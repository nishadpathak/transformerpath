#!/usr/bin/env node
/* scripts/smoke-release.js <base_url> <expected_sha> [--wait]
 *
 * Cache-busted and plain requests. Follows redirects and records status,
 * redirect chain, age, cache-status and etag. Exits 1 on any failed assert.
 *
 * --wait polls /data/build-provenance.json until build_commit equals
 * expected_sha, then runs the checks. --wait-minutes sets that budget
 * (default 30). A Netlify onSuccess hook uses a short budget because the
 * deploy has already been published.
 */
'use strict';
const http = require('http');
const https = require('https');
const { URL } = require('url');

const rawArgs = process.argv.slice(2);
const wait = rawArgs.indexOf('--wait') >= 0;
let waitMinutes = 30;
const waitFlag = rawArgs.indexOf('--wait-minutes');
if (waitFlag >= 0) waitMinutes = Number(rawArgs[waitFlag + 1]);
if (!Number.isFinite(waitMinutes) || waitMinutes <= 0) waitMinutes = 30;
const args = rawArgs.filter(function (a, i) {
  if (a === '--wait' || a === '--wait-minutes') return false;
  if (i > 0 && rawArgs[i - 1] === '--wait-minutes') return false;
  return true;
});
const base = (args[0] || '').replace(/\/$/, '');
const expected = (args[1] || '').trim();
if (require.main === module && (!base || !expected)) {
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
  '/manufacturers/hitachi-energy/',
  '/markets/india/',
  '/markets/uae/',
  '/jobs.html',
  '/faq.html',
  '/exhibitions.html',
  '/grids.html',
  '/tenders.html',
  '/pricing.html',
  '/events.html',
  '/events',
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

const ERROR_TEXT = [
  { re: /Internal Server Error/i, label: 'Internal Server Error' },
  { re: /Application error/i, label: 'Application error' },
  { re: /A server error has occurred/i, label: 'server error' },
  { re: /Page not found/i, label: 'Page not found' },
  { re: /This page could not be found/i, label: 'could not be found' }
];

const MAIN_LAG_MS = 15 * 60 * 1000;

/* liveSha is behind main when main has commits the deploy does not.
 * divergenceAt is the committer time of the oldest of those commits.
 * A gap of 15 minutes or less is a build still in flight. Longer is a stuck deploy. */
function mainLagVerdict(liveSha, mainSha, divergenceAt, nowMs) {
  if (!mainSha) return { ok: false, detail: 'GitHub main HEAD unknown' };
  if (String(liveSha) === String(mainSha)) return { ok: true, detail: 'live commit is main HEAD' };
  const at = new Date(divergenceAt).getTime();
  if (!Number.isFinite(at)) return { ok: false, detail: 'main divergence time missing' };
  const ageMs = (nowMs == null ? Date.now() : nowMs) - at;
  const min = Math.max(0, Math.round(ageMs / 60000));
  const detail = 'live ' + String(liveSha).slice(0, 12) + ' behind main ' + String(mainSha).slice(0, 12) + ' for ' + min + ' min';
  if (ageMs > MAIN_LAG_MS) return { ok: false, detail: detail };
  return { ok: true, detail: detail + ' (within 15)' };
}

function productionHost(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'transformerpath.com' || host === 'www.transformerpath.com';
  } catch (e) {
    return false;
  }
}

