/* Grid census verification is one date. Each operator record has its own
 * updated date: the git blame date of that operator's lines in data/grids.json.
 * data/grid-operator-dates.json is that map, committed so a shallow build does
 * not stamp every operator with the build clock or with the census date.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOC_PATH = path.join(ROOT, 'data/grid-operator-dates.json');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function longDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const parts = String(iso).split('-').map(Number);
  return parts[2] + ' ' + MONTHS[parts[1] - 1] + ' ' + parts[0];
}

function load() {
  return JSON.parse(fs.readFileSync(DOC_PATH, 'utf8'));
}

function operatorIso(name, doc) {
  const table = (doc || load()).operators || {};
  const iso = table[name];
  return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso : null;
}

function operatorLabel(name, doc) {
  const iso = operatorIso(name, doc);
  return iso ? 'Record updated ' + longDate(iso) : 'Record updated: Not available';
}

function censusLabel(doc) {
  const text = longDate((doc || load()).census_verified);
  return text ? 'Census verified ' + text : 'Census verified: Not available';
}

function blameOperatorDates() {
  let shallow = false;
  try {
    shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: ROOT, encoding: 'utf8' }).trim() === 'true';
  } catch (e) {
    return null;
  }
  if (shallow) return null;
  let out;
  try {
    out = execFileSync('git', ['blame', 'HEAD', '-w', '--date=short', '--', 'data/grids.json'], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 120000
    });
  } catch (e) {
    return null;
  }
  const rows = [];
  out.split('\n').forEach(function (line) {
    const m = line.match(/(\d{4}-\d{2}-\d{2})\s+\d+\)\s?(.*)$/);
    if (m) rows.push({ date: m[1], text: m[2] });
  });
  const operators = {};
  for (let i = 0; i < rows.length; i++) {
    if (!/\[\s*$/.test(rows[i].text) || !rows[i + 1] || !/^\s*"/.test(rows[i + 1].text)) continue;
    const name = rows[i + 1].text.match(/"([^"]+)"/);
    if (!name) continue;
    let date = rows[i + 1].date;
    for (let j = i + 1; j < rows.length && j < i + 6; j++) {
      if (rows[j].date > date) date = rows[j].date;
      if (/\]\s*,?\s*$/.test(rows[j].text)) break;
    }
    operators[name[1]] = date;
  }
  return operators;
}

module.exports = {
  DOC_PATH: DOC_PATH,
  longDate: longDate,
  load: load,
  operatorIso: operatorIso,
  operatorLabel: operatorLabel,
  censusLabel: censusLabel,
  blameOperatorDates: blameOperatorDates
};
