#!/usr/bin/env node
/* build-materials-pages.js — Materials Intelligence pages.
 *
 * Generates:
 *   /materials         — Transformer Materials Intelligence index
 *   /materials/crgo    — CRGO Electrical Steel Market Monitor
 *
 * Every figure comes from data/materials.json (provenance-complete). HONESTY:
 * copper/aluminium are the LME reference (dated, sourced, not live); CRGO is
 * presented as having no single global price with the reasons WHY prices differ
 * (market, grade, loss class, Hi-B vs conventional, thickness, width, form,
 * basis, tariff, freight) and the table shows GRADE NOT SPECIFIED rather than a
 * guessed figure. No fabricated numbers.
 *
 * Run: node build-materials-pages.js  (after build-materials.js).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DATA = JSON.parse(fs.readFileSync('data/materials.json', 'utf8'));
const MATS = DATA.materials || [];

fs.mkdirSync('materials', { recursive: true });

// ── /materials index ──────────────────────────────────────────────────────
function materialsIndex() {
  const style = '.mt-wrap{max-width:1080px;margin:0 auto;padding:44px 20px 96px}.mt-wrap h1{font-size:2rem;color:var(--ink)}.mt-wrap .lead{color:var(--muted);font-size:1.02rem;max-width:900px;margin:8px 0 20px}.mt-note{color:var(--muted);font-size:.82rem;max-width:900px;margin:8px 0 24px}.mt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.mt-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px}.mt-card h3{font-size:1.05rem;color:var(--ink);margin:0 0 6px}.mt-card .val{font-size:1.5rem;font-weight:800;color:var(--accent);margin:2px 0}.mt-card .meta{color:var(--muted);font-size:.78rem;line-height:1.6}.mt-card .basis{display:inline-block;font-size:.66rem;font-weight:700;letter-spacing:.04em;padding:1px 7px;border-radius:8px;text-transform:uppercase;margin-left:6px}.basis-CURRENT_REFERENCE{background:#0f3a2a;color:#34d399}.basis-AGING{background:#12283f;color:#60a5fa}.basis-STALE{background:#3a2c0f;color:#fbbf24}.basis-HISTORICAL{background:#1d2330;color:#9fb0c4}.mt-card a{color:var(--accent);font-weight:700}.mt-h2{font-size:1.2rem;color:var(--ink);margin:26px 0 8px}.mt-fig{color:var(--muted);font-size:.8rem;max-width:900px;line-height:1.6}';
  const cards = MATS.map((m) => {
    const src = m.price != null ? '≈ ' + m.price.toLocaleString('en-US') + ' ' + m.unit.replace(/^USD \//, '') : 'No established public reference';
    // P0 freshness_status (falls back to legacy delay_type/basis). Never "live".
    const fs_ = m.freshness_status || m.delay_type || 'HISTORICAL';
    const basis = m.basis || m.price_basis || 'NOT VERIFIED';
    const meta = (m.market ? '<span>Market: ' + esc(m.market) + '</span> · ' : '') +
      (m.observation_date ? '<span>Observed: ' + esc(m.observation_date) + '</span> · ' : '') +
      '<span>Basis: ' + esc(basis) + '</span> · ' +
      (m.source ? '<span>Source: ' + esc(m.source) + '</span>' : '<span>Source: no public reference</span>') +
      '<br>' + (m.observation_date ? '<span class="mt-fig">Retrieved: ' + esc(m.retrieved_at || '—') + ' · freshness: ' + esc(fs_) + '</span>' : '');
    return '<div class="mt-card"><h3>' + esc(m.material) + '</h3><div class="val">' + esc(src) + '<span class="basis ' + esc(fs_) + '">' + esc(fs_) + '</span></div><div class="meta">' + meta + '</div>' +
      (m.notes ? '<div class="mt-fig" style="margin-top:6px">' + esc(m.notes) + '</div>' : '') + '</div>';
  }).join('');
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Transformer Materials Intelligence — Copper, Aluminium, CRGO | TransformerPath</title>' +
    '<meta name="description" content="Transformer Materials Intelligence — copper, aluminium, CRGO/electrical steel, transformer oil, ester, pressboard and tank steel. Reference prices with observation dates and sources. CRGO has no single global price — grades, markets and commercial basis are explained.">' +
    '<link rel="canonical" href="https://transformerpath.com/materials.html"><meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="Transformer Materials Intelligence"><meta property="og:url" content="https://transformerpath.com/materials.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any"><link rel="stylesheet" href="style.css?v=12"><style>' + style + '</style></head><body>\n' + HEAD + '\n<main class="mt-wrap">' +
    '<h1>Transformer <span style="color:var(--accent)">Materials</span> Intelligence</h1>' +
    '<p class="lead">Input-cost signal for transformer sourcing. Copper and aluminium use the LME 3-month official settlement as the <b>latest market reference</b> (dated, sourced, labelled with a freshness status — never presented as a live feed). CRGO and other materials have no public daily index — they are shown as unavailable with the reasons explained, rather than invented.</p>' +
    '<div class="mt-note"><b style="color:var(--text)">Honesty statement:</b> ' + esc(DATA.honesty_note || '') + '</div>' +
    '<div class="mt-note" style="margin-top:0"><b style="color:var(--text)">Freshness scale:</b> ' + esc(DATA.freshness_scale || '') + '</div>' +
    '<div class="mt-grid">' + cards + '</div>' +
    '<h2 class="mt-h2">Focused monitors</h2>' +
    '<div class="mt-grid"><div class="mt-card"><h3>CRGO Electrical Steel</h3><div class="val">No single global price</div><div class="meta">Market · Grade · Thickness · Basis</div><div class="mt-fig" style="margin-top:6px">Prices legitimately differ by market, grade, loss class and commercial basis. See the market monitor for why, and the full context.</div><a href="materials/crgo/">Open CRGO Market Monitor &rarr;</a></div></div>' +
    '<p class="mt-fig" style="margin-top:20px">Material references are the LME 3-month official settlement (reference) where available and are clearly labelled; they are not live feeds and must be verified against the official source for a commercial decision. See the <a href="methodology.html" style="color:var(--accent)">research methodology</a>.</p>' +
    (function () { try { return fs.readFileSync('_partials/feedback-inline.html', 'utf8'); } catch (e) { return ''; } })() +
    '</main>\n' + FOOT + '\n<script src="analytics.js" defer></script>\n</body>\n</html>';
}
fs.writeFileSync('materials.html', materialsIndex());
console.log('materials.html wrote (' + MATS.length + ' materials)');

// ── /materials/crgo — CRGO Market Monitor ─────────────────────────────────
function crgoPage() {
  const style = '.cr-wrap{max-width:1040px;margin:0 auto;padding:44px 20px 96px}.cr-wrap h1{font-size:2rem;color:var(--ink)}.cr-wrap .lead{color:var(--muted);font-size:1.02rem;max-width:860px;margin:8px 0 20px}.cr-h2{font-size:1.15rem;color:var(--ink);margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}.cr-note{color:var(--muted);font-size:.82rem;max-width:860px;margin:8px 0 18px}.cr-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:12px}.cr-card h3{font-size:1.02rem;color:var(--ink);margin:0 0 6px}.cr-card p{color:var(--text);line-height:1.7;font-size:.92rem;margin:0}.cr-row{color:var(--muted);font-size:.82rem;max-width:860px;line-height:1.7;margin:6px 0}.cr-tbl{width:100%;border-collapse:collapse;font-size:.86rem}.cr-tbl th{text-align:left;color:var(--muted);font-weight:800;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;border-bottom:2px solid var(--border)}.cr-tbl td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top}.cr-tbl .na{color:var(--muted)}';
  // Why prices differ factors
  const factors = [
    ['Market', 'China, India, Europe, USA, Japan/Korea and others each have their own steel supply, demand and trade position; there is no single global market.' ],
    ['Grade', 'Conventional CRGO (M-3/M-4), Hi-B grain-oriented, and domain-refined/laser-scribed differ in loss and permeability — and in price.' ],
    ['Loss class', 'Lower specific loss (W/kg) grades cost more. Two prices with different loss classes are not comparable.' ],
    ['Thickness', '0.23 mm, 0.27 mm, 0.30 mm, 0.35 mm and thinner gauge affect hysteresis/eddy loss and price.' ],
    ['Form & width', 'Slit coil, full-width coil, and cut/sheet forms differ in yield and unit cost.' ],
    ['Commercial basis', 'FOB, CIF, EXW, domestic, delivered and market-reference bases are NOT comparable without adjustment.' ],
    ['Tariff & freight', 'Trade barriers, freight and delivery terms shift the landed cost between markets.' ],
    ['Volume & relationship', 'Negotiated annual volumes and long-term supplier relationships change the effective price.' ],
  ];
  const factorsHtml = factors.map((f) => '<div class="cr-card"><h3>' + esc(f[0]) + '</h3><p>' + esc(f[1]) + '</p></div>').join('');
  const table = '<table class="cr-tbl"><thead><tr><th>Market</th><th>Grade</th><th>Thickness</th><th>Price</th><th>Currency/unit</th><th>Basis</th><th>Observation</th><th>Source</th><th>Trend</th></tr></thead><tbody>' +
    '<tr><td>China</td><td class="na">GRADE NOT SPECIFIED</td><td class="na">—</td><td class="na">No verified reference</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td></tr>' +
    '<tr><td>India</td><td class="na">GRADE NOT SPECIFIED</td><td class="na">—</td><td class="na">No verified reference</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td></tr>' +
    '<tr><td>Europe</td><td class="na">GRADE NOT SPECIFIED</td><td class="na">—</td><td class="na">No verified reference</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td></tr>' +
    '<tr><td>USA</td><td class="na">GRADE NOT SPECIFIED</td><td class="na">—</td><td class="na">No verified reference</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td></tr>' +
    '<tr><td>Japan / Korea</td><td class="na">GRADE NOT SPECIFIED</td><td class="na">—</td><td class="na">No verified reference</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td></tr>' +
    '<tr><td>Other (reliable)</td><td class="na">GRADE NOT SPECIFIED</td><td class="na">—</td><td class="na">No verified reference</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td><td class="na">—</td></tr>' +
    '</tbody></table>' +
    '<p class="cr-row"><b style="color:var(--text)">Trend:</b> a 30/90/365-day trend is only shown where enough dated observations exist. With no verified grade- and basis-specific reference, no trend is invented here.</p>';
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>CRGO Electrical Steel Market Monitor | TransformerPath</title>' +
    '<meta name="description" content="CRGO (grain-oriented electrical steel) market monitor for transformer cores. There is no single global CRGO exchange price — it varies by market, grade, loss class, thickness, form and commercial basis. Grade-specific, basis-specific figures are shown only where verified.">' +
    '<link rel="canonical" href="https://transformerpath.com/materials/crgo/"><meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="CRGO Electrical Steel Market Monitor"><meta property="og:url" content="https://transformerpath.com/materials/crgo/"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg"><link rel="icon" href="../../brand/favicon.ico" sizes="any"><link rel="stylesheet" href="../../style.css?v=12"><style>' + style + '</style></head><body>\n' + HEAD + '\n<main class="cr-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../materials.html" style="color:var(--accent)">Materials</a> › CRGO</nav>' +
    '<h1>CRGO Electrical Steel <span style="color:var(--accent)">Market Monitor</span></h1>' +
    '<p class="lead"><b>There is no single global CRGO exchange price.</b> Grain-oriented electrical steel is a negotiated, grade-specific material. A single US or China figure with no grade, thickness and basis is not a comparable price — so TransformerPath shows CRGO as <b>GRADE NOT SPECIFIED</b> until a verified, grade- and basis-specific reference exists.</p>' +
    '<div class="cr-note"><b style="color:var(--text)">Why prices differ:</b> CRGO price varies according to the factors below. Comparing two prices without matching these is misleading; that is why a single "global CRGO number" is not shown.</div>' +
    '<div class="cr-h2">Factors that determine CRGO price</div>' + factorsHtml +
    '<div class="cr-h2">Reference table <span style="font-size:.9rem;color:var(--muted);font-weight:600;text-transform:none">(grade- and basis-specific verified figures only)</span></div>' +
    table +
    '<p class="cr-row" style="margin-top:16px"><b style="color:var(--text)">Honesty note:</b> each cell shows no verified figure rather than an estimate. Where a market publishes a good, grade-specific reference it will be added with its observation date, market, basis and source. Unknown &gt; incorrect. See <a href="../../materials.html" style="color:var(--accent)">Transformer Materials Intelligence</a> and the <a href="../../methodology.html" style="color:var(--accent)">research methodology</a>.</p>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js" defer></script>\n</body>\n</html>';
}
fs.mkdirSync('materials/crgo', { recursive: true });
fs.writeFileSync('materials/crgo/index.html', crgoPage());
console.log('materials/crgo/index.html wrote (CRGO Market Monitor)');
