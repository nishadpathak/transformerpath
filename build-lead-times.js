#!/usr/bin/env node
/* build-lead-times.js — free lead-time and factory-capacity tracker.
 *
 * Rows come from lib/lead-time-rows.js. A record without a day or a month
 * is not given one here.
 */
'use strict';
const fs = require('fs');
const { selectRows } = require('./lib/lead-time-rows');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function fitDesc(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  const tail = ' Figures are copied from the source text. No row is added to fill a gap.';
  if (s.length < 140 && s.length + tail.length <= 160) s += tail;
  if (s.length > 160) {
    const cut = s.slice(0, 160);
    const sp = cut.lastIndexOf(' ');
    s = (sp > 120 ? cut.slice(0, sp) : cut).trim();
  }
  return s;
}

const selected = selectRows();
const rows = selected.rows;
const lead = rows.filter(function (row) { return row.kind === 'lead_time'; });
const capacity = rows.filter(function (row) { return row.kind === 'factory_capacity'; });

function table(list) {
  if (!list.length) {
    return '<p class="note">No row in this section has both a source URL and a day or month on the record.</p>';
  }
  const body = list.map(function (row) {
    const checked = row.precision === 'month'
      ? row.lastCheckedLabel + ' (day not stated on the source label)'
      : row.lastCheckedLabel;
    return '<tr data-kind="' + esc(row.kind) + '" data-last-checked="' + esc(row.lastChecked) + '" data-precision="' + esc(row.precision) + '" data-source-url="' + esc(row.sourceUrl) + '">' +
      '<td>' + esc(row.statement) + '<div class="meta">' + esc(row.claimLabel) + '</div></td>' +
      '<td>' + esc(row.figures.join('; ')) + '</td>' +
      '<td><a href="' + esc(row.sourceUrl) + '" target="_blank" rel="noopener">' + esc(row.sourceLabel || 'source') + '</a></td>' +
      '<td>' + esc(checked) + '</td></tr>';
  }).join('');
  return '<div class="tbl"><table><thead><tr><th>What the record says</th><th>Figure in that text</th><th>Source</th><th>Last checked</th></tr></thead><tbody>' + body + '</tbody></table></div>';
}

const description = fitDesc('Free tracker of transformer lead times and factory capacity. Each row is a sourced figure already on file, with the date stored on that record.');
const style = '.c-wrap{max-width:980px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead,.note{color:var(--muted);font-size:1rem;max-width:820px}.c-wrap h2{font-size:1.2rem;color:var(--ink);margin-top:28px}.tbl{overflow-x:auto}.c-wrap table{width:100%;border-collapse:collapse;font-size:.88rem}.c-wrap th,.c-wrap td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--border)}.c-wrap th{color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.03em}.c-wrap a{color:var(--accent)}.meta{color:var(--muted);font-size:.75rem;margin-top:4px}';
const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Lead times and factory capacity</title>' +
  '<meta name="description" content="' + esc(description) + '">' +
  '<link rel="canonical" href="https://transformerpath.com/factory-capacity/">' +
  '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
  '<meta property="og:title" content="Lead times and factory capacity"><meta property="og:url" content="https://transformerpath.com/factory-capacity/">' +
  '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
  '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg"><link rel="stylesheet" href="/style.css?v=14"><style>' + style + '</style><link rel="stylesheet" href="/tp-nav.css?v=14">' +
  '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap" data-lead-times="1">' +
  '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="/tenders.html">Tenders</a> · <a href="/tenders/countries.html">Countries</a> · Lead times</nav>' +
  '<h1>Lead times and factory capacity</h1>' +
  '<p class="lead">Free tracker. Every row is a figure already stored with a source URL and a day or a month. Last checked is that stored date. For a news item it is the publication date on the intel record, not a separate factory audit. For the Virginia Transformer capacity row it is the day that company page was read. A month is shown when the source label names a month and no day. Records with only a year, or with no date, are left off.</p>' +
  '<p class="note">' + rows.length + ' rows · ' + lead.length + ' lead time · ' + capacity.length + ' factory capacity. <a href="/article-lead-times.html">Why lead times got longer</a> is a separate guide. Typical lead times by class and region are on the <a href="/lead-times/">grid lead-time tracker</a>.</p>' +
  '<h2>Lead times (' + lead.length + ')</h2>' + table(lead) +
  '<h2>Factory capacity (' + capacity.length + ')</h2>' + table(capacity) +
  '<h2>Left off this page</h2>' +
  '<ul class="note">' +
  '<li>Intel items whose only date is a year, and intel items that have a URL but no date.</li>' +
  '<li>A development whose stored day does not match the day written in its source label.</li>' +
  '<li>Directory lead-time notes, which have no source URL and no check date.</li>' +
  '<li>Census plants whose capacity note says the figure is not publicly disclosed.</li>' +
  '</ul>' +
  '</main>\n' + FOOT + '\n<script src="/analytics.js" defer></script>\n</body>\n</html>';

fs.mkdirSync('factory-capacity', { recursive: true });
fs.writeFileSync('factory-capacity/index.html', html);
if (fs.existsSync('lead-times.html')) fs.unlinkSync('lead-times.html');
console.log('factory-capacity/index.html wrote ' + rows.length + ' rows (' + lead.length + ' lead time, ' + capacity.length + ' factory capacity); skipped ' + selected.skipped.length);
selected.skipped.forEach(function (item) {
  console.log('  skipped: ' + item.reason + ' — ' + item.title);
});
