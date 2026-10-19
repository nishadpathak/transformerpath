#!/usr/bin/env node
/* Sourced spec records: a filled field has a public URL, a date, and a quote.
 * Run: node tests/manufacturer-specs.js
 */
'use strict';

const specs = require('../lib/manufacturer-specs');
const doc = specs.load();
const errors = specs.validate(doc);

function fail(msg) { errors.push(msg); }

const by = {};
doc.companies.forEach(function (c) { by[c.slug] = c; });

const hy = by['hyosung-heavy-industries'];
if (!hy || !hy.max_voltage_kv || hy.max_voltage_kv.value !== 765) fail('Hyosung voltage');
if (!hy || hy.iso.length !== 3) fail('Hyosung ISO count');
if (hy && hy.iso.some(function (c) { return c.standard === 'ISO 9001' && c.quote !== 'ISO9001'; })) fail('Hyosung ISO quote');

const va = by['virginia-transformer-corp'];
if (!va || va.max_voltage_kv.value !== 525 || va.mva.max !== 1400) fail('Virginia ratings');
if (va && va.iso.length) fail('Virginia ISO was not named on the About Us page');

const pro = by['prolec-ge'];
if (!pro || !pro.parent || pro.parent.name !== 'GE Vernova') fail('Prolec parent');
if (pro && pro.parent.quote.indexOf('remaining 50%') < 0) fail('Prolec parent quote');

const high = specs.withVoltageAtLeast(doc, 400);
if (high.length < 5) fail('fewer than 5 makers at 400 kV');
if (specs.withProduct(doc, 'DT').length >= 5) fail('distribution gate should stay closed until 5 sources');
if (specs.withProduct(doc, 'DRY').length >= 5) fail('dry-type gate should stay closed until 5 sources');

const html = specs.renderHtml(hy);
if (html.indexOf('765') < 0 || html.indexOf('hyosungheavyindustries.com') < 0) fail('Hyosung render');
if (html.indexOf('ISO 9001') < 0) fail('Hyosung ISO render');

const empty = doc.companies.filter(function (c) {
  return !c.max_voltage_kv && !c.mva && !c.plants.length && !c.iso.length && !c.parent && !c.products.length;
});
if (empty.length < 100) fail('expected most of the 150 to stay empty, got ' + empty.length + ' empty');

if (errors.length) {
  console.error('MANUFACTURER SPECS FAIL');
  errors.forEach(function (e) { console.error('  ' + e); });
  process.exit(1);
}
console.log('MANUFACTURER SPECS OK companies=' + doc.companies.length + ' empty=' + empty.length + ' at-400kV=' + high.length);
