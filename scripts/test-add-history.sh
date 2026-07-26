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

# --- first entry gets version 1 ---
cat > "$TMP/doc.json" <<'EOF'
{
  "metadata": {
    "description": "Keep me"
  },
  "schema": {},
  "items": []
}
EOF
"$SCRIPT" "$TMP/doc.json" "Добавлена история изменений" >/dev/null
v1="$("$PYTHON" -c "import json; print(json.load(open('$TMP/doc.json'))['metadata']['history'][0]['version'])")"
assert_eq "first version is 1" "1" "$v1"

# --- next entry gets version 2 ---
"$SCRIPT" "$TMP/doc.json" "Второе изменение" >/dev/null
v2="$("$PYTHON" -c "import json; h=json.load(open('$TMP/doc.json'))['metadata']['history']; print(h[-1]['version'], len(h))")"
assert_eq "second version is 2 with two entries" "2 2" "$v2"

# --- description preserved ---
desc="$("$PYTHON" -c "import json; print(json.load(open('$TMP/doc.json'))['metadata']['description'])")"
assert_eq "description preserved" "Keep me" "$desc"

# --- comment of exactly 80 chars accepted ---
eighty="$(python3 -c 'print("あ"*80)')"
assert_ok "80 Unicode chars accepted" "$SCRIPT" "$TMP/doc.json" "$eighty"
last_comment="$("$PYTHON" -c "import json; print(json.load(open('$TMP/doc.json'))['metadata']['history'][-1]['comment'])")"
assert_eq "80-char comment stored" "$eighty" "$last_comment"

# --- 81 chars rejected ---
eighty_one="$(python3 -c 'print("あ"*81)')"
before="$("$PYTHON" -c "import json; print(len(json.load(open('$TMP/doc.json'))['metadata']['history']))")"
assert_fail "81 Unicode chars rejected" "$SCRIPT" "$TMP/doc.json" "$eighty_one"
after="$("$PYTHON" -c "import json; print(len(json.load(open('$TMP/doc.json'))['metadata']['history']))")"
assert_eq "history unchanged after 81-char reject" "$before" "$after"

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

# --- missing history created; metadata created when absent ---
echo '{"schema":{},"items":[]}' > "$TMP/plain.json"
"$SCRIPT" "$TMP/plain.json" "init" >/dev/null
"$PYTHON" - <<PY
import json, sys
doc = json.load(open("$TMP/plain.json"))
assert "metadata" in doc
assert doc["metadata"]["history"][0]["version"] == 1
print("ok")
PY
echo "PASS: creates metadata.history when absent"
pass=$((pass + 1))

# --- corrupt last version rejected ---
cat > "$TMP/corrupt.json" <<'EOF'
{
  "metadata": {
    "description": "x",
    "history": [{"version": "1", "at": "2026-07-26T00:00:00Z", "comment": "bad"}]
  },
  "schema": {},
  "items": []
}
EOF
assert_fail "non-integer last version rejected" "$SCRIPT" "$TMP/corrupt.json" "nope"

# --- history not an array rejected ---
cat > "$TMP/notarray.json" <<'EOF'
{
  "metadata": {
    "description": "x",
    "history": {"version": 1}
  },
  "schema": {},
  "items": []
}
EOF
assert_fail "non-array history rejected" "$SCRIPT" "$TMP/notarray.json" "nope"

echo
echo "add-history tests: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
