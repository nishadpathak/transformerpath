#!/usr/bin/env node
/* tests/manufacturers-directory-smoke.js
 *
 * The directory used to throw ReferenceError: countrySlug is not defined and
 * the catch replaced #board, so the published census disappeared. This runs
 * the page script against data/manufacturers.json and against a thrown render,
 * and requires the published board to contain exactly the census: one row per
 * manufacturer in data/manufacturers.json, equal to data/site-stats.json.
 * The two class="mk-row" strings inside makerRow() are templates, not rows.
 *
 * Run: node tests/manufacturers-directory-smoke.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
const census = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(root, 'data/site-stats.json'), 'utf8'));

function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function publishedBoard(source) {
  const startMark = '<!--SSR:mfg-board-->';
  const endMark = '<!--/SSR:mfg-board-->';
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark);
  if (start < 0 || end < start) throw new Error('published manufacturer board markers missing');
  return source.slice(start + startMark.length, end);
}
function censusMakers(data) {
  const names = [];
  data.forEach(function (country) {
    (country.makers || []).forEach(function (maker) {
      if (!/^Served by/i.test(maker[0])) names.push(String(maker[0]));
    });
  });
  return names;
}
function boardRows(board) {
  return board.match(/<div class="mk-row">[\s\S]*?<\/div>/g) || [];
}
function rowIdentity(row) {
  const note = row.match(/class="note">([^<]*)</);
  if (note) return { kind: 'note', name: decode(note[1]) };
  const named = row.match(/class="prof"[^>]*>([^<]*)</) || row.match(/<b>([^<]*)<\/b>/);
  if (!named) return { kind: 'unknown', name: row.slice(0, 80) };
  return { kind: 'maker', name: decode(named[1]) };
}

let failures = [];
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failures.push(label + (detail ? ' :: ' + detail : ''));
}

function scriptSource() {
  const start = html.indexOf('const DATA_URL');
  const end = html.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('directory script not found');
  return html.slice(start, end).replace('loadData();', 'globalThis.__ready = loadData();');
}

function el(id) {
  return {
    id: id,
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    dataset: {},
    children: [],
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    setAttribute(name) { if (name === 'data-dir-fallback') this._fallback = true; },
    appendChild(node) { this.children.push(node); return node; },
    insertBefore(node) { this.children.unshift(node); return node; },
    addEventListener() {},
    scrollIntoView() {},
    querySelector(sel) {
      if (sel === '[data-dir-fallback]') return this.children.find((c) => c && c._fallback) || null;
      return null;
    },
    querySelectorAll() { return []; },
  };
}

function dom() {
  const nodes = {};
  function get(id) { return nodes[id] || (nodes[id] = el(id)); }
  return {
    nodes: nodes,
    document: {
      getElementById: get,
      createElement() { return el(''); },
    },
  };
}

function run(fetchImpl, log) {
  const ui = dom();
  const context = {
    console: log || console,
    document: ui.document,
    fetch: fetchImpl,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(scriptSource(), context, { filename: 'manufacturers.html' });
  return context.__ready.then(() => ({ context: context, ui: ui }));
}

function rows(htmlText) {
  return (String(htmlText || '').match(/class="mk-row"/g) || []).length;
}

(async function main() {
  const makers = censusMakers(census);
  const boardHtml = publishedBoard(html);
  const published = boardRows(boardHtml).map(rowIdentity);
  const makerRows = published.filter(function (row) { return row.kind === 'maker'; });
  const noteRows = published.filter(function (row) { return row.kind === 'note'; });
  const unknownRows = published.filter(function (row) { return row.kind === 'unknown'; });
  const seen = new Map();
  makerRows.forEach(function (row) {
    const key = row.name.toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  const duplicates = [...seen.entries()].filter(function (pair) { return pair[1] > 1; }).map(function (pair) { return pair[0]; });
  const censusKeys = new Set(makers.map(function (name) { return name.toLowerCase(); }));
  const boardKeys = new Set(makerRows.map(function (row) { return row.name.toLowerCase(); }));
  const extra = [...boardKeys].filter(function (name) { return !censusKeys.has(name); });
  const missing = [...censusKeys].filter(function (name) { return !boardKeys.has(name); });
  const shown = html.match(/Showing (\d+) companies across (\d+) countries/);

  check('published board row count equals the census', makerRows.length === makers.length && makerRows.length === stats.manufacturers, makerRows.length + ' board rows, ' + makers.length + ' in manufacturers.json, site-stats ' + stats.manufacturers);
  check('published board has no note, duplicate, or unparsed rows', noteRows.length === 0 && unknownRows.length === 0 && duplicates.length === 0, 'notes ' + noteRows.map(function (row) { return row.name; }).join('; ') + ' unknown ' + unknownRows.length + ' duplicates ' + duplicates.join('; '));
  check('published board lists the same manufacturers as the census', extra.length === 0 && missing.length === 0, 'extra ' + extra.join('; ') + ' missing ' + missing.slice(0, 8).join('; '));
  check('directory count line equals the census', !!shown && Number(shown[1]) === stats.manufacturers, shown ? shown[0] : 'missing');

  const ssrRows = makerRows.length;
  check('server-rendered directory has more than 0 maker rows', ssrRows > 0, String(ssrRows));
  check('countrySlug is defined in the page script', /function countrySlug\s*\(/.test(html));
  check('a JS failure does not replace #board', !/getElementById\('board'\)\.innerHTML\s*=\s*'[^']*Could not load the manufacturer directory/.test(html));

  const ok = await run(function (url) {
    if (String(url).indexOf('manufacturers.json') !== -1) {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(census); } });
    }
    return Promise.resolve({ ok: false, json: function () { return Promise.resolve([]); } });
  });
  const board = ok.ui.nodes.board;
  const rendered = rows(board.innerHTML);
  check('live render produces more than 0 maker rows', rendered > 0, String(rendered));
  const liveCount = ok.ui.nodes.count ? ok.ui.nodes.count.textContent : '';
  check('client count equals the census', liveCount.indexOf('Showing ' + stats.manufacturers + ' ') === 0, liveCount);
  const countryLinks = board.innerHTML.match(/manufacturers\/[a-z0-9-]+\.html/g) || [];
  check('live render links countries to country pages', countryLinks.length > 0, String(countryLinks.length));
  check('countrySlug keeps the short USA / UAE / Türkiye files',
    ok.context.countrySlug('USA') === 'usa' &&
    ok.context.countrySlug('United Arab Emirates') === 'uae' &&
    ok.context.countrySlug('Türkiye') === 'turkiye',
    [ok.context.countrySlug('USA'), ok.context.countrySlug('United Arab Emirates'), ok.context.countrySlug('Türkiye')].join(','));

  const seeded = '<div class="mk-row"><b>Kept Manufacturer</b></div>';
  const failed = await run(function () {
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve([{ country: 'Nowhere', region: 'Europe' }]); },
    });
  }, { log() {}, error() {}, warn() {} });
  // Re-run the failure against a board that already holds the published list.
  // The script above starts from an empty board; seed it and call loadData again.
  failed.ui.nodes.board.innerHTML = seeded;
  failed.ui.nodes.board.children = [];
  await failed.context.loadData();
  check('a render throw keeps the published maker rows', failed.ui.nodes.board.innerHTML.indexOf('Kept Manufacturer') !== -1 && failed.ui.nodes.board.innerHTML.indexOf('Could not load the manufacturer directory') === -1, failed.ui.nodes.board.innerHTML.slice(0, 180));
  check('a render throw explains that the published list is still showing', !!failed.ui.nodes.board.querySelector('[data-dir-fallback]'));

  if (failures.length) {
    console.error('\n' + failures.length + ' manufacturer directory smoke check(s) failed');
    process.exit(1);
  }
  console.log('\nManufacturer directory smoke checks passed (' + rendered + ' rendered rows, ' + ssrRows + ' server-rendered).');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
