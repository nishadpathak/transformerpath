#!/usr/bin/env node
/* build-tender-countries.js — one page per country that has tenders.
 *
 * Run after build-tenders.js and build-awards.js.
 * Each tender links to its entity page. An award link is added only when
 * awards.json has a sourced award for that tender_id. Manufacturers are
 * census rows filed under the country. They are directory matches.
 */
'use strict';
const fs = require('fs');
const {
  slugify, groupTenders, directoryGroupsFor, makerRows
} = require('./lib/tender-countries');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const TENDERS = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders || [];
const AWARDS = JSON.parse(fs.readFileSync('data/awards.json', 'utf8')).awards || [];
const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const SLUGS = (() => {
  const map = {};
  try {
    JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (row) {
      if (row && row.name && row.slug) map[row.name] = row.slug;
    });
  } catch (e) {}
  return map;
})();

const ORDER = { OPEN: 0, CLOSING_SOON: 1, EXPECTED: 2, EVALUATION: 3, PROCUREMENT_PLAN: 4, FRAMEWORK: 5, MOU: 6, AWARDED: 7, CLOSED: 8, UNKNOWN: 9 };
const byTender = {};
AWARDS.forEach(function (award) {
  if (award && award.tender_id && !byTender[award.tender_id]) byTender[award.tender_id] = award;
});

function httpUrl(url) {
  return /^https?:\/\//i.test(String(url || '')) && !/example\.com/i.test(url);
}

function sourcedAward(tender) {
  const award = tender && byTender[tender.tender_id];
  if (!award) return null;
  const name = String(award.awardee || '').trim();
  const urls = (award.source_urls || []).filter(httpUrl);
  if (!name || !urls.length || !award.tender_id) return null;
  return award;
}

function makerHref(name) {
  const slug = SLUGS[name];
  if (!slug) return '';
  if (!fs.existsSync('manufacturers/' + slug + '/index.html')) return '';
  return '/manufacturers/' + slug + '/';
}

function countryFile(country) {
  const file = 'manufacturers/' + slugify(country) + '.html';
  return fs.existsSync(file) ? '/' + file : '';
}

function fitDesc(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  const tails = [
    ' Directory matches are not a prediction of who will win.',
    ' No winner is inferred.',
    ' Sourced records only.'
  ];
  for (let i = 0; i < tails.length && s.length < 140; i++) {
    if (s.length + tails[i].length <= 160) s += tails[i];
  }
  if (s.length > 160) {
    const cut = s.slice(0, 160);
    const sp = cut.lastIndexOf(' ');
    s = (sp > 120 ? cut.slice(0, sp) : cut).trim();
  }
  return s;
}

function modeRegion(tenders) {
  const counts = {};
  tenders.forEach(function (tender) {
    const region = tender.region || 'Other';
    counts[region] = (counts[region] || 0) + 1;
  });
  return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); })[0] || 'Other';
}

const STYLE = '.c-wrap{max-width:980px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:820px}.c-wrap h2{font-size:1.2rem;color:var(--ink);margin-top:28px}.t-row{padding:10px 0;border-bottom:1px solid var(--border);font-size:.92rem}.t-row a{color:var(--accent);font-weight:700;text-decoration:none}.t-row a:hover{text-decoration:underline}.t-meta{color:var(--muted);font-size:.8rem;display:block;margin-top:3px}.dir-note{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:10px;padding:12px 14px;font-size:.9rem;margin:8px 0 12px}.mk-row{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--border);font-size:.9rem}.mk-row .city{color:var(--muted);font-size:.8rem}.st{display:inline-block;font-weight:700;font-size:.66rem;letter-spacing:.04em;padding:1px 8px;border-radius:8px;text-transform:uppercase}.st-open{background:#14351f;color:#4ade80}.st-expected{background:#2a2413;color:#e8c46a}.st-closing{background:#2a1a13;color:#fb923c}.st-eval{background:#12283f;color:#60a5fa}.st-awarded{background:#0f2a2a;color:#2dd4bf}.st-closed{background:#1d2330;color:#9fb0c4}';
const ST = { OPEN: 'st-open', CLOSING_SOON: 'st-closing', EXPECTED: 'st-expected', EVALUATION: 'st-eval', AWARDED: 'st-awarded', CLOSED: 'st-closed', UNKNOWN: 'st-closed', PROCUREMENT_PLAN: 'st-expected', FRAMEWORK: 'st-expected', MOU: 'st-expected' };

