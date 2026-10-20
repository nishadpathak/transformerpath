#!/usr/bin/env node
/* Sourced stock flags. Unset listings stay blank. Prices stay the existing three. */
'use strict';
const fs = require('fs');
const path = require('path');
const availability = require('../lib/availability');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    failed++;
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
  }
}

const root = path.join(__dirname, '..');
const doc = JSON.parse(fs.readFileSync(path.join(root, 'data/company-availability.json'), 'utf8'));
const rows = doc.companies || [];
const map = availability.load(root);
const prices = 'Featured $299/yr, Featured + Verified $699/yr, Component Sponsor $199/mo.';

check('sidecar rows are the loaded flags', rows.length === Object.keys(map).length && rows.length > 0, String(rows.length));
rows.forEach(function (row) {
  check(row.slug + ' is a known flag with a source and a date',
    !!availability.VALUES[row.availability] &&
      /^https:\/\/\S+$/.test(row.availability_source) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.availability_checked));
  const mark = availability.markHtml(row, row.slug);
  check(row.slug + ' badge links the existing claim form',
    mark.indexOf('data-availability="' + row.availability + '"') !== -1 &&
      mark.indexOf('href="/claim-listing/' + row.slug + '/"') !== -1 &&
      mark.indexOf('data-claim-listing') === -1 &&
      mark.indexOf(prices) !== -1 &&
      mark.indexOf('buy.stripe.com') === -1);
});
check('no Elin company is flagged', !rows.some(function (row) { return /elin/i.test(row.slug); }));
check('public manufacturer count stays 887', require('../lib/public-company-count').read(root).publicCount === 887);

['lib/availability.js', 'data/company-availability.json'].forEach(function (rel) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  check(rel + ' has no Dubai or UAE location', !/\bDubai\b|\bUAE\b|United Arab Emirates/i.test(text));
  check(rel + ' adds no Stripe link', text.indexOf('buy.stripe.com') === -1);
});
check('mark copy uses only the existing prices', availability.PRICES === prices);
check('chip offers shippable units', availability.chipHtml().indexOf('>Shippable units<') !== -1 && availability.chipHtml().indexOf('data-shippable-filter="1"') !== -1);

const mark = availability.markHtml(map['hammond-power-solutions'], 'hammond-power-solutions');
check('hammond mark does not say the site holds units', !/transformerpath (holds|stocks|resells|sells)/i.test(mark));

function row(flagged) {
  const node = {
    attrs: {},
    hidden: false,
    children: flagged ? [{ attrs: { 'data-availability': 'in_stock' } }] : [],
    getAttribute: function (name) { return this.attrs[name]; },
    setAttribute: function (name, value) { this.attrs[name] = value; },
    querySelector: function (sel) {
      if (sel !== '[data-availability]') return null;
      return this.children[0] || null;
    }
  };
  return node;
}
const button = row(false);
button.attrs['aria-pressed'] = 'false';
button.addEventListener = function (type, fn) { this.onclick = fn; };
const empty = { hidden: true };
const sampleRows = [row(true), row(false), row(false)];
const documentStub = {
  querySelector: function () { return button; },
  getElementById: function () { return empty; },
  querySelectorAll: function () { return sampleRows; }
};
const script = availability.filterScript().replace(/^<script>/, '').replace(/<\/script>$/, '');
require('vm').runInNewContext(script, { document: documentStub });
check('shippable filter starts with every row visible', sampleRows.every(function (item) { return item.hidden === false; }));
button.onclick();
check('shippable filter keeps only flagged rows', sampleRows[0].hidden === false && sampleRows[1].hidden === true && sampleRows[2].hidden === true && button.getAttribute('aria-pressed') === 'true');
button.onclick();
check('shippable filter restores the full list', sampleRows.every(function (item) { return item.hidden === false; }) && button.getAttribute('aria-pressed') === 'false');

if (failed) {
  console.error('AVAILABILITY FLAG FAILED (' + failed + ')');
  process.exit(1);
}
console.log('AVAILABILITY FLAG PASS');
