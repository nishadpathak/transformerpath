#!/usr/bin/env node
/* build-applications.js — industry/application commercial landing pages.
 *
 * Inspired by how a strong transformer OEM markets: organise by the INDUSTRY
 * the buyer is in (data centres, mining, renewables, oil & gas, railways,
 * utilities, cement) rather than only by product. Each page is a high-intent
 * landing page with:
 *   - an intro + a "what buyers should look for" buyer guide
 *   - relevant manufacturers (from the census, by type), linked to country pages
 *   - related components (linked) and relevant transformer types
 *   - upcoming events for the industry (from data/events.json)
 *   - RFQ + Verified CTAs
 * Run: node build-applications.js  (part of the Netlify build command).
 */
'use strict';
const fs = require('fs');
// Root-absolutise header/footer links so they work from nested /applications/ pages.
const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
// company name -> entity page slug (built by build-company-pages, which runs first).
let CSMAP = {}; try { JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (c) { CSMAP[c.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = c.slug; }); } catch (e) {}
const csl = function (name) { return CSMAP[String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()]; };
const EVENTS = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));

// Components map (slug -> label) — matches the generated /components/* pages.
const COMPONENTS = {
  'transformer-bushings': 'Bushings', 'on-load-tap-changers': 'On-load tap changers',
  'transformer-cooling': 'Cooling systems', 'insulation-materials': 'Insulation materials',
  'conductors-and-core': 'Conductors & core steel', 'oil-fluids-preservation': 'Oil & fluids / preservation',
  'protection-monitoring': 'Protection, monitoring & diagnostics', 'tank-and-mechanical': 'Tank & mechanical',
};

