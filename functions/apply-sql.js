/* GET /.netlify/functions/apply-sql
 * Returns the canonical APPLY_SQL (text/plain) so operators can fetch the
 * runnable DDL without checking out the repo. No secrets. POST is rejected.
 */
'use strict';
const { APPLY_SQL } = require('./lib/account-model');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'access-control-allow-origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { 'content-type': 'text/plain' }, body: 'GET only\n' };
  }
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
    body: APPLY_SQL,
  };
};
