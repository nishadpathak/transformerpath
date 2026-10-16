/* Sourced cooling class, unit rating, standards, test evidence and factory city.
 *
 * A value is kept only when its quote is the page text, with a source URL and
 * checked_at. Cooling on a page that states its own MVA ceiling uses that
 * ceiling for landing pages. A landing page exists only when at least three
 * manufacturers in one country clear one cooling class and one MVA floor, and
 * the same set is not already published at a higher floor.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FLOORS = [1000, 500, 250, 100, 50, 25, 10, 5];
const COOLING_CODES = ['ONAN', 'ONAF', 'OFAF', 'ODAF', 'OFWF', 'ODWF', 'KNAN', 'KNAF', 'AN', 'AF'];
const TEST_CATEGORIES = {
  'short-circuit': /\bshort[\s-]*circuit\b/i,
  impulse: /\bimpulse\b|darbe/i,
  'routine-type': /\b(routine|type|special|fat)\b|tip\s+test/i,
  'temperature-rise': /\b(temperature[\s-]*rise|heat run)\b|s[ıi]cakl[ıi]k art[ıi][sş]/i
};
const NAME_DENY = /\b(ajay|prabhat|jitendra|mamtora|g[uü]re|atilla)\b/i;
const PLACE_DENY = /\bDubai\b|\bUAE\b|United Arab Emirates/;

function load(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data', 'sourced-spec-fields.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function quoteHasCode(quote, code) {
  const re = new RegExp('(?<![A-Za-z])' + code + '(?![A-Za-z])');
  return re.test(String(quote || ''));
}

function parseShown(shown) {
  const m = String(shown || '').trim().match(/^(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(\s*)(kVA|MVA|kV)$/i);
  if (!m) return null;
  let num = m[1];
  const unit = m[3].toUpperCase();
  if (/^\d{1,3}(?:\.\d{3})+$/.test(num)) num = num.replace(/\./g, '');
  else num = num.replace(/,/g, '');
  let value = Number(num);
  if (!isFinite(value)) return null;
  if (unit === 'KVA') value = value / 1000;
  const kind = unit === 'KV' ? 'kV' : 'MVA';
  return { value: Math.round(value * 1000) / 1000, kind: kind };
}

function near(a, b) {
  return Math.abs(a - b) < 0.001;
}

function fold(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function citationErrors(row, label) {
  const errors = [];
  if (!row || typeof row !== 'object') return [label + ' missing'];
  if (!row.source_url || !/^https?:\/\//i.test(row.source_url)) errors.push(label + ' source_url');
  if (!DATE.test(row.checked_at || '')) errors.push(label + ' checked_at');
  if (!String(row.quote || '').trim()) errors.push(label + ' quote');
  const blob = String(row.quote || '') + ' ' + String(row.ceiling_quote || '');
  if (NAME_DENY.test(blob)) errors.push(label + ' personal name');
  if (PLACE_DENY.test(blob)) errors.push(label + ' place branding');
  return errors;
}

function numberErrors(row, label, kind) {
  const errors = citationErrors(row, label);
  const parsed = parseShown(row && row.shown);
  if (!parsed || parsed.kind !== kind) errors.push(label + ' shown');
  else if (!near(parsed.value, row.value)) errors.push(label + ' value');
  else if (String(row.quote || '').indexOf(row.shown) < 0 && String(row.ceiling_quote || '').indexOf(row.shown) < 0) {
    errors.push(label + ' shown not in quote');
  }
  return errors;
}

function validate(doc) {
  const errors = [];
  const companies = doc && doc.companies;
  if (!Array.isArray(companies) || !companies.length) return ['companies missing'];
  const seen = {};
  companies.forEach(function (c) {
    if (!c || !c.slug || !c.name || !c.country) {
      errors.push('record missing slug, name or country');
      return;
    }
    if (seen[c.slug]) errors.push('duplicate slug ' + c.slug);
    seen[c.slug] = 1;
    (c.cooling || []).forEach(function (row) {
      errors.push.apply(errors, citationErrors(row, c.slug + ' ' + row.code));
      if (COOLING_CODES.indexOf(row.code) < 0) errors.push(c.slug + ' cooling code ' + row.code);
      if (!quoteHasCode(row.quote, row.code)) errors.push(c.slug + ' quote misses ' + row.code);
      if (row.applies_up_to_mva != null) {
        const parsed = parseShown(row.shown);
        if (!parsed || parsed.kind !== 'MVA' || !near(parsed.value, row.applies_up_to_mva)) {
          errors.push(c.slug + ' cooling ceiling ' + row.code);
        }
        if (String(row.ceiling_quote || row.quote || '').indexOf(row.shown) < 0) {
          errors.push(c.slug + ' ceiling quote ' + row.code);
        }
      }
    });
    if (c.max_mva) errors.push.apply(errors, numberErrors(c.max_mva, c.slug + ' mva', 'MVA'));
    if (c.max_kv) errors.push.apply(errors, numberErrors(c.max_kv, c.slug + ' kv', 'kV'));
    (c.standards || []).forEach(function (row) {
      errors.push.apply(errors, citationErrors(row, c.slug + ' standard'));
      const chunks = String(row.code || '').split(/[^A-Za-z0-9]+/).filter(function (part) { return part.length >= 2; });
      const quote = String(row.quote || '').toLowerCase();
      if (!chunks.length || chunks.some(function (part) { return quote.indexOf(part.toLowerCase()) < 0; })) {
        errors.push(c.slug + ' standard not in quote ' + row.code);
      }
    });
    (c.tests || []).forEach(function (row) {
      errors.push.apply(errors, citationErrors(row, c.slug + ' test'));
      const re = TEST_CATEGORIES[row.category];
      if (!re) errors.push(c.slug + ' test category ' + row.category);
      else if (!re.test(row.quote || '')) errors.push(c.slug + ' test quote ' + row.category);
    });
    if (c.testing_statement) {
      errors.push.apply(errors, citationErrors(c.testing_statement, c.slug + ' testing statement'));
      if (!/\btests?\b|\btesting\b/i.test(c.testing_statement.quote || '')) {
        errors.push(c.slug + ' testing statement does not say test');
      }
    }
    if (c.factory) {
      errors.push.apply(errors, citationErrors(c.factory, c.slug + ' factory'));
      if (!c.factory.city || fold(c.factory.quote).indexOf(fold(c.factory.city)) < 0) {
        errors.push(c.slug + ' factory city not in quote');
      }
    }
  });
  return errors;
}

function coolingCeiling(company, code) {
  const row = (company.cooling || []).filter(function (item) { return item.code === code; })[0];
  if (!row) return null;
  if (row.applies_up_to_mva != null) return row.applies_up_to_mva;
  if (company.max_mva && company.max_mva.value != null) return company.max_mva.value;
  return null;
}

function countrySlug(name) {
  const key = String(name || '').toLowerCase();
  if (key === 'türkiye' || key === 'turkey') return 'turkiye';
  return key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function countWord(n) {
  return ({ 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' })[n] || String(n);
}

function descriptionFor(page) {
  const head = countWord(page.companies.length) + ' sourced manufacturers in ' + page.country +
    ' state ' + page.cooling + ' cooling and a unit rating of at least ' + page.floor + ' MVA.';
  let text = head + ' Each row quotes the manufacturer page that was read.';
  const extras = [' No unsourced name is added to fill the list.', ' Checked 16 October 2026.'];
  extras.forEach(function (extra) {
    if (text.length < 140 && text.length + extra.length <= 160) text += extra;
  });
  return text;
}

function titleFor(page) {
  return page.cooling + ' ' + page.floor + ' MVA manufacturers in ' + page.country + ' | TransformerPath';
}

function indexCopy() {
  return {
    title: 'Cooling and MVA manufacturer groups | TransformerPath',
    description: 'Groups pair a sourced cooling class, an MVA floor and a country. A page is published only when at least three manufacturers match. Shorter lists are omitted.',
    h1: 'Cooling and MVA manufacturer groups'
  };
}

function landings(doc) {
  const companies = (doc && doc.companies) || [];
  const codes = [];
  const countries = [];
  companies.forEach(function (c) {
    if (countries.indexOf(c.country) < 0) countries.push(c.country);
    (c.cooling || []).forEach(function (row) {
      if (codes.indexOf(row.code) < 0) codes.push(row.code);
    });
  });
  codes.sort();
  countries.sort();
  const seen = {};
  const out = [];
  FLOORS.forEach(function (floor) {
    codes.forEach(function (code) {
      countries.forEach(function (country) {
        const rows = companies.filter(function (c) {
          if (c.country !== country) return false;
          const cap = coolingCeiling(c, code);
          return cap != null && cap >= floor;
        }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        if (rows.length < 3) return;
        const sig = rows.map(function (c) { return c.slug; }).join('|');
        const key = code + '|' + country;
        seen[key] = seen[key] || {};
        if (seen[key][sig]) return;
        seen[key][sig] = 1;
        const slug = code.toLowerCase() + '-' + floor + '-mva-' + countrySlug(country);
        const page = {
          slug: slug,
          cooling: code,
          floor: floor,
          country: country,
          path: 'manufacturers/specs/' + slug + '/index.html',
          urlPath: '/manufacturers/specs/' + slug + '/',
          h1: code + ' ' + floor + ' MVA manufacturers in ' + country,
          companies: rows,
          checked_at: (doc && doc.checked_at) || rows[0].cooling[0].checked_at
        };
        page.title = titleFor(page);
        page.description = descriptionFor(page);
        out.push(page);
      });
    });
  });
  out.sort(function (a, b) {
    return (a.country + a.cooling + String(a.floor)).localeCompare(b.country + b.cooling + String(b.floor));
  });
  return out;
}

function certFamilies(code) {
  const u = String(code || '').toUpperCase();
  const out = [];
  ['IEC', 'IEEE', 'ISO', 'UL'].forEach(function (family) {
    if (u.indexOf(family) >= 0) out.push(family);
  });
  return out;
}

module.exports = {
  load: load,
  validate: validate,
  landings: landings,
  indexCopy: indexCopy,
  coolingCeiling: coolingCeiling,
  quoteHasCode: quoteHasCode,
  parseShown: parseShown,
  certFamilies: certFamilies,
  descriptionFor: descriptionFor,
  titleFor: titleFor,
  FLOORS: FLOORS,
  COOLING_CODES: COOLING_CODES
};
