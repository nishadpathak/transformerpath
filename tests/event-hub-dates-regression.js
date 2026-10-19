#!/usr/bin/env node
/* Series hub copy is the sentence derived from events-canonical.json
 * for the day the page was built. A dated upcoming edition is named.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { seriesFeature } = require('../lib/event-hub-copy');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  PASS  ' + label);
  else {
    failed++;
    console.error('  FAIL  ' + label + (detail ? ' :: ' + detail : ''));
  }
}

const canon = JSON.parse(fs.readFileSync('data/events-canonical.json', 'utf8'));
const groups = {};
(canon.canonical_editions || []).forEach(function (ev) {
  const key = ev.series_slug || ev.id;
  (groups[key] = groups[key] || []).push(ev);
});

function decode(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

let hubs = 0;
Object.keys(groups).forEach(function (slug) {
  const file = path.join('events', slug, 'index.html');
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  if (html.indexOf('data-tp-event-role="hub"') < 0) return;
  hubs++;
  const tag = html.match(/<p id="series-cta"[^>]*>[\s\S]*?<\/p>/);
  if (!tag) {
    check(slug + ' has a series sentence', false);
    return;
  }
  const asof = (tag[0].match(/data-hub-asof="([^"]+)"/) || [])[1];
  const got = decode(tag[0]);
  const want = seriesFeature(groups[slug], asof).text;
  check(slug + ' hub sentence matches the canonical edition', !!asof && got === want, 'got ' + got + ' want ' + want);
});

const wetex = seriesFeature(groups.wetex, '2026-10-16');
check('WETEX on 16 Oct 2026 names the dated edition', wetex.text.indexOf('WETEX 2026') !== -1 && wetex.text.indexOf('20 Oct 2026') !== -1 && wetex.text.indexOf('dates not yet announced') === -1, wetex.text);
check('series hubs were checked', hubs > 12, String(hubs));

if (failed) {
  console.error('EVENT HUB DATES REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EVENT HUB DATES REGRESSION OK');
