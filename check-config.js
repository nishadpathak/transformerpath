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
// 404s, and the system/redirect stubs). "Transformer Equipments" is a stale
// legacy snapshot (old intel pages, _synctmp/, site-archive/, legacy mega-menu
// nav, "Elin" voice + long-dead claims) that must never be published; it is
// 404'd in netlify.toml and gitignored, so the gate ignores it too.
const SERVED_SKIP = ['archive', '_private', 'transformerpath-site', 'dist', 'node_modules', '.git', 'Transformer Equipments', 'manufacturers', 'projects', 'accessories', 'utilities', 'tenders', 'events', 'knowledge', 'media', 'markets', 'case-studies', 'topics', 'functions', 'vendor', 'viz'];
function servedHtml() {
  return fs.readdirSync('.').filter((f) => f.endsWith('.html') && !SERVED_SKIP.includes(f) && !/^intel-2026-/.test(f));
}

const problems = [];
const ok = [];
function check(label, pass, detail) {
  if (pass) ok.push(label);
  else problems.push(label + (detail ? ' :: ' + detail : ''));
}

const pages = servedHtml();
const pageContentMap = new Map();
pages.forEach((f) => {
  try { pageContentMap.set(f, fs.readFileSync(f, 'utf8')); } catch (e) {}
});

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
// Homepage "Industry pulse" metrics must show the canonical project/tender/award
// counts (from site-stats.json), not a hard-coded example.
check('index data-stat="projects" fallback = canonical', dataStatFallback(HOME, 'projects') === STATS.projects);
check('index data-stat="tenders" fallback = canonical', dataStatFallback(HOME, 'tenders') === STATS.tenders);
check('index data-stat="openTenders" fallback = canonical', dataStatFallback(HOME, 'openTenders') === STATS.openTenders);
check('index data-stat="awards" fallback = canonical', dataStatFallback(HOME, 'awards') === STATS.awards);

// manufacturers.html Dataset schema "size" (build_ssr now syncs it).
const MFG_PAGE = pages.find((p) => p === 'manufacturers.html') || 'manufacturers.html';
const mfgHtml = fs.readFileSync(MFG_PAGE, 'utf8');
const schemaSize = mfgHtml.match(/"size"\s*:\s*(\d+)/);
check('manufacturers.html schema size = config', schemaSize && +schemaSize[1] === CFG.counters.manufacturers,
  'schema says ' + (schemaSize && schemaSize[1]));

