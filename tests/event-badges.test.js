#!/usr/bin/env node
/* Event badge labels follow the event timezone. A second event is only data. */
'use strict';
const fs = require('fs');
const path = require('path');
const badges = require('../event-badges');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failed++;
}

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/event-badges.json'), 'utf8'));
const ep = catalog.events.filter(function (event) { return event.slug === 'ep-shanghai-2026'; })[0];
check('EP Shanghai dates match the official 3–5 December 2026 visit window', ep && ep.start === '2026-12-03' && ep.end === '2026-12-05' && ep.timezone === 'Asia/Shanghai' && ep.url === '/events/ep-shanghai-2026/');
check('the official visiting page is the date source', ep && ep.source_url === 'https://www.epchinashow.com/EP/visitor/visitinginfo/eng');

const endOfShow = new Date('2026-12-05T15:59:00Z');
const nextMorning = new Date('2026-12-05T16:00:00Z');
check('the end date in Shanghai is still exhibiting', badges.todayInZone('Asia/Shanghai', endOfShow) === '2026-12-05' && badges.label(ep, endOfShow) === 'Exhibiting at EP Shanghai \u00b7 3\u20135 Dec 2026');
check('the next Shanghai day is exhibited, without a manual edit', badges.todayInZone('Asia/Shanghai', nextMorning) === '2026-12-06' && badges.label(ep, nextMorning) === 'Exhibited at EP Shanghai 2026');

const wetex = {
  slug: 'wetex-2027',
  name: 'WETEX',
  past_name: 'WETEX 2027',
  start: '2027-11-28',
  end: '2027-12-02',
  timezone: 'Asia/Riyadh',
  url: '/events/wetex-2027/'
};
check('a same-year range is computed from the dates', badges.label(wetex, new Date('2027-11-28T12:00:00Z')) === 'Exhibiting at WETEX \u00b7 28 Nov\u20132 Dec 2027');
check('after that end date the past name is used', badges.label(wetex, new Date('2027-12-02T21:00:00Z')) === 'Exhibited at WETEX 2027');

const extended = JSON.parse(JSON.stringify(catalog));
extended.events.push(wetex);
extended.companies.push({ event: 'wetex-2027', slug: 'example-co', name: 'Example Co' });
badges.use(extended);
const wetexHtml = badges.htmlFor({ slug: 'example-co', name: 'Example Co' }, new Date('2027-11-28T12:00:00Z'));
check('a new event badges a company from data alone', wetexHtml.indexOf('data-event-badge="wetex-2027"') >= 0 && wetexHtml.indexOf('Exhibiting at WETEX \u00b7 28 Nov\u20132 Dec 2027') >= 0 && wetexHtml.indexOf('href="/events/wetex-2027/"') >= 0);
badges.use(catalog);

const abb = badges.htmlFor({ slug: 'abb-china-co-ltd', name: 'ABB (China) Co., LTD' });
check('ABB (China) gets the EP Shanghai badge', abb.indexOf('data-event-badge="ep-shanghai-2026"') >= 0 && abb.indexOf('data-event-end="2026-12-05"') >= 0);
const plain = badges.htmlFor({ slug: 'not-an-exhibitor', name: 'Not An Exhibitor' });
check('a company outside the participation list has no badge', plain === '');

const shell = fs.readFileSync(path.join(root, 'accessories/shell-global-shell-diala/index.html'), 'utf8');
const h1 = shell.slice(shell.indexOf('<h1>'), shell.indexOf('</h1>'));
check('Shell profile places the badge in the heading', h1.indexOf('class="event-badge"') >= 0 && h1.indexOf('Shell') >= 0);
const board = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
check('the manufacturer directory badges a participant beside the name link', board.indexOf('ABB (China) Co., LTD</a><a class="event-badge"') >= 0);
check('the directory page loads the badge script', board.indexOf('/event-badges.js') >= 0);

if (failed) {
  console.error('EVENT BADGES FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EVENT BADGES OK');
