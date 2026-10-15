#!/usr/bin/env node
/* build-event-ics.js — write events/ics/<id>.ics for calendar links.
 *
 * Reads data/events.json. Does not rebuild event pages.
 * An event with a start and an end date gets a calendar file.
 * A link whose event has no dates is removed, and the rest of the page stays.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadEvents } = require('./lib/events-reader');
const { eventIcs } = require('./lib/event-ics');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'transformerpath', 'functions']);

function hasCalendarDates(ev) {
  return !!(ev && DATE.test(String(ev.start || '')) && DATE.test(String(ev.end || '')));
}

function stripIcsAnchor(html, id) {
  const idRe = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const href = 'events\\/ics\\/' + idRe + '\\.ics';
  const span = new RegExp('\\s*<span>\\s*<a\\b[^>]*href="[^"]*' + href + '"[^>]*>[\\s\\S]*?<\\/a>\\s*<\\/span>', 'g');
  const bare = new RegExp('\\s*<a\\b[^>]*href="[^"]*' + href + '"[^>]*>[\\s\\S]*?<\\/a>', 'g');
  return html.replace(span, '').replace(bare, '');
}

function listHtmlFiles(root) {
  const out = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        walk(p);
      } else if (ent.name.endsWith('.html')) out.push(p);
    }
  }
  walk(root);
  return out;
}

function linkedIds(html) {
  return [...html.matchAll(/events\/ics\/([A-Za-z0-9-]+)\.ics/g)].map((m) => m[1]);
}

function syncEventCalendars(options) {
  const root = (options && options.root) || process.cwd();
  const byId = new Map(loadEvents().filter((ev) => ev && ev.id).map((ev) => [ev.id, ev]));
  const wanted = new Map();
  let stripped = 0;
  listHtmlFiles(root).forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    if (html.indexOf('events/ics/') < 0) return;
    let next = html;
    [...new Set(linkedIds(html))].forEach((id) => {
      const ev = byId.get(id);
      if (hasCalendarDates(ev)) {
        wanted.set(id, ev);
        return;
      }
      const strippedHtml = stripIcsAnchor(next, id);
      if (strippedHtml !== next) {
        next = strippedHtml;
        stripped += 1;
      }
    });
    if (next !== html) fs.writeFileSync(file, next);
  });

  const dir = path.join(root, 'events', 'ics');
  fs.mkdirSync(dir, { recursive: true });
  let wrote = 0;
  wanted.forEach((ev, id) => {
    const body = eventIcs(ev);
    const dest = path.join(dir, id + '.ics');
    const prev = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (prev !== body) {
      fs.writeFileSync(dest, body);
      wrote += 1;
    }
  });
  return { linked: wanted.size, wrote, stripped };
}

module.exports = { hasCalendarDates, stripIcsAnchor, syncEventCalendars, linkedIds, listHtmlFiles };

if (require.main === module) {
  const result = syncEventCalendars();
  console.log('event calendars: ' + result.linked + ' with dates, ' + result.wrote + ' written, ' + result.stripped + ' undated links removed');
}
