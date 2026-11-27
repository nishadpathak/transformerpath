/* EU provisional safeguard on the core inside an imported transformer.
 *
 * Commission Implementing Regulation (EU) 2026/2133 of 18 September 2026,
 * OJ L 2026/2133. English text of that act:
 * https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202602133
 *
 * Article 1(6): when the Article 1(3) product is incorporated in a transformer
 * under the CN codes in that paragraph, the provisional safeguard duty is
 * 1 140 EUR per ton of that incorporated product. The operator declares the
 * weight in tonnes of the core. Those goods are not subject to the quotas.
 *
 * Article 1(2) and 1(4) set a different price-threshold duty for loose
 * grain-oriented steel (CN 7225 11 00 and 7226 11 00). Article 1(5) sets a
 * different price-threshold duty for laminations and cores that are not
 * incorporated in a transformer (CN 8504 90 13). This module does not apply
 * the 1 140 rate to either of those.
 *
 * Article 4 and Annex III are the developing-country rule. Annex III.2 lists
 * the developing-country origins to which the measures apply, by product
 * type. For laminations and cores, that column is the three origins marked
 * in the regulation. Other Annex III.1 origins are exempt for this rate.
 * Article 5 excludes Iceland, Liechtenstein, Norway, Kenya, and Ukraine.
 *
 * A number is returned only when the code is a transformer CN in Article 1(3)
 * and the origin is one the operative text subjects to the laminations-and-cores
 * measure: the Annex III.2 column, or a non-exempt origin the regulation names
 * (Japan and the Republic of Korea in Annex I.2; Switzerland and Taiwan in
 * recital 92, which Article 5 does not exclude). Every other origin is not
 * clear from those lists and returns the broker result. No other country list
 * is used.
 *
 * 26 February 2027 is the provisional end date in recital 110. It is not a
 * confirmed decision date. Article 7: the regulation enters into force on
 * 25 September 2026.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPCoreDuty = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RATE_EUR_PER_TONNE = 1140;
  var SOURCE_URL = 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202602133';
  var RULE_DATE = '2026-09-18';
  var ENTRY_INTO_FORCE = '2026-09-25';
  var PROVISIONAL_END = '2027-02-26';
  var BROKER = 'Check with your broker';
  var DISCLAIMER = 'This is an estimate only, not customs advice.';

  /* Article 1(3). */
  var TRANSFORMER_CN = [
    '85042100',
    '85042210',
    '85042290',
    '85042300',
    '85043121',
    '85043129',
    '85043180',
    '85043200',
    '85043300',
    '85043400'
  ];
  /* Article 1(2): loose grain-oriented flat-rolled silicon-electrical steel. */
  var GOES_CN = ['72251100', '72261100'];
  /* Article 1(3) and 1(5), and Annex II: laminations and cores not in a transformer. */
  var SLC_CN = ['85049013'];

  /* Annex III.1, as printed after the heading. Algeria is named in the heading
   * and again in the list. */
  var DEVELOPING_LIST = 'Afghanistan, Albania, Algeria, Angola, Antigua and Barbuda, Argentina, Armenia, Bahrain, Bangladesh, Barbados, Belize, Benin, Bolivia, Botswana, Brazil, Brunei Darussalam, Burkina Faso, Burundi, Cabo Verde, Cambodia, Cameroon, Central African Republic, Chad, Chile, China, Colombia, Congo, Costa Rica, Côte d\'Ivoire, Cuba, Democratic Republic of the Congo, Djibouti, Dominica, Dominican Republic, Ecuador, Egypt, El Salvador, Eswatini, Fiji, Gabon, Gambia, Georgia, Ghana, Grenada, Guatemala, Guinea, Guinea-Bissau, Guyana, Haiti, Honduras, Hong Kong, India, Indonesia, Jamaica, Jordan, Kazakhstan, Kenya, Kuwait, Kyrgyz Republic, Lao People\'s Democratic Republic, Lesotho, Liberia, Macao, Madagascar, Malawi, Malaysia, Maldives, Mali, Mauritania, Mauritius, Mexico, Moldova, Mongolia, Montenegro, Morocco, Mozambique, Myanmar, Namibia, Nepal, Nicaragua, Niger, Nigeria, North Macedonia, Oman, Pakistan, Panama, Papua New Guinea, Paraguay, Peru, Philippines, Qatar, Rwanda, Saint Kitts and Nevis, Saint Lucia, Saint Vincent and the Grenadines, Samoa, Saudi Arabia, Senegal, Seychelles, Sierra Leone, Solomon Islands, South Africa, Sri Lanka, Suriname, Tajikistan, Tanzania, Thailand, Togo, Tonga, Trinidad and Tobago, Tunisia, Türkiye, Uganda, Ukraine, United Arab Emirates, Uruguay, Vanuatu, Venezuela, Vietnam, Yemen, Zambia, Zimbabwe';

  /* Annex III.2, laminations and cores column. */
  var LNC_SUBJECT_NAMES = ['China', 'Türkiye', 'United Arab Emirates'];
  /* Article 5. */
  var ARTICLE5_NAMES = ['Iceland', 'Liechtenstein', 'Norway', 'Kenya', 'Ukraine'];
  /* Named in the regulation and not excluded for this product. */
  var NAMED_COVERED_NAMES = [
    'Japan',
    'Korea, Republic of (South Korea)',
    'South Korea',
    'Republic of Korea',
    'Switzerland',
    'Taiwan'
  ];

  function normName(value) {
    return String(value || '')
      .replace(/['’]/g, '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function indexNames(list) {
    var map = {};
    list.forEach(function (name) {
      var key = normName(name);
      if (key) map[key] = 1;
    });
    return map;
  }

  var DEVELOPING = indexNames(DEVELOPING_LIST.split(',').map(function (part) { return part.trim(); }));
  var LNC_SUBJECT = indexNames(LNC_SUBJECT_NAMES);
  var ARTICLE5 = indexNames(ARTICLE5_NAMES);
  var NAMED_COVERED = indexNames(NAMED_COVERED_NAMES);

  var ALIAS = {};
  ALIAS[normName('Turkey')] = normName('Türkiye');
  ALIAS[normName('Korea, Republic of')] = normName('Korea, Republic of (South Korea)');

  function digits(code) {
    return String(code || '').replace(/\D/g, '');
  }

  function has(list, cn) {
    return list.indexOf(cn) !== -1;
  }

  function classifyCode(code) {
    var d = digits(code);
    if (!d) return { kind: 'other' };
    if (d.length === 8 || d.length === 10) {
      var cn = d.slice(0, 8);
      if (has(GOES_CN, cn)) return { kind: 'goes', cn: cn };
      if (has(SLC_CN, cn)) return { kind: 'slc', cn: cn };
      if (has(TRANSFORMER_CN, cn)) return { kind: 'transformer', cn: cn };
      return { kind: 'other', cn: cn };
    }
    if (d.length === 6) {
      var transformers = TRANSFORMER_CN.filter(function (cn) { return cn.slice(0, 6) === d; });
      if (transformers.length === 1) return { kind: 'transformer', cn: transformers[0] };
      if (transformers.length > 1) return { kind: 'ambiguous' };
      if (d === '722511' || d === '722611') return { kind: 'goes', cn: d + '00' };
      return { kind: 'other' };
    }
    if (d.indexOf('72251100') === 0 || d.indexOf('72261100') === 0) return { kind: 'goes' };
    if (d.indexOf('85049013') === 0) return { kind: 'slc' };
    return { kind: 'other' };
  }

  function originStatus(origin) {
    var key = ALIAS[normName(origin)] || normName(origin);
    if (!key) return 'unknown';
    if (ARTICLE5[key]) return 'exempt';
    if (LNC_SUBJECT[key]) return 'covered';
    if (NAMED_COVERED[key]) return 'covered';
    if (DEVELOPING[key]) return 'exempt';
    return 'unknown';
  }

  function tonnesOf(weight, unit) {
    if (typeof weight === 'string' && weight.trim() === '') return null;
    var n = typeof weight === 'number' ? weight : parseFloat(String(weight).replace(/,/g, ''));
    if (!isFinite(n) || n <= 0) return null;
    var u = normName(unit || 'tonnes');
    if (u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms') return n / 1000;
    if (u === 't' || u === 'tonne' || u === 'tonnes' || u === 'ton' || u === 'tons') return n;
    return null;
  }

  function dutyEur(tonnes) {
    return Math.round(tonnes * RATE_EUR_PER_TONNE * 100) / 100;
  }

  function broker(reason, productKind) {
    return {
      status: 'broker',
      result: BROKER,
      amountEur: null,
      tonnes: null,
      reason: reason,
      productKind: productKind || 'other'
    };
  }

  function estimate(input) {
    var row = input || {};
    var product = classifyCode(row.code);
    if (product.kind === 'goes') {
      return broker('Loose grain-oriented steel follows the price-threshold and quota rule. This rate is not applied to it.', 'goes');
    }
    if (product.kind === 'slc') {
      return broker('Standalone laminations and cores follow the price-threshold and quota rule. This rate applies only to the declared core weight inside a covered transformer.', 'slc');
    }
    if (product.kind === 'ambiguous') {
      return broker('This code matches more than one CN line, so coverage is not clear.', 'ambiguous');
    }
    if (product.kind !== 'transformer') {
      return broker('This product code is not a transformer CN code named for the incorporated-core duty.', 'other');
    }
    var origin = originStatus(row.origin);
    if (origin === 'exempt') {
      return broker('This origin is outside the incorporated-core duty on the terms written in the regulation.', 'transformer');
    }
    if (origin !== 'covered') {
      return broker('This origin is not matched to a covered or exempt name in the regulation, so coverage is not clear.', 'transformer');
    }
    var tonnes = tonnesOf(row.weight, row.unit);
    if (tonnes == null) {
      return {
        status: 'need_weight',
        result: '',
        amountEur: null,
        tonnes: null,
        reason: 'Enter the declared core weight in tonnes or kilograms.',
        productKind: 'transformer',
        cn: product.cn
      };
    }
    return {
      status: 'estimate',
      result: '',
      amountEur: dutyEur(tonnes),
      tonnes: tonnes,
      reason: 'Declared core weight only. The rate is not applied to the weight of the whole transformer.',
      productKind: 'transformer',
      cn: product.cn
    };
  }

  return {
    RATE_EUR_PER_TONNE: RATE_EUR_PER_TONNE,
    SOURCE_URL: SOURCE_URL,
    RULE_DATE: RULE_DATE,
    ENTRY_INTO_FORCE: ENTRY_INTO_FORCE,
    PROVISIONAL_END: PROVISIONAL_END,
    BROKER: BROKER,
    DISCLAIMER: DISCLAIMER,
    TRANSFORMER_CN: TRANSFORMER_CN.slice(),
    GOES_CN: GOES_CN.slice(),
    SLC_CN: SLC_CN.slice(),
    DEVELOPING_COUNT: Object.keys(DEVELOPING).length,
    estimate: estimate,
    classifyCode: classifyCode,
    originStatus: originStatus,
    normName: normName
  };
});
