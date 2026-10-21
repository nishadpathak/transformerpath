#!/usr/bin/env node
/* Event badge labels follow the event timezone. History years require a source URL. */
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

const LIST = 'https://www.epchinashow.com/EP/visitor/exhibitorlist/eng';
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/event-badges.json'), 'utf8'));
const ep = catalog.events.filter(function (event) { return event.slug === 'ep-shanghai-2026'; })[0];
check('EP Shanghai dates match the official 3–5 December 2026 visit window', ep && ep.start === '2026-12-03' && ep.end === '2026-12-05' && ep.timezone === 'Asia/Shanghai' && ep.url === '/events/ep-shanghai-2026/' && ep.year === 2026 && ep.series === 'ep-shanghai');
check('the official visiting page is the date source', ep && ep.source_url === 'https://www.epchinashow.com/EP/visitor/visitinginfo/eng');
check('how to add an event or a year is documented', /history entry/.test(catalog.how_to_add) && /source/.test(catalog.how_to_add) && /WETEX/.test(catalog.how_to_add));

const errors = badges.validate(catalog);
check('every history entry has an exhibitor-list source', errors.length === 0, errors.slice(0, 4).join('; '));
check('EP Shanghai 2026 history still cites the exhibitor list', catalog.companies.every(function (row) {
  return row.history.every(function (entry) { return /^https?:\/\//.test(entry.source); }) && row.history.some(function (entry) {
    return entry.event !== 'ep-shanghai-2026' || (entry.year === 2026 && entry.source === LIST);
  });
}));
const abbRow = catalog.companies.filter(function (row) { return row.slug === 'abb-china-co-ltd'; })[0];
check('ABB (China) still has only EP Shanghai 2026', abbRow && abbRow.history.length === 1 && abbRow.history[0].event === 'ep-shanghai-2026');

function withoutSource(mutate) {
  const copy = JSON.parse(JSON.stringify(catalog));
  mutate(copy.companies[0].history[0]);
  return badges.validate(copy);
}
check('a history entry with no source fails validation', withoutSource(function (entry) { delete entry.source; }).some(function (error) { return /missing source exhibitor-list URL/.test(error); }));
check('a blank source fails validation', withoutSource(function (entry) { entry.source = '  '; }).some(function (error) { return /missing source exhibitor-list URL/.test(error); }));
check('a source that is not an exhibitor-list URL fails validation', withoutSource(function (entry) { entry.source = 'EP Shanghai 2026 official Exhibitor List (Partial) PDF'; }).some(function (error) { return /missing source exhibitor-list URL/.test(error); }));

const endOfShow = new Date('2026-12-05T15:59:00Z');
const nextMorning = new Date('2026-12-05T16:00:00Z');
check('the end date in Shanghai is still exhibiting', badges.todayInZone('Asia/Shanghai', endOfShow) === '2026-12-05' && badges.label(ep, endOfShow) === 'Exhibiting at EP Shanghai \u00b7 3\u20135 Dec 2026');
check('the next Shanghai day is exhibited, without a manual edit', badges.todayInZone('Asia/Shanghai', nextMorning) === '2026-12-06' && badges.label(ep, nextMorning) === 'Exhibited at EP Shanghai 2026');

const during = new Date('2026-10-20T12:00:00Z');
const abb = badges.htmlFor({ slug: 'abb-china-co-ltd', name: 'ABB (China) Co., LTD' }, during);
check('ABB (China) gets the highlighted EP Shanghai badge', abb.indexOf('data-event-badge="ep-shanghai-2026"') >= 0 && abb.indexOf('data-event-end="2026-12-05"') >= 0 && abb.indexOf('Exhibiting at EP Shanghai \u00b7 3\u20135 Dec 2026') >= 0 && abb.indexOf('2025') < 0);
const abbPast = badges.htmlFor({ slug: 'abb-china-co-ltd', name: 'ABB (China) Co., LTD' }, nextMorning);
check('after the show the only sourced year moves into history', abbPast.indexOf('Exhibited at EP Shanghai 2026') >= 0 && abbPast.indexOf('Exhibiting') < 0 && abbPast.indexOf('2025') < 0);
const plain = badges.htmlFor({ slug: 'not-an-exhibitor', name: 'Not An Exhibitor' }, during);
check('a company outside the participation list has no badge', plain === '');

const wetex = {
  slug: 'wetex-2025',
  series: 'wetex',
  name: 'WETEX',
  past_name: 'WETEX 2025',
  year: 2025,
  start: '2025-11-18',
  end: '2025-11-20',
  timezone: 'Asia/Riyadh',
  url: '/events/wetex-2025/'
};
const ep2025 = {
  slug: 'ep-shanghai-2025',
  series: 'ep-shanghai',
  name: 'EP Shanghai',
  past_name: 'EP Shanghai 2025',
  year: 2025,
  start: '2025-12-03',
  end: '2025-12-05',
  timezone: 'Asia/Shanghai',
  url: '/events/ep-shanghai-2025/'
};
check('a same-year range is computed from the dates', badges.label({
  slug: 'wetex-2027',
  name: 'WETEX',
  past_name: 'WETEX 2027',
  start: '2027-11-28',
  end: '2027-12-02',
  timezone: 'Asia/Riyadh',
  url: '/events/wetex-2027/'
}, new Date('2027-11-28T12:00:00Z')) === 'Exhibiting at WETEX \u00b7 28 Nov\u20132 Dec 2027');

