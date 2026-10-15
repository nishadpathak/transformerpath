#!/usr/bin/env node
/* Group events stay on the group. A subsidiary event is attached only when the
 * title names that subsidiary. A factory event requires a SOURCED facility
 * whose city or site the item names. The Hitachi Energy India investment must
 * not appear on the China, HQ, or other Hitachi entities.
 */
'use strict';
const fs = require('fs');
const { assignEntityScope, sourcedFacilityId } = require('../lib/entity-scope');
const { norm } = require('../lib/company-aliases');

const GENERIC = {
  transformer: 1, transformers: 1, electric: 1, electrical: 1, energy: 1, power: 1,
  group: 1, company: 1, limited: 1, ltd: 1, llc: 1, inc: 1, industries: 1,
  industrial: 1, solutions: 1, heavy: 1, international: 1, and: 1, the: 1, co: 1,
  corp: 1, corporation: 1, saog: 1, gmbh: 1, plc: 1
};

const companies = [
  { id: 'g', name: 'Hitachi Energy' },
  { id: 'in', name: 'Hitachi Energy India' },
  { id: 'ltd', name: 'Hitachi Energy India Ltd' },
  { id: 'cq', name: 'Hitachi Energy (Chongqing / Shanghai)' },
  { id: 'hq', name: 'Hitachi Energy (global HQ)' },
  { id: 'nj', name: 'Hitachi Energy (Insulation & Components, Nanjangud — formerly Raman Boards)' },
  { id: 'it', name: 'Hitachi Energy Italy' }
];
function co(id) { return companies.find(function (c) { return c.id === id; }); }
function hit(id, phrase) { return { company: co(id), phrase: phrase }; }

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

console.log('=== ENTITY SCOPE ===');
const indiaTitle = norm('Hitachi Energy eyes more India investments amid global power grid demand surge');
const indiaHits = assignEntityScope(
  [hit('g', 'hitachi energy'), hit('cq', 'hitachi energy'), hit('hq', 'hitachi energy'), hit('nj', 'hitachi energy')],
  indiaTitle, companies, GENERIC, norm);
const indiaIds = indiaHits.map(function (h) { return h.company.id; }).sort();
check('India investment stays on the group and Hitachi Energy India', indiaIds.join(',') === 'g,in', indiaIds.join(','));
check('India investment is not on Chongqing, HQ, Nanjangud, or India Ltd',
  !indiaHits.some(function (h) { return h.company.id === 'cq' || h.company.id === 'hq' || h.company.id === 'nj' || h.company.id === 'ltd'; }));
const indiaSub = indiaHits.find(function (h) { return h.company.id === 'in'; });
check('India investment scope is subsidiary', indiaSub && indiaSub.scope === 'subsidiary');
check('Group scope stays group', indiaHits.some(function (h) { return h.company.id === 'g' && h.scope === 'group'; }));

const hefeiTitle = norm('China: Hitachi Energy commits $300m to Hefei — a NEW power transformer factory');
const hefeiHits = assignEntityScope([hit('g', 'hitachi energy'), hit('cq', 'hitachi energy')], hefeiTitle, companies, GENERIC, norm);
check('Hefei China investment stays on the group only', hefeiHits.length === 1 && hefeiHits[0].company.id === 'g' && hefeiHits[0].scope === 'group');

const pgcilTitle = norm('Hitachi Energy India wins Rs 6.47bn PGCIL order for 765 kV transformers');
const pgcilHits = assignEntityScope(
  [hit('in', 'hitachi energy india'), hit('ltd', 'hitachi energy india')],
  pgcilTitle, companies, GENERIC, norm);
check('PGCIL order stays on Hitachi Energy India', pgcilHits.length === 1 && pgcilHits[0].company.id === 'in');

const fac = sourcedFacilityId(co('cq'), { title: 'Hitachi Energy expands the Chongqing plant', snippet: '' }, [
  { company_id: 'cq', status: 'SOURCED', city: 'Chongqing', id: 'fac-cq' },
  { company_id: 'cq', status: 'TO_RESEARCH', city: 'Shanghai', id: 'fac-sh' }
], norm);
check('SOURCED city named in the title is a factory event', fac === 'fac-cq');
const notFac = sourcedFacilityId(co('cq'), { title: 'Hitachi Energy commits $300m to Hefei', snippet: 'China factory' }, [
  { company_id: 'cq', status: 'SOURCED', city: 'Chongqing', id: 'fac-cq' }
], norm);
check('Hefei story does not attach to the Chongqing factory', notFac == null);
const unsourced = sourcedFacilityId(co('cq'), { title: 'Shanghai plant', snippet: '' }, [
  { company_id: 'cq', status: 'TO_RESEARCH', city: 'Shanghai', id: 'fac-sh' }
], norm);
check('unsourced census row is not a factory event', unsourced == null);

