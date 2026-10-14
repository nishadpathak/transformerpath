#!/usr/bin/env node
/* tests/manufacturers-directory-smoke.js
 *
 * The directory used to throw ReferenceError: countrySlug is not defined and
 * the catch replaced #board, so the published census disappeared. This runs
 * the page script against data/manufacturers.json and against a thrown render,
 * and requires more than 0 maker rows in both the server HTML and the live render.
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
  const ssrRows = (html.match(/class="mk-row"/g) || []).length;
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
