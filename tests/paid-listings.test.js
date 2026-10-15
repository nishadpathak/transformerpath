/* tests/paid-listings.test.js
 *
 * Stripe test-mode fixtures only. No live charge. Session ids use the
 * cs_test_ prefix. Network calls to Stripe are not made.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

function sign(payload, secret, ts) {
  const t = String(ts || Math.floor(Date.now() / 1000));
  const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload, 'utf8').digest('hex');
  return 't=' + t + ',v1=' + v1;
}

function memoryStore() {
  const events = new Map();
  const listings = new Map();
  const api = {
    paidWrites: 0,
    entitlementWrites: 0,
    listings: listings,
    events: events,
    eventProcessed: async function (id) { return events.has(id); },
    markProcessed: async function (id, type) { events.set(id, type); },
    writeEntitlement: async function () { api.entitlementWrites++; },
    writePaidListing: async function (row) {
      api.paidWrites++;
      listings.set(row.session_id, Object.assign({}, row));
    }
  };
  return api;
}

async function postWebhook(handler, secret, event) {
  const payload = JSON.stringify(event);
  return handler({
    httpMethod: 'POST',
    headers: { 'stripe-signature': sign(payload, secret) },
    body: payload
  });
}

async function main() {
  const savedFetch = global.fetch;
  const savedStripe = process.env.STRIPE_SECRET_KEY;
  const savedPriceM = process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER;
  const savedPriceE = process.env.STRIPE_PRICE_FEATURED_EVENT;
  const savedNotify = process.env.NOTIFY_TO;
  const savedResend = process.env.RESEND_API_KEY;

  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER;
  delete process.env.STRIPE_PRICE_FEATURED_EVENT;
  delete process.env.RESEND_API_KEY;

  global.fetch = function () { throw new Error('stripe must not be called'); };
  const checkout = require('../functions/create-checkout');

  let res = await checkout.handler({ httpMethod: 'GET' });
  check('create-checkout GET is 405', res.statusCode === 405);

  res = await checkout.handler({ httpMethod: 'OPTIONS' });
  check('create-checkout OPTIONS is 204', res.statusCode === 204);

  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      product: 'verified_manufacturer',
      company_slug: 'not-a-real-company-zzz',
      email: 'buyer@example.com'
    })
  });
  check('unknown slug is 400', res.statusCode === 400 && JSON.parse(res.body).error === 'unknown slug', res.body);

  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      product: 'featured_event',
      event_id: 'not-a-real-event-zzz',
      email: 'buyer@example.com'
    })
  });
  check('unknown event is 400', res.statusCode === 400, res.body);

  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      product: 'verified_manufacturer',
      company_slug: 'a-plus-power-solution',
      email: 'buyer@example.com'
    })
  });
  const unconfigured = JSON.parse(res.body);
  check('unconfigured checkout is 503', res.statusCode === 503 && unconfigured.configured === false, res.body);
  check('503 names missing env vars', Array.isArray(unconfigured.missing) && unconfigured.missing.indexOf('STRIPE_SECRET_KEY') >= 0);

  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_PRICE_FEATURED_EVENT = 'price_test_featured';
  let featuredCheckoutBody = '';
  global.fetch = async function (url, opts) {
    featuredCheckoutBody = opts && opts.body ? String(opts.body) : '';
    return { ok: true, status: 200, json: async function () { return { id: 'cs_test_featured_created', url: 'https://checkout.stripe.com/c/pay/cs_test_created', livemode: false }; } };
  };
  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'featured_event', event_id: 'middle-east-energy', email: 'buyer@example.com' })
  });
  check('featured checkout success url opens the events form', res.statusCode === 200 && featuredCheckoutBody.indexOf('paid%3Dfeatured_event') >= 0 && featuredCheckoutBody.indexOf('%23submit-event') >= 0, res.statusCode + ' ' + featuredCheckoutBody.slice(0, 240));

  process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER = 'price_test_verified';
  let manufacturerCheckoutBody = '';
  global.fetch = async function (url, opts) {
    manufacturerCheckoutBody = opts && opts.body ? String(opts.body) : '';
    return { ok: true, status: 200, json: async function () { return { id: 'cs_test_mfr_created', url: 'https://checkout.stripe.com/c/pay/cs_test_created', livemode: false }; } };
  };
  res = await checkout.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ product: 'verified_manufacturer', company_slug: 'a-plus-power-solution', email: 'buyer@example.com' })
  });
  check('manufacturer checkout success url opens the claim form', res.statusCode === 200 && manufacturerCheckoutBody.indexOf('paid%3Dverified_manufacturer') >= 0 && manufacturerCheckoutBody.indexOf('%23claimForm') >= 0, res.statusCode + ' ' + manufacturerCheckoutBody.slice(0, 280));
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_FEATURED_EVENT;
  delete process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER;
  global.fetch = function () { throw new Error('stripe must not be called'); };

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test_secret';
  const wh = require('../functions/stripe-webhook');
  const store = memoryStore();
  wh._setPersistenceForTests(store);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  const bad = await wh.handler({
    httpMethod: 'POST',
    headers: { 'stripe-signature': 't=' + Math.floor(Date.now() / 1000) + ',v1=' + 'ab'.repeat(32) },
    body: '{}'
  });
  check('bad signature is 400', bad.statusCode === 400, bad.body);

  const ignored = await postWebhook(wh.handler, secret, {
    id: 'evt_ignore_1',
    type: 'payment_intent.created',
    data: { object: {} }
  });
  check('ignored event is 200', ignored.statusCode === 200 && JSON.parse(ignored.body).ignored === 'payment_intent.created', ignored.body);

  const sessionId = 'cs_test_fixture_verified_manufacturer';
  check('fixture session id is test mode', sessionId.indexOf('cs_test_') === 0);
  const paidEvent = {
    id: 'evt_paid_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        amount_total: 49900,
        currency: 'usd',
        livemode: false,
        customer_email: 'buyer@example.com',
        metadata: { product: 'verified_manufacturer', company_slug: 'a-plus-power-solution' }
      }
    }
  };
  const first = await postWebhook(wh.handler, secret, paidEvent);
  const row = store.listings.get(sessionId);
  check('completed test session writes paid_listings', first.statusCode === 200 && row && row.status === 'paid_pending_verification', first.body);
  check('row keeps amount, currency, livemode, email', row && row.amount === 49900 && row.currency === 'usd' && row.livemode === false && row.email === 'buyer@example.com' && row.company_slug === 'a-plus-power-solution');

  const replay = await postWebhook(wh.handler, secret, paidEvent);
  check('replayed event id is idempotent', replay.statusCode === 200 && JSON.parse(replay.body).idempotent === true && store.paidWrites === 1, replay.body);
  check('markProcessed receives the event type', store.events.get('evt_paid_1') === 'checkout.session.completed');

  const engineerMiss = await postWebhook(wh.handler, secret, {
    id: 'evt_eng_missing_user',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_engineer', metadata: { plan: 'learning' } } }
  });
  check('engineer checkout without user_id stays 400', engineerMiss.statusCode === 400, engineerMiss.body);

  const engineerHit = await postWebhook(wh.handler, secret, {
    id: 'evt_eng_user',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_engineer_user', metadata: { plan: 'learning', user_id: 'user_1' }, customer: 'cus_1' } }
  });
  check('engineer checkout with user_id still writes entitlement', engineerHit.statusCode === 200 && store.entitlementWrites === 1, engineerHit.body);
  check('engineer markProcessed receives event type', store.events.get('evt_eng_user') === 'checkout.session.completed');

  const paid = require('../lib/paid-listings');
  check('no badge while status is paid_pending_verification', paid.manufacturerBadgeHtml('a-plus-power-solution', { listings: [row] }) === '');

  const verifiedDoc = {
    listings: [Object.assign({}, row, {
      status: 'verified',
      reviewer: 'directory-review',
      reviewed_at: '2026-10-14T09:00:00Z',
      verification_evidence: 'Corporate domain email matched the directory website.'
    })]
  };
  const badge = paid.manufacturerBadgeHtml('a-plus-power-solution', verifiedDoc);
  check('verified row renders VERIFIED MANUFACTURER', badge.indexOf('>VERIFIED MANUFACTURER<') >= 0 && badge.indexOf('data-company-slug="a-plus-power-solution"') >= 0, badge);
  check('badge includes commerce neutrality', badge.indexOf('does NOT mean product certified') >= 0);

  const company = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8')).companies
    .find(function (c) { return c.slug === 'a-plus-power-solution'; });
  const copy = JSON.parse(JSON.stringify(company));
  const evidence = copy.evidence;
  const capability = JSON.stringify(copy.capability_evidence);
  const score = copy.completeness_score;
  const labels = JSON.stringify(copy.capability_labels);
  const featuredBefore = copy.featured;
  paid.applyVerifiedManufacturers([copy], verifiedDoc);
  check('directory tier and verified flag set', copy.listing_tier === 'verified' && copy.verified === true);
  check('capability and evidence unchanged', copy.evidence === evidence && JSON.stringify(copy.capability_evidence) === capability);
  check('ranking fields unchanged', copy.completeness_score === score && JSON.stringify(copy.capability_labels) === labels && copy.featured === featuredBefore);

  const featuredSession = 'cs_test_fixture_featured_event';
  check('featured fixture session id is test mode', featuredSession.indexOf('cs_test_') === 0);
  const pendingEvent = {
    listings: [{
      product: 'featured_event',
      event_id: 'middle-east-energy',
      status: 'paid_pending_verification',
      session_id: featuredSession,
      email: 'events@example.com',
      amount: 29900,
      currency: 'usd',
      livemode: false
    }]
  };
  check('no FEATURED label before review', paid.featuredEventHtml('middle-east-energy', pendingEvent) === '');
  const featuredDoc = {
    listings: [Object.assign({}, pendingEvent.listings[0], {
      status: 'verified',
      reviewer: 'directory-review',
      reviewed_at: '2026-10-14T09:30:00Z',
      verification_evidence: 'Organiser confirmation matched the event page.'
    })]
  };
  const featuredHtml = paid.featuredEventHtml('middle-east-energy', featuredDoc);
  check('reviewed event renders FEATURED', featuredHtml.indexOf('>FEATURED<') >= 0 && featuredHtml.indexOf('data-event-id="middle-east-energy"') >= 0, featuredHtml);
  check('event id is in the catalog', paid.knownEventId('middle-east-energy') === true);

  const linkSession = 'cs_test_payment_link_featured';
  check('payment link fixture session id is test mode', linkSession.indexOf('cs_test_') === 0);
  delete process.env.STRIPE_PAYMENT_LINK_FEATURED_EVENT;
  const linkEvent = {
    id: 'evt_plink_featured',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: linkSession,
        amount_total: paid.FEATURED_EVENT_AMOUNT_CENTS,
        currency: 'usd',
        livemode: false,
        payment_link: 'plink_test_featured',
        customer_details: { email: 'organiser@example.com' },
        metadata: {}
      }
    }
  };
  const linkRes = await postWebhook(wh.handler, secret, linkEvent);
  const linkRow = store.listings.get(linkSession);
  check('payment link writes a pending featured slot', linkRes.statusCode === 200 && linkRow && linkRow.product === 'featured_event' && linkRow.status === 'paid_pending_verification' && !linkRow.event_id, JSON.stringify(linkRow));
  check('payment link does not publish FEATURED', paid.featuredEventHtml('middle-east-energy', { listings: [linkRow] }) === '');
  const linkReplay = await postWebhook(wh.handler, secret, linkEvent);
  check('payment link replay is idempotent', linkReplay.statusCode === 200 && JSON.parse(linkReplay.body).idempotent === true);

  const returnEvent = await postWebhook(wh.handler, secret, {
    id: 'evt_featured_return',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_featured_return',
        amount_total: 29900,
        currency: 'usd',
        livemode: false,
        success_url: 'https://transformerpath.com/events.html?paid=featured_event&session_id=cs_test_featured_return#submit-event',
        customer_email: 'return@example.com',
        metadata: {}
      }
    }
  });
  const returnRow = store.listings.get('cs_test_featured_return');
  check('after-payment URL matches a pending featured slot', returnEvent.statusCode === 200 && returnRow && returnRow.product === 'featured_event' && returnRow.status === 'paid_pending_verification', returnEvent.body);

  process.env.STRIPE_PAYMENT_LINK_FEATURED_EVENT = 'plink_expected';
  check('configured plink id matches that link', paid.isFeaturedEventCheckout({ amount_total: 29900, currency: 'usd', payment_link: 'plink_expected', metadata: {} }) === true);
  check('configured plink id ignores a different $299 link', paid.isFeaturedEventCheckout({ amount_total: 29900, currency: 'usd', payment_link: 'plink_other', metadata: {} }) === false);
  delete process.env.STRIPE_PAYMENT_LINK_FEATURED_EVENT;
  check('engineer payment link is not a featured slot', paid.isFeaturedEventCheckout({ amount_total: 19900, currency: 'usd', payment_link: 'plink_learn', metadata: { user_id: 'user_1', plan: 'learning' } }) === false);
  check('engineer payment link is not a manufacturer slot', paid.isVerifiedManufacturerCheckout({ amount_total: 19900, currency: 'usd', payment_link: 'plink_learn', metadata: { user_id: 'user_1', plan: 'learning' } }) === false);

  const mfrLinkSession = 'cs_test_payment_link_verified';
  check('manufacturer payment link fixture session id is test mode', mfrLinkSession.indexOf('cs_test_') === 0);
  delete process.env.STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER;
  const mfrLinkEvent = {
    id: 'evt_plink_verified',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: mfrLinkSession,
        amount_total: paid.VERIFIED_MANUFACTURER_AMOUNT_CENTS,
        currency: 'usd',
        livemode: false,
        payment_link: 'plink_test_verified',
        client_reference_id: 'a-plus-power-solution',
        customer_details: { email: 'maker@example.com' },
        metadata: {}
      }
    }
  };
  const mfrLinkRes = await postWebhook(wh.handler, secret, mfrLinkEvent);
  const mfrLinkRow = store.listings.get(mfrLinkSession);
  check('payment link writes a pending manufacturer verification', mfrLinkRes.statusCode === 200 && mfrLinkRow && mfrLinkRow.product === 'verified_manufacturer' && mfrLinkRow.status === 'paid_pending_verification' && mfrLinkRow.company_slug === 'a-plus-power-solution', JSON.stringify(mfrLinkRow));
  check('payment link does not publish VERIFIED MANUFACTURER', paid.manufacturerBadgeHtml('a-plus-power-solution', { listings: [mfrLinkRow] }) === '');

  const mfrReturn = await postWebhook(wh.handler, secret, {
    id: 'evt_verified_return',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_verified_return',
        amount_total: 49900,
        currency: 'usd',
        livemode: false,
        success_url: 'https://transformerpath.com/claim-profile.html?paid=verified_manufacturer&session_id=cs_test_verified_return#claimForm',
        customer_email: 'return-mfr@example.com',
        metadata: {}
      }
    }
  });
  const mfrReturnRow = store.listings.get('cs_test_verified_return');
  check('after-payment URL matches a pending verification', mfrReturn.statusCode === 200 && mfrReturnRow && mfrReturnRow.product === 'verified_manufacturer' && mfrReturnRow.status === 'paid_pending_verification', mfrReturn.body);

  process.env.STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER = 'plink_mfr_expected';
  check('configured manufacturer plink id matches that link', paid.isVerifiedManufacturerCheckout({ amount_total: 49900, currency: 'usd', payment_link: 'plink_mfr_expected', metadata: {} }) === true);
  check('configured manufacturer plink id ignores a different $499 link', paid.isVerifiedManufacturerCheckout({ amount_total: 49900, currency: 'usd', payment_link: 'plink_other', metadata: {} }) === false);
  delete process.env.STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER;
  check('$299 featured link is not a manufacturer slot', paid.isVerifiedManufacturerCheckout({ amount_total: 29900, currency: 'usd', payment_link: 'plink_test_featured', metadata: {} }) === false);
  check('$499 link is not a featured slot', paid.isFeaturedEventCheckout({ amount_total: 49900, currency: 'usd', payment_link: 'plink_test_verified', metadata: {} }) === false);
  check('$399 exhibitor link is not a featured event slot', paid.isFeaturedEventCheckout({ amount_total: 39900, currency: 'usd', payment_link: 'plink_test_exhibitor', metadata: {} }) === false);
  check('$399 exhibitor link is not a manufacturer slot', paid.isVerifiedManufacturerCheckout({ amount_total: 39900, currency: 'usd', payment_link: 'plink_test_exhibitor', metadata: {} }) === false);

  const exhibitorLinkSession = 'cs_test_payment_link_exhibitor';
  check('exhibitor payment link fixture session id is test mode', exhibitorLinkSession.indexOf('cs_test_') === 0);
  delete process.env.STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR;
  const exhibitorLinkRes = await postWebhook(wh.handler, secret, {
    id: 'evt_exhibitor_link',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: exhibitorLinkSession,
        amount_total: 39900,
        currency: 'usd',
        payment_link: 'plink_test_exhibitor',
        livemode: false,
        metadata: {},
        customer_email: 'buyer@example.com'
      }
    }
  });
  const exhibitorLinkRow = store.listings.get(exhibitorLinkSession);
  check('payment link writes a pending exhibitor slot', exhibitorLinkRes.statusCode === 200 && exhibitorLinkRow && exhibitorLinkRow.product === 'featured_exhibitor' && exhibitorLinkRow.status === 'paid_pending_verification' && !exhibitorLinkRow.event_id, JSON.stringify(exhibitorLinkRow));
  process.env.STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR = 'plink_exhibitor_expected';
  check('configured exhibitor plink id matches that link', paid.isFeaturedExhibitorCheckout({ amount_total: 39900, currency: 'usd', payment_link: 'plink_exhibitor_expected', metadata: {} }) === true);
  check('configured exhibitor plink id ignores a different $399 link', paid.isFeaturedExhibitorCheckout({ amount_total: 39900, currency: 'usd', payment_link: 'plink_other', metadata: {} }) === false);
  delete process.env.STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR;

  const engineerStill = await postWebhook(wh.handler, secret, {
    id: 'evt_eng_199',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_eng_199', amount_total: 19900, currency: 'usd', payment_link: 'plink_learn', metadata: { plan: 'learning', user_id: 'user_199' } } }
  });
  check('engineer $199 payment link still writes an entitlement', engineerStill.statusCode === 200 && store.entitlementWrites === 2 && !store.listings.get('cs_test_eng_199'), engineerStill.body);

  const link = paid.FEATURED_EVENT_PAYMENT_LINK;
  check('events list pay button uses the constant', fs.readFileSync('events.html', 'utf8').indexOf('href="' + link + '"') >= 0 && fs.readFileSync('events.html', 'utf8').indexOf('name="event_name"') >= 0 && fs.readFileSync('events.html', 'utf8').indexOf('name="event_url"') >= 0 && fs.readFileSync('events.html', 'utf8').indexOf('name="event_dates"') >= 0);
  check('pricing pay button uses the constant', fs.readFileSync('pricing.html', 'utf8').indexOf('href="' + link + '"') >= 0);
  const eventPages = fs.readdirSync('events').filter(function (d) { return fs.existsSync('events/' + d + '/index.html'); });
  const cardPages = eventPages.filter(function (d) {
    return fs.readFileSync('events/' + d + '/index.html', 'utf8').indexOf('Feature your company on TransformerPath') >= 0;
  });
  const linkedPages = cardPages.filter(function (d) {
    return fs.readFileSync('events/' + d + '/index.html', 'utf8').indexOf('href="' + link + '"') >= 0;
  });
  const leftoverWidgets = eventPages.filter(function (d) {
    return fs.readFileSync('events/' + d + '/index.html', 'utf8').indexOf('data-product="featured_event"') >= 0;
  });
  check('event pages use the payment link', cardPages.length > 20 && linkedPages.length === cardPages.length && leftoverWidgets.length === 0, 'cards=' + cardPages.length + ' linked=' + linkedPages.length + ' leftover=' + leftoverWidgets.length);
  const pricedPages = cardPages.filter(function (d) {
    const html = fs.readFileSync('events/' + d + '/index.html', 'utf8');
    return html.indexOf('Featured Event is $299 per event.') >= 0 && html.indexOf('Featured Exhibitor is $399 per event.') >= 0 && html.indexOf('from $399') < 0;
  });
  check('event cards show Featured Event at $299 and Featured Exhibitor at $399', pricedPages.length === cardPages.length, 'priced=' + pricedPages.length + ' cards=' + cardPages.length);
  check('event card template keeps the two prices distinct', fs.readFileSync('build-events.js', 'utf8').indexOf('Featured Event is $299 per event. Featured Exhibitor is $399 per event.') >= 0 && fs.readFileSync('build-events.js', 'utf8').indexOf('from $399') < 0);

  function jsHits(dir, hits) {
    fs.readdirSync(dir).forEach(function (name) {
      if (name === 'node_modules' || name === 'dist' || name === 'transformerpath' || name === '.git') return;
      const p = dir + '/' + name;
      const st = fs.statSync(p);
      if (st.isDirectory()) jsHits(p, hits);
      else if (name.endsWith('.js') && fs.readFileSync(p, 'utf8').indexOf(link) >= 0) hits.push(p);
    });
  }
  const hits = [];
  jsHits('.', hits);
  check('payment link URL lives in one config constant', hits.length === 1 && hits[0] === './lib/paid-listings.js', hits.join(','));

  const mfrLink = paid.VERIFIED_MANUFACTURER_PAYMENT_LINK;
  check('both pay URLs live in the same config object', paid.PAYMENT_LINKS.featured_event.url === link && paid.PAYMENT_LINKS.verified_manufacturer.url === mfrLink);
  const exhibitorLink = paid.FEATURED_EXHIBITOR_PAYMENT_LINK;
  check('exhibitor pay URL lives in the same config object', paid.PAYMENT_LINKS.featured_exhibitor.url === exhibitorLink && paid.PAYMENT_LINKS.featured_exhibitor.amountCents === 39900);
  const exhibitorHits = [];
  function jsHitsExhibitor(dir, found) {
    fs.readdirSync(dir).forEach(function (name) {
      if (name === 'node_modules' || name === 'dist' || name === 'transformerpath' || name === '.git') return;
      const p = dir + '/' + name;
      const st = fs.statSync(p);
      if (st.isDirectory()) jsHitsExhibitor(p, found);
      else if (name.endsWith('.js') && fs.readFileSync(p, 'utf8').indexOf(exhibitorLink) >= 0) found.push(p);
    });
  }
  jsHitsExhibitor('.', exhibitorHits);
  check('exhibitor payment link URL lives in that same constant', exhibitorHits.length === 1 && exhibitorHits[0] === './lib/paid-listings.js', exhibitorHits.join(','));
  check('events list exhibitor pay button uses the constant', fs.readFileSync('events.html', 'utf8').indexOf('href="' + exhibitorLink + '"') >= 0 && fs.readFileSync('events.html', 'utf8').indexOf('Featured Exhibitor · $399') >= 0);
  check('pricing exhibitor pay button uses the constant', fs.readFileSync('pricing.html', 'utf8').indexOf('href="' + exhibitorLink + '"') >= 0 && fs.readFileSync('pricing.html', 'utf8').indexOf('Feature your exhibitor — $399') >= 0);
  check('sponsor exhibitor pay button uses the constant', fs.readFileSync('sponsor.html', 'utf8').indexOf('href="' + exhibitorLink + '"') >= 0 && fs.readFileSync('sponsor.html', 'utf8').indexOf('id="contact"') >= 0);
  check('exhibitions page exhibitor pay button uses the constant', fs.readFileSync('exhibitions.html', 'utf8').indexOf('href="' + exhibitorLink + '"') >= 0);
  const commerce = JSON.parse(fs.readFileSync('data/commerce.json', 'utf8'));
  const commerceExhibitor = commerce.sections.reduce(function (found, section) {
    return found || (section.products || []).filter(function (product) { return product.id === 'featured_exhibitor'; })[0];
  }, null);
  check('commerce catalog stores the exhibitor payment link', commerceExhibitor && commerceExhibitor.price === 399 && commerceExhibitor.payment_link === exhibitorLink, JSON.stringify(commerceExhibitor && { price: commerceExhibitor.price, payment_link: commerceExhibitor.payment_link }));
  const exhibitorPages = cardPages.filter(function (d) {
    const html = fs.readFileSync('events/' + d + '/index.html', 'utf8');
    return html.indexOf('href="' + exhibitorLink + '"') >= 0 && html.indexOf('data-featured-exhibitor-pay="1"') >= 0 && html.indexOf('href="../../sponsor.html">Feature your company — $399') < 0;
  });
  check('event pages use the exhibitor payment link', exhibitorPages.length === cardPages.length && cardPages.length > 20, 'cards=' + cardPages.length + ' exhibitor=' + exhibitorPages.length);
  const mfrHits = [];
  function jsHitsMfr(dir, found) {
    fs.readdirSync(dir).forEach(function (name) {
      if (name === 'node_modules' || name === 'dist' || name === 'transformerpath' || name === '.git') return;
      const p = dir + '/' + name;
      const st = fs.statSync(p);
      if (st.isDirectory()) jsHitsMfr(p, found);
      else if (name.endsWith('.js') && fs.readFileSync(p, 'utf8').indexOf(mfrLink) >= 0) found.push(p);
    });
  }
  jsHitsMfr('.', mfrHits);
  check('manufacturer payment link URL lives in that same constant', mfrHits.length === 1 && mfrHits[0] === './lib/paid-listings.js', mfrHits.join(','));
  check('list-company pay button uses the constant', fs.readFileSync('list-company.html', 'utf8').indexOf('href="' + mfrLink + '"') >= 0 && fs.readFileSync('list-company.html', 'utf8').indexOf('badge goes live as soon as payment clears') < 0);
  const claimHtml = fs.readFileSync('claim-profile.html', 'utf8');
  check('claim form pay button uses the constant', claimHtml.indexOf('href="' + mfrLink + '"') >= 0 && claimHtml.indexOf('id="claimForm"') >= 0 && claimHtml.indexOf('name="payment_session"') >= 0 && claimHtml.indexOf('claimPaidBanner') >= 0);
  check('pricing manufacturer pay button uses the constant', fs.readFileSync('pricing.html', 'utf8').indexOf('href="' + mfrLink + '"') >= 0);
  const profileDirs = fs.readdirSync('manufacturers').filter(function (d) {
    return fs.existsSync('manufacturers/' + d + '/index.html') && fs.readFileSync('manufacturers/' + d + '/index.html', 'utf8').indexOf('>Claim this profile →</a>') >= 0;
  });
  const linkedProfiles = profileDirs.filter(function (d) {
    const html = fs.readFileSync('manufacturers/' + d + '/index.html', 'utf8');
    return html.indexOf('href="' + mfrLink + '?client_reference_id=' + d + '"') >= 0 && html.indexOf('Pay $499 — Get Verified') >= 0;
  });
  check('manufacturer profiles use the Get Verified payment link', profileDirs.length === linkedProfiles.length && linkedProfiles.length > 900, 'profiles=' + profileDirs.length + ' linked=' + linkedProfiles.length);
  check('sample profile keeps the claim link beside the pay button', fs.readFileSync('manufacturers/erea-energy-engineering/index.html', 'utf8').indexOf('client_reference_id=erea-energy-engineering') >= 0);
  const sampleCtas = paid.verifiedManufacturerCtasHtml({ companySlug: 'erea-energy-engineering', trackName: 'EREA Energy Engineering' });
  check('profile and directory ctas use the $499 link with the maker slug', sampleCtas.indexOf('href="' + mfrLink + '?client_reference_id=erea-energy-engineering"') >= 0 && sampleCtas.indexOf('>Get verified<') >= 0 && sampleCtas.indexOf('>Claim this profile<') >= 0 && sampleCtas.indexOf('data-mfr-verify-cta="claim"') >= 0 && sampleCtas.indexOf('data-mfr-verify-cta="get-verified"') >= 0);
  check('earned manufacturer does not get a verify cta', paid.verifiedManufacturerCtasHtml({ companySlug: 'erea-energy-engineering', earned: true }) === '');
  const samplePage = fs.readFileSync('manufacturers/erea-energy-engineering/index.html', 'utf8');
  const topAt = samplePage.indexOf('data-mfr-verify-cta="get-verified"');
  check('sample profile shows both ctas above the census note', topAt > 0 && topAt < samplePage.indexOf('Independent census profile') && samplePage.indexOf('data-mfr-verify-cta="claim"') > 0 && samplePage.indexOf('data-mfr-verify-cta="claim"') < samplePage.indexOf('Independent census profile'));

  const gate = require('../check-paid-badges');
  const stray = '<span class="paid-badge" data-paid-badge="verified-manufacturer" data-company-slug="a-plus-power-solution">VERIFIED MANUFACTURER</span>';
  check('CI fails a badge without a verified row', gate.auditHtml('sample.html', stray, { listings: [] }).length === 1);
  check('CI passes a badge with a verified row', gate.auditHtml('sample.html', stray, verifiedDoc).length === 0);
  check('CI fails directory verified without a row', gate.auditDirectory([{ slug: 'a-plus-power-solution', listing_tier: 'verified', verified: true }], { listings: [] }).length === 1);

  const receipt = require('../functions/lib/paid-receipt');
  process.env.NOTIFY_TO = 'ops@example.com';
  const msgs = receipt.messages(row);
  check('buyer confirmation is addressed to the payer', msgs.buyer && msgs.buyer.to[0] === 'buyer@example.com');
  check('internal notice goes to NOTIFY_TO', msgs.internal && msgs.internal.to[0] === 'ops@example.com');
  check('receipt text does not contain a secret key', msgs.buyer.text.indexOf('sk_') < 0 && msgs.internal.text.indexOf('whsec_') < 0);
  const featuredReceipt = receipt.messages(linkRow);
  check('featured receipt sends the buyer to the events form', featuredReceipt.buyer && featuredReceipt.buyer.text.indexOf('/events.html?paid=featured_event#submit-event') >= 0);
  const manufacturerReceipt = receipt.messages(mfrLinkRow);
  check('manufacturer receipt sends the buyer to the claim form', manufacturerReceipt.buyer && manufacturerReceipt.buyer.text.indexOf('/claim-profile.html?paid=verified_manufacturer#claimForm') >= 0);
  const exhibitorReceipt = receipt.messages(exhibitorLinkRow);
  check('exhibitor receipt sends the buyer to the exhibitor form', exhibitorReceipt.buyer && exhibitorReceipt.buyer.text.indexOf('/sponsor.html?paid=featured_exhibitor#contact') >= 0 && exhibitorReceipt.buyer.text.indexOf('Featured Exhibitor ($399)') >= 0);

  const widget = paid.checkoutWidget({
    product: 'verified_manufacturer',
    companySlug: 'a-plus-power-solution',
    fallback: '../../claim-profile.html',
    button: 'Pay $499 — Get Verified'
  });
  check('claim checkout widget has the pay button', widget.indexOf('Pay $499 — Get Verified') >= 0);

  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return {
          id: sessionId,
          payment_status: 'paid',
          amount_total: 49900,
          livemode: false,
          metadata: { product: 'verified_manufacturer', company_slug: 'a-plus-power-solution' }
        };
      }
    };
  };
  const verify = require('../functions/verify-access');
  const listingAccess = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  })).body);
  check('manufacturer payment does not grant course access', listingAccess.valid === false && listingAccess.paid === true && listingAccess.listing === 'paid_pending_verification' && !listingAccess.entitlement_token, JSON.stringify(listingAccess));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return {
          id: linkSession,
          payment_status: 'paid',
          amount_total: 29900,
          currency: 'usd',
          livemode: false,
          payment_link: 'plink_test_featured',
          metadata: {}
        };
      }
    };
  };
  const featuredAccess = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: linkSession })
  })).body);
  check('featured payment link does not grant course access', featuredAccess.valid === false && featuredAccess.paid === true && featuredAccess.product === 'featured_event' && featuredAccess.listing === 'paid_pending_verification' && !featuredAccess.entitlement_token, JSON.stringify(featuredAccess));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return {
          id: mfrLinkSession,
          payment_status: 'paid',
          amount_total: 49900,
          currency: 'usd',
          livemode: false,
          payment_link: 'plink_test_verified',
          metadata: {}
        };
      }
    };
  };
  const manufacturerAccess = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: mfrLinkSession })
  })).body);
  check('manufacturer payment link does not grant course access', manufacturerAccess.valid === false && manufacturerAccess.paid === true && manufacturerAccess.product === 'verified_manufacturer' && manufacturerAccess.listing === 'paid_pending_verification' && !manufacturerAccess.entitlement_token, JSON.stringify(manufacturerAccess));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return {
          id: exhibitorLinkSession,
          payment_status: 'paid',
          amount_total: 39900,
          currency: 'usd',
          livemode: false,
          payment_link: 'plink_test_exhibitor',
          metadata: {}
        };
      }
    };
  };
  const exhibitorAccess = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: exhibitorLinkSession })
  })).body);
  check('exhibitor payment link does not grant course access', exhibitorAccess.valid === false && exhibitorAccess.paid === true && exhibitorAccess.product === 'featured_exhibitor' && exhibitorAccess.listing === 'paid_pending_verification' && !exhibitorAccess.entitlement_token, JSON.stringify(exhibitorAccess));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return { id: 'cs_test_learn', payment_status: 'paid', amount_total: 19900, livemode: false, metadata: {}, payment_link: 'plink_learn' };
      }
    };
  };
  const learning = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: 'cs_test_learn' })
  })).body);
  check('engineer $199 payment still grants learner', learning.valid === true && learning.tier === 'learner' && !!learning.entitlement_token, JSON.stringify({ valid: learning.valid, tier: learning.tier, hasToken: !!learning.entitlement_token }));

  global.fetch = savedFetch;
  if (savedStripe === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = savedStripe;
  if (savedPriceM === undefined) delete process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER; else process.env.STRIPE_PRICE_VERIFIED_MANUFACTURER = savedPriceM;
  if (savedPriceE === undefined) delete process.env.STRIPE_PRICE_FEATURED_EVENT; else process.env.STRIPE_PRICE_FEATURED_EVENT = savedPriceE;
  if (savedNotify === undefined) delete process.env.NOTIFY_TO; else process.env.NOTIFY_TO = savedNotify;
  if (savedResend === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = savedResend;

  console.log('\nPAID LISTINGS: ' + (fail ? 'FAIL' : 'PASS') + ' (' + pass + ' passed, ' + fail + ' failed)');
  console.log('TEST_MODE_SESSION ' + sessionId);
  console.log('TEST_MODE_SESSION ' + featuredSession);
  process.exit(fail ? 1 : 0);
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
