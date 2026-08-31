#!/usr/bin/env node
/* build-accessories.js — TransformerPath Transformer Accessories Directory.
 *
 * Generates a verified, searchable directory of transformer accessories
 * manufacturers/suppliers from data/accessories.json, plus a per-company entity
 * page each. Every entry carries a verification_status and verification_date so
 * the directory is honest about what was website-verified vs pending.
 *
 * Categories covered: Buchholz relays, bushings (HV/LV), tap changers (OLTC/DETC),
 * conservator tanks, breathers, radiators/cooling, cooling fans, oil-level and
 * temperature indicators, pressure-relief devices, oil treatment, oil-circulation
 * pumps, monitoring/diagnostic devices, transformer oil/ester, pressboard/insulation,
 * CRGO, copper/CTC, laminated wood, DDP/DPE, test equipment.
 *
 * Run: node build-accessories.js  (part of the Netlify build command).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }

const DATA = JSON.parse(fs.readFileSync('data/accessories.json', 'utf8'));
const SUPPLIERS = DATA.suppliers || [];
const CATEGORIES = DATA.categories || [];

function catPills(list) { return (list || []).map((c) => '<span class="tpill">' + esc(c) + '</span>').join(' '); }

function page(s) {
  const slug = slugify(s.name);
  const url = 'https://transformerpath.com/accessories/' + slug + '/';
  const loc = [s.city, s.state, s.country].filter(Boolean).join(', ');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(s.name) + ' — Transformer Accessories Supplier | TransformerPath</title>' +
    '<meta name="description" content="' + esc(s.name) + ' — ' + esc((s.categories || []).join(', ')) + ' transformer accessories/supplier (' + esc(loc) + '). ' + esc((s.description || '').slice(0, 140)) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(s.name) + ' — Transformer Accessories Supplier"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=5"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: s.name, url: s.website || url, description: (s.description || '').slice(0, 200), address: { '@type': 'PostalAddress', addressLocality: s.city, addressRegion: s.state, addressCountry: s.country } }) + '</script>' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.c-wrap .evmeta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap ul{padding-left:20px;line-height:1.7}.c-wrap table{width:100%;border-collapse:collapse;margin:10px 0}.c-wrap table th{text-align:left;color:var(--muted);font-weight:600;padding:6px 10px;border-bottom:1px solid var(--border);width:38%}.c-wrap table td{padding:6px 10px;border-bottom:1px solid var(--border);color:var(--text)}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../accessories.html" style="color:var(--accent)">Accessories</a> › ' + esc(s.name) + '</nav>' +
    '<h1>' + esc(s.name) + '</h1>' +
    '<div class="evmeta"><span><b>Country</b> ' + esc(s.country) + '</span>' + (s.state ? '<span><b>State</b> ' + esc(s.state) + '</span>' : '') + (s.city ? '<span><b>City</b> ' + esc(s.city) + '</span>' : '') + (s.website ? '<span><a href="' + esc(s.website) + '" target="_blank" rel="noopener" style="color:var(--accent)">Official website ↗</a></span>' : '') + (s.email ? '<span><b>Email</b> ' + esc(s.email) + '</span>' : '') + '</div>' +
    '<p class="lead">' + esc(s.description) + '</p>' +
    '<h2>Product categories</h2><div style="margin:4px 0 8px">' + catPills(s.categories) + '</div>' +
    '<h2>Company record</h2><table>' +
    '<tr><th>Company</th><td>' + esc(s.name) + '</td></tr>' +
    '<tr><th>Location</th><td>' + esc(loc || '—') + '</td></tr>' +
    '<tr><th>Accessory categories</th><td>' + esc((s.categories || []).join(', ')) + '</td></tr>' +
    (s.founded_year ? '<tr><th>Founded</th><td>' + esc(String(s.founded_year)) + '</td></tr>' : '') +
    (s.certifications && s.certifications.length ? '<tr><th>Certifications / standards</th><td>' + esc((s.certifications || []).join(', ')) + '</td></tr>' : '') +
    '<tr><th>Verification</th><td>' + esc(s.verification_status) + ' · ' + esc(s.verification_date || '') + '</td></tr>' +
    '</table>' +
    '<p style="font-size:.78rem;color:var(--muted);margin-top:8px">Directory entries are informational supplier listings and do not imply verification, endorsement or commercial affiliation. Verification reflects a website check on the date recorded; always carry out your own due diligence before a commercial decision.</p>' +
    '<div class="card" style="background:rgba(245,166,35,.06);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Supply transformer accessories?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Get your company listed in the directory, or post a requirement to reach accessory suppliers.</p>' +
    '<a class="btn btn-amber" href="../../list-company.html" data-track="supplier_claim_started">Get listed</a> <a class="btn btn-outline btn-sm" href="../../rfq.html" data-track="rfq_started">Submit an RFQ</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}

// Directory index page is generated by build-accessories.html (data-driven client-side).
// This builder only generates the per-supplier entity pages.
// Generate a small meta file for the index page to consume.
fs.mkdirSync('accessories', { recursive: true });
let built = 0, indexable = 0;
SUPPLIERS.forEach((s) => {
  try {
    if (/^(Inactive|Unverified)$/i.test(s.verification_status || '')) return; // don't generate pages for inactive/unverified
    const slug = slugify(s.name);
    fs.mkdirSync('accessories/' + slug, { recursive: true });
    fs.writeFileSync('accessories/' + slug + '/index.html', page(s));
    built++; if (/verified/i.test(s.verification_status || '')) indexable++;
  } catch (e) { console.error('!! ' + s.name + ' failed: ' + e.message); }
});
console.log('accessory supplier entity pages:', built, '| verified (index,follow):', indexable);

fs.writeFileSync('data/accessories-meta.json', JSON.stringify({ total: indexable, categories: CATEGORIES }, null, 2));
