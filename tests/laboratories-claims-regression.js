#!/usr/bin/env node
/* Laboratories must not show a voltage unit or a capability checkmark
 * unless that value is a sourced field. Placeholder rows say the scope
 * is not restated. */
'use strict';
const fs = require('fs');

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

function scopeUnsourced(lab) {
  const sc = String(lab.short_circuit_capacity || '');
  const scope = String((lab.accreditation && lab.accreditation.scope) || '');
  return /not restated/i.test(sc) || /as published on the laboratory website/i.test(scope);
}

function card(name) {
  const start = ssr.indexOf('>' + name + '<');
  if (start < 0) return '';
  const end = ssr.indexOf('class="lab-card"', start + 10);
  return ssr.slice(start, end < 0 ? start + 5000 : end);
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
  check(lab.name + ' states voltage is missing', piece.indexOf('Voltage not stated') >= 0);
  check(lab.name + ' does not render a kV pill', !/\d[\d,]*\s*kV Peak/.test(piece), piece.slice(0, 180));
  check(lab.name + ' does not check a capability', piece.indexOf('✓ Yes') < 0);
  check(lab.name + ' marks every capability unknown', (piece.match(/— unknown/g) || []).length === 10, String((piece.match(/— unknown/g) || []).length));
});

const kema = labs.find(function (lab) { return lab.id === 'lab:kema-labs-arnhem'; });
const kemaCard = card(kema.name);
check('KEMA keeps its sourced voltage', kemaCard.indexOf(kema.max_voltage_kv + ' kV Peak') >= 0);
check('KEMA keeps a sourced checkmark', kemaCard.indexOf('✓ Yes') >= 0);

const verifiedAccred = labs.filter(function (lab) {
  const body = String((lab.accreditation && lab.accreditation.body) || '');
  return lab.accreditation && String(lab.accreditation.standard || '').indexOf('17025') >= 0 && body && !/as published/i.test(body);
}).length;
check('accreditation stat is the verified count of the directory', ssr.indexOf(verifiedAccred + ' of ' + labs.length) >= 0, verifiedAccred + ' of ' + labs.length);
check('page does not claim every laboratory is accredited', ssr.indexOf('>' + labs.length + '<') < 0 || ssr.indexOf(labs.length + ' of ' + labs.length) < 0);
check('no empty kV pill in the directory', !/>\s*kV(?:\s|Peak|<)/.test(ssr));

if (failed) {
  console.error('LABORATORY CLAIMS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('LABORATORY CLAIMS OK');
