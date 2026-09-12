#!/usr/bin/env node
/* build-projects.js — TransformerPath Project Entity Pages.
 *
 * Generates a Project entity page per record in data/projects.json (the audit's
 * Projects schema). A project is a distinct grid/substation build/tender/award,
 * NOT an article. Fields are only shown where sourced; the transformer_requirement
 * grade is displayed so a reader can tell confirmed transformer scope from an
 * inferred or unknown one.
 *
 * Run: node build-projects.js  (part of the Netlify build command).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

const DATA = JSON.parse(fs.readFileSync('data/projects.json', 'utf8'));
const PROJECTS = DATA.projects || [];
const MARKET_SLUG = { 'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia', 'Qatar': 'qatar', 'Kuwait': 'kuwait', 'Bahrain': 'bahrain', 'India': 'india', 'China': 'china', 'United Kingdom': 'united-kingdom', 'Germany': 'germany', 'France': 'france', 'Netherlands': 'netherlands', 'United States': 'usa', 'Canada': 'canada', 'Australia': 'australia', 'Egypt': 'egypt', 'South Africa': 'south-africa', 'Brazil': 'brazil' };
// World region taxonomy (mirrors the projects.json region_map).
const REGION = {};
(function () {
  const rm = (DATA.region_map) || {};
  Object.keys(rm).forEach(function (region) { (rm[region] || []).forEach(function (c) { REGION[ci(c)] = region; }); });
  // fallback for countries not explicitly mapped by exact name
  const FALLBACK = { uk: 'Europe', 'south korea': 'Asia', 'dubai': 'Middle East', 'abu dhabi': 'Middle East', 'new delhi': 'Asia' };
  // ignore; exact country names are mapped above
})();
const regionOf = (c) => REGION[ci(c)] || (/(UAE|Saudi|Oman|Qatar|Kuwait|Bahrain|Dubai|Abu Dhabi|Middle East)/i.test(c) ? 'Middle East' : /(India|China|Korea|Japan|Indonesia|Vietnam|Malaysia|Philippines|Thailand|Pakistan|Bangladesh|Asia)/i.test(c) ? 'Asia' : /(Germany|UK|France|Italy|Spain|Netherlands|Norway|Sweden|Poland|Austria|Belgium|Denmark|Europe)/i.test(c) ? 'Europe' : /(USA|United States|Canada|Mexico|North America)/i.test(c) ? 'North America' : /(Brazil|Chile|Argentina|Colombia|Peru|Latin America)/i.test(c) ? 'Latin America' : /(South Africa|Egypt|Morocco|Kenya|Nigeria|Africa|Algeria|Angola|Senegal|Tanzania|Zambia)/i.test(c) ? 'Africa' : /(Australia|New Zealand|Oceania)/i.test(c) ? 'Oceania' : 'Other');
const REGION_ORDER = ['Middle East', 'Asia', 'Europe', 'North America', 'Latin America', 'Africa', 'Oceania'];
// Utility buyer name fragment -> utility entity slug (data/grids.json derived, matches build-utilities.js).
const UTILITY_SLUG = { 'kahramaa': 'kahramaa', 'dewa': 'dewa', 'ewa': 'ewa', 'ministry of electricity': 'mewre-ministry-of-electricity-and-water', 'saudi': 'saudi-electricity-co-national-grid-sa' };
const uSlug = (u) => { const k = ci(u); for (const [frag, slug] of Object.entries(UTILITY_SLUG)) { if (k.indexOf(frag) >= 0) return slug; } return ''; };
const GRADE_HELP = {
  CONFIRMED: 'Transformer scope is explicitly documented in the source.',
  INFERRED: 'Transformer requirement is reasonably inferred from the substation / grid scope.',
  UNKNOWN: 'Transformer requirement is not yet documented.',
};
const STATUS_LABEL = { evaluation: 'Pre-award / evaluation', tendering: 'Tendering', expected: 'Expected', awarded: 'Awarded', construction: 'Construction', energized: 'Energized' };

/* Status labels are Title Case ("Energized", "Pre-award / evaluation"), so
   splicing them after a hardcoded "A " produced "A Energized ...". Lowercase the
   label in running prose and pick the article from its first sound. */
