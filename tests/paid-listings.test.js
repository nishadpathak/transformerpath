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
        url: paid.FEATURED_EVENT_PAYMENT_LINK,
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

  const amountOnly = await postWebhook(wh.handler, secret, {
    id: 'evt_amount_only_299',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_amount_only_299',
        amount_total: 29900,
        currency: 'usd',
        livemode: false,
        payment_link: 'plink_job_featured',
        metadata: {},
        customer_details: { email: 'jobs@example.com' }
      }
    }
  });
  check('$299 amount alone does not write Featured Event', amountOnly.statusCode === 400 && !store.listings.get('cs_test_amount_only_299'), amountOnly.body);

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
        url: paid.VERIFIED_MANUFACTURER_PAYMENT_LINK,
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
  check('$1,500 webinar link is not a featured event slot', paid.isFeaturedEventCheckout({ amount_total: 150000, currency: 'usd', payment_link: 'plink_test_webinar', metadata: {} }) === false);
  check('$1,500 webinar link is not an exhibitor slot', paid.isFeaturedExhibitorCheckout({ amount_total: 150000, currency: 'usd', payment_link: 'plink_test_webinar', metadata: {} }) === false);
  check('$1,500 webinar link is not a manufacturer slot', paid.isVerifiedManufacturerCheckout({ amount_total: 150000, currency: 'usd', payment_link: 'plink_test_webinar', metadata: {} }) === false);
  check('engineer $1,999 is not a hosted webinar', paid.isHostedWebinarCheckout({ amount_total: 199900, currency: 'usd', payment_link: 'plink_team', metadata: { plan: 'team', user_id: 'user_team' } }) === false);

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
        url: paid.FEATURED_EXHIBITOR_PAYMENT_LINK,
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

  const webinarLinkSession = 'cs_test_payment_link_webinar';
  check('webinar payment link fixture session id is test mode', webinarLinkSession.indexOf('cs_test_') === 0);
  delete process.env.STRIPE_PAYMENT_LINK_HOSTED_WEBINAR;
  const webinarLinkRes = await postWebhook(wh.handler, secret, {
    id: 'evt_webinar_link',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: webinarLinkSession,
        amount_total: 150000,
        currency: 'usd',
        payment_link: 'plink_test_webinar',
        url: paid.HOSTED_WEBINAR_PAYMENT_LINK,
        livemode: false,
        metadata: {},
        customer_email: 'buyer@example.com'
      }
    }
  });
  const webinarLinkRow = store.listings.get(webinarLinkSession);
  check('payment link writes a pending webinar slot', webinarLinkRes.statusCode === 200 && webinarLinkRow && webinarLinkRow.product === 'hosted_webinar' && webinarLinkRow.status === 'paid_pending_verification' && !webinarLinkRow.event_id, JSON.stringify(webinarLinkRow));
  process.env.STRIPE_PAYMENT_LINK_HOSTED_WEBINAR = 'plink_webinar_expected';
  check('configured webinar plink id matches that link', paid.isHostedWebinarCheckout({ amount_total: 150000, currency: 'usd', payment_link: 'plink_webinar_expected', metadata: {} }) === true);
  check('configured webinar plink id ignores a different $1,500 link', paid.isHostedWebinarCheckout({ amount_total: 150000, currency: 'usd', payment_link: 'plink_other', metadata: {} }) === false);
  delete process.env.STRIPE_PAYMENT_LINK_HOSTED_WEBINAR;

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
  const webinarLink = paid.HOSTED_WEBINAR_PAYMENT_LINK;
  check('webinar pay URL lives in the same config object', paid.PAYMENT_LINKS.hosted_webinar.url === webinarLink && paid.PAYMENT_LINKS.hosted_webinar.amountCents === 150000);
  const webinarHits = [];
  function jsHitsWebinar(dir, found) {
    fs.readdirSync(dir).forEach(function (name) {
      if (name === 'node_modules' || name === 'dist' || name === 'transformerpath' || name === '.git') return;
      const p = dir + '/' + name;
      const st = fs.statSync(p);
      if (st.isDirectory()) jsHitsWebinar(p, found);
      else if (name.endsWith('.js') && fs.readFileSync(p, 'utf8').indexOf(webinarLink) >= 0) found.push(p);
    });
  }
  jsHitsWebinar('.', webinarHits);
  check('webinar payment link URL lives in that same constant', webinarHits.length === 1 && webinarHits[0] === './lib/paid-listings.js', webinarHits.join(','));
  check('pricing webinar pay button uses the constant', fs.readFileSync('pricing.html', 'utf8').indexOf('href="' + webinarLink + '"') >= 0 && fs.readFileSync('pricing.html', 'utf8').indexOf('Host a webinar — $1,500') >= 0 && fs.readFileSync('pricing.html', 'utf8').indexOf('not a live Stripe checkout') < 0);
  check('webinars page pay button uses the constant', fs.readFileSync('webinars.html', 'utf8').indexOf('href="' + webinarLink + '"') >= 0 && fs.readFileSync('webinars.html', 'utf8').indexOf('Host a webinar · from $1,500') >= 0);
  check('sponsor webinar pay button uses the constant', fs.readFileSync('sponsor.html', 'utf8').indexOf('href="' + webinarLink + '"') >= 0 && fs.readFileSync('sponsor.html', 'utf8').indexOf('id="hosted-webinar"') >= 0 && fs.readFileSync('sponsor.html', 'utf8').indexOf('Host a webinar — $1,500') >= 0);
  const commerceWebinar = commerce.sections.reduce(function (found, section) {
    return found || (section.products || []).filter(function (product) { return product.id === 'hosted_webinar'; })[0];
  }, null);
  check('commerce catalog stores the webinar payment link', commerceWebinar && commerceWebinar.price === 1500 && commerceWebinar.payment_link === webinarLink, JSON.stringify(commerceWebinar && { price: commerceWebinar.price, payment_link: commerceWebinar.payment_link }));
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
  const webinarReceipt = receipt.messages(webinarLinkRow);
  check('webinar receipt sends the buyer to the sponsor form', webinarReceipt.buyer && webinarReceipt.buyer.text.indexOf('/sponsor.html?paid=hosted_webinar#contact') >= 0 && webinarReceipt.buyer.text.indexOf('Hosted Webinar ($1,500)') >= 0);

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
          url: paid.FEATURED_EVENT_PAYMENT_LINK,
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
          url: paid.VERIFIED_MANUFACTURER_PAYMENT_LINK,
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
          url: paid.FEATURED_EXHIBITOR_PAYMENT_LINK,
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
        return {
          id: webinarLinkSession,
          payment_status: 'paid',
          amount_total: 150000,
          currency: 'usd',
          livemode: false,
          payment_link: 'plink_test_webinar',
          url: paid.HOSTED_WEBINAR_PAYMENT_LINK,
          metadata: {}
        };
      }
    };
  };
  const webinarAccess = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: webinarLinkSession })
  })).body);
  check('webinar payment link does not grant course access', webinarAccess.valid === false && webinarAccess.paid === true && webinarAccess.product === 'hosted_webinar' && webinarAccess.listing === 'paid_pending_verification' && !webinarAccess.entitlement_token, JSON.stringify(webinarAccess));

  const coursePay = require('../lib/course-payment');
  check('$299 amount alone is not Featured Event', paid.isFeaturedEventCheckout({ amount_total: 29900, currency: 'usd', payment_link: 'plink_job_featured', metadata: {} }) === false);
  check('$199 amount alone is not Featured Event', paid.isFeaturedEventCheckout({ amount_total: 19900, currency: 'usd', payment_link: 'plink_job_standard', metadata: {} }) === false);
  check('$199 amount alone is not a course', coursePay.classifyCourse({ amount_total: 19900, currency: 'usd', payment_link: 'plink_job_standard', metadata: {} }) === null);
  check('$299 amount alone is not Learning', coursePay.classifyCourse({ amount_total: 29900, currency: 'usd', payment_link: 'plink_job_featured', metadata: {} }) === null);
  check('learning metadata classifies without using the amount', coursePay.classifyCourse({ amount_total: 29900, metadata: { plan: 'learning' } }).tier === 'learner');
  check('learning Payment Link code classifies a $199 charge', coursePay.classifyCourse({ amount_total: 19900, url: 'https://buy.stripe.com/' + coursePay.COURSES.learning.code, metadata: {} }).product === 'learning');
  check('expanded Learning Payment Link classifies a completed $199 session', coursePay.classifyCourse({
    amount_total: 19900,
    url: null,
    metadata: {},
    payment_link: { id: 'plink_learn_live', object: 'payment_link', url: 'https://buy.stripe.com/' + coursePay.COURSES.learning.code }
  }).tier === 'learner');
  check('expanded Professional Payment Link classifies without the amount', coursePay.classifyCourse({
    amount_total: 19900,
    url: null,
    metadata: {},
    payment_link: { id: 'plink_pro_live', url: 'https://buy.stripe.com/' + coursePay.COURSES.professional.code }
  }).tier === 'professional');
  check('expanded Team Payment Link classifies without the amount', coursePay.classifyCourse({
    amount_total: 29900,
    url: null,
    metadata: {},
    payment_link: { id: 'plink_team_live', url: 'https://buy.stripe.com/' + coursePay.COURSES.team.code }
  }).tier === 'enterprise');
  check('expanded unknown Payment Link is not Learning', coursePay.classifyCourse({
    amount_total: 19900,
    url: null,
    metadata: {},
    payment_link: { id: 'plink_job_standard', url: 'https://buy.stripe.com/jobstandardnotacourse' }
  }) === null);
  check('expanded Featured Event link is not a course', coursePay.classifyCourse({
    amount_total: 29900,
    url: null,
    metadata: {},
    payment_link: { id: 'plink_featured_live', url: paid.FEATURED_EVENT_PAYMENT_LINK }
  }) === null);
  check('expanded Featured Event link still matches that product', paid.isFeaturedEventCheckout({
    amount_total: 34900,
    url: null,
    metadata: {},
    payment_link: { id: 'plink_featured_live', url: paid.FEATURED_EVENT_PAYMENT_LINK }
  }) === true);
  check('known learning plink id classifies without an env var', coursePay.classifyCourse({
    amount_total: 59900,
    metadata: {},
    payment_link: 'plink_1UQhha2YHcFlJstOHjvZv5V0'
  }).tier === 'learner');
  check('inactive yearly learning link does not classify', coursePay.classifyCourse({
    amount_total: 19900,
    metadata: {},
    payment_link: { id: 'plink_old_yearly', url: 'https://buy.stripe.com/4gMbIU2lO5hj1NC5DcfYY03' }
  }) === null);
  check('learning metadata does not become a listing', paid.listingProduct({
    amount_total: 19900,
    metadata: { product: 'learning' },
    payment_link: 'plink_1UQhha2YHcFlJstOHjvZv5V0'
  }) === null);
  check('engineering pro metadata classifies without the amount', coursePay.classifyCourse({
    amount_total: 19900,
    metadata: { product: 'engineering_pro' }
  }).plan === 'Engineering Pro' && coursePay.classifyCourse({
    amount_total: 19900,
    metadata: { product: 'engineering_pro' }
  }).tier === 'professional');
  check('engineering team metadata classifies without the amount', coursePay.classifyCourse({
    amount_total: 29900,
    metadata: { plan: 'Engineering Team' }
  }).tier === 'enterprise');
  const pricingPage = fs.readFileSync('pricing.html', 'utf8');
  check('pricing learning button is the one-time link', pricingPage.indexOf('href="' + paid.PAYMENT_LINKS.learning.url + '"') >= 0 && pricingPage.indexOf('4gMbIU2lO5hj1NC5DcfYY03') < 0 && pricingPage.indexOf('Unavailable — email us to unlock') < 0);
  check('pricing engineering pro button is the existing link', pricingPage.indexOf('href="' + paid.PAYMENT_LINKS.engineering_pro.url + '"') >= 0);
  check('pricing engineering team button is the existing link', pricingPage.indexOf('href="' + paid.PAYMENT_LINKS.engineering_team.url + '"') >= 0);
  check('pricing keeps the single-payment learning line', pricingPage.indexOf('Single payment · 12 months access · no auto-renewal') >= 0);
  ['pricing.html', 'intel-pro.html', 'verified.html', 'list-company.html'].forEach(function (file) {
    const html = fs.readFileSync(file, 'utf8');
    const uls = html.split('<ul');
    const soonInList = uls.slice(1).some(function (chunk) {
      const list = chunk.slice(0, chunk.indexOf('</ul>'));
      return list.indexOf('Coming soon') >= 0;
    });
    check(file + ' paid lists do not contain Coming soon', !soonInList && html.indexOf('On the roadmap (not included yet)') >= 0);
  });
  check('supplier and intel pages do not advertise an uncheckouted price',
    pricingPage.indexOf('$1,499') < 0 && pricingPage.indexOf('$49/mo') < 0 && pricingPage.indexOf('$49 / month') < 0
    && !/\$49(?!\d)/.test(fs.readFileSync('intel-pro.html', 'utf8'))
    && fs.readFileSync('verified.html', 'utf8').indexOf('$1,499') < 0
    && fs.readFileSync('verified.html', 'utf8').indexOf('$199') < 0);
  check('intel pro shows $499 for 12 months and no monthly figure', (function () {
    const intel = fs.readFileSync('intel-pro.html', 'utf8');
    const start = pricingPage.indexOf('>Intel Pro</h3>');
    const card = pricingPage.slice(start, pricingPage.indexOf('Enterprise / Procurement Team', start));
    const noMonthly = function (html) {
      return html.indexOf('$49/mo') < 0 && html.indexOf('$49 / month') < 0 && html.indexOf('$49 / mo') < 0
        && !/\$49(?!\d)/.test(html) && html.indexOf('588') < 0 && html.indexOf('billed monthly') < 0;
    };
    return start > 0 && card.indexOf('$499') >= 0 && card.indexOf('/ 12 months') >= 0
      && card.indexOf('mailto:hello@transformerpath.com?subject=Intel%20Pro') >= 0
      && card.indexOf('buy.stripe.com') < 0
      && intel.indexOf('$499') >= 0 && intel.indexOf('/ 12 months') >= 0
      && intel.indexOf('mailto:hello@transformerpath.com?subject=Intel%20Pro') >= 0
      && noMonthly(card) && noMonthly(intel);
  })());

  delete process.env.STRIPE_PAYMENT_LINK_LEARNING;
  process.env.STRIPE_PAYMENT_LINK_LEARNING = 'plink_learn_expected';
  check('configured learning plink id classifies that link', coursePay.classifyCourse({ amount_total: 19900, payment_link: 'plink_learn_expected', metadata: {} }).tier === 'learner');
  check('configured learning plink id ignores a different $199 link', coursePay.classifyCourse({ amount_total: 19900, payment_link: 'plink_job_standard', metadata: {} }) === null);
  delete process.env.STRIPE_PAYMENT_LINK_LEARNING;

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
  check('$199 amount alone does not grant Learning', learning.valid === false && learning.paid === true && learning.reason === 'unclassified' && !learning.entitlement_token, JSON.stringify(learning));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return { id: 'cs_test_job_299', payment_status: 'paid', amount_total: 29900, currency: 'usd', livemode: false, metadata: {}, payment_link: 'plink_job_featured' };
      }
    };
  };
  const jobFeatured = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: 'cs_test_job_299' })
  })).body);
  check('$299 amount alone does not grant Learning or Featured Event', jobFeatured.valid === false && jobFeatured.reason === 'unclassified' && jobFeatured.product !== 'featured_event' && jobFeatured.tier !== 'learner', JSON.stringify(jobFeatured));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return { id: 'cs_test_learn_meta', payment_status: 'paid', amount_total: 19900, livemode: false, metadata: { plan: 'learning' }, payment_link: 'plink_learn' };
      }
    };
  };
  const learningMeta = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: 'cs_test_learn_meta' })
  })).body);
  check('learning metadata still grants learner', learningMeta.valid === true && learningMeta.tier === 'learner' && !!learningMeta.entitlement_token, JSON.stringify({ valid: learningMeta.valid, tier: learningMeta.tier }));

  let expandedUrl = '';
  global.fetch = async function (url) {
    expandedUrl = String(url);
    return {
      ok: true,
      json: async function () {
        return {
          id: 'cs_test_learn_expanded',
          payment_status: 'paid',
          amount_total: 19900,
          livemode: false,
          metadata: {},
          url: null,
          payment_link: { id: 'plink_learn_live', object: 'payment_link', url: 'https://buy.stripe.com/' + coursePay.COURSES.learning.code }
        };
      }
    };
  };
  const learningExpanded = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: 'cs_test_learn_expanded' })
  })).body);
  check('verify-access expands the Payment Link', expandedUrl.indexOf('expand[]=payment_link') !== -1, expandedUrl);
  check('expanded Learning link grants learner', learningExpanded.valid === true && learningExpanded.tier === 'learner' && !!learningExpanded.entitlement_token, JSON.stringify({ valid: learningExpanded.valid, tier: learningExpanded.tier }));

  global.fetch = async function () {
    return {
      ok: true,
      json: async function () {
        return {
          id: 'cs_test_job_expanded',
          payment_status: 'paid',
          amount_total: 19900,
          livemode: false,
          metadata: {},
          url: null,
          payment_link: { id: 'plink_job_standard', object: 'payment_link', url: 'https://buy.stripe.com/jobstandardnotacourse' }
        };
      }
    };
  };
  const jobExpanded = JSON.parse((await verify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ session_id: 'cs_test_job_expanded' })
  })).body);
  check('expanded $199 job link does not grant Learning', jobExpanded.valid === false && jobExpanded.paid === true && jobExpanded.reason === 'unclassified' && !jobExpanded.entitlement_token, JSON.stringify(jobExpanded));

  global.fetch = savedFetch;
  if (savedStripe === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = savedStripe;

  const confirm = require('../functions/confirm-listing-payment');
  delete process.env.STRIPE_SECRET_KEY;
  let stripeCalls = 0;
  global.fetch = function () { stripeCalls++; return Promise.reject(new Error('stripe must not be called')); };
  let confirmRes = await confirm.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_fake', product: 'verified_manufacturer', paid: true }) });
  let confirmBody = JSON.parse(confirmRes.body);
  check('missing stripe key does not confirm a session_id', confirmRes.statusCode === 200 && confirmBody.configured === false && confirmBody.paid === false && stripeCalls === 0, JSON.stringify(confirmBody));

  process.env.STRIPE_SECRET_KEY = 'sk_test_confirm_only';
  global.fetch = function (url) {
    stripeCalls++;
    const id = String(url).split('/').pop().split('?')[0];
    const sessions = {
      cs_test_unpaid: { payment_status: 'unpaid', metadata: { product: 'verified_manufacturer' } },
      cs_test_wrong: { payment_status: 'paid', metadata: { product: 'featured_event' } },
      cs_test_paid_mfr: { payment_status: 'paid', metadata: { product: 'verified_manufacturer' } },
      cs_test_paid_webinar: { payment_status: 'paid', metadata: { product: 'hosted_webinar' } },
      cs_test_course: { payment_status: 'paid', amount_total: 19900, currency: 'usd', metadata: { plan: 'learning' } }
    };
    if (!sessions[id]) return Promise.resolve({ ok: false, json: async function () { return { error: 'missing' }; } });
    return Promise.resolve({ ok: true, json: async function () { return sessions[id]; } });
  };
  confirmRes = await confirm.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_unpaid', product: 'verified_manufacturer' }) });
  confirmBody = JSON.parse(confirmRes.body);
  check('unpaid session is not payment received', confirmBody.configured === true && confirmBody.paid === false, JSON.stringify(confirmBody));
  confirmRes = await confirm.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_wrong', product: 'verified_manufacturer' }) });
  confirmBody = JSON.parse(confirmRes.body);
  check('paid session for a different product is not confirmed', confirmBody.paid === false && confirmBody.product === 'featured_event', JSON.stringify(confirmBody));
  confirmRes = await confirm.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_course', product: 'featured_exhibitor' }) });
  confirmBody = JSON.parse(confirmRes.body);
  check('course payment does not confirm a listing', confirmBody.paid === false, JSON.stringify(confirmBody));
  confirmRes = await confirm.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_paid_mfr', product: 'verified_manufacturer' }) });
  confirmBody = JSON.parse(confirmRes.body);
  check('paid matching listing session is confirmed', confirmBody.configured === true && confirmBody.paid === true && confirmBody.product === 'verified_manufacturer', JSON.stringify(confirmBody));
  confirmRes = await confirm.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_paid_webinar', product: 'hosted_webinar' }) });
  confirmBody = JSON.parse(confirmRes.body);
  check('paid hosted webinar session is confirmed only for that product', confirmBody.paid === true && confirmBody.product === 'hosted_webinar', JSON.stringify(confirmBody));
  confirmRes = await confirm.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_paid_webinar', product: 'featured_exhibitor' }) });
  confirmBody = JSON.parse(confirmRes.body);
  check('paid webinar session does not confirm an exhibitor return', confirmBody.paid === false && confirmBody.product === 'hosted_webinar', JSON.stringify(confirmBody));
  confirmRes = await confirm.handler({ httpMethod: 'GET' });
  check('confirm requires a product', confirmRes.statusCode === 400 && JSON.parse(confirmRes.body).paid === false);

  const vm = require('vm');
  const clientSrc = fs.readFileSync('listing-payment.js', 'utf8');
  async function banner(search, payload) {
    const note = { style: { display: 'none' }, textContent: 'Payment received. should be replaced' };
    const hidden = { value: '' };
    const sandbox = {
      URLSearchParams: URLSearchParams,
      location: { search: search },
      document: { getElementById: function (id) { return id === 'claimPaidBanner' ? note : hidden; } },
      fetch: function () {
        return Promise.resolve({ json: function () { return Promise.resolve(payload); } });
      }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(clientSrc, sandbox);
    sandbox.window.tpListingPayment.confirm({
      product: 'verified_manufacturer',
      noteId: 'claimPaidBanner',
      sessionFieldId: 'claimPaymentSession',
      paidText: 'Payment received. Submit your company details in the form below.'
    });
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    return note.textContent;
  }
  const neutral = 'If you completed payment, submit the form below; we confirm payment before review.';
  check('client keeps neutral text when stripe is not configured', await banner('?paid=verified_manufacturer&session_id=cs_test_fake', { configured: false, paid: false, product: null }) === neutral);
  check('client keeps neutral text for an unpaid session', await banner('?paid=verified_manufacturer&session_id=cs_test_fake', { configured: true, paid: false, product: null }) === neutral);
  check('client says payment received only after a matching confirmation', await banner('?paid=verified_manufacturer&session_id=cs_test_paid_mfr', { configured: true, paid: true, product: 'verified_manufacturer' }) === 'Payment received. Submit your company details in the form below.');
  check('client ignores a paid flag for another product', await banner('?paid=verified_manufacturer&session_id=cs_test_fake', { configured: true, paid: true, product: 'featured_event' }) === neutral);

  const claimPage = fs.readFileSync('claim-profile.html', 'utf8');
  const claimBanner = claimPage.slice(claimPage.indexOf('id="claimPaidBanner"'), claimPage.indexOf('id="claimPaidBanner"') + 500);
  check('claim banner default copy is neutral', claimBanner.indexOf(neutral) >= 0 && claimBanner.indexOf('Payment received') < 0);
  check('claim page asks confirm-listing-payment', claimPage.indexOf('listing-payment.js') >= 0);
  check('events page does not treat the query as payment received', fs.readFileSync('events.html', 'utf8').indexOf("note.textContent = pending") < 0 && fs.readFileSync('events.html', 'utf8').indexOf('listing-payment.js') >= 0);
  check('sponsor page asks confirm-listing-payment', fs.readFileSync('sponsor.html', 'utf8').indexOf('confirm-listing-payment') < 0 && fs.readFileSync('sponsor.html', 'utf8').indexOf('listing-payment.js') >= 0 && fs.readFileSync('sponsor.html', 'utf8').indexOf("note.textContent=pending") < 0 && fs.readFileSync('sponsor.html', 'utf8').indexOf("product:'hosted_webinar'") >= 0);
  check('pricing listing return uses confirm-listing-payment', fs.readFileSync('pricing.html', 'utf8').indexOf('confirm-listing-payment') >= 0);
  ['claim-profile.html', 'events.html', 'sponsor.html'].forEach(function (rel) {
    const page = fs.readFileSync(rel, 'utf8');
    check(rel + ' shows the return banner after deferred scripts', page.indexOf('DOMContentLoaded') >= 0 && page.indexOf('tpListingPayment.confirm') >= 0);
  });

  delete process.env.STRIPE_SECRET_KEY;
  global.fetch = savedFetch;
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
