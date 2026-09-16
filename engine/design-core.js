/* ============================================================================
   TransformerPath — design-core: first-pass analytical electromagnetic core.
   ----------------------------------------------------------------------------
   Genuine first-pass PEM sizing from standard relations (analytical, NOT FEM).
   This is BETA / ENGINEERING REVIEW and NOT independently validated: every
   output is an analytical estimate and must be checked by a qualified
   transformer design engineer against the relevant standard.

   Relations used (all standard, first-pass):
     - phase voltage:   Y -> V_phase = V_line/sqrt(3);  D -> V_phase = V_line
     - flux/phase:      Phi_m = B_peak * A_net
     - volts per turn:  Et = 4.44 * f * Phi_m            (sinusoidal, 1.11*4)
     - turns:           N   = V_phase / Et
     - line current:    3ph I = S / (sqrt(3)*V_line);   1ph I = S / V_line
     - conductor area:  A   = I_winding / J              (first-pass winding EMF)
     - DC resistance:   R   = rho(T) * MLT * N / A
     - conductor mass:  m   = delta * A * MLT * N*phases
   Assumptions are exposed and returned with the results (Section C/D/D/F/BOM
   ancestry). No compliance/validation claim is made.

   Pure logic (no DOM). Node-usable for the regression harness.
   ========================================================================== */
'use strict';

const MATERIAL = {
  copper:     { density_kg_m3: 8940,  resistivity_ohm_m: 1.724e-8, label: 'Copper' },
  aluminium:  { density_kg_m3: 2700,  resistivity_ohm_m: 2.826e-8, label: 'Aluminium' },
};

// Resistivity reference 20C -> temperature parameter alpha (1/K).
const ALPHA = { copper: 0.00393, aluminium: 0.00403 };
function resistivity(mat, tempC) {
  const m = MATERIAL[mat]; if (!m) throw new Error('unknown material ' + mat);
  return m.resistivity_ohm_m * (1 + ALPHA[mat] * ((tempC || 20) - 20));
}

function phaseVolt(V, conn, phases) {
  if (phases === 1) return V;
  return String(conn || '').toUpperCase().indexOf('Y') >= 0 || String(conn || '').toUpperCase().indexOf('YN') >= 0
    ? V / Math.sqrt(3) : V; // delta / zig-zag: phase = line (first-pass)
}

function designCore(input) {
  // Inputs (req + defaults). No invention: missing -> result flags it.
  const S   = input.rating_kva || input.rating_mva * 1000;
  const f   = input.freq || 50;
  const phases = input.phases || 3;
  const Vh  = input.hv_kv || 0;
  const Vl  = input.lv_kv || 0;
  const B   = input.peak_flux_density_T || 0;
  const A   = input.net_core_area_m2 || 0;
  const J   = input.current_density_A_mm2 || 0;
  const MLT = input.mean_turn_length_m || 0;
  const mat = input.winding_material || 'copper';
  const tempC = input.winding_temp_C || 75;

  const out = { class: 'analytical-first-pass', beta: true, inputs: { rating_kva: S, freq: f, phases: phases, hv_kv: Vh, lv_kv: Vl, peak_flux_density_T: B, net_core_area_m2: A, current_density_A_mm2: J, winding_material: mat, winding_temp_C: tempC }, assumptions: {}, results: {} };

  // Turns ratio.
  out.results.turns_ratio = Vh && Vl ? Vh / Vl : null;
  out.assumptions.turns_ratio = 'V_hv / V_lv (nameplate ratio; ignores tap/vector-group phase shift)';

  // Electrical (per-phase).
  const Iph = (Vh && S) ? S * 1000 / (phases === 1 ? Vh * 1000 : Math.sqrt(3) * Vh * 1000) : null;
  out.results.hv_line_current_A = Iph;
  // CONNECTION-AWARE phase voltage. For a DELTA HV winding the phase voltage is
  // the LINE voltage; for WYE it is V_line/sqrt(3). Applying V_line/sqrt(3) to
  // a delta winding is a physical error, and topology MUST propagate through the
  // design (Y-Y / Y-D / D-Y must not be identical). Unsupported connections are
  // flagged so the UI can disable/restrict rather than trust the output.
  const hvConn = String(input.hv_conn || input.conn || input.vector_group || 'Y').toUpperCase();
  const hvSupported = /^(Y|YN|D|DN)$/.test(hvConn);
  out.results.topology_status = hvSupported ? 'SUPPORTED' : 'UNSUPPORTED_TOPOLOGY';
  if (!hvSupported) out.results.topology_note = 'Connection "' + hvConn + '" is not supported by the implemented phase-voltage/winding model. Set hv_conn to a supported, benchmarked topology (Y/YN/D/DN) or disable this calculation.';
  out.results.hv_phase_voltage_V = (Vh && phases !== 1) ? (hvConn.indexOf('D') >= 0 ? Vh * 1000 : Vh * 1000 / Math.sqrt(3)) : (Vh ? Vh * 1000 : null);
  out.assumptions.hv_phase_voltage = phases === 1 ? 'line = phase' : 'wye: V_line/sqrt(3); delta: phase = line (topology-aware)';

  // Magnetic.
  const Phi = (B && A) ? B * A : null;
  const Et  = (f && Phi) ? 4.44 * f * Phi : null;
  out.results.flux_per_phase_Wb = Phi;
  out.results.volts_per_turn = Et;
  out.assumptions.magnetic = 'Phi_m = B_peak * A_net; Et = 4.44 * f * Phi_m (sinusoidal)';

  // Turns.
  const Nhv = (Et && out.results.hv_phase_voltage_V) ? out.results.hv_phase_voltage_V / Et : null;
  out.results.hv_turns = Nhv;
  out.assumptions.turns = 'N = V_phase / Et (first-pass; ignores tap steps and insulation build)';

  // Winding conductor (HV).
  if (Iph && J) {
    out.results.hv_conductor_area_mm2 = Iph / J;
    out.results.hv_current_density_A_mm2 = J;
    out.assumptions.winding = 'A = I_winding / J; winding current ~= line current (first-pass; ignores connection/parallel paths)';
  } else { out.results.hv_conductor_area_mm2 = null; }

  // DC resistance + mass (HV).
  if (Nhv && MLT && out.results.hv_conductor_area_mm2) {
    const A_m2 = out.results.hv_conductor_area_mm2 / 1e6;
    const rho = resistivity(mat, tempC);
    const R = rho * MLT * Nhv / A_m2; // per winding, ohms
    const m = MATERIAL[mat].density_kg_m3 * A_m2 * MLT * Nhv * (phases === 1 ? 1 : 3);
    out.results.hv_dc_resistance_ohm = R;
    out.results.hv_conductor_mass_kg = m;
    out.results.hv_dc_i2r_loss_W = (R && Iph) ? R * Iph * Iph : null;
    out.assumptions.winding_res = 'R = rho(T) * MLT * N / A; rho at ' + tempC + ' C; I2R = R*I^2 per winding';
    out.assumptions.mass = 'm = density * A * MLT * N * phases; excludes insulation, transpositions, eddy/stray';
  }

  return out;
}

module.exports = { designCore, MATERIAL, resistivity };
