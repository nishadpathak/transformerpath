/* Four autotransformer calculators: winding ratio, common current,
 * rating plate, and terminal impedance.
 *
 * Three-phase step-down. Throughput S is the power that passes from the
 * HV terminal to the LV terminal. Voltages are line-to-line.
 *
 *   a = V_HV / V_LV
 *   N_series : N_common = (V_HV − V_LV) : V_LV = (a − 1) : 1
 *   I = S / (√3 · U)                         IEC 60076-1
 *   I_series = I_HV = I_LV / a
 *   I_common = I_LV − I_HV = I_LV · (a − 1) / a
 *   S_eq = S · (1 − V_LV / V_HV)             IEEE C57.12.10 co-ratio
 *
 * Percent impedance at the same throughput is not divided by a². Ohmic
 * impedance does scale with U²: Z_ohm = (uk/100) · U² / S. One measured
 * uk% is the leakage between the series and common sections. It is not
 * split into a common-winding percent, and IEC 60076-5 clause 3 is not
 * that split. Clause 4.1 is the symmetrical short-circuit current
 * I_sc = I_rated / (uk/100). It is not a 4–15% acceptance band.
 *
 * CommonJS for tests; also attached to window for the page.
 */
'use strict';

var CONNECTIONS = { D: true, Y: true, Z: true };
var MVA_MAX = 500;
var KV_MAX = 2000;
var UK_PERCENT_DEFAULT = 12.5;
var UK_PERCENT_MAX = 100;

function format1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function format2(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function format3(n) {
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

function formatMva(n) {
  var rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(1);
}

function formatTurns(a) {
  var perCommon = a - 1;
  var text = perCommon.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return text + ' : 1';
}

function rejected(failures) {
  var error = failures.length === 1
    ? failures[0].message
    : 'Rejected — ' + failures.length + ' errors.';
  return { ok: false, error: error, failures: failures };
}

function readNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() === '') return NaN;
  return Number(value);
}

function computeAutotransformer(input) {
  input = input || {};
  var failures = [];
  var ratedMva = readNumber(input.ratedMva);
  var primaryKv = readNumber(input.primaryKv);
  var secondaryKv = readNumber(input.secondaryKv);
  var ukRaw = input.ukPercent;
  var ukPercent = (ukRaw === undefined || ukRaw === null || ukRaw === '')
    ? UK_PERCENT_DEFAULT
    : readNumber(ukRaw);
  var primaryConnection = input.primaryConnection;
  var secondaryConnection = input.secondaryConnection;

  if (!isFinite(ratedMva)) {
    failures.push({ field: 'ratedMva', message: 'Rated power must be a finite number.' });
  } else if (!(ratedMva > 0)) {
    failures.push({ field: 'ratedMva', message: 'Rated power must be greater than zero.' });
  } else if (ratedMva > MVA_MAX) {
    failures.push({ field: 'ratedMva', message: 'Rated power must not exceed 500 MVA.' });
  }

  if (!isFinite(primaryKv)) {
    failures.push({ field: 'primaryKv', message: 'Primary voltage must be a finite number.' });
  } else if (!(primaryKv > 0)) {
    failures.push({ field: 'primaryKv', message: 'Primary voltage must be greater than zero.' });
  } else if (primaryKv > KV_MAX) {
    failures.push({ field: 'primaryKv', message: 'Primary voltage (kV) must not exceed 2000.' });
  }

  if (!isFinite(secondaryKv)) {
    failures.push({ field: 'secondaryKv', message: 'Secondary voltage must be a finite number.' });
  } else if (!(secondaryKv > 0)) {
    failures.push({ field: 'secondaryKv', message: 'Secondary voltage must be greater than zero.' });
  } else if (secondaryKv > KV_MAX) {
    failures.push({ field: 'secondaryKv', message: 'Secondary voltage (kV) must not exceed 2000.' });
  }

  if (isFinite(primaryKv) && isFinite(secondaryKv) && primaryKv > 0 && secondaryKv > 0 &&
      !(primaryKv > secondaryKv + 1e-9)) {
    failures.push({
      field: 'primaryKv',
      message: 'Autotransformer primary voltage must exceed secondary voltage (step-down). Swap the fields for a step-up unit.'
    });
  }

  if (!isFinite(ukPercent)) {
    failures.push({ field: 'ukPercent', message: 'uk% must be a finite number.' });
  } else if (!(ukPercent > 0)) {
    failures.push({ field: 'ukPercent', message: 'Percent impedance must be greater than zero.' });
  } else if (ukPercent > UK_PERCENT_MAX) {
    failures.push({ field: 'ukPercent', message: 'Percent impedance must not exceed 100.' });
  }

  if (!CONNECTIONS[primaryConnection]) {
    failures.push({ field: 'primaryConnection', message: 'Primary connection must be D, Y or Z.' });
  }
  if (!CONNECTIONS[secondaryConnection]) {
    failures.push({ field: 'secondaryConnection', message: 'Secondary connection must be D, Y or Z.' });
  }

  if (failures.length) return rejected(failures);

  var a = primaryKv / secondaryKv;
  if (!(a >= 1.0001)) {
    return rejected([{
      field: 'primaryKv',
      message: 'Winding ratio must be at least 1.0001 (step-down autotransformer). Got a = ' + a.toFixed(4) + '.'
    }]);
  }

  var sqrt3 = Math.sqrt(3);
  var throughA = (ratedMva * 1e6) / (sqrt3 * secondaryKv * 1000);
  var seriesA = throughA / a;
  var commonA = throughA * (a - 1) / a;
  var commonPercent = (100 * (a - 1)) / a;
  var coRatio = (primaryKv - secondaryKv) / primaryKv;
  var equivalentMva = ratedMva * coRatio;
  var seriesVoltageKv = primaryKv - secondaryKv;
  var zPu = ukPercent / 100;
  var primaryOhm = zPu * primaryKv * primaryKv / ratedMva;
  var secondaryOhm = zPu * secondaryKv * secondaryKv / ratedMva;

  return {
    ok: true,
    ratedMva: ratedMva,
    primaryKv: primaryKv,
    secondaryKv: secondaryKv,
    primaryConnection: primaryConnection,
    secondaryConnection: secondaryConnection,
    /* Connection letters do not set the clock hour. */
    vectorGroup: primaryConnection + secondaryConnection,
    clockNumber: null,
    ukPercent: ukPercent,
    windingRatio: a,
    nSeriesFraction: (a - 1) / a,
    nCommonFraction: 1 / a,
    turnsSplit: formatTurns(a),
    seriesVoltageKv: seriesVoltageKv,
    commonVoltageKv: secondaryKv,
    throughCurrentLvA: throughA,
    seriesCurrentHvA: seriesA,
    commonCurrentA: commonA,
    commonCurrentPercent: commonPercent,
    coRatio: coRatio,
    equivalentMva: equivalentMva,
    impedance: {
      primaryPercent: ukPercent,
      secondaryPercent: ukPercent,
      commonPercent: null,
      primaryOhm: primaryOhm,
      secondaryOhm: secondaryOhm,
      primaryImpedanceVoltageKv: zPu * primaryKv,
      secondaryImpedanceVoltageKv: zPu * secondaryKv,
      primaryScA: seriesA / zPu,
      secondaryScA: throughA / zPu,
      scMva: ratedMva / zPu,
      label: 'Percent impedance is uk% on both terminals at this throughput. Ohms scale with U². Common-winding percent is not derived from one uk%.'
    }
  };
}

