#!/usr/bin/env node
/* Fail when TransformerPath's own brand copy names Dubai or the UAE.
 *
 * Listings stay. A UAE tender, a DEWA row, an event held in Dubai, a
 * UAE-based company, and the UAE market page are facts about the industry,
 * not the brand. This check looks only at brand surfaces:
 *   footer, header, about, contact,
 *   the TransformerPath Organization JSON-LD (including address and areaServed),
 *   meta and Open Graph descriptions of non-listing pages,
 *   llms.txt, web manifests, email templates, and README-style public text,
 *   and the site's own refresh schedule copy.
 *
 * Inline scripts, and JS that can be published, are scanned for the word
 * Dubai outside string and regex literals. A city, venue, tender or company
 * record may name Dubai. A comment or an identifier may not.
 *
 * Run: node scripts/check-brand-locale.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const PLACE_RE = /\bDubai\b|\bUAE\b|United Arab Emirates|\bU\.A\.E\.?\b/i;

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'archive',
  '_private',
  'transformerpath',
  'transformerpath-site',
  'vendor'
]);

const LISTING_DIR = /^(manufacturers|events|markets|tenders|projects|utilities|accessories|grids|knowledge|case-studies|topics|components|machinery|laboratories|services|logistics|media|applications|buyers|awards|directory)\//;
const LISTING_FILE = /^(events|exhibitions|tenders|projects|manufacturers|markets|utilities|awards|jobs|grids|intel|archive|gcc-weekly-pack|buyers|components|standards|map|directory|accessories|machinery|laboratories|services|logistics|associations|education|books|rfq|search|intelligence|hydrogen)\.html$/;

const EMAIL_FILES = [
  'functions/watchlist-subscribe.js',
  'functions/notify.js',
  'functions/lib/paid-receipt.js'
];

const problems = [];

function relOf(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function isListingPage(rel) {
  const base = rel.replace(/^dist\//, '');
  if (LISTING_DIR.test(base)) return true;
  if (LISTING_FILE.test(base)) return true;
  if (/^intel-/.test(path.basename(base)) && base.endsWith('.html')) return true;
  return false;
}

function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function attr(tag, name) {
  const re = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
  const m = tag.match(re);
  return m ? (m[2] != null ? m[2] : m[3]) : '';
}

function stripHidden(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function snippet(text) {
  const m = String(text).match(PLACE_RE);
  if (!m) return String(text).replace(/\s+/g, ' ').trim().slice(0, 160);
  const i = m.index;
  return String(text).slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ').trim();
}

function report(rel, where, text) {
  problems.push(rel + ' ' + where + ' — ' + snippet(text));
}

function hit(text) {
  PLACE_RE.lastIndex = 0;
  return PLACE_RE.test(text);
}

/* JS copied to dist by build-dist.js. Build modules stay off this list:
 * they are not a public page, and a place name inside them is not brand copy. */
const PUBLISHED_LIB = new Set([
  'lib/event-search.js',
  'lib/job-board.js',
  'lib/rfq-leads.js',
  'lib/provenance-badge.js',
  'lib/saved-design.js',
  'lib/learning-catalog.js',
  'lib/dga-interpret.js',
  'lib/commissioning-jobs.js'
]);

function isPublishedJs(rel) {
  if (!/\.js$/i.test(rel)) return false;
  if (PUBLISHED_LIB.has(rel)) return true;
  const top = rel.split('/')[0];
  if (top !== rel && ['tests', 'scripts', 'docs', 'functions', 'plugins', 'engine', 'lib', 'data', '.github'].indexOf(top) >= 0) return false;
  if (top === rel && /^(build[-_]|check-|audit-|merge-|stamp-|bump-|apply-|sync-)/.test(rel)) return false;
  return true;
}

