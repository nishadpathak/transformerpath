#!/usr/bin/env node
/* Voltage, annual MVA and standards filters use data/manufacturer-tiers.json.
 * Default filters still list the census. A 525 kV filter keeps Virginia
 * Transformer and hides a maker with no sourced voltage.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
const census = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
const tiers = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturer-tiers.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(root, 'data/site-stats.json'), 'utf8'));

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
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
    setAttribute() {},
    appendChild(node) { this.children.push(node); return node; },
    addEventListener() {},
    scrollIntoView() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; }
  };
}

function run() {
  const nodes = {};
  function get(id) { return nodes[id] || (nodes[id] = el(id)); }
  const start = html.indexOf('const DATA_URL');
  const end = html.indexOf('</script>', start);
  const source = html.slice(start, end).replace('loadData();', 'globalThis.__ready = loadData();');
  const context = {
    console: console,
    document: { getElementById: get, createElement() { return el(''); } },
    fetch: function (url) {
      const u = String(url);
      let body = null;
      if (u.indexOf('manufacturers.json') >= 0) body = census;
      else if (u.indexOf('manufacturer-tiers.json') >= 0) body = tiers;
      else if (u.indexOf('site-stats.json') >= 0) body = stats;
      if (!body) return Promise.resolve({ ok: false, json: function () { return Promise.resolve([]); } });
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } });
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'manufacturers.html' });
  return context.__ready.then(function () { return { context: context, nodes: nodes }; });
}

(async function main() {
  check('voltage, MVA and standard selects are on the directory',
    /id="fKv"/.test(html) && /id="fMva"/.test(html) && /id="fCert"/.test(html));
  const ui = await run();
  const count = ui.nodes.count.textContent;
  check('default view still counts the census', count.indexOf('Showing ' + stats.manufacturers + ' ') === 0, count);
  ui.nodes.fKv.value = '525';
  ui.context.page = 1;
  ui.context.render();
  let htmlBoard = '';
  let guard = 0;
  while (guard < 30) {
    guard++;
    htmlBoard += ui.nodes.board.innerHTML;
    if (ui.nodes.board.innerHTML.indexOf('data-pg="next"') < 0 || ui.nodes.board.innerHTML.indexOf('data-pg="next" disabled') >= 0) break;
    ui.context.page += 1;
    ui.context.render();
  }
  check('525 kV filter keeps Virginia Transformer', htmlBoard.indexOf('Virginia Transformer Corp') >= 0);
  check('525 kV filter hides a maker with no sourced voltage', htmlBoard.indexOf('Howard Industries (Howard Power Solutions)') < 0);
  const shown = ui.nodes.count.textContent;
  check('525 kV filter does not claim the full census', shown.indexOf('Showing ' + stats.manufacturers + ' ') !== 0, shown);
  if (failed) {
    console.error('DIRECTORY SPEC FILTERS FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('DIRECTORY SPEC FILTERS PASS');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
