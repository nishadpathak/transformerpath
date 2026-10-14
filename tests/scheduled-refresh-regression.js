#!/usr/bin/env node
/* tests/scheduled-refresh-regression.js
 * daily-rebuild is scheduled twice a day and does not report success when the
 * build hook is missing. refresh-data uses the shared feed, including RSS
 * when EVENTREGISTRY_KEY is unset.
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

console.log('=== SCHEDULED REFRESH REGRESSION ===');
const toml = fs.readFileSync('netlify.toml', 'utf8');
const block = toml.split('[functions."daily-rebuild"]')[1] || '';
const schedule = (block.match(/schedule\s*=\s*"([^"]+)"/) || [])[1] || '';
check('daily-rebuild runs at 06:00 and 18:00 UTC', schedule === '0 6,18 * * *', schedule);

const daily = fs.readFileSync('functions/daily-rebuild.js', 'utf8');
check('missing hook is not a 204 success', !/statusCode:\s*204/.test(daily) && /statusCode:\s*503/.test(daily));
check('missing hook does not set ok true', !/ok:\s*true,\s*\n\s*triggered:\s*false/.test(daily));

const refresh = fs.readFileSync('functions/refresh-data.js', 'utf8');
check('refresh-data uses the shared intel source', /require\('\.\/lib\/intel-source'\)/.test(refresh) && /buildFeed\(/.test(refresh));
check('a fetch with no articles is not HTTP 200', /statusCode:\s*res\.success\s*\?\s*200\s*:\s*503/.test(refresh));

const dailyMod = require('../functions/daily-rebuild');
delete process.env.TP_BUILD_HOOK_URL;
delete process.env.BUILD_HOOK_URL;
dailyMod.handler({}).then(function (res) {
  check('handler without hook returns 503', res && res.statusCode === 503, String(res && res.statusCode));
  const body = JSON.parse(res.body || '{}');
  check('handler without hook is not ok', body.ok === false && body.triggered === false);
  if (failed) {
    console.error('SCHEDULED REFRESH REGRESSION FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('SCHEDULED REFRESH REGRESSION OK');
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
