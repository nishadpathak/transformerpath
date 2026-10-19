#!/usr/bin/env node
/* tests/check-events-integrity.js — events depth gate.
 * Schema, confirmation evidence, freshness, projected silence, hub titles,
 * count copy, duplicate editions, directory slugs, and the two fixtures.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadEvents } = require('../lib/events-reader');
const { dubaiToday } = require('../lib/event-display');
const { resolveStatus, isDiscoverable, isUpcoming } = require('../lib/event-status');

const hard = [];
const warn = [];
function fail(m) { hard.push(m); }
function note(m) { warn.push(m); }

const schema = JSON.parse(fs.readFileSync('data/events.schema.json', 'utf8'));
const item = schema.items;
const events = loadEvents();
const today = dubaiToday();
const slugs = new Set(JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).map((c) => c.slug));

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function ageDays(iso) {
  const a = new Date(iso + 'T12:00:00Z').getTime();
  const b = new Date(today + 'T12:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

if (!Array.isArray(events) || !events.length) fail('events.json did not load as a non-empty array');

const seen = {};
events.forEach((ev) => {
  (item.required || []).forEach((k) => {
    if (!Object.prototype.hasOwnProperty.call(ev, k) || ev[k] == null || ev[k] === '') {
      if (k === 'date_status' && ev.date_status == null) return;
      if (k === 'relevance_tier' && ev.relevance_tier == null) return;
      fail(ev.id + ' missing required ' + k);
    }
  });
  if (!ev.id || !ev.name) fail('record missing id or name');
  if (seen[ev.id]) fail('duplicate edition id ' + ev.id);
  seen[ev.id] = ev.name;
  ['start', 'end', 'source_checked_at'].forEach((k) => {
    if (ev[k] && !/^\d{4}-\d{2}-\d{2}$/.test(ev[k])) fail(ev.id + ' bad date ' + k + '=' + ev[k]);
  });
  const enums = item.properties || {};
  ['type', 'date_status', 'relevance_tier'].forEach((k) => {
    const allowed = enums[k] && enums[k].enum;
    if (allowed && ev[k] != null && allowed.indexOf(ev[k]) < 0) fail(ev.id + ' bad ' + k + '=' + ev[k]);
  });
  if (ev.date_status === 'CONFIRMED' && !(ev.source_url && ev.source_checked_at)) {
    fail(ev.id + ' CONFIRMED without source_url and source_checked_at');
  }
  if (/verified/i.test(String(ev.date_status || ''))) fail(ev.id + ' uses a verified status label');
  const soon = ev.start && ev.start >= today && ev.start <= addDays(today, 120);
  if (ev.source_checked_at && soon) {
    const age = ageDays(ev.source_checked_at);
    if (age > 60) fail(ev.id + ' source_checked_at is ' + age + ' days old and the edition is inside 120 days');
  } else if (ev.source_checked_at && ev.start && ev.start > today && ageDays(ev.source_checked_at) > 120) {
    note(ev.id + ' source_checked_at is older than 120 days');
  }
  (ev.key_exhibitors || []).forEach((x) => {
    if (x.entity_slug && !slugs.has(x.entity_slug)) fail(ev.id + ' exhibitor slug missing from directory: ' + x.entity_slug);
  });
});

const mee = events.find((e) => e.id === 'middle-east-energy-2027');
if (!mee || mee.start !== '2027-05-11' || mee.end !== '2027-05-13') fail('fixture MEE 2027 must start 2027-05-11');

const hubPath = path.join('events', 'cwieme-berlin', 'index.html');
if (!fs.existsSync(hubPath)) fail('CWIEME Berlin hub was not built');
else {
  const html = fs.readFileSync(hubPath, 'utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/) || ['', ''])[1];
  const h1 = (html.match(/<h1>([^<]*)<\/h1>/) || ['', ''])[1];
  const cta = (html.match(/id="series-cta"[^>]*>([\s\S]*?)<\/p>/) || ['', ''])[1];
  if (/2026/.test(title) || /2026/.test(h1) || /2026/.test(cta)) {
    fail('CWIEME Berlin hub title/CTA still names 2026 after 2026-05-21');
  }
  if (!/2027/.test(cta)) fail('CWIEME Berlin hub CTA does not name the 2027 edition');
}

if (fs.existsSync('events/calendar.ics')) {
  const ics = fs.readFileSync('events/calendar.ics', 'utf8');
  events.filter((e) => e.date_status === 'PROJECTED').forEach((e) => {
    if (ics.indexOf('UID:' + e.id + '@') >= 0) fail('PROJECTED edition emitted in calendar.ics: ' + e.id);
  });
}
events.filter((e) => e.date_status === 'PROJECTED' && e.id).forEach((e) => {
  const p = path.join('events', e.id, 'index.html');
  if (!fs.existsSync(p)) return;
  const html = fs.readFileSync(p, 'utf8');
  if (/application\/ld\+json/.test(html) && /startDate/.test(html)) fail('PROJECTED edition emitted Event JSON-LD: ' + e.id);
});

if (fs.existsSync('events.html')) {
  const page = fs.readFileSync('events.html', 'utf8');
  const confirmed = events.filter((e) => e.date_status === 'CONFIRMED' && e.source_url && e.source_checked_at && e.end && e.end >= today).length;
  const projected = events.filter((e) => e.date_status === 'PROJECTED' && (!e.end || e.end >= today)).length;
  const countries = new Set(events.filter((e) => {
    if (e.research_status === 'REJECTED_NO_EVIDENCE' || e.date_status === 'CANCELLED') return false;
    if (!isDiscoverable(resolveStatus(e))) return false;
    if (!e.country) return false;
    if (!e.end) return e.date_status === 'TBA' || e.date_status === 'PROJECTED';
    return e.end >= today;
  }).map((e) => e.country)).size;
  const upcoming = events.filter((e) => isUpcoming(e, today)).length;
  const other = upcoming - confirmed - projected;
  if (other < 0) fail('events count split exceeds the upcoming list (' + other + ')');
  const expect = confirmed + ' upcoming confirmed · ' + projected + ' projected' +
    (other > 0 ? ' · ' + other + ' dates not confirmed' : '') +
    ' · ' + countries + ' countries hosting';
  if (page.indexOf(expect) < 0) fail('events.html count copy does not match data (' + expect + ')');
  if (/140 countries/.test(page.replace(/const EVENTS\s*=\s*\[[\s\S]*?\];/, ''))) fail('events.html still says 140 countries outside event records');
}

console.log('EVENTS DEPTH GATE');
console.log('Editions: ' + events.length + ' | today ' + today);
if (warn.length) warn.forEach((w) => console.log('  WARN ' + w));
if (hard.length) {
  hard.forEach((h) => console.error('  FAIL ' + h));
  process.exit(1);
}
console.log('EVENTS DEPTH OK');
