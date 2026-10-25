#!/usr/bin/env node
/* tests/adsense-inject.test.js — loader and one slot on article and learn pages. */
'use strict';

const fs = require('fs');
const inject = require('../adsense-inject');
const cwv = require('../lib/seo-cwv');
const cfg = inject.cfg;
let problems = [];

function ok(cond, msg) {
  console.log((cond ? '  ok — ' : '  ✗ ') + msg);
  if (!cond) problems.push(msg);
}

const HOME = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Home</title></head>' +
  '<body><section class="hero"><h1>Hero</h1></section><main><p>Body</p></main></body></html>';
const home = inject.stampHtml(HOME, 'index.html');
ok(home.indexOf(cfg.LOADER) === -1, 'homepage does not gain the AdSense loader');
ok(home.indexOf('adsbygoogle') === -1, 'homepage has no AdSense script');
ok(home.indexOf('data-tp-ad="in-content"') === -1, 'homepage has no manual slot');
ok(home.indexOf('/consent.js') !== -1, 'homepage gains the consent banner script');
ok(inject.stampHtml(home, 'index.html') === home, 'stamping the homepage twice stays ad-free');

const DIRTY = HOME.replace('</head>', cfg.LOADER + '</head>').replace(
  '</h1>',
  '</h1><aside class="tp-ad" data-tp-ad="in-content"><ins class="adsbygoogle"></ins></aside><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>'
);
const cleaned = inject.stampHtml(DIRTY, 'manufacturers.html');
ok(cleaned.indexOf('adsbygoogle') === -1 && cleaned.indexOf('data-tp-ad') === -1, 'directory pages lose a pre-existing loader and slot');
const cwvClean = cwv.apply(DIRTY, 'index.html', '.', {}, []);
ok(cwvClean.indexOf('adsbygoogle') === -1, 'seo pass strips the loader from non-article pages');

const ARTICLE = '<!DOCTYPE html><html><head><title>Z</title></head><body><main class="k-wrap">' +
  '<h1>Title</h1><div class="quick">Quick</div><h2 id="a">First</h2><p>Paragraph one.</p>' +
  '<h2 id="b">Second</h2><p>Paragraph two.</p></main></body></html>';
const article = inject.stampHtml(ARTICLE, 'knowledge/transformer-impedance.html');
const slotAt = article.indexOf('<aside class="tp-ad');
const firstP = article.indexOf('Paragraph one.</p>') + 'Paragraph one.</p>'.length;
const secondH = article.indexOf('<h2 id="b">');
ok(inject.wantsAds('knowledge/transformer-impedance.html'), 'knowledge article is an ad page');
ok(slotAt === firstP, 'knowledge slot sits after the first section');
ok(slotAt < secondH, 'knowledge page has a single slot before the next section');
ok(article.split('data-tp-ad="in-content"').length === 2, 'knowledge article has one slot');
ok(article.indexOf('>Advertisement<') !== -1, 'slot is labelled Advertisement');
ok(article.indexOf('data-ad-slot="' + cfg.INCONTENT_SLOT + '"') !== -1, 'slot id comes from the constant');
ok(article.indexOf('hidden') !== -1 && article.indexOf('tp-ad-collapsed') !== -1, 'placeholder slot is collapsed');
ok(article.indexOf('<h1>Title</h1>') < slotAt, 'knowledge slot is below the title');
ok(inject.headInner(article).indexOf(cfg.LOADER) !== -1, 'knowledge article loader is inside head');
ok(article.split(cfg.LOADER).length === 2, 'knowledge article loader appears once');
ok(inject.stampHtml(article, 'knowledge/transformer-impedance.html') === article, 'stamping an article twice does not duplicate the loader');

const PRICING = '<!DOCTYPE html><html><head></head><body><h1>Pricing</h1><section class="hero"></section></body></html>';
const pricing = inject.stampHtml(PRICING, 'pricing.html');
ok(pricing.indexOf(cfg.LOADER) === -1, 'pricing does not get the loader');
ok(pricing.indexOf('data-tp-ad') === -1, 'pricing has no manual slot');
ok(inject.isSlotExcluded('admin/discovery-desk.html'), 'admin paths are excluded');
ok(inject.isSlotExcluded('checkout-success.html'), 'checkout pages are excluded');
ok(!inject.wantsAds('events.html'), 'events pages are not ad pages');
ok(!inject.wantsAds('directory.html') && !inject.wantsAds('manufacturers.html'), 'directory lists are not ad pages');
ok(!inject.wantsAds('intel.html'), 'intel list is not an ad page');
ok(!inject.wantsAds('knowledge.html'), 'article index is not an article page');
ok(!inject.wantsAds('education.html') && !inject.wantsAds('academy.html'), 'education directory and academy tools are not learn pages');
ok(!inject.wantsAds('books/volume-0/index.html'), 'coming-soon book stubs are not learn pages');

