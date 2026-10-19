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

print("netlify.toml OK — [build] parses, and [functions] is a separate table")
