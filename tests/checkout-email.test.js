/* Checkout email gate: Payment Link query, lead row, anon insert policy.
 * Run: node tests/checkout-email.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const email = require('../checkout-email');
const claim = require('../claim-listing');

const root = path.join(__dirname, '..');
const base = 'https://buy.stripe.com/testCheckoutCode01';
const withSlug = base + '?client_reference_id=hitachi-energy';

assert.strictEqual(email.validEmail('buyer@example.com'), true);
assert.strictEqual(email.validEmail('a+b@example.com'), true);
assert.strictEqual(email.validEmail(''), false);
assert.strictEqual(email.validEmail('not-an-email'), false);
assert.strictEqual(email.validEmail('a@b'), false);
assert.strictEqual(email.validEmail('a b@example.com'), false);

assert.strictEqual(
  email.withPrefilledEmail(base, 'buyer@example.com'),
  base + '?prefilled_email=' + encodeURIComponent('buyer@example.com')
);
assert.strictEqual(
  email.withPrefilledEmail(withSlug, 'a+b@example.com'),
  withSlug + '&prefilled_email=' + encodeURIComponent('a+b@example.com')
);
assert.ok(email.withPrefilledEmail(withSlug, 'buyer@example.com').indexOf('client_reference_id=hitachi-energy') > 0);
assert.strictEqual(
  email.withPrefilledEmail(withSlug + '&prefilled_email=old%40example.com', 'new@example.com'),
  withSlug + '&prefilled_email=' + encodeURIComponent('new@example.com')
);
assert.strictEqual(
  email.withPrefilledEmail(base + '#pay', 'buyer@example.com'),
  base + '?prefilled_email=' + encodeURIComponent('buyer@example.com') + '#pay'
);
assert.strictEqual(email.withPrefilledEmail(withSlug, 'buyer@example.com'), claim.withPrefilledEmail(withSlug, 'buyer@example.com'));
assert.strictEqual(email.validEmail('buyer@example.com'), claim.validEmail('buyer@example.com'));
assert.strictEqual(email.validEmail('nope'), claim.validEmail('nope'));
assert.strictEqual(email.priceIdFromUrl(withSlug), 'testCheckoutCode01');

const row = email.leadRow({
  email: ' buyer@example.com ',
  listingSlug: 'hitachi-energy',
  productName: 'verified_manufacturer',
  priceId: 'testCheckoutCode01',
  pagePath: '/claim-listing/hitachi-energy/',
  createdAt: '2026-10-30T00:00:00.000Z'
});
assert.strictEqual(row.email, 'buyer@example.com');
assert.strictEqual(row.listing_slug, 'hitachi-energy');
assert.strictEqual(row.product_name, 'verified_manufacturer');
assert.strictEqual(row.price_id, 'testCheckoutCode01');
assert.strictEqual(row.page_path, '/claim-listing/hitachi-energy/');
assert.strictEqual(row.created_at, '2026-10-30T00:00:00.000Z');
assert.strictEqual(email.leadRow({ email: 'a@b.co', listingSlug: '' }).listing_slug, null);

const skipped = email.saveLead(row);
assert.strictEqual(skipped.skipped, true);
assert.strictEqual(typeof skipped.then, 'undefined');

let posted = null;
email.saveLead(row, {
  config: { url: 'https://example.supabase.co/', anon: 'test-anon-key' },
  fetch: function (url, opts) {
    posted = { url: url, opts: opts };
    return Promise.resolve({ ok: true });
  }
}).then(function (res) {
  assert.strictEqual(res.ok, true);
  assert.strictEqual(posted.url, 'https://example.supabase.co/rest/v1/checkout_leads');
  assert.strictEqual(posted.opts.headers.Prefer, 'return=minimal');
  assert.strictEqual(posted.opts.headers.Authorization, 'Bearer test-anon-key');
  assert.strictEqual(JSON.parse(posted.opts.body).email, 'buyer@example.com');
  assert.strictEqual(JSON.parse(posted.opts.body).listing_slug, 'hitachi-energy');
  return email.saveLead(row, {
    config: { url: 'https://example.supabase.co', anon: 'test-anon-key' },
    fetch: function () { return Promise.reject(new Error('down')); }
  });
}).then(function (res) {
  assert.strictEqual(res.ok, false);
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261030140000_checkout_leads.sql'), 'utf8');
  assert.ok(/create table if not exists public\.checkout_leads/.test(sql));
  assert.ok(/email text not null/.test(sql));
  assert.ok(/listing_slug text/.test(sql));
  assert.ok(/product_name text/.test(sql));
  assert.ok(/price_id text/.test(sql));
  assert.ok(/page_path text/.test(sql));
  assert.ok(/created_at timestamptz not null default now\(\)/.test(sql));
  assert.ok(/enable row level security/.test(sql));
  assert.ok(/force row level security/.test(sql));
  assert.ok(/grant insert on table public\.checkout_leads to anon/.test(sql));
  assert.ok(/for insert\s+to anon\s+with check \(true\)/.test(sql));
  assert.strictEqual(/for select/.test(sql), false);
  assert.strictEqual(/for update/.test(sql), false);
  assert.strictEqual(/for delete/.test(sql), false);
  assert.ok(/revoke all on table public\.checkout_leads from public, anon, authenticated/.test(sql));

  function hrefCount(file) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const hrefs = html.match(/href="https:\/\/buy\.stripe\.com\/[^"]+"/g) || [];
    const inputs = html.match(/<input type="email"[^>]*data-checkout-email/g) || [];
    hrefs.forEach(function (href) {
      assert.ok(html.indexOf(href) >= 0);
    });
    assert.strictEqual(inputs.length, hrefs.length, file + ' inputs ' + inputs.length + ' hrefs ' + hrefs.length);
    inputs.forEach(function (tag) {
      assert.ok(/required/.test(tag), tag);
    });
    return hrefs.length;
  }
  assert.ok(hrefCount('pricing.html') >= 9);
  assert.strictEqual(hrefCount('claim-profile.html'), 1);
  const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
  assert.ok(privacy.indexOf('TransformerPath stores emails entered at checkout to follow up on incomplete purchases, and questions go to hello@transformerpath.com.') >= 0);
  assert.strictEqual(/dubai|uae/i.test(privacy.slice(privacy.indexOf('Payment processing'), privacy.indexOf('Payment processing') + 800)), false);

  const opened = [];
  const input = {
    value: '',
    attrs: {},
    getAttribute: function (k) { return this.attrs[k] || ''; },
    setAttribute: function (k, v) { this.attrs[k] = v; },
    addEventListener: function (name, fn) { this.listeners[name] = fn; },
    listeners: {},
    reportValidity: function () { this.reported = true; }
  };
  const anchor = {
    textContent: 'Unlock Learning — $199 →',
    attrs: { href: base, target: '_blank', 'data-track-plan': 'Learning' },
    getAttribute: function (k) { return this.attrs[k] || ''; },
    setAttribute: function (k, v) { this.attrs[k] = v; },
    addEventListener: function (name, fn) { this.listeners[name] = fn; },
    listeners: {},
    closest: function () { return wrap; }
  };
  const wrap = {
    className: 'tp-checkout-email',
    querySelector: function () { return input; }
  };
  input.parentNode = wrap;
  const savedWindow = global.window;
  global.window = {
    open: function (url) { opened.push(url); },
    location: { pathname: '/pricing.html' }
  };
  const doc = {
    head: { appendChild: function () {} },
    getElementById: function () { return { id: 'tp-checkout-email-style' }; },
    createElement: function () { return {}; },
    querySelectorAll: function (sel) {
      if (sel.indexOf('buy.stripe.com') >= 0) return [anchor];
      if (sel.indexOf('data-checkout-email') >= 0) return [input];
      return [];
    }
  };
  email.mount(doc);
  anchor.listeners.click({ preventDefault: function () {} });
  assert.strictEqual(opened.length, 0);
  assert.strictEqual(input.reported, true);
  input.value = 'buyer@example.com';
  return email.startAnchor(anchor, input, { preventDefault: function () {} }).then(function () {
    assert.strictEqual(opened.length, 1);
    assert.strictEqual(opened[0], base + '?prefilled_email=' + encodeURIComponent('buyer@example.com'));
    var popup = { closed: false, location: {} };
    var asyncAnchor = {
      attrs: { href: withSlug, target: '_blank', 'data-track-plan': 'Verified Manufacturer' },
      getAttribute: function (k) { return this.attrs[k] || ''; },
      setAttribute: function (k, v) { this.attrs[k] = v; }
    };
    global.window = {
      open: function (url) {
        opened.push(url);
        return url === 'about:blank' ? popup : null;
      },
      location: { pathname: '/pricing.html' },
      TP_SUPABASE: { url: 'https://example.supabase.co', anon: 'test-anon-key' }
    };
    global.fetch = function () { return Promise.resolve({ ok: false }); };
    return email.startAnchor(asyncAnchor, { value: 'buyer@example.com' }, { preventDefault: function () {} }).then(function () {
      assert.strictEqual(opened[opened.length - 1], 'about:blank');
      assert.strictEqual(
        popup.location.href,
        withSlug + '&prefilled_email=' + encodeURIComponent('buyer@example.com')
      );
      assert.ok(popup.location.href.indexOf('client_reference_id=hitachi-energy') > 0);
    });
  }).then(function () {
    assert.ok(fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8').indexOf("'checkout-email.js'") >= 0);
    if (savedWindow === undefined) delete global.window;
    else global.window = savedWindow;
    console.log('checkout email: PASS');
  });
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
