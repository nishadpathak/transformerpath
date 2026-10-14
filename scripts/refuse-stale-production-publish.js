#!/usr/bin/env node
/* scripts/refuse-stale-production-publish.js
 *
 * Last step of the Netlify build. A production build of an older commit can
 * finish uploading after a newer commit is already on main. Netlify then
 * publishes that older artifact, so /build.json reports the commit this
 * build checked out (COMMIT_REF) while main has moved. Failing here makes
 * Netlify drop the artifact instead of publishing it.
 *
 * Preview and branch builds are left alone. If GitHub cannot be read, the
 * deploy is not blocked: a status outage must not freeze production.
 */
'use strict';
const https = require('https');

function shouldPublish(context, commitRef, mainSha) {
  if (context !== 'production') {
    return { publish: true, detail: 'skipped (context=' + (context || 'unset') + ')' };
  }
  const ref = String(commitRef || '').trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(ref)) {
    return { publish: false, detail: 'production COMMIT_REF is missing' };
  }
  const main = String(mainSha || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(main)) {
    return { publish: true, detail: 'GitHub main SHA unavailable; not blocking this deploy' };
  }
  if (main === ref || main.startsWith(ref) || ref.startsWith(main)) {
    return { publish: true, detail: 'COMMIT_REF is main ' + main };
  }
  return {
    publish: false,
    detail: 'refusing to publish ' + ref + ' because main is ' + main
  };
}

function githubMainSha() {
  return new Promise(function (resolve) {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/repos/nishadpathak/transformerpath/commits/main',
      method: 'GET',
      headers: {
        'user-agent': 'transformerpath-release',
        'accept': 'application/vnd.github+json'
      },
      timeout: 15000
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        if (res.statusCode !== 200) return resolve('');
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')).sha || '');
        } catch (e) {
          resolve('');
        }
      });
    });
    req.on('timeout', function () { req.destroy(); resolve(''); });
    req.on('error', function () { resolve(''); });
    req.end();
  });
}

async function main() {
  const context = process.env.CONTEXT || '';
  const commitRef = process.env.COMMIT_REF || '';
  const mainSha = context === 'production' ? await githubMainSha() : '';
  const verdict = shouldPublish(context, commitRef, mainSha);
  console.log('production publish check: ' + verdict.detail);
  if (!verdict.publish) {
    console.error('RELEASE PUBLISH: ' + verdict.detail);
    console.error('RELEASE PUBLISH: this artifact would leave /build.json on a commit that is no longer main');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(function (e) {
    console.error('production publish check could not finish: ' + (e && e.message || e));
  });
}

module.exports = { shouldPublish };
