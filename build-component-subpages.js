#!/usr/bin/env node
/* build-component-subpages.js
 *
 * Populates all 8 component sub-pages with:
 *   1. Technical Overview & Standards
 *   2. Specialized Sub-Categories
 *   3. VERIFIED CANONICAL SUPPLIERS (Name, Country, Scope, Website, Direct RFQ)
 *   4. Technical FAQ & Due Diligence Disclaimers
 *
 * Run: node build-component-subpages.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const DEEP_DIVE = JSON.parse(fs.readFileSync('data/components-deep-dive.json', 'utf8')).categories || [];
const ACCESSORIES = JSON.parse(fs.readFileSync('data/accessories.json', 'utf8')).suppliers || [];

const PAGES = [
  {
    file: 'components/transformer-bushings.html',
    title: 'Transformer Bushings & Terminations',
    standards: 'IEC 60137, IEEE C57.19, DIN 42530',
    lead: 'Oil-impregnated paper (OIP), resin-impregnated paper (RIP), and resin-impregnated synthetics (RIS) condenser bushings for HV/LV line connections, terminal plates, and cable boxes up to 1,200 kV AC and 800 kV DC.',
    subcats: [
      { title: 'HV RIP / RIS Bushings', desc: 'Dry-type resin-impregnated condenser bushings for 36 kV to 1200 kV AC and HVDC converter transformers with zero explosion risk.' },
      { title: 'OIP Condenser Bushings', desc: 'Oil-impregnated paper bushings with capacitive grading for high-voltage power transformers and substations.' },
      { title: 'LV Porcelain / DIN Bushings', desc: 'DIN 42530 and standard porcelain/epoxy bushings, 1 kV to 36 kV, rated up to several kA for distribution transformers.' },
      { title: 'Plug-in / Elbow Terminations', desc: 'Dead-break and load-break separable screened connectors for compact pad-mounted and RMU-fed transformers.' }
    ],
    deepCatIds: ['bushings'],
    accCats: ['Bushings (HV, LV)'],
    faq: [
      { q: 'What is the operational difference between OIP and RIP bushings?', a: 'OIP bushings contain liquid mineral oil with paper insulation requiring oil level monitoring. RIP/RIS bushings use solid cured resin without free oil, eliminating fire hazards, moisture ingress risks, and allowing horizontal mounting.' },
      { q: 'What parameters govern transformer bushing selection?', a: 'System highest voltage (Um), basic impulse level (BIL), rated continuous current, creepage distance / pollution severity class (IEC 60815), cantilever strength, and dielectric dissipation factor (tan delta).' }
    ]
  },
  {
    file: 'components/on-load-tap-changers.html',
    title: 'On-Load Tap Changers (OLTC & DETC)',
    standards: 'IEC 60214-1, IEEE C57.131',
    lead: 'Vacuum-interrupter and conventional oil-break on-load tap changers (OLTC), de-energized off-circuit tap changers (DETC), motor drive mechanisms, and digital voltage regulating controls.',
    subcats: [
      { title: 'Vacuum In-Tank OLTCs', desc: 'Vacuum switching technology inside the diverter switch eliminating oil carbonization and extending maintenance intervals to 300,000+ operations.' },
      { title: 'Bell-Type & Drum OLTCs', desc: 'Compact on-load tap changers designed for industrial, furnace, and medium-power transformer applications.' },
      { title: 'De-Energized Tap Changers (DETC)', desc: 'Linear and rotary off-circuit tap selectors for manual off-load voltage ratio adjustment.' },
      { title: 'Motor Drive Units & Controls', desc: 'Intelligent digital motor drive units with step position signaling, tap monitoring, and SCADA voltage regulation.' }
    ],
    deepCatIds: ['tap-changers'],
    accCats: ['Tap changers (OLTC / DETC)'],
    faq: [
      { q: 'Why has vacuum OLTC technology become the global utility standard?', a: 'Vacuum interrupters extinguish the switching arc inside sealed vacuum bottles, completely avoiding arc contact with insulating oil. This prevents soot, preserves oil dielectric strength, and lowers maintenance cycles.' },
      { q: 'What is the function of a high-speed transition resistor in an OLTC?', a: 'The transition resistor bridges adjacent tap contacts during transfer to maintain continuous load current while limiting circulating current across the bridged winding section.' }
    ]
  },
  {
    file: 'components/insulation-materials.html',
    title: 'Transformer Insulation Materials & Pressboard',
    standards: 'IEC 60641, IEC 60763, IEC 60893, ASTM D2413',
    lead: 'Pre-compressed high-density transformerboard, diamond dotted paper (DDP), crepe paper, laminated wood clamping beams, and high-temperature aramid insulation.',
    subcats: [
      { title: 'Transformerboard (High-Density Pressboard)', desc: 'Pure unbleached kraft cellulose board for cylinders, barriers, angle rings, and winding clamping plates.' },
      { title: 'Diamond Dotted Paper (DDP / DPE)', desc: 'Epoxy resin dot-coated kraft insulation paper that cures during heat-run to bond windings into rigid blocks.' },
      { title: 'Laminated Densified Wood', desc: 'Beechwood laminates bonded under extreme pressure for non-magnetic core clamping beams, rings, and pressure plates.' },
      { title: 'Aramid Insulation (Nomex®)', desc: 'High-temperature thermal class H/C (180°C–220°C) aramid sheet and paper for dry-type, traction, and high-temperature liquid transformers.' }
    ],
    deepCatIds: ['pressboard', 'insulation-wood', 'ddp-paper'],
    accCats: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)', 'Laminated wood / insulation wood'],
    faq: [
      { q: 'What is the dielectric difference between Calendered Pressboard and Transformerboard?', a: 'Transformerboard (IEC 60641-3-1 Type B.3.1) is high-density, dimensionally stable, hot-press dried board with low compressibility (<5%) used for structural and high-voltage barriers. Calendered pressboard is softer and used for punching formed parts.' },
      { q: 'Why is Diamond Dotted Paper critical for short-circuit withstand?', a: 'During oven drying, the B-stage epoxy dots melt, flow, and polymerize, bonding adjacent turns and layers into a solid structural monolith capable of resisting severe radial and axial electromagnetic short-circuit forces.' }
    ]
  },
  {
    file: 'components/transformer-cooling.html',
    title: 'Transformer Cooling Systems & Radiators',
    standards: 'IEC 60076-2, IEEE C57.12.00, DIN 42551',
    lead: 'Pressed-steel panel radiators, forced-oil water coolers (OFWF/ODWF), compact air-blast coolers (OFAF/ODAF), radiator shut-off butterfly valves, and high-efficiency low-noise cooling fans.',
    subcats: [
      { title: 'Pressed Steel Radiator Banks', desc: 'Hot-dip galvanized and multi-coat painted panel radiator elements complying with DIN 42551 and customized header spacing.' },
      { title: 'Forced Air (AF) Cooling Fans', desc: 'Low-noise, IP56-rated external axial cooling fans with automatic thermostatic staging control.' },
      { title: 'Oil Circulation Pumps', desc: 'Glandless centrifugal immersion pumps for forced-oil directed (ODAF/ODWF) and non-directed (OFAF/OFWF) cooling loops.' },
      { title: 'Oil-to-Water Heat Exchangers', desc: 'Double-tube fail-safe heat exchangers for hydro-power generation and offshore converter substations.' }
    ],
    deepCatIds: ['radiators', 'cooling-fans', 'oil-pumps'],
    accCats: ['Radiators / cooling systems', 'Cooling fans', 'Oil-circulation pumps'],
    faq: [
      { q: 'What is the difference between OFAF and ODAF cooling?', a: 'In OFAF (Oil Forced Air Forced), pumps circulate bulk oil through external coolers. In ODAF (Oil Directed Air Forced), internal baffles guide the forced oil flow directly through winding cooling ducts for maximum heat transfer efficiency.' }
    ]
  },
  {
    file: 'components/conductors-and-core.html',
    title: 'Conductors & Magnetic Core Materials',
    standards: 'IEC 60404-8-7, ASTM A876, IEC 60317',
    lead: 'Continuously transposed conductors (CTC), enamelled magnet wire, oxygen-free copper and aluminium strip, Grain-Oriented Electrical Steel (CRGO), and amorphous alloy ribbons.',
    subcats: [
      { title: 'Continuously Transposed Conductors (CTC)', desc: 'Multi-strand transposed copper strips with epoxy bonding and kraft/Netome insulation to eliminate eddy-current losses in large power windings.' },
      { title: 'Grain-Oriented Electrical Steel (CRGO)', desc: 'High-permeability (Hi-B), domain-refined, laser-scribed silicon steel sheets (0.18mm to 0.27mm) for ultra-low no-load loss cores.' },
      { title: 'Copper & Aluminium Foil / Strip', desc: 'High-conductivity edge-conditioned copper and aluminium strips for low-voltage distribution and foil windings.' },
      { title: 'Amorphous Core Alloys', desc: 'Iron-based metallic glass ribbons offering up to 75% lower core losses compared to conventional CRGO in distribution grids.' }
    ],
    deepCatIds: ['crgo-steel', 'ctc-conductors'],
    accCats: ['CRGO (core steel)', 'Copper / CTC conductors'],
    faq: [
      { q: 'Why is continuously transposed conductor (CTC) essential above 50 MVA?', a: 'CTC transposes each individual enamelled copper strand through every position in the conductor cross-section along the winding length. This equalizes flux linkages, drastically cutting circulating eddy currents and winding hot-spot temperatures.' }
    ]
  },
  {
    file: 'components/oil-fluids-preservation.html',
    title: 'Transformer Oil, Ester Fluids & Preservation',
    standards: 'IEC 60296, IEC 61099, ASTM D3487, IEEE C57.147',
    lead: 'Inhibited and uninhibited naphthenic mineral insulating oils, synthetic and natural ester dielectric fluids (K-class fire safety), rubber air-cell preservation bladders, and silica-gel breathers.',
    subcats: [
      { title: 'Natural & Synthetic Ester Fluids', desc: 'High fire-point (>300°C), biodegradable K-class dielectric fluids (FR3, MIDEL) for urban, indoor, and environmentally sensitive substations.' },
      { title: 'Inhibited Mineral Insulating Oil', desc: 'High-dielectric, low-viscosity naphthenic oils offering excellent oxidation stability and heat dissipation.' },
      { title: 'Rubber Conservator Air Cells', desc: 'Nitrile and rubber compensation bladders that seal transformer oil from atmospheric oxygen and moisture contact.' },
      { title: 'Dehydrating Silica Gel Breathers', desc: 'Conventional and maintenance-free smart self-regenerating air breathers for oil conservator expansion tanks.' }
    ],
    deepCatIds: ['transformer-oil', 'breathers', 'conservator-tanks'],
    accCats: ['Transformer oil / ester fluids', 'Breathers (silica gel)', 'Conservator tanks', 'Oil treatment devices'],
    faq: [
      { q: 'What advantages do natural ester fluids provide over mineral oil?', a: 'Natural esters have a flash point >300°C (K-class vs O-class for mineral oil at 140°C), are 100% readily biodegradable, and chemically bind moisture to extend cellulose paper insulation life.' }
    ]
  },
  {
    file: 'components/protection-monitoring.html',
    title: 'Transformer Protection & Online Monitoring',
    standards: 'IEC 60255, EN 50216, IEEE C57.104',
    lead: 'Buchholz relays, sudden pressure relays, multi-gas online Dissolved Gas Analysis (DGA) monitors, fiber-optic direct winding temperature sensors, and electronic pressure relief devices.',
    subcats: [
      { title: 'Buchholz Relays & Gas Accumulators', desc: 'Single and double-float Buchholz relays according to EN 50216 for early detection of internal arcing, partial discharge, and oil surges.' },
      { title: 'Online Multi-Gas DGA Monitors', desc: 'Continuous photoacoustic and gas-chromatography monitors measuring fault gases (H2, CH4, C2H2, C2H4, C2H6, CO, CO2) and moisture in oil.' },
      { title: 'Fiber-Optic Hot-Spot Temperature Probes', desc: 'Direct GaAs fiber-optic temperature sensors embedded inside high-voltage windings for real-time dynamic rating control.' },
      { title: 'Pressure Relief Devices (PRD)', desc: 'Spring-loaded mechanical and electronic relief valves with directional discharge hoods and microswitches.' }
    ],
    deepCatIds: ['buchholz-relays', 'monitoring-dga', 'temperature-indicators', 'pressure-relief'],
    accCats: ['Buchholz relays', 'Monitoring / diagnostic devices', 'Temperature indicators', 'Pressure-relief devices', 'Oil-level indicators'],
    faq: [
      { q: 'Why is Acetylene (C2H2) considered the most critical DGA gas?', a: 'Acetylene is generated only at thermal fault temperatures exceeding 700°C or by high-energy electric arcing. Detection of C2H2 indicates active electrical discharge requiring immediate investigation.' }
    ]
  },
  {
    file: 'components/tank-and-mechanical.html',
    title: 'Transformer Tank Fabrication & Mechanical Fittings',
    standards: 'EN 10025, ASME Section IX, DIN 42560',
    lead: 'Heavy structural steel transformer tanks, bell-type vacuum-rated enclosures, corrugated fin tanks for distribution units, conservators, valves, and resilient sealing gaskets.',
    subcats: [
      { title: 'Vacuum-Rated Heavy Power Tanks', desc: 'Full vacuum-withstand welded structural steel tanks with internal non-magnetic shielding and lifting trunnions.' },
      { title: 'Corrugated Fin Distribution Tanks', desc: 'Automated folded-fin hermetically sealed tanks acting as both enclosure and cooling surface for distribution units.' },
      { title: 'Radiator & Drain Butterfly Valves', desc: 'Flanged carbon and stainless steel butterfly valves with visual open/close indicators for radiator isolation.' },
      { title: 'High-Performance Gaskets & Seals', desc: 'Cork-rubber, fluorocarbon (Viton), and NBR gaskets resistant to high-temperature mineral oil and ester fluids.' }
    ],
    deepCatIds: ['conservator-tanks', 'valves-gaskets'],
    accCats: ['Conservator tanks', 'Pressure-relief devices'],
    faq: [
      { q: 'Why do large power transformer tanks require full-vacuum capability?', a: 'During factory and site oil filling, the transformer must be subjected to deep vacuum (<1 mbar) for several hours to extract residual moisture and air bubbles before vacuum oil impregnation.' }
    ]
  }
];

function getSuppliersForPage(config) {
  const map = new Map();

  // 1. Pull from deep dive
  config.deepCatIds.forEach(catId => {
    const cat = DEEP_DIVE.find(c => c.id === catId);
    if (cat && cat.suppliers) {
      cat.suppliers.forEach(s => {
        if (!map.has(s.name)) {
          map.set(s.name, {
            name: s.name,
            country: s.country,
            location: (s.city ? s.city + ', ' : '') + s.country,
            website: s.website,
            desc: s.description || cat.scope,
            source: 'Deep-Dive Directory'
          });
        }
      });
    }
  });

  // 2. Pull from accessories
  config.accCats.forEach(catName => {
    ACCESSORIES.forEach(s => {
      if (s.categories && s.categories.includes(catName)) {
        if (!map.has(s.name)) {
          map.set(s.name, {
            name: s.name,
            country: s.country,
            location: (s.city ? s.city + ', ' : '') + s.country,
            website: s.website,
            desc: s.description || (s.categories || []).join(' · '),
            source: 'Verified Accessory Census'
          });
        }
      }
    });
  });

  return Array.from(map.values());
}

PAGES.forEach(cfg => {
  const suppliers = getSuppliersForPage(cfg);

  const subcatsHtml = cfg.subcats.map(sc => `
    <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px">
      <h3 style="color:var(--ink);font-size:1.05rem;margin:0 0 6px">${esc(sc.title)}</h3>
      <p style="color:var(--muted);font-size:.88rem;line-height:1.5;margin:0 0 10px">${esc(sc.desc)}</p>
      <div style="font-size:.82rem"><a href="../rfq.html?category=${encodeURIComponent(sc.title)}" style="color:var(--accent);font-weight:700">Request quotation →</a></div>
    </div>
  `).join('');

  const suppliersHtml = suppliers.length ? `
    <h2 style="font-size:1.3rem;color:var(--ink);margin:34px 0 12px">Verified Sourced Suppliers (${suppliers.length})</h2>
    <p style="font-size:.88rem;color:var(--muted);margin-bottom:16px">Independent canonical supplier listings verified against manufacturer disclosures and official registries. Sourced for high-voltage and distribution transformer integration.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:28px">
      ${suppliers.map(s => `
        <div class="supp-card" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
              <h3 style="font-size:1.08rem;font-weight:700;color:var(--ink);margin:0">${esc(s.name)}</h3>
              <span style="display:inline-block;background:rgba(22,163,74,.14);color:#16a34a;border:1px solid #16a34a;border-radius:999px;padding:1px 7px;font-size:.68rem;font-weight:700">VERIFIED</span>
            </div>
            <div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">📍 ${esc(s.location)}</div>
            <p style="font-size:.85rem;color:var(--text);line-height:1.45;margin:0 0 12px">${esc(s.desc)}</p>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;justify-content:space-between;align-items:center;font-size:.82rem">
            ${s.website ? `<a href="${esc(s.website)}" target="_blank" rel="noopener nofollow" style="color:var(--accent);font-weight:600">Official website ↗</a>` : '<span style="color:var(--muted)">Verified OEM</span>'}
            <a class="btn btn-outline btn-sm" href="../rfq.html?supplier=${encodeURIComponent(s.name)}&category=${encodeURIComponent(cfg.title)}" style="font-size:.74rem;padding:3px 10px">Request RFQ →</a>
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const faqHtml = cfg.faq.map(f => `
    <div style="margin:14px 0">
      <b style="color:var(--ink);font-size:.96rem">${esc(f.q)}</b>
      <p style="color:var(--text);margin:4px 0 0;line-height:1.65;font-size:.9rem">${esc(f.a)}</p>
    </div>
  `).join('');

  const fullHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cfg.title)} — Technical Overview &amp; Sourced Suppliers | TransformerPath</title>
<meta name="description" content="Technical guide and verified supplier directory for ${esc(cfg.title)}. Standards: ${esc(cfg.standards)}. Shortlist verified manufacturers and request quotations.">
<link rel="canonical" href="https://transformerpath.com/${cfg.file}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="${esc(cfg.title)} | TransformerPath">
<meta property="og:description" content="Technical specifications, standards (${esc(cfg.standards)}), and verified component suppliers for ${esc(cfg.title)}.">
<meta property="og:url" content="https://transformerpath.com/${cfg.file}">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<link rel="stylesheet" href="/style.css?v=13">
<link rel="stylesheet" href="/tp-nav.css?v=13">
<link rel="stylesheet" href="/tp-feedback.css?v=13">
<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg"><link rel="icon" href="/brand/favicon.ico" sizes="any">
<style>
.c-wrap { max-width: 980px; margin: 0 auto; padding: 44px 20px 88px; }
.c-wrap h1 { font-size: 2.1rem; color: var(--ink); margin: 0 0 6px; }
.c-wrap .std { font-family: monospace; font-size: .84rem; color: var(--accent); background: rgba(245,166,35,.08); display: inline-block; padding: 3px 10px; border-radius: 6px; margin: 6px 0 14px; }
.c-wrap .lead { color: var(--muted); font-size: 1.02rem; line-height: 1.6; margin-bottom: 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 24px; }
</style>
</head>
<body>
${HEAD}
<main class="c-wrap">
  <nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="../components.html" style="color:var(--accent)">Components</a> › ${esc(cfg.title)}</nav>
  <h1>${esc(cfg.title)}</h1>
  <div class="std">Applicable Standards: ${esc(cfg.standards)}</div>
  <p class="lead">${esc(cfg.lead)}</p>

  <h2 style="font-size:1.3rem;color:var(--ink);margin:24px 0 12px">Technical Classifications</h2>
  <div class="grid">${subcatsHtml}</div>

  ${suppliersHtml}

  <h2 style="font-size:1.3rem;color:var(--ink);margin-top:32px">Engineering &amp; Technical FAQ</h2>
  ${faqHtml}

  <div style="margin-top:28px">
    <div class="card" style="background:rgba(245,166,35,.08);border:1px solid var(--accent);border-radius:12px;padding:20px 22px;text-align:center">
      <b style="color:var(--text);font-size:1.1rem">Procuring ${esc(cfg.title)}?</b>
      <p style="color:var(--muted);font-size:.9rem;margin:6px 0 14px">Issue a direct technical requirement to verified component and material manufacturers.</p>
      <a class="btn btn-amber" href="../rfq.html?category=${encodeURIComponent(cfg.title)}" data-track="rfq_started" data-track-component_category="${esc(cfg.title)}">Submit an RFQ →</a>
      <a class="btn btn-outline btn-sm" href="../list-company.html" data-track="supplier_claim_started" data-track-component_category="${esc(cfg.title)}" style="margin-left:8px">Supply this? Claim listing →</a>
    </div>
  </div>

  <div style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:16px">
    Explore related: <a href="../components.html" style="color:var(--accent);font-weight:600">All Components</a> · <a href="../buyers-guide.html" style="color:var(--accent);font-weight:600">Buyer's Guide</a> · <a href="../standards.html" style="color:var(--accent);font-weight:600">Standards Directory</a>
  </div>
  <p style="font-size:.78rem;color:var(--muted);margin-top:22px">Disclaimer: Directory entries are compiled from public technical sources and verified manufacturer disclosures. Verification confirms stated corporate identity and product line availability; it does not constitute factory auditing, quality warranty, or utility endorsement.</p>
</main>
${FOOT}
<script src="/analytics.js?v=2" defer></script>
</body>
</html>`;

  fs.writeFileSync(cfg.file, fullHtml);
  console.log(`✓ Built ${cfg.file} with ${suppliers.length} canonical suppliers.`);
});
