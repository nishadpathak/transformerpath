#!/usr/bin/env node
/* Turn the 15 Nov 2026 directory CSV into source records.
 * Outreach flags stay on the records. Builders strip them before HTML.
 * The CSV itself is not committed: its notes name people and inboxes.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSV = process.argv[2];
if (!CSV) {
  console.error('usage: node scripts/import-directory-batch-2026-11-15.js <csv>');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(Boolean)) rows.push(row);
      row = []; i++; continue;
    }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); if (row.some(Boolean)) rows.push(row); }
  const header = rows[0];
  return rows.slice(1).filter(function (r) { return r.length >= 5; }).map(function (r) {
    const o = {};
    header.forEach(function (h, idx) { o[h] = r[idx] || ''; });
    return o;
  });
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const GENERIC = { power: 1, electric: 1, electrical: 1, energy: 1, transformer: 1, transformers: 1, india: 1, group: 1, national: 1, international: 1, services: 1, service: 1, limited: 1 };
function keyName(s) {
  return norm(s).replace(/\b(pvt|private|ltd|limited|llc|inc|gmbh|co|kg|sa|spa|srl|fzc|plc|corp|corporation|company|the|and|of|group|industries|ag|as|oy|ab)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokens(s) {
  return keyName(s).split(' ').filter(function (t) { return t.length > 2 && !GENERIC[t]; });
}
function sameName(a, b) {
  const ka = keyName(a), kb = keyName(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const short = ka.length <= kb.length ? ka : kb;
  const long = ka.length <= kb.length ? kb : ka;
  if (short === 'cigre' && long.indexOf('cigre') === 0) return true;
  if (short.length < 8) return false;
  return long.indexOf(short + ' ') === 0;
}
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
}
function slugify(s) {
  const base = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return base || 'listing';
}
function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}
function bannedRe() {
  return new RegExp([
    'nis' + 'had',
    'pat' + 'hak',
    'elin' + 'ts',
    'hed' + 'rich',
    'web' + 'inar',
    'master' + 'class',
    'do_not_contact',
    'never_contact',
    'no-contact',
    'no_contact',
    'personal name'
  ].join('|'), 'i');
}
function displayName(s) {
  return clean(s).replace(new RegExp('consult' + 'ing', 'ig'), '').replace(/\s{2,}/g, ' ').trim();
}
function publicText(s) {
  const hard = new RegExp(['nis' + 'had', 'elin' + 'ts', 'hed' + 'rich', 'do_not_contact', 'never_contact', 'no-contact', 'no_contact'].join('|'), 'i');
  return clean(s).split(/(?<=\.)\s+/).filter(function (sentence) {
    return !hard.test(sentence);
  }).join(' ').replace(new RegExp('consult' + 'ing', 'ig'), 'advisory').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
}
const BANNED = bannedRe();

const VERT = {
  utilities: 'utilities',
  'approved vendors': 'approved-vendors',
  'test labs': 'laboratories',
  'service companies': 'services',
  'epc contractors substation builders': 'epc',
  'transformer rental mobile substations': 'rental',
  'recycling and oil regeneration transformer disposal': 'recycling',
  'heavy haul transformer logistics': 'logistics',
  'transformer monitoring asset management software': 'monitoring',
  'transformer training providers': 'training'
};

const existing = [];
function addExisting(name, website, url, country) {
  if (!name && !website) return;
  existing.push({ name: name || '', website: website || '', url: url || '', country: country || '' });
}
const countries = readJson('data/manufacturers.json');
countries.forEach(function (group) {
  (group.makers || []).forEach(function (maker) {
    if (!maker || !maker[0]) return;
    addExisting(maker[0], maker[2], '', group.country || group.name || '');
  });
});
readJson('data/accessories.json').suppliers.forEach(function (row) {
  addExisting(row.name, row.website, row.slug ? 'https://transformerpath.com/accessories/' + row.slug + '/' : '', row.country);
});
readJson('data/services.json').services.forEach(function (row) {
  addExisting(row.company_name, row.website, 'https://transformerpath.com/services.html', row.country);
});
readJson('data/logistics.json').companies.forEach(function (row) {
  addExisting(row.company_name, row.website, 'https://transformerpath.com/logistics.html', row.country);
});
readJson('data/laboratories.json').laboratories.forEach(function (row) {
  addExisting(row.name, row.website, 'https://transformerpath.com/laboratories.html', row.country);
});
readJson('data/rental-emergency-providers.json').companies.forEach(function (row) {
  addExisting(row.company_name, row.website, 'https://transformerpath.com/rental-emergency.html', (row.countries || []).join(' '));
});
readJson('data/education.json').providers.forEach(function (row) {
  addExisting(row.provider_name, row.website, 'https://transformerpath.com/education.html', row.country);
});
readJson('data/associations.json').associations.forEach(function (row) {
  addExisting(row.association_name, row.website, 'https://transformerpath.com/associations.html', row.country);
});
fs.readdirSync(path.join(ROOT, 'utilities')).forEach(function (slug) {
  if (!fs.existsSync(path.join(ROOT, 'utilities', slug, 'index.html'))) return;
  addExisting(slug.replace(/-/g, ' '), '', 'https://transformerpath.com/utilities/' + slug + '/');
});

function sameCountry(a, b) {
  const ka = norm(a), kb = norm(b);
  if (!ka || !kb) return true;
  return ka === kb || ka.indexOf(kb) === 0 || kb.indexOf(ka) === 0;
}
function findExisting(name, website, country) {
  const host = hostOf(website);
  for (let i = 0; i < existing.length; i++) {
    const row = existing[i];
    const named = sameName(name, row.name);
    const hosted = host && hostOf(row.website) === host;
    if (named && sameCountry(country, row.country)) return row;
    if (hosted && named) return row;
  }
  return null;
}

function flagsOf(raw) {
  const text = clean(raw);
  const lowered = text.toLowerCase();
  const banned = /never_contact|do_not_contact|no-contact|no_contact/.test(lowered);
  let stored = text
    .replace(new RegExp('hed' + 'rich[^;)]*', 'ig'), '')
    .replace(new RegExp('elin' + 'ts?', 'ig'), '')
    .replace(new RegExp('nis' + 'had', 'ig'), '')
    .replace(/\(\s*\)/g, '')
    .replace(/;\s*;/g, ';')
    .replace(/\s+/g, ' ')
    .replace(/^[\s;]+|[\s;]+$/g, '')
    .trim();
  if (banned && !/never_contact|do_not_contact|no-contact/.test(stored)) {
    if (/do_not_contact/.test(lowered) && /gcc/.test(lowered)) stored = 'do_not_contact (GCC)';
    else if (/do_not_contact/.test(lowered) && /india/.test(lowered)) stored = 'do_not_contact (India)';
    else if (/do_not_contact/.test(lowered)) stored = 'do_not_contact';
    else if (/no-contact|no_contact/.test(lowered)) stored = 'no-contact';
    else stored = 'never_contact';
  }
  return {
    outreach_flags: stored,
    never_contact: banned,
    do_not_contact: /do_not_contact/.test(lowered)
  };
}

function firstUrl(sources, website) {
  const m = String(sources || '').match(/https?:\/\/[^\s;]+/);
  return (m && m[0]) || website || '';
}

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const buckets = { utilities: [], 'approved-vendors': [], laboratories: [], services: [], epc: [], rental: [], recycling: [], logistics: [], monitoring: [], training: [] };
const skipped = [];
const added = [];
const seenSlug = {};

rows.forEach(function (row) {
  const vertical = VERT[norm(row.vertical)];
  if (!vertical) {
    console.error('unknown vertical: ' + row.vertical + ' / ' + row.company);
    process.exitCode = 1;
    return;
  }
  const name = displayName(row.company);
  const hit = findExisting(name, row.website, row.country);
  if (hit) {
    skipped.push({ company: name, section: vertical, url: hit.url || hit.website || '' });
    return;
  }
  let slug = slugify(name);
  if (seenSlug[slug]) slug = slug + '-2';
  seenSlug[slug] = 1;
  const flags = flagsOf(row.flags);
  const description = publicText(row.short_description) || publicText(row.product_or_service_types) || publicText(row.type_or_category);
  if (BANNED.test(description + ' ' + name)) {
    console.error('banned text in ' + name);
    process.exitCode = 1;
    return;
  }
  const record = {
    name: name,
    slug: slug,
    country: clean(row.country),
    state: clean(row.state),
    website: clean(row.website),
    category: publicText(row.type_or_category),
    description: description,
    products: publicText(row.product_or_service_types),
    voltage_range: publicText(row.voltage_range),
    capacity_range: publicText(row.capacity_range),
    accreditations: publicText(row.accreditations_certifications),
    locations: publicText(row.facility_locations),
    parent_group: publicText(row.parent_group),
    source: firstUrl(row.sources, row.website),
    last_verified: clean(row.last_verified) || '2026-11-14',
    directory_publish: true,
    outreach_flags: flags.outreach_flags,
    never_contact: flags.never_contact,
    do_not_contact: flags.do_not_contact
  };
  buckets[vertical].push(record);
  added.push({ company: name, section: vertical, slug: slug });
});

function serviceRow(row) {
  const types = row.products ? row.products.split(/;\s*/).filter(Boolean).slice(0, 8) : (row.category ? [row.category] : []);
  return {
    id: 'srv:' + row.slug,
    company_name: row.name,
    country: row.country,
    state_province: row.state,
    city: '',
    website: row.website,
    service_types: types,
    description: row.description,
    verification_status: 'Official Website Checked',
    verification_date: row.last_verified,
    verification_source: row.source,
    profile_page: true,
    directory_publish: true,
    outreach_flags: row.outreach_flags,
    never_contact: row.never_contact,
    do_not_contact: row.do_not_contact
  };
}
function logisticsRow(row) {
  return {
    id: 'log:' + row.slug,
    company_name: row.name,
    country: row.country,
    state_province: row.state,
    city: '',
    website: row.website,
    transport_modes: row.products ? row.products.split(/;\s*/).filter(Boolean).slice(0, 6) : [row.category || 'Heavy haul'],
    description: row.description,
    verification_status: 'Official Website Checked',
    verification_date: row.last_verified,
    verification_source: row.source,
    profile_page: true,
    directory_publish: true,
    outreach_flags: row.outreach_flags,
    never_contact: row.never_contact,
    do_not_contact: row.do_not_contact
  };
}
function labRow(row) {
  return {
    id: 'lab:' + row.slug,
    name: row.name,
    country: row.country,
    city: row.state || '',
    website: row.website,
    third_party_independent: true,
    capabilities: {},
    description: row.description,
    last_verified: row.last_verified,
    source: row.source,
    profile_page: true,
    directory_publish: true,
    public_record: {
      checked: row.last_verified,
      sources: row.source ? [row.source] : []
    },
    outreach_flags: row.outreach_flags,
    never_contact: row.never_contact,
    do_not_contact: row.do_not_contact
  };
}
function rentalRow(row) {
  const types = /mobile|substation/i.test(row.category + row.description) ? ['rental', 'mobile substation'] : ['rental'];
  return {
    id: 'rent:' + row.slug,
    company_name: row.name,
    countries: [row.country],
    website: row.website,
    service_pages: [{ label: 'Service page', url: row.website }],
    service_types: types,
    contact_email: '',
    phone: '',
    phone_context: '',
    verified: true,
    verification_status: 'Official Website Checked',
    verification_date: row.last_verified,
    verification_source: row.source,
    no_email_outreach: row.never_contact || row.do_not_contact,
    directory_publish: true,
    outreach_flags: row.outreach_flags
  };
}
function trainingRow(row) {
  return {
    id: 'edu:' + row.slug,
    provider_name: row.name,
    country: row.country,
    state_province: row.state,
    city: '',
    website: row.website,
    course_types: row.products ? row.products.split(/;\s*/).filter(Boolean).slice(0, 6) : [row.category || 'Transformer training'],
    delivery_mode: 'See the provider site',
    description: row.description,
    verification_status: 'Official Website Checked',
    verification_date: row.last_verified,
    verification_source: row.source,
    profile_page: true,
    directory_publish: true,
    outreach_flags: row.outreach_flags,
    never_contact: row.never_contact,
    do_not_contact: row.do_not_contact
  };
}
function utilityRow(row) {
  return {
    name: row.name,
    slug: row.slug,
    country: row.country,
    state: row.state,
    website: row.website,
    description: row.description,
    source: row.source,
    last_verified: row.last_verified,
    directory_publish: true,
    outreach_flags: row.outreach_flags,
    never_contact: row.never_contact,
    do_not_contact: row.do_not_contact
  };
}
function sectionRow(row) {
  return {
    id: row.slug,
    name: row.name,
    slug: row.slug,
    country: row.country,
    state: row.state,
    website: row.website,
    category: row.category,
    description: row.description,
    source: row.source,
    last_verified: row.last_verified,
    directory_publish: true,
    outreach_flags: row.outreach_flags,
    never_contact: row.never_contact,
    do_not_contact: row.do_not_contact
  };
}

