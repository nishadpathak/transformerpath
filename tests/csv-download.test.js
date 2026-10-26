/* CSV delivery: build-time files, mocked Stripe, signed downloads.
 * No live charge. The Stripe secret must never appear in a response.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const csv = require('../lib/csv-exports');
const download = require('../functions/csv-download');

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  PASS  ' + name);
  else { failed++; console.log('  FAIL  ' + name); }
}

function previewCount(html, key) {
  const re = new RegExp('data-csv-preview="' + key + '"[\\s\\S]*?</table>');
  const match = html.match(re);
  if (!match) return -1;
  const body = (match[0].split('<tbody>')[1] || '').split('</tbody>')[0];
  return (body.match(/<tr\b/g) || []).length;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: async function () { return body; }
  };
}

const SECRET = 'sk_test_csv_do_not_print_9f3a';
const savedSecret = process.env.STRIPE_SECRET_KEY;
const savedDir = process.env.CSV_EXPORT_DIR;
const savedFetch = global.fetch;
const logs = [];
const origLog = console.log;
const origErr = console.error;
console.log = function () {
  logs.push(Array.prototype.join.call(arguments, ' '));
  return origLog.apply(console, arguments);
};
console.error = function () {
  logs.push(Array.prototype.join.call(arguments, ' '));
  return origErr.apply(console, arguments);
};

const calls = [];
function installFetch(handler) {
  calls.length = 0;
  global.fetch = async function (url, opts) {
    const auth = opts && opts.headers && (opts.headers.Authorization || opts.headers.authorization) || '';
    calls.push({ url: String(url), auth: auth });
    return handler(String(url), opts || {});
  };
}

function session(product, where, status) {
  const meta = { product: product };
  const base = {
    id: 'cs_test_csv_paid',
    payment_status: status || 'paid',
    metadata: {},
    line_items: { object: 'list', data: [] },
    payment_link: null
  };
  if (where === 'price') {
    base.line_items.data.push({
      price: {
        id: 'price_csv',
        metadata: meta,
        product: { id: 'prod_csv', metadata: {} }
      }
    });
  } else if (where === 'product') {
    base.line_items.data.push({
      price: {
        id: 'price_csv',
        metadata: {},
        product: { id: 'prod_csv', metadata: meta }
      }
    });
  } else if (where === 'item') {
    base.line_items.data.push({
      price: { id: 'price_csv', metadata: {}, product: 'prod_csv' },
      metadata: meta
    });
  } else if (where === 'link') {
    base.payment_link = {
      id: 'plink_csvbundle',
      object: 'payment_link',
      metadata: meta,
      url: 'https://buy.stripe.com/CSV_TEST_NOT_A_LINK'
    };
  } else if (where === 'link-id') {
    base.payment_link = 'plink_csvbundle';
  } else if (where === 'session') {
    base.metadata = meta;
  } else if (where === 'learning') {
    base.line_items.data.push({
      price: { id: 'price_learn', metadata: { product: 'learning' }, product: { id: 'prod_learn', metadata: {} } }
    });
    base.metadata = { product: 'csv_bundle' };
  }
  return base;
}

(async function () {
  try {
    const dest = csv.defaultExportDir();
    const manifest = csv.writeExports(dest);
    process.env.CSV_EXPORT_DIR = dest;
    process.env.STRIPE_SECRET_KEY = SECRET;

    check('builder writes three files', manifest.files.directory.rows > 10 && manifest.files.tenders.rows > 10 && manifest.files.awards.rows > 10);
    const directoryDoc = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));
    const tenderDoc = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8'));
    const awardDoc = JSON.parse(fs.readFileSync('data/awards.json', 'utf8'));
    check('directory row count matches the live index', manifest.files.directory.rows === directoryDoc.companies.length);
    const siteStats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
    check('directory scope names the site manufacturer count and the larger file', manifest.directory_scope.indexOf(siteStats.manufacturers.toLocaleString('en-US')) !== -1 && manifest.directory_scope.indexOf(manifest.files.directory.rows.toLocaleString('en-US')) !== -1 && /not manufacturers/.test(manifest.directory_scope));
    const directoryParsed = csv.parseCsv(csv.readStored(dest, 'directory'));
    check('inferred or unverified directory rows show an em dash for last_verified', directoryParsed.rows.every(function (row, idx) {
      const company = directoryDoc.companies[idx];
      const hidden = csv.publicLastVerified('2020-01-01', [company.evidence, company.claim_type, company.research_status]) === csv.UNVERIFIED_MARK;
      return hidden ? row.last_verified === csv.UNVERIFIED_MARK : row.last_verified !== csv.UNVERIFIED_MARK;
    }));
    const tenderParsed = csv.parseCsv(csv.readStored(dest, 'tenders'));
    check('inferred tender rows show an em dash for last_verified', tenderParsed.rows.every(function (row, idx) {
      const source = tenderDoc.tenders[idx];
      const hidden = source.transformer_scope === 'INFERRED';
      return hidden ? row.last_verified === csv.UNVERIFIED_MARK : (source.transformer_scope === 'CONFIRMED' ? /^\d{4}-\d{2}-\d{2}$/.test(row.last_verified) : true);
    }));
    const awardParsed = csv.parseCsv(csv.readStored(dest, 'awards'));
    check('inferred award rows show an em dash for last_verified', awardParsed.rows.every(function (row, idx) {
      const source = awardDoc.awards[idx];
      return source.transformer_scope === 'INFERRED' ? row.last_verified === csv.UNVERIFIED_MARK : row.last_verified !== csv.UNVERIFIED_MARK || source.transformer_scope !== 'CONFIRMED';
    }));
    check('tender row count matches the live register', manifest.files.tenders.rows === tenderDoc.tenders.length);
    check('award row count matches the live register', manifest.files.awards.rows === awardDoc.awards.length);

    Object.keys(csv.FILES).forEach(function (key) {
      const text = csv.readStored(dest, key);
      const parsed = csv.parseCsv(text);
      check(key + ' licence is on the file', text.indexOf(csv.LICENCE) !== -1 && /single company/i.test(csv.LICENCE) && /no resale/i.test(csv.LICENCE));
      check(key + ' every row carries the licence', parsed.rows.length > 0 && parsed.rows.every(function (row) { return row.licence === csv.LICENCE; }));
      check(key + ' preview source has a header', parsed.headers.indexOf('licence') !== -1);
    });

    const directoryCsv = csv.parseCsv(csv.readStored(dest, 'directory'));
    check('first directory name round-trips', directoryCsv.rows[0].name === directoryDoc.companies[0].name);
    check('formula-like cells are prefixed', csv.csvEscape('=cmd') === "'=cmd" && csv.parseCsv(csv.toCsv(['name', 'licence'], [{ name: '=cmd', licence: csv.LICENCE }], ['# note'])).rows[0].name === "'=cmd");

    const ignored = require('child_process').spawnSync('git', ['check-ignore', '-q', 'data/csv-exports/directory.csv']);
    check('generated CSVs are gitignored', ignored.status === 0);

    require('../build-data-page').build();
    ['lib/csv-exports.js', 'functions/csv-download.js', 'build-csv-exports.js', 'data.html', 'data-checkout.js'].forEach(function (file) {
      const text = fs.readFileSync(file, 'utf8');
      check(file + ' has no buy.stripe.com link', text.indexOf('buy.stripe.com') === -1);
    });

    const productRe = /csv_directory|csv_tenders|csv_awards|csv_bundle/;
    const allowedProductFiles = {
      'lib/csv-exports.js': true,
      'lib/csv-pay.js': true,
      'functions/csv-download.js': true,
      'build-csv-exports.js': true,
      'build-data-page.js': true,
      'data.html': true,
      'tests/csv-download.test.js': true,
      'tests/data-page.test.js': true
    };
    const productHits = [];
    function walkProductIds(dir) {
      const skip = new Set(['node_modules', '.git', 'dist', 'archive', 'transformerpath', 'transformerpath-site', 'data', '.cursor']);
      fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
        if (entry.name.charAt(0) === '.' && entry.name !== '.github') return;
        if (skip.has(entry.name)) return;
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) { walkProductIds(rel); return; }
        if (!/\.(html|js|toml)$/.test(entry.name)) return;
        const text = fs.readFileSync(rel, 'utf8');
        if (!productRe.test(text)) return;
        const posix = rel.split(path.sep).join('/');
        if (!allowedProductFiles[posix]) productHits.push(posix);
      });
    }
    walkProductIds('.');
    check('no page names a CSV product or a CSV Payment Link', productHits.length === 0);

    const toml = fs.readFileSync('netlify.toml', 'utf8');
    check('build generates the CSVs', toml.indexOf('node build-csv-exports.js') !== -1);
    check('build runs this test', toml.indexOf('node tests/csv-download.test.js') !== -1);
    check('download URL rewrites to the function', toml.indexOf('from = "/data/download"') !== -1 && toml.indexOf('/.netlify/functions/csv-download') !== -1);
    check('function bundles the export files', toml.indexOf('data/csv-exports/*') !== -1);
    const distGate = fs.readFileSync('build-dist.js', 'utf8');
    check('dist gate refuses a public CSV export', distGate.indexOf('csv-exports') !== -1 && /\\\.csv\$/.test(distGate));

    installFetch(async function () { return jsonResponse(404, { error: { message: 'no such session' } }); });
    const bogus = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'bogus' } });
    check('bogus session is a page', bogus.statusCode === 200 && String(bogus.headers['Content-Type']).indexOf('text/html') === 0);
    check('bogus session shows the verify-failed sentence', bogus.body.indexOf(csv.VERIFY_FAILED) !== -1);
    check('bogus session is not a CSV attachment', !bogus.headers['Content-Disposition']);
    check('bogus session shows 10-row samples', previewCount(bogus.body, 'directory') === 10 && previewCount(bogus.body, 'tenders') === 10 && previewCount(bogus.body, 'awards') === 10);
    check('download page states what the directory rows are', bogus.body.indexOf('id="csv-directory-scope"') !== -1 && bogus.body.indexOf(manifest.directory_scope) !== -1);
    check('stripe was asked with the bearer secret', calls.length === 1 && calls[0].auth === 'Bearer ' + SECRET && calls[0].url.indexOf(SECRET) === -1 && calls[0].url.indexOf('https://api.stripe.com/') === 0);
    check('response does not contain the secret', bogus.body.indexOf(SECRET) === -1);

    installFetch(async function () { throw new Error('network down'); });
    const thrown = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_down' } });
    check('stripe errors stay on the verify-failed page', thrown.statusCode === 200 && thrown.body.indexOf(csv.VERIFY_FAILED) !== -1 && thrown.body.indexOf(SECRET) === -1);

    delete process.env.STRIPE_SECRET_KEY;
    calls.length = 0;
    global.fetch = async function () { calls.push({ url: 'called' }); return jsonResponse(200, {}); };
    const unconfigured = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_nokey' } });
    check('missing secret does not call Stripe or attach a file', calls.length === 0 && unconfigured.body.indexOf(csv.EMAIL_INSTEAD) !== -1 && unconfigured.body.indexOf(csv.VERIFY_FAILED) === -1 && !unconfigured.headers['Content-Disposition']);
    const sneakExp = Date.now() + 60000;
    const sneak = {
      dl: 'directory',
      sid: 'cs_test_csv_paid',
      exp: String(sneakExp),
      sig: csv.signDownload(SECRET, 'cs_test_csv_paid', 'directory', sneakExp)
    };
    const sneakRes = await download.handler({ httpMethod: 'GET', queryStringParameters: sneak });
    check('missing secret does not serve a signed CSV', sneakRes.body.indexOf(csv.EMAIL_INSTEAD) !== -1 && !sneakRes.headers['Content-Disposition'] && sneakRes.body.length < csv.readStored(dest, 'directory').length);
    process.env.STRIPE_SECRET_KEY = SECRET;

    const unpaid = session('csv_directory', 'price', 'unpaid');
    installFetch(async function () { return jsonResponse(200, unpaid); });
    const unpaidRes = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_unpaid' } });
    check('unpaid session is verify-failed', unpaidRes.body.indexOf(csv.VERIFY_FAILED) !== -1 && unpaidRes.body.indexOf('id="csv-paid"') === -1);

    const learning = session('learning', 'learning', 'paid');
    installFetch(async function () { return jsonResponse(200, learning); });
    const learningRes = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_learning' } });
    check('a learning checkout does not unlock a CSV', learningRes.body.indexOf(csv.VERIFY_FAILED) !== -1 && learningRes.body.indexOf('transformerpath-directory.csv') === -1);

    const directorySession = session('csv_directory', 'price', 'paid');
    installFetch(async function () { return jsonResponse(200, directorySession); });
    const paid = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_csv_paid' } });
    check('paid directory session is not the failure sentence', paid.statusCode === 200 && paid.body.indexOf(csv.VERIFY_FAILED) === -1 && paid.body.indexOf('id="csv-paid"') !== -1);
    check('paid page does not echo a stripe buy link', paid.body.indexOf('buy.stripe.com') === -1);
    check('directory purchase offers only the directory file', (paid.body.match(/transformerpath-directory\.csv/g) || []).length >= 1 && paid.body.indexOf('transformerpath-tenders.csv') === -1 && paid.body.indexOf('transformerpath-awards.csv') === -1);
    const href = (paid.body.match(/href="(\/data\/download\?dl=directory[^"]+)"/) || [])[1];
    check('directory link is signed', !!href && href.indexOf('sig=') !== -1 && href.indexOf(SECRET) === -1);
    const laterName = directoryDoc.companies[50] && directoryDoc.companies[50].name;
    check('preview stops at 10 rows', previewCount(paid.body, 'directory') === 10 && laterName && paid.body.indexOf(laterName) === -1);

    const params = {};
    href.replace('/data/download?', '').split('&amp;').join('&').split('&').forEach(function (pair) {
      const bits = pair.split('=');
      params[decodeURIComponent(bits[0])] = decodeURIComponent(bits.slice(1).join('='));
    });
    calls.length = 0;
    const file = await download.handler({ httpMethod: 'GET', queryStringParameters: params });
    check('signed link does not call Stripe again', calls.length === 0);
    check('signed link returns the directory CSV', file.statusCode === 200 && String(file.headers['Content-Type']).indexOf('text/csv') === 0 && file.headers['Content-Disposition'].indexOf('transformerpath-directory.csv') !== -1);
    check('signed body is the build-time file', file.body === csv.readStored(dest, 'directory') && file.body.indexOf(csv.LICENCE) !== -1 && file.body.indexOf(SECRET) === -1);

    const swapped = Object.assign({}, params, { dl: 'awards' });
    const swappedRes = await download.handler({ httpMethod: 'GET', queryStringParameters: swapped });
    check('a directory signature cannot fetch awards', swappedRes.body.indexOf(csv.VERIFY_FAILED) !== -1 && !swappedRes.headers['Content-Disposition']);

    const expired = Object.assign({}, params, { exp: String(Date.now() - 1000) });
    expired.sig = csv.signDownload(SECRET, expired.sid, expired.dl, Number(expired.exp));
    const expiredRes = await download.handler({ httpMethod: 'GET', queryStringParameters: expired });
    check('an expired signature is verify-failed', expiredRes.body.indexOf(csv.VERIFY_FAILED) !== -1);

    const far = Object.assign({}, params, { exp: String(Date.now() + csv.TTL_MS + 5 * 60 * 1000) });
    far.sig = csv.signDownload(SECRET, far.sid, far.dl, Number(far.exp));
    const farRes = await download.handler({ httpMethod: 'GET', queryStringParameters: far });
    check('a link past 15 minutes is refused', farRes.body.indexOf(csv.VERIFY_FAILED) !== -1);

    const bundle = session('csv_bundle', 'link', 'paid');
    installFetch(async function () { return jsonResponse(200, bundle); });
    const bundleRes = await download.handler({ httpMethod: 'POST', body: JSON.stringify({ session_id: 'cs_test_bundle' }) });
    check('payment link metadata unlocks all three files', bundleRes.body.indexOf('transformerpath-directory.csv') !== -1 && bundleRes.body.indexOf('transformerpath-tenders.csv') !== -1 && bundleRes.body.indexOf('transformerpath-awards.csv') !== -1);
    check('bundle page hides the payment link url', bundleRes.body.indexOf('buy.stripe.com') === -1 && bundleRes.body.indexOf(SECRET) === -1);

    const fromProduct = session('csv_awards', 'product', 'paid');
    installFetch(async function () { return jsonResponse(200, fromProduct); });
    const awardsRes = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_awards' } });
    check('line item product metadata selects awards', awardsRes.body.indexOf('transformerpath-awards.csv') !== -1 && awardsRes.body.indexOf('transformerpath-directory.csv') === -1);

    let paymentLinkFetches = 0;
    installFetch(async function (url) {
      if (url.indexOf('/payment_links/') !== -1) {
        paymentLinkFetches++;
        return jsonResponse(200, { id: 'plink_csvbundle', metadata: { product: 'csv_tenders' } });
      }
      return jsonResponse(200, session('csv_tenders', 'link-id', 'paid'));
    });
    const linkIdRes = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_plink' } });
    check('a payment link id is loaded for its metadata', paymentLinkFetches === 1 && linkIdRes.body.indexOf('transformerpath-tenders.csv') !== -1 && linkIdRes.body.indexOf('transformerpath-directory.csv') === -1);

    const fromSession = session('csv_tenders', 'session', 'paid');
    check('session metadata is a csv product when nothing earlier is set', csv.csvProductFromSession(fromSession) === 'csv_tenders');
    check('line items beat a later bundle tag', csv.csvProductFromSession(learning) === null);
    const fromUrl = session('csv_directory', 'session', 'paid');
    fromUrl.metadata = {};
    fromUrl.payment_link = { id: 'plink_dir', url: 'https://buy.stripe.com/14AdR26C41131NC5DcfYY0r' };
    check('an approved directory Payment Link url selects that file', csv.csvProductFromSession(fromUrl) === 'csv_directory');
    const lookalike = session('csv_directory', 'session', 'paid');
    lookalike.metadata = {};
    lookalike.payment_link = { url: 'https://buy.stripe.com/14AdR26C41131NC5DcfYY0rEXTRA' };
    check('a lookalike Payment Link url is not a CSV', csv.csvProductFromSession(lookalike) === null);
    const blocked = session('learning', 'learning', 'paid');
    blocked.payment_link = { url: 'https://buy.stripe.com/3cI28k7G8257dwke9IfYY0u' };
    check('a non-csv line item does not fall through to a bundle url', csv.csvProductFromSession(blocked) === null);

    const empty = await download.handler({ httpMethod: 'GET', queryStringParameters: {} });
    check('a visit with no session is verify-failed', empty.statusCode === 200 && empty.body.indexOf(csv.VERIFY_FAILED) !== -1 && empty.statusCode !== 404);

    const other = await download.handler({ httpMethod: 'PUT', queryStringParameters: { session_id: 'bogus' } });
    check('other methods do not download a file', other.statusCode === 405 && other.body.indexOf(csv.VERIFY_FAILED) !== -1);

    process.env.CSV_EXPORT_DIR = path.join(dest, 'missing-dir');
    installFetch(async function () { return jsonResponse(200, directorySession); });
    const missing = await download.handler({ httpMethod: 'GET', queryStringParameters: { session_id: 'cs_test_csv_paid' } });
    const missingHref = (missing.body.match(/href="(\/data\/download\?dl=directory[^"]+)"/) || [])[1];
    const missingParams = {};
    missingHref.replace('/data/download?', '').split('&amp;').join('&').split('&').forEach(function (pair) {
      const bits = pair.split('=');
      missingParams[decodeURIComponent(bits[0])] = decodeURIComponent(bits.slice(1).join('='));
    });
    const missingFile = await download.handler({ httpMethod: 'GET', queryStringParameters: missingParams });
    check('a paid session with no file does not pretend verification failed', missingFile.statusCode === 200 && missingFile.body.indexOf(csv.FILE_MISSING) !== -1 && missingFile.body.indexOf(csv.VERIFY_FAILED) === -1 && !missingFile.headers['Content-Disposition']);
    process.env.CSV_EXPORT_DIR = dest;

    check('logs do not contain the secret', logs.every(function (line) { return line.indexOf(SECRET) === -1; }));
  } catch (err) {
    failed++;
    origErr.call(console, '  FAIL  test crashed');
    origErr.call(console, err && err.stack ? err.stack.split(SECRET).join('[redacted]') : 'error');
  } finally {
    console.log = origLog;
    console.error = origErr;
    if (savedSecret == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedSecret;
    if (savedDir == null) delete process.env.CSV_EXPORT_DIR;
    else process.env.CSV_EXPORT_DIR = savedDir;
    global.fetch = savedFetch;
  }

  if (failed) {
    console.error(failed + ' csv download check(s) failed');
    process.exit(1);
  }
  console.log('csv download checks passed');
})();
