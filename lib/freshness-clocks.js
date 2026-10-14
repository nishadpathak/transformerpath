/* TransformerPath — separate freshness clocks.
 *
 * Daily Intel and the manufacturer census are NOT the same clock.
 *   intelAge  → DATA CURRENT (<36h) / REFRESH DELAYED (36–72h) / DATA STALE (>72h)
 *   censusAge → CENSUS REBUILT <date>; NEVER labelled DATA CURRENT when age > 72h
 *
 * Intel copy uses SOURCE CHECKED (a source was inspected). VERIFIED is a
 * company-listing state (Listed → Claimed → Verified → Supplier Pro), not an
 * intel freshness word.
 */
'use strict';

const INTEL_CURRENT_H = 36;
const INTEL_STALE_H = 72;
const CENSUS_STALE_H = 72;

function ageHours(iso, now) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (isNaN(t)) {
    // Date-only stamps (YYYY-MM-DD) are treated as UTC noon that day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) {
      const t2 = Date.parse(iso + 'T12:00:00Z');
      if (isNaN(t2)) return null;
      return (now - t2) / 3600000;
    }
    return null;
  }
  return (now - t) / 3600000;
}

function intelStatus(iso, now) {
  now = now || Date.now();
  const h = ageHours(iso, now);
  if (h == null) return { id: 'unknown', label: 'REFRESH UNKNOWN', hours: null, dataCurrent: false };
  if (h > INTEL_STALE_H) return { id: 'stale', label: 'DATA STALE', hours: h, dataCurrent: false };
  if (h > INTEL_CURRENT_H) return { id: 'delayed', label: 'REFRESH DELAYED', hours: h, dataCurrent: false };
  return { id: 'current', label: 'DATA CURRENT', hours: h, dataCurrent: true };
}

function censusStatus(iso, now) {
  now = now || Date.now();
  const h = ageHours(iso, now);
  if (h == null) return { id: 'unknown', label: 'CENSUS DATE UNKNOWN', hours: null, dataCurrent: false };
  if (h > CENSUS_STALE_H) return { id: 'stale', label: 'CENSUS AGING', hours: h, dataCurrent: false };
  return { id: 'recent', label: 'CENSUS REBUILT', hours: h, dataCurrent: false };
}

function clocksFromFreshness(fresh, now) {
  now = now || Date.now();
  const surfaces = (fresh && fresh.surfaces) || [];
  const intel = surfaces.find((s) => s.id === 'daily_intel') || {};
  const census = surfaces.find((s) => s.id === 'census') || {};
  const intelIso = intel.last_successful_refresh || intel.last_data_refresh || intel.last_build;
  const censusIso = census.last_successful_refresh || census.last_data_refresh || census.last_build;
  return {
    intel: Object.assign({ iso: intelIso }, intelStatus(intelIso, now)),
    census: Object.assign({ iso: censusIso }, censusStatus(censusIso, now)),
  };
}

module.exports = {
  INTEL_CURRENT_H, INTEL_STALE_H, CENSUS_STALE_H,
  ageHours, intelStatus, censusStatus, clocksFromFreshness,
};
