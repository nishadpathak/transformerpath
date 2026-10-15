#!/usr/bin/env node
/* Published validation examples on each calculator.
 * The expected figures are recomputed from the textbook relations cited on
 * the page (IEC 60076-1 current, IEC 60076-5 clause 4.1, IEEE C57.12.10
 * co-ratio, sinusoidal EMF). The HTML must show those figures.
 */
'use strict';
const fs = require('fs');
const sizing = require('../viz/autotransformer-sizing.js');
const np = require('../viz/nameplate-short-circuit.js');
const { threePhaseCurrent, parallelLoadShare } = require('../js/tp-grid-calc.js');

const problems = [];
function ok(c, m) {
  console.log((c ? '  ok — ' : '  ✗ ') + m);
  if (!c) problems.push(m);
}
function read(rel) { return fs.readFileSync(rel, 'utf8'); }
function has(html, needle, label) { ok(html.includes(needle), label + ' contains ' + needle); }

console.log('CALCULATOR VALIDATION EXAMPLES\n');

const auto = read('autotransformer-sizing.html');
const autoBlock = auto.slice(auto.indexOf('id="auto-validation"'), auto.indexOf('id="auto-validation"') + 900);
const autoR = sizing.autotransformerSizing({ throughMva: 100, hvKv: 132, lvKv: 66 });
ok(autoBlock.includes('100 MVA') && autoBlock.includes('132') && autoBlock.includes('66'), 'autotransformer example states the inputs');
has(autoBlock, autoR.coRatio.toFixed(1), 'autotransformer co-ratio');
has(autoBlock, autoR.equivalentMvaText + ' MVA', 'autotransformer equivalent rating');
has(autoBlock, autoR.iLvText + ' A', 'autotransformer LV current');
has(autoBlock, autoR.iSeriesText + ' A', 'autotransformer series current');
has(autoBlock, autoR.iCommonText + ' A', 'autotransformer common current');
ok(autoBlock.includes('IEEE C57.12.10') && autoBlock.includes('IEC 60076-1'), 'autotransformer cites IEEE C57.12.10 and IEC 60076-1');

const calc = read('calculator.html');
const nameBlock = calc.slice(calc.indexOf('id="nameplate-validation"'), calc.indexOf('id="nameplate-validation"') + 900);
const nameR = np.nameplateShortCircuit({ mva: 63, kv: 230, ukPercent: 12.5 });
ok(nameBlock.includes('63 MVA') && nameBlock.includes('230 kV') && nameBlock.includes('12.5%'), 'nameplate example states the inputs');
has(nameBlock, nameR.ratedText + ' A', 'nameplate rated current');
has(nameBlock, nameR.scKaText + ' kA', 'nameplate short-circuit current');
has(nameBlock, nameR.scMvaText + ' MVA', 'nameplate short-circuit power');
ok(nameBlock.includes('IEC 60076-1') && nameBlock.includes('IEC 60076-5'), 'nameplate cites IEC 60076-1 and IEC 60076-5');

const designBlock = calc.slice(calc.indexOf('id="design-validation"'), calc.indexOf('id="design-validation"') + 1400);
const S = 1000, f = 50, hv = 11000, lv = 433, K = 0.45, Bm = 1.7, tap = 5;
let Et = K * Math.sqrt(S);
const Vlvp = lv / Math.sqrt(3);
const Tlv = Math.round(Vlvp / Et);
Et = Vlvp / Tlv;
const AiCm = Et / (4.44 * f * Bm) * 1e4;
const Thv = Math.round(Tlv * hv / Vlvp);
const ThvMax = Math.round(Thv * (1 + tap / 100));
const fmt = (v, dp) => Number(v).toLocaleString('en', { maximumFractionDigits: dp, minimumFractionDigits: dp });
const IlvL = S * 1e3 / (Math.sqrt(3) * lv);
const IhvL = S * 1e3 / (Math.sqrt(3) * hv);
ok(designBlock.includes('1,000 kVA') && designBlock.includes('Dyn11'), 'design example states the inputs');
has(designBlock, 'LV turns ' + Tlv, 'design LV turns');
has(designBlock, 'HV turns ' + Thv, 'design HV turns');
has(designBlock, String(ThvMax), 'design tap turns');
has(designBlock, fmt(Et, 3) + ' V', 'design volts per turn');
has(designBlock, fmt(AiCm, 1) + ' cm²', 'design core area');
has(designBlock, fmt(IlvL, 1) + ' A', 'design LV line current');
has(designBlock, fmt(IhvL, 2) + ' A', 'design HV line current');
has(designBlock, fmt(IhvL / Math.sqrt(3), 2) + ' A', 'design HV winding current');
has(designBlock, '75 / 28 kV', 'design IEC 60076-3 insulation level for Um 12 kV');
ok(designBlock.includes('IEC 60076-1') && designBlock.includes('IEC 60076-3'), 'design example cites IEC 60076-1 and IEC 60076-3');

