"""CLI providers and cascade selection for the Magic-data LLM engine.

Each provider turns a ready prompt into plain text by shelling out to a local
CLI (Codex or Claude Code) in a fresh, isolated session. A run is described by
a *step* — a provider plus an optional model and effort. Steps are grouped into
named *cascades*: ordered lists tried until one succeeds, so a missing CLI, a
connection problem or a deprecated model falls through to the next option
instead of surfacing an error to the user.

Runs are cancellable: an optional RunControl is threaded through the cascade so
a caller (the run registry) can stop the underlying CLI process. Implemented
with :mod:`subprocess` so it works on macOS, Linux and Windows without shell
scripts.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Any

SUPPORTED_PROVIDERS = ("codex", "claude")


class ProviderError(Exception):
    """Raised when a provider is unavailable or its CLI run fails."""


class RunCancelled(Exception):
    """Raised when a run was stopped by the user before finishing."""


class RunControl:
    """Cooperative cancellation shared with a running cascade.

    The cascade checks ``cancelled`` between steps; the active CLI subprocess is
    registered here so a cancel can terminate it immediately.
    """

    def __init__(self) -> None:
        self.cancelled = False
        self._process: subprocess.Popen[str] | None = None
        self._lock = threading.Lock()

    def register(self, process: subprocess.Popen[str]) -> None:
        with self._lock:
            self._process = process
            cancel_now = self.cancelled
        if cancel_now:
            _terminate(process)

    def unregister(self) -> None:
        with self._lock:
            self._process = None

    def cancel(self) -> None:
        with self._lock:
            self.cancelled = True
            process = self._process
        if process is not None:
            _terminate(process)


# ----------------------------------------------------------------------------
# Cascade selection
# ----------------------------------------------------------------------------

def resolve_steps(selector: str | None, config: dict[str, Any]) -> list[dict[str, Any]]:
    """Turn a selector into the ordered list of run steps to try.

    A selector may be a cascade name, a profile name, or a bare provider.
    Returns an empty list when the selector cannot be resolved.
    """
    selector = selector or config.get("default_provider") or "auto"
    profiles = config.get("profiles") if isinstance(config.get("profiles"), dict) else {}
    cascades = config.get("cascades") if isinstance(config.get("cascades"), dict) else {}

    if selector in cascades and isinstance(cascades[selector], list):
        steps = [_profile_step(name, profiles) for name in cascades[selector]]
        return [step for step in steps if step]
    if selector in profiles:
        step = _profile_step(selector, profiles)
        return [step] if step else []
    if selector in SUPPORTED_PROVIDERS:
        return [{"provider": selector, "label": selector}]
    if selector == "auto":
        return [{"provider": provider, "label": provider} for provider in SUPPORTED_PROVIDERS]
    return []


def _profile_step(name: Any, profiles: dict[str, Any]) -> dict[str, Any] | None:
    profile = profiles.get(name) if isinstance(name, str) else None
    if not isinstance(profile, dict):
        if name in SUPPORTED_PROVIDERS:
            return {"provider": name, "label": name}
        return None
    provider = profile.get("provider")
    if provider not in SUPPORTED_PROVIDERS:
        return None
    return {
        "provider": provider,
        "model": profile.get("model"),
        "effort": profile.get("effort"),
        "label": name,
    }


def run_cascade(
    steps: list[dict[str, Any]],
    prompt: str,
    config: dict[str, Any],
    cwd: str,
    control: RunControl | None = None,
) -> dict[str, Any]:
    """Try each step until one succeeds; raise if all of them fail.

    Raises RunCancelled if ``control`` was cancelled while trying.
    """
    errors: list[str] = []
    for step in steps:
        if control is not None and control.cancelled:
            raise RunCancelled()
        label = step.get("label") or step["provider"]
        try:
            text = run_provider(
                step["provider"],
                prompt,
                config,
                cwd,
                model=step.get("model"),
                effort=step.get("effort"),
                control=control,
            )
            return {"text": text, "provider": step["provider"], "profile": label}
        except RunCancelled:
            raise
        except ProviderError as error:
            if control is not None and control.cancelled:
                raise RunCancelled()
            errors.append(f"{label}: {error}")
    raise ProviderError("All providers failed:\n" + "\n".join(errors))


# ----------------------------------------------------------------------------
# Providers
# ----------------------------------------------------------------------------

def run_provider(
    provider: str,
    prompt: str,
    config: dict[str, Any],
    cwd: str,
    model: str | None = None,
    effort: str | None = None,
    control: RunControl | None = None,
) -> str:
    """Run ``prompt`` through ``provider`` and return its final text output."""
    if provider == "codex":
        return _run_codex(prompt, config, cwd, model, effort, control)
    if provider == "claude":
        return _run_claude(prompt, config, cwd, model, effort, control)
    raise ProviderError(f"Unsupported provider: {provider}")


def _run_codex(
    prompt: str,
    config: dict[str, Any],
    cwd: str,
    model: str | None,
    effort: str | None,
    control: RunControl | None,
) -> str:
    codex_bin = str(config.get("codex_bin", "codex"))
    _require(codex_bin, "Codex CLI not found. Install it or set codex_bin in config.yaml.")

    sandbox = str(config.get("codex_sandbox", "workspace-write"))
    network = "true" if config.get("codex_network_access", True) else "false"
    args = [
        codex_bin,
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        sandbox,
        "-c",
        f"sandbox_workspace_write.network_access={network}",
        "--cd",
        cwd,
    ]
    if model:
        args += ["-m", str(model)]
    if effort:
        args += ["-c", f'model_reasoning_effort="{effort}"']

    out_file = Path(tempfile.mktemp(suffix=".txt"))
    args += ["--output-last-message", str(out_file), "-"]
    try:
        stdout = _run(args, prompt, config, cwd, control)
        if out_file.is_file():
            message = out_file.read_text(encoding="utf-8").strip()
            if message:
                return message
        return stdout.strip()
    finally:
        out_file.unlink(missing_ok=True)


def _run_claude(
    prompt: str,
    config: dict[str, Any],
    cwd: str,
    model: str | None,
    effort: str | None,
    control: RunControl | None,
) -> str:
    claude_bin = str(config.get("claude_bin", "claude"))
    _require(claude_bin, "Claude CLI not found. Install it or set claude_bin in config.yaml.")

    permission_mode = str(config.get("claude_permission_mode", "bypassPermissions"))
    args = [
        claude_bin,
        "--print",
        "--no-session-persistence",
        "--output-format",
        "text",
        "--permission-mode",
        permission_mode,
        "--add-dir",
        cwd,
    ]
    if model:
        args += ["--model", str(model)]
    if effort:
        args += ["--effort", str(effort)]

    return _run(args, prompt, config, cwd, control).strip()


def _require(binary: str, message: str) -> None:
    if shutil.which(binary) is None and not Path(binary).is_file():
        raise ProviderError(message)


def _run(
    args: list[str],
    prompt: str,
    config: dict[str, Any],
    cwd: str,
    control: RunControl | None = None,
) -> str:
    """Run one CLI process to completion and return its stdout.

    The process runs in its own session/process group so a cancel can take down
    the whole tree. Raises RunCancelled if cancelled, ProviderError otherwise.
    """
    timeout = _timeout(config)
    kwargs: dict[str, Any] = dict(
        cwd=cwd,
        text=True,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if os.name == "posix":
        kwargs["start_new_session"] = True
    else:
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

    try:
        process = subprocess.Popen(args, **kwargs)
    except OSError as exc:
        raise ProviderError(f"Could not start provider: {exc}") from exc

    if control is not None:
        control.register(process)
    try:
        stdout, stderr = process.communicate(input=prompt, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        _terminate(process)
        try:
            process.communicate(timeout=5)
        except Exception:
            pass
        raise ProviderError(f"Provider timed out after {timeout}s.") from exc
    finally:
        if control is not None:
            control.unregister()

    if control is not None and control.cancelled:
        raise RunCancelled()
    if process.returncode != 0:
        error = (stderr or stdout or "").strip()
        raise ProviderError(error or f"Provider exited with code {process.returncode}.")
    return stdout


def _terminate(process: subprocess.Popen[str]) -> None:
    """Best-effort stop of a running process (and its group on POSIX)."""
    if process.poll() is not None:
        return
    try:
        if os.name == "posix":
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        else:
            process.terminate()
    except (ProcessLookupError, OSError):
        return
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            if os.name == "posix":
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            else:
                process.kill()
        except (ProcessLookupError, OSError):
            pass


def _timeout(config: dict[str, Any]) -> int:
    try:
        return max(1, int(config.get("timeout_seconds", 600)))
    except (TypeError, ValueError):
        return 600
