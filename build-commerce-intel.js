#!/usr/bin/env node
/* build-commerce-intel.js — honest commercial-opportunity signals.
 *
 * The revenue dashboard /admin/revenue must NEVER show fabricated revenue.
 * This builder derives ONLY what is real from the canonical datasets:
 *   - platform scale (manufacturers, projects, tenders, awards, events)
 *   - supplier prospect signals (manufacturers that have a website but carry no
 *     verified/claim record statically — a natural "claim" pipeline)
 *   - event promotion prospects (upcoming events with no featured package)
 *   - a neutral note that live revenue requires the Stripe/Supabase integration
 *
 * Every field is computed from source data. No revenue, no conversion, no
 * "pipeline value" totals are invented. Where live commercial state is not
 * available statically, it is explicitly labelled as such rather than guessed.
 *
 * Run: node build-commerce-intel.js  (after build-awards.js / project datasets).
 */
'use strict';
const fs = require('fs');
function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

const MANUF = readJson('data/manufacturers.json', []);
const PROJECTS = readJson('data/projects.json', {}).projects || [];
const TENDERS = readJson('data/tenders.json', {}).tenders || [];
const AWARDS = readJson('data/awards.json', {}).awards || [];
const EVENTS = readJson('data/events.json', {});
const events = Array.isArray(EVENTS) ? EVENTS : (EVENTS.events || []);
const COMMERCE = readJson('data/commerce.json', {});
const STATS = readJson('data/site-stats.json', {});

// Supplier prospect list: companies that have a website (a natural claim target).
// We cannot know real claim/verified state statically (that lives in Supabase),
// so this is a dynamic "discovery" surface, not a claim/verified ledger.
const supplierProspects = [];
const seenCo = new Set();
MANUF.forEach((g) => {
  (g.makers || []).forEach((x) => {
    if (/^Served by/i.test(x[0])) return;
    const name = x[0].trim();
    const url = x[2] || '';
    if (seenCo.has(name.toLowerCase())) return;
    if (!/^https?:\/\//.test(url)) return;
    seenCo.add(name.toLowerCase());
    supplierProspects.push({
      name, country: g.country, region: g.region || '', city: x[1] || '',
      categories: (x[3] || '').split(',').map((s) => s.trim()).filter(Boolean),
      website: url,
      // claim/verified state is recorded server-side; statically unknown here.
      commercial_status: 'not recorded statically — see Supabase company_claims',
    });
  });
});
supplierProspects.sort((a, b) => String(a.country).localeCompare(b.country) || String(a.name).localeCompare(b.name));

// Event promotion prospects: upcoming events (no featured package recorded statically).
const today = new Date().toISOString().slice(0, 10);
const eventProspects = events
  .filter((e) => e.s && e.s >= today && e.d)
  .map((e) => ({ name: e.n, city: e.c || '', country: e.co || '', region: e.r || '', date: e.s, url: e.u || '' }))
  .sort((a, b) => String(a.date).localeCompare(b.date));

const commerce = {
  $schema: 'https://transformerpath.com/commerce-intel.schema.json',
  generated: new Date().toISOString(),
  honesty_note: 'Revenue and conversion figures are NOT shown because live Stripe/Supabase transaction data is not available in this static build. No revenue, no conversion rate and no pipeline value are fabricated. The figures below are real platform-scale and prospect signals derived from the canonical datasets.',
  metrics: {
    platform_scale: {
      manufacturers: STATS.manufacturers || supplierProspects.length,
      projects: STATS.projects || PROJECTS.length,
      tenders: STATS.tenders || TENDERS.length,
      open_tenders: STATS.openTenders || 0,
      awards: STATS.awards || AWARDS.length,
      events: STATS.events || events.length,
    },
    prospect_signals: {
      supplier_prospects_with_website: supplierProspects.length,
      upcoming_events: eventProspects.length,
    },
  },
  supplier_prospects: supplierProspects.slice(0, 200),
  event_prospects: eventProspects,
  products: (COMMERCE && COMMERCE.sections) || [],
  revenue: {
    status: 'collection-in-progress',
    note: 'Live revenue requires the Stripe checkout + Supabase entitlements integration to be wired and verified. Until then no revenue is disclosed rather than estimated.',
  },
};
fs.writeFileSync('data/commerce-intel.json', JSON.stringify(commerce, null, 2));
console.log('commerce-intel.json wrote: ' + supplierProspects.length + ' supplier prospects, ' + eventProspects.length + ' event prospects; revenue status collection-in-progress');
