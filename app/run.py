#!/usr/bin/env python3

import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = "localhost"
PORT = 57214

PAGE = b"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Hello World</title>
</head>
<body>
    <h1>Hello World</h1>
    <button id="stop-btn">Stop</button>
    <p id="status"></p>
    <script>
        document.getElementById("stop-btn").addEventListener("click", function () {
            fetch("/stop", { method: "POST" }).then(function () {
                document.getElementById("status").textContent = "Server stopped.";
            });
        });
    </script>
</body>
</html>
"""

STOPPED_PAGE = b"Server stopped."


class HelloWorldHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(PAGE)))
        self.end_headers()
        self.wfile.write(PAGE)

    def do_POST(self) -> None:
        if self.path == "/stop":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(STOPPED_PAGE)))
            self.end_headers()
            self.wfile.write(STOPPED_PAGE)
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_error(404)

    def log_message(self, format: str, *args) -> None:
        pass


def main() -> None:
    server = HTTPServer((HOST, PORT), HelloWorldHandler)
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


if __name__ == "__main__":
    main()
