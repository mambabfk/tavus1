"""
One-off: explode the @@@FILE-delimited blobs in _seed/blobs/ into docs_store/.

Each blob is the raw stdout of `for f in ...; do echo "@@@FILE:$f"; cat "$f"; done`
run against the Tavus docs MCP. A line `@@@FILE:/path/to/page.mdx` starts a new
page; everything until the next marker is that page's body. We write it to
docs_store/<path>.md so server.py can index it offline (URL/title are derived
from the path/body at load time).
"""

import glob
import os

HERE = os.path.dirname(__file__)
BLOB_DIR = os.path.join(HERE, "blobs")
OUT_DIR = os.path.join(HERE, "..", "docs_store")
MARKER = "@@@FILE:"


def flush(path: str, lines: list[str]) -> None:
    if not path:
        return
    rel = path.strip().lstrip("/")
    if rel.endswith(".mdx"):
        rel = rel[: -len(".mdx")] + ".md"
    elif not rel.endswith(".md"):
        rel = rel + ".md"
    dest = os.path.join(OUT_DIR, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    body = "\n".join(lines).strip() + "\n"
    with open(dest, "w", encoding="utf-8") as f:
        f.write(body)


def main() -> None:
    count = 0
    for blob in sorted(glob.glob(os.path.join(BLOB_DIR, "*.txt"))):
        with open(blob, "r", encoding="utf-8") as f:
            cur_path, buf = "", []
            for line in f.read().splitlines():
                if line.startswith(MARKER):
                    if cur_path:
                        flush(cur_path, buf)
                        count += 1
                    cur_path, buf = line[len(MARKER):], []
                else:
                    buf.append(line)
            if cur_path:
                flush(cur_path, buf)
                count += 1
    print(f"Wrote {count} pages to {os.path.normpath(OUT_DIR)}")


if __name__ == "__main__":
    main()