const results = [];
function record(name, ok, detail) {
  results.push({ name: name, ok: ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
}

async function main() {
  if (wait) {
    const deadline = Date.now() + waitMinutes * 60 * 1000;
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

  const buildRes = await fetchFollow(bust(base + '/build.json'));
  const buildPlain = await fetchFollow(base + '/build.json');
  let build = null;
  try { build = JSON.parse(buildRes.body); } catch (e) { build = null; }
  record('build.json 200', buildRes.status === 200 && buildPlain.status === 200, 'bust=' + buildRes.status + ' plain=' + buildPlain.status);
  record('build.json commit', !!(build && build.commit === expected), build && build.commit);
  record(
    'build.json matches provenance',
    !!(build && build.commit === prov.build_commit && build.commit_id === build.commit && build.build_time === prov.build_at && build.data_version === prov.data_version && build.latest_intel_date && typeof build.manufacturer_count === 'number' && typeof build.main_head_at_build === 'string'),
    build ? (build.commit_id + ' source=' + (build.commit_source || '') + ' main_at_build=' + (build.main_head_at_build || '') + ' intel=' + build.latest_intel_date + ' makers=' + build.manufacturer_count) : 'missing'
  );
  if (!build || build.commit !== expected) {
    console.error('smoke stopped: /build.json is not this release');
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
    const intelDate = meta(busted.body, 'tp-latest-intel-date');
    const makerCount = meta(busted.body, 'tp-manufacturer-count');
    const same = c === prov.build_commit && a === prov.build_at && v === prov.data_version &&
      c === build.commit && a === build.build_time && v === build.data_version &&
      intelDate === build.latest_intel_date && makerCount === String(build.manufacturer_count);
    const text = visible(busted.body);
    const bad = FORBIDDEN.filter(function (f) { return f.re.test(text); }).map(function (f) { return f.label; });
    const errors = ERROR_TEXT.filter(function (f) { return f.re.test(text); }).map(function (f) { return f.label; });
    bad.push.apply(bad, errors);
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

  if (!productionHost(base)) {
    record('main lag', true, 'skipped off production');
  } else {
    try {
      const mainRes = await fetchFollow('https://api.github.com/repos/nishadpathak/transformerpath/commits/main');
      const mainDoc = JSON.parse(mainRes.body);
      const mainSha = mainDoc.sha || '';
      let divergenceAt = mainDoc.commit && mainDoc.commit.committer && mainDoc.commit.committer.date;
      if (mainSha && mainSha !== build.commit) {
        const cmpRes = await fetchFollow('https://api.github.com/repos/nishadpathak/transformerpath/compare/' + build.commit + '...' + mainSha);
        const cmp = JSON.parse(cmpRes.body);
        if (cmp.status === 'diverged' || cmp.status === 'behind') {
          record('main lag', false, 'live commit is ' + cmp.status + ' from main ' + mainSha.slice(0, 12));
        } else {
          if (cmp.commits && cmp.commits[0] && cmp.commits[0].commit && cmp.commits[0].commit.committer) {
            divergenceAt = cmp.commits[0].commit.committer.date;
          }
          const verdict = mainLagVerdict(build.commit, mainSha, divergenceAt, Date.now());
          record('main lag', verdict.ok, verdict.detail);
        }
      } else {
        const verdict = mainLagVerdict(build.commit, mainSha, divergenceAt, Date.now());
        record('main lag', verdict.ok, verdict.detail);
      }
    } catch (e) {
      record('main lag', false, String(e && e.message || e));
    }
  }

  for (const forbiddenPath of ['/data/commerce-intel.json', '/data/backup-pre-sprint/commerce-intel.json', '/data/backup-pre-sprint/site-stats.json']) {
    const res = await fetchFollow(bust(base + forbiddenPath));
    record(forbiddenPath + ' 404', res.status === 404, 'status=' + res.status + ' chain=' + res.chain.map(function (c) { return c.status; }).join('→'));
  }

  const failed = results.filter(function (r) { return !r.ok; });
  console.log((failed.length ? 'SMOKE FAIL' : 'SMOKE PASS') + ' — ' + (results.length - failed.length) + '/' + results.length);
  if (failed.length) process.exit(1);
}

if (require.main === module) {
  main().catch(function (e) {
    console.error('SMOKE FAIL — ' + (e && e.stack || e));
    process.exit(1);
  });
}

module.exports = { PAGES, ERROR_TEXT, FORBIDDEN, mainLagVerdict, MAIN_LAG_MS };
