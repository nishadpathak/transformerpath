/* Region and country directory filters, and the prerendered landing pages.
 * Counts come from data/manufacturers.json. A place under five listings
 * has no landing page. Run: node tests/directory-geo.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const geo = require('../lib/directory-geo');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    failed++;
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
  }
}

function censusCount(row) {
  return (row.makers || []).filter(function (maker) {
    return maker && maker[0] && !/^Served by/i.test(maker[0]);
  }).length;
}

const census = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
const model = geo.loadModel();
const docs = geo.buildDocuments(model);
const regionDocs = docs.filter(function (doc) { return doc.kind === 'region'; });
const countryDocs = docs.filter(function (doc) { return doc.kind === 'country'; });

check('every region with 5 or more listings has one page', regionDocs.length === model.regions.filter(function (row) {
  return row.count >= geo.MIN_LISTINGS;
}).length && regionDocs.length === 10, String(regionDocs.length));
check('country pages are only the places with 5 or more listings', countryDocs.length === census.filter(function (row) {
  return censusCount(row) >= 5;
}).length, String(countryDocs.length));
check('a country under 5 listings has no page', !countryDocs.some(function (doc) { return doc.slug === 'switzerland'; }));

const titles = {};
const descriptions = {};
docs.forEach(function (doc) {
  const place = doc.kind === 'region'
    ? model.regions.filter(function (row) { return row.slug === doc.slug; })[0].name
    : model.countries.filter(function (row) { return row.slug === doc.slug; })[0].country;
  check(doc.file + ' title is the place pattern',
    doc.title === place + ' transformer manufacturers | TransformerPath' &&
      doc.html.indexOf('property="og:title" content="' + place + ' transformer manufacturers | TransformerPath"') !== -1,
    doc.title + ' (' + doc.title.length + ')');
  check(doc.file + ' description is 140–160 and includes the count',
    doc.description.length >= 140 && doc.description.length <= 160 && doc.description.indexOf(String(doc.count)) !== -1,
    doc.description + ' (' + doc.description.length + ')');
  check(doc.file + ' canonical is its own URL',
    doc.html.indexOf('href="https://transformerpath.com' + doc.path + '"') !== -1);
  check(doc.file + ' count is on the page', doc.html.indexOf('data-count="' + doc.count + '"') !== -1);
  check(doc.file + ' has no Stripe link or price',
    doc.html.indexOf('buy.stripe.com') === -1 && doc.html.indexOf('$') === -1);
  if (titles[doc.title]) check(doc.file + ' title is unique', false, 'same as another page');
  if (descriptions[doc.description]) check(doc.file + ' description is unique', false, 'same as another page');
  titles[doc.title] = doc.file;
  descriptions[doc.description] = doc.file;
});

const usa = countryDocs.filter(function (doc) { return doc.slug === 'usa'; })[0];
check('a blank city is an em dash', usa.html.indexOf('>Altran Corporation</a><span class="tpill">TX</span><span class="city">—</span>') !== -1);
check('country listing rows include a claim link', (usa.html.match(/class="mk-row"/g) || []).length > 0 && (usa.html.match(/data-claim-listing="1"/g) || []).length === (usa.html.match(/class="mk-row"/g) || []).length);
check('region listing rows include a claim link', regionDocs.every(function (doc) {
  const rows = (doc.html.match(/class="mk-row"/g) || []).length;
  return rows > 0 && (doc.html.match(/data-claim-listing="1"/g) || []).length === rows;
}));
check('a blank website is an em dash', usa.html.indexOf('>R.E. Uptegraff Mfg</a>') !== -1 && usa.html.indexOf('<span class="site">—</span>') !== -1);

const countryNames = model.countries.map(function (row) { return row.country; });
function placeAt(name) { return countryNames.indexOf(name); }
check('Philippines sorts before Thailand', placeAt('Philippines') !== -1 && placeAt('Philippines') < placeAt('Thailand'));
check('Türkiye sorts after Tunisia and before Uganda', placeAt('Tunisia') < placeAt('Türkiye') && placeAt('Türkiye') < placeAt('Uganda'));

const germany = model.countries.filter(function (row) { return row.country === 'Germany'; })[0];
const names = germany.makers.map(function (maker) { return maker[0]; });
const sorted = names.slice().sort(function (a, b) { return a.localeCompare(b, 'en', { sensitivity: 'base' }); });
check('Germany listings stay alphabetical', names.join('|') === sorted.join('|'));

check('USA slug stays short', geo.countrySlug('USA') === 'usa' && geo.countrySlug('United Arab Emirates') === 'uae');

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
    insertBefore(node) { this.children.unshift(node); return node; },
    addEventListener(type, fn) { this['on' + type] = fn; },
    scrollIntoView() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function run(search) {
  const html = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
  const start = html.indexOf('const DATA_URL');
  const end = html.indexOf('</script>', start);
  const source = html.slice(start, end).replace('loadData();', 'globalThis.__ready = loadData();');
  const nodes = {};
  function get(id) { return nodes[id] || (nodes[id] = el(id)); }
  const history = { url: '', replaceState(state, title, url) { this.url = url; } };
  const context = {
    console: console,
    document: { getElementById: get, createElement() { return el(''); } },
    fetch: function (url) {
      const u = String(url);
      if (u.indexOf('manufacturers.json') !== -1) {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve(census); } });
      }
      if (u.indexOf('company-slugs.json') !== -1) {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve(JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'))); } });
      }
      return Promise.resolve({ ok: false, json: function () { return Promise.resolve([]); } });
    },
    location: { pathname: '/manufacturers.html', search: search, hash: '' },
    history: history,
    URLSearchParams: URLSearchParams,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'manufacturers.html' });
  return context.__ready.then(function () { return { context: context, nodes: nodes, history: history }; });
}

(async function main() {
  const germanyMakers = censusCount(census.filter(function (row) { return row.country === 'Germany'; })[0]);
  const ui = await run('?region=europe&country=germany');
  const count = ui.nodes.count.textContent;
  check('URL region and country filter the census',
    count.indexOf('Showing ' + germanyMakers + ' ') === 0 && ui.nodes.fRegion.value === 'Europe' && ui.nodes.fCountry.value === 'Germany',
    count + ' region=' + ui.nodes.fRegion.value + ' country=' + ui.nodes.fCountry.value);
  check('the filtered address is written back',
    ui.history.url.indexOf('region=Europe') !== -1 && ui.history.url.indexOf('country=Germany') !== -1,
    ui.history.url);
  ui.nodes.fType.value = 'PT';
  ui.nodes.search.value = 'siemens';
  ui.context.page = 1;
  ui.context.render();
  const narrowed = ui.nodes.count.textContent;
  const expected = (census.filter(function (row) { return row.country === 'Germany'; })[0].makers || []).filter(function (maker) {
    return !/^Served by/i.test(maker[0]) &&
      String(maker[3] || '').split(',').map(function (token) { return token.trim(); }).indexOf('PT') !== -1 &&
      (maker[0] + ' ' + (maker[1] || '') + ' Germany').toLowerCase().indexOf('siemens') !== -1;
  }).length;
  check('region and country combine with search and category',
    narrowed.indexOf('Showing ' + expected + ' ') === 0 && ui.history.url.indexOf('region=Europe') !== -1 && ui.history.url.indexOf('country=Germany') !== -1,
    narrowed + ' expected ' + expected + ' url ' + ui.history.url);

  const plain = await run('');
  const stats = JSON.parse(fs.readFileSync(path.join(root, 'data/site-stats.json'), 'utf8'));
  const aliases = require('../lib/company-aliases');
  const slugRows = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
  const slugMap = {};
  slugRows.forEach(function (row) {
    if (row && row.name && row.slug) slugMap[row.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = row.slug;
  });
  const visibleCount = aliases.visibleMakerCount(census, slugMap);
  check('an empty query lists each company once',
    plain.nodes.count.textContent.indexOf('Showing ' + visibleCount + ' ') === 0 && visibleCount === stats.manufacturers - 7,
    plain.nodes.count.textContent);

  if (failed) {
    console.error('directory geo tests failed (' + failed + ')');
    process.exit(1);
  }
  console.log('directory geo tests passed (' + regionDocs.length + ' regions, ' + countryDocs.length + ' countries)');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
