"""Loading and rendering of Magic-data LLM scenarios.

A scenario is a single YAML file in ``app/llm-scenarios/``. It carries the
prompt template, UI metadata and the list of required/optional context fields.
This is the first configuration level: everything a prompt needs by default
lives here. Per-call customization (provider override, extra context, extra
instructions) is layered on top at request time.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from llm.yaml_min import parse_yaml

SCENARIOS_DIR = (Path(__file__).resolve().parent.parent / "llm-scenarios").resolve()
SCENARIO_ID_CHARS = frozenset("abcdefghijklmnopqrstuvwxyz0123456789-_")
PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")


def load_scenario(scenario_id: str) -> dict[str, Any] | None:
    """Return the parsed scenario, or ``None`` if the id is unknown/invalid."""
    if not _valid_scenario_id(scenario_id):
        return None
    path = (SCENARIOS_DIR / f"{scenario_id}.yaml").resolve()
    if SCENARIOS_DIR not in path.parents or not path.is_file():
        return None
    scenario = parse_yaml(path.read_text(encoding="utf-8"))
    scenario.setdefault("id", scenario_id)
    return scenario


def render_prompt(
    scenario: dict[str, Any],
    context: dict[str, Any] | None = None,
    extra: str = "",
) -> str:
    """Render the scenario prompt for a single call.

    ``context`` fills ``{{placeholders}}``. A ``runtime`` namespace with a
    fresh ``session_id`` is always injected so each run is isolated. ``extra``
    is optional free-text appended as additional instructions (the second,
    per-call configuration level).
    """
    context = dict(context or {})
    now = datetime.now(timezone.utc).isoformat()
    runtime = {"session_id": now, "timestamp": now}
    if isinstance(context.get("runtime"), dict):
        runtime.update(context["runtime"])
    context["runtime"] = runtime

    required = scenario.get("context", {}).get("required", [])
    if not isinstance(required, list):
        required = []
    missing = [path for path in required if _get_by_path(context, path) is None]
    if missing:
        raise ValueError(f"Missing context fields: {', '.join(missing)}")

    template = scenario.get("prompt")
    if not isinstance(template, str) or not template.strip():
        raise ValueError("Scenario prompt is empty")

    def replace(match: re.Match[str]) -> str:
        value = _get_by_path(context, match.group(1))
        return "" if value is None else str(value)

    prompt = PLACEHOLDER_RE.sub(replace, template)
    if extra and extra.strip():
        prompt = f"{prompt.rstrip()}\n\n# Additional instructions\n{extra.strip()}\n"
    return prompt


def _valid_scenario_id(scenario_id: str) -> bool:
    return bool(scenario_id) and all(ch in SCENARIO_ID_CHARS for ch in scenario_id)


def _get_by_path(value: Any, path: str) -> Any:
    current: Any = value
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
        if current is None:
            return None
    return current
