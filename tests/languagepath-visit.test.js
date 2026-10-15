#!/usr/bin/env node
/* Visitor-guide block is data on the event, rendered only for that record. */
'use strict';
const fs = require('fs');
const path = require('path');

const COPY = 'Travelling there? Phrases, etiquette and local tips for visitors';
const EXPECT = {
  'wetex-2026': { start: '2026-10-20', end: '2026-10-22', name: /WETEX 2026/, url: 'https://languagepath.org/events/visiting/wetex-2026/' },
  'gcc-power-2026': { start: '2026-11-02', end: '2026-11-04', name: /GCC POWER 2026/, url: 'https://languagepath.org/events/visiting/gcc-power-2026/' },
  'saudi-elenex-2026': { start: '2026-11-16', end: '2026-11-19', name: /Saudi Elenex 2026/, url: 'https://languagepath.org/events/visiting/saudi-elenex-2026/' },
  'ep-shanghai-2026': { start: '2026-12-03', end: '2026-12-05', name: /EP Shanghai 2026/, url: 'https://languagepath.org/events/visiting/ep-shanghai-2026/' },
  'world-future-energy-summit-2027': { start: '2027-01-12', end: '2027-01-14', name: /World Future Energy Summit 2027/, url: 'https://languagepath.org/events/visiting/world-future-energy-summit-2027/' },
  'elecrama-2027': { start: '2027-02-20', end: '2027-02-24', name: /ELECRAMA 2027/, url: 'https://languagepath.org/events/visiting/elecrama-2027/' },
  'middle-east-energy-2027': { start: '2027-05-11', end: '2027-05-13', name: /Middle East Energy 2027/, url: 'https://languagepath.org/events/visiting/middle-east-energy-2027/' },
  'power-and-utilities-india-2027': { start: '2027-05-19', end: '2027-05-21', name: /Power & Utilities India 2027/, url: 'https://languagepath.org/events/visiting/power-and-utilities-india-2027/' },
  'epower-2027': { start: '2027-06-03', end: '2027-06-05', name: /ePower 2027/, url: 'https://languagepath.org/events/visiting/epower-2027/' },
};

let failed = 0;
let quietOk = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}
function checkQuiet(label, pass, detail) {
  if (pass) quietOk++;
  else check(label, false, detail);
}

function block(url) {
  return '<aside class="lp-visit" style="margin:16px 0;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--card)">' +
    '<a href="' + url + '" rel="noopener" target="_blank">' + COPY + '</a></aside>';
}

function asides(html) {
  return html.match(/<aside class="lp-visit"[\s\S]*?<\/aside>/g) || [];
}

const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const canon = JSON.parse(fs.readFileSync('data/events-canonical.json', 'utf8')).canonical_editions;
const byId = Object.fromEntries(events.map((e) => [e.id, e]));
const canonById = Object.fromEntries(canon.map((e) => [e.id, e]));
const editionIds = new Set(events.map((e) => e.id));

Object.keys(EXPECT).forEach((id) => {
  const want = EXPECT[id];
  const ev = byId[id];
  const ed = canonById[id];
  check(id + ' is on the event record', !!(ev && ed));
  if (!ev || !ed) return;
  check(id + ' name and dates match the guide', ev.start === want.start && ev.end === want.end && want.name.test(ev.name) && want.name.test(ed.name), ev.name + ' ' + ev.start + '→' + ev.end + ' / canonical ' + ed.start + '→' + ed.end);
  check(id + ' languagepath_visit_url matches on both files', ev.languagepath_visit_url === want.url && ed.languagepath_visit_url === want.url, ev.languagepath_visit_url);
});

const extras = events.filter((e) => e.languagepath_visit_url && !EXPECT[e.id]).map((e) => e.id);
const canonExtras = canon.filter((e) => e.languagepath_visit_url && !EXPECT[e.id]).map((e) => e.id);
check('no other event record stores a visitor URL', extras.length === 0 && canonExtras.length === 0, extras.concat(canonExtras).join(', '));

const builder = fs.readFileSync('build-events.js', 'utf8');
check('edition pages render the field', builder.includes('travelBlock(ev) + visitorGuideBlock(ev)'));
check('series hubs render the featured edition field', builder.includes('travelBlock(nxt) + visitorGuideBlock(nxt)'));
check('renderer keeps the copy and link attributes', builder.includes(COPY) && builder.includes('rel="noopener" target="_blank"') && !/sister/i.test(builder.slice(builder.indexOf('function visitorGuideBlock'), builder.indexOf('function visitorGuideBlock') + 800)));

fs.readdirSync('events', { withFileTypes: true }).forEach((ent) => {
  if (!ent.isDirectory() || ent.name === 'ics') return;
  const file = path.join('events', ent.name, 'index.html');
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  const found = asides(html);
  const want = EXPECT[ent.name];
  if (want) {
    check(ent.name + ' page shows one visitor block', found.length === 1 && found[0] === block(want.url), found.join(' | '));
    return;
  }
  if (editionIds.has(ent.name)) {
    checkQuiet(ent.name + ' has no visitor block', found.length === 0 && html.indexOf('languagepath.org/events/visiting') < 0, String(found.length));
    return;
  }
  const cta = ((html.match(/id="series-cta"[^>]*>([\s\S]*?)<\/p>/) || ['', ''])[1]).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const featured = Object.keys(EXPECT).filter((id) => byId[id] && cta.indexOf(byId[id].name) >= 0);
  if (featured.length === 1) {
    check(ent.name + ' hub shows the featured edition guide', found.length === 1 && found[0] === block(EXPECT[featured[0]].url), cta);
  } else {
    checkQuiet(ent.name + ' hub has no visitor block', featured.length === 0 && found.length === 0, 'featured=' + featured.join(',') + ' asides=' + found.length);
  }
});
console.log('  ✓ ' + quietOk + ' other event pages omit the block');

if (failed) {
  console.error('LANGUAGEPATH VISIT FAILED (' + failed + ')');
  process.exit(1);
}
console.log('LANGUAGEPATH VISIT OK');
