/* Hubs and profiles for directory sections that did not already have a
 * builder: approved vendors, EPC, monitoring software, recycling, and the
 * 20 Nov 2026 manufacturer listings. Outreach flags are not written into HTML.
 * GCC countries render as GCC.
 */
'use strict';
const fs = require('fs');
const outreach = require('./lib/directory-outreach');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function locOf(row) {
  const country = outreach.publicCountry(row.country);
  if (country === 'GCC') return 'GCC';
  return [row.state, country].filter(Boolean).join(', ') || '—';
}

const SECTIONS = [
  { file: 'data/approved-vendors.json', dir: 'approved-vendors', hub: 'approved-vendors.html', title: 'Approved vendors', blurb: 'Transformer manufacturers and insulating-oil suppliers named on a utility approved-vendor list. Free unclaimed listings.' },
  { file: 'data/epc-contractors.json', dir: 'epc', hub: 'epc.html', title: 'EPC & substation builders', blurb: 'Engineering, procurement and construction firms that build substations and transmission projects. Free unclaimed listings.' },
  { file: 'data/monitoring-software.json', dir: 'monitoring', hub: 'monitoring.html', title: 'Transformer monitoring software', blurb: 'Sensors, dissolved-gas tools and asset-management software used on transformers. Free unclaimed listings.' },
  { file: 'data/recycling.json', dir: 'recycling', hub: 'recycling.html', title: 'Recycling & oil disposal', blurb: 'Companies that collect, recycle or dispose of transformer oil and electrical equipment. Free unclaimed listings.' },
  { file: 'data/manufacturer-listings.json', dir: 'manufacturers', hub: 'manufacturer-listings.html', title: 'Manufacturer listings', blurb: 'Transformer manufacturers added as free unclaimed listings. These pages sit beside the main manufacturer census.' }
];

function profile(section, row) {
  const url = 'https://transformerpath.com/' + section.dir + '/' + row.slug + '/';
  const loc = locOf(row);
  const page = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(row.name) + ' — ' + esc(section.title) + ' | TransformerPath</title>' +
    '<meta name="description" content="' + esc((row.description || row.name).slice(0, 180)) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=14"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '</head><body>\n' + HEAD + '\n<main id="main" tabindex="-1" style="max-width:900px;margin:0 auto;padding:44px 20px 88px">' +
    '<nav style="font-size:.8rem;color:var(--muted)"><a href="../../' + section.hub + '">' + esc(section.title) + '</a> › ' + esc(row.name) + '</nav>' +
    '<h1>' + esc(row.name) + '</h1>' +
    (row.category ? '<p style="color:var(--muted)">' + esc(outreach.scrubPublic(row.category)) + '</p>' : '') +
    '<p>' + esc(outreach.scrubPublic(row.description || '')) + '</p>' +
    '<p>Location: ' + esc(loc) + (row.website ? ' · <a href="' + esc(row.website) + '"' + (section.dir === 'manufacturers' ? ' target="_blank" rel="noopener nofollow" data-track="official_website_click" data-track-manufacturer="' + esc(row.name) + '"' : '') + '>Official website</a>' : '') + '</p>' +
    (row.source ? '<p style="font-size:.85rem;color:var(--muted)">Source: ' + esc(row.source) + '. Checked ' + esc(row.last_verified || '—') + '.</p>' : '') +
    '<p style="font-size:.78rem;color:var(--muted)">Unclaimed directory listing. It is not a certification or an endorsement.</p>' +
    (section.dir === 'manufacturers' ? '<p><a href="../../correct-company.html?company=' + encodeURIComponent(row.name) + '" data-track="manufacturer_correction_started" data-track-manufacturer="' + esc(row.name) + '">Suggest a correction →</a></p>' : '') +
    '</main>\n' + FOOT + '\n</body></html>\n';
  if (outreach.leaked(page) || outreach.leakedPlace(page)) throw new Error('outreach or place flag leaked into ' + url);
  fs.mkdirSync(section.dir + '/' + row.slug, { recursive: true });
  fs.writeFileSync(section.dir + '/' + row.slug + '/index.html', page);
}

function hub(section, rows) {
  const publicRows = rows.map(function (row) {
    const copy = outreach.publicCopy(row);
    copy.country = outreach.publicCountry(row.country);
    if (copy.country === 'GCC') copy.state = '';
    return copy;
  });
  const embedded = JSON.stringify(publicRows).replace(/<\/script/gi, '<\\/script');
  if (outreach.leaked(embedded) || outreach.leakedPlace(embedded)) throw new Error('outreach or place flag leaked into ' + section.hub);
  const cards = publicRows.map(function (row) {
    const loc = row.country === 'GCC' ? 'GCC' : ([row.state, row.country].filter(Boolean).join(', ') || '—');
    return '<article class="card" style="padding:16px 18px;margin:0 0 12px">' +
      '<h2 style="margin:0 0 6px;font-size:1.15rem"><a href="/' + section.dir + '/' + esc(row.slug) + '/">' + esc(row.name) + '</a></h2>' +
      '<p style="margin:0 0 6px;color:var(--muted);font-size:.88rem">' + esc(loc) + (row.category ? ' · ' + esc(row.category) : '') + '</p>' +
      '<p style="margin:0 0 8px">' + esc(row.description || '') + '</p>' +
      (row.website ? '<a href="' + esc(row.website) + '">Official website</a>' : '') +
      '</article>';
  }).join('\n');
  const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(section.title) + ' | TransformerPath</title>' +
    '<meta name="description" content="' + esc(section.blurb) + '">' +
    '<link rel="canonical" href="https://transformerpath.com/' + section.hub + '">' +
    '<meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="style.css?v=14"><link rel="stylesheet" href="tp-nav.css?v=15">' +
    '</head><body>\n' + HEAD + '\n<main id="main" tabindex="-1" style="max-width:980px;margin:0 auto;padding:40px 20px 80px">' +
    '<nav style="font-size:.82rem;color:var(--muted)"><a href="directory.html">Directory</a> › ' + esc(section.title) + '</nav>' +
    '<h1>' + esc(section.title) + '</h1>' +
    '<p class="lead" style="color:var(--muted)">' + esc(section.blurb) + '</p>' +
    '<p style="font-weight:800;color:var(--accent)">' + rows.length + ' listings</p>' +
    cards +
    '</main>\n' + FOOT + '\n<script>window.__TP_SECTION__=' + embedded + ';</script>\n</body></html>\n';
  if (outreach.leaked(html) || outreach.leakedPlace(html)) throw new Error('outreach or place flag leaked into ' + section.hub);
  fs.writeFileSync(section.hub, html);
  console.log(section.hub + ' wrote ' + rows.length);
}

SECTIONS.forEach(function (section) {
  if (!fs.existsSync(section.file)) {
    console.log(section.hub + ' skipped, no ' + section.file);
    return;
  }
  const doc = JSON.parse(fs.readFileSync(section.file, 'utf8'));
  const rows = doc.companies || [];
  rows.forEach(function (row) { profile(section, row); });
  hub(section, rows);
});
