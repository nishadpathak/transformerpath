#!/usr/bin/env node
/* build-company-pages.js — per-manufacturer entity pages (the relationship graph).
 *
 * Builds ONE page per transformer manufacturer in the census, at
 * /manufacturers/<company>/ — an independent industry-database entry, not a
 * company impersonation. Each page assembles:
 *   - identity (country, city, region) + official website + verification status
 *   - transformer capabilities (types) + tier enrichments (MVA/kV/regions/certs/source)
 *   - RELATED COMPONENTS / APPLICATIONS / MARKET / COUNTRY (auto from type+country)
 *   - latest TransformerPath Intel (region/country-matched) + upcoming events
 *   - a conservative Organization/WebPage/Breadcrumb schema (never asserts
 *     ownership/affiliation; the official URL is referenced, not claimed)
 *   - RFQ + "claim your profile" conversion loop
 *
 * Indexability tier (protects domain quality):
 *   Tier A/B (index,follow) — has a real website URL.  Tier C (noindex,follow) —
 *   no URL, i.e. a directory row with no externally corroborating web presence.
 * Run: node build-company-pages.js  (part of the Netlify build command, BEFORE build-seo).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = function (s) { return (s || '').toLowerCase(); };
const norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const STATS = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const CS = require('./data/site-stats.json');
// Company → Brand → Site inventory (internal; grouped by shared website).
const SITES = JSON.parse(fs.readFileSync('data/manufacturer-sites.json', 'utf8'));
function normUrl(u) { return String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase().trim(); }
const SITE_GROUP = {};
SITES.forEach(function (g) { SITE_GROUP[normUrl(g.url)] = g; });
// Company-specific, sourced developments from TransformerPath Daily Intel.
const DEVELOPMENTS = JSON.parse(fs.readFileSync('data/company-developments.json', 'utf8'));
const DEV_BY_NAME = {};
DEVELOPMENTS.forEach(function (d) { DEV_BY_NAME[norm(d.name)] = d; });
const COMPONENTS = { 'transformer-bushings': 'Transformer bushings', 'on-load-tap-changers': 'On-load tap changers', 'transformer-cooling': 'Cooling systems', 'insulation-materials': 'Insulation materials', 'conductors-and-core': 'Conductors & core steel', 'oil-fluids-preservation': 'Oil & preservation', 'protection-monitoring': 'Protection & monitoring', 'tank-and-mechanical': 'Tank & mechanical' };
const APPS = { 'utilities-grid': 'Utilities & Grid', 'renewables': 'Renewable Energy', 'data-centres': 'Data Centres', 'hvdc': 'HVDC & Converters', 'solar': 'Solar PV', 'bess': 'Battery Storage', 'offshore-wind': 'Offshore Wind', 'mining-metals': 'Mining & Metals', 'oil-gas': 'Oil, Gas & Energy', 'railways': 'Railways & Metro', 'cement-industrial': 'Cement & Industrial' };

// type -> related components / applications
const TYPE_COMPS = { PT: ['transformer-bushings', 'on-load-tap-changers', 'transformer-cooling', 'insulation-materials', 'protection-monitoring'], DT: ['transformer-bushings', 'transformer-cooling', 'oil-fluids-preservation', 'conductors-and-core'], DRY: ['insulation-materials', 'transformer-cooling', 'conductors-and-core'] };
const TYPE_APPS = { PT: ['utilities-grid', 'hvdc', 'renewables'], DT: ['data-centres', 'renewables', 'utilities-grid'], DRY: ['data-centres', 'renewables', 'railways'] };

// manufacturer country (census name) -> market hub slug (only where a hub exists)
const COUNTRY_MARKET = { 'uae': 'uae', 'united arab emirates': 'uae', 'saudi arabia': 'saudi-arabia', 'india': 'india', 'china': 'china', 'usa': 'usa', 'united states': 'usa', 'germany': 'germany', 'türkiye': 'turkiye', 'turkey': 'turkiye', 'brazil': 'brazil', 'vietnam': 'vietnam', 'south korea': 'south-korea', 'korea': 'south-korea', 'japan': 'japan', 'italy': 'italy', 'france': 'france', 'spain': 'spain', 'netherlands': 'netherlands', 'poland': 'poland', 'sweden': 'sweden', 'chile': 'chile', 'colombia': 'colombia', 'peru': 'peru', 'taiwan': 'taiwan', 'czechia': 'czechia', 'norway': 'norway', 'venezuela': 'venezuela', 'finland': 'finland', 'nigeria': 'nigeria', 'argentina': 'argentina', 'egypt': 'egypt', 'bulgaria': 'bulgaria', 'austria': 'austria', 'romania': 'romania', 'uzbekistan': 'uzbekistan', 'canada': 'canada', 'mexico': 'mexico', 'south africa': 'south-africa', 'indonesia': 'indonesia', 'thailand': 'thailand', 'pakistan': 'pakistan', 'united kingdom': 'united-kingdom' };
const COUNTRY_ALIAS = { 'türkiye': 'turkey', 'turkey': 'türkiye', 'uae': 'united arab emirates', 'united arab emirates': 'uae', 'usa': 'united states', 'united states': 'usa' };

function tierFor(name) { const n = norm(name); return TIERS.find(function (t) { return norm(t.name) === n; }); }
// country -> country-page slug (census naming), with aliases for tier-added companies.
const COUNTRY_PAGE = { 'usa': 'usa', 'united states': 'usa', 'united states of america': 'usa', 'usa (united states)': 'usa', 'türkiye': 'turkiye', 'turkey': 'turkiye', 'uae': 'uae', 'united arab emirates': 'uae' };
MANUF.forEach(function (g) { COUNTRY_PAGE[ci(g.country)] = slugify(g.country); });
function pageSlugFor(country) { const k = ci(country); if (COUNTRY_PAGE[k]) return COUNTRY_PAGE[k]; return country && MANUF.some(function (g) { return ci(g.country) === k; }) ? slugify(country) : ''; }

// ── Assemble company records ──
const records = {}; const seen = {};
MANUF.forEach(function (g) {
  g.makers.forEach(function (x) {
    if (/^Served by/i.test(x[0])) return; // not a company
    const name = x[0].trim(); const key = norm(name);
    if (seen[key]) return; // dedupe across countries (keep first)
    seen[key] = 1;
    const types = String(x[3] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    records[key] = { name: name, country: g.country, region: g.region, flag: g.flag, city: x[1] || '', url: x[2] || '', types: types, flagV: x[4] || '', established: x[5] || '', tierFile: tierFor(name), listed: true };
  });
});
// Add the documented global leaders (manufacturer-tiers.json) that aren't a census
// maker under that exact name, so every sufficiently-documented company has a page.
function tierTypes(ts) { const map = { power: 'PT', distribution: 'DT', dry: 'DRY', 'dry-type': 'DRY', cast: 'DRY', 'cast-resin': 'DRY' }; return (ts || []).map(function (t) { return map[ci(t)]; }).filter(Boolean); }
TIERS.forEach(function (t) {
  const key = norm(t.name);
  if (seen[key]) return; // already a census record
  seen[key] = 1;
  const rec = MANUF.find(function (g) { return ci(g.country) === ci(t.country); });
  const r = { name: t.name, country: t.country || 'Global', region: rec ? rec.region : 'Europe', flag: rec ? rec.flag : '', city: '', url: t.site || '', types: tierTypes(t.types).length ? tierTypes(t.types) : ['PT', 'DT'], flagV: '', established: '', tierFile: t, listed: true };
  records[key] = r;
});

function typeBadge(t) { return { PT: 'Power', DT: 'Distribution', DRY: 'Dry-type' }[t] || t; }
// Brand sites (grouped by shared website). Rendered only for multi-site brands,
// and ONLY as a site inventory — never as a claim that a site is a factory.
function brandSitesHtml(r) {
  const grp = r.url ? SITE_GROUP[normUrl(r.url)] : null;
  if (!grp || grp.siteCount <= 1) return '';
  const own = grp.sites.filter(function (s) { return s.name === r.name; });
  const others = grp.sites.filter(function (s) { return s.name !== r.name; });
  const list = others.length ? others : grp.sites; // if this is the canonical row, list them all
  const items = list.map(function (s) {
    const prods = (s.products || []).map(function (t) { return '<span class="tpill">' + esc(typeBadge(t)) + '</span>'; }).join(' ');
    return '<tr><td style="padding:6px 10px;vertical-align:top"><b style="color:var(--text)">' + esc(s.name) + '</b><br><span style="color:var(--muted);font-size:.82rem">' + esc(s.city || '—') + ', ' + esc(s.country) + '</span></td>' +
      '<td style="padding:6px 10px;vertical-align:top">' + (prods || '<span style="color:var(--muted)">—</span>') + '</td>' +
      '<td style="padding:6px 10px;vertical-align:top"><span style="font-size:.74rem;color:var(--muted)">Unclassified</span></td></tr>';
  }).join('');
  return '<h2>Sites &amp; locations</h2><p style="font-size:.82rem;color:var(--muted)">TransformerPath lists the sites it has in its census for this brand. It does <b>not</b> classify whether each is a manufacturing plant, office or service centre without independent confirmation.</p>' +
    '<table class="tbl"><tbody>' + items + '</tbody></table>';
}
// Sourced, company-specific developments (orders, expansions, acquisitions,
// rebrands) pulled from TransformerPath Daily Intel — linked to their sources.
function developmentsHtml(r) {
  const d = DEV_BY_NAME[norm(r.name)];
  if (!d || !d.developments || !d.developments.length) return '';
  const lis = d.developments.map(function (x) {
    const dateMatch = String(x.src || '').match(/(\d{1,2}\s+\w{3}\s+\d{4})/);
    const date = dateMatch ? dateMatch[1] : '';
    return '<li style="margin:7px 0"><a href="' + esc(x.url) + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">' + esc(x.title) + '</a><br>' +
      '<span style="color:var(--muted);font-size:.82rem">' + esc(x.src || '') + '</span></li>';
  }).join('');
  return '<h2>Recent developments</h2><p style="font-size:.82rem;color:var(--muted)">Sourced from TransformerPath Daily Intel. An item is shown because it <b>references</b> this company — it is not an independently verified award, order or project attribution.</p>' +
    '<ul>' + lis + '</ul>';
}
function eventsFor(rec) {
  const now = new Date(); const alias = COUNTRY_ALIAS[ci(rec.country)] || rec.country;
  return EVENTS.filter(function (ev) { return ci(ev.co) === ci(rec.country) || ci(ev.co) === ci(alias); })
    .filter(function (ev) { return new Date(ev.e) >= now; })
    .sort(function (a, b) { return String(a.s).localeCompare(String(b.s)); }).slice(0, 5);
}
function intelFor(rec) {
  const regions = { 'Middle East': 'GCC', 'Europe': 'Europe', 'Americas': 'USA', 'Asia': 'India', 'South Asia': 'India', 'East Asia': 'RoW', 'Southeast Asia': 'RoW', 'Eurasia': 'RoW', 'Africa': 'RoW', 'Latin America': 'RoW', 'Oceania': 'RoW' };
  const reg = INTEL[regions[rec.region] || 'RoW']; const out = [];
  if (reg && reg.items) {
    const kw = ci(rec.country).split(/[^a-z]+/).filter(function (w) { return w.length > 3; }).concat([ci(rec.country).replace(/\s+/g, ' ')]);
    reg.items.forEach(function (it) { if (kw.some(function (k) { return k && ci(it.title + ' ' + it.snippet).indexOf(k) >= 0; })) out.push(it); });
  }
  return out.slice(0, 3);
}
const fmt = function (d) { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

function page(r, slug) {
  const tier = r.tierFile;
  const indexable = !!r.url;
  const robots = indexable ? 'index,follow' : 'noindex,follow';
  const url = 'https://transformerpath.com/manufacturers/' + slug + '/';
  // capabilities: union of type + tier fields
  const typeHtml = (r.types.length ? r.types : ['DT']).map(function (t) { return '<span class="tpill">' + esc(typeBadge(t)) + '</span>'; }).join(' ');
  const comps = [...new Set((r.types.length ? r.types : ['DT']).reduce(function (a, t) { return a.concat(TYPE_COMPS[t] || []); }, []))];
  const compLinks = comps.map(function (c) { return '<a class="tpill" href="../../components/' + c + '.html">' + esc(COMPONENTS[c] || c) + '</a>'; }).join(' ');
  const apps = [...new Set((r.types.length ? r.types : ['DT']).reduce(function (a, t) { return a.concat(TYPE_APPS[t] || []); }, []))];
  const appLinks = apps.map(function (a) { return '<a class="tpill" href="../../applications/' + a + '.html">' + esc(APPS[a] || a) + '</a>'; }).join(' ');
  const marketSlug = COUNTRY_MARKET[ci(r.country)];
  const marketLink = marketSlug ? '<a class="tpill" href="../../markets/' + marketSlug + '/">' + esc(r.country) + ' market</a>' : '';
  const countrySlug = pageSlugFor(r.country);
  const countryPageExists = countrySlug && fs.existsSync('manufacturers/' + countrySlug + '.html');
  const countryLink = countryPageExists ? '<a class="tpill" href="../../manufacturers/' + countrySlug + '.html">' + esc(r.country) + ' manufacturers</a>' : '';
  const crumbCountry = countryPageExists ? '<a href="../../manufacturers/' + countrySlug + '.html" style="color:var(--accent)">' + esc(r.country) + '</a>' : esc(r.country);
  const cityHtml = r.city ? '<span class="tpill">' + esc(r.city) + '</span>' : '';
  const evs = eventsFor(r);
  const evHtml = evs.map(function (ev) { return '<li style="margin:6px 0"><a href="' + esc(ev.u) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(ev.n) + '</a> <span style="color:var(--muted);font-size:.85rem">' + fmt(ev.s) + ' · ' + esc(ev.c) + ', ' + esc(ev.co) + '</span></li>'; }).join('') || '<li style="color:var(--muted)">No confirmed events for this market yet.</li>';
  const intel = intelFor(r);
  const intelHtml = intel.map(function (it) { return '<li style="margin:6px 0"><b style="color:var(--text);font-size:.9rem">' + esc(it.title) + '</b><p style="color:var(--muted);font-size:.84rem;margin:2px 0 0">' + esc(it.snippet.slice(0, 150)) + (it.snippet.length > 150 ? '…' : '') + '</p></li>'; }).join('') || '<li style="color:var(--muted)">Daily Intel for this market is refreshed hourly.</li>';
  const lastReviewed = (STATS.updated || '2026-08-26');
  const verify = r.flagV === 'P' ? '★ Pro Verified' : r.flagV === 'V' ? '✓ Verified' : 'Listed (directory)';
  const trust = '<div class="src"><b>Data sources</b> <span class="tpill">Company website</span><span class="tpill">Public manufacturer documentation</span><span class="tpill">Public project announcements</span><span class="tpill">TransformerPath industry database</span></div>' +
    '<div class="src" style="margin-top:6px"><b>Last reviewed</b> ' + lastReviewed + ' &nbsp;&middot;&nbsp; <b>Profile status</b> <span style="color:var(--accent)">' + verify + '</span></div>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:6px">Listed profiles are informational directory entries and do not imply verification, endorsement or commercial affiliation. ' + esc(r.name) + ' is <b>not</b> affiliated with TransformerPath.</p>';
  // conservative schema: describe the company, never claim affiliation
  const orgSchema = { '@context': 'https://schema.org', '@type': 'Organization', name: r.name, url: r.url ? r.url : url, description: (r.types.length ? 'Transformer manufacturer (' + r.types.map(typeBadge).join(', ') + ')' : 'Transformer manufacturer') + ' — ' + r.country + (r.city ? ', ' + r.city : ''), address: { '@type': 'PostalAddress', addressCountry: r.country, addressLocality: r.city || undefined } };
  const pageSchema = { '@context': 'https://schema.org', '@type': 'WebPage', name: r.name + ' — Company Profile', url: url, about: { '@type': 'Organization', name: r.name } };
  const b = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Manufacturers', item: 'https://transformerpath.com/manufacturers.html' }, { '@type': 'ListItem', position: 2, name: r.name }] };
  const schema = '<script type="application/ld+json">' + JSON.stringify(orgSchema) + '</script><script type="application/ld+json">' + JSON.stringify(pageSchema) + '</script><script type="application/ld+json">' + JSON.stringify(b) + '</script>';
  // tier enrichment table
  let tierTable = '';
  if (tier) {
    const row = function (k, v) { return v ? '<tr><th>' + k + '</th><td>' + v + '</td></tr>' : ''; };
    const c = tier.mva ? '~' + tier.mva.toLocaleString('en-US') + ' MVA' : '—';
    const kv = tier.kv ? tier.kv + ' kV' : '—';
    // Source-authority honesty: capability figures resting only on a
    // low-authority third-party directory (Ensun / IQS / Sinovoltaics / generic
    // "industry directory") must be flagged as unverified — they are not
    // independently sourced evidence of a capability.
    const LOW_AUTH = /ensun|iqs|sinovoltaics|industry directory|directory/i;
    const lowAuth = LOW_AUTH.test('' + tier.source);
    const srcLabel = (tier.source || '—') + (lowAuth ? ' <span style="color:var(--muted);font-weight:600">(third-party directory — not independently verified)</span>' : '') + (tier.note ? ' <span style="color:var(--muted);cursor:help" title="' + esc(tier.note) + '">&#8505;</span>' : '');
    tierTable = '<table class="tbl"><tbody>' + row('Indicative capacity / yr', c) + row('Max voltage capability', kv) + row('Product types', (tier.types || []).join(', ')) + row('Regions served', (tier.regions || []).join(', ')) + row('Reported standards', (tier.certs || []).join(', ')) + row('Source', srcLabel) + '</tbody></table>' + '<p style="font-size:.72rem;color:var(--muted)">Separate figures: annual manufacturing capacity and maximum voltage capability are independently reported values — they are <b>not</b> combined here into a single product capability. Indicative, compiled from published market research/industry directories; verify against the manufacturer before a procurement decision.</p>';
  }

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(r.name) + ' — Company Profile, Products &amp; Industry Information | TransformerPath</title>' +
    '<meta name="description" content="' + esc(r.name) + ' — independent company profile: transformer capabilities (' + esc((r.types.length ? r.types : ['DT']).map(typeBadge).join(', ')) + '), location, related components, market intelligence and events, from the TransformerPath census.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(r.name) + ' — Company Profile"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="' + robots + '">' +
    '<link rel="stylesheet" href="../../style.css?v=5"><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><link rel="preconnect" href="https://www.google-analytics.com">' +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' + schema +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 88px}.c-wrap h1{font-size:2rem;color:var(--ink)}.c-wrap h2{font-size:1.2rem;color:var(--ink);margin-top:26px}.c-wrap p{color:var(--text);line-height:1.7}.c-wrap .lead{color:var(--muted);font-size:1rem}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap .tbl{width:100%;border-collapse:collapse;margin:10px 0}.c-wrap .tbl th{text-align:left;color:var(--muted);font-weight:600;padding:6px 10px;border-bottom:1px solid var(--border);width:40%}.c-wrap .tbl td{padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text)}.c-wrap ul{padding-left:20px;line-height:1.7}.vbadge{color:var(--green);font-weight:700;font-size:.8rem}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../manufacturers.html" style="color:var(--accent)">Manufacturers</a> › ' + crumbCountry + ' › ' + esc(r.name) + '</nav>' +
    '<h1>' + esc(r.name) + '</h1>' +
    '<p class="lead">Independent company profile covering reported transformer capabilities, markets, related industry developments and relevant events.</p>' +
    '<p style="font-size:.9rem;color:var(--muted);margin:6px 0 0">' + (r.flag || '') + ' <b style="color:var(--text)">' + esc(r.country) + '</b>' + (r.city ? ' · ' + esc(r.city) : '') + ' · <span style="color:var(--accent)">' + verify + '</span>' + (r.url ? ' · <a href="' + esc(r.url) + '" target="_blank" rel="noopener nofollow" style="color:var(--accent)">Official website ↗</a>' : '') + '</p>' +
    trust +
    '<h2>Capabilities</h2><div style="margin:4px 0 8px">' + typeHtml + '</div>' +
    (tierTable ? '<h2>Indicative capability data</h2>' + tierTable : '') +
    '<h2>Related components</h2><div>' + compLinks + '</div>' +
    '<h2>Relevant applications</h2><div>' + appLinks + '</div>' +
    '<h2>Markets</h2><div>' + countryLink + (cityHtml ? ' ' + cityHtml : '') + (marketLink ? ' ' + marketLink : '') + '</div>' +
    brandSitesHtml(r) + developmentsHtml(r) +
    '<h2>Latest TransformerPath intelligence</h2><ul>' + intelHtml + '</ul>' +
    '<h2>Upcoming events</h2><ul>' + evHtml + '</ul>' +
    '<p style="font-size:.72rem;color:var(--muted)">Last reviewed: ' + lastReviewed + '.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:22px"><b style="color:var(--text)">Represent this company?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Claim and update this profile to keep its capabilities, markets and verification accurate.</p>' +
    '<a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-manufacturer="' + esc(r.name) + '">Claim and update this profile →</a></div>' +
    '<div class="card" style="background:var(--bg);border:1px solid var(--border);padding:16px 18px;text-align:center;margin-top:14px"><b style="color:var(--text)">Looking for transformer suppliers?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a technical requirement for supplier matching across the ' + esc(r.country) + ' and regional manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-manufacturer="' + esc(r.name) + '">Submit an RFQ</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js?v=2" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('manufacturers', { recursive: true });
const slugsUsed = {};
let indexed = 0, noindexed = 0, rich = 0;
const list = Object.keys(records).map(function (k) { return records[k]; });
// ensure unique slugs
list.forEach(function (r) {
  let slug = slugify(r.name); let k = 2;
  while (slugsUsed[slug]) { k++; slug = slugify(r.name) + '-' + k; }
  slugsUsed[slug] = 1; r.slug = slug;
});
list.forEach(function (r) {
  fs.mkdirSync('manufacturers/' + r.slug, { recursive: true });
  fs.writeFileSync('manufacturers/' + r.slug + '/index.html', page(r, r.slug));
  if (r.url) { indexed++; if (r.tierFile) rich++; } else noindexed++;
});
console.log('company pages:', list.length, '| indexed:', indexed, '(rich tier:', rich + ')', '| noindex(follow):', noindexed);
// Slug manifest so other builders can link a maker -> its company entity page,
// and know which company pages are indexable (vs noindex,follow).
fs.writeFileSync('data/company-slugs.json', JSON.stringify(Object.keys(records).map(function (k) { const r = records[k]; return { name: r.name, slug: r.slug, country: r.country, indexable: !!r.url }; }), null, 2));
