/* Saved calculator snapshots round-trip the inputs the page can reopen. */
'use strict';

const assert = require('assert');
const design = require('../lib/saved-design.js');

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + name + '  -> ' + (e && e.message));
  }
}

check('snapshot keeps known inputs and drops unknown fields', function () {
  const snap = design.snapshot({
    type: 'power',
    skva: '100',
    hv: '132000',
    vec: 'YNd11',
    secret: 'nope',
    type_extra: 'nope',
  }, { rating: '100 MVA', vector: 'YNd11' });
  assert.strictEqual(snap.inputs.type, 'power');
  assert.strictEqual(snap.inputs.skva, '100');
  assert.strictEqual(snap.inputs.secret, undefined);
  assert.strictEqual(snap.summary.rating, '100 MVA');
  assert.strictEqual(snap.version, '2.1');
});

check('readInputs copies checkbox and text values', function () {
  const inputs = design.readInputs(function (id) {
    if (id === 'type') return 'dist';
    if (id === 'autogr') return '1';
    if (id === 'std') return 'iec';
    return undefined;
  });
  assert.strictEqual(inputs.type, 'dist');
  assert.strictEqual(inputs.autogr, '1');
  assert.strictEqual(inputs.std, 'iec');
  assert.strictEqual(inputs.hv, undefined);
});

check('validateSnapshot rejects a result-only blob', function () {
  assert.throws(function () { design.validateSnapshot({ summary: {} }); }, /missing calculator inputs/);
});

check('an unchecked box is stored and still applied', function () {
  assert.strictEqual(design.checkboxValue(false), '0');
  assert.strictEqual(design.checkboxValue(true), '1');
  assert.strictEqual(design.isChecked('0'), false);
  assert.strictEqual(design.isChecked(''), false);
  assert.strictEqual(design.isChecked('1'), true);
  assert.strictEqual(design.shouldApply('', true), true);
  assert.strictEqual(design.shouldApply('0', true), true);
  assert.strictEqual(design.shouldApply('', false), false);
  assert.strictEqual(design.shouldApply(null, true), false);
});

check('default name uses the calculated rating', function () {
  assert.strictEqual(design.defaultName({ rating: '1000 kVA', vector: 'Dyn11' }, {}), '1000 kVA Dyn11');
  assert.strictEqual(design.defaultName(null, { skva: '1000', vec: 'Dyn11' }), '1000 Dyn11');
  assert.strictEqual(design.defaultName(null, {}), 'Untitled design');
});

if (failed) {
  console.log(failed + ' failed');
  process.exit(1);
}
console.log('saved design snapshots OK');
