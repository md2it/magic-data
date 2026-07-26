#!/usr/bin/env bash
# Regression tests for scripts/add-history.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/add-history.sh"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/add-history-test.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

pass=0
fail=0

assert_ok() {
  local name=$1
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name" >&2
    fail=$((fail + 1))
  fi
}

assert_fail() {
  local name=$1
  shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL: $name (expected failure)" >&2
    fail=$((fail + 1))
  else
    echo "PASS: $name"
    pass=$((pass + 1))
  fi
}

assert_eq() {
  local name=$1 expected=$2 actual=$3
  if [[ "$expected" == "$actual" ]]; then
    echo "PASS: $name"
    pass=$((pass + 1))
  else
    echo "FAIL: $name (expected='$expected' actual='$actual')" >&2
    fail=$((fail + 1))
  fi
}

PYTHON="$ROOT/.venv/bin/python"
[[ -x "$PYTHON" ]] || PYTHON="$(command -v python3)"

# --- first entry keyed v1 ---
cat > "$TMP/doc.json" <<'EOF'
{
  "metadata": {
    "description": "Keep me"
  },
  "schema": {},
  "items": []
}
EOF
"$SCRIPT" "$TMP/doc.json" "Added change history" >/dev/null
first="$("$PYTHON" -c "import json; v=json.load(open('$TMP/doc.json'))['metadata']['versions']; k=next(iter(v)); print(k, list(v), v[k]['comment'])")"
assert_eq "first entry is v1" "v1 ['v1'] Added change history" "$first"

# --- next entry is prepended as v2 ---
"$SCRIPT" "$TMP/doc.json" "Second change" >/dev/null
v2="$("$PYTHON" -c "import json; v=json.load(open('$TMP/doc.json'))['metadata']['versions']; print(list(v), v['v2']['comment'])")"
assert_eq "second entry prepended as v2" "['v2', 'v1'] Second change" "$v2"

# --- description preserved ---
desc="$("$PYTHON" -c "import json; print(json.load(open('$TMP/doc.json'))['metadata']['description'])")"
assert_eq "description preserved" "Keep me" "$desc"

# --- comment of exactly 80 chars accepted ---
eighty="$(python3 -c 'print("あ"*80)')"
assert_ok "80 Unicode chars accepted" "$SCRIPT" "$TMP/doc.json" "$eighty"
last_comment="$("$PYTHON" -c "import json; v=json.load(open('$TMP/doc.json'))['metadata']['versions']; print(v[next(iter(v))]['comment'])")"
assert_eq "80-char comment stored as newest" "$eighty" "$last_comment"

# --- 81 chars rejected ---
eighty_one="$(python3 -c 'print("あ"*81)')"
before="$("$PYTHON" -c "import json; print(len(json.load(open('$TMP/doc.json'))['metadata']['versions']))")"
assert_fail "81 Unicode chars rejected" "$SCRIPT" "$TMP/doc.json" "$eighty_one"
after="$("$PYTHON" -c "import json; print(len(json.load(open('$TMP/doc.json'))['metadata']['versions']))")"
assert_eq "versions unchanged after 81-char reject" "$before" "$after"

# --- empty comment rejected ---
assert_fail "empty comment rejected" "$SCRIPT" "$TMP/doc.json" ""

# --- multiline comment rejected ---
assert_fail "multiline comment rejected" "$SCRIPT" "$TMP/doc.json" $'line1\nline2'

# --- invalid JSON not overwritten ---
echo '{not json' > "$TMP/bad.json"
cp "$TMP/bad.json" "$TMP/bad.json.bak"
assert_fail "invalid JSON rejected" "$SCRIPT" "$TMP/bad.json" "should fail"
if cmp -s "$TMP/bad.json" "$TMP/bad.json.bak"; then
  echo "PASS: invalid JSON file left untouched"
  pass=$((pass + 1))
else
  echo "FAIL: invalid JSON file was modified" >&2
  fail=$((fail + 1))
fi

# --- missing versions created; metadata created when absent ---
echo '{"schema":{},"items":[]}' > "$TMP/plain.json"
"$SCRIPT" "$TMP/plain.json" "init" >/dev/null
"$PYTHON" - <<PY
import json
doc = json.load(open("$TMP/plain.json"))
assert "metadata" in doc
assert list(doc["metadata"]["versions"]) == ["v1"]
assert doc["metadata"]["versions"]["v1"]["comment"] == "init"
print("ok")
PY
echo "PASS: creates metadata.versions when absent"
pass=$((pass + 1))

# --- versions array (old shape) rejected ---
cat > "$TMP/asarray.json" <<'EOF'
{
  "metadata": {
    "description": "x",
    "versions": [{"at": "2026-07-26T00:00:00Z", "comment": "old"}]
  },
  "schema": {},
  "items": []
}
EOF
assert_fail "array versions rejected" "$SCRIPT" "$TMP/asarray.json" "nope"

# --- invalid version key rejected ---
cat > "$TMP/badkey.json" <<'EOF'
{
  "metadata": {
    "description": "x",
    "versions": {
      "3": {"at": "2026-07-26T00:00:00Z", "comment": "bad"}
    }
  },
  "schema": {},
  "items": []
}
EOF
assert_fail "numeric version key rejected" "$SCRIPT" "$TMP/badkey.json" "nope"

echo
echo "add-history tests: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
