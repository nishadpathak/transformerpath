/* Nameplate symmetrical short-circuit current.
 *
 * Same relationship as the design calculator: the short-circuit multiple is
 * 100/uk%, and the symmetrical RMS line current is rated current times that
 * multiple. Rated current is I = S / (√3 · U), three-phase, with S in kVA
 * and U in kV. IEC 60076-5 clause 4.1 is the symmetrical short-circuit
 * current. z = uk% / 100, infinite bus (transformer impedance only).
 *
 * Short-circuit power S/z is MVA. It is returned on its own field so it
 * cannot be reported as a current in kA.
 */
'use strict';

function format1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function format3(n) {
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

function formatMva(n) {
  var rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return rounded.toFixed(1);
}

function nameplateShortCircuit(input) {
  input = input || {};
  var mva = Number(input.mva);
  var kv = Number(input.kv);
  var ukPercent = Number(input.ukPercent);
  if (!(mva > 0) || !(kv > 0) || !(ukPercent > 0)) {
    return { ok: false, error: 'Power, line voltage and percent impedance must be positive.' };
  }
  var zPu = ukPercent / 100;
  var multiple = 100 / ukPercent;
  var ratedA = (mva * 1000) / (Math.sqrt(3) * kv);
  var scA = ratedA * multiple;
  var scKa = scA / 1000;
  var scMva = mva / zPu;
  return {
    ok: true,
    zPu: zPu,
    multiple: multiple,
    ratedA: ratedA,
    scA: scA,
    scKa: scKa,
    scMva: scMva,
    ratedText: format1(ratedA),
    scKaText: format3(scKa),
    scMvaText: formatMva(scMva)
  };
}

var api = { nameplateShortCircuit: nameplateShortCircuit };
if (typeof module !== 'undefined' && module.exports) module.exports = api;

function bootNameplate() {
  var fullBtn = document.getElementById('mode-full');
  var plateBtn = document.getElementById('mode-nameplate');
  var form = document.getElementById('nameplate-form');
  if (!fullBtn || !plateBtn || !form) return;

  function render() {
    var result = api.nameplateShortCircuit({
      mva: document.getElementById('np-mva').value,
      kv: document.getElementById('np-kv').value,
      ukPercent: document.getElementById('np-uk').value
    });
    var err = document.getElementById('nameplate-error');
    var out = document.getElementById('nameplate-out');
    if (!result.ok) {
      err.hidden = false;
      err.textContent = result.error;
      out.hidden = true;
      return;
    }
    err.hidden = true;
    out.hidden = false;
    document.getElementById('np-rated').textContent = result.ratedText + ' A';
    document.getElementById('np-ka').textContent = result.scKaText + ' kA';
    document.getElementById('np-mva-sc').textContent = result.scMvaText + ' MVA';
  }

  function setMode(mode) {
    document.body.setAttribute('data-calc-mode', mode);
    fullBtn.classList.toggle('on', mode === 'full');
    plateBtn.classList.toggle('on', mode === 'nameplate');
    if (mode === 'nameplate') render();
  }

  fullBtn.addEventListener('click', function () { setMode('full'); });
  plateBtn.addEventListener('click', function () { setMode('nameplate'); });
  form.addEventListener('submit', function (ev) { ev.preventDefault(); setMode('nameplate'); render(); });
  ['np-mva', 'np-kv', 'np-uk'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      if (document.body.getAttribute('data-calc-mode') === 'nameplate') render();
    });
  });
}

if (typeof window !== 'undefined') {
  window.TP_NAMEPLATE = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootNameplate);
    else bootNameplate();
  }
}
