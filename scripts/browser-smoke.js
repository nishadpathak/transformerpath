#!/usr/bin/env node
/* Post-deploy browser smoke. Playwright is required only when this file is
 * executed. The checks below stay require-able without it.
 *
 * WebKit uses the iPhone 13 device (390px). Chromium uses the same width so
 * overflow is checked on both. A power3d page that has fallen back because
 * WebGL is missing is not a failure; a page with no canvas and no fallback is.
 */
'use strict';

const PAGES = [
  { path: '/', name: 'home', banner: 'home' },
  { path: '/intel', name: 'intel', banner: 'intel' },
  { path: '/intelligence', name: 'intelligence' },
  { path: '/manufacturers/', name: 'manufacturers' },
  { path: '/manufacturers/cg-power/', name: 'maker' },
  { path: '/power3d.html', name: 'power3d', canvas: true },
  { path: '/events', name: 'events' },
  { path: '/pricing.html', name: 'pricing' },
  { path: '/markets/india/', name: 'market' }
];

const THIRD_PARTY = /googletagmanager|google-analytics|googleadservices|doubleclick|facebook\.net|hotjar|clarity\.ms|pagead2?|adservice|googlesyndication|sentry\.io|jsdelivr|unpkg\.com|fonts\.googleapis|fonts\.gstatic|gstatic\.com\/recaptcha|invalid-placard|AdwaitaLayoutTraits/i;

function isIgnoredConsole(text) {
  return THIRD_PARTY.test(String(text || ''));
}

function bannerAgreement(home, stamp, fresh) {
  if (!home || !stamp || !fresh) return { ok: false, detail: 'missing banner' };
  const keys = ['status', 'source', 'checked'];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!home[k] || home[k] !== stamp[k] || home[k] !== fresh[k]) {
      return { ok: false, detail: k + ' home=' + home[k] + ' stamp=' + stamp[k] + ' fresh=' + fresh[k] };
    }
  }
  return { ok: true, detail: home.status + ' · ' + home.source };
}

function overflowVerdict(scrollWidth, clientWidth, overflowX) {
  if (overflowX === 'hidden' || overflowX === 'clip') return true;
  return Number(scrollWidth) <= Number(clientWidth) + 1;
}

/* ready + a canvas is the rendered case. UNAVAILABLE with the static fallback
 * is the honest no-WebGL path and must not fail the deploy. */
function canvasPresent(state) {
  if (state && state.ready && state.hasCanvas) return { ok: true, detail: 'rendered' };
  if (state && state.unavailable && state.hasFallback) return { ok: true, detail: 'fallback' };
  return { ok: false, detail: state ? JSON.stringify(state) : 'missing' };
}

function readBanner() {
  function grab(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return {
      status: el.getAttribute('data-intel-status') || '',
      source: el.getAttribute('data-intel-source') || '',
      checked: el.getAttribute('data-intel-checked') || ''
    };
  }
  return { home: grab('hero-live-pill'), stamp: grab('stamp'), fresh: grab('freshnessLine') };
}

function readOverflow() {
  const doc = document.documentElement;
  return {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    overflowX: getComputedStyle(doc).overflowX
  };
}

function readCanvas() {
  const el = document.getElementById('c3d');
  if (!el) return { ready: false, hasCanvas: false, unavailable: false, hasFallback: false };
  const state = el.getAttribute('data-tp-3d-state') || '';
  return {
    ready: state === 'READY',
    unavailable: state === 'UNAVAILABLE',
    hasCanvas: !!el.querySelector('canvas'),
    hasFallback: !!el.querySelector('.tp-3d-fallback')
  };
}

async function checkPage(page, origin, item) {
  const errors = [];
  function note(kind, text) {
    const line = kind + ': ' + text;
    if (!isIgnoredConsole(line)) errors.push(line);
  }
  page.on('pageerror', function (err) { note('pageerror', err && err.message ? err.message : String(err)); });
  page.on('console', function (msg) {
    if (msg.type() !== 'error') return;
    note('console', msg.text());
  });
  const url = origin.replace(/\/$/, '') + item.path;
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const status = res ? res.status() : 0;
  if (status >= 400) errors.push('http ' + status + ' ' + item.path);
  if (item.canvas) {
    await page.waitForFunction(function () {
      const el = document.getElementById('c3d');
      if (!el) return false;
      const state = el.getAttribute('data-tp-3d-state') || '';
      return state === 'READY' || state === 'UNAVAILABLE';
    }, null, { timeout: 30000 }).catch(function () {});
  }
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(readOverflow);
  const banner = item.banner ? await page.evaluate(readBanner) : null;
  const canvas = item.canvas ? await page.evaluate(readCanvas) : null;
  const problems = [];
  if (errors.length) problems.push(item.name + ' console: ' + errors.slice(0, 4).join(' | '));
  if (!overflowVerdict(overflow.scrollWidth, overflow.clientWidth, overflow.overflowX)) {
    problems.push(item.name + ' overflow ' + overflow.scrollWidth + '>' + overflow.clientWidth);
  }
  if (item.canvas) {
    const canvasResult = canvasPresent(canvas);
    if (!canvasResult.ok) problems.push(item.name + ' canvas ' + canvasResult.detail);
  }
  return { banner: banner, problems: problems };
}

async function runBrowser(playwright, origin) {
  const problems = [];
  let homeBanner = null;
  let intelBanner = null;
  const chromium = await playwright.chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const webkit = await playwright.webkit.launch({ headless: true });
  try {
    const desk = await chromium.newContext({ viewport: { width: 390, height: 844 } });
    const phone = await webkit.newContext(Object.assign({}, playwright.devices['iPhone 13']));
    const deskPage = await desk.newPage();
    const phonePage = await phone.newPage();
    for (let i = 0; i < PAGES.length; i++) {
      const item = PAGES[i];
      const a = await checkPage(deskPage, origin, item);
      const b = await checkPage(phonePage, origin, item);
      problems.push.apply(problems, a.problems.map(function (p) { return 'chromium ' + p; }));
      problems.push.apply(problems, b.problems.map(function (p) { return 'webkit ' + p; }));
      if (item.banner === 'home') homeBanner = a.banner && a.banner.home;
      if (item.banner === 'intel') intelBanner = a.banner;
    }
    await desk.close();
    await phone.close();
  } finally {
    await chromium.close();
    await webkit.close();
  }
  const agree = bannerAgreement(
    homeBanner,
    intelBanner && intelBanner.stamp,
    intelBanner && intelBanner.fresh
  );
  if (!agree.ok) problems.push('banner ' + agree.detail);
  return { ok: problems.length === 0, problems: problems, banner: agree.detail };
}

async function main() {
  const origin = process.argv[2] || 'https://transformerpath.com';
  let playwright;
  try { playwright = require('playwright'); }
  catch (e) {
    console.error('playwright is not installed');
    process.exit(1);
  }
  const result = await runBrowser(playwright, origin);
  if (!result.ok) {
    console.error('BROWSER SMOKE FAIL');
    result.problems.forEach(function (p) { console.error('  ' + p); });
    process.exit(1);
  }
  console.log('BROWSER SMOKE PASS — ' + result.banner);
}

module.exports = {
  PAGES: PAGES,
  isIgnoredConsole: isIgnoredConsole,
  bannerAgreement: bannerAgreement,
  overflowVerdict: overflowVerdict,
  canvasPresent: canvasPresent
};

if (require.main === module) {
  main().catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
