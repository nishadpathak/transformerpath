/* Structured manufacturer profile claims.
 *
 * A public value exists only when a page was read: source URL, the day it
 * was read, and a quote. The quote stays in the source file. The public
 * record keeps the URL, the day, and a verification status.
 *
 * company-declared: the supplier's own page stated it.
 * verified: a reviewer marked a source that is not only that statement.
 * unverified: not published.
 *
 * This projector does not invent verified facts. An Elin company stays an
 * ordinary listing: a sourced figure is company-declared, never verified.
 * Empty fields render as an em dash. No price is stored.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && document.querySelector) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.mount);
    else api.mount();
  }
  if (root) root.tpProfileClaims = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var HTTP = /^https?:\/\/\S+$/i;
  var DASH = '—';
  var STATUSES = ['verified', 'company-declared', 'unverified'];
  var FIELDS = [
    ['category', 'Category / application'],
    ['rated_kva', 'Rated kVA'],
    ['rated_mva', 'Rated MVA'],
    ['voltage_class', 'Voltage class'],
    ['factory', 'Factory locations'],
    ['testing', 'Testing capabilities'],
    ['standard', 'Standards'],
    ['certification', 'Certifications'],
    ['media', 'Photos / brochures'],
    ['project_reference', 'Project references'],
    ['export_market', 'Export markets']
  ];
  var FIELD_ORDER = {};
  FIELDS.forEach(function (row, i) { FIELD_ORDER[row[0]] = i; });
  var PRODUCT = { PT: 'Power transformer', DT: 'Distribution transformer', DRY: 'Dry-type transformer' };
  var TEST_LABEL = {
    'short-circuit': 'Short-circuit test',
    impulse: 'Impulse test',
    'routine-type': 'Routine, type or FAT',
    'temperature-rise': 'Temperature-rise test'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function elinListing(slug, name) {
    var blob = String(slug || '') + ' ' + String(name || '');
    return /\belin\b/i.test(blob) || /elin-insulation/i.test(blob);
  }

  function labelStatus(slug, name, proposed) {
    if (elinListing(slug, name)) return 'company-declared';
    if (STATUSES.indexOf(proposed) >= 0) return proposed;
    return 'company-declared';
  }

  function cited(field) {
    if (!field || typeof field !== 'object') return null;
    var url = String(field.source_url || '').trim();
    var day = String(field.verified || field.checked_at || '').trim();
    var quote = String(field.quote || '').trim();
    if (!HTTP.test(url) || !DATE.test(day) || !quote) return null;
    if (/do_not_contact/i.test(url) || /do_not_contact/i.test(quote)) return null;
    return { url: url, day: day };
  }

  function money(text) {
    return /(?:\$|€|£)\s?\d/.test(String(text || ''));
  }

  function makeClaim(slug, name, field, display, cite, extra, proposed) {
    var shown = String(display || '').trim();
    if (!shown || shown === DASH || !cite) return null;
    if (money(shown)) return null;
    if (/do_not_contact/i.test(shown)) return null;
    var status = labelStatus(slug, name, proposed || 'company-declared');
    if (status === 'unverified') return null;
    var claim = {
      field: field,
      display: shown,
      source_url: cite.url,
      verification_status: status,
      checked: cite.day
    };
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        if (extra[key] != null && extra[key] !== '') claim[key] = extra[key];
      });
    }
    return claim;
  }

  function push(list, claim) {
    if (!claim) return;
    var key = claim.field + '|' + claim.display + '|' + claim.source_url;
    for (var i = 0; i < list.length; i++) {
      var have = list[i];
      if ((have.field + '|' + have.display + '|' + have.source_url) === key) return;
    }
    list.push(claim);
  }

  function rangeText(min, max, unit) {
    if (!(max > 0)) return '';
    if (min != null && min !== '' && Number(min) > 0 && Number(min) !== Number(max)) {
      return String(min) + '–' + String(max) + ' ' + unit;
    }
    return 'up to ' + String(max) + ' ' + unit;
  }

  function normName(value) {
    return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function indexBySlug(doc) {
    var out = {};
    ((doc && doc.companies) || []).forEach(function (row) {
      if (row && row.slug) out[row.slug] = row;
    });
    return out;
  }

  function buildCompany(spec, sourced, projects, slug) {
    var name = (spec && spec.name) || (sourced && sourced.name) || '';
    if (!slug || !name) return null;
    var claims = [];
    (spec && spec.products || []).forEach(function (product) {
      var cite = cited(product);
      var label = PRODUCT[product && product.code];
      if (!label) return;
      push(claims, makeClaim(slug, name, 'category', label, cite, { code: product.code }));
    });
    if (spec && spec.mva && spec.mva.basis !== 'annual') {
      var mvaCite = cited(spec.mva);
      var mvaText = rangeText(spec.mva.min, spec.mva.max, spec.mva.unit || 'MVA');
      push(claims, makeClaim(slug, name, 'rated_mva', mvaText, mvaCite, {
        mva_min: spec.mva.min,
        mva_max: spec.mva.max
      }));
    } else if (sourced && sourced.max_mva) {
      var maxMva = cited(sourced.max_mva);
      var maxMvaText = sourced.max_mva.shown || (sourced.max_mva.value ? 'up to ' + sourced.max_mva.value + ' MVA' : '');
      push(claims, makeClaim(slug, name, 'rated_mva', maxMvaText, maxMva, { mva_max: sourced.max_mva.value }));
    }
    if (spec && spec.max_voltage_kv) {
      var kvCite = cited(spec.max_voltage_kv);
      var kvText = spec.max_voltage_kv.value + ' kV' + (spec.max_voltage_kv.scope ? ' (' + spec.max_voltage_kv.scope + ')' : '');
      push(claims, makeClaim(slug, name, 'voltage_class', kvText, kvCite, { kv: spec.max_voltage_kv.value }));
    } else if (sourced && sourced.max_kv) {
      var maxKv = cited(sourced.max_kv);
      var maxKvText = sourced.max_kv.shown || (sourced.max_kv.value ? sourced.max_kv.value + ' kV' : '');
      push(claims, makeClaim(slug, name, 'voltage_class', maxKvText, maxKv, { kv: sourced.max_kv.value }));
    }
    var factoryCities = {};
    (spec && spec.plants || []).forEach(function (plant) {
      var cite = cited(plant);
      var place = [plant.city, plant.country].filter(Boolean).join(', ');
      var label = plant.label + (place ? ' — ' + place : '');
      if (plant.city) factoryCities[normName(plant.city)] = 1;
      push(claims, makeClaim(slug, name, 'factory', label, cite, { country: plant.country || '', city: plant.city || '' }));
    });
    if (sourced && sourced.factory) {
      var factory = sourced.factory;
      var factoryCite = cited(factory);
      var cityKey = normName(factory.city);
      if (!cityKey || !factoryCities[cityKey]) {
        var factoryLabel = [factory.city, factory.country].filter(Boolean).join(', ');
        push(claims, makeClaim(slug, name, 'factory', factoryLabel, factoryCite, {
          country: factory.country || '',
          city: factory.city || ''
        }));
      }
    }
    (sourced && sourced.tests || []).forEach(function (test) {
      var cite = cited(test);
      var label = TEST_LABEL[test.category] || test.category;
      push(claims, makeClaim(slug, name, 'testing', label, cite, { test: test.category }));
    });
    (sourced && sourced.standards || []).forEach(function (standard) {
      var cite = cited(standard);
      push(claims, makeClaim(slug, name, 'standard', standard.code, cite, { code: standard.code }));
    });
    (spec && spec.iso || []).forEach(function (iso) {
      var cite = cited(iso);
      var validity = iso.valid_until && DATE.test(iso.valid_until) ? iso.valid_until : DASH;
      var label = iso.standard + '. Validity ' + validity;
      push(claims, makeClaim(slug, name, 'certification', label, cite, {
        code: iso.standard,
        valid_until: iso.valid_until && DATE.test(iso.valid_until) ? iso.valid_until : ''
      }));
    });
    var want = normName(name);
    (projects || []).forEach(function (project) {
      if (!project || normName(project.manufacturer) !== want) return;
      if (project.transformer_requirement && project.transformer_requirement !== 'CONFIRMED') return;
      var url = Array.isArray(project.sources) ? project.sources[0] : '';
      var day = String(project.last_verified || '');
      if (!HTTP.test(String(url || '')) || !DATE.test(day)) return;
      var cite = { url: String(url).trim(), day: day };
      var label = project.project;
      push(claims, makeClaim(slug, name, 'project_reference', label, cite));
    });
    if (!claims.length) return null;
    claims.sort(function (a, b) {
      var field = (FIELD_ORDER[a.field] || 0) - (FIELD_ORDER[b.field] || 0);
      if (field) return field;
      return String(a.display).localeCompare(String(b.display));
    });
    var last = '';
    claims.forEach(function (claim) {
      if (!last || claim.checked > last) last = claim.checked;
    });
    return { slug: slug, name: name, last_reviewed: last, claims: claims };
  }

  function buildPublic(specsDoc, sourcedDoc, projectsDoc) {
    var specs = indexBySlug(specsDoc);
    var sourced = indexBySlug(sourcedDoc);
    var projects = (projectsDoc && projectsDoc.projects) || projectsDoc || [];
    if (!Array.isArray(projects)) projects = [];
    var slugs = {};
    Object.keys(specs).forEach(function (slug) { slugs[slug] = 1; });
    Object.keys(sourced).forEach(function (slug) { slugs[slug] = 1; });
    var companies = Object.keys(slugs).sort().map(function (slug) {
      return buildCompany(specs[slug], sourced[slug], projects, slug);
    }).filter(Boolean);
    return {
      note: 'Derived from sourced manufacturer pages and confirmed project records. A missing field is an em dash on the profile. Nothing here was added without a source URL. Company-declared means the supplier page stated it. Verified is not assigned by this file.',
      companies: companies
    };
  }

  function loadSources(fs, path, root) {
    function read(rel) {
      return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    }
    return buildPublic(
      read('data/manufacturer-specs.json'),
      read('data/sourced-spec-fields.json'),
      read('data/projects.json')
    );
  }

  function badge(status) {
    if (status === 'verified') return '<span class="evidence-badge" data-evidence="verified">Verified fact</span>';
    if (status === 'company-declared') return '<span class="evidence-badge" data-evidence="company-declared">Company-declared</span>';
    return '';
  }

  function claimLine(claim) {
    return esc(claim.display) + ' ' + badge(claim.verification_status) +
      ' <a href="' + esc(claim.source_url) + '" target="_blank" rel="noopener">source</a>' +
      ' <span style="color:var(--muted)">checked ' + esc(claim.checked) + '</span>';
  }

  function renderCompany(company) {
    var byField = {};
    ((company && company.claims) || []).forEach(function (claim) {
      if (!claim || !claim.field || !claim.display || !HTTP.test(claim.source_url || '')) return;
      if (STATUSES.indexOf(claim.verification_status) < 0 || claim.verification_status === 'unverified') return;
      (byField[claim.field] = byField[claim.field] || []).push(claim);
    });
    var rows = FIELDS.map(function (field) {
      var list = byField[field[0]] || [];
      var body = list.length ? list.map(claimLine).join('<br>') : DASH;
      return '<tr><th>' + field[1] + '</th><td>' + body + '</td></tr>';
    });
    var reviewed = company && DATE.test(company.last_reviewed || '') ? company.last_reviewed : DASH;
    rows.push('<tr><th>Last reviewed</th><td>' + esc(reviewed) + '</td></tr>');
    return '<section data-profile-claims="1" class="profile-claims">' +
      '<h2>Structured specifications</h2>' +
      '<p style="font-size:.84rem;color:var(--muted)">Verified fact and Company-declared are different labels. A Verified fact was checked against a source other than the supplier statement. A Company-declared figure is quoted from the supplier and linked. An empty field is —.</p>' +
      '<table class="tbl"><tbody>' + rows.join('') + '</tbody></table></section>';
  }

  function profileSlug() {
    if (typeof location === 'undefined') return '';
    var path = String(location.pathname || '').replace(/\/index\.html$/, '/');
    var match = path.match(/\/manufacturers\/([a-z0-9-]+)\/$/);
    return match ? match[1] : '';
  }

  function mount() {
    if (typeof document === 'undefined' || !document.querySelector('.claim-listing-row')) return;
    var slug = profileSlug();
    var main = document.querySelector('main.c-wrap') || document.getElementById('main');
    if (!slug || !main || main.querySelector('[data-profile-claims]')) return;
    function place(company) {
      var holder = document.createElement('div');
      holder.innerHTML = renderCompany(company || { slug: slug, claims: [] });
      var anchor = main.querySelector('h2');
      if (anchor && anchor.parentNode === main) main.insertBefore(holder, anchor);
      else main.appendChild(holder);
    }
    fetch('/data/profile-claims-public.json').then(function (res) {
      if (!res.ok) throw new Error('claims');
      return res.json();
    }).then(function (doc) {
      var found = null;
      ((doc && doc.companies) || []).forEach(function (row) {
        if (row && row.slug === slug) found = row;
      });
      place(found);
    }).catch(function () { place(null); });
  }

  function containsPrivate(value) {
    return /do_not_contact/i.test(JSON.stringify(value || {}));
  }

  return {
    DASH: DASH,
    FIELDS: FIELDS,
    STATUSES: STATUSES,
    elinListing: elinListing,
    labelStatus: labelStatus,
    buildPublic: buildPublic,
    loadSources: loadSources,
    renderCompany: renderCompany,
    mount: mount,
    containsPrivate: containsPrivate,
    money: money
  };
});
