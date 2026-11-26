/* Canonical India market page: editorial sources, sourced company links and the
 * shared procurement intake, never a separate tender or company database. */
'use strict';

const seed = require('../data/india-market-hub.json');
const { validateNotice } = require('./tender-notices');
const { parseCloseInstant } = require('./deadline');
const { isOfficialProcurementUrl } = require('./tender-sources');
const { recordOnMarket } = require('./market-country');

const INDIA = { name: 'India' };
const MAX_TENDERS = 6;
const IST = 'Asia/Kolkata';
const clock = new Intl.DateTimeFormat('en-IN', { timeZone: IST, dateStyle: 'medium', timeStyle: 'short' });
const day = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', dateStyle: 'medium' });

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function reference(t) { return String(t.official_reference || t.procurement_id || '').trim(); }

function activeTenderSnapshot(tenders, notices, now = Date.now()) {
  const rows = new Map();
  // The builder runs before build-tenders.js. Read the canonical intake as well
  // as the previous build snapshot, retaining any known terminal market status.
  for (const t of tenders) {
    const id = reference(t);
    if (id && recordOnMarket(t, INDIA)) rows.set(id, t);
  }
  for (const n of notices) {
    if (!recordOnMarket(n, INDIA) || validateNotice(n).length) continue;
    const id = reference(n);
    const prior = rows.get(id);
    if (prior && !['OPEN', 'CLOSING_SOON', 'UNDATED', 'EXPECTED', 'CLOSED'].includes(prior.status)) continue;
    if (prior && prior.status === 'CLOSED' && !(Date.parse(n.close_at) > Date.parse(prior.close_at))) continue;
    rows.set(id, { ...prior, ...n, status: 'OPEN', source_verified: true });
  }
  return [...rows.values()].filter((row) => {
    const official = row.official_source_url || row.official_procurement_url;
    const expiry = parseCloseInstant(row.close_at);
    return row.source_verified && /^https:\/\//i.test(official || '') && isOfficialProcurementUrl(official) && expiry &&
      Date.parse(expiry) > now && ['OPEN', 'CLOSING_SOON'].includes(row.status);
  }).sort((a, b) => {
    const priority = (t) => (seed.tender_priority.indexOf(reference(t)) + 1 || 1000);
    return priority(a) - priority(b) || Date.parse(a.close_at) - Date.parse(b.close_at) ||
      reference(a).localeCompare(reference(b));
  }).slice(0, MAX_TENDERS);
}

function renderHeadings() {
  return '<style>' +
    '.india-jump{display:flex;flex-wrap:wrap;gap:.55rem;margin:1.2rem 0}.india-jump a{display:inline-flex;align-items:center;min-height:44px;padding:6px 12px;border-radius:9px;border:1px solid var(--border);color:var(--accent);font-size:.89rem;font-weight:700;text-decoration:none}.india-jump a:hover{text-decoration:underline}.india-jump a:focus-visible,.india-grid a:focus-visible,.india-module a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}' +
    '.india-module{margin:2rem 0;scroll-margin-top:92px}.india-module h2{margin:0 0 .55rem}.india-module .india-desc,.india-card p{color:var(--muted);font-size:.9rem;line-height:1.55;margin:.4rem 0}.india-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,252px),1fr));gap:.8rem;margin:.95rem 0}.india-card{padding:1rem;min-width:0;overflow-wrap:anywhere;border:1px solid var(--border);background:var(--card);border-radius:12px}.india-card h3{color:var(--ink);font-size:1rem;line-height:1.35;margin:.4rem 0}.india-card a,.india-module a{color:var(--accent)}.india-meta{color:var(--muted);font-size:.78rem}.india-badge{color:var(--text);font-weight:700}.india-card ul{margin:.25rem 0;padding-left:1.1rem}.india-card li+li{margin-top:.75rem}.india-module [hidden]{display:none!important}' +
    '</style>';
}

function renderNav() {
  return '<nav class="india-jump" aria-label="India transformer hub">' +
    '<a href="#sell-into-market">Selling guide</a><a href="#india-tenders">Buyer tenders</a><a href="#india-news">Market news</a>' +
    '<a href="#india-directory">Supplier clusters</a><a href="#india-awards">Award history</a></nav>';
}

