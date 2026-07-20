"""One-off migration: adds a ULID `id` as the first key of every data JSON
file that doesn't already have one. Run once after introducing id-based
document routing; safe to re-run (files that already have an id are left
untouched)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ulid import new_ulid

DATA_DIR = (Path(__file__).resolve().parent.parent.parent / "data").resolve()


def migrate() -> None:
    for file_path in sorted(DATA_DIR.rglob("*.json")):
        if any(part.startswith(".") for part in file_path.relative_to(DATA_DIR).parts):
            continue

        source = file_path.read_text(encoding="utf-8")
        try:
            data = json.loads(source)
        except json.JSONDecodeError:
            print(f"skip (invalid json): {file_path.relative_to(DATA_DIR)}")
            continue
        if not isinstance(data, dict):
            print(f"skip (not an object): {file_path.relative_to(DATA_DIR)}")
            continue
        if isinstance(data.get("id"), str) and data["id"]:
            print(f"skip (already has id): {file_path.relative_to(DATA_DIR)}")
            continue

        with_id = {"id": new_ulid(), **data}
        file_path.write_text(json.dumps(with_id, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"migrated: {file_path.relative_to(DATA_DIR)}")


if __name__ == "__main__":
    migrate()
