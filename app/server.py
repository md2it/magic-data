import json
import mimetypes
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


def build_data_tree(dir_path: Path, rel_prefix: str = "") -> list:
    dirs = []
    files = []

    for entry in dir_path.iterdir():
        if entry.name.startswith("."):
            continue
        rel_path = f"{rel_prefix}{entry.name}"
        if entry.is_dir():
            dirs.append({"name": entry.name, "type": "dir", "children": build_data_tree(entry, rel_path + "/")})
        elif entry.is_file() and entry.suffix == ".json":
            files.append({"name": entry.name, "type": "file", "path": rel_path})

    dirs.sort(key=lambda node: node["name"].lower())
    files.sort(key=lambda node: node["name"].lower())
    return dirs + files


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
        if urlsplit(self.path).path != "/stop":
            self.send_error(404)
            return

        self.send_bytes(STOPPED_PAGE, "text/plain; charset=utf-8")
        threading.Thread(target=self.server.shutdown).start()

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
