#!/usr/bin/env node
/* build-implementation-matrix.js — P0 audit before building.
 *
 * Records the CURRENT STATE of every stated surface against the sprint goals,
 * so the build work proceeds from evidence, not assumption. This is a READ-ONLY
 * snapshot of the checked-in source + generated data at the point of audit.
 *
 * Every row: feature / current_state / working? / data_source / production_state /
 *             issue / action.
 *
 * "No better than UNKNOWN" is the audit's own honesty rule: it only records a
 * working/architecture state that is actually present in source; it does not
 * assert anything about a live environment it cannot verify.
 *
 * Run: node build-implementation-matrix.js
 * Output: data/implementation-matrix.json
 */
'use strict';
const fs = require('fs');

function exists(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }

const maze = [];
function row(feature, state, working, source, production, issue, action) {
  maze.push({ feature, current_state: state, working, data_source: source, production_state: production, issue, action });
}

// ── Freshness / data truth ────────────────────────────────────────────────
row('Intel freshness readout',
  'data/freshness.json with 6 surfaces; intel.html shows last_build + cadence',
  'YES', 'build-freshness.js', 'ships in sitemap',
  'Surfaces carry last_build/last_data_refresh/source_health but NOT the P0 full set (last_attempted_refresh, last_successful_refresh, latest_source_observation, records_added/updated, source_count, source_failures, status).',
  'Extend build-freshness.js to emit the full per-dataset refresh metadata set; add truthful source-health statuses.');
row('Source-health page',
  'admin.html has a Source Health card (renders per-surface cadence/dates). No dedicated /admin/source-health page.',
  'PARTIAL', 'data/freshness.json', 'admin only (noindex)',
  'No public/dedicated source-health surface; statuses not per-source (only per-surface).',
  'Build /admin/source-health with per-source rows (name/type/region/last_checked/last_success/latest_content_date/failure_count/status).');
row('Public truthfulness of liveliness claims',
  'intel.html & faq.html say refreshed daily (curated) + separate auto-briefing cache. No "live" claim.',
  'YES', 'build-freshness.js / manual', 'ships (intel)',
  'Good — no false LIVE/HOURLY claims. Materials footers can still read "reference" not "live".',
  'Keep truthful cadence; ensure materials use LATEST MARKET REFERENCE everywhere.');

// ── Materials ─────────────────────────────────────────────────────────────
row('Materials index (/materials)',
  'Transformer Materials Intelligence; 7 materials with provenance; CRGO monitor link.',
  'YES', 'data/materials.json (build-materials.js)', 'ships, in sitemap',
  'Price records use price_basis/delay_type/confidence rather than the P0 terms basis/freshness_status.',
  'Align material record schema to P0 (material/grade/market/country/region/price/currency/unit/basis/observation_date/source/source_url/retrieved_at/freshness_status).');
row('CRGO monitor (/materials/crgo)',
  'Explains no single global price; GRADE NOT SPECIFIED table.',
  'YES', 'build-materials-pages.js', 'ships, in sitemap',
  'Market/grade table is qualitative (no rows where no verified figure exists).',
  'Keep honest; do not invent rows. Add trend/source columns only where a verified observation exists.');
row('Material history (30d/90d/1y trend)',
  'Not present — only a single latest reference per material.',
  'NO', 'none', 'n/a',
  'No multi-observation history stored, so no trend computed.',
  'Only compute trends where enough dated observations exist; never fabricate missing history. Requires an observation store.');
row('Connect materials to calculator',
  'Calculator BOM uses fixed "indicative supply-only USD" default prices, editable by user. No market-reference link.',
  'PARTIAL', 'calculator.html (hardcoded)', 'ships',
  'No distinction between MARKET REFERENCE / USER PRICE / DEFAULT ASSUMPTION; no observation-date/source shown for BOM prices.',
  'Add a provenance tri-state with source+date per price; never silently overwrite user inputs.');
row('BOM cost movement (baseline vs current)',
  'Not present.',
  'NO', 'none', 'n/a',
  'No baseline save or indicative movement calc.',
  'Add SAVE BOM BASELINE → INDICATIVE MATERIAL COST MOVEMENT (never labelled actual selling-price change).');

// ── Learn / engineering depth ─────────────────────────────────────────────
row('Course depth audit',
  '26 chapters audited; 6 DEPTH_FLAG (11,14,16,17,23,24).',
  'YES', 'build-course-depth.js / data/course-depth.json', 'tracked data',
  'Flags exist; chapters not yet deepened.',
  'Deepen flagged chapters with real content (not count inflation).');
