#!/usr/bin/env node
/* tests/adsense-inject.test.js — loader, one slot, collapsed placeholder. */
'use strict';

const inject = require('../adsense-inject');
const cfg = inject.cfg;
let problems = [];

function ok(cond, msg) {
  console.log((cond ? '  ok — ' : '  ✗ ') + msg);
  if (!cond) problems.push(msg);
}

const HOME = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Home</title></head>' +
  '<body><section class="hero"><h1>Hero</h1></section><main><p>Body</p></main></body></html>';
const home = inject.stampHtml(HOME, 'index.html');
ok(inject.headInner(home).indexOf(cfg.LOADER) !== -1, 'homepage loader is inside head');
ok(home.split(cfg.LOADER).length === 2, 'homepage loader appears once');
ok(home.indexOf('data-tp-ad="in-content"') === -1, 'homepage has no manual slot');
ok(home.indexOf('/consent.js') !== -1, 'homepage gains the consent banner script');
ok(inject.stampHtml(home, 'index.html') === home, 'stamping twice does not duplicate the loader');

const ARTICLE = '<!DOCTYPE html><html><head><title>Z</title></head><body><main class="k-wrap">' +
  '<h1>Title</h1><div class="quick">Quick</div><h2 id="a">First</h2><p>Paragraph one.</p>' +
  '<h2 id="b">Second</h2><p>Paragraph two.</p></main></body></html>';
const article = inject.stampHtml(ARTICLE, 'knowledge/transformer-impedance.html');
const slotAt = article.indexOf('<aside class="tp-ad');
const firstP = article.indexOf('Paragraph one.</p>') + 'Paragraph one.</p>'.length;
const secondH = article.indexOf('<h2 id="b">');
ok(slotAt === firstP, 'knowledge slot sits after the first section');
ok(slotAt < secondH, 'knowledge page has a single slot before the next section');
ok(article.split('data-tp-ad="in-content"').length === 2, 'knowledge article has one slot');
ok(article.indexOf('>Advertisement<') !== -1, 'slot is labelled Advertisement');
ok(article.indexOf('data-ad-slot="' + cfg.INCONTENT_SLOT + '"') !== -1, 'slot id comes from the constant');
ok(article.indexOf('hidden') !== -1 && article.indexOf('tp-ad-collapsed') !== -1, 'placeholder slot is collapsed');
ok(article.indexOf('<h1>Title</h1>') < slotAt, 'knowledge slot is below the title');

const PRICING = '<!DOCTYPE html><html><head></head><body><h1>Pricing</h1><section class="hero"></section></body></html>';
const pricing = inject.stampHtml(PRICING, 'pricing.html');
ok(pricing.indexOf(cfg.LOADER) !== -1, 'pricing still gets the loader');
ok(pricing.indexOf('data-tp-ad') === -1, 'pricing has no manual slot');
ok(inject.isSlotExcluded('admin/discovery-desk.html'), 'admin paths are excluded');
ok(inject.isSlotExcluded('checkout-success.html'), 'checkout pages are excluded');
ok(!inject.wantsInContentSlot('events.html'), 'events pages are loader-only');
ok(inject.wantsInContentSlot('directory.html') && inject.wantsInContentSlot('manufacturers.html'), 'directory lists get a slot');
ok(inject.wantsInContentSlot('intel.html'), 'intel list gets a slot');

const INTEL = '<!DOCTYPE html><html><head></head><body><section class="hero intel-hero"><h1>Daily</h1></section>' +
  '<div id="intel-timeline"><article class="intel-post">One</article><article>Two</article></div></body></html>';
const intel = inject.stampHtml(INTEL, 'intel.html');
const heroEnd = intel.indexOf('</section>');
ok(intel.indexOf('data-tp-ad="in-content"') > heroEnd, 'intel slot is below the hero');
ok(intel.indexOf('<aside class="tp-ad') < intel.indexOf('id="intel-timeline"'), 'intel slot sits outside the feed the script rewrites');
ok(intel.split('</article>').length === 3, 'intel still has both stories');

const DIR = '<!DOCTYPE html><html><head></head><body><h1>Directory</h1><p>Intro</p>' +
  '<div id="directoryRoot"><p>Loading</p></div></body></html>';
const dir = inject.stampHtml(DIR, 'directory.html');
ok(dir.indexOf('data-tp-ad="in-content"') > dir.indexOf('</h1>'), 'directory slot is below the title');
ok(dir.indexOf('data-tp-ad="in-content"') < dir.indexOf('id="directoryRoot"'), 'directory slot precedes the list');

const MFG = '<!DOCTYPE html><html><head></head><body><section class="hero"><h1>Makers</h1></section>' +
  '<p id="count"><!--/SSR:mfg-count-->Showing 1<!--/SSR:mfg-count--></p><div id="board"></div></body></html>';
const mfg = inject.stampHtml(MFG, 'manufacturers.html');
ok(mfg.indexOf('data-tp-ad="in-content"') > mfg.indexOf('</section>'), 'manufacturer slot is below the hero');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nadsense inject tests passed');
