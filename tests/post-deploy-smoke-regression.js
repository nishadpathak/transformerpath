#!/usr/bin/env node
/* tests/post-deploy-smoke-regression.js
 * Serves one fake release and checks the smoke script accepts it, then
 * rejects the same release when a page contains error text.
 */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const smoke = require('../scripts/smoke-release');

const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('  ✓', m); };

console.log('=== POST-DEPLOY SMOKE REGRESSION ===');

const REQUIRED = ['/', '/intel.html', '/intel', '/intelligence', '/intelligence.html', '/manufacturers.html', '/events.html', '/pricing.html', '/markets/india/', '/manufacturers/cg-power/', '/manufacturers/hitachi-energy/'];
REQUIRED.forEach(function (p) {
  assert(smoke.PAGES.indexOf(p) >= 0, 'smoke covers ' + p);
});
assert(smoke.ERROR_TEXT.some(function (e) { return e.label === 'Internal Server Error'; }), 'smoke flags Internal Server Error');
const now = Date.parse('2026-10-14T12:33:00Z');
const live = 'fcd838a9e48eb8a1cbd81458e9dc7ade79d0eb5b';
const main = '6d3afe9643dcb128da100cd74f89335fdfc48c54';
assert(smoke.mainLagVerdict(live, live, '2026-10-14T12:00:00Z', now).ok, 'matching main HEAD passes');
assert(smoke.mainLagVerdict(live, main, '2026-10-14T12:29:44Z', now).ok, 'a few minutes behind main is still a deploy in flight');
assert(!smoke.mainLagVerdict(live, main, '2026-10-14T12:00:00Z', now).ok, 'more than 15 minutes behind main fails');
assert(!smoke.mainLagVerdict(live, main, '2026-10-14T12:17:59Z', now).ok, '15 minutes plus a second fails');
assert(smoke.mainLagVerdict(live, main, '2026-10-14T12:18:00Z', now).ok, 'exactly 15 minutes is still inside the window');

const plugin = fs.readFileSync('plugins/netlify-plugin-post-deploy-smoke/index.js', 'utf8');
const manifest = fs.readFileSync('plugins/netlify-plugin-post-deploy-smoke/manifest.yml', 'utf8');
assert(/onSuccess/.test(plugin) && /failPlugin/.test(plugin), 'Netlify plugin fails the hook when smoke fails');
assert(/context !== 'production'/.test(plugin), 'plugin smokes production deploys only');
assert(/netlify-plugin-post-deploy-smoke/.test(manifest), 'plugin manifest is named');
const workflow = fs.readFileSync('.github/workflows/post-deploy-smoke.yml', 'utf8');
assert(/deployment_status:/.test(workflow), 'GitHub Action listens for deployment_status');
const toml = fs.readFileSync('netlify.toml', 'utf8');
assert(/package = "\.\/plugins\/netlify-plugin-post-deploy-smoke"/.test(toml), 'netlify.toml installs the local plugin');

const SHA = '0123456789abcdef0123456789abcdef01234567';
const BUILD = '2026-10-14T12:00:00.000Z';
const VERSION = 'abc123def456';
const prov = {
  build_commit: SHA,
  build_at: BUILD,
  data_version: VERSION
};
const build = {
  commit: SHA,
  commit_id: SHA,
  commit_source: 'COMMIT_REF',
  main_head_at_build: SHA,
  build_time: BUILD,
  data_version: VERSION,
  latest_intel_date: '2026-10-13',
  manufacturer_count: 906
};

function page(extra) {
  return '<!DOCTYPE html><html><head>' +
    '<meta name="tp-build-commit" content="' + SHA + '">' +
    '<meta name="tp-build-at" content="' + BUILD + '">' +
    '<meta name="tp-data-version" content="' + VERSION + '">' +
    '<meta name="tp-latest-intel-date" content="2026-10-13">' +
    '<meta name="tp-manufacturer-count" content="906">' +
    '</head><body>' +
    '<span data-stat="manufacturers">906</span>' +
    '<table><tr><th>Highest sourced voltage evidence</th><td>765 kV</td></tr></table>' +
    (extra || 'release ok') +
    '</body></html>';
}

function serve(bodies) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const pathname = req.url.split('?')[0];
      if (!Object.prototype.hasOwnProperty.call(bodies, pathname)) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('missing');
        return;
      }
      const body = bodies[pathname];
      const type = pathname.endsWith('.json') ? 'application/json' : 'text/html';
      res.writeHead(200, { 'content-type': type });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', function () {
      resolve({ server: server, port: server.address().port });
    });
  });
}

function runSmoke(port) {
  return new Promise(function (resolve) {
    const child = spawn(process.execPath, [
      path.join('scripts', 'smoke-release.js'),
      'http://127.0.0.1:' + port,
      SHA
    ]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', function (d) { stdout += d; });
    child.stderr.on('data', function (d) { stderr += d; });
    child.on('close', function (code) {
      resolve({ status: code, stdout: stdout, stderr: stderr });
    });
  });
}

(async function () {
  const good = {};
  smoke.PAGES.forEach(function (p) { good[p] = page(''); });
  good['/data/build-provenance.json'] = JSON.stringify(prov);
  good['/build.json'] = JSON.stringify(build);
  good['/data/site-stats.json'] = JSON.stringify({ manufacturers: 906 });

  const ok = await serve(good);
  const pass = await runSmoke(ok.port);
  ok.server.close();
  if (pass.status !== 0) console.error(pass.stdout + '\n' + pass.stderr);
  assert(pass.status === 0, 'fixture release passes smoke');
  assert(/SMOKE PASS/.test(pass.stdout), 'fixture release prints SMOKE PASS');

  const badBodies = Object.assign({}, good);
  badBodies['/pricing.html'] = page('Internal Server Error');
  const bad = await serve(badBodies);
  const fail = await runSmoke(bad.port);
  bad.server.close();
  assert(fail.status !== 0, 'error text fails smoke');
  assert(/Internal Server Error/.test(fail.stdout), 'failure names the error text');
  console.log('PASS — post-deploy smoke');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
