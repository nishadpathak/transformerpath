/* Autodesk affiliate placements. The only base URL and sub-ID parameter
 * name live in data/autodesk-affiliate.json. Pages render one note from
 * this module. tp-autodesk.js rewrites the href from the same file once
 * baseUrl is an https URL, so the live CJ link is a one-line swap. */
'use strict';
const fs = require('fs');
const path = require('path');

const CONFIG_REL = 'data/autodesk-affiliate.json';
const ROOT = path.join(__dirname, '..');

function load() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG_REL), 'utf8'));
  if (!cfg || typeof cfg.baseUrl !== 'string' || !cfg.baseUrl) throw new Error('autodesk affiliate baseUrl missing');
  if (!cfg.subIdParam || !/^[A-Za-z][A-Za-z0-9_]{0,20}$/.test(cfg.subIdParam)) {
    throw new Error('autodesk affiliate subIdParam missing');
  }
  if (!Array.isArray(cfg.placements) || !cfg.placements.length) throw new Error('autodesk affiliate placements missing');
  return cfg;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Join base + sub-ID. A base that already has a query keeps it and adds
 * the parameter with &. A trailing ? or & is left as the joiner. */
function hrefFor(baseUrl, param, sid) {
  const base = String(baseUrl || '');
  const key = String(param || '');
  const id = encodeURIComponent(String(sid || ''));
  if (!base || !key || !sid) return '';
  if (/[?&]$/.test(base)) return base + key + '=' + id;
  if (base.indexOf('?') !== -1) return base + '&' + key + '=' + id;
  return base + '?' + key + '=' + id;
}

function placementByPage(page, cfg) {
  const list = (cfg || load()).placements;
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].page === page) return list[i];
  }
  return null;
}

function noteHtml(placement, cfg) {
  if (!placement) return '';
  const config = cfg || load();
  const href = hrefFor(config.baseUrl, config.subIdParam, placement.sid);
  const dark = placement.tone === 'dark';
  const color = dark ? 'color:#c5d0dc' : 'color:var(--muted,#5b6b7f)';
  const linkStyle = dark ? ' style="color:#f5a623"' : '';
  return '<p class="tp-adsk" data-tp-autodesk="' + esc(placement.sid) + '" style="font-size:.82rem;line-height:1.45;margin:12px 0;' + color + '">' +
    esc(placement.lead) + ' ' +
    '<a href="' + esc(href) + '" rel="sponsored noopener" target="_blank" data-tp-autodesk-link' + linkStyle + '>' + esc(placement.label) + '</a> ' +
    '<span>Affiliate link</span>' +
    ' · <a href="/affiliate-disclosure.html"' + linkStyle + '>Affiliate disclosure</a></p>';
}

function scriptTag() {
  return '<script src="/tp-autodesk.js" defer></script>';
}

function blockForPage(page) {
  const cfg = load();
  const placement = placementByPage(page, cfg);
  if (!placement) return '';
  return noteHtml(placement, cfg) + '\n' + scriptTag();
}

module.exports = {
  CONFIG_REL: CONFIG_REL,
  load: load,
  esc: esc,
  hrefFor: hrefFor,
  placementByPage: placementByPage,
  noteHtml: noteHtml,
  scriptTag: scriptTag,
  blockForPage: blockForPage
};