var api = {
  computeAutotransformer: computeAutotransformer,
  format1: format1,
  format2: format2,
  format3: format3,
  formatMva: formatMva,
  formatTurns: formatTurns,
  UK_PERCENT_DEFAULT: UK_PERCENT_DEFAULT,
  UK_PERCENT_MAX: UK_PERCENT_MAX,
  MVA_MAX: MVA_MAX
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;

function text(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function bootCalculators() {
  var form = document.getElementById('at-form');
  if (!form || !document.getElementById('at-mva')) return;

  function render() {
    var result = api.computeAutotransformer({
      ratedMva: document.getElementById('at-mva').value,
      primaryKv: document.getElementById('at-hv').value,
      secondaryKv: document.getElementById('at-lv').value,
      ukPercent: document.getElementById('at-uk').value,
      primaryConnection: document.getElementById('at-pri').value,
      secondaryConnection: document.getElementById('at-sec').value
    });
    var err = document.getElementById('at-error');
    var out = document.getElementById('at-results');
    if (!result.ok) {
      err.hidden = false;
      err.textContent = result.error;
      out.hidden = true;
      return;
    }
    err.hidden = true;
    out.hidden = false;

    text('winding-ratio-a', format2(result.windingRatio));
    text('winding-ratio-kv', format1(result.primaryKv) + ' / ' + format1(result.secondaryKv) + ' kV');
    text('winding-ratio-turns', result.turnsSplit);
    text('winding-ratio-series-kv', format1(result.seriesVoltageKv) + ' kV');

    text('common-current-percent', format1(result.commonCurrentPercent) + '%');
    text('common-current-less', format1(100 - result.commonCurrentPercent) + '%');
    text('common-current-a', format1(result.commonCurrentA) + ' A');
    text('common-current-through', format1(result.throughCurrentLvA) + ' A');
    text('common-current-series', format1(result.seriesCurrentHvA) + ' A');

    text('plate-mva', formatMva(result.ratedMva) + ' MVA');
    text('plate-eq', formatMva(result.equivalentMva) + ' MVA');
    text('plate-vector', result.primaryConnection + ' / ' + result.secondaryConnection);
    text('plate-uk', format2(result.ukPercent) + '%');
    text('plate-hv-kv', format1(result.primaryKv));
    text('plate-series-kv', format1(result.seriesVoltageKv));
    text('plate-lv-kv', format1(result.secondaryKv));
    text('plate-common-kv', format1(result.commonVoltageKv));
    text('plate-hv-a', format1(result.seriesCurrentHvA));
    text('plate-series-a', format1(result.seriesCurrentHvA));
    text('plate-lv-a', format1(result.throughCurrentLvA));
    text('plate-common-a', format1(result.commonCurrentA));

    var z = result.impedance;
    text('z-hv-percent', format2(z.primaryPercent) + '%');
    text('z-lv-percent', format2(z.secondaryPercent) + '%');
    text('z-hv-ohm', format2(z.primaryOhm) + ' Ω');
    text('z-lv-ohm', format3(z.secondaryOhm) + ' Ω');
    text('z-hv-drop', format2(z.primaryImpedanceVoltageKv) + ' kV');
    text('z-lv-drop', format2(z.secondaryImpedanceVoltageKv) + ' kV');
    text('z-hv-sc', format3(z.primaryScA / 1000) + ' kA');
    text('z-lv-sc', format3(z.secondaryScA / 1000) + ' kA');
    text('z-sc-mva', formatMva(z.scMva) + ' MVA');
  }

  form.addEventListener('submit', function (ev) { ev.preventDefault(); render(); });
  ['at-mva', 'at-hv', 'at-lv', 'at-uk', 'at-pri', 'at-sec'].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  render();
}

if (typeof window !== 'undefined') {
  window.TP_AUTOTRANSFORMER_CALC = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootCalculators);
    else bootCalculators();
  }
}
