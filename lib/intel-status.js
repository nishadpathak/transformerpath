#!/usr/bin/env node
/* lib/intel-status.js — one clock for the homepage banner and intel.html.
 *
 * latest_source_date is the newest validated CONTENT day (publication,
 * update, float, event, or a day-precision feed card). Never source_checked_at,
 * never the build clock, never a tender close, never a future day.
 * Status comes from lib/intel-freshness and the latest sourced-item date.
 * The GCC discovery_claim_disallowed flag does not gate this label.
 */
'use strict';
const fs = require('fs');
const { classifyIntelStatus, formatDayUTC, statusDotColor } = require('./intel-freshness');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

function pushDay(dates, d, todayIso) {
  if (!d) return;
  const day = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  if (todayIso && day > todayIso) return;
  dates.push(day);
}

function computeIntelStatus(opts) {
  opts = opts || {};
  const now = opts.now ? new Date(opts.now) : new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const buildAt = opts.buildAt || now.toISOString();
  const feed = opts.feed || readJson('data/intel-feed-ui.json', {});
  const intel = opts.intel || readJson('data/intel.json', {});
  const gcc = opts.gcc || readJson('data/gcc-discovery-candidates.json', {});
  const adapters = opts.adapters || readJson('data/gcc-adapter-report.json', {});

  const dates = [];
  if (feed.honesty && feed.honesty.latest_source_iso) pushDay(dates, feed.honesty.latest_source_iso, todayIso);
  if (intel.refresh_meta && intel.refresh_meta.newest_validated_content_date) {
    pushDay(dates, intel.refresh_meta.newest_validated_content_date, todayIso);
  }
  (gcc.candidates || []).forEach(function (c) {
    const d = c.dates || {};
    ['update_date', 'tender_float_date', 'publication_date', 'event_date'].forEach(function (k) {
      pushDay(dates, d[k], todayIso);
    });
  });
  // Day-precision cards. A stale honesty label must not hide a newer item.
  (feed.posts || []).forEach(function (p) {
    if (p && p.datePrecision === 'day') pushDay(dates, p.dateIso, todayIso);
  });
  dates.sort();
  const newest = dates.length ? dates[dates.length - 1] : null;

  const checks = [];
  (gcc.candidates || []).forEach(function (c) {
    const d = c.dates && c.dates.source_checked_at;
    if (d) {
      const day = String(d).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day <= todayIso) checks.push(day);
    }
  });
  if (adapters.generated_at) {
    const day = String(adapters.generated_at).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day <= todayIso) checks.push(day);
  }
  checks.sort();
  const checked = checks.length ? checks[checks.length - 1] : null;

  const classified = classifyIntelStatus({
    latestSourceIso: newest,
    latestCheckedAt: checked,
    buildAt: buildAt,
    now: now
  });

  return {
    status: classified.statusLabel,
    reason: classified.reason,
    latest_source_date: classified.latest_source_date || null,
    latest_source_iso: classified.latest_source_iso,
    latest_source_checked_at: checked,
    latest_source_checked_label: checked ? formatDayUTC(checked) : null,
    build_at: buildAt,
    build_label: formatDayUTC(buildAt),
    data_current_claim_allowed: classified.data_current_claim_allowed,
    age_days: classified.ageDays,
    dot: statusDotColor(classified.statusLabel)
  };
}

function writeIntelStatus(doc) {
  const status = doc || computeIntelStatus();
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/intel-status.json', JSON.stringify(status, null, 2) + '\n');
  return status;
}

module.exports = {
  computeIntelStatus: computeIntelStatus,
  writeIntelStatus: writeIntelStatus,
  readJson: readJson
};
