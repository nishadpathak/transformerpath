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

const LISTING_DIR = /^(manufacturers|events|markets|tenders|projects|utilities|accessories|grids|knowledge|case-studies|topics|components|machinery|laboratories|services|logistics|media|applications|buyers|awards)\//;
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
    if (rel === 'about.html' || rel === 'contact.html') scanPageText(rel, html);
    const alert = html.match(/<p\b[^>]*\bid=["']tp-alert-status["'][^>]*>[\s\S]*?<\/p>/i);
    if (alert && hit(alert[0])) report(rel, 'schedule copy', alert[0]);
    return;
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
