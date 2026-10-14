#!/usr/bin/env node
/* scripts/weekly-link-check.js — live website check for the public directories.
 *
 * Classification (checked with curl):
 *   ok            HTTP 2xx, no redirect
 *   redirected    HTTP 2xx after a 3xx, or a final 3xx
 *   blocked       401, 403, 406, 429, 451 — not dead
 *   dead          DNS failure, 404, 410
 *   error         HTTP 5xx
 *   unreachable   timeout, TLS failure, empty reply, other transport errors
 *
 * Does not change directory records. Writes data/directory-link-check.json.
 * Exit 0 unless --fail-on-dead is set and at least one confirmed dead link
 * remains.
 *
 * Run: node scripts/weekly-link-check.js
 *      node scripts/weekly-link-check.js --urls https://example.com/
 *      node scripts/weekly-link-check.js --fail-on-dead
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadDirectories } = require('../lib/directory-records');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const failOnDead = args.indexOf('--fail-on-dead') !== -1;
let only = null;
const ui = args.indexOf('--urls');
if (ui !== -1 && args[ui + 1]) only = args[ui + 1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const outIdx = args.indexOf('--out');
const outPath = outIdx !== -1 && args[outIdx + 1]
  ? path.resolve(args[outIdx + 1])
  : path.join(ROOT, 'data', 'directory-link-check.json');

const UA = 'Mozilla/5.0 (compatible; TransformerPathLinkCheck/1.0; +https://transformerpath.com)';

function checkedDate() {
  return new Date().toISOString().slice(0, 10);
}

function collect() {
  const dirs = loadDirectories();
  const map = new Map();
  Object.keys(dirs).forEach(function (directory) {
    dirs[directory].forEach(function (row) {
      const url = String(row.website || '').trim();
      if (!url) return;
      if (!map.has(url)) map.set(url, []);
      map.get(url).push({ directory: directory, name: row.name, country: row.country });
    });
  });
  return map;
}

function curl(url) {
  return new Promise(function (resolve) {
    const child = spawn('curl', [
      '-sS', '-o', '/dev/null', '--http1.1', '-A', UA,
      '--max-time', '18', '--connect-timeout', '8',
      '-L', '--max-redirs', '6',
      '-w', '%{http_code}\t%{url_effective}\t%{num_redirects}',
      url
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(function () { child.kill('SIGKILL'); }, 22000);
    child.stdout.on('data', function (d) { stdout += d; });
    child.stderr.on('data', function (d) { stderr += d; });
    child.on('close', function () {
      clearTimeout(timer);
      const line = stdout.trim().split('\n').pop() || '';
      const parts = line.split('\t');
      resolve({
        code: Number(parts[0] || 0),
        finalUrl: parts[1] || '',
        redirects: Number(parts[2] || 0),
        err: stderr.trim().slice(0, 240)
      });
    });
  });
}

function classify(res) {
  const code = res.code || 0;
  const curlNo = (String(res.err || '').match(/curl: \((\d+)\)/) || [])[1] || '';
  if (code === 401 || code === 403 || code === 406 || code === 429 || code === 451) return 'blocked';
  if (code === 404 || code === 410 || curlNo === '6') return 'dead';
  if (code >= 500) return 'error';
  if (code >= 200 && code < 300) return res.redirects > 0 ? 'redirected' : 'ok';
  if (code >= 300 && code < 400) return 'redirected';
  return 'unreachable';
}

async function main() {
  const map = collect();
  let urls = [...map.keys()];
  if (only) urls = only;
  const concurrency = 16;
  let index = 0;
  const results = [];
  async function worker() {
    while (index < urls.length) {
      const url = urls[index++];
      const res = await curl(url);
      const status = classify(res);
      results.push({
        url: url,
        status: status,
        http_code: res.code || 0,
        final_url: res.finalUrl || '',
        redirects: res.redirects || 0,
        error: status === 'ok' ? '' : (res.err || ''),
        used_by: map.get(url) || []
      });
      if (results.length % 100 === 0) {
        process.stderr.write('checked ' + results.length + '/' + urls.length + '\n');
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length || 1) }, function () { return worker(); }));
  results.sort(function (a, b) { return a.url < b.url ? -1 : a.url > b.url ? 1 : 0; });
  const summary = { ok: 0, redirected: 0, blocked: 0, dead: 0, error: 0, unreachable: 0 };
  results.forEach(function (r) { summary[r.status] = (summary[r.status] || 0) + 1; });
  const byDirectory = {};
  results.forEach(function (r) {
    (r.used_by || []).forEach(function (u) {
      if (!byDirectory[u.directory]) byDirectory[u.directory] = { ok: 0, redirected: 0, blocked: 0, dead: 0, error: 0, unreachable: 0 };
      byDirectory[u.directory][r.status] = (byDirectory[u.directory][r.status] || 0) + 1;
    });
  });
  const report = {
    checked: checkedDate(),
    method: 'curl --http1.1 -L. 403, 406 and 429 are blocked, not dead. DNS failure and HTTP 404/410 are dead. TLS failures, timeouts and HTTP 5xx are not treated as dead.',
    summary: summary,
    by_directory: byDirectory,
    results: results
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log('LINK CHECK ' + report.checked + ' ' + JSON.stringify(summary) + ' → ' + outPath);
  if (failOnDead && summary.dead > 0) process.exit(1);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