const extended = JSON.parse(JSON.stringify(catalog));
extended.events.push(ep2025);
extended.companies.push({
  slug: 'example-co',
  name: 'Example Co',
  history: [
    { event: 'ep-shanghai-2026', year: 2026, source: 'https://example.com/ep-2026-list' },
    { event: 'ep-shanghai-2025', year: 2025, source: 'https://example.com/ep-2025-list' },
    { event: 'wetex-2025', year: 2025, source: 'https://example.com/wetex-2025-list' }
  ]
});
check('the synthetic history is valid only because every year has a source', badges.validate(extended).length === 0);
badges.use(extended);
const groupedNow = badges.htmlFor({ slug: 'example-co', name: 'Example Co' }, during);
check('an ongoing show stays highlighted beside the older sourced year', groupedNow.indexOf('Exhibiting at EP Shanghai \u00b7 3\u20135 Dec 2026') >= 0 && groupedNow.indexOf('Exhibited at EP Shanghai 2025') >= 0 && groupedNow.indexOf('Exhibited at EP Shanghai 2026') < 0);
check('a separate past show is its own history line', groupedNow.indexOf('Exhibited at WETEX 2025') >= 0 && groupedNow.indexOf('data-event-badge="wetex-2025"') >= 0);
const groupedPast = badges.htmlFor({ slug: 'example-co', name: 'Example Co' }, nextMorning);
check('ended years of one show accumulate, most recent first', groupedPast.indexOf('Exhibited at EP Shanghai 2026 \u00b7 2025') >= 0 && groupedPast.indexOf('Exhibiting') < 0);
check('WETEX stays on its own line after EP Shanghai ends', groupedPast.indexOf('Exhibited at WETEX 2025') >= 0);

const unsourced = JSON.parse(JSON.stringify(extended));
unsourced.companies[unsourced.companies.length - 1].history[1].source = '';
badges.use(unsourced);
const dropped = badges.htmlFor({ slug: 'example-co' }, nextMorning);
check('a past year with no source is left off the badge', dropped.indexOf('Exhibited at EP Shanghai 2026 \u00b7 2025') < 0 && dropped.indexOf('Exhibited at EP Shanghai 2025') < 0 && dropped.indexOf('Exhibited at EP Shanghai 2026') >= 0 && dropped.indexOf('Exhibited at WETEX 2025') >= 0);
check('dropping the source also fails validation', badges.validate(unsourced).some(function (error) { return /missing source exhibitor-list URL/.test(error); }));
badges.use(catalog);

function badgeEl(attrs) {
  const values = Object.assign({}, attrs);
  return {
    values: values,
    style: {},
    textContent: attrs.text || '',
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : null; },
    setAttribute: function (name, value) { values[name] = value; },
    removeAttribute: function (name) { delete values[name]; }
  };
}
function scopeOf(nodes) {
  return { querySelectorAll: function () { return nodes; } };
}
const live = badgeEl({
  'data-event-badge': 'ep-shanghai-2026',
  'data-event-name': 'EP Shanghai',
  'data-event-past': 'EP Shanghai 2026',
  'data-event-year': '2026',
  'data-event-also': '2025',
  'data-event-start': '2026-12-03',
  'data-event-end': '2026-12-05',
  'data-event-tz': 'Asia/Shanghai',
  'data-event-state': 'upcoming',
  text: 'Exhibiting at EP Shanghai · 3–5 Dec 2026'
});
const older = badgeEl({
  'data-event-role': 'history',
  'data-event-badge': 'ep-shanghai-2025',
  'data-event-name': 'EP Shanghai',
  'data-event-years': '2025',
  'data-event-pending': '2026',
  'data-event-end': '2026-12-05',
  'data-event-tz': 'Asia/Shanghai',
  'data-event-state': 'past',
  text: 'Exhibited at EP Shanghai 2025'
});
badges.refresh(scopeOf([live, older]), endOfShow);
check('through the end date the current show stays highlighted', live.textContent === 'Exhibiting at EP Shanghai \u00b7 3\u20135 Dec 2026' && live.values['data-event-state'] === 'upcoming' && older.textContent === 'Exhibited at EP Shanghai 2025' && !older.values.hidden);
badges.refresh(scopeOf([live, older]), nextMorning);
check('the morning after, that year joins the history line and the old line hides', live.textContent === 'Exhibited at EP Shanghai 2026 \u00b7 2025' && live.values['data-event-state'] === 'past' && older.values.hidden === '');

const shell = fs.readFileSync(path.join(root, 'accessories/shell-global-shell-diala/index.html'), 'utf8');
const h1 = shell.slice(shell.indexOf('<h1>'), shell.indexOf('</h1>'));
check('Shell profile places the badge in the heading', h1.indexOf('class="event-badge"') >= 0 && h1.indexOf('Exhibiting at EP Shanghai \u00b7 3\u20135 Dec 2026') >= 0);
const board = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
check('the manufacturer directory badges a participant beside the name link', board.indexOf('ABB (China) Co., LTD</a><a class="event-badge"') >= 0);
check('the directory page loads the badge script', board.indexOf('/event-badges.js') >= 0);
const sharedName = badges.htmlFor({ slug: 'mitsubishi-electric', name: 'Mitsubishi Electric' });
const separateUnit = badges.htmlFor({ slug: 'mitsubishi-electric-power-modules', name: 'Mitsubishi Electric' });
check('a shared display name does not copy another profile’s badge', sharedName.indexOf('ECCE Europe') < 0 && separateUnit.indexOf('ECCE Europe 2026') >= 0);

if (failed) {
  console.error('EVENT BADGES FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EVENT BADGES OK');
