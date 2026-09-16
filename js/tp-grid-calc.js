/**
 * TransformerPath Grid Lab — Core Electrical Engineering Calculation Engine
 * Rigorous three-phase formulas for grid voltage transformations, currents, and losses.
 */

'use strict';

const SQRT3 = Math.sqrt(3);

/**
 * Three-phase current calculation: I = (S_mva * 1000) / (sqrt(3) * V_kv) in Amperes
 * @param {number} mva - Apparent power in MVA
 * @param {number} kv - Line-to-line voltage in kV
 * @returns {number} Current in Amperes (A)
 */
function threePhaseCurrent(mva, kv) {
  if (!mva || !kv || kv <= 0) return 0;
  return (mva * 1000) / (SQRT3 * kv);
}

/**
 * Active power from apparent power: P = S * cos(phi)
 * @param {number} mva - Apparent power in MVA
 * @param {number} powerFactor - Power factor (e.g. 0.85 to 0.95)
 * @returns {number} Active power in MW
 */
function activePower(mva, powerFactor = 0.9) {
  return mva * powerFactor;
}

/**
 * Apparent power from active power: S = P / cos(phi)
 * @param {number} mw - Active power in MW
 * @param {number} powerFactor - Power factor
 * @returns {number} Apparent power in MVA
 */
function apparentPower(mw, powerFactor = 0.9) {
  if (!powerFactor || powerFactor <= 0) return mw;
  return mw / powerFactor;
}

/**
 * Transmission line I^2 * R loss in MW for 3-phase line
 * P_loss = 3 * I^2 * R = (S^2 / V^2) * R
 * @param {number} currentA - Phase current in Amperes
 * @param {number} resistanceOhm - Total phase resistance in Ohms
 * @returns {number} Loss in MW
 */
function lineLossMW(currentA, resistanceOhm) {
  return (3 * Math.pow(currentA, 2) * resistanceOhm) / 1e6;
}

/**
 * Transformer total loss calculation at specific loading fraction
 * Total Loss = P_no_load (core loss, constant) + (loading_fraction^2) * P_load (copper loss)
 * @param {number} noLoadLossKW - Core loss in kW (constant while energized)
 * @param {number} fullLoadLossKW - Full load copper loss in kW at 100% rated
 * @param {number} loadFraction - Loading ratio (e.g. 0.8 for 80% load)
 * @returns {{ noLoadKW: number, loadKW: number, totalKW: number, efficiencyPercent: number }}
 */
function transformerLosses(noLoadLossKW, fullLoadLossKW, loadFraction, ratedMVA, powerFactor = 0.9) {
  const noLoadKW = noLoadLossKW;
  const loadKW = fullLoadLossKW * Math.pow(loadFraction, 2);
  const totalKW = noLoadKW + loadKW;
  const outputKW = ratedMVA * 1000 * loadFraction * powerFactor;
  const efficiency = outputKW > 0 ? (outputKW / (outputKW + totalKW)) * 100 : 0;

  return {
    noLoadKW: Math.round(noLoadKW * 10) / 10,
    loadKW: Math.round(loadKW * 10) / 10,
    totalKW: Math.round(totalKW * 10) / 10,
    efficiencyPercent: Math.min(99.95, Math.round(efficiency * 100) / 100)
  };
}

/**
 * Voltage ratio between primary and secondary
 */
function voltageRatio(vPrimKV, vSecKV) {
  if (!vSecKV || vSecKV <= 0) return 0;
  return vPrimKV / vSecKV;
}

/**
 * OLTC secondary voltage adjustment
 * @param {number} nominalKV - Nominal secondary voltage (e.g. 33.0 kV)
 * @param {number} tapPosition - Current tap (e.g. 7, 8, 9 where 7 is nominal)
 * @param {number} stepPercent - Step voltage percent per tap (typically 1.25%)
 * @param {number} loadSagKV - Voltage sag due to system loading
 */
function oltcRegulatedVoltage(nominalKV, tapPosition, stepPercent = 1.25, loadSagKV = 0, nominalTap = 7) {
  const tapDelta = tapPosition - nominalTap;
  const boostFactor = 1 + (tapDelta * stepPercent) / 100;
  const rawVoltage = nominalKV * boostFactor - loadSagKV;
  return Math.round(rawVoltage * 100) / 100;
}

/**
 * Parallel transformer load sharing
 * Two transformers T1, T2 in parallel sharing a common load.
 * If %Z are equal, S1 = S_total * (S_rated1 / (S_rated1 + S_rated2))
 */
function parallelLoadShare(totalLoadMVA, t1RatedMVA, t1ZPercent, t2RatedMVA, t2ZPercent, t1InService = true, t2InService = true) {
  if (!t1InService && !t2InService) {
    return { t1MVA: 0, t1LoadPercent: 0, t2MVA: 0, t2LoadPercent: 0, totalDeliveredMVA: 0, overloaded: false };
  }
  if (t1InService && !t2InService) {
    const t1Load = totalLoadMVA;
    const pct = (t1Load / t1RatedMVA) * 100;
    return {
      t1MVA: Math.round(t1Load * 10) / 10,
      t1LoadPercent: Math.round(pct * 10) / 10,
      t2MVA: 0,
      t2LoadPercent: 0,
      totalDeliveredMVA: t1Load,
      overloaded: pct > 100
    };
  }
  if (!t1InService && t2InService) {
    const t2Load = totalLoadMVA;
    const pct = (t2Load / t2RatedMVA) * 100;
    return {
      t1MVA: 0,
      t1LoadPercent: 0,
      t2MVA: Math.round(t2Load * 10) / 10,
      t2LoadPercent: Math.round(pct * 10) / 10,
      totalDeliveredMVA: t2Load,
      overloaded: pct > 100
    };
  }

  // Both in service: admittance weighting
  const y1 = t1RatedMVA / t1ZPercent;
  const y2 = t2RatedMVA / t2ZPercent;
  const yTotal = y1 + y2;

  const t1MVA = totalLoadMVA * (y1 / yTotal);
  const t2MVA = totalLoadMVA * (y2 / yTotal);

  const t1Pct = (t1MVA / t1RatedMVA) * 100;
  const t2Pct = (t2MVA / t2RatedMVA) * 100;

  return {
    t1MVA: Math.round(t1MVA * 10) / 10,
    t1LoadPercent: Math.round(t1Pct * 10) / 10,
    t2MVA: Math.round(t2MVA * 10) / 10,
    t2LoadPercent: Math.round(t2Pct * 10) / 10,
    totalDeliveredMVA: totalLoadMVA,
    overloaded: t1Pct > 100 || t2Pct > 100
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    threePhaseCurrent,
    activePower,
    apparentPower,
    lineLossMW,
    transformerLosses,
    voltageRatio,
    oltcRegulatedVoltage,
    parallelLoadShare
  };
}
