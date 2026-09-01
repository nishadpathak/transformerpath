#!/usr/bin/env node
/* build-grids.js — TransformerPath per-country Grid profiles.
 *
 * The hand-authored grids.html stays the worldwide directory (rich sections
 * + a server-rendered country board). What it lacked was a per-country detail
 * page. This builder generates one Grid profile per country (/grids/<slug>/)
 * from data/grids.json — frequency, synchronous area, region, every operator
 * with its role, operating voltage and official site, plus cross-links to the
 * country's market hub, utility profiles, manufacturer census and
 * transformer-relevant projects. Nothing is invented: fields come verbatim
 * from the grids census.
 *
 * Honesty: all operator/voltage/freq/sync values are source census data; a
 * country's grid page is a reference profile, not a claim about any specific
 * project or supply. No capability figures derived.
 *
 * Run: node build-grids.js  (part of the Netlify build).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

const GRIDS = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));
const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const PROJECTS = (JSON.parse(fs.readFileSync('data/projects.json', 'utf8')).projects) || [];

// Country -> market-hub slug (mirrors build-markets country naming), and
// country-page slug for the manufacturer census. Only where a hub exists.
const COUNTRY_MARKET = {};
(function () {
  const slugByCountry = {
    'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia', 'India': 'india', 'China': 'china',
    'United States': 'usa', 'USA': 'usa', 'Germany': 'germany', 'Türkiye': 'turkiye', 'Brazil': 'brazil',
    'South Korea': 'south-korea', 'Vietnam': 'vietnam', 'Indonesia': 'indonesia', 'France': 'france',
    'United Kingdom': 'united-kingdom', 'Italy': 'italy', 'Spain': 'spain', 'Netherlands': 'netherlands',
    'Poland': 'poland', 'Sweden': 'sweden', 'Norway': 'norway', 'Canada': 'canada', 'Mexico': 'mexico',
    'Australia': 'australia', 'New Zealand': 'new-zealand', 'South Africa': 'south-africa', 'Egypt': 'egypt',
    'Japan': 'japan', 'Chile': 'chile', 'Argentina': 'argentina', 'Colombia': 'colombia', 'Peru': 'peru',
    'Austria': 'austria', 'Belgium': 'belgium', 'Denmark': 'denmark', 'Finland': 'finland', 'Ireland': 'ireland',
    'Portugal': 'portugal', 'Switzerland': 'switzerland', 'Czechia': 'czechia', 'Romania': 'romania',
    'Thailand': 'thailand', 'Malaysia': 'malaysia', 'Philippines': 'philippines', 'Pakistan': 'pakistan',
    'Bangladesh': 'bangladesh', 'Nigeria': 'nigeria', 'Kenya': 'kenya', 'Morocco': 'morocco', 'Algeria': 'algeria',
    'Tanzania': 'tanzania', 'Zambia': 'zambia', 'Angola': 'angola', 'Senegal': 'senegal', 'Ukraine': 'ukraine',
    'Greece': 'greece', 'Hungary': 'hungary', 'Slovakia': 'slovakia', 'Bulgaria': 'bulgaria', 'Croatia': 'croatia',
    'Serbia': 'serbia', 'Iraq': 'iraq', 'Jordan': 'jordan', 'Kuwait': 'kuwait', 'Qatar': 'qatar', 'Oman': 'oman',
  };
  Object.keys(slugByCountry).forEach((c) => { COUNTRY_MARKET[ci(c)] = slugByCountry[c]; });
})();
const countryMarket = (c) => COUNTRY_MARKET[ci(c)] || '';

// Manufacturer census uses short country forms (e.g. "UAE", "USA") where the
// grid census uses full names. Map grid census country -> manufacturer census
// country name; fall back to the grid name unchanged.
function censusCountry(name) {
  const a = { 'United Arab Emirates': 'UAE', 'United States': 'USA', 'Türkiye': 'Türkiye', 'Côte d\'Ivoire': 'Côte d\'Ivoire' };
  return a[ci(name)] === undefined ? name : a[ci(name)];
}
// Manufacturer Census record for a grid country (validated at build time).
function censusFor(country) {
  const want = censusCountry(country);
  return MANUF.find((x) => ci(x.country) === ci(want)) || null;
}
// Manufacturer per-country page URL slug (build-seo writes manufacturers/<slug>.html).
function manufCountrySlug(c) {
  const alias = { 'United States': 'usa', 'USA': 'usa', 'Türkiye': 'turkiye', 'United Kingdom': 'united-kingdom', 'United Arab Emirates': 'uae' };
  return slugify(alias[ci(c)] || ci(c));
}

// The 24 utility entity profiles (build-utilities.js) — matched to a country
// page by discovering which operators in this grid have a utilities/<slug> page.
const UTILS_ON_DISK = (function () {
  const m = {};
  try { fs.readdirSync('utilities').forEach((d) => { if (fs.existsSync('utilities/' + d + '/index.html')) m[d] = true; }); } catch (e) {}
  return m;
})();

function regionOrderOf(r) {
  const order = ['Middle East', 'Europe', 'CIS / Eurasia', 'Africa', 'South Asia', 'East Asia', 'Southeast Asia', 'North America', 'Latin America', 'Oceania'];
  const i = order.indexOf(r); return i < 0 ? 99 : i;
}

function gridPage(g) {
  const slug = slugify(g.country);
  const url = 'https://transformerpath.com/grids/' + slug + '/';
  const market = countryMarket(g.country);
  const marketLink = market && fs.existsSync('markets/' + market + '/index.html');
  const marketHtml = marketLink ? '<a class="tpill" href="../../markets/' + market + '/">' + esc(g.country) + ' market hub</a>' : '';
  // Utility profiles for this country: any operator whose slugified name has a
  // utilities/<slug>/index.html entity page built by build-utilities.js.
  const utilPills = g.grids.map((x) => slugify(x[0])).filter((s) => UTILS_ON_DISK[s])
    .map((s) => '<a class="tpill" href="../../utilities/' + s + '/">' + esc(s.replace(/-/g, ' ')) + ' profile</a>').join('');
  // Manufacturer census for this country -> country page + count.
  const census = censusFor(g.country);
  const makers = census ? census.makers.filter((m) => !/^Served by/i.test(m[0])) : [];
  const manufSlug = manufCountrySlug(g.country);
  const manufLink = fs.existsSync('manufacturers/' + manufSlug + '.html') ? '<a class="tpill" href="../../manufacturers/' + manufSlug + '.html">' + esc(censusCountry(g.country)) + ' manufacturers (' + makers.length + ')</a>' : '';
  // Projects for this country.
  const projects = PROJECTS.filter((p) => ci(p.country) === ci(g.country));
  const projHtml = projects.map((p) => '<li style="margin:5px 0"><a href="../../projects/' + slugify(p.project) + '/" style="color:var(--accent);font-weight:600">' + esc(p.project) + '</a> <span style="color:var(--muted);font-size:.82rem">· ' + esc(p.voltage || '') + ' · ' + esc(p.status || '') + '</span></li>').join('') || '<li style="color:var(--muted)">No transformer-relevant project recorded yet.</li>';
  const related = (marketHtml || manufLink || utilPills || projects.length) ? '<h2>Related TransformerPath</h2><div style="margin:4px 0;line-height:2">' + (marketHtml || '') + ' ' + (manufLink || '') + ' ' + utilPills + '</div>' +
      (projects.length ? '<h2>Transformer-relevant projects</h2><ul>' + projHtml + '</ul>' : '') : '';

  const operatorRows = g.grids.map((x) => {
    return '<div class="grid-row"><b>' + esc(x[0]) + '</b><span class="desc">' + esc(x[1] || '') + '</span>' + (x[2] ? '<span class="kv">' + esc(x[2]) + '</span>' : '') + (x[3] ? '<a href="' + esc(x[3]) + '" target="_blank" rel="noopener">Site →</a>' : '') + '</div>';
  }).join('') || '<p style="color:var(--muted)">No operator data recorded for this grid yet.</p>';

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(g.country) + ' Electrical Grid — Operators &amp; Voltage | TransformerPath</title>' +
    '<meta name="description" content="' + esc(g.country) + ' electrical grid — frequency, synchronous area, grid operators and their operating voltages. Reference profiles from the TransformerPath worldwide grid census.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="' + esc(g.country) + ' Electrical Grid"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg"><link rel="icon" href="../../brand/favicon.ico" sizes="any"><link rel="stylesheet" href="../../style.css?v=11"><style>' +
    '.gw-wrap{max-width:960px;margin:0 auto;padding:44px 20px 90px}.gw-wrap h1{font-size:1.9rem;color:var(--ink)}.gw-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px;margin:8px 0 18px}.gw-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.gw-wrap .evmeta b{color:var(--text)}.gw-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.gw-wrap h2{font-size:1.2rem;color:var(--ink);margin-top:26px}.gw-wrap .grid-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);font-size:.92rem}.gw-wrap .grid-row b{color:var(--ink);min-width:170px}.gw-wrap .grid-row .desc{color:var(--muted);font-size:.86rem;flex:1}.gw-wrap .grid-row .kv{color:var(--accent);font-size:.82rem;font-weight:600}.gw-wrap .grid-row a{color:var(--accent);font-size:.8rem;font-weight:600}.gw-wrap ul{padding-left:18px;line-height:1.7}</style></head><body>\n' +
    HEAD + '\n<main class="gw-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../grids.html" style="color:var(--accent)">Grids</a> › ' + esc(g.region) + ' › ' + esc(g.country) + '</nav>' +
    '<h1>' + (g.flag || '') + ' ' + esc(g.country) + ' Electrical Grid</h1>' +
    '<p class="lead">Reference profile of the ' + esc(g.country) + ' electricity grid — grid frequency, synchronous area, and the main transmission &amp; distribution operators with their operating voltages. Compiled from the TransformerPath worldwide grid census.</p>' +
    '<div class="evmeta"><span><b>Region</b> ' + esc(g.region) + '</span><span><b>Frequency</b> ' + esc(g.freq || '—') + ' Hz</span><span><b>Synchronous area</b> ' + esc(g.sync || '—') + '</span><span><b>Operators</b> ' + g.grids.length + '</span></div>' +
    '<h2>Grid operators</h2>' + operatorRows +
    related +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:16px">Reference profile from the TransformerPath grid census; operator, voltage and frequency data are as recorded and may change. Report a <a href="mailto:hello@transformerpath.com?subject=Grid%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Supply transformers to ' + esc(g.country) + '</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a transformer requirement and TransformerPath will match it against the relevant manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-utility="' + esc(g.country) + ' grid">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-utility="' + esc(g.country) + ' grid">Are you a supplier here? Get Verified →</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}

// Generate per-country Grid profiles.
fs.mkdirSync('grids', { recursive: true });
const slugs = new Set();
GRIDS.forEach((g) => {
  const slug = slugify(g.country);
  fs.mkdirSync('grids/' + slug, { recursive: true });
  fs.writeFileSync('grids/' + slug + '/index.html', gridPage(g));
  slugs.add(slug);
});
console.log('grid profiles wrote: ' + GRIDS.length + ' countries -> ' + slugs.size + ' /grids/<slug>/ pages');

