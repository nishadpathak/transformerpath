/* Dissolved-gas screening for mineral-oil transformers.
 *
 * Duval Triangle 1 uses the IEC 60599 zone limits on CH4, C2H4, and C2H2.
 * Rogers ratios use the IEC 60599 three-ratio code table.
 * IEEE C57.104-2019 status uses Table 1 (90th percentile) and Table 2
 * (95th percentile). Tables 3 and 4 need an earlier sample and are not applied.
 * The key-gas method follows IEEE C57.104-2019 Annex D.1.
 *
 * This is a screening aid. It is not a diagnosis.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPDga = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GAS_KEYS = ['h2', 'ch4', 'c2h6', 'c2h4', 'c2h2', 'co', 'co2'];
  var GAS_LABELS = {
    h2: 'H2', ch4: 'CH4', c2h6: 'C2H6', c2h4: 'C2H4', c2h2: 'C2H2', co: 'CO', co2: 'CO2'
  };
  var DISCLAIMER = 'This is not a substitute for expert diagnosis.';
  var AGE_INDEX = { unknown: 0, y1_9: 1, y10_30: 2, y30: 3 };
  var AGE_LABEL = {
    unknown: 'age not stated',
    y1_9: '1 to 9 years',
    y10_30: '10 to 30 years',
    y30: 'over 30 years'
  };

  /* Columns: unknown age, 1-9 years, 10-30 years, over 30 years.
   * Values are the IEEE C57.104-2019 percentile norms in ppm. */
  var TABLE1 = {
    le02: {
      h2: [80, 75, 75, 100],
      ch4: [90, 45, 90, 110],
      c2h6: [90, 30, 90, 150],
      c2h4: [50, 20, 50, 90],
      c2h2: [1, 1, 1, 1],
      co: [900, 900, 900, 900],
      co2: [9000, 5000, 10000, 10000]
    },
    gt02: {
      h2: [40, 40, 40, 40],
      ch4: [20, 20, 20, 20],
      c2h6: [15, 15, 15, 15],
      c2h4: [50, 25, 60, 60],
      c2h2: [2, 2, 2, 2],
      co: [500, 500, 500, 500],
      co2: [5000, 3500, 5500, 5500]
    }
  };
  var TABLE2 = {
    le02: {
      h2: [200, 200, 200, 200],
      ch4: [150, 100, 150, 200],
      c2h6: [175, 70, 175, 250],
      c2h4: [100, 40, 95, 175],
      c2h2: [2, 2, 2, 4],
      co: [1100, 1100, 1100, 1100],
      co2: [12500, 7000, 14000, 14000]
    },
    gt02: {
      h2: [90, 90, 90, 90],
      ch4: [50, 60, 60, 30],
      c2h6: [40, 30, 40, 40],
      c2h4: [100, 80, 125, 125],
      c2h2: [7, 7, 7, 7],
      co: [600, 600, 600, 600],
      co2: [7000, 5000, 8000, 8000]
    }
  };

  /* Zone corners as percent [CH4, C2H4, C2H2]. Order is the published polygons. */
  var DUVAL_POLYGONS = [
    { zone: 'PD', points: [[98, 0, 2], [98, 2, 0], [100, 0, 0]] },
    { zone: 'D1', points: [[0, 0, 100], [0, 23, 77], [64, 23, 13], [87, 0, 13]] },
    { zone: 'D2', points: [[0, 23, 77], [0, 71, 29], [31, 40, 29], [47, 40, 13], [64, 23, 13]] },
    { zone: 'T3', points: [[0, 85, 15], [0, 100, 0], [50, 50, 0], [35, 50, 15]] },
    { zone: 'T2', points: [[46, 50, 4], [50, 50, 0], [80, 20, 0], [76, 20, 4]] },
    { zone: 'T1', points: [[76, 20, 4], [80, 20, 0], [98, 2, 0], [98, 0, 2], [96, 0, 4]] },
    { zone: 'DT', points: [[0, 71, 29], [0, 85, 15], [35, 50, 15], [46, 50, 4], [96, 0, 4], [87, 0, 13], [47, 40, 13], [31, 40, 29]] }
  ];
  var DUVAL_TEXT = {
    PD: 'Partial discharges',
    D1: 'Discharges of low energy',
    D2: 'Discharges of high energy',
    T1: 'Thermal fault below 300 C',
    T2: 'Thermal fault from 300 C to 700 C',
    T3: 'Thermal fault above 700 C',
    DT: 'Mixture of thermal and electrical faults'
  };

  var ROGERS = [
    { r2: [0], r1: [0], r5: [0], text: 'No fault indicated. The codes match the normal-ageing case.' },
    { r2: [0], r1: [1], r5: [0], text: 'Partial discharges of low energy density.' },
    { r2: [1], r1: [1], r5: [0], text: 'Partial discharges of high energy density.' },
    { r2: [1], r1: [0], r5: [2], text: 'Discharges of high energy.' },
    { r2: [1, 2], r1: [0], r5: [1, 2], text: 'Discharges of low energy.' },
    { r2: [0], r1: [0], r5: [1], text: 'Thermal fault below 150 C.' },
    { r2: [0], r1: [2], r5: [0], text: 'Thermal fault from 150 C to 300 C.' },
    { r2: [0], r1: [2], r5: [1], text: 'Thermal fault from 300 C to 700 C.' },
    { r2: [0], r1: [2], r5: [2], text: 'Thermal fault above 700 C.' }
  ];

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function num(value) {
    if (value == null || value === '') return null;
    var n = typeof value === 'number' ? value : Number(String(value).trim());
    if (!isFinite(n) || n < 0 || n > 1e7) return null;
    return n;
  }

  function column(o2n2, age) {
    var side = o2n2 === 'gt02' ? 'gt02' : (o2n2 === 'le02' ? 'le02' : null);
    var idx = AGE_INDEX[age];
    if (!side || idx == null) return null;
    function take(table) {
      var out = {};
      GAS_KEYS.forEach(function (key) { out[key] = table[side][key][idx]; });
      return out;
    }
    return {
      o2n2: side,
      age: age,
      label: (side === 'le02' ? 'O2/N2 at or below 0.2' : 'O2/N2 above 0.2') + ', ' + AGE_LABEL[age],
      p90: take(TABLE1),
      p95: take(TABLE2)
    };
  }

  function xy(ch4, c2h4, c2h2) {
    return [c2h4 + c2h2 / 2, c2h2 * Math.sqrt(3) / 2];
  }

  function inside(pt, poly) {
    var x = pt[0];
    var y = pt[1];
    var hit = false;
    var i;
    var j;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0];
      var yi = poly[i][1];
      var xj = poly[j][0];
      var yj = poly[j][1];
      var dx = xj - xi;
      var dy = yj - yi;
      var len2 = dx * dx + dy * dy;
      if (len2 > 0) {
        var t = ((x - xi) * dx + (y - yi) * dy) / len2;
        if (t >= 0 && t <= 1) {
          var px = xi + t * dx;
          var py = yi + t * dy;
          if ((x - px) * (x - px) + (y - py) * (y - py) <= 0.04) return true;
        }
      }
      var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) hit = !hit;
    }
    return hit;
  }

  function duvalZone(ch4, c2h4, c2h2) {
    var pt = xy(ch4, c2h4, c2h2);
    var i;
    for (i = 0; i < DUVAL_POLYGONS.length; i++) {
      var poly = DUVAL_POLYGONS[i].points.map(function (p) { return xy(p[0], p[1], p[2]); });
      if (inside(pt, poly)) return DUVAL_POLYGONS[i].zone;
    }
    return null;
  }

  function ratioValue(numr, den) {
    if (den > 0) return numr / den;
    if (numr > 0) return Infinity;
    return null;
  }

  function codeC2H2(value) {
    if (value == null) return null;
    if (value < 0.1) return 0;
    if (value <= 3) return 1;
    return 2;
  }

  function codeCH4(value) {
    if (value == null) return null;
    if (value < 0.1) return 1;
    if (value <= 1) return 0;
    return 2;
  }

  function codeC2H4(value) {
    if (value == null) return null;
    if (value < 1) return 0;
    if (value <= 3) return 1;
    return 2;
  }

  function hasCode(list, code) {
    return list.indexOf(code) !== -1;
  }

  function rogers(gases) {
    var r1 = ratioValue(gases.ch4, gases.h2);
    var r2 = ratioValue(gases.c2h2, gases.c2h4);
    var r5 = ratioValue(gases.c2h4, gases.c2h6);
    var c1 = codeCH4(r1);
    var c2 = codeC2H2(r2);
    var c5 = codeC2H4(r5);
    var match = null;
    if (c1 != null && c2 != null && c5 != null) {
      ROGERS.some(function (row) {
        if (hasCode(row.r2, c2) && hasCode(row.r1, c1) && hasCode(row.r5, c5)) {
          match = row;
          return true;
        }
        return false;
      });
    }
    var summary;
    if (c1 == null || c2 == null || c5 == null) {
      summary = 'One or more Rogers ratios cannot be formed because a denominator gas is zero and the numerator is zero.';
    } else if (!match) {
      summary = 'Codes ' + c2 + ', ' + c1 + ', ' + c5 + ' (C2H2/C2H4, CH4/H2, C2H4/C2H6) do not match a Rogers case.';
    } else {
      summary = 'Codes ' + c2 + ', ' + c1 + ', ' + c5 + ' (C2H2/C2H4, CH4/H2, C2H4/C2H6). ' + match.text;
    }
    return {
      ratios: { ch4_h2: r1, c2h2_c2h4: r2, c2h4_c2h6: r5 },
      codes: { ch4_h2: c1, c2h2_c2h4: c2, c2h4_c2h6: c5 },
      text: match ? match.text : '',
      summary: summary
    };
  }

  function ieeeStatus(gases, col) {
    var above90 = [];
    var above95 = [];
    GAS_KEYS.forEach(function (key) {
      if (gases[key] > col.p95[key]) above95.push(key);
      else if (gases[key] > col.p90[key]) above90.push(key);
    });
    var level = above95.length ? 3 : (above90.length ? 2 : 1);
    var names = { 1: 'Status 1', 2: 'Status 2', 3: 'Status 3' };
    var meaning = {
      1: 'Every gas is at or below the Table 1 norm for this column.',
      2: 'At least one gas is above Table 1 and none is above Table 2.',
      3: 'At least one gas is above the Table 2 norm.'
    };
    var note = 'Level screening only. IEEE C57.104-2019 Tables 3 and 4 compare the change and the rate with an earlier sample. This tool has one sample, so it does not apply those tables and it cannot show active gassing.';
    return {
      level: level,
      label: names[level],
      meaning: meaning[level],
      above90: above90,
      above95: above95,
      note: note
    };
  }

  function keyGas(gases, norms) {
    var rows = [
      { gas: 'c2h2', fault: 'Electrical high-energy fault (arcing). The key-gas method associates hydrogen with acetylene for arcing, and carbon monoxide as well when cellulose is involved.' },
      { gas: 'h2', fault: 'Electrical low-energy partial discharge. Hydrogen is the main gas, with smaller amounts of methane.' },
      { gas: 'c2h4', fault: 'Thermal fault in the mineral oil. Ethylene is the main gas, with smaller amounts of ethane, methane, and hydrogen.' },
      { gas: 'co', fault: 'Thermal fault involving oil and cellulose. Carbon monoxide is the main gas.' }
    ];
    var best = null;
    rows.forEach(function (row) {
      var norm = norms[row.gas];
      var ratio = norm > 0 ? gases[row.gas] / norm : 0;
      row.ratio = ratio;
      if (ratio > 1 && (!best || ratio > best.ratio)) best = row;
    });
    var limitation = 'IEEE C57.104-2019 Annex D.1 says an automatic key-gas identification is often inconclusive, because the main gas is not always one of these four.';
    if (!best) {
      return {
        gas: '',
        fault: '',
        summary: 'No key gas is above its Table 1 norm, so the method does not name a fault type.',
        limitation: limitation
      };
    }
    return {
      gas: GAS_LABELS[best.gas],
      fault: best.fault,
      summary: 'The highest multiple of the Table 1 norm is ' + GAS_LABELS[best.gas] + ' (' + round1(best.ratio) + ' times the norm). ' + best.fault,
      limitation: limitation
    };
  }

  function fmtRatio(value) {
    if (value == null) return 'not defined';
    if (value === Infinity) return 'above the top code (numerator only)';
    return String(round1(value));
  }

  function listGases(keys) {
    if (!keys.length) return 'none';
    return keys.map(function (key) { return GAS_LABELS[key]; }).join(', ');
  }

  function interpret(input) {
    var src = input || {};
    var gases = {};
    var i;
    for (i = 0; i < GAS_KEYS.length; i++) {
      var parsed = num(src[GAS_KEYS[i]]);
      if (parsed == null) {
        return { error: 'Enter each gas in ppm. Use 0 when the laboratory reports none. Negative values are not accepted.' };
      }
      gases[GAS_KEYS[i]] = parsed;
    }
    var col = column(src.o2n2 || 'le02', src.age || 'unknown');
    if (!col) return { error: 'Choose an O2/N2 column and an age band. The default is O2/N2 at or below 0.2 and age not stated.' };

    var tri = gases.ch4 + gases.c2h4 + gases.c2h2;
    var percents = null;
    var zone = null;
    if (tri > 0) {
      percents = {
        ch4: 100 * gases.ch4 / tri,
        c2h4: 100 * gases.c2h4 / tri,
        c2h2: 100 * gases.c2h2 / tri
      };
      zone = duvalZone(percents.ch4, percents.c2h4, percents.c2h2);
    }
    var duval = {
      applicable: tri > 0 && !!zone,
      zone: zone || '',
      fault: zone ? DUVAL_TEXT[zone] : '',
      percents: percents,
      summary: tri <= 0
        ? 'Duval Triangle 1 is not plotted. Methane, ethylene, and acetylene are all zero.'
        : (zone
          ? 'Zone ' + zone + ': ' + DUVAL_TEXT[zone] + '. Percent of CH4 + C2H4 + C2H2 is CH4 ' + round1(percents.ch4) + ', C2H4 ' + round1(percents.c2h4) + ', C2H2 ' + round1(percents.c2h2) + '.'
          : 'The three gases do not fall in a published Duval Triangle 1 zone.')
    };
    if (duval.applicable) {
      duval.summary += ' The triangle identifies a suspected fault. It does not decide, by itself, that a fault exists.';
    }

    var ratio = rogers(gases);
    var status = ieeeStatus(gases, col);
    var key = keyGas(gases, col.p90);
    var narrative = [
      duval.summary,
      'Rogers ratios: ' + ratio.summary,
      'IEEE C57.104-2019 ' + status.label + ' (' + col.label + '). ' + status.meaning + ' ' + status.note,
      'Key-gas method: ' + key.summary + ' ' + key.limitation,
      'Read the four results together. When they disagree, that disagreement is part of the result.',
      DISCLAIMER
    ].join(' ');

    var lines = [
      'TransformerPath DGA screening report',
      'Contact hello@transformerpath.com',
      '',
      DISCLAIMER,
      'One laboratory sample. Not a trend, and not a finding that a transformer is fit or unfit for service.',
      ''
    ];
    if (src.asset) lines.push('Asset: ' + String(src.asset));
    if (src.sampled) lines.push('Sample date: ' + String(src.sampled));
    lines.push('IEEE column: ' + col.label);
    lines.push('');
    lines.push('Gas ppm');
    GAS_KEYS.forEach(function (keyName) {
      lines.push(GAS_LABELS[keyName] + ': ' + gases[keyName] + '    Table 1: ' + col.p90[keyName] + '    Table 2: ' + col.p95[keyName]);
    });
    lines.push('');
    lines.push('Duval Triangle 1 (IEC 60599 zone limits)');
    lines.push(duval.summary);
    lines.push('');
    lines.push('Rogers ratios (IEC 60599 code table)');
    lines.push('CH4/H2 = ' + fmtRatio(ratio.ratios.ch4_h2) + ' code ' + (ratio.codes.ch4_h2 == null ? 'n/a' : ratio.codes.ch4_h2));
    lines.push('C2H2/C2H4 = ' + fmtRatio(ratio.ratios.c2h2_c2h4) + ' code ' + (ratio.codes.c2h2_c2h4 == null ? 'n/a' : ratio.codes.c2h2_c2h4));
    lines.push('C2H4/C2H6 = ' + fmtRatio(ratio.ratios.c2h4_c2h6) + ' code ' + (ratio.codes.c2h4_c2h6 == null ? 'n/a' : ratio.codes.c2h4_c2h6));
    lines.push(ratio.summary);
    lines.push('');
    lines.push('IEEE C57.104-2019 status');
    lines.push(status.label + '. ' + status.meaning);
    lines.push('Above Table 1 only: ' + listGases(status.above90));
    lines.push('Above Table 2: ' + listGases(status.above95));
    lines.push(status.note);
    lines.push('');
    lines.push('Key-gas method (IEEE C57.104-2019 Annex D.1)');
    lines.push(key.summary);
    lines.push(key.limitation);
    lines.push('');
    lines.push(narrative);

    return {
      error: null,
      gases: gases,
      column: col,
      duval: duval,
      rogers: ratio,
      ieee: status,
      keyGas: key,
      narrative: narrative,
      disclaimer: DISCLAIMER,
      lines: lines
    };
  }

  return {
    GAS_KEYS: GAS_KEYS,
    GAS_LABELS: GAS_LABELS,
    DISCLAIMER: DISCLAIMER,
    TABLE1: TABLE1,
    TABLE2: TABLE2,
    interpret: interpret,
    duvalZone: duvalZone,
    column: column
  };
});
