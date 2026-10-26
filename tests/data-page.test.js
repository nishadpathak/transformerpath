/* Sales page for the CSV exports. Counts come from the live JSON.
 * Payment Links are not crawlable anchors.
 */
'use strict';
const fs = require('fs');
const csv = require('../lib/csv-exports');
const pay = require('../lib/csv-pay');
const pageBuilder = require('../build-data-page');

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  PASS  ' + name);
  else { failed++; console.log('  FAIL  ' + name); }
}

function previewCount(html, key) {
  const re = new RegExp('data-csv-preview="' + key + '"[\\s\\S]*?</table>');
  const match = html.match(re);
  if (!match) return -1;
  const body = (match[0].split('<tbody>')[1] || '').split('</tbody>')[0];
  return (body.match(/<tr\b/g) || []).length;
}

pageBuilder.build();
const html = fs.readFileSync('data.html', 'utf8');
const plans = JSON.parse(fs.readFileSync('data/csv-pay-plans.json', 'utf8'));
const directory = JSON.parse(fs.readFileSync('data/directory-index.json', 'utf8'));
const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8'));
const awards = JSON.parse(fs.readFileSync('data/awards.json', 'utf8'));
const terms = fs.readFileSync('terms.html', 'utf8');
const robots = fs.readFileSync('robots.txt', 'utf8');
const script = fs.readFileSync('data-checkout.js', 'utf8');
const visible = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ');

check('directory count is the live index', html.indexOf(directory.companies.length.toLocaleString('en-US')) !== -1 && directory.companies.length > 10);
check('tender count is the live register', html.indexOf((tenders.tenders || []).length.toLocaleString('en-US')) !== -1);
check('award count is the live register', html.indexOf((awards.awards || []).length.toLocaleString('en-US')) !== -1);
check('tender description is the register comment', tenders.$comment && html.indexOf(tenders.$comment) !== -1);
check('award description is the register comment', awards.$comment && html.indexOf(awards.$comment) !== -1);
check('ten-row samples', previewCount(html, 'directory') === 10 && previewCount(html, 'tenders') === 10 && previewCount(html, 'awards') === 10);
['id', 'name', 'kind', 'country', 'tender_id', 'title', 'award_id', 'awardee', 'licence'].forEach(function (field) {
  check('page names the field ' + field, html.indexOf('<code>' + field + '</code>') !== -1);
});
check('licence line is the export licence', html.indexOf(csv.LICENCE) !== -1 && /single company/i.test(csv.LICENCE) && /no resale/i.test(csv.LICENCE));
check('terms sentence is quoted from terms.html', terms.indexOf(pageBuilder.TERMS_SENTENCE) !== -1 && html.indexOf(pageBuilder.TERMS_SENTENCE) !== -1);
check('directory dataset licence URL is on the page', html.indexOf(pageBuilder.DIRECTORY_LICENCE) !== -1 && fs.readFileSync('directory.html', 'utf8').indexOf('"license": "' + pageBuilder.DIRECTORY_LICENCE + '"') !== -1);
check('page has no Payment Link href', html.indexOf('buy.stripe.com') === -1 && html.indexOf('href="https://buy.stripe.com') === -1);
Object.keys(pay.LINKS).forEach(function (product) {
  const spec = pay.LINKS[product];
  check(product + ' is a nofollow click control', html.indexOf('href="#' + product + '" rel="nofollow" data-csv-product="' + product + '"') !== -1 && html.indexOf(spec.button) !== -1);
  check(product + ' plan is the approved link', plans.plans[product] === spec.url && spec.url.indexOf('https://buy.stripe.com/') === 0);
});
check('plan file has only the four approved links', Object.keys(plans.plans).length === 4);
check('checkout script does not embed a Payment Link', script.indexOf('buy.stripe.com') === -1 && script.indexOf('preventDefault') !== -1 && script.indexOf('/data/csv-pay-plans.json') !== -1);
check('robots covers the plan file and the download', /^Disallow:\s*\/data\/csv-pay-plans\.json\s*$/m.test(robots) && /^Disallow:\s*\/data\/download\s*$/m.test(robots));
check('download rewrite remains', fs.readFileSync('netlify.toml', 'utf8').indexOf('from = "/data/download"') !== -1 && fs.readFileSync('netlify.toml', 'utf8').indexOf('from = "/data"') !== -1 && fs.readFileSync('netlify.toml', 'utf8').indexOf('to = "/data.html"') !== -1);
check('contact addresses are hello@transformerpath.com only', (html.match(/mailto:[^"'\s>]+/gi) || []).every(function (mail) { return mail === 'mailto:hello@transformerpath.com'; }) && html.indexOf('hello@transformerpath.com') !== -1);
check('visible text has no undefined, NaN, or null', !/\b(?:undefined|NaN|null)\b/.test(visible));
check('generated CSVs stay gitignored', require('child_process').spawnSync('git', ['check-ignore', '-q', 'data/csv-exports/directory.csv']).status === 0);
check('checkout script is published', fs.readFileSync('build-dist.js', 'utf8').indexOf("'data-checkout.js'") !== -1);
const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
const description = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
check('title is inside the 50 to 60 character window', title.length >= 50 && title.length <= 60);
check('description is inside the 140 to 160 character window', description.length >= 140 && description.length <= 160);

const prices = { csv_directory: 149, csv_tenders: 99, csv_awards: 49, csv_bundle: 249 };
Object.keys(prices).forEach(function (product) {
  check(product + ' shows its approved price', html.indexOf('$' + prices[product]) !== -1 && pay.LINKS[product].amountUsd === prices[product]);
});

const locations = [];
global.window = {
  location: {
    assign: function (url) { locations.push(url); }
  },
  fetch: function () {
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve(plans); }
    });
  }
};
delete require.cache[require.resolve('../data-checkout')];
const click = require('../data-checkout').onClick;
const anchor = {
  getAttribute: function (name) { return name === 'data-csv-product' ? 'csv_tenders' : ''; },
  closest: function () { return anchor; }
};
let prevented = false;
click({
  target: anchor,
  preventDefault: function () { prevented = true; }
});
setTimeout(function () {
  check('a click follows the tenders Payment Link', prevented && locations.length === 1 && locations[0] === pay.LINKS.csv_tenders.url);
  check('the click does not use the anchor href', html.indexOf('href="' + pay.LINKS.csv_tenders.url) === -1);
  if (failed) {
    console.error(failed + ' data page check(s) failed');
    process.exit(1);
  }
  console.log('data page checks passed');
}, 20);
