/* Sourced manufacturer specifications.
 *
 * A field is present only when a public page states it. The quote is the
 * page text, source_url is that page, and verified is the day it was read.
 * Empty means no public source is on file.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function load(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data', 'manufacturer-specs.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function citationOk(field, label) {
  const errors = [];
  if (!field || typeof field !== 'object') return ['missing'];
  if (!field.source_url || !/^https?:\/\//i.test(field.source_url)) errors.push(label + ' source_url');
  if (!DATE.test(field.verified || '')) errors.push(label + ' verified');
  if (!String(field.quote || '').trim()) errors.push(label + ' quote');
  return errors;
}

function validate(doc) {
  const errors = [];
  const companies = doc && doc.companies;
  if (!Array.isArray(companies)) return ['companies array missing'];
  if (companies.length < 140 || companies.length > 160) errors.push('company count ' + companies.length);
  const seen = {};
  companies.forEach(function (c) {
    if (!c || !c.slug || !c.name) {
      errors.push('record missing slug or name');
      return;
    }
    if (seen[c.slug]) errors.push('duplicate slug ' + c.slug);
    seen[c.slug] = 1;
    if (c.max_voltage_kv) {
      errors.push.apply(errors, citationOk(c.max_voltage_kv, c.slug + ' voltage'));
      if (!(c.max_voltage_kv.value > 0)) errors.push(c.slug + ' voltage value');
    }
    if (c.mva) {
      errors.push.apply(errors, citationOk(c.mva, c.slug + ' mva'));
      if (c.mva.max != null && !(c.mva.max > 0)) errors.push(c.slug + ' mva max');
      if (c.mva.min != null && c.mva.max != null && c.mva.min > c.mva.max) errors.push(c.slug + ' mva range');
    }
    (c.plants || []).forEach(function (p, i) {
      errors.push.apply(errors, citationOk(p, c.slug + ' plant ' + i));
      if (!String(p.label || '').trim()) errors.push(c.slug + ' plant label');
    });
    (c.iso || []).forEach(function (p, i) {
      errors.push.apply(errors, citationOk(p, c.slug + ' iso ' + i));
      if (!/^ISO\s?\d{4,5}$/i.test(p.standard || '')) errors.push(c.slug + ' iso standard');
    });
    if (c.parent) {
      errors.push.apply(errors, citationOk(c.parent, c.slug + ' parent'));
      if (!c.parent.name) errors.push(c.slug + ' parent name');
    }
    (c.products || []).forEach(function (p, i) {
      errors.push.apply(errors, citationOk(p, c.slug + ' product ' + i));
      if (['PT', 'DT', 'DRY'].indexOf(p.code) < 0) errors.push(c.slug + ' product code');
    });
  });
  return errors;
}

function withVoltageAtLeast(doc, kv) {
  return (doc.companies || []).filter(function (c) {
    return c.max_voltage_kv && c.max_voltage_kv.value >= kv;
  });
}

function withProduct(doc, code) {
  return (doc.companies || []).filter(function (c) {
    return (c.products || []).some(function (p) { return p.code === code; });
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cite(field) {
  return '<a href="' + esc(field.source_url) + '" target="_blank" rel="noopener">source</a> <span style="color:var(--muted)">checked ' + esc(field.verified) + '</span>';
}

function renderHtml(spec) {
  if (!spec) return '';
  const rows = [];
  if (spec.max_voltage_kv) {
    const v = spec.max_voltage_kv;
    rows.push(['Maximum voltage stated', esc(v.value) + ' kV' + (v.scope ? ' (' + esc(v.scope) + ')' : '') + '. ' + cite(v) + '<br><q>' + esc(v.quote) + '</q>']);
  }
  if (spec.mva) {
    const m = spec.mva;
    const range = (m.min != null ? esc(m.min) + '–' : 'up to ') + esc(m.max) + ' ' + esc(m.unit || 'MVA');
    const basis = m.basis === 'annual' ? ' annual' : '';
    rows.push(['MVA' + basis, range + '. ' + cite(m) + '<br><q>' + esc(m.quote) + '</q>']);
  }
  if (spec.plants && spec.plants.length) {
    const body = spec.plants.map(function (p) {
      const place = [p.city, p.country].filter(Boolean).join(', ');
      return esc(p.label) + (place ? ' — ' + esc(place) : '') + '. ' + cite(p) + '<br><q>' + esc(p.quote) + '</q>';
    }).join('<br>');
    rows.push(['Plants', body]);
  }
  if (spec.iso && spec.iso.length) {
    const body = spec.iso.map(function (p) {
      return esc(p.standard) + '. ' + cite(p) + '<br><q>' + esc(p.quote) + '</q>';
    }).join('<br>');
    rows.push(['ISO certifications', body]);
  }
  if (spec.parent) {
    const p = spec.parent;
    const link = p.slug
      ? '<a href="../../manufacturers/' + esc(p.slug) + '/">' + esc(p.name) + '</a>'
      : esc(p.name);
    rows.push(['Parent company', link + '. ' + cite(p) + '<br><q>' + esc(p.quote) + '</q>']);
  }
  if (!rows.length) return '';
  return '<h2>Sourced specifications</h2><table class="tbl"><tbody>' +
    rows.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') +
    '</tbody></table><p style="font-size:.72rem;color:var(--muted)">Only figures quoted from the linked page are shown. A missing line means that field has no public source on file.</p>';
}

const MIN_HUB = 5;

function hub(slug, title, h1, lead, companies) {
  return {
    slug: slug,
    path: 'manufacturers/sourced/' + slug + '/index.html',
    urlPath: '/manufacturers/sourced/' + slug + '/',
    title: title,
    h1: h1,
    lead: lead,
    companies: companies.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
  };
}

/** Landing pages that have at least five makers with a sourced qualifying field. */
function hubs(doc) {
  const out = [];
  const power = withProduct(doc, 'PT');
  if (power.length >= MIN_HUB) {
    out.push(hub(
      'power-transformers',
      'Power transformers with a sourced rating | TransformerPath',
      'Power transformers',
      power.length + ' manufacturers whose own page states that they build power transformers. Each row links to that page and quotes the sentence that was read.',
      power
    ));
  }
  const kv = withVoltageAtLeast(doc, 400);
  if (kv.length >= MIN_HUB) {
    out.push(hub(
      '400-kv',
      'Makers sourced at 400 kV and above | TransformerPath',
      '400 kV and above',
      kv.length + ' manufacturers with a public page that states a transformer voltage of 400 kV or higher. The quote on each row is the sentence that was read. A DC converter rating is labeled as such.',
      kv
    ));
  }
  const distribution = withProduct(doc, 'DT');
  if (distribution.length >= MIN_HUB) {
    out.push(hub(
      'distribution-transformers',
      'Distribution transformers from sourced pages | TransformerPath',
      'Distribution transformers',
      distribution.length + ' manufacturers whose own page states that they build distribution transformers.',
      distribution
    ));
  }
  const dry = withProduct(doc, 'DRY');
  if (dry.length >= MIN_HUB) {
    out.push(hub(
      'dry-type-transformers',
      'Dry-type transformers from sourced pages | TransformerPath',
      'Dry-type transformers',
      dry.length + ' manufacturers whose own page states that they build dry-type transformers.',
      dry
    ));
  }
  return out;
}

module.exports = {
  load: load,
  validate: validate,
  withVoltageAtLeast: withVoltageAtLeast,
  withProduct: withProduct,
  renderHtml: renderHtml,
  hubs: hubs,
  MIN_HUB: MIN_HUB
};
