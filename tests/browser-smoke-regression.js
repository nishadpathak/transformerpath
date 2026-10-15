#!/usr/bin/env node
/* The browser smoke and the rollback plan must be testable without Playwright
 * and without a Netlify token. */
'use strict';
const fs = require('fs');
const smoke = require('../scripts/browser-smoke');
const rollback = require('../scripts/rollback-production');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

console.log('=== BROWSER SMOKE REGRESSION ===');
const paths = smoke.PAGES.map(function (p) { return p.path; });
['/', '/intel', '/intelligence', '/manufacturers/', '/manufacturers/cg-power/', '/power3d.html', '/events', '/pricing.html', '/markets/india/'].forEach(function (p) {
  check('covers ' + p, paths.indexOf(p) >= 0);
});
check('power3d is the canvas page', smoke.PAGES.some(function (p) { return p.path === '/power3d.html' && p.canvas; }));

const home = { status: 'UPDATED 14 Oct 2026', source: '2026-10-14', checked: '2026-10-14' };
check('matching banners agree', smoke.bannerAgreement(home, Object.assign({}, home), Object.assign({}, home)).ok);
check('a different status fails', !smoke.bannerAgreement(home, Object.assign({}, home, { status: 'OTHER' }), home).ok);
check('390px with no overflow passes', smoke.overflowVerdict(390, 390, 'visible'));
check('one pixel of subpixel slack passes', smoke.overflowVerdict(391, 390, 'visible'));
check('a wider document fails', !smoke.overflowVerdict(420, 390, 'visible'));
check('a clipped root is not a document overflow', smoke.overflowVerdict(791, 390, 'hidden'));
check('a ready canvas passes', smoke.canvasPresent({ ready: true, hasCanvas: true }).ok);
check('a WebGL fallback passes', smoke.canvasPresent({ unavailable: true, hasFallback: true }).detail === 'fallback');
check('a missing canvas fails', !smoke.canvasPresent({ ready: false, hasCanvas: false }).ok);
check('analytics noise is ignored', smoke.isIgnoredConsole('console: Failed to load https://www.googletagmanager.com/gtag/js'));
check('a same-origin error is kept', !smoke.isIgnoredConsole('pageerror: Cannot read properties of null'));

const noop = rollback.planRollback({ token: '' });
check('missing token is a no-op', noop.action === 'noop' && /NETLIFY_AUTH_TOKEN/.test(noop.reason));
check('an empty token is a no-op', rollback.planRollback({ token: '   ' }).action === 'noop');

const deploys = [
  { id: 'dep-new', context: 'production', state: 'ready', commit_ref: 'aaa' },
  { id: 'dep-good', context: 'production', state: 'ready', commit_ref: 'bbb' },
  { id: 'dep-old', context: 'production', state: 'ready', commit_ref: 'ccc' },
  { id: 'dep-preview', context: 'deploy-preview', state: 'ready', commit_ref: 'ddd' }
];
const good = rollback.planRollback({
  token: 'token',
  deploys: deploys,
  failingSha: 'aaa',
  statusBySha: { bbb: 'failure', ccc: 'success' },
  siteId: 'site'
});
check('restore prefers an earlier success status', good.action === 'restore' && good.deployId === 'dep-old', good.deployId);
const immediate = rollback.planRollback({
  token: 'token',
  deploys: deploys,
  failingSha: 'aaa',
  statusBySha: {},
  siteId: 'site'
});
check('otherwise restore the immediately previous deploy', immediate.action === 'restore' && immediate.deployId === 'dep-good' && /immediately previous/.test(immediate.how));
const skip = rollback.planRollback({
  token: 'token',
  deploys: deploys,
  failingSha: 'zzz',
  statusBySha: { bbb: 'success' }
});
check('do not restore when the published deploy is a different commit', skip.action === 'skip');

const workflow = fs.readFileSync('.github/workflows/post-deploy-smoke.yml', 'utf8');
check('workflow installs playwright', /playwright/.test(workflow));
check('workflow runs webkit and chromium', /webkit/.test(workflow) && /chromium/.test(workflow));
check('workflow references the Netlify token', /secrets\.NETLIFY_AUTH_TOKEN/.test(workflow));
check('workflow can open issues', /issues: write/.test(workflow));
check('workflow opens a GitHub issue', /gh issue create/.test(workflow));
check('workflow does not create the secret', !/gh secret set/.test(workflow) && !/NETLIFY_AUTH_TOKEN\s*[:=]\s*['"][^$]/.test(workflow));
check('browser smoke runs in the existing workflow', /scripts\/browser-smoke\.js/.test(workflow));
check('rollback runs from the existing workflow', /scripts\/rollback-production\.js/.test(workflow));

const toml = fs.readFileSync('netlify.toml', 'utf8');
check('the build runs this regression', /node tests\/browser-smoke-regression\.js/.test(toml));

const smokeSrc = fs.readFileSync('scripts/browser-smoke.js', 'utf8');
check('playwright is not required at module scope', !/^const .*require\('playwright'\)/m.test(smokeSrc) && /require\('playwright'\)/.test(smokeSrc));

if (failed) {
  console.error('BROWSER SMOKE REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — browser smoke regression');
