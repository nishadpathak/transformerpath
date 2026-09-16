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

const SKIP = ['archive', '_private', 'transformerpath-site', 'dist', 'node_modules', 'functions', '_partials', 'Transformer Equipments'];
const files = walk('.', SKIP);

// Link target existence: resolve relative to the file's directory.
// Netlify pretty URLs map /directory → directory.html and /certificates/x →
// certificates.html (rewrite), so extensionless / trailing-slash targets count
// as OK when the corresponding .html page exists.
const siteRoot = process.cwd();
function candidatePaths(resolved) {
  const out = [resolved];
  if (resolved.endsWith(path.sep) || resolved.endsWith('/')) {
    const base = resolved.replace(/[/\\]+$/, '');
    out.push(base, base + '.html', path.join(base, 'index.html'));
  } else if (!path.extname(resolved)) {
    out.push(resolved + '.html', path.join(resolved, 'index.html'));
  }
  return out;
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
  for (const cand of candidatePaths(resolved)) {
    if (fs.existsSync(cand)) return { ok: true, resolved: cand };
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