const INDIA_URL = 'https://www.cnbctv18.com/business/exclusive-hitachi-energy-eyes-more-india-investments-amid-global-power-grid-demand-surge-20011073.htm';
const HEFEI_URL = 'https://transformer-magazine.com/news/hitachi-energy-invests-300-m-in-china/';
const devs = JSON.parse(fs.readFileSync('data/company-developments.json', 'utf8'));
function holders(url) {
  const out = [];
  devs.forEach(function (row) {
    (row.developments || []).forEach(function (d) {
      if (d.url === url) out.push(row.name + ':' + d.event_scope);
    });
  });
  return out.sort();
}
check('published India investment is group + India subsidiary',
  holders(INDIA_URL).join('|') === 'Hitachi Energy India:subsidiary|Hitachi Energy:group',
  holders(INDIA_URL).join('|'));
check('published Hefei investment is the Hitachi Energy group only',
  holders(HEFEI_URL).join('|') === 'Hitachi Energy:group',
  holders(HEFEI_URL).join('|'));
['Hitachi Energy (Chongqing / Shanghai)', 'Hitachi Energy (global HQ)', 'Hitachi Energy (Insulation & Components, Nanjangud — formerly Raman Boards)', 'Hitachi Energy India Ltd', 'Siemens Energy (Transformers Weiz)'].forEach(function (name) {
  check(name + ' has no inherited group developments', !devs.some(function (row) { return row.name === name; }));
});

const events = JSON.parse(fs.readFileSync('data/entity-events.json', 'utf8')).companies_events || {};
function eventHolders(url) {
  return Object.keys(events).filter(function (name) {
    return (events[name].events || []).some(function (e) { return e.url === url; });
  }).sort();
}
check('entity graph keeps the India investment on the group and India',
  eventHolders(INDIA_URL).join('|') === 'Hitachi Energy|Hitachi Energy India',
  eventHolders(INDIA_URL).join('|'));
const indiaEvent = (events['Hitachi Energy India'].events || []).find(function (e) { return e.url === INDIA_URL; });
check('India entity event is scoped subsidiary', indiaEvent && indiaEvent.event_scope === 'subsidiary');

function section(html, heading) {
  const marker = '<h2>' + heading + '</h2>';
  const i = html.indexOf(marker);
  if (i < 0) return '';
  const n = html.indexOf('<h2>', i + marker.length);
  return html.slice(i, n < 0 ? html.length : n);
}
function page(path) { return fs.readFileSync(path, 'utf8'); }
const cq = page('manufacturers/hitachi-energy-chongqing-shanghai/index.html');
const hq = page('manufacturers/hitachi-energy-global-hq/index.html');
const group = page('manufacturers/hitachi-energy/index.html');
const indiaPage = page('manufacturers/hitachi-energy-india/index.html');
check('Chongqing timeline does not list the India investment', section(cq, 'Company timeline').indexOf(INDIA_URL) < 0 && section(cq, 'Recent developments').indexOf(INDIA_URL) < 0);
check('Chongqing timeline does not list the Hefei group investment', section(cq, 'Company timeline').indexOf(HEFEI_URL) < 0);
check('global HQ timeline does not list the India investment', section(hq, 'Company timeline').indexOf(INDIA_URL) < 0 && section(hq, 'Recent developments').indexOf(INDIA_URL) < 0);
check('Hitachi Energy group page keeps the India investment', section(group, 'Company timeline').indexOf(INDIA_URL) >= 0 && section(group, 'Recent developments').indexOf(INDIA_URL) >= 0);
check('Hitachi Energy India page shows the India investment', section(indiaPage, 'Company timeline').indexOf(INDIA_URL) >= 0 && section(indiaPage, 'Recent developments').indexOf(INDIA_URL) >= 0);

const pagesSrc = fs.readFileSync('build-company-pages.js', 'utf8');
check('company pages resolve timeline events from the entity name', /function timelineHtml\(r\) \{[\s\S]*?entityNames\(r\)/.test(pagesSrc));
check('company pages do not inherit a parent timeline via lookupName', pagesSrc.indexOf('const lookup = lookupName(r)') < 0);

if (failed) {
  console.error('ENTITY SCOPE REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('ENTITY SCOPE REGRESSION OK');
