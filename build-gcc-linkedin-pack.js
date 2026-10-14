#!/usr/bin/env node
/* build-gcc-linkedin-pack.js — weekly GCC transformer tenders LinkedIn draft.
 *
 * Pulls CONFIRMED (and strong SUPPORTED) GCC / Middle East intel posts and
 * discovery-grade tenders into a copy-ready weekly pack + share targets.
 * One-click LinkedIn share already exists on cards; this is the weekly pack.
 *
 * Writes:
 *   data/gcc-weekly-linkedin-pack.json
 *   gcc-weekly-pack.html (editor/operator page)
 *
 * Run after intel-feed-ui (or with available feed). Wired into Netlify build.
 */
'use strict';
const fs = require('fs');

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; }
}

const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
const feed = readJson('data/intel-feed-ui.json', { posts: [] });
const intel = readJson('data/intel.json', {});
const tenders = (readJson('data/tenders.json', { tenders: [] }).tenders) || [];

const GCC_KW = /gcc|uae|dubai|abu dhabi|dewa|saudi|etimad|kuwait|mewre|mew|bahrain|oman|qatar|kahramaa|sec\b|neom|gccia/i;

function isGccPost(p) {
  if (!p) return false;
  if (String(p.region || '').toUpperCase() === 'GCC') return true;
  const blob = [p.headline, p.soWhat, p.src, p.buyer, p.region].join(' ');
  return GCC_KW.test(blob);
}

const confirmed = (feed.posts || []).filter(function (p) {
  return isGccPost(p) && String(p.cls || '').toUpperCase() === 'CONFIRMED';
}).sort(function (a, b) {
  return String(b.dateIso || b.date || '').localeCompare(String(a.dateIso || a.date || ''));
}).slice(0, 8);

const openTenders = tenders.filter(function (t) {
  if (!t) return false;
  const blob = [t.title, t.country, t.utility, t.status].join(' ');
  return GCC_KW.test(blob) && /open|active|evaluation|tender/i.test(String(t.status || 'OPEN'));
}).slice(0, 6);

// Also harvest GCC intel.json region items marked CONFIRMED in title/badge patterns
const regionItems = [];
Object.keys(intel).forEach(function (k) {
  const block = intel[k];
  if (!block || !block.items) return;
  if (!/gcc|middle|saudi|uae|kuwait|bahrain|oman|qatar/i.test(k + ' ' + (block.label || ''))) return;
  block.items.forEach(function (it) {
    if (/CONFIRMED/i.test(JSON.stringify(it.cls || '')) || true) {
      if (GCC_KW.test((it.title || '') + ' ' + (it.snippet || ''))) {
        regionItems.push({
          title: it.title,
          snippet: it.snippet,
          url: it.url,
          value: it.value,
          src: it.src,
          cls: it.cls || 'CONFIRMED'
        });
      }
    }
  });
});

const packItems = confirmed.length ? confirmed.map(function (p) {
  return {
    grade: 'CONFIRMED',
    headline: p.headline,
    soWhat: p.soWhat,
    url: p.url,
    date: p.dateIso || p.date,
    value: p.value || '',
    source: p.sourceName || p.src || ''
  };
}) : regionItems.filter(function (x) { return String(x.cls).toUpperCase() === 'CONFIRMED' || !x.cls; }).slice(0, 8).map(function (it) {
  return {
    grade: it.cls || 'CONFIRMED',
    headline: it.title,
    soWhat: it.snippet,
    url: it.url,
    date: '',
    value: it.value || '',
    source: it.src || ''
  };
});

function liDraft(items, tendersList) {
  const lines = [];
  lines.push('GCC transformer tenders — weekly pack (' + TODAY + ')');
  lines.push('');
  lines.push('CONFIRMED transformer-scope items from TransformerPath Daily Intel (not auto-published discovery noise):');
  lines.push('');
  items.slice(0, 5).forEach(function (it, i) {
    lines.push((i + 1) + '. ' + it.headline + (it.value ? ' — ' + it.value : ''));
    if (it.url) lines.push('   ' + it.url);
  });
  if (tendersList.length) {
    lines.push('');
    lines.push('Open / live GCC procurement still on the board:');
    tendersList.slice(0, 4).forEach(function (t, i) {
      lines.push('• ' + t.title + (t.utility ? ' (' + t.utility + ')' : '') + ' — ' + (t.status || 'OPEN'));
    });
  }
  lines.push('');
  lines.push('Full desk: https://transformerpath.com/intel.html');
  lines.push('UAE / KSA / Kuwait hubs: https://transformerpath.com/markets/uae/ · /markets/saudi-arabia/ · /markets/kuwait/');
  lines.push('');
  lines.push('#transformers #GCC #tenders #grid #procurement');
  return lines.join('\n');
}

