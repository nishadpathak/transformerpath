/* TransformerPath — Visualization engineering mathematics (pure, no DOM).
 *
 * These functions compute the ENGINEERING the visualizations display. They are
 * analytical/simplified models and are explicitly NOT EMT/CFD or validated
 * design calculations. They serve educational visualization and are labeled as
 * such in the UI. No validated technical content is altered.
 *
 * Exportable (CommonJS) so the deterministic math can be unit-tested in Node.
 */
'use strict';

/* ============================================================================
 * 1. VECTOR GROUP
 * Clock notation: clock number N => LV LAGS HV by N*30deg. The LV phase phasor
 * is the HV phasor rotated by -N*30 deg (mod 360). Star (y) phase voltage =
 * VLL/sqrt(3); delta (D) phase voltage = VLL. Returns phasor angles (deg) for
 * the three HV and three LV phase-to-neutral/line vectors.
 * ========================================================================== */
function vecGroup(hvConn, lvConn, clock) {
  const norm = (a) => ((a % 360) + 360) % 360;
  const clockN = ((parseInt(clock, 10) || 0) % 12 + 12) % 12;
  const disp = clockN * 30;                       // LV lags HV by disp deg
  // HV phase-to-neutral angles (A=0, B=-120, C=+120). For delta the line
  // phasor is offset by +30deg from the corresponding star phase; keep the
  // primary reference at A=0 for the clock comparison (standard blocks).
  const hvAngles = [0, 120, -120].map(norm);
  const lvAngles = hvAngles.map((a) => norm(a - disp));  // LV lags HV
  const phaseVolt = (conn) => /y|yn|z/i.test(conn) ? 1 / Math.sqrt(3) : 1; // p.u. relative to VLL
  return {
    clockN, disp, hvAngles, lvAngles,
    hvPhase: phaseVolt(hvConn), lvPhase: phaseVolt(lvConn),
    clockwise: clockN, note: 'clock ' + clockN + ' => LV lags HV by ' + disp + ' deg (LV ' + (disp > 180 ? 'leads' : 'lags') + ' HV by ' + (360 - disp) + ' deg equivalent)',
  };
}

/* Parallel compatibility (simplified IEE/IEC rule).
 * Direct parallel operation requires the SAME phase displacement (clock) and
 * a compatible connection; different clock numbers are NOT directly parallel-
 * able without phase-correcting external reconnection. Voltage ratio and
 * impedance are checked against tolerances. Returns {compatible, reasons[]}.
 */
function parallelCheck(a, b, opts) {
  opts = opts || {};
  const ratioTol = opts.ratioTol || 0.005; // 0.5%
  const zTol = opts.zTol || 0.10;          // 10% impedance band
  const reasons = [];
  const compatible = [];
  // Voltage ratio in p.u. of HV/LV (assume equal per-unit unless supplied).
  const ra = opts.ratioA || 1, rb = opts.ratioB || 1;
  if (Math.abs(ra - rb) / Math.max(ra, rb) > ratioTol) compatible.push(false), reasons.push('voltage ratio differs by > ' + (ratioTol * 100) + '%');
  else compatible.push(true), reasons.push('voltage ratio within ' + (ratioTol * 100) + '%');
  const za = opts.zImpedanceA || 5, zb = opts.zImpedanceB || 5;
  if (Math.abs(za - zb) / Math.max(za, zb) > zTol) compatible.push(false), reasons.push('short-circuit impedance differs by > ' + (zTol * 100) + '%');
  else compatible.push(true), reasons.push('short-circuit impedance within ' + (zTol * 100) + '%');
  // Phase displacement must match.
  if (a.clockN === b.clockN) compatible.push(true), reasons.push('same phase displacement (clock ' + a.clockN + ')');
  else compatible.push(false), reasons.push('phase displacement differs (clock ' + a.clockN + ' vs ' + b.clockN + ') — requires phase-correcting external reconnection, not direct parallel');
  return { compatible: compatible.every(Boolean), reasons };
}

