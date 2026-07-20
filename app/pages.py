from html import escape
from pathlib import Path
from typing import Optional

from markdown_it import MarkdownIt


PAGES_DIR = (Path(__file__).parent / "content" / "pages").resolve()


def render_markdown_page(slug: str) -> Optional[bytes]:
    """Render an application-owned Markdown page as a complete HTML document."""
    page_path = (PAGES_DIR / f"{slug}.md").resolve()
    if PAGES_DIR not in page_path.parents or not page_path.is_file():
        return None

    markdown = MarkdownIt("commonmark", {"html": False})
    content = markdown.render(page_path.read_text(encoding="utf-8"))
    title = "Help" if slug == "help" else slug.replace("-", " ").title()

    document = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{escape(title)} · Magic-data</title>
    <link rel="stylesheet" href="/assets/css/layout.css">
    <link rel="stylesheet" href="/assets/css/markdown.css">
</head>
<body>
    <header id="app-header"></header>
    <main class="static-page">
        <article class="markdown-content">
{content}
        </article>
    </main>
    <footer id="app-footer"></footer>
    <script src="/assets/js/layout.js"></script>
</body>
</html>
"""
    return document.encode("utf-8")
