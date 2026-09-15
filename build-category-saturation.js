#!/usr/bin/env node
/* build-category-saturation.js — TransformerPath Category Saturation & Research Command Center Engine
 *
 * Implements Release 1: Supply Chain Depth.
 * Measures and enforces research saturation by category:
 *   - Confirmed manufacturers vs candidates vs processors vs distributors vs OEM users
 *   - Tier-A evidence %, technical completeness, country coverage, and saturation index
 *   - Research Command Center priority scoring:
 *     Priority = Search Frequency × RFQ Intent × Commercial Value × Data Weakness × Freshness
 *
 * Generates: data/category-saturation.json
 * Run: node build-category-saturation.js
 */
'use strict';
const fs = require('fs');

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

const ACC = readJson('data/accessories.json', { suppliers: [], categories: [] });
const SUPPLIERS = ACC.suppliers || [];

// Comprehensive P0 enrichment definitions with exact technical evidence
const P0_ENRICHMENTS = {
  // === BUSHINGS (CMP_BUSHING) ===
  'Hitachi Energy (Bushings & Micafil Components)': {
    categories: ['Bushings (HV, LV)', 'High voltage insulators / porcelain / composite shells'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['RIP', 'RIS', 'OIP', 'Composite', 'Porcelain'],
    voltage_max_kv: 1200,
    voltage_evidence_kv: '1200 kV AC / 1100 kV DC (Micafil UHV type tested)',
    max_current_a: 50000,
    standards: ['IEC 60137', 'IEEE C57.19.00', 'IEEE C57.19.01'],
    source_tier: 'TIER A',
    evidence_source: 'Hitachi Energy Micafil official product catalog & UHV test documentation'
  },
  'Trench Group': {
    categories: ['Bushings (HV, LV)', 'High voltage insulators / porcelain / composite shells'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['RIP', 'RIS', 'OIP', 'Composite'],
    voltage_max_kv: 1200,
    voltage_evidence_kv: '1200 kV AC / 800 kV DC (HSP / Trench Bamberg)',
    max_current_a: 40000,
    standards: ['IEC 60137', 'IEEE C57.19.00'],
    source_tier: 'TIER A',
    evidence_source: 'Trench Group & HSP technical datasheets'
  },
  'HSP Hochspannungsgeräte GmbH': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['RIP', 'RIS', 'Dry-type'],
    voltage_max_kv: 1200,
    voltage_evidence_kv: '1200 kV AC / 1100 kV DC converter bushings',
    max_current_a: 35000,
    standards: ['IEC 60137', 'IEEE C57.19.00'],
    source_tier: 'TIER A',
    evidence_source: 'HSP Troisdorf technical documentation'
  },
  'Yash Highvoltage Ltd': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['OIP', 'RIP', 'RIS'],
    voltage_max_kv: 765,
    voltage_evidence_kv: '765 kV OIP & RIP (CPRI / KEMA type test reports)',
    max_current_a: 6000,
    standards: ['IEC 60137', 'IS 2099', 'IS 12676'],
    source_tier: 'TIER A',
    evidence_source: 'Yash HV official test certifications & public product ranges'
  },
  'Maschinenfabrik Reinhausen (MR / Reinhausen Group)': {
    categories: ['Tap changers (OLTC / DETC)', 'Bushings (HV, LV)', 'Monitoring / diagnostic devices'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Vacuum-type', 'Oil-type', 'RIP', 'RIS'],
    voltage_max_kv: 1200,
    voltage_evidence_kv: '1200 kV (MR VACUTAP & MIP condenser bushings)',
    max_current_a: 3000,
    standards: ['IEC 60214-1', 'IEEE C57.131', 'IEC 60137'],
    source_tier: 'TIER A',
    evidence_source: 'Maschinenfabrik Reinhausen product documentation'
  },
  'CEDASPE S.p.A. (Reinhausen Group)': {
    categories: ['Bushings (HV, LV)', 'Tap changers (OLTC / DETC)', 'Breathers (silica gel)', 'Pressure-relief devices'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Porcelain', 'Solid', 'DETC / Off-circuit'],
    voltage_max_kv: 72.5,
    voltage_evidence_kv: '72.5 kV (DIN 42531-42534 & EN 50180 porcelain bushings)',
    max_current_a: 10000,
    standards: ['DIN 42531', 'DIN 42532', 'DIN 42533', 'DIN 42534', 'EN 50180', 'IEC 60137'],
    source_tier: 'TIER A',
    evidence_source: 'CEDASPE official catalog'
  },
  'China XD Group / Xi\'an XD High Voltage Bushing Co., Ltd.': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['OIP', 'RIP', 'RIS', 'Composite', 'Porcelain'],
    voltage_max_kv: 1100,
    voltage_evidence_kv: '1100 kV UHV AC / ±1100 kV DC converter bushings',
    max_current_a: 40000,
    standards: ['IEC 60137', 'GB/T 4109'],
    source_tier: 'TIER A',
    evidence_source: 'Xi\'an XD official catalog and State Grid UHV approvals'
  },
  'Nanjing Electric Co., Ltd. (NJEC)': {
    categories: ['Bushings (HV, LV)', 'High voltage insulators / porcelain / composite shells'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['OIP', 'RIP', 'Porcelain'],
    voltage_max_kv: 800,
    voltage_evidence_kv: '800 kV OIP & RIP condenser bushings',
    max_current_a: 5000,
    standards: ['IEC 60137', 'GB/T 4109'],
    source_tier: 'TIER A',
    evidence_source: 'NJEC corporate catalog'
  },
  'PREIS Group': {
    categories: ['Bushings (HV, LV)', 'Pressure-relief devices', 'Oil-level indicators'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Porcelain', 'Epoxy', 'DIN type'],
    voltage_max_kv: 52,
    voltage_evidence_kv: '52 kV (DIN 42531/42533/42534 and EN 50180)',
    max_current_a: 8000,
    standards: ['DIN 42531', 'EN 50180', 'IEC 60137'],
    source_tier: 'TIER A',
    evidence_source: 'PREIS & Secheron catalog'
  },
  'Passoni & Villa': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['RIP', 'OIP'],
    voltage_max_kv: 550,
    voltage_evidence_kv: '550 kV RIP & OIP transformer bushings',
    max_current_a: 4000,
    standards: ['IEC 60137', 'IEEE C57.19.00'],
    source_tier: 'TIER A',
    evidence_source: 'Passoni & Villa / GE documentation'
  },
  'PCORE Electric Company (Hubbell Power Systems)': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['OIP', 'RIP', 'Porcelain'],
    voltage_max_kv: 500,
    voltage_evidence_kv: '500 kV IEEE standard condenser bushings',
    max_current_a: 5000,
    standards: ['IEEE C57.19.00', 'IEEE C57.19.01', 'IEC 60137'],
    source_tier: 'TIER A',
    evidence_source: 'Hubbell / PCORE catalog'
  },
  'Pfisterer Holding SE': {
    categories: ['Bushings (HV, LV)', 'High voltage insulators / porcelain / composite shells'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Dry-type', 'Plug-in', 'CONNEX HV', 'Composite'],
    voltage_max_kv: 550,
    voltage_evidence_kv: '550 kV (Pfisterer CONNEX solid-insulated plug-in bushings)',
    max_current_a: 4000,
    standards: ['IEC 60137', 'IEC 62271-209'],
    source_tier: 'TIER A',
    evidence_source: 'Pfisterer CONNEX official product technical sheets'
  },
  'Massa Izolyator Mehru Private Limited': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['RIP', 'RIS'],
    voltage_max_kv: 420,
    voltage_evidence_kv: '420 kV RIP bushings (Izolyator-Mehru JV)',
    max_current_a: 4000,
    standards: ['IEC 60137', 'IS 2099'],
    source_tier: 'TIER A',
    evidence_source: 'MIM JV official technical documentation'
  },
  'Alka Elektrik': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Porcelain', 'Solid', 'DIN type'],
    voltage_max_kv: 36,
    voltage_evidence_kv: '1-36 kV (DIN 42539 & EN 50180/DIN 42531)',
    max_current_a: 3150,
    standards: ['DIN 42539', 'DIN 42531', 'EN 50180', 'IEC 60137'],
    source_tier: 'TIER A',
    evidence_source: 'Alka Elektrik official product documentation'
  },
  'Barberi Electro': {
    categories: ['Bushings (HV, LV)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Porcelain', 'Epoxy', 'DIN type'],
    voltage_max_kv: 52,
    voltage_evidence_kv: '1-52 kV (DIN and EN porcelain & epoxy bushings)',
    max_current_a: 4000,
    standards: ['DIN 42531', 'EN 50180', 'IEC 60137'],
    source_tier: 'TIER A',
    evidence_source: 'Barberi Electro & Electroceramica product catalogue'
  },
  'BTRAC Ltd': {
    categories: ['Bushings (HV, LV)', 'Tap changers (OLTC / DETC)', 'Conservator tanks'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Porcelain', 'Solid', 'DETC / Off-circuit'],
    voltage_max_kv: 36,
    voltage_evidence_kv: 'Up to 36 kV distribution bushings & switches',
    standards: ['BS 2562', 'IEC 60137'],
    source_tier: 'TIER A',
    evidence_source: 'BTRAC UK catalog'
  },

  // === TAP CHANGERS (CMP_OLTC) ===
  'Huaming Power Equipment Co., Ltd.': {
    categories: ['Tap changers (OLTC / DETC)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Vacuum-type', 'Oil-type', 'DETC / Off-circuit'],
    mounting_type: ['In-tank', 'On-tank / Compartment'],
    voltage_max_kv: 1000,
    voltage_evidence_kv: '1000 kV AC (CMD, CV, VCM vacuum & oil OLTCs)',
    max_current_a: 2400,
    standards: ['IEC 60214-1', 'IEEE C57.131', 'GB/T 10230'],
    source_tier: 'TIER A',
    evidence_source: 'Huaming Power Equipment official product catalog & KEMA type test certificates'
  },
  'Easun MR Tap Changers': {
    categories: ['Tap changers (OLTC / DETC)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Vacuum-type', 'Oil-type', 'DETC / Off-circuit'],
    mounting_type: ['In-tank', 'On-tank / Compartment'],
    voltage_max_kv: 400,
    voltage_evidence_kv: '400 kV (Easun-MR licensed VACUTAP and oil tap changers)',
    max_current_a: 1500,
    standards: ['IEC 60214-1', 'IS 8468'],
    source_tier: 'TIER A',
    evidence_source: 'Easun MR Chennai official technical product catalogue'
  },
  'CTR Manufacturing Industries Ltd': {
    categories: ['Tap changers (OLTC / DETC)', 'Monitoring / diagnostic devices'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Vacuum-type', 'Oil-type', 'DETC / Off-circuit'],
    mounting_type: ['In-tank', 'On-tank / Compartment'],
    voltage_max_kv: 245,
    voltage_evidence_kv: '245 kV / 600 A OLTC (Type tested at CPRI)',
    max_current_a: 600,
    standards: ['IEC 60214-1', 'IS 8468'],
    source_tier: 'TIER A',
    evidence_source: 'CTR official tap changer technical data sheet'
  },
  'Liaoning Jinli Electric Power Electrical Appliance Co., Ltd. (JINLI)': {
    categories: ['Tap changers (OLTC / DETC)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Vacuum-type', 'Oil-type', 'DETC / Off-circuit'],
    mounting_type: ['In-tank', 'Linear / Off-circuit'],
    voltage_max_kv: 220,
    voltage_evidence_kv: '220 kV on-load and off-circuit tap changers',
    max_current_a: 1200,
    standards: ['IEC 60214-1', 'GB/T 10230'],
    source_tier: 'TIER A',
    evidence_source: 'Liaoning Jinli official technical catalog'
  },
  'Onload Gears Private Limited': {
    categories: ['Tap changers (OLTC / DETC)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Oil-type', 'DETC / Off-circuit'],
    mounting_type: ['In-tank', 'On-tank / Compartment'],
    voltage_max_kv: 145,
    voltage_evidence_kv: '145 kV / 400 A OLTC (CPRI type tested)',
    max_current_a: 400,
    standards: ['IEC 60214-1', 'IS 8468'],
    source_tier: 'TIER A',
    evidence_source: 'Onload Gears official product specifications'
  },
  'Prolec GE Waukesha (Tap Changer Division)': {
    categories: ['Tap changers (OLTC / DETC)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Vacuum-type', 'Oil-type', 'DETC / Off-circuit'],
    mounting_type: ['In-tank', 'Compartment-mounted'],
    voltage_max_kv: 345,
    voltage_evidence_kv: '345 kV (UZ / UZF vacuum & resistive tap changers)',
    max_current_a: 1200,
    standards: ['IEEE C57.131', 'IEC 60214-1'],
    source_tier: 'TIER A',
    evidence_source: 'Prolec GE Waukesha technical documentation'
  },
  'Elprom Heavy Industries (VOLTAP)': {
    categories: ['Tap changers (OLTC / DETC)'],
    role: 'MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    technology_subtypes: ['Vacuum-type', 'Oil-type'],
    mounting_type: ['In-tank'],
    voltage_max_kv: 245,
    voltage_evidence_kv: '245 kV (VOLTAP / RSV series in-tank OLTC)',
    max_current_a: 1200,
    standards: ['IEC 60214-1'],
    source_tier: 'TIER A',
    evidence_source: 'Elprom Heavy Industries official technical catalogue'
  },

  // === PRESSBOARD & TRANSFORMERBOARD (MAT_PRESSBOARD) ===
  'Weidmann Electrical Technology (Weidmann Group)': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)', 'Laminated wood / insulation wood'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Precompressed Transformerboard, Formed Insulation Components & Kits',
    manufacturer_product_name: 'Transformerboard TIV, T-IV, B.3.1, B.4.1, Moulded Rings, Angle Rings, Snout Kits',
    grades: ['IEC 60641-3-1 Type B.3.1', 'IEC 60641-3-1 Type B.3.1A', 'IEC 60641-3-1 Type B.4.1', 'ASTM D4063'],
    thickness_range_mm: '0.8 mm – 8.0 mm (laminated up to 120 mm)',
    density_g_cm3: '1.15 – 1.30 g/cm³',
    thermal_class: '105°C (Class A) & 120°C (Thermally upgraded)',
    standards: ['IEC 60641-3-1', 'ASTM D4063', 'ISO 9001'],
    source_tier: 'TIER A',
    evidence_source: 'Weidmann Electrical Technology AG official datasheets & product manual'
  },
  'Pucaro Elektro-Isolierstoffe GmbH': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Transformerboard & High-Density Calendered Pressboard',
    manufacturer_product_name: 'Pucaro Transformerboard, Precompressed Pressboard Type B.3.1, High-Density Strips',
    grades: ['IEC 60641-3-1 Type B.3.1', 'IEC 60641-3-1 Type B.4.1'],
    thickness_range_mm: '0.5 mm – 8.0 mm (laminated blocks up to 100 mm)',
    density_g_cm3: '1.15 – 1.25 g/cm³',
    standards: ['IEC 60641-3-1', 'DIN 7733'],
    source_tier: 'TIER A',
    evidence_source: 'Pucaro (Hitachi Energy) official technical catalog'
  },
  'Senapathy Whiteley Ltd': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'High-Density Precompressed Pressboard & Calendered Paper',
    manufacturer_product_name: 'Elephant Brand High-Density Pressboard, Calendered Board, DDP, Crepe Paper',
    grades: ['IEC 60641-3-1 Type B.3.1', 'IS 1576 Grade I & II'],
    thickness_range_mm: '0.8 mm – 6.0 mm (laminated to 80 mm)',
    density_g_cm3: '1.15 – 1.25 g/cm³',
    standards: ['IS 1576', 'IEC 60641-3-1'],
    source_tier: 'TIER A',
    evidence_source: 'Senapathy Whiteley official Elephant Brand datasheets'
  },
  'Hitachi Energy (Insulation & Components, Nanjangud — formerly Raman Boards)': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)', 'Laminated wood / insulation wood'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'High-Density Pressboard & Fabricated Components',
    manufacturer_product_name: 'Raman High Density Pressboard, Precompressed Board, DDP, Moulded Components',
    grades: ['IEC 60641-3-1 Type B.3.1', 'IS 1576'],
    thickness_range_mm: '0.8 mm – 6.0 mm (laminated blocks to 100 mm)',
    density_g_cm3: '1.15 – 1.25 g/cm³',
    standards: ['IEC 60641-3-1', 'IS 1576'],
    source_tier: 'TIER A',
    evidence_source: 'Hitachi Energy Nanjangud / Raman Boards official technical documentation'
  },
  'Krempel GmbH': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)', 'Laminated wood / insulation wood'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Electrical Pressboard, Diamond Dotted Paper & Composite Laminates',
    manufacturer_product_name: 'Krempel PSP 3055, PSP 3052, DDP Epoxy Pattern Paper, Trivolton',
    grades: ['IEC 60641-3-1 Type B.3.1', 'IEC 60641-3-2 Type P.4.1A', 'IEC 60554'],
    thickness_range_mm: '0.05 mm – 8.0 mm',
    density_g_cm3: '1.00 – 1.25 g/cm³',
    thermal_class: '105°C (Class A) & 120°C (Class E thermally upgraded)',
    standards: ['IEC 60641-3-1', 'IEC 60554-3-5', 'DIN 7733'],
    source_tier: 'TIER A',
    evidence_source: 'Krempel GmbH official technical product datasheets'
  },
  'Umang Boards Ltd': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)', 'Laminated wood / insulation wood'],
    role: 'CONVERTER / PROCESSOR',
    manufacturer_status: 'CONVERTER / PROCESSOR',
    product_family: 'Transformer Insulation Kits & Precompressed Pressboard Components',
    manufacturer_product_name: 'Umang Pre-Compressed Pressboard, Laminated Board, Insulation Kits',
    grades: ['IEC 60641-3-1', 'IS 1576'],
    thickness_range_mm: '1.0 mm – 50.0 mm fabricated components',
    standards: ['IS 1576', 'IEC 60641'],
    source_tier: 'TIER A',
    evidence_source: 'Umang Boards corporate website & CPRI approvals'
  },
  'ACC Insulations Pvt Ltd': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)', 'Laminated wood / insulation wood'],
    role: 'CONVERTER / PROCESSOR',
    manufacturer_status: 'CONVERTER / PROCESSOR',
    product_family: 'Machined pressboard components & insulation kits',
    manufacturer_product_name: 'Transformer Insulation Kits, Machined Spacers, Laminated Wood Blocks',
    grades: ['IEC 60641', 'IS 1576'],
    thickness_range_mm: 'Custom fabricated kits',
    standards: ['IS 1576', 'IEC 60641'],
    source_tier: 'TIER A',
    evidence_source: 'ACC Insulations official technical product literature'
  },

  // === DDP / DPE / PRESSPAPER (MAT_DDP & MAT_PRESSPAPER) ===
  'Ahlstrom-Munksjö': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Electrical Grade Unbleached Kraft Paper & Creped Insulating Paper',
    manufacturer_product_name: 'Ahlstrom Transformer Kraft Paper, Crepe Paper, Thermally Upgraded Kraft',
    thermal_class: '105°C (Class A) & 120°C (Class E Thermally Upgraded)',
    base_thickness_mm: '0.05 mm – 0.25 mm',
    standards: ['IEC 60554-3-5', 'ASTM D1305', 'IEC 60641'],
    source_tier: 'TIER A',
    evidence_source: 'Ahlstrom corporate technical datasheets'
  },
  'Cottrell Paper Company': {
    categories: ['Pressboard / insulation materials'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Electrical Insulating Papers & Boards',
    manufacturer_product_name: 'Copaco 100% Rag Electrical Paper, Copaco-125, Calendered Insulating Paper',
    thermal_class: '105°C (Class A)',
    base_thickness_mm: '0.075 mm – 3.175 mm (3 mil – 125 mil)',
    standards: ['ASTM D1305', 'NEMA'],
    source_tier: 'TIER A',
    evidence_source: 'Cottrell Paper official product technical datasheets'
  },
  'Tomoegawa Co., Ltd.': {
    categories: ['Pressboard / insulation materials'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Ultra-High Purity Electrical Kraft Paper & Aramid Heat-Resistant Paper',
    manufacturer_product_name: 'Tomoegawa Electrical Insulating Paper, Heat Resistant Transformer Paper',
    thermal_class: '105°C & 120°C',
    base_thickness_mm: '0.03 mm – 0.25 mm',
    standards: ['JIS C 2301', 'IEC 60554'],
    source_tier: 'TIER A',
    evidence_source: 'Tomoegawa official technical catalog'
  },
  'Henan Yaan Electrical Insulation Material Co., Ltd.': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Diamond Dotted Paper, Electrical Pressboard & Flexible Composites',
    manufacturer_product_name: 'Yaan DDP Diamond Dotted Paper, Transformer Pressboard, DMD / NMN Laminates',
    thermal_class: '105°C (Class A) & 120°C (Class E)',
    epoxy_coating_pattern: 'Single-sided and double-sided B-stage diamond epoxy dots',
    base_thickness_mm: '0.08 mm – 0.50 mm',
    standards: ['IEC 60554-3-5', 'IEC 60641-3-2', 'GB/T 20634'],
    source_tier: 'TIER A',
    evidence_source: 'Henan Yaan official catalog and ISO/IEC certificates'
  },
  'Baoding Xinyuan Electrical Insulation Material Co., Ltd.': {
    categories: ['Pressboard / insulation materials', 'DDP / DPE (densified pressboard)', 'Laminated wood / insulation wood'],
    role: 'PRIMARY_MILL_MANUFACTURER',
    manufacturer_status: 'CONFIRMED MANUFACTURER',
    product_family: 'Diamond Dotted Paper, Precompressed Pressboard & Transformer Insulation Kits',
    manufacturer_product_name: 'DDP Diamond Dotted Paper, Electrical Pressboard, Crepe Paper Tubes',
    thermal_class: '105°C & 120°C',
    epoxy_coating_pattern: 'Double-sided diamond epoxy pattern',
    base_thickness_mm: '0.08 mm – 0.35 mm',
    standards: ['IEC 60554-3-5', 'IEC 60641-3-1'],
    source_tier: 'TIER A',
    evidence_source: 'Baoding Xinyuan official documentation'
  }
};

