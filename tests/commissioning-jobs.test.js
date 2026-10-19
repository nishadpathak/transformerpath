/* HV/MV commissioning board, paid form, and the webhook without Supabase. */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const board = require('../lib/commissioning-jobs');
const download = require('../functions/csv-download');
const paid = require('../lib/paid-listings');
const course = require('../lib/course-payment');
const flags = require('../lib/feature-flags');

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log('  PASS  ' + name);
  else {
    failed++;
    console.error('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

const stored = JSON.parse(fs.readFileSync('data/commissioning-jobs.json', 'utf8'));
check('published file starts empty', Array.isArray(stored.published) && stored.published.length === 0);
check('empty file lists nothing', board.publicPosts(stored.published, '2026-10-18').length === 0);

function live(over) {
  return Object.assign({
    status: 'published',
    title: 'Commissioning engineer',
    company: 'Example Utility',
    location: 'Houston',
    function: 'Commissioning',
    description: 'One commissioning engineer for a single substation.',
    posting_url: 'https://example.com/jobs/commissioning/88421',
    captured_at: '2026-10-18',
    last_verified_at: '2026-10-18',
    http_status: 200,
    http_checked_at: '2026-10-18',
    reviewer: 'TransformerPath review',
    reviewed_at: '2026-10-18T12:00:00Z',
    verification_evidence: 'Vacancy page returned 200 on the check day.',
    voltage: 'HV',
    one_position: true
  }, over || {});
}

check('a reviewed HV vacancy is listed', board.publicPosts([live()], '2026-10-18').length === 1);
check('a reviewed MV vacancy is listed', board.publicPosts([live({ voltage: 'MV', title: 'MV commissioning lead' })], '2026-10-18').length === 1);
check('LV is not listed', board.publicPosts([live({ voltage: 'LV' })], '2026-10-18').length === 0);
check('a careers search is not listed', board.publicPosts([live({ posting_url: 'https://example.com/careers' })], '2026-10-18').length === 0);
check('an unreviewed payment is not listed', board.publicPosts([live({ reviewer: '', status: 'paid_pending_verification' })], '2026-10-18').length === 0);

const page = fs.readFileSync('commissioning-jobs/index.html', 'utf8');
check('page states the empty board', page.indexOf('No HV or MV commissioning posts are listed.') !== -1);
check('page offers the live $199 button', page.indexOf('Post a job, $199') !== -1 && page.indexOf('https://buy.stripe.com/4gMeV62lO9xz9g4fdMfYY0U') !== -1 && page.indexOf('data-product="commissioning_job_post"') !== -1);
check('page does not invent a vacancy', page.indexOf('Example Utility') === -1 && page.indexOf('example.com/jobs') === -1);
check('publish copies the board directory', (function () {
  const src = fs.readFileSync('build-dist.js', 'utf8');
  const dirs = src.match(/const DIRS = \[([\s\S]*?)\];/);
  return !!(dirs && dirs[1].indexOf("'commissioning-jobs'") !== -1);
})());
check('page loads the empty postings file', page.indexOf('/data/commissioning-jobs.json') !== -1);
check('page has no CSV product', page.indexOf('csv_') === -1);
check('jobs page keeps the free heading and links the board', (function () {
  const jobs = fs.readFileSync('jobs.html', 'utf8');
  return jobs.indexOf('Hiring? Post a Job — Free') !== -1 && jobs.indexOf('/commissioning-jobs/') !== -1 && jobs.indexOf('4gMeV62lO9xz9g4fdMfYY0U') === -1;
})());
check('RFQ payments stay off', flags.jobsRfqPaymentsEnabled() === false);

check('$199 alone is not a commissioning post', paid.listingProduct({ amount_total: 19900, metadata: {} }) == null);
check('the live Payment Link is the commissioning post', paid.listingProduct({
  metadata: {},
  payment_link: { url: paid.PAYMENT_LINKS.commissioning_job_post.url },
  amount_total: 19900
}) === 'commissioning_job_post');
check('the older job link stays job_standard', paid.listingProduct({
  metadata: {},
  payment_link: { url: paid.PAYMENT_LINKS.job_standard.url },
  amount_total: 19900
}) === 'job_standard');
check('a commissioning checkout is not a course', course.classifyCourse({
  metadata: { product: 'commissioning_job_post' },
  amount_total: 19900,
  payment_link: { url: paid.PAYMENT_LINKS.commissioning_job_post.url }
}) == null);
check('success path is the claim page', paid.PAYMENT_LINKS.commissioning_job_post.successPath.indexOf('/claim?product=commissioning_job_post') === 0);

const SECRET = 'sk_test_jobs';
const savedSecret = process.env.STRIPE_SECRET_KEY;
const savedFetch = global.fetch;
function install(product) {
  global.fetch = async function () {
    return {
      ok: true,
      status: 200,
      json: async function () {
        return { id: 'cs_test_job', payment_status: 'paid', metadata: { product: product }, amount_total: 19900 };
      }
    };
  };
}

(async function () {
  process.env.STRIPE_SECRET_KEY = SECRET;
  install('commissioning_job_post');
  const paidPage = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'commissioning_job_post', session_id: 'cs_test_job' }
  });
  check('paid job return is a claim link, not a 500', paidPage.statusCode === 200 && paidPage.body.indexOf('id="job-claim"') !== -1 && paidPage.body.indexOf('product=commissioning_job_post') !== -1 && paidPage.body.indexOf('csv') === -1);
  const noFile = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { dl: 'commissioning_job_post' }
  });
  check('a job post has no downloadable file', noFile.statusCode === 200 && noFile.body.indexOf('id="job-no-file"') !== -1 && !noFile.headers['Content-Disposition']);

  delete process.env.STRIPE_SECRET_KEY;
  global.fetch = async function () { throw new Error('no secret'); };
  const open = await download.handler({
    httpMethod: 'GET',
    queryStringParameters: { product: 'commissioning_job_post', session_id: 'cs_test_job' }
  });
  check('missing Stripe secret is a 200 failure page', open.statusCode === 200 && open.body.indexOf("couldn't verify") !== -1);

  process.env.STRIPE_SECRET_KEY = SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_job_unit';
  delete require.cache[require.resolve('../functions/stripe-webhook')];
  const wh = require('../functions/stripe-webhook');
  function sign(payload, secret) {
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
    return 't=' + t + ',v1=' + v1;
  }
  const payload = JSON.stringify({
    id: 'evt_commissioning_job',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_job_hook', metadata: { product: 'commissioning_job_post' }, amount_total: 19900 } }
  });
  const hook = await wh.handler({ httpMethod: 'POST', headers: { 'stripe-signature': sign(payload, 'whsec_job_unit') }, body: payload });
  const hookBody = JSON.parse(hook.body);
  check('job webhook does not 500 without Supabase', hook.statusCode === 200 && hookBody.digital_product === 'commissioning_job_post' && hookBody.stored === false);

  const claim = fs.readFileSync('claim.html', 'utf8');
  check('claim form is hidden in the page', claim.indexOf('id="claimJob"') !== -1 && /id="claimJob"[^>]*hidden/.test(claim));
  const scripts = claim.match(/<script>([\s\S]*?)<\/script>/g) || [];
  let claimScript = '';
  scripts.forEach(function (block) {
    if (block.indexOf('confirm-listing-payment') !== -1) claimScript = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
  });
  async function claimReturn(search, verifyBody, confirmBody) {
    const note = { textContent: 'Checking this checkout with Stripe.' };
    const form = { hidden: true };
    const link = { hidden: true, href: '' };
    const sandbox = {
      URLSearchParams: URLSearchParams,
      location: { search: search, hash: '', replace: function () {} },
      document: {
        getElementById: function (id) {
          if (id === 'claimSetupNote') return note;
          if (id === 'claimJob') return form;
          if (id === 'claimNext') return link;
          return null;
        }
      },
      fetch: function (url) {
        const payload = String(url).indexOf('confirm-listing-payment') !== -1 ? confirmBody : verifyBody;
        return Promise.resolve({ json: function () { return Promise.resolve(payload); } });
      }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(claimScript, sandbox);
    await new Promise(function (resolve) { setTimeout(resolve, 20); });
    return { note: note, form: form, link: link };
  }
  const shown = await claimReturn('?product=commissioning_job_post&session_id=cs_test_job', { paid: true, product: 'commissioning_job_post' }, { configured: true, paid: true, product: 'commissioning_job_post' });
  check('claim shows the form only after Stripe agrees', shown.form.hidden === false && shown.link.hidden === true && shown.note.textContent.indexOf('Payment does not publish') !== -1);
  const denied = await claimReturn('?product=commissioning_job_post&session_id=cs_test_job', { paid: false, product: null }, null);
  check('an unconfirmed return hides the form', denied.form.hidden === true && denied.note.textContent.indexOf('Payment received') === -1);
  const listing = await claimReturn('?session_id=cs_test_featured_listing', { paid: true, product: 'featured_listing' }, { configured: true, paid: true, product: 'featured_listing' });
  check('a featured listing still uses the listing sentence', listing.note.textContent === "Payment received. We'll set up your listing within 2 business days via hello@transformerpath.com." && listing.form.hidden === true);

  process.env.STRIPE_SECRET_KEY = savedSecret;
  global.fetch = savedFetch;
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nCommissioning job tests passed');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
