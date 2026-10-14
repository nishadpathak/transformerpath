#!/usr/bin/env node
/* scripts/check-event-links.js — non-blocking official_url check.
 * 404/410/DNS are failures. 403/406/429 are BLOCKED for a browser re-check.
 * Writes data/event-link-report.json and always exits 0.
 */
'use strict';
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { loadEvents } = require('../lib/events-reader');

const events = loadEvents().filter((e) => e.official_url);
const out = { checked_at: new Date().toISOString().slice(0, 10), ok: [], fail: [], blocked: [], error: [] };

function check(url) {
  return new Promise((resolve) => {
    let lib;
    let u;
    try { u = new URL(url); lib = u.protocol === 'http:' ? http : https; }
    catch (e) { return resolve({ url, class: 'fail', status: 0, error: 'bad url' }); }
    const req = lib.request({
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      port: u.port || undefined,
      timeout: 12000,
      headers: { 'User-Agent': 'TransformerPathLinkCheck/1.0', Accept: 'text/html' },
    }, (res) => {
      res.resume();
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        return resolve({ url, class: 'ok', status, note: 'redirect' });
      }
      if (status === 404 || status === 410) return resolve({ url, class: 'fail', status });
      if (status === 403 || status === 406 || status === 429) return resolve({ url, class: 'blocked', status });
      if (status >= 200 && status < 400) return resolve({ url, class: 'ok', status });
      return resolve({ url, class: 'error', status });
    });
    req.on('timeout', () => { req.destroy(); resolve({ url, class: 'error', status: 0, error: 'timeout' }); });
    req.on('error', (err) => {
      const msg = String(err.code || err.message || err);
      const dns = /ENOTFOUND|EAI_AGAIN|ENODATA/.test(msg);
      resolve({ url, class: dns ? 'fail' : 'error', status: 0, error: msg });
    });
    req.end();
  });
}

(async () => {
  const queue = events.slice();
  const workers = new Array(12).fill(0).map(async () => {
    while (queue.length) {
      const ev = queue.shift();
      const row = await check(ev.official_url);
      row.id = ev.id;
      row.name = ev.name;
      out[row.class === 'ok' ? 'ok' : row.class === 'fail' ? 'fail' : row.class === 'blocked' ? 'blocked' : 'error'].push(row);
    }
  });
  await Promise.all(workers);
  const summary = {
    checked_at: out.checked_at,
    checked: events.length,
    ok: out.ok.length,
    fail: out.fail.length,
    blocked: out.blocked.length,
    error: out.error.length,
    fail_list: out.fail,
    blocked_list: out.blocked,
    error_list: out.error,
  };
  fs.writeFileSync('data/event-link-report.json', JSON.stringify(summary, null, 2) + '\n');
  console.log('event links ok=' + summary.ok + ' fail=' + summary.fail + ' blocked=' + summary.blocked + ' error=' + summary.error);
})();
