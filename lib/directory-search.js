/* TransformerPath — segmented directory search.
 *
 * Shared by:
 *   - functions/directory-search.js  (SSR of /directory?q=…)
 *   - tests/check-directory-ssr.js
 *   - check-directory-search.js (optional)
 *
 * "Segmented" means the query is parsed into structured fields (voltage, MVA,
 * country, transformer type) and matched against those fields — not a bag of
 * words against a generic card. Each hit carries match_reasons so the rendered
 * result can show WHY it matched (e.g. "voltage evidence: 765 kV").
 */
'use strict';

const STOPWORDS = new Set([
  'manufacturer', 'manufacturers', 'supplier', 'suppliers', 'company', 'companies',
  'transformer', 'transformers', 'factory', 'factories', 'for', 'the', 'a', 'an',
  'and', 'make', 'makers', 'of', 'in', 'with', 'need', 'find', 'show', 'me',
]);

const TYPE_ALIASES = {
  gsu: 'gsu', 'generator step-up': 'gsu', 'generator step up': 'gsu',
  autotransformer: 'autotransformer', auto: 'autotransformer',
  'cast resin': 'cast_resin', 'cast-resin': 'cast_resin', dry: 'dry_type', 'dry type': 'dry_type', 'dry-type': 'dry_type',
  traction: 'traction', furnace: 'furnace', rectifier: 'rectifier',
  reactor: 'reactor', 'shunt reactor': 'reactor',
  'power transformer': 'power', power: 'power',
  distribution: 'distribution', 'distribution transformer': 'distribution',
};

function parseQuery(raw) {
  const q = String(raw || '').replace(/\+/g, ' ').trim();
  const lower = q.toLowerCase();
  const segments = { voltageKv: null, mva: null, country: null, types: [], tokens: [] };

  let rest = lower;

  const kv = rest.match(/\b(\d+(?:\.\d+)?)\s*-?\s*k\s*v\b/);
  if (kv) {
    segments.voltageKv = parseFloat(kv[1]);
    rest = rest.replace(kv[0], ' ');
  }

  const mva = rest.match(/\b(\d+(?:\.\d+)?)\s*-?\s*mva\b/);
  if (mva) {
    segments.mva = parseFloat(mva[1]);
    rest = rest.replace(mva[0], ' ');
  }

  Object.keys(TYPE_ALIASES).sort((a, b) => b.length - a.length).forEach((alias) => {
    const re = new RegExp('\\b' + alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(rest)) {
      segments.types.push(TYPE_ALIASES[alias]);
      rest = rest.replace(re, ' ');
    }
  });

  segments.tokens = rest.split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w) && w.length > 1);
  return { raw: q, segments };
}

function haystack(c) {
  const types = [];
  ['power', 'distribution', 'dry_type', 'special'].forEach((t) => {
    Object.keys((c.transformer_types && c.transformer_types[t]) || {}).forEach((k) => {
      if (k !== '__present') types.push(k.replace(/_/g, ' '));
    });
  });
  const fac = (c.factories || []).map((f) => ((f.city || '') + ' ' + (f.country || '') + ' ' + (f.produces || ''))).join(' ');
  return [
    c.name, c.country, c.region, c.headquarters,
    (c.product_codes || []).join(' '),
    (c.capability_labels || []).join(' '),
    types.join(' '),
    c.voltage && c.voltage.value,
    c.mva && c.mva.value,
    (c.certs || []).join(' '),
    fac,
  ].join(' ').toLowerCase();
}

