#!/usr/bin/env node
/* build-materials.js — TransformerPath Materials Intelligence (canonical).
 *
 * Produces data/materials.json, the single source of truth for transformer
 * materials intelligence, with full provenance per the platform's absolute
 * rules. Every material record carries:
 *   material / grade / market / country / region / price / currency / unit /
 *   price_basis / observation_date / source / source_url / retrieved_at /
 *   delay_type / confidence / notes
 *
 * HONESTY (absolute rules):
 *   - Copper and aluminium use the LME 3-month official ring settlement as a
 *     latest REFERENCE (verified, sourced, dated). Never labelled "live" —
 *     they are reference prices with an observation date and delay.
 *   - CRGO / electrical steel has NO public daily index and prices legitimately
 *     differ by market, grade, thickness, loss class and commercial basis.
 *     Where there is no verified, grade-specific, basis-specific figure we show
 *     value=null and "GRADE NOT SPECIFIED" rather than an unverifiable estimate.
 *     A concrete US/China estimate with no grade/basis is NOT a comparable price
 *     and is not shown as one. Unknown > incorrect.
 *   - Materials with no credible public reference (oil, ester, pressboard,
 *     CTC, tank steel) are shown as "No established public reference" rather
 *     than invented numbers.
 *
 * Run: node build-materials.js
 */
'use strict';
const fs = require('fs');
function esc(s) { return String(s == null ? '' : s); }

const TODAY = new Date().toISOString().slice(0, 10);

// Copper / aluminium — verifiable LME reference; delay is inherent (reference,
// not a live feed). These are genuinely sourced.
const LME = 'https://www.lme.com/en/market-data/lme-reference-prices/lme-official-price';
const rows = [
  {
    material: 'Copper', grade: 'Cu-ETP / windings', market: 'LME', country: 'Global', region: 'Global',
    price: 14170, currency: 'USD', unit: 'USD / t', price_basis: '3-month official ring settlement (reference)',
    observation_date: '2026-08-20', source: 'LME official price', source_url: LME,
    retrieved_at: '2026-08-26', delay_type: 'REFERENCE', confidence: 'MEDIUM',
    notes: 'LME 3-month official ring settlement as a latest reference. Varies by day; verify against the LME official price before commercial use. Not a live feed.',
  },
  {
    material: 'Aluminium', grade: 'Al conductor / foil', market: 'LME', country: 'Global', region: 'Global',
    price: 3182, currency: 'USD', unit: 'USD / t', price_basis: '3-month official ring settlement (reference)',
    observation_date: '2026-08-20', source: 'LME official price', source_url: LME,
    retrieved_at: '2026-08-26', delay_type: 'REFERENCE', confidence: 'MEDIUM',
    notes: 'LME 3-month official ring settlement as a latest reference. Varies by day; verify against the LME official price before commercial use. Not a live feed.',
  },
  {
    material: 'CRGO / grain-oriented electrical steel', grade: 'GRADE NOT SPECIFIED', market: 'Various', country: '', region: '',
    price: null, currency: 'USD', unit: 'USD / MT', price_basis: 'NOT VERIFIED',
    observation_date: null, source: 'No established public reference', source_url: '',
    retrieved_at: TODAY, delay_type: 'HISTORICAL', confidence: 'LIMITED',
    notes: 'There is no single global CRGO exchange price. Price varies by market, grade (M-3/M-4/M-OH etc.), loss class, conventional vs Hi-B, domain refinement, thickness, width, coil/slit form, volume, commercial basis, tariffs, freight and delivery basis. No grade-, thickness- and basis-specific verified figure is available here, so no concrete number is shown. Unknown > incorrect.',
  },
  {
    material: 'Transformer oil (mineral)', grade: 'GRADE NOT SPECIFIED', market: 'Various', country: '', region: '',
    price: null, currency: 'USD', unit: 'USD / t', price_basis: 'NOT VERIFIED',
    observation_date: null, source: 'No established public reference', source_url: '',
    retrieved_at: TODAY, delay_type: 'HISTORICAL', confidence: 'LIMITED',
    notes: 'No public daily index for mineral transformer oil; price is negotiated. Shown as unavailable rather than invented.',
  },
  {
    material: 'Natural ester', grade: 'GRADE NOT SPECIFIED', market: 'Various', country: '', region: '',
    price: null, currency: 'USD', unit: 'USD / t', price_basis: 'NOT VERIFIED',
    observation_date: null, source: 'No established public reference', source_url: '',
    retrieved_at: TODAY, delay_type: 'HISTORICAL', confidence: 'LIMITED',
    notes: 'No public daily index for natural ester; price is negotiated and runs at a premium over mineral oil. Shown as unavailable rather than invented.',
  },
  {
    material: 'Pressboard / laminated pressboard', grade: 'GRADE NOT SPECIFIED', market: 'Various', country: '', region: '',
    price: null, currency: 'USD', unit: 'USD / kg', price_basis: 'NOT VERIFIED',
    observation_date: null, source: 'No established public reference', source_url: '',
    retrieved_at: TODAY, delay_type: 'HISTORICAL', confidence: 'LIMITED',
    notes: 'No public daily index for transformer pressboard; price is negotiated by grade and thickness. Shown as unavailable rather than invented.',
  },
  {
    material: 'Tank steel', grade: 'GRADE NOT SPECIFIED', market: 'Various', country: '', region: '',
    price: null, currency: 'USD', unit: 'USD / t', price_basis: 'NOT VERIFIED',
    observation_date: null, source: 'No established public reference', source_url: '',
    retrieved_at: TODAY, delay_type: 'HISTORICAL', confidence: 'LIMITED',
    notes: 'Mild steel plate for tanks; price is a general steel-market input, not a transformer-specific public index. Shown as unavailable rather than invented.',
  },
];
// Sort: sourced reference first, then unavailable.
rows.sort((a, b) => (a.price == null) - (b.price == null) || String(a.material).localeCompare(b.material));

