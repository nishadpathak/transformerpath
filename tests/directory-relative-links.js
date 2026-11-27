#!/usr/bin/env node
/* Pages served from a directory URL must not use same-folder relative internal
 * links. A root file that shares its name with a directory (or a Netlify
 * rewrite such as /pricing/) is requested as /name/, so href="intel.html"
 * and href="accessories/<slug>/" 404. Nested index pages may use ../.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { isShadowPage, isBareRelative, fixUrl, rootAbsoluteAssets, rootHref } = require('../lib/shadow-asset-paths');
const { accessoryPublicSlug } = require('../lib/accessory-slug');

assert.strictEqual(fixUrl('intel.html'), '/intel.html');
assert.strictEqual(fixUrl('./rfq.html'), '/rfq.html');
assert.strictEqual(fixUrl('accessories/acme/'), '/accessories/acme/');
assert.strictEqual(fixUrl('/intel.html'), '/intel.html');
assert.strictEqual(fixUrl('../intel.html'), '../intel.html');
assert.strictEqual(fixUrl('https://example.com/a'), 'https://example.com/a');
assert.strictEqual(fixUrl('#main'), '#main');
assert.strictEqual(fixUrl('${ev.u}'), '${ev.u}');
assert.strictEqual(rootHref('https://example.com/a'), 'https://example.com/a');
assert.strictEqual(rootHref('data:text/calendar,BEGIN'), 'data:text/calendar,BEGIN');
assert.strictEqual(rootHref('mailto:hello@transformerpath.com'), 'mailto:hello@transformerpath.com');
assert.strictEqual(rootHref('//map.html?q=1'), '//map.html?q=1');
assert.strictEqual(rootHref('/map.html?q=1'), '/map.html?q=1');
assert.strictEqual(rootHref('#main'), '#main');
assert.strictEqual(rootHref('events/sirexe/'), '/events/sirexe/');

const dynamic = rootAbsoluteAssets('<a href="${ev.u}"></a><a href="${hotelURL(ev)}"></a>');
assert.strictEqual(dynamic.includes('href="/${'), false);
assert.strictEqual(dynamic.includes('href="${ev.u}"'), true);

const rewritten = rootAbsoluteAssets(
  '<a href="intel.html">Intel</a><a href="accessories/\'+slug+\'/">Card</a>' +
  '<script>location.href = "workspace.html"; fetch(\'data/site-stats.json\');</script>'
);
assert.strictEqual(rewritten.includes('href="/intel.html"'), true);
assert.strictEqual(rewritten.includes('href="/accessories/\''), true);
assert.strictEqual(rewritten.includes('location.href = "/workspace.html"'), true);
assert.strictEqual(rewritten.includes("fetch('/data/site-stats.json')"), true);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'transformerpath']);

function walk(dir, out, pred) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out, pred);
    else if (pred(full, ent.name)) out.push(full);
  }
  return out;
}

function eachAttr(html, fn) {
  const re = /\s(?:href|src|poster|action)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let match;
  while ((match = re.exec(html))) fn(match[2] !== undefined ? match[2] : match[3]);
}

function isScriptUrl(url) {
  return /\.html(?:[?#]|$)/i.test(url) || /^data\//.test(url);
}

function eachScriptUrl(html, fn) {
  const re = /(?:location(?:\.href)?\s*=\s*|location\.(?:assign|replace)\(\s*|fetch\(\s*|return\s+)(["'])([^"']+)\1/gi;
  let match;
  while ((match = re.exec(html))) fn(match[2]);
}

function pageTargetExists(url) {
  const pathOnly = decodeURIComponent(String(url).split('#')[0].split('?')[0]);
  if (!pathOnly.startsWith('/') || pathOnly.startsWith('//')) return true;
  const rel = pathOnly.replace(/^\/+/, '').replace(/\/$/, '');
  if (!rel) return true;
  return [rel, rel + '.html', path.join(rel, 'index.html')].some(function (candidate) {
    return fs.existsSync(candidate);
  });
}

const failures = [];

function fail(file, detail) {
  failures.push(file + ': ' + detail);
}

walk('.', [], function (_full, name) { return name.endsWith('.html'); })
  .filter(isShadowPage)
  .forEach(function (file) {
    const html = fs.readFileSync(file, 'utf8');
    eachAttr(html, function (url) {
      if (!url || url.indexOf('+') !== -1 || url.indexOf('${') !== -1) return;
      if (isBareRelative(url)) fail(file, 'relative ' + url.slice(0, 120));
    });
    eachScriptUrl(html, function (url) {
      if (isBareRelative(url) && isScriptUrl(url)) fail(file, 'script ' + url.slice(0, 120));
    });
  });

walk('.', [], function (full, name) {
  return name === 'index.html' && full.includes(path.sep);
}).forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  eachAttr(html, function (url) {
    if (!url || url.indexOf('+') !== -1) return;
    if (!isBareRelative(url)) return;
    const local = path.resolve(path.dirname(file), url.split('#')[0].split('?')[0]);
    if (fs.existsSync(local) || fs.existsSync(path.join(local, 'index.html'))) return;
    fail(file, 'relative ' + url.slice(0, 120));
  });
});

const accessories = fs.readFileSync('accessories.html', 'utf8');
assert.strictEqual(accessories.includes('accessories.schema.json'), false, 'accessories page must not reference the missing schema');
assert.strictEqual(fs.readFileSync('data/accessories.json', 'utf8').includes('accessories.schema.json'), false, 'accessories data must not publish the missing schema');
assert.strictEqual(accessories.includes('href="/accessories/\'+slug+\'/"'), true, 'card links must be root-absolute');
assert.strictEqual(accessories.includes('s.public_slug||accessorySlug(s)'), true, 'cards must prefer the published slug');
assert.strictEqual(accessories.includes('href="accessories/'), false, 'card links must not be directory-relative');
assert.strictEqual(fs.readFileSync('build-accessories.js', 'utf8').includes('delete publicDoc.$schema'), true);

const slugStart = accessories.indexOf('function slugify(s)');
const slugEnd = accessories.indexOf('function render()');
const accessorySlug = new Function(accessories.slice(slugStart, slugEnd) + '\nreturn accessorySlug;')();
const embedAt = accessories.indexOf('window.__TP_ACCESSORIES__=');
const embedded = JSON.parse(accessories.slice(embedAt + 'window.__TP_ACCESSORIES__='.length, accessories.indexOf(';</script>', embedAt)));
const published = new Map((embedded.suppliers || []).map(function (row) { return [row.name, row]; }));
const suppliers = JSON.parse(fs.readFileSync('data/accessories.json', 'utf8')).suppliers || [];
const builder = fs.readFileSync('build-accessories.js', 'utf8');
assert.strictEqual(builder.includes("fs.writeFileSync('accessories/' + slug + '/index.html'"), true);
assert.strictEqual(builder.includes('row.public_slug = accessoryPublicSlug(row)'), true);

suppliers.forEach(function (supplier) {
  if (/^(Inactive|Unverified)$/i.test(supplier.verification_status || '')) return;
  const slug = accessoryPublicSlug(supplier);
  const row = published.get(supplier.name);
  assert.ok(row, supplier.name + ' is missing from the accessories page');
  assert.strictEqual(row.public_slug, slug, supplier.name + ' published slug');
  const used = String(row.public_slug || accessorySlug(supplier) || '').replace(/^\/+|\/+$/g, '');
  assert.strictEqual(used, slug, supplier.name + ' card target');
  const folder = path.join('accessories', slug, 'index.html');
  if (!fs.existsSync(folder)) {
    assert.strictEqual(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), true, slug + ' is not a buildable accessory path');
  }
});

eachAttr(accessories, function (url) {
  if (!url || url.indexOf('+') !== -1 || !url.startsWith('/')) return;
  if (!pageTargetExists(url)) fail('accessories.html', 'missing target ' + url.slice(0, 160));
});

if (failures.length) {
  console.error(failures.slice(0, 40).join('\n'));
  console.error(failures.length + ' relative directory links');
  process.exit(1);
}

const notFound = fs.readFileSync('404.html', 'utf8');
assert.strictEqual(/<link[^>]+href="style\.css/.test(notFound), false, '404 stylesheet must be root-absolute');
assert.strictEqual(/<script[^>]+src="(?!\/)[^"]+\.js/.test(notFound), false, '404 scripts must be root-absolute');
assert.strictEqual(notFound.includes('href="/style.css'), true);
assert.strictEqual(notFound.includes('src="/analytics.js'), true);

function domStub() {
  function el() {
    return {
      innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, className: '', hidden: false, disabled: false,
      firstChild: null,
      classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
      appendChild(child) { return child; },
      insertBefore() {},
      setAttribute() {}, getAttribute() { return ''; },
      addEventListener() {}, removeEventListener() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, scrollIntoView() {}, focus() {}, click() {},
      setAttributeNS() {}, getBBox() { return { x: 0, y: 0, width: 0, height: 0 }; }
    };
  }
  const elements = {};
  const document = {
    getElementById(id) { if (!elements[id]) elements[id] = el(); return elements[id]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return el(); },
    createElementNS() { return el(); },
    addEventListener() {},
    documentElement: el(),
    body: el()
  };
  return { elements: elements, document: document };
}

function pageScript(file, needle) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = html.match(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (let i = 0; i < scripts.length; i++) {
    const body = scripts[i].replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    if (body.indexOf(needle) !== -1) return body;
  }
  throw new Error('no inline script in ' + file + ' containing ' + needle);
}

function localFetch(url) {
  const rel = String(url).replace(/^\//, '').split('?')[0];
  if (rel && fs.existsSync(rel) && fs.statSync(rel).isFile()) {
    const body = JSON.parse(fs.readFileSync(rel, 'utf8'));
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
  }
  return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); } });
}

function runInline(file, needle, endNeedle) {
  let code = pageScript(file, needle);
  if (endNeedle) {
    const at = code.indexOf(endNeedle);
    if (at < 0) throw new Error(file + ' missing ' + endNeedle);
    code = code.slice(0, at);
  }
  const dom = domStub();
  const context = {
    document: dom.document,
    console: console,
    URLSearchParams: URLSearchParams,
    URL: { createObjectURL: function () { return 'blob:local'; } },
    fetch: localFetch,
    location: { search: '', hash: '', href: '/', replace: function () {}, assign: function () {} },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    Date: Date, Math: Math, JSON: JSON, Promise: Promise, Blob: function Blob() {},
    navigator: { language: 'en' },
    window: null
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: file, timeout: 20000 });
  return { elements: dom.elements, context: context };
}

function collectHrefs(elements, ids) {
  let html = '';
  ids.forEach(function (id) {
    html += (elements[id] && elements[id].innerHTML) || '';
  });
  return (html.match(/href="([^"]*)"/g) || []).map(function (attr) {
    return attr.slice(6, -1);
  });
}

function brokenRendered(href) {
  return /^\/https?:/i.test(href) || /^\/data:/i.test(href) || /^\/mailto:/i.test(href) || /^\/\/[^/?#]*\.html(?:[?#]|$)/i.test(href);
}

function flush() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

async function renderedCounts() {
  const events = runInline('events.html', 'const EVENTS', "fetch('https://ipapi.co/json/')");
  const eventsHrefs = collectHrefs(events.elements, ['grid', 'upNext', 'liveNow']);
  const jobs = runInline('jobs.html', 'function escJob', null);
  if (typeof jobs.context.renderLive === 'function') {
    jobs.context.renderLive([{
      t: 'Tester', co: 'Example', loc: 'Austin', fn: 'Engineering',
      posting_url: 'https://example.com/jobs/apply', last_verified_at: '2026-11-01'
    }]);
  }
  const jobsHrefs = collectHrefs(jobs.elements, ['liveBoard', 'signalBoard', 'board']);
  const grids = runInline('grids.html', 'const DATA', null);
  const gridsHrefs = collectHrefs(grids.elements, ['board']);
  const makers = runInline('manufacturers.html', 'function makerHref', null);
  for (let i = 0; i < 30; i++) await flush();
  const makerHrefs = collectHrefs(makers.elements, ['board']);
  return {
    'events.html': { hrefs: eventsHrefs.length, broken: eventsHrefs.filter(brokenRendered) },
    manufacturers: { hrefs: makerHrefs.length, broken: makerHrefs.filter(brokenRendered) },
    grids: { hrefs: gridsHrefs.length, broken: gridsHrefs.filter(brokenRendered) },
    jobs: { hrefs: jobsHrefs.length, broken: jobsHrefs.filter(brokenRendered) }
  };
}

renderedCounts().then(function (counts) {
  let broken = 0;
  Object.keys(counts).forEach(function (page) {
    const row = counts[page];
    console.log('rendered ' + page + ' hrefs=' + row.hrefs + ' broken=' + row.broken.length);
    if (row.broken.length) {
      broken += row.broken.length;
      console.error(page + ' ' + row.broken.slice(0, 5).join('\n'));
    }
    assert.ok(row.hrefs > 0, page + ' rendered no hrefs');
  });
  assert.strictEqual(broken, 0);
  console.log('directory-relative-links: ok');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
