'use strict';
/* Lead-time and factory-capacity rows.
 *
 * A row is kept only when the repo already stores a source URL and a day
 * or a month. A year by itself, a URL with no date, and a directory note
 * with no source are left out. Figures are substrings of the stored text.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DAY_LABEL = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})$/;
const MONTH_LABEL = /^([A-Za-z]{3,9})\s+(20\d{2})$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DASH = '[\\-\\u2010-\\u2015]';
const LEAD_FIGURE = new RegExp(
  '\\b\\d+\\s*(?:' + DASH + '|to)\\s*\\d+\\s*(?:weeks|months|years)\\b|\\b\\d+\\s*(?:weeks|months|years)\\b',
  'i'
);
const CAPACITY_PHRASE = new RegExp(
  'transformer\\s+' + '(?:factory|plant)|power-transformer\\s+plant|manufacturing\\s+capacity|production\\s+capacity|annual\\s+capacity|MVA\\s*/\\s*(?:yr|year)',
  'i'
);
const CAPACITY_FIGURE = new RegExp(
  '(?:\\bUSD\\b|\\bUS\\$|\\$|\\bJPY\\b|€|\\bRs\\b|\\bTL\\b)\\s*[\\d.,]+\\s*(?:m\\b|bn\\b|million\\b|billion\\b)?|\\b\\d[\\d,.]*\\s*MVA(?:\\s*/\\s*(?:yr|year))?|\\bmore than double\\b',
  'i'
);

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function httpUrl(url) {
  const value = String(url || '').trim();
  return /^https?:\/\//i.test(value) && !/example\.com/i.test(value) ? value : '';
}

function monthName(mm) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(mm) - 1] || '';
}

function labelFromIso(iso) {
  const m = String(iso || '').match(ISO_DAY);
  if (!m) return '';
  const mon = monthName(m[2]);
  if (!mon) return '';
  return String(Number(m[3])) + ' ' + mon + ' ' + m[1];
}

/* A stored day, or a month when the label names a month and the iso day is
 * the first of that month. A bare year (including a 31 Dec bucket) is not a date. */
function sourceDate(iso, label) {
  const day = String(iso || '').slice(0, 10);
  const lab = String(label || '').trim();
  if (DAY_LABEL.test(lab) && ISO_DAY.test(day) && !/-12-31$/.test(day)) {
    return { lastChecked: day, precision: 'day', label: lab };
  }
  if (MONTH_LABEL.test(lab) && /^\d{4}-\d{2}-01$/.test(day)) {
    return { lastChecked: day.slice(0, 7), precision: 'month', label: lab };
  }
  return null;
}

function dateFromSrc(src, iso) {
  const named = String(src || '').match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2})\b/);
  if (named && ISO_DAY.test(String(iso || '').slice(0, 10))) {
    const label = named[1];
    const stored = String(iso).slice(0, 10);
    const parsed = labelFromIso(stored);
    if (parsed && parsed !== label) return null;
    return { lastChecked: stored, precision: 'day', label: label };
  }
  if (ISO_DAY.test(String(iso || '').slice(0, 10)) && !/-01$/.test(String(iso).slice(0, 10))) {
    const stored = String(iso).slice(0, 10);
    return { lastChecked: stored, precision: 'day', label: labelFromIso(stored) };
  }
  return null;
}

function firstMatch(re, text) {
  const flags = re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g';
  const copy = new RegExp(re.source, flags);
  const found = [];
  const seen = {};
  let m;
  while ((m = copy.exec(text))) {
    const piece = m[0].replace(/\s+/g, ' ').trim();
    const key = piece.toLowerCase().replace(/\s+/g, '');
    if (!piece || seen[key]) continue;
    seen[key] = 1;
    found.push(piece);
  }
  return found;
}

/* Prefer the single stored field that already states the claim, so a figure
 * from a different sentence is not attached to a shorter headline. */
function pickStatement(parts, kind) {
  const pred = kind === 'lead_time' ? isLeadText : isCapacityText;
  const figs = kind === 'lead_time' ? leadFigures : capacityFigures;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part && pred(part) && figs(part).length) return part;
  }
  return parts.filter(Boolean).join('\n');
}

