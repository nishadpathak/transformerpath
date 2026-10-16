#!/usr/bin/env node
/* An award is a contract result. A procurement plan, a framework announcement
 * and an MoU are not awards. Every award names an awardee and cites a source
 * that describes a contract award.
 */
'use strict';
const fs = require('fs');
const {
  nonAwardKind,
  validateAward,
  describesContractAward,
  awardeeFromTitle,
} = require('../lib/award-classification');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

const kahramaaTitle = 'KAHRAMAA 2026 plan: 198 tenders worth QR21.4bn ($5.9bn); QR8.9bn for transmission';
const kahramaaBody = "Qatar's 2026 procurement programme spans 198 tenders (~$5.9bn); electricity transmission accounts for QR8.9bn ($2.4bn). Awards expected through H2 2026.";
check('KAHRAMAA plan is a procurement plan', nonAwardKind(kahramaaTitle + '\n' + kahramaaBody, kahramaaTitle) === 'procurement_plan');
check('a procurement plan is not a contract award', !describesContractAward({ title: kahramaaTitle, snippet: kahramaaBody }));

const framework = {
  title: 'Svenska kraftnät main grid expansion framework',
  epc: 'NYAB (collaboration contract)',
  source: 'NYAB press release',
  award_basis: 'NYAB signed a contract for Phase 1 planning and design. Phase 2, the construction order, is not yet secured.',
  source_urls: ['https://nyabgroup.com/en/newsroom/nyab-signs-collaboration-contract-with-svenska-kraftnat-for-main-grid-expansion/'],
};
check('framework title is not an award', nonAwardKind(framework.title, framework.title) === 'framework');
check('framework record fails award validation', validateAward(framework).length > 0);

check('award without an awardee fails', validateAward({
  title: 'Grid package awarded',
  source: 'Utility awards the package',
  source_urls: ['https://example.gov/award'],
}).indexOf('missing awardee') >= 0);
check('award whose source does not describe a contract fails', validateAward({
  title: 'North corridor reinforcement',
  awardee: 'Example EPC',
  source: 'Project page',
  source_urls: ['https://example.gov/projects/north-corridor'],
}).indexOf('source does not describe a contract award') >= 0);
check('an awards-to title names the supplier', awardeeFromTitle('Stadtwerke Saarbrücken Netz awards a 10 kV switchgear for substation BBH to NATUS') === 'NATUS');
check('an awards-to title keeps a two-word supplier', awardeeFromTitle('Red Eléctrica awards three 220 kV GIS bays to Siemens Energy') === 'Siemens Energy');
check('a title without a named supplier stays empty', awardeeFromTitle('Grid package awarded') === '');

check('named winner with award language passes', validateAward({
  title: 'China XD wins SGCC equipment tenders',
  awardee: 'China XD',
  snippet: 'China XD announced that subsidiaries won the procurement.',
  source_urls: ['https://www.jiemian.com/article/14811421.html'],
}).length === 0);

const intelDoc = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
let saarbrucken = null;
Object.keys(intelDoc).forEach(function (region) {
  ((intelDoc[region] && intelDoc[region].items) || []).forEach(function (it) {
    if (/Stadtwerke Saarbrücken Netz awards/.test(it.title || '')) saarbrucken = it;
  });
});
check('Saarbrücken TED notice names NATUS GmbH & Co. KG', saarbrucken && saarbrucken.awardee === 'NATUS GmbH & Co. KG', saarbrucken && saarbrucken.awardee);

const awards = JSON.parse(fs.readFileSync('data/awards.json', 'utf8')).awards;
const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8')).tenders;
const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
const index = fs.readFileSync('index.html', 'utf8');

check('no award is a plan, framework or MoU', awards.every(function (a) {
  return !nonAwardKind([a.title, a.award_basis, a.source].join('\n'), a.title);
}));
check('every award record validates', awards.every(function (a) { return validateAward(a).length === 0; }));
check('KAHRAMAA plan is not in awards', !awards.some(function (a) { return /KAHRAMAA 2026 plan/.test(a.title); }));
check('Svenska framework is not in awards', !awards.some(function (a) { return /main grid expansion framework/.test(a.title); }));

const kahramaa = tenders.find(function (t) { return /KAHRAMAA 2026 plan/.test(t.title); });
const svenska = tenders.find(function (t) { return /main grid expansion framework/.test(t.title); });
check('KAHRAMAA tender is a procurement plan', kahramaa && kahramaa.status === 'PROCUREMENT_PLAN', kahramaa && kahramaa.status);
check('Svenska tender is a framework', svenska && svenska.status === 'FRAMEWORK', svenska && svenska.status);

check('homepage award total matches awards.json', stats.awards === awards.length, stats.awards + ' vs ' + awards.length);
check('homepage visible count matches', index.indexOf('data-stat="awards">' + awards.length) >= 0);
check('homepage title matches the tracked total', index.indexOf('title="' + awards.length + ' awards tracked, split by transformer scope"') >= 0);
check('scope split sums to the tracked total', stats.awardsConfirmed + stats.awardsInferred + stats.awardsUnknown === awards.length);

if (failed) {
  console.error('AWARD CLASSIFICATION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('AWARD CLASSIFICATION OK (' + awards.length + ' awards)');
