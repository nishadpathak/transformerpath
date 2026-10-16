'use strict';
/* Pages removed from the sitemap on 16 Oct 2026 that otherwise 404.
 * Each public path 301s to the closest page that is still published:
 * a country or category directory, the replacement tender or project,
 * or the tenders, projects, events, accessories, or intel hub.
 * India policy stories are intel items, not tenders, so they go to intel.
 */
const PAIRS = [
  ['/accessories/banmore-electricals-pvt-ltd/', '/accessories.html'],
  ['/accessories/bhavnish-metal-india-private-limited/', '/accessories.html'],
  ['/accessories/kirloskar-brothers-limited/', '/accessories.html'],
  ['/accessories/sorbead-india/', '/accessories.html'],
  ['/events/euci-asset-management-strategies-for-power-transformers-2026/', '/events.html'],
  ['/events/euci-asset-management-strategies-for-power-transformers/', '/events.html'],
  ['/gcc-weekly-pack.html', '/intel.html'],
  ['/gcc-weekly-pack', '/intel.html'],
  ['/manufacturers/berytech-energy-liban-cables-and-transfo/', '/manufacturers/lebanon.html'],
  ['/manufacturers/chang-yang-electric/', '/manufacturers/taiwan.html'],
  ['/manufacturers/dry-type-transformers/singapore/', '/manufacturers/singapore.html'],
  ['/manufacturers/famiq-transformadores-uruguay-cir-s-a/', '/manufacturers/uruguay.html'],
  ['/manufacturers/hanoi-transformer-manufacturing-hbt/', '/manufacturers/bth-hanoi-transformer-mfg/'],
  ['/manufacturers/hexaformer/', '/manufacturers/sweden.html'],
  ['/manufacturers/huacheng-electric/', '/manufacturers/fortune-electric/'],
  ['/manufacturers/kuwait-electrical-wiring-accessories-co-kewa-transformers/', '/manufacturers/kuwait.html'],
  ['/manufacturers/lkh-projects-distribution/', '/manufacturers/singapore.html'],
  ['/manufacturers/sichuan-transformer-co-ltd/', '/manufacturers/china.html'],
  ['/manufacturers/transfobol-s-r-l-transformadores-bolivia/', '/manufacturers/bolivia.html'],
  ['/manufacturers/vermeire-belting-and-transformers/', '/manufacturers/belgium.html'],
  ['/projects/dewa-13-x-132-11-kv-substations-epc/', '/projects.html'],
  ['/tenders/atlantic-shores-south/', '/projects/atlantic-shores-south/'],
  ['/tenders/bahrain-ewa-takes-bids-for-sitra-400-kv-grid-substation-cable-works-siemens-energy-holds-127m-substation-epc/', '/tenders/bahrain-ewa-sitra-400-kv-grid-substation/'],
  ['/tenders/dewa-13-x-132-11-kv-substations-epc/', '/tenders.html'],
  ['/tenders/dewa-floats-epc-tender-for-twelve-132-11-kv-substations-in-dubai-south-and-expo-valley-development-zones/', '/tenders.html'],
  ['/tenders/india-grants-2-year-public-procurement-exemption-to-four-chinese-owned-transformer-equipment-subsidiaries/', '/intel.html'],
  ['/tenders/india-to-open-power-tenders-to-china-linked-oems-with-local-factories/', '/intel.html']
];

function expand(pair) {
  const rows = [pair];
  if (pair[0].endsWith('/') && pair[0].length > 1) rows.push([pair[0].slice(0, -1), pair[1]]);
  return rows;
}

const RULES = PAIRS.reduce(function (out, pair) { return out.concat(expand(pair)); }, []);

const BEGIN = '# BEGIN retired-url-redirects';
const END = '# END retired-url-redirects';

function redirectsBlock() {
  const lines = RULES.map(function (row) { return row[0] + '  ' + row[1] + '  301'; });
  return BEGIN + '\n' + lines.join('\n') + '\n' + END;
}

function tomlBlock() {
  const chunks = RULES.map(function (row) {
    return '[[redirects]]\n  from = "' + row[0] + '"\n  to = "' + row[1] + '"\n  status = 301\n  force = true';
  });
  return BEGIN + '\n' + chunks.join('\n\n') + '\n' + END;
}

module.exports = {
  PAIRS: PAIRS,
  RULES: RULES,
  BEGIN: BEGIN,
  END: END,
  redirectsBlock: redirectsBlock,
  tomlBlock: tomlBlock
};
