"""A tiny dependency-free YAML reader.

Supports the subset used by Magic-data configuration: nested maps (any
depth), lists of scalars and lists of maps, block scalars (``key: |``),
compact inline maps/lists (``{a: 1, b: 2}`` / ``[a, b]``) and scalar
coercion. This keeps the app free of a third-party YAML dependency.

Indentation must use spaces. Comments (``#``) and blank lines are ignored
outside of block scalars.
"""

from __future__ import annotations

from typing import Any


def parse_yaml(text: str) -> dict[str, Any]:
    """Parse a small YAML document into a dictionary."""
    lines = text.split("\n")
    value, _ = _parse_block(lines, 0, 0)
    return value if isinstance(value, dict) else {}


def _parse_block(lines: list[str], i: int, indent: int) -> tuple[Any, int]:
    j = _next_significant(lines, i)
    if j >= len(lines) or _indent(lines[j]) < indent:
        return None, i
    if lines[j].strip().startswith("- "):
        return _parse_list(lines, i, _indent(lines[j]))
    return _parse_map(lines, i, _indent(lines[j]))


def _parse_map(lines: list[str], i: int, indent: int) -> tuple[dict[str, Any], int]:
    result: dict[str, Any] = {}
    n = len(lines)
    while i < n:
        if _is_skippable(lines[i]):
            i += 1
            continue
        ind = _indent(lines[i])
        if ind < indent:
            break
        if ind > indent:  # defensive: unexpected deeper line
            i += 1
            continue
        key, _, rest = lines[i].strip().partition(":")
        key = key.strip()
        rest = rest.strip()
        if rest == "|":
            result[key], i = _parse_block_scalar(lines, i + 1, indent)
        elif rest == "":
            child = _next_significant(lines, i + 1)
            if child < n and _indent(lines[child]) > indent:
                result[key], i = _parse_block(lines, i + 1, _indent(lines[child]))
            else:
                result[key] = None
                i += 1
        else:
            result[key] = _parse_scalar(rest)
            i += 1
    return result, i


def _parse_list(lines: list[str], i: int, indent: int) -> tuple[list[Any], int]:
    result: list[Any] = []
    n = len(lines)
    while i < n:
        if _is_skippable(lines[i]):
            i += 1
            continue
        ind = _indent(lines[i])
        if ind < indent or not lines[i].strip().startswith("-"):
            break
        if ind > indent:
            break
        item = lines[i].strip()[1:].strip()
        if item == "":
            child = _next_significant(lines, i + 1)
            if child < n and _indent(lines[child]) > indent:
                value, i = _parse_block(lines, i + 1, _indent(lines[child]))
                result.append(value)
            else:
                result.append(None)
                i += 1
        elif ":" in item and not item.startswith(("{", "[", '"', "'")):
            # A list item that starts a map: "- key: value" plus any deeper lines.
            value, i = _collect_list_map(lines, i, indent)
            result.append(value)
        else:
            result.append(_parse_scalar(item))
            i += 1
    return result, i


def _collect_list_map(lines: list[str], i: int, indent: int) -> tuple[dict[str, Any], int]:
    # Rewrite "- " as spaces so the item and its continuation form one map block.
    first = lines[i]
    dash = first.index("-")
    virtual = [first[:dash] + " " + first[dash + 1:]]
    i += 1
    n = len(lines)
    while i < n and (_is_skippable(lines[i]) or _indent(lines[i]) > indent):
        virtual.append(lines[i])
        i += 1
    value, _ = _parse_map(virtual, 0, _indent(virtual[0]))
    return value, i


def _parse_block_scalar(lines: list[str], i: int, key_indent: int) -> tuple[str, int]:
    block: list[str] = []
    n = len(lines)
    while i < n:
        if lines[i].strip() == "":
            block.append("")
            i += 1
            continue
        if _indent(lines[i]) > key_indent:
            block.append(lines[i])
            i += 1
            continue
        break
    non_empty = [line for line in block if line != ""]
    base = min((_indent(line) for line in non_empty), default=0)
    dedented = "\n".join(line[base:] if line != "" else "" for line in block)
    return dedented.rstrip() + "\n", i


def _parse_scalar(value: str) -> Any:
    if value.startswith("{") and value.endswith("}"):
        return _parse_flow_map(value[1:-1])
    if value.startswith("[") and value.endswith("]"):
        return [_coerce(part.strip()) for part in value[1:-1].split(",") if part.strip()]
    return _coerce(value)


def _parse_flow_map(inner: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for part in inner.split(","):
        if not part.strip():
            continue
        key, _, val = part.partition(":")
        result[key.strip()] = _coerce(val.strip())
    return result


def _coerce(value: str) -> Any:
    lowered = value.lower()
    if lowered in {"true", "yes"}:
        return True
    if lowered in {"false", "no"}:
        return False
    if lowered in {"null", "~", "none"}:
        return None
    if value and value.lstrip("-").isdigit():
        return int(value)
    if len(value) >= 2 and value[0] in "\"'" and value[-1] == value[0]:
        return value[1:-1]
    return value


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _is_skippable(line: str) -> bool:
    stripped = line.strip()
    return stripped == "" or stripped.startswith("#")


def _next_significant(lines: list[str], i: int) -> int:
    while i < len(lines) and _is_skippable(lines[i]):
        i += 1
    return i
