#!/usr/bin/env node
/* build-category-saturation.js — Category Depth & Research Command Center Engine
 *
 * Implements:
 * 1. Deep Category Saturation Metrics across all 12 key verticals:
 *    - Confirmed Manufacturers
 *    - Processors / Converters
 *    - Distributors / Stockists
 *    - Total Manufacturing Facilities
 *    - Countries Represented
 *    - Tier-A Source Coverage %
 *    - Saturation Tier (LOW / MEDIUM / HIGH)
 * 2. Automated Research Priority Scoring:
 *    Priority = Search Demand × RFQ Value × Data Weakness × Staleness
 *
 * Run: node build-category-saturation.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

function readJson(f, fallback) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { return fallback; }
}

const companiesDoc = readJson('data/companies.json', { companies: [] });
const directoryDoc = readJson('data/directory-index.json', { companies: [] });
const accessoriesDoc = readJson('data/accessories.json', { suppliers: [] });
const facilitiesDoc = readJson('data/facilities.json', { facilities: [] });
const labsDoc = readJson('data/laboratories.json', { laboratories: [] });
const machineryDoc = readJson('data/machinery.json', { machinery: [] });

const CATEGORIES = [
  {
    id: 'pressboard',
    name: 'Pressboard & Transformerboard',
    standards: ['IEC 60641', 'IEC 60763'],
    thickness_range: '0.5 mm – 120 mm (laminated)',
    search_demand: 92, // 0-100 scale
    rfq_value_weight: 88,
    keywords: ['pressboard', 'transformerboard', 'insulation board', 'kraft board', 'high-density board']
  },
  {
    id: 'bushings',
    name: 'Transformer Bushings (OIP / RIP / RIS)',
    standards: ['IEC 60137', 'IEEE C57.19.00'],
    voltage_range: '24 kV – 1,200 kV',
    search_demand: 95,
    rfq_value_weight: 94,
    keywords: ['bushing', 'rip bushing', 'oip bushing', 'ris bushing', 'composite bushing', 'porcelain bushing']
  },
  {
    id: 'oltc',
    name: 'On-Load & De-Energized Tap Changers (OLTC / DETC)',
    standards: ['IEC 60214-1', 'IEC 60214-2'],
    voltage_range: 'Up to 1,200 kV / 3,000 A',
    search_demand: 90,
    rfq_value_weight: 92,
    keywords: ['tap changer', 'oltc', 'detc', 'vacuum tap changer', 'on-load tap changer']
  },
  {
    id: 'conductors_ctc',
    name: 'Continuously Transposed Conductors (CTC) & Copper Winding',
    standards: ['IEC 60317', 'ASTM B48'],
    technical_range: 'Oxygen-Free Copper (OFC), 5–83 strands, epoxy bonded',
    search_demand: 85,
    rfq_value_weight: 90,
    keywords: ['ctc', 'continuously transposed', 'copper conductor', 'enamelled wire', 'paper insulated copper']
  },
  {
    id: 'radiators_cooling',
    name: 'Transformer Radiators & Forced Cooling Systems',
    standards: ['DIN 42551', 'EN 50216-6'],
    technical_range: 'Panel radiators, ONAN/ONAF/OFAF/ODAF coolers, pumps, fans',
    search_demand: 78,
    rfq_value_weight: 75,
    keywords: ['radiator', 'cooling bank', 'oil cooler', 'transformer fan', 'oil pump']
  },
  {
    id: 'dielectric_fluids',
    name: 'Dielectric Liquids & Natural/Synthetic Esters',
    standards: ['IEC 60296', 'IEC 62770', 'IEC 61099'],
    technical_range: 'Inhibited mineral oil, FR3 natural ester, Midel 7131 synthetic ester',
    search_demand: 88,
    rfq_value_weight: 85,
    keywords: ['mineral oil', 'ester', 'fr3', 'midel', 'natural ester', 'synthetic ester', 'dielectric fluid']
  },
  {
    id: 'insulation_paper',
    name: 'DDP / DPE Diamond Dotted Paper & Crepe Paper',
    standards: ['IEC 60554', 'IEC 60641'],
    technical_range: '0.05 mm – 0.25 mm thermo-stabilized kraft + epoxy dots',
    search_demand: 72,
    rfq_value_weight: 70,
    keywords: ['diamond dotted paper', 'ddp', 'dpe', 'crepe paper', 'crepe tube', 'insulating paper']
  },
  {
    id: 'laminated_wood',
    name: 'Densified Laminated Wood & Structural Insulation',
    standards: ['IEC 61061', 'DIN 7707'],
    technical_range: 'Density 1.15–1.35 g/cm³, pressure rings, clamping beams, step blocks',
    search_demand: 65,
    rfq_value_weight: 68,
    keywords: ['laminated wood', 'densified wood', 'clamping ring', 'pressure ring', 'insulation block']
  },
  {
    id: 'monitoring_dga',
    name: 'Online DGA, Bushing Monitoring & Transformer Digital Twins',
    standards: ['IEC 60599', 'IEEE C57.104'],
    technical_range: 'Multi-gas photoacoustic / GC DGA, tan delta & capacitance, fiber-optic probes',
    search_demand: 89,
    rfq_value_weight: 82,
    keywords: ['dga', 'dissolved gas', 'online monitoring', 'bushing monitor', 'partial discharge', 'fiber optic temperature']
  },
  {
    id: 'crgo_cores',
    name: 'CRGO Electrical Steel & Slit/Stacked Cores',
    standards: ['IEC 60404-8-7', 'EN 10107'],
    technical_range: 'Domain refined (0.85 W/kg loss), high-permeability, step-lap assembled',
    search_demand: 94,
    rfq_value_weight: 96,
    keywords: ['crgo', 'electrical steel', 'grain oriented', 'transformer core', 'step-lap core']
  },
  {
    id: 'testing_labs',
    name: 'High-Voltage & Short-Circuit Testing Laboratories',
    standards: ['ISO/IEC 17025', 'STL Charter'],
    technical_range: 'Impulse up to 2,400 kV, short-circuit test up to 400 MVA direct / synthetic',
    search_demand: 82,
    rfq_value_weight: 80,
    keywords: ['testing laboratory', 'short circuit test', 'impulse test', 'type test', 'stl member lab']
  },
  {
    id: 'machinery',
    name: 'Transformer Manufacturing Machinery & Winding Equipment',
    standards: ['CE / ISO 9001'],
    technical_range: 'Horizontal/vertical winding machines, core cut-to-length lines, vacuum drying ovens',
    search_demand: 75,
    rfq_value_weight: 78,
    keywords: ['winding machine', 'cut to length', 'slitting line', 'vacuum drying', 'vpd plant']
  }
];

// Audit suppliers per category
const saturationReport = [];

CATEGORIES.forEach(cat => {
  const suppliersFound = [];
  const countries = new Set();
  let mfgCount = 0;
  let procCount = 0;
  let distCount = 0;
  let tierACount = 0;
  let totalFacilities = 0;

  // Scan accessories
  (accessoriesDoc.suppliers || []).forEach(s => {
    const text = (s.name + ' ' + (s.categories||[]).join(' ') + ' ' + (s.description||'')).toLowerCase();
    const isMatch = cat.keywords.some(k => text.includes(k));
    if (isMatch) {
      suppliersFound.push(s);
      if (s.country) countries.add(s.country);
      const role = String(s.role || s.manufacturer_role || '').toUpperCase();
      if (role.includes('MANUFACTURER') || role === 'CONFIRMED MANUFACTURER') mfgCount++;
      else if (role.includes('PROCESSOR') || role.includes('CONVERTER')) procCount++;
      else if (role.includes('DISTRIBUTOR') || role.includes('STOCKIST')) distCount++;
      else mfgCount++; // default OEM

      if (s.source_tier === 'TIER A' || s.verification_status === 'Verified') tierACount++;
      totalFacilities += (s.facilities && s.facilities.length) || 1;
    }
  });

  // Also scan companies if related (e.g. CRGO, testing labs, machinery)
  if (cat.id === 'testing_labs') {
    (labsDoc.laboratories || []).forEach(l => {
      suppliersFound.push(l);
      if (l.country) countries.add(l.country);
      tierACount++;
      mfgCount++;
      totalFacilities += 1;
    });
  } else if (cat.id === 'machinery') {
    (machineryDoc.machinery || []).forEach(m => {
      suppliersFound.push(m);
      if (m.country) countries.add(m.country);
      tierACount++;
      mfgCount++;
      totalFacilities += 1;
    });
  }

  const totalSuppliers = suppliersFound.length;
  const tierACoverage = totalSuppliers ? Math.round((tierACount / totalSuppliers) * 100) : 0;
  
  // Calculate Saturation Tier
  let saturationTier = 'LOW';
  if (mfgCount >= 18 && countries.size >= 8 && tierACoverage >= 75) saturationTier = 'HIGH';
  else if (mfgCount >= 8 && countries.size >= 4) saturationTier = 'MEDIUM';

  // Data weakness factor (0.1 to 1.0)
  const dataWeakness = saturationTier === 'LOW' ? 1.0 : (saturationTier === 'MEDIUM' ? 0.55 : 0.2);
  const stalenessFactor = 0.85; // baseline

  // Priority Score = Search Demand * RFQ Value * Weakness * Staleness
  const priorityScore = Math.round((cat.search_demand * cat.rfq_value_weight * dataWeakness * stalenessFactor) / 100);

  saturationReport.push({
    category_id: cat.id,
    category_name: cat.name,
    standards: cat.standards,
    technical_range: cat.thickness_range || cat.voltage_range || cat.technical_range,
    metrics: {
      confirmed_manufacturers: mfgCount,
      processors_converters: procCount,
      distributors_stockists: distCount,
      total_suppliers: totalSuppliers,
      total_facilities: totalFacilities,
      countries_count: countries.size,
      countries: Array.from(countries),
      tier_a_coverage_pct: tierACoverage,
      saturation_tier: saturationTier
    },
    research_priority: {
      score: priorityScore,
      search_demand_index: cat.search_demand,
      rfq_value_weight: cat.rfq_value_weight,
      weakness_factor: dataWeakness
    }
  });
});

// Sort by research priority
saturationReport.sort((a, b) => b.research_priority.score - a.research_priority.score);

const output = {
  generated_at: new Date().toISOString(),
  audit_date: '2026-09-15',
  total_categories_audited: saturationReport.length,
  top_research_priorities: saturationReport.slice(0, 5).map((c, i) => ({
    rank: i + 1,
    category: c.category_name,
    priority_score: c.research_priority.score,
    saturation: c.metrics.saturation_tier,
    manufacturers_logged: c.metrics.confirmed_manufacturers,
    countries_covered: c.metrics.countries_count,
    action_brief: `Expand ${c.category_name} supplier census across East Asia, Europe, and North America.`
  })),
  categories: saturationReport
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/category-saturation.json', JSON.stringify(output, null, 2));

console.log('✅ Generated data/category-saturation.json: 12 verticals audited.');
console.log('🏆 Top 5 Research Priorities Today:');
output.top_research_priorities.forEach(p => {
  console.log(`   ${p.rank}. ${p.category} (Priority Score: ${p.priority_score}, Saturation: ${p.saturation})`);
});
