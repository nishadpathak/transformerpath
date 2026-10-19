/* Read the signed-in user's student_badge with their Supabase access token.
 * Uses the anon/publishable key and row-level security. No service-role key.
 * A missing token, missing public config, or a false badge returns false.
 */
'use strict';

var publicEnv = require('./supabase-public-env');

function accessToken(event) {
  var headers = event && event.headers ? event.headers : {};
  var value = headers['x-tp-supabase-auth'] || headers['X-Tp-Supabase-Auth'] || '';
  value = String(value).trim();
  if (!value || value.length > 4096) return '';
  return value;
}

function studentBadge(event, fetchImpl) {
  var token = accessToken(event);
  var cfg = publicEnv.publicConfig(process.env);
  if (!token || !cfg.configured) return Promise.resolve(false);
  var fetcher = fetchImpl || fetch;
  return fetcher(cfg.url + '/rest/v1/profiles?select=student_badge', {
    headers: {
      apikey: cfg.anon,
      Authorization: 'Bearer ' + token,
      Accept: 'application/json'
    }
  }).then(function (res) {
    if (!res || !res.ok) return false;
    return res.json();
  }).then(function (rows) {
    return Array.isArray(rows) && rows.some(function (row) { return row && row.student_badge === true; });
  }).catch(function () { return false; });
}

module.exports = { studentBadge: studentBadge, accessToken: accessToken };
