/* Mid-tier manufacturers for /spare-capacity/.
 *
 * The set is tier 2 in data/manufacturer-tiers.json. A row is published only
 * when that name resolves to a profile page already on disk. Country is the
 * country on that profile. Region is the census region for that country.
 * Voltage is the highest voltage the profile already states. A capacity note
 * is attached only from data/mid-tier-capacity-notes.json, which stores a
 * public URL and a date. Rows without that note keep an empty capacity field.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveCompanyAlias } = require('./company-aliases');
const { verifiedManufacturerPayHref, VERIFIED_MANUFACTURER_PAYMENT_LINK } = require('./paid-listings');

const ROOT = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function regionFor(country) {
  const groups = readJson('data/manufacturers.json');
  const hit = groups.find(function (g) { return g && g.country === country; });
  return hit && hit.region ? hit.region : '';
}

function profileBits(slug) {
  const file = path.join(ROOT, 'manufacturers', slug, 'index.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const h1 = strip((html.match(/<h1>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const country = ((html.match(/<b style="color:var\(--text\)">([^<]+)<\/b>/) || [])[1] || '').trim();
  const lead = strip((html.match(/<p class="lead">([\s\S]*?)<\/p>/i) || [])[1] || '');
  const kvMatch = lead.match(/highest sourced voltage (\d+(?:\.\d+)?) kV/i);
  const kv = kvMatch ? Number(kvMatch[1]) : null;
  return { name: h1, country: country, kv: Number.isFinite(kv) ? kv : null };
}

function notesBySlug() {
  const doc = readJson('data/mid-tier-capacity-notes.json');
  const map = {};
  (doc.notes || []).forEach(function (note) {
    if (!note || !note.slug) return;
    map[note.slug] = note;
  });
  return map;
}

function listMidTier() {
  const tiers = readJson('data/manufacturer-tiers.json').filter(function (row) {
    return row && row.tier === 2 && row.name;
  });
  const notes = notesBySlug();
  const rows = [];
  tiers.forEach(function (tier) {
    const alias = resolveCompanyAlias(tier.name);
    const slug = alias.slug;
    const profile = profileBits(slug);
    if (!profile || !profile.name || !profile.country) return;
    const note = notes[slug] || null;
    const href = verifiedManufacturerPayHref(slug) || VERIFIED_MANUFACTURER_PAYMENT_LINK;
    rows.push({
      tierName: tier.name,
      name: profile.name,
      slug: slug,
      country: profile.country,
      region: regionFor(profile.country),
      kv: profile.kv,
      profileHref: '/manufacturers/' + slug + '/',
      payHref: href,
      capacity: note
    });
  });
  rows.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return rows;
}

module.exports = {
  listMidTier: listMidTier,
  notesBySlug: notesBySlug
};
