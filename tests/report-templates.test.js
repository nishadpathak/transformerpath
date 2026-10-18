/* Blank test-report templates, paid download, and the webhook without Supabase. */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const reports = require('../lib/report-templates');
const xlsx = require('../lib/xlsx-workbook');
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

const KEYS = ['ratio', 'winding_resistance', 'insulation_resistance', 'tan_delta', 'sfra', 'dga_sampling', 'commissioning_checklist'];
check('seven original templates', reports.TEMPLATES.length === 7 && KEYS.every(function (key) { return !!reports.BY_KEY[key]; }));

KEYS.forEach(function (key) {
  const built = reports.buildTemplate(key);
  const files = xlsx.unzipStore(built.bytes);
  const sheet = files['xl/worksheets/sheet1.xml'].toString('utf8');
  check(key + ' is an xlsx workbook', built.bytes.slice(0, 2).toString() === 'PK' && !!files['xl/workbook.xml'] && !!sheet);
  built.template.columns.forEach(function (col) {
    check(key + ' column ' + col, sheet.indexOf(col) !== -1);
  });
  check(key + ' names the public test list', sheet.indexOf(built.template.list) !== -1);
});

const checklist = reports.rowsFor(reports.BY_KEY.commissioning_checklist);
const items = checklist.map(function (row) { return row[0]; });
check('checklist names ratio, winding resistance, tan delta, SFRA, and DGA',
  items.indexOf('Voltage ratio and phase displacement') !== -1 &&
  items.indexOf('Winding resistance') !== -1 &&
  items.indexOf('Capacitance and dissipation factor') !== -1 &&
  items.indexOf('Sweep frequency response baseline') !== -1 &&
  items.indexOf('Dissolved-gas sample') !== -1);
check('workbook does not claim a standard limit', reports.NOTE.indexOf('does not apply a pass or fail limit') !== -1);

const zip = reports.buildBundleZip();
const zipped = xlsx.unzipStore(zip.bytes);
check('bundle zip holds seven workbooks', reports.TEMPLATES.every(function (item) {
  return zipped[item.filename] && zipped[item.filename].slice(0, 2).toString() === 'PK';
}));

const page = fs.readFileSync('templates/index.html', 'utf8');
check('page previews every template', reports.TEMPLATES.every(function (item) {
  return page.indexOf('id="' + item.key + '"') !== -1 && page.indexOf(item.title) !== -1 && item.columns.every(function (col) { return page.indexOf(col) !== -1; });
}));
check('page links both live Payment Links',
  page.indexOf('https://buy.stripe.com/eVqeV67G839beAo7LkfYY0S') !== -1 &&
  page.indexOf('data-product="report_template"') !== -1 &&
  page.indexOf('https://buy.stripe.com/aFa00ce4w4dffEsfdMfYY0T') !== -1 &&
  page.indexOf('data-product="template_bundle"') !== -1);
check('page has no CSV product and no other brand', page.indexOf('csv_') === -1 && page.indexOf('ELIN') === -1);
check('tools hub links the templates', fs.readFileSync('tools.html', 'utf8').indexOf('/templates/') !== -1);
check('no workbook is published in the templates directory', fs.readdirSync('templates').every(function (name) { return !/\.xlsx$|\.zip$/i.test(name); }));

check('$49 alone is not a template purchase', paid.listingProduct({ amount_total: 4900, metadata: {} }) == null);
check('$149 alone is not the bundle', paid.listingProduct({ amount_total: 14900, metadata: {} }) == null);
check('metadata product=report_template is one template', paid.listingProduct({ metadata: { product: 'report_template' }, amount_total: 4900 }) === 'report_template');
check('the $49 Payment Link code is one template', paid.listingProduct({
  metadata: {},
  payment_link: { url: paid.PAYMENT_LINKS.report_template.url }
}) === 'report_template');
check('the $149 Payment Link code is the bundle', paid.listingProduct({
  metadata: {},
  payment_link: { url: paid.PAYMENT_LINKS.template_bundle.url }
}) === 'template_bundle');
check('a template checkout is not a course', course.classifyCourse({
  metadata: { product: 'report_template' },
  amount_total: 4900,
  payment_link: { url: paid.PAYMENT_LINKS.report_template.url }
}) == null);
check('template success path is the download page', paid.PAYMENT_LINKS.report_template.successPath.indexOf('/data/download?product=report_template') === 0);
check('bundle success path is the download page', paid.PAYMENT_LINKS.template_bundle.successPath.indexOf('/data/download?product=template_bundle') === 0);