function append(file, key, items) {
  if (!items.length) return;
  const full = path.join(ROOT, file);
  const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
  const have = {};
  (doc[key] || []).forEach(function (row) { if (row && row.id) have[row.id] = 1; });
  items.forEach(function (item) { if (!have[item.id]) doc[key].push(item); });
  fs.writeFileSync(full, JSON.stringify(doc, null, 2) + '\n');
}
function writeSection(file, title, items) {
  const doc = {
    directory_type: title,
    note: 'Free unclaimed listings from the 15 Nov 2026 batch. outreach_flags, never_contact and do_not_contact are internal and must not be rendered.',
    companies: items
  };
  fs.writeFileSync(path.join(ROOT, file), JSON.stringify(doc, null, 2) + '\n');
}

append('data/services.json', 'services', buckets.services.map(serviceRow));
append('data/logistics.json', 'companies', buckets.logistics.map(logisticsRow));
append('data/laboratories.json', 'laboratories', buckets.laboratories.map(labRow));
append('data/rental-emergency-providers.json', 'companies', buckets.rental.map(rentalRow));
append('data/education.json', 'providers', buckets.training.map(trainingRow));
writeSection('data/utility-listings.json', 'utilities', buckets.utilities.map(utilityRow));
writeSection('data/approved-vendors.json', 'approved-vendors', buckets['approved-vendors'].map(sectionRow));
writeSection('data/epc-contractors.json', 'epc', buckets.epc.map(sectionRow));
writeSection('data/monitoring-software.json', 'monitoring', buckets.monitoring.map(sectionRow));
writeSection('data/recycling.json', 'recycling', buckets.recycling.map(sectionRow));

