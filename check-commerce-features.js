#!/usr/bin/env node
/* CI gate: every priced feature in data/commerce.json carries delivery
 * "built" or "coming_soon", and every public pricing surface that names
 * that feature uses the same flag. Coming-soon features must show the
 * words "Coming soon" on the element. Built features must not.
 *
 * Catalog source is data/products.json feature_delivery, copied into
 * data/commerce.json by build-commerce.js. This check fails if commerce.json
 * has drifted from that list.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAGES = [
  'pricing.html',
  'intel-pro.html',
  'verified.html',
  'list-company.html',
  'sponsor.html'
];

const DELIVERIES = { built: true, coming_soon: true };

function fail(msg) {
  console.error('FAIL  ' + msg);
  return msg;
}

function load(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function featureElements(html) {
  const out = [];
  const re = /<([a-zA-Z0-9]+)([^>]*\bdata-feature="([^"]+)"[^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[1];
    const attrs = m[2];
    const id = m[3];
    const deliveryMatch = attrs.match(/\bdata-delivery="([^"]+)"/);
    const start = m.index + m[0].length;
    const close = new RegExp('</' + tag + '\\s*>', 'i').exec(html.slice(start));
    if (!close) {
      out.push({ id: id, delivery: deliveryMatch ? deliveryMatch[1] : '', text: '', broken: true });
      continue;
    }
    const inner = html.slice(start, start + close.index);
    out.push({
      id: id,
      delivery: deliveryMatch ? deliveryMatch[1] : '',
      text: inner.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
    });
  }
  return out;
}

function main() {
  const errors = [];
  const products = load('data/products.json');
  const commerce = load('data/commerce.json');
  const source = products.feature_delivery || [];
  const catalog = commerce.features || [];

  if (!source.length) errors.push(fail('data/products.json feature_delivery is empty'));
  if (!catalog.length) errors.push(fail('data/commerce.json features is empty — run node build-commerce.js'));

  const sourceIds = {};
  source.forEach(function (f) {
    if (!f || !f.id) { errors.push(fail('feature_delivery entry missing id')); return; }
    if (sourceIds[f.id]) errors.push(fail('duplicate feature_delivery id ' + f.id));
    sourceIds[f.id] = f;
    if (!DELIVERIES[f.delivery]) errors.push(fail(f.id + ' delivery must be built or coming_soon, got ' + f.delivery));
    if (!f.label) errors.push(fail(f.id + ' missing label'));
  });

  const catalogIds = {};
  catalog.forEach(function (f) {
    if (!f || !f.id) { errors.push(fail('commerce feature missing id')); return; }
    if (catalogIds[f.id]) errors.push(fail('duplicate commerce feature id ' + f.id));
    catalogIds[f.id] = f;
    if (!DELIVERIES[f.delivery]) errors.push(fail('commerce feature ' + f.id + ' delivery must be built or coming_soon'));
    const src = sourceIds[f.id];
    if (!src) errors.push(fail('commerce feature ' + f.id + ' is not in products.json feature_delivery'));
    else if (src.delivery !== f.delivery) errors.push(fail(f.id + ' delivery drifted: products.json ' + src.delivery + ' vs commerce.json ' + f.delivery));
  });
  Object.keys(sourceIds).forEach(function (id) {
    if (!catalogIds[id]) errors.push(fail(id + ' is in products.json but missing from commerce.json features'));
  });

  const seen = {};
  PAGES.forEach(function (file) {
    if (!fs.existsSync(file)) { errors.push(fail('missing page ' + file)); return; }
    const html = fs.readFileSync(file, 'utf8');
    featureElements(html).forEach(function (el) {
      if (el.broken) { errors.push(fail(file + ' unclosed data-feature=' + el.id)); return; }
      const spec = catalogIds[el.id];
      if (!spec) { errors.push(fail(file + ' data-feature="' + el.id + '" is not in commerce.json')); return; }
      if (el.delivery !== spec.delivery) {
        errors.push(fail(file + ' ' + el.id + ' data-delivery="' + el.delivery + '" but commerce.json says ' + spec.delivery));
      }
      const marked = el.text.indexOf('Coming soon') >= 0;
      if (spec.delivery === 'coming_soon' && !marked) {
        errors.push(fail(file + ' ' + el.id + ' is coming_soon but the element does not say Coming soon'));
      }
      if (spec.delivery === 'built' && marked) {
        errors.push(fail(file + ' ' + el.id + ' is built but the element says Coming soon'));
      }
      seen[el.id] = true;
    });
  });

  catalog.forEach(function (f) {
    if (!seen[f.id]) errors.push(fail(f.id + ' (' + f.delivery + ') is not marked on ' + PAGES.join(', ')));
  });

  if (errors.length) {
    console.error(errors.length + ' commerce feature check failure(s)');
    process.exit(1);
  }
  const soon = catalog.filter(function (f) { return f.delivery === 'coming_soon'; }).length;
  const built = catalog.filter(function (f) { return f.delivery === 'built'; }).length;
  console.log('commerce features ok: ' + catalog.length + ' (' + built + ' built, ' + soon + ' coming_soon)');
}

main();
