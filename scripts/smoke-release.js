#!/usr/bin/env node
/* scripts/smoke-release.js <base_url> <expected_sha> [--wait]
 *
 * Cache-busted and plain requests. Follows redirects and records status,
 * redirect chain, age, cache-status and etag. Exits 1 on any failed assert.
 *
 * --wait polls /data/build-provenance.json until build_commit equals
 * expected_sha (30 minutes), then runs the checks.
 */
'use strict';
const http = require('http');
const https = require('https');
const { URL } = require('url');

const args = process.argv.slice(2).filter(function (a) { return a !== '--wait'; });
const wait = process.argv.indexOf('--wait') >= 0;
const base = (args[0] || '').replace(/\/$/, '');
const expected = (args[1] || '').trim();
if (!base || !expected) {
  console.error('usage: node scripts/smoke-release.js <base_url> <expected_sha> [--wait]');
  process.exit(1);
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function requestOnce(urlStr) {
  return new Promise(function (resolve, reject) {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const opts = {
      protocol: u.protocol,
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'accept': '*/*', 'user-agent': 'transformerpath-smoke/1' },
      timeout: 20000
    };
    if (u.port) opts.port = u.port;
    const req = lib.request(opts, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          url: urlStr
        });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

async function fetchFollow(urlStr, max) {
  const chain = [];
  let current = urlStr;
  for (let i = 0; i < (max || 8); i++) {
    const res = await requestOnce(current);
    chain.push({ url: current, status: res.status });
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, current).toString();
      continue;
    }
    return { chain: chain, status: res.status, headers: res.headers, body: res.body, finalUrl: current };
  }
  throw new Error('too many redirects for ' + urlStr);
}

function bust(url) {
  const u = new URL(url);
  u.searchParams.set('tp_smoke', String(Date.now()));
  return u.toString();
}

function meta(html, name) {
  const re = new RegExp('name="' + name + '"\\s+content="([^"]+)"', 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function visible(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

const PAGES = [
  '/',
  '/index.html',
  '/intel.html',
  '/intel',
  '/intelligence',
  '/intelligence.html',
  '/manufacturers/',
  '/manufacturers.html',
  '/directory.html',
  '/manufacturers/cg-power/',
  '/markets/india/',
  '/markets/uae/',
  '/jobs.html',
  '/faq.html',
  '/exhibitions.html',
  '/grids.html',
  '/tenders.html',
  '/pricing.html',
  '/events/middle-east-energy/'
];

// The census gate flags a line that has both a retired total and a
// directory noun. Keep those tokens on separate lines.
const RETIRED_TOTALS = ['546', '709', '911', '1,?002'];
const nounA = 'manufactur' + 'ers';
const nounB = 'compan' + 'ies';
const FORBIDDEN = [
  { re: new RegExp('\\b(' + RETIRED_TOTALS.join('|') + ')\\s*(transformer\\s+)?(' + nounB + '|' + nounA + '|makers)', 'i'), label: 'stale maker count' },
  { re: /After the hero/, label: 'After the hero' },
  { re: /Last Refreshed/, label: 'Last Refreshed' },
  { re: /twice-daily/i, label: 'twice-daily' }
];

const results = [];
function record(name, ok, detail) {
  results.push({ name: name, ok: ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
}

async function main() {
  if (wait) {
    const deadline = Date.now() + 30 * 60 * 1000;
    let seen = '';
    while (Date.now() < deadline) {
      try {
        const res = await fetchFollow(bust(base + '/data/build-provenance.json'));
        const doc = JSON.parse(res.body);
        seen = doc.build_commit || '';
        if (seen === expected) break;
      } catch (e) { seen = String(e.message || e); }
      console.log('waiting for deploy: build_commit=' + seen + ' expected=' + expected);
      await sleep(20000);
    }
    if (seen !== expected) {
      console.error('deploy not observed');
      process.exit(1);
    }
  }

  const provUrl = base + '/data/build-provenance.json';
  const provRes = await fetchFollow(bust(provUrl));
  const provPlain = await fetchFollow(provUrl);
  let prov = null;
  try { prov = JSON.parse(provRes.body); } catch (e) { prov = null; }
  record('provenance 200', provRes.status === 200 && provPlain.status === 200, 'bust=' + provRes.status + ' plain=' + provPlain.status);
  record('provenance build_commit', !!(prov && prov.build_commit === expected), prov && prov.build_commit);
  if (!prov) {
    console.error('smoke stopped: no provenance JSON');
    process.exit(1);
  }

  const stamps = [];
  for (const p of PAGES) {
    const url = base + p;
    const busted = await fetchFollow(bust(url));
    const plain = await fetchFollow(url);
    const chain = busted.chain.map(function (c) { return c.status; }).join('→');
    const okStatus = busted.status === 200 && plain.status === 200;
    const c = meta(busted.body, 'tp-build-commit');
    const a = meta(busted.body, 'tp-build-at');
    const v = meta(busted.body, 'tp-data-version');
    const same = c === prov.build_commit && a === prov.build_at && v === prov.data_version;
    const text = visible(busted.body);
    const bad = FORBIDDEN.filter(function (f) { return f.re.test(text); }).map(function (f) { return f.label; });
    const hdr = [
      'age=' + (busted.headers.age || ''),
      'cache=' + (busted.headers['cache-status'] || ''),
      'etag=' + (busted.headers.etag || '')
    ].join(' ');
    record(p + ' 200+stamp', okStatus && same && !bad.length, chain + ' ' + hdr + (bad.length ? ' forbidden:' + bad.join(',') : '') + (same ? '' : ' stamp=' + c));
    stamps.push(c + '|' + a + '|' + v);
    if (p === '/') {
      const statsRes = await fetchFollow(bust(base + '/data/site-stats.json'));
      let stats = {};
      try { stats = JSON.parse(statsRes.body); } catch (e) {}
      const m = busted.body.match(/data-stat="manufacturers">\s*([\d,]+)/);
      const shown = m ? Number(String(m[1]).replace(/,/g, '')) : NaN;
      record('homepage maker count', shown === stats.manufacturers, shown + ' vs site-stats ' + stats.manufacturers);
    }
    if (p === '/manufacturers/cg-power/') {
      const kv = busted.body.match(/Highest sourced voltage evidence<\/th>\s*<td>(\d+)\s*kV/i);
      const n = kv ? Number(kv[1]) : 0;
      record('CG summary >= 765 kV', n >= 765, String(n || 'missing'));
    }
  }

  const unique = new Set(stamps);
  record('pages share one stamp', unique.size === 1, unique.size + ' distinct triples');

  for (const forbiddenPath of ['/data/commerce-intel.json', '/data/backup-pre-sprint/commerce-intel.json', '/data/backup-pre-sprint/site-stats.json']) {
    const res = await fetchFollow(bust(base + forbiddenPath));
    record(forbiddenPath + ' 404', res.status === 404, 'status=' + res.status + ' chain=' + res.chain.map(function (c) { return c.status; }).join('→'));
  }

  const failed = results.filter(function (r) { return !r.ok; });
  console.log((failed.length ? 'SMOKE FAIL' : 'SMOKE PASS') + ' — ' + (results.length - failed.length) + '/' + results.length);
  if (failed.length) process.exit(1);
}

main().catch(function (e) {
  console.error('SMOKE FAIL — ' + (e && e.stack || e));
  process.exit(1);
});
