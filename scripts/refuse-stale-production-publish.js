#!/usr/bin/env node
/* scripts/refuse-stale-production-publish.js
 *
 * Last step of the Netlify build. Refuse a production artifact that would
 * move the live site backwards, or that is not on main.
 *
 * Do not require COMMIT_REF to be the tip of main. A production build takes
 * several minutes, and main often moves while it runs. Netlify also skips
 * the queued deploys in between and builds one commit. Failing that build
 * because it is no longer the tip leaves /build.json on the last commit that
 * happened to finish while it was still the tip.
 *
 * Preview and branch builds are left alone. If GitHub or the live build.json
 * cannot be read, the deploy is not blocked: an outage must not freeze
 * production.
 */
'use strict';
const https = require('https');

function sameSha(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

/* compare(commit...main).status from the GitHub compare API. */
function onMainFromCompare(status) {
  if (status === 'ahead' || status === 'identical') return true;
  if (status === 'behind' || status === 'diverged') return false;
  return null;
}

/* compare(commit...published).status. "ahead" means published contains this
 * commit plus later ones, so publishing this artifact would roll production
 * backwards. */
function olderThanPublishedFromCompare(status) {
  if (status === 'ahead') return true;
  if (status === 'behind' || status === 'identical' || status === 'diverged') return false;
  return null;
}

function shouldPublish(context, commitRef, info) {
  if (context !== 'production') {
    return { publish: true, detail: 'skipped (context=' + (context || 'unset') + ')' };
  }
  const ref = String(commitRef || '').trim().toLowerCase();
  if (!/^[0-9a-f]{7,40}$/.test(ref)) {
    return { publish: false, detail: 'production COMMIT_REF is missing' };
  }
  if (typeof info === 'string' || info == null) info = { mainSha: info || '' };
  const main = String(info.mainSha || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(main)) {
    return { publish: true, detail: 'GitHub main SHA unavailable; not blocking this deploy' };
  }
  if (sameSha(ref, main)) {
    return { publish: true, detail: 'COMMIT_REF is main ' + main };
  }
  if (info.onMain === false) {
    return {
      publish: false,
      detail: 'refusing to publish ' + ref + ' because it is not on main ' + main
    };
  }
  if (info.olderThanPublished === true) {
    const published = String(info.publishedSha || '').trim().toLowerCase();
    return {
      publish: false,
      detail: 'refusing to publish ' + ref + ' because production is already on ' + (published || 'a newer commit')
    };
  }
  const published = String(info.publishedSha || '').trim().toLowerCase();
  return {
    publish: true,
    detail: 'COMMIT_REF ' + ref + ' is on main ' + main +
      (published ? ' and is not older than production ' + published : ' (published commit unread)')
  };
}

function getJson(hostname, path) {
  return new Promise(function (resolve) {
    const req = https.request({
      hostname: hostname,
      path: path,
      method: 'GET',
      headers: {
        'user-agent': 'transformerpath-release',
        'accept': hostname === 'api.github.com' ? 'application/vnd.github+json' : 'application/json'
      },
      timeout: 15000
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        if (res.statusCode !== 200) return resolve(null);
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('timeout', function () { req.destroy(); resolve(null); });
    req.on('error', function () { resolve(null); });
    req.end();
  });
}

async function main() {
  const context = process.env.CONTEXT || '';
  const commitRef = process.env.COMMIT_REF || '';
  if (context !== 'production') {
    const skipped = shouldPublish(context, commitRef, {});
    console.log('production publish check: ' + skipped.detail);
    return;
  }
  const repoUrl = 'https://github.com/nishadpathak/transformerpath';
  const repoSlug = repoUrl.slice('https://github.com/'.length);
  const mainDoc = await getJson('api.github.com', '/repos/' + repoSlug + '/commits/main');
  const mainSha = mainDoc && mainDoc.sha || '';
  const live = await getJson('transformerpath.com', '/build.json');
  const publishedSha = live && live.commit || '';
  let onMain = null;
  let olderThanPublished = null;
  if (/^[0-9a-f]{40}$/i.test(mainSha)) {
    if (sameSha(commitRef, mainSha)) onMain = true;
    else {
      const cmp = await getJson('api.github.com', '/repos/' + repoSlug + '/compare/' + commitRef + '...' + mainSha);
      onMain = cmp ? onMainFromCompare(cmp.status) : null;
    }
  }
  if (publishedSha) {
    if (sameSha(commitRef, publishedSha)) olderThanPublished = false;
    else {
      const cmp = await getJson('api.github.com', '/repos/' + repoSlug + '/compare/' + commitRef + '...' + publishedSha);
      olderThanPublished = cmp ? olderThanPublishedFromCompare(cmp.status) : null;
    }
  }
  const verdict = shouldPublish(context, commitRef, {
    mainSha: mainSha,
    publishedSha: publishedSha,
    onMain: onMain,
    olderThanPublished: olderThanPublished
  });
  console.log('production publish check: ' + verdict.detail);
  if (!verdict.publish) {
    console.error('RELEASE PUBLISH: ' + verdict.detail);
    console.error('RELEASE PUBLISH: this artifact would move production backwards or off main');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(function (e) {
    console.error('production publish check could not finish: ' + (e && e.message || e));
  });
}

module.exports = {
  shouldPublish: shouldPublish,
  onMainFromCompare: onMainFromCompare,
  olderThanPublishedFromCompare: olderThanPublishedFromCompare
};
