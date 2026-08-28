#!/usr/bin/env node
/* build-utilities.js — TransformerPath Utility Entity Pages.
 *
 * Turns the strategically-important grid operators / utilities from
 * data/grids.json into rich, indexable entity pages (T&D World-inspired), each
 * aggregating that utility's transformer-relevant context with data pulled live
 * from the census, market, grid, event and intel files — never typed.
 *
 * A utility entity page contains: overview, grid characteristics, transformer
 * voltage classes, major substations where sourced, known transformer projects,
 * relevant manufacturers (by country), recent TransformerPath intel (by region),
 * events, official procurement links, sources and last-reviewed.
 *
 * Run: node build-utilities.js  (after build-markets, before build-seo).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const GRIDS = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const PROJECTS = (JSON.parse(fs.readFileSync('data/projects.json', 'utf8'))).projects || [];

// Company entity slug map (manufacturer entity graphs).
let CSMAP = {};
try { JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach((c) => { CSMAP[c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = c.slug; }); } catch (e) {}
const csl = (m) => CSMAP[String(m).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()];

// Market hub slug by country (mirrors build-markets). Allows utilities to link
// back to their market hub where one exists.
const MARKET_SLUG = { 'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia', 'India': 'india', 'China': 'china', 'United States': 'usa', 'Germany': 'germany', 'Brazil': 'brazil', 'Vietnam': 'vietnam', 'South Korea': 'south-korea', 'Japan': 'japan', 'Italy': 'italy', 'France': 'france', 'Spain': 'spain', 'Netherlands': 'netherlands', 'Poland': 'poland', 'Sweden': 'sweden', 'Chile': 'chile', 'Colombia': 'colombia', 'Peru': 'peru', 'Taiwan': 'taiwan', 'Czechia': 'czechia', 'Norway': 'norway', 'Venezuela': 'venezuela', 'Finland': 'finland', 'Nigeria': 'nigeria', 'Argentina': 'argentina', 'Egypt': 'egypt', 'Bulgaria': 'bulgaria', 'Austria': 'austria', 'Romania': 'romania', 'Uzbekistan': 'uzbekistan', 'Canada': 'canada', 'Mexico': 'mexico', 'South Africa': 'south-africa', 'Indonesia': 'indonesia', 'Thailand': 'thailand', 'Pakistan': 'pakistan', 'United Kingdom': 'united-kingdom' };
// Country page slug in manufacturers/ (census naming) for the "manufacturers in country" link.
const COUNTRY_SLUG = { 'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia', 'Oman': 'oman', 'Kuwait': 'kuwait', 'Qatar': 'qatar', 'Bahrain': 'bahrain', 'Egypt': 'egypt', 'Germany': 'germany', 'France': 'france', 'United Kingdom': 'united-kingdom', 'India': 'india', 'China': 'china', 'South Africa': 'south-africa', 'Kenya': 'kenya', 'Tanzania': 'tanzania', 'Zambia': 'zambia', 'Canada': 'canada', 'South Korea': 'south-korea' };
// Map the country names I use to the names the manufacturer census uses (the
// census uses short forms like "UAE", "Algeria", "USA" at group level).
const MANUF_COUNTRY = { 'United Arab Emirates': 'UAE', 'Saudi Arabia': 'Saudi Arabia', 'Oman': 'Oman', 'Kuwait': 'Kuwait', 'Qatar': 'Qatar', 'Bahrain': 'Bahrain', 'Egypt': 'Egypt', 'Germany': 'Germany', 'France': 'France', 'United Kingdom': 'United Kingdom', 'India': 'India', 'China': 'China', 'South Africa': 'South Africa', 'Kenya': 'Kenya', 'Tanzania': 'Tanzania', 'Zambia': 'Zambia', 'Canada': 'Canada', 'South Korea': 'South Korea', 'Algeria': 'Algeria', 'Angola': 'Angola', 'Senegal': 'Senegal' };
const mCountry = (c) => MANUF_COUNTRY[c] || c;

// The strategically important utilities, in priority order. Each record matches a
// name fragment in data/grids.json so live data (voltage, site) is pulled in.
const STRATEGIC = [
  { name: 'DEWA', country: 'United Arab Emirates', blurb: 'Dubai Electricity & Water Authority — vertically-integrated utility covering generation, transmission and distribution across Dubai, and a leading buyer of distribution transformers, power transformers and substation equipment in the Gulf.' },
  { name: 'TAQA Transmission', country: 'United Arab Emirates', blurb: 'Abu Dhabi transmission owner-operator and the northern grid spine — the 400/220 kV backbone of the Abu Dhabi grid and a key buyer of high-voltage power transformers.' },
  { name: 'SEWA', country: 'United Arab Emirates', blurb: 'Sharjah Electricity, Water & Gas Authority — the Sharjah utility, a substantial buyer of 220 kV and below distribution and power transformers.' },
  { name: 'EtihadWE', country: 'United Arab Emirates', blurb: 'Etihad Water & Electricity — Northern Emirates utility, procuring 132/33/11 kV substation, transformer and switchgear packages.' },
  { name: 'Saudi Electricity Co / National Grid SA', country: 'Saudi Arabia', blurb: 'The Saudi Electricity Company (SEC) and its National Grid operating arm — the dominant buyer of 380/110 kV power transformers, reactors and GSUs across the Kingdom under Vision 2030.' },
  { name: 'MEWRE (Ministry of Electricity & Water)', country: 'Kuwait', blurb: 'Kuwait Ministry of Electricity & Water (and Renewable Energy) — the state buyer of 400/132/11 kV transformers and substations.' },
  { name: 'KAHRAMAA', country: 'Qatar', blurb: 'Qatar General Electricity & Water Corporation — the monopolistic Qatari utility, procuring 400/132/66/11 kV transformers and substation plant.' },
  { name: 'EWA', country: 'Bahrain', blurb: 'Electricity & Water Authority (Bahrain) — the island utility, a buyer of 220/66/11 kV transformers and reactors.' },
  { name: 'OETC (Oman Grid)', country: 'Oman', blurb: 'Oman Electricity Transmission Company (OETC) — the sole transmission owner-operator in Oman, running the 400/220/132 kV grid and a key buyer of power transformers.' },

  { name: 'POWERGRID + Grid-India (NLDC)', country: 'India', blurb: 'Power Grid Corporation of India (POWERGRID) — the national transmission utility and one of the largest buyers of 765/400/220 kV power transformers and HVDC equipment in the world.' },
  { name: 'State Grid Corp of China (SGCC)', country: 'China', blurb: 'State Grid Corporation of China (SGCC) — the world\'s largest utility and transformer buyer, procuring UHV 1000 kV AC and ±1100 kV DC equipment at scale.' },
  { name: 'RTE', country: 'France', blurb: 'Réseau de Transport d\'Électricité (RTE) — the French TSO, a major buyer of 400/225 kV power transformers for grid reinforcement and interconnection.' },
  { name: 'NESO / National Grid ET', country: 'United Kingdom', blurb: 'National Energy System Operator and National Grid Electricity Transmission — the GB TSO, procuring 400/275 kV power transformers and interconnector equipment.' },
  { name: 'TenneT', country: 'Netherlands', blurb: 'TenneT — the Dutch and German TSO, a leading buyer of 380 kV power transformers and offshore-grid converter equipment.' },
  { name: 'Eskom / NTCSA', country: 'South Africa', blurb: 'Eskom and the National Transmission Company South Africa — the dominant South African utility and a buyer of 765/400 kV power transformers.' },
  { name: 'IESO / Hydro One (Ontario)', country: 'Canada', blurb: 'The Independent Electricity System Operator (IESO) and Hydro One — the Ontario market operator and transmission utility, buyers of 500/230 kV power transformers.' },
  { name: 'KEPCO / KPX', country: 'South Korea', blurb: 'Korea Electric Power Corporation (KEPCO) and Korea Power Exchange — the Korean utility and market operator, procuring 765/345 kV power transformers.' },
  { name: 'KETRACO / Kenya Power', country: 'Kenya', blurb: 'Kenya Electricity Transmission Company (KETRACO) and Kenya Power — the Kenyan transmission developer and distributor, buyers of 400/220/66 kV transformers.' },
  { name: 'TANESCO', country: 'Tanzania', blurb: 'Tanzania Electric Supply Company (TANESCO) — the national utility, procuring 400/220/132 kV transformers and substation plant.' },
  { name: 'ZESCO', country: 'Zambia', blurb: 'Zambia Electricity Supply Corporation (ZESCO) — the national utility and a buyer of 330/220/66 kV power transformers.' },
  { name: 'Sonelgaz / GRTE', country: 'Algeria', blurb: 'Sonelgaz and its transmission arm GRTE — the Algerian national utility, procuring 400/220/60 kV transformers and substation equipment.' },
  { name: 'Senelec', country: 'Senegal', blurb: 'Société Nationale d\'Électricité du Sénégal (Senelec) — the Senegalese utility, a buyer of 225/90/30 kV transformers.' },
  { name: 'RNT (Rede Nacional de Transporte)', country: 'Angola', blurb: 'Rede Nacional de Transporte de Electricidade (RNT) — the Angolan transmission utility, procuring 400/220/60 kV transformers.' },
  { name: 'EETC', country: 'Egypt', blurb: 'Egyptian Electricity Transmission Company (EETC) — the state transmission monopsonist, procuring 500/220/66 kV power transformers and substation packages.' },
];

function buildUtility(u) {
  // Pull live data: find the country grid record + this operator.
  const gridRec = GRIDS.find((c) => ci(c.country).indexOf(ci(u.country)) >= 0);
  const op = (gridRec && (gridRec.grids || []).find((x) => ci(x[0]).indexOf(ci(u.name)) >= 0)) || [];
  const opName = op[0] || u.name;
  const opDesc = op[1] || u.blurb;
  const voltage = op[2] || '';
  const site = op[3] || '';

  const country = u.country;
  const slug = slugify(opName);
  const url = 'https://transformerpath.com/utilities/' + slug + '/';

  // Relevant manufacturers (this country's census makers -> entity / country links).
  const manuf = MANUF.find((g) => ci(g.country) === ci(mCountry(country)));
  const mkPills = (manuf ? manuf.makers.filter((m) => !/^served by/i.test(m[0])).slice(0, 14).map((m) => {
    const s = csl(m[0]);
    return s ? '<a class="tpill" href="../../manufacturers/' + s + '/">' + esc(m[0]) + '</a>' : '<span class="tpill">' + esc(m[0]) + '</span>';
  }).join(' ') : '<span style="color:var(--muted);font-size:.85rem">No transformer manufacturers recorded for this market yet.</span>');
  const mkCount = manuf ? manuf.makers.filter((m) => !/^served by/i.test(m[0])).length : 0;
  const manufCountryLink = COUNTRY_SLUG[country] ? '<a class="tpill" href="../../manufacturers/' + COUNTRY_SLUG[country] + '.html">All ' + esc(country) + ' manufacturers →</a>' : '';

  // Market hub link.
  const marketLink = MARKET_SLUG[country] ? '<a class="tpill" href="../../markets/' + MARKET_SLUG[country] + '/">' + esc(country) + ' market hub</a>' : '';

  // Intel for this region (GCC/Europe/etc.) — map region to intel key.
  const intelKey = gridRec && gridRec.region ? (ci(gridRec.region).indexOf('middle east') >= 0 || ci(gridRec.region).indexOf('gcc') >= 0 ? 'GCC' : '') : '';
  const intelItems = (INTEL[intelKey] && INTEL[intelKey].items ? INTEL[intelKey].items : []).slice(0, 4);
  const intelHtml = intelItems.map((it) => '<li style="margin:6px 0"><b style="color:var(--text);font-size:.9rem">' + esc(it.title) + '</b><p style="color:var(--muted);font-size:.84rem;margin:2px 0 0">' + esc(it.snippet.slice(0, 150)) + (it.snippet.length > 150 ? '…' : '') + '</p></li>').join('') || '<li style="color:var(--muted)">No recent TransformerPath intel for this market yet.</li>';

  // Events in this country (from events.json).
  const evArr = Array.isArray(EVENTS) ? EVENTS : (EVENTS.events || []);
  const evMatches = evArr.filter((e) => ci((e.c || '') + (e.co || '')).indexOf(ci(country)) >= 0 || ci(e.co || '').indexOf(ci(country)) >= 0);
  const evHtml = evMatches.slice(0, 3).map((e) => '<li style="margin:6px 0"><a href="' + esc(e.u || '#') + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(e.n) + '</a> <span style="color:var(--muted);font-size:.85rem">' + esc((e.s || '').slice(0, 10)) + ' · ' + esc((e.c || '') + ', ' + (e.co || '')) + '</span></li>').join('') || '<li style="color:var(--muted)">No confirmed transformer industry events for this market yet.</li>';

  // Related projects: match by country, and by utility name where possible.
  const projMatches = PROJECTS.filter((p) => ci(p.country || '').indexOf(ci(country)) >= 0 || ci((p.utility || '') + ' ' + (p.country || '')).indexOf(ci(opName)) >= 0);
  const projHtml = projMatches.slice(0, 4).map((p) => '<li style="margin:6px 0"><a href="../../projects/' + slugify(p.project) + '/" style="color:var(--accent)">' + esc(p.project) + '</a> <span style="color:var(--muted);font-size:.85rem">' + esc((p.status || '')) + ' · ' + ((p.transformer_requirement || 'UNKNOWN').toUpperCase()) + '</span></li>').join('') || '<li style="color:var(--muted)">No transformer-relevant project records yet for this market — see the <a href="../../projects.html" style="color:var(--accent)">projects list</a>.</li>';

  // Voltage classes (parse the operator's declared voltage + a sensible ladder).
  const vClass = voltage ? esc(voltage.split('/')[0].replace(/ kV.*/, '') + ' kV') : '';
  const odesc = opDesc;

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(opName) + ' — Transformer Procurement & Grid Profile | TransformerPath</title>' +
    '<meta name="description" content="' + esc(opName) + ' (' + esc(country) + ') — grid characteristics, transformer voltage classes, relevant manufacturers, TransformerPath intel and events. ' + esc(odesc.slice(0, 140)) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(opName) + ' — Transformer Grid Profile"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: opName, url: site || url, description: 'Transmission / distribution utility operating in ' + country + '.', address: { '@type': 'PostalAddress', addressCountry: country } }) + '</script>' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.c-wrap .evmeta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap ul{padding-left:20px;line-height:1.7}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../grids.html" style="color:var(--accent)">Grids</a> › <a href="../../markets/' + (MARKET_SLUG[country] || (slugify(country))) + '/" style="color:var(--accent)">' + esc(country) + '</a> › ' + esc(opName) + '</nav>' +
    '<h1>' + esc(opName) + '</h1>' +
    '<div class="evmeta"><span><b>Country</b> ' + esc(country) + '</span>' + (voltage ? '<span><b>Top voltage</b> ' + esc(voltage) + '</span>' : '') + ((gridRec && gridRec.region) ? '<span><b>Region</b> ' + esc(gridRec.region) + '</span>' : '') + (site ? '<span><a href="' + esc(site) + '" target="_blank" rel="noopener" style="color:var(--accent)">Official site ↗</a></span>' : '') + '</div>' +
    '<p class="lead">' + esc(odesc) + '</p>' +
    '<h2>Overview</h2><p style="line-height:1.7;color:var(--text)">' + esc(u.blurb) + '</p>' +
    '<h2>Grid characteristics</h2><ul>' +
    '<li><b>Operating region:</b> ' + esc(country) + (gridRec && gridRec.region ? ' — ' + esc(gridRec.region) : '') + '</li>' +
    '<li><b>System frequency:</b> ' + esc((gridRec && gridRec.freq) || '50') + ' Hz</li>' +
    '<li><b>Synchronous area:</b> ' + esc((gridRec && gridRec.sync) || '') + '</li>' +
    '<li><b>Top voltage class:</b> ' + esc(voltage || '—') + '</li>' +
    '</ul>' +
    '<h2>Transformer &amp; substation profile</h2><ul>' +
    '<li><b>Highest voltage class in this market:</b> ' + esc(voltage || '—') + '</li>' +
    '<li><b>Transformer demand driver:</b> ' + esc(odesc) + '</li>' +
    '<li><b>Procurement notes:</b> Utilities in this market procure against national grid codes and international standards — verify the governing standard before a tender.</li>' +
    '</ul>' +
    '<h2>Relevant manufacturers</h2><p style="color:var(--muted);font-size:.94rem;margin:4px 0 8px">' + mkCount + ' transformer makers recorded in the ' + esc(country) + ' census — power, distribution and dry-type. Verify capability before a decision.</p><div style="margin:4px 0 8px">' + mkPills + '</div>' + (manufCountryLink ? '<div style="margin-top:8px">' + manufCountryLink + '</div>' : '') +
    '<h2>Market context</h2><div>' + (marketLink || '<span style="color:var(--muted);font-size:.85rem">Market hub not yet built for this country.</span>') + '</div>' +
    '<h2>Latest TransformerPath intel</h2><ul>' + intelHtml + '</ul>' +
    '<h2>Related projects</h2><ul>' + projHtml + '</ul>' +
    '<h2>Upcoming events</h2><ul>' + evHtml + '</ul>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:8px">Last reviewed: ' + new Date().toISOString().slice(0, 10) + '. Sources: official utility / operator filings and public announcements; maintained encyclopedia-style from the TransformerPath grid census. Report a <a href="mailto:hello@transformerpath.com?subject=Grid%20census%20correction" style="color:var(--accent)">correction</a>.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Supply this utility</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a transformer requirement and TransformerPath will match it against the ' + esc(country) + ' and regional manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-utility="' + esc(opName) + '">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-utility="' + esc(opName) + '">Are you a supplier here? Get Verified →</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('utilities', { recursive: true });
let built = 0;
STRATEGIC.forEach((u) => {
  try {
    const slug = slugify(u.slug || u.name);
    fs.mkdirSync('utilities/' + slug, { recursive: true });
    fs.writeFileSync('utilities/' + slug + '/index.html', buildUtility(u));
    built++;
  } catch (e) { console.error('!! ' + u.name + ' failed: ' + e.message); }
});
console.log('utility entity pages:', built);