row('Engineering-claim classification',
  '193 pieces; knowledge layer 100% normed; 4 masterclass ch (1,7,23,25) flagged ENGINEERING_REVIEW_REQUIRED.',
  'YES', 'build-engineering-claims.js / data/engineering-claims.json', 'tracked data',
  'Register confirms normed coverage and a 4-chapter review queue.',
  'Route flags to human engineering review; do NOT guess-fix.');
row('Technical figure standard + SVG set',
  'Masterclass uses inline SVG diagrams (22) + 48 tables; no unified Technical Figure Standard; buyers-guide/index use emoji icons.',
  'PARTIAL', 'masterclass.html (static)', 'ships',
  'No pro-drawing standard; emoji icons violate the standard.',
  'Author TRANSFORMERPATH TECHNICAL FIGURE STANDARD + first high-value SVG set (core/step-lap/winding/insulation/leakage/impulse).');

// ── Directory / supply chain ──────────────────────────────────────────────
row('Shared entity model',
  'manufacturers.json keyed by country (country -> [makers]); accessories.json has categories+suppliers; none is a canonical Company entity spanning categories.',
  'PARTIAL', 'data/manufacturers.json, data/accessories.json', 'ships',
  'No single Company entity; a company in several categories would be duplicated. This is the core P2 gap.',
  'Introduce a shared Company entity (researched facts vs company-provided) referenced by category directories — never duplicate.');
row('Component directory',
  'components.html has 8 hardcoded COMPONENTS categories (inline const, no shared data file).',
  'PARTIAL', 'components.html (inline)', 'ships',
  'Data is inline, not a canonical directory source; categories limited to 8 top-level.',
  'Move to a canonical components data file; add structured subcategories (bushings, OLTC/DETC, radiators, fans, pumps, Buchholz, PRD, CTs, marshalling, etc.).');
row('Testing/diagnostics/software/services/test-lab directories',
  'Not built as a categories architecture.',
  'NO', 'none', 'n/a',
  'The high-value B2B/testing surface is absent.',
  'Add shared directory categories for testing, software, services, test labs — only where credible; never infer accreditation/capability.');
row('Directory search',
  'search.html exists; no unified INDUSTRY DIRECTORY SEARCH with the stated filters.',
  'PARTIAL', 'search.html / company data', 'ships',
  'Search is not a bounded directory search with category/capability/country filters and explicit FEATURED/SPONSORED labels.',
  'Build a single directory search that never ranks paid > factual; label promotional placements.');

// ── Platform integrity (already good — confirm, do not rebuild) ──────────
row('Build gates',
  'DATA QUALITY 0 critical · CONFIG CHECK 65 assertions · 0 broken links (2811 targets).',
  'YES', 'check-data-quality/check-config/check-links', 'chain',
  'All green.',
  'Preserve every build; run full chain after each unit.');
row('Account workflow (follow/save)',
  'workspace.html + supabase.js expose TP.saveItem/TP.follow/listSaved/listFollows; Supabase URL+anon key configured.',
  'PARTIAL', 'supabase.js / workspace.html', 'account layer (needs live Supabase)',
  'follow/save exist; compare and alerts do NOT.',
  'Add compare + alerts; complete follow--save--compare--RFQ--alert. Supabase service key stays creds-blocked.');

module.exports = { row, maze, exists };
if (require.main === module) {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/implementation-matrix.json', JSON.stringify({
    $schema: 'https://transformerpath.com/implementation-matrix.schema.json',
    generated: new Date().toISOString(),
    note: 'P0 audit before building. READ-ONLY snapshot of checked-in source + generated data. Does not assert anything about a live environment it cannot verify. UNKNOWN > INCORRECT.',
    sections: {
      freshness: maze.filter((r) => /freshness|intel|source-health|data truth/i.test(r.feature)),
      materials: maze.filter((r) => /material|BOM|CRGO|calculator/i.test(r.feature)),
      learning: maze.filter((r) => /depth|claim|figure|drawing|review/i.test(r.feature)),
      directory: maze.filter((r) => /entity|component|directory|testing|software|service/i.test(r.feature)),
      integrity: maze.filter((r) => /gate|account|workflow/i.test(r.feature)),
    },
    rows: maze,
  }, null, 2) + '\n');
  console.log('implementation-matrix: ' + maze.length + ' rows. data/implementation-matrix.json written.');
}
