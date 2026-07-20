from __future__ import annotations

import json
import mimetypes
import re
import shutil
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from llm_engine import (
    ProviderError,
    load_config,
    load_scenario,
    render_prompt,
    resolve_steps,
    run_cascade,
)
from pages import render_page
from ulid import new_ulid


HOST = "localhost"
PORT = 57214

APP_DIR = Path(__file__).parent.resolve()
UI_DIR = (APP_DIR / "frontend").resolve()
DATA_DIR = (APP_DIR.parent / "data").resolve()
STOPPED_PAGE = b"Server stopped."
VALID_NAME_RE = re.compile(r"^[^/\\]+$")


def read_doc_id(file_path: Path) -> str | None:
    """Reads the stable `id` a data document carries as its first key.

    Best-effort: files that predate the id convention, or that aren't valid
    JSON objects, simply have no id and are only reachable by their literal
    path (see `resolve_data_route`).
    """
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if isinstance(data, dict):
        doc_id = data.get("id")
        if isinstance(doc_id, str) and doc_id:
            return doc_id
    return None


def build_data_tree(dir_path: Path, rel_prefix: str = "") -> list:
    dirs = []
    files = []

    for entry in dir_path.iterdir():
        if entry.name.startswith("."):
            continue
        rel_path = f"{rel_prefix}{entry.name}"
        if entry.is_dir():
            dirs.append({
                "name": entry.name,
                "type": "dir",
                "path": rel_path,
                "children": build_data_tree(entry, rel_path + "/"),
            })
        elif entry.is_file() and entry.suffix == ".json":
            files.append({
                "name": entry.name,
                "type": "file",
                "path": rel_path,
                "id": read_doc_id(entry),
            })

    dirs.sort(key=lambda node: node["name"].lower())
    files.sort(key=lambda node: node["name"].lower())
    return dirs + files


def build_id_index(dir_path: Path) -> dict:
    """Flat map of `id -> relative path` for every data document that has one."""
    index: dict[str, str] = {}

    def walk(nodes: list) -> None:
        for node in nodes:
            if node["type"] == "dir":
                walk(node["children"])
            elif node.get("id"):
                index[node["id"]] = node["path"]

    walk(build_data_tree(dir_path))
    return index


def resolve_data_route(url_path: str) -> tuple[str, str] | None:
    """Resolves a request path to `(kind, rel_path)`, `kind` in {"doc", "dir"}.

    Only the last path segment is meaningful for documents: it is expected to
    be `{id}` or `{id}-{slug}`, where everything before the first "-" is
    looked up as a document id (the rest of the path, and the slug, are
    purely decorative and never re-validated - so renaming/moving a document
    never breaks a link built around its id). Falls back to a literal
    directory or file path match for entries that don't carry an id yet
    (e.g. added by hand outside the app). Returns None if nothing matches,
    which the caller turns into a real 404 - this function is the single
    place that decides whether a document/directory route exists.
    """
    rel = url_path.strip("/")
    if not rel:
        return ("dir", "")

    last_segment = rel.rsplit("/", 1)[-1]
    doc_id = last_segment.partition("-")[0]
    id_index = build_id_index(DATA_DIR)
    if doc_id in id_index:
        return ("doc", id_index[doc_id])

    candidate = resolve_within_data_dir(rel)
    if candidate is not None and candidate.is_dir():
        rel_dir = "" if candidate == DATA_DIR else str(candidate.relative_to(DATA_DIR)).replace("\\", "/")
        return ("dir", rel_dir)
    if candidate is not None and candidate.suffix == ".json" and candidate.is_file():
        return ("doc", rel)

    return None


def sanitize_name(raw: str) -> str | None:
    name = raw.strip()
    if not name or name in (".", "..") or name.startswith("."):
        return None
    if not VALID_NAME_RE.match(name):
        return None
    return name


def resolve_within_data_dir(rel_path: str) -> Path | None:
    candidate = (DATA_DIR / rel_path).resolve() if rel_path else DATA_DIR
    if candidate != DATA_DIR and DATA_DIR not in candidate.parents:
        return None
    return candidate


class ApplicationHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        path = unquote(urlsplit(self.path).path)

        if path == "/api/data-tree":
            self.send_json(build_data_tree(DATA_DIR))
            return
        if path.startswith("/api/data-files/"):
            self.handle_get_data_file(path[len("/api/data-files/"):])
            return
        if path.startswith("/api/llm-scenarios/"):
            self.handle_get_scenario(path[len("/api/llm-scenarios/"):])
            return
        if path.startswith("/api/"):
            self.send_error(404)
            return

        if path == "/":
            self.serve_data_app("dir", "")
            return

        if not path.startswith("/assets/"):
            if self.handle_page(path):
                return
            route = resolve_data_route(path)
            if route is not None:
                self.serve_data_app(*route)
                return

        self.handle_frontend_file(path)

    def do_POST(self) -> None:
        path = urlsplit(self.path).path

        if path == "/stop":
            self.send_bytes(STOPPED_PAGE, "text/plain; charset=utf-8")
            threading.Thread(target=self.server.shutdown).start()
            return
        if path == "/api/data-tree/create":
            self.handle_create_data_file(self.read_json_body())
            return
        if path == "/api/data-tree/move":
            self.handle_move_data_entry(self.read_json_body())
            return
        if path == "/api/llm/run":
            self.handle_llm_run(self.read_json_body())
            return

        self.send_error(404)

    def read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}

    def handle_create_data_file(self, data: dict) -> None:
        dir_path = resolve_within_data_dir(str(data.get("dir", "")).strip("/"))
        if dir_path is None or not dir_path.is_dir():
            self.send_error(404)
            return

        name = sanitize_name(str(data.get("name", "")))
        if name is None:
            self.send_error(400)
            return

        if data.get("type") == "dir":
            self.create_directory(dir_path, name)
        else:
            self.create_file(dir_path, name)

    def create_directory(self, dir_path: Path, name: str) -> None:
        new_dir = dir_path / name
        if DATA_DIR not in new_dir.parents or new_dir.exists():
            self.send_error(409)
            return

        new_dir.mkdir()
        rel_path = str(new_dir.relative_to(DATA_DIR)).replace("\\", "/")
        self.send_json({"path": rel_path, "type": "dir"})

    def create_file(self, dir_path: Path, name: str) -> None:
        if name.lower().endswith(".json"):
            name = sanitize_name(name[: -len(".json")])
            if name is None:
                self.send_error(400)
                return

        file_path = dir_path / f"{name}.json"
        if DATA_DIR not in file_path.parents or file_path.exists():
            self.send_error(409)
            return

        doc_id = new_ulid()
        file_path.write_text(json.dumps({"id": doc_id}, indent=2) + "\n", encoding="utf-8")
        rel_path = str(file_path.relative_to(DATA_DIR)).replace("\\", "/")
        self.send_json({"path": rel_path, "type": "file", "id": doc_id})

    def handle_move_data_entry(self, data: dict) -> None:
        source_rel = str(data.get("source", "")).strip("/")
        source_path = resolve_within_data_dir(source_rel) if source_rel else None
        if source_path is None or source_path == DATA_DIR or not source_path.exists():
            self.send_error(404)
            return

        target_dir = resolve_within_data_dir(str(data.get("targetDir", "")).strip("/"))
        if target_dir is None or not target_dir.is_dir():
            self.send_error(404)
            return
        if target_dir == source_path or source_path in target_dir.parents:
            self.send_error(400)
            return

        entry_type = "dir" if source_path.is_dir() else "file"
        new_path = target_dir / source_path.name
        if new_path == source_path:
            self.send_json({"path": source_rel, "type": entry_type})
            return
        if new_path.exists():
            self.send_error(409)
            return

        shutil.move(str(source_path), str(new_path))
        rel_path = str(new_path.relative_to(DATA_DIR)).replace("\\", "/")
        self.send_json({"path": rel_path, "type": entry_type})

    def handle_get_scenario(self, scenario_id: str) -> None:
        scenario = load_scenario(scenario_id.strip("/"))
        if scenario is None:
            self.send_json_error(404, "Scenario not found")
            return
        self.send_json(scenario)

    def handle_llm_run(self, data: dict) -> None:
        scenario_id = str(data.get("scenarioId", "")).strip()
        scenario = load_scenario(scenario_id)
        if scenario is None:
            self.send_json_error(404, "Scenario not found")
            return

        config = load_config()
        selector = data.get("provider") or scenario.get("provider") or config.get("default_provider")
        steps = resolve_steps(selector, config)
        if not steps:
            self.send_json_error(400, f"Unknown provider selector: {selector}")
            return

        context = data.get("context") if isinstance(data.get("context"), dict) else {}
        extra = data.get("extra") if isinstance(data.get("extra"), str) else ""
        try:
            prompt = render_prompt(scenario, context, extra)
        except ValueError as error:
            self.send_json_error(400, str(error))
            return

        try:
            result = run_cascade(steps, prompt, config, str(APP_DIR.parent))
        except ProviderError as error:
            self.send_json_error(500, str(error))
            return

        self.send_json({
            "text": result["text"],
            "provider": result["provider"],
            "profile": result.get("profile"),
            "scenarioId": scenario_id,
        })

    def handle_page(self, path: str) -> bool:
        body = render_page(path)
        if body is None:
            return False
        self.send_bytes(body, "text/html; charset=utf-8")
        return True

    def serve_data_app(self, kind: str, rel_path: str) -> None:
        body = render_page("/", initial_state={"kind": kind, "path": rel_path})
        if body is None:
            self.send_error(404)
            return
        self.send_bytes(body, "text/html; charset=utf-8")

    def handle_frontend_file(self, path: str) -> None:
        file_path = (UI_DIR / path.lstrip("/")).resolve()
        if UI_DIR not in file_path.parents and file_path != UI_DIR:
            self.send_error(403)
            return
        if not file_path.is_file():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        self.send_bytes(file_path.read_bytes(), content_type)

    def handle_get_data_file(self, name: str) -> None:
        file_path = (DATA_DIR / name).resolve()
        if DATA_DIR not in file_path.parents or file_path.suffix != ".json" or not file_path.is_file():
            self.send_error(404)
            return
        self.send_bytes(file_path.read_bytes(), "text/plain; charset=utf-8")

    def send_json(self, data: object) -> None:
        self.send_bytes(json.dumps(data).encode("utf-8"), "application/json; charset=utf-8")

    def send_json_error(self, status: int, message: str) -> None:
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_bytes(self, body: bytes, content_type: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:
        pass


def main() -> None:
    server = HTTPServer((HOST, PORT), ApplicationHandler)
    url = f"http://{HOST}:{PORT}"
    print(f"Serving at {url}")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("Server stopped.")
