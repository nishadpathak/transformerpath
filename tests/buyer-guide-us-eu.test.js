/* US/EU grid-equipment buyer note: public page, Payment Link, and PDF download. */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const guide = require('../lib/buyer-guide-us-eu');
const download = require('../functions/csv-download');
const paid = require('../lib/paid-listings');
const course = require('../lib/course-payment');

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log('  PASS  ' + name);
  else {
    failed++;
    console.error('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

const page = fs.readFileSync('guides/us-eu-grid-equipment/index.html', 'utf8');
const link = paid.PAYMENT_LINKS.buyer_guide_us_eu;

check('page shows the live $19 Payment Link', page.indexOf(link.url) !== -1 && page.indexOf('data-product="buyer_guide_us_eu"') !== -1 && page.indexOf('id="guide-buy"') !== -1);
check('buy control is not hidden', /id="guide-buy"[^>]*hidden/.test(page) === false);
check('page is not legal advice and names the contact', page.indexOf('This is not legal advice.') !== -1 && page.indexOf('hello@transformerpath.com') !== -1);
check('page states the 1 November 2026 date was not confirmed', page.indexOf('1 November 2026') !== -1 && /was not confirmed|do not state that date/.test(page));
check('page names substation and instrument transformers and 69 kV', page.indexOf('substation transformers') !== -1 && page.indexOf('instrument transformers') !== -1 && page.indexOf('69 kV') !== -1);
check('page says the US order is not a blanket ban', /not a blanket ban/.test(page));
check('every official source URL is on the page', guide.SOURCES.every(function (source) { return page.indexOf(source.url) !== -1; }));
check('page has no Dubai, UAE, or personal-service wording', page.indexOf('Dubai') === -1 && page.indexOf('UAE') === -1 && /webinar|masterclass/i.test(page) === false);
check('tools hub links the summary', fs.readFileSync('tools.html', 'utf8').indexOf('/guides/us-eu-grid-equipment/') !== -1);
check('publish copies the guides directory', (function () {
  const src = fs.readFileSync('build-dist.js', 'utf8');
  const dirs = src.match(/const DIRS = \[([\s\S]*?)\];/);
  return !!(dirs && dirs[1].indexOf("'guides'") !== -1);
})());
check('canonical is the public summary', page.indexOf('https://transformerpath.com/guides/us-eu-grid-equipment/') !== -1);

check('$19 alone is not this guide', paid.listingProduct({ amount_total: 1900, metadata: {} }) == null);
check('metadata product=buyer_guide_us_eu is the guide', paid.listingProduct({ metadata: { product: 'buyer_guide_us_eu' }, amount_total: 1900 }) === 'buyer_guide_us_eu');
check('the live Payment Link code is the guide', paid.listingProduct({
  metadata: {},
  payment_link: { url: link.url }
}) === 'buyer_guide_us_eu');
check('the Stripe product id is the guide', paid.listingProduct({
  metadata: {},
  line_items: { data: [{ price: { id: 'price_guide', product: { id: link.productId, metadata: {} } } }] }
}) === 'buyer_guide_us_eu');
check('a guide checkout is not a course', course.classifyCourse({
  metadata: { product: 'buyer_guide_us_eu' },
  amount_total: 1900,
  payment_link: { url: link.url }
}) == null);
check('success path is the download page for this product', link.successPath === '/data/download?session_id={CHECKOUT_SESSION_ID}&product=buyer_guide_us_eu');
check('amount is $19', link.amountCents === 1900);

const bytes = guide.buildPdf();
const text = bytes.toString('latin1');
check('PDF starts with the PDF header', bytes.slice(0, 5).toString() === '%PDF-');
check('PDF carries the disclaimer, the contact, and the unconfirmed date', text.indexOf('This is not legal advice') !== -1 && text.indexOf('hello@transformerpath.com') !== -1 && text.indexOf('1 November 2026') !== -1 && text.indexOf('was not in an official text') !== -1);
check('PDF cites the order and does not invent a country list', text.indexOf('91 FR 55995') !== -1 && text.indexOf('does not invent that list') !== -1);
guide.SOURCES.forEach(function (source) {
  const host = source.url.replace(/^https:\/\//, '').split('/')[0];
  check('PDF names ' + host, text.indexOf(host) !== -1);
});

const SECRET = 'sk_test_guide_do_not_print';
const savedSecret = process.env.STRIPE_SECRET_KEY;
const savedFetch = global.fetch;
function sessionBody(product, status) {
  return {
    id: 'cs_test_guide',
    payment_status: status || 'paid',
    metadata: { product: product },
    line_items: { data: [] },
    payment_link: null
  };
}
function install(body, ok) {
  global.fetch = async function () {
    return { ok: ok !== false, status: ok === false ? 404 : 200, json: async function () { return body; } };
  };
}

(async function () {
  process.env.STRIPE_SECRET_KEY = SECRET;
  install(sessionBody('buyer_guide_us_eu', 'paid'));
  const paidHtml = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { session_id: 'cs_test_guide', product: 'buyer_guide_us_eu' }
  });
  check('paid session returns HTML', paidHtml.statusCode === 200 && String(paidHtml.headers['Content-Type']).indexOf('text/html') === 0);
  check('paid page confirms the guide and hides the secret', paidHtml.body.indexOf('id="guide-paid"') !== -1 && paidHtml.body.indexOf(SECRET) === -1 && paidHtml.body.indexOf('buy.stripe.com') === -1);
  const href = (paidHtml.body.match(/href="(\/data\/download\?dl=buyer_guide_us_eu[^"]+)"/) || [])[1];
  check('PDF link is signed', !!href && href.indexOf('sig=') !== -1);
  const params = {};
  href.replace('/data/download?', '').split('&amp;').join('&').split('&').forEach(function (pair) {
    const bits = pair.split('=');
    params[decodeURIComponent(bits[0])] = decodeURIComponent(bits.slice(1).join('='));
  });
  global.fetch = async function () { throw new Error('signed download must not call Stripe'); };
  const file = await download.handler({ httpMethod: 'GET', queryStringParameters: params });
  const raw = Buffer.from(file.body, 'base64');
  check('signed link is the guide PDF', file.statusCode === 200 && file.isBase64Encoded === true && raw.slice(0, 5).toString() === '%PDF-' && String(file.headers['Content-Disposition']).indexOf(guide.FILENAME) !== -1);

  install(sessionBody('dga_report', 'paid'));
  const wrong = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'buyer_guide_us_eu', session_id: 'cs_test_guide' }
  });
  check('a different product cannot fetch the guide', wrong.body.indexOf('id="guide-verify-failed"') !== -1 && wrong.body.indexOf('buyer_guide_us_eu') !== -1);

  delete process.env.STRIPE_SECRET_KEY;
  global.fetch = async function () { throw new Error('no secret'); };
  const open = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'buyer_guide_us_eu' }
  });
  check('no payment still recognises the product', open.statusCode === 200 && open.body.indexOf('id="guide-verify-failed"') !== -1 && open.body.indexOf('data-product="buyer_guide_us_eu"') !== -1 && open.body.indexOf('%PDF-') === -1);

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_guide_unit';
  delete require.cache[require.resolve('../functions/stripe-webhook')];
  const wh = require('../functions/stripe-webhook');
  function sign(payload, secret) {
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
    return 't=' + t + ',v1=' + v1;
  }
  const payload = JSON.stringify({
    id: 'evt_buyer_guide',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_guide_hook', metadata: { product: 'buyer_guide_us_eu' }, amount_total: 1900 } }
  });
  const hook = await wh.handler({ httpMethod: 'POST', headers: { 'stripe-signature': sign(payload, 'whsec_guide_unit') }, body: payload });
  const hookBody = JSON.parse(hook.body);
  check('webhook acknowledges the guide without Supabase', hook.statusCode === 200 && hookBody.digital_product === 'buyer_guide_us_eu' && hookBody.stored === false, hook.body);

  if (savedSecret == null) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedSecret;
  global.fetch = savedFetch;
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('buyer guide ok');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