/* ============================================================================
 * 2. INRUSH (simplified, analytical — NOT EMT)
 * Flux-linkage lambda(t) = integral(v dt) + residual flux, for v = Vm sin(wt+a)
 * closed at switching angle alpha. lambda(t) = -(Vm/w)cos(wt+a) + residual +
 * a DC offset equal to (Vm/w)cos(a) so lambda(a instant) = residual (flux
 * cannot jump). The magnetising current is small while |B|<Bsat and spikes
 * (air-core inductance) once the core saturates. Returns arrays for the first
 * n cycles for animation.
 * ========================================================================== */
function inrush(params) {
  const alpha = (params.switchingAngleDeg || 0) * Math.PI / 180;
  const f = params.freq || 50;
  const w = 2 * Math.PI * f;
  const Vm = (params.voltagePk || 1.0);            // p.u. peak voltage
  const phi_r = params.residualFluxPu || 0;        // residual flux, p.u. of rated
  const Bsat = params.saturationPu || 1.2;         // saturation flux, p.u. of rated
  const cycles = params.cycles || 6;
  const perCycle = params.pointsPerCycle || 120;
  const n = cycles * perCycle;
  const fluxRated = Vm / w;                        // rated peak flux-linkage
  const lambda = (t) => -(Vm / w) * Math.cos(w * t + alpha) + (Vm / w) * Math.cos(alpha) + phi_r * fluxRated;
  const B = (t) => lambda(t) / fluxRated;          // p.u. of rated flux
  const iMag = (t) => {
    const b = B(t);
    if (Math.abs(b) <= Bsat) return 0.02 * Math.sign(b) * Math.abs(b) / Bsat; // small linear magnetising
    const over = Math.abs(b) - Bsat;
    return Math.sign(b) * (0.02 + over * 8);       // sharp air-core rise after saturation (p.u.)
  };
  const V = (t) => Vm * Math.sin(w * t + alpha);
  const out = { t: [], v: [], flux: [], current: [] };
  for (let i = 0; i <= n; i++) {
    const t = i / perCycle * (1 / f);
    out.t.push(+(t * 1000).toFixed(2));
    out.v.push(+V(t).toFixed(3));
    out.flux.push(+B(t).toFixed(3));
    out.current.push(+iMag(t).toFixed(3));
  }
  out.peakCurrent = Math.max.apply(null, out.current);
  out.label = 'EDUCATIONAL DEMO ONLY — NOT an engineering design calculator and NOT an EMT simulation. This simplified model shows WHY switching angle + residual flux + saturation can produce asymmetric flux and high magnetising-current peaks. It does NOT predict the actual inrush current of a real transformer (which depends on the full circuit, core geometry, winding/residual details and system interaction). Flux = integral(v) + residual; current rises only when |flux| > saturation.';
  return out;
}

/* ============================================================================
 * 3. SHORT-CIRCUIT FORCE SCALING (educational)
 * Electromagnetic force on a winding is proportional to the square of the
 * current:  F = k * I^2. This returns the force MULTIPLIER for a given fault
 * current multiplier, and the qualitative winding force tendencies. It does
 * NOT compute the actual force (which depends on the leakage field, winding
 * geometry, and axial/radial distribution) — it teaches the I^2 relationship.
 * ========================================================================== */
function shortCircuitForces(currentMult) {
  var i = currentMult || 1;
  var force = i * i; // F ~ I^2
  return {
    currentMultiplier: +i.toFixed(2), forceMultiplier: +force.toFixed(2),
    fmt: function () { return i + '\u00D7 current \u2192 \u2248 ' + force + '\u00D7 force'; },
    quali: 'Qualification: actual force distribution depends on winding geometry, end-winding spacing and the leakage field; this shows only the F \u221D I^2 scaling, not a completed mechanical-withstand design.'
  };
}
// Per-winding qualitative tendency (for the visual labels).
function forceTendencies() {
  return [
    { w: 'LV winding', force: 'Radial compression \u2190 \u2192 (inward)', note: 'Radial force compresses the inner (LV) winding toward the core.' },
    { w: 'HV winding', force: 'Hoop / circumferential tension \u2194 (outward)', note: 'Radial force puts the outer (HV) winding in hoop tension.' },
    { w: 'Winding ends', force: 'Axial forces \u2191 \u2193', note: 'Amp\u00e8re-turn imbalance produces axial compression/repulsion at the ends.' },
    { w: 'Supports/clamps', force: 'Clamping reaction', note: 'The clamping system resists axial forces; spacer/end-block support must be designed for it.' },
  ];
}

