from __future__ import annotations

import json
from html import escape
from pathlib import Path
from typing import Optional

from markdown_it import MarkdownIt


FRONTEND_DIR = (Path(__file__).parent / "frontend").resolve()
PAGES_DIR = (FRONTEND_DIR / "pages").resolve()
LAYOUT_PATH = FRONTEND_DIR / "layout" / "page.html"


def render_page(url_path: str, initial_state: Optional[dict] = None) -> Optional[bytes]:
    """Render an application-owned HTML or Markdown page in the shared layout.

    `initial_state`, when given, is serialized and injected as
    `window.__INITIAL_STATE__` so the page's own scripts can pick up
    server-resolved routing state (e.g. which document/directory to show)
    without re-deriving it - and without deciding not-found on the client.
    """
    page_path = find_page(url_path)
    if page_path is None:
        return None

    metadata, source = read_page_source(page_path)
    content = render_content(page_path, source)
    configured_title = metadata.get("title")
    title = configured_title if isinstance(configured_title, str) else default_title(page_path)
    styles = metadata.get("styles")
    scripts = metadata.get("scripts")
    style_paths = ["/assets/css/markdown.css"] if page_path.suffix == ".md" else []
    if isinstance(styles, list):
        style_paths.extend(styles)
    script_paths = scripts if isinstance(scripts, list) else []
    page_head = "\n".join(stylesheet_tag(path) for path in style_paths)
    page_scripts = "\n".join(script_tag(path) for path in script_paths)
    initial_state_html = "" if initial_state is None else initial_state_tag(initial_state)

    document = LAYOUT_PATH.read_text(encoding="utf-8")
    document = document.replace("{{ title }}", escape(title))
    document = document.replace("{{ page_head }}", page_head)
    document = document.replace("{{ initial_state }}", initial_state_html)
    document = document.replace("{{ content }}", content)
    document = document.replace("{{ page_scripts }}", page_scripts)
    return document.encode("utf-8")


def initial_state_tag(initial_state: dict) -> str:
    payload = json.dumps(initial_state).replace("</", "<\\/")
    return f"    <script>window.__INITIAL_STATE__ = {payload};</script>"


def find_page(url_path: str) -> Optional[Path]:
    relative_path = url_path.strip("/")
    if not relative_path:
        candidates = [PAGES_DIR / "index.html", PAGES_DIR / "index.md"]
    else:
        relative = Path(relative_path)
        candidates = [
            PAGES_DIR / relative / "index.html",
            PAGES_DIR / relative / "index.md",
            PAGES_DIR / f"{relative_path}.html",
            PAGES_DIR / f"{relative_path}.md",
        ]

    for candidate in candidates:
        resolved = candidate.resolve()
        if PAGES_DIR in resolved.parents and resolved.is_file():
            return resolved
    return None


def read_page_source(page_path: Path) -> tuple[dict[str, str | list[str]], str]:
    source = page_path.read_text(encoding="utf-8")
    if not source.startswith("---\n"):
        return {}, source

    closing_marker = source.find("\n---\n", len("---\n"))
    if closing_marker == -1:
        return {}, source

    metadata = parse_front_matter(source[len("---\n"):closing_marker])
    return metadata, source[closing_marker + len("\n---\n"):]


def parse_front_matter(source: str) -> dict[str, str | list[str]]:
    metadata: dict[str, str | list[str]] = {}
    current_list: list[str] | None = None

    for line in source.splitlines():
        if line.startswith("  - ") and current_list is not None:
            current_list.append(line[4:].strip())
            continue

        key, separator, value = line.partition(":")
        if not separator:
            continue

        key = key.strip()
        value = value.strip()
        if key in {"styles", "scripts"}:
            current_list = []
            metadata[key] = current_list
        elif key == "title" and value:
            metadata[key] = value
            current_list = None
        else:
            current_list = None

    return metadata


def render_content(page_path: Path, source: str) -> str:
    if page_path.suffix == ".html":
        return source

    markdown = MarkdownIt("commonmark", {"html": False})
    content = markdown.render(source)
    return f"""    <main class=\"static-page\">
        <article class=\"markdown-content\">
{content}        </article>
    </main>"""


def default_title(page_path: Path) -> str:
    relative_path = page_path.relative_to(PAGES_DIR)
    if relative_path == Path("index.html"):
        return "Magic-data"

    name = relative_path.parent.name if page_path.stem == "index" else page_path.stem
    return f"{name.replace('-', ' ').title()} · Magic-data"


def stylesheet_tag(path: str) -> str:
    return f'    <link rel="stylesheet" href="{escape(path, quote=True)}">'


def script_tag(path: str) -> str:
    return f'    <script src="{escape(path, quote=True)}"></script>'
