#!/usr/bin/env node
/* tests/power3d-canvas-smoke.js
 * Serves the SEO-pass HTML (the bytes production publishes) and checks the
 * power-transformer canvas is actually painted.
 *
 *   node tests/power3d-canvas-smoke.js
 *
 * Needs Playwright with Chromium and WebKit installed. Set TP_SMOKE_ARTIFACTS
 * to a directory to keep the viewport screenshots.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const cwv = require('../lib/seo-cwv');

let playwright;
try {
  playwright = require('playwright');
} catch (e) {
  console.error('playwright is not installed. Install it, then run this again.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const artifacts = process.env.TP_SMOKE_ARTIFACTS || '';
if (artifacts) fs.mkdirSync(artifacts, { recursive: true });

const PAGES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/power3d': 'power3d.html',
  '/power3d.html': 'power3d.html',
  '/hero-3d.html': 'hero-3d.html'
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4'
};

function published(rel) {
  return cwv.apply(fs.readFileSync(path.join(root, rel), 'utf8'), rel, root, {}, []);
}

const rendered = {};
Object.keys(PAGES).forEach(function (urlPath) {
  rendered[urlPath] = Buffer.from(published(PAGES[urlPath]));
});

function startServer() {
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (rendered[url.pathname]) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(rendered[url.pathname]);
      return;
    }
    const rel = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    fs.readFile(file, function (err, buf) {
      if (err) { res.writeHead(404); res.end('missing ' + rel); return; }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve({ server: server, port: server.address().port });
    });
  });
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function pngStats(buf) {
  if (buf.length < 8 || buf[0] !== 137 || buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('screenshot is not a PNG');
  }
  let o = 8;
  let width = 0, height = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (interlace) throw new Error('interlaced PNG');
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!bpp) throw new Error('unsupported PNG color type ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  let offset = 0;
  let sum = 0, sum2 = 0, n = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++];
    const row = Buffer.from(raw.slice(offset, offset + stride));
    offset += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) v = (v + paeth(a, b, c)) & 255;
      row[i] = v;
    }
    prev = row;
    for (let x = 0; x < width; x += 3) {
      const i = x * bpp;
      const lum = colorType === 0 ? row[i] : (0.2126 * row[i] + 0.7152 * row[i + 1] + 0.0722 * row[i + 2]);
      sum += lum;
      sum2 += lum * lum;
      n++;
    }
  }
  const mean = sum / n;
  const variance = Math.max(0, sum2 / n - mean * mean);
  return { width: width, height: height, stdev: Math.sqrt(variance), mean: mean };
}

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

function track(page, origin) {
  const errors = [];
  const missed = [];
  const urls = [];
  page.on('pageerror', function (err) { errors.push(String(err)); });
  page.on('response', function (res) {
    urls.push(res.url());
    let host = '';
    try { host = new URL(res.url()).host; } catch (e) { return; }
    const pathName = new URL(res.url()).pathname;
    // Netlify functions are not part of the static tree this server hosts.
    if (host === origin && res.status() >= 400 && pathName.indexOf('/.netlify/functions/') !== 0) {
      missed.push(res.status() + ' ' + res.url());
    }
  });
  page.on('requestfailed', function (req) {
    let host = '';
    let pathName = '';
    try {
      const u = new URL(req.url());
      host = u.host;
      pathName = u.pathname;
    } catch (e) { return; }
    if (host === origin && pathName.indexOf('/.netlify/functions/') !== 0) {
      missed.push((req.failure() && req.failure().errorText) + ' ' + req.url());
    }
  });
  return { errors: errors, missed: missed, urls: urls };
}

async function shot(page, name) {
  if (!artifacts) return;
  await page.screenshot({ path: path.join(artifacts, name + '.png') });
}

async function canvasShot(locator) {
  return locator.screenshot({ type: 'png' });
}

async function assertPainted(label, png) {
  let stats;
  try { stats = pngStats(png); }
  catch (e) { check(label + ' decodes', false, e.message); return; }
  check(label + ' is non-blank',
    stats.width > 40 && stats.height > 40 && stats.stdev > 8,
    Math.round(stats.width) + 'x' + Math.round(stats.height) + ' stdev ' + stats.stdev.toFixed(1));
}

(async function () {
  console.log('=== POWER3D CANVAS SMOKE ===');
  const started = await startServer();
  const origin = 'http://127.0.0.1:' + started.port;
  const host = '127.0.0.1:' + started.port;
  const iphone = playwright.devices['iPhone 13'];
  const chromiumArgs = ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'];

  async function session(browserType, opts, launchArgs) {
    const browser = await browserType.launch({ headless: true, args: launchArgs || [] });
    const context = await browser.newContext(opts || {});
    const page = await context.newPage();
    const bag = track(page, host);
    return { browser: browser, page: page, bag: bag };
  }

  async function power3d(browserType, name, opts, launchArgs) {
    const s = await session(browserType, opts, launchArgs);
    await s.page.goto(origin + '/power3d', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await s.page.waitForFunction(function () {
      const el = document.getElementById('c3d');
      return el && el.getAttribute('data-tp-3d-state') === 'READY' && el.querySelector('canvas');
    }, null, { timeout: 30000 });
    await s.page.waitForTimeout(400);
    const png = await canvasShot(s.page.locator('#c3d canvas'));
    await assertPainted(name + ' canvas', png);
    await shot(s.page, name);
    check(name + ' has no script errors', s.bag.errors.length === 0, s.bag.errors.join(' | '));
    check(name + ' has no same-origin misses', s.bag.missed.length === 0, s.bag.missed.slice(0, 8).join(' | '));
    const three = s.bag.urls.some(function (u) { return /\/vendor\/three\.min\.js$/.test(u); });
    const gate = s.bag.urls.some(function (u) { return /\/tp-webgl-gate\.js$/.test(u); });
    check(name + ' loads three.js and the gate from the site root', three && gate);
    await s.browser.close();
  }

  async function homeDesktop() {
    const s = await session(playwright.chromium, { viewport: { width: 1440, height: 900 } }, chromiumArgs);
    await s.page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await s.page.waitForFunction(function () {
      const el = document.getElementById('heroViz');
      return el && el.getAttribute('data-tp-3d-state') === 'READY';
    }, null, { timeout: 30000 });
    const frame = s.page.frameLocator('#hero3dFrame');
    await frame.locator('canvas').waitFor({ state: 'visible', timeout: 10000 });
    await s.page.waitForTimeout(400);
    const png = await canvasShot(frame.locator('canvas'));
    await assertPainted('homepage chromium canvas', png);
    await shot(s.page, 'home-chromium');
    const noteHidden = await s.page.locator('#hero3dNote').isHidden();
    check('homepage chromium keeps the unavailable note hidden', noteHidden);
    check('homepage chromium has no script errors', s.bag.errors.length === 0, s.bag.errors.join(' | '));
    check('homepage chromium has no same-origin misses', s.bag.missed.length === 0, s.bag.missed.slice(0, 8).join(' | '));
    await s.browser.close();
  }

  async function homePhone() {
    const s = await session(playwright.webkit, iphone, []);
    await s.page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await s.page.waitForTimeout(4000);
    const early3d = s.bag.urls.some(function (u) {
      return /hero-3d\.html|three\.min\.js/.test(u);
    });
    check('iPhone homepage does not load 3D before a tap', !early3d, s.bag.urls.filter(function (u) {
      return /hero-3d|three\.min/.test(u);
    }).join(' '));
    await s.page.locator('h1').click();
    await s.page.waitForFunction(function () {
      const el = document.getElementById('heroViz');
      return el && el.getAttribute('data-tp-3d-state') === 'READY';
    }, null, { timeout: 30000 });
    const frame = s.page.frameLocator('#hero3dFrame');
    await frame.locator('canvas').waitFor({ state: 'visible', timeout: 10000 });
    await s.page.waitForTimeout(500);
    const png = await canvasShot(frame.locator('canvas'));
    await assertPainted('homepage webkit canvas', png);
    await shot(s.page, 'home-webkit-iphone');
    const noteHidden = await s.page.locator('#hero3dNote').isHidden();
    check('iPhone homepage keeps the unavailable note hidden', noteHidden);
    check('iPhone homepage has no script errors', s.bag.errors.length === 0, s.bag.errors.join(' | '));
    check('iPhone homepage has no same-origin misses', s.bag.missed.length === 0, s.bag.missed.slice(0, 8).join(' | '));
    await s.browser.close();
  }

  async function noWebGL() {
    const browser = await playwright.chromium.launch({
      headless: true,
      args: ['--disable-webgl', '--disable-3d-apis']
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const bag = track(page, host);
    await page.goto(origin + '/power3d', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.tp-3d-fallback', { timeout: 10000 });
    const text = await page.locator('.tp-3d-fallback').innerText();
    check('no-WebGL power3d shows the static fallback',
      /Interactive 3D is unavailable in this browser/.test(text) &&
      await page.locator('.tp-3d-fallback img').isVisible());
    const state = await page.locator('#c3d').getAttribute('data-tp-3d-state');
    check('no-WebGL power3d is marked unavailable', state === 'UNAVAILABLE', state);
    check('no-WebGL power3d does not throw', bag.errors.length === 0, bag.errors.join(' | '));
    await shot(page, 'power3d-no-webgl');

    const home = await context.newPage();
    await home.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await home.waitForFunction(function () {
      const note = document.getElementById('hero3dNote');
      return note && note.hidden === false;
    }, null, { timeout: 10000 });
    const poster = await home.locator('#heroViz img').isVisible();
    const frame = await home.locator('#hero3dFrame').count();
    check('no-WebGL homepage keeps the poster and the note', poster && frame === 0);
    await shot(home, 'home-no-webgl');
    await browser.close();
  }

  try {
    await power3d(playwright.chromium, 'power3d-chromium', { viewport: { width: 1440, height: 900 } }, chromiumArgs);
    await power3d(playwright.webkit, 'power3d-webkit-iphone', iphone, []);
    await homeDesktop();
    await homePhone();
    await noWebGL();
  } catch (err) {
    console.error(err);
    failed++;
  } finally {
    started.server.close();
  }

  if (failed) {
    console.error('\n' + failed + ' power3d canvas smoke check(s) failed');
    process.exit(1);
  }
  console.log('\nPower3d canvas smoke passed.');
})();
