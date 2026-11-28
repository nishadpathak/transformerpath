'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const BEGIN = '# BEGIN generated calendar download filenames';
const END = '# END generated calendar download filenames';
const MAX_FILENAME = 40;

function calendarFilename(id) {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Invalid event calendar id: ' + id);
  const original = id + '.ics';
  if (original.length <= MAX_FILENAME) return original;
  const year = (id.match(/-20\d{2}$/) || [''])[0];
  const hash = createHash('sha256').update(id).digest('hex').slice(0, 6);
  const limit = MAX_FILENAME - year.length - hash.length - '-.ics'.length;
  const cut = id.slice(0, limit);
  const word = cut.lastIndexOf('-');
  const label = word >= 15 ? cut.slice(0, word) : cut.replace(/-+$/, '');
  return label + '-' + hash + year + '.ics';
}

function calendarHeaderRules(ids) {
  const names = new Set();
  const blocks = [];
  for (const id of [...new Set(ids)].sort()) {
    const filename = calendarFilename(id);
    if (names.has(filename)) throw new Error('Duplicate event download name: ' + filename);
    names.add(filename);
    if (filename === id + '.ics') continue;
    blocks.push('/events/ics/' + id + '.ics\n' +
      '  Content-Type: text/calendar; charset=utf-8\n' +
      '  Content-Disposition: attachment; filename="' + filename + '"');
  }
  return blocks;
}

function syncCalendarDownloadHeaders(root, ids) {
  const file = path.join(root, '_headers');
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const native = previous.replace(/^# BEGIN generated calendar download filenames\r?\n[\s\S]*?^# END generated calendar download filenames(?:\r?\n|$)/m, '').trimEnd();
  const blocks = calendarHeaderRules(ids);
  const parts = [native];
  if (blocks.length) parts.push(BEGIN + '\n' + blocks.join('\n\n') + '\n' + END);
  const next = parts.filter(Boolean).join('\n\n') + '\n';
  if (next !== previous) fs.writeFileSync(file, next);
  return blocks.length;
}

module.exports = { MAX_FILENAME, calendarFilename, calendarHeaderRules, syncCalendarDownloadHeaders };
