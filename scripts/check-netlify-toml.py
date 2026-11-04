#!/usr/bin/env python3
"""Parse netlify.toml and require a real [build] table.

Netlify rejects the file when the [build] header is missing and
`functions = "functions"` sits at the root: that string collides with the
later [functions] table ('trying to redefine an already defined table').
"""
import sys
import tomllib
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "netlify.toml"
text = path.read_text(encoding="utf-8")
lines = text.splitlines()
first = lines[0].strip() if lines else ""
if first != "[build]":
    sys.exit("netlify.toml line 1 must be [build], found %r" % first)

try:
    doc = tomllib.loads(text)
except tomllib.TOMLDecodeError as err:
    sys.exit("netlify.toml is not valid TOML: %s" % err)

build = doc.get("build")
if not isinstance(build, dict):
    sys.exit("netlify.toml [build] table missing")
command = build.get("command")
publish = build.get("publish")
if not isinstance(command, str) or "check-sitemap.js" not in command:
    sys.exit("netlify.toml [build].command missing or does not run check-sitemap.js")
if publish != "dist":
    sys.exit("netlify.toml [build].publish must be dist")
if build.get("functions") != "functions":
    sys.exit("netlify.toml [build].functions must be the functions directory")

fns = doc.get("functions")
if not isinstance(fns, dict):
    sys.exit("netlify.toml [functions] must be a table, not a string that collides with [build].functions")

html = (build.get("processing") or {}).get("html") or {}
if html.get("pretty_urls") is not False:
    sys.exit("netlify.toml [build.processing.html].pretty_urls must be false")

redirects = doc.get("redirects") or []

def checkout_path(value):
    return str(value or "").split("?", 1)[0].rstrip("/") == "/checkout"

# pretty_urls strips the slash, then a 301 back to /checkout/ repeats
# Location: /checkout/?product=learning forever.
for rule in redirects:
    status = int(rule.get("status") or 301)
    if checkout_path(rule.get("from")) and 300 <= status < 400 and checkout_path(rule.get("to")):
        sys.exit(
            "/checkout/?product=learning is a self-redirect: %s -> %s %s"
            % (rule.get("from"), rule.get("to"), status)
        )

for path in ("/checkout", "/checkout/"):
    hits = [rule for rule in redirects if rule.get("from") == path]
    if len(hits) != 1:
        sys.exit("netlify.toml needs exactly one rule from %s" % path)
    rule = hits[0]
    if int(rule.get("status") or 0) != 200 or rule.get("to") != "/checkout/index.html" or rule.get("force") is not True:
        sys.exit(
            "%s must rewrite 200 to /checkout/index.html so /checkout/?product=learning is not a redirect"
            % path
        )

print("netlify.toml OK — [build] parses, [functions] is a separate table, /checkout/?product=learning is not a self-redirect")
