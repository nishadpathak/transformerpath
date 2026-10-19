#!/usr/bin/env node
/* UN Comtrade HS 8504 trade flows for country and market pages.
 *
 * Figures are primary values the public preview API returned. A missing year
 * is a year that was not in the response. This module does not sum partners
 * into a total, does not fill gaps, and does not copy one country's figures
 * onto another.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveCountry } = require('./country-codes');
const { formatDayUTC } = require('./intel-freshness');

const HS = '8504';
const HEADING = 'Electrical transformers, static converters (for example, rectifiers) and inductors';
const SOURCE_HOME = 'https://comtradeplus.un.org/';
const API = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';
const TOP_N = 5;
const DATA_FILE = path.join(__dirname, '..', 'data', 'comtrade-hs8504.json');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sourceUrl(reporterCode) {
  const code = reporterCode == null ? '' : String(reporterCode);
  if (!code) return SOURCE_HOME;
  return 'https://comtradeplus.un.org/TradeFlow?Frequency=A&CommodityCodes=' + HS + '&Reporters=' + encodeURIComponent(code);
}

function formatUsd(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const nearest = Math.round(abs);
  let frac = '';
  if (Math.abs(abs - nearest) > 1e-6) {
    const fixed = abs.toFixed(3);
    frac = fixed.slice(fixed.indexOf('.') + 1).replace(/0+$/, '');
  }
  const intPart = (frac ? Math.floor(abs + 1e-9) : nearest).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return 'US$' + sign + intPart + (frac ? '.' + frac : '');
}

function retrievedLabel(iso) {
  const label = formatDayUTC(iso);
  return /^\d{1,2} [A-Za-z]{3} \d{4}$/.test(label) ? label : '';
}

function load(file) {
  const target = file || DATA_FILE;
  try {
    const data = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) {
    return null;
  }
}

function lookup(data, countryName) {
  if (!data || !data.countries) return null;
  const resolved = resolveCountry(countryName);
  if (!resolved.ok || resolved.regional || !resolved.iso) return null;
  return data.countries[resolved.iso] || null;
}

function finiteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/* Turn raw preview rows for one flow into annual totals and a partner list.
 * partnerCode 0 is the World aggregate. It is the annual total when present.
 * Partner rows are not added up to replace a missing World total.
 */
function summarizeFlow(rows, partnerNames) {
  const names = partnerNames || {};
  const byYear = new Map();
  (rows || []).forEach(function (row) {
    if (!row || String(row.cmdCode) !== HS) return;
    const year = Number(row.period);
    if (!Number.isInteger(year) || year < 1000) return;
    if (!finiteNumber(row.primaryValue)) return;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(row);
  });
  const years = Array.from(byYear.keys()).sort(function (a, b) { return b - a; });
  const annual = [];
  years.forEach(function (year) {
    const world = byYear.get(year).filter(function (row) { return Number(row.partnerCode) === 0; });
    if (world.length !== 1) return;
    const row = world[0];
    annual.push({
      year: year,
      value_usd: row.primaryValue,
      valuation: valuationOf(row),
      classification: row.classificationCode || '',
      legacy_estimation_flag: numberOrNull(row.legacyEstimationFlag)
    });
  });
  const latest = years.length ? years[0] : null;
  let partners = [];
  let partnersComplete = false;
  let partnersNote = '';
  if (latest != null) {
    const latestRows = byYear.get(latest);
    const truncated = latestRows.some(function (row) { return row._truncated === true; });
    if (truncated) {
      partnersNote = 'The public preview did not return every partner row for ' + latest + ', so no partner ranking is shown.';
    } else {
      partnersComplete = true;
      partners = latestRows
        .filter(function (row) { return Number(row.partnerCode) !== 0 && !row._group; })
        .map(function (row) {
          const code = Number(row.partnerCode);
          const known = Object.prototype.hasOwnProperty.call(names, String(code));
          return {
            code: code,
            name: known ? names[String(code)] : '',
            value_usd: row.primaryValue,
            valuation: valuationOf(row),
            legacy_estimation_flag: numberOrNull(row.legacyEstimationFlag)
          };
        })
        .sort(function (a, b) {
          if (a.value_usd !== b.value_usd) return b.value_usd - a.value_usd;
          return a.code - b.code;
        })
        .slice(0, TOP_N);
    }
  }
  return {
    annual: annual,
    latest_year: annual.length ? annual[0].year : latest,
    partners_year: partners.length ? latest : null,
    partners: partners,
    partners_complete: partnersComplete,
    partners_note: partnersNote
  };
}

function valuationOf(row) {
  if (!row) return '';
  if (row.flowCode === 'X' && finiteNumber(row.fobvalue)) return 'FOB';
  if (row.flowCode === 'M' && finiteNumber(row.cifvalue)) return 'CIF';
  return '';
}