const APPLICATIONS = [
  { slug: 'data-centres', title: 'Transformers for Data Centres & AI', icon: '🏢',
    intro: 'Hyperscale and colocation campuses need high-density, reliable power at the grid edge. Step-up, dry-type and compact distribution transformers, plus MV switchgear and solid-state concepts, are short in supply worldwide.',
    types: ['PT', 'DT', 'DRY'],
    guide: ['Transformer capacity and rating matching the IT load deck, and N+1 / 2N redundancy',
      'Dry-type or ester-filled units for indoor / fire-sensitive spaces',
      'Short lead times: data-centre delivery windows rarely allow a 3-year queue',
      'Surge, harmonic and power-quality capability for converter and UPS loads',
      'Monitoring and condition-diagnostics readiness for predictive maintenance'],
    components: ['transformer-bushings', 'transformer-cooling', 'protection-monitoring', 'insulation-materials'],
    regions: ['North America', 'Europe'],
    evkw: ['data', 'ai', 'hyperscal', 'cloud'],
    faq: [['Which transformers do data centres need?', 'Step-up or distribution transformers for the incoming supply, plus dry-type or ester-filled units for indoor, fire-sensitive spaces where reliability and footprint matter.'],
      ['What MBE/voltage do data-centre transformers use?', 'Typical designs step MV to 400/230 V at the rack; incoming transformers range from a few MVA for colocation to 100+ MVA for hyperscale campuses, often at 13.8 kV to 138 kV.'],
      ['When in the build should I order?', 'Early. Data-centre critical-power schedules rarely tolerate multi-year lead times, so transformer orders are often placed long before civil completion.'],
      ['Can TransformerPath match data-centre suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving the high-reliability data-centre segment.']],
  },
  { slug: 'renewables', title: 'Transformers for Renewable Energy & Grid Integration', icon: '☀️',
    intro: 'Solar, wind and storage projects need collector, step-up (GSU) and grid-connection transformers sized for variable, inverter-based generation, plus grid-forming and ancillary capability.',
    types: ['PT', 'DT', 'DRY'],
    guide: ['Step-up (GSU) and collector transformer sizing for the array / turbine layout',
      'Voltage range and impedance that line up with the utility grid-connection point',
      'Ancillary / grid-forming behaviour for high renewable penetration',
      'Battery-storage and hybrid transformer or converter-integrated options',
      'NEC / IEC / local grid-code compliance and protection coordination'],
    components: ['transformer-bushings', 'on-load-tap-changers', 'protection-monitoring', 'transformer-cooling'],
    regions: ['Americas', 'Europe', 'Asia'],
    evkw: ['solar', 'wind', 'renewable', 'storage', 'battery', 'grid'],
    faq: [['What is a GSU transformer?', 'A generator (or grid) step-up transformer that raises the collector voltage to the utility grid-connection level — the key unit in solar and wind farms.'],
      ['Why are BESS/hybrid transformers needed?', 'Battery-storage and hybrid plants need transformers rated for bidirectional power, high harmonic content from inverters, and often a converter-integrated design.'],
      ['What voltage do renewable projects connect at?', 'Collector systems run at 33–35 kV (often 34.5 kV in the US) up to 138 kV or higher, GSUs stepping up to the transmission point.'],
      ['Can TransformerPath find solar/wind transformer suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving renewables and grid integration.']],
  },
  { slug: 'mining-metals', title: 'Transformers for Mining & Metals', icon: '⛏️',
    intro: 'Open-pit and processing plants run on heavy-duty, high-availability power. Ruggedised transformers for crushers, mills, furnaces and process electrification are the norm, in harsh and remote sites.',
    types: ['PT', 'DT'],
    guide: ['Furnace, rectifier and process transformers for metals / electrolytic duty',
      'Ruggedisation for dust, vibration, altitude and temperature',
      'High short-circuit strength and harmonics handling for mill / furnace loads',
      'Serviceability and spares in remote or fly-in/fly-out sites',
      'Standards: IEC 60076, IEEE C57 and local mining electrical codes'],
    components: ['transformer-bushings', 'oil-fluids-preservation', 'tank-and-mechanical', 'transformer-cooling'],
    regions: ['Africa', 'Americas', 'Oceania'],
    evkw: ['mining', 'mineral', 'metal', 'process'],
    faq: [['What transformers do mining plants use?', 'Furnace and rectifier transformers for smelting/electrolysis, process transformers and ruggedised distribution units for crushing, milling and conveyors.'],
      ['How are mining transformers ruggedised?', 'For dust, vibration, altitude, temperature and corrosive atmospheres, with high short-circuit strength and harmonics handling for mill and furnace loads.'],
      ['What standards apply?', 'IEC 60076 and IEEE C57 families, plus local mining electrical codes and any site-specific safety requirements.'],
      ['Can TransformerPath match mining suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving mining and metals.']],
  },
  { slug: 'oil-gas', title: 'Transformers for Oil, Gas & Energy', icon: '🛢️',
    intro: 'Upstream, midstream and refinery projects — and the wider energy-transition and hydrogen build-out — need transformers engineered for extreme ambient temperatures, hazardous areas and offshore duty.',
    types: ['PT', 'DRY'],
    guide: ['High ambient-temperature design (GCC 50 °C ambient derating)',
      'Hazardous-area and offshore / desert-class builds (epoxy, corrosion protection)',
      'Converter / rectifier transformers for electrolysis and HVDC',
      'Sealed or ester-filled options for fire-risk and environmental zones',
      'IEC 60076 + area-classification (IEC 60079) awareness for the transformer room'],
    components: ['insulation-materials', 'transformer-bushings', 'oil-fluids-preservation', 'transformer-cooling'],
    regions: ['Middle East', 'Africa', 'Europe'],
    evkw: ['oil', 'gas', 'energy', 'hydrogen', 'petroleum', 'petrochem', 'adip'],
    faq: [['Why do oil & gas transformers need high-ambient design?', 'Sites in the Gulf and hot regions see 45–50 °C ambient, requiring derating, larger cooling and desert-class enclosures to maintain rated output.'],
      ['Do I need hazardous-area transformers?', 'In classified areas, sealed or ester-filled units and area-classification (IEC 60079) awareness are essential for safety and compliance.'],
      ['What about converter/rectifier transformers for hydrogen?', 'Electrolysis and HVDC need rectifier and converter transformers with high harmonics and voltage control — a growing segment of the oil & gas energy-transition build-out.'],
      ['Can TransformerPath match oil & gas suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving the oil, gas and energy sectors.']],
  },
  { slug: 'railways', title: 'Transformers for Railways & Metro', icon: '🚆',
    intro: 'Traction and metro systems need transformers for the catenary, trackside stations and on-board auxiliary power, engineered for vibration, compactness and continuous service.',
    types: ['DRY', 'DT'],
    guide: ['Traction substation and wayside transformer sizing for the railway voltage',
      'Auxiliary / dry-type units for stations, signalling and control rooms',
      'Ruggedised build for vibration, dust and temperature swing',
      'Fire-safe (dry-type or ester) designs for tunnels and underground stations',
      'Conformance with railway-specific standards and utility interfaces'],
    components: ['insulation-materials', 'transformer-bushings', 'transformer-cooling', 'tank-and-mechanical'],
    regions: ['Asia', 'Europe', 'Middle East'],
    evkw: ['rail', 'metro', 'traction', 'transit', 'urban transport'],
    faq: [['What transformers do railways use?', 'Traction substation and wayside transformers for the catenary, auxiliary and dry-type units for stations/signalling, and on-board auxiliary transformers on the train.'],
      ['Why dry-type or ester for rail?', 'Tunnels and underground stations often require fire-safe (dry-type or ester) designs, and rail builds must tolerate vibration, dust and wide temperature swings.'],
      ['What standards govern rail transformers?', 'Railways have specific traction and fire-safety requirements in addition to IEC 60076, plus the local grid-interface rules.'],
      ['Can TransformerPath match rail suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving railways, metro and transit.']],
  },
  { slug: 'utilities-grid', title: 'Transformers for Utilities & Grid', icon: '⚡',
    intro: 'The transmission and distribution backbone. Power, distribution and reactor transformers for TSOs, DSOs and national grids — the scale, voltage and reliability class that governs system security.',
    types: ['PT', 'DT'],
    guide: ['Voltage class, MVA rating and impedance for the substation role',
      'Reactor (shunt/series) options for reactive compensation and line limits',
      'Loss and efficiency targets under eco-design / efficiency regulations',
      'Type-test, short-circuit withstand and DGA / monitoring provisions',
      'Grid-code and interconnection compliance for the operating market'],
    components: ['transformer-bushings', 'on-load-tap-changers', 'protection-monitoring', 'insulation-materials'],
    regions: ['Middle East', 'Europe', 'North America', 'Asia'],
    evkw: ['grid', 'utility', 'transmission', 'substation', 'cigre', 'power', 'ts'],
    faq: [['What transformer do utilities need?', 'Power transformers for transmission substations, distribution transformers for the network, and reactors (shunt/series) for reactive compensation and line limits.'],
      ['What voltage classes does the grid use?', 'Transmission runs from 110 kV to 765 kV (and higher for UHV), with distribution at 11–33 kV and below; reactors and GSUs feature heavily at the bulk-power level.'],
      ['Why are transformers and reactors important for stability?', 'They control voltage, reactive power and fault current, so their rating, impedance and monitoring directly affect system security.'],
      ['Can TransformerPath match utility suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving utilities and the grid.']],
  },
  { slug: 'cement-industrial', title: 'Transformers for Cement & Industrial', icon: '🏭',
    intro: 'Cement, paper & pulp, pharma and general process industries need reliable distribution and drive transformers matched to continuous high-load duty and harsh plant environments.',
    types: ['DT', 'PT'],
    guide: ['Distribution transformer sizing for the plant load and motor drives',
      'Harmonics / VFD load handling and derating',
      'Ruggedised build for dust, vibration and temperature',
      'Availability and spares strategy for continuous process plants',
      'Energy-efficiency class and loss limits for the local grid'],
    components: ['transformer-cooling', 'insulation-materials', 'oil-fluids-preservation', 'tank-and-mechanical'],
    regions: ['Asia', 'Middle East', 'Africa'],
    evkw: ['cement', 'industrial', 'process', 'paper', 'chemical', 'pharma'],
    faq: [['What transformers do cement and process plants need?', 'Distribution transformers sized for the plant load and motor drives, often with harmonics and VFD-load handling for variably loaded continuous processes.'],
      ['Why do heavy-industry plants need ruggedised transformers?', 'Dust, vibration, temperature and continuous high-load duty demand a stronger enclosure, plus a solid spares and availability strategy.'],
      ['How are losses and efficiency regulated for industry?', 'Energy-efficiency classes and loss limits (e.g. EU eco-design) increasingly apply to distribution transformers in industrial networks.'],
      ['Can TransformerPath match industrial suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving cement, paper, pharma and general industry.']],
  },
  { slug: 'solar', title: 'Transformers for Solar (PV) Power Plants', icon: '☀️',
    intro: 'Utility-scale solar depends on a chain of transformers: string/central inverter feed into collector transformers, which step up through a GSU to the grid point. Large PV plants need high-efficiency, high-reliability units sized for one-directional, inverter-based output.',
    types: ['PT', 'DT', 'DRY'],
    guide: ['Collector transformer sizing for the DC/AC block and inverter ratings',
      'GSU step-up voltage (e.g. 34.5 kV → 138/230/345 kV) matched to the POI',
      'High efficiency (inverter-based output rewards low-loss transformer design)',
      'High-altitude and dust/dirt derating for PV sites',
      'Grid-code compliance (fault ride-through, protection coordination, harmonics)'],
    components: ['transformer-bushings', 'on-load-tap-changers', 'protection-monitoring', 'transformer-cooling'],
    regions: ['Americas', 'Europe', 'Asia', 'Middle East'],
    evkw: ['solar', 'photovoltaic', 'pv', 'beacon', 'utility-scale solar'],
    faq: [['How many transformers does a solar farm need?', 'Typically a collector transformer per MV block (often 2–5 MVA at 34.5 kV in the US) plus one GSU for the plant, with the number set by the plant size and layout.'],
      ['What voltage do solar plants connect at?', 'Collector systems run at 33–35 kV (often 34.5 kV in the US); GSUs step up to 110–345 kV for grid interconnection.'],
      ['What makes a solar GSU different?', 'It is sized for inverter-based, one-directional output with high harmonics and intermittent loading, so loss, cooling and protection are tailored to PV.'],
      ['Can TransformerPath find solar transformer suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving solar PV.']],
  },
  { slug: 'bess', title: 'Transformers for Battery Energy Storage (BESS)', icon: '🔋',
    intro: 'Grid-scale battery storage needs transformers that handle bidirectional power flow, high harmonic content from power-electronics converters, and fast switching. Collector, step-up and hybrid (MV) transformers plus protection/monitoring are essential to the energy-storage value chain.',
    types: ['PT', 'DT', 'DRY'],
    guide: ['Bidirectional (charge/discharge) power rating and thermal design',
      'High harmonic / converter loading management and derating',
      'Hybrid or converter-integrated transformer options',
      'Fast-response protection and grid-code compliance for storage',
      'Fire-safety and footprint choices (dry-type/ester for containerised sites)'],
    components: ['transformer-bushings', 'protection-monitoring', 'on-load-tap-changers', 'transformer-cooling'],
    regions: ['Americas', 'Europe', 'Asia', 'Middle East'],
    evkw: ['bess', 'battery', 'storage', 'energy storage', 'grid-scale'],
    faq: [['Why do BESS transformers need bidirectional rating?', 'Batteries both charge and discharge, so the transformer must be rated for power flow in both directions, often with a hybrid or converter-integrated design.'],
      ['Where do BESS transformers sit?', 'At the MV point of interconnection between the battery/inverter block and the grid, stepping up to the utility connection voltage.'],
      ['Are BESS transformers a growing market?', 'Yes — the grid-scale storage build-out (especially paired with solar and wind) is one of the fastest-growing transformer demand segments.'],
      ['Can TransformerPath find BESS transformer suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving energy storage.']],
  },
  { slug: 'offshore-wind', title: 'Transformers for Offshore Wind', icon: '🌊',
    intro: 'Offshore wind demands the most engineered transformers in renewables: compact, corrosion-protected GSUs on the platform, collector transformers in the array, and converter transformers at the onshore HVDC link — all specified for marine environments, weight and space limits.',
    types: ['PT', 'DT', 'DRY'],
    guide: ['Offshore GSU sizing for turbine clusters and platform MV collection',
      'Corrosion-resistant, sealed/ester designs for the marine environment',
      'Weight, footprint and lifting constraints on the substation platform',
      'High ambient and harmonic handling for variable, converter-coupled output',
      'Cable, HVDC and grid-connection interface for large offshore wind farms'],
    components: ['insulation-materials', 'transformer-bushings', 'oil-fluids-preservation', 'transformer-cooling'],
    regions: ['Europe', 'Americas'],
    evkw: ['offshore', 'wind', 'marine', 'platform', 'offshore wind'],
    faq: [['What transformers are used offshore?', 'Collector transformers in the turbine array, compact GSUs on the offshore substation platform, and often HVDC converter transformers at the onshore link.'],
      ['Why are offshore transformers different?', 'They need corrosion protection, sealed/ester designs, smaller weight and footprint, and high reliability in a hard-to-service marine environment.'],
      ['What voltage do offshore wind farms use?', 'Array collection at 33–66 kV, stepped up on the platform to 132–220 kV (or converted to HVDC) for the export cable to shore.'],
      ['Can TransformerPath find offshore wind suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving offshore wind.']],
  },
  { slug: 'hvdc', title: 'Transformers for HVDC & Converter Stations', icon: '⚡',
    intro: 'High-voltage direct current (HVDC) is the backbone of long-distance and offshore transmission, and its converter transformers are among the most demanding units in the industry. They feed the converters, block harmonics, and transfer DC mass — the highest-value transformer application there is.',
    types: ['PT'],
    guide: ['Converter transformer design for the LCC/VSC converter topology',
      'DC insulation and interface with valves, smoothing reactors and filters',
      'High MVA, high-voltage step-up to the AC system (typically 400–800 kV DC)',
      'Harmonic, reactive and control requirements of the converter station',
      'Interconnection, HVDC link and offshore/onshore grid-connection conformity'],
    components: ['insulation-materials', 'on-load-tap-changers', 'protection-monitoring', 'transformer-bushings'],
    regions: ['Asia', 'Europe', 'Middle East', 'Americas'],
    evkw: ['hvdc', 'converter', 'interconnector', 'converter station', 'uhv'],
    faq: [['What is a converter transformer?', 'The transformer that feeds HVDC converter valves, providing the AC-side interface and insulation between the AC grid and the DC converter stage.'],
      ['Why are converter transformers so expensive?', 'They are large MVA, high-voltage, DC-rated units with demanding insulation and control requirements — among the most complex and costly transformers built.'],
      ['Where are HVDC transformers used?', 'In point-to-point HVDC links, offshore wind export, interconnectors (e.g. ±800 kV UHV DC) and back-to-back converter stations.'],
      ['Can TransformerPath find HVDC/converter suppliers?', 'Yes — submit an RFQ on this page and we will match it against manufacturers serving HVDC and converter stations.']],
  },
];

