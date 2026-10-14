/* Shared directory introduction.
 * Uses only fields already on the record. Never invents a founding year.
 * Browser: window.TPIntro. Node: require('./directory-intro').
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPIntro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TYPE = {
    PT: 'power transformers',
    DT: 'distribution transformers',
    DRY: 'dry-type and cast-resin transformers',
    TX: 'specialty transformers',
    SR: 'reactors',
    IT: 'instrument transformers',
    INST: 'instrument transformers'
  };

  function list(items, limit) {
    var a = [];
    (items || []).forEach(function (item) {
      var s = String(item || '').trim();
      if (!s || a.indexOf(s) >= 0) return;
      a.push(s);
    });
    if (limit && a.length > limit) a = a.slice(0, limit);
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  function productPhrase(products) {
    return list((products || []).map(function (p) {
      var code = String(p || '').trim();
      return TYPE[code] || code;
    }), 6);
  }

  function supplierIntro(o) {
    o = o || {};
    var name = o.name || 'This organisation';
    var place = [o.city, o.country].filter(Boolean).join(', ');
    var role = o.role || 'supplier';
    var products = productPhrase(o.products);
    var sentences = [];
    sentences.push(name + ' is listed as a ' + role + (place ? ' in ' + place : '') + '.');
    if (products) sentences.push('Products and scope on file: ' + products + '.');
    if (o.established) sentences.push('Year of establishment on file: ' + o.established + '.');
    else sentences.push('Year of establishment is not yet recorded in this census.');
    var sourced = [];
    if (o.voltage) sourced.push('highest sourced voltage ' + o.voltage);
    if (o.capacity) sourced.push('indicative capacity ' + o.capacity);
    if (sourced.length) {
      sentences.push('Sourced figures on file: ' + sourced.join('; ') + '. These are the highest sourced values, not an audited company maximum.');
    }
    if (o.extra) sentences.push(o.extra);
    return sentences.join(' ');
  }

  /* Keep a researched description, then add year, range and scope that the card would otherwise hide. */
  function enrichExisting(o) {
    o = o || {};
    var parts = [];
    var description = String(o.description || '').trim();
    if (description) parts.push(description);
    var facts = [];
    if (o.established) facts.push('Established ' + o.established);
    else if (o.requireYear) facts.push('Year of establishment is not yet recorded in this census');
    var products = productPhrase(o.products);
    if (products && description.toLowerCase().indexOf(products.toLowerCase()) < 0) facts.push('Scope on file: ' + products);
    if (o.capacity) facts.push('Range on file: ' + o.capacity);
    if (o.voltage && description.indexOf(String(o.voltage)) < 0) facts.push('Voltages on file: ' + o.voltage);
    if (facts.length) parts.push(facts.join('. ') + '.');
    if (o.extra) parts.push(o.extra);
    if (!parts.length) return supplierIntro(o);
    return parts.join(' ');
  }

  return { supplierIntro: supplierIntro, enrichExisting: enrichExisting, productPhrase: productPhrase };
});
