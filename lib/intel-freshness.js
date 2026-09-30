#!/usr/bin/env node
/* lib/intel-freshness.js — single clock vocabulary for Intel surfaces.
 *
 * Three distinct clocks (never conflate):
 *   latest_source_date     — newest validated CONTENT / observation date on a
 *                            published item (float / publication / event / update).
 *                            Never source_checked_at, never build time, never COD.
 *   latest_source_checked_at — when we last probed/checked a source portal.
 *   build_at               — when this HTML/JSON artifact was regenerated.
 *
 * DATA CURRENT is forbidden when latest_source_date lags the desk or when
 * gcc_market_watch.data_current_claim_allowed === false. Prefer
 * INTEL COVERAGE DELAYED when discovery has not caught the industry.
 */
'use strict';

const COVERAGE_LAG_DAYS = 10; // sourced intel older than this → coverage delayed

function dayIso(d) {
  if (!d) return null;
  const s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseInstant(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

function formatDayUTC(d) {
  const t = parseInstant(d);
  if (!t) return String(d || '');
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Derive public Intel status from clocks.
 * @param {object} opts
 * @param {string} opts.latestSourceIso - YYYY-MM-DD content date
 * @param {string} [opts.latestCheckedAt] - ISO source-check stamp
 * @param {string} [opts.buildAt] - ISO build stamp
 * @param {boolean} [opts.dataCurrentClaimAllowed] - from GCC honesty block
 * @param {Date} [opts.now]
 */
function classifyIntelStatus(opts) {
  opts = opts || {};
  const now = opts.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const sourceIso = dayIso(opts.latestSourceIso);
  const claimAllowed = opts.dataCurrentClaimAllowed !== false;

  let statusLabel = 'INTEL COVERAGE DELAYED';
  let reason = 'no_validated_source_date';
  let ageDays = null;

  if (sourceIso) {
    ageDays = Math.round((Date.parse(todayIso + 'T00:00:00Z') - Date.parse(sourceIso + 'T00:00:00Z')) / 86400000);
    if (ageDays < 0) {
      statusLabel = 'INTEL COVERAGE DELAYED';
      reason = 'future_source_date_rejected';
    } else if (!claimAllowed || ageDays > COVERAGE_LAG_DAYS) {
      statusLabel = 'INTEL COVERAGE DELAYED';
      reason = !claimAllowed ? 'discovery_claim_disallowed' : 'source_lag_' + ageDays + 'd';
    } else if (ageDays <= 3) {
      statusLabel = 'DATA CURRENT';
      reason = 'source_within_3d';
    } else if (ageDays <= 7) {
      statusLabel = 'REFRESH DELAYED';
      reason = 'source_within_7d';
    } else {
      statusLabel = 'INTEL COVERAGE DELAYED';
      reason = 'source_lag_' + ageDays + 'd';
    }
  }

  // Absolute STALE only when we have no source date at all and build is ancient,
  // or source is older than 30 days.
  if (sourceIso && ageDays != null && ageDays > 30) {
    statusLabel = 'DATA STALE';
    reason = 'source_lag_' + ageDays + 'd';
  }
  if (!sourceIso) {
    statusLabel = 'DATA STALE';
    reason = 'no_validated_source_date';
  }

  return {
    statusLabel: statusLabel,
    reason: reason,
    ageDays: ageDays,
    latest_source_date: sourceIso ? formatDayUTC(sourceIso) : null,
    latest_source_iso: sourceIso,
    latest_source_checked_at: opts.latestCheckedAt || null,
    build_at: opts.buildAt || null,
    data_current_claim_allowed: claimAllowed && statusLabel === 'DATA CURRENT',
    honesty: 'Status follows latest_source_date, not build_at. Desk rebuild alone never yields DATA CURRENT.'
  };
}

function statusDotColor(label) {
  if (label === 'DATA CURRENT') return '#1a9d4a';
  if (label === 'REFRESH DELAYED') return '#e0a800';
  if (label === 'INTEL COVERAGE DELAYED') return '#e0a800';
  return '#94a3b8';
}

module.exports = {
  COVERAGE_LAG_DAYS: COVERAGE_LAG_DAYS,
  dayIso: dayIso,
  formatDayUTC: formatDayUTC,
  classifyIntelStatus: classifyIntelStatus,
  statusDotColor: statusDotColor
};
