"""CLI providers for the Magic-data LLM engine.

Each provider turns a ready prompt into plain text by shelling out to a local
CLI (Codex or Claude Code) in a fresh, isolated session. Implemented directly
with :mod:`subprocess` so it works on macOS, Linux and Windows without shell
scripts.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

SUPPORTED_PROVIDERS = ("codex", "claude")


class ProviderError(Exception):
    """Raised when a provider is unavailable or its CLI run fails."""


def run_provider(provider: str, prompt: str, config: dict[str, Any], cwd: str) -> str:
    """Run ``prompt`` through ``provider`` and return its final text output."""
    if provider == "codex":
        return _run_codex(prompt, config, cwd)
    if provider == "claude":
        return _run_claude(prompt, config, cwd)
    raise ProviderError(f"Unsupported provider: {provider}")


def _run_codex(prompt: str, config: dict[str, Any], cwd: str) -> str:
    codex_bin = str(config.get("codex_bin", "codex"))
    _require(codex_bin, "Codex CLI not found. Install it or set codex_bin in config.yaml.")

    sandbox = str(config.get("codex_sandbox", "workspace-write"))
    network = "true" if config.get("codex_network_access", True) else "false"
    out_file = Path(tempfile.mktemp(suffix=".txt"))
    try:
        completed = _run(
            [
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
                "--output-last-message",
                str(out_file),
                "-",
            ],
            prompt,
            config,
            cwd,
        )
        if out_file.is_file():
            message = out_file.read_text(encoding="utf-8").strip()
            if message:
                return message
        return completed.stdout.strip()
    finally:
        out_file.unlink(missing_ok=True)


def _run_claude(prompt: str, config: dict[str, Any], cwd: str) -> str:
    claude_bin = str(config.get("claude_bin", "claude"))
    _require(claude_bin, "Claude CLI not found. Install it or set claude_bin in config.yaml.")

    permission_mode = str(config.get("claude_permission_mode", "bypassPermissions"))
    completed = _run(
        [
            claude_bin,
            "--print",
            "--no-session-persistence",
            "--output-format",
            "text",
            "--permission-mode",
            permission_mode,
            "--add-dir",
            cwd,
        ],
        prompt,
        config,
        cwd,
    )
    return completed.stdout.strip()


def _require(binary: str, message: str) -> None:
    if shutil.which(binary) is None and not Path(binary).is_file():
        raise ProviderError(message)


def _run(
    args: list[str], prompt: str, config: dict[str, Any], cwd: str
) -> subprocess.CompletedProcess[str]:
    timeout = _timeout(config)
    try:
        completed = subprocess.run(
            args,
            input=prompt,
            cwd=cwd,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise ProviderError(f"Provider timed out after {timeout}s.") from exc
    except OSError as exc:
        raise ProviderError(f"Could not start provider: {exc}") from exc
    if completed.returncode != 0:
        error = (completed.stderr or completed.stdout or "").strip()
        raise ProviderError(error or f"Provider exited with code {completed.returncode}.")
    return completed


def _timeout(config: dict[str, Any]) -> int:
    try:
        return max(1, int(config.get("timeout_seconds", 600)))
    except (TypeError, ValueError):
        return 600
