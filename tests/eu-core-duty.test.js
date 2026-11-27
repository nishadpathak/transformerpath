/* EU incorporated-core duty: Article 1(6) rate, or a broker result. */
'use strict';
const fs = require('fs');
const assert = require('assert');
const duty = require('../lib/eu-core-duty');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok  ' + name);
  else {
    failed++;
    console.error('FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

function row(over) {
  return Object.assign({ code: '8504 23 00', origin: 'Japan', weight: 2, unit: 'tonnes' }, over || {});
}

const japan = duty.estimate(row());
check('covered transformer and named origin returns core tonnes times 1140', japan.status === 'estimate' && japan.amountEur === 2280 && japan.tonnes === 2);
check('six-digit heading is accepted when it maps to one CN line', duty.estimate(row({ code: '8504.23' })).amountEur === 2280);
check('split heading is not a number', duty.estimate(row({ code: '8504.22' })).result === duty.BROKER && duty.estimate(row({ code: '8504.22' })).amountEur == null);
check('kilograms are converted before the rate', duty.estimate(row({ code: '85042210', origin: 'China', weight: 1000, unit: 'kg' })).amountEur === 1140);
check('loose grain-oriented steel is not this rate', duty.estimate(row({ code: '7225 11 00' })).result === duty.BROKER && duty.estimate(row({ code: '7226 11 00' })).amountEur == null);
check('standalone core is not this rate', duty.estimate(row({ code: '8504 90 13' })).result === duty.BROKER && duty.estimate(row({ code: '8504 90 13 90', origin: 'China' })).amountEur == null);
check('developing origin outside the laminations column is not a number', duty.estimate(row({ origin: 'India' })).result === duty.BROKER && duty.estimate(row({ origin: 'Brazil' })).amountEur == null);
check('article 5 origins are not a number', duty.estimate(row({ origin: 'Ukraine' })).result === duty.BROKER && duty.estimate(row({ origin: 'Norway' })).amountEur == null && duty.estimate(row({ origin: 'Kenya' })).amountEur == null);
check('annex column origins are calculated', duty.estimate(row({ origin: 'Türkiye', weight: 1.5 })).amountEur === 1710 && duty.estimate(row({ origin: 'Turkey', weight: 1 })).amountEur === 1140 && duty.estimate(row({ origin: 'United Arab Emirates', weight: 1 })).amountEur === 1140);
check('article 1 covers the united states and the united kingdom', duty.estimate(row({ origin: 'United States' })).amountEur === 2280 && duty.estimate(row({ origin: 'United Kingdom' })).amountEur === 2280 && duty.estimate(row({ origin: 'Germany' })).amountEur === 2280);
check('aliases recognise uae korea us and uk', duty.estimate(row({ origin: 'UAE', weight: 1 })).amountEur === 1140 && duty.estimate(row({ origin: 'United Arab Emirates', weight: 1 })).amountEur === 1140 && duty.estimate(row({ origin: 'Korea', weight: 1 })).amountEur === 1140 && duty.estimate(row({ origin: 'South Korea', weight: 1 })).amountEur === 1140 && duty.estimate(row({ origin: 'Republic of Korea', weight: 1 })).amountEur === 1140 && duty.estimate(row({ origin: 'USA' })).amountEur === 2280 && duty.estimate(row({ origin: 'UK' })).amountEur === 2280);
check('an unrecognised origin is not guessed', duty.estimate(row({ origin: 'Narnia' })).result === duty.BROKER && duty.estimate(row({ origin: 'Narnia' })).amountEur == null);
check('switzerland and taiwan are the named non-exempt origins', duty.estimate(row({ code: '8504 33 00', origin: 'Switzerland', weight: 0.25 })).amountEur === 285 && duty.estimate(row({ code: '8504 21 00', origin: 'Taiwan', weight: 2, unit: 'kg' })).amountEur === 2.28);
check('an unrecognised code is not a number', duty.estimate(row({ code: '8511 11 00' })).result === duty.BROKER);
check('a missing core weight does not invent a duty', duty.estimate(row({ weight: '' })).status === 'need_weight' && duty.estimate(row({ weight: 0 })).amountEur == null);
check('a decimal comma is one and a half tonnes, not fifteen', duty.estimate(row({ weight: '1,5' })).amountEur === 1710 && duty.estimate(row({ weight: '1,50' })).tonnes === 1.5);
check('a thousands comma still groups', duty.estimate(row({ weight: '1,500' })).tonnes === 1500);
check('mixed European grouping is read from the last separator', duty.estimate(row({ weight: '1.500,5' })).tonnes === 1500.5 && duty.estimate(row({ weight: '1 500,5' })).tonnes === 1500.5 && duty.estimate(row({ weight: '1,234.5' })).tonnes === 1234.5);
check('a stray comma after a dotted decimal is not a duty', duty.estimate(row({ weight: '1.5,' })).status === 'need_weight' && duty.estimate(row({ weight: '1.5,0' })).amountEur == null && duty.estimate(row({ weight: '1,5.0' })).amountEur == null);
check('a single dot and three digits asks which weight is meant', (function () {
  var asked = duty.estimate(row({ weight: '1.500' }));
  return asked.status === 'confirm_weight' && asked.amountEur == null && asked.decimalEntered === 1.5 && asked.groupedEntered === 1500;
})());
check('one or two digits after a dot stay a decimal', duty.estimate(row({ weight: '1.5' })).tonnes === 1.5 && duty.estimate(row({ weight: '1.50' })).tonnes === 1.5);
check('tonnes are grouped for display', duty.formatGrouped(1500.5) === '1,500.5' && duty.formatGrouped(2) === '2');
check('an unclear comma group is not a duty', duty.estimate(row({ weight: '1,5000' })).status === 'need_weight' && duty.estimate(row({ weight: '1,5000' })).amountEur == null);
check('the rate and the provisional end date are the regulation figures', duty.RATE_EUR_PER_TONNE === 1140 && duty.PROVISIONAL_END === '2027-02-26' && duty.RULE_DATE === '2026-09-18');
check('developing list keeps the annex tail and a diacritic name', duty.DEVELOPING_COUNT === 122 && duty.originStatus('Zimbabwe') === 'exempt' && duty.originStatus("Côte d'Ivoire") === 'exempt');

const page = fs.readFileSync('tools/duty-checker/index.html', 'utf8');
const tools = fs.readFileSync('tools.html', 'utf8');
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
check('page states the estimate disclaimer', page.indexOf('This is an estimate only, not customs advice.') !== -1);
check('page links the OJ text and names the provisional end date', page.indexOf('https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202602133') !== -1 && page.indexOf('TXT/PDF') === -1 && page.indexOf('26 February 2027 is the provisional end date of the measure. It is not a confirmed decision date.') !== -1);
check('origin is a country dropdown', page.indexOf('<select id="duty-origin"') !== -1);
check('page says the rate is the declared core, not the whole unit', page.indexOf('does not use the weight of the whole unit') !== -1 && page.indexOf('standalone laminations or cores') !== -1);
check('tools hub links the duty checker', tools.indexOf('href="/tools/duty-checker/"') !== -1);
check('sitemap lists the duty checker on the regulation date', sitemap.indexOf('https://transformerpath.com/tools/duty-checker/') !== -1 && sitemap.indexOf('<loc>https://transformerpath.com/tools/duty-checker/</loc><lastmod>2026-09-18</lastmod>') !== -1);
check('published script is copied', fs.readFileSync('build-dist.js', 'utf8').indexOf("'lib/eu-core-duty.js'") !== -1);
check('page does not call the end date a decision', page.indexOf('confirmed decision date') !== -1 && page.indexOf('decision date of') === -1);

assert.strictEqual(failed, 0);
console.log('\neu core duty: PASS');