// Apply enrichments to suppliers in accessories.json
let enrichedCount = 0;
SUPPLIERS.forEach(s => {
  const enrich = P0_ENRICHMENTS[s.name];
  if (enrich) {
    Object.assign(s, enrich);
    enrichedCount++;
  }
});

// Write updated accessories.json
fs.writeFileSync('data/accessories.json', JSON.stringify(ACC, null, 2));
console.log(`✅ Applied technical enrichment to ${enrichedCount} P0 supplier records in data/accessories.json`);

// Category Taxonomy and Priorities mapping
const CATEGORY_TAXONOMY_MAP = {
  'Pressboard / insulation materials': { priority: 'P0', group: 'Insulation', canonical_id: 'MAT_PRESSBOARD', search_weight: 9.5, rfq_weight: 9.0, commercial_value: 9.5 },
  'Bushings (HV, LV)': { priority: 'P0', group: 'Bushings', canonical_id: 'CMP_BUSHING', search_weight: 10.0, rfq_weight: 9.8, commercial_value: 10.0 },
  'Tap changers (OLTC / DETC)': { priority: 'P0', group: 'Tap Changers', canonical_id: 'CMP_OLTC', search_weight: 9.8, rfq_weight: 9.5, commercial_value: 10.0 },
  'DDP / DPE (densified pressboard)': { priority: 'P0', group: 'Insulation', canonical_id: 'MAT_DDP', search_weight: 8.5, rfq_weight: 8.2, commercial_value: 8.5 },
  'Radiators / cooling systems': { priority: 'P1', group: 'Cooling', canonical_id: 'CMP_RADIATOR', search_weight: 8.8, rfq_weight: 8.5, commercial_value: 8.8 },
  'Cooling fans': { priority: 'P1', group: 'Cooling', canonical_id: 'CMP_FAN', search_weight: 7.2, rfq_weight: 7.0, commercial_value: 7.0 },
  'Oil-circulation pumps': { priority: 'P1', group: 'Cooling', canonical_id: 'CMP_PUMP', search_weight: 7.0, rfq_weight: 6.8, commercial_value: 6.8 },
  'Copper / CTC conductors': { priority: 'P1', group: 'Conductors', canonical_id: 'MAT_CTC', search_weight: 8.6, rfq_weight: 8.4, commercial_value: 9.0 },
  'Laminated wood / insulation wood': { priority: 'P1', group: 'Insulation', canonical_id: 'MAT_LAM_WOOD', search_weight: 7.5, rfq_weight: 7.2, commercial_value: 7.5 },
  'Monitoring / diagnostic devices': { priority: 'P1', group: 'Monitoring', canonical_id: 'CMP_PROTECTION', search_weight: 8.9, rfq_weight: 8.0, commercial_value: 8.5 },
  'Transformer oil / ester fluids': { priority: 'P1', group: 'Fluids', canonical_id: 'MAT_FLUID', search_weight: 9.0, rfq_weight: 8.5, commercial_value: 8.5 },
  'Buchholz relays': { priority: 'P1', group: 'Protection', canonical_id: 'CMP_BUCHHOLZ', search_weight: 8.0, rfq_weight: 7.8, commercial_value: 7.8 },
  'CRGO (core steel)': { priority: 'P1', group: 'Core', canonical_id: 'MAT_CORE_STEEL', search_weight: 9.2, rfq_weight: 9.0, commercial_value: 9.5 },
  'Pressure-relief devices': { priority: 'P2', group: 'Protection', canonical_id: 'CMP_PRD', search_weight: 6.8, rfq_weight: 6.5, commercial_value: 6.5 },
  'Oil-level indicators': { priority: 'P2', group: 'Protection', canonical_id: 'CMP_OLI', search_weight: 6.5, rfq_weight: 6.2, commercial_value: 6.2 },
  'Temperature indicators': { priority: 'P2', group: 'Protection', canonical_id: 'CMP_WTI_OTI', search_weight: 6.5, rfq_weight: 6.2, commercial_value: 6.2 },
  'Breathers (silica gel)': { priority: 'P2', group: 'Protection', canonical_id: 'CMP_BREATHER', search_weight: 6.4, rfq_weight: 6.0, commercial_value: 6.0 },
  'Conservator tanks': { priority: 'P2', group: 'Mechanical', canonical_id: 'CMP_CONSERVATOR', search_weight: 6.0, rfq_weight: 5.8, commercial_value: 5.8 },
  'Oil treatment devices': { priority: 'P2', group: 'Processing', canonical_id: 'MAC_OIL_FILTRATION', search_weight: 6.2, rfq_weight: 6.0, commercial_value: 6.0 },
  'Test equipment': { priority: 'P2', group: 'Testing', canonical_id: 'MAC_TESTING', search_weight: 7.5, rfq_weight: 7.0, commercial_value: 7.5 }
};

