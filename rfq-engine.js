/* rfq-engine.js — RFQ → potentially relevant supplier matching.
 *
 * Deterministic, fact-based matching of an RFQ (transformer category, rating,
 * voltage, delivery destination) against the source-backed manufacturer census
 * (data/manufacturer-intel.json). It surfaces "potentially relevant
 * manufacturers", never "best suppliers" — the language is deliberately neutral
 * (Rule #5: commercial status never determines technical relevance; a listed
 * manufacturer can be technically relevant).
 *
 * Matching is capability-based only: product type covers the category, reported
 * MVA / voltage cover the rating, factory/market country covers the destination.
 * Commercial payment NEVER affects matching. Research status is shown for
 * transparency but does not gate matching.
 *
 * Exposes:
 *   window.TP_RFQ.match({ category, rating, voltage, destination, quantity })
 *     -> { matches: [ {name, slug, country, products, reported_voltage,
 *                      reported_mva, factory_countries, research_status,
 *                      reasons[] } ] }
 *
 * Degrades gracefully: if the census cannot be loaded it resolves to [].
 */
(function () {
  'use strict';
  var DATA = null;

  var CATEGORY_TO_PRODUCT = {
    'Power Transformer': ['PT', 'POWER', 'GSU', 'AUTOTRANSFORMER', 'SPECIAL'],
    'Distribution Transformer': ['DT', 'DISTRIBUTION', 'PAD_MOUNTED', 'POLE_MOUNTED'],
    'Dry-Type / Cast Resin': ['DRY', 'DRY_TYPE', 'CAST_RESIN', 'TRACTION'],
    'Bushings': ['BUSHING'],
    'Tap-Changers (OLTC/DETC)': ['OLTC', 'TAP_CHANGER'],
    'Insulation Materials': ['INSULATION'],
    'Transformer Oil & Fluids': ['OIL', 'FLUID', 'ESTER'],
    'Radiators / Cooling': ['COOLING', 'RADIATOR'],
    'Monitoring & Protection': ['MONITORING', 'PROTECTION'],
    'Testing / Site Services': ['TESTING', 'SERVICE', 'REPAIR'],
    'Other Components': ['SPECIAL', 'COMPONENT'],
  };

  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }

  function mvaNumber(v) { var m = String(v || '').replace(/[^\d.]/g, ''); return parseFloat(m) || 0; }
  function kvNumber(v) { var m = String(v || '').match(/(\d+(?:\.\d+)?)/); var n = parseFloat(m ? m[1] : 0); return n; }

  function factoryCountries(c) { return (c.factories || []).map(function (f) { return norm(f.country); }).filter(Boolean); }
  function hasCountry(c, dest) {
    if (!dest) return true;
    var d = norm(dest); if (!d) return true;
    // Match destination against the company's factory countries OR its HQ country.
    if (norm(c.country) === d) return true;
    return factoryCountries(c).some(function (fc) { return d.indexOf(fc) >= 0 || fc.indexOf(d) >= 0; });
  }

  function matchOne(cat, rating, voltage, dest) {
    var cats = CATEGORY_TO_PRODUCT[cat] || [];
    return DATA.filter(function (c) {
      var ps = (c.products || []).map(norm);
      // category match: census product type covers the requested category
      var typeOk = !cats.length || ps.some(function (p) { return cats.some(function (w) { return p === w.toLowerCase(); }); });
      if (!typeOk) return false;
      var mvaOk = true;
      if (rating) { var need = mvaNumber(rating); if (need) mvaOk = mvaNumber(c.reported_mva) >= need; }
      var kvOk = true;
      if (voltage) { var needKv = kvNumber(voltage); if (needKv) kvOk = kvNumber(c.reported_voltage) >= needKv; }
      if (!mvaOk || !kvOk) return false;
      if (!hasCountry(c, dest)) return false;
      return true;
    }).slice(0, 24);
  }

  function score(c, reasons) {
    // Deterministic ordering by research completeness + presence of confirmed capability.
    return (c.research_completeness || 0) * 10 + (c.reported_mva ? 3 : 0) + (c.reported_voltage ? 2 : 0) + (c.reported_certs && c.reported_certs.length ? 1 : 0);
  }

  function evid(c) {
    if (c.company_reported) return 'COMPANY_REPORTED';
    if (c.research_status === 'ACTIVE_CONFIRMED') return 'CONFIRMED';
    if (c.research_status === 'ACTIVE_LIMITED_DATA' || c.research_status === 'RESEARCH_REQUIRED') return 'INFERRED';
    return 'UNKNOWN';
  }
  function evidenceLabel(e) { return e === 'CONFIRMED' ? 'confirmed' : e === 'COMPANY_REPORTED' ? 'company-reported' : e === 'INFERRED' ? 'inferred' : 'unknown'; }

  function match(req) {
    if (!DATA) return Promise.resolve([]);
    var cat = req && req.category || '';
    var rating = req && req.rating || '';
    var voltage = req && req.voltage || '';
    var dest = req && req.destination || '';
    var matches = matchOne(cat, rating, voltage, dest).map(function (c) {
      var reasons = [];
      var ev = evid(c);
      reasons.push('Product categories cover ' + (cat || 'requested equipment'));
      if (rating && mvaNumber(rating)) reasons.push('Reported rating reaches ' + rating + ' (' + evidenceLabel(ev) + ')');
      if (voltage && kvNumber(voltage)) reasons.push('Reported voltage reaches ' + voltage + ' (' + evidenceLabel(ev) + ')');
      if (dest && hasCountry(c, dest)) reasons.push('Manufactures/serves in ' + dest);
      if (c.research_completeness == null || c.research_completeness < 3) reasons.push('Research completeness limited — verify with the manufacturer');
      return {
        name: c.name, slug: c.slug, country: c.country, region: c.region,
        products: c.products || [], reported_voltage: c.reported_voltage || '',
        reported_mva: c.reported_mva || '', factory_countries: [...new Set(factoryCountries(c))],
        research_status: c.research_status || '', research_completeness: c.research_completeness || 0,
        evidence: ev, evidence_label: evidenceLabel(ev), company_reported: !!c.company_reported,
        website: c.website || '', reasons: reasons,
      };
    }).sort(function (a, b) { return (b.research_completeness - a.research_completeness); });
    return Promise.resolve(matches);
  }

  window.TP_RFQ = { match: match, _load: function () { return DATA; } };
  if (document && document.readyState !== 'loading') loadData();

  function loadData() {
    fetch('data/manufacturer-intel.json').then(function (r) { return r.json(); }).then(function (d) { DATA = d.companies || []; }).catch(function () { DATA = []; });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadData);
  }
})();
