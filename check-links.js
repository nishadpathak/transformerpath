const fs = require('fs');
const path = require('path');

// Walk servable .html files (root + generated dirs), skipping gitignored/stale dirs.
function walk(dir, skip = []) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (skip.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, skip));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/* Maghreb #3 accidentally committed a nested fork under transformerpath/
   (parallel site + Stripe checkout experiment). It is not published via
   build-dist and must not fail the root link gate — same class as
   transformerpath-site/. */
const SKIP = ['archive', '_private', 'transformerpath-site', 'transformerpath', 'dist', 'node_modules', 'functions', '_partials', 'Transformer Equipments'];
const files = walk('.', SKIP);

// Link target existence: resolve relative to the file's directory.
// Clean routes like /intel are served via Netlify redirects/rewrites to
// intel.html — treat those as valid when the matching .html (or index.html) exists.
const siteRoot = process.cwd();
function loadRedirects() {
  const map = Object.create(null);
  let text = '';
  try { text = fs.readFileSync(path.join(siteRoot, '_redirects'), 'utf8'); } catch (e) { return map; }
  text.split('\n').forEach(function (line) {
    const s = line.trim();
    if (!s || s.charAt(0) === '#') return;
    const parts = s.split(/\s+/);
    if (parts.length >= 2 && parts[0].charAt(0) === '/') map[parts[0]] = parts[1];
  });
  return map;
}
const REDIRECTS = loadRedirects();
const TOML_REDIRECTS = loadTomlRedirects();

function loadTomlRedirects() {
  const map = Object.create(null);
  let text = '';
  try { text = fs.readFileSync(path.join(siteRoot, 'netlify.toml'), 'utf8'); } catch (e) { return map; }
  text.split('[[redirects]]').slice(1).forEach(function (block) {
    const from = (block.match(/^\s*from\s*=\s*"([^"]+)"/m) || [])[1];
    const to = (block.match(/^\s*to\s*=\s*"([^"]+)"/m) || [])[1];
    if (from && to && from.charAt(0) === '/') map[from] = to;
  });
  return map;
}

function functionFile(dest) {
  const m = String(dest || '').match(/^\/\.netlify\/functions\/([A-Za-z0-9_-]+)\/?$/);
  if (!m) return null;
  const file = path.join(siteRoot, 'functions', m[1] + '.js');
  return fs.existsSync(file) ? file : null;
}
function existsTarget(fromFile, target) {
  const clean = target.split('#')[0].split('?')[0].trim();
  if (!clean) return { ok: true };
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(clean)) return { ok: true }; // protocol (http, mailto, tel, data)
  if (clean.startsWith('//')) return { ok: true };
  if (clean === '') return { ok: true };
  const resolved = clean.startsWith('/')
    ? path.resolve(siteRoot, clean.slice(1))          // site-absolute (Netlify serves from publish root)
    : path.resolve(path.dirname(fromFile), clean);
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) return { ok: true, resolved };
  // Extensionless pretty URL → sibling .html
  if (!path.extname(resolved) && fs.existsSync(resolved + '.html')) {
    return { ok: true, resolved: resolved + '.html' };
  }
  // Directory pretty URL → index.html
  const asDir = resolved.endsWith(path.sep) ? resolved.slice(0, -1) : resolved;
  if (!path.extname(asDir) && fs.existsSync(path.join(asDir, 'index.html'))) {
    return { ok: true, resolved: path.join(asDir, 'index.html') };
  }
  // Explicit _redirects rule (the file itself is gone; the rule owns the URL).
  let sitePath = '/' + path.relative(siteRoot, asDir).split(path.sep).join('/');
  if (clean.endsWith('/') && !sitePath.endsWith('/')) sitePath += '/';
  const dest = REDIRECTS[sitePath] || TOML_REDIRECTS[sitePath];
  if (dest && dest.charAt(0) === '/' && dest !== sitePath) {
    const fn = functionFile(dest);
    if (fn) return { ok: true, resolved: fn };
    return existsTarget(path.join(siteRoot, 'index.html'), dest);
  }
  return { ok: false, resolved };
}

// Strip JS template literals and string-concat expressions so ${...} and '+...+'
// are not treated as real link destinations.
function stripJsLiterals(html) {
  return html
    .replace(/\$\{[^}]*\}/g, 'JS')        // ${expr}
    .replace(/'\s*\+\s*[^']*\s*\+\s*'/g, "''") // '+x+'
    .replace(/\\$\{/g, 'JS');
}

let total = 0, broken = 0;
const brokenList = [];
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const clean = stripJsLiterals(html);
  /* The `?` was escaped, making this a CAPTURING group that matched the literal
     text "?:href" or "src" — so href was never tested at all. Every internal link
     on the site was invisible to this gate while it reported "0 broken". */
  const re = /(?:href|src)\s*=\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(clean))) {
    const target = m[1];
    /* stripJsLiterals() rewrites ${...} to the placeholder JS; that is a template
       expression, not a link. Match JS as a path segment (/JS/) or glued onto a
       slug (books/volume-JS/, masterclass.html#JS) — not only a whole segment. */
    if (/(?:^|[/_\-.#?])JS(?:[/.#?]|$)/.test(target)) continue;
    total++;
    const r = existsTarget(f, target);
    if (!r.ok) {
      broken++;
      brokenList.push(`${f}  ->  ${target}`);
    }
  }
}
console.log(`scanned ${files.length} files, ${total} link targets, ${broken} broken`);
if (broken) {
  console.log('\n--- broken internal links ---');
  brokenList.forEach(b => console.log(b));
  /* This was the only gate in the netlify build with no exit code, so a broken
     link could never stop a deploy. */
  process.exitCode = 1;
}
