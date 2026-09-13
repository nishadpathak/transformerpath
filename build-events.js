#!/usr/bin/env node
/* build-events.js — TransformerPath individual Event pages (entity SEO).
 *
 * The TransformerIndia audit's point 8: a manufacturer corporate site stays
 * visible for event searches (CWIEME, ELECRAMA, CIGRE). We build the neutral
 * equivalent: for the major transformer exhibitions, an event page that
 * aggregates the venue/dates, the transformer companies exhibiting (from the
 * country market hub), related TransformerPath intel (region-matched), related
 * components, a "featured exhibitor" slot, an FAQ and a CTA — so
 * "CWIEME Berlin 2026 transformers" can rank for us, not just the organiser.
 * Run: node build-events.js  (part of the Netlify build command).
 */
'use strict';
const fs = require('fs');
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ci = function (s) { return (s || '').toLowerCase(); };

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const CFG = JSON.parse(fs.readFileSync('data/config.json', 'utf8'));
const CSSV = (CFG.assets && CFG.assets.css) || 12;
// ONE canonical event-status resolver (shared across Events/Homepage/Search/
// Market/Company/Structured-data surfaces). Replaces the local heuristic below.
const { resolveStatus, isTravelSafe, chip: statusChip } = require('./lib/event-status');
// Company entity pages (built by build-company-pages) -> exhibitor map for events.
const CSMAP = {}; const COUNTRY_CO = {};
try { JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (c) { CSMAP[c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = c.slug; (COUNTRY_CO[c.country] = COUNTRY_CO[c.country] || []).push({ name: c.name, slug: c.slug }); }); } catch (e) {}

const COUNTRY_MARKET = { uae: 'uae', 'united arab emirates': 'uae', 'saudi arabia': 'saudi-arabia', india: 'india', china: 'china', usa: 'usa', 'united states': 'usa', germany: 'germany', 'türkiye': 'turkiye', turkey: 'turkiye' };