function shell(opts) {
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(opts.title) + '</title>' +
    '<meta name="description" content="' + esc(opts.description) + '">' +
    '<link rel="canonical" href="' + esc(opts.canonical) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(opts.title) + '"><meta property="og:url" content="' + esc(opts.canonical) + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="' + opts.icon + 'brand/favicon.svg"><link rel="stylesheet" href="' + opts.icon + 'style.css?v=14"><style>' + STYLE + '</style><link rel="stylesheet" href="' + opts.icon + 'tp-nav.css?v=14">' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap"' + (opts.attrs || '') + '>' +
    opts.body +
    '</main>\n' + FOOT + '\n<script src="' + opts.icon + 'analytics.js" defer></script>\n</body>\n</html>';
}

function tenderRows(tenders) {
  return tenders.slice().sort(function (a, b) {
    return (ORDER[a.status] - ORDER[b.status]) || String(a.title).localeCompare(String(b.title));
  }).map(function (tender) {
    const award = sourcedAward(tender);
    const slug = slugify(tender.title);
    const status = '<span class="st ' + (ST[tender.status] || 'st-closed') + '">' + esc(tender.statusLabel || tender.status || '') + '</span>';
    const awardHtml = award
      ? '<span class="t-meta">Sourced award: <a data-award-link="1" href="/awards.html#award-' + esc(award.tender_id) + '">' + esc(award.awardee) + '</a></span>'
      : '<span class="t-meta">No sourced award record for this tender.</span>';
    return '<div class="t-row" data-tender-id="' + esc(tender.tender_id) + '" data-award-id="' + esc(award ? award.tender_id : '') + '">' +
      '<a href="/tenders/' + esc(slug) + '/">' + esc(tender.title) + '</a> ' + status +
      '<span class="t-meta">' + esc(tender.country || '') + (tender.utility || tender.buyer ? ' · ' + esc(tender.utility || tender.buyer) : '') + '</span>' +
      awardHtml + '</div>';
  }).join('');
}

function directoryHtml(group) {
  const filed = directoryGroupsFor(MANUF, group.canonical);
  const makers = makerRows(filed);
  const labels = [];
  filed.forEach(function (row) {
    if (labels.indexOf(row.country) < 0) labels.push(row.country);
  });
  const filedText = labels.length ? labels.join(', ') : group.name;
  const note = makers.length
    ? 'Directory matches filed under ' + filedText + ' in the manufacturer directory. These companies are listed for this country. A directory match is not a prediction of who will win these tenders.'
    : 'No manufacturer directory rows are filed under this country. A directory match is not a prediction of who will win these tenders.';
  const list = makers.map(function (maker) {
    const href = makerHref(maker.name);
    const name = href ? '<a href="' + esc(href) + '">' + esc(maker.name) + '</a>' : '<b>' + esc(maker.name) + '</b>';
    const countryHref = countryFile(maker.filedUnder);
    const more = countryHref ? ' · <a href="' + esc(countryHref) + '">All ' + esc(maker.filedUnder) + ' directory rows</a>' : '';
    return '<div class="mk-row" data-directory-maker="' + esc(maker.name) + '" data-filed-under="' + esc(maker.filedUnder) + '">' +
      name + '<span class="city">' + esc(maker.city || '') + (maker.types ? ' · ' + esc(maker.types) : '') + more + '</span></div>';
  }).join('');
  const countryLinks = filed.map(function (row) {
    const href = countryFile(row.country);
    return href ? '<a href="' + esc(href) + '">All ' + esc(row.country) + ' directory rows</a>' : '';
  }).filter(Boolean);
  return '<h2>Manufacturers active in this country (' + makers.length + ')</h2>' +
    '<p class="dir-note" data-directory-label="1">' + esc(note) + '</p>' +
    (list || '') +
    (countryLinks.length ? '<p class="t-meta">' + countryLinks.join(' · ') + '</p>' : '');
}

