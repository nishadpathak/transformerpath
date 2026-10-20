/* Optional stock flag for a manufacturer listing.
 *
 * availability is one of available_now, remanufactured, in_stock.
 * A row is kept only when availability_source is an https URL and
 * availability_checked is a calendar date. Anything else is ignored,
 * and the listing stays unset.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const claimListing = require('./claim-listing');

const VALUES = {
  available_now: 'Available now',
  remanufactured: 'Remanufactured',
  in_stock: 'In stock'
};

const PRICES = 'Featured $299/yr, Featured + Verified $699/yr, Component Sponsor $199/mo.';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function valid(row) {
  if (!row || !row.slug || !VALUES[row.availability]) return false;
  if (!/^https:\/\/\S+$/.test(String(row.availability_source || ''))) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.availability_checked || ''))) return false;
  return true;
}

function load(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data', 'company-availability.json');
  let doc = { companies: [] };
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { doc = { companies: [] }; }
  const bySlug = {};
  (doc.companies || []).forEach(function (row) {
    if (!valid(row)) return;
    bySlug[String(row.slug).trim().toLowerCase()] = {
      slug: String(row.slug).trim().toLowerCase(),
      availability: row.availability,
      availability_source: row.availability_source,
      availability_checked: row.availability_checked
    };
  });
  return bySlug;
}

function forSlug(slug, map) {
  if (!slug) return null;
  const table = map || load();
  return table[String(slug).trim().toLowerCase()] || null;
}

function chipHtml() {
  return '<button type="button" class="avail-chip" data-shippable-filter="1" aria-pressed="false">Shippable units</button>';
}

function emptyHtml() {
  return '<p class="avail-empty" id="avail-empty" hidden>No listing in this view has a sourced shippable-unit flag.</p>';
}

function chipCss() {
  return '.avail-chip{min-height:44px;border-radius:999px;border:1px solid var(--border);background:var(--card);color:var(--text);padding:8px 14px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer}' +
    '.avail-chip[aria-pressed="true"]{border-color:var(--amber);box-shadow:inset 0 0 0 1px var(--amber)}' +
    '.avail-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}' +
    '.avail-empty{color:var(--muted)}' +
    '.avail-claim{font-size:.78rem;color:var(--muted);line-height:1.45}';
}

function markHtml(row, slug) {
  if (!row || !VALUES[row.availability]) return '';
  const href = claimListing.href(slug || row.slug);
  return '<span class="avail-mark" data-availability="' + esc(row.availability) + '">' +
    '<span class="avail-badge" style="display:inline-block;font-size:.62rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:rgba(245,166,35,.16);border:1px solid var(--amber);color:var(--ink);vertical-align:middle">' +
    esc(VALUES[row.availability]) + '</span> ' +
    '<a class="avail-source" href="' + esc(row.availability_source) + '" target="_blank" rel="noopener">Source</a> ' +
    '<span class="avail-checked">checked ' + esc(row.availability_checked) + '</span> ' +
    '<span class="avail-claim">Seller: <a class="avail-claim-link" href="' + esc(href) + '">claim this listing</a>. ' +
    esc(PRICES) + '</span></span>';
}

function rowAttrs(row) {
  if (!row || !VALUES[row.availability]) return '';
  return ' data-shippable="1" data-availability="' + esc(row.availability) + '"';
}

function filterScript() {
  return '<script>(function(){' +
    'var btn=document.querySelector("[data-shippable-filter=\\"1\\"]");' +
    'if(!btn)return;' +
    'var empty=document.getElementById("avail-empty");' +
    'function apply(){' +
    'var on=btn.getAttribute("aria-pressed")==="true";' +
    'var shown=0;' +
    'var nodes=[].slice.call(document.querySelectorAll(".mk-row"));' +
    'nodes.forEach(function(row){' +
    'var ok=!on||row.getAttribute("data-shippable")==="1"||!!row.querySelector("[data-availability]");' +
    'row.hidden=!ok;' +
    'if(ok)shown++;' +
    '});' +
    'if(empty)empty.hidden=!(on&&shown===0);' +
    '}' +
    'btn.addEventListener("click",function(){' +
    'var on=btn.getAttribute("aria-pressed")==="true";' +
    'btn.setAttribute("aria-pressed",on?"false":"true");' +
    'apply();' +
    '});' +
    'apply();' +
    '})();</script>';
}

module.exports = {
  VALUES: VALUES,
  PRICES: PRICES,
  esc: esc,
  load: load,
  forSlug: forSlug,
  chipHtml: chipHtml,
  emptyHtml: emptyHtml,
  chipCss: chipCss,
  markHtml: markHtml,
  rowAttrs: rowAttrs,
  filterScript: filterScript
};
