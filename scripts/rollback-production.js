#!/usr/bin/env node
/* Roll production back to the previous good Netlify deploy.
 *
 * No NETLIFY_AUTH_TOKEN: print the alert and exit 0. Do not call the API.
 * This file does not create or request the secret.
 */
'use strict';
const https = require('https');
const { execFileSync } = require('child_process');

function planRollback(opts) {
  opts = opts || {};
  const token = String(opts.token || '').trim();
  if (!token) {
    return {
      action: 'noop',
      reason: 'NETLIFY_AUTH_TOKEN is not set. Rollback did not call the Netlify API. Add that repo secret to restore the previous production deploy.'
    };
  }
  const deploys = (opts.deploys || []).filter(function (d) {
    return d && d.context === 'production' && d.state === 'ready' && d.id;
  });
  const published = deploys[0];
  if (!published) return { action: 'noop', reason: 'No ready production deploy to roll back from.' };
  const failing = String(opts.failingSha || '');
  const publishedSha = String(published.commit_ref || '');
  if (failing && publishedSha && publishedSha !== failing && publishedSha.indexOf(failing) !== 0 && failing.indexOf(publishedSha) !== 0) {
    return {
      action: 'skip',
      reason: 'The published production deploy is ' + publishedSha + ', not the failing commit ' + failing + '. Left it in place.'
    };
  }
  const prior = deploys.slice(1);
  const statusBySha = opts.statusBySha || {};
  function succeeded(sha) {
    const s = String(sha || '');
    return statusBySha[s] === 'success' || statusBySha[s.slice(0, 7)] === 'success';
  }
  const good = prior.find(function (d) { return succeeded(d.commit_ref); });
  const target = good || prior[0];
  if (!target) return { action: 'noop', reason: 'No previous production deploy.' };
  return {
    action: 'restore',
    siteId: opts.siteId || '',
    deployId: target.id,
    commit: target.commit_ref || '',
    how: good
      ? 'previous deploy whose transformerpath/production status is success'
      : 'immediately previous production deploy; no earlier success status was found'
  };
}

function request(method, urlPath, token, body) {
  return new Promise(function (resolve, reject) {
    const req = https.request({
      hostname: 'api.netlify.com',
      path: urlPath,
      method: method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('Netlify ' + method + ' ' + urlPath + ' -> ' + res.statusCode + ' ' + text.slice(0, 300)));
          return;
        }
        resolve(text ? JSON.parse(text) : {});
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function productionStatus(sha) {
  if (!sha || !process.env.GITHUB_REPOSITORY) return '';
  try {
    const out = execFileSync('gh', ['api', 'repos/' + process.env.GITHUB_REPOSITORY + '/commits/' + sha + '/status'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const data = JSON.parse(out);
    const hit = (data.statuses || []).find(function (s) { return s.context === 'transformerpath/production'; });
    return hit ? hit.state : '';
  } catch (e) {
    return '';
  }
}

async function main() {
  const token = String(process.env.NETLIFY_AUTH_TOKEN || '').trim();
  const failingSha = String(process.env.FAILING_SHA || '').trim();
  if (!token) {
    const plan = planRollback({ token: '' });
    console.error('ROLLBACK ALERT: ' + plan.reason);
    return;
  }
  const siteName = process.env.NETLIFY_SITE_NAME || 'transformerpath';
  const site = process.env.NETLIFY_SITE_ID
    ? { id: process.env.NETLIFY_SITE_ID }
    : await request('GET', '/api/v1/sites/' + encodeURIComponent(siteName), token);
  const deploys = await request('GET', '/api/v1/sites/' + site.id + '/deploys?per_page=30', token);
  const statusBySha = {};
  (deploys || []).forEach(function (d) {
    if (d && d.commit_ref && !statusBySha[d.commit_ref]) statusBySha[d.commit_ref] = productionStatus(d.commit_ref);
  });
  const plan = planRollback({
    token: token,
    deploys: deploys,
    failingSha: failingSha,
    statusBySha: statusBySha,
    siteId: site.id
  });
  console.log('ROLLBACK: ' + plan.action + ' — ' + (plan.reason || plan.how || ''));
  if (plan.action !== 'restore') return;
  await request('POST', '/api/v1/sites/' + site.id + '/deploys/' + plan.deployId + '/restore', token, {});
  console.log('ROLLBACK RESTORED ' + plan.deployId + ' (' + plan.commit + ')');
}

module.exports = { planRollback: planRollback };

if (require.main === module) {
  main().catch(function (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}
