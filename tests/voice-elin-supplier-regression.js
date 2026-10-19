#!/usr/bin/env node
/* The site voice "Elin" stays banned. The supplier Elin Insulation does not. */
'use strict';
const banned = /\bELIN\b(?!\s+Insulation\b)(?!-insulation\b)/i;

let failed = 0;
function check(label, pass) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label); failed++; }
}

check('supplier name is allowed', !banned.test('Elin Insulation FZ LLC stocks pressboard'));
check('supplier slug is allowed', !banned.test('slug elin-insulation-fz-llc'));
check('bare Elin voice is still banned', banned.test('Ask Elin for a walkthrough'));
check('personal reference stays banned', /\bpersonal\s+reference\b/i.test('a personal reference'));

if (failed) {
  console.error('VOICE ELIN SUPPLIER REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — voice Elin supplier regression');
