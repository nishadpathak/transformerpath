/* Calculator snapshot shared by the page and the tests.
 * A saved design stores the inputs the calculator can apply again, plus an
 * optional summary taken from a completed calculation.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TPSavedDesign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var INPUT_IDS = [
    'std', 'fluid', 'insclass', 'harmonic_profile', 'tco_preset', 'cost_a', 'cost_b',
    'capex_base', 'toc_years', 'skva', 'freq', 'hv', 'lv', 'vec', 'ztgt', 'nlltgt',
    'autogr', 'tap', 'cool', 'K', 'bm', 'dlv', 'dhv', 'hr', 'stray',
    'gclv', 'glvhv', 'gph', 'gend', 'grade'
  ];

  var TYPES = { dist: true, power: true, cast: true };

  function snapshot(inputs, summary) {
    var clean = {};
    if (inputs && typeof inputs === 'object') {
      if (TYPES[inputs.type]) clean.type = inputs.type;
      INPUT_IDS.forEach(function (id) {
        if (inputs[id] == null) return;
        clean[id] = inputs[id];
      });
    }
    return {
      app: 'TransformerPath Calculator',
      version: '2.1',
      inputs: clean,
      summary: summary && typeof summary === 'object' ? summary : null
    };
  }

  function readInputs(getter) {
    var inputs = {};
    if (typeof getter !== 'function') return inputs;
    var type = getter('type');
    if (TYPES[type]) inputs.type = type;
    INPUT_IDS.forEach(function (id) {
      var value = getter(id);
      if (value !== undefined) inputs[id] = value;
    });
    return inputs;
  }

  function validateSnapshot(data) {
    if (!data || typeof data !== 'object' || !data.inputs || typeof data.inputs !== 'object') {
      throw new Error('Saved design is missing calculator inputs.');
    }
    return data;
  }

  function defaultName(summary, inputs) {
    if (summary && summary.rating && summary.vector) return String(summary.rating) + ' ' + String(summary.vector);
    var rating = inputs && inputs.skva ? String(inputs.skva) : '';
    var vec = inputs && inputs.vec ? String(inputs.vec) : '';
    var name = (rating + ' ' + vec).trim();
    return name || 'Untitled design';
  }

  return {
    INPUT_IDS: INPUT_IDS,
    snapshot: snapshot,
    readInputs: readInputs,
    validateSnapshot: validateSnapshot,
    defaultName: defaultName
  };
});
