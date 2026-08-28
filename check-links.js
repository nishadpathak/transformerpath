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

const SKIP = ['archive', '_private', 'transformerpath-site', 'node_modules', 'functions'];
const files = walk('.', SKIP);

// Link target existence: resolve relative to the file's directory.
const siteRoot = process.cwd();
function existsTarget(fromFile, target) {
  const clean = target.split('#')[0].split('?')[0].trim();
  if (!clean) return { ok: true };
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(clean)) return { ok: true }; // protocol (http, mailto, tel, data)
  if (clean.startsWith('//')) return { ok: true };
  if (clean === '') return { ok: true };
  const resolved = path.resolve(path.dirname(fromFile), clean);
  return { ok: fs.existsSync(resolved), resolved };
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
  const re = /(\?:href|src)\s*=\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(clean))) {
    const target = m[2];
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
}
