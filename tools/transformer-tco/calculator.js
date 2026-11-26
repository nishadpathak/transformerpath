/* TransformerPath purchase + energy-loss comparison. All inputs stay in this page. */
(function () {
  'use strict';

  const example = Object.freeze({
    currency: 'USD', unit: 'kW', hours: 8760, load: 50, rate: 0.12, life: 20, discount: 0,
    a: Object.freeze({ price: 25000, noLoad: 1, load: 8 }),
    b: Object.freeze({ price: 28000, noLoad: 0.7, load: 6 })
  });

  const currencies = ['AED','AUD','BHD','BRL','CAD','CHF','CLP','CNY','COP','DKK','EGP','EUR',
    'GBP','HKD','IDR','INR','JPY','KRW','KWD','MXN','MYR','NOK','NZD','OMR','PHP','PLN',
    'QAR','SAR','SEK','SGD','THB','TRY','USD','VND','ZAR'];
  const precision = (code) => new Intl.NumberFormat('en', { style: 'currency', currency: code })
    .resolvedOptions().maximumFractionDigits;

  function inRange(value, min, max, label, integer) {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new RangeError(label + ' must be ' + (integer ? 'a whole number ' : '') + 'from ' + min + ' to ' + max + '.');
    }
    return value;
  }

  function compare(input) {
    if (!currencies.includes(input.currency)) throw new RangeError('Choose a supported currency.');
    if (input.unit !== 'W' && input.unit !== 'kW') throw new RangeError('Choose W or kW for both quotes.');
    const hours = inRange(input.hours, 0, 8760, 'Annual energized hours');
    const load = inRange(input.load, 0, 100, 'Equivalent load (%)') / 100;
    const rate = inRange(input.rate, 0, 1000000, 'Energy rate');
    const life = inRange(input.life, 1, 100, 'Service life', true);
    const discount = inRange(input.discount, 0, 100, 'Real discount rate (%)') / 100;
    const kw = input.unit === 'W' ? 0.001 : 1;
    // 0% yields exactly N. log1p/expm1 avoids subtractive cancellation for small rates.
    const factor = discount === 0 || Math.log1p(discount) === 0
      ? life : -Math.expm1(-life * Math.log1p(discount)) / discount;

    function evaluate(quote, name) {
      const price = inRange(quote.price, 0, 1e12, name + ' price');
      const maxLoss = 1e6 / kw;
      const noLoad = inRange(quote.noLoad, 0, maxLoss, name + ' no-load loss') * kw;
      const ratedLoss = inRange(quote.load, 0, maxLoss, name + ' full-load loss') * kw;
      const annualNoLoad = noLoad * hours;
      const annualLoad = ratedLoss * load * load * hours;
      const annualEnergy = annualNoLoad + annualLoad;
      const annualCost = annualEnergy * rate;
      const lifetimeCost = annualCost * factor;
      return { price, annualNoLoad, annualLoad, annualEnergy, annualCost, lifetimeCost,
        pvNoLoad: annualNoLoad * rate * factor, pvLoad: annualLoad * rate * factor,
        tco: price + lifetimeCost };
    }

    const a = evaluate(input.a, 'Quote A');
    const b = evaluate(input.b, 'Quote B');
    const gap = Math.abs(a.tco - b.tco);
    const minorUnit = 10 ** -precision(input.currency);
    return { a, b, gap, lower: gap < minorUnit / 2 ? null : a.tco < b.tco ? 'A' : 'B', factor };
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { compare, example };
    return;
  }

  const byId = (id) => document.getElementById(id);
  const form = byId('tco-form');
  if (!form) return;
  const field = (id) => byId('tco-' + id);
  const keys = ['currency','unit','hours','load','rate','life','discount'];
  const quotes = ['a','b'];
  const quoteKeys = ['price','noLoad','load'];
  const resultKeys = ['price','annualNoLoad','annualLoad','annualEnergy','annualCost','pvNoLoad','pvLoad','lifetimeCost','tco'];
  const energyKeys = new Set(['annualNoLoad','annualLoad','annualEnergy']);
  const energy = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
  const basis = field('basis');
  const results = field('results');
  let previousUnit = field('unit').value;

  function clearResults() {
    results.hidden = true;
    field('status').textContent = '';
    field('error').textContent = '';
  }

  function syncUnit() {
    const selected = field('unit').value;
    previousUnit = selected;
    document.querySelectorAll('[data-loss-unit]').forEach((node) => { node.textContent = selected; });
    document.querySelectorAll('[data-loss-input]').forEach((node) => { node.max = selected === 'W' ? 1e9 : 1e6; });
    document.querySelectorAll('[data-currency-label]').forEach((node) => { node.textContent = field('currency').value || 'chosen currency'; });
  }

  function calculate() {
    clearResults();
    if (!form.reportValidity()) return;
    const input = {};
    for (const key of keys) {
      const control = field(key);
      input[key] = control.tagName === 'SELECT' ? control.value
        : key === 'discount' && control.value === '' ? 0 : control.valueAsNumber;
    }
    for (const quote of quotes) {
      input[quote] = Object.fromEntries(quoteKeys.map((key) => [key, field(quote + '-' + key).valueAsNumber]));
    }
    try {
      const { a, b, gap, lower } = compare(input);
      const money = new Intl.NumberFormat('en', { style: 'currency', currency: input.currency, currencyDisplay: 'code' });
      const moneyText = (value) => money.format(value);
      for (const [quote, value] of [['a', a], ['b', b]]) {
        for (const key of resultKeys) {
          field(quote + '-out-' + key).textContent = energyKeys.has(key)
            ? energy.format(value[key]) + ' kWh' : moneyText(value[key]);
        }
      }
      field('answer').textContent = lower
        ? 'Quote ' + lower + ' has the lower modeled total by ' + moneyText(gap) + '.'
        : 'The modeled gap is less than half the smallest currency unit.';
      field('output-label').textContent = (input.discount ? 'Present-value estimate' : 'Undiscounted estimate')
        + ' over ' + input.life + (input.life === 1 ? ' year' : ' years') + ', in today’s currency.'
        + (form.dataset.example === 'true' ? ' Includes illustrative inputs; not supplier data.' : '');
      results.hidden = false;
      field('status').textContent = 'Comparison updated. ' + field('answer').textContent;
      results.focus();
    } catch (error) {
      field('error').textContent = error instanceof RangeError ? error.message : 'Could not calculate these values.';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculate();
  });
  form.addEventListener('input', (event) => {
    if (event.target === field('unit') && previousUnit !== event.target.value) {
      const conversion = event.target.value === 'W' ? 1000 : 0.001;
      document.querySelectorAll('[data-loss-input]').forEach((node) => {
        // Retain the physical loss when changing the unit, and suppress binary rounding noise.
        if (Number.isFinite(node.valueAsNumber)) node.value = Number((node.valueAsNumber * conversion).toPrecision(15));
      });
    }
    if (/^tco-[ab]-/.test(event.target.id)) basis.checked = false;
    clearResults();
    syncUnit();
  });
  field('example').addEventListener('click', () => {
    for (const key of keys) field(key).value = example[key];
    for (const quote of quotes) for (const key of quoteKeys) field(quote + '-' + key).value = example[quote][key];
    // An illustrative dataset must not silently confirm the user's real quote basis.
    basis.checked = false;
    form.dataset.example = 'true';
    syncUnit();
    clearResults();
    field('status').textContent = 'Illustrative example loaded. Review the loss basis checkbox, then compare.';
  });
  basis.addEventListener('input', (event) => { event.stopPropagation(); clearResults(); });
  field('clear').addEventListener('click', () => {
    form.reset();
    form.dataset.example = 'false';
    syncUnit();
    clearResults();
    field('hours').focus();
    field('status').textContent = 'Inputs cleared.';
  });
  syncUnit();
  form.querySelectorAll('button[disabled]').forEach((button) => { button.disabled = false; });
}());
