#!/usr/bin/env python3

import socket
from urllib.error import URLError
from urllib.request import Request, urlopen

from server import main


HOST = "localhost"
PORT = 57214


def is_port_in_use() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(1)
        return connection.connect_ex((HOST, PORT)) == 0


def restart_running_server() -> bool:
    request = Request(f"http://{HOST}:{PORT}/restart", method="POST")
    try:
        with urlopen(request, timeout=3) as response:
            return response.status == 200
    except URLError:
        return False


def start() -> None:
    if not is_port_in_use():
        main()
        return

    print(f"Port {PORT} is already in use.")
    while True:
        answer = input("Restart the running Magic-data server? [Y/N]: ").strip().lower()
        if answer in ("y", "n"):
            break
        print("Please enter Y or N.")

    if answer == "n":
        print("Startup cancelled.")
        return

    if restart_running_server():
        print("Magic-data server restart requested.")
    else:
        print(f"Port {PORT} is occupied by another service or an incompatible Magic-data server.")


if __name__ == "__main__":
    start()
