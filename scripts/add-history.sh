#!/usr/bin/env bash
# Prepend a metadata.versions entry to a data JSON document (newest first).
# Versions is an object keyed by vN (e.g. v3, v2, v1).
# Usage: ./scripts/add-history.sh <file.json> "<comment>"
set -euo pipefail

usage() {
  echo "Usage: $0 <file.json> \"<comment>\"" >&2
  exit 1
}

if [[ $# -ne 2 ]]; then
  usage
fi

FILE=$1
COMMENT=$2

if [[ ! -f "$FILE" ]]; then
  echo "Error: file not found: $FILE" >&2
  exit 1
fi

# Prefer the project venv interpreter when available; fall back to python3.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
else
  echo "Error: python3 is required" >&2
  exit 1
fi

export ADD_HISTORY_FILE=$FILE
export ADD_HISTORY_COMMENT=$COMMENT

"$PYTHON" - <<'PY'
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

VERSION_KEY_RE = re.compile(r"^v([1-9]\d*)$")


def fail(message: str) -> None:
    print(f"Error: {message}", file=sys.stderr)
    sys.exit(1)


def detect_indent_unit(raw: str) -> str:
    for line in raw.splitlines():
        if not line or line.lstrip() == line:
            continue
        if line[0] == "\t":
            return "\t"
        spaces = len(line) - len(line.lstrip(" "))
        if spaces > 0:
            if spaces % 4 == 0:
                return "    "
            return "  "
    return "  "


def skip_ws(s: str, i: int) -> int:
    n = len(s)
    while i < n and s[i] in " \t\r\n":
        i += 1
    return i


def match_string(s: str, i: int):
    """If s[i] is '\"', return (decoded_string, index_after_string); else None."""
    if i >= len(s) or s[i] != '"':
        return None
    i += 1
    chars = []
    while i < len(s):
        ch = s[i]
        if ch == "\\":
            if i + 1 >= len(s):
                return None
            chars.append(s[i : i + 2])
            i += 2
            continue
        if ch == '"':
            raw_token = '"' + "".join(chars) + '"'
            try:
                return json.loads(raw_token), i + 1
            except json.JSONDecodeError:
                return None
        chars.append(ch)
        i += 1
    return None


def find_matching(s: str, open_idx: int) -> int:
    open_ch = s[open_idx]
    close_ch = "]" if open_ch == "[" else "}"
    depth = 0
    i = open_idx
    in_string = False
    escape = False
    while i < len(s):
        ch = s[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
        else:
            if ch == '"':
                in_string = True
            elif ch == open_ch:
                depth += 1
            elif ch == close_ch:
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return -1


def skip_value(s: str, i: int) -> int:
    i = skip_ws(s, i)
    if i >= len(s):
        return -1
    ch = s[i]
    if ch == '"':
        matched = match_string(s, i)
        return -1 if matched is None else matched[1]
    if ch in "{[":
        end = find_matching(s, i)
        return -1 if end < 0 else end + 1
    if ch in "-0123456789":
        m = re.match(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?", s[i:])
        return -1 if not m else i + m.end()
    for lit in ("true", "false", "null"):
        if s.startswith(lit, i):
            return i + len(lit)
    return -1


def iter_object_properties(s: str, obj_start: int):
    """Yield (key, key_start, value_start, value_end) for a JSON object."""
    if obj_start < 0 or obj_start >= len(s) or s[obj_start] != "{":
        return
    i = skip_ws(s, obj_start + 1)
    if i < len(s) and s[i] == "}":
        return
    while i < len(s):
        key_start = i
        matched = match_string(s, i)
        if matched is None:
            return
        key, i = matched
        i = skip_ws(s, i)
        if i >= len(s) or s[i] != ":":
            return
        i = skip_ws(s, i + 1)
        value_start = i
        value_end = skip_value(s, i)
        if value_end < 0:
            return
        yield key, key_start, value_start, value_end
        i = skip_ws(s, value_end)
        if i < len(s) and s[i] == ",":
            i = skip_ws(s, i + 1)
            continue
        return


def find_root_object_start(s: str) -> int:
    i = skip_ws(s, 0)
    return i if i < len(s) and s[i] == "{" else -1


def parse_version_number(key: str) -> int:
    matched = VERSION_KEY_RE.fullmatch(key)
    if matched is None:
        fail(f"metadata.versions keys must look like v1, v2, ... (got {key!r})")
    return int(matched.group(1))


def next_version_number(versions: dict) -> int:
    if not versions:
        return 1
    return max(parse_version_number(key) for key in versions) + 1


def format_version_prop(version_key: str, entry: dict, prop_indent: str, indent_unit: str) -> str:
    field_indent = prop_indent + indent_unit
    return "\n".join(
        [
            f'{prop_indent}"{version_key}": {{',
            f'{field_indent}"at": {json.dumps(entry["at"], ensure_ascii=False)},',
            f'{field_indent}"comment": {json.dumps(entry["comment"], ensure_ascii=False)}',
            f"{prop_indent}}}",
        ]
    )


def newline_before(s: str, idx: int) -> bool:
    j = idx - 1
    while j >= 0 and s[j] in " \t":
        j -= 1
    return j >= 0 and s[j] == "\n"


def surgical_insert(raw: str, version_key: str, entry: dict, indent_unit: str):
    root_start = find_root_object_start(raw)
    if root_start < 0:
        return None

    props = list(iter_object_properties(raw, root_start))
    meta_prop = next((p for p in props if p[0] == "metadata"), None)

    # No metadata: insert a new metadata object as the first root property.
    if meta_prop is None:
        root_end = find_matching(raw, root_start)
        if root_end < 0:
            return None
        body_indent = indent_unit
        versions_indent = indent_unit * 2
        entry_prop = format_version_prop(version_key, entry, versions_indent + indent_unit, indent_unit)
        block = (
            f'{body_indent}"metadata": {{\n'
            f'{versions_indent}"versions": {{\n'
            f"{entry_prop}\n"
            f"{versions_indent}}}\n"
            f"{body_indent}}}"
        )
        inner = skip_ws(raw, root_start + 1)
        if inner < root_end:
            block += ","
            if not newline_before(raw, inner):
                block += "\n"
            return raw[: root_start + 1] + "\n" + block + raw[inner:]
        return raw[: root_start + 1] + "\n" + block + "\n" + raw[root_end:]

    _key, _ks, meta_value_start, meta_value_end = meta_prop
    if raw[meta_value_start] != "{":
        return None

    meta_props = list(iter_object_properties(raw, meta_value_start))
    versions_prop = next((p for p in meta_props if p[0] == "versions"), None)

    # metadata.versions exists: prepend (or fill empty object) without rewriting the file.
    if versions_prop is not None:
        _hk, _hks, versions_start, versions_end = versions_prop
        if raw[versions_start] != "{":
            return None
        close_idx = versions_end - 1
        if close_idx < versions_start or raw[close_idx] != "}":
            return None

        object_inner = raw[versions_start + 1 : close_idx]
        empty = object_inner.strip() == ""

        versions_key_start = versions_prop[1]
        versions_key_line_start = raw.rfind("\n", 0, versions_key_start) + 1
        versions_key_indent = raw[versions_key_line_start:versions_key_start]
        prop_indent = versions_key_indent + indent_unit
        entry_prop = format_version_prop(version_key, entry, prop_indent, indent_unit)

        if empty:
            insertion = f"\n{entry_prop}\n{versions_key_indent}"
            return raw[: versions_start + 1] + insertion + raw[close_idx:]

        # Non-empty: insert at the front, with a trailing comma after the new property.
        insertion = f"\n{entry_prop},"
        return raw[: versions_start + 1] + insertion + raw[versions_start + 1 :]

    # metadata exists but no versions: add versions as the last metadata property.
    meta_close = meta_value_end - 1
    if meta_close < meta_value_start or raw[meta_close] != "}":
        return None
    meta_key_start = meta_prop[1]
    meta_key_line_start = raw.rfind("\n", 0, meta_key_start) + 1
    close_indent = raw[meta_key_line_start:meta_key_start]
    if meta_props:
        first_key_start = meta_props[0][1]
        prop_line_start = raw.rfind("\n", 0, first_key_start) + 1
        prop_indent = raw[prop_line_start:first_key_start]
    else:
        prop_indent = close_indent + indent_unit
    entry_prop = format_version_prop(version_key, entry, prop_indent + indent_unit, indent_unit)
    versions_block = (
        f'{prop_indent}"versions": {{\n'
        f"{entry_prop}\n"
        f"{prop_indent}}}"
    )

    inner = skip_ws(raw, meta_value_start + 1)
    if inner == meta_close:
        insertion = f"\n{versions_block}\n{close_indent}"
        return raw[: meta_value_start + 1] + insertion + raw[meta_close:]

    last_non_ws = meta_close - 1
    while last_non_ws > meta_value_start and raw[last_non_ws] in " \t\r\n":
        last_non_ws -= 1
    insertion = f",\n{versions_block}"
    return raw[: last_non_ws + 1] + insertion + "\n" + close_indent + raw[meta_close:]


def atomic_write(path: Path, text: str) -> None:
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as tmp:
            tmp.write(text)
            tmp.flush()
            os.fsync(tmp.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def main() -> None:
    path = Path(os.environ["ADD_HISTORY_FILE"])
    comment = os.environ["ADD_HISTORY_COMMENT"]

    if comment == "":
        fail("comment must be a non-empty single line")
    if "\n" in comment or "\r" in comment:
        fail("comment must be a single line (no newlines)")
    if len(comment) > 80:
        fail("comment must be at most 80 Unicode characters")

    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"cannot read file: {exc}")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON: {exc}")

    if not isinstance(data, dict):
        fail("JSON root must be an object")

    metadata = data.get("metadata")
    if metadata is None:
        versions = {}
    elif not isinstance(metadata, dict):
        fail("metadata must be an object")
    else:
        versions = metadata.get("versions", {})
        if "versions" in metadata and not isinstance(versions, dict):
            fail("metadata.versions must be an object")
        if not isinstance(versions, dict):
            fail("metadata.versions must be an object")
        for key in versions:
            parse_version_number(key)

    next_version = next_version_number(versions)
    version_key = f"v{next_version}"

    entry = {
        "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "comment": comment,
    }

    indent_unit = detect_indent_unit(raw)
    text = surgical_insert(raw, version_key, entry, indent_unit)

    # Fallback: full rewrite only when surgical editing cannot locate structure.
    if text is None:
        if metadata is None:
            data = {"metadata": {"versions": {version_key: entry}}, **data}
        else:
            metadata = data.setdefault("metadata", {})
            existing = metadata.get("versions")
            if not isinstance(existing, dict):
                existing = {}
            rebuilt = {version_key: entry}
            for key, value in existing.items():
                if key != version_key:
                    rebuilt[key] = value
            metadata["versions"] = rebuilt
        dump_indent = 4 if indent_unit == "    " else 2
        text = json.dumps(data, ensure_ascii=False, indent=dump_indent)
        if raw.endswith("\n"):
            text += "\n"

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        fail(f"internal error: produced invalid JSON ({exc})")

    out_meta = parsed.get("metadata")
    if not isinstance(out_meta, dict) or not isinstance(out_meta.get("versions"), dict):
        fail("internal error: versions missing after update")
    out_versions = out_meta["versions"]
    if version_key not in out_versions:
        fail("internal error: new versions entry not applied")
    if out_versions[version_key].get("comment") != comment:
        fail("internal error: new versions entry not applied")
    first_key = next(iter(out_versions))
    if first_key != version_key:
        fail("internal error: newest versions key is not first")
    if metadata is not None and isinstance(metadata, dict):
        if "description" in metadata and metadata["description"] != out_meta.get("description"):
            fail("internal error: metadata.description changed")

    try:
        atomic_write(path, text)
    except OSError as exc:
        fail(f"cannot write file: {exc}")

    print(f"Added versions entry {version_key} to {path}")


if __name__ == "__main__":
    main()
PY
