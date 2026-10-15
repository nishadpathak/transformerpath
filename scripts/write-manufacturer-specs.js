#!/usr/bin/env node
/* Build data/manufacturer-specs.json.
 *
 * The first records are the tier list, matched to canonical slugs. The rest
 * are indexable census profiles by research completeness, then name, until
 * 150. Facts below were read from the linked page on 2026-10-15. A field
 * that is not in this list stays empty.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECKED = '2026-10-15';
const LIMIT = 150;

const TIER_SLUGS = [
  'hitachi-energy',
  'siemens-energy',
  'ge-vernova',
  'schneider-electric',
  'mitsubishi-electric',
  'hd-hyundai-electric',
  'toshiba-energy-systems',
  'tbea-group-changji-hq-shenyang-hengyang-tianjin-plants',
  'cg-power-and-industrial-solutions',
  'elsewedy-electric-transformers',
  'sgb-smit-group',
  'royal-smit-transformers-b-v-sgb-smit-group',
  'efacec',
  'wilson-transformer-company',
  'tmc-transformers',
  'specialtrasfo-spa',
  'hyosung-heavy-industries',
  'hico-technology',
  'china-xd-group-xian-xd-transformer',
  'jiangsu-huapeng-jshp-huapeng-group',
  'transformers-and-rectifiers-india-taril',
  'bhel',
  'prolec-ge',
  'weg',
  'hammond-power-solutions',
  'virginia-transformer-corp',
  'vantran-industries',
  'gangheng-electric',
  'altran-corporation',
  'custom-transformers-ltd',
  'emerald-transformer',
  'foster-transformer-company',
  'jefferson-electric-voltaris',
  'electronetics-llc',
  'bridgeport-magnetics',
  'ctm-magnetics'
];

function cite(url, quote) {
  return { source_url: url, verified: CHECKED, quote: quote };
}

const HITACHI = 'https://www.hitachienergy.com/us/en/products-and-solutions/transformers/power-transformers/generator-step-up-transformers-gsu/core-type-transformers';
const SIEMENS = 'https://www.siemens-energy.com/global/en/home/products-services/product/power-transformers.html';
const HYOSUNG = 'https://www.hyosungheavyindustries.com/en/business/power-products/P010101';
const PROLEC = 'https://www.prolec.energy/transformers/power-transformers/';
const VIRGINIA = 'https://www.vatransformer.com/about-us/';
const WILSON = 'https://www.wtc.com.au/your-requirements/products/power-transformers/';
const EFACEC = 'https://www.efacec.com/business/transformers/';
const TARIL = 'https://www.transformerindia.com/';
const TBEA = 'https://en.tbea.com/';
const HAMMOND = 'https://americas.hammondpowersolutions.com/';
const JSHP = 'https://jshp-usa.com/';
const GE_PARENT = 'https://www.gevernova.com/news/press-releases/ge-vernova-completes-prolec-ge-acquisition';

const FACTS = {
  'hitachi-energy': {
    max_voltage_kv: Object.assign({ value: 1000, unit: 'kV' }, cite(HITACHI, 'Primary voltage: up to 1,000 kV')),
    mva: Object.assign({ min: null, max: 1500, unit: 'MVA', basis: 'unit_rating' }, cite(HITACHI, 'Unit ratings: up to 1,500 MVA')),
    plants: [Object.assign({ label: '12 factories', city: '', country: '' }, cite(HITACHI, '12 factories, one global approach – bringing consistency, delivery performance, and technology'))],
    products: [Object.assign({ code: 'PT' }, cite(HITACHI, 'Core type transformers'))]
  },
  'siemens-energy': {
    max_voltage_kv: Object.assign({ value: 1100, unit: 'kV', scope: 'large power transformer' }, cite(SIEMENS, 'Voltage range | Up to 300 kV | Up to 1,100 kV | ± 1,100 kV')),
    mva: Object.assign({ min: null, max: 1300, unit: 'MVA', basis: 'unit_rating' }, cite(SIEMENS, 'Power rating | Up to 250 MVA | Up to 1,300 MVA | Up to 750 MVA')),
    products: [Object.assign({ code: 'PT' }, cite(SIEMENS, 'Power transformers engineered for reliability, designed for the future'))]
  },
  'hyosung-heavy-industries': {
    max_voltage_kv: Object.assign({ value: 765, unit: 'kV' }, cite(HYOSUNG, 'manufactures a variety of transformers with a maximum voltage of 765 kV and a maximum capacity of 1,500 MVA')),
    mva: Object.assign({ min: null, max: 1500, unit: 'MVA', basis: 'unit_rating' }, cite(HYOSUNG, 'manufactures a variety of transformers with a maximum voltage of 765 kV and a maximum capacity of 1,500 MVA')),
    plants: [Object.assign({ label: 'Changwon Plant', city: 'Changwon', country: 'South Korea' }, cite(HYOSUNG, 'we have manufactured more than 7,500 extra-high-voltage transformers at the Changwon Plant alone'))],
    iso: [
      Object.assign({ standard: 'ISO 9001' }, cite(HYOSUNG, 'ISO9001')),
      Object.assign({ standard: 'ISO 14001' }, cite(HYOSUNG, 'ISO14001')),
      Object.assign({ standard: 'ISO 45001' }, cite(HYOSUNG, 'ISO45001'))
    ],
    products: [Object.assign({ code: 'PT' }, cite(HYOSUNG, 'Power Transformers'))]
  },
  'prolec-ge': {
    max_voltage_kv: Object.assign({ value: 800, unit: 'kV' }, cite(PROLEC, 'Ranging from 5 to 1200 MVA in primary voltage through 800 kV')),
    mva: Object.assign({ min: 5, max: 1200, unit: 'MVA', basis: 'unit_rating' }, cite(PROLEC, 'Ranging from 5 to 1200 MVA in primary voltage through 800 kV')),
    plants: [
      Object.assign({ label: 'Monterrey', city: 'Monterrey', country: 'Mexico' }, cite(PROLEC, 'operating facilities in Monterrey, Mexico, Waukesha, Wisconsin, Goldsboro, North Carolina, and Canoas, Brazil')),
      Object.assign({ label: 'Waukesha', city: 'Waukesha, Wisconsin', country: 'USA' }, cite(PROLEC, 'operating facilities in Monterrey, Mexico, Waukesha, Wisconsin, Goldsboro, North Carolina, and Canoas, Brazil')),
      Object.assign({ label: 'Goldsboro', city: 'Goldsboro, North Carolina', country: 'USA' }, cite(PROLEC, 'operating facilities in Monterrey, Mexico, Waukesha, Wisconsin, Goldsboro, North Carolina, and Canoas, Brazil')),
      Object.assign({ label: 'Canoas', city: 'Canoas', country: 'Brazil' }, cite(PROLEC, 'operating facilities in Monterrey, Mexico, Waukesha, Wisconsin, Goldsboro, North Carolina, and Canoas, Brazil'))
    ],
    parent: Object.assign({ name: 'GE Vernova', slug: 'ge-vernova' }, cite(GE_PARENT, 'GE Vernova Inc. (NYSE: GEV) today announced it has completed the acquisition of the remaining 50% stake of Prolec GE')),
    products: [Object.assign({ code: 'PT' }, cite(PROLEC, 'Power Transformers'))]
  },
  'virginia-transformer-corp': {
    max_voltage_kv: Object.assign({ value: 525, unit: 'kV', scope: 'core-type liquid-filled class' }, cite(VIRGINIA, 'We offer ratings from 300 kVA up to 400 MVA/525 kV class for core-type liquid-filled transformers, from 60 MVA up to 500 MVA/500 kV for shell-type liquid-filled transformers, and 300 kVA up to 20 MVA/35 kV for dry-type transformers.')),
    mva: Object.assign({ min: null, max: 1400, unit: 'MVA', basis: 'unit_rating' }, cite(VIRGINIA, 'we provide power transformers up to 1,400 MVA, 500 kV')),
    plants: [
      Object.assign({ label: 'Six facilities in the United States and Mexico', city: '', country: '' }, cite(VIRGINIA, 'Our six state-of-the-art facilities throughout the United States and Mexico')),
      Object.assign({ label: 'Chihuahua manufacturing facility', city: 'Chihuahua', country: 'Mexico' }, cite(VIRGINIA, 'VTC further expanded in 1995 by adding a manufacturing facility in Chihuahua, Mexico'))
    ],
    products: [
      Object.assign({ code: 'PT' }, cite(VIRGINIA, 'we provide power transformers up to 1,400 MVA, 500 kV')),
      Object.assign({ code: 'DRY' }, cite(VIRGINIA, '300 kVA up to 20 MVA/35 kV for dry-type transformers'))
    ]
  },
  'wilson-transformer-company': {
    max_voltage_kv: Object.assign({ value: 400, unit: 'kV' }, cite(WILSON, 'customised power transformers ranging in size from 3MVA up to 550MVA 400kV at our Glen Waverley facility')),
    mva: Object.assign({ min: 3, max: 550, unit: 'MVA', basis: 'unit_rating' }, cite(WILSON, 'customised power transformers ranging in size from 3MVA up to 550MVA 400kV at our Glen Waverley facility')),
    plants: [Object.assign({ label: 'Glen Waverley facility', city: 'Glen Waverley', country: 'Australia' }, cite(WILSON, 'at our Glen Waverley facility'))],
    products: [Object.assign({ code: 'PT' }, cite(WILSON, 'customised power transformers ranging in size from 3MVA up to 550MVA 400kV'))]
  },
  'efacec': {
    max_voltage_kv: Object.assign({ value: 525, unit: 'kV' }, cite(EFACEC, 'Shell Up to 1500 MVA and 525 kV (BIL 1675 kV) Core Up to 350 MVA and 525 kV (BIL 1675 kV)')),
    mva: Object.assign({ min: null, max: 1500, unit: 'MVA', basis: 'unit_rating' }, cite(EFACEC, 'Shell Up to 1500 MVA and 525 kV (BIL 1675 kV)')),
    products: [
      Object.assign({ code: 'PT' }, cite(EFACEC, 'Our Core and Shell type power transformers')),
      Object.assign({ code: 'DT' }, cite(EFACEC, 'Distribution Transformers Optimal efficiency for electricity distribution networks.'))
    ]
  },
  'transformers-and-rectifiers-india-taril': {
    max_voltage_kv: Object.assign({ value: 1200, unit: 'kV' }, cite(TARIL, 'TARIL delivers high-performance power transformers up to 1200 kV and 1000 MVA')),
    mva: Object.assign({ min: null, max: 1000, unit: 'MVA', basis: 'unit_rating' }, cite(TARIL, 'TARIL delivers high-performance power transformers up to 1200 kV and 1000 MVA')),
    plants: [
      Object.assign({ label: 'Moraiya plant, capacity 40,000+ MVA', city: 'Moraiya', country: 'India' }, cite(TARIL, 'Moraiya Capacity of Plant 40,000+ MVA')),
      Object.assign({ label: 'Changodar plant, capacity 35,000+ MVA', city: 'Changodar', country: 'India' }, cite(TARIL, 'Changodar Capacity of Plant 35,000+ MVA')),
      Object.assign({ label: 'Odhav plant, capacity 2000 MVA', city: 'Odhav', country: 'India' }, cite(TARIL, 'Odhav Capacity of Plant 2000 MVA'))
    ],
    products: [
      Object.assign({ code: 'PT' }, cite(TARIL, 'high-performance power transformers up to 1200 kV and 1000 MVA')),
      Object.assign({ code: 'DT' }, cite(TARIL, 'distribution transformers ranging from 250KVA to 10,000KVA and up to 33 kV'))
    ]
  },
  'tbea-group-changji-hq-shenyang-hengyang-tianjin-plants': {
    max_voltage_kv: Object.assign({ value: 1100, unit: 'kV', scope: 'DC converter transformer' }, cite(TBEA, "The industry's first ± 1100kV DC converter transformer for transmission")),
    products: [Object.assign({ code: 'PT' }, cite(TBEA, "The industry's first ± 1100kV DC converter transformer for transmission"))]
  },
  'jiangsu-huapeng-jshp-huapeng-group': {
    max_voltage_kv: Object.assign({ value: 850, unit: 'kV' }, cite(JSHP, 'transformer solutions ranging from low-voltage distribution transformers to 850 kV, 1,000 MVA power transformers')),
    mva: Object.assign({ min: null, max: 1000, unit: 'MVA', basis: 'unit_rating' }, cite(JSHP, 'to 3-phase 850kV 1000 MVA transformers')),
    products: [
      Object.assign({ code: 'PT' }, cite(JSHP, '850 kV, 1,000 MVA power transformers')),
      Object.assign({ code: 'DT' }, cite(JSHP, 'ranging from low-voltage distribution transformers to 850 kV, 1,000 MVA power transformers'))
    ]
  },
  'hammond-power-solutions': {
    max_voltage_kv: Object.assign({ value: 46, unit: 'kV', scope: 'VPI class stated on the product list' }, cite(HAMMOND, 'VPI – Up to 46kV Class')),
    products: [Object.assign({ code: 'DRY' }, cite(HAMMOND, 'Cast Resin – Up to 35kV Class'))]
  }
};

function blank() {
  return { max_voltage_kv: null, mva: null, plants: [], iso: [], parent: null, products: [] };
}

function main() {
  const slugs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/company-slugs.json'), 'utf8'));
  const intel = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manufacturer-intel.json'), 'utf8'));
  const facilities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sourced-facility-evidence.json'), 'utf8'));
  const bySlug = {};
  slugs.forEach(function (s) { if (s && s.slug) bySlug[s.slug] = s; });
  const completeness = {};
  (intel.companies || []).forEach(function (c) { completeness[c.slug] = c.research_completeness || 0; });
  TIER_SLUGS.forEach(function (slug) {
    if (!bySlug[slug]) throw new Error('missing slug ' + slug);
  });
  const rest = slugs.filter(function (s) {
    return s && s.indexable && TIER_SLUGS.indexOf(s.slug) < 0;
  });
  rest.sort(function (a, b) {
    const d = (completeness[b.slug] || 0) - (completeness[a.slug] || 0);
    if (d) return d;
    return String(a.name).localeCompare(String(b.name));
  });
  const chosen = TIER_SLUGS.concat(rest.map(function (s) { return s.slug; })).slice(0, LIMIT);
  const plantsBySlug = {};
  (facilities.plants || []).forEach(function (p) {
    const slug = String(p.company_id || '').replace(/^cmp:/, '');
    if (!slug || p.status !== 'SOURCED' || !p.source_url) return;
    (plantsBySlug[slug] = plantsBySlug[slug] || []).push(p);
  });
  const companies = chosen.map(function (slug) {
    const row = bySlug[slug];
    const base = blank();
    const extra = FACTS[slug] || {};
    Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    if ((!base.plants || !base.plants.length) && plantsBySlug[slug]) {
      base.plants = plantsBySlug[slug].map(function (p) {
        return {
          label: p.site || p.city,
          city: p.city || '',
          country: p.country || '',
          source_url: p.source_url,
          verified: String(p.source_checked_at || '').slice(0, 10),
          quote: p.evidence_quote
        };
      });
    }
    return {
      slug: slug,
      name: row.name,
      country: row.country || '',
      max_voltage_kv: base.max_voltage_kv,
      mva: base.mva,
      plants: base.plants || [],
      iso: base.iso || [],
      parent: base.parent,
      products: base.products || []
    };
  });
  const doc = {
    _comment: 'Top 150 directory profiles. The first 36 follow the tier list onto canonical slugs. The rest are indexable profiles ordered by research completeness, then name. A null or empty field has no public source on file. verified is the day the linked page was read.',
    checked: CHECKED,
    count: companies.length,
    companies: companies
  };
  const out = path.join(ROOT, 'data/manufacturer-specs.json');
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  const filled = companies.filter(function (c) {
    return c.max_voltage_kv || c.mva || (c.plants && c.plants.length) || (c.iso && c.iso.length) || c.parent || (c.products && c.products.length);
  }).length;
  console.log('wrote', companies.length, 'specs;', filled, 'with at least one sourced field');
}

main();
