#!/usr/bin/env node
/* autotransformer-calculators.test.js
 *
 * Ports the old Phase 1 and Phase 2 autotransformer checks (winding ratio,
 * common current, rating plate, impedance) onto the plain-node runner.
 *
 * The 100 MVA, 132/66 kV, uk 12.5%, D/Y case is unchanged where the old
 * tests already matched theory: a = 2, I_LV ≈ 874.77 A, series and common
 * ≈ 437.39 A, turns fractions 0.5 and 0.5, HV impedance voltage 16.5 kV.
 *
 * Four old expectations contradicted that theory and are locked the other
 * way here:
 *   - N_series:N_common at a = 2 is 1 : 1, not infinity.
 *   - Percent impedance is not divided by a², so LV uk stays 12.5%, not 3.125%.
 *   - A common-winding percent is not ((a−1)/a)² · uk.
 *   - LV impedance voltage is 0.125 × 66 kV = 8.25 kV, not 2.06 kV.
 *   - The connection pair is DY. The clock hour is not forced to 11.
 *   - uk% outside 4–15 is not rejected. Clause 4.1 is I_sc, not a cap.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var calc = require('../viz/autotransformer-calculators.js');
var sizing = require('../viz/autotransformer-sizing.js');

var problems = [];
var checks = 0;
function ok(c, m) {
  checks += 1;
  console.log((c ? '  ok — ' : '  ✗ ') + m);
  if (!c) problems.push(m);
}

var DONE = {
  ratedMva: 100,
  primaryKv: 132,
  secondaryKv: 66,
  primaryConnection: 'D',
  secondaryConnection: 'Y',
  ukPercent: 12.5
};

function compute(over) {
  var input = {};
  Object.keys(DONE).forEach(function (k) { input[k] = DONE[k]; });
  if (over) Object.keys(over).forEach(function (k) { input[k] = over[k]; });
  return calc.computeAutotransformer(input);
}

console.log('AUTOTRANSFORMER CALCULATORS\n');

var sqrt3 = Math.sqrt(3);
var iLv = 100e6 / (sqrt3 * 66e3);

var ratioOnly = calc.computeAutotransformer({
  ratedMva: 100, primaryKv: 132, secondaryKv: 66,
  primaryConnection: 'D', secondaryConnection: 'Y'
});
ok(ratioOnly.ok === true && ratioOnly.ukPercent === calc.UK_PERCENT_DEFAULT, 'omitted uk% defaults to 12.5');
ok(calc.UK_PERCENT_DEFAULT === 12.5, 'default uk% is 12.5');
ok(Math.abs((132 / 66) - 2) < 1e-12, 'ratio helper case 132/66 is 2');
ok(Math.abs((230 / 34.5) - (230 / 34.5)) < 1e-12, '230/34.5 ratio is finite');

var r = compute();
ok(r.ok === true, '100 MVA, 132/66 kV, uk 12.5, D/Y is accepted');
ok(r.ratedMva === 100 && r.primaryKv === 132 && r.secondaryKv === 66, 'rating-plate inputs are kept');
ok(r.primaryConnection === 'D' && r.secondaryConnection === 'Y', 'connections stay D and Y');
ok(r.vectorGroup === 'DY', 'vector group is the two connection letters');
ok(r.vectorGroup !== 'DY11' && r.clockNumber === null, 'clock hour is not assumed to be 11');
ok(r.ukPercent === 12.5, 'uk% is the value entered');
ok(r.windingRatio === 2, 'winding ratio a is 2');
ok(r.throughCurrentLvA > 874.7 && r.throughCurrentLvA < 874.8, 'LV through current is about 874.77 A');
ok(Math.abs(r.throughCurrentLvA - iLv) < 1e-6, 'I_LV = S / (√3 · V_LV)');
ok(r.commonCurrentA >= 437.3 && r.commonCurrentA <= 437.5, 'common current is about 437.4 A');
ok(Math.abs(r.commonCurrentA - (iLv * 0.5)) < 1e-6, 'common current is I_LV × (a−1)/a');
ok(Math.abs(r.seriesCurrentHvA - (iLv / 2)) < 1e-6, 'series current is I_LV / a');
ok(Math.abs(r.seriesCurrentHvA - r.commonCurrentA) < 1e-9, 'at a = 2 series current equals common current');
ok(Math.abs(r.seriesCurrentHvA - (100000 / (sqrt3 * 132))) < 1e-6, 'series current is the HV line current');
ok(Math.abs(r.commonCurrentA - (r.throughCurrentLvA - r.seriesCurrentHvA)) < 1e-9, 'common current is I_LV − I_HV');
ok(Math.abs(r.commonCurrentPercent - 50) < 1e-9, 'common current is 50% of LV current');
ok(Math.abs((100 - r.commonCurrentPercent) - 50) < 1e-9, 'the common winding carries 50% less than I_LV');
ok(Math.abs(r.nSeriesFraction - 0.5) < 1e-12 && Math.abs(r.nCommonFraction - 0.5) < 1e-12, 'turn fractions of the total are 0.5 and 0.5');
ok(r.turnsSplit === '1 : 1', 'series:common turns are 1 : 1 at a = 2');
ok(r.turnsSplit.indexOf('∞') === -1, 'a = 2 is not rendered as infinity');
ok(Math.abs(r.seriesVoltageKv - 66) < 1e-12, 'series-section voltage is HV − LV');
ok(Math.abs(r.seriesVoltageKv - 132) > 1, 'series-section voltage is not the HV terminal voltage');
ok(Math.abs(r.coRatio - 0.5) < 1e-12, 'co-ratio is 0.5');
ok(Math.abs(r.equivalentMva - 50) < 1e-9, 'equivalent rating is 50 MVA');

ok(r.impedance.primaryPercent === 12.5, 'HV percent impedance is the entered uk%');
ok(r.impedance.secondaryPercent === 12.5, 'LV percent impedance stays 12.5% at the same throughput');
ok(Math.abs(r.impedance.secondaryPercent - 3.125) > 0.1, 'LV percent is not uk / a²');
ok(r.impedance.commonPercent === null, 'common-winding percent is not invented');
ok(Math.abs(r.impedance.primaryOhm - 21.78) < 1e-9, 'HV ohms are (0.125) × 132² / 100');
ok(Math.abs(r.impedance.secondaryOhm - 5.445) < 1e-9, 'LV ohms are (0.125) × 66² / 100');
ok(Math.abs(r.impedance.secondaryOhm - (r.impedance.primaryOhm / 4)) < 1e-9, 'ohmic LV impedance is HV ohms / a²');
ok(Math.abs(r.impedance.primaryImpedanceVoltageKv - 16.5) < 1e-12, 'HV impedance voltage is 0.125 × 132 kV');
ok(Math.abs(r.impedance.secondaryImpedanceVoltageKv - 8.25) < 1e-12, 'LV impedance voltage is 0.125 × 66 kV');
ok(Math.abs(r.impedance.secondaryImpedanceVoltageKv - 2.06) > 0.5, 'LV impedance voltage is not 2.06 kV');
ok(r.impedance.label.indexOf('§3') === -1, 'impedance label does not cite clause 3');
ok(Math.abs(r.impedance.secondaryScA - (iLv / 0.125)) < 1e-6, 'LV short-circuit current is I / (uk/100)');
ok(Math.abs(r.impedance.primaryScA - (r.seriesCurrentHvA / 0.125)) < 1e-6, 'HV short-circuit current is I_HV / (uk/100)');
ok(Math.abs(r.impedance.scMva - 800) < 1e-9, 'short-circuit power is 800 MVA');
ok(Math.abs(r.impedance.secondaryScA - r.impedance.scMva) > 1, 'short-circuit current is not the MVA figure');

ok(calc.format1(r.throughCurrentLvA) === '874.8', 'LV current displays as 874.8 A');
ok(calc.format1(r.seriesCurrentHvA) === '437.4', 'series current displays as 437.4 A');
ok(calc.format1(r.commonCurrentA) === '437.4', 'common current displays as 437.4 A');
ok(calc.formatMva(r.equivalentMva) === '50', 'equivalent rating displays as 50');
ok(calc.format2(r.impedance.primaryImpedanceVoltageKv) === '16.50', 'HV impedance voltage displays as 16.50 kV');
ok(calc.format2(r.impedance.secondaryImpedanceVoltageKv) === '8.25', 'LV impedance voltage displays as 8.25 kV');
ok(calc.format2(r.impedance.primaryOhm) === '21.78', 'HV ohms display as 21.78');
ok(calc.format3(r.impedance.secondaryOhm) === '5.445', 'LV ohms display as 5.445');
ok(calc.format3(r.impedance.secondaryScA / 1000) !== '800' && calc.format3(r.impedance.secondaryScA / 1000) !== '800.000', 'LV kA text is not 800');

var sized = sizing.autotransformerSizing({ throughMva: 100, hvKv: 132, lvKv: 66 });
ok(Math.abs(r.equivalentMva - sized.equivalentMva) < 1e-9, 'equivalent rating matches the sizing page');
ok(Math.abs(r.commonCurrentA - sized.iCommonA) < 1e-6, 'common current matches the sizing page');
ok(Math.abs(r.seriesCurrentHvA - sized.iSeriesA) < 1e-6, 'series current matches the sizing page');
ok(calc.format1(r.throughCurrentLvA) === sized.iLvText, 'LV display matches the sizing page');

ok(calc.formatTurns(3) === '2 : 1', 'a = 3 is 2 : 1');
ok(calc.formatTurns(1.5) === '0.5 : 1', 'a = 1.5 is 0.5 : 1');
ok(calc.formatTurns(230 / 34.5).indexOf('∞') === -1, '230/34.5 turns are finite');

var a230 = 230 / 34.5;
var wide = compute({ primaryKv: 230, secondaryKv: 34.5, ukPercent: 10 });
ok(wide.ok === true, '230/34.5 kV, uk 10% is accepted');
ok(Math.abs(wide.windingRatio - a230) < 1e-12, 'winding ratio is 230/34.5');
ok(wide.impedance.secondaryPercent === 10, '230/34.5 percent is not divided by a²');
ok(Math.abs(wide.impedance.secondaryPercent - (10 / (a230 * a230))) > 0.1, '230/34.5 LV percent is not the ohmic scale factor');
ok(Math.abs(wide.impedance.primaryOhm / (a230 * a230) - wide.impedance.secondaryOhm) < 1e-6, '230/34.5 ohms still scale with a²');
ok(wide.impedance.commonPercent === null, '230/34.5 does not invent a common percent');

var a3 = compute({ primaryKv: 99, secondaryKv: 33, ukPercent: 9, primaryConnection: 'Y', secondaryConnection: 'Y' });
ok(a3.ok === true && a3.windingRatio === 3, '99/33 kV is a = 3');
ok(a3.turnsSplit === '2 : 1', 'a = 3 turns split is 2 : 1');
ok(a3.vectorGroup === 'YY', 'Y/Y stays YY');
ok(a3.impedance.primaryPercent === 9 && a3.impedance.secondaryPercent === 9, 'a = 3 percent stays 9 on both terminals');
ok(Math.abs(a3.impedance.secondaryPercent - 1) > 0.5, 'a = 3 LV percent is not uk/9');
ok(Math.abs(a3.impedance.secondaryOhm * 9 - a3.impedance.primaryOhm) < 1e-9, 'a = 3 ohms scale by 9');
ok(Math.abs(a3.impedance.secondaryImpedanceVoltageKv - 2.97) < 1e-12, 'a = 3 LV impedance voltage is 0.09 × 33');
ok(Math.abs(a3.commonCurrentPercent - (200 / 3)) < 1e-9, 'a = 3 common current is 66.666…% of I_LV');
ok(a3.impedance.commonPercent === null, 'a = 3 common percent is not 4');

var uk8 = compute({ ukPercent: 8 });
ok(uk8.impedance.primaryPercent === 8 && uk8.impedance.secondaryPercent === 8, 'uk 8% stays 8% on both terminals');
ok(Math.abs(uk8.impedance.secondaryPercent - 2) > 0.5, 'uk 8% is not scaled to 2%');
ok(Math.abs(uk8.impedance.primaryImpedanceVoltageKv - 10.56) < 1e-12, 'uk 8% HV impedance voltage is 10.56 kV');
ok(Math.abs(uk8.impedance.secondaryImpedanceVoltageKv - 5.28) < 1e-12, 'uk 8% LV impedance voltage is 5.28 kV');

[3.5, 3.999, 4, 15, 15.1, 16, 20].forEach(function (uk) {
  var got = compute({ ukPercent: uk });
  ok(got.ok === true && got.ukPercent === uk, 'uk ' + uk + '% is accepted');
  ok(got.impedance.secondaryPercent === uk, 'uk ' + uk + '% is not divided by a²');
});
ok(compute({ ukPercent: 4 }).impedance.primaryImpedanceVoltageKv === 0.04 * 132, 'uk 4% still uses uk × U');
ok(compute({ ukPercent: 15 }).impedance.secondaryImpedanceVoltageKv === 0.15 * 66, 'uk 15% still uses uk × U on LV');

function rejection(over) {
  return compute(over);
}
var zeroMva = rejection({ ratedMva: 0 });
ok(zeroMva.ok === false && zeroMva.failures[0].field === 'ratedMva', 'zero power is rejected on ratedMva');
ok(rejection({ ratedMva: -50 }).ok === false, 'negative power is rejected');
ok(rejection({ ratedMva: 1000 }).ok === false, 'power above 500 MVA is rejected');
ok(rejection({ primaryKv: 66, secondaryKv: 66 }).ok === false, 'equal voltages are rejected');
ok(rejection({ primaryKv: 66, secondaryKv: 132 }).ok === false, 'step-up voltages are rejected');
ok(rejection({ primaryKv: 2500 }).ok === false, 'primary voltage above 2000 kV is rejected');
ok(rejection({ ukPercent: 0 }).ok === false, 'uk 0 is rejected');
ok(rejection({ ukPercent: -1 }).ok === false, 'negative uk is rejected');
ok(rejection({ ukPercent: 101 }).ok === false, 'uk above 100% is rejected');
var ukZero = rejection({ ukPercent: 0 });
ok(ukZero.failures.some(function (f) { return f.field === 'ukPercent'; }), 'uk 0 names the ukPercent field');
ok(!/4\.0|15\.0|envelope|§4\.1|clause 4\.1/.test(ukZero.error), 'uk rejection does not cite a 4–15 envelope or clause 4.1');
ok(rejection({ primaryConnection: 'N' }).ok === false, 'connection N is rejected');
ok(rejection({ secondaryConnection: 'd' }).ok === false, 'lowercase d is rejected');
ok(rejection({ primaryConnection: 'Dyn' }).ok === false, 'Dyn is rejected as a connection letter');
ok(rejection({ primaryConnection: 'D', secondaryConnection: 'Y' }).ok === true, 'D/Y remains valid');

var conns = ['D', 'Y', 'Z'];
var matrixOk = true;
conns.forEach(function (p) {
  conns.forEach(function (s) {
    var got = compute({ primaryConnection: p, secondaryConnection: s });
    if (!got.ok || got.vectorGroup !== p + s || /11$/.test(got.vectorGroup)) matrixOk = false;
  });
});
ok(matrixOk, 'all nine D/Y/Z pairs pass and none is given hour 11');

var src = fs.readFileSync(path.join(__dirname, '../viz/autotransformer-calculators.js'), 'utf8');
ok(src.indexOf('∞') === -1, 'calculator source has no infinity turns cutoff');
ok(src.indexOf('/ (a * a)') === -1 && src.indexOf('/(a*a)') === -1 && src.indexOf('/ (a*a)') === -1, 'percent is not divided by a squared in the source');
ok(src.indexOf('§3') === -1 && src.indexOf('IEC 60076-5 clause 3') !== -1, 'clause 3 is named only to say it is not the split');

var html = fs.readFileSync(path.join(__dirname, '../autotransformer.html'), 'utf8');
ok(html.indexOf('id="winding-ratio"') !== -1, 'winding-ratio card is on the page');
ok(html.indexOf('id="common-current"') !== -1, 'common-current card is on the page');
ok(html.indexOf('id="rating-plate"') !== -1, 'rating-plate card is on the page');
ok(html.indexOf('id="impedance"') !== -1, 'impedance card is on the page');
ok(html.indexOf('viz/autotransformer-calculators.js') !== -1, 'page loads the calculator module');
ok(html.indexOf('id="c3d"') !== -1 && html.indexOf('5-limb core') !== -1, '3D core reference stays');
ok(html.indexOf('YNa0(d)') !== -1, '400/220 connection note stays');
ok(html.indexOf('Series winding') !== -1 && html.indexOf('Common winding') !== -1, 'series and common winding notes stay');
ok(html.indexOf('Delta tertiary') !== -1, 'tertiary note stays');
ok(html.indexOf('no galvanic isolation') !== -1, 'isolation note stays');
ok(html.indexOf('hello@transformerpath.com') !== -1, 'contact address is hello@transformerpath.com');

var blockStart = html.indexOf('id="at-validation"');
var block = html.slice(blockStart, blockStart + 1600);
ok(block.indexOf('100 MVA') !== -1 && block.indexOf('132') !== -1 && block.indexOf('66') !== -1 && block.indexOf('12.5') !== -1, 'validation example states the inputs');
ok(block.indexOf('1 : 1') !== -1, 'validation example states turns 1 : 1');
ok(block.indexOf('874.8 A') !== -1, 'validation example states 874.8 A');
ok(block.indexOf('437.4 A') !== -1, 'validation example states 437.4 A');
ok(block.indexOf('50 MVA') !== -1, 'validation example states 50 MVA');
ok(block.indexOf('12.5%') !== -1, 'validation example keeps percent impedance at 12.5%');
ok(block.indexOf('21.78') !== -1 && block.indexOf('5.445') !== -1, 'validation example states both ohmic values');
ok(block.indexOf('16.5 kV') !== -1 && block.indexOf('8.25 kV') !== -1, 'validation example states both impedance voltages');
ok(block.indexOf('IEEE C57.12.10') !== -1 && block.indexOf('IEC 60076-1') !== -1 && block.indexOf('IEC 60076-5') !== -1, 'validation example cites the three standards');
ok(block.indexOf('3.125') === -1 && block.indexOf('2.06') === -1, 'validation example does not publish the divided percent or the 2.06 kV drop');
ok(html.indexOf('DY11') === -1, 'page does not assume DY11');
ok(html.indexOf('Z_HV / a') === -1 && html.indexOf('Z_LV = Z_HV') === -1, 'page does not divide percent impedance by a²');
ok(!/tan[\s-]?brief/i.test(html), 'page does not name TanBrief');
ok(!/polsia/i.test(html), 'page does not name Polsia');
ok(!/Dubai|\bUAE\b|United Arab Emirates/.test(html), 'page does not name Dubai or the UAE');
ok(!/\$\s*\d/.test(html), 'page adds no price');

var workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/engineering-math.yml'), 'utf8');
ok(workflow.indexOf('tests/autotransformer-calculators.test.js') !== -1, 'engineering-math CI runs these checks');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nAUTOTRANSFORMER CALCULATORS OK — ' + checks + ' checks');