function withArticle(label, capitalise) {
  const l = String(label || '').toLowerCase();
  const art = /^[aeiou]/.test(l) ? 'an' : 'a';
  return (capitalise ? art.charAt(0).toUpperCase() + art.slice(1) : art) + ' ' + l;
}

function page(p) {
  const slug = slugify(p.project);
  const url = 'https://transformerpath.com/projects/' + slug + '/';
  const grade = (p.transformer_requirement || 'UNKNOWN').toUpperCase();
  const vol = p.voltage || '—';
  /* MARKET_SLUG maps every country; market hubs exist for 39 of them. Linking
     on the map alone produced 33 dead links (Australia 25, Kuwait/Qatar/Bahrain).
     Same guard build-exhibitions.js already uses. */
  const marketSlug = MARKET_SLUG[p.country];
  const marketLink = (marketSlug && fs.existsSync('markets/' + marketSlug + '/index.html')) ? '<a class="tpill" href="../../markets/' + marketSlug + '/">' + esc(p.country) + ' market</a>' : '';
  const utilLink = (p.utility && uSlug(p.utility)) ? '<a class="tpill" href="../../utilities/' + uSlug(p.utility) + '/">' + esc(p.utility) + ' profile</a>' : '';
  const srcLinks = (p.sources || []).filter((u) => u).map((u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener" style="color:var(--accent)">source</a>').join(' · ') || '—';

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(p.project) + ' — Transformer Project | TransformerPath</title>' +
    '<meta name="description" content="' + esc(p.project) + ' (' + esc(p.country) + ') — ' + esc(withArticle(STATUS_LABEL[p.status] || p.status, false)) + ' transformer-relevant grid/substation project. Voltage ' + esc(vol) + ', ' + esc(grade.toLowerCase()) + ' transformer requirement. Source-tracked by TransformerPath.">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(p.project) + ' — Transformer Project"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Project', name: p.project, description: 'Transformer-relevant ' + (p.status || '') + ' project in ' + p.country + '.', location: { '@type': 'Place', name: p.country } }) + '</script>' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.6rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.c-wrap .evmeta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap ul{padding-left:20px;line-height:1.7}.c-wrap table{width:100%;border-collapse:collapse;margin:10px 0}.c-wrap table th{text-align:left;color:var(--muted);font-weight:600;padding:6px 10px;border-bottom:1px solid var(--border);width:38%}.c-wrap table td{padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text)}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../projects.html" style="color:var(--accent)">Projects</a> › ' + esc(regionOf(p.country)) + ' › ' + esc(p.country) + ' › ' + esc(p.project) + '</nav>' +
    '<h1>' + esc(p.project) + ' <button class="follow-btn" data-follow-type="project" data-follow-subject="' + esc(p.project) + '" data-follow-label="' + esc(p.project) + '" title="Follow this project in My TransformerPath">Follow</button></h1>' +
    '<p class="lead" style="margin-bottom:14px">' + esc(withArticle(STATUS_LABEL[p.status] || p.status, true)) + ' transformer-relevant grid/substation project, tracked as an entity (not an article) by TransformerPath.</p>' +
    '<div class="evmeta"><span><b>Region</b> ' + esc(regionOf(p.country)) + '</span><span><b>Country</b> ' + esc(p.country) + '</span><span><b>Voltage</b> ' + esc(vol) + '</span><span><b>Status</b> ' + esc((STATUS_LABEL[p.status] || p.status)) + '</span>' + (p.expected ? '<span><b>Expected</b> ' + esc(p.expected) + '</span>' : '') + '</div>' +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:14px 18px;margin-bottom:22px"><span class="cls-badge cls-' + grade + '">' + grade + '</span> <span style="font-size:.9rem;color:var(--text)">' + esc(GRADE_HELP[grade] || GRADE_HELP.UNKNOWN) + '</span></div>' +
    '<h2>Project record</h2><table>' +
    '<tr><th>Project</th><td>' + esc(p.project) + '</td></tr>' +
    '<tr><th>Region</th><td>' + esc(regionOf(p.country)) + '</td></tr>' +
    '<tr><th>Country</th><td>' + esc(p.country) + '</td></tr>' +
    (p.utility ? '<tr><th>Utility / buyer</th><td>' + esc(p.utility) + '</td></tr>' : '') +
    (p.epc ? '<tr><th>EPC</th><td>' + esc(p.epc) + '</td></tr>' : '') +
    '<tr><th>Transformer requirement</th><td><span class="cls-badge cls-' + grade + '">' + grade + '</span></td></tr>' +
    '<tr><th>Voltage</th><td>' + esc(vol) + '</td></tr>' +
    '<tr><th>Status</th><td>' + esc((STATUS_LABEL[p.status] || p.status)) + '</td></tr>' +
    (p.manufacturer ? '<tr><th>Transformer manufacturer</th><td>' + esc(p.manufacturer) + '</td></tr>' : '') +
    '<tr><th>Expected</th><td>' + esc(p.expected || '—') + '</td></tr>' +
    '</table>' +
    '<h2>Sources</h2><ul><li>' + esc(p.src_label || 'public announcement') + ' · ' + srcLinks + '</li></ul>' +
    '<h2>Market context</h2><div>' + (marketLink || '<span style="color:var(--muted);font-size:.85rem">Market hub not yet built.</span>') + (utilLink ? ' ' + utilLink : '') + '</div>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:8px">Last reviewed: ' + new Date().toISOString().slice(0, 10) + '. Sources: public tender/project announcements and TransformerPath Daily Intel; transformer scope graded per the CONFIRMED / INFERRED / UNKNOWN taxonomy. Report a <a href="mailto:hello@transformerpath.com?subject=Project%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Supply this project</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a transformer requirement and TransformerPath will match it against the relevant manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-project="' + esc(slug) + '">Submit an RFQ</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n<script src="../../follow-button.js" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('projects', { recursive: true });
let built = 0;
PROJECTS.forEach((p) => {
  try {
    const slug = slugify(p.project);
    fs.mkdirSync('projects/' + slug, { recursive: true });
    fs.writeFileSync('projects/' + slug + '/index.html', page(p));
    built++;
  } catch (e) { console.error('!! ' + p.project + ' failed: ' + e.message); }
});
console.log('project entity pages:', built);

/* ── Global /projects index: World → Region → Country → Utility → Project ────
 * Server-rendered (no client fetch / no empty-container flash). Groups all
 * projects by world region then country, computes global coverage statistics,
 * and exposes client-side filters (region, country, status, transformer scope,
 * voltage class, transformer type) driven by data attributes so /projects is a
 * genuine global intelligence page, not a GCC-only list. Every project card is
 * source-linked and preserves its transformer-scope confidence grade.
 */
(function renderProjectsIndex() {
  const label = function (s) { return { evaluation: 'Pre-award / evaluation', tendering: 'Tendering', expected: 'Expected', awarded: 'Awarded', construction: 'Construction', energized: 'Energized', planned: 'Planned', 'under construction': 'Under construction' }[s] || s; };

  // Normalise project status to a filterable set.
  const normStat = function (s) {
    const k = String(s || '').toLowerCase();
    if (/award/.test(k)) return 'awarded';
    if (/energ|complete/.test(k)) return 'energized';
    if (/construct/.test(k)) return 'construction';
    if (/tender|bid/.test(k)) return 'tendering';
    if (/planned|announc/.test(k)) return 'planned';
    if (/expected|evaluation/.test(k)) return 'expected';
    return k || 'expected';
  };
  const STAT_ORDER = ['planned', 'tendering', 'expected', 'awarded', 'construction', 'energized'];
  const STAT_LABEL = { planned: 'Planned', tendering: 'Tendering', expected: 'Expected / pre-award', awarded: 'Awarded', construction: 'Under construction', energized: 'Energized' };

  // Coverage statistics.
  const regions = {}; const countries = new Set();
  let confirmed = 0, inferred = 0, unknown = 0, awarded = 0, tenders = 0, active = 0;
  PROJECTS.forEach(function (p) {
    const r = regionOf(p.country); regions[r] = (regions[r] || 0) + 1; countries.add(p.country);
    const g = (p.transformer_requirement || 'UNKNOWN').toUpperCase();
    if (g === 'CONFIRMED') confirmed++; else if (g === 'INFERRED') inferred++; else unknown++;
    const st = normStat(p.status);
    if (st === 'tendering' || st === 'planned' || st === 'expected') tenders++;
    if (['planned', 'tendering', 'expected', 'awarded', 'construction'].indexOf(st) >= 0) active++;
    if (st === 'awarded') awarded++;
  });
  const lastVerified = '2026-08-31';

  // Group projects by region then country.
  const byRegion = {};
  PROJECTS.forEach(function (p) {
    const r = regionOf(p.country);
    (byRegion[r] = byRegion[r] || {});
    const c = p.country;
    (byRegion[r][c] = byRegion[r][c] || []).push(p);
  });
  const regionKeys = Object.keys(byRegion).sort(function (a, b) {
    const ia = REGION_ORDER.indexOf(a), ib = REGION_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  // Build region blocks with filterable data-attributes.
  const regionBlocks = regionKeys.map(function (region) {
    const countryKeys = Object.keys(byRegion[region]).sort();
    const countryBlocks = countryKeys.map(function (country) {
      const countryData = country.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const items = byRegion[region][country].map(function (p) {
        const g = (p.transformer_requirement || 'UNKNOWN').toUpperCase();
        const st = normStat(p.status);
        const slug = slugify(p.project);
        return '<div class="pj-card" data-region="' + esc(region.toLowerCase()) + '" data-country="' + esc(countryData) + '" data-status="' + esc(st) + '" data-scope="' + esc(g.toLowerCase()) + '" data-voltage="' + esc(p.voltage || '') + '">' +
          '<h3><a href="projects/' + slug + '/">' + esc(p.project) + '</a></h3>' +
          '<div class="meta"><b>Country</b> ' + esc(p.country) + ' &middot; <b>Voltage</b> ' + esc(p.voltage || '—') + ' &middot; <b>Status</b> ' + esc(STAT_LABEL[st] || label(p.status)) + ' <span class="cls-badge cls-' + g + '">' + g + '</span></div>' +
          (p.utility ? '<div class="meta"><b>Utility</b> ' + esc(p.utility) + '</div>' : '') +
          '<div class="src"><a href="' + esc((p.sources && p.sources[0]) || '#') + '" target="_blank" rel="noopener">source</a>' + (p.expected ? ' · expected ' + esc(p.expected) : '') + '</div></div>';
      }).join('');
      return '<div class="u-country" data-stc="' + esc(countryData) + '"><b class="u-cname">' + esc(country) + ' (' + byRegion[region][country].length + ')</b>' + items + '</div>';
    }).join('');
    return '<div class="region-h" data-regionh="' + esc(region.toLowerCase()) + '">' + esc(region) + ' (' + regions[region] + ')</div>' + countryBlocks;
  }).join('');

  // Filter controls (region / country / status / scope / search).
  const regionOptions = regionKeys.map(function (r) { return '<option value="' + esc(r.toLowerCase()) + '">' + esc(r) + '</option>'; }).join('');
  const statusOptions = STAT_ORDER.map(function (s) { return '<option value="' + s + '">' + STAT_LABEL[s] + '</option>'; }).join('');
  const scopeOptions = ['confirmed', 'inferred', 'unknown'].map(function (s) { return '<option value="' + s + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>'; }).join('');

  const statsHtml = '<div class="pj-stats">' +
    '<div class="s"><b>' + Object.keys(regions).length + '</b><small>Regions</small></div>' +
    '<div class="s"><b>' + countries.size + '</b><small>Countries</small></div>' +
    '<div class="s"><b>' + PROJECTS.length + '</b><small>Projects</small></div>' +
    '<div class="s"><b>' + confirmed + '</b><small>Confirmed transformer scopes</small></div>' +
    '<div class="s"><b>' + tenders + '</b><small>Open / upcoming</small></div>' +
    '<div class="s"><b>' + awarded + '</b><small>Awarded</small></div>' +
    '</div>';

  const filters = '<div class="pj-filters">' +
    '<input id="pjSearch" class="pj-input" type="search" placeholder="Search projects, country, utility…" aria-label="Search projects">' +
    '<select id="pjRegion" class="pj-select" aria-label="Filter by region"><option value="">All regions</option>' + regionOptions + '</select>' +
    '<select id="pjStatus" class="pj-select" aria-label="Filter by status"><option value="">All statuses</option>' + statusOptions + '</select>' +
    '<select id="pjScope" class="pj-select" aria-label="Filter by transformer scope"><option value="">All transformer scopes</option>' + scopeOptions + '</select>' +
    '</div>';

  const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Transformer Projects — Global Database | TransformerPath</title>' +
    '<meta name="description" content="A global, source-backed database of transformer-relevant grid, substation and transmission projects — planned, tendering, awarded, under construction and energized — across ' + countries.size + ' countries and ' + Object.keys(regions).length + ' world regions, with transformer-scope confidence grades.">' +
    '<link rel="canonical" href="https://transformerpath.com/projects.html"><meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="Transformer Projects — Global Database"><meta property="og:url" content="https://transformerpath.com/projects.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any"><link rel="stylesheet" href="style.css?v=13"><style>' +
    '.pj-wrap{max-width:1100px;margin:0 auto;padding:44px 20px 90px}.pj-wrap h1{font-size:2rem;color:var(--ink)}.pj-wrap .lead{color:var(--muted);font-size:1.03rem;max-width:860px;margin:8px 0 24px}.pj-stats{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 22px}.pj-stats .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;text-align:center;min-width:130px}.pj-stats .s b{color:var(--text);font-size:1.4rem;display:block}.pj-stats .s small{color:var(--muted);font-size:.74rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.pj-filters{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px}.pj-input,.pj-select{padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);font-family:inherit;font-size:.9rem}.pj-input{flex:1;min-width:220px}.region-h{font-size:1.05rem;font-weight:800;color:var(--ink);text-transform:uppercase;letter-spacing:.05em;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}.u-country{margin:8px 0 16px}.u-cname{display:block;font-size:.92rem;font-weight:800;color:var(--accent);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.03em}.pj-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:13px 15px;margin-bottom:8px}.pj-card h3{margin:0 0 4px}.pj-card h3 a{color:var(--text);font-weight:700;font-size:.98rem;text-decoration:none}.pj-card h3 a:hover{color:var(--accent)}.pj-card .meta{color:var(--muted);font-size:.84rem;margin:3px 0}.pj-card .meta b{color:var(--text)}.pj-card .src{font-size:.78rem;color:var(--muted);margin-top:6px}.pj-card .src a{color:var(--accent)}.cls-badge{display:inline-block;font-weight:700;font-size:9.5px;letter-spacing:.05em;padding:1px 6px;border-radius:8px;margin-left:6px;vertical-align:middle;text-transform:uppercase}.cls-CONFIRMED{background:#14351f;color:#4ade80;border:1px solid rgba(74,222,128,.35)}.cls-INFERRED{background:#12283f;color:#60a5fa;border:1px solid rgba(96,165,250,.35)}.cls-UNKNOWN{background:#1d2330;color:#9fb0c4;border:1px solid rgba(159,176,196,.35)}.pj-note{color:var(--muted);font-size:.8rem;margin-top:18px}.pj-empty{color:var(--muted);text-align:center;padding:30px}</style></head><body>\n' +
    HEAD + '\n<main class="pj-wrap">' +
    '<h1>Transformer <span style="color:var(--accent)">Projects</span> — Global Database</h1>' +
    '<p class="lead">A global, source-backed database of transformer-relevant grid, substation and transmission projects — planned, tendering, awarded, under construction and energized — organised World → Region → Country → Utility → Project → Transformer Scope. Each project is tracked as an entity, with its transformer scope graded <span class="cls-badge cls-CONFIRMED">confirmed</span>, <span class="cls-badge cls-INFERRED">inferred</span> or <span class="cls-badge cls-UNKNOWN">unknown</span> per the published source. A transformer manufacturer or award is recorded only where explicitly sourced. Last verified: ' + lastVerified + '.</p>' +
    statsHtml + filters +
    '<div id="list">' + regionBlocks + '</div>' +
    '<p class="pj-note">Projects are source-tracked from public tender/project databases, utility &amp; regulator announcements and reputable industry reporting; transformer scope is graded per the CONFIRMED / INFERRED / UNKNOWN taxonomy and never inferred as a manufacturer or award without a source. Report a <a href="mailto:hello@transformerpath.com?subject=Project%20correction" style="color:var(--accent)">correction</a>. See the <a href="methodology.html" style="color:var(--accent)">research methodology</a>.</p>' +
    '</main>\n' + FOOT + '\n<script src="analytics.js" defer></script>\n<script>\n(function(){var q=document.getElementById("pjSearch"),r=document.getElementById("pjRegion"),s=document.getElementById("pjStatus"),c=document.getElementById("pjScope");function apply(){var vq=q?q.value.trim().toLowerCase():"",vr=r?r.value:"",vs=s?s.value:"",vc=c?c.value:"";var cards=document.querySelectorAll(".pj-card");var shown=0;cards.forEach(function(card){var hay=(card.getAttribute("data-country")||"")+" "+(card.getAttribute("data-region")||"")+" "+(card.textContent||"").toLowerCase();var ok=!vq||hay.indexOf(vq)>=0;if(vr&&card.getAttribute("data-region")!==vr)ok=false;if(vs&&card.getAttribute("data-status")!==vs)ok=false;if(vc&&card.getAttribute("data-scope")!==vc)ok=false;card.style.display=ok?"":"none";if(ok)shown++;});var groups=document.querySelectorAll(".u-country");groups.forEach(function(gp){var vis=0;gp.querySelectorAll(".pj-card").forEach(function(cd){if(cd.style.display!=="none")vis++;});gp.style.display=vis?"":"none";});var regs=document.querySelectorAll(".region-h");regs.forEach(function(rh){var vis=0;var nxt=rh.nextElementSibling;while(nxt&&nxt.classList&&!nxt.classList.contains("region-h")){if(nxt.style.display!=="none")vis++;nxt=nxt.nextElementSibling;}rh.style.display=vis?"":"none";});var list=document.getElementById("list");if(list&&shown===0){var e=document.getElementById("pjEmpty");if(!e){list.insertAdjacentHTML("beforeend","<div id=\\"pjEmpty\\" class=\\"pj-empty\\">No projects match your filters — clear to show all.</div>");}}else{var e2=document.getElementById("pjEmpty");if(e2)e2.remove();}}if(q)q.addEventListener("input",apply);[r,s,c].forEach(function(el){if(el)el.addEventListener("change",apply);});})();\n</script>\n</body>\n</html>';
  fs.writeFileSync('projects.html', html);
  console.log('projects.html wrote (global database: ' + PROJECTS.length + ' projects / ' + countries.size + ' countries / ' + Object.keys(regions).length + ' regions; confirmed scopes: ' + confirmed + ')');
})();
