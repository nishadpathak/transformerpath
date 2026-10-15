/* Three-phase autotransformer co-ratio sizing.
 *
 * Equivalent (self) rating S_eq = S_through × (1 − V_LV/V_HV).
 * That factor is the co-ratio used for the equivalent two-winding rating
 * (IEEE C57.12.10). Line current is I = S / (√3 · U), three-phase
 * (IEC 60076-1). Series current is the HV line current. Common current
 * is I_LV − I_HV.
 *
 * Percent impedance is not split here, and no turns ratio is returned.
 * CommonJS for tests; also attached to window for the sizing page.
 */
'use strict';

function num(v) {
  var n = Number(v);
  return n;
}

function format1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function formatMva(n) {
  var rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(1);
}

function autotransformerSizing(input) {
  input = input || {};
  var throughMva = num(input.throughMva);
  var hvKv = num(input.hvKv);
  var lvKv = num(input.lvKv);
  if (!(throughMva > 0) || !(hvKv > 0) || !(lvKv > 0)) {
    return { ok: false, error: 'Throughput and both line voltages must be positive.' };
  }
  if (!(hvKv > lvKv)) {
    return { ok: false, error: 'HV line voltage must be higher than LV line voltage.' };
  }
  var coRatio = 1 - (lvKv / hvKv);
  var equivalentMva = throughMva * coRatio;
  var iLvA = (throughMva * 1000) / (Math.sqrt(3) * lvKv);
  var iSeriesA = (throughMva * 1000) / (Math.sqrt(3) * hvKv);
  var iCommonA = iLvA - iSeriesA;
  return {
    ok: true,
    coRatio: coRatio,
    equivalentMva: equivalentMva,
    iLvA: iLvA,
    iSeriesA: iSeriesA,
    iCommonA: iCommonA,
    equivalentMvaText: formatMva(equivalentMva),
    iLvText: format1(iLvA),
    iSeriesText: format1(iSeriesA),
    iCommonText: format1(iCommonA)
  };
}

var api = { autotransformerSizing: autotransformerSizing, format1: format1, formatMva: formatMva };
if (typeof module !== 'undefined' && module.exports) module.exports = api;

function bootSizingPage() {
  var form = document.getElementById('sizing-form');
  if (!form) return;
  function render() {
    var result = window.TP_AUTOTRANSFORMER.autotransformerSizing({
      throughMva: document.getElementById('through').value,
      hvKv: document.getElementById('hvkv').value,
      lvKv: document.getElementById('lvkv').value
    });
    var err = document.getElementById('sizing-error');
    var out = document.getElementById('sizing-out');
    if (!result.ok) {
      err.hidden = false;
      err.textContent = result.error;
      out.hidden = true;
      return;
    }
    err.hidden = true;
    out.hidden = false;
    document.getElementById('co-ratio').textContent = result.coRatio.toFixed(4);
    document.getElementById('eq-mva').textContent = result.equivalentMvaText + ' MVA';
    document.getElementById('i-lv').textContent = result.iLvText + ' A';
    document.getElementById('i-series').textContent = result.iSeriesText + ' A';
    document.getElementById('i-common').textContent = result.iCommonText + ' A';
  }
  form.addEventListener('submit', function (ev) { ev.preventDefault(); render(); });
  ['through', 'hvkv', 'lvkv'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', render);
  });
  render();
}

if (typeof window !== 'undefined') {
  window.TP_AUTOTRANSFORMER = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootSizingPage);
    else bootSizingPage();
  }
}
