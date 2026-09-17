#!/usr/bin/env node
/* lib/listing-tier.js — paid Verified / Supplier Pro overlay for map + directory.
 *
 * Commercial listing is a separate axis from research. A website-checked
 * accessories row is NOT Verified Manufacturer. A LISTED census OEM is not
 * Featured. This module is the only place that turns paid/claimed flags into
 * featured-pin + badge state.
 *
 * Sources, in order (later does not override an explicit paid overlay):
 *   1. data/listing-tiers.json  (slug or exact census name)
 *   2. rec.listing_tier / rec.featured / rec.verified
 *   3. rec.commercial_status  (VERIFIED | SUPPLIER_PRO | FEATURED | PRO)
 *   4. manufacturer tuple flag m[4]  ('V' | 'P')
 *
 * Website-checked verification_status is ignored on purpose.
 */
'use strict';
const fs = require('fs');

function norm(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function listed() {
  return { featured: false, verified: false, tier: 'listed' };
}

function fromTierToken(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return null;
  if (s === 'p' || s === 'pro' || s === 'supplier_pro' || s === 'featured') {
    return { featured: true, verified: true, tier: 'pro' };
  }
  if (s === 'v' || s === 'verified' || s === 'verified_supplier' || s === 'claimed_verified') {
    return { featured: true, verified: true, tier: 'verified' };
  }
  return null;
}

function loadOverlay(filePath) {
  const p = filePath || 'data/listing-tiers.json';
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return { listings: [], cta: 'verified.html' };
  }
}

function indexOverlay(data) {
  const bySlug = Object.create(null);
  const byName = Object.create(null);
  (data && data.listings ? data.listings : []).forEach((row) => {
    if (!row) return;
    if (row.slug) bySlug[norm(row.slug)] = row;
    if (row.name) byName[norm(row.name)] = row;
  });
  return {
    bySlug: bySlug,
    byName: byName,
    cta: (data && data.cta) || 'verified.html'
  };
}

function fromOverlayRow(row) {
  if (!row) return null;
  const fromField = fromTierToken(row.listing_tier) || fromTierToken(row.tier) || fromTierToken(row.commercial_status);
  if (fromField) return fromField;
  if (row.featured || row.verified) {
    return { featured: true, verified: !!(row.verified || row.featured), tier: row.featured && !row.verified ? 'pro' : 'verified' };
  }
  return null;
}

function resolveListing(rec, overlayIndex) {
  rec = rec || {};
  const idx = overlayIndex || { bySlug: {}, byName: {} };
  const slug = rec.slug || '';
  const name = rec.name || rec.n || '';
  const overlay = (slug && idx.bySlug[norm(slug)]) || (name && idx.byName[norm(name)]) || null;
  const hit = fromOverlayRow(overlay)
    || fromTierToken(rec.listing_tier)
    || (rec.featured === true ? { featured: true, verified: true, tier: 'pro' } : null)
    || (rec.verified === true ? { featured: true, verified: true, tier: 'verified' } : null)
    || fromTierToken(rec.commercial_status)
    || fromTierToken(rec.flag)
    || fromTierToken(rec.flagV)
    || (Array.isArray(rec._src) ? fromTierToken(rec._src[4]) : null)
    || (rec._src && !Array.isArray(rec._src)
      ? (fromTierToken(rec._src.listing_tier) || fromTierToken(rec._src.commercial_status)
        || (rec._src.featured === true ? { featured: true, verified: true, tier: 'pro' } : null)
        || (rec._src.verified === true ? { featured: true, verified: true, tier: 'verified' } : null))
      : null);
  return hit || listed();
}

function applyMakerFlag(maker, overlayIndex) {
  if (!Array.isArray(maker) || !maker[0]) return maker;
  if (maker[4] === 'P' || maker[4] === 'V') return maker;
  const hit = resolveListing({ name: maker[0], flag: maker[4], _src: maker }, overlayIndex);
  if (hit.tier === 'pro') maker[4] = 'P';
  else if (hit.tier === 'verified') maker[4] = 'V';
  return maker;
}

module.exports = {
  norm: norm,
  listed: listed,
  fromTierToken: fromTierToken,
  loadOverlay: loadOverlay,
  indexOverlay: indexOverlay,
  resolveListing: resolveListing,
  applyMakerFlag: applyMakerFlag
};

if (require.main === module) {
  var fails = 0;
  function ok(c, m) { if (!c) { fails++; console.error('  ✗ ' + m); } else console.log('  ok — ' + m); }
  console.log('LISTING TIER self-test');
  var empty = indexOverlay({ listings: [] });
  ok(resolveListing({ name: 'ABB' }, empty).featured === false, 'unknown OEM is not featured');
  ok(resolveListing({ name: 'ABB', commercial_status: 'LISTED' }, empty).tier === 'listed', 'LISTED is not featured');
  ok(resolveListing({ name: 'X', _src: { verification_status: 'Official Website Checked' } }, empty).featured === false, 'website-checked is not commercial Verified');
  var paid = indexOverlay({ listings: [{ name: 'Delta Star', listing_tier: 'verified' }] });
  ok(resolveListing({ name: 'Delta Star' }, paid).featured === true && resolveListing({ name: 'Delta Star' }, paid).verified === true, 'overlay verified is a featured pin');
  ok(resolveListing({ name: 'Eaton', flag: 'P' }, empty).tier === 'pro', 'tuple P is Supplier Pro');
  ok(resolveListing({ name: 'Eaton', flag: 'V' }, empty).tier === 'verified', 'tuple V is Verified');
  console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'LISTING TIER PASS'));
  process.exitCode = fails ? 1 : 0;
}
