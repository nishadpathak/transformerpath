#!/usr/bin/env node
/* Re-check data/public-tender-notices.json against public procurement APIs.
 *
 * TED uses the public search API. The World Bank uses its procurement-notice
 * API. ADB and AfDB are requested on their public sites. A source that fails
 * or is blocked keeps the rows already stored for that source. The script
 * never invents a buyer, a value, or a deadline, and it never reads
 * TendersOnTime.
 *
 * A matching TED notice updates close_at only when the API returns a
 * different offset instant for that publication number. A matching World
 * Bank notice updates last_verified when the calendar day still matches.
 * --discover prints further current TED and World Bank notices and does
 * not write them.
 *
 * Run: node scripts/refresh-public-tenders.js
 *      node scripts/refresh-public-tenders.js --discover
 */
'use strict';

const fs = require('fs');
const https = require('https');
const { validateNotice } = require('../lib/tender-notices');

const FILE = 'data/public-tender-notices.json';
const TODAY = new Date().toISOString().slice(0, 10);
const DISCOVER = process.argv.indexOf('--discover') !== -1;
const UA = 'transformerpath-tender-refresh/1';

function request(url, options) {
  const opts = options || {};
  return new Promise(function (resolve, reject) {
    const lib = url.indexOf('https://') === 0 ? https : null;
    if (!lib) return reject(new Error('https only'));
    const req = lib.request(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'user-agent': UA, accept: 'application/json' }, opts.headers || {}),
      timeout: 40000
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function sourceOf(notice) {
  const url = String(notice && notice.official_source_url || '');
  if (/ted\.europa\.eu/i.test(url)) return 'ted';
  if (/worldbank\.org/i.test(url)) return 'worldbank';
  if (/adb\.org/i.test(url)) return 'adb';
  if (/afdb\.org/i.test(url)) return 'afdb';
  return '';
}

async function tedByNumber(numbers) {
  if (!numbers.length) return { ok: false, notices: [] };
  const query = numbers.map(function (n) { return 'publication-number=' + n; }).join(' OR ');
  try {
    const res = await request('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: query,
        fields: ['publication-number', 'deadline-receipt-request', 'buyer-name', 'notice-title'],
        limit: Math.min(100, numbers.length),
        page: 1,
        scope: 'ALL',
        paginationMode: 'PAGE_NUMBER'
      })
    });
    if (res.status !== 200) return { ok: false, status: res.status, notices: [] };
    const data = JSON.parse(res.body);
    return { ok: true, notices: data.notices || [] };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), notices: [] };
  }
}

async function worldBank(id) {
  try {
    const res = await request('https://search.worldbank.org/api/v2/procnotices?format=json&id=' + encodeURIComponent(id));
    if (res.status !== 200) return { ok: false, status: res.status };
    const data = JSON.parse(res.body);
    const row = (data.procnotices || [])[0];
    return { ok: !!row, row: row || null };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function probe(url) {
  try {
    const res = await request(url, { headers: { accept: 'text/html,application/json' } });
    return res.status;
  } catch (e) {
    return 0;
  }
}

function deadlineDay(closeAt) {
  const match = String(closeAt || '').match(/(20\d{2}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

async function discoverTed() {
  const day = TODAY.replace(/-/g, '');
  const res = await request('https://api.ted.europa.eu/v3/notices/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'notice-type = cn-standard AND deadline-receipt-request >= ' + day + ' AND (notice-title ~ transformer OR notice-title ~ switchgear OR notice-title ~ substation)',
      fields: ['publication-number', 'notice-title', 'buyer-name', 'deadline-receipt-request', 'buyer-country'],
      limit: 15,
      page: 1,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER'
    })
  });
  if (res.status !== 200) {
    console.log('discover TED failed ' + res.status);
    return;
  }
  const data = JSON.parse(res.body);
  console.log('discover TED candidates ' + (data.totalNoticeCount || 0) + ' (showing up to 15, not written)');
  (data.notices || []).forEach(function (n) {
    const title = n['notice-title'] && (n['notice-title'].eng || n['notice-title'].ENG);
    const label = Array.isArray(title) ? title[0] : title;
    console.log('  ' + n['publication-number'] + ' ' + ((n['deadline-receipt-request'] || [])[0] || '') + ' ' + String(label || '').slice(0, 110));
  });
}

async function main() {
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const notices = doc.notices || [];
  const tedRefs = notices.filter(function (n) { return sourceOf(n) === 'ted'; }).map(function (n) { return n.official_reference; });
  const ted = await tedByNumber(tedRefs);
  const byPub = {};
  if (ted.ok) {
    ted.notices.forEach(function (n) { if (n['publication-number']) byPub[n['publication-number']] = n; });
    console.log('TED re-check returned ' + ted.notices.length + ' of ' + tedRefs.length);
  } else {
    console.log('TED re-check skipped (' + (ted.status || ted.error || 'failed') + '); stored TED rows kept');
  }

  for (let i = 0; i < notices.length; i++) {
    const notice = notices[i];
    const kind = sourceOf(notice);
    if (kind === 'ted' && ted.ok) {
      const hit = byPub[notice.official_reference];
      if (!hit) {
        console.log('  ' + notice.official_reference + ' not in this TED response; row kept');
        continue;
      }
      const deadline = (hit['deadline-receipt-request'] || [])[0] || '';
      if (deadline && deadline !== notice.close_at) {
        console.log('  ' + notice.official_reference + ' deadline ' + notice.close_at + ' -> ' + deadline);
        notice.close_at = deadline;
      }
      notice.last_verified = TODAY;
    } else if (kind === 'worldbank') {
      const hit = await worldBank(notice.official_reference);
      if (!hit.ok || !hit.row) {
        console.log('  ' + notice.official_reference + ' World Bank re-check failed; row kept');
        continue;
      }
      const apiDay = deadlineDay(hit.row.submission_deadline_date);
      const storedDay = deadlineDay(notice.close_at);
      if (apiDay && storedDay && apiDay !== storedDay) {
        console.log('  ' + notice.official_reference + ' calendar day on the API is ' + apiDay + '; stored ' + storedDay + ' left unchanged');
      } else if (apiDay && apiDay === storedDay) {
        notice.last_verified = TODAY;
      }
    }
  }

  const adb = await probe('https://www.adb.org/projects/tenders');
  const afdb = await probe('https://www.afdb.org/en/projects-and-operations/procurement');
  console.log('ADB public tenders page status ' + adb + (adb === 200 ? '' : ' (no ADB rows added)'));
  console.log('AfDB procurement page status ' + afdb + (afdb === 200 ? '' : ' (no AfDB rows added)'));

  let invalid = 0;
  notices.forEach(function (notice) {
    const errors = validateNotice(notice);
    if (errors.length) {
      invalid++;
      console.log('  invalid ' + notice.official_reference + ' ' + errors.join(','));
    }
  });
  if (invalid) {
    console.error('refresh left ' + invalid + ' invalid rows; file not written');
    process.exit(1);
  }
  doc.notices = notices;
  fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
  console.log('wrote ' + notices.length + ' public notices');

  if (DISCOVER) {
    try { await discoverTed(); }
    catch (e) { console.log('discover TED error ' + (e && e.message || e)); }
  }
}

main().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