const LEARN = '<!DOCTYPE html><html><head><title>Learn</title></head><body><main>' +
  '<section class="hero"><h1>Learn</h1><p>Intro</p></section>' +
  '<h2>Track</h2><p>First lesson.</p><h2>Next</h2><p>More.</p></main></body></html>';
const learn = inject.stampHtml(LEARN, 'learn.html');
ok(inject.isLearnPage('learn.html') && inject.wantsInContentSlot('learn.html'), 'learn.html gets a slot');
ok(inject.isLearnPage('engineer-track.html') && inject.isLearnPage('construction-guide.html'), 'track and construction guide are learn pages');
ok(learn.split(cfg.LOADER).length === 2, 'learn page loader appears once');
ok(learn.indexOf('data-tp-ad="in-content"') > learn.indexOf('</section>'), 'learn slot is below the hero');
ok(learn.indexOf('data-tp-ad="in-content"') < learn.indexOf('<h2>Next</h2>'), 'learn slot stays after the first section');
ok(learn.split('data-tp-ad="in-content"').length === 2, 'learn page has one slot');

const GUIDE = '<!DOCTYPE html><html><head><title>Guide</title></head><body><main><h1>Buy early</h1>' +
  '<p>Intro</p><!--tp-ad-slot--><h2>Next</h2><p>Body</p></main></body></html>';
ok(!inject.wantsInContentSlot('buy-early/index.html'), 'buy-early does not get an in-content slot');
ok(!inject.wantsInContentSlot('spare-capacity/index.html'), 'spare-capacity does not get an in-content slot');
ok(!inject.wantsInContentSlot('lead-times/index.html'), 'lead-times does not get an in-content slot');
ok(!inject.wantsInContentSlot('bottlenecks/index.html'), 'bottlenecks hub does not get an in-content slot');
ok(!inject.wantsInContentSlot('bottlenecks/bushings/index.html'), 'bottlenecks bushings page does not get an in-content slot');
ok(!inject.wantsInContentSlot('tools/dga/index.html'), 'DGA tool does not get an in-content slot');
const guide = inject.stampHtml(GUIDE, 'buy-early/index.html');
ok(guide.indexOf('<!--tp-ad-slot-->') !== -1, 'buy-early marker is left in place');
ok(guide.indexOf('data-tp-ad="in-content"') === -1, 'buy-early has no slot');
ok(guide.indexOf(cfg.LOADER) === -1, 'buy-early does not gain the AdSense loader');
ok(guide.indexOf('/consent.js') !== -1, 'buy-early gains the consent script when missing');

const realLearn = inject.stampHtml(fs.readFileSync('learn.html', 'utf8'), 'learn.html');
ok(realLearn.split(cfg.LOADER).length === 2 && realLearn.split('data-tp-ad="in-content"').length === 2, 'published learn.html gets one loader and one slot');
const realHero = realLearn.search(/<section[^>]*class="[^"]*\bhero\b/);
ok(realLearn.indexOf('data-tp-ad="in-content"') > realLearn.indexOf('</section>', realHero), 'published learn slot is below the hero');

const realTrack = inject.stampHtml(fs.readFileSync('engineer-track.html', 'utf8'), 'engineer-track.html');
ok(realTrack.split(cfg.LOADER).length === 2 && realTrack.split('data-tp-ad="in-content"').length === 2, 'engineer track gets one loader and one slot');

const realBuild = inject.stampHtml(fs.readFileSync('construction-guide.html', 'utf8'), 'construction-guide.html');
ok(realBuild.split(cfg.LOADER).length === 2 && realBuild.split('data-tp-ad="in-content"').length === 2, 'construction guide gets one loader and one slot');
ok(realBuild.indexOf('data-tp-ad="in-content"') > realBuild.search(/<h1[\s>]/), 'construction guide slot is below the title');

const realArticle = inject.stampHtml(fs.readFileSync('knowledge/transformer-impedance.html', 'utf8'), 'knowledge/transformer-impedance.html');
ok(realArticle.split(cfg.LOADER).length === 2 && realArticle.split('data-tp-ad="in-content"').length === 2, 'published knowledge article gets one loader and one slot');

const realGuide = inject.stampHtml(fs.readFileSync('guides/us-eu-grid-equipment/index.html', 'utf8'), 'guides/us-eu-grid-equipment/index.html');
ok(inject.isArticlePage('guides/us-eu-grid-equipment/index.html'), 'buyer guide is an article page');
ok(realGuide.split(cfg.LOADER).length === 2 && realGuide.split('data-tp-ad="in-content"').length === 2, 'buyer guide gets one loader and one slot');

const consent = fs.readFileSync('consent.js', 'utf8');
ok(consent.indexOf('adsbygoogle') === -1, 'consent.js does not inject the AdSense loader');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nadsense inject tests passed');