// No stale old-count text anywhere in served pages (520 / "census of 520"/etc).
const STALE_RE = /(\b520\b[^a-z]{0,20}(manufacturer|makers?|directory))|((census|worldwide census) of 520)|(\b546\b[^a-z]{0,20}(manufacturer|makers?|directory))|((census|worldwide census) of 546)|(546-manufacturer)/i;
pages.forEach((f) => {
  const s = pageContentMap.get(f) || '';
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

// ── 2b. Books — prices must equal config and checkout must be direct (or email fallback) ──
const BOOKS = fs.readFileSync('books.html', 'utf8');
const bp = CFG.pricing;
for (const [k, val] of Object.entries({
  bookDigitalV1: bp.bookDigitalV1, bookDigitalV2: bp.bookDigitalV2,
  bookBundleV1V2Digital: bp.bookBundleV1V2Digital, bookPrintV1: bp.bookPrintV1, bookPrintV2: bp.bookPrintV2,
})) {
  const key = k.replace(/^book/, '').replace(/([A-Z])/g, '_$1').toUpperCase();
  check('books.' + key + ' price = $' + val, new RegExp('\\$' + val + '\\b').test(BOOKS));
}
check('books page uses a checkout (Stripe links or email fallback), not a bare text form',
  /buy\.stripe|REPLACE_WITH_STRIPE|checkout|data-track="book_purchase"/.test(BOOKS));

// ── 2c. Supplier tiers (verified.html) must reflect config ────────────────
const VERIFIED = fs.readFileSync('verified.html', 'utf8');
check('verified.Verified = $' + bp.verifiedSupplier.price, new RegExp('\\$' + bp.verifiedSupplier.price + '\\b').test(VERIFIED));
check('verified.Supplier Pro = $' + bp.proVerifiedSupplier.price,
  new RegExp('\\$' + bp.proVerifiedSupplier.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',?') + '\\b').test(VERIFIED));
check('verified has Listed (free) tier', /<h2>Listed<\/h2>[\s\S]*?<div class="price">Free<\/div>/.test(VERIFIED));
check('verified has Founding offer', new RegExp('\\$' + bp.foundingVerified.price + '\\b').test(VERIFIED));

// ── 3. Intel cadence + classification ─────────────────────────────────────
const INTEL = fs.readFileSync('intel.html', 'utf8');
check('intel cadence label = config', new RegExp('\\b' + CFG.intel.cadenceLabel + '\\b', 'i').test(INTEL));
// No contradicting intel-feed cadence text (e.g. "updated hourly", "2×/day") on served
// intel/index pages. Legitimate other-cadence uses (LME hourly, "announced weekly", the
// "Weekly scan of technology" label) are excluded by matching only intel-cadence phrasing.
// The forbidden phrases are DERIVED from the configured cadence, not hard-coded.
// This block used to treat "hourly" as always wrong, which was true only while
// config said daily. netlify.toml now schedules refresh-data at "0 * * * *", so
// hourly is the correct claim and a "daily"/"weekly" claim is the contradiction.
const CADENCE_ALTERNATIVES = {
  hourly: ['daily', 'twice a day', 'twice daily', '2x/day', '2×/day', 'weekly', 'every morning'],
  daily: ['hourly', 'every hour', 'twice a day', 'twice daily', '2x/day', '2×/day', 'weekly'],
  weekly: ['hourly', 'every hour', 'daily', 'twice a day', 'twice daily'],
};
const WRONG_CADENCES = CADENCE_ALTERNATIVES[CFG.intel.cadence] || [];
const CADENCE_BAD = new RegExp(
  '(?:updated|refreshed)\\s+(?:' +
  WRONG_CADENCES.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
  ')', 'gi');
for (const f of ['intel.html', 'index.html']) {
  const txt = fs.readFileSync(f, 'utf8');
  if (CADENCE_BAD.test(txt)) {
    const m = txt.match(CADENCE_BAD);
    problems.push('intel-cadence-contradiction ' + f + ' :: ' + (m && m[0]));
  }
}
// Sitewide live-surface sweep for the same contradiction strings. Immutable dated
// Intel archives (intel-2026-*.html) are frozen historical snapshots and are
// excluded — their old copy is not a live claim. Legitimate negations ("not a
// live rate") are not matched by these patterns.
(function () {
  const fsx = require('fs');
  const pathx = require('path');
  const files = fsx.readdirSync('.').filter((f) => f.endsWith('.html'));
  files.forEach(function (f) {
    if (/^intel-2026-\d{2}-\d{2}\.html$/.test(f)) return; // frozen archive
    /* Only VISIBLE claims count. Reading raw HTML flagged a JS comment in
       jobs.html ("// ... (refreshed weekly)") that no visitor ever sees, and
       which describes the jobs board rather than the intel feed. Strip script
       blocks, style blocks and HTML comments before matching. */
    const txt = fsx.readFileSync(f, 'utf8')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');
    if (CADENCE_BAD.test(txt)) {
      const m = txt.match(CADENCE_BAD);
      problems.push('live-cadence-contradiction ' + f + ' :: ' + (m && m[0]));
    }
  });
})();
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
  const s = pageContentMap.get(f) || '';
  const text = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const cred = affirmCredClaim(text);
  if (cred) problems.push('voice-cert-claim ' + f + ' :: ' + cred);
  if (/\bELIN\b|\bpersonal\s+reference\b/i.test(text)) {
    const m = text.match(/\bELIN\b|\bpersonal\s+reference\b/i);
    problems.push('voice-elinstrict ' + f + ' :: ' + (m && m[0]));
  }
  // ── Commercial-architecture forbidden terminology (audit P0) ──────────
  // Public plan names must be Learning/Professional/Team. Reject old "Learner"
  // plan-tier and "$X/year" per-year billing phrasing on the public pricing
  // surface only (not intel data, not JS internals, not legitimate company/
  // business uses of "enterprise"). Standard/cert references (IEC, ISO, UL,
  // IEEE, CE, ANSI) and negations are allowed.
  const pricingSurface = /pricing\.html$/.test(f);
  const learnSurface = /learn\.html$/.test(f);
  if (pricingSurface || learnSurface) {
    const nodec = text; // text already has HTML comments stripped upstream
    // Learner as a standalone plan/heading word (exclude "individual learner — 1 seat").
    const learnerHeading = /\bLearner\b\s*(?:plan|tier)?\s*<\/|>Learner(?!\s*—\s*1 seat)/.test(nodec) || /<h\d[^>]*>\s*Learner\s*<\/h\d>/i.test(nodec);
    if (learnerHeading) problems.push('voice-commercial-terms ' + f + ' :: Learner plan tier');
    // Per-year billing phrasing on the surface (exclude JS PRICE vars / comments).
    if (/\$\d[\d,]*\s*\/\s*year\b/i.test(nodec)) {
      problems.push('voice-commercial-terms ' + f + ' :: per-year billing');
    }
    // Confirm the canonical names are all present.
    if (!/Learning/.test(nodec) || !/\bProfessional\b/.test(nodec) || !/\bTeam\b/.test(nodec)) {
      problems.push('voice-commercial-terms ' + f + ' :: missing canonical plan names');
    }
  }
}

