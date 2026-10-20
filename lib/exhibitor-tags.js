/* EP Shanghai 2026 exhibitor marks. The data file is the exhibitor list
 * citation only. Outreach fields are not stored here.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const claimListing = require('./claim-listing');

const LABEL = 'Exhibiting at EP Shanghai 2026';
const EVENT_PATH = '/events/ep-shanghai-2026/';

function load(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data/ep-shanghai-2026-exhibitors.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { listings: [] };
  }
}

function index(doc) {
  const bySlug = Object.create(null);
  const byName = Object.create(null);
  (doc.listings || []).forEach(function (row) {
    if (!row || row.action === 'skipped') return;
    if (row.slug) bySlug[row.slug] = row;
    if (row.profile_name) byName[row.profile_name] = row;
    if (row.exhibitor_name) byName[row.exhibitor_name] = row;
  });
  return { bySlug: bySlug, byName: byName, doc: doc };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function block(row, opts) {
  if (!row) return '';
  opts = opts || {};
  const booth = row.booth && row.booth !== '—'
    ? '<span class="tpill">Booth ' + esc(row.booth) + '</span>' : '';
  let html = booth
    ? '<p class="exhibitor-tag" style="margin:10px 0 0">' + booth + '</p>'
    : '';
  if (row.products) {
    html += '<p style="font-size:.9rem;color:var(--text);margin:6px 0 0"><b>Exhibitor list products:</b> ' + esc(row.products) + '</p>';
  }
  if (row.action === 'added' && (!row.website || row.website === '—')) {
    html += '<p style="font-size:.9rem;color:var(--muted);margin:6px 0 0">Website: —</p>';
  }
  if (opts.claim && row.slug) {
    html += '<p class="claim-listing-row" style="margin:10px 0 0">' + claimListing.linkHtml(row.slug) + '</p>';
  }
  return html;
}

function forSlug(slug, root) {
  if (!slug) return null;
  return index(load(root)).bySlug[slug] || null;
}

module.exports = {
  LABEL: LABEL,
  EVENT_PATH: EVENT_PATH,
  load: load,
  index: index,
  block: block,
  forSlug: forSlug
};