// Application -> related Knowledge article slugs (query-intent tie-in + internal graph).
const KNOWNOW = {
  'data-centres': ['transformer-overloading', 'dry-type-vs-oil-filled', 'k-factor-transformers'],
  'renewables': ['gsu-transformers', 'shunt-reactor', 'transformer-inrush-current'],
  'mining-metals': ['transformer-short-circuit-forces', 'transformer-overheating', 'transformer-failure-cost'],
  'oil-gas': ['onan-vs-onaf-vs-ofaf', 'transformer-insulating-liquids', 'transformer-creepage-distance'],
  'railways': ['dry-type-transformer-cooling', 'transformer-earthing', 'transformer-neutral-earthing'],
  'utilities-grid': ['power-vs-distribution', 'transformer-impedance', 'parallel-operation-transformers'],
  'cement-industrial': ['transformer-overheating', 'transformer-winding-failure', 'transformer-maintenance-checklist'],
  'solar': ['gsu-transformers', 'transformer-inrush-current', 'transformer-voltage-regulation'],
  'bess': ['k-factor-transformers', 'transformer-overloading', 'transformer-insulating-liquids'],
  'offshore-wind': ['dry-type-vs-oil-filled', 'gsu-transformers', 'transformer-transport-handling'],
  'hvdc': ['transformer-insulation-aging', 'shunt-reactor', 'transformer-impedance'],
};
// Friendly label from a knowledge slug (e.g. "transformer-overloading" -> "Transformer overloading").
function knowLabel(s) { return s.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

// Related company entity pages (by transformer type) for the application -> company graph.
function companiesFor(types) {
  const out = []; const seen = {};
  MANUF.forEach(function (g) {
    g.makers.forEach(function (x) {
      if (/^Served by/i.test(x[0])) return;
      if (types.some(function (tt) { return String(x[3] || '').toUpperCase().indexOf(tt) >= 0; })) {
        const s = csl(x[0]); if (s && !seen[x[0]]) { seen[x[0]] = 1; out.push({ name: x[0], slug: s, city: x[1] || '', country: g.country }); }
      }
    });
  });
  return out.slice(0, 9);
}

function makersFor(types) {
  const out = {};
  MANUF.forEach(function (g) {
    const hits = g.makers.filter(function (x) {
      const t = String(x[3] || '').toUpperCase();
      return types.some(function (tt) { return t.indexOf(tt) >= 0; });
    });
    if (hits.length) { const region = g.region || 'Other'; (out[region] = out[region] || []).push({ country: g.country, flag: g.flag, names: hits }); }
  });
  return out;
}
function eventsFor(app) {
  const now = new Date();
  const kws = (app.evkw || []).concat((app.title.toLowerCase().split(/[^a-z]+/)));
  return EVENTS.filter(function (ev) {
    const hay = ((ev.n + ' ' + ev.d + ' ' + ev.r + ' ' + ev.co)).toLowerCase();
    const inRegion = ev.r && app.regions.indexOf(ev.r) >= 0;
    const inKw = kws.some(function (k) { return k && hay.indexOf(k) >= 0; });
    return new Date(ev.e) >= now && (inRegion || inKw);
  }).sort(function (a, b) { return String(a.s).localeCompare(String(b.s)); }).slice(0, 6);
}
const fmt = function (d) { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };

function page(app) {
  const manuf = makersFor(app.types);
  let mHtml = Object.keys(manuf).sort().map(function (region) {
    const grp = manuf[region];
    return '<div class="mk-zone"><b style="color:var(--ink)">' + esc(region) + '</b> — ' + grp.length + ' group(s)' +
      grp.map(function (gg) {
        return '<div style="margin:6px 0 0 10px"><span style="color:var(--muted);font-size:.9rem">' + esc(gg.flag || '') + ' <a href="../manufacturers/' + slugify(gg.country) + '.html" style="color:var(--accent)">' + esc(gg.country) + '</a></span>&nbsp;<span style="color:var(--muted);font-size:.8rem">' +
          gg.names.slice(0, 8).map(function (x) { return esc(x[0]); }).join(' · ') + (gg.names.length > 8 ? ' …' : '') + '</span></div>';
      }).join('') + '</div>';
  }).join('');
  const compHtml = app.components.map(function (s) { return '<a class="tpill" href="../components/' + s + '.html">' + esc(COMPONENTS[s] || s) + '</a>'; }).join(' ');
  const evHtml = eventsFor(app).map(function (ev) {
    return '<li style="margin:6px 0"><a href="' + esc(ev.u) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + esc(ev.n) + '</a> <span style="color:var(--muted);font-size:.85rem">' + fmt(ev.s) + (ev.e && ev.e !== ev.s ? ' → ' + fmt(ev.e) : '') + ' · ' + esc(ev.c) + ', ' + esc(ev.co) + '</span></li>';
  }).join('') || '<li style="color:var(--muted)">No matches yet — check back, or submit an RFQ.</li>';
  const typeHtml = app.types.map(function (t) { return '<span class="tpill">' + t + '</span>'; }).join(' ');
  const faq = app.faq || [];
  const faqQuestions = faq.length ? faq : [{ q: 'What should ' + app.title.replace(/^Transformers for /, '') + ' buyers look for?', a: app.guide.join(' ') }];
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqQuestions.map(function (f) { return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }; }) };
  const schema = '<script type="application/ld+json">' + JSON.stringify(faqSchema) + '</script>' +
    '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: app.title, url: 'https://transformerpath.com/applications/' + app.slug + '.html', description: app.intro }) + '</script>';
  const faqHtml = faqQuestions.map(function (f) { return '<div style="margin:12px 0"><b style="color:var(--ink)">' + esc(f.q) + '</b><p style="color:var(--text);margin:4px 0 0;line-height:1.7">' + esc(f.a) + '</p></div>'; }).join('');

  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(app.title) + ' | TransformerPath</title>' +
    '<meta name="description" content="' + esc(app.intro.slice(0, 150)) + '">' +
    '<link rel="canonical" href="https://transformerpath.com/applications/' + app.slug + '.html">' +
    '<meta name="robots" content="index,follow"><link rel="stylesheet" href="../style.css?v=5"><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><link rel="preconnect" href="https://www.google-analytics.com">' +
    '<link rel="icon" type="image/svg+xml" href="../brand/favicon.svg">' + schema +
    '<style>.c-wrap{max-width:960px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.85rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem;max-width:760px}.c-wrap .mk-zone{margin:10px 0;padding:8px 12px;border-bottom:1px solid var(--border)}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}</style>' +
    '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="../applications.html" style="color:var(--accent)">Applications</a> › ' + esc(app.title) + '</nav>' +
    '<h1>' + app.icon + ' ' + esc(app.title) + '</h1><p class="lead">' + esc(app.intro) + '</p>' +
    '<p style="font-size:.85rem;color:var(--muted)">Relevant transformer types: ' + typeHtml + '</p>' +
    '<h2 style="font-size:1.25rem;color:var(--ink);margin-top:26px">What ' + esc(app.title.replace('Transformers for ', '') + ' buyers') + ' should look for</h2><ul style="padding-left:20px;line-height:1.7;color:var(--text)">' +
    app.guide.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
    '<h2 style="font-size:1.25rem;color:var(--ink);margin-top:26px">Manufacturers &amp; suppliers</h2><p style="font-size:.85rem;color:var(--muted)">Selected from the TransformerPath worldwide census; verify capability before a decision.</p>' +
    (mHtml || '<p style="color:var(--muted)">Use the directory to browse makers by country.</p>') +
    '<h2 style="font-size:1.25rem;color:var(--ink);margin-top:26px">Related companies</h2><div style="margin:4px 0 8px">' + companiesFor(app.types).map(function (c) { return '<a class="tpill" href="../manufacturers/' + c.slug + '/">' + esc(c.name) + '<span style="color:var(--muted)"> · ' + esc(c.country) + '</span></a>'; }).join(' ') + '</div>' +
    '<h2 style="font-size:1.25rem;color:var(--ink);margin-top:26px">Related components</h2><div style="margin:4px 0 8px">' + compHtml + '</div>' +
    '<h2 style="font-size:1.25rem;color:var(--ink);margin-top:26px">Upcoming industry events</h2><ul style="padding-left:20px">' + evHtml + '</ul>' +
    '<h2 style="font-size:1.25rem;color:var(--ink);margin-top:26px">Frequently asked</h2>' + faqHtml +
    '<h2 style="font-size:1.25rem;color:var(--ink);margin-top:26px">Related knowledge</h2><div style="margin:4px 0 8px">' + (KNOWNOW[app.slug] || []).map(function (s) { return '<a class="tpill" href="../knowledge/' + s + '.html">' + esc(knowLabel(s)) + '</a>'; }).join(' ') + '</div>' +
    '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:24px"><b style="color:var(--text)">Looking for a supplier for this application?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a requirement and TransformerPath will match it against manufacturers that serve this sector.</p>' +
    '<a class="btn btn-amber" href="../rfq.html" data-track="rfq_started" data-track-component_category="' + esc(app.title) + '">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../list-company.html" data-track="supplier_claim_started" data-track-component_category="' + esc(app.title) + '">Sell in this sector? Get Verified →</a></div>' +
    '<div style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:8px">Explore: <a href="../markets.html" style="color:var(--accent);font-weight:600">Markets</a> · <a href="../knowledge.html" style="color:var(--accent);font-weight:600">Knowledge</a> · <a href="../components.html" style="color:var(--accent);font-weight:600">Components</a> · <a href="../books.html" style="color:var(--accent);font-weight:600">Books</a> · <a href="../academy.html" style="color:var(--accent);font-weight:600">Academy</a></div>' +
    '</main>\n' + FOOT + '\n<script src="../analytics.js?v=2" defer></script>\n</body>\n</html>';
}

