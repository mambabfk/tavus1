"""
Scrape the full Tavus documentation into docs_store/ as local files.

Strategy:
  1. Pull every URL from https://docs.tavus.io/sitemap.xml.
  2. Fetch each page, extract the main readable content, strip nav/scripts.
  3. Write one `.md` file per page with `url`/`title` frontmatter, mirroring
     the URL path so server.py can index it offline.

Run once on a machine with network access:
    pip install -r requirements.txt
    python scrape.py
    # then (re)start server.py, or POST /reload on a running server

Re-run any time to refresh the local mirror.
"""

import os
import re
import sys
import time
import xml.etree.ElementTree as ET

import httpx
from bs4 import BeautifulSoup

BASE = os.environ.get("TAVUS_DOCS_BASE", "https://docs.tavus.io")
SITEMAP = os.environ.get("TAVUS_SITEMAP", f"{BASE}/sitemap.xml")
OUT_DIR = os.environ.get("DOCS_DIR", os.path.join(os.path.dirname(__file__), "docs_store"))
TIMEOUT = float(os.environ.get("SCRAPE_TIMEOUT", "30"))
DELAY = float(os.environ.get("SCRAPE_DELAY", "0.2"))

HEADERS = {"User-Agent": "tavus-docs-mirror/1.0 (+local persona tooling)"}


def get_sitemap_urls(client: httpx.Client) -> list[str]:
    r = client.get(SITEMAP, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    root = ET.fromstring(r.text)
    urls = [el.text.strip() for el in root.iter() if el.tag.endswith("loc") and el.text]
    # De-dupe, keep only docs pages, drop assets.
    seen, out = set(), []
    for u in urls:
        if u in seen or any(u.lower().endswith(ext) for ext in (".png", ".jpg", ".svg", ".xml")):
            continue
        seen.add(u)
        out.append(u)
    return out


def extract(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "nav", "header", "footer", "aside"]):
        tag.decompose()
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        title = h1.get_text(strip=True)
    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = main.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return title or "Tavus Docs", text


def out_path(url: str) -> str:
    path = re.sub(r"^https?://[^/]+/?", "", url).strip("/")
    if not path:
        path = "index"
    path = re.sub(r"[?#].*$", "", path)
    return os.path.join(OUT_DIR, path + ".md")


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    with httpx.Client(follow_redirects=True) as client:
        try:
            urls = get_sitemap_urls(client)
        except Exception as e:
            print(f"Failed to read sitemap {SITEMAP}: {e}", file=sys.stderr)
            return 1
        print(f"Found {len(urls)} pages in sitemap.")
        ok = 0
        for i, url in enumerate(urls, 1):
            try:
                r = client.get(url, headers=HEADERS, timeout=TIMEOUT)
                r.raise_for_status()
                title, text = extract(r.text)
                if not text.strip():
                    print(f"  [skip empty] {url}")
                    continue
                fp = out_path(url)
                os.makedirs(os.path.dirname(fp), exist_ok=True)
                with open(fp, "w", encoding="utf-8") as f:
                    f.write(f"---\nurl: {url}\ntitle: {title}\n---\n{text}\n")
                ok += 1
                print(f"  [{i}/{len(urls)}] {url}")
            except Exception as e:
                print(f"  [error] {url}: {e}", file=sys.stderr)
            time.sleep(DELAY)
        # Also mirror the machine-readable bundles so API schemas are searchable.
        for name, src in (("openapi.md", f"{BASE}/openapi.yaml"), ("llms-full.md", f"{BASE}/llms-full.txt")):
            try:
                r = client.get(src, headers=HEADERS, timeout=TIMEOUT)
                r.raise_for_status()
                fp = os.path.join(OUT_DIR, name)
                with open(fp, "w", encoding="utf-8") as f:
                    f.write(f"---\nurl: {src}\ntitle: {name}\n---\n{r.text}\n")
                ok += 1
                print(f"  [extra] {src}")
            except Exception as e:
                print(f"  [skip extra] {src}: {e}", file=sys.stderr)
        print(f"Done. Wrote {ok} files to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
