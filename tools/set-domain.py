"""Switch the site to absolute URLs once you know the domain, and write sitemap.xml.

Usage (from the project folder):
    python tools/set-domain.py https://www.example.com

Run it again any time you add a page or change the domain. It is safe to re-run.
"""
import datetime
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Every public page: file on disk -> path in the URL
PAGES = {
    "index.html": "",
    "size-it-up/index.html": "size-it-up/",
    "which-is-heavier/index.html": "which-is-heavier/",
    "sort-it/index.html": "sort-it/",
    "ballpark/index.html": "ballpark/",
    "speed-race/index.html": "speed-race/",
    "number-guess/index.html": "number-guess/",
    "how-many-fit/index.html": "how-many-fit/",
    "how-far/index.html": "how-far/",
    "weekly/index.html": "weekly/",
    "survival/index.html": "survival/",
    "answers/index.html": "answers/",
    "suggest/index.html": "suggest/",
    "archive/index.html": "archive/",
    "privacy/index.html": "privacy/",
    "about/index.html": "about/",
    "categories/index.html": "categories/",
    "contact/index.html": "contact/",
    "terms/index.html": "terms/",
}

if len(sys.argv) != 2 or not re.match(r"^https?://[^/]+$", sys.argv[1].rstrip("/")):
    sys.exit("Usage: python tools/set-domain.py https://www.example.com")
base = sys.argv[1].rstrip("/") + "/"
today = datetime.date.today().isoformat()

for file, path in PAGES.items():
    p = ROOT / file
    s = io.open(p, encoding="utf-8").read()
    url = base + path
    s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', s)
    s = re.sub(r'\s*<meta property="og:url" content="[^"]*">', "", s)
    s = s.replace('<meta property="og:type"', f'<meta property="og:url" content="{url}">\n  <meta property="og:type"', 1)
    # og:image: turn "../og/x.png", "og/x.png" or an old absolute URL into the new absolute URL
    s = re.sub(r'<meta property="og:image" content="(?:[^"]*?)(og/[^"/]+\.png)">',
               lambda m: f'<meta property="og:image" content="{base}{m.group(1)}">', s)
    io.open(p, "w", encoding="utf-8", newline="\n").write(s)
    print("updated", file)

urls = "\n".join(f"  <url><loc>{base}{path}</loc><lastmod>{today}</lastmod></url>" for path in PAGES.values())
io.open(ROOT / "sitemap.xml", "w", encoding="utf-8", newline="\n").write(
    f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n')
robots = io.open(ROOT / "robots.txt", encoding="utf-8").read()
robots = re.sub(r"\n*Sitemap: .*", "", robots).rstrip() + f"\n\nSitemap: {base}sitemap.xml\n"
io.open(ROOT / "robots.txt", "w", encoding="utf-8", newline="\n").write(robots)
print("wrote sitemap.xml and robots.txt for", base)
