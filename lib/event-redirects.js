'use strict';
/* Retired event paths. Each one 301s to the series hub or the events
 * calendar. Targets use a trailing slash so the hop does not chain
 * through a second slash redirect.
 *
 * middle-energy is the short slug of Middle East Energy.
 * The long ASEAN and Power Uzbekistan slugs were the same series as the
 * shorter hub. The remaining rows are old public aliases.
 */
const RULES = [
  ['/events/middle-energy', '/events/middle-east-energy/'],
  ['/events/middle-energy/', '/events/middle-east-energy/'],
  ['/events/asean-sustainable-energy-week-incl-renewable-energy-asia', '/events/asean-sustainable-energy-week/'],
  ['/events/asean-sustainable-energy-week-incl-renewable-energy-asia/', '/events/asean-sustainable-energy-week/'],
  ['/events/power-uzbekistan-19th-energy-exhibition', '/events/power-uzbekistan/'],
  ['/events/power-uzbekistan-19th-energy-exhibition/', '/events/power-uzbekistan/'],
  ['/events/ieee-pes-tandd-conference-and-exposition', '/events/ieee-pes-td/'],
  ['/events/ieee-pes-tandd-conference-and-exposition/', '/events/ieee-pes-td/'],
  ['/events/7th-international-colloquium-transformer-research-and-asset-management-ictram-2026', '/events/7th-ictram-intl-colloquium-on-transformer-research-and-asset-management/'],
  ['/events/7th-international-colloquium-transformer-research-and-asset-management-ictram-2026/', '/events/7th-ictram-intl-colloquium-on-transformer-research-and-asset-management/'],
  ['/events/cigre-australia-a2', '/events/cigre-australia-a2-transformer-and-reactor-workshop/'],
  ['/events/cigre-australia-a2/', '/events/cigre-australia-a2-transformer-and-reactor-workshop/'],
  ['/events/cigre-canada', '/events/cigre-canada-conference-and-exhibition/'],
  ['/events/cigre-canada/', '/events/cigre-canada-conference-and-exhibition/'],
  ['/events/cigre-symposium', '/events/cigre-symposium-cairns/'],
  ['/events/cigre-symposium/', '/events/cigre-symposium-cairns/'],
  ['/events/distributech-international-2026', '/events/distributech/'],
  ['/events/distributech-international-2026/', '/events/distributech/'],
  ['/events/elfack-gothenburg', '/events/elfack/'],
  ['/events/elfack-gothenburg/', '/events/elfack/'],
  ['/events/enlit-africa-2026-formerly-african-utility-week', '/events/enlit-africa/'],
  ['/events/enlit-africa-2026-formerly-african-utility-week/', '/events/enlit-africa/'],
  ['/events/ichve', '/events/ichve-ieee-intl-conf-on-high-voltage-engineering/'],
  ['/events/ichve/', '/events/ichve-ieee-intl-conf-on-high-voltage-engineering/'],
  ['/events/ieee-eic', '/events/ieee-eic-and-ipmhvc/'],
  ['/events/ieee-eic/', '/events/ieee-eic-and-ipmhvc/'],
  ['/events/ieee-pes-transformers-committee-fall', '/events/ieee-pes-transformers-committee/'],
  ['/events/ieee-pes-transformers-committee-fall/', '/events/ieee-pes-transformers-committee/'],
  ['/events/korea-smart-grid', '/events/korea-smart-grid-week/'],
  ['/events/korea-smart-grid/', '/events/korea-smart-grid-week/'],
  ['/events/megawhat-transformer-iandc-days-2026', '/events.html'],
  ['/events/megawhat-transformer-iandc-days-2026/', '/events.html']
];

const BEGIN = '# BEGIN event-canonical-redirects';
const END = '# END event-canonical-redirects';

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

function spliceMarked(text, block) {
  const src = String(text || '');
  const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (re.test(src)) return src.replace(re, block);
  const trimmed = src.replace(/\s*$/, '');
  return (trimmed ? trimmed + '\n' : '') + block + '\n';
}

module.exports = {
  RULES: RULES,
  BEGIN: BEGIN,
  END: END,
  redirectsBlock: redirectsBlock,
  tomlBlock: tomlBlock,
  spliceMarked: spliceMarked
};