const groups = groupTenders(TENDERS);
const slugs = Object.keys(groups).sort(function (a, b) { return groups[a].name.localeCompare(groups[b].name); });

fs.mkdirSync('tenders/country', { recursive: true });
slugs.forEach(function (slug) {
  const group = groups[slug];
  const awardCount = group.tenders.filter(sourcedAward).length;
  const filed = directoryGroupsFor(MANUF, group.canonical);
  const makers = makerRows(filed);
  const description = fitDesc(group.name + ' lists ' + group.tenders.length + ' transformer tenders and ' + makers.length + ' directory manufacturers. Award links appear only where a sourced award record exists.');
  const body = '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="/tenders.html" style="color:var(--accent)">Tenders</a> · <a href="/tenders/countries.html" style="color:var(--accent)">Countries</a> · ' + esc(group.name) + '</nav>' +
    '<h1>' + esc(group.name) + ' transformer tenders</h1>' +
    '<p class="lead">' + group.tenders.length + ' tenders are filed under ' + esc(group.name) + '. Each title links to the tender page. Where a sourced award record exists, the awardee links to that award. Manufacturers below are directory matches, not predictions of who will win.</p>' +
    '<p class="t-meta">' + esc(modeRegion(group.tenders)) + ' · ' + awardCount + ' with a sourced award · <a href="/lead-times.html" style="color:var(--accent)">Lead times and factory capacity</a></p>' +
    '<h2>Tenders (' + group.tenders.length + ')</h2>' +
    tenderRows(group.tenders) +
    directoryHtml(group);
  const html = shell({
    title: group.name + ' transformer tenders',
    description: description,
    canonical: 'https://transformerpath.com/tenders/country/' + slug + '/',
    icon: '../../../',
    attrs: ' data-country="' + esc(group.name) + '" data-canonical-country="' + esc(group.canonical) + '"',
    body: body
  });
  fs.mkdirSync('tenders/country/' + slug, { recursive: true });
  fs.writeFileSync('tenders/country/' + slug + '/index.html', html);
});

fs.readdirSync('tenders/country', { withFileTypes: true }).forEach(function (entry) {
  if (entry.isDirectory() && slugs.indexOf(entry.name) < 0) {
    fs.rmSync('tenders/country/' + entry.name, { recursive: true, force: true });
  }
});

const indexRows = slugs.map(function (slug) {
  const group = groups[slug];
  const awardCount = group.tenders.filter(sourcedAward).length;
  const makers = makerRows(directoryGroupsFor(MANUF, group.canonical));
  return '<div class="t-row"><a href="/tenders/country/' + esc(slug) + '/">' + esc(group.name) + '</a>' +
    '<span class="t-meta">' + group.tenders.length + ' tenders · ' + awardCount + ' sourced awards · ' + makers.length + ' directory matches</span></div>';
}).join('');
const indexDesc = fitDesc('Country pages for ' + slugs.length + ' transformer tender markets. Each page lists that country’s tenders and links a sourced award only when an award record exists.');
const indexHtml = shell({
  title: 'Transformer tenders by country',
  description: indexDesc,
  canonical: 'https://transformerpath.com/tenders/countries.html',
  icon: '../',
  attrs: ' data-country-index="1"',
  body: '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="/tenders.html" style="color:var(--accent)">Tenders</a> · Countries</nav>' +
    '<h1>Transformer tenders by country</h1>' +
    '<p class="lead">One page for each country with a tender on file. A tender stays on the country stored on its record. An award link appears only where a sourced award record exists. Manufacturers on those pages are directory matches, not predictions of who will win. <a href="/lead-times.html" style="color:var(--accent)">Lead times and factory capacity</a> is separate, and free.</p>' +
    indexRows
});
fs.writeFileSync('tenders/countries.html', indexHtml);
console.log('tender country pages wrote ' + slugs.length + ' countries');
