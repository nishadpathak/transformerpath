#!/usr/bin/env node
/* build-markets.js — TransformerPath Market Hubs (geographic SEO).
 *
 * The strongest idea from the TransformerIndia audit: geographic SEO. Each target
 * market becomes a genuine intelligence hub that aggregates the WHOLE market —
 * grid operators, transformer manufacturers, components, projects & intel,
 * events, technical context and an RFQ — neutrally, rather than promoting one
 * manufacturer. Data is pulled live from the census/grid/event/intel files and
 * all counters are generated from central data (site-stats.json), never typed.
 *
 * Markets are created only where there is enough data (7 core markets first).
 * Run: node build-markets.js  (part of the Netlify build command).
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
const GRIDS = JSON.parse(fs.readFileSync('data/grids.json', 'utf8'));
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const STATS = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
// Business-intelligence graph: typed company events + structured projects.
const BI = JSON.parse(fs.readFileSync('data/entity-events.json', 'utf8'));
const BI_EVENTS = BI.companies_events || {};
const BI_PROJECTS = BI.projects || [];
const BI_TYPES = BI.types || {};
const COMPONENTS = {
  'transformer-bushings': 'Transformer bushings', 'on-load-tap-changers': 'On-load tap changers',
  'transformer-cooling': 'Cooling systems', 'insulation-materials': 'Insulation materials',
  'conductors-and-core': 'Conductors & core steel', 'oil-fluids-preservation': 'Oil & preservation',
  'protection-monitoring': 'Protection & monitoring', 'tank-and-mechanical': 'Tank & mechanical',
};

// Company entity-page slug map -> reciprocal link from market/event pages back
// to each manufacturer's own profile (the entity-graph reverse edge).
let CSMAP = {};
try { JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (c) { CSMAP[c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = c.slug; }); } catch (e) {}
const csl = function (m) { return CSMAP[String(m).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()]; };

const MARKETS = [
  { slug: 'uae', name: 'UAE', gridsName: 'United Arab Emirates', manufName: 'UAE', region: 'Middle East', flag: '🇦🇪',
    intel: 'GCC', kw: ['uae', 'emirati', 'dubai', 'abu dhabi', 'dewa', 'taqa', 'etihad'],
    blurb: 'The UAE runs a compact, high-load Gulf grid (40/132 kV backbone, with 400 kV spine) and a fast-growing investment pipeline in substations, renewables and data centres. Buyers here demand GCC-rated (high-ambient) plant, and sourcing is dominated by imports alongside a small but rising domestic OEM base.',
    tech: ['400 kV / 220 / 132 / 33 / 11 kV transmission and distribution', '50 Hz, GCCIA interconnection with the wider Gulf grid', 'High ambient-temperature design and desert-class enclosure', 'IEC + BS/EN adoption; DEWA/TAQA/EtihadWE procurement requirements', 'DEWA distribution sector is a key buyer of 11/0.4 kV distribution transformers'],
    faq: [
      ['Which utilities buy transformers in the UAE?', 'DEWA (Dubai), TAQA Transmission (Abu Dhabi spine), EtihadWE (Northern Emirates) and SEWA (Sharjah) are the main buyers; transmission assets are largely 400/220 kV and distribution 33/11 kV.'],
      ['What voltage classes are common in the UAE?', 'Transmission at 400 kV and 220 kV, sub-transmission at 132 kV, and distribution at 33 kV / 11 kV, with 400/230 V at the point of use.'],
      ['Does the UAE manufacture transformers locally?', 'There is a modest domestic OEM presence alongside heavy import reliance — the TransformerPath census tracks UAE manufacturers, but most high-voltage plant is imported from regional and global suppliers.'],
    ] },
  { slug: 'saudi-arabia', name: 'Saudi Arabia', gridsName: 'Saudi Arabia', manufName: 'Saudi Arabia', region: 'Middle East', flag: '🇸🇦',
    intel: 'GCC', kw: ['saudi', 'ksa', 'neom', 'red sea', 'sec', 'vision'],
    blurb: 'Saudi Arabia is the largest transformer market in the Gulf, driven by Vision 2030 giga-projects (NEOM, Red Sea, Qiddiya), grid expansion and a massive renewables build-out. It demands high-ambient, high-reliability plant for one of the harshest operating environments on earth.',
    tech: ['380 kV / 110 / 13.8 kV transmission, 60 Hz transmission is not used — 50 Hz', 'Very high ambient temperature derating and sand/dust protection', 'National grid operator (SEC) procurement and international compliance', 'Large-scale solar + BESS integration and grid-stability requirements', 'Strong demand for power and distribution transformers, reactors and GSUs'],
    faq: [
      ['Who buys transformers in Saudi Arabia?', 'The Saudi Electricity Company (SEC) and its subsidiaries, alongside independent power producers (IPPs) and the developer-owners of Vision 2030 giga-projects.'],
      ['What transformer voltage does Saudi Arabia use?', 'The transmission grid is 380 kV / 110 kV, with distribution at 13.8 kV and lower. Frequency is 50 Hz.'],
      ['Why is upstream demand growing so fast?', 'Project awards rose sharply in 2026 (per TransformerPath intel), with substation and transmission build-out a direct consequence of large solar, industrial and giga-project loads.'],
    ] },
  { slug: 'india', name: 'India', gridsName: 'India', manufName: 'India', region: 'South Asia', flag: '🇮🇳',
    intel: 'India', kw: ['india', 'indian', 'ceat', 'power grid'],
    blurb: 'India is one of the largest and most competitive transformer manufacturing bases in the world — and one of the biggest buyers. With an extensive 765/400/220 kV grid and an enormous distribution-transformer replacement and rural-electrification programme, demand spans EHV power transformers down to pole-mounted distribution units and dry-type.',
    tech: ['765 kV / 400 / 220 / 132 / 66 / 33 / 11 kV, 50 Hz', 'CEA (Central Electricity Authority) and CIGRE India frameworks', 'BIS (IS) standards in addition to IEC; heavy distribution-transformer usage', 'Strong export base plus domestic demand from state utilities and IPPs', 'Grid-scale renewables and modernisation increasing demand for reactors and GSUs'],
    faq: [
      ['Which Indian manufacturers produce EHV transformers?', 'TransformerPath tracks a large Indian base; the largest nameplate EHV suppliers are the national OEMs, and the full country-level list is on the India directory page.'],
      ['What voltage does India transmit at?', '765 kV AC is the highest operating voltage class, alongside ±800 kV HVDC interconnectors, with 400 kV, 220 kV, 132 kV, 66 kV, 33 kV and 11 kV below.'],
      ['How does TransformerPath classify manufacturers?', 'By manufacturer type (power, distribution, dry-type) and by country; directory inclusion is a census listing, not an endorsement.'],
    ] },
  { slug: 'china', name: 'China', gridsName: 'China', manufName: 'China', region: 'East Asia', flag: '🇨🇳',
    intel: 'RoW', kw: ['china', 'chinese', 'state grid', 'uhv', 'sgcc'],
    blurb: 'China is the world\'s largest transformer market and manufacturing base, operating the most expansive ultra-high-voltage (UHV) AC/DC transmission system. State Grid (SGCC) and China Southern Grid drive enormous MV/HV demand, and Chinese OEMs are the largest global exporters of power and distribution transformers.',
    tech: ['UHV AC up to 1000 kV and UHV DC ±800 kV, with 750/500/220/110 kV below', '50 Hz national grid; GB standards, heavily aligned with IEC', 'State Grid Corporation (SGCC) and China Southern Grid (CSG) procurement', 'Largest converter-transformer and GSU demand in the world', 'Massive domestic capacity plus global export of transformers and components'],
    faq: [
      ['What is the highest voltage in China?', 'China operates 1000 kV UHV AC and ±800 kV UHV DC — the highest voltage classes in commercial service — with 750 kV and 500 kV feeding regional networks.'],
      ['Who are the main grid operators?', 'State Grid Corporation of China (SGCC) covers most of the country; China Southern Grid (CSG) covers the southern provinces.'],
      ['Is China a major exporter of transformers?', 'Yes — Chinese OEMs are the largest global source of power and distribution transformers and many component categories, which is why they appear across TransformerPath country pages.'],
    ] },
  { slug: 'usa', name: 'United States', gridsName: 'USA', manufName: 'USA', region: 'North America', flag: '🇺🇸',
    intel: 'USA', kw: ['u.s.', 'usa', 'united states', 'american', 'doe', 'ferc'],
    blurb: 'The US is a massive, 60 Hz market in the middle of a transformer supply crunch. Grid hardening, renewables, data-centre load growth and ageing infrastructure are driving demand for both liquid-filled and dry-type distribution and power transformers, with a strong emphasis on ANSI/IEEE compliance and short lead times.',
    tech: ['765 kV / 500 / 345 / 230 / 138 / 69 kV transmission; 60 Hz', 'ANSI / IEEE / NEMA standards (IEEE C57 series)', 'Distribution transformers (pole-mounted, pad-mounted, dry-type) widely used', 'Data-centre and renewables load growth driving 138–345 kV demand', 'RDIs and regulatory focus on transformer supply security and lead times'],
    faq: [
      ['What standards apply in the US?', 'ANSI/IEEE C57 standards govern transformer design and testing, with NEMA for distribution equipment; the US uses 60 Hz.'],
      ['Why is there a US transformer shortage?', 'Under-investment in domestic capacity, a surge in data-centre and renewables load, and long lead times for large units have created sustained supply pressure and higher prices.'],
      ['How can buyers source US-compliant transformers?', 'Use the TransformerPath USA manufacturers directory, then submit an RFQ specifying the IEEE class, voltage and rating required.'],
    ] },
  { slug: 'germany', name: 'Germany', gridsName: 'Germany', manufName: 'Germany', region: 'Europe', flag: '🇩🇪',
    intel: 'Europe', kw: ['german', 'germany', 'entso', 'tennet', 'europe'],
    blurb: 'Germany is the engineering heart of the European transformer industry. It is a demanding market for high-efficiency, low-loss distribution and power transformers, shaped by EU eco-design (Tier requirements), aggressive renewable integration and the TSO-led grid reinforcement of a 50 Hz ENTSO-E network.',
    tech: ['380 kV / 220 / 110 kV, 50 Hz ENTSO-E', 'Eco-design / EU (EU No 548/2014) efficiency requirements', 'IEC as EN standards (DIN VDE); strong transformer and component OEM base', 'High renewable penetration drives distribution and grid-stability demand', 'Grid reinforcement and offshore wind connection increase transformer and reactor needs'],
    faq: [
      ['What transformer standard does Germany follow?', 'IEC standards adopted as EN with DIN VDE additions; EU eco-design sets minimum efficiency (Tier 1/2) for distribution transformers.'],
      ['Which grid operators buy transformers in Germany?', 'The four TSOs (TenneT, 50Hertz, Amprion, TransnetBW) operate the 380/220 kV network; distribution operators (DSOs) buy large numbers of distribution transformers.'],
      ['Is German manufacturing significant?', 'Yes — Germany hosts major power-transformer and component OEMs and is a centre of engineering for the European industry.'],
    ] },
  { slug: 'turkiye', name: 'Türkiye', gridsName: 'Türkiye', manufName: 'Türkiye', region: 'Eurasia', flag: '🇹🇷',
    intel: 'RoW', kw: ['turkey', 'türkiye', 'teias', 'turkish'],
    blurb: 'Türkiye is a fast-growing transformer producer, exporter and consumer, sitting at the junction of Europe, the Middle East and Central Asia. A strong domestic OEM base serves both the national TEİAŞ grid and large export markets, with a 50 Hz network that is synchronised to the European (ENTSO-E) system.',
    tech: ['400 kV / 154 / 31.5 kV, 50 Hz, synchronised to ENTSO-E', 'IEC-based with TSE standards; large and growing export base', 'TEİAŞ national grid operator; strong distribution transformer manufacturing', 'High interconnector activity and renewable build-out', 'Valuable exporter of distribution and power transformers to Europe, Africa and the Middle East'],
    faq: [
      ['What voltage does Türkiye transmit at?', 'The national grid operates at 400 kV and 154 kV, with distribution typically at 31.5 kV and below, at 50 Hz.'],
      ['Is Türkiye synchronised to Europe?', 'Yes — Türkiye is part of the ENTSO-E synchronous area, so European interconnection rules and standards apply.'],
      ['Why is Turkish manufacturing important?', 'A strong domestic OEM base produces and exports distribution and power transformers at scale, making it a competitive sourcing hub.'],
    ] },
  { slug: 'brazil', name: 'Brazil', gridsName: 'Brazil', manufName: 'Brazil', region: 'Latin America', flag: '🇧🇷',
    intel: 'RoW', kw: ['brazil', 'brazilian', 'ons', 'sin', 'eletrobras'],
    blurb: 'Brazil runs a predominantly hydro-based, 60 Hz grid (the SIN — Sistema Interligado Nacional), with a large and competitive domestic transformer industry and rising demand from transmission auction expansion, renewables and grid modernisation.',
    tech: ['500 kV / 230 / 138 / 88 / 69 kV transmission; 60 Hz', 'ONS (Operador Nacional do Sistema) grid codes and interconnection rules', 'A large domestic power/distribution transformer OEM base', 'Hydro-dominated generation plus growing wind and solar build-out', 'Transmission auctions (leilões) drive substation and transformer packages'],
    faq: [
      ['What voltage does Brazil transmit at?', 'The SIN operates at 500 kV and 230 kV transmission, with 138 kV, 88 kV and 69 kV sub-transmission and lower distribution voltages, at 60 Hz.'],
      ['Who buys transformers in Brazil?', 'Transmission utilities (cemig, Taesa, ISA, Eletrobras companies) and distribution utilities, plus the winning consortia of the transmission auctions.'],
      ['Is Brazil a major transformer producer?', 'Yes — Brazil has a substantial domestic power and distribution transformer industry serving both its own grid and export markets.'],
    ] },
  { slug: 'south-korea', name: 'South Korea', gridsName: 'South Korea', manufName: 'South Korea', region: 'East Asia', flag: '🇰🇷',
    intel: 'RoW', kw: ['korea', 'korean', 'kepco', 'hyundai', 'ls'],
    blurb: 'South Korea is home to some of the largest transformer and grid-equipment makers in the world (LS, HD Hyundai Electric, Hyosung). It operates a dense 60 Hz grid and its OEMs are major exporters, especially as US and global demand surges.',
    tech: ['765 kV / 345 / 154 / 66 kV transmission; 60 Hz', 'KEPCO (Korea Electric Power Corporation) grid and procurement standards', 'KS standards aligned with IEC', 'Large exporting OEM base in power and distribution transformers', 'Driven by domestic grid reliability plus strong export demand'],
    faq: [
      ['Which Korean manufacturers are global?', 'LS Electric, HD Hyundai Electric and Hyosung Heavy Industries are leading Korean power-equipment makers, and several are now expanding US capacity.'],
      ['What voltage does South Korea use?', 'The KEPCO grid operates at 765 kV, 345 kV, 154 kV and 66 kV, at 60 Hz.'],
      ['Why are Korean OEMs exporting so much?', 'Domestic technical strength plus the global transformer shortage make Korean builders a key source, with new plants planned overseas.'],
    ] },
  { slug: 'vietnam', name: 'Vietnam', gridsName: 'Vietnam', manufName: 'Vietnam', region: 'Southeast Asia', flag: '🇻🇳',
    intel: 'RoW', kw: ['vietnam', 'vietnamese', 'evn', 'power'],
    blurb: 'Vietnam is a fast-growing, 50 Hz market with rapid load growth, a large distribution-transformer manufacturing base and rising demand from renewables and industrial parks. Domestic OEMs supply much of the distribution equipment and increasingly export.',
    tech: ['500 kV / 220 / 110 / 35 / 22 kV; 50 Hz', 'EVN (Vietnam Electricity) grid and procurement framework', 'TCVN standards, widely aligned with IEC', 'Strong distribution-transformer manufacturing base (MBT, THIBIDI, EEMC, BTH, HBT) plus foreign plants', 'Rapid industrial and renewable load growth'],
    faq: [
      ['What voltage does Vietnam use?', 'The national grid is 500 kV and 220 kV transmission with 110 kV, 35 kV and 22 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Vietnam?', 'EVN and its regional power companies, plus industrial parks and the growing renewable and utility-scale solar/wind sector.'],
      ['Does Vietnam manufacture transformers?', 'Yes — Vietnam has a substantial distribution and power transformer manufacturing base, including MBT, THIBIDI, EEMC (Dong Anh), BTH and HBT.'],
    ] },
  { slug: 'japan', name: 'Japan', gridsName: 'Japan', manufName: 'Japan', region: 'East Asia', flag: '🇯🇵',
    intel: 'RoW', kw: ['japan', 'japanese', 'tepco', 'tokyo electric', 'j-gate'],
    blurb: 'Japan is a technically advanced, 50/60 Hz market (split between eastern 50 Hz and western 60 Hz) with leading OEMs (Toshiba, Hitachi Energy, Fuji, Meiden) and a premium focus on reliability, low loss and compact design. Demand is steady, from utility renewal and industrial load.',
    tech: ['500 kV / 275 / 154 / 66 / 22 kV (50 Hz east, 60 Hz west)', 'JEC/Japanese grid standards, plus IEC alignment for exports', 'Leading OEM base (Toshiba, Hitachi, Fuji, Meiden) — many global suppliers', 'Emphasis on low-loss, compact, high-reliability design', 'Utility asset renewal and growing data-centre/industrial load'],
    faq: [
      ['Why is Japan split 50/60 Hz?', 'The eastern grid runs at 50 Hz and the western at 60 Hz — a legacy of different imported technologies — requiring frequency-converter interties between the regions.'],
      ['What voltage does Japan use?', 'Transmission runs at 500 kV, 275 kV, 154 kV and 66 kV, with distribution at 22 kV and below.'],
      ['Are Japanese OEMs important globally?', 'Yes — Toshiba, Hitachi Energy, Fuji and Meiden are significant global transformer and grid-equipment suppliers.'],
    ] },
  { slug: 'united-kingdom', name: 'United Kingdom', gridsName: 'United Kingdom', manufName: 'United Kingdom', region: 'Europe', flag: '🇬🇧',
    intel: 'Europe', kw: ['uk', 'britain', 'national grid', 'british', 'ofgem'],
    blurb: 'The UK is a mature 50 Hz, ENTSO-E-synchronised market with a strong engineering heritage, an offshore-wind and interconnector-driven build-out, and a $multi-billion transmission upgrade programme. Its grid operator (National Grid/ESO) and DSOs buy power, distribution and reactor transformers, and offshore wind drives high-value converter and GSU demand.',
    tech: ['400 kV / 275 / 132 / 33 / 11 kV, 50 Hz ENTSO-E', 'National Grid ESO and Ofgem framework; BS/EN (IEC-aligned)', 'Large offshore-wind and interconnector build-out drives converter/GSU demand', 'Asset renewal plus a major transmission upgrade programme', 'Historical OEM base plus importing from Europe and beyond'],
    faq: [
      ['Who buys transformers in the UK?', 'National Grid (transmission), the DSOs (distribution), and the offshore-wind and interconnector developers.'],
      ['What voltage does the UK use?', 'The transmission grid is 400 kV and 275 kV, with 132 kV, 33 kV and 11 kV below, at 50 Hz.'],
      ['Why is UK transformer demand rising?', 'Offshore wind, interconnectors and a major transmission reinforcement programme are driving power, GSU and reactor demand.'],
    ] },
  { slug: 'italy', name: 'Italy', gridsName: 'Italy', manufName: 'Italy', region: 'Europe', flag: '🇮🇹',
    intel: 'Europe', kw: ['italy', 'italian', 'terna', 'enel'],
    blurb: 'Italy is a 50 Hz ENTSO-E market with a sophisticated grid (Terna transmission, e-distribuzione DSO) and a strong transformer OEM/component base. Distribution-network renewal and renewable integration drive steady primary-substation transformer demand.',
    tech: ['380 kV / 220 / 150 / 132 / 66 / 20 kV, 50 Hz ENTSO-E', 'Terna (transmission) and e-distribuzione (distribution) frameworks', 'A notable OEM and component base (and key converter/GSU for renewables)', 'Distribution substation renewal and renewable grid connection', 'CEI/EN (IEC-aligned) standards'],
    faq: [
      ['What voltage does Italy use?', 'Transmission at 380 kV and 220 kV, with 150 kV, 132 kV, 66 kV and 20 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Italy?', 'Terna (transmission) and e-distribuzione (the main DSO), plus renewable and industrial developers.'],
      ['Are Italian OEMs significant?', 'Yes — Italy has a strong transformer and component base serving both the domestic grid and export markets.'],
    ] },
  { slug: 'thailand', name: 'Thailand', gridsName: 'Thailand', manufName: 'Thailand', region: 'Southeast Asia', flag: '🇹🇭',
    intel: 'RoW', kw: ['thailand', 'thai', 'egat', 'pea', 'mea'],
    blurb: 'Thailand operates a 50 Hz grid under EGAT (generation/transmission) and the PEA/MEA distribution utilities, with a substantial local transformer industry (Ekarat, Tirathai, QTC, Thai Trafo) and steady demand from grid expansion, renewables and industrial parks.',
    tech: ['230 kV / 115 / 69 / 22 kV, 50 Hz', 'EGAT (transmission) and PEA/MEA (distribution) procurement', 'TIS standards aligned with IEC', 'A solid domestic transformer OEM base (Ekarat, Tirathai, QTC, Thai Trafo)', 'Rising renewable and industrial load growth'],
    faq: [
      ['What voltage does Thailand use?', 'The EGAT grid is 230 kV (and 115 kV/69 kV), with distribution at 22 kV and below, at 50 Hz.'],
      ['Who buys transformers in Thailand?', 'EGAT (transmission), the PEA and MEA (distribution), and renewable and industrial developers.'],
      ['Does Thailand manufacture transformers?', 'Yes — Thailand has a strong base including Ekarat Engineering, Tirathai, QTC Energy and Thai Trafo Manufacturing.'],
    ] },
  { slug: 'indonesia', name: 'Indonesia', gridsName: 'Indonesia', manufName: 'Indonesia', region: 'Southeast Asia', flag: '🇮🇩',
    intel: 'RoW', kw: ['indonesia', 'indonesian', 'pln', 'java-bali'],
    blurb: 'Indonesia is a large, archipelagic 50 Hz market dominated by PLN, with huge distribution-transformer demand across its thousands of islands and growing generation/transmission build-out. Domestic OEMs (Trafoindo, Bambang Djaja, Unindo) and foreign plants serve the grid.',
    tech: ['275 kV / 150 / 70 / 20 kV, 50 Hz', 'PLN (Perusahaan Listrik Negara) grid and procurement standards', 'SNI/IEC-aligned standards', 'A solid domestic transformer base (Trafoindo, Bambang Djaja, Unindo) plus foreign plants', 'Huge distribution-transformer demand across the archipelago'],
    faq: [
      ['What voltage does Indonesia use?', 'The PLN grid operates at 275 kV and 150 kV, with 70 kV and 20 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Indonesia?', 'PLN and its regional and generation subsidiaries are the dominant buyer, alongside industrial and renewable developers.'],
      ['Does Indonesia manufacture transformers?', 'Yes — Indonesia has a domestic base including Trafoindo Prima Perkasa, Bambang Djaja and Unindo, plus foreign-owned plants.'],
    ] },
  { slug: 'pakistan', name: 'Pakistan', gridsName: 'Pakistan', manufName: 'Pakistan', region: 'South Asia', flag: '🇵🇰',
    intel: 'RoW', kw: ['pakistan', 'pakistani', 'ntdc', 'k-electric'],
    blurb: 'Pakistan operates a 50 Hz grid under NTDC (transmission) and DISCOs/K-Electric (distribution), with a sizeable domestic distribution-transformer industry and rising demand from grid modernisation, load growth and an energy-security push.',
    tech: ['500 kV / 220 / 132 / 66 / 11 kV, 50 Hz', 'NTDC (transmission) and the DISCOs/K-Electric (distribution) framework', 'PEC/IEC-aligned standards', 'A notable domestic base (Pak Elektron, Siemens Pakistan, Trafo Link, Transfopower)', 'Grid modernisation and load growth'],
    faq: [
      ['What voltage does Pakistan use?', 'The grid is 500 kV and 220 kV transmission, with 132 kV, 66 kV and 11 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Pakistan?', 'NTDC (transmission), the distribution companies and K-Electric, plus industrial and renewable developers.'],
      ['Does Pakistan manufacture transformers?', 'Yes — Pakistan has a domestic base including Pak Elektron (PEL), Siemens Pakistan, Transfopower and Trafo Link.'],
    ] },
  { slug: 'south-africa', name: 'South Africa', gridsName: 'South Africa', manufName: 'South Africa', region: 'Africa', flag: '🇿🇦',
    intel: 'RoW', kw: ['south africa', 'south african', 'eskom', 'sappi'],
    blurb: 'South Africa is the most industrialised grid in Africa, 50 Hz under Eskom (transmission/generation) and municipal distributors. It faces load-shedding and a major grid-reinforcement and renewables-transition programme, driving transformer, reactor and GSU demand.',
    tech: ['765 kV / 400 / 275 / 132 / 88 / 66 / 22 kV, 50 Hz', 'Eskom (transmission) and municipal/DSO procurement', 'SANS/IEC-aligned standards', 'A domestic base plus imports to meet high demand', 'Grid reinforcement, renewables and the energy-transition programme'],
    faq: [
      ['What voltage does South Africa use?', 'Eskom operates 765 kV, 400 kV and 275 kV transmission, with 132 kV, 88 kV, 66 kV and 22 kV distribution, at 50 Hz.'],
      ['Who buys transformers in South Africa?', 'Eskom (transmission and generation) and the municipal distributors, plus renewable and industrial developers.'],
      ['Why is demand growing?', 'Grid reinforcement, a large renewables build-out and the energy-transition programme are driving transformer, reactor and GSU demand.'],
    ] },
  { slug: 'mexico', name: 'Mexico', gridsName: 'Mexico', manufName: 'Mexico', region: 'Latin America', flag: '🇲🇽',
    intel: 'RoW', kw: ['mexico', 'mexican', 'cfe'],
    blurb: 'Mexico operates a 60 Hz grid under CFE (Comisión Federal de Electricidad), with strong demand from industrial parks, manufacturing (near-shoring) and renewables. Its OEM and component base serves both the domestic grid and export, and CFE is a large, steady transformer buyer.',
    tech: ['400 kV / 230 / 138 / 69 / 13.8 kV, 60 Hz', 'CFE (Comisión Federal de Electricidad) grid and procurement framework', 'NMX/IEC-aligned standards', 'A domestic OEM and component base plus imports', 'Near-shoring, industrial parks and renewables drive demand'],
    faq: [
      ['What voltage does Mexico use?', 'The CFE grid operates at 400 kV and 230 kV, with 138 kV, 69 kV and 13.8 kV distribution, at 60 Hz.'],
      ['Who buys transformers in Mexico?', 'CFE (transmission and distribution) is the dominant buyer, alongside industrial parks and renewable developers.'],
      ['Why is Mexican demand rising?', 'Near-shoring and industrial growth, plus a growing renewables build-out, are increasing transformer and substation demand.'],
    ] },
  { slug: 'canada', name: 'Canada', gridsName: 'Canada', manufName: 'Canada', region: 'North America', flag: '🇨🇦',
    intel: 'USA', kw: ['canada', 'canadian', 'hydro', 'hydro-quebec'],
    blurb: 'Canada is a 60 Hz North American market with large hydro, a strong grid and growing demand from electrification, renewables and data centres. Provincial utilities (Hydro-Québec, BC Hydro, etc.) buy transformers to ANSI/IEEE standards, and the country has a capable domestic OEM/component base.',
    tech: ['765 kV / 500 / 315 / 230 / 115 / 25 kV, 60 Hz', 'Provincial utilities and the ISO/ANS/IEEE grid framework', 'CSA/ANS/IEC-aligned standards', 'A capable domestic OEM and component base', 'Electrification, renewables and data-centre load growth'],
    faq: [
      ['What voltage does Canada use?', 'Transmission runs at 765 kV, 500 kV, 315 kV and 230 kV, with 115 kV and lower distribution, at 60 Hz.'],
      ['Who buys transformers in Canada?', 'The provincial utilities (Hydro-Québec, BC Hydro, Ontario, etc.) and renewable/industrial developers.'],
      ['What standards apply?', 'Canadian utilities use ANSI/IEEE (C57) standards with local CSA requirements, at 60 Hz.'],
    ] },
  { slug: 'france', name: 'France', gridsName: 'France', manufName: 'France', region: 'Europe', flag: '🇫🇷',
    intel: 'Europe', kw: ['france', 'french', 'rte', 'edf'],
    blurb: 'France operates a high-voltage 50 Hz ENTSO-E grid under RTE (transmission) and Enedis (distribution), with a nuclear-heavy generation mix and a growing renewables build-out. Its transformer market is driven by grid renewal, nuclear and renewable connection, and it hosts major OEM/component engineering.',
    tech: ['400 kV / 225 / 90 / 63 / 20 kV, 50 Hz ENTSO-E', 'RTE (transmission), Enedis (distribution), EDF (generation)', 'NF/EN (IEC-aligned) standards', 'A notable OEM and component base', 'Nuclear, renewable and grid-renewal demand'],
    faq: [
      ['What voltage does France use?', 'RTE operates at 400 kV and 225 kV, with 90 kV, 63 kV and 20 kV distribution, at 50 Hz.'],
      ['Who buys transformers in France?', 'RTE (transmission), Enedis (distribution) and EDF (generation), plus renewable and industrial developers.'],
      ['Why is French demand steady?', 'Nuclear-renewal, renewable connection and grid-renewal programmes keep transformer demand healthy.'],
    ] },
  { slug: 'spain', name: 'Spain', gridsName: 'Spain', manufName: 'Spain', region: 'Europe', flag: '🇪🇸',
    intel: 'Europe', kw: ['spain', 'spanish', 'ree', 'iberdrola'],
    blurb: 'Spain is a 50 Hz ENTSO-E market with a high renewable share, operated by Red Eléctrica (transmission) and major DSOs. Its peninsular grid and interconnectors drive transformer, GSU and reactor demand, and the country has a capable transformer/component base.',
    tech: ['400 kV / 220 / 132 / 66 / 46 / 20 kV, 50 Hz ENTSO-E', 'Red Eléctrica de España (transmission), DSOs and renewable developers', 'UNE/EN (IEC-aligned) standards', 'A capable transformer and component base', 'High renewable share and interconnector activity'],
    faq: [
      ['What voltage does Spain use?', 'Red Eléctrica operates at 400 kV and 220 kV, with 132 kV, 66 kV, 46 kV and 20 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Spain?', 'Red Eléctrica (transmission), the DSOs and the renewable/industrial developers.'],
      ['Why is Spanish demand rising?', 'A high renewable share and interconnector build-out drive GSU, collector and reactor demand.'],
    ] },
  { slug: 'netherlands', name: 'Netherlands', gridsName: 'Netherlands', manufName: 'Netherlands', region: 'Europe', flag: '🇳🇱',
    intel: 'Europe', kw: ['netherlands', 'dutch', 'tennet', 'gasunie'],
    blurb: 'The Netherlands operates a dense 50 Hz ENTSO-E grid under TenneT (transmission) and regional DSOs, with strong offshore-wind, data-centre and electrification demand. Its transformer market is driven by offshore-wind export, grid reinforcement and a major import-reliance story.',
    tech: ['380 kV / 220 / 150 / 110 / 25 / 10 kV, 50 Hz ENTSO-E', 'TenneT (transmission) and the regional DSOs', 'NEN/EN (IEC-aligned) standards', 'Imports plus a modest domestic base', 'Offshore wind, data centres and electrification drive demand'],
    faq: [
      ['What voltage does the Netherlands use?', 'TenneT operates at 380 kV and 220 kV, with 150 kV, 110 kV and lower distribution, at 50 Hz.'],
      ['Who buys transformers in the Netherlands?', 'TenneT (transmission), the DSOs and the offshore-wind and data-centre developers.'],
      ['Why is demand growing?', 'Offshore-wind export, grid reinforcement and data-centre load are driving transformer demand.'],
    ] },
  { slug: 'poland', name: 'Poland', gridsName: 'Poland', manufName: 'Poland', region: 'Europe', flag: '🇵🇱',
    intel: 'Europe', kw: ['poland', 'polish', 'pse', 'overwatch'],
    blurb: 'Poland is a fast-transitioning 50 Hz ENTSO-E market, with PSE (PSE S.A.) operating the transmission grid and several DSOs. Its coal-to-renewables transition and grid reinforcement are driving large transformer, GSU and reactor demand, and the country is a strong manufacturing and sourcing hub.',
    tech: ['400 kV / 220 / 110 / 30 / 15 kV, 50 Hz ENTSO-E', 'PSE (transmission) and the DSOs', 'PN/EN (IEC-aligned) standards', 'A strong manufacturing base and key European sourcing hub', 'Coal-to-renewables transition and grid reinforcement'],
    faq: [
      ['What voltage does Poland use?', 'PSE operates at 400 kV and 220 kV, with 110 kV and 30/15 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Poland?', 'PSE (transmission), the DSOs and the renewable/industrial developers.'],
      ['Is Poland a manufacturing hub?', 'Yes — Poland has a strong transformer and components manufacturing base and is a key European sourcing destination.'],
    ] },
  { slug: 'sweden', name: 'Sweden', gridsName: 'Sweden', manufName: 'Sweden', region: 'Europe', flag: '🇸🇪',
    intel: 'Europe', kw: ['sweden', 'swedish', 'svk', 'vattenfall'],
    blurb: 'Sweden is a 50 Hz Nordic ENTSO-E market with a large hydro and wind base, operated by Svenska kraftnät (transmission) and the DSOs. Its transmission build-out, offshore wind and electrification of industry drive power-transformer and reactor demand, and it has a strong OEM/engineering base.',
    tech: ['400 kV / 220 / 130 / 120 / 60 / 11 kV, 50 Hz ENTSO-E', 'Svenska kraftnät (transmission) and the DSOs', 'SS/EN (IEC-aligned) standards', 'A strong OEM and engineering base', 'Offshore wind, industrial electrification and grid reinforcement'],
    faq: [
      ['What voltage does Sweden use?', 'Svenska kraftnät operates at 400 kV and 220 kV, with 130 kV, 120 kV and lower distribution, at 50 Hz.'],
      ['Who buys transformers in Sweden?', 'Svenska kraftnät (transmission), the DSOs and the industrial/offshore-wind developers.'],
      ['Why is Swedish demand growing?', 'Offshore wind, industrial electrification and grid reinforcement are driving power-transformer and reactor demand.'],
    ] },
  { slug: 'chile', name: 'Chile', gridsName: 'Chile', manufName: 'Chile', region: 'Latin America', flag: '🇨🇱',
    intel: 'RoW', kw: ['chile', 'chilean', 'coordinador', 'nexans'],
    blurb: 'Chile operates a long, thin 50 Hz grid under the Coordinador Eléctrico (transmission coordination) and the generation/distribution utilities, with the world\'s highest solar and wind penetration plans. Its renewables build-out drives strong collector, GSU and grid-connection transformer demand.',
    tech: ['500 kV / 220 / 110 / 66 / 23 kV, 50 Hz', 'Coordinador Eléctrico Nacional (system operator) and the utilities', 'IEC-aligned standards', 'A modest domestic base plus imports', 'Very high solar/wind penetration and grid build-out'],
    faq: [
      ['What voltage does Chile use?', 'The Chilean grid is 500 kV and 220 kV transmission, with 110 kV, 66 kV and 23 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Chile?', 'The transmission companies, the generation/utilities and the renewable developers.'],
      ['Why is demand rising?', 'Chile has one of the highest renewable penetrations in the world, driving collector, GSU and grid-transformer demand.'],
    ] },
  { slug: 'colombia', name: 'Colombia', gridsName: 'Colombia', manufName: 'Colombia', region: 'Latin America', flag: '🇨🇴',
    intel: 'RoW', kw: ['colombia', 'colombian', 'xm', 'isa'],
    blurb: 'Colombia operates a hydro-dominated 60 Hz grid under XM (system operator) and ISA/the transmission companies. Its distributor and grid build-out, plus renewable and industrial growth, drive steady transformer demand, and the country is a notable Latin American market.',
    tech: ['500 kV / 230 / 115 / 34.5 / 13.2 kV, 60 Hz', 'XM (system operator), ISA and the transmission companies', 'IEC-aligned standards', 'A notable regional base', 'Hydro-dominated generation plus renewable and industrial growth'],
    faq: [
      ['What voltage does Colombia use?', 'The Colombian grid is 500 kV and 230 kV transmission, with 115 kV, 34.5 kV and 13.2 kV distribution, at 60 Hz.'],
      ['Who buys transformers in Colombia?', 'ISA and the transmission companies, the distributors and the renewable/industrial developers.'],
      ['Is Colombia a notable market?', 'Yes — a hydro-dominated Latin American grid with steady transformer and substation demand.'],
    ] },
  { slug: 'peru', name: 'Peru', gridsName: 'Peru', manufName: 'Peru', region: 'Latin America', flag: '🇵🇪',
    intel: 'RoW', kw: ['peru', 'peruvian', 'coes'],
    blurb: 'Peru operates a 60 Hz grid under the COES (system operator) and its generation/distribution utilities, with growing demand from mining, industrial and renewable projects. Its transmission and mining-sector transformer need is driven by copper/gold operations and grid expansion.',
    tech: ['500 kV / 220 / 138 / 60 / 22.9 kV, 60 Hz', 'COES (system operator), the distributors and the mining/industrial consumers', 'IEC-aligned standards', 'A modest domestic base plus imports', 'Mining, industrial and renewable-driven demand'],
    faq: [
      ['What voltage does Peru use?', 'The Peruvian grid is 500 kV and 220 kV transmission, with 138 kV, 60 kV and 22.9 kV distribution, at 60 Hz.'],
      ['Who buys transformers in Peru?', 'The utilities and the mining/industrial consumers, plus renewable developers.'],
      ['Why is demand driven by mining?', 'Large copper and gold operations and grid expansion create steady transformer and substation demand.'],
    ] },
  { slug: 'argentina', name: 'Argentina', gridsName: 'Argentina', manufName: 'Argentina', region: 'Latin America', flag: '🇦🇷',
    intel: 'RoW', kw: ['argentina', 'argentine', 'cammesa', 'transener'],
    blurb: 'Argentina operates a 50 Hz grid under CAMMESA (system operator) and Transener (transmission), with a large domestic transformer manufacturing base and demand from grid renewal, renewables and the Vaca Muerta energy build-out. It is a significant Latin American producer and consumer.',
    tech: ['500 kV / 330 / 220 / 132 / 66 / 13.2 kV, 50 Hz', 'CAMMESA (system operator), Transener (transmission) and the distributors', 'IEC-aligned standards', 'A large domestic transformer manufacturing base', 'Renewables, grid renewal and the Vaca Muerta energy build-out'],
    faq: [
      ['What voltage does Argentina use?', 'The grid is 500 kV and 330 kV transmission, with 220 kV, 132 kV and 66 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Argentina?', 'Transener (transmission), the distributors and the renewable/industrial developers, plus the Vaca Muerta energy build-out.'],
      ['Does Argentina manufacture transformers?', 'Yes — Argentina has a large domestic power and distribution transformer manufacturing base serving both its grid and exports.'],
    ] },
  { slug: 'egypt', name: 'Egypt', gridsName: 'Egypt', manufName: 'Egypt', region: 'Africa', flag: '🇪🇬',
    intel: 'RoW', kw: ['egypt', 'egyptian', 'eetc', 'elsewedy'],
    blurb: 'Egypt operates a 50 Hz grid under EETC (the Egyptian Electricity Transmission Company), with a strong domestic OEM base (elsewedy, etc.) and high demand from grid build-out, renewables and the energy-transition programme. It is a key transformer and component hub in North Africa.',
    tech: ['500 kV / 220 / 132 / 66 / 33 / 11 kV, 50 Hz', 'EETC (Egyptian Electricity Transmission Company) and the distributors', 'IEC-aligned standards', 'A strong domestic OEM and component base (elsewedy among others)', 'Grid build-out, renewables and the energy-transition programme'],
    faq: [
      ['What voltage does Egypt use?', 'The EETC grid is 500 kV and 220 kV transmission, with 132 kV, 66 kV and 11 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Egypt?', 'EETC (transmission) and the distribution companies, plus the renewable and industrial developers.'],
      ['Does Egypt manufacture transformers?', 'Yes — Egypt has a strong OEM and components base and is a key transformer-only and component sourcing hub in North Africa.'],
    ] },
  { slug: 'taiwan', name: 'Taiwan', gridsName: 'Taiwan', manufName: 'Taiwan', region: 'East Asia', flag: '🇹🇼',
    intel: 'RoW', kw: ['taiwan', 'taiwanese', 'taipower'],
    blurb: 'Taiwan operates a 60 Hz grid under Taipower, with a capable domestic transformer/switchgear base (Fortune, Shihlin, TECO, Allis) and steady demand from industrial parks, data centres and renewable integration. It also serves as an export base.',
    tech: ['345 kV / 161 / 69 / 22.8 / 11.4 kV, 60 Hz', 'Taipower (Taiwan Power Company) grid and procurement', 'CNS/IEC-aligned standards', 'A capable domestic transformer and switchgear base', 'Industrial, data-centre and renewable-driven demand'],
    faq: [
      ['What voltage does Taiwan use?', 'The Taipower grid is 345 kV and 161 kV, with 69 kV and 22.8/11.4 kV distribution, at 60 Hz.'],
      ['Who buys transformers in Taiwan?', 'Taipower (transmission and distribution), plus the industrial, data-centre and renewable developers.'],
      ['Does Taiwan manufacture transformers?', 'Yes — Taiwan has a capable base including Fortune Electric, Shihlin Electric, TECO and Allis Electric.'],
    ] },
  { slug: 'czechia', name: 'Czechia', gridsName: 'Czechia', manufName: 'Czechia', region: 'Europe', flag: '🇨🇿',
    intel: 'Europe', kw: ['czechia', 'czech', 'ceps', 'eg'],
    blurb: 'Czechia operates a 50 Hz ENTSO-E grid under ČEPS (transmission) and the distribution companies, with a strong industrial and manufacturing base and a significant transformer/component OEM presence. Grid renewal and interconnection drive steady demand.',
    tech: ['400 kV / 220 / 110 / 22 kV, 50 Hz ENTSO-E', 'ČEPS (transmission) and the distribution companies', 'ČSN/EN (IEC-aligned) standards', 'A strong industrial and component base', 'Grid renewal and interconnection'],
    faq: [
      ['What voltage does Czechia use?', 'ČEPS operates at 400 kV and 220 kV, with 110 kV and 22 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Czechia?', 'ČEPS (transmission), the distribution companies and the industrial developers.'],
      ['Is there a transformer OEM base?', 'Yes — Czechia has a strong industrial and component base and is an established European sourcing hub.'],
    ] },
  { slug: 'norway', name: 'Norway', gridsName: 'Norway', manufName: 'Norway', region: 'Europe', flag: '🇳🇴',
    intel: 'Europe', kw: ['norway', 'norwegian', 'statnett'],
    blurb: 'Norway is a 50 Hz Nordic ENTSO-E market dominated by hydro, operated by Statnett (transmission) and the DSOs. Its offshore-wind, industrial-electrification and interconnection build-out drives power-transformer and converter demand.',
    tech: ['420 kV / 300 / 132 / 66 / 22 kV, 50 Hz ENTSO-E', 'Statnett (transmission) and the DSOs', 'NEK/EN (IEC-aligned) standards', 'A modest domestic base plus imports', 'Hydro, offshore wind, electrification and interconnection'],
    faq: [
      ['What voltage does Norway use?', 'Statnett operates at 420 kV and 300 kV, with 132 kV, 66 kV and 22 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Norway?', 'Statnett (transmission), the DSOs and the industrial/offshore-wind developers.'],
      ['Why is demand rising?', 'Offshore wind, industrial electrification and interconnection are driving power-transformer and converter demand.'],
    ] },
  { slug: 'venezuela', name: 'Venezuela', gridsName: 'Venezuela', manufName: 'Venezuela', region: 'Latin America', flag: '🇻🇪',
    intel: 'RoW', kw: ['venezuela', 'venezuelan', 'corpoelec'],
    blurb: 'Venezuela operates a 60 Hz grid under Corpoelec (the state utility), with a major focus on asset renewal after years of under-investment. Domestic OEMs and imports supply the transformer and substation equipment needed for recovery and modernisation.',
    tech: ['765 kV / 400 / 230 / 138 / 34.5 / 13.8 kV, 60 Hz', 'Corpoelec (state utility) and the regional companies', 'IEC-aligned standards', 'A domestic base plus imports', 'Asset renewal and grid modernisation after years of under-investment'],
    faq: [
      ['What voltage does Venezuela use?', 'The grid includes 765 kV and 400 kV transmission, with 230 kV, 138 kV and 34.5/13.8 kV distribution, at 60 Hz.'],
      ['Who buys transformers in Venezuela?', 'Corpoelec and the regional electricity companies are the main buyers.'],
      ['What is driving demand?', 'Asset renewal and grid modernisation after years of under-investment are the key transformer and substation needs.'],
    ] },
  { slug: 'finland', name: 'Finland', gridsName: 'Finland', manufName: 'Finland', region: 'Europe', flag: '🇫🇮',
    intel: 'Europe', kw: ['finland', 'finnish', 'fingrid'],
    blurb: 'Finland is a 50 Hz Nordic ENTSO-E market operated by Fingrid (transmission) and the DSOs, with strong offshore-wind, industrial and cross-border interconnection activity. Its transmission build-out and electrification drive power-transformer and reactor demand.',
    tech: ['400 kV / 220 / 110 / 20 kV, 50 Hz ENTSO-E', 'Fingrid (transmission) and the DSOs', 'SFS/EN (IEC-aligned) standards', 'A modest domestic base plus imports', 'Offshore wind, interconnection and industrial electrification'],
    faq: [
      ['What voltage does Finland use?', 'Fingrid operates at 400 kV and 220 kV, with 110 kV and 20 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Finland?', 'Fingrid (transmission), the DSOs and the industrial/offshore-wind developers.'],
      ['Why is demand rising?', 'Offshore wind, cross-border interconnection and industrial electrification are driving transformer demand.'],
    ] },
  { slug: 'nigeria', name: 'Nigeria', gridsName: 'Nigeria', manufName: 'Nigeria', region: 'Africa', flag: '🇳🇬',
    intel: 'RoW', kw: ['nigeria', 'nigeria grid', 'tcni'],
    blurb: 'Nigeria is the largest economy and grid in West Africa, 50 Hz under TCN (Transmission Company of Nigeria) and the distribution companies. Its huge grid-renewal, electrification and embedded-generation programme drives transformer and substation demand, with a growing local assembly base.',
    tech: ['330 kV / 132 / 33 / 11 kV, 50 Hz', 'TCN (Transmission Company of Nigeria) and the DisCos (distribution)', 'IEC-aligned standards', 'A growing local assembly/manufacturing base', 'Grid renewal, electrification and embedded-generation build-out'],
    faq: [
      ['What voltage does Nigeria use?', 'The TCN grid is 330 kV and 132 kV, with 33 kV and 11 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Nigeria?', 'TCN (transmission) and the DisCos (distribution companies), plus embedded-generation developers.'],
      ['Why is demand high?', 'A large grid-renewal, rural-electrification and embedded-generation programme is driving transformer and substation demand.'],
    ] },
  { slug: 'bulgaria', name: 'Bulgaria', gridsName: 'Bulgaria', manufName: 'Bulgaria', region: 'Europe', flag: '🇧🇬',
    intel: 'Europe', kw: ['bulgaria', 'bulgarian', 'eso', 'nek'],
    blurb: 'Bulgaria is a 50 Hz ENTSO-E market operated by ESO (transmission) and the DSOs, with a notable transformer and components manufacturing base and demand from grid renewal, renewables and interconnection. It is an established European sourcing hub.',
    tech: ['400 kV / 220 / 110 / 20 kV, 50 Hz ENTSO-E', 'ESO (transmission) and the distribution companies', 'BDS/EN (IEC-aligned) standards', 'A notable manufacturing and components base', 'Grid renewal, renewables and interconnection'],
    faq: [
      ['What voltage does Bulgaria use?', 'The ESO grid is 400 kV and 220 kV, with 110 kV and 20 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Bulgaria?', 'ESO (transmission), the distribution companies and the renewable/industrial developers.'],
      ['Is Bulgaria a manufacturing hub?', 'Yes — Bulgaria has a notable transformer and components manufacturing base and is an established European sourcing hub.'],
    ] },
  { slug: 'austria', name: 'Austria', gridsName: 'Austria', manufName: 'Austria', region: 'Europe', flag: '🇦🇹',
    intel: 'Europe', kw: ['austria', 'austrian', 'apg'],
    blurb: 'Austria is a 50 Hz ENTSO-E market operated by APG (transmission) and the DSOs, with strong renewable, hydro and interconnection activity and a capable transformer/component engineering base. It is a compact but high-craft market.',
    tech: ['380 kV / 220 / 110 / 10 kV, 50 Hz ENTSO-E', 'APG (transmission) and the distribution companies', 'ÖVE/EN (IEC-aligned) standards', 'A capable OEM and engineering base', 'Hydro, renewables and interconnection'],
    faq: [
      ['What voltage does Austria use?', 'APG operates at 380 kV and 220 kV, with 110 kV and lower distribution, at 50 Hz.'],
      ['Who buys transformers in Austria?', 'APG (transmission), the DSOs and the renewable/hydro developers.'],
      ['Is Austria an engineering hub?', 'Yes — Austria has a capable transformer and component engineering base serving its grid and export.'],
    ] },
  { slug: 'romania', name: 'Romania', gridsName: 'Romania', manufName: 'Romania', region: 'Europe', flag: '🇷🇴',
    intel: 'Europe', kw: ['romania', 'romanian', 'transelectrica'],
    blurb: 'Romania is a 50 Hz ENTSO-E market operated by Transelectrica (transmission) and the DSOs, with a growing transformer and components base and demand from grid renewal, renewables and EU-funded modernisation.',
    tech: ['400 kV / 220 / 110 / 20 kV, 50 Hz ENTSO-E', 'Transelectrica (transmission) and the distribution companies', 'SR/EN (IEC-aligned) standards', 'A growing manufacturing and components base', 'Grid renewal, renewables and EU-funded modernisation'],
    faq: [
      ['What voltage does Romania use?', 'Transelectrica operates at 400 kV and 220 kV, with 110 kV and 20 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Romania?', 'Transelectrica (transmission), the distribution companies and the renewable/industrial developers.'],
      ['Is there a manufacturing base?', 'Yes — Romania has a growing transformer and components manufacturing base supporting the regional grid.'],
    ] },
  { slug: 'uzbekistan', name: 'Uzbekistan', gridsName: 'Uzbekistan', manufName: 'Uzbekistan', region: 'Eurasia', flag: '🇺🇿',
    intel: 'RoW', kw: ['uzbekistan', 'uzbek', 'regions'],
    blurb: 'Uzbekistan is a fast-modernising 50 Hz market with a substantial grid-renewal programme and a growing industrial and renewable base. Its central-Asian grid build-out drives transformer, substation and component demand.',
    tech: ['500 kV / 220 / 110 / 10 kV, 50 Hz', 'The national utility and regional companies', 'IEC-aligned standards', 'A growing domestic base plus imports', 'Grid-renewal and industrial/renewable build-out'],
    faq: [
      ['What voltage does Uzbekistan use?', 'The grid is 500 kV and 220 kV, with 110 kV and 10 kV distribution, at 50 Hz.'],
      ['Who buys transformers in Uzbekistan?', 'The national utility and regional electricity companies, plus the industrial and renewable developers.'],
      ['Why is demand rising?', 'A major grid-renewal and industrial/renewable build-out programme is driving transformer and substation demand.'],
    ] },
];

// Region -> related Knowledge article slugs (query-intent tie-in + internal graph).
const REGION_KW = {
  'Middle East': ['gsu-transformers', 'onan-vs-onaf-vs-ofaf', 'transformer-inrush-current'],
  'South Asia': ['power-vs-distribution', 'transformer-failure-cost', 'transformer-maintenance-checklist'],
  'East Asia': ['gsu-transformers', 'transformer-winding-manufacturing', 'transformer-type-selection'],
  'Southeast Asia': ['power-vs-distribution', 'transformer-overheating', 'transformer-maintenance-checklist'],
  'North America': ['power-vs-distribution', 'transformer-type-selection', 'tap-changer-faults'],
  'Latin America': ['power-vs-distribution', 'transformer-overheating', 'transformer-failure-cost'],
  'Eurasia': ['power-vs-distribution', 'transformer-type-selection', 'transformer-voltage-regulation'],
  'Africa': ['transformer-overheating', 'transformer-maintenance-checklist', 'transformer-failure-cost'],
  'Europe': ['power-vs-distribution', 'parallel-operation-transformers', 'transformer-impedance'],
  'Oceania': ['power-vs-distribution', 'transformer-type-selection', 'transformer-impedance'],
};
function kmapFor(m) { return REGION_KW[m.region] || REGION_KW.Europe; }
function knowLabel(s) { return s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

function makersFor(m) {
  const list = [];
  MANUF.forEach(function (g) {
    if (ci(g.country) === ci(m.manufName) || ci(m.manufName).indexOf(ci(g.country)) >= 0 || ci(g.country).indexOf(ci(m.manufName)) >= 0) {
      g.makers.forEach(function (x) { list.push({ name: x[0], city: x[1], url: x[2], types: x[3], countrySlug: slugify(g.country) }); });
    }
  });
  return list;
}
function gridsFor(m) {
  const g = GRIDS.find(function (x) { return ci(x.country).indexOf(ci(m.gridsName)) >= 0 || ci(m.gridsName).indexOf(ci(x.country)) >= 0; });
  return g;
}
function eventsFor(m) {
  const now = new Date();
  return EVENTS.filter(function (ev) {
    const countryMatch = ci(ev.co) === ci(m.gridsName) || ci(ev.co) === ci(m.manufName) || ci(m.name) === ci(ev.co);
    const kwMatch = m.kw.some(function (k) { return ci(ev.n + ' ' + ev.co + ' ' + ev.r + ' ' + ev.d).indexOf(k) >= 0; });
    return countryMatch || (kwMatch && ci(ev.co).indexOf(ci(m.name)) >= 0);
  }).filter(function (ev) { return new Date(ev.e) >= now; }).sort(function (a, b) { return String(a.s).localeCompare(String(b.s)); }).slice(0, 8);
}
function intelFor(m) {
  const reg = INTEL[m.intel]; const out = [];
  if (reg && reg.items) reg.items.forEach(function (it) {
    if (m.kw.some(function (k) { return ci(it.title + ' ' + it.snippet).indexOf(k) >= 0; })) out.push(it);
  });
  return out.slice(0, 5);
}
// Business-intelligence activity for a market: typed company developments and
// structured projects that involve this country/region. Only sourced entries.
function biFor(m) {
  const countries = [ci(m.gridsName), ci(m.name)].filter(Boolean);
  const countryHit = function (c) { return countries.indexOf(ci(c)) >= 0; };
  // Projects matching the country (or region keywords).
  const projects = BI_PROJECTS.filter(function (p) { return countryHit(p.country) || m.kw.some(function (k) { return ci(p.country + ' ' + p.name).indexOf(k) >= 0; }); });
  // Typed company events for companies headquartered/operating in this market.
  const events = [];
  Object.keys(BI_EVENTS).forEach(function (co) {
    const c = BI_EVENTS[co];
    const inMarket = c.country && countryHit(c.country) || m.kw.some(function (k) { return ci(co + ' ' + (c.country || '')).indexOf(k) >= 0; });
    if (!inMarket) return;
    (c.events || []).forEach(function (e) { if (e.type !== 'reference') events.push({ co: co, e: e }); });
  });
  return { projects: projects, events: events };
}
const fmt = function (d) { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

function marketPage(m) {
  const mk = makersFor(m); const g = gridsFor(m);
  const evs = eventsFor(m); const intel = intelFor(m);
  const utl = (g && g.grids) ? g.grids : [];
  const typeCount = function (t) { return mk.filter(function (x) { return String(x.types || '').toUpperCase().indexOf(t) >= 0; }).length; };
  const mkHtml = mk.slice(0, 14).map(function (x) {
    const slug = csl(x.name);
    const name = slug ? '<a class="prof" href="../../manufacturers/' + slug + '/" style="color:var(--accent);font-weight:700">' + esc(x.name) + '</a>' : '<b>' + esc(x.name) + '</b>';
    return '<div class="mk-row">' + name + '<span class="city">' + esc(x.city || '') + '</span><span class="prof">' + esc(x.types || '') + '</span>' + (x.url ? ' <a href="' + esc(x.url) + '" style="color:var(--accent);font-size:.78rem" target="_blank" rel="noopener">↗</a>' : '') + '</div>';
  }).join('') + (mk.length > 14 ? '<p style="color:var(--muted);font-size:.82rem">+' + (mk.length - 14) + ' more on the country page.</p>' : '');
  const utlHtml = utl.map(function (u) { return '<div class="mk-row"><b>' + esc(u[0]) + '</b><span class="city">' + esc(u[1]) + '</span><span class="prof">' + esc(u[2]) + '</span>' + (u[3] ? ' <a href="' + esc(u[3]) + '" style="color:var(--accent);font-size:.78rem" target="_blank" rel="noopener">↗</a>' : '') + '</div>'; }).join('');
  const evHtml = evs.map(function (ev) { return '<li style="margin:6px 0"><a href="' + esc(ev.u) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(ev.n) + '</a> <span style="color:var(--muted);font-size:.85rem">' + fmt(ev.s) + ' · ' + esc(ev.c) + ', ' + esc(ev.co) + '</span></li>'; }).join('') || '<li style="color:var(--muted)">No local events yet — check the events calendar.</li>';
  const intelHtml = intel.map(function (it) { return '<li style="margin:6px 0"><b style="color:var(--text)">' + esc(it.title) + '</b><p style="color:var(--muted);font-size:.86rem;margin:2px 0 0">' + esc(it.snippet.slice(0, 200)) + (it.snippet.length > 200 ? '…' : '') + '</p></li>'; }).join('') || '<li style="color:var(--muted)">Intel for this market is refreshed hourly.</li>';
  // Structured business-intelligence feed (typed company developments + projects).
  const bi = biFor(m);
  const biEvt = bi.events.slice(0, 8).map(function (x) {
    const label = BI_TYPES[x.e.type] || x.e.type;
    return '<li style="margin:6px 0"><b style="color:var(--accent);font-size:.78rem;text-transform:uppercase;letter-spacing:.03em">' + esc(label) + '</b> · <a href="' + esc(x.e.url) + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">' + esc(x.e.title) + '</a> <span style="color:var(--muted);font-size:.82rem">· ' + esc(x.co) + '</span></li>';
  }).join('');
  const biProj = bi.projects.slice(0, 8).map(function (p) {
    return '<li style="margin:6px 0"><a href="' + esc(p.url) + '" style="color:var(--accent);font-weight:600">' + esc(p.name) + '</a> <span style="color:var(--muted);font-size:.82rem">· ' + esc(p.country) + (p.voltage ? ' · ' + esc(p.voltage) : '') + ' · ' + esc(p.status || '') + ' · transformer scope <b>' + esc(p.transformer_requirement) + '</b></span></li>';
  }).join('');
  const biHtml = (biEvt || biProj)
    ? '<p style="font-size:.85rem;color:var(--muted)">Sourced company developments and transformer-relevant projects with a footprint in this market. An item is shown because it <b>references</b> the company or project — it is not an independently verified award or scope unless the source confirms one.</p>' +
      (biEvt ? '<div><b style="color:var(--text)">Company activity</b><ul>' + biEvt + '</ul></div>' : '') +
      (biProj ? '<div style="margin-top:8px"><b style="color:var(--text)">Transformer projects</b><ul>' + biProj + '</ul></div>' : '') +
      '<p style="font-size:.82rem;color:var(--muted)">See the <a href="../../intelligence.html" style="color:var(--accent)">Intelligence</a> hub for the full activity feed.</p>'
    : '<p style="color:var(--muted)">No source-backed business activity published for this market yet.</p>';
  const compHtml = Object.keys(COMPONENTS).map(function (c) { return '<a class="tpill" href="../../components/' + c + '.html">' + esc(COMPONENTS[c]) + '</a>'; }).join(' ');
  const techHtml = m.tech.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
  const faqHtml = m.faq.map(function (f) { return '<div style="margin:12px 0"><b style="color:var(--ink)">' + esc(f[0]) + '</b><p style="color:var(--text);margin:4px 0 0">' + esc(f[1]) + '</p></div>'; }).join('');
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: m.faq.map(function (f) { return { '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }; }) };
  const url = 'https://transformerpath.com/markets/' + m.slug + '/';
  const schema = '<script type="application/ld+json">' + JSON.stringify(faqSchema) + '</script>' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Transformer Industry — ' + m.name, url: url, description: m.blurb.slice(0, 150) }) + '</script>';
  const mkCount = typeCount('PT') + typeCount('DT') + typeCount('DRY');

  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Transformer Industry — ' + esc(m.name) + ' | TransformerPath</title>' +
    '<meta name="description" content="' + esc(m.blurb.slice(0, 155)) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="Transformer Industry — ' + esc(m.name) + '"><meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">' +
    '<link rel="stylesheet" href="../../style.css?v=5"><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><link rel="preconnect" href="https://www.google-analytics.com"><link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">' +
    '<style>.c-wrap{max-width:940px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap .mk-row{display:flex;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:.92rem}.c-wrap .mk-row b{color:var(--ink)}.c-wrap .mk-row .city{color:var(--muted);font-size:.82rem}.c-wrap .mk-row .prof{color:var(--accent);font-size:.78rem;font-weight:600;margin-left:auto}.c-wrap h2{font-size:1.25rem;color:var(--ink);margin-top:26px}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}.stats{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}.stats .s{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 16px}.stats .s b{color:var(--accent);font-size:1.15rem;display:block}.stats .s span{color:var(--muted);font-size:.78rem}</style>' + schema +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../../markets.html" style="color:var(--accent)">Markets</a> › ' + esc(m.name) + '</nav>' +
    '<h1>' + m.flag + ' Transformer Industry — ' + esc(m.name) + '</h1>' +
    '<p class="lead">' + esc(m.blurb) + '</p>' +
    '<div class="stats">' +
    '<div class="s"><b>' + mk.length + '</b><span>manufacturers tracked</span></div>' +
    '<div class="s"><b>' + utl.length + '</b><span>grid operators</span></div>' +
    '<div class="s"><b>' + (g ? esc(g.freq) : '-') + ' Hz</b><span>' + esc((g && g.sync) || 'grid frequency') + '</span></div>' +
    '<div class="s"><b>' + evs.length + '</b><span>upcoming events</span></div>' +
    '</div>' +
    '<h2>Grid &amp; utilities</h2>' + (utlHtml || '<p style="color:var(--muted)">See the grid directory for operator details.</p>') +
    '<h2>Transformer manufacturers</h2><p style="font-size:.85rem;color:var(--muted)">' + mkCount + ' maker records in the ' + esc(m.name) + ' census — power, distribution and dry-type. <a href="../../manufacturers/' + slugify(m.manufName) + '.html" style="color:var(--accent)">All ' + esc(m.name) + ' manufacturers →</a></p>' + (mkHtml || '<p style="color:var(--muted)">No manufacturers listed yet.</p>') +
    '<h2>Components &amp; suppliers</h2><div style="margin:4px 0">' + compHtml + '</div>' +
    '<h2>Business activity</h2>' + biHtml +
    '<h2>Projects &amp; intelligence</h2><ul>' + intelHtml + '</ul>' +
    '<h2>Upcoming events</h2><ul>' + evHtml + '</ul>' +
    '<h2>Technical context</h2><ul>' + techHtml + '</ul>' +
    '<h2>Frequently asked</h2>' + faqHtml +
    '<h2>Related reading</h2><div style="margin:4px 0 8px">' + kmapFor(m).map(function (s) { return '<a class="tpill" href="../../knowledge/' + s + '.html">' + esc(knowLabel(s)) + '</a>'; }).join(' ') + '</div>' +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Find transformer suppliers in ' + esc(m.name) + '</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a requirement and TransformerPath will match it against the ' + esc(m.name) + ' and regional manufacturing base.</p>' +
    '<a class="btn btn-amber" href="../../rfq.html" data-track="rfq_started" data-track-component_category="' + esc(m.name) + ' market">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../../list-company.html" data-track="supplier_claim_started" data-track-component_category="' + esc(m.name) + ' market">Are you a supplier here? Get Verified →</a></div>' +
    '<div style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:8px">Learn more: <a href="../../knowledge.html" style="color:var(--accent);font-weight:600">Knowledge</a> · <a href="../../applications.html" style="color:var(--accent);font-weight:600">Applications</a> · <a href="../../components.html" style="color:var(--accent);font-weight:600">Components</a> · <a href="../../books.html" style="color:var(--accent);font-weight:600">Books</a> · <a href="../../academy.html" style="color:var(--accent);font-weight:600">Academy</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../../analytics.js?v=2" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('markets', { recursive: true });
const links = [];
MARKETS.forEach(function (m) {
  const dir = 'markets/' + m.slug; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/index.html', marketPage(m));
  links.push({ slug: m.slug, name: m.name, flag: m.flag, makers: makersFor(m).length, operators: (gridsFor(m) || {}).grids ? gridsFor(m).grids.length : 0 });
  console.log('OK markets/' + m.slug + '/ | ' + m.name);
});

// Market index
const idx = '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Transformer Markets by Country | TransformerPath</title>' +
  '<meta name="description" content="Country transformer intelligence hubs — grid operators, manufacturers, components, projects, events, technical context and RFQ for the world\'s key markets.">' +
  '<link rel="canonical" href="https://transformerpath.com/markets.html"><link rel="stylesheet" href="style.css?v=5"><link rel="icon" type="image/svg+xml" href="brand/favicon.svg"></head><body>' +
  HEAD + '\n<section class="hero" style="padding:48px 0 26px"><div class="container" style="max-width:960px"><h1 style="font-size:2rem">Transformer markets, by country</h1><p style="color:var(--muted);max-width:720px">The whole market in one place — not one manufacturer. Operators, manufacturers, components, intel, events and technical context for the markets that matter.</p></div></section>' +
  '<main class="container" style="max-width:960px;padding:0 0 60px"><div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">' +
  links.map(function (l) { return '<a class="card" href="markets/' + l.slug + '/" style="text-decoration:none;padding:16px;border-radius:12px"><span style="font-size:1.6rem">' + l.flag + '</span><div style="font-weight:700;color:var(--ink);margin:6px 0">' + esc(l.name) + '</div><span style="font-size:.82rem;color:var(--muted)">' + l.makers + ' makers · ' + l.operators + ' operators</span></a>'; }).join('') +
  '</div></main>' + FOOT + '\n<script src="analytics.js?v=2" defer></script>\n</body>\n</html>';
fs.writeFileSync('markets.html', idx);
console.log('OK markets.html index |', links.length, 'market hubs');