/* ============================================================================
 * 4. CALCULATION STATUS (the "Confidence of Calculation" component)
 * Encodes the pedagogy: equation closure is NOT physical validation. A result
 * is graded on a cumulative ladder — INSUFFICIENT_DATA -> CALCULATED ->
 * BENCHMARKED -> CRITERION_CHECKED -> PRELIMINARY_ENGINEERING ->
 * ENGINEERING_REVIEWED. There is NO generic "VALIDATED": the headline always
 * names the scope (e.g. "Analytical model benchmark validated", never "Design
 * validated"). With no supplied acceptance criterion the result is NOT a PASS.
 * ========================================================================== */
function calcStatus(input) {
  var i = input || {};
  // Evidence dimensions — each must be satisfied for the claim to ADVANCE.
  // This is WEAKEST-LINK propagation (not a precedence shortcut): a higher state
  // requires all lower evidence, so e.g. a "qualified review" alone can never
  // climb to ENGINEERING_REVIEWED without benchmark + criterion evidence.
  var analysis = !!i.analytical;
  var inputs = !!i.inputsComplete;
  var modelOk = i.modelScope !== false;   // model applicability (false => uncertain / not-sufficient)
  var benchmark = !!i.benchmark;
  var criterion = !!i.criterion;
  var review = !!i.qualified;
  var fea = !!i.fea, mfg = !!i.manufacturing;

  var items = [
    { k: 'analytical', label: 'Analytical calculation', ok: analysis },
    { k: 'inputs', label: 'Input completeness', ok: inputs },
    { k: 'benchmark', label: 'Independent benchmark (within tolerance)', ok: benchmark },
    { k: 'criterion', label: 'Acceptance criterion supplied + evaluated', ok: criterion },
    { k: 'fea', label: 'Detailed field solution (FEA)', ok: fea },
    { k: 'mfg', label: 'Manufacturing review', ok: mfg },
    { k: 'review', label: 'Qualified engineering review', ok: review },
  ];
  var state, scope;
  if (!analysis || !inputs) { state = 'INSUFFICIENT_DATA'; scope = 'Required inputs missing — not computed.'; }
  else if (!modelOk) { state = 'PRELIMINARY_ENGINEERING'; scope = 'Model applicability uncertain — full physical validation not claimed.'; }
  else if (!benchmark) { state = 'CALCULATED'; scope = 'Analytical calculation completed; not yet benchmarked or criterion-checked.'; }
  else if (!criterion) { state = 'BENCHMARKED'; scope = 'Analytical model benchmark validated against an independent reference within defined tolerance.'; }
  else if (!(fea || mfg)) { state = 'CRITERION_CHECKED'; scope = 'Analytical model computed and an applicable acceptance criterion supplied + evaluated.'; }
  else if (!review) { state = 'PRELIMINARY_ENGINEERING'; scope = 'Multiple analytical checks completed; detailed engineering validation/review remains.'; }
  else { state = 'ENGINEERING_REVIEWED'; scope = 'Analytical model reviewed by a qualified engineer within stated scope.'; }
  // Machine-readable credibility evidence (weakest-link overall = state).
  return {
    state: state, items: items, done: items.filter(function (x) { return x.ok; }).length, total: items.length, scope: scope,
    headline: 'STATUS: ' + state.replace(/_/g, ' '), scopeLine: scope,
    input_sufficiency: (!analysis || !inputs) ? 'INSUFFICIENT_DATA' : 'SUFFICIENT',
    model_scope: modelOk ? 'APPLICABLE' : 'LIMITED',
    benchmark_status: benchmark ? 'BENCHMARKED_WITHIN_TOLERANCE' : 'NOT_BENCHMARKED',
    criterion_status: criterion ? 'CRITERION_SUPPLIED_AND_EVALUATED' : 'CRITERION_MISSING',
    review_status: review ? 'ENGINEERING_REVIEWED' : 'NOT_REVIEWED',
    overall_runtime_status: state
  };
}

