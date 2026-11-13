#!/usr/bin/env node
/* Build the browser intel payload and the public RSS file from data/intel.json.
 *
 * The HTTP function used to fetch external RSS on every homepage view. That
 * call took 10–30s and sometimes returned 504. This file is the build-time
 * render: the function and the page read it, and they do not call the network.
 *
 * intel-feed.xml lastBuildDate is the newest item date, not a frozen July stamp.
 * Item text is copied from data/intel.json. Nothing here is invented.
 */
'use strict';

const fs = require('fs');

const SRC = 'data/intel.json';
const SNAPSHOT = 'data/intel-feed-snapshot.json';
const RSS_PATH = 'intel-feed.xml';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function dayOf(item) {
  const blob = [item && item.publication_date, item && item.date_iso, item && item.event_date, item && item.date_label].join(' ');
  const iso = blob.match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : '';
}

/* A date after the build day is not a publication day. Year-end placeholders
 * (31 Dec) were making lastBuildDate sit in the future. */
function datedItems(items, today) {
  const day = today || new Date().toISOString().slice(0, 10);
  return items.map(function (it) {
    const raw = it.day;
    return Object.assign({}, it, { day: raw && raw <= day ? raw : '' });
  });
}

function rfc822(iso) {
  const p = String(iso || '').split('-');
  if (p.length < 3) return '';
  const dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return WEEKDAYS[dt.getUTCDay()] + ', ' + dd + ' ' + MONTHS[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear() + ' 00:00:00 GMT';
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function flatten(doc) {
  const out = [];
  Object.keys(doc || {}).forEach(function (key) {
    const block = doc[key];
    if (!block || !Array.isArray(block.items)) return;
    block.items.forEach(function (item) {
      if (!item || !item.title) return;
      out.push({
        title: String(item.title).replace(/\s+/g, ' ').trim(),
        snippet: String(item.snippet || '').replace(/\s+/g, ' ').trim(),
        url: item.url || '',
        src: item.src || '',
        region: block.label || item.region || key,
        day: dayOf(item)
      });
    });
  });
  return out;
}

function buildSnapshot(doc, today) {
  const items = datedItems(flatten(doc), today);
  const latest = items.map(function (it) { return it.day; }).filter(Boolean).sort().pop() || '';
  const regions = {};
  items.slice().sort(function (a, b) {
    if (a.day && b.day && a.day !== b.day) return a.day < b.day ? 1 : -1;
    if (a.day && !b.day) return -1;
    if (!a.day && b.day) return 1;
    return 0;
  }).forEach(function (it) {
    if (!regions[it.region]) regions[it.region] = [];
    if (regions[it.region].length >= 5) return;
    regions[it.region].push({
      title: it.title,
      snippet: it.snippet.slice(0, 150),
      url: it.url,
      src: it.src,
      lang: 'en'
    });
  });
  const articles = Object.keys(regions).map(function (label) {
    return { label: label, items: regions[label] };
  }).filter(function (row) { return row.items.length; });
  const total = articles.reduce(function (n, row) { return n + row.items.length; }, 0);
  return {
    briefing: latest
      ? ('Sourced intel through ' + latest + ': ' + total + ' items from the TransformerPath record, grouped by region.')
      : 'Sourced intel is published from the TransformerPath record.',
    articles: articles,
    configured: false,
    timestamp: latest ? (latest + 'T00:00:00.000Z') : (doc.updated || ''),
    latest_item_date: latest,
    source: 'data/intel.json'
  };
}

function buildRss(doc, today) {
  const items = datedItems(flatten(doc), today).filter(function (it) { return it.day; });
  items.sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : 0; });
  const latest = items.length ? items[0].day : '';
  const rows = items.slice(0, 20).map(function (it) {
    const link = /^https?:\/\//i.test(it.url) ? it.url : 'https://transformerpath.com/intel.html';
    return [
      '  <item>',
      '    <title>' + esc(it.title) + '</title>',
      '    <link>' + esc(link) + '</link>',
      '    <guid isPermaLink="false">' + esc(it.day + ' ' + it.title).slice(0, 180) + '</guid>',
      '    <pubDate>' + rfc822(it.day) + '</pubDate>',
      '    <description>' + esc(it.snippet.slice(0, 280)) + '</description>',
      '    <category>' + esc(it.region) + '</category>',
      '  </item>'
    ].join('\n');
  }).join('\n\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    '  <title>TransformerPath — Daily Intel</title>',
    '  <link>https://transformerpath.com/intel.html</link>',
    '  <atom:link href="https://transformerpath.com/intel-feed.xml" rel="self" type="application/rss+xml"/>',
    '  <description>Sourced transformer industry intelligence from the TransformerPath record.</description>',
    '  <language>en</language>',
    '  <lastBuildDate>' + rfc822(latest) + '</lastBuildDate>',
    '',
    rows,
    '',
    '</channel>',
    '</rss>',
    ''
  ].join('\n');
}

function main() {
  const doc = readJson(SRC);
  const today = new Date().toISOString().slice(0, 10);
  const snapshot = buildSnapshot(doc, today);
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n');
  fs.writeFileSync(RSS_PATH, buildRss(doc, today));
  console.log('intel feed snapshot: ' + snapshot.articles.length + ' regions, latest item ' + (snapshot.latest_item_date || 'none'));
}

if (require.main === module) main();

module.exports = { buildSnapshot, buildRss, dayOf, rfc822, flatten, datedItems };