fs.mkdirSync('applications', { recursive: true });
const links = [];
APPLICATIONS.forEach(function (app) {
  fs.writeFileSync('applications/' + app.slug + '.html', page(app));
  links.push({ slug: app.slug, title: app.title, icon: app.icon });
  console.log('OK applications/' + app.slug + '.html');
});
// Index page
const idx = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Transformer Applications by Industry | TransformerPath</title>' +
  '<meta name="description" content="Transformer requirements by industry — data centres, renewables, mining, oil and gas, railways, utilities and industrial. Buyer guides, suppliers, components and events.">' +
  '<link rel="canonical" href="https://transformerpath.com/applications.html">' +
  '<link rel="stylesheet" href="style.css?v=5"><link rel="icon" type="image/svg+xml" href="brand/favicon.svg"></head><body>' +
  HEAD + '\n<section class="hero" style="padding:48px 0 30px"><div class="container" style="max-width:960px"><h1 style="font-size:2rem">Transformer applications by industry</h1><p style="color:var(--muted);max-width:720px">Buyer guides, relevant manufacturers, components and events for the sectors that buy transformers.</p></div></section>' +
  '<main class="container" style="max-width:960px;padding:0 0 60px"><div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">' +
  links.map(function (l) { return '<a class="card" href="applications/' + l.slug + '.html" style="text-decoration:none;padding:16px;border-radius:12px"><span style="font-size:1.6rem">' + l.icon + '</span><div style="font-weight:700;color:var(--ink);margin:6px 0">' + esc(l.title) + '</div><span style="font-size:.82rem;color:var(--accent)">Explore →</span></a>'; }).join('') +
  '</div></main>' + FOOT + '\n<script src="analytics.js?v=2" defer></script>\n</body>\n</html>';
fs.writeFileSync('applications.html', idx);
console.log('OK applications.html index |', APPLICATIONS.length, 'application pages');
