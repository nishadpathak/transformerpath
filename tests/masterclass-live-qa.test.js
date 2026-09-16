#!/usr/bin/env node
/* tests/masterclass-live-qa.test.js — verifiable Masterclass paywall security QA.
 * Only the determinable paths are asserted (no browser, no live Stripe/Supabase).
 *   - direct API access / abuse (valid, invalid, case, encoded, unexpected)
 *   - invalid / tampered / expired token variants -> fail closed
 *   - the locked response never leaks the chapter HTML
 * The browser + live-backend journeys (anonymous render, free/paid/Team/refresh,
 * cookie inspection, DOM/cache leakage) are NOT verifiable here and are
 * reported separately as not-verified.
 */
'use strict';
const ent = require('../functions/lib/entitlement');
const fn = require('../functions/masterclass-content.js');
process.env.ENTITLEMENT_SECRET = process.env.ENTITLEMENT_SECRET || 'qa-secret';
let problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }
function call(q) { return fn.handler({ httpMethod: 'GET', queryStringParameters: q || {}, headers: {} }).then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) })); }

console.log('MASTERCLASS PAYWALL LIVE QA (verifiable subset)\n');

console.log('1. DIRECT API ACCESS / ABUSE (no entitlement):');
(async () => {
  let r = await call({ chapter: 'inrush' });
  ok(r.status === 200 && r.body.locked === true && !r.body.html, 'valid chapter, no token -> LOCKED (no html)');
  ok(!(r.body.html && r.body.html.indexOf('decay envelope') >= 0), 'no leaked full chapter html in locked response');
  r = await call({ chapter: 'Inrush' });
  ok(r.body.locked === true && !r.body.html, 'case variation ("Inrush") -> LOCKED (lowercased id)');
  r = await call({ chapter: 'inru%73h' }); // encoded 's'
  ok(r.status !== 200 || r.body.locked === true, 'encoded chapter name -> safely handled (no payload)');
  r = await call({ chapter: 'nonexistent' });
  ok(r.status === 404, 'unknown chapter -> 404');
  r = await call({ chapter: '' });
  ok(r.status === 404, 'empty chapter -> 404 (never payload)');
  r = await call({ chapter: 'javascript:alert(1)' });
  ok(r.status === 404 || r.body.locked === true, 'unexpected/injection chapter value -> never payload');
  // Free chapter still available without entitlement.
  r = await call({ chapter: 'fundamentals' });
  ok(r.body.free === true, 'free chapter returned without entitlement');

  console.log('\n2. INVALID / TAMPERED / EXPIRED TOKEN -> FAIL CLOSED:');
  const validTok = ent.issue('learning', 60);
  ok(ent.verify(validTok).valid === true, 'valid token verifies');
  ok(ent.verify(validTok.slice(0, -2) + 'aa').valid === false, 'tampered signature -> invalid');
  ok(ent.verify(validTok + 'x').valid === false, 'wrong signature -> invalid');
  ok(ent.verify(ent.issue('free', 60)).valid === false, 'unknown/unsupported plan (free) -> no token, fail closed');
  // missing expiry: craft a token without exp.
  const b64 = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const noExp = b64(JSON.stringify({ plan: 'learning' }));
  const noExpTok = noExp + '.' + require('crypto').createHmac('sha256', process.env.ENTITLEMENT_SECRET).update(noExp).digest('hex');
  ok(ent.verify(noExpTok).valid === false, 'missing expiry -> invalid');
  ok(ent.verify(ent.issue('learning', -10)).valid === false, 'expired token -> invalid');
  // A valid token must actually unlock the function and not leak beyond.
  const open = await fn.handler({ httpMethod: 'GET', queryStringParameters: { chapter: 'inrush' }, headers: { authorization: 'Bearer ' + validTok } });
  const oj = JSON.parse(open.body);
  ok(oj.ok === true && (oj.html || '').indexOf('decay envelope') >= 0, 'valid token -> full chapter delivered (only to entitled)');

  console.log('\n3. HTML / SEO LEAKAGE (file-level):');
  const fs = require('fs');
  const served = fs.readFileSync('masterclass.html', 'utf8');
  ['decay envelope', 'Fig. 14.1', 'K√S', 'Duval'].forEach((m) => { ok(served.indexOf(m) < 0, 'served masterclass.html has no "' + m + '"'); });
  ok(served.indexOf('class="mc-locked"') >= 0, 'served page uses locked placeholders (not hidden CSS)');
  ok(served.indexOf('"html"') < 0 && served.indexOf('decay') < 0, 'no preloaded full-chapter JSON in served HTML');
  ok(!fs.existsSync('_private/masterclass-full.html'), 'full course source NOT in the deploy tree (moved to vault / gitignored) — outputs are committed, so the paywall functions without it');

  console.log('\nMASTERCLASS LIVE QA (verifiable): ' + (problems.length ? problems.length + ' problem(s)' : 'PASS'));
  process.exitCode = problems.length ? 1 : 0;
})();
