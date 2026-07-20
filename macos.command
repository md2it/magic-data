#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON_BIN="$VENV_DIR/bin/python"
REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"
REQUIREMENTS_MARKER="$VENV_DIR/.magic-data-requirements.txt"

if [[ ! -x "$PYTHON_BIN" ]]; then
    python3 -m venv "$VENV_DIR" || exit 1
fi

if [[ ! -f "$REQUIREMENTS_MARKER" ]] || ! cmp -s "$REQUIREMENTS_FILE" "$REQUIREMENTS_MARKER"; then
    "$PYTHON_BIN" -m pip install --disable-pip-version-check -r "$REQUIREMENTS_FILE" || exit 1
    cp "$REQUIREMENTS_FILE" "$REQUIREMENTS_MARKER"
fi

exec "$PYTHON_BIN" "$SCRIPT_DIR/app/run.py"
