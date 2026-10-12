/* tests/entitlement-regression.js — server-authoritative entitlement smoke test.
 *
 * Covers the commercial-readiness concern: a paid visitor must receive the
 * correct entitlement, it must work across devices (signed token, not
 * localStorage), and gated content must fail CLOSED for missing / tampered /
 * expired / wrong-secret tokens. Pure crypto — no Supabase/network needed.
 */
'use strict';
process.env.ENTITLEMENT_SECRET = 'test_entitlement_secret_regression';
const ent = require('../functions/lib/entitlement.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

// 1. Each paid plan issues a valid token with the right rank.
for (const [plan, rank] of [['learning', 1], ['professional', 2], ['team', 3], ['enterprise', 3]]) {
  const t = ent.issue(plan, 3600);
  const v = ent.verify(t);
  check('issue+verify "' + plan + '" valid, rank ' + rank, v.valid && v.rank === rank, JSON.stringify(v));
}

// 2. Unknown plan -> no token (no silent entitlement).
check('unknown plan -> no token', ent.issue('free_loader', 3600) === null);

// 3. Tampered token -> fail closed.
const good = ent.issue('professional', 3600);
const tampered = good.slice(0, good.lastIndexOf('.') + 1) + 'deadbeef';
check('tampered signature -> invalid', ent.verify(tampered).valid === false);
check('tampered -> bad_signature reason', ent.verify(tampered).reason === 'bad_signature');

// 4. Expired token -> fail closed.
const expired = ent.issue('learning', -10);
check('expired token -> invalid', ent.verify(expired).valid === false);
check('expired -> expired reason', ent.verify(expired).reason === 'expired');

// 5. Missing / empty -> fail closed.
check('missing token -> invalid', ent.verify('').valid === false);
check('null token -> invalid', ent.verify(null).valid === false);

// 6. Cross-secret: a token signed with a different secret must not verify.
const foreign = (function () {
  const crypto = require('crypto');
  const payload = Buffer.from(JSON.stringify({ plan: 'team', exp: Math.floor(Date.now() / 1000) + 3600 }))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = crypto.createHmac('sha256', 'a_different_secret').update(payload).digest('hex');
  return payload + '.' + sig;
})();
check('foreign-secret token -> invalid', ent.verify(foreign).valid === false);

// 7. Token works across devices: extractToken reads Authorization header AND cookie.
check('extractToken from Bearer header', ent.extractToken({ headers: { authorization: 'Bearer ' + good } }) === good);
check('extractToken from tp_ent cookie', ent.extractToken({ headers: { cookie: 'a=1; tp_ent=' + good + '; b=2' } }) === good);
check('extractToken none -> null', ent.extractToken({ headers: {} }) === null);

// 8. Fail-closed when the server secret is not configured.
const savedSecret = process.env.ENTITLEMENT_SECRET;
const savedStripe = process.env.STRIPE_SECRET_KEY;
delete process.env.ENTITLEMENT_SECRET; delete process.env.STRIPE_SECRET_KEY;
check('no secret -> not entitled (fail closed)', ent.verify(good).valid === false);
check('no secret -> issue returns null', ent.issue('team', 3600) === null);
process.env.ENTITLEMENT_SECRET = savedSecret;
if (savedStripe !== undefined) process.env.STRIPE_SECRET_KEY = savedStripe;

console.log('\nENTITLEMENT REGRESSION: ' + (fail ? 'FAIL' : 'PASS') + ' (' + pass + ' passed, ' + fail + ' failed)');
process.exit(fail ? 1 : 0);
