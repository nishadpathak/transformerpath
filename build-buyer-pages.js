#!/usr/bin/env node
/* build-buyer-pages.js — /buy-early/ and /spare-capacity/.
 *
 * Buy-early is a free guide. Every figure is taken from a public page linked
 * in the text. Spare-capacity lists tier-2 profiles from lib/mid-tier-list.js.
 * Run: node build-buyer-pages.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { listMidTier } = require('./lib/mid-tier-list');
const copy = require('./lib/buyer-page-copy');

copy.assertWindows();

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pageShell(rel, main) {
  const title = copy.TITLES[rel];
  const description = copy.DESCRIPTIONS[rel];
  const canon = 'https://transformerpath.com/' + rel.replace(/index\.html$/, '');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(description) + '">' +
    '<link rel="canonical" href="' + canon + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:url" content="' + canon + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">' +
    '<meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">' +
    '<link rel="stylesheet" href="/style.css?v=14"><link rel="stylesheet" href="/tp-nav.css?v=14">' +
    '<style>' + STYLES + '</style>' +
    '<script src="/consent.js" defer></script>' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" class="c-wrap">' + main + '</main>\n' +
    FOOT + '\n<script src="/analytics.js" defer></script>\n</body>\n</html>\n';
}

const STYLES = [
  '.c-wrap{max-width:980px;margin:0 auto;padding:32px 20px 80px}',
  '.c-wrap h1{font-size:1.8rem;color:var(--ink);line-height:1.25}',
  '.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:32px}',
  '.c-wrap p,.c-wrap li{color:var(--text);line-height:1.7}',
  '.c-wrap .lead{color:var(--muted);font-size:1.05rem}',
  '.c-wrap a{color:var(--accent)}',
  '.crumbs{font-size:.8rem;color:var(--muted);margin-bottom:12px}',
  '.src{font-size:.86rem}',
  '.tbl{overflow-x:auto}',
  '.c-wrap table{width:100%;border-collapse:collapse;font-size:.92rem}',
  '.c-wrap th,.c-wrap td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--border)}',
  '.c-wrap th{color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.03em}',
  '.filters{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}',
  '.filters label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--muted);flex:1 1 160px;min-width:140px}',
  '.filters select{min-height:44px;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font:inherit}',
  '.sc-count{color:var(--muted);font-size:.9rem}',
  '.sc-empty{display:none;color:var(--muted)}',
  '.sc-cta{display:inline-block;text-align:center}',
  '@media (max-width:720px){',
  '.c-wrap h1{font-size:1.45rem}',
  '.sc-table thead{display:none}',
  '.sc-table tr{display:block;border:1px solid var(--border);border-radius:10px;margin:0 0 12px;padding:8px 4px}',
  '.sc-table td{display:block;border:0;padding:6px 8px}',
  '.sc-table td::before{content:attr(data-label);display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px}',
  '.sc-cta{display:block}',
  '}'
].join('');

const ROWS = listMidTier();
if (!ROWS.length) throw new Error('mid-tier list is empty');

function a(href, label) {
  return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
}

function buyEarlyMain() {
  const makers = '<ul>' + ROWS.map(function (row) {
    return '<li><a href="' + esc(row.profileHref) + '">' + esc(row.name) + '</a> · ' + esc(row.country) + '</li>';
  }).join('') + '</ul>';
  const sourced = ROWS.filter(function (row) { return row.capacity; });
  const sourcedList = sourced.map(function (row) {
    return '<li><a href="/spare-capacity/#m-' + esc(row.slug) + '">' + esc(row.name) + '</a> — ' +
      esc(row.capacity.text) + ' ' + a(row.capacity.source_url, row.capacity.source_label) + '.</li>';
  }).join('');

  return '<nav class="crumbs"><a href="/manufacturers.html">Manufacturers</a> · <a href="/spare-capacity/">Mid-tier manufacturers</a> · Buy early</nav>' +
    '<h1>Buying long-lead transformer equipment early</h1>' +
    '<p class="lead">A free guide for buyers who have to place transformer orders before a project date is close. Figures below are copied from the linked public sources. TransformerPath adds no lead-time number of its own.</p>' +
    '<p>The companion page is the <a href="/spare-capacity/">mid-tier manufacturer list</a>. A dash on that page means no public, dated capacity note is on file. The list does not say a factory has open capacity. Typical lead times by class and region are on the <a href="/lead-times/">grid lead-time tracker</a>.</p>' +
    '<h2>What stretches a lead time</h2>' +
    '<p>Demand has been running ahead of factory slots. ' + a('https://www.woodmac.com/news/opinion/4-years-into-a-difficult-transformers-market-in-the-us-is-there-a-potential-end-in-sight/', 'Wood Mackenzie, 27 June 2024') +
    ' wrote that power and generator step-up lead times had tripled since 2021, to about 150 weeks after receipt of order over the two quarters before that article, and that prices had risen 70–75% or more since 2020. ' +
    a('https://pv-magazine-usa.com/2026/05/11/u-s-transformer-market-faces-severe-supply-constraints-as-lead-times-extend-to-four-years/', 'pv magazine USA, 11 May 2026') +
    ' reported Wood Mackenzie figures for generator step-up demand up 274% from 2019 to 2025, and substation-transformer demand up 116% over the same years. That article also said prices had jumped by roughly 80% over five years, and named grain-oriented electrical steel and copper as constrained inputs.</p>' +
    '<p>The ' + a('https://www.energy.gov/sites/default/files/2024-10/EXEC-2022-001242%20-%20Large%20Power%20Transformer%20Resilience%20Report%207-10-24.pdf', 'U.S. Department of Energy Report to Congress, July 2024') +
    ' says large power transformer delays also follow specialty steel laminations, specialty copper, and skilled labour, and that these units are custom-built: bidding, design, manufacture, testing, and special transport all sit on the clock. The ' +
    a('https://www.energy.gov/oe/supply-chain-and-market-analysis', 'Department of Energy Office of Electricity supply-chain page') +
    ' says one reason distribution production runs long is the lack of consistent specifications, and that the Department identified over 80,000 distribution transformer varieties.</p>' +
    '<!--tp-ad-slot-->' +
    '<h2>Ordering timelines by size class</h2>' +
    '<p>Each cell is a figure the linked source states for that class. Where a source gives a range, the range is the cell. Where a source gives no week count, the row says so.</p>' +
    '<div class="tbl"><table><thead><tr><th>Size class</th><th>What the source states</th><th>Source</th></tr></thead><tbody>' +
    '<tr><td>Distribution transformers</td><td>Lead times moved from three to six months in 2019 to 12 to 30 months in 2023, which that page calls the latest data it is using.</td><td class="src">' + a('https://www.energy.gov/oe/supply-chain-and-market-analysis', 'U.S. DOE Office of Electricity') + '</td></tr>' +
    '<tr><td>Pad-mount distribution</td><td>About 75 weeks after receipt of order, on average, over the two quarters before the article.</td><td class="src">' + a('https://www.woodmac.com/news/opinion/4-years-into-a-difficult-transformers-market-in-the-us-is-there-a-potential-end-in-sight/', 'Wood Mackenzie, 27 June 2024') + '</td></tr>' +
    '<tr><td>Pole-top distribution</td><td>Lead times had started to ease after utilities stockpiled units through 2022 and 2023. The article states no week count for the eased figure.</td><td class="src">' + a('https://www.woodmac.com/news/opinion/4-years-into-a-difficult-transformers-market-in-the-us-is-there-a-potential-end-in-sight/', 'Wood Mackenzie, 27 June 2024') + '</td></tr>' +
    '<tr><td>Power and generator step-up, 2024 average</td><td>About 50 weeks in 2021, and 120 weeks on average in 2024. Large substation power and generator step-up units ranged from 80 to 210 weeks. Separately, the report says a buyer may wait 2 to 4 years, against a wait of months as recently as 2020, and that one U.S. large-power-transformer factory disclosed a 5-year wait for new orders.</td><td class="src">' + a('https://www.cisa.gov/sites/default/files/2024-09/NIAC_Addressing%20the%20Critical%20Shortage%20of%20Power%20Transformers%20to%20Ensure%20Reliability%20of%20the%20U.S.%20Grid_Report_06112024_508c_pdf_0.pdf', 'NIAC report, June 2024') + '</td></tr>' +
    '<tr><td>Large power transformers, 100 MVA and above</td><td>The report defines a large power transformer as 100 MVA or greater. It says 36-month lead times are commonly quoted and maximum lead times reach as much as 60 months. It also says that before 2020 an order could be placed with a lead time of less than a year.</td><td class="src">' + a('https://www.energy.gov/sites/default/files/2024-10/EXEC-2022-001242%20-%20Large%20Power%20Transformer%20Resilience%20Report%207-10-24.pdf', 'U.S. DOE, July 2024') + '</td></tr>' +
    '<tr><td>Power transformers, second quarter of 2025</td><td>Average lead time 128 weeks, down 10 weeks from the prior quarter. The same summary says power transformers and generator step-up units were seeing sustained lead times of 2 to 3 years.</td><td class="src">' + a('https://www.powermag.com/wp-content/uploads/2026/01/making-the-connection-executive-summary-september-2025.pdf', 'Power Magazine executive summary, September 2025') + '</td></tr>' +
    '<tr><td>Generator step-up, second quarter of 2025</td><td>Average lead time eased to 143 weeks.</td><td class="src">' + a('https://www.powermag.com/wp-content/uploads/2026/01/making-the-connection-executive-summary-september-2025.pdf', 'Power Magazine executive summary, September 2025') + '</td></tr>' +
    '<tr><td>High-capacity units, 2026</td><td>Lead times as long as four years, attributed by the article to PwC analysts.</td><td class="src">' + a('https://pv-magazine-usa.com/2026/05/11/u-s-transformer-market-faces-severe-supply-constraints-as-lead-times-extend-to-four-years/', 'pv magazine USA, 11 May 2026') + '</td></tr>' +
    '</tbody></table></div>' +
    '<h2>When to freeze the specification</h2>' +
    '<p>' + a('https://www.woodmac.com/news/opinion/4-years-into-a-difficult-transformers-market-in-the-us-is-there-a-potential-end-in-sight/', 'Wood Mackenzie, 27 June 2024') +
    ' describes owners who give demand commitments years ahead with high-level characteristics — high-side and low-side voltage, and kVA ratings — and then meet the manufacturer 16 weeks before production start to confirm each unit, the quantity, the price, and the lead time. The ' +
    a('https://www.energy.gov/oe/supply-chain-and-market-analysis', 'Department of Energy') +
    ' ties longer distribution production to specifications that differ from utility to utility. Freezing rating, voltages, impedance, and accessories before a factory holds a slot is the step those two sources are describing. TransformerPath does not publish a second freeze week of its own.</p>' +
    '<p>The ' + a('https://www.cisa.gov/sites/default/files/2024-09/NIAC_Addressing%20the%20Critical%20Shortage%20of%20Power%20Transformers%20to%20Ensure%20Reliability%20of%20the%20U.S.%20Grid_Report_06112024_508c_pdf_0.pdf', 'NIAC report, June 2024') +
    ' says many utilities use custom designs, which makes volume production impractical, and that the out-years of a five-year capital budget are seldom specific about discrete projects. A slot reserved against a draft specification still has to be reconfirmed when the design is frozen.</p>' +
    '<h2>Reserving a production slot</h2>' +
    '<p>' + a('https://pv-magazine-usa.com/2026/05/11/u-s-transformer-market-faces-severe-supply-constraints-as-lead-times-extend-to-four-years/', 'pv magazine USA, 11 May 2026') +
    ' says some firms purchase production slots before the project site is final, and that others refurbish older equipment until a new unit arrives. The ' +
    a('https://www.powermag.com/wp-content/uploads/2026/01/making-the-connection-executive-summary-september-2025.pdf', 'September 2025 executive summary') +
    ' says long lead times are pushing developers and utilities to secure production slots further ahead, and that this has led to delays and cancellations. The same summary says nearly $1.8 billion of transformer-production investment aimed at North America had been announced since 2023. Those announcements are factory plans. They are not a statement that a named factory has an open slot today.</p>' +
    '<h2>Alternatives when the queue is long</h2>' +
    '<p><b>Mid-tier manufacturers.</b> The <a href="/spare-capacity/">mid-tier list</a> is the tier-2 set already stored in the directory, each row linked to its profile. Use it to find makers outside the largest groups. A capacity cell on that page is filled only when a public, dated source describes a capacity expansion, a new plant, or an announced lead time.</p>' +
    '<p>Profiles with a sourced capacity note:</p><ul>' + sourcedList + '</ul>' +
    '<p><b>Refurbished units.</b> ' + a('https://pv-magazine-usa.com/2026/05/11/u-s-transformer-market-faces-severe-supply-constraints-as-lead-times-extend-to-four-years/', 'pv magazine USA, 11 May 2026') +
    ' says some buyers refurbish older equipment to bridge the wait for a new unit. That article does not name a refurbisher or a price.</p>' +
    '<p><b>Spare units.</b> The ' + a('https://www.energy.gov/sites/default/files/2024-10/EXEC-2022-001242%20-%20Large%20Power%20Transformer%20Resilience%20Report%207-10-24.pdf', 'July 2024 Department of Energy report') +
    ' says long lead times and limited availability of spare large power transformers are a resilience concern. The ' +
    a('https://www.cisa.gov/sites/default/files/2024-09/NIAC_Addressing%20the%20Critical%20Shortage%20of%20Power%20Transformers%20to%20Ensure%20Reliability%20of%20the%20U.S.%20Grid_Report_06112024_508c_pdf_0.pdf', 'NIAC report') +
    ' discusses larger inventories of critical spares. Neither source lists a manufacturer as holding a spare for sale, so this guide does not either.</p>' +
    '<h2>Manufacturers on the mid-tier list</h2>' +
    '<p>' + ROWS.length + ' published profiles are in the tier-2 set. Country is the country on the profile.</p>' +
    makers +
    '<p>Questions about a listing go to <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p>';
}

function ratingLabel(kv) {
  if (kv == null) return '—';
  return String(kv) + ' kV';
}

function capacityCell(row) {
  if (!row.capacity) return '—';
  const note = row.capacity;
  return esc(note.text) + ' <a href="' + esc(note.source_url) + '" target="_blank" rel="noopener">' +
    esc(note.source_label) + '</a> <span class="src">(' + esc(note.date_label) + ')</span>';
}

function spareMain() {
  const regions = [];
  const countries = [];
  ROWS.forEach(function (row) {
    if (row.region && regions.indexOf(row.region) < 0) regions.push(row.region);
    if (row.country && countries.indexOf(row.country) < 0) countries.push(row.country);
  });
  regions.sort();
  countries.sort();
  const regionOptions = regions.map(function (name) {
    return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
  }).join('');
  const countryOptions = countries.map(function (name) {
    return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
  }).join('');
  const body = ROWS.map(function (row) {
    const kv = row.kv == null ? '' : String(row.kv);
    return '<tr id="m-' + esc(row.slug) + '" data-region="' + esc(row.region) + '" data-country="' + esc(row.country) + '" data-kv="' + esc(kv) + '">' +
      '<td data-label="Manufacturer"><a href="' + esc(row.profileHref) + '">' + esc(row.name) + '</a></td>' +
      '<td data-label="Region">' + esc(row.region || '—') + '</td>' +
      '<td data-label="Country">' + esc(row.country || '—') + '</td>' +
      '<td data-label="Highest voltage">' + esc(ratingLabel(row.kv)) + '</td>' +
      '<td data-label="Capacity note">' + capacityCell(row) + '</td>' +
      '<td data-label="Verified"><a class="btn btn-amber btn-sm sc-cta" href="' + esc(row.payHref) + '" data-verified-manufacturer-pay="1" data-track="supplier_verify_started" data-track-manufacturer="' + esc(row.name) + '">Get Verified $499/yr</a></td>' +
      '</tr>';
  }).join('');
  const withNotes = ROWS.filter(function (row) { return row.capacity; }).length;

  return '<nav class="crumbs"><a href="/manufacturers.html">Manufacturers</a> · <a href="/buy-early/">Buy early</a> · Mid-tier manufacturers</nav>' +
    '<h1>Mid-tier transformer manufacturers</h1>' +
    '<p class="lead">These rows are the tier-2 manufacturers in the site directory that already have a profile. Region is the census region for the profile country. Voltage is the highest voltage that profile already states. A missing value is shown as a dash.</p>' +
    '<p>The capacity column is a public, dated note of a capacity expansion, a new plant, or an announced lead time. ' +
    withNotes + ' of ' + ROWS.length + ' rows have such a note. A dash means no note of that kind is on file. The dash is not a statement that the factory is open or full. Ordering ahead is covered in the <a href="/buy-early/">free buying guide</a>. Typical lead times by class and region are on the <a href="/lead-times/">grid lead-time tracker</a>.</p>' +
    '<!--tp-ad-slot-->' +
    '<form class="filters" id="sc-filters" action="/spare-capacity/" method="get">' +
    '<label>Region<select id="sc-region" name="region"><option value="">Any</option>' + regionOptions + '</select></label>' +
    '<label>Country<select id="sc-country" name="country"><option value="">Any</option>' + countryOptions + '</select></label>' +
    '<label>Rating range<select id="sc-rating" name="rating"><option value="">Any</option>' +
    '<option value="le36">Up to 36 kV</option>' +
    '<option value="37-170">37–170 kV</option>' +
    '<option value="171-400">171–400 kV</option>' +
    '<option value="gt400">Above 400 kV</option></select></label>' +
    '</form>' +
    '<p class="sc-count" id="sc-count" aria-live="polite">Showing ' + ROWS.length + ' of ' + ROWS.length + '</p>' +
    '<p class="sc-empty" id="sc-empty">No manufacturer matches these filters.</p>' +
    '<div class="tbl"><table class="sc-table"><thead><tr><th>Manufacturer</th><th>Region</th><th>Country</th><th>Highest voltage</th><th>Capacity note</th><th>Verified</th></tr></thead><tbody id="sc-body">' +
    body + '</tbody></table></div>' +
    '<p class="src">Get Verified uses the existing Verified Manufacturer checkout at $499 for 12 months. After payment, the return path is the <a href="/claim-profile.html?paid=verified_manufacturer#claimForm">claim form</a>.</p>' +
    '<script>' + FILTER_JS + '</script>';
}

const FILTER_JS = [
  '(function(){',
  'var region=document.getElementById("sc-region");',
  'var country=document.getElementById("sc-country");',
  'var rating=document.getElementById("sc-rating");',
  'var rows=[].slice.call(document.querySelectorAll("#sc-body tr"));',
  'var count=document.getElementById("sc-count");',
  'var empty=document.getElementById("sc-empty");',
  'var countryOptions=[].slice.call(country.options);',
  'function inRating(kv,band){',
  'if(!band)return true;',
  'if(kv==="")return false;',
  'var n=Number(kv);',
  'if(band==="le36")return n<=36;',
  'if(band==="37-170")return n>=37&&n<=170;',
  'if(band==="171-400")return n>=171&&n<=400;',
  'if(band==="gt400")return n>400;',
  'return true;',
  '}',
  'function syncCountries(){',
  'var keep=country.value;',
  'var allowed={};',
  'rows.forEach(function(row){',
  'if(region.value&&row.getAttribute("data-region")!==region.value)return;',
  'allowed[row.getAttribute("data-country")]=1;',
  '});',
  'country.innerHTML="";',
  'countryOptions.forEach(function(opt){',
  'if(opt.value&&!allowed[opt.value])return;',
  'country.appendChild(opt);',
  '});',
  'if(keep&&allowed[keep])country.value=keep;else country.value="";',
  '}',
  'function apply(){',
  'var shown=0;',
  'rows.forEach(function(row){',
  'var ok=true;',
  'if(region.value&&row.getAttribute("data-region")!==region.value)ok=false;',
  'if(country.value&&row.getAttribute("data-country")!==country.value)ok=false;',
  'if(!inRating(row.getAttribute("data-kv"),rating.value))ok=false;',
  'row.hidden=!ok;',
  'if(ok)shown++;',
  '});',
  'count.textContent="Showing "+shown+" of "+rows.length;',
  'empty.style.display=shown? "none":"block";',
  '}',
  'region.addEventListener("change",function(){syncCountries();apply();});',
  'country.addEventListener("change",apply);',
  'rating.addEventListener("change",apply);',
  'syncCountries();apply();',
  '})();'
].join('');

function writePage(rel, main) {
  const file = path.join(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pageShell(rel, main));
}

function patchProfiles() {
  let patched = 0;
  ROWS.forEach(function (row) {
    const file = path.join('manufacturers', row.slug, 'index.html');
    let html = fs.readFileSync(file, 'utf8');
    if (html.indexOf('data-tp-spare-capacity="1"') !== -1) return;
    const next = html.replace(/(<p class="lead">[\s\S]*?<\/p>)/, '$1' + copy.PROFILE_CROSSLINK);
    if (next === html) throw new Error('no lead paragraph on ' + file);
    fs.writeFileSync(file, next);
    patched++;
  });
  return patched;
}

writePage('buy-early/index.html', buyEarlyMain());
writePage('spare-capacity/index.html', spareMain());
const patched = patchProfiles();
const noted = ROWS.filter(function (row) { return row.capacity; }).length;
console.log('buy-early and spare-capacity wrote ' + ROWS.length + ' manufacturers, ' + noted + ' capacity notes, ' + patched + ' profiles cross-linked');