/* ============================================================================
 * 5. LOADING / HOT-SPOT / LIFE (simplified IEC 60076-7-style, analytical)
 * Educational. NOT CFD. For a LIQUID-FILLED transformer it models top-oil and
 * winding hot-spot with first-order time constants; for DRY-TYPE it has NO
 * top-liquid state (a dry-type winding heats through the solid/air path).
 * Relative ageing uses the 6 degC rule: V = 2^((hotspot-98)/6). Missing
 * required model parameters -> INSUFFICIENT_DATA (NOT a hidden assumption).
 * An explicitly labelled educational example dataset is used when parameters
 * are not supplied (default), never a silent assumption.
 * ========================================================================== */
function thermalEngine(input) {
  var i = input || {};

  // Required inputs (nothing invented).
  if (i.loadPU == null || i.loadPU === '' || i.ambientC == null || i.ambientC === '' || i.durationH == null || i.durationH === '' || !i.mode) {
    return { state: 'INSUFFICIENT_DATA', note: 'Required inputs missing (load, ambient temperature, cooling mode, duration).', series: null };
  }
  // Thermal params: if absent, use the EXPLICITLY LABELLED educational example dataset.
  var ex = i.__example !== false;
  var tauO = i.tauOilH != null ? i.tauOilH : (ex ? 2.5 : null);
  var tauW = i.tauWindingH != null ? i.tauWindingH : (ex ? 0.12 : null);
  var dThetaO = i.dThetaOilK != null ? i.dThetaOilK : (ex ? 42 : null);         // top-oil rise at rated, K
  var grad = i.hotSpotGradientK != null ? i.hotSpotGradientK : (ex ? 13 : null); // hot-spot gradient at rated, K
  if (tauO == null || tauW == null || dThetaO == null || grad == null) {
    return { state: 'INSUFFICIENT_DATA', note: 'Thermal model parameters not supplied.', series: null };
  }

  var dry = !!i.dryType;
  var load = +i.loadPU, amb = +i.ambientC, durH = +i.durationH;
  var steps = Math.max(6, Math.min(120, Math.round(durH * 12) || 12));
  var times = [], topOil = [], hotSpot = [], ageRate = [];
  var dt = durH / steps;
  // Load loss scales ~ I^2; total loss ~ I^2 (copper dominates the rise) with a
  // small fixed iron component omitted for the educational model.
  var loss = load * load;
  var oUlt = dThetaO * loss;        // ultimate top-oil rise
  var hUlt = grad * loss;           // ultimate hot-spot gradient
  var ageSum = 0;
  for (var k = 0; k <= steps; k++) {
    var t = k * dt;
    var top = dry ? null : (amb + oUlt * (1 - Math.exp(-t / tauO)));           // no top-oil for dry-type
    var hs;
    if (dry) {
      // Dry-type: winding temperature directly through the solid/air path.
      hs = amb + hUlt * (1 - Math.exp(-t / tauW));
    } else {
      var o = top;
      hs = o + hUlt * (1 - Math.exp(-t / tauW));                              // hot-spot above top-oil
    }
    var V = Math.pow(2, (hs - 98) / 6);                                        // relative ageing rate
    if (k > 0) ageSum += (V + (ageRate.length ? ageRate[ageRate.length - 1] : V)) / 2 * dt; // trapz
    times.push(+t.toFixed(2)); topOil.push(top == null ? null : +top.toFixed(2));
    hotSpot.push(+hs.toFixed(2)); ageRate.push(+V.toFixed(4));
  }
  return {
    state: 'CALCULATED', dryType: dry, note: ex ? 'Educational example dataset (τo=' + tauO + ' h, Δθo=' + dThetaO + ' K, gradient=' + grad + ' K, τw=' + tauW + ' h) — NOT your transformer. Analytical (IEC-like), NOT CFD.' : '',
    series: { times, topOil, hotSpot, ageRate },
    final: { topOil: topOil[steps], hotSpot: hotSpot[steps], ageRate: ageRate[steps], lossOfLifeH: +ageSum.toFixed(2) }
  };
}

module.exports = { vecGroup, parallelCheck, inrush, shortCircuitForces, forceTendencies, calcStatus, thermalEngine };

// Also expose for the browser (loaded as a script) -> window.TP_VIZ_MATH
if (typeof window !== 'undefined') { window.TP_VIZ_MATH = { vecGroup: vecGroup, parallelCheck: parallelCheck, inrush: inrush, shortCircuitForces: shortCircuitForces, forceTendencies: forceTendencies, calcStatus: calcStatus, thermalEngine: thermalEngine }; }