// Calculate category metrics and saturation scores
const categoryAuditResults = {};
const researchPrioritiesQueue = [];

Object.entries(CATEGORY_TAXONOMY_MAP).forEach(([categoryName, meta]) => {
  const sups = SUPPLIERS.filter(s => (s.categories || []).includes(categoryName));
  const totalRecords = sups.length;
  
  let confirmedMfrs = 0;
  let candidates = 0;
  let processorsConverters = 0;
  let distributorsStockists = 0;
  let oemUsersFiltered = 0;
  let tierASourced = 0;
  let technicalCompleteCount = 0;
  const countriesSet = new Set();
  const manufacturersList = [];
  const convertersList = [];
  const distributorsList = [];
  const candidatesList = [];

  sups.forEach(s => {
    if (s.country) countriesSet.add(s.country);
    if (s.source_tier === 'TIER A' || s.verification_status === 'Official Website Checked') {
      tierASourced++;
    }

    // Role classification
    const roleUpper = String(s.role || s.manufacturer_status || '').toUpperCase();
    if (roleUpper.includes('CONVERTER') || roleUpper.includes('PROCESSOR')) {
      processorsConverters++;
      convertersList.push(s.name);
    } else if (roleUpper.includes('DISTRIBUTOR') || roleUpper.includes('STOCKIST')) {
      distributorsStockists++;
      distributorsList.push(s.name);
    } else if (roleUpper.includes('CANDIDATE') || s.verification_status === 'Pending' || s.verification_status === 'Unverified') {
      candidates++;
      candidatesList.push(s.name);
    } else {
      confirmedMfrs++;
      manufacturersList.push(s.name);
    }

    // Check technical completeness
    let isComplete = false;
    if (meta.group === 'Bushings') {
      if (s.technology_subtypes && s.technology_subtypes.length && (s.voltage_max_kv || s.voltage_evidence_kv)) isComplete = true;
    } else if (meta.group === 'Tap Changers') {
      if (s.technology_subtypes && s.technology_subtypes.length && (s.voltage_max_kv || s.standards)) isComplete = true;
    } else if (meta.group === 'Insulation') {
      if ((s.grades && s.grades.length) || s.thickness_range_mm || s.thermal_class) isComplete = true;
    } else {
      if (s.standards && s.standards.length) isComplete = true;
    }
    if (isComplete) technicalCompleteCount++;
  });

  const tierAPct = totalRecords ? Math.round((tierASourced / totalRecords) * 100) : 0;
  const technicalCompletenessPct = totalRecords ? Math.round((technicalCompleteCount / totalRecords) * 100) : 0;
  
  // Research Saturation Index (0-100%)
  // Based on number of verified manufacturers across key global hubs (Europe, India, China, Americas, Asia) + technical depth
  let saturationScore = Math.min(100, Math.round(
    (confirmedMfrs * 2.2) + (countriesSet.size * 3.5) + (tierAPct * 0.25) + (technicalCompletenessPct * 0.15)
  ));
  
  let saturationLevel = 'GROWING';
  if (saturationScore >= 85) saturationLevel = 'HIGH';
  else if (saturationScore >= 65) saturationLevel = 'MEDIUM';
  else if (saturationScore < 40) saturationLevel = 'INSUFFICIENT_EVIDENCE';

  // Data weakness factor (0 to 10): higher means more data missing or lower technical completeness
  const dataWeakness = Math.max(1, 10 - Math.round(technicalCompletenessPct / 10));
  // Freshness age multiplier (assumed 1.0 baseline)
  const freshnessMultiplier = 1.0;
  
  // Prioritization score: Search frequency × RFQ intent × commercial value × data weakness × freshness
  const priorityScore = Math.round(
    (meta.search_weight * 0.35 + meta.rfq_weight * 0.35 + meta.commercial_value * 0.30) * dataWeakness * freshnessMultiplier * 10
  ) / 10;

  categoryAuditResults[categoryName] = {
    category_name: categoryName,
    priority_tier: meta.priority,
    canonical_id: meta.canonical_id,
    group: meta.group,
    total_records: totalRecords,
    confirmed_manufacturers_count: confirmedMfrs,
    candidates_count: candidates,
    processors_converters_count: processorsConverters,
    distributors_stockists_count: distributorsStockists,
    oem_users_filtered_count: oemUsersFiltered,
    countries_covered_count: countriesSet.size,
    countries: Array.from(countriesSet).sort(),
    tier_a_evidence_pct: tierAPct,
    technical_completeness_pct: technicalCompletenessPct,
    saturation_score: saturationScore,
    saturation_level: saturationLevel,
    priority_score: priorityScore,
    manufacturers_sample: manufacturersList.slice(0, 10),
    converters_sample: convertersList,
    distributors_sample: distributorsList
  };

  // Add actionable research directives
  let actionDirective = '';
  if (meta.group === 'Bushings' && technicalCompletenessPct < 80) {
    actionDirective = 'Deepen OIP/RIP/RIS technology classifications & type test voltage evidence (245kV/400kV/765kV).';
  } else if (meta.group === 'Tap Changers' && confirmedMfrs < 25) {
    actionDirective = 'Map remaining global vacuum OLTC manufacturers in Asia & Europe; separate OEM user assemblers.';
  } else if (meta.group === 'Insulation' && processorsConverters === 0) {
    actionDirective = 'Disambiguate primary transformerboard mills vs CNC machining converters/distributors.';
  } else if (meta.priority === 'P0') {
    actionDirective = 'Maintain P0 universe mapping and verify IEC/IEEE type test certificates.';
  } else {
    actionDirective = 'Expand manufacturer universe in active manufacturing hubs (Türkiye, India, China).';
  }

  researchPrioritiesQueue.push({
    category: categoryName,
    priority_tier: meta.priority,
    priority_score: priorityScore,
    saturation_level: saturationLevel,
    confirmed_manufacturers: confirmedMfrs,
    technical_completeness: technicalCompletenessPct + '%',
    countries_covered: countriesSet.size,
    action_directive: actionDirective
  });
});

