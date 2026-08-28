#!/usr/bin/env node
/* TransformerPath config regression guard.
 *
 * Reads the SINGLE source of truth (data/config.json) and verifies that the
 * generated/public site actually matches it, so the constants listed in the
 * master brief cannot silently drift. Fails (exit 1) on any mismatch that
 * would publish a contradiction to production.
 *
 * Run after every build: `node check-config.js`
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CFG = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));

// Whittle down to served files (skip gitignored/stale dirs the Netlify build
// 404s, and the system/redirect stubs).
const SERVED_SKIP = ['archive', '_private', 'transformerpath-site', 'node_modules', '.git'];
function servedHtml() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      if (SERVED_SKIP.includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) out.push(p);
    }
  })('.');
  return out;
}

const problems = [];
const ok = [];
function check(label, pass, detail) {
  if (pass) ok.push(label);
  else problems.push(label + (detail ? ' :: ' + detail : ''));
}

const pages = servedHtml();

// ── 1. Counters must agree with config everywhere they appear ─────────────
const MFG = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const realMakers = MFG.reduce((a, g) => a + g.makers.filter((m) => !/^Served by/i.test(m[0])).length, 0);
const mfgCountries = MFG.filter((g) => g.makers.some((m) => !/^Served by/i.test(m[0]))).length;

check('census.manufacturers matches config', realMakers === CFG.counters.manufacturers,
  'DB says ' + realMakers + ', config says ' + CFG.counters.manufacturers);
check('census.manufacturingCountries matches config', mfgCountries === CFG.counters.manufacturingCountries,
  'DB says ' + mfgCountries + ', config says ' + CFG.counters.manufacturingCountries);

// site-stats.json is the client-side counter source of truth.
const STATS = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
check('site-stats.manufacturers matches config', STATS.manufacturers === CFG.counters.manufacturers,
  String(STATS.manufacturers));
check('site-stats.manufacturingCountries matches config', STATS.manufacturingCountries === CFG.counters.manufacturingCountries,
  String(STATS.manufacturingCountries));
check('site-stats.countries matches config', STATS.countries === CFG.counters.gridCountries, String(STATS.countries));
check('site-stats.gridOperators matches config', STATS.gridOperators === CFG.counters.gridOperators, String(STATS.gridOperators));
check('site-stats.events matches config', STATS.events === CFG.counters.events, String(STATS.events));

// The homepage KPI hero data-stat fallbacks must equal config.
const HOME = fs.readFileSync('index.html', 'utf8');
function dataStatFallback(html, key) {
  const m = html.match(new RegExp('data-stat="' + key + '">\\s*(\\d+)'));
  return m ? +m[1] : null;
}
check('index data-stat="manufacturers" fallback = config',
  dataStatFallback(HOME, 'manufacturers') === CFG.counters.manufacturers);
check('index data-stat="manufacturingCountries" fallback = config',
  dataStatFallback(HOME, 'manufacturingCountries') === CFG.counters.manufacturingCountries);
check('index data-stat="countries" fallback = config',
  dataStatFallback(HOME, 'countries') === CFG.counters.gridCountries);

// manufacturers.html Dataset schema "size" (build_ssr now syncs it).
const MFG_PAGE = pages.find((p) => p === 'manufacturers.html') || 'manufacturers.html';
const mfgHtml = fs.readFileSync(MFG_PAGE, 'utf8');
const schemaSize = mfgHtml.match(/"size"\s*:\s*(\d+)/);
check('manufacturers.html schema size = config', schemaSize && +schemaSize[1] === CFG.counters.manufacturers,
  'schema says ' + (schemaSize && schemaSize[1]));

// No stale old-count text anywhere in served pages (520 / "census of 520"/etc).
const STALE_RE = /(\b520\b[^a-z]{0,20}(manufacturer|makers?|directory))|((census|worldwide census) of 520)/i;
pages.forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  if (STALE_RE.test(s)) {
    const m = s.match(STALE_RE);
    problems.push('stale-count ' + f + ' :: ' + m[0]);
  }
});

// ── 2. Pricing must match config everywhere it appears ────────────────────
function hasPrice(html, amount) {
  // match $199 / $599 / $1,999-style renditions
  const re = new RegExp('\\$' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',?') + '\\b');
  return re.test(html);
}
const PRICING = fs.readFileSync('pricing.html', 'utf8');
const plans = CFG.pricing.plans;
for (const [name, plan] of Object.entries(plans)) {
  check('pricing.' + name + ' price = $' + plan.price, hasPrice(PRICING, plan.price));
  // must mention no auto-renewal for the paid tiers
}
check('pricing mentions no auto-renewal', /no auto-renewal/i.test(PRICING));
// Every paid plan must say it is a single 12-month payment (no recurring).
const planText = PRICING.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
for (const [name, plan] of Object.entries(plans)) {
  check('pricing.' + name + ' is single payment / 12 months',
    new RegExp('\\$' + plan.price + '.*?12 months', 'i').test(planText) || /12 months/.test(planText));
}

// Pricing schema (AggregateOffer) low/high must equal config.
const offer = PRICING.match(/"lowPrice"\s*:\s*"(\d+)"/);
const offerHi = PRICING.match(/"highPrice"\s*:\s*"(\d+)"/);
check('pricing schema lowPrice = config', offer && +offer[1] === Math.min(...Object.values(plans).map((p) => p.price)));
check('pricing schema highPrice = config', offerHi && +offerHi[1] === Math.max(...Object.values(plans).map((p) => p.price)));

// ── 3. Intel cadence + classification ─────────────────────────────────────
const INTEL = fs.readFileSync('intel.html', 'utf8');
check('intel cadence label = config', new RegExp('\\b' + CFG.intel.cadenceLabel + '\\b', 'i').test(INTEL));
// No contradicting intel-feed cadence text (e.g. "updated hourly", "2×/day") on served
// intel/index pages. Legitimate other-cadence uses (LME hourly, "announced weekly", the
// "Weekly scan of technology" label) are excluded by matching only intel-cadence phrasing.
const CADENCE_BAD = /(updated\s+(?:hourly|2×\/day|2x\/day|every\s+hour))|(\bHourly\b\s+global\s+briefing)|(<b>\s*Hourly\s*<\/b>)/gi;
for (const f of ['intel.html', 'index.html']) {
  const txt = fs.readFileSync(f, 'utf8');
  if (CADENCE_BAD.test(txt)) {
    const m = txt.match(CADENCE_BAD);
    problems.push('intel-cadence-contradiction ' + f + ' :: ' + (m && m[0]));
  }
}
for (const c of CFG.intel.classificationLevels) {
  check('intel classification level ' + c + ' present', INTEL.includes(c));
}
// Freeze rule: dated historical editions must NOT dynamically inject today's feed.
// loadBriefing() is the LIVE-feed injector; if a dated page *calls* it (rather
// than merely declaring the async function), it would repopulate a historical
// page with today's items. Strip the declaration, then look for a real call.
const HIST = fs.readdirSync('.').filter((f) => /^intel-2026-/.test(f) && f.endsWith('.html'));
for (const f of HIST) {
  const s = fs.readFileSync(f, 'utf8');
  const declStripped = s.replace(/(?:async\s+)?function\s+loadBriefing\s*\([^)]*\)\s*\{[\s\S]*?\n\}/g, '');
  const callRe = /(?:^|[^a-zA-Z0-9_$])loadBriefing\s*\(/g;
  if (callRe.test(declStripped)) {
    problems.push('frozen-intel-not-frozen ' + f + ' (calls loadBriefing)');
  }
}
check('historical intel editions are frozen (no live loadBriefing call)', problems.filter((p) => p.startsWith('frozen-intel')).length === 0);

// ── 4. Voice / compliance ────────────────────────────────────────────────
// Only flag AFFIRMATIVE educational-credential claims. Allow:
//  - negations ("not an accredited qualification", "no qualification")
//  - technical uses (seismic qualification, tender/supplier prequalification)
function affirmCredClaim(text) {
  // Only flag affirmative claims with a 30-char prefix that is NOT a negation.
  const re = /(.{0,30}?)(accredited\s+(?:course|programme|program|learning|qualification|track))|(official\s+(?:qualification|certificate))|(certif(?:y|ies|ied)\s+you)|(we\s+(?:are|offer)\s+an?\s+accredited)/gi;
  let m;
  while ((m = re.exec(text))) {
    const pre = (m[1] || '').toLowerCase();
    if (/\bnot\b|\bno\b|\bnever\b|\bdoesn't\b|\bdo not\b|not\s+an?\b/.test(pre)) continue;
    return m[0];
  }
  return null;
}
for (const f of pages) {
  const s = fs.readFileSync(f, 'utf8');
  const text = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const cred = affirmCredClaim(text);
  if (cred) problems.push('voice-cert-claim ' + f + ' :: ' + cred);
  if (/\bELIN\b|\bpersonal\s+reference\b/i.test(text)) {
    const m = text.match(/\bELIN\b|\bpersonal\s+reference\b/i);
    problems.push('voice-elinstrict ' + f + ' :: ' + (m && m[0]));
  }
}

// ── 5. Navigation structure ───────────────────────────────────────────────
// The header nav must use the grouped INTELLIGENCE/INDUSTRY/ENGINEERING/LEARN/
// BUSINESS structure with Search + Account, and never regress to the flat list.
const NAV_LABELS = ['Intelligence', 'Industry', 'Engineering', 'Learn', 'Business'];
const NAV_HTML = fs.readFileSync('index.html', 'utf8');
for (const lbl of NAV_LABELS) {
  check('nav group "' + lbl + '" present', NAV_HTML.includes('nav-group-label">' + lbl));
}
check('nav has Search', NAV_HTML.includes('href="search.html"'));
check('nav has Account', NAV_HTML.includes('href="workspace.html">Account'));

// ── 6. Build the regression report ────────────────────────────────────────
if (problems.length) {
  console.error('CONFIG CHECK FAILED — ' + problems.length + ' issue(s):');
  problems.forEach((p) => console.error('  ✗ ' + p));
  process.exitCode = 1;
} else {
  console.log('CONFIG CHECK OK — ' + ok.length + ' assertions passed; config, counters, pricing, intel and voice all consistent.');
}
