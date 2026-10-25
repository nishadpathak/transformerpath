#!/usr/bin/env node
/* Free claim-listing form: Netlify submit, domain flag, existing upgrade links.
 * The page is noindex, so it stays out of the sitemap.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const claim = require('../lib/claim-listing');
const paid = require('../lib/paid-listings');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failed++;
}

check('matching work email is a domain match', claim.reviewFlag('sales@bemag.ca', 'https://www.bemag.ca/') === 'domain_match');
check('a mailbox subdomain matches the listing host', claim.reviewFlag('plant@mail.bemag.ca', 'https://www.bemag.ca/transformers') === 'domain_match');
check('sibling subdomains stay on manual review', claim.reviewFlag('plant@mail.bemag.ca', 'https://shop.bemag.ca/') === 'manual_review');
check('parent domain matches a site host', claim.domainsMatch('office@bemag.ca', 'https://shop.bemag.ca/'));
check('other domains are flagged for manual review', claim.reviewFlag('sales@gmail.com', 'https://www.bemag.ca/') === 'manual_review');
check('a lookalike host is not a match', claim.reviewFlag('a@notbemag.ca', 'https://bemag.ca/') === 'manual_review');
check('a missing website is manual review', claim.reviewFlag('sales@bemag.ca', '') === 'manual_review');
check('claim link carries the slug', claim.href('bemag-transformer') === '/claim-listing/bemag-transformer/');
check('upgrade links keep the existing price url and add the slug', claim.payHref(paid.PAYMENT_LINKS.featured_listing.url, 'bemag-transformer') === paid.PAYMENT_LINKS.featured_listing.url + '?client_reference_id=bemag-transformer' && claim.payHref(paid.PAYMENT_LINKS.featured_verified.url, 'bemag-transformer') === paid.PAYMENT_LINKS.featured_verified.url + '?client_reference_id=bemag-transformer');
check('pay buttons use the existing payment links', claim.PAY_URLS.verified_manufacturer === paid.VERIFIED_MANUFACTURER_PAYMENT_LINK && claim.PAY_URLS.featured_listing === paid.PAYMENT_LINKS.featured_listing.url && claim.PAY_URLS.featured_verified === paid.PAYMENT_LINKS.featured_verified.url);
check('a click target keeps client_reference_id on the existing link', claim.checkoutUrl('verified_manufacturer', 'bemag-transformer') === paid.VERIFIED_MANUFACTURER_PAYMENT_LINK + '?client_reference_id=bemag-transformer' && claim.checkoutUrl('featured_listing', 'bemag-transformer') === paid.PAYMENT_LINKS.featured_listing.url + '?client_reference_id=bemag-transformer' && claim.checkoutUrl('featured_verified', 'bemag-transformer') === paid.PAYMENT_LINKS.featured_verified.url + '?client_reference_id=bemag-transformer');
check('an empty slug keeps the bare payment link', claim.checkoutUrl('featured_verified', '') === paid.PAYMENT_LINKS.featured_verified.url && claim.checkoutUrl('no-such-plan', 'bemag-transformer') === '');
const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
check('robots.txt disallows the claim pages', /^Disallow:\s*\/claim-listing\/\s*$/m.test(robots));
const analytics = fs.readFileSync(path.join(root, 'analytics.js'), 'utf8');
check('analytics tracks pay buttons and existing stripe anchors', analytics.indexOf('[data-pay-plan]') >= 0 && analytics.indexOf('a[href*="buy.stripe.com"]') >= 0 && analytics.indexOf('checkout_start') >= 0);
check('a bad slug still opens the form', claim.href('..//') === '/claim-listing/');

const index = JSON.parse(fs.readFileSync(path.join(root, 'data/claim-listing-index.json'), 'utf8'));
const fresh = claim.buildClaimIndex(root);
check('claim index matches the census', JSON.stringify(index) === JSON.stringify(fresh));
check('index keeps the listing website', index['bemag-transformer'] && index['bemag-transformer'].website === 'https://www.bemag.ca/');

const form = fs.readFileSync(path.join(root, 'claim-listing/index.html'), 'utf8');
const received = fs.readFileSync(path.join(root, 'claim-listing/received/index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'claim-listing.js'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const CONFIRM = 'We review claims manually; corrected data appears once verified.';

function visible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

[form, received].forEach(function (html, i) {
  const name = i === 0 ? 'form' : 'received';
  check(name + ' is noindex', /<meta name="robots" content="noindex,follow">/.test(html));
  check(name + ' states the manual review confirmation', html.indexOf(CONFIRM) >= 0);
});
check('sitemap leaves the noindex claim page out', sitemap.indexOf('claim-listing') === -1);
check('form posts to Netlify without JavaScript', /method="POST"/.test(form) && /action="\/claim-listing\/received\/"/.test(form) && /data-netlify="true"/.test(form) && /name="form-name" value="claim-listing"/.test(form));
check('honeypot is present and not required', /data-netlify-honeypot="bot-field"/.test(form) && /name="bot-field"/.test(form) && !/name="bot-field"[^>]*required/.test(form));
check('form collects company, slug, role, email, and corrections', /name="company"/.test(form) && /name="slug"/.test(form) && /name="role"/.test(form) && /name="email"/.test(form) && /name="corrections"/.test(form) && /name="correct_fields"/.test(form));
check('unmatched claims default to manual review', /name="review_flag" value="manual_review"/.test(form));
check('the form does not ask for a personal name', !/name="name"|Full Name|Your name/i.test(form));
check('the page script does not block a native submit', script.indexOf('preventDefault') < 0);
check('the claim flow does not call Supabase', form.indexOf('supabase') < 0 && script.indexOf('supabase') < 0 && received.indexOf('supabase') < 0);

const verified = paid.VERIFIED_MANUFACTURER_PAYMENT_LINK;
const featured = paid.PAYMENT_LINKS.featured_listing.url;
const both = paid.PAYMENT_LINKS.featured_verified.url;
[form, received].forEach(function (html, i) {
  const name = i === 0 ? 'form' : 'received';
  check(name + ' has no crawlable stripe href', html.indexOf('buy.stripe.com') < 0 && html.indexOf('href="https://buy.stripe.com') < 0);
  check(name + ' uses a verified pay button', html.indexOf('data-pay-plan="verified_manufacturer"') >= 0 && html.indexOf('>Get Verified $499 one-time payment · covers 12 months<') >= 0);
  check(name + ' uses a featured pay button', html.indexOf('data-pay-plan="featured_listing"') >= 0 && html.indexOf('>Featured $299/yr<') >= 0);
  check(name + ' uses a featured plus verified pay button', html.indexOf('data-pay-plan="featured_verified"') >= 0 && html.indexOf('>Featured+Verified $699/yr<') >= 0);
  check(name + ' noscript names hello@', /<noscript>[\s\S]*mailto:hello@transformerpath\.com[\s\S]*<\/noscript>/.test(html));
});
check('received page loads the click handler', received.indexOf('/claim-listing.js') >= 0);
check('upgrade copy keeps featured yearly prices and the one-time verified price', form.indexOf('$499 one-time payment · covers 12 months') >= 0 && form.indexOf('with no auto-renewal') >= 0 && form.indexOf('$499/yr') < 0 && form.indexOf('$299/yr') >= 0 && form.indexOf('$699/yr') >= 0 && form.indexOf('Identity and contact details checked. Not a product certification.') >= 0);
const mailtos = (form + received).match(/mailto:[^"'\s>]+/gi) || [];
check('contact is hello@transformerpath.com only', mailtos.length > 0 && mailtos.every(function (m) { return m === 'mailto:hello@transformerpath.com'; }));
check('claim page has no visible undefined, NaN, or null', !/\b(?:undefined|NaN|null)\b/.test(visible(form + received)));
check('published script is on the dist allowlist', fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8').indexOf("'claim-listing.js'") >= 0 && fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8').indexOf("'claim-listing'") >= 0);
check('form loads the domain check and the listing index', form.indexOf('/claim-listing.js') >= 0 && script.indexOf('/data/claim-listing-index.json') >= 0);

const board = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
const boardStart = board.indexOf('<!--SSR:mfg-board-->');
const boardEnd = board.indexOf('<!--/SSR:mfg-board-->');
const ssr = board.slice(boardStart, boardEnd);
const census = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
let makers = 0;
census.forEach(function (country) {
  (country.makers || []).forEach(function (maker) {
    if (maker && !/^Served by/i.test(maker[0])) makers++;
  });
});
const aliases = require('../lib/company-aliases');
const slugRows = JSON.parse(fs.readFileSync(path.join(root, 'data/company-slugs.json'), 'utf8'));
const slugMap = {};
slugRows.forEach(function (row) {
  if (row && row.name && row.slug) slugMap[row.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = row.slug;
});
const visibleMakers = aliases.visibleMakerCount(census, slugMap);
check('directory board links every visible maker', (ssr.match(/data-claim-listing="1"/g) || []).length === visibleMakers, visibleMakers + ' visible, ' + makers + ' census');
check('plant alias rows collapse onto the company profile', visibleMakers === makers - 7, String(visibleMakers));
check('directory script renders the same claim link', board.indexOf('function claimListingLink') >= 0 && board.indexOf('data-claim-listing="1"') >= 0);

let profileMiss = 0;
let profileCount = 0;
fs.readdirSync(path.join(root, 'manufacturers')).forEach(function (dir) {
  const file = path.join(root, 'manufacturers', dir, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
  const html = fs.readFileSync(file, 'utf8');
  if (/http-equiv=["']refresh["']/i.test(html)) {
    if (html.indexOf('data-claim-listing="1"') >= 0) profileMiss++;
    return;
  }
  if (html.indexOf('Claim this profile') < 0) return;
  profileCount++;
  if (html.indexOf('/claim-listing/' + dir + '/') < 0) profileMiss++;
});
check('every full profile links to its claim form', profileMiss === 0 && profileCount >= 890, 'miss ' + profileMiss + ' profiles ' + profileCount);

const canada = fs.readFileSync(path.join(root, 'manufacturers/canada.html'), 'utf8');
const canadaRows = canada.split('<div class="mk-row">').slice(1).filter(function (row) {
  return row.indexOf('class="note"') < 0;
});
check('country listing rows include a claim link', canadaRows.length > 0 && canadaRows.every(function (row) {
  return row.indexOf('data-claim-listing="1"') >= 0 && /\/claim-listing\/[a-z0-9-]+\//.test(row);
}));
const hub = fs.readFileSync(path.join(root, 'manufacturers/power-transformers/index.html'), 'utf8');
check('product listing rows include a claim link', (hub.match(/data-claim-listing="1"/g) || []).length > 50);

const api = require('../claim-listing');
const flagBox = { value: 'manual_review' };
const siteBox = { value: '' };
const emailBox = { value: '' };
const slugBox = { value: '' };
const companyBox = { value: '' };
const listeners = {};
const formEl = {
  getAttribute: function () { return ''; },
  setAttribute: function () {},
  addEventListener: function (name, fn) { listeners[name] = fn; },
  querySelector: function (sel) {
    if (sel.indexOf('review_flag') >= 0) return flagBox;
    if (sel.indexOf('listing_website') >= 0) return siteBox;
    return null;
  }
};
const nodes = {
  claimListingForm: formEl,
  'claim-slug': slugBox,
  'claim-company': companyBox,
  'claim-email': emailBox,
  'claim-domain-status': { textContent: '' }
};
function payBox(plan) {
  return {
    attrs: { 'data-pay-plan': plan, 'data-pay-slug': '' },
    getAttribute: function (k) { return this.attrs[k] || ''; },
    setAttribute: function (k, v) { this.attrs[k] = v; }
  };
}
const payLink = payBox('verified_manufacturer');
const featuredLink = payBox('featured_listing');
const bothLink = payBox('featured_verified');
global.document = {
  getElementById: function (id) { return nodes[id] || null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return [payLink, featuredLink, bothLink]; },
  readyState: 'complete',
  addEventListener: function () {}
};
global.window = { location: { search: '?slug=bemag-transformer' } };
global.fetch = function () {
  return Promise.resolve({
    ok: true,
    json: function () { return Promise.resolve({ 'bemag-transformer': index['bemag-transformer'] }); }
  });
};
emailBox.addEventListener = function (name, fn) { listeners['email-' + name] = fn; };
slugBox.addEventListener = function (name, fn) { listeners['slug-' + name] = fn; };
api.boot();
setTimeout(function () {
  check('slug and company are filled from the address', slugBox.value === 'bemag-transformer' && companyBox.value === 'Bemag Transformer', slugBox.value + ' / ' + companyBox.value);
  emailBox.value = 'sales@bemag.ca';
  listeners['email-input']();
  check('a matching email is stored as domain_match', flagBox.value === 'domain_match' && siteBox.value === 'https://www.bemag.ca/', flagBox.value + ' ' + siteBox.value);
  check('verified checkout keeps the existing link and the maker slug', payLink.getAttribute('data-pay-slug') === 'bemag-transformer' && claim.checkoutUrl('verified_manufacturer', payLink.getAttribute('data-pay-slug')) === verified + '?client_reference_id=bemag-transformer', payLink.getAttribute('data-pay-slug'));
  check('featured checkouts keep the existing links and the maker slug', featuredLink.getAttribute('data-pay-slug') === 'bemag-transformer' && bothLink.getAttribute('data-pay-slug') === 'bemag-transformer' && claim.checkoutUrl('featured_listing', featuredLink.getAttribute('data-pay-slug')) === featured + '?client_reference_id=bemag-transformer' && claim.checkoutUrl('featured_verified', bothLink.getAttribute('data-pay-slug')) === both + '?client_reference_id=bemag-transformer');
  emailBox.value = 'sales@gmail.com';
  listeners['email-input']();
  check('a different email stays on manual review', flagBox.value === 'manual_review', flagBox.value);
  slugBox.value = 'not-a-real-listing';
  listeners['slug-change']();
  setTimeout(function () {
  check('an unknown slug says listing not found and clears the slug', slugBox.value === '' && nodes['claim-domain-status'].textContent === 'Listing not found', slugBox.value + ' / ' + nodes['claim-domain-status'].textContent);
  const bemagPage = fs.readFileSync(path.join(root, 'claim-listing/bemag-transformer/index.html'), 'utf8');
  check('a prerendered claim page is noindex and prefilled', /noindex,follow/.test(bemagPage) && bemagPage.indexOf('value="Bemag Transformer"') >= 0 && bemagPage.indexOf('value="bemag-transformer"') >= 0);
  check('a prerendered page carries the slug on every pay button', bemagPage.indexOf('buy.stripe.com') < 0 && (bemagPage.match(/data-pay-slug="bemag-transformer"/g) || []).length === 3 && bemagPage.indexOf('data-pay-plan="verified_manufacturer"') >= 0 && bemagPage.indexOf('data-pay-plan="featured_listing"') >= 0 && bemagPage.indexOf('data-pay-plan="featured_verified"') >= 0);
  const clicked = { href: '' };
  const savedWindow = global.window;
  global.window = { location: { search: '', assign: function (url) { clicked.href = url; } } };
  const payEvent = { target: { closest: function () { return { getAttribute: function (k) { return k === 'data-pay-plan' ? 'featured_verified' : 'bemag-transformer'; } }; } } };
  claim.onPayClick(payEvent);
  check('a click opens the existing payment link', clicked.href === both + '?client_reference_id=bemag-transformer', clicked.href);
  global.window = savedWindow;
  check('the prerendered page stays out of the sitemap', sitemap.indexOf('claim-listing') === -1);
  const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  const bemagAt = toml.indexOf('query = {slug = "bemag-transformer"}');
  const bemagRule = bemagAt >= 0 ? toml.slice(Math.max(0, bemagAt - 220), bemagAt + 40) : '';
  check('a known query redirects to the prerendered page with status 301', bemagRule.indexOf('to = "/claim-listing/bemag-transformer/"') >= 0 && bemagRule.indexOf('status = 301') >= 0 && bemagRule.indexOf('302') < 0, bemagRule);
  const notFoundAt = toml.indexOf('from = "/claim-listing/not-found/"');
  const notFoundRule = notFoundAt >= 0 ? toml.slice(notFoundAt, notFoundAt + 160) : '';
  check('the not-found claim url returns status 404', notFoundRule.indexOf('to = "/claim-listing/not-found/index.html"') >= 0 && notFoundRule.indexOf('status = 404') >= 0 && notFoundRule.indexOf('force = true') >= 0, notFoundRule);
  const splatAt = toml.indexOf('from = "/claim-listing/*"');
  const splat = splatAt >= 0 ? toml.slice(splatAt, splatAt + 180) : '';
  check('an unknown claim path serves the not-found page as a 404', splat.indexOf('to = "/claim-listing/not-found/index.html"') >= 0 && splat.indexOf('status = 404') >= 0 && splat.indexOf('force') < 0, splat);
  const gate = require('../lib/claim-slug-gate');
  check('a known query targets the prerendered page', gate.claimQueryTarget('bemag-transformer', index) === '/claim-listing/bemag-transformer/');
  check('an unknown query targets that slug path', gate.claimQueryTarget('not-a-real-listing', index) === '/claim-listing/not-a-real-listing/');
  check('a blank query stays on the form', gate.claimQueryTarget('', index) === '');
  const edge = fs.readFileSync(path.join(root, 'netlify/edge-functions/claim-listing-query.js'), 'utf8');
  check('the edge function sends a slug query with a 301', edge.indexOf('301') >= 0 && edge.indexOf('302') < 0 && edge.indexOf("'/claim-listing/' + slug + '/'") >= 0);
  const missingPage = fs.readFileSync(path.join(root, 'claim-listing/not-found/index.html'), 'utf8');
  const missingVisible = visible(missingPage);
  check('the not-found page says Listing not found without JavaScript', missingVisible.indexOf('Listing not found') >= 0 && missingPage.indexOf('href="/directory.html"') >= 0 && missingPage.indexOf('/claim-listing.js') < 0);
  check('the not-found page is noindex', /noindex,follow/.test(missingPage));
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-hub-'));
  const anchor = ' <a class="btn btn-outline btn-sm claim-listing-link" href="/claim-listing/power-transformers/" data-claim-listing="1">Claim this listing</a>';
  fs.mkdirSync(path.join(tmp, 'hungary'));
  fs.writeFileSync(path.join(tmp, 'hungary', 'index.html'), '<nav>Power' + anchor + ' › Hungary</nav>');
  fs.mkdirSync(path.join(tmp, 'india'));
  fs.writeFileSync(path.join(tmp, 'india', 'index.html'), '<nav>Power' + anchor + ' › India</nav>');
  claim.stripStaleHubClaim(tmp, 'power-transformers', { india: true });
  const stripped = fs.readFileSync(path.join(tmp, 'hungary', 'index.html'), 'utf8');
  const keptHtml = fs.readFileSync(path.join(tmp, 'india', 'index.html'), 'utf8');
  check('a stale hub drops the product-type claim link', stripped.indexOf('/claim-listing/power-transformers/') < 0 && stripped.indexOf('Hungary') >= 0, stripped);
  check('a hub the generator rewrites is left for that writer', keptHtml.indexOf(anchor) >= 0);
  const hungaryHub = fs.readFileSync(path.join(root, 'manufacturers/power-transformers/hungary/index.html'), 'utf8');
  check('the Hungary power hub does not claim the product type', hungaryHub.indexOf('/claim-listing/power-transformers/') < 0 && hungaryHub.indexOf('/claim-listing/ganz-transformers-and-electric-rotating-machines/') >= 0);
  const barePages = [];
  function walkHtml(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'transformerpath') return;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walkHtml(abs);
      else if (ent.isFile() && ent.name.endsWith('.html')) {
        const html = fs.readFileSync(abs, 'utf8');
        if (html.indexOf('href="/claim-listing/"') >= 0) barePages.push(path.relative(root, abs));
      }
    });
  }
  walkHtml(root);
  check('no generated page links to /claim-listing/ without a slug', barePages.length === 0, barePages.slice(0, 12).join(', '));
  const { fitWindow } = require('../lib/seo-fit');
  const catalog = require('../lib/seo-catalog');
  const seenTitle = {};
  const seenDesc = {};
  let claimSeoMiss = 0;
  Object.keys(index).forEach(function (slug) {
    const copy = catalog.claimListingCopy('claim-listing/' + slug + '/index.html');
    const title = copy && fitWindow(copy.title, 50, 60, copy && [' | TransformerPath']);
    const description = copy && fitWindow(copy.description, 140, 160, [' Only sourced fields are shown.', ' Independent record on TransformerPath.']);
    if (!copy || title !== copy.title || description !== copy.description) claimSeoMiss++;
    else if (title.length < 50 || title.length > 60 || description.length < 140 || description.length > 160) claimSeoMiss++;
    else if (seenTitle[title] || seenDesc[description]) claimSeoMiss++;
    else { seenTitle[title] = slug; seenDesc[description] = slug; }
  });
  check('each claim page has a unique title and description inside the SEO window', claimSeoMiss === 0, String(claimSeoMiss));
  const bemagCopy = catalog.claimListingCopy('claim-listing/bemag-transformer/index.html');
  check('a claim title names the listing and leaves the form heading unchanged', bemagCopy && bemagCopy.title.indexOf('Bemag') >= 0 && bemagPage.indexOf('<h1>Claim this listing</h1>') >= 0);
  if (failed) {
    console.error('CLAIM LISTING FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('CLAIM LISTING OK');
  }, 30);
}, 30);
