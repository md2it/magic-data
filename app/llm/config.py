"""Global LLM engine configuration (level 1).

Reads ``config.yaml`` next to this module and merges it over built-in
defaults so a missing or partial file never breaks a run.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from llm.yaml_min import parse_yaml

CONFIG_PATH = (Path(__file__).resolve().parent / "config.yaml").resolve()

DEFAULTS: dict[str, Any] = {
    "default_provider": "codex",
    "timeout_seconds": 600,
    "codex_bin": "codex",
    "codex_sandbox": "workspace-write",
    "codex_network_access": True,
    "claude_bin": "claude",
    "claude_permission_mode": "bypassPermissions",
}


def load_config() -> dict[str, Any]:
    """Return the merged configuration (defaults overlaid with the file)."""
    config = dict(DEFAULTS)
    if CONFIG_PATH.is_file():
        try:
            config.update(parse_yaml(CONFIG_PATH.read_text(encoding="utf-8")))
        except (ValueError, OSError):
            pass
    return config
