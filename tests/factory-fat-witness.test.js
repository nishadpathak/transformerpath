'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const lesson = path.join(root, 'learn/factory-path/fat');
const html = fs.readFileSync(path.join(lesson, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(lesson, 'fat.js'), 'utf8');

assert.match(html, /rel="canonical" href="https:\/\/transformerpath\.com\/learn\/factory-path\/fat\/"/);
assert.match(html, /href="\/learn\/factory-path\/"/);
assert.match(html, /id="fat-interactive" hidden/);
assert.match(html, /<details id="fat-workthrough">\s*<summary>Read the witness reasoning and sample note/);
assert.match(html, /fictional training case/i);
assert.match(html, /case-specific signoff rule/i);
assert.match(html, /id="nameplate"[\s\S]*?Manufacturer serial<\/dt><dd><code>SIM-26-0417<\/code>/);
assert.match(html, /id="sheet-three"[\s\S]*?SIM-26-0471/);
assert.match(html, /mismatch proves neither an electrical failure nor a pass/i);
assert.match(html, /original unit-linked records/);
assert.match(html, /webstore\.iec\.ch\/en\/publication\/98615/);
assert.match(html, /jip33\.iogp\.org/);
assert.equal((html.match(/type="radio" name="fat-outcome"/g) || []).length, 3);
assert(!/<form\b|mailto:|<input[^>]*type="(?:submit|email)"/i.test(html), 'no form or collection');
assert(!/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML/i.test(js), 'exercise is side-effect free');

const feedback = {textContent:''};
let selected = null;
let focused = 0;
const events = {};
const ui = {
  hidden:true,
  addEventListener: (type, fn) => { events['ui:' + type] = fn; },
  querySelector: query => query === 'input' ? {focus: () => { focused++; }} : selected,
};
const check = {addEventListener: (type, fn) => { events['check:' + type] = fn; }};
const elements = {'fat-interactive':ui, 'fat-check':check, 'fat-feedback':feedback};
vm.runInNewContext(js, {document:{getElementById: id => elements[id]}});
assert.equal(ui.hidden, false);
events['check:click']();
assert.equal(focused, 1);
assert.match(feedback.textContent, /Choose a disposition/);
for (const [value, expected] of [
  ['accept', /matching cover.*different serial/],
  ['hold', /hold signoff.*does not establish electrical failure/i],
  ['reject', /does not prove.*failed electrically/],
]) {
  selected = {value};
  events['ui:change']();
  assert.equal(feedback.textContent, '');
  events['check:click']();
  assert.match(feedback.textContent, expected);
}
console.log('FAT witness case: fictional evidence, no-JS walkthrough, source links, decision feedback, and no submissions verified.');
