/* ============================================================================
   TransformerPath — Design Engine validation + consistency-check core.
   ----------------------------------------------------------------------------
   PURPOSE: Turn a design-input object into an HONEST validation report. This is
   the Section S/U "Design Validation" + "validation before release" framework.

   KEY RULES (the engine does not know how to fake a PASS):
     - A check that is not applicable to the class returns NOT_CALCULATED.
     - A check whose required input is missing returns INSUFFICIENT_DATA.
     - A check only returns PASS/REVIEW/WARNING when the calculation value is
       present AND compared to a real limit/tolerance.
     - No class is ever labelled certified/IEC/IEEE compliant/FEM- or CFD-validated.
       Advanced classes are BETA / ENGINEERING REVIEW until benchmark-validated.

   The engine validates the INPUT+RESULT. It does NOT compute the physics for a
   class that has not been built/validated. This file contains no transformer
   physics; it is the validation gate. Load data/design-engine-classes.json.

   Usable in Node (for check-design.js benchmarks) and could be bundled for a
   design workspace UI. Pure logic, no DOM.
   ========================================================================== */
'use strict';
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync(__dirname + '/data/design-engine-classes.json', 'utf8'));

const STATUS = { PASS: 'PASS', REVIEW: 'REVIEW', WARNING: 'WARNING', NOT_CALCULATED: 'NOT_CALCULATED', INSUFFICIENT_DATA: 'INSUFFICIENT_DATA' };

function isNum(v) { return typeof v === 'number' && isFinite(v); }

// Compare a computed value against a limit. limitMode: 'max'|'min'|'range'.
function inLimits(value, limit, mode, tol) {
  if (!isNum(value) || !isNum(limit)) return null; // cannot compare
  if (mode === 'max') {
    if (value <= limit) return value <= limit * (1 + (tol || 0.05)) ? 'PASS' : 'REVIEW';
    return 'WARNING';
  }
  if (mode === 'min') {
    if (value >= limit) return value >= limit * (1 - (tol || 0.05)) ? 'PASS' : 'REVIEW';
    return 'WARNING';
  }
  return null;
}

