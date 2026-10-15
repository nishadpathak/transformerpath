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
 * Global status follows latest_source_date only. The GCC discovery flag
 * (data_current_claim_allowed / discovery_claim_disallowed) does not gate it.
 * An item no more than 1 day old reads UPDATED with that date, or
 * "Updated today" when the item is from today. Older items keep the age
 * labels. A desk rebuild never mints freshness.
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

const MONTHS_UTC = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayUTC(d) {
  const iso = dayIso(d);
  const t = parseInstant(d);
  if (!t && !iso) return String(d || '');
  let label = '';
  if (t) {
    try {
      label = t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch (e) {
      label = '';
    }
  }
  label = String(label || '').replace(/\u00a0|\u202f/g, ' ').trim();
  if (!/^\d{1,2} [A-Za-z]{3} \d{4}$/.test(label)) {
    const day = iso || (t ? t.toISOString().slice(0, 10) : '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const p = day.split('-');
      label = String(Number(p[2])) + ' ' + MONTHS_UTC[Number(p[1]) - 1] + ' ' + p[0];
    }
  }
  return label;
}

/**
 * Derive public Intel status from the latest sourced-item date.
 * dataCurrentClaimAllowed is accepted and ignored: GCC discovery honesty
 * does not change this global label.
 * @param {object} opts
 * @param {string} opts.latestSourceIso - YYYY-MM-DD content date
 * @param {string} [opts.latestCheckedAt] - ISO source-check stamp
 * @param {string} [opts.buildAt] - ISO build stamp
 * @param {Date} [opts.now]
 */
function classifyIntelStatus(opts) {
  opts = opts || {};
  const now = opts.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const sourceIso = dayIso(opts.latestSourceIso);

  let statusLabel = 'INTEL COVERAGE DELAYED';
  let reason = 'no_validated_source_date';
  let ageDays = null;

  if (sourceIso) {
    ageDays = Math.round((Date.parse(todayIso + 'T00:00:00Z') - Date.parse(sourceIso + 'T00:00:00Z')) / 86400000);
    const dayLabel = formatDayUTC(sourceIso);
    const dayOk = /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(dayLabel);
    if (ageDays < 0) {
      statusLabel = 'INTEL COVERAGE DELAYED';
      reason = 'future_source_date_rejected';
    } else if (ageDays === 0 && dayOk) {
      statusLabel = 'Updated today';
      reason = 'source_within_1d';
    } else if (ageDays === 1 && dayOk) {
      statusLabel = 'UPDATED ' + dayLabel;
      reason = 'source_within_1d';
    } else if (!dayOk) {
      statusLabel = 'INTEL COVERAGE DELAYED';
      reason = 'source_date_unprintable';
    } else if (ageDays > COVERAGE_LAG_DAYS) {
      statusLabel = 'INTEL COVERAGE DELAYED';
      reason = 'source_lag_' + ageDays + 'd';
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

  // Absolute STALE only when we have no source date at all,
  // or the sourced item is older than 30 days.
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
    data_current_claim_allowed: statusLabel === 'DATA CURRENT',
    honesty: 'Status follows latest_source_date, not build_at and not the GCC discovery gate. A sourced item no more than 1 day old reads UPDATED with that date, or Updated today. Desk rebuild alone never yields UPDATED or DATA CURRENT.'
  };
}

function statusDotColor(label) {
  if (label === 'DATA CURRENT' || label === 'Updated today' || /^UPDATED \d{1,2} [A-Za-z]{3} \d{4}$/.test(label || '')) return '#1a9d4a';
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
