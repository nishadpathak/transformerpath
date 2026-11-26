#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { compare, example } = require('../tools/transformer-tco/calculator');

const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, a + ' != ' + b);
const baseline = compare(example);
assert.equal(baseline.a.annualNoLoad, 8760);
assert.equal(baseline.a.annualLoad, 17520);
assert.equal(baseline.a.annualEnergy, 26280);
close(baseline.a.annualCost, 3153.6);
close(baseline.a.tco, 88072);
close(baseline.b.tco, 74252.8);
close(baseline.gap, 13819.2);
assert.equal(baseline.lower, 'B');
assert.equal(baseline.factor, 20);
close(baseline.a.pvNoLoad + baseline.a.pvLoad, baseline.a.lifetimeCost);
assert.equal(compare({ ...example, a: example.b, b: example.a }).lower, 'A');
assert.equal(compare({ ...example, a: example.b }).lower, null);

const zeroLoad = compare({ ...example, load: 0 });
assert.equal(zeroLoad.a.annualLoad, 0);
assert.equal(zeroLoad.a.annualNoLoad, 8760);
assert.equal(compare({ ...example, load: 100 }).a.annualLoad, 8 * 8760);
close(compare({ ...example, load: Math.sqrt(0.5)*100 }).a.annualLoad, 8 * 8760 * 0.5);

for (const opts of [{ hours: 0 }, { rate: 0 }]) {
  const res = compare({ ...example, ...opts });
  assert.equal(res.a.lifetimeCost, 0);
  assert.equal(res.a.tco, example.a.price);
  assert.equal(res.lower, 'A');
}
assert.equal(compare({ ...example, rate: 0 }).a.annualEnergy, 26280);
assert.equal(compare({ ...example, a: {price:0, noLoad:0, load:0} }).a.tco, 0);

const wQuote = ({ price, noLoad, load }) => ({ price, noLoad:noLoad * 1000, load: load * 1000 });
const watts = compare({ ...example, unit: 'W', a: wQuote(example.a), b: wQuote(example.b) });
close(watts.a.tco, baseline.a.tco);
close(watts.b.tco, baseline.b.tco);

const dr = compare({ ...example, life: 2, discount: 10 });
const factor = 1/1.1 + 1/(1.1**2);
close(dr.factor, factor);
close(dr.a.tco, example.a.price + baseline.a.annualCost * factor);
close(compare({ ...example, discount: 1e-10 }).factor, 20, 1e-9);
assert.equal(compare({ ...example, life: 1, discount: 100 }).factor, 0.5);

for (const bad of [
  { discount: -1 }, { discount: Infinity }, { hours: 8761 }, { hours: NaN },
  { load: 100.01 }, { load: null }, { life: 0 }, { life: 2.7 }, { rate: -0.1 },
  { rate: '' }, { currency: 'bad' }, { unit: 'mw' },
  { a: { ...example.a, price: -1 } }, { b: { ...example.b, load: Infinity } },
  { b: { ...example.b, noLoad: 1e7 } }
]) assert.throws(() => compare({ ...example, ...bad }), RangeError);

const html = fs.readFileSync('tools/transformer-tco/index.html', 'utf8');
const tools = fs.readFileSync('tools.html', 'utf8');
assert.match(tools, /href="\/tools\/transformer-tco\/"[^>]*>/);
assert.match(html, /rel="canonical" href="https:\/\/transformerpath\.com\/tools\/transformer-tco\/"/);
assert.match(html, /tco-basis" type="checkbox" required/);
assert.match(html, /site[s]?\/default\/files\/2024-04\/dt_ecs_fr\.pdf/);
assert.match(html, /liquid-immersed-dist-transformers-final-22-02-16\.pdf/);
assert.doesNotMatch(html, /<script[^>]+(https?:|analytics\.js|adsbygoogle)/i);
const form = html.match(/<form\b[\s\S]+?<\/form>/)[0];
assert.doesNotMatch(form, /<(?:input|select)\b[^>]*\bname=/i, 'No quote input can become a submitted form parameter');
if (process.argv.includes('--dist')) {
  const built = fs.readFileSync('dist/tools/transformer-tco/index.html', 'utf8');
  const scripts = Array.from(built.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi));
  const allowed = new Set(['/tools/transformer-tco/calculator.js', '/consent.js']);
  for (const [, src] of scripts) {
    const u = new URL(src, 'https://transformerpath.com');
    assert.equal(u.origin, 'https://transformerpath.com');
    assert.ok(allowed.has(u.pathname), 'Unexpected script on standalone calculator: ' + u.pathname);
  }
  assert.ok(scripts.some(([,src]) => src.startsWith('/tools/transformer-tco/calculator.js')));
  assert.match(fs.readFileSync('dist/sitemap.xml', 'utf8'), /<loc>https:\/\/transformerpath\.com\/tools\/transformer-tco\/<\/loc>/);
  console.log('PASS — published calculator stays standalone and is in the sitemap');
}
console.log('PASS — transformer TCO examples, input guards, units, discounting, source links and entry point');