function regexAllowed(last) {
  if (!last) return true;
  if (/^(return|case|throw|typeof|void|delete|new|in|of|instanceof|else|do|yield|await)$/.test(last)) return true;
  if (/^(\(|\[|\{|,|;|:|=|!|&|\||\?|\+|-|\*|%|~|\^|<|>|\/)$/.test(last)) return true;
  if (/^(=>|==|!=|<=|>=|\+\+|--|&&|\|\||\+=|-=|\*=|\/=|%=|===|!==|\?\?)$/.test(last)) return true;
  return false;
}

/* Comments and identifiers stay. String literals and regular expressions are
 * data (a record field, or a pattern that recognises a place in a record). */
function outsideData(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  let last = '';
  let state = 'code';
  let regexClass = false;
  const tmplStack = [];
  let exprDepth = 0;
  function identChar(ch) { return /[A-Za-z0-9_$]/.test(ch); }
  while (i < n) {
    const c = code[i];
    const c2 = code[i + 1];
    if (state === 'line') {
      if (c === '\n') { out += c; state = 'code'; last = ''; i++; continue; }
      out += c;
      i++;
      continue;
    }
    if (state === 'block') {
      out += c;
      if (c === '*' && c2 === '/') { out += '/'; i += 2; state = 'code'; last = ''; continue; }
      i++;
      continue;
    }
    if (state === 'squote' || state === 'dquote' || state === 'template') {
      const q = state === 'squote' ? "'" : state === 'dquote' ? '"' : '`';
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (state === 'template' && c === '$' && c2 === '{') {
        out += '  ';
        i += 2;
        tmplStack.push(exprDepth);
        exprDepth = 1;
        state = 'code';
        last = '{';
        continue;
      }
      if (c === q) { out += ' '; i++; state = 'code'; last = 'str'; continue; }
      out += c === '\n' ? '\n' : ' ';
      i++;
      continue;
    }
    if (state === 'regex') {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === '[') regexClass = true;
      else if (c === ']') regexClass = false;
      if (c === '/' && !regexClass) {
        out += ' ';
        i++;
        while (i < n && /[a-z]/i.test(code[i])) { out += ' '; i++; }
        state = 'code';
        last = 're';
        regexClass = false;
        continue;
      }
      if (c === '\n') { out += '\n'; i++; state = 'code'; last = ''; regexClass = false; continue; }
      out += ' ';
      i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { out += c; i++; continue; }
    if (c === '/' && c2 === '/') { state = 'line'; out += c; i++; continue; }
    if (c === '/' && c2 === '*') { state = 'block'; out += c; i++; continue; }
    if (c === "'") { state = 'squote'; out += ' '; i++; continue; }
    if (c === '"') { state = 'dquote'; out += ' '; i++; continue; }
    if (c === '`') { state = 'template'; out += ' '; i++; continue; }
    if (c === '/' && regexAllowed(last)) { state = 'regex'; regexClass = false; out += ' '; i++; continue; }
    if (c === '{' && tmplStack.length) exprDepth++;
    if (c === '}' && tmplStack.length) {
      exprDepth--;
      if (exprDepth === 0) {
        exprDepth = tmplStack.pop();
        state = 'template';
        out += ' ';
        i++;
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && identChar(code[j])) j++;
      const word = code.slice(i, j);
      out += word;
      i = j;
      last = word;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9.xXa-fA-F_]/.test(code[j])) j++;
      out += code.slice(i, j).replace(/[^\n]/g, ' ');
      i = j;
      last = 'num';
      continue;
    }
    const three = code.slice(i, i + 3);
    const two = code.slice(i, i + 2);
    let tok = c;
    if (three === '===' || three === '!==' || three === '**=') tok = three;
    else if (/^(=>|==|!=|<=|>=|\+\+|--|&&|\|\||\+=|-=|\*=|\/=|%=|\?\?)$/.test(two)) tok = two;
    out += tok;
    i += tok.length;
    last = tok;
  }
  return out;
}

const DUBAI_WORD = /\bDubai\b/i;

function mentionsDubai(text) {
  DUBAI_WORD.lastIndex = 0;
  return DUBAI_WORD.test(text);
}

function scanInlineScripts(rel, html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m[1] || '')) continue;
    const code = outsideData(m[2]);
    if (mentionsDubai(code)) report(rel, 'inline script', code);
  }
}

function scanPublishedJs(rel, code) {
  const visible = outsideData(code);
  if (mentionsDubai(visible)) report(rel, 'script', visible);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (SKIP_DIRS.has(ent.name)) return;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}

function isBrandOrg(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const types = [].concat(node['@type'] || []);
  if (types.indexOf('Organization') < 0) return false;
  const name = String(node.name || '');
  const id = String(node['@id'] || '');
  if (name === 'TransformerPath') return true;
  return /transformerpath\.com/i.test(id) && /#organization\b/.test(id);
}

function walkJson(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(function (n) { walkJson(n, visit); });
    return;
  }
  visit(node);
  Object.keys(node).forEach(function (k) {
    if (k === '@context') return;
    const v = node[k];
    if (v && typeof v === 'object') walkJson(v, visit);
  });
}

