#!/usr/bin/env node
/* First data-correctness audit. Source records and the derived tender/profile
 * output must agree with the text already on file. Nothing here invents a fact.
 *
 * Run after build-tenders.js, build-company-pages.js and build-site-stats.js.
 */
'use strict';
const fs = require('fs');
const { countryFromText, isoDateInText, usableSource } = require('../lib/tender-country');
const { classifyOpenDeadline } = require('../lib/deadline');
const { closedReason, itemIsActive } = require('../lib/intel-activity');
const { isUpcoming, platformToday } = require('../lib/event-status');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

console.log('=== DATA CORRECTNESS AUDIT ===');
const TODAY = '2026-10-15';

check('Dubai / DEWA names the UAE', countryFromText('DEWA floats a tender in Dubai South') === 'United Arab Emirates');
check('German TSO names Germany', countryFromText('German TSO Amprion opens procurement') === 'Germany');
check('Iraq in the title names Iraq', countryFromText('Iraq Ministry of Electricity to procure transformers') === 'Iraq');
check('a text with no place stays blank', countryFromText('Pinggao Electric wins a procurement') === '');
check('bid closing 28 Oct 2026 is an ISO date', isoDateInText('Bid closing 28 Oct 2026') === '2026-10-28');
check('a bare year is not a deadline', isoDateInText('expected H2 2026') === '');
check('example.com is not a source', !usableSource('https://example.com/upd'));
check('an https report is a source', usableSource('https://www.saudigulfprojects.com/2026/04/kahramaa-invites-bids-for-2026-power-transmission-system-expansion-project/'));

const passed = { title: 'Closed lot', tender_close_date: '2026-09-20', is_active: true, snippet: 'tender still mentioned' };
check('a passed close date is not active', itemIsActive(passed, TODAY) === false);
check('the close date is the reason', /2026-09-20/.test(closedReason(passed, TODAY)));
const stillOpen = { title: 'DEWA tender', tender_close_date: '2026-10-28', is_active: true, snippet: 'Bid closing 28 Oct 2026' };
check('28 Oct 2026 is still active on 15 Oct', itemIsActive(stillOpen, TODAY) === true);
const labeled = { title: 'Oman tender', is_active: false, closed_reason: 'Consulting-proposal deadline of 21 June 2026 has passed.', snippet: 'international tender' };
check('an explicit closed reason beats the word tender', itemIsActive(labeled, TODAY) === false);

const makers = JSON.parse(fs.readFileSync('data/manufacturer-intel.json', 'utf8')).companies;
const ireland = makers.find(function (c) { return c.slug === 'cg-power-systems-ireland-formerly-pauwels-ireland'; });
check('Ireland profile is on file', !!ireland);
check('Cavan does not carry the 146,000 MVA group figure', !ireland.reported_mva);
check('Cavan does not carry the 400 kV group figure', !ireland.reported_voltage);
check('the note says the figures are Bhopal and Malanpur', /Bhopal and Malanpur/.test(ireland.sources.capability_note) && /not a sourced rating for the Cavan plant/.test(ireland.sources.capability_note));

const india = makers.find(function (c) { return c.slug === 'cg-power-and-industrial-solutions'; });
check('the Indian CG record still has the annual-report capacity', india && /146,000/.test(String(india.reported_mva || '')));

const feed = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
check('the North America copy of the AEP Ohio item is gone', !feed['North America']);
const usaAep = (feed.USA.items || []).filter(function (it) {
  return it.url === 'https://www.utilitydive.com/news/aep-ohio-puco-transmission-filing-data-centers/829104/';
});
check('the unbacked AEP Ohio item is retired from every region', usaAep.length === 0);
const RETIRED_URLS = ['tndindia.com/pgcil-approves-investment', 'al-babtain-awarded-al-hasa-north', 'siemens-energy-tennet-complete-balwin3-fat', 'bad-honnef-testing-expansion', 'dewa-floats-12-substation-tender', 'aep-ohio-puco-transmission-filing-data-centers'];
check('none of the six unbacked intel items remain', !JSON.stringify(feed).match(new RegExp(RETIRED_URLS.join('|').replace(/\./g, '\\.'))));

function findItem(title) {
  let hit = null;
  Object.keys(feed).forEach(function (k) {
    (feed[k].items || []).forEach(function (it) { if (it.title === title) hit = it; });
  });
  return hit;
}
check('the unbacked DEWA twelve-substation item is gone', !findItem('DEWA floats EPC tender for twelve 132/11 kV substations in Dubai South and Expo Valley development zones'));
const amprion = findItem('Amprion launches tender for decentralised grid booster projects');
check('Amprion item is Germany', amprion && amprion.country === 'Germany');
const iraq = findItem('Iraq Ministry of Electricity to procure 4,026 locally-made transformers');
check('Iraq procurement item is Iraq', iraq && iraq.country === 'Iraq');
const oman = findItem('Oman (Nama) floats international tender for 800–1,000 MW green-hydrogen power plant');
check('Oman consulting deadline is not shown as open', oman && oman.is_active === false && /21 June 2026/.test(oman.closed_reason));