function checksFor(cls, input) {
  const k = CONFIG.classes.find((c) => c.key === cls);
  const out = [];
  const val = (f) => input[f];
  const has = (f) => val(f) !== undefined && val(f) !== null && val(f) !== '';

  // 1. Missing critical specification input.
  const critical = ['power_kva', 'hv_kv', 'lv_kv', 'freq', 'voltage_ratio'];
  const missing = critical.filter((f) => !has(f));
  if (cls === 'shunt_reactor') { /* critical = mvar, voltage, freq */ const m2 = ['mvar', 'voltage_kv', 'freq'].filter((f) => !has(f)); out.push({ id: 'missing_input', label: 'Required specification input', status: m2.length ? STATUS.INSUFFICIENT_DATA : STATUS.PASS, note: m2.length ? 'Missing: ' + m2.join(', ') : 'Reactor inputs present' }); }
  else if (missing.length) out.push({ id: 'missing_input', label: 'Required specification input', status: STATUS.INSUFFICIENT_DATA, note: 'Missing: ' + missing.join(', ') });
  else out.push({ id: 'missing_input', label: 'Required specification input', status: STATUS.PASS, note: 'Specification present' });

  // 2. Flux density vs limit (magnetic design).
  if (has('flux_density_T') && has('flux_density_limit')) out.push({ id: 'flux_density', label: 'Flux density vs. design limit', status: inLimits(val('flux_density_T'), val('flux_density_limit'), 'max'), note: val('flux_density_T') + ' T vs limit ' + val('flux_density_limit') + ' T' });
  else out.push({ id: 'flux_density', label: 'Flux density vs. design limit', status: (!k || (k.modules_structured || []).indexOf('magnetic') < 0) ? STATUS.NOT_CALCULATED : STATUS.INSUFFICIENT_DATA, note: 'Flux density not supplied' });

  // 3. Current density vs limit (winding design).
  if (has('current_density') && has('current_density_limit')) out.push({ id: 'current_density', label: 'Current density vs. design limit', status: inLimits(val('current_density'), val('current_density_limit'), 'max'), note: val('current_density') + ' A/mm2 vs limit ' + val('current_density_limit') + ' A/mm2' });
  else out.push({ id: 'current_density', label: 'Current density vs. design limit', status: (!k || (k.modules_structured || []).indexOf('winding') < 0) ? STATUS.NOT_CALCULATED : STATUS.INSUFFICIENT_DATA, note: 'Current density not supplied' });

  // 4. Impedance vs target tolerance (impedance module).
  if (has('calc_impedance_pct') && has('target_impedance_pct')) {
    const d = Math.abs(val('calc_impedance_pct') - val('target_impedance_pct')) / val('target_impedance_pct');
    out.push({ id: 'impedance', label: 'Short-circuit impedance vs. target', status: d <= (val('impedance_tolerance') || 0.07) ? STATUS.PASS : (d <= 0.2 ? STATUS.REVIEW : STATUS.WARNING), note: 'calc ' + val('calc_impedance_pct') + '% vs target ' + val('target_impedance_pct') + '% (' + (d * 100).toFixed(1) + '% deviation)' });
  } else out.push({ id: 'impedance', label: 'Short-circuit impedance vs. target', status: (!k || (k.modules_structured || []).indexOf('impedance') < 0) ? STATUS.NOT_CALCULATED : STATUS.INSUFFICIENT_DATA, note: 'Impedance calc or target not supplied' });

  // 5. Loss vs requirement.
  if (has('load_loss_limit') && has('calc_load_loss')) {
    out.push({ id: 'load_loss', label: 'Load loss vs. requirement', status: inLimits(val('calc_load_loss'), val('load_loss_limit'), 'max'), note: 'calc ' + val('calc_load_loss') + ' W vs limit ' + val('load_loss_limit') + ' W' });
  } else out.push({ id: 'load_loss', label: 'Load loss vs. requirement', status: (!k || (k.modules_structured || []).indexOf('losses') < 0) ? STATUS.NOT_CALCULATED : STATUS.INSUFFICIENT_DATA, note: 'Load loss not supplied' });

  // 6. Temperature rise vs target (thermal).
  if (has('temp_rise_K') && has('temp_rise_limit')) {
    out.push({ id: 'temp_rise', label: 'Temperature rise vs. target', status: inLimits(val('temp_rise_K'), val('temp_rise_limit'), 'max'), note: val('temp_rise_K') + ' K vs limit ' + val('temp_rise_limit') + ' K' });
  } else out.push({ id: 'temp_rise', label: 'Temperature rise vs. target', status: (!k || (k.modules_structured || []).indexOf('thermal') < 0) ? STATUS.NOT_CALCULATED : STATUS.INSUFFICIENT_DATA, note: 'Temperature rise not supplied' });

  // 7. Tap range consistency.
  if (has('tap_percent') && has('regulation_percent') && has('impedance_pct')) {
    const tapRange = val('tap_percent') ? Math.abs(val('tap_percent')) : 0;
    out.push({ id: 'tap_range', label: 'Tap range vs. regulation feasibility', status: tapRange > 0.25 * val('impedance_pct') + 0.05 * val('regulation_percent') ? STATUS.REVIEW : STATUS.PASS, note: 'Tap range ' + tapRange + '% vs impedance ' + val('impedance_pct') + '% / regulation ' + val('regulation_percent') + '%' });
  } else out.push({ id: 'tap_range', label: 'Tap range vs. regulation feasibility', status: STATUS.INSUFFICIENT_DATA, note: 'Tap/regulation/impedance data not supplied' });

  // 8. Window utilisation (geometry).
  if (has('window_utilization') && has('window_utilization_limit')) {
    out.push({ id: 'window_util', label: 'Core-window utilisation', status: inLimits(val('window_utilization'), val('window_utilization_limit'), 'max'), note: val('window_utilization') + ' vs limit ' + val('window_utilization_limit') });
  } else out.push({ id: 'window_util', label: 'Core-window utilisation', status: STATUS.INSUFFICIENT_DATA, note: 'Window utilisation not supplied' });

  // 9. Short-circuit mechanical stress (analytical only).
  if (has('sc_stress_MPa') && has('sc_stress_limit')) {
    out.push({ id: 'sc_stress', label: 'Short-circuit stress (analytical)', status: inLimits(val('sc_stress_MPa'), val('sc_stress_limit'), 'max'), note: val('sc_stress_MPa') + ' MPa vs limit ' + val('sc_stress_limit') + ' MPa — ANALYTICAL, not structural FEA' });
  } else out.push({ id: 'sc_stress', label: 'Short-circuit stress (analytical)', status: (!k || (k.modules_structured || []).indexOf('short_circuit') < 0) ? STATUS.NOT_CALCULATED : STATUS.INSUFFICIENT_DATA, note: 'SC stress not supplied' });

  // 10. Cooling sufficiency (thermal).
  if (has('cooling_class') && has('cooling_required_kW')) {
    out.push({ id: 'cooling', label: 'Cooling sufficiency', status: has('cooling_available_kW') ? inLimits(val('cooling_required_kW'), val('cooling_available_kW'), 'max') : STATUS.INSUFFICIENT_DATA, note: val('cooling_class') + ' required ' + val('cooling_required_kW') + ' kW' + (has('cooling_available_kW') ? ' vs available ' + val('cooling_available_kW') + ' kW' : ' (available not supplied)') });
  } else out.push({ id: 'cooling', label: 'Cooling sufficiency', status: STATUS.NOT_CALCULATED, note: 'Cooling class / duty not supplied' });

  return out;
}

// Public API.
function validate(cls, input) { return { cls: cls, checks: checksFor(cls, input || {}), config: CONFIG }; }
function classConf(cls) { return CONFIG.classes.find((c) => c.key === cls) || null; }
function positioning(cls) { return { forbidden: CONFIG.positioning_rules.forbidden, allowed: CONFIG.positioning_rules.allowed }; }

module.exports = { validate, classConf, positioning, CONFIG, STATUS };

// Node CLI: node design-engine.js <class> with a JSON input file, else list classes.
if (require.main === module) {
  if (process.argv[2] === '--classes') { console.log(CONFIG.classes.map((c) => c.key + ' [' + c.status + ']').join('\n')); }
  else if (process.argv[2] && fs.existsSync(process.argv[3])) {
    const cls = process.argv[2], input = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    const res = validate(cls, input);
    console.log('DESIGN VALIDATION — ' + cls + ' (' + (res.config.classes.find((c) => c.key === cls) || {}).status + ')\n');
    res.checks.forEach((c) => console.log('  [' + c.status + '] ' + c.label + ' — ' + c.note));
  } else { console.log('usage: node design-engine.js <class> <input.json> | node design-engine.js --classes'); }
}