function scanBrandOrg(rel, html) {
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!/TransformerPath/.test(raw)) continue;
    if (!hit(raw) && !/areaServed/.test(raw)) continue;
    let data;
    try { data = JSON.parse(raw); }
    catch (e) { continue; }
    walkJson(data, function (node) {
      if (!isBrandOrg(node)) return;
      const packed = JSON.stringify(node);
      if (hit(packed)) report(rel, 'Organization JSON-LD', packed);
    });
  }
}

function scanChrome(rel, html) {
  const visible = stripHidden(html);
  const blocks = [
    { name: 'footer', re: /<footer\b[^>]*>[\s\S]*?<\/footer>/gi },
    { name: 'header', re: /<header\b[^>]*>[\s\S]*?<\/header>/gi }
  ];
  blocks.forEach(function (b) {
    b.re.lastIndex = 0;
    let m;
    while ((m = b.re.exec(visible))) {
      if (hit(m[0])) report(rel, b.name, m[0]);
    }
  });
}

function scanMeta(rel, html) {
  if (isListingPage(rel)) return;
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const key = (attr(tag, 'name') || attr(tag, 'property') || '').toLowerCase();
    if (['description', 'og:description', 'og:title', 'twitter:description', 'twitter:title'].indexOf(key) < 0) continue;
    const value = decode(attr(tag, 'content'));
    if (hit(value)) report(rel, 'meta ' + key, value);
  }
  const title = html.match(/<title>([^<]*)<\/title>/i);
  if (title && hit(decode(title[1]))) report(rel, 'title', title[1]);
}

function scanPageText(rel, html) {
  const visible = stripHidden(html);
  if (hit(visible)) report(rel, 'page copy', visible);
}

function scanRefreshMeta(node, rel) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(function (n) { scanRefreshMeta(n, rel); });
    return;
  }
  if (node.refresh_meta && typeof node.refresh_meta === 'object') {
    ['cadence', 'note'].forEach(function (k) {
      const v = node.refresh_meta[k];
      if (typeof v === 'string' && hit(v)) report(rel, 'refresh_meta.' + k, v);
    });
  }
  Object.keys(node).forEach(function (k) {
    if (k === 'items' || k === 'posts' || k === 'regions') return;
    const v = node[k];
    if (v && typeof v === 'object') scanRefreshMeta(v, rel);
  });
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

function selfCheck() {
  const failures = [];
  function expect(cond, label) {
    if (!cond) failures.push(label);
  }
  expect(isListingPage('markets/uae/index.html'), 'UAE market page is a listing');
  expect(isListingPage('events/wetex-2026/index.html'), 'Dubai event page is a listing');
  expect(isListingPage('manufacturers/beta-transformers-fzco/index.html'), 'UAE company page is a listing');
  expect(isListingPage('tenders.html'), 'tenders index is a listing');
  expect(!isListingPage('about.html'), 'about is brand copy');
  expect(!isListingPage('contact.html'), 'contact is brand copy');
  expect(!isListingPage('index.html'), 'home is brand copy');
  expect(!isListingPage('privacy.html'), 'privacy is brand copy');

  const company = '<script type="application/ld+json">{"@type":"Organization","name":"Beta Transformers","address":{"addressLocality":"Dubai","addressCountry":"UAE"}}</script>';
  const brand = '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://transformerpath.com/#organization","name":"TransformerPath","address":{"addressLocality":"Dubai"},"areaServed":"United Arab Emirates"}]}</script>';
  const before = problems.length;
  scanBrandOrg('fixture-company.html', company);
  expect(problems.length === before, 'a listed company Organization in Dubai is not brand copy');
  scanBrandOrg('fixture-brand.html', brand);
  expect(problems.length === before + 1, 'TransformerPath Organization address and areaServed are brand copy');
  problems.length = before;

  const commentScript = '<script>const EVENTS_DAY_OFFSET_MS = 4*60*60*1000; // GST / Asia/Dubai</script>';
  const identScript = '<script>const dubai = 4*60*60*1000;</script>';
  const dataScript = '<script>const EVENTS = [{"city":"Dubai","country":"UAE","v":"Dubai World Trade Centre"}];</script>';
  const jsonLd = '<script type="application/ld+json">{"addressLocality":"Dubai"}</script>';
  scanInlineScripts('fixture-comment.html', commentScript);
  expect(problems.length === before + 1, 'a script comment that names Dubai is not data');
  problems.length = before;
  scanInlineScripts('fixture-ident.html', identScript);
  expect(problems.length === before + 1, 'an identifier named dubai is not data');
  problems.length = before;
  scanInlineScripts('fixture-data.html', dataScript);
  expect(problems.length === before, 'event records inside a script are data');
  scanInlineScripts('fixture-ld.html', jsonLd);
  expect(problems.length === before, 'JSON-LD is not an inline program');
  expect(!mentionsDubai(outsideData("const fmt = { timeZone: 'Asia/Dubai' };")), 'a timezone string is data');
  expect(!mentionsDubai(outsideData('if (/\\b(Dubai|DEWA)\\b/.test(t)) return;')), 'a place-matching regex is data');
  expect(mentionsDubai(outsideData('const label = `offset ${dubai}`;')), 'an identifier inside a template is not data');
  expect(isPublishedJs('lib/event-search.js'), 'published lib JS is scanned');
  expect(!isPublishedJs('lib/event-status.js'), 'build-only lib JS is not a public script');
  expect(!isPublishedJs('build_ssr.js'), 'build scripts are not a public script');
  expect(isPublishedJs('analytics.js'), 'root runtime JS is scanned');
  if (failures.length) {
    console.error('brand-locale self-check failed:\n  ' + failures.join('\n  '));
    process.exit(1);
  }
}