let staleActive = 0;
Object.keys(feed).forEach(function (k) {
  (feed[k].items || []).forEach(function (it) {
    const close = String(it.tender_close_date || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(close) && close < TODAY && it.is_active !== false) staleActive++;
  });
});
check('no intel item with a passed close date is still active', staleActive === 0, String(staleActive));

const projects = JSON.parse(fs.readFileSync('data/projects.json', 'utf8')).projects;
const kah = projects.find(function (p) { return /KAHRAMAA 2026 transmission expansion EPC/.test(p.project); });
check('KAHRAMAA no longer cites example.com', kah && kah.sources.every(usableSource));
check('KAHRAMAA uses the SaudiGulf report already cited for this package', kah && kah.sources[0].indexOf('saudigulfprojects.com/2026/04/kahramaa-invites-bids') >= 0);
check('KAHRAMAA transformer scope is inferred, not confirmed', kah && kah.transformer_requirement === 'INFERRED');
const gcc = projects.find(function (p) { return p.project === 'GCCIA Saudi-Kuwait interconnection'; });
check('GCCIA Saudi-Kuwait now cites real sources', gcc && gcc.sources.length >= 1 && gcc.sources.every(usableSource));
check('GCCIA no longer carries the withheld note', gcc && !gcc.source_note);
const cim = projects.find(function (p) { return /Cimarr/.test(p.project); });
check('Cimarron is operating', cim && cim.status === 'energized');
const asw = projects.find(function (p) { return /Atlantic Shores South/.test(p.project); });
check('Atlantic Shores South is cancelled', asw && asw.status === 'cancelled');

const tenders = JSON.parse(fs.readFileSync('data/tenders.json', 'utf8'));
const rows = tenders.tenders || [];
function tender(title) { return rows.find(function (t) { return t.title === title; }); }
check('the fake DEWA twelve-substation tender is gone', !tender('DEWA floats EPC tender for twelve 132/11 kV substations in Dubai South and Expo Valley development zones'));
check('no tender is open without an exact deadline', rows.every(function (t) { return (t.status !== 'OPEN' && t.status !== 'CLOSING_SOON') || /^\d{4}-\d{2}-\d{2}$/.test(t.deadline || ''); }));
const omanT = tender('Oman (Nama) floats international tender for 800–1,000 MW green-hydrogen power plant');
check('Oman Nama consulting deadline is not an open tender', omanT && omanT.status === 'CLOSED', omanT && omanT.status);
check('Oman Nama deadline is 21 June 2026', omanT && omanT.deadline === '2026-06-21', omanT && omanT.deadline);
const zdas = tender('ŽĎAS tenders a 110 kV switchyard rebuild with two 110/22/6.3 kV transformers');
check('ŽĎAS tender country is Czechia', zdas && zdas.country === 'Czechia', zdas && zdas.country);
const mondragon = tender('Mondragon solar project tenders floating transformer substations');
check('Mondragon tender country is France', mondragon && mondragon.country === 'France', mondragon && mondragon.country);
check('Mondragon stays open through 16 Oct 2026 12:00 UTC', classifyOpenDeadline('2026-10-16', '2026-10-16T12:00:00.000Z') !== 'CLOSED');
check('Mondragon status follows the deadline clock', mondragon && mondragon.status === classifyOpenDeadline(mondragon.deadline), mondragon && mondragon.status);
const policy = tender('India grants 2-year public-procurement exemption to four Chinese-owned transformer/equipment subsidiaries');
check('the India procurement-exemption story is not a tender', !policy);
check('no tender uses a region name as its country', rows.every(function (t) {
  return ['Europe', 'Asia', 'Africa', 'Middle East', 'North America', 'Latin America', 'Oceania', 'Other'].indexOf(t.country) < 0;
}));
const ampT = tender('Amprion launches tender for decentralised grid booster projects');
check('Amprion tender country is Germany', ampT && ampT.country === 'Germany', ampT && ampT.country);
const iraqT = tender('Iraq Ministry of Electricity to procure 4,026 locally-made transformers');
check('Iraq tender country is Iraq', iraqT && iraqT.country === 'Iraq', iraqT && iraqT.country);
check('Iraq tender region follows the project map', iraqT && iraqT.region === 'Middle East', iraqT && iraqT.region);
const gccT = tender('GCCIA Saudi-Kuwait interconnection');
check('GCCIA (now sourced) is never shown as an open tender', !gccT || (gccT.status !== 'OPEN' && gccT.status !== 'CLOSING_SOON'), gccT && gccT.status);
const kahT = tender('KAHRAMAA 2026 transmission expansion EPC');
check('KAHRAMAA tender source is not a placeholder', kahT && usableSource(kahT.official_procurement_url));
check('KAHRAMAA tender is not open', kahT && kahT.status !== 'OPEN' && kahT.status !== 'CLOSING_SOON', kahT && kahT.status);
check('no published tender uses example.com', rows.every(function (t) { return !(t.source_urls || []).some(function (u) { return /example\.com/i.test(u); }); }));

