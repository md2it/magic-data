"""A tiny dependency-free YAML reader.

Only the subset used by Magic-data LLM configuration is supported: scalar
values, one level of nested maps, simple lists (``  - item`` and
``    - item``) and block scalars (``key: |``). This keeps the app free of a
third-party YAML dependency, exactly as the reference project does.
"""

from __future__ import annotations

from typing import Any


def parse_yaml(text: str) -> dict[str, Any]:
    """Parse a small YAML document into a dictionary."""
    result: dict[str, Any] = {}
    current_map: dict[str, Any] | None = None
    current_parent: dict[str, Any] | None = None
    current_list_key: str | None = None
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        if line.startswith("    - ") and current_parent is not None and current_list_key is not None:
            current_parent[current_list_key].append(_coerce(line.strip()[2:].strip()))
            i += 1
            continue
        if line.startswith("  ") and current_map is not None:
            key, value = _split_scalar(line.strip())
            if value == "":
                next_line = lines[i + 1] if i + 1 < len(lines) else ""
                if next_line.startswith("    - "):
                    current_map[key] = []
                    current_parent = current_map
                    current_list_key = key
                else:
                    nested: dict[str, Any] = {}
                    current_map[key] = nested
                    current_parent = current_map
                    current_list_key = None
            elif value == "[]":
                current_map[key] = []
                current_parent = current_map
                current_list_key = key
            else:
                current_map[key] = _coerce(value)
                current_parent = None
                current_list_key = None
            i += 1
            continue
        current_map = None
        current_parent = None
        current_list_key = None
        key, value = _split_scalar(line)
        if value == "|":
            block: list[str] = []
            i += 1
            while i < len(lines):
                block_line = lines[i]
                if block_line.startswith("  "):
                    block.append(block_line[2:])
                    i += 1
                    continue
                if not block_line.strip():
                    block.append("")
                    i += 1
                    continue
                break
            result[key] = "\n".join(block).rstrip() + "\n"
            continue
        if value == "":
            nested = {}
            result[key] = nested
            current_map = nested
        else:
            result[key] = _coerce(value)
        i += 1
    return result


def _split_scalar(line: str) -> tuple[str, str]:
    key, separator, value = line.partition(":")
    if not separator:
        raise ValueError(f"Invalid YAML line: {line}")
    return key.strip(), value.strip()


def _coerce(value: str) -> Any:
    """Turn a scalar string into bool/int where it obviously is one."""
    lowered = value.lower()
    if lowered in {"true", "yes"}:
        return True
    if lowered in {"false", "no"}:
        return False
    if lowered in {"null", "~", "none"}:
        return None
    if value and (value.lstrip("-").isdigit()):
        return int(value)
    if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
        return value[1:-1]
    return value
