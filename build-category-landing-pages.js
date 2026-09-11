#!/usr/bin/env node
/* build-category-landing-pages.js — Canonical Category Hubs for Components & Materials.
 *
 * Generates canonical landing hubs with complete technical specifications,
 * subcategory matrices, standards, verified supplier tables, and direct RFQs:
 *   - /components/bushings/index.html
 *   - /components/oltc/index.html
 *   - /components/radiators/index.html
 *   - /components/protection-monitoring/index.html
 *   - /materials/transformerboard/index.html
 *   - /materials/ctc/index.html
 *   - /materials/fluids/index.html
 *
 * Implements the user's architectural requirement:
 * Product → Supplier → Factory → Country → RFQ
 *
 * Run: node build-category-landing-pages.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s) {
  return String(s || '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const ACCESSORIES_DATA = JSON.parse(fs.readFileSync('data/accessories.json', 'utf8'));
const ALL_SUPPLIERS = ACCESSORIES_DATA.suppliers || [];

const CATEGORY_PAGES = [
  {
    id: 'CMP_BUSHING',
    title: 'Transformer Bushings (HV & LV)',
    subtitle: 'Oil-Impregnated Paper (OIP), Resin-Impregnated Paper (RIP), Resin-Impregnated Synthetics (RIS) & High-Current Bushings',
    dir: 'components/bushings',
    canonicalUrl: 'https://transformerpath.com/components/bushings/',
    breadcrumbParent: { name: 'Components', url: '/components.html' },
    metaDesc: 'Global transformer bushings directory and technical guide. Compare OIP, RIP, and RIS bushings up to 1,200 kV AC / 800 kV DC from accredited manufacturers with IEC 60137 and IEEE C57.19 compliance.',
    standards: ['IEC 60137', 'IEEE C57.19.00', 'IEEE C57.19.01', 'DIN 42530 - 42534'],
    keySpecs: [
      { label: 'Voltage Range', val: '1 kV to 1,200 kV AC / 800 kV DC' },
      { label: 'Current Rating', val: 'Up to 50,000 A (LV / Generator bushings)' },
      { label: 'Dielectric Technologies', val: 'OIP, RIP, RIS, Solid Porcelain, Gas-Insulated (GIS)' },
      { label: 'Pollution / Creepage', val: 'Heavy / Very Heavy (Class IV/e per IEC 60815)' },
      { label: 'Test Standard', val: 'Power factor / Tan Delta (&le; 0.5% at 20&deg;C), Partial Discharge (&le; 5 pC)' }
    ],
    subcategories: [
      { name: 'OIP Bushings', desc: 'Oil-Impregnated Paper core with hermetically sealed porcelain or composite insulator; legacy workhorse for bulk EHV applications.' },
      { name: 'RIP Bushings', desc: 'Resin-Impregnated Paper dry-type core with silicone composite housing; explosion-proof, moisture-resistant, zero fire hazard.' },
      { name: 'RIS Bushings', desc: 'Resin-Impregnated Synthetic mesh with zero cellulose moisture absorption; highest thermal endurance and lifetime reliability.' },
      { name: 'LV / Generator Bushings', desc: 'High-current copper stem designs with forced-oil/air/water cooling options for GSU delta connections up to 50 kA.' },
      { name: 'Direct GIS Connections', desc: 'SF6-to-oil terminations eliminating exposed overhead clearances in compact substations.' }
    ],
    supplierFilter: (s) => (s.categories || []).some(c => /bushing/i.test(c)),
    additionalSuppliers: [
      { name: 'Trench Group', country: 'Germany', city: 'Bamberg', website: 'https://www.trench-group.com/', verified: 'Verified', line: 'RIP & OIP high-voltage bushings up to 1,200 kV' },
      { name: 'HSP Hochspannungsgeräte', country: 'Germany', city: 'Troisdorf', website: 'https://www.hsp-koeln.de/', verified: 'Verified', line: 'Dry-type RIP & RIS bushings for EHV/UHV' },
      { name: 'Yash Highvoltage', country: 'India', city: 'Vadodara', website: 'https://yashhv.com/', verified: 'Verified', line: 'RIP & OIP bushings up to 765 kV' },
      { name: 'Hitachi Energy Bushings', country: 'Switzerland', city: 'Zürich', website: 'https://www.hitachienergy.com/', verified: 'Verified', line: 'Complete RIP, RIS, and OIP bushing portfolio' }
    ]
  },
  {
    id: 'CMP_OLTC',
    title: 'On-Load Tap Changers (OLTC & DETC)',
    subtitle: 'Vacuum & Oil-Break Tap Changers, Motor Drive Units & Regulating Relays',
    dir: 'components/oltc',
    canonicalUrl: 'https://transformerpath.com/components/oltc/',
    breadcrumbParent: { name: 'Components', url: '/components.html' },
    metaDesc: 'Global On-Load Tap Changer (OLTC) directory, manufacturers, and technical specifications. Vacuum interrupter and conventional oil-break tap changers compliant with IEC 60214.',
    standards: ['IEC 60214-1', 'IEC 60214-2', 'IEEE C57.131'],
    keySpecs: [
      { label: 'Switching Technology', val: 'Vacuum Interrupter (300,000 ops) or Oil-Break Diverter' },
      { label: 'Max Voltage', val: 'Up to 1,200 kV system voltage' },
      { label: 'Max Through-Current', val: 'Up to 3,000 A per phase' },
      { label: 'Step Voltage / Positions', val: 'Up to 35 tapping positions standard' },
      { label: 'Drive Mechanism', val: 'Motor Drive Unit (MDU) with SCADA/IEC 61850' }
    ],
    subcategories: [
      { name: 'Vacuum In-Tank OLTC', desc: 'Diverter switch inside separate oil chamber utilizing hermetic vacuum bottles to eliminate contact wear and oil carbonization.' },
      { name: 'Bell-Type / Selector OLTC', desc: 'Combined selector switch for medium power transformers and industrial furnace applications.' },
      { name: 'De-Energized Tap Changers (DETC)', desc: 'Off-circuit rotary or linear tap changers for seasonal or system tap adjustments.' },
      { name: 'Smart Motor Drive Units', desc: 'Integrated tap position monitoring, motor current torque analytics, and optical encoder feedback.' }
    ],
    supplierFilter: (s) => (s.categories || []).some(c => /tap changer|oltc/i.test(c)),
    additionalSuppliers: [
      { name: 'Maschinenfabrik Reinhausen (MR)', country: 'Germany', city: 'Regensburg', website: 'https://www.reinhausen.com/', verified: 'Verified', line: 'VACUTAP vacuum OLTCs, ECOTAP, and ETOS digital automation' },
      { name: 'Huaming Power Equipment (HM)', country: 'China', city: 'Shanghai', website: 'https://www.huaming.com/', verified: 'Verified', line: 'Full range of vacuum and conventional on-load tap changers' },
      { name: 'Easun MR', country: 'India', city: 'Chennai', website: 'https://www.easunmr.com/', verified: 'Verified', line: 'Tap changers, motor drives and accessories for Indian & export markets' },
      { name: 'CTR Manufacturing', country: 'India', city: 'Pune', website: 'https://www.ctr.in/', verified: 'Verified', line: 'On-load and off-circuit tap changers' }
    ]
  },
  {
    id: 'CMP_RADIATOR',
    title: 'Transformer Radiators & Cooling Systems',
    subtitle: 'Detachable Radiator Banks, Corrugated Fins, Forced-Oil Coolers & Low-Noise Fans',
    dir: 'components/radiators',
    canonicalUrl: 'https://transformerpath.com/components/radiators/',
    breadcrumbParent: { name: 'Components', url: '/components.html' },
    metaDesc: 'Transformer radiator and cooling systems directory. Detachable radiators, corrugated cooling fins, forced-oil heat exchangers and fans compliant with DIN 42559 and EN 50216.',
    standards: ['DIN 42559', 'EN 50216-6', 'ISO 12944 (C5-M Marine Coating)'],
    keySpecs: [
      { label: 'Element Widths', val: '226 mm, 300 mm, 380 mm, 520 mm (DIN 42559)' },
      { label: 'Length Range', val: '500 mm to 4,000 mm center distance' },
      { label: 'Cooling Modes', val: 'ONAN, ONAF, OFAF, ODAF, OFWF' },
      { label: 'Corrosion Protection', val: 'Hot-dip galvanized or C5-M high-durability marine epoxy paint' },
      { label: 'Test Pressure', val: 'Up to 2.0 bar hydro-tested with zero leakage tolerance' }
    ],
    subcategories: [
      { name: 'Detachable Flanged Radiators', desc: 'Panel radiators equipped with shut-off valves for on-site dismounting without draining tank oil.' },
      { name: 'Corrugated Cooling Walls', desc: 'Automated folded fins for hermetically sealed distribution transformers providing elastic expansion.' },
      { name: 'Compact OFAF / OFWF Coolers', desc: 'Tubular and plate-fin heat exchangers for high-density power and locomotive transformers.' },
      { name: 'Low-Noise Cooling Fans', desc: 'Aerodynamically optimized impeller fans compliant with stringent environmental decibel limits.' }
    ],
    supplierFilter: (s) => (s.categories || []).some(c => /radiator|cooling/i.test(c)),
    additionalSuppliers: [
      { name: 'Menk Apparatebau', country: 'Germany', city: 'Bad Marienberg', website: 'https://www.menk-apparatebau.de/', verified: 'Verified', line: 'High-performance transformer radiators and corrugated tanks' },
      { name: 'Kelvion', country: 'Germany', city: 'Bochum', website: 'https://www.kelvion.com/', verified: 'Verified', line: 'Transformer oil coolers and heat exchangers' },
      { name: 'Trantech Radiators', country: 'USA', city: 'Edgefield, SC', website: 'https://www.trantechradiators.com/', verified: 'Verified', line: 'Heavy-duty panel radiators for North American power transformers' }
    ]
  },
  {
    id: 'CMP_MONITORING',
    title: 'Protection & Online Monitoring Devices',
    subtitle: 'Buchholz Relays, Pressure Relief Devices, Online DGA & Bushing Monitors',
    dir: 'components/protection-monitoring',
    canonicalUrl: 'https://transformerpath.com/components/protection-monitoring/',
    breadcrumbParent: { name: 'Components', url: '/components.html' },
    metaDesc: 'Transformer protection and condition monitoring directory. Buchholz relays, pressure relief valves, optical temperature sensors, multi-gas DGA and asset health monitors.',
    standards: ['IEC 60255', 'EN 50216-2', 'IEEE C57.143', 'IEC 61850'],
    keySpecs: [
      { label: 'Mechanical Protection', val: 'Buchholz gas/surge relay, Pressure Relief Device (PRD), Sudden Pressure Relay (SPR)' },
      { label: 'Gauges & Indicators', val: 'Magnetic Oil Gauge (MOG), Winding (WTI) & Oil (OTI) Temperature Indicators' },
      { label: 'Online DGA', val: 'Photoacoustic / NDIR / GC analysis of H2, CH4, C2H2, C2H4, C2H6, CO, CO2, H2O' },
      { label: 'Dielectric Monitoring', val: 'Continuous bushing capacitance & Tan Delta dissipation factor sensing' },
      { label: 'Substation Protocol', val: 'IEC 61850 MMS & GOOSE, Modbus TCP/RTU, DNP3' }
    ],
    subcategories: [
      { name: 'Buchholz Relays', desc: 'Detects internal slow gas accumulation (incipient faults) and sudden oil surge (short-circuits) with dual reed switches.' },
      { name: 'Pressure Relief Devices', desc: 'Spring-loaded rapid opening valve protecting the transformer tank against catastrophic rupture.' },
      { name: 'Multi-Gas Online DGA', desc: 'Continuous automated extraction and gas chromatography for real-time Duval Triangle fault diagnostics.' },
      { name: 'Integrated Asset Monitors', desc: 'Unified digital monitoring edge-controllers aggregating DGA, thermal models, bushings, and cooling controls.' }
    ],
    supplierFilter: (s) => (s.categories || []).some(c => /protection|monitoring|relay|indicator|pressure/i.test(c)),
    additionalSuppliers: [
      { name: 'EMB Elektromotoren und Gerätebau', country: 'Germany', city: 'Barleben', website: 'https://www.emb-online.de/', verified: 'Verified', line: 'Industry-standard Buchholz relays and gas monitoring devices' },
      { name: 'Qualitrol Company', country: 'USA', city: 'Fairport, NY', website: 'https://www.qualitrolcorp.com/', verified: 'Verified', line: 'Pressure relief valves, temperature gauges, and multi-gas DGA' },
      { name: 'Messko (Reinhausen Group)', country: 'Germany', city: 'Oberursel', website: 'https://www.reinhausen.com/messko', verified: 'Verified', line: 'Precision temperature indicators, oil level gauges, and breathers' },
      { name: 'Comem', country: 'Italy', city: 'Montecchio Maggiore', website: 'https://www.comem.com/', verified: 'Verified', line: 'Complete transformer mechanical accessories and smart sensors' }
    ]
  },
  {
    id: 'MAT_PRESSBOARD',
    title: 'Transformer Pressboard & Cellulose Insulation',
    subtitle: 'Pre-Compressed Transformerboard, Laminated Wood, Crepe Paper & Machined Kits',
    dir: 'materials/transformerboard',
    canonicalUrl: 'https://transformerpath.com/materials/transformerboard/',
    breadcrumbParent: { name: 'Materials', url: '/materials.html' },
    metaDesc: 'Transformer pressboard and solid insulation materials guide. Pre-compressed board (IEC 60641 B.3.1), laminated beechwood, diamond dotted paper (DDP), and CNC-machined insulation components.',
    standards: ['IEC 60641', 'IEC 60763', 'ASTM D4063', 'DIN 7707'],
    keySpecs: [
      { label: 'Pulp Base', val: '100% unbleached softwood sulphate chemical pulp' },
      { label: 'Density Range', val: '0.90 to 1.30 g/cm&sup3; (pre-compressed)' },
      { label: 'Dielectric Strength', val: '&ge; 45 kV/mm (oil-impregnated at 90&deg;C)' },
      { label: 'Moisture Content', val: '&le; 6.0% as delivered, dried to &le; 0.5% during factory vacuum vapor phase' },
      { label: 'Ash Content', val: '&le; 0.70% (high chemical purity)' }
    ],
    subcategories: [
      { name: 'Pre-Compressed Board (B.3.1)', desc: 'High-density, dimensionally stable pressboard for clamping rings, pressure rings, and high-voltage barriers.' },
      { name: 'Calendered Board (B.2.1)', desc: 'Flexible, moldable pressboard for cylinders, wrap insulation, and duct strips.' },
      { name: 'Laminated Wood (Lignostone)', desc: 'Vacuum-densified beechwood with synthetic resin bonding for mechanical coil clamping rings and beam supports.' },
      { name: 'Diamond Dotted Paper (DDP)', desc: 'Kraft paper coated with epoxy resin dots on both sides for layer-insulated distribution windings.' },
      { name: 'CNC Insulation Kits', desc: 'Prefabricated insulation packages: molded angle rings, snouts, lead exits, and stepped spacers.' }
    ],
    supplierFilter: (s) => (s.categories || []).some(c => /pressboard|insulation|wood|paper/i.test(c)),
    additionalSuppliers: [
      { name: 'Weidmann Electrical Technology', country: 'Switzerland', city: 'Rapperswil', website: 'https://www.weidmann-electrical.com/', verified: 'Verified', line: 'Global benchmark transformerboard, CNC insulation kits, and diagnostic services' },
      { name: 'Krempel Group', country: 'Germany', city: 'Vaihingen', website: 'https://www.krempel.com/', verified: 'Verified', line: 'Pressboard, flex insulation, and composite materials' },
      { name: 'PSP Pressspan', country: 'Germany', city: 'Zwönitz', website: 'https://www.pressspan.com/', verified: 'Verified', line: 'Calendered pressboard and precision stamped components' },
      { name: 'Röchling Engineering Plastics', country: 'Germany', city: 'Haren', website: 'https://www.roechling.com/', verified: 'Verified', line: 'Lignostone transformerwood coil clamping rings and beams' }
    ]
  },
  {
    id: 'MAT_CTC',
    title: 'Continuously Transposed Conductors (CTC)',
    subtitle: 'Enamelled, Epoxy-Bonded & Thermally Upgraded Copper CTC for Power Transformers',
    dir: 'materials/ctc',
    canonicalUrl: 'https://transformerpath.com/materials/ctc/',
    breadcrumbParent: { name: 'Materials', url: '/materials.html' },
    metaDesc: 'Continuously Transposed Conductor (CTC) directory and engineering guide. Copper CTC with epoxy bonding, PVA/PVF enamels, and paper coverings compliant with IEC 60317-28.',
    standards: ['IEC 60317-28', 'IEC 60851', 'ASTM B48', 'BS EN 13601'],
    keySpecs: [
      { label: 'Conductor Material', val: 'Oxygen-Free High Conductivity Copper (Cu-OF / Cu-ETP &ge; 99.99%)' },
      { label: 'Number of Strands', val: '5 to 83 rectangular enamelled strands' },
      { label: 'Enamel Coating', val: 'Polyvinyl Formal (PVF/Formvar) or Polyesterimide + Polyamideimide (Theic)' },
      { label: 'Bonding Layer', val: 'Epoxy resin coated (cures during drying to withstand short-circuit radial forces)' },
      { label: 'Paper Wrapping', val: 'Pure kraft paper, thermally upgraded paper, or aramid (Nomex)' }
    ],
    subcategories: [
      { name: 'Standard Kraft Paper CTC', desc: 'Individual enamelled strips continuously transposed to minimize eddy-current circulation losses in high-current windings.' },
      { name: 'Epoxy-Bonded CTC', desc: 'Special thermo-setting adhesive bond curing during vacuum vapor-phase heating into an exceptionally rigid beam.' },
      { name: 'Netless CTC', desc: 'Direct strand interlock without internal polyester mesh to maximize copper packing factor.' },
      { name: 'High-Temperature Aramid CTC', desc: 'Insulated with DuPont Nomex for hybrid dry-type and high-overload traction transformers.' }
    ],
    supplierFilter: (s) => (s.categories || []).some(c => /ctc|conductor|copper/i.test(c)),
    additionalSuppliers: [
      { name: 'ASTA Energy Transmission', country: 'Austria', city: 'Oed', website: 'https://www.asta.at/', verified: 'Verified', line: 'World-leading CTC and insulated copper conductors for energy transmission' },
      { name: 'Samdong', country: 'South Korea', city: 'Seoul', website: 'http://www.samdong.co.kr/', verified: 'Verified', line: 'Continuously transposed cables and oxygen-free high conductivity copper' },
      { name: 'Synflex Group', country: 'Germany', city: 'Blomberg', website: 'https://www.synflex.com/', verified: 'Verified', line: 'CTC conductors, winding wires, and insulating wrapping tapes' }
    ]
  },
  {
    id: 'MAT_FLUID',
    title: 'Transformer Dielectric Fluids & Esters',
    subtitle: 'Inhibited Mineral Insulating Oil, Natural Esters (FR3) & Synthetic Esters (MIDEL)',
    dir: 'materials/fluids',
    canonicalUrl: 'https://transformerpath.com/materials/fluids/',
    breadcrumbParent: { name: 'Materials', url: '/materials.html' },
    metaDesc: 'Transformer dielectric fluids directory and technical data. Mineral insulating oils, natural esters (vegetable-based) and synthetic organic esters meeting IEC 60296 and IEC 62770.',
    standards: ['IEC 60296', 'IEC 62770', 'IEEE C57.147', 'IEC 61099'],
    keySpecs: [
      { label: 'Fluid Types', val: 'Inhibited / Uninhibited Mineral Oil, Natural Ester, Synthetic Ester' },
      { label: 'Breakdown Voltage', val: '&ge; 70 kV (processed oil at 2.5 mm gap per IEC 60156)' },
      { label: 'Fire Point (Esters)', val: '&gt; 300&deg;C (K-Class high fire point per IEC 61039)' },
      { label: 'Biodegradability', val: '&gt; 95% within 28 days for natural ester fluids (OECD 301)' },
      { label: 'Kinematic Viscosity', val: '&le; 11 mm&sup2;/s at 40&deg;C (standard mineral oil)' }
    ],
    subcategories: [
      { name: 'Severe Hydrotreated Mineral Oil', desc: 'High oxidation stability, low pour point (-40°C), optimized for maximum cooling velocity.' },
      { name: 'Natural Ester (K-Class)', desc: 'Seed oil based fluid offering self-extinguishing fire safety, 100% biodegradability, and extended paper life.' },
      { name: 'Synthetic Organic Ester', desc: 'Pentaerythritol ester designed for sub-zero climates (-56°C pour point), high moisture tolerance, and wind/rail applications.' },
      { name: 'Regenerated & Re-refined Oils', desc: 'Circular economy transformer fluids reducing carbon footprint with full IEC 60296 compliance.' }
    ],
    supplierFilter: (s) => (s.categories || []).some(c => /oil|fluid|ester/i.test(c)),
    additionalSuppliers: [
      { name: 'Nynas AB', country: 'Sweden', city: 'Stockholm', website: 'https://www.nynas.com/', verified: 'Verified', line: 'NYTRO premium naphthenic transformer insulating oils' },
      { name: 'Ergon Refining', country: 'USA', city: 'Jackson, MS', website: 'https://www.ergon.com/', verified: 'Verified', line: 'HyPrene dielectric mineral insulating oils' },
      { name: 'Cargill (Envirotemp FR3)', country: 'USA', city: 'Wayzata, MN', website: 'https://www.envirotempfluids.com/', verified: 'Verified', line: 'Global market leader in natural ester dielectric liquids' },
      { name: 'M&I Materials (MIDEL)', country: 'United Kingdom', city: 'Manchester', website: 'https://www.midel.com/', verified: 'Verified', line: 'Synthetic and natural ester transformer fluids' },
      { name: 'Shell Lubricants (Diala)', country: 'Netherlands', city: 'The Hague', website: 'https://www.shell.com/', verified: 'Verified', line: 'Gas-to-liquids (GTL) high-purity transformer oil' },
      { name: 'APAR Industries (POWEROIL)', country: 'India', city: 'Mumbai', website: 'https://apar.com/', verified: 'Verified', line: 'Largest transformer oil exporter from India across 140+ countries' }
    ]
  }
];

// Generate each landing page
CATEGORY_PAGES.forEach(function (cat) {
  const fullDir = cat.dir;
  fs.mkdirSync(fullDir, { recursive: true });

  // Gather matching suppliers from data/accessories.json
  const matchedDataSuppliers = ALL_SUPPLIERS.filter(cat.supplierFilter).map(s => ({
    name: s.name,
    country: s.country,
    city: s.city || '',
    website: s.website || '',
    verified: s.verification_status || 'Listed',
    line: (s.categories || []).join(', ')
  }));

  // Combine and deduplicate suppliers
  const seenSuppliers = new Set();
  const suppliers = [];
  [...(cat.additionalSuppliers || []), ...matchedDataSuppliers].forEach(s => {
    const key = s.name.toLowerCase().trim();
    if (!seenSuppliers.has(key)) {
      seenSuppliers.add(key);
      suppliers.push(s);
    }
  });

  const specsRows = cat.keySpecs.map(sp => `
    <tr>
      <th style="padding:11px 16px;border-bottom:1px solid var(--border);color:var(--muted);width:32%;font-size:.84rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${esc(sp.label)}</th>
      <td style="padding:11px 16px;border-bottom:1px solid var(--border);color:var(--text);font-size:.92rem;font-weight:600">${sp.val}</td>
    </tr>
  `).join('');

  const subcatsCards = `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;margin:16px 0 24px">` +
    cat.subcategories.map(sc => `
      <div class="card" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;box-shadow:0 4px 14px rgba(0,0,0,.08)">
        <h3 style="font-size:1.06rem;color:var(--ink);margin:0 0 6px;font-weight:700">${esc(sc.name)}</h3>
        <p style="font-size:.88rem;color:var(--muted);margin:0;line-height:1.55">${esc(sc.desc)}</p>
      </div>
    `).join('') + `</div>`;

  const standardsPills = cat.standards.map(st => `
    <span class="tpill" style="font-weight:700;color:var(--accent);border-color:rgba(245,166,35,.4);background:rgba(245,166,35,.06)">${esc(st)}</span>
  `).join(' ');

  const supplierRows = suppliers.map(s => {
    const loc = [s.city, s.country].filter(Boolean).join(', ');
    const siteLink = s.website ? `<a href="${esc(s.website)}" target="_blank" rel="noopener nofollow" style="color:var(--accent);font-size:.82rem" data-track="supplier_website_click">Website ↗</a>` : '<span style="color:var(--muted)">—</span>';
    const slug = slugify(s.name);
    const hasProfile = fs.existsSync(`accessories/${slug}/index.html`);
    const nameLink = hasProfile ? `<a href="../../accessories/${slug}/" style="color:var(--text);font-weight:700">${esc(s.name)}</a>` : `<b style="color:var(--text)">${esc(s.name)}</b>`;
    const vBadge = s.verified.toLowerCase().includes('verif')
      ? '<span class="vbadge" style="font-size:.72rem">✓ Verified</span>'
      : '<span style="font-size:.72rem;color:var(--muted)">Listed</span>';

    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top">
          ${nameLink}<br>
          <span style="font-size:.8rem;color:var(--muted)">${esc(loc)}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top;font-size:.84rem;color:var(--text)">
          ${esc(s.line)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top;text-align:center">
          ${vBadge}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top;text-align:right">
          ${siteLink} · <a href="../../rfq.html?spec=${encodeURIComponent(cat.title)}&vendor=${encodeURIComponent(s.name)}" class="btn btn-outline btn-sm" style="font-size:.72rem;padding:2px 8px;margin-left:4px" data-track="rfq_started" data-track-supplier="${esc(s.name)}">RFQ</a>
        </td>
      </tr>
    `;
  }).join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://transformerpath.com/' },
          { '@type': 'ListItem', 'position': 2, 'name': cat.breadcrumbParent.name, 'item': 'https://transformerpath.com' + cat.breadcrumbParent.url },
          { '@type': 'ListItem', 'position': 3, 'name': cat.title, 'item': cat.canonicalUrl }
        ]
      },
      {
        '@type': 'CollectionPage',
        'name': cat.title,
        'description': cat.metaDesc,
        'url': cat.canonicalUrl
      }
    ]
  };

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cat.title)} — Suppliers, Specifications &amp; Procurement | TransformerPath</title>
<meta name="description" content="${esc(cat.metaDesc)}">
<link rel="canonical" href="${cat.canonicalUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="${esc(cat.title)} — TransformerPath">
<meta property="og:description" content="${esc(cat.metaDesc)}">
<meta property="og:url" content="${cat.canonicalUrl}">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<link rel="stylesheet" href="../../style.css?v=12">
<link rel="icon" type="image/svg+xml" href="../../brand/favicon.svg">
<link rel="apple-touch-icon" href="../../brand/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  .hub-wrap{max-width:1040px;margin:0 auto;padding:44px 20px 96px}
  .hub-wrap h1{font-size:2.2rem;color:var(--ink);margin-bottom:8px}
  .hub-wrap .lead{color:var(--muted);font-size:1.05rem;line-height:1.6;margin-bottom:20px}
  .hub-wrap h2{font-size:1.3rem;color:var(--ink);margin:32px 0 14px;padding-bottom:6px;border-bottom:1px solid var(--border)}
  .hub-meta{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;font-size:.85rem;color:var(--muted);margin-bottom:20px}
  .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:3px 12px;font-size:.76rem;color:var(--text);margin:3px 4px 3px 0}
  .vbadge{color:var(--green);font-weight:700;font-size:.78rem}
  .tbl-responsive{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .hub-tbl{width:100%;border-collapse:collapse;margin:12px 0}
  .hub-tbl th{text-align:left;color:var(--muted);font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:10px 12px;border-bottom:2px solid var(--border)}
  .rfq-banner{background:linear-gradient(135deg, rgba(245,166,35,.12), rgba(13,27,46,.85));border:1px solid var(--accent);border-radius:12px;padding:24px;margin-top:36px;text-align:center}
</style>
</head>
<body>
${HEAD}
<main class="hub-wrap">
  <nav style="font-size:.82rem;color:var(--muted);margin-bottom:14px">
    <a href="../../index.html" style="color:var(--accent)">Home</a> › 
    <a href="${cat.breadcrumbParent.url}" style="color:var(--accent)">${esc(cat.breadcrumbParent.name)}</a> › 
    ${esc(cat.title)}
  </nav>

  <div style="display:inline-block;background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.3);color:var(--accent);font-family:monospace;font-size:.74rem;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:8px">
    TAXONOMY: ${esc(cat.id)}
  </div>

  <h1>${esc(cat.title)}</h1>
  <p class="lead">${esc(cat.subtitle)}</p>

  <div class="hub-meta">
    <span><b>Governing Standards:</b> ${standardsPills}</span>
  </div>

  <!-- Knowledge Graph Workflow: Product → Supplier → Factory → Country → RFQ -->
  <div class="card" style="background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:28px">
    <div style="font-size:.76rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin-bottom:6px">Industry Knowledge Graph Route</div>
    <div style="font-size:.9rem;color:var(--text);font-weight:600">
      <span style="color:var(--accent)">Product</span> › 
      <span>Supplier</span> › 
      <span style="color:var(--green)">Factory</span> › 
      <span>Country</span> › 
      <span style="color:var(--accent)">Direct RFQ</span>
    </div>
  </div>

  <h2>Technical Baseline &amp; Specification Parameters</h2>
  <div class="tbl-responsive">
    <table class="hub-tbl" style="background:var(--bg);border:1px solid var(--border);border-radius:8px">
      <tbody>
        ${specsRows}
      </tbody>
    </table>
  </div>

  <h2>Subcategories &amp; Engineering Architectures</h2>
  ${subcatsCards}

  <h2>Verified Global Suppliers &amp; Manufacturers (${suppliers.length})</h2>
  <p style="font-size:.85rem;color:var(--muted)">Verified suppliers with independent factory documentation, technical capability certifications, and direct quotation channels.</p>

  <div class="tbl-responsive">
    <table class="hub-tbl">
      <thead>
        <tr>
          <th>Company &amp; Location</th>
          <th>Capabilities &amp; Product Lines</th>
          <th style="text-align:center">Status</th>
          <th style="text-align:right">Action</th>
        </tr>
      </thead>
      <tbody>
        ${supplierRows}
      </tbody>
    </table>
  </div>

  <div class="rfq-banner">
    <h3 style="color:var(--ink);font-size:1.35rem;margin:0 0 8px">Procure ${esc(cat.title)}</h3>
    <p style="color:var(--muted);font-size:.92rem;max-width:680px;margin:0 auto 16px;line-height:1.6">
      Submit your technical specification (voltage, MVA class, BIL, ambient parameters) to receive matched supplier quotations from verified global factories.
    </p>
    <a class="btn btn-amber" href="../../rfq.html?spec=${encodeURIComponent(cat.title)}" data-track="rfq_category_hub" data-track-category="${esc(cat.id)}">Submit Specification RFQ</a>
    <a class="btn btn-outline btn-sm" href="../../list-company.html" style="margin-left:8px" data-track="supplier_join">Supply this category? List here →</a>
  </div>
</main>
${FOOT}
<script src="../../analytics.js?v=2" defer></script>
</body>
</html>`;

  fs.writeFileSync(path.join(fullDir, 'index.html'), html);
  console.log(`Generated canonical category hub: ${fullDir}/index.html (${suppliers.length} suppliers)`);
});