const SECRET = 'sk_test_templates';
const savedSecret = process.env.STRIPE_SECRET_KEY;
const savedFetch = global.fetch;
function sessionBody(product, status) {
  return {
    id: 'cs_test_tpl',
    payment_status: status,
    metadata: { product: product },
    amount_total: product === 'template_bundle' ? 14900 : 4900
  };
}
function install(body) {
  global.fetch = async function () {
    return { ok: true, status: 200, json: async function () { return body; } };
  };
}

(async function () {
  process.env.STRIPE_SECRET_KEY = SECRET;
  install(sessionBody('report_template', 'paid'));
  const picker = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'report_template', session_id: 'cs_test_tpl' }
  });
  check('paid $49 page is a picker, not a 500', picker.statusCode === 200 && picker.body.indexOf('id="template-pick"') !== -1 && picker.body.indexOf('csv') === -1);
  check('picker lists every template', KEYS.every(function (key) { return picker.body.indexOf(key) !== -1; }));

  const chosen = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'report_template', session_id: 'cs_test_tpl', template: 'ratio' }
  });
  const href = (chosen.body.match(/href="(\/data\/download\?dl=report_template[^"]+)"/) || [])[1];
  check('chosen template link is signed', !!href && href.indexOf('template=ratio') !== -1 && href.indexOf('sig=') !== -1);
  const params = {};
  href.replace('/data/download?', '').split('&amp;').join('&').split('&').forEach(function (pair) {
    const bits = pair.split('=');
    params[decodeURIComponent(bits[0])] = decodeURIComponent(bits.slice(1).join('='));
  });
  global.fetch = async function () { throw new Error('signed download must not call Stripe'); };
  const file = await download.handler({ httpMethod: 'GET', queryStringParameters: params });
  const raw = Buffer.from(file.body, 'base64');
  check('signed link is the ratio workbook', file.statusCode === 200 && file.isBase64Encoded === true && raw.slice(0, 2).toString() === 'PK' && String(file.headers['Content-Disposition']).indexOf('transformerpath-ratio.xlsx') !== -1);
  const swapped = Object.assign({}, params, { template: 'sfra' });
  const bad = await download.handler({ httpMethod: 'GET', queryStringParameters: swapped });
  check('a swapped template fails the signature', bad.body.indexOf("couldn't verify") !== -1 && !bad.headers['Content-Disposition']);

  install(sessionBody('template_bundle', 'paid'));
  const bundle = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'template_bundle', session_id: 'cs_test_tpl' }
  });
  check('bundle page lists all seven and a zip', bundle.statusCode === 200 && bundle.body.indexOf('id="template-zip"') !== -1 && KEYS.every(function (key) { return bundle.body.indexOf('template=' + key) !== -1; }));
  const zipHref = (bundle.body.match(/href="(\/data\/download\?dl=template_bundle&amp;template=all[^"]+)"/) || [])[1];
  const zipParams = {};
  zipHref.replace('/data/download?', '').split('&amp;').join('&').split('&').forEach(function (pair) {
    const bits = pair.split('=');
    zipParams[decodeURIComponent(bits[0])] = decodeURIComponent(bits.slice(1).join('='));
  });
  global.fetch = async function () { throw new Error('signed zip must not call Stripe'); };
  const zipFile = await download.handler({ httpMethod: 'GET', queryStringParameters: zipParams });
  const zipRaw = Buffer.from(zipFile.body, 'base64');
  const zipFiles = xlsx.unzipStore(zipRaw);
  check('signed bundle is a zip of seven workbooks', zipFile.statusCode === 200 && reports.TEMPLATES.every(function (item) { return zipFiles[item.filename]; }));

  install(sessionBody('dga_report', 'paid'));
  const wrong = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'report_template', session_id: 'cs_test_tpl', template: 'ratio' }
  });
  check('a different product cannot fetch a template', wrong.body.indexOf("couldn't verify") !== -1);

  delete process.env.STRIPE_SECRET_KEY;
  global.fetch = async function () { throw new Error('no secret'); };
  const open = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'template_bundle', session_id: 'cs_test_tpl' }
  });
  check('missing Stripe secret is a 200 failure page', open.statusCode === 200 && open.body.indexOf("couldn't verify") !== -1 && open.body.indexOf('csv') === -1);

  process.env.STRIPE_SECRET_KEY = SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_tpl_unit';
  delete require.cache[require.resolve('../functions/stripe-webhook')];
  const wh = require('../functions/stripe-webhook');
  function sign(payload, secret) {
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
    return 't=' + t + ',v1=' + v1;
  }
  async function post(event) {
    const payload = JSON.stringify(event);
    return wh.handler({ httpMethod: 'POST', headers: { 'stripe-signature': sign(payload, 'whsec_tpl_unit') }, body: payload });
  }
  const hook = await post({
    id: 'evt_report_template',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_tpl_hook', metadata: { product: 'report_template' }, amount_total: 4900 } }
  });
  const hookBody = JSON.parse(hook.body);
  check('template webhook does not 500 without Supabase', hook.statusCode === 200 && hookBody.digital_product === 'report_template' && hookBody.stored === false);
  const bundleHook = await post({
    id: 'evt_template_bundle',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_bundle_hook', metadata: {}, payment_link: { url: paid.PAYMENT_LINKS.template_bundle.url }, amount_total: 14900 } }
  });
  check('bundle Payment Link is acknowledged', bundleHook.statusCode === 200 && JSON.parse(bundleHook.body).digital_product === 'template_bundle' && JSON.parse(bundleHook.body).stored === false);

  const claim = fs.readFileSync('claim.html', 'utf8');
  const scripts = claim.match(/<script>([\s\S]*?)<\/script>/g) || [];
  let claimScript = '';
  scripts.forEach(function (block) {
    if (block.indexOf('confirm-listing-payment') !== -1) claimScript = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
  });
  async function claimReturn(search, verifyBody, confirmBody) {
    const note = { textContent: 'Checking this checkout with Stripe.' };
    const link = { hidden: true, href: '' };
    const sandbox = {
      URLSearchParams: URLSearchParams,
      location: { search: search, hash: '', replace: function () {} },
      document: { getElementById: function (id) { return id === 'claimSetupNote' ? note : (id === 'claimNext' ? link : null); } },
      fetch: function (url) {
        const payload = String(url).indexOf('confirm-listing-payment') !== -1 ? confirmBody : verifyBody;
        return Promise.resolve({ json: function () { return Promise.resolve(payload); } });
      }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(claimScript, sandbox);
    await new Promise(function (resolve) { setTimeout(resolve, 20); });
    return { note: note, link: link };
  }
  const shown = await claimReturn('?product=report_template&session_id=cs_test_tpl', { paid: true, product: 'report_template' }, { configured: true, paid: true, product: 'report_template' });
  check('claim shows the template download only after Stripe agrees', shown.link.hidden === false && shown.link.href.indexOf('product=report_template') !== -1 && shown.note.textContent.indexOf('Payment received') === 0);
  const hidden = await claimReturn('?product=template_bundle&session_id=cs_test_tpl', { paid: true, product: 'template_bundle' }, { configured: true, paid: false, product: 'template_bundle' });
  check('an unconfirmed bundle return hides the download', hidden.link.hidden === true && hidden.note.textContent.indexOf('Payment received') === -1);

  process.env.STRIPE_SECRET_KEY = savedSecret;
  global.fetch = savedFetch;
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nReport template tests passed');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