selfCheck();

walk(root, []).forEach(function (file) {
  const rel = relOf(file);
  if (file.endsWith('.html')) {
    let html;
    try { html = fs.readFileSync(file, 'utf8'); }
    catch (e) { return; }
    scanChrome(rel, html);
    scanBrandOrg(rel, html);
    scanMeta(rel, html);
    scanInlineScripts(rel, html);
    if (rel === 'about.html' || rel === 'contact.html') scanPageText(rel, html);
    const alert = html.match(/<p\b[^>]*\bid=["']tp-alert-status["'][^>]*>[\s\S]*?<\/p>/i);
    if (alert && hit(alert[0])) report(rel, 'schedule copy', alert[0]);
    return;
  }
  if (isPublishedJs(rel)) {
    let code;
    try { code = fs.readFileSync(file, 'utf8'); }
    catch (e) { return; }
    scanPublishedJs(rel, code);
  }
  const base = path.basename(file);
  if (/^readme(\..*)?$/i.test(base) || base === 'llms.txt' || base.endsWith('.webmanifest')) {
    const text = fs.readFileSync(file, 'utf8');
    if (hit(text)) report(rel, 'public text', text);
  }
});

['_partials/footer.html', '_partials/header.html', '_partials/header-standalone.html'].forEach(function (rel) {
  const text = read(rel);
  if (text && hit(text)) report(rel, 'partial', text);
});

EMAIL_FILES.forEach(function (rel) {
  const text = read(rel);
  if (text && hit(text)) report(rel, 'email template', text);
});

(function scanAlerts() {
  const rel = 'functions/watchlist-alerts.js';
  const text = read(rel);
  if (!text) return;
  const chrome = text.replace(/const PRESET_KW = \{[\s\S]*?\n\};/, '');
  if (hit(chrome)) report(rel, 'email template', chrome);
})();

['build-intel-news.js', 'build-gcc-intel-publish.js'].forEach(function (rel) {
  const text = read(rel);
  if (!text) return;
  text.split('\n').forEach(function (line, i) {
    if (!/cadence|refresh_meta\.note/.test(line)) return;
    if (hit(line)) report(rel + ':' + (i + 1), 'schedule copy', line);
  });
});

['data/intel.json', 'data/freshness.json'].forEach(function (rel) {
  const text = read(rel);
  if (!text) return;
  try { scanRefreshMeta(JSON.parse(text), rel); }
  catch (e) { report(rel, 'refresh_meta', e.message); }
});

if (problems.length) {
  console.error('BRAND LOCALE CHECK FAILED — ' + problems.length + ' brand mention(s) of Dubai or the UAE:');
  problems.slice(0, 40).forEach(function (p) { console.error('  ' + p); });
  if (problems.length > 40) console.error('  … and ' + (problems.length - 40) + ' more');
  process.exit(1);
}
console.log('brand-locale check OK — brand copy does not name Dubai or the UAE');
