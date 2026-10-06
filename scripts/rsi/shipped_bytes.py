"""Bytes a visitor downloads: the committed size at HEAD of the files the site serves. Prints shipped_bytes=<n>.

GitHub Pages serves the repo root (CNAME, .nojekyll). Counted: index.html, the images it and site.webmanifest
reference, og.png, and the crawler text files (robots.txt, sitemap.xml, llms*.txt). Not counted: docs/, scripts/,
dotfiles, and the full-size image masters in img/ that scripts/optimize-images.py derives the served files from.
The page never references those masters, so deleting or recompressing one is not a visitor-facing win.
"""
import subprocess

SERVED = (".html", ".css", ".js", ".mjs", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico",
          ".woff", ".woff2", ".json", ".webmanifest", ".xml", ".txt")
SKIP_DIRS = ("docs", "scripts")
# Source masters for scripts/optimize-images.py (keep in step with its __main__ block). img/logo.png is a master
# too but stays counted: site.webmanifest serves it as the 256 px icon.
MASTERS = {"img/settings.gif", "img/preview-collage.webp", "img/preview-quicklook.png", "img/convert.png"}
listing = subprocess.run(["git", "ls-tree", "-r", "-l", "-z", "HEAD"], capture_output=True, check=True).stdout
total = 0
for entry in listing.split(b"\0"):
    if not entry:
        continue
    meta, path = entry.decode("utf-8", "replace").split("\t", 1)
    size = meta.split()[3]
    parts = path.split("/")
    if size == "-" or not path.lower().endswith(SERVED):
        continue
    if any(p.startswith(".") for p in parts) or parts[0] in SKIP_DIRS or path in MASTERS:
        continue
    total += int(size)
print(f"shipped_bytes={total}")
