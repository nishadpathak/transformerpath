#!/usr/bin/env node
/* Writes the free claim form and its confirmation page from the site chrome.
 * Both pages are noindex, so the sitemap builder leaves them out.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync(path.join(root, '_partials/header.html'), 'utf8').trim());
const FOOT = abs(fs.readFileSync(path.join(root, '_partials/footer.html'), 'utf8').trim());
const paid = require(path.join(root, 'lib/paid-listings'));
const declaredOrigin = require(path.join(root, 'lib/declared-origin'));

const VERIFIED = paid.VERIFIED_MANUFACTURER_PAYMENT_LINK;
const FEATURED = paid.PAYMENT_LINKS.featured_listing.url;
const BOTH = paid.PAYMENT_LINKS.featured_verified.url;
const CONFIRM = 'We review claims manually; corrected data appears once verified.';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function payHref(base, slug) {
  if (!slug) return base;
  return base + '?client_reference_id=' + encodeURIComponent(slug);
}

function upgrades(slug) {
  return '<section class="claim-upgrades" aria-label="Upgrade options">'
    + '<h2>Upgrade options</h2>'
    + '<p>Claiming a listing is free. These paid options use the existing checkout links. Payment does not publish a listing before review.</p>'
    + '<a class="btn btn-amber" href="' + payHref(VERIFIED, slug) + '" data-verified-manufacturer-pay="1">Get Verified $499 one-time</a>'
    + '<a class="btn btn-outline" href="' + payHref(FEATURED, slug) + '" data-featured-listing-pay="1">Featured $299/yr</a>'
    + '<a class="btn btn-outline" href="' + payHref(BOTH, slug) + '" data-featured-verified-pay="1">Featured+Verified $699/yr</a>'
    + '<ul class="claim-inclusions"><li>Featured directory slot</li><li>Reviewed Verified Manufacturer badge</li><li>declared-origin check</li></ul>'
    + '<p class="declared-origin-note">' + declaredOrigin.NOTE + '</p>'
    + '</section>';
}

const css = '<style>'
  + '.claim-page{max-width:720px;margin:0 auto;padding:28px 16px 64px;box-sizing:border-box}'
  + '.claim-page *,.claim-page *::before,.claim-page *::after{box-sizing:border-box}'
  + '.claim-page h1{font-size:clamp(1.55rem,6vw,2.1rem);color:var(--ink);overflow-wrap:anywhere;margin:0 0 8px}'
  + '.claim-page h2{font-size:1.2rem;color:var(--ink);margin:0 0 8px}'
  + '.claim-page p{color:var(--text);line-height:1.55}'
  + '.claim-page .claim-note,.claim-page .claim-confirm{color:var(--muted);font-size:.92rem}'
  + '.claim-form label{display:block;margin:14px 0 4px;font-weight:600;font-size:.9rem;color:var(--ink)}'
  + '.claim-form input[type="text"],.claim-form input[type="email"],.claim-form select,.claim-form textarea{width:100%;max-width:100%;min-width:0;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:var(--text);font:inherit;font-size:1rem}'
  + '.claim-form textarea{min-height:120px;resize:vertical}'
  + '.claim-form input:focus,.claim-form textarea:focus,.claim-form select:focus{outline:2px solid var(--accent);border-color:transparent}'
  + '.claim-checks{border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-top:14px}'
  + '.claim-checks legend{font-weight:700;color:var(--ink);padding:0 4px}'
  + '.claim-checks label{display:flex;gap:8px;align-items:flex-start;font-weight:500;margin:8px 0}'
  + '.claim-checks input{width:auto;margin-top:3px}'
  + '.claim-hp{position:absolute;left:-9999px;height:0;overflow:hidden}'
  + '.claim-upgrades{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin-top:22px}'
  + '.claim-upgrades a{width:100%;max-width:100%;text-align:center;white-space:normal}'
  + '.claim-page .btn{max-width:100%}'
  + '@media (max-width:390px){.claim-page{padding:20px 12px 48px}.claim-form input[type="text"],.claim-form input[type="email"],.claim-form select,.claim-form textarea{font-size:16px}}'
  + '</style>';

function page(opts) {
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n'
    + '<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>' + opts.title + '</title>\n'
    + '<meta name="description" content="' + opts.description + '">\n'
    + '<meta name="robots" content="noindex,follow">\n'
    + '<link rel="canonical" href="' + opts.canonical + '">\n'
    + '<link rel="stylesheet" href="/style.css?v=14">\n'
    + '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg"><link rel="icon" href="/brand/favicon.ico" sizes="any">\n'
    + '<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png">\n'
    + '<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">\n'
    + '<link rel="manifest" href="/manifest.webmanifest">\n'
    + '<meta name="theme-color" content="#0d1b2e">\n'
    + '<link rel="stylesheet" href="/tp-nav.css?v=14">\n'
    + '<link rel="stylesheet" href="/tp-feedback.css?v=14">\n'
    + css + '\n</head>\n<body>\n'
    + HEAD + '\n<main id="main" tabindex="-1" class="claim-page">\n'
    + opts.main + '\n</main>\n'
    + FOOT + '\n'
    + '<script src="/analytics.js?v=7" defer></script>\n'
    + '<script src="/tp-freshness.js?v=7" defer></script>\n'
    + '<script src="/tp-feedback.js?v=7" defer></script>\n'
    + (opts.extra || '')
    + '</body>\n</html>\n';
}

function formMain(row) {
  const company = row ? row.name : '';
  const slug = row ? row.slug : '';
  const website = row ? row.website : '';
  return '<h1>Claim this listing</h1>'
  + '<p>Tell TransformerPath what to correct on a manufacturer listing. The directory does not change until a person checks the claim.</p>'
  + '<p class="claim-confirm" role="status">' + CONFIRM + '</p>'
  + '<p class="claim-note">Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a></p>'
  + '<form id="claimListingForm" class="claim-form" name="claim-listing" method="POST" action="/claim-listing/received/" data-netlify="true" data-netlify-honeypot="bot-field">'
  + '<input type="hidden" name="form-name" value="claim-listing">'
  + '<input type="hidden" name="review_flag" value="manual_review">'
  + '<input type="hidden" name="listing_website" value="' + esc(website) + '">'
  + '<p class="claim-hp" hidden><label>Leave this empty: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>'
  + '<label for="claim-company">Company</label>'
  + '<input id="claim-company" type="text" name="company" required maxlength="160" autocomplete="organization" value="' + esc(company) + '">'
  + '<label for="claim-slug">Slug</label>'
  + '<input id="claim-slug" type="text" name="slug" required maxlength="160" autocomplete="off" spellcheck="false" value="' + esc(slug) + '">'
  + '<p class="claim-note">The slug is the last part of the claim address.</p>'
  + '<label for="claim-role">Role</label>'
  + '<select id="claim-role" name="role" required>'
  + '<option value="">Select a role</option>'
  + '<option value="commercial">Commercial</option>'
  + '<option value="engineering">Engineering</option>'
  + '<option value="operations">Operations</option>'
  + '<option value="marketing">Marketing</option>'
  + '<option value="authorised-representative">Authorised representative</option>'
  + '</select>'
  + '<label for="claim-email">Work email</label>'
  + '<input id="claim-email" type="email" name="email" required maxlength="160" autocomplete="email" inputmode="email">'
  + '<p id="claim-domain-status" class="claim-note" role="status">A work email on the listing website domain is recorded as a domain match. Any other email is flagged for manual review. With JavaScript off, the claim is flagged for manual review.</p>'
  + '<fieldset class="claim-checks"><legend>Fields to correct</legend>'
  + '<label><input type="checkbox" name="correct_fields" value="website"> Website</label>'
  + '<label><input type="checkbox" name="correct_fields" value="city"> City</label>'
  + '<label><input type="checkbox" name="correct_fields" value="country"> Country</label>'
  + '<label><input type="checkbox" name="correct_fields" value="products"> Products</label>'
  + '<label><input type="checkbox" name="correct_fields" value="capacity"> Capacity</label>'
  + '<label><input type="checkbox" name="correct_fields" value="other"> Other</label>'
  + '</fieldset>'
  + '<label for="claim-corrections">What should change</label>'
  + '<textarea id="claim-corrections" name="corrections" required maxlength="4000"></textarea>'
  + '<p class="claim-note">Name each field and the corrected value. Corrected data appears on the listing once it is verified.</p>'
  + '<p style="margin-top:16px"><button class="btn btn-amber" type="submit">Submit claim</button></p>'
  + '<noscript><p class="claim-note">This form submits without JavaScript. ' + CONFIRM + '</p></noscript>'
  + '</form>'
  + upgrades(slug);
}

const notFoundMain = '<h1>Listing not found</h1>'
  + '<p><a href="/directory.html">Back to the directory</a></p>';

const receivedMain = '<h1>Claim received</h1>'
  + '<p class="claim-confirm" role="status">' + CONFIRM + '</p>'
  + '<p class="claim-note">Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a></p>'
  + '<p><a href="/manufacturers.html">Back to manufacturers</a></p>'
  + upgrades('');

const formHtml = page({
  title: 'Claim this listing — TransformerPath',
  description: 'Submit a free correction claim for a TransformerPath manufacturer listing. Claims are reviewed manually.',
  canonical: 'https://transformerpath.com/claim-listing/',
  main: formMain(null),
  extra: '<script src="/claim-listing.js" defer></script>\n'
});

const receivedHtml = page({
  title: 'Claim received — TransformerPath',
  description: 'TransformerPath reviews listing claims manually. Corrected data appears once verified.',
  canonical: 'https://transformerpath.com/claim-listing/received/',
  main: receivedMain
});

const notFoundHtml = page({
  title: 'Listing not found — TransformerPath',
  description: 'Listing not found. Open the directory to find a manufacturer listing.',
  canonical: 'https://transformerpath.com/claim-listing/not-found/',
  main: notFoundMain
});

const claimRoot = path.join(root, 'claim-listing');
fs.mkdirSync(path.join(claimRoot, 'received'), { recursive: true });
fs.readdirSync(claimRoot, { withFileTypes: true }).forEach(function (ent) {
  if (ent.isDirectory() && ent.name !== 'received') {
    fs.rmSync(path.join(claimRoot, ent.name), { recursive: true, force: true });
  }
});
fs.writeFileSync(path.join(claimRoot, 'index.html'), formHtml);
fs.writeFileSync(path.join(claimRoot, 'received', 'index.html'), receivedHtml);
fs.mkdirSync(path.join(claimRoot, 'not-found'), { recursive: true });
fs.writeFileSync(path.join(claimRoot, 'not-found', 'index.html'), notFoundHtml);

const claimIndex = require(path.join(root, 'lib/claim-listing')).buildClaimIndex(root);
fs.writeFileSync(path.join(root, 'data/claim-listing-index.json'), JSON.stringify(claimIndex, null, 2) + '\n');
const slugs = Object.keys(claimIndex);
slugs.forEach(function (slug) {
  const row = claimIndex[slug];
  const html = page({
    title: 'Claim this listing — TransformerPath',
    description: 'Submit a free correction claim for a TransformerPath manufacturer listing. Claims are reviewed manually.',
    canonical: 'https://transformerpath.com/claim-listing/' + slug + '/',
    main: formMain({ name: row.name, slug: slug, website: row.website || '' }),
    extra: '<script src="/claim-listing.js" defer></script>\n'
  });
  const dir = path.join(claimRoot, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
});

const begin = '# BEGIN claim-listing-query-redirects';
const end = '# END claim-listing-query-redirects';
const redirectLines = [begin, '# A slug query is a 301 to /claim-listing/<slug>/. An unknown path returns the not-found page with status 404.'];
slugs.forEach(function (slug) {
  ['/claim-listing/', '/claim-listing'].forEach(function (from) {
    redirectLines.push('[[redirects]]');
    redirectLines.push('  from = "' + from + '"');
    redirectLines.push('  to = "/claim-listing/' + slug + '/"');
    redirectLines.push('  status = 301');
    redirectLines.push('  force = true');
    redirectLines.push('  query = {slug = "' + slug + '"}');
    redirectLines.push('');
  });
});
['/claim-listing/not-found', '/claim-listing/not-found/'].forEach(function (from) {
  redirectLines.push('[[redirects]]');
  redirectLines.push('  from = "' + from + '"');
  redirectLines.push('  to = "/claim-listing/not-found/index.html"');
  redirectLines.push('  status = 404');
  redirectLines.push('  force = true');
  redirectLines.push('');
});
redirectLines.push('[[redirects]]');
redirectLines.push('  from = "/claim-listing/*"');
redirectLines.push('  to = "/claim-listing/not-found/index.html"');
redirectLines.push('  status = 404');
redirectLines.push('');
redirectLines.push(end);
const block = redirectLines.join('\n') + '\n';
const tomlPath = path.join(root, 'netlify.toml');
let toml = fs.readFileSync(tomlPath, 'utf8');
const start = toml.indexOf(begin);
const stop = toml.indexOf(end);
if (start >= 0 && stop > start) {
  toml = toml.slice(0, start) + block + toml.slice(stop + end.length).replace(/^\n/, '');
} else {
  const anchor = '  to = "/directory/country/turkiye/"\n  status = 301\n  force = true\n\n[[redirects]]\n  from = "/manufacturers/czech-republic.html"';
  if (toml.indexOf(anchor) < 0) throw new Error('netlify.toml anchor for claim redirects is missing');
  toml = toml.replace(anchor, '  to = "/directory/country/turkiye/"\n  status = 301\n  force = true\n\n' + block + '\n[[redirects]]\n  from = "/manufacturers/czech-republic.html"');
}
fs.writeFileSync(tomlPath, toml);
console.log('wrote claim-listing pages for ' + slugs.length + ' listings');
