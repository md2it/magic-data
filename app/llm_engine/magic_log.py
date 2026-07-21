"""Persistent, append-only journal of Magic runs."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any


class MagicLog:
    """Stores run snapshots as JSON Lines and materializes the latest state."""

    def __init__(self, path: Path, session_id: str) -> None:
        self._path = path
        self.session_id = session_id
        self._lock = threading.Lock()

    def append(self, run: dict[str, Any]) -> None:
        """Append one run snapshot, creating `.user/` only on first run."""
        event = {"sessionId": self.session_id, **run}
        line = json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n"
        with self._lock:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            with self._path.open("a", encoding="utf-8") as file:
                file.write(line)

    def list_runs(self) -> list[dict[str, Any]]:
        """Return the most recent snapshot of each run, newest first."""
        with self._lock:
            if not self._path.is_file():
                return []
            latest: dict[str, dict[str, Any]] = {}
            with self._path.open("r", encoding="utf-8") as file:
                for line in file:
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    run_id = entry.get("id")
                    if isinstance(run_id, str):
                        latest[run_id] = entry
        return sorted(latest.values(), key=lambda run: run.get("startedAt", 0), reverse=True)