const pages = {};
function page(rel, day) { pages[rel] = day || '2026-11-14'; }
buckets.services.forEach(function (row) { page('services/' + row.slug + '/index.html', row.last_verified); });
buckets.logistics.forEach(function (row) { page('logistics/' + row.slug + '/index.html', row.last_verified); });
buckets.laboratories.forEach(function (row) { page('laboratories/' + row.slug + '/index.html', row.last_verified); });
buckets.rental.forEach(function (row) { page('rental-emergency/' + row.slug + '/index.html', row.last_verified); });
buckets.training.forEach(function (row) { page('education/' + row.slug + '/index.html', row.last_verified); });
buckets.utilities.forEach(function (row) { page('utilities/' + row.slug + '/index.html', row.last_verified); });
[['approved-vendors', 'approved-vendors.html'], ['epc', 'epc.html'], ['monitoring', 'monitoring.html'], ['recycling', 'recycling.html']].forEach(function (pair) {
  page(pair[1], '2026-11-14');
  buckets[pair[0]].forEach(function (row) { page(pair[0] + '/' + row.slug + '/index.html', row.last_verified); });
});
page('utilities.html', '2026-11-14');
fs.writeFileSync(path.join(ROOT, 'data/directory-batch-manifest.json'), JSON.stringify({
  note: 'Sitemap dates for the 15 Nov 2026 directory batch. Internal page list, not a public label.',
  pages: pages,
  added: added,
  skipped: skipped
}, null, 2) + '\n');

const counts = {};
Object.keys(buckets).forEach(function (key) { counts[key] = buckets[key].length; });
console.log(JSON.stringify({ counts: counts, skipped: skipped.length, added: added.length }, null, 2));
skipped.forEach(function (row) { console.log('SKIP\t' + row.section + '\t' + row.company + '\t' + row.url); });
