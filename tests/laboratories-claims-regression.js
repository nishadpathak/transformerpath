#!/usr/bin/env node
/* Laboratories must not show a voltage unit or a capability checkmark
 * unless that value is a sourced field. Placeholder rows say the scope
 * is not restated. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const { accreditationScopeState } = require('../lib/laboratory-evidence');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const data = JSON.parse(fs.readFileSync('data/laboratories.json', 'utf8'));
const labs = data.laboratories || [];
const html = fs.readFileSync('laboratories.html', 'utf8');
const ssr = html.slice(0, html.indexOf('var LABS'));
const machines = fs.readFileSync('machinery.html', 'utf8');
const directory = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies;
const directorySsr = require('../lib/directory-ssr');
const cpri = labs.find(function (lab) { return lab.id === 'lab:cpri-bengaluru'; });
const doble = labs.find(function (lab) { return lab.id === 'lab:doble-engineering-watertown'; });

function scopeUnsourced(lab) {
  const sc = String(lab.short_circuit_capacity || '');
  const scope = String((lab.accreditation && lab.accreditation.scope) || '');
  return /not restated/i.test(sc) || /as published on the laboratory website/i.test(scope);
}

function card(name, area) {
  area = area || ssr;
  const start = area.indexOf('>' + name.replace(/&/g, '&amp;') + '<');
  if (start < 0) return '';
  const end = area.indexOf('class="lab-card"', start + 10);
  return area.slice(start, end < 0 ? start + 5000 : end);
}

console.log('=== LABORATORY CLAIMS ===');
const unsourced = labs.filter(scopeUnsourced);
check('four laboratories leave the scope unrestated', unsourced.length === 4, String(unsourced.length));
unsourced.forEach(function (lab) {
  const caps = lab.capabilities || {};
  const sourcedTrue = Object.keys(caps).filter(function (k) { return caps[k] === true; });
  check(lab.name + ' has no sourced capability true', sourcedTrue.length === 0, sourcedTrue.join(','));
  const piece = card(lab.name);
  check(lab.name + ' card is on the page', piece.length > 0);
  check(lab.name + ' hides an empty voltage pill', piece.indexOf('kv-pill') < 0 && !/kV Peak/.test(piece));
  check(lab.name + ' does not check a capability', piece.indexOf('✓ Yes') < 0);
  check(lab.name + ' marks every capability Not stated', (piece.match(/Not stated/g) || []).length === 10, String((piece.match(/Not stated/g) || []).length));
});

const kema = labs.find(function (lab) { return lab.id === 'lab:kema-labs-arnhem'; });
const kemaCard = card(kema.name);
check('KEMA has no blanket voltage or unscoped accreditation claim', kema.max_voltage_kv === null && !/kV Peak|1200 kV/.test(kemaCard) && kemaCard.includes('rva.nl/en/alle-geaccrediteerden/l020/') && kemaCard.includes('2030-04-01'));
check('KEMA keeps sourced capability checkmarks', kemaCard.includes('✓ Yes') && kema.capabilities.short_circuit === true && !kema.capabilities.oil_testing);

function checkCpri(piece, stage) {
  check(stage + ' CPRI confirms the HPL closure and dates past scope without an RFQ',
    piece.includes('High Power Laboratory temporarily closed') && piece.includes('Official status notice') &&
    piece.includes('250 MVA') && piece.includes('220/400 kV') &&
    !/rfq\.html\?company=|✓ Yes|kV Peak|1200 kV/.test(piece));
}
checkCpri(card(cpri.name), 'SSR');
const dobleCard = card(doble.name);
check('Doble uses ANAB Marlborough oil methods only', doble.city === 'Marlborough, Massachusetts' && dobleCard.includes('AT-2637') &&
  dobleCard.includes('ASTM D3612 Method C') && dobleCard.includes('2026-12-05') &&
  !/500 kV|kV Peak|A2LA|Watertown/.test(dobleCard) && Object.keys(doble.capabilities).join(',') === 'oil_testing');
check('ANAB scope is historical only after its own end date',
  accreditationScopeState(doble.accreditation, '2026-12-05') === 'current' &&
  accreditationScopeState(doble.accreditation, '2026-12-06') === 'historical');

const labScript = html.match(/<script>\s*(var LABS = [\s\S]+?)<\/script>/)[1];
const nodes = Object.create(null);
const sandbox = { document: { getElementById: function (id) {
  if (!nodes[id]) nodes[id] = { addEventListener: function () {} };
  return nodes[id];
} } };
vm.runInNewContext(labScript, sandbox);
vm.runInNewContext("searchQuery = 'CPRI'; renderCards();", sandbox);
checkCpri(card(cpri.name, nodes.labGrid.innerHTML), 'Client search');
vm.runInNewContext("requiredCaps.short_circuit = true; renderCards();", sandbox);
check('CPRI is not included in active short-circuit filter', !nodes.labGrid.innerHTML.includes(cpri.name));
vm.runInNewContext("Date = class extends Date { constructor() { super('2026-12-06T00:00Z'); } }; requiredCaps = {}; searchQuery = 'Doble'; renderCards();", sandbox);
check('Doble client shows expired scope as historical', nodes.labGrid.innerHTML.includes('Historical accreditation:') && nodes.labGrid.innerHTML.includes('a renewed scope is not recorded'));

function row(slug) { return directory.find(function (d) { return d.slug === slug; }); }
const cpriSearch = row('cpri-bengaluru');
check('Global index uses CPRI as reference-only and excludes technical claims',
  cpriSearch && cpriSearch.reference_only === true && !cpriSearch.voltage.num && !cpriSearch.mva.value && !cpriSearch.certs.length);
const cpriGlobalCard = directorySsr.directoryRoot([cpriSearch], {});
check('Global SSR card links the notice but not a live CPRI RFQ',
  cpriGlobalCard.includes('High Power Laboratory temporarily closed') && cpriGlobalCard.includes('Official status notice') &&
  !cpriGlobalCard.includes('rfq.html?company='));
const cpriVendorCard = directorySsr.vendors([cpriSearch]).listHtml;
check('Vendor SSR card cannot attach closed CPRI to a shortlist',
  cpriVendorCard.includes('Official status notice') && !/rfq\.html\?company=|vnd-select/.test(cpriVendorCard));
['doble-engineering-watertown', 'kema-labs-arnhem'].forEach(function (slug) {
  const l = row(slug);
  check(slug + ' has linked scope without a numerical claim', l && l.source_meta.source_url.startsWith('https://') &&
    !l.voltage.num && !l.mva.value && l.capability_evidence.voltage === 'UNKNOWN' && l.capability_evidence.mva === 'UNKNOWN');
});
check('unsupported machinery offers removed from both public directories',
  !/weidmann-cnc-insulation-machining|de-angeli-ctc-line|Weidmann Component Machining CNC Center|De Angeli CTC Transposition/.test(machines) &&
  !row('weidmann-cnc-insulation-machining') && !row('de-angeli-ctc-line') &&
  directory.some(function (d) { return d.kind === 'component_supplier' && /De Angeli Prodotti/.test(d.name); }) &&
  directory.some(function (d) { return d.kind === 'component_supplier' && /Weidmann Electrical Technology/.test(d.name); }));

const rfqMarkup = fs.readFileSync('rfq.html', 'utf8');
const schedule = Array.from(rfqMarkup.matchAll(/<script(?:\s[^>]*)?>\s*([\s\S]*?)<\/script>/g), function (m) { return m[1]; })
  .find(function (script) { return script.includes('function loadQueryParams'); });
function exerciseRfq(query, lab) {
  const elements = {};
  const calls = [];
  function response(value) {
    return {
      then: function (fn) { return response(fn(value)); },
      catch: function () {}
    };
  }
  vm.runInNewContext(schedule, {
    document: { getElementById: function (id) {
      return elements[id] || (elements[id] = { value: '', style: {}, addEventListener: function () {} });
    } },
    window: { location: { search: query } },
    URLSearchParams: URLSearchParams,
    fetch: function (url) {
      calls.push(url);
      return response({ ok: !!lab, json: function () { return { companies: lab ? [lab] : [] }; } });
    }
  });
  return { fields: elements, calls: calls };
}
const closedRfq = exerciseRfq('?company=' + encodeURIComponent(cpri.name) + '&suppliers=other,cpri-bengaluru&rating=50', cpriSearch);
check('Opening a stale CPRI quote keeps other targets and never prefills the closed lab',
  closedRfq.fields.fld_rating.value === '50' && closedRfq.fields.fld_supplier_shortlist.value === 'other' &&
  !(closedRfq.fields.fld_details && closedRfq.fields.fld_details.value) &&
  closedRfq.fields.rfqTargetStatus.textContent.includes('not attached') &&
  closedRfq.calls.join(',') === 'data/directory-index.json');
const otherRfq = exerciseRfq('?company=Other+Lab&suppliers=other', null);
check('Ordinary quote links and their existing prefill remain unchanged',
  otherRfq.fields.fld_details.value.includes('Other Lab') && otherRfq.fields.fld_supplier_shortlist.value === 'other' &&
  !otherRfq.calls.length);

const verifiedAccred = labs.filter(function (lab) {
  const body = String((lab.accreditation && lab.accreditation.body) || '');
  return lab.accreditation && String(lab.accreditation.standard || '').indexOf('17025') >= 0 && body && !/as published/i.test(body) && accreditationScopeState(lab.accreditation) !== 'historical';
}).length;
check('accreditation stat is the verified count of the directory', ssr.indexOf(verifiedAccred + ' of ' + labs.length) >= 0, verifiedAccred + ' of ' + labs.length);
check('page does not claim every laboratory is accredited', ssr.indexOf('>' + labs.length + '<') < 0 || ssr.indexOf(labs.length + ' of ' + labs.length) < 0);
check('no empty kV pill in the directory', !/>\s*kV(?:\s|Peak|<)/.test(ssr));

if (failed) {
  console.error('LABORATORY CLAIMS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('LABORATORY CLAIMS OK');