function numberOrNull(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function hasFigures(rec) {
  if (!rec || !rec.flows) return false;
  return ['X', 'M'].some(function (flow) {
    const block = rec.flows[flow];
    if (!block) return false;
    if (block.annual && block.annual.length) return true;
    if (block.partners && block.partners.length) return true;
    return false;
  });
}

function provenanceLine(rec, source) {
  const yearBits = [];
  function addYear(year) {
    if (year == null || year === '') return;
    const text = String(year);
    if (yearBits.indexOf(text) === -1) yearBits.push(text);
  }
  ['X', 'M'].forEach(function (flow) {
    const block = rec && rec.flows && rec.flows[flow];
    (block && block.annual || []).forEach(function (row) { addYear(row.year); });
    if (block) addYear(block.partners_year);
  });
  yearBits.sort(function (a, b) { return Number(b) - Number(a); });
  const retrieved = retrievedLabel(rec && rec.retrieved);
  const bits = [];
  if (yearBits.length) bits.push('Year' + (yearBits.length > 1 ? 's' : '') + ' ' + yearBits.join(', '));
  bits.push('Source: <a href="' + esc(source || SOURCE_HOME) + '">UN Comtrade</a>');
  if (retrieved) bits.push('Retrieved ' + esc(retrieved));
  return '<p class="comtrade-meta" style="margin:8px 0 0;font-size:.82rem;color:var(--muted)">' + bits.join(' · ') + '</p>';
}

function moneyCell(row) {
  if (!row) return 'Not returned';
  const basis = row.valuation ? ' ' + esc(row.valuation) : '';
  return esc(formatUsd(row.value_usd)) + basis;
}

function partnerList(block, flowLabel) {
  if (!block) return '<p style="color:var(--muted);font-size:.88rem">Not returned.</p>';
  const year = block.partners_year;
  if (block.partners && block.partners.length && year) {
    const items = block.partners.map(function (p) {
      const name = p.name ? esc(p.name) : ('Partner code ' + esc(String(p.code)));
      return '<li>' + name + ' · ' + moneyCell(p) + '</li>';
    }).join('');
    return '<ol style="margin:6px 0 0 1.1rem;padding:0">' + items + '</ol>';
  }
  if (block.partners_note) {
    return '<p style="color:var(--muted);font-size:.88rem">' + esc(block.partners_note) + '</p>';
  }
  if (year) {
    return '<p style="color:var(--muted);font-size:.88rem">No ' + esc(flowLabel) + ' partner rows were returned for ' + esc(String(year)) + '.</p>';
  }
  return '<p style="color:var(--muted);font-size:.88rem">No ' + esc(flowLabel) + ' partner rows were returned.</p>';
}

function figuresHtml(rec) {
  const source = rec.source_url || sourceUrl(rec.reporterCode);
  const x = rec.flows.X || { annual: [], partners: [] };
  const m = rec.flows.M || { annual: [], partners: [] };
  const years = [];
  function addYear(y) { if (years.indexOf(y) === -1) years.push(y); }
  (x.annual || []).forEach(function (row) { addYear(row.year); });
  (m.annual || []).forEach(function (row) { addYear(row.year); });
  years.sort(function (a, b) { return b - a; });
  const xBy = {};
  const mBy = {};
  (x.annual || []).forEach(function (row) { xBy[row.year] = row; });
  (m.annual || []).forEach(function (row) { mBy[row.year] = row; });
  const reporter = rec.reporterDesc ? ' Reporter in UN Comtrade: ' + rec.reporterDesc + '.' : '';
  const table = years.length
    ? '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:.88rem"><thead><tr>' +
      '<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--muted)">Year</th>' +
      '<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--muted)">Exports</th>' +
      '<th style="text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);color:var(--muted)">Imports</th>' +
      '</tr></thead><tbody>' +
      years.map(function (year) {
        return '<tr><td style="padding:8px 10px;border-bottom:1px solid var(--border);font-weight:700">' + esc(String(year)) + '</td>' +
          '<td style="padding:8px 10px;border-bottom:1px solid var(--border)">' + moneyCell(xBy[year]) + '</td>' +
          '<td style="padding:8px 10px;border-bottom:1px solid var(--border)">' + moneyCell(mBy[year]) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>'
    : '<p style="color:var(--muted);font-size:.88rem">No World total was returned. Partner rows are not summed into a total.</p>';
  const exportYear = x.partners_year ? ' (' + x.partners_year + ')' : '';
  const importYear = m.partners_year ? ' (' + m.partners_year + ')' : '';
  return '<section id="comtrade-hs8504" data-comtrade="8504" data-comtrade-retrieved="' + esc(rec.retrieved || '') + '" data-comtrade-reporter="' + esc(rec.reporterCode == null ? '' : String(rec.reporterCode)) + '">' +
    '<h2>HS 8504 trade flows</h2>' +
    '<p style="font-size:.9rem;color:var(--muted)">Annual merchandise trade in HS 8504 — ' + esc(HEADING) + ' — from the UN Comtrade public preview. Values are the API primary value in US dollars. Exports are marked FOB and imports CIF only when that field was present. A blank year is a year the API did not return. Nothing here is interpolated.' + esc(reporter) + '</p>' +
    provenanceLine(rec, source) +
    '<h3 style="font-size:1.02rem;margin:14px 0 4px">Annual values</h3>' + table +
    '<h3 style="font-size:1.02rem;margin:14px 0 4px">Top export partners' + esc(exportYear) + '</h3>' + partnerList(x, 'export') +
    '<h3 style="font-size:1.02rem;margin:14px 0 4px">Top import partners' + esc(importYear) + '</h3>' + partnerList(m, 'import') +
    '</section>';
}

function emptyReasonText(rec) {
  const reason = rec && rec.empty_reason;
  if (reason === 'no_reporter') {
    return 'UN Comtrade’s public reporter list has no reporter for this country. No trade figures are estimated from another reporter.';
  }
  if (reason === 'ambiguous_reporter') {
    return 'More than one current UN Comtrade reporter shares this country’s code. No reporter was chosen, and no figures are shown.';
  }
  if (reason === 'not_in_snapshot') {
    return 'This country is not in the retrieved UN Comtrade snapshot. No figures are estimated.';
  }
  const checked = rec && rec.years_checked && rec.years_checked.length ? rec.years_checked.join(', ') : '';
  const who = rec && rec.reporterDesc ? ' for ' + rec.reporterDesc : '';
  const span = checked ? ' Dataset years checked: ' + checked + '.' : '';
  return 'No HS 8504 annual rows were returned' + who + '.' + span + ' No figures are estimated or filled in.';
}

function emptyHtml(rec, fileRetrieved) {
  const retrieved = (rec && rec.retrieved) || fileRetrieved || '';
  const label = retrievedLabel(retrieved);
  const source = (rec && rec.source_url) || SOURCE_HOME;
  const meta = [];
  meta.push('Source: <a href="' + esc(source) + '">UN Comtrade</a>');
  if (label) meta.push('Retrieved ' + esc(label));
  return '<section id="comtrade-hs8504" data-comtrade="8504" data-comtrade-empty="1" data-comtrade-retrieved="' + esc(retrieved) + '">' +
    '<h2>HS 8504 trade flows</h2>' +
    '<p style="font-size:.9rem;color:var(--muted)">' + esc(emptyReasonText(rec)) + ' HS 8504 is ' + esc(HEADING) + '.</p>' +
    '<p class="comtrade-meta" style="margin:8px 0 0;font-size:.82rem;color:var(--muted)">' + meta.join(' · ') + '</p>' +
    '</section>';
}

function sectionHtml(countryName, data) {
  const dataset = data || load();
  if (!dataset) {
    return emptyHtml({ empty_reason: 'not_in_snapshot', source_url: SOURCE_HOME }, '');
  }
  const rec = lookup(dataset, countryName);
  if (!rec) {
    return emptyHtml({ empty_reason: 'not_in_snapshot', retrieved: dataset.retrieved, source_url: SOURCE_HOME }, dataset.retrieved);
  }
  if (!hasFigures(rec)) return emptyHtml(rec, dataset.retrieved);
  return figuresHtml(rec);
}

function cardHtml(countryName, data) {
  const dataset = data || load();
  const section = sectionHtml(countryName, dataset);
  const empty = section.indexOf('data-comtrade-empty="1"') !== -1;
  const rec = dataset ? lookup(dataset, countryName) : null;
  if (empty || !rec) {
    const label = retrievedLabel((rec && rec.retrieved) || (dataset && dataset.retrieved) || '');
    return '<p data-comtrade-card="1" data-comtrade-empty="1" style="font-size:.78rem;color:var(--muted);margin:0 0 12px">HS 8504 trade: no annual figures were returned for this country. ' +
      '<a href="' + esc(SOURCE_HOME) + '">UN Comtrade</a>' +
      (label ? ' · Retrieved ' + esc(label) : '') + '</p>';
  }
  const x = rec.flows && rec.flows.X && rec.flows.X.annual && rec.flows.X.annual[0];
  const m = rec.flows && rec.flows.M && rec.flows.M.annual && rec.flows.M.annual[0];
  const year = (x && x.year) || (m && m.year);
  const label = retrievedLabel(rec.retrieved);
  const bits = ['HS 8504'];
  if (year) bits.push(String(year));
  if (x) bits.push('exports ' + formatUsd(x.value_usd));
  if (m) bits.push('imports ' + formatUsd(m.value_usd));
  return '<p data-comtrade-card="1" style="font-size:.78rem;color:var(--text);margin:0 0 12px">' + esc(bits.join(' · ')) +
    ' · <a href="' + esc(rec.source_url || sourceUrl(rec.reporterCode)) + '">UN Comtrade</a>' +
    (label ? ' · Retrieved ' + esc(label) : '') + '</p>';
}

module.exports = {
  HS: HS,
  HEADING: HEADING,
  SOURCE_HOME: SOURCE_HOME,
  API: API,
  TOP_N: TOP_N,
  DATA_FILE: DATA_FILE,
  sourceUrl: sourceUrl,
  formatUsd: formatUsd,
  load: load,
  lookup: lookup,
  summarizeFlow: summarizeFlow,
  hasFigures: hasFigures,
  sectionHtml: sectionHtml,
  cardHtml: cardHtml,
  figuresHtml: figuresHtml,
  emptyHtml: emptyHtml
};
