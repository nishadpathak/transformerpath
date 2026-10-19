/* Public Supabase config: env names only, never a secret in the browser file. */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { publicConfig, presence } = require('../functions/lib/supabase-public-env');
const { writeSupabaseConfig } = require('../scripts/write-supabase-config');
const fn = require('../functions/supabase-public-config');

function jwt(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role: role, ref: 'test' })).toString('base64url');
  return header + '.' + payload + '.sig';
}

const url = 'https://exampleproject.supabase.co';
const publishable = 'sb_publishable_example_public_key';
const secret = 'sb_secret_example_should_not_ship';

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + name + '  -> ' + (e && e.message));
  }
}

check('empty env is not configured and has no key', function () {
  const cfg = publicConfig({});
  assert.strictEqual(cfg.configured, false);
  assert.strictEqual(cfg.url, '');
  assert.strictEqual(cfg.anon, '');
});

check('publishable key is accepted', function () {
  const cfg = publicConfig({ SUPABASE_URL: url + '/', SUPABASE_PUBLISHABLE_KEY: publishable });
  assert.strictEqual(cfg.configured, true);
  assert.strictEqual(cfg.url, url);
  assert.strictEqual(cfg.anon, publishable);
  assert.strictEqual(cfg.source.anon, 'SUPABASE_PUBLISHABLE_KEY');
});

check('anon JWT is accepted and beats a later publishable key', function () {
  const anon = jwt('anon');
  const cfg = publicConfig({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: anon,
    SUPABASE_PUBLISHABLE_KEY: publishable,
  });
  assert.strictEqual(cfg.anon, anon);
});

check('secret key is rejected', function () {
  const cfg = publicConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: secret });
  assert.strictEqual(cfg.configured, false);
  assert.strictEqual(cfg.reason, 'public_key_rejected');
  assert.strictEqual(cfg.anon, '');
});

check('service_role JWT is rejected', function () {
  const cfg = publicConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: jwt('service_role') });
  assert.strictEqual(cfg.configured, false);
  assert.strictEqual(cfg.anon, '');
});

check('invalid host is rejected', function () {
  const cfg = publicConfig({ SUPABASE_URL: 'https://evil.example/steal', SUPABASE_ANON_KEY: publishable });
  assert.strictEqual(cfg.configured, false);
  assert.strictEqual(cfg.reason, 'invalid_url');
});

check('written file omits a rejected secret', function () {
  const dest = path.join(os.tmpdir(), 'tp-supabase-config-' + process.pid + '.js');
  const result = writeSupabaseConfig({
    SUPABASE_URL: url,
    SUPABASE_ANON_KEY: secret,
    SUPABASE_SECRET_KEY: secret,
  }, dest);
  const body = fs.readFileSync(dest, 'utf8');
  fs.unlinkSync(dest);
  assert.strictEqual(result.configured, false);
  assert.ok(body.indexOf(secret) === -1, 'secret leaked into config file');
  assert.ok(body.indexOf('url: ""') !== -1);
});

check('probe reports names only', function () {
  const present = presence({
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_SECRET_KEY: secret,
  });
  const encoded = JSON.stringify(present);
  assert.strictEqual(present.SUPABASE_URL, true);
  assert.strictEqual(present.SUPABASE_ANON_KEY, false);
  assert.strictEqual(present.SUPABASE_PUBLISHABLE_KEY, true);
  assert.strictEqual(present.SUPABASE_SECRET_KEY, true);
  assert.strictEqual(present.SUPABASE_SERVICE_ROLE_KEY, false);
  assert.ok(encoded.indexOf(secret) === -1);
  assert.ok(encoded.indexOf(publishable) === -1);
  assert.ok(encoded.indexOf(url) === -1);
});

async function handlerChecks() {
  const previous = {};
  ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(function (name) {
    previous[name] = process.env[name];
    delete process.env[name];
  });
  process.env.SUPABASE_URL = url;
  process.env.SUPABASE_PUBLISHABLE_KEY = publishable;
  process.env.SUPABASE_SECRET_KEY = secret;
  try {
    const probe = await fn.handler({ queryStringParameters: { probe: '1' } });
    const probeBody = JSON.parse(probe.body);
    assert.strictEqual(probeBody.present.SUPABASE_SECRET_KEY, true);
    assert.ok(probe.body.indexOf(secret) === -1, 'probe printed a secret');
    assert.ok(probe.body.indexOf(publishable) === -1, 'probe printed the public key');
    const pub = await fn.handler({ queryStringParameters: {} });
    const body = JSON.parse(pub.body);
    assert.strictEqual(body.configured, true);
    assert.strictEqual(body.anon, publishable);
    assert.ok(pub.body.indexOf(secret) === -1);
    console.log('  PASS  function probe and public response');
  } finally {
    Object.keys(previous).forEach(function (name) {
      if (previous[name] == null) delete process.env[name];
      else process.env[name] = previous[name];
    });
  }
}

handlerChecks().then(function () {
  if (failed) {
    console.log(failed + ' failed');
    process.exit(1);
  }
  console.log('workspace public config OK');
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
