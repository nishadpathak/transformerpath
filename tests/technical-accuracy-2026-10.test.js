#!/usr/bin/env node
/* Technical review, 16 Oct 2026 — the published pages must carry the
 * corrected limits and editions, and must not keep the retired wording.
 */
'use strict';
const fs = require('fs');
const problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }
function read(rel) { return fs.readFileSync(rel, 'utf8'); }

const mc = require('../functions/lib/masterclass-chapters.js');
const cooling = mc.cooling.html;
const testing = mc.testing.html;
const standards = mc.standards.html;
const vector = mc.vectorgroups.html;
const site = mc.sitelife.html;
const after = mc.aftersales.html;
const gloss = mc.glossary.html;

ok(cooling.includes('120 °C (non-upgraded paper) / 140 °C (thermally upgraded)'), 'cooling: normal cyclic 120/140 °C');
ok(cooling.includes('140 °C (non-upgraded paper) / 160 °C (thermally upgraded)'), 'cooling: long-time emergency 140/160 °C');
ok(cooling.includes('Hot-spot ≤ 160 °C — IEC 60076-7:2018 Table 2'), 'cooling: short-time 160 °C');
ok(!cooling.includes('Hotspot ≤ 120 °C, top oil'), 'cooling: old single 120 °C cell is gone');

ok(testing.includes('≤ 250 pC at 1.58'), 'testing: 250 pC at 1.58 Ur/√3');
ok(testing.includes('no rise &gt; 50 pC') && testing.includes('no rise greater than 50 pC'), 'testing: rise limit 50 pC');
ok(testing.includes('≤ 100 pC at 1.2'), 'testing: 100 pC at 1.2 Ur/√3');
ok(!testing.includes('100 pC typical') && !testing.includes('100–250 pC'), 'testing: old PD band is gone');
ok(testing.includes('IEC 60076-1:2011 cl. 11.1.2.2'), 'testing: >72.5 kV routine clause');
ok(testing.includes('IEC 60270:2025'), 'testing: IEC 60270:2025');
ok(testing.includes('combustible-gas total includes CO'), 'testing: TDCG includes CO');

ok(standards.includes('IEC 60076-1:2011'), 'standards map: IEC 60076-1:2011');
ok(standards.includes('IEEE C57.12.90-2026'), 'standards map: C57.12.90-2026');
ok(standards.includes('replaces the 2021 edition'), 'standards map: 2026 replaces 2021');
ok(standards.includes('IEEE C57.91-2025'), 'standards map: C57.91-2025');
ok(standards.includes('EN 50110-1:2023'), 'standards map: EN 50110-1:2023');
ok(standards.includes('IEC 60599:2022'), 'standards map: IEC 60599:2022');
ok(standards.includes('IEC 60270:2025'), 'standards map: IEC 60270:2025');

ok(vector.includes('Z₀ follows the winding connection and the core'), 'vector groups: Z0 depends on connection and core');
ok(vector.includes('Dyn, 3-limb') && vector.includes('0.85–1.0 × Z₁') && vector.includes('5-limb or shell'), 'vector groups: connection-specific ranges kept');
ok(site.includes('H₂ + CH₄ + C₂H₆ + C₂H₄ + C₂H₂ + CO'), 'site life: combustible total includes CO');
ok(site.includes('EN 50110-1:2023'), 'site life: EN 50110-1:2023');
ok(after.includes('includes CO in that total'), 'aftersales: combustible total includes CO');
ok(gloss.includes('saturates near 2.03 T') && gloss.includes('1.6–1.75 T'), 'glossary: saturation and design flux');

const guide = read('construction-guide.html');
ok(guide.includes('≤ 250 pC, no rise > 50 pC'), 'construction guide: PD at 1.58 Ur/√3');
ok(guide.includes('≤ 100 pC (IEC 60076-3)'), 'construction guide: PD at 1.2 Ur/√3');
ok(guide.includes('cl. 11.1.2.2'), 'construction guide: routine tests above 72.5 kV');
ok(!guide.includes('≤ 300 pC'), 'construction guide: 300 pC limit is gone');

const reg = read('data/standards.json');
ok(reg.includes('"standard_code": "IEEE Std C57.12.90"'), 'registry still lists C57.12.90');
ok(reg.includes('Current Edition: 2026 (replaces 2021)'), 'registry: C57.12.90 edition 2026');
ok(reg.includes('Current Edition: 2011 (Edition 3.0)'), 'registry: IEC 60076-1 stays 2011');
const page = read('standards.html');
ok(page.includes('Current Edition: 2026 (replaces 2021)'), 'standards page embeds the 2026 edition');
ok(page.includes('IEEE C57.12.90-2026'), 'standards page names C57.12.90-2026');

for (const pair of [
  ['learn.html', '2.03 T'],
  ['design.html', 'Typical design flux is 1.6–1.75 T'],
  ['calculator.html', 'CRGO saturates near 2.03 T'],
  ['knowledge/transformer-life-aging.html', 'each 6 K'],
  ['knowledge/transformer-overheating.html', 'Each extra 6 K'],
  ['knowledge/transformer-overloading.html', '120/140 °C'],
  ['knowledge/insulation-class.html', 'each extra 6 °C'],
  ['knowledge/type-vs-routine-test.html', '11.1.2.2'],
  ['knowledge/transformer-standard-testing-requirements.html', '11.1.2.2'],
  ['knowledge/transformer-partial-discharge-test.html', '≤ 250 pC'],
  ['knowledge/partial-discharge.html', '≤ 250 pC'],
  ['knowledge/transformer-oil-dga-hydrogen.html', 'C2H2 + CO'],
  ['knowledge/transformer-zero-sequence-test.html', '3-limb, 5-limb or shell']
]) {
  ok(read(pair[0]).includes(pair[1]), pair[0] + ' contains ' + pair[1]);
}

const retired = ['6-10 K', '6–10 °C', '1.9 T hard ceiling', 'knee at ≈1.9'];
for (const file of ['learn.html', 'design.html', 'calculator.html', 'construction-guide.html', 'build-knowledge.js', 'functions/lib/masterclass-chapters.js']) {
  const text = read(file);
  for (const phrase of retired) ok(!text.includes(phrase), file + ' does not say ' + phrase);
}

console.log('\nTECHNICAL ACCURACY: ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
process.exitCode = problems.length ? 1 : 0;
