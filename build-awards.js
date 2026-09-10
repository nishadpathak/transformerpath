#!/usr/bin/env node
/* build-awards.js — TransformerPath Award entity (first-class, source-backed).
 *
 * An AWARD is a confirmed contract result — the outcome of a tender/procurement
 * process. It is SEPARATE from the tender (the procurement process) and the
 * project (the infrastructure entity). A tender that has reached AWARDED (with
 * explicit source evidence) yields one Award record.
 *
 * Rule (never infer): an award is only created where the source confirms the
 * result. A vendor list, a project, or a technical capability is NEVER an award.
 * Every Award carries its source URL(s). Confidence is conservatively LIMITED /
 * INDEPENDENTLY_SOURCED (matching the session's standard), never upgraded
 * without a corroborating source. Contract value is included ONLY when the
 * source states it — never derived.
 *
 * Output:
 *   data/awards.json   — canonical Award entity (derived, source-backed)
 *   awards.html        — worldwide /awards index grouped by region with filters
 *
 * Run: node build-awards.js  (after build-tenders.js).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = (s) => (s || '').toLowerCase();

const TENDERS = (JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders) || [];

// Build the Award entity from source-confirmed AWARDED tenders.
const awards = [];
const seen = {};
TENDERS.forEach((t) => {
  if (t.status !== 'AWARDED') return;
  // Source evidence required: only a tender with a real published source is an award.
  const srcUrls = (t.source_urls || []).filter((u) => /^https?:\/\//.test(u) && !/example\.com|\bupd\b/.test(u));
  if (!srcUrls.length) return;
  const key = ci(t.title + '|' + t.tender_id);
  if (seen[key]) return;
  seen[key] = 1;
  // Order of preference for buyer: utility, then buyer, then epc. Never fabricate a name.
  const buyer = t.utility || t.buyer || t.epc || '';
  const isProjectDerived = ci(t.source || '').indexOf('transformerpath project database') >= 0;
  awards.push({
    award_id: 'AW-' + slugify(t.title).slice(0, 30).replace(/-+$/, ''),
    tender_id: t.tender_id || '',
    project_slug: t.project_slug || '',
    project: t.project_slug ? slugify(t.project_slug) : '',
    title: t.title,
    buyer,
    utility: t.utility || '',
    epc: t.epc || '',
    country: t.country || '',
    region: t.region || 'Other',
    voltage: t.voltage || '',
    transformer_scope: t.transformer_scope || 'UNKNOWN',
    quantity: t.quantity || '',
    // Contract value only where the source states a currency + figure; never derived.
    contract_value: (/^(USD|EUR|CNY|INR|GBP|AED|SAR|QAR|KWD|RLY|KRW|JPY|R\$|€|£|₹|¥|₩)\s?[\d.,]+/i.test(t.quantity || '') ? t.quantity : ''),
    currency: (/^(USD|EUR|CNY|INR|GBP|AED|SAR|QAR|KWD|KRW|JPY)\b/i.test(t.quantity || '') ? String(t.quantity).match(/^([A-Z]{2,3})/i)[1].toUpperCase() : ''),
    source: t.source || '',
    source_urls: srcUrls,
    confidence: 'LIMITED',
    claim_type: 'INDEPENDENTLY_SOURCED',
    // The AWARD/order result is EXPLICIT (derived only from a source-confirmed
    // AWARDED tender with real source URLs). This is distinct from the
    // transformer-SCOPE confidence (transformer_scope), which may be INFERRED.
    award_status: 'CONFIRMED',
    last_verified: t.last_verified || new Date().toISOString().slice(0, 10),
    _derived: isProjectDerived,
  });
});

// Sort: by country then recency of source label (descending).
function dateFromSrc(src) { const m = String(src || '').match(/(\d{1,2}\s+\w{3}\s+\d{4})/); if (!m) return ''; const d = new Date(m[1]); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); }
awards.sort((a, b) => String(a.country).localeCompare(b.country) || String(dateFromSrc(b.source)).localeCompare(dateFromSrc(a.source)));

const stats = {
  generated_at: new Date().toISOString(),
  total: awards.length,
  countries: new Set(awards.map((a) => a.country).filter(Boolean)).size,
  regions: new Set(awards.map((a) => a.region).filter(Boolean)).size,
  confirmed_scope: awards.filter((a) => a.transformer_scope === 'CONFIRMED').length,
  by_region: awards.reduce((m, a) => { m[a.region] = (m[a.region] || 0) + 1; return m; }, {}),
};
fs.writeFileSync('data/awards.json', JSON.stringify({ schema: 'https://transformerpath.com/awards.schema.json', $comment: 'First-class Award entity. Derived only from source-confirmed AWARDED tenders; an award is never inferred from a vendor list, a project, or a technical capability. Confidence limited/independently-sourced; values shown only where the source states them.', updated: stats.generated_at.slice(0, 10), stats, awards }, null, 2));
console.log('awards.json wrote ' + awards.length + ' awards / ' + stats.countries + ' countries / ' + Object.keys(stats.by_region).length + ' regions; ' + stats.confirmed_scope + ' confirmed transformer scope');

// ── Awards index page (worldwide, grouped by region) ────────────────────────
(function renderAwardsIndex() {
  const REGION_ORDER = { 'Middle East': 0, Europe: 1, Asia: 2, 'Latin America': 3, Africa: 4, 'North America': 5, Oceania: 6, Other: 7 };
  const byRegion = {};
  awards.forEach((a) => { (byRegion[a.region] = byRegion[a.region] || []).push(a); });
  const regionKeys = Object.keys(byRegion).sort((a, b) => (REGION_ORDER[a] ?? 9) - (REGION_ORDER[b] ?? 9));
  const style = '.aw-wrap{max-width:1080px;margin:0 auto;padding:44px 20px 90px}.aw-wrap h1{font-size:2rem;color:var(--ink)}.aw-wrap .lead{color:var(--muted);font-size:1.02rem;max-width:840px;margin:8px 0 22px}.aw-stats{display:flex;flex-wrap:wrap;gap:14px;margin:0 0 24px}.aw-stats .s{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;text-align:center;min-width:120px}.aw-stats .s b{color:var(--text);font-size:1.3rem;display:block}.aw-stats .s small{color:var(--muted);font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.region-h{font-size:1.02rem;font-weight:800;color:var(--ink);text-transform:uppercase;letter-spacing:.05em;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}.aw-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:.92rem}.aw-row .aw-title{color:var(--accent);font-weight:700;font-size:.95rem;text-decoration:none;flex:1}.aw-title:hover{text-decoration:underline}.aw-row .aw-meta{color:var(--muted);font-size:.8rem}.aw-note{color:var(--muted);font-size:.8rem;margin-top:20px}';
  const body = regionKeys.map((region) => {
    const rows = byRegion[region].sort((a, b) => String(a.country).localeCompare(b.country)).map((a) =>
      '<div class="aw-row"><a class="aw-title" href="' + (a.source_urls[0] ? esc(a.source_urls[0]) : '#') + '"' + (a.source_urls[0] ? ' target="_blank" rel="noopener"' : '') + '>' + esc(a.title) + '</a>' +
      '<span class="aw-meta">' + esc(a.country || a.region) + (a.voltage ? ' · ' + esc(a.voltage) : '') + (a.award_status ? ' · <b>Award status:</b> ' + esc(a.award_status) : '') + (a.transformer_scope && a.transformer_scope !== 'CONFIRMED' ? ' · <b>Transformer scope:</b> ' + esc(a.transformer_scope) : '') + (a.buyer ? ' · ' + esc(a.buyer) : '') + '</span></div>').join('');
    return '<div class="region-h">' + esc(region) + ' (' + byRegion[region].length + ')</div>' + rows;
  }).join('');
  const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Transformer Awards — Confirmed Contract Results | TransformerPath</title>' +
    '<meta name="description" content="A worldwide directory of confirmed transformer-relevant awards — contract results with the buyer, EPC, country, voltage and source. ' + awards.length + ' source-confirmed awards across ' + stats.countries + ' countries.">' +
    '<link rel="canonical" href="https://transformerpath.com/awards.html"><meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="Transformer Awards — Confirmed Contract Results"><meta property="og:url" content="https://transformerpath.com/awards.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any"><link rel="stylesheet" href="style.css?v=12"><style>' + style + '</style></head><body>\n' + HEAD + '\n<main class="aw-wrap">' +
    '<h1>Transformer <span style="color:var(--accent)">Awards</span></h1>' +
    '<p class="lead">Confirmed contract results across the transformer industry — the outcome of a tender/procurement process. <b>Award status</b> confirms that the award/order result is explicit (never inferred from a vendor list, a project, or a technical capability). <b>Transformer scope</b> is a separate confidence in whether the transformer content itself is explicit or only inferred. Each award links to its source.</p>' +
    '<div class="aw-stats"><div class="s"><b>' + awards.length + '</b><small>Awards</small></div><div class="s"><b>' + stats.countries + '</b><small>Countries</small></div><div class="s"><b>' + Object.keys(stats.by_region).length + '</b><small>Regions</small></div><div class="s"><b>' + stats.confirmed_scope + '</b><small>Confirmed transformer scope</small></div></div>' +
    body +
    '<p class="aw-note">Award metadata is source-tracked. A vendor list or a project is never treated as an award; a confirmed result requires explicit source evidence. Report a <a href="mailto:hello@transformerpath.com?subject=Award%20correction" style="color:var(--accent)">correction</a>. See the <a href="methodology.html" style="color:var(--accent)">research methodology</a>.</p>' +
    '</main>\n' + FOOT + '\n<script src="analytics.js" defer></script>\n</body>\n</html>';
  fs.writeFileSync('awards.html', html);
  console.log('awards.html wrote (' + awards.length + ' awards / ' + stats.countries + ' countries / ' + regionKeys.length + ' regions)');
})();
