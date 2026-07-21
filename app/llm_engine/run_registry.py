"""In-memory registry for asynchronous, cancellable LLM runs.

Each run executes a cascade in its own daemon thread (its own CLI subprocess),
so several runs proceed in parallel without blocking each other or the server.
The registry is the single source of truth for run status across the whole app,
which is what the global status widget and any browser tab read from.
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from llm_engine.providers import ProviderError, RunCancelled, RunControl, run_cascade
from llm_engine.magic_log import MagicLog

DONE_TTL_SEC = 300  # keep finished runs visible this long, then forget them


@dataclass
class LlmRunRecord:
    id: str
    scenario_id: str
    label: str
    selector: str
    status: str  # running | done | failed | cancelled
    started_at: float
    context_label: str = ""
    finished_at: float | None = None
    provider: str | None = None
    profile: str | None = None
    text: str | None = None
    error: str | None = None
    _control: RunControl | None = field(default=None, repr=False, compare=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "scenarioId": self.scenario_id,
            "label": self.label,
            "selector": self.selector,
            "contextLabel": self.context_label,
            "status": self.status,
            "startedAt": int(self.started_at * 1000),
            "finishedAt": int(self.finished_at * 1000) if self.finished_at is not None else None,
            "provider": self.provider,
            "profile": self.profile,
            "text": self.text,
            "error": self.error,
        }


class LlmRunRegistry:
    def __init__(self, magic_log: MagicLog, done_ttl_sec: int = DONE_TTL_SEC) -> None:
        self._runs: dict[str, LlmRunRecord] = {}
        self._lock = threading.Lock()
        self._done_ttl_sec = done_ttl_sec
        self._magic_log = magic_log

    def start(
        self,
        *,
        scenario_id: str,
        label: str,
        selector: str,
        steps: list[dict[str, Any]],
        prompt: str,
        config: dict[str, Any],
        cwd: str,
        context_label: str = "",
    ) -> LlmRunRecord:
        run_id = uuid.uuid4().hex
        record = LlmRunRecord(
            id=run_id,
            scenario_id=scenario_id,
            label=label,
            selector=selector,
            status="running",
            started_at=time.time(),
            context_label=context_label,
            _control=RunControl(),
        )
        with self._lock:
            self._cleanup_locked()
            self._runs[run_id] = record
        self._magic_log.append(record.to_dict())
        threading.Thread(
            target=self._execute,
            args=(record, steps, prompt, config, cwd),
            name=f"llm-run-{run_id[:8]}",
            daemon=True,
        ).start()
        return record

    def get(self, run_id: str) -> LlmRunRecord | None:
        with self._lock:
            self._cleanup_locked()
            return self._runs.get(run_id)

    def list_runs(self) -> list[LlmRunRecord]:
        with self._lock:
            self._cleanup_locked()
            return sorted(self._runs.values(), key=lambda record: record.started_at)

    def cancel(self, run_id: str) -> LlmRunRecord | None:
        with self._lock:
            record = self._runs.get(run_id)
        if record is None:
            return None
        if record.status == "running" and record._control is not None:
            record._control.cancel()
        return record

    def _execute(
        self,
        record: LlmRunRecord,
        steps: list[dict[str, Any]],
        prompt: str,
        config: dict[str, Any],
        cwd: str,
    ) -> None:
        try:
            result = run_cascade(steps, prompt, config, cwd, control=record._control)
            self._finish(
                record,
                "done",
                provider=result.get("provider"),
                profile=result.get("profile"),
                text=result.get("text"),
            )
        except RunCancelled:
            self._finish(record, "cancelled", error="Stopped by user")
        except ProviderError as exc:
            self._finish(record, "failed", error=str(exc))
        except Exception as exc:  # noqa: BLE001 - never let a run thread die silently
            self._finish(record, "failed", error=str(exc))

    def _finish(
        self,
        record: LlmRunRecord,
        status: str,
        *,
        provider: str | None = None,
        profile: str | None = None,
        text: str | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            if record.status != "running":
                return
            record.status = status
            record.finished_at = time.time()
            record.provider = provider
            record.profile = profile
            record.text = text
            record.error = error
            record._control = None
            snapshot = record.to_dict()
        self._magic_log.append(snapshot)

    def _cleanup_locked(self) -> None:
        cutoff = time.time() - self._done_ttl_sec
        stale = [
            run_id
            for run_id, record in self._runs.items()
            if record.status != "running" and (record.finished_at or 0) < cutoff
        ]
        for run_id in stale:
            del self._runs[run_id]
