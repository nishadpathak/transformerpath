/* DGA interpreter, paid PDF, and the webhook path when Supabase is absent. */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const dga = require('../lib/dga-interpret');
const pdf = require('../lib/dga-pdf');
const download = require('../functions/csv-download');
const paid = require('../lib/paid-listings');
const course = require('../lib/course-payment');
const inject = require('../adsense-inject');

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log('  PASS  ' + name);
  else {
    failed++;
    console.error('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

function gases(over) {
  return Object.assign({
    h2: 10, ch4: 10, c2h6: 10, c2h4: 10, c2h2: 0, co: 100, co2: 1000,
    o2n2: 'le02', age: 'unknown'
  }, over || {});
}

function roughZone(p) {
  if (p.ch4 >= 98) return 'PD';
  if (p.c2h4 <= 23 && p.c2h2 >= 13) return 'D1';
  if (p.c2h2 <= 15 && p.c2h4 >= 50) return 'T3';
  if (p.c2h2 <= 4 && p.c2h4 > 20 && p.c2h4 < 50) return 'T2';
  if (p.c2h2 <= 4 && p.c2h4 <= 20 && p.ch4 < 98) return 'T1';
  return null;
}

[
  { ch4: 99, c2h4: 0.5, c2h2: 0.5 },
  { ch4: 80, c2h4: 16, c2h2: 4 },
  { ch4: 55, c2h4: 41, c2h2: 4 },
  { ch4: 10, c2h4: 85, c2h2: 5 },
  { ch4: 20, c2h4: 10, c2h2: 70 }
].forEach(function (p) {
  const expect = roughZone(p);
  check('Duval ' + expect + ' at ' + p.ch4 + '/' + p.c2h4 + '/' + p.c2h2, dga.duvalZone(p.ch4, p.c2h4, p.c2h2) === expect);
});

const thermal = dga.interpret(gases({ h2: 20, ch4: 80, c2h6: 10, c2h4: 100, c2h2: 0.5, co: 200, co2: 2000 }));
check('Rogers thermal above 700 C', thermal.rogers.codes.c2h2_c2h4 === 0 && thermal.rogers.codes.ch4_h2 === 2 && thermal.rogers.codes.c2h4_c2h6 === 2 && /above 700/.test(thermal.rogers.text));
check('that sample is Duval T3', thermal.duval.zone === 'T3');

const normal = dga.interpret(gases({ h2: 40, ch4: 20, c2h6: 15, c2h4: 8, c2h2: 0, co: 200, co2: 2000 }));
check('Rogers normal-ageing case', normal.rogers.codes.ch4_h2 === 0 && normal.rogers.codes.c2h2_c2h4 === 0 && normal.rogers.codes.c2h4_c2h6 === 0 && /normal-ageing/.test(normal.rogers.text));

const quiet = dga.interpret(gases());
check('low gases are IEEE status 1', quiet.ieee.level === 1);
check('acetylene at the Table 1 norm stays status 1', dga.interpret(gases({ c2h2: 1 })).ieee.level === 1);
check('acetylene between the tables is status 2', dga.interpret(gases({ c2h2: 1.5 })).ieee.level === 2);
check('acetylene above Table 2 is status 3', dga.interpret(gases({ c2h2: 3 })).ieee.level === 3);
check('status 1 does not claim a rate', /Tables 3 and 4/.test(quiet.ieee.note) && /one sample/.test(quiet.ieee.note));

const arcing = dga.interpret(gases({ h2: 40, c2h2: 10, ch4: 20, c2h6: 10, c2h4: 15, co: 100, co2: 1000 }));
check('acetylene above its norm is the key gas', arcing.keyGas.gas === 'C2H2' && /arcing/.test(arcing.keyGas.summary));
const paper = dga.interpret(gases({ co: 5000, h2: 20, ch4: 20, c2h6: 10, c2h4: 10, c2h2: 0, co2: 4000 }));
check('carbon monoxide above its norm is the cellulose key gas', paper.keyGas.gas === 'CO' && /cellulose/.test(paper.keyGas.summary));
check('no key gas when every gas is inside Table 1', quiet.keyGas.gas === '' && /does not name a fault/.test(quiet.keyGas.summary));

check('zero triangle is not plotted', dga.interpret(gases({ ch4: 0, c2h4: 0, c2h2: 0 })).duval.applicable === false);
check('missing gas is an error', !!dga.interpret({ h2: 1 }).error);
check('negative gas is an error', !!dga.interpret(gases({ h2: -1 })).error);
check('disclaimer is on every reading', quiet.disclaimer === 'This is not a substitute for expert diagnosis.' && quiet.narrative.indexOf(quiet.disclaimer) !== -1);

const bytes = pdf.buildPdf(quiet.lines);
check('PDF starts with the PDF header', bytes.slice(0, 5).toString() === '%PDF-');
check('PDF contains the disclaimer and the contact address', bytes.toString('latin1').indexOf('not a substitute for expert diagnosis') !== -1 && bytes.toString('latin1').indexOf('hello@transformerpath.com') !== -1);

const page = fs.readFileSync('tools/dga/index.html', 'utf8');
check('page links the live $19 Payment Link', page.indexOf('https://buy.stripe.com/bJe7sE4tWh01ak8c1AfYY0V') !== -1 && page.indexOf('data-product="dga_report"') !== -1);
check('page names the seven gases', ['H2', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'CO', 'CO2'].every(function (gas) { return page.indexOf(gas) !== -1; }));
check('page cites the four methods and the disclaimer', /Duval Triangle 1/.test(page) && /Rogers ratios/.test(page) && /IEEE C57\.104-2019/.test(page) && /Annex D\.1/.test(page) && /IEC 60599/.test(page) && page.indexOf('This is not a substitute for expert diagnosis.') !== -1);
check('page keeps the gas values for the download', page.indexOf('tp-dga-inputs') !== -1 && page.indexOf('localStorage') !== -1 && page.indexOf('/data/download?product=dga_report') !== -1);
check('page has no other brand and no CSV product', page.indexOf('ELIN') === -1 && page.indexOf('csv_') === -1 && page.indexOf('buy.stripe.com/') === page.lastIndexOf('buy.stripe.com/') && page.indexOf('https://buy.stripe.com/bJe7sE4tWh01ak8c1AfYY0V') !== -1);
check('tools hub links the interpreter', fs.readFileSync('tools.html', 'utf8').indexOf('/tools/dga/') !== -1);

const stamped = inject.stampHtml(page, 'tools/dga/index.html');
check('AdSense loader is stamped once', stamped.split(inject.cfg.LOADER).length === 2);
check('DGA page gets one in-content slot below the hero', inject.wantsInContentSlot('tools/dga/index.html') === true && stamped.split('data-tp-ad="in-content"').length === 2 && stamped.indexOf('data-tp-ad="in-content"') > stamped.indexOf('</section>'));

check('$19 alone is not a DGA purchase', paid.listingProduct({ amount_total: 1900, metadata: {} }) == null);
check('metadata product=dga_report is the DGA PDF', paid.listingProduct({ metadata: { product: 'dga_report' }, amount_total: 1900 }) === 'dga_report');
check('the live Payment Link code is the DGA PDF', paid.listingProduct({
  metadata: {},
  payment_link: { url: 'https://buy.stripe.com/bJe7sE4tWh01ak8c1AfYY0V' }
}) === 'dga_report');
check('a DGA checkout is not a course', course.classifyCourse({
  metadata: { product: 'dga_report' },
  amount_total: 1900,
  payment_link: { url: paid.PAYMENT_LINKS.dga_report.url }
}) == null);
check('DGA success path is the download page', paid.PAYMENT_LINKS.dga_report.successPath.indexOf('/data/download?product=dga_report') === 0);

const SECRET = 'sk_test_dga_do_not_print';
const savedSecret = process.env.STRIPE_SECRET_KEY;
const savedFetch = global.fetch;
function sessionBody(product, status) {
  return {
    id: 'cs_test_dga',
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
  install(sessionBody('dga_report', 'paid'));
  const paidHtml = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: {
      product: 'dga_report', session_id: 'cs_test_dga',
      h2: '20', ch4: '80', c2h6: '10', c2h4: '100', c2h2: '0.5', co: '200', co2: '2000'
    }
  });
  check('paid session returns HTML, not a 500', paidHtml.statusCode === 200 && String(paidHtml.headers['Content-Type']).indexOf('text/html') === 0);
  check('paid page confirms payment and does not offer a CSV', paidHtml.body.indexOf('id="dga-paid"') !== -1 && paidHtml.body.indexOf('csv') === -1 && paidHtml.body.indexOf(SECRET) === -1);
  const href = (paidHtml.body.match(/href="(\/data\/download\?dl=dga_report[^"]+)"/) || [])[1];
  check('PDF link is signed', !!href && href.indexOf('sig=') !== -1);
  const params = {};
  href.replace('/data/download?', '').split('&amp;').join('&').split('&').forEach(function (pair) {
    const bits = pair.split('=');
    params[decodeURIComponent(bits[0])] = decodeURIComponent(bits.slice(1).join('='));
  });
  global.fetch = async function () { throw new Error('signed download must not call Stripe'); };
  const file = await download.handler({ httpMethod: 'GET', queryStringParameters: params });
  const raw = Buffer.from(file.body, 'base64');
  check('signed link is a PDF and skips Stripe', file.statusCode === 200 && file.isBase64Encoded === true && raw.slice(0, 5).toString() === '%PDF-' && String(file.headers['Content-Type']).indexOf('application/pdf') === 0);
  check('PDF names the thermal reading', raw.toString('latin1').indexOf('Thermal fault above 700 C') !== -1);
  const tampered = Object.assign({}, params, { h2: '99999' });
  const bad = await download.handler({ httpMethod: 'GET', queryStringParameters: tampered });
  check('a changed gas value fails the signature', bad.body.indexOf("couldn't verify") !== -1 && !bad.headers['Content-Disposition']);

  install(sessionBody('featured_listing', 'paid'));
  const wrong = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'dga_report', session_id: 'cs_test_dga', h2: '1', ch4: '1', c2h6: '1', c2h4: '1', c2h2: '0', co: '1', co2: '1' }
  });
  check('a different product cannot fetch the PDF', wrong.body.indexOf("couldn't verify") !== -1);

  delete process.env.STRIPE_SECRET_KEY;
  global.fetch = async function () { throw new Error('no secret'); };
  const open = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'dga_report', session_id: 'cs_test_dga' }
  });
  check('missing Stripe secret is a 200 failure page', open.statusCode === 200 && open.body.indexOf("couldn't verify") !== -1);

  const empty = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'dga_report', session_id: 'cs_test_dga_local' }
  });
  process.env.STRIPE_SECRET_KEY = SECRET;
  install(sessionBody('dga_report', 'paid'));
  const waiting = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'dga_report', session_id: 'cs_test_dga' }
  });
  check('paid page without gases reads localStorage', waiting.statusCode === 200 && waiting.body.indexOf('localStorage') !== -1 && waiting.body.indexOf('tp-dga-inputs') !== -1);
  check('unconfigured call above did not throw', empty.statusCode === 200);

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dga_unit';
  delete require.cache[require.resolve('../functions/stripe-webhook')];
  const wh = require('../functions/stripe-webhook');
  function sign(payload, secret) {
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
    return 't=' + t + ',v1=' + v1;
  }
  async function post(event) {
    const payload = JSON.stringify(event);
    return wh.handler({ httpMethod: 'POST', headers: { 'stripe-signature': sign(payload, 'whsec_dga_unit') }, body: payload });
  }
  const hook = await post({
    id: 'evt_dga_report',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_dga_hook', metadata: { product: 'dga_report' }, amount_total: 1900 } }
  });
  const hookBody = JSON.parse(hook.body);
  check('DGA webhook does not 500 without Supabase', hook.statusCode === 200 && hookBody.digital_product === 'dga_report' && hookBody.stored === false, hook.body);
  const linkHook = await post({
    id: 'evt_dga_link',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_dga_link', metadata: {}, payment_link: { url: paid.PAYMENT_LINKS.dga_report.url }, amount_total: 1900 } }
  });
  check('Payment Link code is acknowledged', linkHook.statusCode === 200 && JSON.parse(linkHook.body).digital_product === 'dga_report');

  const claim = fs.readFileSync('claim.html', 'utf8');
  const scripts = claim.match(/<script>([\s\S]*?)<\/script>/g) || [];
  let claimScript = '';
  scripts.forEach(function (block) {
    if (block.indexOf('confirm-listing-payment') !== -1) claimScript = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
  });
  async function claimReturn(search, verifyBody, confirmBody) {
    const note = { textContent: 'Checking this checkout with Stripe.' };
    const link = { hidden: true, href: '' };
    const calls = [];
    let replaced = '';
    const sandbox = {
      URLSearchParams: URLSearchParams,
      location: { search: search, hash: '', replace: function (url) { replaced = url; } },
      document: { getElementById: function (id) { return id === 'claimSetupNote' ? note : (id === 'claimNext' ? link : null); } },
      fetch: function (url, opts) {
        calls.push({ url: String(url), body: opts && opts.body });
        const payload = String(url).indexOf('confirm-listing-payment') !== -1 ? confirmBody : verifyBody;
        return Promise.resolve({ json: function () { return Promise.resolve(payload); } });
      }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(claimScript, sandbox);
    await new Promise(function (resolve) { setTimeout(resolve, 20); });
    return { note: note, link: link, calls: calls, replaced: replaced };
  }
  const listing = await claimReturn('?session_id=cs_test_featured_listing', { paid: true, product: 'featured_listing' }, { configured: true, paid: true, product: 'featured_listing' });
  check('a featured listing still uses the listing sentence', listing.note.textContent === "Payment received. We'll set up your listing within 2 business days via hello@transformerpath.com." && listing.link.hidden === true);
  const dgaClaim = await claimReturn('?product=dga_report&session_id=cs_test_dga', { paid: true, product: 'dga_report' }, { configured: true, paid: true, product: 'dga_report' });
  check('claim shows the download only after Stripe agrees', dgaClaim.link.hidden === false && dgaClaim.link.href.indexOf('product=dga_report') !== -1 && dgaClaim.link.href.indexOf('session_id=cs_test_dga') !== -1 && dgaClaim.note.textContent.indexOf('Payment received') === 0);
  const denied = await claimReturn('?product=dga_report&session_id=cs_test_dga', { paid: false, product: null }, null);
  check('an unconfirmed DGA return hides the download', denied.link.hidden === true && denied.note.textContent.indexOf('Stripe has not confirmed') !== -1);
  const noSession = await claimReturn('?product=dga_report', null, null);
  check('DGA claim without a session does not pretend it was paid', noSession.replaced === '' && noSession.note.textContent.indexOf('Payment received') === -1);

  process.env.STRIPE_SECRET_KEY = savedSecret;
  global.fetch = savedFetch;
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nDGA interpreter tests passed');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