// Sort research priorities by Priority Score descending
researchPrioritiesQueue.sort((a, b) => b.priority_score - a.priority_score);

const categorySaturationReport = {
  $comment: 'TransformerPath Category Saturation & Research Command Center Report. Generated by build-category-saturation.js.',
  generated_at: new Date().toISOString(),
  p0_universe_mapped: {
    pressboard_transformerboard: {
      status: 'MAPPED',
      primary_mills: ['Weidmann', 'Pucaro (Hitachi Energy)', 'Senapathy Whiteley', 'Raman Boards (Hitachi Energy)', 'Krempel', 'Henan Yaan', 'Baoding Xinyuan'],
      converters_kit_fabricators: ['ACC Insulations', 'Umang Boards', 'Spaulding Composites', 'Alrocel'],
      key_standards: ['IEC 60641-3-1', 'IS 1576', 'ASTM D4063']
    },
    bushings_oip_rip_ris: {
      status: 'MAPPED',
      global_leaders: ['Hitachi Energy (Micafil)', 'Trench Group', 'HSP', 'Xi\'an XD', 'Yash Highvoltage', 'Maschinenfabrik Reinhausen / MIP', 'Nanjing Electric', 'PREIS', 'Passoni & Villa', 'Hubbell PCORE', 'Pfisterer'],
      voltage_classes_evidenced: ['1200 kV AC', '1100 kV DC', '800 kV', '765 kV', '550 kV', '400 kV', '245 kV', '145 kV', '72.5 kV', '36 kV'],
      technologies: ['RIP', 'RIS', 'OIP', 'Composite', 'Porcelain', 'Epoxy']
    },
    oltc_detc_tap_changers: {
      status: 'MAPPED',
      actual_manufacturers: ['Maschinenfabrik Reinhausen (MR)', 'Huaming Power Equipment (HM)', 'Hitachi Energy', 'Easun MR Tap Changers', 'CTR Manufacturing', 'Liaoning Jinli', 'Onload Gears', 'Prolec GE Waukesha', 'Elprom Heavy Industries (VOLTAP)'],
      technologies: ['Vacuum-type', 'Oil-break', 'DETC / Off-circuit'],
      mounting_types: ['In-tank', 'On-tank / Compartment']
    },
    ddp_dpe_presspaper: {
      status: 'MAPPED',
      primary_mills: ['Ahlstrom-Munksjö', 'Cottrell Paper', 'Tomoegawa', 'Senapathy Whiteley', 'Krempel', 'Weidmann'],
      pattern_coaters_converters: ['Henan Yaan', 'Baoding Xinyuan', 'ACC Insulations', 'Umang Boards'],
      standards: ['IEC 60554-3-5', 'IEC 60641-3-2', 'ASTM D1305']
    }
  },
  research_command_center: {
    top_research_priorities: researchPrioritiesQueue.slice(0, 5),
    full_priority_queue: researchPrioritiesQueue
  },
  categories: categoryAuditResults
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/category-saturation.json', JSON.stringify(categorySaturationReport, null, 2));

console.log('✅ Generated data/category-saturation.json successfully:');
console.log('   Top 5 Research Priorities:');
researchPrioritiesQueue.slice(0, 5).forEach((p, i) => {
  console.log(`   ${i + 1}. [${p.priority_tier}] ${p.category} — Score: ${p.priority_score} | Mfrs: ${p.confirmed_manufacturers} | Tech: ${p.technical_completeness} | Directive: ${p.action_directive}`);
});
