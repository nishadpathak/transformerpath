/* Which directory listings stay in the index.
 *
 * A listing page is always written and stays reachable. This module only
 * decides robots and, through that, the sitemap. Thin or unclaimed listings
 * are noindex,follow. Rich listings stay index,follow.
 *
 * Rich means sourced data with multiple fields already on file. Nothing here
 * is estimated, and no field is filled in to qualify a page.
 *
 * Manufacturer profile (index,follow) — all of the following:
 *   1. The census row has a public website.
 *   2. At least one of these sourced-field bars holds:
 *      a. data/manufacturer-intel.json completeness_score is 60 or more.
 *         The census baseline (name, country, website, product types, and a
 *         factory city) scores 50. Each further 10 points is an existing
 *         sourced field: reported voltage, reported MVA, reported standards,
 *         testing capability or orders/projects, or a sourced cooling class.
 *      b. data/manufacturer-tiers.json dossier for that company has a source
 *         string and at least two of: kV, MVA, annual capacity, standards,
 *         product types, voltage classes.
 *      c. The census row names a city and three or more distinct product-type
 *         codes (multiple product fields on the same sourced row).
 *
 * Accessory profile (index,follow) — all of the following, from
 * data/accessories.json:
 *   - verification_status and listing_status are not unclaimed, inactive,
 *     or unverified
 *   - website, city, standards, and evidence_source are non-empty
 *   - at least one of voltage_max_kv, voltage_evidence_kv, max_current_a
 *
 * Service and laboratory profile pages generated for profile_page rows are
 * unclaimed stubs ("Unclaimed listing"). They stay on the site and are
 * noindex. The directory hubs are not listings and are unchanged.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function filled(v) {
  if (v == null) return false;
  if (typeof v === 'number') return !isNaN(v) && v !== 0;
  if (typeof v === 'string') {
    const s = v.trim();
    return !!s && s !== '—' && s !== '-' && s !== 'n/a' && s !== 'N/A';
  }
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return !!v;
}

function loadIntel(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data/manufacturer-intel.json');
  let doc = { companies: [] };
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { doc = { companies: [] }; }
  const bySlug = {};
  const byName = {};
  (doc.companies || []).forEach(function (c) {
    if (c && c.slug) bySlug[c.slug] = c;
    if (c && c.name) byName[norm(c.name)] = c;
  });
  return { bySlug: bySlug, byName: byName };
}

let INTEL = null;
function intelStore(root) {
  if (!INTEL) INTEL = loadIntel(root);
  return INTEL;
}

function intelFor(rec, root) {
  const store = intelStore(root);
  if (rec.slug && store.bySlug[rec.slug]) return store.bySlug[rec.slug];
  const name = norm(rec.name);
  if (name && store.byName[name]) return store.byName[name];
  return null;
}

function tierIsRich(tier) {
  if (!tier || !filled(tier.source)) return false;
  let n = 0;
  if (filled(tier.kv)) n++;
  if (filled(tier.mva)) n++;
  if (filled(tier.cap)) n++;
  if (filled(tier.certs)) n++;
  if (filled(tier.types)) n++;
  if (filled(tier.voltage)) n++;
  return n >= 2;
}

function distinctTypes(types) {
  const out = [];
  (types || []).forEach(function (t) {
    const s = String(t || '').trim();
    if (s && out.indexOf(s) < 0) out.push(s);
  });
  return out;
}

function manufacturerIndexable(rec, root) {
  if (!rec || !filled(rec.url)) return false;
  if (tierIsRich(rec.tierFile)) return true;
  const intel = intelFor(rec, root);
  if (intel && Number(intel.completeness_score) >= 60) return true;
  if (filled(rec.city) && distinctTypes(rec.types).length >= 3) return true;
  return false;
}

function unclaimedStatus(rec) {
  const status = String((rec && (rec.verification_status || rec.listing_status)) || '');
  const listing = String((rec && rec.listing_status) || '');
  if (/unclaimed/i.test(status) || /unclaimed/i.test(listing)) return true;
  if (/^(inactive|unverified)$/i.test(status.trim())) return true;
  return false;
}

function accessoryIndexable(rec) {
  if (!rec || unclaimedStatus(rec)) return false;
  if (!filled(rec.website) || !filled(rec.city)) return false;
  if (!filled(rec.standards) || !filled(rec.evidence_source)) return false;
  const tech = ['voltage_max_kv', 'voltage_evidence_kv', 'max_current_a'].filter(function (k) {
    return filled(rec[k]);
  });
  return tech.length >= 1;
}

/* Generated service and laboratory profile pages are unclaimed stubs.
 * The hubs stay indexable; these profile URLs do not. */
function stubProfileIndexable() {
  return false;
}

function robots(indexable) {
  return indexable ? 'index,follow' : 'noindex,follow';
}

module.exports = {
  filled: filled,
  manufacturerIndexable: manufacturerIndexable,
  accessoryIndexable: accessoryIndexable,
  stubProfileIndexable: stubProfileIndexable,
  robots: robots,
  tierIsRich: tierIsRich,
  distinctTypes: distinctTypes
};
