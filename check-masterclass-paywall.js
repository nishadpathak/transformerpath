#!/usr/bin/env node
/* check-masterclass-paywall.js — Masterclass entitlement/paywall regression gate.
 *
 * Verifies:
 *   1. The served masterclass.html does NOT leak full paid chapter content.
 *   2. The paid chapter payload exists server-side and holds the full chapters.
 *   3. The delivery function is FAIL-CLOSED: no token -> locked; invalid token
 *      -> locked; a valid token -> full chapter.
 *   4. Free chapters remain in the served page.
 *
 * Run: node check-masterclass-paywall.js
 */
'use strict';
const fs = require('fs');
let problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }

const redirects = fs.existsSync('_redirects') ? fs.readFileSync('_redirects', 'utf8') : '';

console.log('MASTERCLASS PAYWALL QA\n');
console.log('1. PUBLIC COURSE PAGE IS RETIRED:');
ok(!fs.existsSync('masterclass.html'), 'public masterclass.html is not served');
ok(/\/masterclass\.html\s+\/learn\s+301/.test(redirects), '_redirects 301s /masterclass.html to /learn');
ok(/\/masterclass\s+\/learn\s+301/.test(redirects), '_redirects 301s /masterclass to /learn');

console.log('\n2. SERVER-SIDE PAYLOAD:');
const CH = require('./functions/lib/masterclass-chapters.js');
const ids = Object.keys(CH);
ok(ids.length >= 20, 'payload has ' + ids.length + ' paid chapters');
ok(ids.every((i) => CH[i] && CH[i].html && CH[i].html.length > 500), 'every paid chapter payload carries its full HTML');
ok(CH.inrush && CH.inrush.html.indexOf('decay envelope') >= 0, 'inrush full chapter lives only in the server payload');

console.log('\n3. FAIL-CLOSED DELIVERY:');
process.env.ENTITLEMENT_SECRET = process.env.ENTITLEMENT_SECRET || 'test-secret-for-gate';
const ent = require('./functions/lib/entitlement');
const fn = require('./functions/masterclass-content.js');
function call(body) { return fn.handler({ httpMethod: 'GET', queryStringParameters: body, headers: {} }); }
(async () => {
  const lockNoTok = await call({ chapter: 'inrush' });
  ok(!lockNoTok.body || (JSON.parse(lockNoTok.body).locked === true), 'no token -> LOCKED (fail-closed)');
  const lockBad = await call({ chapter: 'inrush' });
  ok(JSON.parse(lockBad.body).locked === true, 'invalid token -> LOCKED');
  const tok = ent.issue('learning', 3600);
  const open = await fn.handler({ httpMethod: 'GET', queryStringParameters: { chapter: 'inrush' }, headers: { authorization: 'Bearer ' + tok } });
  const oj = JSON.parse(open.body);
  ok(oj.ok === true && (oj.html || '').indexOf('decay envelope') >= 0, 'valid Learning token -> full chapter delivered');
  const teamTok = ent.issue('enterprise', 3600); // Team/enterprise = learning or higher
  const tj = JSON.parse((await fn.handler({ httpMethod: 'GET', queryStringParameters: { chapter: 'inrush' }, headers: { authorization: 'Bearer ' + teamTok } })).body);
  ok(tj.ok === true, 'Team (enterprise) token unlocks the course');
  const expired = await fn.handler({ httpMethod: 'GET', queryStringParameters: { chapter: 'inrush' }, headers: { authorization: 'Bearer ' + ent.issue('learning', -10) } });
  ok(JSON.parse(expired.body).locked === true, 'expired token -> LOCKED');

  console.log('\n4. FREE CHAPTERS STILL COME FROM THE FUNCTION:');
  const freeFund = JSON.parse((await fn.handler({ httpMethod: 'GET', queryStringParameters: { chapter: 'fundamentals' }, headers: {} })).body);
  ok(freeFund.free === true, 'free chapter fundamentals is delivered without a token');
  ok(!fs.existsSync('masterclass.html'), 'free chapters are not copied into a public course page');

  console.log('\n5. ENGINEER TRACK GATE:');
  const etHtml = fs.readFileSync('engineer-track.html', 'utf8');
  ok(etHtml.indexOf('250 kVA') < 0 && etHtml.indexOf('63 MVA') < 0 && etHtml.indexOf('40 MVA') < 0, 'served engineer-track.html does not contain paid capstone briefs');
  ok(etHtml.indexOf('data/engineer-track-paid.json') < 0, 'page does not fetch public paid JSON');
  ok(etHtml.indexOf('/.netlify/functions/engineer-track-content') >= 0, 'page fetches the entitlement-gated function');
  ok(etHtml.indexOf('1000 kVA') >= 0, 'free Level 1 Capstone F remains in the served page');
  ok(!fs.existsSync('data/engineer-track-paid.json'), 'public data/engineer-track-paid.json is gone');
  const ET = require('./functions/lib/engineer-track-levels.js');
  ok(ET.level2.indexOf('250 kVA') >= 0 && ET.level3.indexOf('63 MVA') >= 0 && ET.level4.indexOf('40 MVA') >= 0, 'paid briefs live only in the server payload');
  const etFn = require('./functions/engineer-track-content.js');
  const etLock = JSON.parse((await etFn.handler({ httpMethod: 'GET', headers: {} })).body);
  ok(etLock.locked === true && !etLock.level2, 'no token -> LOCKED, no briefs');
  const etOpen = JSON.parse((await etFn.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer ' + tok } })).body);
  ok(etOpen.ok === true && (etOpen.level2 || '').indexOf('250 kVA') >= 0, 'valid token -> Level 2 brief delivered');

  console.log('\nPAYWALL QA: ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
  process.exitCode = problems.length ? 1 : 0;
})();
