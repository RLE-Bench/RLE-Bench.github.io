#!/usr/bin/env python3
"""Package the research blog and its dependencies for a static Hugging Face Space."""

import argparse
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
from urllib.parse import urljoin, urlsplit


ROOT = Path(__file__).resolve().parents[1]
ARTICLE_URL = "https://rle-bench.github.io/blog/"
URL_ATTRIBUTES = {"href", "src", "poster", "data-source"}


def space_url(value):
    """Move the article to the root, keeping site navigation on the main website."""
    path = urlsplit(value).path
    if value.startswith("../"):
        if path.startswith("../assets/") or Path(path).suffix in {".js", ".css"}:
            return value[3:]
        return urljoin(ARTICLE_URL, value)
    if not urlsplit(value).scheme and not value.startswith(("/", "#")):
        if Path(path).suffix in {".js", ".css"}:
            return "blog/" + value
    return value


class Dependencies(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name not in URL_ATTRIBUTES or not value:
                continue
            url = urlsplit(value)
            if not url.scheme and not url.netloc and url.path not in {"", "./"}:
                self.paths.add(url.path)


def build(output):
    # Refuse to overwrite a directory: every upload starts with a clean bundle.
    output.mkdir(parents=True, exist_ok=False)
    html = (ROOT / "blog/index.html").read_text()
    html = re.sub(
        r'\b(href|src|poster|data-source)=("|\x27)(.*?)\2',
        lambda m: f"{m[1]}={m[2]}{space_url(m[3])}{m[2]}",
        html,
    )
    # External destinations must open outside the Space iframe.
    html = re.sub(
        r'<a\b[^>]*\bhref=["\x27]https?://[^>]*>',
        lambda m: m[0][:-1] + ' target="_blank" rel="noopener noreferrer">'
        if "target=" not in m[0] and "rel=" not in m[0]
        else m[0][:-1] + ' target="_blank">' if "target=" not in m[0] else m[0],
        html,
    )
    (output / "index.html").write_text(html)
    shutil.copyfile(ROOT / "deploy/huggingface/README.md", output / "README.md")

    dependencies = Dependencies()
    dependencies.feed(html)
    pending = set(dependencies.paths)
    copied = set()
    while pending:
        relative = pending.pop()
        if relative in copied:
            continue
        source = (ROOT / unescape(relative)).resolve()
        if not source.is_relative_to(ROOT) or not source.is_file():
            raise ValueError(f"Missing or invalid article dependency: {relative}")
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix in {".js", ".css"}:
            text = source.read_text().replace("../assets/", "assets/")
            pending.update(re.findall(r'["\x27](assets/[^"\x27]+)["\x27]', text))
            target.write_text(text)
        else:
            shutil.copyfile(source, target)
        copied.add(relative)

    files = [p for p in output.rglob("*") if p.is_file()]
    total = sum(p.stat().st_size for p in files)
    print(f"Built {len(files)} files ({total / 1024 / 1024:.1f} MiB) in {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="New directory for the upload bundle")
    args = parser.parse_args()
    build(args.output.resolve())
