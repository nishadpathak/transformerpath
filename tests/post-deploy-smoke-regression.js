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
const publish = require('../scripts/refuse-stale-production-publish');

const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } console.log('  ✓', m); };

console.log('=== POST-DEPLOY SMOKE REGRESSION ===');

const REQUIRED = ['/', '/intel.html', '/intel', '/intelligence', '/intelligence.html', '/manufacturers.html', '/events.html', '/pricing.html', '/markets/india/', '/manufacturers/cg-power/', '/manufacturers/hitachi-energy/'];
REQUIRED.forEach(function (p) {
  assert(smoke.PAGES.indexOf(p) >= 0, 'smoke covers ' + p);
});
assert(smoke.ERROR_TEXT.some(function (e) { return e.label === 'Internal Server Error'; }), 'smoke flags Internal Server Error');
const released = 'ea26f4c500eb7cbd9ddf710bd9829d34059a5919';
const other = '3d43832047640e4ca351dd3acd2e031e8e20daca';
const matched = smoke.mainLagVerdict(released, released, released);
assert(matched.ok, 'live build.json and provenance match the released SHA');
assert(/match released/.test(matched.detail) && matched.detail.indexOf(released.slice(0, 12)) >= 0, 'verdict names the released SHA');
assert(!smoke.mainLagVerdict(other, released, released).ok, 'a live build.json from another commit fails');
assert(!smoke.mainLagVerdict(released, other, released).ok, 'a live provenance from another commit fails');
assert(!smoke.mainLagVerdict(released, released, '').ok, 'a missing released SHA fails');
const smokeSrc = fs.readFileSync('scripts/smoke-release.js', 'utf8');
assert(!/commits\/main/.test(smokeSrc), 'smoke does not read the current tip of main');
assert(!/api\.github\.com/.test(smokeSrc), 'smoke does not compare the live release to GitHub');
const OLD = 'fcd838a9e48eb8a1cbd81458e9dc7ade79d0eb5b';
const NEW = '6d3afe9643dcb128da100cd74f89335fdfc48c54';
assert(publish.shouldPublish('deploy-preview', OLD, NEW).publish, 'preview builds are not blocked when main has moved');
assert(publish.shouldPublish('production', NEW, NEW).publish, 'production publishes when COMMIT_REF is main');
assert(!publish.shouldPublish('production', OLD, NEW).publish, 'production refuses a commit main has already passed');
assert(!publish.shouldPublish('production', '', NEW).publish, 'production refuses a missing COMMIT_REF');
assert(publish.shouldPublish('production', NEW, '').publish, 'an unreadable main SHA does not freeze the deploy');

const plugin = fs.readFileSync('plugins/netlify-plugin-post-deploy-smoke/index.js', 'utf8');
const manifest = fs.readFileSync('plugins/netlify-plugin-post-deploy-smoke/manifest.yml', 'utf8');
assert(/onSuccess/.test(plugin) && /failPlugin/.test(plugin), 'Netlify plugin fails the hook when smoke fails');
assert(/context !== 'production'/.test(plugin), 'plugin smokes production deploys only');
assert(/netlify-plugin-post-deploy-smoke/.test(manifest), 'plugin manifest is named');
const workflow = fs.readFileSync('.github/workflows/post-deploy-smoke.yml', 'utf8');
assert(/deployment_status:/.test(workflow), 'GitHub Action listens for deployment_status');
assert(/github\.event\.deployment\.sha \|\| github\.sha/.test(workflow), 'the action smokes the released SHA, not the tip of main');
assert(/transformerpath\/production/.test(workflow), 'the action posts a production commit status');
assert(/statuses: write/.test(workflow), 'the action can write commit statuses');
const toml = fs.readFileSync('netlify.toml', 'utf8');
assert(/package = "\.\/plugins\/netlify-plugin-post-deploy-smoke"/.test(toml), 'netlify.toml installs the local plugin');
assert(/node scripts\/refuse-stale-production-publish\.js/.test(toml), 'the build command refuses a stale production publish');

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

function serve(bodies, onRequest) {
  return new Promise(function (resolve) {
    const server = http.createServer(function (req, res) {
      const pathname = req.url.split('?')[0];
      if (onRequest) onRequest(pathname);
      if (!Object.prototype.hasOwnProperty.call(bodies, pathname)) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('missing');
        return;
      }
      const raw = bodies[pathname];
      const body = typeof raw === 'function' ? raw() : raw;
      const type = pathname.endsWith('.json') ? 'application/json' : 'text/html';
      res.writeHead(200, { 'content-type': type });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', function () {
      resolve({ server: server, port: server.address().port });
    });
  });
}

function runSmoke(port, extraArgs) {
  return new Promise(function (resolve) {
    const child = spawn(process.execPath, [
      path.join('scripts', 'smoke-release.js'),
      'http://127.0.0.1:' + port,
      SHA
    ].concat(extraArgs || []));
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
  assert(/match released/.test(pass.stdout), 'fixture release matches the released SHA');

  const badBodies = Object.assign({}, good);
  badBodies['/pricing.html'] = page('Internal Server Error');
  const bad = await serve(badBodies);
  const fail = await runSmoke(bad.port);
  bad.server.close();
  assert(fail.status !== 0, 'error text fails smoke');
  assert(/Internal Server Error/.test(fail.stdout), 'failure names the error text');

  /* Run ea26f4c: the released SHA went live while --wait was polling, and
   * main moved to a newer tip before the check finished. That tip is not
   * the expected value. */
  const PREVIOUS = '3d43832047640e4ca351dd3acd2e031e8e20daca';
  const ADVANCED = '8ad8478499e2aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  let provenanceReads = 0;
  let mainTip = SHA;
  let mainLookups = 0;
  const moving = Object.assign({}, good);
  moving['/data/build-provenance.json'] = function () {
    provenanceReads += 1;
    if (provenanceReads === 1) {
      mainTip = ADVANCED;
      return JSON.stringify(Object.assign({}, prov, { build_commit: PREVIOUS }));
    }
    return JSON.stringify(prov);
  };
  const raced = await serve(moving, function (pathname) {
    if (/commits\/main|\/compare\//.test(pathname)) mainLookups += 1;
  });
  const racedRun = await runSmoke(raced.port, ['--wait', '--wait-minutes', '1', '--wait-interval-ms', '20']);
  raced.server.close();
  if (racedRun.status !== 0) console.error(racedRun.stdout + '\n' + racedRun.stderr);
  assert(provenanceReads >= 2, 'smoke waited while the released SHA was not live yet');
  assert(mainTip === ADVANCED, 'main advanced while the check was waiting');
  assert(mainLookups === 0, 'smoke did not look up the tip of main');
  assert(racedRun.status === 0, 'main advancing mid-run still passes when the released SHA is live');
  assert(/waiting for deploy: build_commit=/.test(racedRun.stdout), 'smoke polled until the released SHA was live');
  assert(/match released/.test(racedRun.stdout), 'smoke compares the live files to the released SHA');
  assert(!/behind main/.test(racedRun.stdout), 'smoke does not report lag behind the new main tip');
  assert(racedRun.stdout.indexOf(ADVANCED.slice(0, 12)) < 0, 'smoke does not judge the release against the new main tip');
  console.log('PASS — post-deploy smoke');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