// ── 4b. Trust / launch-day wording ─────────────────────────────────────────
// Guard against stale or overclaiming copy that sophisticated users notice.
//  - "accounts are being added" (stale account-launch framing) on the live FAQ.
//  - overclaimed credential phrasing on pricing/learn ("certificate per level",
//    "certificate badge", "completion certificate issued" as an affirmative
//    claim) — the honest position is a completion RECORD, never an accreditation.
//  - homepage "Today's / Read Today's Intel" framing (implies freshness the
//    curated feed cannot guarantee).
const TRUST_FILES = ['faq.html', 'pricing.html', 'learn.html', 'index.html'];
const staleAccount = /accounts are being added|accounts being added|Not today\./i;
// Overclaimed credential phrasing, negation-aware (a leading "no / not / not an"
// makes the phrase honest, so it must NOT be flagged).
function overCredClaim(text) {
  const re = /(certificate\s+(?:per\s+level|badge)|(?:completion|course[- ]?completion)\s+certificate\s+(?:issued|awarded)|issues?\s+(?:a\s+)?certificate)/gi;
  let m;
  while ((m = re.exec(text))) {
    // Walk back over the ~40 chars preceding and ~60 following for a negation,
    // and skip the FAQ question-verb form ("Do you issue a certificate of...").
    const beg = Math.max(0, re.lastIndex - m[0].length - 45);
    const ctx = (text.slice(beg, re.lastIndex + 60) || '').toLowerCase();
    if (/\bno\b|\bnot\b|\bnever\b|\bdoesn't\b|\bdo not\b|\bdo we\b|do you issue|does transformerpath|we do not|is not|are not\b/.test(ctx)) continue;
    return m[0];
  }
  return null;
}
const todayFrame = /Read Today('s|&#39;s)? Intel|Today('s|&#39;s)? Transformer Intel|read today('s|&#39;s)? intel\b|Today('s|&#39;s)? briefing\b|read today('s|&#39;s)? briefing\b/i;
for (const f of TRUST_FILES) {
  const t = pageContentMap.get(f) || (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  const strip = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (staleAccount.test(strip)) problems.push('voice-stale-account ' + f + ' :: stale account-launch framing');
  const cred = overCredClaim(strip);
  if (cred) problems.push('voice-overclaim-cert ' + f + ' :: ' + cred);
  if (todayFrame.test(strip)) problems.push('voice-todays-intel ' + f + ' :: ' + todayFrame.source);
}

// ── 5. Navigation structure ───────────────────────────────────────────────
// The header nav is the FLAT structure that replaced the five mega-menus
// (Intelligence / Industry / Engineering / Learn / Business): nine primary
// destinations reachable in one click, lower-priority items in a single "More"
// list, and a flat hamburger panel below 1024px. This guards against a
// regression BACK to nested dropdowns.
const NAV_HTML = pageContentMap.get('index.html') || fs.readFileSync('index.html', 'utf8');
const NAV_PRIMARY = ['intel.html', 'manufacturers.html', 'projects.html', 'tenders.html',
  'grids.html', 'events.html', 'learn.html', 'tools.html', 'rfq.html'];
for (const href of NAV_PRIMARY) {
  check('nav primary link ' + href, new RegExp('class="tpnav"[\\s\\S]{0,4000}?href="' + href.replace('.', '\\.') + '"').test(NAV_HTML));
}
check('nav has flat container', /class="tpnav"/.test(NAV_HTML));
check('nav has More list', /tpnav-more-panel/.test(NAV_HTML));
check('nav has Search', NAV_HTML.includes('href="search.html"'));
check('nav has Account', /href="workspace\.html"/.test(NAV_HTML));
check('nav has no mega-menu regression', !/nav-group-label/.test(NAV_HTML));

// ── 5b. Asset cache-busters + dark-theme default must match config ─────────
// CSS/JS version queries and the SW cache name come from data/config.json assets.
// They MUST match what's actually referenced on the served pages, otherwise
// browsers serve stale CSS/JS (the "not updated" symptom).
if (CFG.assets) {
  const CSSV = CFG.assets.css, JSV = CFG.assets.js, THEMEV = CFG.assets.theme, SWC = CFG.assets.sw;
  // Every served HTML page must reference the current CSS version.
  const SAMPLE = ['index.html', 'intel.html', 'manufacturers.html', 'learn.html'];
  let badCss = 0, badJs = 0, badTheme = 0;
  for (const f of pages) {
    const s = pageContentMap.get(f) || '';
    if (/style\.css\?v=\d+/.test(s) && !s.includes('style.css?v=' + CSSV)) badCss++;
    if (/tp-theme\.css\?v=\d+/.test(s) && !s.includes('tp-theme.css?v=' + THEMEV)) badTheme++;
  }
  check('all served pages reference style.css?v=' + CSSV, badCss === 0, badCss + ' pages stale');
  check('tool pages reference tp-theme.css?v=' + THEMEV, badTheme === 0, badTheme + ' pages stale');
  // Dark theme must be the CSS default on the html element (no light flash).
  let noDark = 0;
  for (const f of pages) {
    const raw = pageContentMap.get(f) || '';
    if (/<html[^>]*data-theme="dark"/.test(raw)) continue;
    // system/redirect stubs and non-nav pages are exempt
    if (/admin\.html|offline\.html|tutorial\.html|tx-design-masterclass\.html$/.test(f)) continue;
    if (/<html[^>]*lang="en"/.test(raw)) noDark++;
  }
  check('all served pages default to dark theme (data-theme="dark")', noDark === 0, noDark + ' pages light-flash');
  // SW cache name must match config.
  const SW = fs.readFileSync('sw.js', 'utf8');
  check('sw.js cache name = ' + SWC, SW.includes("const CACHE = '" + SWC + "'"));
}

// ── 5c. Strategic-route consistency (source → build → artifact gate) ───────
// Every route the audit flagged must, in its BUILT artifact, contain the current
// architecture and EXCLUDE the forbidden old architecture. This is the
// production-consistency gate: if a stale generation ever ships, the build fails
// instead of silently serving an old page to crawlers.
function routeCheck(route, req, forb, rawReqs) {
  let s = '';
  try { s = pageContentMap.get(route) || fs.readFileSync(route, 'utf8'); } catch (e) { problems.push('route-missing ' + route); return; }
  const text = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const head = text.slice(0, 4000);
  for (const r of (req || [])) {
    check(route + ' requires "' + r + '"', new RegExp(r, 'i').test(text));
  }
  for (const r of (rawReqs || [])) {
    check(route + ' requires (raw) "' + r + '"', new RegExp(r, 'i').test(s));
  }
  for (const f of (forb || [])) {
    if (new RegExp(f, 'i').test(head)) problems.push('route-stale ' + route + ' :: forbidden "' + f + '" found');
  }
}
// /pricing — canonical plans, single 12-month payments, no cert claims, no $/year.
routeCheck('pricing.html', ['Learning', 'Professional', 'Team', '\\$199', '\\$599', '\\$1,999', 'no auto-renewal', '12 months'],
  ['Learner\\s*(plan|tier)?\\s*<', 'Enterprise\\s*(plan|tier)?\\s*<', '\\$199\\s*/\\s*year', 'certificate per level', 'co-branded certificates?', 'capstone review \\+ certificate']);
// /for-manufacturers — neutral voice, no old claims, no old plan names.
routeCheck('for-manufacturers.html', [], ['we are not FEM', 'we would rather tell you', 'instead of us', 'co-branded certificates?', '\\bLearner\\b\\s*(plan|tier)?\\s*<']);
// FEM article + repository-wide 10-15% accuracy claim.
routeCheck('article-fem-vs-analytical.html', ['accuracy depends materially on transformer type, geometry'], ['10[\\s\\u2013-]?15\\s*%']);
for (const f of pages) {
  const s = (pageContentMap.get(f) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (/10[\s\u2013-]?15\s*%\s+of an? (optimised|optimized) works design/i.test(s)) {
    problems.push('route-stale ' + f + ' :: 10-15% works-design claim');
  }
}
// Books — first releases, direct checkout, no email-only ordering.
routeCheck('books.html', ['first releases'], ['Email to order', 'Two volumes of transformer engineering'], ['data-buy=']);
// Design Duel SSR — values must be present in crawlable HTML.
routeCheck('design.html', ['72 kW', '355 kW', '215 t'], ['id="sp-nll"></', 'id="sp-ll"></']);
// Footer — no "networking" positioning.
for (const f of pages) {
  const s = (pageContentMap.get(f) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (/global (intelligence|information) and networking platform/i.test(s)) problems.push('route-stale ' + f + ' :: footer "networking"');
}

// ── 5d. Navigation + manufacturer-neutrality regression (confirmed defects) ──
// The flat-nav migration must never regress to the five-category mega-menu, and
// the manufacturer directory must stay neutral (find/filter/compare, never
// "declare winners"). Both guard P0 defects found in production trust QA.
let megaNav = 0, rankClaim = 0;
for (const f of pages) {
  const raw = pageContentMap.get(f) || '';
  if (/<nav class="nav-links"[^>]*>/.test(raw)) megaNav++;
  if (/ranked global leaders|strongest manufacturers|declare (a|the) (dominant )?winner(s)?/i.test(raw)) rankClaim++;
}
check('no served page uses the legacy mega-menu nav', megaNav === 0, megaNav + ' page(s)');
check('no served page ranks manufacturers ("global leaders"/"strongest")', rankClaim === 0, rankClaim + ' page(s)');

// ── 6. Build the regression report ────────────────────────────────────────
if (problems.length) {
  console.error('CONFIG CHECK FAILED — ' + problems.length + ' issue(s):');
  problems.forEach((p) => console.error('  ✗ ' + p));
  process.exitCode = 1;
} else {
  console.log('CONFIG CHECK OK — ' + ok.length + ' assertions passed; config, counters, pricing, intel and voice all consistent.');
}
