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

from pages import render_markdown_page


HOST = "localhost"
PORT = 57214

APP_DIR = Path(__file__).parent.resolve()
UI_DIR = (APP_DIR / "frontend").resolve()
INDEX_FILE = UI_DIR / "index.html"
DATA_DIR = (APP_DIR.parent / "data").resolve()
STOPPED_PAGE = b"Server stopped."
VALID_NAME_RE = re.compile(r"^[^/\\]+$")


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
            files.append({"name": entry.name, "type": "file", "path": rel_path})

    dirs.sort(key=lambda node: node["name"].lower())
    files.sort(key=lambda node: node["name"].lower())
    return dirs + files


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
        if path == "/help":
            self.handle_static_page("help")
            return
        if path == "/settings":
            self.handle_frontend_file("/settings.html")
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
        if name.lower().endswith(".json"):
            name = sanitize_name(name[: -len(".json")])
            if name is None:
                self.send_error(400)
                return

        file_path = dir_path / f"{name}.json"
        if DATA_DIR not in file_path.parents or file_path.exists():
            self.send_error(409)
            return

        file_path.write_text("{}\n", encoding="utf-8")
        rel_path = str(file_path.relative_to(DATA_DIR)).replace("\\", "/")
        self.send_json({"path": rel_path})

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

        new_path = target_dir / source_path.name
        if new_path == source_path:
            self.send_json({"path": source_rel})
            return
        if new_path.exists():
            self.send_error(409)
            return

        shutil.move(str(source_path), str(new_path))
        rel_path = str(new_path.relative_to(DATA_DIR)).replace("\\", "/")
        self.send_json({"path": rel_path})

    def handle_static_page(self, slug: str) -> None:
        body = render_markdown_page(slug)
        if body is None:
            self.send_error(404)
            return
        self.send_bytes(body, "text/html; charset=utf-8")

    def handle_frontend_file(self, path: str) -> None:
        file_path = INDEX_FILE if path == "/" else (UI_DIR / path.lstrip("/")).resolve()
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
