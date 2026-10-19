'use strict';
/* lib/events-reader.js — one reader for data/events.json.
 *
 * The registry is stored with long keys. For one release this reader also
 * attaches the old short keys (n, s, e, c, co, r, v, u, d) so existing build
 * scripts keep working. Short keys are empty strings when the long field is
 * null, so sorts and date math do not throw. Unknown long fields stay null.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join('data', 'events.json');

function loadRaw() {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.events)) return raw.events;
  return [];
}

function isLong(r) {
  return r && (Object.prototype.hasOwnProperty.call(r, 'name') || Object.prototype.hasOwnProperty.call(r, 'date_status') || Object.prototype.hasOwnProperty.call(r, 'official_url'));
}

function normalize(r) {
  if (!r || typeof r !== 'object') return r;
  if (!isLong(r)) {
    return {
      id: null,
      series_slug: null,
      edition_label: null,
      name: r.n || null,
      type: null,
      start: r.s || null,
      end: r.e || null,
      date_status: null,
      venue: r.v || null,
      city: r.c || null,
      country: r.co || null,
      region: r.r || null,
      organiser: null,
      official_url: r.u || null,
      source_url: null,
      source_checked_at: null,
      relevance_tier: null,
      relevance_reason: null,
      stats: null,
      key_exhibitors: null,
      programme: null,
      deadlines: null,
      registration: null,
      markets: null,
      intel_links: null,
      lifecycle_status: null,
      description: r.d || null,
      research_status: r.research_status || null,
      n: r.n || '',
      s: r.s || '',
      e: r.e || '',
      c: r.c || '',
      co: r.co || '',
      r: r.r || '',
      v: r.v || '',
      u: r.u || '',
      d: r.d || '',
    };
  }
  const o = Object.assign({}, r);
  o.n = o.name || '';
  o.s = o.start || '';
  o.e = o.end || '';
  o.c = o.city || '';
  o.co = o.country || '';
  o.r = o.region || '';
  o.v = o.venue || '';
  o.u = o.official_url || '';
  o.d = o.description || '';
  return o;
}

function loadEvents() {
  return loadRaw().map(normalize);
}

module.exports = { loadEvents, loadRaw, normalize, isLong };
