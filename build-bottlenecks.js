#!/usr/bin/env node
/* build-bottlenecks.js — /bottlenecks/ and five component explainers.
 *
 * Every figure is taken from a public page linked in that paragraph.
 * Run: node build-bottlenecks.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const copy = require('./lib/bottleneck-copy');
const { componentSponsorSectionHtml } = require('./lib/paid-listings');

copy.assertWindows();

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());

const LPT = {
  url: 'https://www.energy.gov/sites/default/files/2024-10/EXEC-2022-001242%20-%20Large%20Power%20Transformer%20Resilience%20Report%207-10-24.pdf',
  label: 'U.S. Department of Energy Report to Congress',
  date: '2024-07',
  display: 'July 2024'
};
const SC = {
  url: 'https://www.energy.gov/sites/default/files/2022-02/Electric%20Grid%20Supply%20Chain%20Report%20-%20Final.pdf',
  label: 'U.S. Department of Energy Electric Grid Supply Chain Review',
  date: '2022-02-24',
  display: '24 February 2022'
};
const OE = {
  url: 'https://www.energy.gov/oe/articles/doe-and-industry-team-keep-lights-america',
  label: 'U.S. Department of Energy Office of Electricity',
  date: '2024-02-22',
  display: '22 February 2024'
};
const NIAC = {
  url: 'https://www.cisa.gov/sites/default/files/2024-09/NIAC_Addressing%20the%20Critical%20Shortage%20of%20Power%20Transformers%20to%20Ensure%20Reliability%20of%20the%20U.S.%20Grid_Report_06112024_508c_pdf_0.pdf',
  label: 'National Infrastructure Advisory Council report',
  date: '2024-06',
  display: 'June 2024'
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function claim(text, source) {
  return '<p class="claim">' + text + ' <a href="' + esc(source.url) + '" target="_blank" rel="noopener">' +
    esc(source.label) + '</a> <time datetime="' + esc(source.date) + '">' + esc(source.display) + '</time>.</p>';
}

function guides() {
  return '<p>Ordering timelines that public sources state are collected in the <a href="/buy-early/">buying guide</a>. Typical lead times by class and region are on the <a href="/lead-times/">grid lead-time tracker</a>. Mid-tier manufacturers already in the directory are on the <a href="/spare-capacity/">mid-tier list</a>. A dash on that list means no public dated capacity note is on file.</p>';
}

function directory(links) {
  const items = links.map(function (item) {
    return '<li><a href="' + esc(item.href) + '">' + esc(item.label) + '</a></li>';
  }).join('');
  return '<h2>Directory</h2><ul>' + items + '</ul>';
}

const STYLES = [
  '.c-wrap{max-width:860px;margin:0 auto;padding:28px 16px 72px;overflow-wrap:anywhere}',
  '.c-wrap h1{font-size:1.7rem;color:var(--ink);line-height:1.25}',
  '.c-wrap h2{font-size:1.2rem;color:var(--ink);margin-top:28px}',
  '.c-wrap p,.c-wrap li{color:var(--text);line-height:1.7}',
  '.c-wrap .lead,.page-date{color:var(--muted)}',
  '.c-wrap a{color:var(--accent)}',
  '.crumbs{font-size:.8rem;color:var(--muted);margin-bottom:12px}',
  '.claim{margin:0 0 14px}',
  '.claim time{color:var(--muted);font-size:.86rem;white-space:nowrap}',
  '.card-list{list-style:none;padding:0;margin:16px 0}',
  '.card-list li{margin:0 0 10px}',
  '.card-list a{display:block;padding:12px 14px;border:1px solid var(--border);border-radius:10px;text-decoration:none}',
  '.tp-component-sponsor a.btn{white-space:normal;max-width:100%;height:auto}',
  '@media (max-width:720px){',
  '.c-wrap{padding:20px 14px 64px}',
  '.c-wrap h1{font-size:1.4rem}',
  '.claim time{white-space:normal}',
  '}'
].join('');

function pageShell(rel, main) {
  const title = copy.TITLES[rel];
  const description = copy.DESCRIPTIONS[rel];
  const canon = 'https://transformerpath.com/' + rel.replace(/index\.html$/, '');
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    datePublished: copy.AS_OF,
    dateModified: copy.AS_OF,
    author: {
      '@type': 'Organization',
      name: 'TransformerPath',
      url: 'https://transformerpath.com/'
    },
    publisher: {
      '@type': 'Organization',
      name: 'TransformerPath',
      url: 'https://transformerpath.com/',
      email: 'hello@transformerpath.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://transformerpath.com/brand/og-image.png'
      }
    },
    mainEntityOfPage: canon
  };
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(description) + '">' +
    '<link rel="canonical" href="' + canon + '">' +
    '<meta property="og:type" content="article"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:url" content="' + canon + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">' +
    '<meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">' +
    '<link rel="stylesheet" href="/style.css?v=14"><link rel="stylesheet" href="/tp-nav.css?v=14">' +
    '<style>' + STYLES + '</style>' +
    '<script type="application/ld+json">' + JSON.stringify(article) + '</script>' +
    '<script src="/consent.js" defer></script>' +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" class="c-wrap">' + main + '</main>\n' +
    FOOT + '\n<script src="/analytics.js" defer></script>\n</body>\n</html>\n';
}

function compiled() {
  return '<p class="page-date">Compiled <time datetime="' + copy.AS_OF + '">' + copy.COMPILED_LABEL + '</time>. Dates on each claim are the dates of the linked sources.</p>';
}

function contact() {
  return '<p>Questions about these pages go to <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p>';
}

function sponsor(key) {
  if (!key) return '';
  return componentSponsorSectionHtml({ component: key });
}

function hubMain() {
  return '<nav class="crumbs"><a href="/">Home</a> · Bottlenecks</nav>' +
    '<h1>Transformer supply bottlenecks</h1>' +
    '<p class="lead">Five explainers on inputs and factory limits that public sources tie to transformer supply. This series adds no figure of its own.</p>' +
    compiled() +
    '<h2>What the public record groups together</h2>' +
    claim('The review states that there are two major bottlenecks in the large power transformer supply chain: U.S. grain-oriented electrical steel production capacity, and the testing capacity of large power transformer manufacturers.', SC) +
    claim('The report states that grain-oriented electrical steel, continuously transposed copper wire, and insulating materials have a significant impact on large power transformer availability and price.', LPT) +
    '<!--tp-ad-slot-->' +
    '<h2>The five explainers</h2>' +
    '<ul class="card-list">' +
    '<li><a href="/bottlenecks/grain-oriented-electrical-steel/">Grain-oriented electrical steel</a></li>' +
    '<li><a href="/bottlenecks/copper-conductors/">Copper and conductors</a></li>' +
    '<li><a href="/bottlenecks/bushings/">Bushings</a></li>' +
    '<li><a href="/bottlenecks/insulation-pressboard-paper/">Insulation pressboard and paper</a></li>' +
    '<li><a href="/bottlenecks/test-bay-capacity/">Test bay and factory capacity</a></li>' +
    '</ul>' +
    '<h2>Buyer pages</h2>' +
    guides() +
    contact();
}

function goesMain() {
  return '<nav class="crumbs"><a href="/bottlenecks/">Bottlenecks</a> · Grain-oriented electrical steel</nav>' +
    '<h1>Grain-oriented electrical steel</h1>' +
    '<p class="lead">Grain-oriented electrical steel, often shortened to GOES, is the core steel named in the public large-power-transformer supply reviews. Figures below are copied from those sources.</p>' +
    compiled() +
    '<h2>What it is</h2>' +
    claim('The report says GOES is manufactured in several grades, including conventional oriented grade (CGO), high-permeability grade (HI-B), permanent domain-refined GOES (PDR), and intermediate grade (MOH). It says HI-B domain-refined grade is highly demanded by large power transformer manufacturers because of its low core loss.', LPT) +
    claim('The same report says the highest grade, PDR, is only available from Nippon Steel in Japan and is not manufactured in the United States. It says an intermediate grade, MOH, is widely available from Japan and South Korea, and that AK Steel makes an equivalent to MOH that is more expensive, has no efficiency benefit, and is not commonly used by U.S. large power transformer manufacturers.', LPT) +
    '<h2>Why it constrains supply</h2>' +
    claim('The review states that there are two major bottlenecks in the large power transformer supply chain. The first is U.S. GOES production capacity. The second is the testing capacity of large power transformer manufacturers.', SC) +
    claim('The review says the United States has one GOES supplier and that this company cannot meet all the demand of large power transformer manufacturers. It says some interviewees estimated that domestic supply meets about 20 percent of domestic demand, and that a 2020 Department of Commerce report indicated that all of the GOES used for large power transformer manufacturing is imported.', SC) +
    claim('The report says Cleveland-Cliffs, through its 2020 acquisition of AK Steel, is the sole active domestic GOES supplier, that the company can meet between 12 and 20 percent of domestic GOES demand, and that it is not currently profitable. It also says there is only one GOES manufacturer in the United States and that this company has been unable to meet domestic demand at quality and prices comparable to imports.', LPT) +
    claim('The report quotes a 2022 Department of Energy conclusion that domestic GOES production is a major weak link in the large power transformer supply chain, with an insignificant domestic market, an insignificant global market demand, an inability to compete with the global market, a lack of technology or material substitutions, and shrinking supply because of competing applications.', LPT) +
    claim('The report says domestic electric-vehicle production consumes non-oriented electrical steel, which competes for the same production capacity as domestic GOES, and that this crowds out less profitable domestic GOES production. It says ATI shut down GOES production in 2016 and that trade data showed a 155 percent increase in GOES imports the following year. It says U.S. Steel has GOES capability through its 2022 acquisition of Big River Steel and is producing non-oriented electrical steel instead.', LPT) +
    claim('The review says that outside the United States there are 13 manufacturers of GOES, and that of those only Japan, South Korea, and Germany could produce GOES at the specifications outlined by the Department of Energy standards then in force.', SC) +
    '<!--tp-ad-slot-->' +
    '<h2>Current public evidence</h2>' +
    claim('A 2020 Department of Commerce industry survey, as cited in the report, found that GOES and continuously transposed copper each account for roughly 25 percent of final large power transformer production costs.', LPT) +
    claim('The report says approximately 80 percent of GOES was imported in 2019, and that the share depends on form: uncut rolls 20 percent, pre-cut lamination sheets 88 percent, pre-assembled stacked cores 80 percent, wound cores 100 percent, completed transformers 35 percent of all transformers and 82 percent of large power transformers. It says imported GOES market penetration hovers around 20 percent, and that earlier figures put it as low as 12 percent or as high as 37 percent between 2015 and 2019.', LPT) +
    claim('The report says GOES is subject to a 25 percent tariff when imported from major exporter countries, while laminations and cores are not.', LPT) +
    claim('Stakeholders cited in the review gave a lead-time comparison of 5 weeks before COVID-19 and 12 weeks after it for GOES.', SC) +
    claim('The Office of Electricity page says lead times for transformer orders, particularly distribution transformers, increased from three to six months in 2019 to 12 to 30 months in 2023, and names grain-oriented electrical steel, aluminum, and copper among the materials shortages. Those months are order times for transformers, not a GOES week count.', OE) +
    claim('The council report says grain-oriented electrical steel is difficult to source domestically, that in April 2024 the Department of Energy modified a new efficiency standard to allow more time for manufacturers to adjust, and that under the new standards 25 percent of distribution transformers will be made using amorphous steel, which lacks domestic sources of production.', NIAC) +
    '<h2>Buyer mitigations</h2>' +
    claim('The council report says most electric utilities do not source transformers under long-term contracts, that the out-years of a five-year capital budget are seldom specific about discrete projects, and that it recommends encouraging long-term contracts between transformer suppliers and the sectors driving demand.', NIAC) +
    claim('The report says that before the COVID-19 pandemic it was possible to place an order for a large transformer with a lead time of less than a year, and that later conversations with domestic producers indicated lead times up to and exceeding 36 months. It says delays also follow difficulty obtaining specialty steel laminations, specialty copper wire, or appropriately skilled labor.', LPT) +
    guides() +
    directory([
      { href: '/components.html#crgo-steel', label: 'Core steel in the components directory' },
      { href: '/materials/crgo/', label: 'CRGO materials page' }
    ]) +
    sponsor('coresteel') +
    contact();
}

function copperMain() {
  return '<nav class="crumbs"><a href="/bottlenecks/">Bottlenecks</a> · Copper and conductors</nav>' +
    '<h1>Copper and conductors</h1>' +
    '<p class="lead">Public supply reviews separate continuously transposed copper, used in large power transformer windings, from ordinary copper sheet. Figures below are copied from those sources.</p>' +
    compiled() +
    '<h2>What it is</h2>' +
    claim('The review describes continuously transposed copper, abbreviated CTC, as a specialized copper wire used for transformer coil winding to minimize losses and hot-spot temperatures, and says it enables compact winding with improved short-circuit performance.', SC) +
    claim('A 2020 Department of Commerce industry survey, as cited in the report, found that GOES and CTC each account for roughly 25 percent of final large power transformer production costs.', LPT) +
    '<h2>Why it constrains supply</h2>' +
    claim('The review’s quantitative assessment says CTC’s highest supply-chain risk is the lack of a substitute for large power transformer manufacturing. It ranks regular copper and insulating materials at the lowest risk, and it says the pandemic lengthened lead times for every material it considered.', SC) +
    claim('The report says delays may occur when a manufacturer has difficulty obtaining specialty copper wire, specialty steel laminations, or appropriately skilled labor, and that CTC copper wire is one of the raw materials with a significant impact on large power transformer availability and price.', LPT) +
    '<!--tp-ad-slot-->' +
    '<h2>Current public evidence</h2>' +
    claim('Stakeholders cited in the review gave lead-time comparisons before and after COVID-19 of 8 weeks versus 18 weeks for CTC, and 4 weeks versus 12 weeks for regular copper sheet.', SC) +
    claim('The Office of Electricity page says lead times for transformer orders, particularly distribution transformers, increased from three to six months in 2019 to 12 to 30 months in 2023, and names copper among the materials shortages. Those months are order times for transformers, not a copper week count.', OE) +
    '<h2>Buyer mitigations</h2>' +
    claim('The review says that, on average, it takes 12 to 16 weeks to manufacture a large power transformer if all the materials are available, then one week to test and one week to prepare the unit for shipping. The manufacture interval in that sentence starts only when the materials are already available.', SC) +
    guides() +
    directory([
      { href: '/components.html#copper-ctc', label: 'Copper and CTC in the components directory' },
      { href: '/materials/ctc/', label: 'CTC materials page' }
    ]) +
    sponsor('copper') +
    contact();
}

function bushingsMain() {
  return '<nav class="crumbs"><a href="/bottlenecks/">Bottlenecks</a> · Bushings</nav>' +
    '<h1>Bushings</h1>' +
    '<p class="lead">A bushing is the insulated connection between a transformer and the line. The public lead-time figure below is the one the 2022 supply-chain review states.</p>' +
    compiled() +
    '<h2>What it is</h2>' +
    claim('The review says bushings provide the electrical connection between a transformer and the electrical transmission network. It says industry engagement indicated that the most common bushing for large power transformers is the oil-impregnated paper bushing, typically a porcelain air-side insulator, a conductor of copper or aluminum, insulating kraft paper, and mineral oil.', SC) +
    '<h2>Why it constrains supply</h2>' +
    claim('The review says high-voltage bushings often have a long lead time of up to five months, citing a 2014 Department of Energy report for that figure. It says industry engagement and literature review indicated only a few domestic bushing suppliers. This page does not repeat the company names in that list.', SC) +
    claim('The review’s quantitative assessment says bushing risk scores come mostly from high import reliance and long lead time. It says that when an end user asks for porcelain for bushings to be sourced outside China, the limited sources it names are the United States, Japan, and Poland.', SC) +
    '<!--tp-ad-slot-->' +
    '<h2>Current public evidence</h2>' +
    claim('The five-month bushing lead time, the count of domestic suppliers as “a few,” and the porcelain sourcing limit are the bushing supply figures the February 2022 review states. It does not publish a later week count for bushings.', SC) +
    '<h2>Buyer mitigations</h2>' +
    claim('The same review says manufacture of a large power transformer takes 12 to 16 weeks on average only if all the materials are available. A bushing lead time of up to five months, as that review states it, sits on the clock before that manufacture interval can start.', SC) +
    guides() +
    directory([
      { href: '/components.html#bushings', label: 'Bushings in the components directory' },
      { href: '/components/bushings/', label: 'Bushings component page' }
    ]) +
    sponsor('bushings') +
    contact();
}

function insulationMain() {
  return '<nav class="crumbs"><a href="/bottlenecks/">Bottlenecks</a> · Insulation pressboard and paper</nav>' +
    '<h1>Insulation pressboard and paper</h1>' +
    '<p class="lead">Cellulose paper and pressboard are the solid insulation the public large-power-transformer review describes. This page does not add a week count the sources do not state.</p>' +
    compiled() +
    '<h2>What it is</h2>' +
    claim('The review says insulating material in this context typically means cellulose used as solid insulation, and that common cellulose types are paper, crepe paper, and pressboard. It says pressboard is the most common insulating material in large power transformers, made by winding wet sheets of electrical-grade unbleached kraft pulp and then drying and pressing them in a hot-press.', SC) +
    claim('The review says pre-compressed pressboard and kraft paper are used for insulating at the core-coil assembly, and that radial spacers in the winding are made of high-density pressboard.', SC) +
    '<h2>Why it constrains supply</h2>' +
    claim('The review says industry engagement indicated that insulating material was a potential supply concern because of a lack of domestic manufacturing, and that additional stakeholders and literature review showed only a few domestic suppliers of insulating material for large power transformers in the United States. This page does not repeat the company names in that list.', SC) +
    claim('The report groups insulating materials with grain-oriented electrical steel and continuously transposed copper wire as raw materials with a significant impact on large power transformer availability and price.', LPT) +
    '<!--tp-ad-slot-->' +
    '<h2>Current public evidence</h2>' +
    claim('The review ranks regular copper and insulating materials at the lowest quantitative supply-chain risk among the segments it scored, and it says the pandemic lengthened lead times for every material it considered. The stakeholder week counts it prints are for GOES, CTC, regular copper sheet, and tap changers. It does not print a pressboard or paper week count.', SC) +
    '<h2>Buyer mitigations</h2>' +
    claim('The review says that, on average, it takes 12 to 16 weeks to manufacture a large power transformer if all the materials are available. Insulating material is one of the inputs that sentence requires to be on hand. The review does not state a separate order-ahead week for pressboard or paper.', SC) +
    guides() +
    directory([
      { href: '/components.html#pressboard', label: 'Pressboard in the components directory' },
      { href: '/materials/transformerboard/', label: 'Transformerboard materials page' }
    ]) +
    sponsor('pressboard') +
    contact();
}

function testBayMain() {
  return '<nav class="crumbs"><a href="/bottlenecks/">Bottlenecks</a> · Test bay and factory capacity</nav>' +
    '<h1>Test bay and factory capacity</h1>' +
    '<p class="lead">Public reviews treat factory slots and test bays as a limit separate from any one material. Figures below are copied from those sources.</p>' +
    compiled() +
    '<h2>What it is</h2>' +
    claim('The review states that the second of two major bottlenecks in the large power transformer supply chain is the testing capacity of large power transformer manufacturers. It says each facility typically has 1 to 2 test beds, that testing can take a week for large power transformers and 24 hours for other transformer types, and that a lack of test beds limits production.', SC) +
    claim('The council report describes manufacturing capacity as floor space, assembly bays, and production lines.', NIAC) +
    '<h2>Why it constrains supply</h2>' +
    claim('The review says stakeholders reported that it takes 12 to 16 weeks on average to manufacture a large power transformer if all the materials are available, then one week to test and one week to prepare the unit for shipping.', SC) +
    claim('The report says manufacturing facilities have a limited number of build slots, and that a slot can be used for a large power transformer, a smaller transformer, or a core refurbishment. It says new factory construction takes 1 to 3 years, and that specialty equipment such as winding machines or core tables can take 1 to 2 years to obtain.', LPT) +
    '<!--tp-ad-slot-->' +
    '<h2>Current public evidence</h2>' +
    claim('The report cites a Department of Commerce estimate that in 2019, 137 large power transformers (18 percent) were produced domestically for domestic use while 617 units (82 percent) were imported, with capacity utilization of about 40 percent and a derived maximum capacity of about 343 large power transformers a year.', LPT) +
    claim('The council report says an electric utility or generation developer that orders a transformer may have to wait 2 to 4 years, compared with a wait of months as recently as 2020, and that one U.S. large power transformer manufacturing facility disclosed a 5-year wait for new orders.', NIAC) +
    '<h2>Buyer mitigations</h2>' +
    claim('The council report says most electric utilities do not source transformers under long-term contracts, and that the out-years of a five-year capital budget are seldom specific about discrete projects. It recommends encouraging long-term contracts between transformer suppliers and the sectors driving demand.', NIAC) +
    claim('The report says that before the COVID-19 pandemic a large transformer could be ordered with a lead time of less than a year, and that later conversations indicated lead times up to and exceeding 36 months. It identifies limited cost-effective domestic manufacturing capacity as a supply-chain weak link.', LPT) +
    guides() +
    directory([
      { href: '/laboratories.html', label: 'Testing laboratories' },
      { href: '/components.html#test-equipment', label: 'Test equipment in the components directory' },
      { href: '/factory-capacity/', label: 'Factory capacity notes' }
    ]) +
    contact();
}

const MAINS = {
  'bottlenecks/index.html': hubMain,
  'bottlenecks/grain-oriented-electrical-steel/index.html': goesMain,
  'bottlenecks/copper-conductors/index.html': copperMain,
  'bottlenecks/bushings/index.html': bushingsMain,
  'bottlenecks/insulation-pressboard-paper/index.html': insulationMain,
  'bottlenecks/test-bay-capacity/index.html': testBayMain
};

copy.PAGES.forEach(function (page) {
  const html = pageShell(page.rel, MAINS[page.rel]());
  const file = path.join(page.rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  console.log('wrote ' + file);
});
