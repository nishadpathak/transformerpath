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

// Deep, full-chapter-only markers (must NOT be in served HTML).
const FULL_MARKERS = ['decay envelope', 'Fig. 14.1', 'K√S', 'short-circuit method', 'Duval', 'axially split'];
const html = fs.readFileSync('masterclass.html', 'utf8');

console.log('MASTERCLASS PAYWALL QA\n');
console.log('1. SERVED HTML LEAK CHECK:');
FULL_MARKERS.forEach((m) => { ok(html.indexOf(m) < 0, 'served masterclass.html does not contain "' + m + '"'); });
ok(html.indexOf('class="mc-locked"') >= 0, 'served page uses locked placeholders (not CSS-hidden full text)');
ok(html.indexOf('Unlock full Masterclass') >= 0, 'served page shows an unlock CTA');

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

  console.log('\n4. FREE CHAPTERS PRESENT:');
  ok(html.indexOf('id="fundamentals"') >= 0, 'free chapter fundamentals is in the served page');
  ok(html.indexOf('id="classification"') >= 0, 'free chapter classification is in the served page');

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
