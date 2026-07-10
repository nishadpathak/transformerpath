#!/usr/bin/env python3
"""
TrafoPath static-site binder.

Single source of truth for the shared site chrome lives in _partials/.
Running this script stamps _partials/header.html and _partials/footer.html into
every content page, so the navigation and footer can never drift again.

Usage:  python3 build.py         # bind every page
        python3 build.py --check # report what WOULD change, write nothing

- The header is applied only to pages that carry the site nav (`nav-links`).
  Immersive tool pages (3D explorers, calculator, academy, …) use their own
  banner header and are left untouched.
- The footer is applied only to pages that use the standard `cols` footer.
- The nav link matching the current page gets aria-current="page" for the
  active-state highlight.
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
HEADER = open(os.path.join(ROOT, "_partials/header.html")).read().strip("\n")
FOOTER = open(os.path.join(ROOT, "_partials/footer.html")).read().strip("\n")

HEADER_RE = re.compile(r"<header[^>]*>\s*<div class=\"container nav\">.*?</header>", re.S)
FOOTER_RE = re.compile(r"<footer[^>]*>.*?</footer>", re.S)

check = "--check" in sys.argv
changed = 0

for path in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    base = os.path.basename(path)
    html = open(path, encoding="utf-8").read()
    orig = html

    # A page is a "content page" iff it carries the real site nav header.
    # Immersive tool/app pages (3D explorers, calculator, academy, tutorial,
    # masterclass, country-designer, construction-guide) don't, and keep their
    # own banner header and page-specific footer untouched.
    is_content = bool(HEADER_RE.search(html))
    if not is_content:
        continue

    # Header: stamp the canonical nav, marking the current page active.
    hm = HEADER_RE.search(html)
    header = HEADER.replace(
        '<a href="%s">' % base, '<a href="%s" aria-current="page">' % base, 1
    )
    html = html[: hm.start()] + header + html[hm.end() :]

    # Footer: content pages all share the one canonical site footer.
    fm = FOOTER_RE.search(html)
    if fm:
        html = html[: fm.start()] + FOOTER + html[fm.end() :]

    if html != orig:
        changed += 1
        print(("would bind " if check else "bound ") + base)
        if not check:
            open(path, "w", encoding="utf-8").write(html)

print("\n%d page(s) %s." % (changed, "would change" if check else "bound"))