// Curated transformer-relevant exhibitions (the "10 major exhibition pages").
const CURATED = [
  { slug: 'middle-east-energy', name: 'Middle East Energy 2026 (50th edition)', market: 'uae',
    register: 'https://register.visitcloud.com/survey/1ilpu1hxi14hc?actioncode=MEEV567264',
    blurb: 'The Gulf\'s flagship power & energy exhibition, held at the Dubai World Trade Centre. Fifty editions of T&D, generation, renewables and smart-grid content make it the region\'s busiest window for transformer, switchgear and substation D&I — a hard requirement for suppliers selling into the GCC projects boom.',
    faq: [['Who exhibits transformer equipment at Middle East Energy?', 'Global and regional transformer, switchgear and substation OEMs, plus component makers and service providers — see the related supplier list on this page.'], ['Does TransformerPath track UAE transformer suppliers?', 'Yes — the UAE market hub aggregates the UAE manufacturer census, grid operators, projects and events, and links to an RFQ.'], ['How can my company be featured?', 'TransformerPath offers a featured exhibitor slot for this event; submit the inquiry link at the bottom of this page.']],
    comps: ['transformer-bushings', 'transformer-cooling', 'protection-monitoring'] },
  { slug: 'cwieme-berlin', name: 'CWIEME Berlin 2026', market: 'germany',
    blurb: 'The European coils, windings, insulation and electrical-manufacturing exhibition at Messe Berlin. The closest trade show to the transformer engineering supply chain — insulation materials, conductor/CTC, cooling, laminations and magnetic core — and a key sourcing event for OEMs and their component suppliers.',
    faq: [['Why is CWIEME Berlin relevant to transformers?', 'It covers insulation, windings, magnetic materials and components that are exactly the transformer supply chain.'], ['Which transformer component categories are shown?', 'Insulation papers and pressboard, CTC and wire, cores and laminations, cooling radiators, bushings and tap-changers.'], ['Can I source transformer components here?', 'Yes — use the TransformerPath components directory and RFQ to shortlist suppliers for the categories shown on this page.']],
    comps: ['insulation-materials', 'conductors-and-core', 'transformer-cooling', 'transformer-bushings'] },
  { slug: 'coiltech-italia', name: 'Coiltech Italia 2026 (17th edition)', market: 'italy',
    blurb: 'Europe\'s specialist coil-winding, motor, transformer and e-mobility exposition at Fiera Pordenone. The transformer supply chain in one hall — conductor/CTC, laminations and magnetic core, insulation (paper, pressboard, aramid), cooling and winding equipment — a key sourcing and technology event for transformer OEMs and their component suppliers.',
    faq: [['Why is Coiltech Italia relevant to transformers?', 'It is the closest specialist show to the transformer manufacturing supply chain: windings, cores, insulation and the machines that make them.'], ['Which transformer categories are shown?', 'Magnetic cores and laminations, CTC and winding wire, insulation papers and pressboard, cooling and varnish, plus winding and assembly machinery.'], ['Can I source transformer components here?', 'Yes — use the TransformerPath components directory and RFQ to shortlist suppliers for the categories shown on this page.']],
    comps: ['insulation-materials', 'conductors-and-core', 'transformer-cooling'] },
  { slug: 'enlit-europe', name: 'Enlit Europe 2026', market: 'austria',
    blurb: 'Europe\'s leading energy-transition exhibition at Messe Wien — 700+ companies and 15,000+ attendees. Covers generation, transmission and distribution, grid modernisation, smart metering and renewables, and is a major window for the transformer, switchgear and substation suppliers serving the European grid build-out.',
    faq: [['Why is Enlit Europe relevant to transformers?', 'Grid modernisation, interconnection and renewables integration across Europe drive sustained demand for power and distribution transformers, GSUs and reactors.'], ['Who attends Enlit Europe?', 'Utilities, TSOs/DSOs, IPPs, grid-equipment manufacturers, EPCs and consultants across the European energy sector.'], ['Can TransformerPath help source from Europe?', 'Yes — the European market hubs and the transformer manufacturer census cover the continent, and an RFQ can be submitted against any of them.']],
    comps: ['transformer-bushings', 'transformer-cooling', 'protection-monitoring'] },
  { slug: 'cigre-paris', name: 'CIGRE Paris Session 2026', market: null,
    blurb: 'The pre-eminent global power-systems conference and session of the International Council on Large Electric Systems (CIGRE). The transformer (A2) study committee reviews power & distribution transformer design, condition monitoring, HVDC converter transformers and diagnostics — the technical heartbeat of the industry.',
    faq: [['What does CIGRE A2 cover?', 'The Transformers committee covers power/distribution transformer design, testing, reliability, diagnostics and HVDC/renewable applications.'], ['Is CIGRE a good place to meet transformer engineers?', 'Yes — it is the leading technical gathering for the transformer community worldwide.'], ['Does TransformerPath cover CIGRE news?', 'TransformerPath intel covers CIGRE, IEC/IEEE and industry announcements relevant to transformers.']],
    comps: ['protection-monitoring', 'insulation-materials', 'on-load-tap-changers'] },
  { slug: 'ieee-pes-td', name: 'IEEE PES T&D Conference & Exposition', market: 'usa',
    blurb: 'North America\'s largest transmission & distribution event, at McCormick Place Chicago. With the US grid hardening, renewables and data-centre load growth, T&D is where power transformer, distribution transformer, reactor and substation suppliers meet the utilities that need them.',
    faq: [['Which US utilities attend IEEE PES T&D?', 'Investor-owned utilities, co-ops and public power across North America — major buyers of power and distribution transformers.'], ['What transformers are in demand in the US?', 'Liquid-filled and dry-type distribution and power transformers, reactors and GSUs for grid hardening and renewables.'], ['How do I source US-compliant transformers?', 'Use the TransformerPath USA market hub and RFQ, specifying the IEEE C57 class, voltage and rating.']],
    comps: ['transformer-bushings', 'on-load-tap-changers', 'protection-monitoring'] },
  { slug: 'cwieme-shanghai', name: 'CWIEME Shanghai 2026', market: 'china',
    blurb: 'The Asian edition of CWIEME at the Shanghai World Expo Exhibition & Convention Center. It is the supply-chain hub for China\'s enormous transformer, motor and generator manufacturing base — magnetic steel, insulation, wire, cores and components, plus finished equipment.',
    faq: [['What does CWIEME Shanghai cover?', 'Electrical manufacturing: insulation, magnetic materials, windings, wire, cores and components for transformers and machines.'], ['Why is China important for transformers?', 'China is the world\'s largest transformer market and manufacturing base, operating UHV AC/DC and exporting widely.'], ['Can I find Chinese component suppliers here?', 'Yes — use the TransformerPath China market hub and components directory to shortlist suppliers.']],
    comps: ['conductors-and-core', 'insulation-materials', 'transformer-cooling'] },
  { slug: 'elecrama', name: 'ELECRAMA 2027 (17th edition)', market: 'india',
    blurb: 'The flagship Indian electrical & power exhibition, at India Expo Mart, Greater Noida. The world\'s largest electrical-economy show by footprint, covering generation, T&D, transformers, switchgear and automation — essential for the Indian transformer market and its export base.',
    faq: [['Why is ELECRAMA significant for transformers?', 'It is the largest gathering of the Indian electrical industry, including power and distribution transformer OEMs and their global customers.'], ['What voltage classes does India use?', '765/400/220/132 kV transmission and 33/11 kV distribution, at 50 Hz, plus ±800 kV HVDC interconnectors.'], ['Can TransformerPath help source from India?', 'Yes — the India market hub lists the Indian manufacturer census and links to an RFQ.']],
    comps: ['transformer-bushings', 'transformer-cooling', 'oil-fluids-preservation'] },
  { slug: 'win-eurasia', name: 'WIN EURASIA 2026 (incl. Electrotech Eurasia)', market: 'turkiye',
    blurb: 'Türkiye\'s largest industrial & electrical tradeshow, at Istanbul Expo Center. It showcases Eurasia\'s manufacturing and electrical-economy base — including the substantial Turkish transformer and component OEM network that exports across Europe, Africa and the Middle East.',
    faq: [['What is WIN EURASIA?', 'A major Turkish industrial & electrical exhibition including the Electrotech Eurasia electrical and technology section.'], ['Is Türkiye a transformer producer?', 'Yes — Türkiye has a strong transformer OEM and component base that both serves the national grid and exports widely.'], ['Does TransformerPath track Türkiye?', 'Yes — the Türkiye market hub aggregates the Turkish manufacturer census, grid operator and events.']],
    comps: ['conductors-and-core', 'insulation-materials', 'transformer-bushings'] },
  { slug: 'wetex', name: 'WETEX 2026 (28th edition)', market: 'uae',
    blurb: 'The Water, Energy, Technology and Environment Exhibition (WETEX), co-located with the Dubai Solar Show at the Dubai World Trade Centre. Under DEWA\'s wing, it is a GCC focus point for sustainability, renewable integration and the grids that support them — including transformer supply.',
    faq: [['What is WETEX?', 'WETEX is Dubai\'s water, energy, technology and environment exhibition, organised under DEWA and co-located with the Dubai Solar Show.'], ['Why does WETEX matter for transformers?', 'It covers renewables and grid integration, areas with high transformer, GSU and reactor demand in the Gulf.'], ['Who benefits from attending?', 'Suppliers of grid, generation, transformer and solar equipment targeting the UAE and wider GCC.']],
    comps: ['transformer-cooling', 'protection-monitoring', 'transformer-bushings'] },
  { slug: 'ieee-pes-general-meeting', name: 'IEEE PES General Meeting 2026', market: null,
    blurb: 'The IEEE Power & Energy Society\'s flagship technical conference, at the Palais des congrès de Montréal. It is the largest North American power-systems technical meeting, with deep transformer, grid and HVDC content and the utility R&D community in attendance.',
    faq: [['Which US/Canadian utilities attend?', 'The PES General Meeting draws utility engineers and researchers across North America and internationally.'], ['How is it relevant to transformers?', 'Its transformer, HVDC and grid-study committees cover power transformer design, monitoring and grid applications.'], ['Does TransformerPath report on IEEE PES?', 'TransformerPath intel covers IEEE/IEC/CIGRE announcements and grid developments.']],
    comps: ['on-load-tap-changers', 'protection-monitoring', 'transformer-cooling'] },
  { slug: 'hannover-messe', name: 'HANNOVER MESSE 2026', market: 'germany',
    blurb: 'The world\'s leading industrial technology trade fair at the Hannover Exhibition Grounds. It spans industrial automation, energy, and the supply chain for electrical machines and transformers — the European venue to see transformer manufacturing technology, motors, drives and grid equipment.',
    faq: [['What is Hannover Messe?', 'The world\'s leading industrial technology fair, covering automation, manufacturing and energy technology.'], ['Is it relevant to transformers?', 'It covers industrial energy and manufacturing technology relevant to transformer making and application.'], ['Which components are shown?', 'Electrical manufacturing technology, insulation, magnetic materials, drives and grid products.']],
    comps: ['transformer-cooling', 'insulation-materials', 'conductors-and-core'] },
  { slug: 'ieee-pes-transformers-committee', name: 'IEEE PES Transformers Committee — Spring 2026', market: 'usa',
    blurb: 'The single most transformer-specific technical gathering in the world: the IEEE PES Transformers Committee meets twice a year to develop and work on the IEEE C57 transformer standards that govern the industry. The sessions on the engineering of power and distribution transformers are the deep technical heartbeat of the US transformer community.',
    faq: [['What is the IEEE PES Transformers Committee?', 'The committee that develops and maintains the IEEE C57 transformer standards — the benchmark for transformers in the 60 Hz Americas and beyond.'], ['Who attends?', 'Manufacturers, utilities, test labs, consultants and academics working on power and distribution transformer engineering and standards.'], ['Why is it relevant to buyers?', 'It defines the standards, tests and good practice that govern transformer specification, acceptance and operation.']],
    comps: ['transformer-bushings', 'on-load-tap-changers', 'tank-and-mechanical'],
    market: 'usa' },
  { slug: 'cigre-australia-a2', name: 'CIGRE Australia A2 — Transformer & Reactor Workshop', market: null,
    blurb: 'The CIGRE Australian A2 study-committee workshop on transformers and reactors — a focused technical event on the design, testing, diagnostics and life management of power transformers and reactors, and the state of the art in transformer condition monitoring.',
    faq: [['What is CIGRE A2?', 'CIGRE study committee A2 covers transformers and reactors — their design, testing, operation and life management.'], ['Is it a good place to meet transformer engineers?', 'Yes — it is a specialist workshop on transformer and reactor technology, with strong practitioner and research content.'], ['Does TransformerPath cover CIGRE A2 news?', 'TransformerPath intel covers CIGRE, IEC/IEEE and industry technical announcements.']],
    comps: ['protection-monitoring', 'insulation-materials', 'oil-fluids-preservation'] },
  { slug: 'gcc-power', name: 'GCC POWER 2026 / CIGRE 22nd Conference', market: 'uae',
    blurb: 'The Gulf Cooperation Council power conference and CIGRE technical event, focused on the GCC grid, T&D build-out, and the substation and transformer investment that the regional projects boom is driving. A key window into Gulf transformer demand.',
    faq: [['What is GCC POWER?', 'The Gulf power conference and CIGRE technical event covering GCC grid, transmission and transformation.'],
      ['Why does it matter for transformers?', 'The GCC projects and grid build-out drive strong transformer, substation and reactor demand, especially in Saudi Arabia and the UAE.'],
      ['How can I source GCC transformer suppliers?', 'Use the TransformerPath UAE or Saudi Arabia market hub, then submit an RFQ.']],
    comps: ['transformer-bushings', 'transformer-cooling', 'protection-monitoring'] },
  { slug: 'saudi-smart-grid', name: 'Saudi Smart Grid Conference 2026 (SASG)', market: 'saudi-arabia',
    blurb: 'Saudi Arabia\'s smart-grid and grid-modernisation conference, a focus for the Vision 2030 build-out, renewable integration and the substation, transformer and automation technology that supports it.',
    faq: [['What is the Saudi Smart Grid Conference?', 'A focused event on grid modernisation and smart-grid technology for the Saudi electricity sector.'],
      ['Why is it relevant to transformers?', 'Grid modernisation and renewables integration drive transformer, GSU and reactor demand in the Kingdom.'],
      ['Who supplies transformers to Saudi Arabia?', 'The Saudi Electricity Company and giga-project developers source from regional and global power-transformer OEMs.']],
    comps: ['transformer-cooling', 'protection-monitoring', 'transformer-bushings'] },
  { slug: 'smarter-e', name: 'The smarter E Europe 2026', market: 'germany',
    blurb: 'The umbrella organisation behind Intersolar Europe, ees Europe, Power2Drive and EM-Power — the leading European meeting place for renewables, storage, e-mobility and energy management. Its renewable and storage focus drives demand for the transformers, GSUs and converter transformers behind the energy transition.',
    faq: [['What is The smarter E?', 'The umbrella event behind Intersolar, ees (storage), Power2Drive and EM-Power — the major European renewables and energy exhibition.'],
      ['Why does it matter for transformers?', 'European solar, wind and storage build-out drives GSU, collector and converter-transformer demand.'],
      ['What should I look for here?', 'Generator step-up and grid-connection transformers, storage transformers and the grid integration technology behind renewables.']],
    comps: ['transformer-bushings', 'transformer-cooling', 'on-load-tap-changers'] },
  { slug: 'cigre-canada', name: 'CIGRE Canada Conference & Exhibition 2026 (Calgary)', market: null,
    blurb: 'The Canadian CIGRE conference and exhibition, at Calgary, brings together the utility, T&D and transformer engineering community of Canada — with A2/D1 transformer and high-voltage content plus the grid-modernisation and electrification themes driving North American demand.',
    faq: [['What is CIGRE Canada?', 'The Canadian committee of CIGRE holds an annual conference and exhibition covering power system, T&D and high-voltage engineering.'],
      ['Why is it relevant to transformers?', 'It covers transformer A2 and high-voltage insulation topics plus the utility electrification and grid-reinforcement themes driving demand.'],
      ['Does TransformerPath cover CIGRE Canada?', 'TransformerPath intel covers CIGRE, IEEE/IEC and regional grid developments.']],
    comps: ['insulation-materials', 'protection-monitoring', 'transformer-bushings'] },
  { slug: 'korea-smart-grid', name: 'Korea Smart Grid Week 2026 (KSGW)', market: 'south-korea',
    blurb: 'Korea Smart Grid Week is South Korea\'s flagship smart-grid, renewable and energy-transition exhibition, at Seoul. It showcases the nation\'s grid-equipment and transformer OEMs (LS, HD Hyundai, Hyosung) and the battery, storage and grid-modernisation technology driving demand.',
    faq: [['What is Korea Smart Grid Week?', 'The leading South Korean smart-grid, renewable and energy exhibition, showcasing the country\'s grid and power-equipment industry.'],
      ['Why is it relevant?', 'It highlights Korea\'s transformer and grid-equipment OEMs (LS, HD Hyundai, Hyosung) and the storage/electrification technology driving demand.'],
      ['Are Korean OEMs major exporters?', 'Yes — Korean grid-equipment makers are global suppliers and are expanding capacity in the US and elsewhere.']],
    comps: ['transformer-bushings', 'transformer-cooling', 'on-load-tap-changers'] },
  { slug: 'ieee-pes-transformers-committee-fall', name: 'IEEE PES Transformers Committee — Fall 2026', market: 'usa',
    blurb: 'The fall meeting of the IEEE PES Transformers Committee — the standards body behind the IEEE C57 transformer series. This is the most transformer-specific technical gathering in the world, where the industry works on transformer standards, testing and design.',
    faq: [['What does the fall meeting cover?', 'The same transformer standards, testing and design work as the spring meeting — the development and maintenance of the IEEE C57 series.'],
      ['Who attends?', 'Transformer manufacturers, utilities, test labs and consultants working on transformer engineering and standards.'],
      ['Why should I attend?', 'It is the definitive place to understand the standards and good practice that govern transformer specification and acceptance.']],
    comps: ['transformer-bushings', 'on-load-tap-changers', 'protection-monitoring'],
    market: 'usa' },
  { slug: 'ieee-eic', name: 'IEEE EIC & IPMHVC 2026', market: 'usa',
    blurb: 'The IEEE Electrical Insulation Conference (EIC) and International Power Modulator and High-Voltage Conference (IPMHVC) — the technical home of insulation materials, high-voltage testing and dielectric science. It is directly relevant to transformer insulation, partial discharge and high-voltage engineering.',
    faq: [['What is IEEE EIC?', 'The Electrical Insulation Conference covers insulation materials, dielectric science and high-voltage testing.'],
      ['Why is it relevant to transformers?', 'It covers the insulation materials, partial discharge and high-voltage testing that underpin transformer reliability.'],
      ['Who attends?', 'Insulation and high-voltage researchers, manufacturers and testing engineers, including the transformer insulation community.']],
    comps: ['insulation-materials', 'protection-monitoring', 'transformer-bushings'] },
  { slug: 'ichve', name: 'ICHVE 2026 — IEEE Int\'l Conf. on High Voltage Engineering', market: null,
    blurb: 'The IEEE International Conference on High Voltage Engineering, at São Paulo, unites the high-voltage engineering community on insulation, dielectric testing, overvoltage and surges — the technical core of transformer insulation and testing.',
    faq: [['What is ICHVE?', 'The IEEE International Conference on High Voltage Engineering, on insulation, dielectric testing and high-voltage phenomena.'],
      ['Why is it relevant to transformers?', 'It covers the insulation, partial discharge and high-voltage testing that govern transformer design and reliability.'],
      ['Who attends?', 'High-voltage and insulation engineers, researchers and manufacturers, including the transformer insulation community.']],
    comps: ['insulation-materials', 'protection-monitoring', 'transformer-bushings'] },
  { slug: 'cigre-symposium', name: 'CIGRE Symposium Cairns 2026', market: null,
    blurb: 'A CIGRE symposium at Cairns focusing on the grid and T&D engineering of the Asia-Pacific, including transformer and high-voltage content and the large-scale grid and renewable build-out in the region.',
    faq: [['What is the CIGRE Symposium?', 'A CIGRE technical symposium on power-system and T&D engineering, held for a region — here the Asia-Pacific.'],
      ['Why is it relevant?', 'It includes transformer and high-voltage content and the grid and renewables build-out that drives regional demand.'],
      ['Does TransformerPath cover CIGRE?', 'Yes — TransformerPath intel covers CIGRE, IEC/IEEE and regional grid developments.']],
    comps: ['transformer-bushings', 'protection-monitoring', 'insulation-materials'] },
];