const openNow = rows.filter(function (t) { return t.status === 'OPEN' || t.status === 'CLOSING_SOON'; }).length;
const tendersHtml = fs.readFileSync('tenders.html', 'utf8');
const openStat = tendersHtml.match(/<b>(\d+)<\/b><small>Open now<\/small>/);
check('Tender Watch open count includes closing soon', openStat && Number(openStat[1]) === openNow, (openStat && openStat[1]) + ' vs ' + openNow);
const intelPage = fs.readFileSync('intelligence.html', 'utf8');
const intelOpen = intelPage.match(/<b>(\d+)<\/b><small>Open now<\/small>/);
check('Intelligence open count matches Tender Watch', intelOpen && Number(intelOpen[1]) === openNow, (intelOpen && intelOpen[1]) + ' vs ' + openNow);
const intelTenders = intelPage.match(/<b>(\d+)<\/b><small>Tenders<\/small>/);
check('Intelligence tender total matches Tender Watch', intelTenders && Number(intelTenders[1]) === rows.length, (intelTenders && intelTenders[1]) + ' vs ' + rows.length);

const cg = fs.readFileSync('manufacturers/cg-power-and-industrial-solutions/index.html', 'utf8');
const lead = (cg.match(/<p class="lead">([\s\S]*?)<\/p>/) || [])[1] || '';
check('CG India lead uses the 765 kV evidence, not the 400 kV tier figure', /highest sourced voltage 765 kV/.test(lead), lead.slice(0, 280));
check('CG India lead does not call 400 kV the highest voltage', !/highest sourced voltage 400 kV/.test(lead));

const ie = fs.readFileSync('manufacturers/cg-power-systems-ireland-formerly-pauwels-ireland/index.html', 'utf8');
check('Ireland profile does not show 146,000 MVA', !/146,000/.test(ie));
check('Ireland profile does not show 400 kV as its rating', !/400 kV/.test(ie));

const day = platformToday();
const events = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const upcoming = events.filter(function (ev) { return isUpcoming(ev, day); }).length;
const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
check('site-stats upcoming matches the shared rule on ' + day, stats.upcomingEvents === upcoming, stats.upcomingEvents + ' vs ' + upcoming);
check('site-stats event total matches the file', stats.events === events.length, stats.events + ' vs ' + events.length);
const shown = fs.readFileSync('events.html', 'utf8').match(/Showing (\d+) upcoming events/);
check('events page count matches', shown && Number(shown[1]) === upcoming, shown && shown[1]);
const home = fs.readFileSync('index.html', 'utf8').match(/data-stat="upcomingEvents">\s*(\d+)/);
check('homepage upcoming count matches', home && Number(home[1]) === upcoming, home && home[1]);
const homeHtml = fs.readFileSync('index.html', 'utf8');
const homeOpen = homeHtml.match(/data-stat="openTenders">\s*(\d+)/);
check('homepage open tenders matches Tender Watch', homeOpen && Number(homeOpen[1]) === openNow, (homeOpen && homeOpen[1]) + ' vs ' + openNow);
const titleOpen = homeHtml.match(/title="(\d+) open tenders accepting bids right now"/);
check('homepage open-tender tooltip matches Tender Watch', titleOpen && Number(titleOpen[1]) === openNow, (titleOpen && titleOpen[1]) + ' vs ' + openNow);
const titleAll = homeHtml.match(/title="View (\d+) procurement tenders worldwide"/);
check('homepage tender tooltip matches the tender total', titleAll && Number(titleAll[1]) === rows.length, (titleAll && titleAll[1]) + ' vs ' + rows.length);

const paid = JSON.parse(fs.readFileSync('data/paid-listings.json', 'utf8'));
check('no paid verified listing is on file', !(paid.listings || []).some(function (row) { return row && row.status === 'verified'; }));

if (failed) {
  console.error('DATA CORRECTNESS AUDIT FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — data correctness audit');
