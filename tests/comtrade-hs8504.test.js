#!/usr/bin/env node
/* HS 8504 trade on country and market pages comes from the UN Comtrade
 * snapshot. Missing years stay missing. Pages without rows say so.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const comtrade = require('../lib/comtrade-hs8504');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok  ' + name);
  else {
    failed++;
    console.error('FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

const gapRows = [
  { period: '2024', flowCode: 'X', partnerCode: 0, cmdCode: '8504', primaryValue: 100, fobvalue: 100, cifvalue: null, classificationCode: 'H6', legacyEstimationFlag: 0 },
  { period: '2024', flowCode: 'X', partnerCode: 156, cmdCode: '8504', primaryValue: 40, fobvalue: 40, cifvalue: null, classificationCode: 'H6', legacyEstimationFlag: 0 },
  { period: '2024', flowCode: 'X', partnerCode: 276, cmdCode: '8504', primaryValue: 70, fobvalue: 70, cifvalue: null, classificationCode: 'H6', legacyEstimationFlag: 0 },
  { period: '2022', flowCode: 'X', partnerCode: 0, cmdCode: '8504', primaryValue: 50, fobvalue: 50, cifvalue: null, classificationCode: 'H5', legacyEstimationFlag: 0 }
];
const gap = comtrade.summarizeFlow(gapRows, { 156: 'China', 276: 'Germany' });
check('gap year 2023 is not created', gap.annual.map(function (r) { return r.year; }).join(',') === '2024,2022');
check('world total is the partner 0 value', gap.annual[0].value_usd === 100);
check('partners are not summed into the total', gap.annual[0].value_usd !== 110);
check('top partner is the larger value', gap.partners[0].name === 'Germany' && gap.partners[0].value_usd === 70);
check('world is not a partner', gap.partners.every(function (p) { return p.code !== 0; }));

const truncated = comtrade.summarizeFlow([
  { period: '2024', flowCode: 'M', partnerCode: 0, cmdCode: '8504', primaryValue: 9, cifvalue: 9, fobvalue: null, classificationCode: 'H6', legacyEstimationFlag: 0, _truncated: true },
  { period: '2024', flowCode: 'M', partnerCode: 156, cmdCode: '8504', primaryValue: 8, cifvalue: 8, fobvalue: null, classificationCode: 'H6', legacyEstimationFlag: 0, _truncated: true }
], { 156: 'China' });
check('truncated preview does not rank partners', truncated.partners.length === 0 && /truncated|every partner/i.test(truncated.partners_note));
check('truncated preview still keeps the world total', truncated.annual.length === 1 && truncated.annual[0].value_usd === 9);

const ambiguous = {
  hs: '8504',
  retrieved: '2026-10-16',
  source_url: comtrade.SOURCE_HOME,
  countries: {
    DE: {
      iso: 'DE',
      reporterCode: 276,
      reporterDesc: 'Germany',
      retrieved: '2026-10-16',
      source_url: comtrade.sourceUrl(276),
      years_checked: [2024, 2022],
      empty_reason: '',
      flows: {
        X: gap,
        M: { annual: [], latest_year: null, partners_year: null, partners: [], partners_complete: true, partners_note: '' }
      }
    },
    TW: {
      iso: 'TW',
      reporterCode: null,
      reporterDesc: '',
      retrieved: '2026-10-16',
      source_url: comtrade.SOURCE_HOME,
      years_checked: [],
      empty_reason: 'no_reporter',
      flows: { X: { annual: [], partners: [] }, M: { annual: [], partners: [] } }
    }
  }
};
const deHtml = comtrade.sectionHtml('Germany', ambiguous);
const twHtml = comtrade.sectionHtml('Taiwan', ambiguous);
check('germany section names the years that exist', deHtml.indexOf('2024') !== -1 && deHtml.indexOf('2022') !== -1 && deHtml.indexOf('2023') === -1);
check('germany section shows the world value', deHtml.indexOf(comtrade.formatUsd(100)) !== -1);
check('germany section has the source link and retrieved date', deHtml.indexOf('https://comtradeplus.un.org/TradeFlow?Frequency=A&amp;CommodityCodes=8504&amp;Reporters=276') !== -1 && deHtml.indexOf('Retrieved 16 Oct 2026') !== -1);
check('taiwan section is an empty state', twHtml.indexOf('data-comtrade-empty="1"') !== -1 && twHtml.indexOf('no reporter') !== -1);
check('taiwan section does not invent a value', twHtml.indexOf('US$') === -1);
check('taiwan section still names the source and retrieved date', twHtml.indexOf('UN Comtrade') !== -1 && twHtml.indexOf('Retrieved 16 Oct 2026') !== -1);
check('unknown partner code is not given a guessed name', comtrade.summarizeFlow([
  { period: '2021', flowCode: 'X', partnerCode: 0, cmdCode: '8504', primaryValue: 3, fobvalue: 3, cifvalue: null, classificationCode: 'H5', legacyEstimationFlag: 0 },
  { period: '2021', flowCode: 'X', partnerCode: 99999, cmdCode: '8504', primaryValue: 2, fobvalue: 2, cifvalue: null, classificationCode: 'H5', legacyEstimationFlag: 0 }
], {}).partners[0].name === '');

const snap = comtrade.load();
check('committed snapshot exists', !!snap && snap.hs === '8504' && !!snap.retrieved);
if (snap && snap.countries) {
  const withFigures = Object.keys(snap.countries).filter(function (iso) { return comtrade.hasFigures(snap.countries[iso]); });
  const empty = Object.keys(snap.countries).filter(function (iso) { return !comtrade.hasFigures(snap.countries[iso]); });
  check('snapshot has at least one country with figures', withFigures.length > 0, String(withFigures.length));
  check('snapshot has at least one country without figures', empty.length > 0, empty.join(','));
  withFigures.forEach(function (iso) {
    const rec = snap.countries[iso];
    ['X', 'M'].forEach(function (flow) {
      const annual = (rec.flows[flow] && rec.flows[flow].annual) || [];
      for (let i = 1; i < annual.length; i++) {
        if (annual[i - 1].year - annual[i].year > 1) {
          const missing = annual[i - 1].year - 1;
          const html = comtrade.sectionHtml(rec.name, snap);
          if (html.indexOf('>' + missing + '<') !== -1 || html.indexOf('Years ' + missing) !== -1) {
            check('no filled gap for ' + iso + ' ' + flow, false, String(missing));
          }
        }
      }
      const partners = (rec.flows[flow] && rec.flows[flow].partners) || [];
      for (let i = 1; i < partners.length; i++) {
        if (partners[i].value_usd > partners[i - 1].value_usd) {
          check(iso + ' ' + flow + ' partners are sorted', false);
        }
      }
    });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.retrieved || '')) check(iso + ' has a retrieved date', false, rec.retrieved);
    if (!rec.source_url || rec.source_url.indexOf('comtradeplus.un.org') === -1) check(iso + ' has a Comtrade source link', false, rec.source_url);
  });
  check('live snapshot render keeps retrieved date', comtrade.sectionHtml('Germany', snap).indexOf('Retrieved') !== -1);
  check('live snapshot empty country has no dollar figure', (function () {
    const iso = empty[0];
    if (!iso) return false;
    const html = comtrade.sectionHtml(snap.countries[iso].name || 'Taiwan', snap);
    return html.indexOf('data-comtrade-empty="1"') !== -1 && html.indexOf('US$') === -1;
  })());
}

function pageHasTrade(file) {
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, 'utf8');
  return html.indexOf('id="comtrade-hs8504"') !== -1 && html.indexOf('UN Comtrade') !== -1 && html.indexOf('Retrieved') !== -1;
}
check('Germany market page has the trade section', pageHasTrade('markets/germany/index.html'));
check('Germany country page has the trade section', pageHasTrade('manufacturers/germany.html'));
check('Taiwan country page has an empty trade state', (function () {
  const file = 'manufacturers/taiwan.html';
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, 'utf8');
  return html.indexOf('data-comtrade-empty="1"') !== -1 && html.indexOf('US$') === -1 && html.indexOf('Retrieved') !== -1;
})());
check('markets index names HS 8504', fs.existsSync('markets.html') && fs.readFileSync('markets.html', 'utf8').indexOf('HS 8504') !== -1);

assert.strictEqual(failed, 0);
console.log('\ncomtrade hs8504: PASS');