function renderTenders(tenders) {
  return '<section class="india-module" id="india-tenders" aria-labelledby="india-tenders-title">' +
    '<h2 id="india-tenders-title">India transformer tenders</h2><p class="india-desc">Selected buyer notices with a published submission time in India Standard Time. Check the official portal for amendments, qualification rules and current status. Notices are not awards.</p>' +
    '<p class="india-desc" data-india-no-open' + (tenders.length ? ' hidden' : '') + '>No selected notices with a future published deadline in this view.</p>' +
    '<div class="india-grid">' + tenders.map((t) => {
      const close = parseCloseInstant(t.close_at);
      const official = t.official_source_url || t.official_procurement_url;
      const checked = t.last_verified && /^\d{4}-\d{2}-\d{2}$/.test(t.last_verified)
        ? ' · Source checked ' + esc(day.format(Date.parse(t.last_verified + 'T12:00:00Z'))) : '';
      return '<article class="india-card" data-listing="tender" data-project-country="India" data-india-close="' + esc(close) + '">' +
        '<span class="india-meta india-badge">Published bid deadline</span><h3>' + esc(t.title) + '</h3>' +
        '<p>' + esc(t.buyer || t.utility) + ' · ' + esc(reference(t)) + '</p>' +
        '<p><b>Bids due:</b> <time datetime="' + esc(close) + '">' + esc(clock.format(Date.parse(close))) + ' IST</time></p>' +
        '<p>' + esc(t.summary || t.snippet) + '</p><a href="' + esc(official) + '" rel="noopener">Official notice</a>' +
        (reference(t).startsWith('500200') ? ' · <a href="https://etender.powergrid.in/" rel="noopener">Find RFx in PRANIT</a>' : '') +
        '<p class="india-meta">' + checked.replace(/^ · /, '') + '</p></article>';
    }).join('') + '</div><p><a href="/tenders/country/india/">All India tenders and status history</a></p></section>' +
    '<script>(function(){var panel=document.getElementById("india-tenders");if(!panel)return;var cards=panel.querySelectorAll("[data-india-close]");var message=panel.querySelector("[data-india-no-open]");function refresh(){var count=0;cards.forEach(function(card){var expiry=Date.parse(card.dataset.indiaClose);card.hidden=!(expiry>Date.now());if(!card.hidden)count++;});message.hidden=count>0;}refresh();window.addEventListener("pageshow",refresh);document.addEventListener("visibilitychange",refresh);if(cards.length)window.setInterval(refresh,30000);})();</script>';
}

function renderNews() {
  const c = seed.market_context;
  return '<section class="india-module" id="india-news" aria-labelledby="india-news-title"><h2 id="india-news-title">India transformer news</h2>' +
    '<p class="india-desc">Selected primary-source developments. Commissioned assets, operating factories and announced investment are not the same.</p><div class="india-grid">' + seed.news.map((n) =>
      '<article class="india-card"><span class="india-meta"><time datetime="' + esc(n.date) + '">' +
      esc(day.format(Date.parse(n.date + 'T12:00:00Z'))) + '</time> · <b>' + esc(n.stage) + '</b></span><h3>' + esc(n.title) +
      '</h3><p>' + esc(n.summary) + '</p><a href="' + esc(n.source) + '" rel="noopener">' + esc(n.publisher) + '</a>' +
      (n.profile ? ' · <a href="' + esc(n.profile) + '">Company profile</a>' : '') + '</article>').join('') +
    '</div><p class="india-desc"><b>' + esc(c.period) + ':</b> ' + esc(c.summary) + ' <a href="' + esc(c.source) + '">IEEMA industry update</a>.</p>' +
    '<p><a href="/intel.html">See the full Daily Intel feed</a></p></section>';
}

function renderDirectory() {
  return '<section class="india-module" id="india-directory" aria-labelledby="india-directory-title"><h2 id="india-directory-title">Browse Indian suppliers by cluster and capability</h2>' +
    '<p class="india-desc">Illustrative companies, not rankings or approved bidders. Confirm which legal entity and plant perform the work and obtain current certificates, test scope and buyer approvals where required.</p>' +
    '<nav class="india-jump" aria-label="Supplier capabilities">' + seed.capabilities.map((c) => '<a href="' + esc(c.path) + '">' + esc(c.name) + '</a>').join('') +
    '</nav><div class="india-grid">' + seed.clusters.map((c) => '<article class="india-card"><h3>' + esc(c.name) + '</h3><ul>' + c.entries.map((d) =>
      '<li>' + (d.profile ? '<a href="' + esc(d.profile) + '"><b>' + esc(d.name) + '</b></a>' : '<b>' + esc(d.name) + '</b>') +
      ' · <span class="india-meta">' + esc(d.role) + '</span><p>' + esc(d.detail) + '</p><a href="' + esc(d.source) + '" rel="noopener" aria-label="' +
      esc('Source for ' + d.name) + '">Source</a></li>').join('') + '</ul></article>').join('') +
    '</div><p><a href="/directory/country/india/">Open the full India directory</a></p></section>';
}

module.exports = { activeTenderSnapshot, renderHeadings, renderNav, renderTenders, renderNews, renderDirectory };
