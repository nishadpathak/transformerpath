#!/usr/bin/env node
/* Edition pages canonicalise to themselves. A bare series slug is the
 * series hub. Projected and unconfirmed future editions with no source
 * are noindex. Wrong series slugs 301 to the real hub.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const eventSeo = require('../lib/event-seo');
const redirects = require('../lib/event-redirects');
const { loadEvents } = require('../lib/events-reader');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const events = loadEvents();
function byId(id) { return events.find(function (ev) { return ev.id === id; }); }

const asean = byId('asean-sustainable-energy-week-incl-renewable-energy-asia-2026');
check('ASEAN 2026 uses the series slug', asean && asean.series_slug === 'asean-sustainable-energy-week', asean && asean.series_slug);
const uz = byId('power-uzbekistan-19th-energy-exhibition-2026');
check('Power Uzbekistan 2026 uses the series slug', uz && uz.series_slug === 'power-uzbekistan', uz && uz.series_slug);
const de = byId('coiltech-2027');
check('Coiltech Deutschland is not filed under the North America series', de && de.series_slug === 'coiltech-deutschland', de && de.series_slug);

const rules = {};
redirects.RULES.forEach(function (row) { rules[row[0]] = row[1]; });
check('middle-energy 301s to middle-east-energy', rules['/events/middle-energy/'] === '/events/middle-east-energy/');
check('long ASEAN slug 301s to the series hub', rules['/events/asean-sustainable-energy-week-incl-renewable-energy-asia/'] === '/events/asean-sustainable-energy-week/');
check('long Power Uzbekistan slug 301s to the series hub', rules['/events/power-uzbekistan-19th-energy-exhibition/'] === '/events/power-uzbekistan/');

const redirectsFile = fs.readFileSync('_redirects', 'utf8');
check('_redirects publishes the middle-energy 301', redirectsFile.indexOf('/events/middle-energy/  /events/middle-east-energy/  301') !== -1);
const toml = fs.readFileSync('netlify.toml', 'utf8');
check('netlify.toml forces the middle-energy 301', toml.indexOf('from = "/events/middle-energy/"') !== -1 && toml.indexOf('to = "/events/middle-east-energy/"') !== -1);

function head(rel) {
  const file = path.join(rel, 'index.html');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}
function canon(html) {
  const m = html.match(/rel="canonical" href="([^"]+)"/);
  return m ? m[1] : '';
}
function robots(html) {
  const m = html.match(/name="robots" content="([^"]+)"/);
  return m ? m[1] : '';
}

const wetex2027 = head('events/wetex-2027');
const wetexHub = head('events/wetex');
const mee2027 = head('events/middle-east-energy-2027');
const meeHub = head('events/middle-east-energy');
check('WETEX 2027 is noindex', /noindex/.test(robots(wetex2027)), robots(wetex2027));
check('WETEX 2027 canonical is its own year URL', canon(wetex2027) === 'https://transformerpath.com/events/wetex-2027/');
check('WETEX hub is indexable', robots(wetexHub) === 'index,follow', robots(wetexHub));
check('WETEX hub canonical is the series URL', canon(wetexHub) === 'https://transformerpath.com/events/wetex/');
check('WETEX hub lists the editions', wetexHub.indexOf('Editions') !== -1 && wetexHub.indexOf('wetex-2026') !== -1);
check('Middle East Energy 2027 is self-canonical and indexable',
  canon(mee2027) === 'https://transformerpath.com/events/middle-east-energy-2027/' && robots(mee2027) === 'index,follow');
check('Middle East Energy hub is a series list', meeHub.indexOf('data-tp-event-role="hub"') !== -1 && meeHub.indexOf('middle-east-energy-2027') !== -1);
check('retired middle-energy HTML is not a second page', !fs.existsSync('events/middle-energy/index.html'));
check('retired ASEAN long slug is not a second hub', !fs.existsSync('events/asean-sustainable-energy-week-incl-renewable-energy-asia/index.html'));

const projected = events.filter(function (ev) {
  return ev.date_status === 'PROJECTED' && !ev.source_url && ev.id;
});
let projectedIndexed = 0;
projected.forEach(function (ev) {
  const html = head('events/' + ev.id);
  if (html && robots(html).indexOf('noindex') === -1) projectedIndexed++;
});
check('projected editions with no source are noindex', projected.length > 0 && projectedIndexed === 0, projectedIndexed + ' still indexable');

const series = {};
events.forEach(function (ev) {
  const slug = ev.series_slug || ev.id;
  (series[slug] = series[slug] || []).push(ev);
});
let unsourcedFutureSeries = 0;
Object.keys(series).forEach(function (slug) {
  const hit = series[slug].some(function (ev) { return eventSeo.shouldNoindexEdition(ev, '2026-10-15'); });
  if (hit) unsourcedFutureSeries++;
});
console.log('  series with a noindex unsourced edition: ' + unsourcedFutureSeries);
console.log('  series slugs corrected: 4 (middle-east-energy, asean-sustainable-energy-week, power-uzbekistan, coiltech-deutschland)');

if (failed) {
  console.error('EVENT CANONICAL REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EVENT CANONICAL REGRESSION OK');
