#!/usr/bin/env node
/* Fetch HS 8504 annual trade from the public UN Comtrade preview API.
 *
 * The preview does not need a subscription key. The full /data/v1 endpoint
 * does (HTTP 401). When the preview needs a key, errors, or runs past the
 * time budget, the committed data/comtrade-hs8504.json snapshot is kept.
 * A country is replaced only when its own requests succeed. Missing years
 * are not filled.
 *
 * Run: node scripts/fetch-comtrade-hs8504.js
 * COMTRADE_REFRESH=always refetches even when the snapshot is from today.
 * COMTRADE_REFRESH=skip keeps the snapshot after a single API probe.
 */
'use strict';
const fs = require('fs');
const https = require('https');
const path = require('path');
const comtrade = require('../lib/comtrade-hs8504');
const { resolveCountry } = require('../lib/country-codes');

const OUT = comtrade.DATA_FILE;
const TODAY = new Date().toISOString().slice(0, 10);
const BUDGET_MS = Number(process.env.COMTRADE_BUDGET_MS || 240000);
const CONCURRENCY = Number(process.env.COMTRADE_CONCURRENCY || 1);
const MAX_YEARS = 3;
const MAX_ATTEMPTS = 12;
const started = Date.now();

function getJson(url) {
  return new Promise(function (resolve, reject) {
    const req = https.get(url, {
      headers: { accept: 'application/json', 'user-agent': 'transformerpath-comtrade/1' },
      timeout: 30000
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const text = Buffer.concat(chunks).toString('utf8');
        let body = null;
        try { body = JSON.parse(text); } catch (e) { body = { error: 'invalid json', raw: text.slice(0, 180) }; }
        resolve({ status: res.statusCode, body: body });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function getJsonRetry(url) {
  let last = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (Date.now() - started > BUDGET_MS) throw new Error('budget');
    try {
      last = await getJson(url);
    } catch (e) {
      last = { status: 0, body: { error: String(e && e.message || e) } };
    }
    if (last.status === 200 && last.body && !last.body.statusCode) return last;
    if (last.status === 401 || (last.body && /subscription key/i.test(JSON.stringify(last.body)))) {
      const err = new Error('needs_key');
      err.needsKey = true;
      throw err;
    }
    const wait = last && (last.status === 429 || last.status === 403) ? 12000 * (attempt + 1) : 500 * Math.pow(2, attempt);
    await new Promise(function (r) { setTimeout(r, wait); });
  }
  const err = new Error('request failed ' + (last && last.status));
  err.last = last;
  throw err;
}

function targetCountries() {
  const names = new Set();
  JSON.parse(fs.readFileSync(path.join('data', 'manufacturers.json'), 'utf8')).forEach(function (c) {
    if (c && c.country) names.add(c.country);
  });
  const src = fs.readFileSync(path.join('build-markets.js'), 'utf8');
  const re = /gridsName:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  const out = [];
  const seen = new Set();
  names.forEach(function (name) {
    const resolved = resolveCountry(name);
    if (!resolved.ok || resolved.regional || !resolved.iso) return;
    if (seen.has(resolved.iso)) return;
    seen.add(resolved.iso);
    out.push({ iso: resolved.iso, name: resolved.name });
  });
  out.sort(function (a, b) { return a.iso < b.iso ? -1 : 1; });
  return out;
}

function chooseReporters(list) {
  const grouped = {};
  (list || []).forEach(function (row) {
    if (!row || row.isGroup) return;
    if (/\(\.\.\.\d{4}\)/.test(String(row.text || ''))) return;
    const iso = row.reporterCodeIsoAlpha2;
    if (!iso) return;
    if (!grouped[iso]) grouped[iso] = [];
    grouped[iso].push(row);
  });
  const chosen = {};
  const ambiguous = {};
  Object.keys(grouped).forEach(function (iso) {
    if (grouped[iso].length === 1) chosen[iso] = grouped[iso][0];
    else ambiguous[iso] = grouped[iso].map(function (r) { return r.reporterCode + ' ' + r.text; });
  });
  return { chosen: chosen, ambiguous: ambiguous };
}

function partnerNameMap(list) {
  const names = {};
  const groups = {};
  (list || []).forEach(function (row) {
    if (!row || row.PartnerCode == null) return;
    const code = String(row.PartnerCode);
    names[code] = row.PartnerDesc || row.text || '';
    if (row.isGroup) groups[code] = true;
  });
  return { names: names, groups: groups };
}

function previewUrl(reporterCode, period) {
  const q = new URLSearchParams({
    reporterCode: String(reporterCode),
    period: String(period),
    cmdCode: comtrade.HS,
    flowCode: 'M,X',
    partner2Code: '0',
    customsCode: 'C00',
    motCode: '0',
    maxRecords: '500'
  });
  return comtrade.API + '?' + q.toString();
}

async function fetchReporter(reporter, names, groups) {
  const da = await getJsonRetry('https://comtradeapi.un.org/public/v1/getDa/C/A/HS?reporterCode=' + reporter.reporterCode);
  const periods = Array.from(new Set((da.body.data || []).map(function (row) { return Number(row.period); })))
    .filter(function (y) { return Number.isInteger(y) && y >= 1990 && y <= 2100; })
    .sort(function (a, b) { return b - a; });
  const yearsChecked = [];
  const rows = [];
  let hits = 0;
  for (let i = 0; i < periods.length && i < MAX_ATTEMPTS && hits < MAX_YEARS; i++) {
    if (Date.now() - started > BUDGET_MS) throw new Error('budget');
    const year = periods[i];
    yearsChecked.push(year);
    await new Promise(function (r) { setTimeout(r, 1500); });
    const res = await getJsonRetry(previewUrl(reporter.reporterCode, year));
    const data = res.body.data || [];
    const count = Number(res.body.count || 0);
    const truncated = count > data.length;
    const useful = data.filter(function (row) {
      return String(row.cmdCode) === comtrade.HS && (row.flowCode === 'X' || row.flowCode === 'M') && typeof row.primaryValue === 'number';
    });
    if (!useful.length) continue;
    hits++;
    useful.forEach(function (row) {
      rows.push({
        period: row.period,
        flowCode: row.flowCode,
        partnerCode: row.partnerCode,
        cmdCode: String(row.cmdCode),
        primaryValue: row.primaryValue,
        cifvalue: typeof row.cifvalue === 'number' ? row.cifvalue : null,
        fobvalue: typeof row.fobvalue === 'number' ? row.fobvalue : null,
        classificationCode: row.classificationCode || '',
        legacyEstimationFlag: typeof row.legacyEstimationFlag === 'number' ? row.legacyEstimationFlag : null,
        _truncated: truncated,
        _group: !!groups[String(row.partnerCode)]
      });
    });
  }
  const xRows = rows.filter(function (row) { return row.flowCode === 'X'; });
  const mRows = rows.filter(function (row) { return row.flowCode === 'M'; });
  const flows = {
    X: comtrade.summarizeFlow(xRows, names),
    M: comtrade.summarizeFlow(mRows, names)
  };
  const record = {
    iso: reporter.reporterCodeIsoAlpha2,
    name: reporter.reporterDesc || reporter.text,
    reporterCode: reporter.reporterCode,
    reporterDesc: reporter.reporterDesc || reporter.text || '',
    retrieved: TODAY,
    source_url: comtrade.sourceUrl(reporter.reporterCode),
    years_checked: yearsChecked,
    empty_reason: '',
    flows: flows
  };
  if (!comtrade.hasFigures(record)) record.empty_reason = 'no_rows';
  return record;
}

function emptyRecord(iso, reason, reporter) {
  return {
    iso: iso,
    name: '',
    reporterCode: reporter ? reporter.reporterCode : null,
    reporterDesc: reporter ? (reporter.reporterDesc || reporter.text || '') : '',
    retrieved: TODAY,
    source_url: reporter ? comtrade.sourceUrl(reporter.reporterCode) : comtrade.SOURCE_HOME,
    years_checked: [],
    empty_reason: reason,
    flows: { X: comtrade.summarizeFlow([], {}), M: comtrade.summarizeFlow([], {}) }
  };
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  }
  const runners = [];
  for (let i = 0; i < limit; i++) runners.push(run());
  await Promise.all(runners);
  return out;
}

function writeSnapshot(doc) {
  const tmp = OUT + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  fs.renameSync(tmp, OUT);
}

async function main() {
  const previous = comtrade.load(OUT);
  const refresh = process.env.COMTRADE_REFRESH || '';
  if (refresh === 'skip' && previous && previous.countries) {
    console.log('COMTRADE_REFRESH=skip — keeping snapshot retrieved ' + (previous.retrieved || ''));
    return;
  }
  let probe;
  try {
    probe = await getJsonRetry(previewUrl(842, 2024));
  } catch (e) {
    if (e.needsKey) {
      console.log('UN Comtrade preview requires a subscription key. Keeping the committed snapshot.');
      if (!previous) process.exit(1);
      return;
    }
    console.log('UN Comtrade preview probe failed (' + e.message + '). Keeping the committed snapshot.');
    if (!previous) process.exit(1);
    return;
  }
  if (!probe.body || !Array.isArray(probe.body.data)) {
    console.log('UN Comtrade preview probe returned no data. Keeping the committed snapshot.');
    if (!previous) process.exit(1);
    return;
  }
  if (refresh !== 'always' && previous && previous.complete === true && previous.countries && Object.keys(previous.countries).length) {
    console.log('Public preview probe ok. Keeping the committed snapshot retrieved ' + (previous.retrieved || '') + '. Set COMTRADE_REFRESH=always to refetch.');
    return;
  }
  console.log('Fetching HS 8504 from the public UN Comtrade preview…');
  const reporters = await getJsonRetry('https://comtradeapi.un.org/files/v1/app/reference/Reporters.json');
  const partners = await getJsonRetry('https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json');
  const choice = chooseReporters(reporters.body.results || []);
  const partnerInfo = partnerNameMap(partners.body.results || []);
  const targets = targetCountries();
  const countries = previous && previous.countries ? Object.assign({}, previous.countries) : {};
  let updated = 0;
  let failed = 0;
  await mapPool(targets, CONCURRENCY, async function (target) {
    if (refresh !== 'always' && countries[target.iso] && countries[target.iso].retrieved) {
      console.log('have ' + target.iso);
      return;
    }
    if (choice.ambiguous[target.iso]) {
      countries[target.iso] = emptyRecord(target.iso, 'ambiguous_reporter', null);
      updated++;
      console.log('ambiguous ' + target.iso + ' ' + choice.ambiguous[target.iso].join(' | '));
      return;
    }
    const reporter = choice.chosen[target.iso];
    if (!reporter) {
      countries[target.iso] = emptyRecord(target.iso, 'no_reporter', null);
      countries[target.iso].name = target.name;
      updated++;
      console.log('no reporter ' + target.iso + ' ' + target.name);
      return;
    }
    try {
      const record = await fetchReporter(reporter, partnerInfo.names, partnerInfo.groups);
      record.iso = target.iso;
      record.name = target.name;
      countries[target.iso] = record;
      updated++;
      const x = record.flows.X.annual[0];
      const m = record.flows.M.annual[0];
      console.log('ok ' + target.iso + ' ' + record.reporterDesc +
        ' years ' + (record.years_checked || []).join(',') +
        ' X ' + (x ? x.year + ':' + x.value_usd : '-') +
        ' M ' + (m ? m.year + ':' + m.value_usd : '-'));
    } catch (e) {
      failed++;
      console.log('keep previous ' + target.iso + ' (' + e.message + ')');
    }
  });
  const doc = {
    hs: comtrade.HS,
    heading: comtrade.HEADING,
    source: 'UN Comtrade',
    source_url: comtrade.SOURCE_HOME,
    api: comtrade.API,
    classification: 'HS',
    retrieved: TODAY,
    complete: failed === 0,
    note: 'Primary values in US dollars as returned by the public UN Comtrade preview for HS 8504. A missing year was not in the response. Partner rows are not summed into a World total. No values are interpolated.',
    countries: countries
  };
  writeSnapshot(doc);
  console.log('Wrote ' + OUT + ' updated ' + updated + ' failed ' + failed + ' countries ' + Object.keys(countries).length);
  if (!Object.keys(countries).length) process.exit(1);
}

main().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