function voltageNum(c) {
  if (c.voltage && typeof c.voltage.num === 'number') return c.voltage.num;
  const m = String((c.voltage && c.voltage.value) || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function mvaNum(c) {
  if (c.mva && typeof c.mva.num === 'number') return c.mva.num;
  const m = String((c.mva && c.mva.value) || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function typeHit(c, typeKey) {
  const t = c.transformer_types || {};
  if (typeKey === 'power') return !!(t.power && t.power.__present);
  if (typeKey === 'distribution') return !!(t.distribution && t.distribution.__present);
  if (typeKey === 'dry_type') return !!(t.dry_type && t.dry_type.__present);
  const buckets = ['power', 'distribution', 'dry_type', 'special'];
  for (let i = 0; i < buckets.length; i++) {
    if (t[buckets[i]] && t[buckets[i]][typeKey]) return true;
  }
  const labels = (c.capability_labels || []).join(' ').toLowerCase();
  const codes = (c.product_codes || []).join(' ').toLowerCase();
  return labels.indexOf(typeKey.replace(/_/g, ' ')) >= 0 || codes.indexOf(typeKey) >= 0;
}

function matchCompany(c, parsed) {
  const seg = parsed.segments;
  const reasons = [];
  const kv = voltageNum(c);
  const mva = mvaNum(c);
  const text = haystack(c);

  if (seg.voltageKv != null) {
    const valueStr = String((c.voltage && c.voltage.value) || '').toLowerCase();
    const facStr = (c.factories || []).map((f) => String(f.produces || '').toLowerCase()).join(' ');
    const kvHit = (kv != null && kv >= seg.voltageKv) ||
      valueStr.indexOf(String(seg.voltageKv)) >= 0 ||
      facStr.indexOf(String(seg.voltageKv) + ' kv') >= 0 ||
      facStr.indexOf(String(seg.voltageKv) + 'kv') >= 0;
    if (!kvHit) return null;
    reasons.push({
      field: 'voltage',
      label: kv != null
        ? ('voltage evidence: ' + (c.voltage.value || (kv + ' kV')) + (kv >= seg.voltageKv ? ' (≥ ' + seg.voltageKv + ' kV)' : ''))
        : ('voltage mention: ' + seg.voltageKv + ' kV'),
    });
  }

  if (seg.mva != null) {
    const valueStr = String((c.mva && c.mva.value) || '').toLowerCase();
    const mvaHit = (mva != null && mva >= seg.mva) || valueStr.indexOf(String(seg.mva)) >= 0;
    if (!mvaHit) return null;
    reasons.push({
      field: 'mva',
      label: 'capacity evidence: ' + (c.mva && c.mva.value ? c.mva.value : (mva + ' MVA')),
    });
  }

  for (let i = 0; i < seg.types.length; i++) {
    if (!typeHit(c, seg.types[i])) return null;
    reasons.push({ field: 'type', label: 'type: ' + seg.types[i].replace(/_/g, ' ') });
  }

  for (let i = 0; i < seg.tokens.length; i++) {
    if (text.indexOf(seg.tokens[i]) < 0) return null;
    if ((c.country || '').toLowerCase().indexOf(seg.tokens[i]) >= 0) {
      reasons.push({ field: 'country', label: 'country: ' + c.country });
    } else if ((c.name || '').toLowerCase().indexOf(seg.tokens[i]) >= 0) {
      reasons.push({ field: 'name', label: 'name match' });
    } else {
      reasons.push({ field: 'text', label: 'matched “' + seg.tokens[i] + '”' });
    }
  }

  if (!reasons.length && !seg.voltageKv && !seg.mva && !seg.types.length && !seg.tokens.length) return null;

  let score = 0;
  reasons.forEach((r) => {
    if (r.field === 'voltage') score += 50;
    else if (r.field === 'mva') score += 30;
    else if (r.field === 'type') score += 20;
    else if (r.field === 'country') score += 15;
    else if (r.field === 'name') score += 10;
    else score += 4;
  });
  if (c.kind === 'manufacturer') score += 3;
  if (c.evidence === 'CONFIRMED') score += 5;
  if (kv != null && seg.voltageKv != null && kv >= seg.voltageKv) score += Math.min(20, Math.round((kv - seg.voltageKv) / 50));

  return { company: c, reasons: reasons, score: score };
}

function profileUrl(c) {
  const slug = c.slug ? String(c.slug).replace(/^(acc|mach|lab|srv|log|asc|edu|buy|med):/, '') : '';
  if (c.kind === 'manufacturer' && slug) return '/manufacturers/' + slug + '/';
  if (c.kind === 'component_supplier') return slug ? '/accessories/' + slug + '/' : '/accessories.html';
  if (c.kind === 'machinery_manufacturer') return '/machinery.html';
  if (c.kind === 'testing_laboratory') return '/laboratories.html';
  if (c.kind === 'service_repair') return '/services.html';
  if (c.kind === 'transport_logistics') return '/logistics.html';
  if (c.kind === 'industry_association') return '/associations.html';
  if (c.kind === 'education_provider') return '/education.html';
  if (c.kind === 'buyer_procurement') return '/buyers.html';
  if (c.kind === 'media_publication') return '/media.html';
  return c.website || '/directory.html';
}

function search(companies, query, opts) {
  const parsed = parseQuery(query);
  const limit = (opts && opts.limit) || 80;
  const hits = [];
  for (let i = 0; i < companies.length; i++) {
    const m = matchCompany(companies[i], parsed);
    if (m) hits.push(m);
  }
  hits.sort((a, b) => b.score - a.score || String(a.company.name).localeCompare(String(b.company.name)));
  return {
    query: parsed.raw,
    segments: parsed.segments,
    total: hits.length,
    hits: hits.slice(0, limit).map((h) => ({
      id: h.company.id,
      kind: h.company.kind,
      name: h.company.name,
      slug: h.company.slug,
      country: h.company.country,
      region: h.company.region,
      website: h.company.website,
      evidence: h.company.evidence,
      voltage: h.company.voltage,
      mva: h.company.mva,
      capability_labels: (h.company.capability_labels || []).slice(0, 8),
      href: profileUrl(h.company),
      match_reasons: h.reasons,
      score: h.score,
    })),
  };
}

module.exports = { parseQuery, search, haystack, voltageNum, profileUrl, STOPWORDS };
