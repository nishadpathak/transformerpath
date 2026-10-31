#!/usr/bin/env node
/* X account chrome and the Intel "Post on X" intent link. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const x = require('../lib/x-share');
const site = require('../lib/site-x');

let failed = 0;
function check(label, fn) {
  try {
    fn();
    console.log('  ok ' + label);
  } catch (err) {
    failed++;
    console.error('  FAIL ' + label + ' — ' + err.message);
  }
}

const title = 'China News Service reports the first converter transformer has arrived';
const id = 'news-www-chinanews-com-cn-cj-2026-10-31-10723734-shtm';
const canonical = 'https://transformerpath.com/intel.html#p-' + id;

check('canonical item url is on transformerpath.com', function () {
  assert.strictEqual(x.intelCanonical(id), canonical);
});

check('intent url encodes the title, the item url, and via', function () {
  const href = x.xPostHref(title, canonical);
  const parsed = new URL(href);
  assert.strictEqual(parsed.origin + parsed.pathname, 'https://x.com/intent/post');
  assert.strictEqual(parsed.searchParams.get('text'), title);
  assert.strictEqual(parsed.searchParams.get('url'), canonical);
  assert.strictEqual(parsed.searchParams.get('via'), 'transformerpath');
  assert.ok(href.indexOf('text=') < href.indexOf('&url='));
  assert.ok(href.indexOf('&url=') < href.indexOf('&via='));
});

check('a long title is shortened before encoding', function () {
  const long = 'Transformer '.repeat(40).trim();
  const text = new URL(x.xPostHref(long, canonical)).searchParams.get('text');
  assert.ok(text.length <= x.TITLE_MAX);
  assert.ok(text.length > 20);
});

check('ampersands in a title stay inside the text parameter', function () {
  const href = x.xPostHref('Oil & gas transformers', canonical);
  const parsed = new URL(href);
  assert.strictEqual(parsed.searchParams.get('text'), 'Oil & gas transformers');
  assert.strictEqual(parsed.searchParams.get('via'), 'transformerpath');
});

check('header and footer partials use the shared anchors', function () {
  const header = fs.readFileSync(path.join(__dirname, '..', '_partials/header.html'), 'utf8');
  const standalone = fs.readFileSync(path.join(__dirname, '..', '_partials/header-standalone.html'), 'utf8');
  const footer = fs.readFileSync(path.join(__dirname, '..', '_partials/footer.html'), 'utf8');
  assert.ok(header.indexOf(site.HEADER_LINK) !== -1);
  assert.ok(standalone.indexOf(site.HEADER_LINK) !== -1);
  assert.ok(footer.indexOf(site.FOOTER_LINK) !== -1);
  [header, standalone, footer].forEach(function (html) {
    assert.ok(html.indexOf('href="https://x.com/transformerpath"') !== -1);
    assert.ok(html.indexOf('target="_blank"') !== -1);
    assert.ok(html.indexOf('rel="noopener"') !== -1);
    assert.ok(html.indexOf('aria-label="TransformerPath on X"') !== -1);
  });
});

check('footer insert is one account link and leaves an existing one', function () {
  const sample = '<footer><a class="tp-li-btn tp-li-follow" data-linkedin-follow href="https://www.linkedin.com/company/transformerpath">Follow us on LinkedIn</a></footer>';
  const once = site.ensureFooterAccount(sample);
  assert.strictEqual((once.match(/x\.com\/transformerpath/g) || []).length, 1);
  assert.ok(once.indexOf('Follow us on X') !== -1);
  assert.ok(once.indexOf('data-linkedin-follow') !== -1);
  assert.strictEqual(site.ensureFooterAccount(once), once);
  assert.deepStrictEqual(site.chromeGaps(once), []);
});

check('header insert lands in the utility cluster', function () {
  const sample = '<header><nav class="tpnav"><span class="tpnav-utils"><a href="search.html">Search</a></span></nav></header><footer><p>Hi</p></footer>';
  const next = site.ensureSiteX(sample);
  assert.ok(next.indexOf('<span class="tpnav-utils">' + site.HEADER_LINK) === next.indexOf('<span class="tpnav-utils">'));
  assert.ok(next.indexOf('Follow us on X') > next.indexOf('<footer'));
  assert.strictEqual(site.ensureSiteX(next), next);
});

check('a custom header still gets the account link', function () {
  const sample = '<header class="gl-topbar"><div class="gl-top-links"><a href="academy.html">Academy</a></div></header>';
  const next = site.ensureHeaderAccount(sample);
  assert.ok(next.indexOf('<div class="gl-top-links">' + site.HEADER_LINK) !== -1);
  assert.deepStrictEqual(site.chromeGaps(next), []);
});

check('a script that mentions a footer is not rewritten', function () {
  const sample = '<header><nav class="tpnav"><span class="tpnav-utils"></span></nav></header>' +
    '<script>var x = "<footer><a data-linkedin-follow href=\\"https://www.linkedin.com/company/transformerpath\\">Follow us on LinkedIn</a></footer>";</script>' +
    '<footer><a data-linkedin-follow href="https://www.linkedin.com/company/transformerpath">Follow us on LinkedIn</a></footer>';
  const next = site.ensureSiteX(sample);
  assert.ok(next.indexOf('var x = "<footer>') !== -1);
  assert.strictEqual((next.match(/Follow us on X/g) || []).length, 1);
});

check('intel renderers build the intent link from the item id', function () {
  ['intel-feed-ui.js', 'build-intel-feed-ui.js', 'build_ssr.js'].forEach(function (file) {
    const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.ok(src.indexOf('xPostHref') !== -1, file);
    assert.ok(src.indexOf('intelCanonical') !== -1, file);
    assert.ok(src.indexOf('class="tp-x-post"') !== -1, file);
    assert.ok(src.indexOf('rel="noopener"') !== -1, file);
    assert.ok(src.indexOf('>Post on X<') !== -1, file);
  });
  const browser = fs.readFileSync(path.join(__dirname, '..', 'intel-feed-ui.js'), 'utf8');
  const fn = browser.match(/function xPostHref\(title, pageUrl\) \{[\s\S]*?\n  \}/);
  const canon = browser.match(/function intelCanonical\(id\) \{[\s\S]*?\n  \}/);
  assert.ok(fn && canon);
  const built = new Function(fn[0] + '\n' + canon[0] + '\nreturn { xPostHref: xPostHref, intelCanonical: intelCanonical };')();
  assert.strictEqual(built.xPostHref(title, built.intelCanonical(id)), x.xPostHref(title, canonical));
});

if (failed) {
  console.error('X SHARE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('X SHARE OK');
