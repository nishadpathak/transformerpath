'use strict';
/* Netlify onSuccess: smoke the production URL after this deploy is published.
 *
 * Deploy-preview and branch builds skip the check. A failure is a failed
 * plugin on the deploy log (SMOKE FAIL) so a bad production release is visible.
 */
const { spawnSync } = require('child_process');
const path = require('path');

module.exports = {
  onSuccess: function ({ utils }) {
    const context = process.env.CONTEXT || '';
    if (context !== 'production') {
      console.log('post-deploy smoke skipped (context=' + (context || 'unset') + ')');
      return;
    }
    const base = String(process.env.URL || 'https://transformerpath.com').replace(/\/$/, '');
    const sha = String(process.env.COMMIT_REF || '').trim();
    if (!sha) {
      utils.build.failPlugin('post-deploy smoke: COMMIT_REF is missing, so the live commit cannot be checked');
      return;
    }
    console.log('post-deploy smoke ' + base + ' commit=' + sha);
    const res = spawnSync(process.execPath, [
      path.join(process.cwd(), 'scripts', 'smoke-release.js'),
      base,
      sha,
      '--wait',
      '--wait-minutes',
      '4'
    ], { stdio: 'inherit' });
    if (res.status !== 0) {
      utils.build.failPlugin('Production smoke failed for ' + sha + '. The deploy log above is the alert.');
    }
  }
};
