#!/usr/bin/env node
/* Company-profile "Upcoming events" lists are built from the event END date.
 * An event that has already ended must not stay on the profile because its
 * start date is still printed next to the name.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { platformToday, isUpcoming } = require('../lib/event-status');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

function decode(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function upcomingSection(html) {
  const marker = 'Upcoming events</h2>';
  const i = html.indexOf(marker);
  if (i < 0) return '';
  const start = html.lastIndexOf('<h2', i);
  const end = html.indexOf('</ul>', i);
  if (start < 0 || end < 0) return '';
  return html.slice(start, end + 5);
}
function listedNames(section) {
  return [...section.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map(function (m) { return decode(m[1]); });
}

console.log('=== UPCOMING PROFILE EVENTS ===');
const today = platformToday();
const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const byName = {};
events.forEach(function (ev) { if (ev && ev.n) byName[ev.n] = ev; });

const src = fs.readFileSync('build-company-pages.js', 'utf8');
check('profiles derive upcoming from the end date at build time',
  /const UPCOMING_AS_OF = platformToday\(\)/.test(src) && /isUpcoming\(ev, UPCOMING_AS_OF\)/.test(src));
check('profiles stamp the upcoming list with the build day', /data-upcoming-as-of/.test(src));

const expired = [];
const root = 'manufacturers';
fs.readdirSync(root).forEach(function (dir) {
  const file = path.join(root, dir, 'index.html');
  if (!fs.existsSync(file)) return;
  const section = upcomingSection(fs.readFileSync(file, 'utf8'));
  if (!section) return;
  listedNames(section).forEach(function (name) {
    const ev = byName[name];
    if (!ev) return;
    if (!isUpcoming(ev, today)) expired.push(dir + ': ' + name + ' ended ' + ev.e);
  });
});
check('no company profile lists an event that ended before ' + today, expired.length === 0, expired.slice(0, 8).join(' | '));

const hyosung = upcomingSection(fs.readFileSync('manufacturers/hyosung-heavy-industries/index.html', 'utf8'));
const hyosungNames = listedNames(hyosung);
check('Hyosung upcoming list exists', hyosungNames.length > 0, hyosungNames.join(', '));
check('Hyosung does not list EPIC 2026', !hyosungNames.some(function (n) { return /EPIC 2026/.test(n); }));
check('Hyosung upcoming events all end on or after ' + today, hyosungNames.every(function (n) {
  const ev = byName[n];
  return ev && isUpcoming(ev, today);
}), hyosungNames.join(', '));

if (failed) {
  console.error('UPCOMING PROFILE EVENTS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('UPCOMING PROFILE EVENTS OK — as of ' + today);
