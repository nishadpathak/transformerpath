/* Student badge unlocks gated course functions. No badge, no token, and a
 * service-role key stay locked. The offer handler never calls Stripe. */
'use strict';

const assert = require('assert');
const offer = require('../lib/student-learning-offer');
const checkout = require('../functions/student-learning-checkout');
const track = require('../functions/engineer-track-content');
const masterclass = require('../functions/masterclass-content');

function jwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: role })).toString('base64url');
  return header + '.' + payload + '.x';
}

const saved = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  STUDENT_LEARNING_COUPON_ENABLED: process.env.STUDENT_LEARNING_COUPON_ENABLED,
  STRIPE_STUDENT_LEARNING_COUPON_ID: process.env.STRIPE_STUDENT_LEARNING_COUPON_ID,
  STRIPE_STUDENT_LEARNING_PRICE_ID: process.env.STRIPE_STUDENT_LEARNING_PRICE_ID
};
const savedFetch = global.fetch;
let fetches = 0;

function restore() {
  Object.keys(saved).forEach(function (name) {
    if (saved[name] == null) delete process.env[name];
    else process.env[name] = saved[name];
  });
  global.fetch = savedFetch;
}

function badgeFetch(badge) {
  fetches = 0;
  global.fetch = function (url, opts) {
    fetches += 1;
    assert.ok(String(url).indexOf('/rest/v1/profiles?select=student_badge') !== -1);
    assert.ok(opts.headers.Authorization.indexOf('Bearer ') === 0);
    assert.ok(opts.headers.apikey.indexOf('sb_secret_') !== 0);
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve([{ student_badge: badge }]); }
    });
  };
}

async function main() {
  const lockedTrack = JSON.parse((await track.handler({ httpMethod: 'GET', headers: {} })).body);
  assert.strictEqual(lockedTrack.locked, true);
  assert.ok(!lockedTrack.level2);
  assert.strictEqual(fetches, 0);

  const lockedChapter = JSON.parse((await masterclass.handler({
    httpMethod: 'GET',
    queryStringParameters: { chapter: 'inrush' },
    headers: {}
  })).body);
  assert.strictEqual(lockedChapter.locked, true);
  assert.ok(!lockedChapter.html);

  process.env.SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
  process.env.SUPABASE_ANON_KEY = jwt('service_role');
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  fetches = 0;
  global.fetch = function () { fetches += 1; throw new Error('service role must not be sent'); };
  const rejected = JSON.parse((await track.handler({
    httpMethod: 'GET',
    headers: { 'x-tp-supabase-auth': 'user-access-token' }
  })).body);
  assert.strictEqual(rejected.locked, true);
  assert.strictEqual(fetches, 0);

  process.env.SUPABASE_ANON_KEY = jwt('anon');
  badgeFetch(false);
  const noBadge = JSON.parse((await track.handler({
    httpMethod: 'GET',
    headers: { 'x-tp-supabase-auth': 'user-access-token' }
  })).body);
  assert.strictEqual(noBadge.locked, true);
  assert.strictEqual(fetches, 1);

  badgeFetch(true);
  const openTrack = JSON.parse((await track.handler({
    httpMethod: 'GET',
    headers: { 'x-tp-supabase-auth': 'user-access-token' }
  })).body);
  assert.strictEqual(openTrack.ok, true);
  assert.strictEqual(openTrack.plan, 'student');
  assert.ok(openTrack.level2.indexOf('250 kVA') !== -1);
  assert.strictEqual(fetches, 1);

  badgeFetch(true);
  const openChapter = JSON.parse((await masterclass.handler({
    httpMethod: 'GET',
    queryStringParameters: { chapter: 'inrush' },
    headers: { 'x-tp-supabase-auth': 'user-access-token' }
  })).body);
  assert.strictEqual(openChapter.ok, true);
  assert.strictEqual(openChapter.plan, 'student');
  assert.ok(openChapter.html && openChapter.html.length > 0);

  delete process.env.STUDENT_LEARNING_COUPON_ENABLED;
  delete process.env.STRIPE_STUDENT_LEARNING_COUPON_ID;
  delete process.env.STRIPE_STUDENT_LEARNING_PRICE_ID;
  const status = await checkout.handler();
  const body = JSON.parse(status.body);
  assert.strictEqual(status.statusCode, 200);
  assert.deepStrictEqual(body, { enabled: false, reason: 'flag_off' });
  assert.strictEqual(offer.checkoutParams(), null);
  console.log('student content access OK');
}

main().then(restore, function (err) {
  restore();
  console.error(err);
  process.exit(1);
});