const learn = read('learn.html');
const learnBlock = learn.slice(learn.indexOf('id="sizing-validation"'), learn.indexOf('id="sizing-validation"') + 1600);
const kva = 1000, HVk = 11, LVk = 0.433, Bk = 1.65, dens = 2.8, Kk = 0.45, fk = 50;
const Etk = Kk * Math.sqrt(kva);
const Ac = Etk / (4.44 * fk * Bk) * 1e4;
const fmt0 = (n, d) => n.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
const Nhv = (HVk * 1000 / Math.sqrt(3)) / Etk;
const Nlv = (LVk * 1000 / Math.sqrt(3)) / Etk;
const Ihv = (kva * 1000) / (Math.sqrt(3) * HVk * 1000);
const Ilv = (kva * 1000) / (Math.sqrt(3) * LVk * 1000);
ok(learn.includes('* 1000') && /HV\*1000/.test(learn), 'sizing engine converts line kV to volts');
ok(learnBlock.includes('1,000 kVA') && learnBlock.includes('11 kV') && learnBlock.includes('0.433 kV'), 'sizing example states the inputs');
has(learnBlock, fmt0(Etk, 2) + ' V', 'sizing volts per turn');
has(learnBlock, fmt0(Ac, 0) + ' cm²', 'sizing core area');
has(learnBlock, 'HV turns ' + fmt0(Nhv, 0), 'sizing HV turns');
has(learnBlock, 'LV turns ' + fmt0(Nlv, 0), 'sizing LV turns');
has(learnBlock, fmt0(Ihv, 1) + ' A', 'sizing HV current');
has(learnBlock, fmt0(Ilv, 0) + ' A', 'sizing LV current');
has(learnBlock, fmt0(Ihv / dens, 1) + ' mm²', 'sizing HV conductor');
has(learnBlock, fmt0(Ilv / dens, 0) + ' mm²', 'sizing LV conductor');
ok(learnBlock.includes('IEC 60076-1') && learnBlock.includes('4.44'), 'sizing example cites IEC 60076-1 and the EMF equation');
ok(!learnBlock.includes('52,486') && !learnBlock.includes('0 turns'), 'sizing example does not publish the kilovolt-as-volt result');

const grid = read('grid-lab.html');
const i21 = Math.round(threePhaseCurrent(1000, 21)).toLocaleString('en');
const i400 = Math.round(threePhaseCurrent(1000, 400)).toLocaleString('en');
const share = parallelLoadShare(140, 100, 12.5, 100, 12.5, true, true);
['id="grid-lab-validation"', 'id="grid-lab-validation-a11y"'].forEach(function (id) {
  const block = grid.slice(grid.indexOf(id), grid.indexOf(id) + 800);
  ok(block.includes('1,000 MVA') && block.includes('21 kV') && block.includes('400 kV'), id + ' states the inputs');
  has(block, i21 + ' A', id + ' 21 kV current');
  has(block, i400 + ' A', id + ' 400 kV current');
  has(block, share.t1MVA + ' MVA', id + ' parallel share');
  ok(block.includes('IEC 60076-1'), id + ' cites IEC 60076-1');
});

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nCALCULATOR VALIDATION EXAMPLES OK');