function normUrl(url) {
  return String(url || '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
}

function leadFigures(text) {
  return firstMatch(LEAD_FIGURE, text);
}

function capacityFigures(text) {
  return firstMatch(CAPACITY_FIGURE, text);
}

function isLeadText(text) {
  return /lead time/i.test(text) && leadFigures(text).length > 0;
}

function isCapacityText(text) {
  if (!/transformer/i.test(text)) return false;
  if (!CAPACITY_PHRASE.test(text)) return false;
  if (/factory acceptance|\bFAT\b/i.test(text) && !/MVA\s*\/\s*(?:yr|year)|manufacturing capacity|annual capacity/i.test(text)) return false;
  return capacityFigures(text).length > 0;
}

function pushRow(rows, seen, row) {
  const key = row.kind + '|' + normUrl(row.sourceUrl) + '|' + row.figures.join('|');
  if (seen[key]) return;
  seen[key] = 1;
  rows.push(row);
}

function skip(skipped, title, reason) {
  skipped.push({ title: String(title || '').slice(0, 180), reason: reason });
}

function fromIntel(doc, rows, seen, skipped) {
  Object.keys(doc || {}).forEach(function (region) {
    const block = doc[region];
    if (!block || !Array.isArray(block.items)) return;
    block.items.forEach(function (item) {
      const text = [item.title, item.snippet, item.value].filter(Boolean).join('\n');
      const lead = isLeadText(text);
      const capacity = isCapacityText(text);
      if (!lead && !capacity) return;
      const url = httpUrl(item.url);
      const dated = sourceDate(item.date_iso, item.date_label);
      if (!url || !dated) {
        skip(skipped, item.title, !url ? 'no source URL' : 'no day or month on the intel record');
        return;
      }
      const kind = lead ? 'lead_time' : 'factory_capacity';
      const statement = pickStatement([item.title, item.value, item.snippet], kind);
      const figures = kind === 'lead_time' ? leadFigures(statement) : capacityFigures(statement);
      if (!figures.length) {
        skip(skipped, item.title, 'qualifying figure is not in one stored field');
        return;
      }
      pushRow(rows, seen, {
        kind: kind,
        subject: item.title || '',
        statement: statement,
        figures: figures,
        claimLabel: 'Intel record',
        sourceLabel: item.src || '',
        sourceUrl: url,
        lastChecked: dated.lastChecked,
        precision: dated.precision,
        lastCheckedLabel: dated.label,
        region: region
      });
    });
  });
}

function fromDevelopments(list, rows, seen, skipped) {
  (list || []).forEach(function (company) {
    (company.developments || []).forEach(function (item) {
      const text = [item.title, item.value].filter(Boolean).join('\n');
      if (!isCapacityText(text) && !isLeadText(text)) return;
      const url = httpUrl(item.url);
      const dated = dateFromSrc(item.src, item.date_iso);
      if (!url || !dated) {
        skip(skipped, item.title, !url ? 'no source URL' : 'development date does not match the source label');
        return;
      }
      const lead = isLeadText(text);
      const kind = lead ? 'lead_time' : 'factory_capacity';
      const statement = pickStatement([item.title, item.value], kind);
      const figures = lead ? leadFigures(statement) : capacityFigures(statement);
      if (!figures.length) {
        skip(skipped, item.title, 'qualifying figure is not in one stored field');
        return;
      }
      pushRow(rows, seen, {
        kind: kind,
        subject: (company.name ? company.name + ' — ' : '') + (item.title || ''),
        statement: statement,
        figures: figures,
        claimLabel: 'Company development record',
        sourceLabel: item.src || '',
        sourceUrl: url,
        lastChecked: dated.lastChecked,
        precision: dated.precision,
        lastCheckedLabel: dated.label,
        region: ''
      });
    });
  });
}

function fromProvenance(list, rows, seen, skipped) {
  (list || []).forEach(function (company) {
    (company.facts || []).forEach(function (fact) {
      if (!fact || fact.field !== 'annual_capacity_mva') return;
      const url = httpUrl(fact.source_url);
      const dated = sourceDate(fact.last_verified || fact.retrieved_at, labelFromIso(fact.last_verified || fact.retrieved_at));
      if (fact.value == null || fact.value === '' || !url || !dated) {
        skip(skipped, company && company.name, 'capacity fact is missing a value, source URL, or check day');
        return;
      }
      const figure = String(fact.value) + (fact.unit ? ' ' + fact.unit : '');
      pushRow(rows, seen, {
        kind: 'factory_capacity',
        subject: (company.name || 'Manufacturer') + ' annual capacity',
        statement: fact.note || figure,
        figures: [figure],
        claimLabel: fact.claim_type === 'COMPANY_REPORTED' ? 'Company-reported' : (fact.claim_type || 'Provenance record'),
        sourceLabel: fact.source_title || '',
        sourceUrl: url,
        lastChecked: dated.lastChecked,
        precision: dated.precision,
        lastCheckedLabel: dated.label,
        region: ''
      });
    });
  });
}

function selectRows() {
  const rows = [];
  const seen = {};
  const skipped = [];
  fromIntel(readJson('data/intel.json'), rows, seen, skipped);
  fromDevelopments(readJson('data/company-developments.json'), rows, seen, skipped);
  fromProvenance(readJson('data/manufacturer-provenance.json'), rows, seen, skipped);
  rows.sort(function (a, b) {
    return String(b.lastChecked).localeCompare(String(a.lastChecked)) || String(a.subject).localeCompare(String(b.subject));
  });
  return { rows: rows, skipped: skipped };
}

function pageDay(rows) {
  let day = null;
  (rows || []).forEach(function (row) {
    if (!row || row.precision !== 'day' || !ISO_DAY.test(row.lastChecked)) return;
    if (!day || row.lastChecked > day) day = row.lastChecked;
  });
  return day;
}

module.exports = {
  selectRows: selectRows,
  pageDay: pageDay,
  sourceDate: sourceDate,
  isLeadText: isLeadText,
  isCapacityText: isCapacityText
};
