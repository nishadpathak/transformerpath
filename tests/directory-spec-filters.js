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
const specs = JSON.parse(fs.readFileSync(path.join(root, 'data/sourced-spec-fields.json'), 'utf8'));
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
      else if (u.indexOf('company-slugs.json') >= 0) body = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
      else if (u.indexOf('manufacturer-tiers.json') >= 0) body = tiers;
      else if (u.indexOf('sourced-spec-fields.json') >= 0) body = specs;
      else if (u.indexOf('profile-claims-public.json') >= 0) body = JSON.parse(fs.readFileSync(path.join(root, 'data/profile-claims-public.json'), 'utf8'));
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
  check('voltage, MVA, standard, cooling and test selects are on the directory',
    /id="fKv"/.test(html) && /id="fMva"/.test(html) && /id="fCert"/.test(html) && /id="fCool"/.test(html) && /id="fTest"/.test(html));
  const ui = await run();
  const count = ui.nodes.count.textContent;
  const aliases = require('../lib/company-aliases');
  const slugRows = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
  const slugMap = {};
  slugRows.forEach(function (row) {
    if (row && row.name && row.slug) slugMap[row.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = row.slug;
  });
  const visibleCount = aliases.visibleMakerCount(census, slugMap);
  const publicCount = require('../lib/public-company-count').read(root).publicCount;
  check('default view counts each company once', count.indexOf('Showing ' + visibleCount + ' ') === 0 && visibleCount === publicCount && stats.manufacturers === publicCount, count);
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
  check('525 kV filter does not claim the full directory', shown.indexOf('Showing ' + publicCount + ' ') !== 0, shown);
  const coolValues = ui.nodes.fCool.children.map(function (opt) { return opt.value; });
  check('cooling options come from sourced classes', coolValues.indexOf('ONAF') >= 0 && coolValues.indexOf('AF') < 0, coolValues.join(','));
  ui.nodes.fKv.value = '';
  ui.nodes.fCool.value = 'ONAF';
  ui.context.page = 1;
  ui.context.render();
  htmlBoard = '';
  guard = 0;
  while (guard < 30) {
    guard++;
    htmlBoard += ui.nodes.board.innerHTML;
    if (ui.nodes.board.innerHTML.indexOf('data-pg="next"') < 0 || ui.nodes.board.innerHTML.indexOf('data-pg="next" disabled') >= 0) break;
    ui.context.page += 1;
    ui.context.render();
  }
  check('ONAF filter keeps a sourced maker', htmlBoard.indexOf('Astor Enerji') >= 0);
  check('ONAF filter hides a maker with no sourced cooling', htmlBoard.indexOf('Howard Industries (Howard Power Solutions)') < 0 && htmlBoard.indexOf('Virginia Transformer Corp') < 0);
  ui.nodes.fCool.value = '';
  ui.nodes.fTest.value = 'short-circuit';
  ui.context.page = 1;
  ui.context.render();
  const testBoard = ui.nodes.board.innerHTML;
  check('short-circuit filter keeps a sourced test record', testBoard.indexOf('Danish Power') >= 0 || testBoard.indexOf('Astor Enerji') >= 0);
  check('short-circuit filter hides cooling-only Classic', testBoard.indexOf('Classic Transformers') < 0);
  check('evidence legend separates verified facts from company declarations', html.indexOf('id="evidenceLegend"') !== -1 && html.indexOf('Verified facts and company declarations are labelled separately') !== -1);
  function collect() {
    let board = '';
    let guard = 0;
    ui.context.page = 1;
    ui.context.render();
    while (guard < 40) {
      guard++;
      board += ui.nodes.board.innerHTML;
      if (ui.nodes.board.innerHTML.indexOf('data-pg="next"') < 0 || ui.nodes.board.innerHTML.indexOf('data-pg="next" disabled') >= 0) break;
      ui.context.page += 1;
      ui.context.render();
    }
    return board;
  }
  ui.nodes.fTest.value = '';
  ui.nodes.fEvidence.value = 'company-declared';
  let declaredBoard = collect();
  check('company-declared filter keeps Virginia Transformer', declaredBoard.indexOf('Virginia Transformer Corp') >= 0);
  check('company-declared filter hides a maker with no sourced claim', declaredBoard.indexOf('Howard Industries (Howard Power Solutions)') < 0);
  check('company-declared row is labelled', declaredBoard.indexOf('data-evidence="company-declared"') >= 0);
  ui.nodes.fEvidence.value = 'verified';
  let verifiedBoard = collect();
  check('verified-only filter hides a company declaration', verifiedBoard.indexOf('Virginia Transformer Corp') < 0);
  ui.nodes.fEvidence.value = 'company-declared';
  ui.nodes.fKv.value = '525';
  let both = collect();
  check('525 kV plus company-declared keeps Virginia', both.indexOf('Virginia Transformer Corp') >= 0);
  ui.nodes.fEvidence.value = 'verified';
  let bothVerified = collect();
  check('525 kV plus verified-only hides the company declaration', bothVerified.indexOf('Virginia Transformer Corp') < 0);
  if (failed) {
    console.error('DIRECTORY SPEC FILTERS FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('DIRECTORY SPEC FILTERS PASS');
})().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