const GLOBAL_OEMS = ['SIEMENS ENERGY', 'HITACHI ENERGY', 'GE VERNOVA', 'TBEA', 'HYOSUNG HEAVY INDUSTRIES', 'WEIDMANN'];

function makersForMarket(marketSlug) {
  const list = [];
  if (marketSlug) {
    const slugToCountry = { 'uae': 'uae', 'saudi-arabia': 'saudi arabia', 'india': 'india', 'china': 'china', 'usa': 'usa', 'germany': 'germany', 'turkiye': 'türkiye' };
    const cname = slugToCountry[marketSlug];
    MANUF.forEach(function (g) {
      if (ci(g.country) === ci(cname)) g.makers.forEach(function (x) { list.push({ name: x[0], slug: slugify(g.country) }); });
    });
  }
  return list.slice(0, 8);
}
function intelFor(rec) {
  const regionKeys = { 'Middle East': 'GCC', 'Europe': 'Europe', 'Americas': 'USA', 'Asia': 'India', 'Eurasia': 'RoW', 'Oceania': 'RoW', 'Africa': 'RoW' };
  let reg = INTEL[regionKeys[rec.r]];
  const kw = ci(rec.co + ' ' + rec.name).split(/[^a-z0-9]+/).filter(function (x) { return x.length > 2; });
  let items = reg ? reg.items : [];
  let matches = items.filter(function (it) { return kw.some(function (k) { return ci(it.title).indexOf(k) >= 0; }); });
  return (matches.length ? matches : items.slice(0, 3)).slice(0, 4);
}
const fmt = function (d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const dt = new Date(d + 'T12:00:00Z');
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
// Travelpayout-affiliated attendee buttons (Book Hotel / Flights / Things to Do /
// calendar) for a curated event, matching the exhibitions + events.html pattern.
const TP = { hotel: 'https://search.hotellook.com/?marker=736890&destination=', flights: 'https://kiwi.tpk.ro/dClaRHg1', activities: 'https://kkday.tpk.ro/VGC9WqGf' };
function travelButtons(name, city, country, s, e) {
  if (!city) return '';
  const hotel = TP.hotel + encodeURIComponent(city);
  const nm = String(name || '').replace(/[\r\n]/g, ' ').trim();
  const loc = [city, country].filter(Boolean).join(', ');
  const d0 = String(s || '').replace(/-/g, ''), d1 = String(e || '').replace(/-/g, '') || d0;
  const cal = 'data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR%0D%0AVERSION%3A2.0%0D%0APRODID%3A-%2F%2FTransformerPath%2F%2FEvents%2F%2FEN%0D%0ACALSCALE%3AGREGORIAN%0D%0ABEGIN%3AVEVENT%0D%0AUID%3A' + (d0 || 'tbd') + '%40transformerpath.com%0D%0ADTSTAMP%3A20260901T000000Z%0D%0ADTSTART%3BVALUE%3DDATE%3A' + d0 + '%0D%0ADTEND%3BVALUE%3DDATE%3A' + d1 + '%0D%0ASUMMARY%3A' + encodeURIComponent(nm) + '%0D%0ALOCATION%3A' + encodeURIComponent(loc) + '%0D%0AEND%3AVEVENT%0D%0AEND%3AVCALENDAR';
  return '<div class="ev-travel" style="margin:10px 0 4px">' +
    '<div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">Travel links may earn an affiliate commission to support TransformerPath independent research.</div>' +
    '<a class="btn btn-outline btn-sm" data-aff="hotel" data-ev="' + esc(nm) + '" href="' + esc(hotel) + '" target="_blank" rel="noopener sponsored">🏨 Book Hotel</a> ' +
    '<a class="btn btn-outline btn-sm" data-aff="flights" data-ev="' + esc(nm) + '" href="' + esc(TP.flights) + '" target="_blank" rel="noopener sponsored">✈ Find Flights</a> ' +
    '<a class="btn btn-outline btn-sm" data-aff="activities" data-ev="' + esc(nm) + '" href="' + esc(TP.activities) + '" target="_blank" rel="noopener sponsored">&#127915;&#65039; Things to Do</a> ' +
    '<a class="btn btn-outline btn-sm" data-aff="calendar" data-ev="' + esc(nm) + '" href="' + cal + '" download target="_blank" rel="noopener">&#128197; Add</a></div>';
}

/* ── Event confirmation state ───────────────────────────────────────────────
 * Event status is resolved by the SINGLE shared resolver in lib/event-status.js
 * (P0 "one canonical event status"). It reads the same cues the registry carries
 * (dates s/e, description d, venue v) and normalises them to one of the canonical
 * states: CONFIRMED_UPCOMING / LIVE / COMPLETED / DATE_TBC / VENUE_TBC /
 * MONITORING / POSTPONED / CANCELLED. It never invents confirmation: a record
 * with "Date est." / "provisional" / venue-TBC cues stays DATE_TBC / VENUE_TBC,
 * so an unconfirmed event can never surface firm dates or book-travel CTAs. */
const travelable = isTravelSafe;


// Map each curated event to its region (for "related events" cross-links).
const EVENT_REGION = {};
CURATED.forEach(function (ev) { const rec = EVENTS.find(function (x) { return ci(x.n).indexOf(ci(ev.name)) >= 0; }); EVENT_REGION[ev.slug] = rec ? rec.r : ''; });

// Region -> related Knowledge slugs across all events (query-intent tie-in).
const EVENT_REL = {
  'Middle East': ['gsu-transformers', 'transformer-inrush-current', 'onan-vs-onaf-vs-ofaf'],
  'Europe': ['power-vs-distribution', 'parallel-operation-transformers', 'transformer-impedance'],
  'Americas': ['power-vs-distribution', 'transformer-type-selection', 'tap-changer-faults'],
  'Asia': ['gsu-transformers', 'transformer-inrush-current', 'transformer-winding-manufacturing'],
  'Oceania': ['power-vs-distribution', 'transformer-type-selection', 'transformer-impedance'],
  'Africa': ['transformer-overheating', 'transformer-maintenance-checklist', 'transformer-failure-cost'],
  'Eurasia': ['power-vs-distribution', 'transformer-type-selection', 'transformer-voltage-regulation'],
};
function knowLabel(s) { return s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

function eventPage(ev) {
  const rec = EVENTS.find(function (x) { return ci(x.n).indexOf(ci(ev.name)) >= 0; }) || { n: ev.name, s: '', e: '', c: '', co: '', r: '', v: '', u: '#', d: ev.blurb };
  const st = resolveStatus(rec);
  const confirmed = travelable(st);
  const mk = makersForMarket(ev.market);
  const intel = intelFor(rec);
  const comps = (ev.comps || []).map(function (c) { return '<a class="tpill" href="../../components/' + c + '.html">' + esc(c.replace(/-/g, ' ')) + '</a>'; }).join(' ');
  const mkHtml = (mk.length ? mk.map(function (x) { return x.name; }).slice(0, 6).join(' · ') : GLOBAL_OEMS.join(' · ')) + (mk.length > 6 ? ' …' : '');
  // Transformer companies in this market, linked to their entity pages (exhibitor map).
  const CO_ALIAS = { 'usa': 'USA', 'united states': 'USA', 'turkey': 'Türkiye', 'uae': 'UAE', 'united kingdom': 'United Kingdom' };
  const coKey = CO_ALIAS[ci(rec.co)] || rec.co;
  const countryCompanies = (COUNTRY_CO[coKey] || []).slice(0, 10);
  const mkPills = (countryCompanies.length ? countryCompanies.map(function (c) { return '<a class="tpill" href="../../manufacturers/' + c.slug + '/">' + esc(c.name) + '</a>'; }) : GLOBAL_OEMS.map(function (g) { var s = CSMAP[g.toLowerCase()]; return s ? '<a class="tpill" href="../../manufacturers/' + s + '/">' + esc(g) + '</a>' : ''; }).filter(Boolean)).join(' ');
  const intelHtml = intel.map(function (it) { return '<li style="margin:6px 0"><b style="color:var(--text)">' + esc(it.title) + '</b><p style="color:var(--muted);font-size:.86rem;margin:2px 0 0">' + esc(it.snippet.slice(0, 160)) + (it.snippet.length > 160 ? '…' : '') + '</p></li>'; }).join('');
  const marketLink = ev.market ? '<a class="tpill" href="../../markets/' + ev.market + '/">' + esc(ev.market.replace(/-/g, ' ')) + ' market hub</a>' : '';
  const countrySlug = slugify(rec.co);
  const countryLink = (rec.co && fs.existsSync('manufacturers/' + countrySlug + '.html')) ? '<a class="tpill" href="../../manufacturers/' + countrySlug + '.html">' + esc(rec.co) + ' manufacturers</a>' : '';
  // Related events: other curated events in the same region.
  const relatedEvents = CURATED.filter(function (o) { return o.slug !== ev.slug && (EVENT_REGION[o.slug] === rec.r || o.market === ev.market); }).slice(0, 3);
  const relatedEvHtml = relatedEvents.map(function (o) { return '<a class="tpill" href="../../events/' + o.slug + '/">' + esc(o.name.slice(0, 40)) + '…</a>'; }).join(' ');
  const relKnow = EVENT_REL[rec.r] || EVENT_REL.Europe;
  const relKnowHtml = relKnow.map(function (s) { return '<a class="tpill" href="../../knowledge/' + s + '.html">' + esc(knowLabel(s)) + '</a>'; }).join(' ');
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: ev.faq.map(function (f) { return { '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }; }) };
  const url = 'https://transformerpath.com/events/' + ev.slug + '/';
  const schema = '<script type="application/ld+json">' + JSON.stringify(faqSchema) + '</script>' +
    (confirmed ? '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', name: ev.name, startDate: rec.s, endDate: rec.e, location: { '@type': 'Place', name: rec.v, address: { '@type': 'PostalAddress', addressLocality: rec.c, addressCountry: rec.co } }, url: rec.u, description: rec.d }) + '</script>' : '');

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(ev.name) + ' — Transformer Exhibitors & Coverage | TransformerPath</title>' +    '<meta name="description" content="' + esc(ev.blurb.slice(0, 155)) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(ev.name) + ' — Transformer Exhibitors"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=' + CSSV + '"><link rel="stylesheet" href="../../tp-nav.css?v=' + CSSV + '"><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><link rel="preconnect" href="https://www.google-analytics.com"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .evmeta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:.9rem;color:var(--muted);margin:6px 0 16px}.c-wrap .evmeta b{color:var(--text)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.c-wrap ul{padding-left:20px;line-height:1.7}</style>' + schema +
    '</head>\n<body>\n' + HEAD + '\n<main id="main" tabindex="-1" class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../events.html" style="color:var(--accent)">Events</a> › ' + esc(ev.name) + '</nav>' +
    '<h1>' + esc(ev.name) + '</h1>' +
    '<div style="margin:4px 0 12px">' + statusChip(st) + (['DATE_TBC','VENUE_TBC','MONITORING','POSTPONED'].indexOf(st.key) >= 0 ? '<span style="font-size:.82rem;color:var(--muted)">Do not book travel on unconfirmed dates — verify with the organiser.</span>' : '') + '</div>' +
    '<div class="evmeta">' +
    (!rec.s || st.key === 'DATE_TBC' || st.key === 'MONITORING' || st.key === 'REJECTED_NO_EVIDENCE' || st.key === 'RESEARCH_REQUIRED'
      ? '<span><b>Dates</b> Not confirmed</span>'
      : '<span><b>Dates</b> ' + fmt(rec.s) + (rec.e !== rec.s ? ' – ' + fmt(rec.e) : '') + '</span>') +
    (st.key === 'VENUE_TBC'
      ? '<span><b>Venue</b> To be confirmed</span>'
      : '<span><b>Venue</b> ' + esc(rec.v || rec.c) + '</span>') +
    '<span><b>Location</b> ' + esc(rec.c + ', ' + rec.co) + '</span>' +
    (rec.u !== '#' ? '<span><a href="' + esc(rec.u) + '" target="_blank" rel="noopener" style="color:var(--accent)">Official site ↗</a></span>' : '') +
    (st.key !== 'REJECTED_NO_EVIDENCE' && st.key !== 'CANCELLED' && st.key !== 'RESEARCH_REQUIRED'
      ? '<span><a href="../../map.html?layer=events&amp;q=' + encodeURIComponent(ev.name) + '" style="color:var(--accent)">View on map</a></span>'
      : '') + '</div>' +
    (confirmed && ev.register ? '<div style="margin:10px 0 4px"><a class="btn btn-amber" href="' + esc(ev.register) + '" target="_blank" rel="noopener" data-track="event_register" data-track-event="' + esc(ev.slug) + '">Register for ' + esc(ev.name) + ' →</a></div>' : '') +
    (confirmed ? travelButtons(ev.name, rec.c, rec.co, rec.s, rec.e) : '') +
    '<p class="lead">' + esc(ev.blurb) + '</p>' +
    '<h2>What it covers</h2><p style="line-height:1.7;color:var(--text)">' + esc(rec.d || ev.blurb) + '</p>' +
    '<h2>Transformer companies &amp; suppliers</h2><p style="color:var(--muted);font-size:.94rem;margin:4px 0 8px">Companies in this market (TransformerPath entity pages) — verify capability before a decision.</p><div style="margin:4px 0 8px">' + mkPills + '</div>' + (countryLink ? '<div style="margin-top:8px">' + countryLink + '</div>' : '') +
    '<h2>Related TransformerPath intelligence</h2><ul>' + intelHtml + '</ul>' +
    '<h2>Related components</h2><div>' + comps + '</div>' +
    (marketLink ? '<h2>Related market</h2><div>' + marketLink + '</div>' : '') +
    '<h2>Frequently asked</h2>' + ev.faq.map(function (f) { return '<div style="margin:12px 0"><b style="color:var(--ink)">' + esc(f[0]) + '</b><p style="color:var(--text);margin:4px 0 0;line-height:1.7">' + esc(f[1]) + '</p></div>'; }).join('') +
    '<h2>Related reading</h2><div style="margin:4px 0 8px">' + relKnowHtml + '</div>' +
    '<h2>Related events</h2><div style="margin:4px 0 8px">' + (relatedEvHtml || '<span style="color:var(--muted);font-size:.85rem">See the events calendar.</span>') + '</div>' +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Meet the industry at ' + esc(ev.name) + '</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Get your product or service in front of transformer buyers — or submit an RFQ to reach suppliers in this sector.</p>' +
    '<div style="font-size:.8rem;color:var(--muted);margin-bottom:12px">Exhibiting here? Feature your company on TransformerPath — from $399 per event.</div>' +
    '<a class="btn btn-amber" href="../../sponsor.html" data-track="event_feature_inquiry" data-track-event="' + esc(ev.slug) + '">Feature your company — $399 →</a> <a class="btn btn-outline btn-sm" href="../../rfq.html" data-track="rfq_started" data-track-component_category="' + esc(ev.slug) + '">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-component_category="' + esc(ev.slug) + '">Get Verified</a></div>' +
    '<div style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:8px">Explore: <a href="../../events.html" style="color:var(--accent);font-weight:600">Events</a> · <a href="../../webinars.html" style="color:var(--accent);font-weight:600">Webinars</a> · <a href="../../learn.html" style="color:var(--accent);font-weight:600">Learn</a> · <a href="../../intel.html" style="color:var(--accent);font-weight:600">Intel</a> · <a href="../../map.html?layer=events" style="color:var(--accent);font-weight:600">Map</a> · <a href="../../markets.html" style="color:var(--accent);font-weight:600">Markets</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js?v=2" defer></script>\n' +
    '<script>(function(){function ok(){try{return localStorage.getItem("tp-cookie-consent")==="accepted"}catch(e){return false}}function load(){var s=document.createElement("script");s.async=1;s.src="https://emrldtp.com/NTQ4OTM4.js?t=548938";s.setAttribute("data-cmp-ab","2");document.head.appendChild(s)}if(ok()){load()}else{var h=function(e){if(e.key==="tp-cookie-consent"&&e.newValue==="accepted"){load();document.removeEventListener("storage",h)}};document.addEventListener("storage",h)}})();<\/script>\n</body>\n</html>';
}
const OEMS_SAMPLE = 'SIEMENS ENERGY · HITACHI ENERGY · GE VERNOVA · TBEA · HYOSUNG HEAVY INDUSTRIES'; // (kept for reference)

fs.mkdirSync('events', { recursive: true });
CURATED.forEach(function (ev) {
  const dir = 'events/' + ev.slug; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/index.html', eventPage(ev));
  console.log('OK events/' + ev.slug + '/ | ' + ev.name);
});
console.log('OK curated event pages:', CURATED.length);
