/* Optional Chromium regression: node build-intel-news.js && node build-tenders.js;
 * CHROMIUM_PATH=/usr/bin/chromium node tests/tender-saved-search-browser.test.js
 * Requires Playwright. All routes use generated local artifacts; real network is blocked.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const board = fs.readFileSync(path.join(root, 'tenders.html'), 'utf8');
const openMark = '<div id="openView">';
const expiredMark = '<div id="expiredView" hidden>';

function fixture(key, title, country, day, verified, eligible = true) {
  const ref = 'FIX-' + key;
  return '<div class="t-row" data-scope="CONFIRMED" data-category="supply" data-product="power-transformer" data-country="' + country +
    '" data-region="Europe" data-title="' + title + '" data-buyer="Fixture Utility" data-ref="' + ref + '"' +
    (eligible ? ' data-alert-key="' + key.repeat(32) + '" data-alert-close="2026-12-' + day +
      'T11:00:00+01:00" data-alert-verified="2026-11-' + verified + '" data-alert-label="' + day + ' Dec 2026 11:00 CET"' : '') +
    '><a class="t-title" href="/tenders/fixture-' + key + '/">' + title +
    '</a><a class="t-notice" data-track-placement="board" href="https://ted.europa.eu/en/notice/-/detail/' +
    ref + '">Official notice</a></div>';
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const scriptErrors = [];
    page.on('pageerror', e => scriptErrors.push(e.message));
    await page.addInitScript(() => { Date.now = () => new Date('2026-11-28T02:00:00Z').getTime(); });
    let html = board;
    const token = 'https://tender-test.invalid';
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== token) return route.abort();
      if (url.pathname === '/tenders.html') return route.fulfill({ contentType: 'text/html', body: html });
      const source = path.join(root, url.pathname);
      if (source.startsWith(root + path.sep) && fs.existsSync(source) && fs.statSync(source).isFile()) {
        return route.fulfill({ path: source });
      }
      return route.abort();
    });

    const initial = fixture('a', 'Fixture extension', 'Germany', '05', '27') +
      fixture('b', 'Fixture stale', 'Germany', '06', '27') +
      fixture('c', 'Fixture equivalent offset', 'Germany', '05', '27');
    const withRows = (open, expired = '') => board.replace(openMark, openMark + open).replace(expiredMark, expiredMark + expired);
    html = withRows(initial);
    await page.goto(token + '/tenders.html');
    await page.locator('#keywordFilter').fill('Fixture');
    await page.locator('#countryFilter').selectOption({ label: 'Germany' });
    await page.locator('#tenderSavedName').fill('Germany fixture');
    await page.locator('#tenderSavedSave').click();
    await page.locator('#tenderAlertsToggle').click();
    assert.match(await page.locator('#tenderAlertsStatus').textContent(), /Tracking is on/);
    assert.equal(await page.locator('#tenderAlertsList li').count(), 0, 'first visit is baseline, not a flood');

    const changed = fixture('a', 'Fixture extension', 'Germany', '08', '28') +
      fixture('b', 'Fixture stale', 'Germany', '12', '27') +
      fixture('c', 'Fixture equivalent offset', 'Germany', '05', '28').replace('11:00:00+01:00', '10:00:00Z') +
      fixture('d', 'Fixture new', 'Germany', '09', '28') +
      fixture('e', 'Fixture new elsewhere', 'India', '10', '28') +
      fixture('f', 'Fixture unverified input', 'Germany', '10', '28', false) +
      fixture('9', 'Fixture duplicate 1', 'Germany', '12', '28') +
      fixture('9', 'Fixture duplicate 2', 'Germany', '13', '28');
    html = withRows(changed, fixture('8', 'Fixture expired only', 'Germany', '04', '28'));
    await page.reload();
    await page.locator('#tenderAlertsList li').first().waitFor();
    const results = await page.locator('#tenderAlertsList li').allTextContents();
    assert.equal(results.length, 2, results.join('\n'));
    assert(results.some(s => /Deadline changed.*Previous deadline: 05 Dec.*Verified deadline: 08 Dec/.test(s)));
    assert(results.some(s => /New on TP: Fixture new/.test(s)));
    assert.equal(await page.locator('#tenderAlertsList a[href^="https://ted.europa.eu"]').count(), 2);
    assert.equal(await page.locator('#tenderAlertsList a[href*="/tenders/fixture-"]').count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);

    await page.reload();
    await page.locator('#tenderAlertsList li').first().waitFor();
    assert.equal(await page.locator('#tenderAlertsList li').count(), 2, 'no duplicate events on same publish');
    await page.locator('#tenderAlertsClear').click();
    await page.reload();
    const saved = page.locator('#tenderSavedSelect option').nth(1);
    await page.locator('#tenderSavedSelect').selectOption(await saved.getAttribute('value'));
    assert.equal(await page.locator('#tenderAlertsList li').count(), 0, 'no replay after clear');
    await page.locator('#tenderAlertsToggle').click();
    assert.match(await page.locator('#tenderAlertsStatus').textContent(), /Tracking is off/);
    await page.locator('#tenderSavedDelete').click();
    assert.equal(await page.locator('#tenderSavedSelect option').count(), 1);
    assert.deepEqual(scriptErrors, []);
    console.log('TENDER SAVED SEARCH BROWSER OK: mobile, opt-in, new/deadline replay, dedupe, source links, clear and delete.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
