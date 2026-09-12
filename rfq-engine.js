/* rfq-engine.js — RFQ → potentially relevant supplier matching.
 *
 * Deterministic, fact-based matching of an RFQ (transformer category, rating,
 * voltage, delivery destination) against the source-backed manufacturer census
 * (data/manufacturer-intel.json) and component suppliers (data/accessories.json).
 * It surfaces "potentially relevant suppliers", never "best suppliers" — the
 * language is deliberately neutral (Rule #5: commercial status never determines
 * technical relevance).
 *
 * Matching is capability-based only: product type covers the category, reported
 * MVA / voltage cover the rating, factory/market country covers the destination.
 */
(function () {
  'use strict';
  var DATA = [];
  var ACCS = [];

  var CATEGORY_TO_PRODUCT = {
    'Power Transformer': ['PT', 'POWER', 'GSU', 'AUTOTRANSFORMER', 'SPECIAL'],
    'Distribution Transformer': ['DT', 'DISTRIBUTION', 'PAD_MOUNTED', 'POLE_MOUNTED'],
    'Dry-Type / Cast Resin': ['DRY', 'DRY_TYPE', 'CAST_RESIN', 'TRACTION'],
    'Bushings': ['BUSHING', 'BUSHINGS (HV, LV)'],
    'Tap-Changers (OLTC/DETC)': ['OLTC', 'TAP_CHANGER', 'TAP CHANGERS (OLTC / DETC)'],
    'Insulation Materials': ['INSULATION', 'PRESSBOARD / INSULATION MATERIALS', 'LAMINATED WOOD / INSULATION WOOD', 'DDP / DPE (DENSIFIED PRESSBOARD)'],
    'Transformer Oil & Fluids': ['OIL', 'FLUID', 'ESTER', 'TRANSFORMER OIL / ESTER FLUIDS'],
    'Radiators / Cooling': ['COOLING', 'RADIATOR', 'RADIATORS / COOLING SYSTEMS', 'COOLING FANS'],
    'Monitoring & Protection': ['MONITORING', 'PROTECTION', 'BUCHHOLZ RELAYS', 'MONITORING / DIAGNOSTIC DEVICES', 'PRESSURE-RELIEF DEVICES', 'TEMPERATURE INDICATORS', 'OIL-LEVEL INDICATORS'],
    'Testing / Site Services': ['TESTING', 'SERVICE', 'REPAIR', 'TEST EQUIPMENT', 'OIL TREATMENT DEVICES'],
    'Other Components': ['SPECIAL', 'COMPONENT', 'CRGO (CORE STEEL)', 'COPPER / CTC CONDUCTORS', 'CONSERVATOR TANKS', 'BREATHERS (SILICA GEL)'],
  };

  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }

  function mvaNumber(v) { var m = String(v || '').replace(/[^\d.]/g, ''); return parseFloat(m) || 0; }
  function kvNumber(v) { var m = String(v || '').match(/(\d+(?:\.\d+)?)/); var n = parseFloat(m ? m[1] : 0); return n; }

  function factoryCountries(c) { return (c.factories || []).map(function (f) { return norm(f.country); }).filter(Boolean); }
  function hasCountry(c, dest) {
    if (!dest) return true;
    var d = norm(dest); if (!d) return true;
    if (norm(c.country) === d) return true;
    return factoryCountries(c).some(function (fc) { return d.indexOf(fc) >= 0 || fc.indexOf(d) >= 0; });
  }

  function matchOne(cat, rating, voltage, dest) {
    var cats = (CATEGORY_TO_PRODUCT[cat] || []).map(norm);
    
    // 1. Match OEMs from manufacturer dataset
    var oemMatches = DATA.filter(function (c) {
      var ps = (c.products || []).map(norm);
      var typeOk = !cats.length || ps.some(function (p) { return cats.some(function (w) { return p === w || p.indexOf(w) >= 0 || w.indexOf(p) >= 0; }); });
      if (!typeOk) return false;
      var mvaOk = true;
      if (rating) { var need = mvaNumber(rating); if (need) mvaOk = mvaNumber(c.reported_mva) >= need; }
      var kvOk = true;
      if (voltage) { var needKv = kvNumber(voltage); if (needKv) kvOk = kvNumber(c.reported_voltage) >= needKv; }
      if (!mvaOk || !kvOk) return false;
      if (!hasCountry(c, dest)) return false;
      return true;
    });

    // 2. Match Component Suppliers from accessories dataset
    var accMatches = ACCS.filter(function (a) {
      var aCats = (a.categories || []).map(norm);
      var catOk = !cats.length || aCats.some(function (ac) { return cats.some(function (w) { return ac.indexOf(w) >= 0 || w.indexOf(ac) >= 0; }); });
      if (!catOk) return false;
      if (dest && norm(a.country) !== norm(dest) && norm(dest).indexOf(norm(a.country)) < 0) return false;
      return true;
    }).map(function (a) {
      return {
        name: a.name,
        slug: (a.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        country: a.country,
        region: 'Global',
        products: a.categories || [],
        reported_voltage: '',
        reported_mva: '',
        factory_countries: [a.country],
        research_status: 'ACTIVE_CONFIRMED',
        research_completeness: 4,
        website: a.website,
        is_accessory: true,
        reasons: ['Component category covers ' + (cat || 'requested equipment'), 'Documented supplier in ' + a.country]
      };
    });

    return accMatches.concat(oemMatches).slice(0, 24);
  }

  function evid(c) {
    if (c.is_accessory) return 'CONFIRMED';
    if (c.company_reported) return 'COMPANY_REPORTED';
    if (c.research_status === 'ACTIVE_CONFIRMED') return 'CONFIRMED';
    if (c.research_status === 'ACTIVE_LIMITED_DATA' || c.research_status === 'RESEARCH_REQUIRED') return 'INFERRED';
    return 'UNKNOWN';
  }
  function evidenceLabel(e) { return e === 'CONFIRMED' ? 'confirmed' : e === 'COMPANY_REPORTED' ? 'company-reported' : e === 'INFERRED' ? 'inferred' : 'unknown'; }

  function match(req) {
    var cat = req && req.category || '';
    var rating = req && req.rating || '';
    var voltage = req && req.voltage || '';
    var dest = req && req.destination || '';
    var matches = matchOne(cat, rating, voltage, dest).map(function (c) {
      var ev = evid(c);
      var reasons = c.reasons ? c.reasons.slice() : [];
      if (!c.is_accessory) {
        reasons.push('Product categories cover ' + (cat || 'requested equipment'));
        if (rating && mvaNumber(rating)) reasons.push('Reported rating reaches ' + rating + ' (' + evidenceLabel(ev) + ')');
        if (voltage && kvNumber(voltage)) reasons.push('Reported voltage reaches ' + voltage + ' (' + evidenceLabel(ev) + ')');
        if (dest && hasCountry(c, dest)) reasons.push('Manufactures/serves in ' + dest);
        if (c.research_completeness == null || c.research_completeness < 3) reasons.push('Research completeness limited — verify with the manufacturer');
      }
      return {
        name: c.name, slug: c.slug, country: c.country, region: c.region,
        products: c.products || [], reported_voltage: c.reported_voltage || '',
        reported_mva: c.reported_mva || '', factory_countries: c.factory_countries || (c.factories ? [...new Set(factoryCountries(c))] : []),
        research_status: c.research_status || '', research_completeness: c.research_completeness || 0,
        evidence: ev, evidence_label: evidenceLabel(ev), company_reported: !!c.company_reported,
        website: c.website || '', reasons: reasons, is_accessory: !!c.is_accessory
      };
    }).sort(function (a, b) { return (b.research_completeness - a.research_completeness); });
    return Promise.resolve(matches);
  }

  window.TP_RFQ = { match: match, _load: function () { return { mfg: DATA, acc: ACCS }; } };
  
  function loadData() {
    fetch('data/manufacturer-intel.json').then(function (r) { return r.json(); }).then(function (d) { DATA = d.companies || []; }).catch(function () { DATA = []; });
    fetch('data/accessories.json').then(function (r) { return r.json(); }).then(function (d) { ACCS = d.suppliers || []; }).catch(function () { ACCS = []; });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadData);
    } else {
      loadData();
    }
  }
})();