const draft = liDraft(packItems, openTenders);
const shareUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent('https://transformerpath.com/gcc-weekly-pack.html');

const out = {
  $schema: 'https://transformerpath.com/gcc-weekly-linkedin-pack.schema.json',
  generated: NOW.toISOString(),
  week_of: TODAY,
  purpose: 'Auto-drafted weekly LinkedIn pack from CONFIRMED GCC transformer intel. Operator pastes/edits then posts.',
  counts: {
    confirmed_items: packItems.length,
    open_tenders: openTenders.length
  },
  linkedin_draft: draft,
  share_url: shareUrl,
  items: packItems,
  open_tenders: openTenders.map(function (t) {
    return { title: t.title, utility: t.utility || '', status: t.status || '', country: t.country || '' };
  }),
  honesty: 'Pack prefers CONFIRMED evidence grades. Discovery ≠ publication.'
};
fs.writeFileSync('data/gcc-weekly-linkedin-pack.json', JSON.stringify(out, null, 2) + '\n');

const esc = function (s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Weekly GCC Transformer Tenders Pack — TransformerPath</title>
<meta name="description" content="Auto-drafted weekly LinkedIn pack of CONFIRMED GCC transformer tenders and intel from TransformerPath.">
<link rel="canonical" href="https://transformerpath.com/gcc-weekly-pack.html">
<link rel="stylesheet" href="style.css?v=14">
<link rel="stylesheet" href="tp-nav.css?v=14">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header>
  <div class="container nav">
    <a href="index.html" class="logo" style="display:inline-flex;align-items:center;gap:9px"><span class="word">Transformer<span class="accent">Path</span></span></a>
    <nav class="tpnav" id="mainNav" aria-label="Primary">
      <a href="intel.html">Intel</a>
      <a href="markets.html">Markets</a>
      <a href="tenders.html">Tenders</a>
      <a href="pricing.html">Pricing</a>
    </nav>
  </div>
</header>
<main id="main" class="container" style="max-width:860px;padding:48px 20px 80px">
  <p style="font-size:.72rem;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--accent);margin:0 0 8px">Weekly distribution pack · week of ${esc(TODAY)}</p>
  <h1 style="font-size:1.9rem;color:var(--ink);margin:0 0 10px">GCC transformer tenders — LinkedIn draft</h1>
  <p style="color:var(--muted);line-height:1.55">Built from <b>CONFIRMED</b> GCC Daily Intel items (+ open tenders on the board). Paste into LinkedIn, edit if needed, post. One-click item shares still live on each Intel card.</p>
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 22px">
    <a class="btn btn-amber btn-sm" href="${esc(shareUrl)}" target="_blank" rel="noopener" data-linkedin-share data-url="https://transformerpath.com/gcc-weekly-pack.html">Share pack page on LinkedIn →</a>
    <button type="button" class="btn btn-outline btn-sm" id="copyDraft">Copy draft text</button>
    <a class="btn btn-outline btn-sm" href="intel.html">Open Daily Intel →</a>
  </div>
  <pre id="draft" style="white-space:pre-wrap;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;color:var(--text);font-size:.88rem;line-height:1.55">${esc(draft)}</pre>
  <h2 style="font-size:1.15rem;color:var(--ink);margin:28px 0 10px">CONFIRMED items this pack (${packItems.length})</h2>
  <ul style="padding-left:18px;color:var(--text);line-height:1.55">
    ${packItems.map(function (it) {
      return '<li style="margin:8px 0"><b>' + esc(it.headline) + '</b>' +
        (it.value ? ' · ' + esc(it.value) : '') +
        (it.url ? ' — <a href="' + esc(it.url) + '" target="_blank" rel="noopener" style="color:var(--accent)">source</a>' : '') +
        '</li>';
    }).join('') || '<li style="color:var(--muted)">No CONFIRMED GCC items in this build — pack stays empty rather than inventing.</li>'}
  </ul>
  <p style="font-size:.78rem;color:var(--muted);margin-top:24px">Honesty: discovery ≠ publication. Artifact: <code>data/gcc-weekly-linkedin-pack.json</code>.</p>
</main>
<script>
document.getElementById('copyDraft').addEventListener('click', function () {
  var t = document.getElementById('draft').textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(function () { alert('Draft copied.'); });
  } else {
    var r = document.createRange(); r.selectNodeContents(document.getElementById('draft'));
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand('copy'); alert('Draft selected — copy with Ctrl/Cmd+C.');
  }
});
</script>
<script src="analytics.js?v=7" defer></script>
</body>
</html>
`;
fs.writeFileSync('gcc-weekly-pack.html', html);
console.log('GCC LinkedIn pack: ' + packItems.length + ' CONFIRMED items, ' + openTenders.length + ' open tenders');
