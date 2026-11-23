"""Copy the public website into dist/ for Cloudflare Pages.

Leaves out everything that isn't part of the site: tools, the database script, notes,
editor settings, and the old /how-big/ and /heavier/ folders (Cloudflare redirects those with 301s).

    python tools/build.py

Cloudflare Pages settings: build command `python3 tools/build.py`, output directory `dist`.
"""
import hashlib
import html
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist"
SKIP = {"dist", "tools", "supabase", ".claude", ".git", ".github", "node_modules", "functions", "edge", ".wrangler", "package.json", "package-lock.json", "how-big", "heavier", "number", "README.md", ".gitignore", "design-samples"}

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
count = 0
for item in ROOT.iterdir():
    if item.name in SKIP or item.name.startswith("."):
        continue
    if item.is_dir():
        shutil.copytree(item, OUT / item.name, ignore=shutil.ignore_patterns("*.py", "__pycache__"))
        count += sum(1 for f in (OUT / item.name).rglob("*") if f.is_file())
    else:
        shutil.copy2(item, OUT / item.name)
        count += 1
print(f"Copied {count} files to {OUT}")

# FAQPage structured data, built from each page's FAQ (<details><summary>question</summary><p>answer</p></details>
# inside an element with class "faq"). Done at build time so it always matches what the page shows.
def plain(html_text):
    t = re.sub(r"<[^>]+>", "", html_text)
    return html.unescape(re.sub(r"\s+", " ", t)).strip()
faq_pages = 0
for page in OUT.rglob("*.html"):
    s = page.read_text(encoding="utf-8")
    if 'type="application/ld+json" data-faq' in s:
        continue
    faqs = []
    for block in re.findall(r'<section class="[^"]*\bfaq\b[^"]*">(.*?)</section>', s, flags=re.S):
        for q, a in re.findall(r"<details><summary>(.*?)</summary>\s*<p>(.*?)</p></details>", block, flags=re.S):
            faqs.append({"@type": "Question", "name": plain(q), "acceptedAnswer": {"@type": "Answer", "text": plain(a)}})
    if not faqs:
        continue
    data = json.dumps({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs}, ensure_ascii=False).replace("</", "<\\/")
    s = s.replace("</head>", f'  <script type="application/ld+json" data-faq>{data}</script>\n</head>', 1)
    with open(page, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(s)
    faq_pages += 1
print(f"FAQ structured data added to {faq_pages} pages")

# BreadcrumbList structured data (Home > page), from each page's canonical URL and <h1>.
# Only for indexable pages with an absolute canonical, so it always matches what Google indexes.
crumb_pages = 0
for page in OUT.rglob("*.html"):
    s = page.read_text(encoding="utf-8")
    if "data-crumbs" in s or 'content="noindex' in s:
        continue
    canon = re.search(r'<link rel="canonical" href="(https://[^"]+)">', s)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", s, flags=re.S)
    if not canon or not h1:
        continue
    url = canon.group(1)
    home = re.match(r"https://[^/]+/", url).group(0)
    if url == home:
        continue
    data = json.dumps({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "sizeit.games", "item": home},
        {"@type": "ListItem", "position": 2, "name": plain(h1.group(1)), "item": url}]}, ensure_ascii=False).replace("</", "<\\/")
    s = s.replace("</head>", f'  <script type="application/ld+json" data-crumbs>{data}</script>\n</head>', 1)
    with open(page, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(s)
    crumb_pages += 1
print(f"Breadcrumb structured data added to {crumb_pages} pages")

# WebApplication structured data for each game page: name, free, playable in the browser, published by the Organization
# defined on the home page. Built from the page's own <h1>, description and canonical URL, so it can't drift.
GAME_FOLDERS = ["size-it-up", "which-is-heavier", "sort-it", "ballpark", "speed-race", "how-many-fit", "how-far",
                "number-guess", "survival", "weekly"]
app_pages = 0
for folder in GAME_FOLDERS:
    page = OUT / folder / "index.html"
    s = page.read_text(encoding="utf-8")
    if "data-webapp" in s:
        continue
    canon = re.search(r'<link rel="canonical" href="(https://[^"]+)">', s)
    desc = re.search(r'<meta name="description" content="([^"]*)"', s)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", s, flags=re.S)
    if not (canon and desc and h1):
        continue
    home = re.match(r"https://[^/]+/", canon.group(1)).group(0)
    data = json.dumps({"@context": "https://schema.org", "@type": "WebApplication", "name": plain(h1.group(1)),
        "url": canon.group(1), "description": html.unescape(desc.group(1)), "applicationCategory": "GameApplication",
        "genre": "Quiz", "operatingSystem": "Any (runs in the browser)", "browserRequirements": "Requires JavaScript",
        "isAccessibleForFree": True, "inLanguage": "en",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "publisher": {"@id": home + "#org"}}, ensure_ascii=False).replace("</", "<\\/")
    s = s.replace("</head>", f'  <script type="application/ld+json" data-webapp>{data}</script>\n</head>', 1)
    with open(page, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(s)
    app_pages += 1
print(f"WebApplication structured data added to {app_pages} game pages")

# Service worker cache name: a hash of every published file, so a deploy that changes anything
# makes returning visitors drop the old cache. No more bumping CACHE in sw.js by hand.
h = hashlib.sha256()
for f in sorted(p for p in OUT.rglob("*") if p.is_file() and p.name != "sw.js"):
    h.update(f.relative_to(OUT).as_posix().encode())
    h.update(f.read_bytes())
sw = OUT / "sw.js"
text = sw.read_text(encoding="utf-8")
text, n = re.subn(r"const CACHE = '[^']*';", f"const CACHE = 'sg-{h.hexdigest()[:10]}';", text, count=1)
if n != 1:
    raise SystemExit("build.py: couldn't find `const CACHE = '...'` in sw.js")
with open(sw, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(text)
print(f"Service worker cache: sg-{h.hexdigest()[:10]}")

# Reminders for things that only work once the site is live
if not (ROOT / "sitemap.xml").exists() or 'rel="canonical" href="./"' in (ROOT / "index.html").read_text(encoding="utf-8"):
    print("WARNING: no domain set, so there's no sitemap.xml. (functions/_middleware.js makes preview URLs absolute meanwhile.)\n"
          "         Run: python tools/set-domain.py https://www.your-domain.com")
if "contact@example.com" in (ROOT / "assets" / "common.js").read_text(encoding="utf-8"):
    print("WARNING: SITE.contact in assets/common.js is still the placeholder contact@example.com")