const out = {
  $schema: 'https://transformerpath.com/materials.schema.json',
  generated: new Date().toISOString(),
  updated: TODAY,
  currency: 'USD',
  honesty_note: 'Copper and aluminium are the LME 3-month official ring settlement as latest REFERENCE (dated, sourced, not a live feed). CRGO, oil, ester, pressboard and tank steel have no established public daily index and are shown as unavailable/GRADE NOT SPECIFIED rather than invented. Unknown > incorrect.',
  materials: rows,
  // Backward-compatible row for the homepage / intel ticker (material-latest.js).
  latest_rows: rows.map((r) => ({
    id: r.material.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    name: r.material, unit: r.unit, value: r.price, value_display: (r.price == null ? '—' : '≈ ' + r.price.toLocaleString('en-US')),
    currency: r.currency, market: r.market, source: r.source, observation_date: r.observation_date || null,
    last_verified: r.retrieved_at, status: (r.price == null ? 'historical' : 'recent'),
    note: r.notes,
  })),
};
fs.writeFileSync('data/materials.json', JSON.stringify(out, null, 2));
// Regenerate materials-latest.json (backward-compat source for the homepage ticker).
const latest = {
  $schema: 'https://transformerpath.com/material-index.schema.json',
  updated: TODAY,
  currency: 'USD',
  note: out.honesty_note,
  rows: out.latest_rows.filter((r) => r.id === 'copper' || r.id === 'aluminium').map((r) => (Object.assign({}, r, { value_display: '≈ ' + r.value.toLocaleString('en-US') }))),
};
fs.writeFileSync('data/materials-latest.json', JSON.stringify(latest, null, 2));
console.log('materials.json wrote ' + rows.length + ' materials (' + rows.filter((r) => r.price != null).length + ' sourced reference, ' + rows.filter((r) => r.price == null).length + ' unavailable/GRADE NOT SPECIFIED)');
