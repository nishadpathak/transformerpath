#!/usr/bin/env node
/* tests/seo-schema.test.js — JSON-LD rules and title windows.
 * Does not crawl the site. check-seo.js does that after the dist pass.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const schema = require('../lib/seo-schema');
const html = require('../lib/seo-html');
const { assignUnique, fitWindow } = require('../lib/seo-fit');
const catalog = require('../lib/seo-catalog');
const { sourceDate, matchEvent, learnSectionTitle } = catalog;
const eventSeo = require('../lib/event-seo');

let failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.error('  ✗ ' + msg); }
  else console.log('  ok — ' + msg);
}

const site = schema.siteNodes();
const org = site.find(function (n) { return n['@type'] === 'Organization'; });
const web = site.find(function (n) { return n['@type'] === 'WebSite'; });
assert(org && org.name === 'TransformerPath' && org.url === 'https://transformerpath.com/', 'site Organization');
assert(web && web.potentialAction['@type'] === 'SearchAction', 'WebSite SearchAction');
assert(web.potentialAction.target.urlTemplate === 'https://transformerpath.com/search.html?q={search_term_string}', 'search target uses q=');
assert(web.potentialAction['query-input'] === 'required name=search_term_string', 'query-input name');

const crumbs = schema.breadcrumbNode('https://transformerpath.com/events/wetex/', [
  { name: 'Home', item: 'https://transformerpath.com/' },
  { name: 'Events', item: 'https://transformerpath.com/events.html' },
  { name: 'WETEX', item: 'https://transformerpath.com/events/wetex/' }
]);
assert(crumbs.itemListElement.map(function (i) { return i.position; }).join(',') === '1,2,3', 'breadcrumb positions');

const plain = schema.entryNode('https://transformerpath.com/manufacturers/acme/', {
  name: 'Acme Electric', city: 'Menomonee Falls', country: 'USA', website: 'https://www.hubbell.com/acmeelectric/'
});
assert(plain['@type'] === 'Organization', 'entry without a street is Organization');
assert(plain.url === 'https://www.hubbell.com/acmeelectric/', 'official URL kept when sourced');
assert(!plain.address.streetAddress && !plain.aggregateRating && !plain.review, 'no street, rating or review');
assert(plain.address.addressLocality === 'Menomonee Falls' && plain.address.addressCountry === 'USA', 'city and country only');

const local = schema.entryNode('https://transformerpath.com/accessories/example/', {
  name: 'Example Works', street: '1 Mill Road', city: 'Leeds', country: 'United Kingdom'
});
assert(local['@type'] === 'LocalBusiness' && local.address.streetAddress === '1 Mill Road', 'LocalBusiness only with a sourced street');

const orgStreet = schema.entryNode('https://transformerpath.com/manufacturers/prolec-ge/', {
  name: 'Prolec GE', street: 'Blvd. Carlos Salinas de Gortari km. 9.25', city: 'Apodaca', country: 'Mexico', asOrganization: true
});
assert(orgStreet['@type'] === 'Organization' && !orgStreet.address.streetAddress, 'Organization JSON-LD omits streetAddress');
assert(orgStreet.address.addressLocality === 'Apodaca' && orgStreet.address.addressCountry === 'Mexico', 'Organization JSON-LD keeps city and country');

const noSite = schema.entryNode('https://transformerpath.com/manufacturers/x/', { name: 'No Site Co', country: 'India' });
assert(!noSite.url, 'missing website is omitted rather than replaced with the profile URL');

const confirmed = schema.eventNode('https://transformerpath.com/events/wetex/', {
  name: 'WETEX 2026 (28th edition)', status: 'CONFIRMED_UPCOMING',
  start: '2026-10-20', end: '2026-10-22', city: 'Dubai', country: 'UAE', venue: 'Dubai World Trade Centre'
});
assert(confirmed.eventStatus === 'https://schema.org/EventScheduled', 'confirmed event is EventScheduled');
assert(confirmed.startDate === '2026-10-20' && confirmed.endDate === '2026-10-22', 'confirmed dates copied from the record');
assert(confirmed.location['@type'] === 'Place' && confirmed.location.address['@type'] === 'PostalAddress', 'location is Place + PostalAddress');
assert(confirmed.location.address.addressLocality === 'Dubai' && !confirmed.location.address.streetAddress, 'location is city and country');
assert(confirmed.eventAttendanceMode === 'https://schema.org/OfflineEventAttendanceMode', 'in-person event is offline');
assert(!confirmed.image, 'brand image is not invented');
assert(schema.validateEventNode(confirmed).length === 0, 'confirmed event passes the structured-data checks');

const rich = schema.eventNode('https://transformerpath.com/events/adipec-2026/', {
  name: 'ADIPEC 2026', status: 'CONFIRMED_UPCOMING',
  start: '2026-11-02', end: '2026-11-05', city: 'Abu Dhabi', country: 'UAE',
  venue: 'ADNEC', organizer: 'dmG events', officialUrl: 'https://www.adipec.com/',
  image: 'https://transformerpath.com/brand/og-image.png'
});
assert(rich.organizer && rich.organizer['@type'] === 'Organization' && rich.organizer.name === 'dmG events', 'organizer is the recorded organisation');
assert(rich.offers && rich.offers.url === 'https://www.adipec.com/', 'offers.url is the official site');
assert(!rich.image, 'the site brand graphic is not used as the event image');
assert(schema.validateEventNode(rich).length === 0, 'rich event passes the structured-data checks ' + schema.validateEventNode(rich).join('; '));

const withImage = schema.eventNode('https://transformerpath.com/events/example-image/', {
  name: 'Shown', status: 'CONFIRMED_UPCOMING', start: '2026-11-02', end: '2026-11-05',
  city: 'Abu Dhabi', country: 'UAE', image: 'https://www.adipec.com/media/hero.jpg'
});
assert(withImage.image === 'https://www.adipec.com/media/hero.jpg', 'a real event image is kept');

const crumbsGraph = schema.graph([crumbs, rich]);
assert(schema.flatten([crumbsGraph]).some(function (n) { return n['@type'] === 'BreadcrumbList'; }), 'event graph keeps BreadcrumbList');
assert(schema.flatten([crumbsGraph]).some(function (n) { return n['@type'] === 'Event' && n.offers && n.offers.url === 'https://www.adipec.com/'; }), 'event graph keeps offers.url');

const projected = schema.eventNode('https://transformerpath.com/events/example/', {
  name: 'Projected Expo', status: 'DATE_TBC',
  start: '2027-05-11', end: '2027-05-13', city: 'Dubai', country: 'UAE', venue: 'Dubai Exhibition Centre',
  description: 'Date est. (recurring)'
});
assert(!projected.startDate && !projected.endDate, 'projected event has no firm date');
assert(String(projected.eventStatus || '').indexOf('EventScheduled') === -1, 'projected event is not EventScheduled');

const postponed = schema.eventNode('https://transformerpath.com/events/later/', {
  name: 'Later Show', status: 'POSTPONED', start: '2027-09-01', city: 'Vienna', country: 'Austria'
});
assert(postponed.eventStatus === 'https://schema.org/EventPostponed' && !postponed.startDate, 'postponed event keeps no date');

const tbcVenue = schema.eventNode('https://transformerpath.com/events/hotel/', {
  name: 'Committee', status: 'VENUE_TBC', start: '2026-10-18', city: 'Fort Lauderdale', country: 'USA', venue: 'TBD conference hotel'
});
assert(String(tbcVenue.eventStatus || '').indexOf('EventScheduled') === -1 && !tbcVenue.startDate, 'venue-TBC is not scheduled');

const article = schema.newsArticleNode('https://transformerpath.com/intel.html', {
  id: 'p-news-example',
  headline: 'Kolektor Etra opens a hall',
  datePublished: '2026-10-08',
  publisher: 'Balkan Green Energy News',
  sourceUrl: 'https://balkangreenenergynews.com/example'
});
assert(article.datePublished === '2026-10-08', 'NewsArticle uses the source date');
assert(article.publisher.name === 'Balkan Green Energy News', 'publisher is the source outlet');
assert(article.author['@type'] === 'Organization' && article.author.name === 'Balkan Green Energy News', 'no person author is invented');
assert(schema.newsArticleNode('https://transformerpath.com/intel.html', { id: 'x', headline: 'No date', publisher: 'Desk' }) === null, 'undated item is not a NewsArticle');

const named = schema.newsArticleNode('https://transformerpath.com/intel.html', {
  id: 'p-by', headline: 'Signed piece', datePublished: '2026-09-02', publisher: 'Utility Dive', author: 'Ada Lovelace'
});
assert(named.author['@type'] === 'Person' && named.author.name === 'Ada Lovelace', 'a real author name is kept');

assert(sourceDate('8 Oct 2026') === '2026-10-08', 'card date parses to a day');
assert(sourceDate('Sep 2026') === '2026-09', 'month-only source date does not invent a day');
assert(sourceDate('') === '', 'blank date stays blank');

const titles = [
  { draft: 'Acme Electric | USA transformers', salt: 'acme-electric', pads: [' | TransformerPath'] },
  { draft: 'Acme Electric | USA transformers', salt: 'acme-electric-hubbell', pads: [' | TransformerPath'] }
];
assignUnique(titles, 'title', 50, 60);
assert(titles[0].title !== titles[1].title, 'duplicate titles are split');
assert(titles.every(function (t) { return t.title.length >= 50 && t.title.length <= 60; }), 'titles sit in 50–60');

const brandedShort = fitWindow('Acme Electric | TransformerPath', 50, 60, [' | TransformerPath']);
assert(brandedShort.length >= 50 && brandedShort.length <= 60, 'short branded title stays in window ' + brandedShort);
assert((brandedShort.match(/TransformerPath/g) || []).length === 1, 'short branded title keeps one brand: ' + brandedShort);
assert(!/\sprofile$/.test(brandedShort), 'short branded title is not padded with profile: ' + brandedShort);
assert(!/\| TransformerPath \| TransformerPath/.test(brandedShort), 'short branded title is not doubled: ' + brandedShort);

const gapTitle = fitWindow('Helsinki supplier record for this plant', 50, 60, [' | TransformerPath']);
assert(gapTitle.length >= 50 && gapTitle.length <= 60, 'mid-length title stays in window ' + gapTitle);
assert(!/\sprofile$/.test(gapTitle), 'mid-length title is not padded with profile: ' + gapTitle);
assert((gapTitle.match(/TransformerPath/g) || []).length <= 1, 'mid-length title has one brand: ' + gapTitle);

[
  'Dry-Type Transformers Manufacturers in Algeria | TransformerPath',
  'Power Transformers Manufacturers in Algeria',
  'Distribution Transformers Manufacturers in Dominican Republic'
].forEach(function (draft) {
  const fitted = fitWindow(draft, 50, 60, [' | TransformerPath']);
  const place = draft.replace(/\s+\|\s*TransformerPath$/, '').split(' ').pop();
  assert(fitted.length >= 50 && fitted.length <= 60, 'country hub title window ' + fitted);
  assert(fitted.indexOf(place) !== -1, 'country hub title keeps the place ' + fitted);
  assert(!/\sin\s+\|/.test(fitted), 'country hub title does not drop the place ' + fitted);
  assert((fitted.match(/TransformerPath/g) || []).length === 1, 'country hub title has one brand ' + fitted);
});

const longTitle = fitWindow('Ahlstrom-Munksjö | Helsinki, Finland supplier', 50, 60, [' | TransformerPath']);
assert(longTitle.length >= 50 && longTitle.length <= 60, 'long title stays in window ' + longTitle.length);
assert(longTitle.indexOf('TransformerP') === -1 || longTitle.indexOf('TransformerPath') !== -1, 'brand is not sliced: ' + longTitle);
assert(!/TransformerP(?!ath)/.test(longTitle), 'no partial TransformerPath in ' + longTitle);

const learnPages = ['learn.html', 'engineer-track.html', 'academy.html', 'pricing.html', 'coretopology.html'];
for (let v = 0; v <= 19; v++) learnPages.push('books/volume-' + v + '/index.html');
learnPages.forEach(function (rel) {
  const source = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const draft = learnSectionTitle(rel, source);
  const fitted = fitWindow(draft, 50, 60, [' | TransformerPath']);
  assert(fitted.length >= 50 && fitted.length <= 60, 'learn title window ' + rel + ' ' + fitted);
  assert((fitted.match(/TransformerPath/g) || []).length <= 1, 'learn title does not repeat the brand: ' + fitted);
  assert(!/\sprofile\b/.test(fitted), 'learn title is not padded with profile: ' + fitted);
  assert(!/\s(and|from|the|a|an|of|to|for)\s+\|/.test(fitted), 'learn title does not end on a dangling word: ' + fitted);
  assert(!/ series\b/.test(fitted), 'learn title does not use a series filler: ' + fitted);
  assert(!/[:;]$/.test(draft) && !/'s$/.test(draft), 'learn title does not end on punctuation or a possessive: ' + draft);
});

const desc = fitWindow('Short record.', 140, 160, [
  ' Only sourced census fields are shown.',
  ' Independent record on TransformerPath.'
]);
assert(desc.length >= 140 && desc.length <= 160, 'description window ' + desc.length);

const graph = schema.graph(site.concat([crumbs, plain, confirmed, article]));
const flat = schema.flatten([graph]);
assert(flat.some(function (n) { return n['@type'] === 'NewsArticle'; }), 'graph keeps NewsArticle');
assert(!JSON.stringify(graph).includes('aggregateRating'), 'graph has no rating');
assert(!JSON.stringify(graph).includes('hreflang'), 'schema graph does not emit hreflang');

const apostrophe = '<meta name="description" content="Xi\'an XD is listed in Xi\'an, Shaanxi, China. Only sourced census fields are shown on this TransformerPath manufacturer profile.">';
assert(html.metaContent(apostrophe, 'description').indexOf("Xi'an, Shaanxi") !== -1, 'description keeps apostrophes');
assert(html.metaContent(apostrophe, 'description').length > 80, 'description is not cut at the apostrophe');
const gccPage = 'GCC POWER 2026 / CIGRE 22nd Conference';
const gccRecords = [
  { n: 'GCC POWER 2026', s: '2026-10-15', v: 'Dubai (venue TBC)' },
  { n: 'GCC POWER 2026 / CIGRE 22nd Conference (Muscat)', s: '2026-11-02', v: 'JW Marriott Hotel Muscat' }
];
const gccHit = matchEvent(gccRecords, gccPage);
assert(gccHit && gccHit.s === '2026-11-02', 'event heading matches the longer unique record');
assert(matchEvent(gccRecords, 'GCC POWER 2026').n === 'GCC POWER 2026', 'exact shorter name stays on its own record');
assert(matchEvent([{ n: 'Show A 2026' }, { n: 'Show A 2026' }], 'Show A 2026') === null, 'duplicate names do not attach');

assert(html.isNoindex('<meta http-equiv="refresh" content="0; url=claim-profile.html">'), 'refresh alias is noindex');
assert(!html.isNoindex('<html><head><title>x</title></head></html>'), 'normal page stays indexable');

const { titleKeepingCountry } = require('../lib/seo-fit');
const seoCat = catalog.create();
let titleMiss = 0;
Object.keys(seoCat.companies).forEach(function (slug) {
  const c = seoCat.companies[slug];
  if (!c.indexable || !c.country) return;
  const t = titleKeepingCountry(c.name, c.country);
  const tail = ' in ' + c.country + ' | TransformerPath';
  if (t.length < 50 || t.length > 60 || t.slice(-tail.length) !== tail) titleMiss++;
});
assert(titleMiss === 0, 'every indexable manufacturer title is 50–60 and keeps the country');
const aktifTitle = titleKeepingCountry('Aktif Elektroteknik (Transformatör)', 'Türkiye');
assert(aktifTitle === 'Aktif Elektroteknik listed in Türkiye | TransformerPath', 'long parenthetical is dropped whole: ' + aktifTitle);
assert(aktifTitle.indexOf('Transforma ') === -1, 'title is not sliced inside Transformatör');
let openParen = 0;
let midWord = 0;
Object.keys(seoCat.companies).forEach(function (slug) {
  const c = seoCat.companies[slug];
  if (!c.indexable || !c.country) return;
  const t = titleKeepingCountry(c.name, c.country);
  if ((t.split('(').length) !== (t.split(')').length)) openParen++;
  const head = t.slice(0, t.length - (' in ' + c.country + ' | TransformerPath').length);
  const pieces = c.name.split(/[\s\-]+/).map(function (src) { return src.replace(/[().,/&]/g, ''); });
  head.split(/\s+/).forEach(function (word) {
    const bare = word.replace(/[().,/&-]/g, '');
    if (bare.length < 5 || pieces.indexOf(bare) !== -1) return;
    const hit = pieces.some(function (s) { return s.length > bare.length && s.indexOf(bare) === 0; });
    if (hit) midWord++;
  });
});
assert(openParen === 0, 'manufacturer titles do not leave an open parenthesis ' + openParen);
assert(midWord === 0, 'manufacturer titles do not slice a name mid-word ' + midWord);
const eventSearchSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'event-search.js'), 'utf8');
assert(/typeof require === 'function' && require\.main === module/.test(eventSearchSrc), 'event search self-test is not evaluated in the browser');

const topicCrumbs = catalog.draft('topics/bushings/index.html', '<h1>Bushings</h1>', seoCat).crumbs;
assert(topicCrumbs.some(function (c) { return /\/topics\/bushings\/$/.test(c.item); }), 'topic hub breadcrumb keeps the hub URL');
assert(!topicCrumbs.some(function (c) { return /\/topics\/?$/.test(c.item); }), 'topic breadcrumb does not link a missing /topics/ index');

const prolec = catalog.draft('manufacturers/prolec-ge/index.html', '<h1>Prolec GE</h1>', seoCat);
const prolecOrg = prolec.nodes.find(function (n) { return n['@type'] === 'Organization' && n.name === 'Prolec GE'; });
assert(prolecOrg && prolecOrg.parentOrganization && prolecOrg.parentOrganization.name === 'GE Vernova', 'Prolec GE parentOrganization is GE Vernova');
assert(prolecOrg && prolecOrg['@type'] === 'Organization' && prolecOrg.address && !prolecOrg.address.streetAddress, 'sourced street is omitted from Organization JSON-LD');
assert(prolecOrg.address.addressCountry === 'Mexico' && /Apodaca/.test(prolecOrg.address.addressLocality || ''), 'Prolec Organization keeps city and country');
assert(!prolecOrg.logo, 'no logo is invented when the company has none');

const usa = catalog.draft('manufacturers/usa.html', '<h1>USA</h1>', seoCat);
const usaList = usa.nodes.find(function (n) { return n['@type'] === 'ItemList'; });
assert(usaList && usaList.numberOfItems > 0 && usaList.itemListElement[0].item['@type'] === 'Organization', 'USA country page has an ItemList of organizations');
const indiaPt = catalog.draft('manufacturers/power-transformers/india/index.html', '<h1>Power</h1>', seoCat);
const indiaList = indiaPt.nodes.find(function (n) { return n['@type'] === 'ItemList'; });
assert(indiaList && indiaList.numberOfItems > 0 && /India/.test(indiaPt.draftTitle), 'India power category page lists makers and keeps the country');
assert(fs.readFileSync('netlify.toml', 'utf8').indexOf('from = "/manufacturers"\n  to = "/manufacturers.html"\n  status = 301') !== -1, '/manufacturers 301s to /manufacturers.html');

const adipecTitle = eventSeo.eventProfileTitle({
  name: 'ADIPEC 2026', date_status: 'CONFIRMED', start: '2026-11-02', end: '2026-11-05', city: 'Abu Dhabi'
});
assert(adipecTitle === 'ADIPEC 2026 \u2013 Abu Dhabi, 2\u20135 Nov | Transformer Events | TransformerPath', 'ADIPEC title ' + adipecTitle);
assert(adipecTitle.length >= 50 && adipecTitle.length <= 100, 'ADIPEC title length ' + adipecTitle.length);
assert((adipecTitle.match(/TransformerPath/g) || []).length === 1, 'ADIPEC title has one brand');
assert(!/\| transformer event\b/i.test(adipecTitle) && !/\sprofile\b/i.test(adipecTitle), 'ADIPEC title drops the old suffix');

const noCity = eventSeo.eventProfileTitle({
  name: 'ADIPEC 2026', date_status: 'CONFIRMED', start: '2026-11-02', end: '2026-11-05'
});
assert(noCity.indexOf('Abu Dhabi') === -1 && /2\u20135 Nov/.test(noCity), 'missing city is omitted ' + noCity);
const unconfirmed = eventSeo.eventProfileTitle({
  name: 'ADIPEC 2027', date_status: 'PROJECTED', start: '2027-11-08', end: '2027-11-11', city: 'Abu Dhabi'
});
assert(!/Nov/.test(unconfirmed) && /Abu Dhabi/.test(unconfirmed), 'unconfirmed dates stay out of the title ' + unconfirmed);
const hubTitle = eventSeo.eventHubTitle('ADIPEC');
assert(hubTitle === 'ADIPEC editions | Transformer Events | TransformerPath', 'hub title ' + hubTitle);
assert(hubTitle !== adipecTitle, 'hub title differs from the year page');
const acdcHub = eventSeo.eventHubTitle('ACDC China (24th IET AC & DC Power Transmission Conference)');
assert(acdcHub === 'ACDC China editions | Transformer Events | TransformerPath', 'hub title drops an unclosed parenthetical: ' + acdcHub);
assert(acdcHub.length >= 50 && acdcHub.length <= 100 && acdcHub.split('(').length === acdcHub.split(')').length, 'ACDC hub title stays in range and balanced');

const eventsPage = fs.readFileSync(path.join(__dirname, '..', 'events.html'), 'utf8');
const eventsTitle = (eventsPage.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
assert((eventsTitle.match(/TransformerPath/g) || []).length === 1, 'events.html title has one brand: ' + eventsTitle);
assert(!/TransformerPath\s*\|\s*TransformerPath/.test(eventsTitle), 'events.html title is not doubled');
const doubled = fitWindow('Industry Events | TransformerPath | TransformerPath', 50, 60, [' | TransformerPath']);
assert((doubled.match(/TransformerPath/g) || []).length === 1, 'doubled brand collapses to one: ' + doubled);
assert(!/TransformerPath\s*\|\s*TransformerPath/.test(doubled), 'doubled brand string does not survive');
const dashed = fitWindow('Industry Events — TransformerPath', 50, 60, [' | TransformerPath']);
assert((dashed.match(/TransformerPath/g) || []).length === 1, 'em-dash brand is not doubled: ' + dashed);

assert(eventSeo.shouldNoindexEdition({ date_status: 'PROJECTED', end: '2028-06-08', description: 'US Coiltech. Date est. (annual, June).' }, '2026-10-15'), 'projected edition with no source is noindex');
assert(!eventSeo.shouldNoindexEdition({ date_status: 'CONFIRMED', start: '2026-11-02', description: 'US Coiltech. Date est. (annual, June).' }, '2026-10-15'), 'confirmed edition stays indexable');
assert(eventSeo.shouldNoindexEdition({
  date_status: 'PROJECTED',
  end: '2027-07-09',
  description: "Thailand's largest energy event. Provisional — annual July cadence at QSNCC, exact dates TBC."
}, '2026-10-15'), 'projected future edition with no source is noindex');
assert(!eventSeo.shouldNoindexEdition({
  date_status: 'PROJECTED',
  end: '2027-07-09',
  source_url: 'https://www.asew-expo.com/',
  description: "Thailand's largest energy event. Provisional — annual July cadence at QSNCC, exact dates TBC."
}, '2026-10-15'), 'a sourced edition with a real sentence stays indexable');
assert(!eventSeo.boilerplateOnly("Thailand's largest energy event. Provisional — annual July cadence at QSNCC, exact dates TBC."), 'a real sentence is not boilerplate-only');
assert(eventSeo.shouldNoindexEdition({
  date_status: null,
  end: '2026-10-22',
  description: "DEWA water, energy and environment expo with a recorded visitor count."
}, '2026-10-15'), 'unconfirmed future edition with no source is noindex');
assert(!eventSeo.shouldNoindexEdition({
  date_status: null,
  end: '2026-01-22',
  description: 'Largest networking event for power generation professionals in the Americas.'
}, '2026-10-15'), 'past unconfirmed edition with a real description stays indexable');

const standardsPage = fs.readFileSync(path.join(__dirname, '..', 'standards.html'), 'utf8');
const standardsTitle = (standardsPage.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
assert(standardsTitle.indexOf('Standards') !== -1, 'standards.html title includes Standards: ' + standardsTitle);

const SHORT_STANDARDS = 'Transformer & Regulations Directory | TransformerPath';
const distStandards = path.join(__dirname, '..', 'dist', 'standards.html');
assert(fs.existsSync(distStandards), 'dist/standards.html exists after the SEO pass');
const distStandardsTitle = html.stripTags((fs.readFileSync(distStandards, 'utf8').match(/<title>([^<]*)<\/title>/i) || [])[1] || '');
assert(distStandardsTitle.indexOf('Standards') !== -1, 'dist/standards.html title includes Standards: ' + distStandardsTitle);
assert(distStandardsTitle !== SHORT_STANDARDS, 'dist/standards.html title keeps Standards: ' + distStandardsTitle);
assert(distStandardsTitle.length >= 50 && distStandardsTitle.length <= 60, 'dist/standards.html title is 50–60 characters: ' + distStandardsTitle.length + ' ' + distStandardsTitle);

const standardsDraft = catalog.draft('standards.html', standardsPage, seoCat);
const fittedStandards = fitWindow(standardsDraft.draftTitle, 50, 60, standardsDraft.padsTitle);
assert(fittedStandards.indexOf('Standards') !== -1, 'fitted standards draft keeps Standards: ' + fittedStandards);
assert(fittedStandards !== SHORT_STANDARDS, 'fitted standards draft is not the shortened directory title: ' + fittedStandards);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nseo schema tests passed');
