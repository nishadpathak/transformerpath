/* Append the 20 Nov 2026 balance file. Does not rewrite the earlier batch.
 * Usage: node scripts/import-directory-balance-2026-11-20.js <csv>
 * Outreach flags go to data/directory-publish.json only.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const outreach = require('../lib/directory-outreach');
const { derivedSlug } = require('../lib/accessory-slug');

const ROOT = path.join(__dirname, '..');
const CSV = process.argv[2];
if (!CSV) {
  console.error('usage: node scripts/import-directory-balance-2026-11-20.js <csv>');
  process.exit(1);
}

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function writeJson(rel, doc) { fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(doc, null, 2) + '\n'); }
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function keyName(s) {
  return norm(s).replace(/\b(pvt|private|ltd|limited|llc|inc|gmbh|co|kg|sa|spa|srl|fzc|plc|corp|corporation|company|the|and|of|group|industries|ag|as|oy|ab|wll|sti)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
}
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function orDash(s) { return clean(s) || '—'; }
function sameCountry(a, b) {
  const ka = norm(a), kb = norm(b);
  if (!ka || !kb) return true;
  if (outreach.publicCountry(a) === 'GCC' && outreach.publicCountry(b) === 'GCC') return true;
  return ka === kb || ka.indexOf(kb) === 0 || kb.indexOf(ka) === 0;
}
function publicText(s) {
  const hard = new RegExp(['nis' + 'had', 'pat' + 'hak', 'do_not_contact', 'never_contact', 'no-contact', 'no_contact'].join('|'), 'i');
  return clean(s).split(/(?<=\.)\s+/).filter(function (sentence) {
    return sentence && !hard.test(sentence);
  }).join(' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\+\d[\d\s().-]{6,}/g, '')
    .replace(/\bconsulting\b/gi, 'advisory')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function facts(row) {
  return ' Voltage range: ' + orDash(row.voltage_range) +
    '. Capacity range: ' + orDash(row.capacity_range) +
    '. Accreditations: ' + orDash(row.accreditations_certifications) +
    '. Parent group: ' + orDash(row.parent_group) + '.';
}
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); if (row.some(Boolean)) rows.push(row); }
  const header = rows[0];
  return rows.slice(1).filter(function (r) { return r.length >= 5; }).map(function (r) {
    const o = {};
    header.forEach(function (h, idx) { o[h] = r[idx] || ''; });
    return o;
  });
}

const VERT = {
  accessories: 'accessories',
  machinery: 'machinery',
  'heavy haul transformer logistics': 'logistics',
  manufacturers: 'manufacturers',
  'service companies': 'services',
  consultants: 'services'
};

const existing = [];
function addExisting(name, website, url, country, source) {
  if (!name && !website) return;
  existing.push({ name: name || '', website: website || '', url: url || '', country: country || '', source: source || '' });
}
readJson('data/manufacturers.json').forEach(function (group) {
  (group.makers || []).forEach(function (maker) {
    if (!maker || !maker[0]) return;
    addExisting(maker[0], maker[2], '', group.country || '', 'manufacturers');
  });
});
readJson('data/accessories.json').suppliers.forEach(function (row) {
  addExisting(row.name, row.website, row.slug ? '/accessories/' + row.slug + '/' : '', row.country, 'accessories');
});
readJson('data/services.json').services.forEach(function (row) {
  addExisting(row.company_name, row.website, '/services.html', row.country, 'services');
});
readJson('data/logistics.json').companies.forEach(function (row) {
  addExisting(row.company_name, row.website, '/logistics.html', row.country, 'logistics');
});
readJson('data/laboratories.json').laboratories.forEach(function (row) {
  addExisting(row.name, row.website, '/laboratories.html', row.country, 'laboratories');
});
readJson('data/machinery.json').machinery.forEach(function (row) {
  addExisting(row.manufacturer || row.name, row.website, '/machinery.html', row.country, 'machinery');
});
['data/manufacturer-listings.json', 'data/epc-contractors.json', 'data/utility-listings.json', 'data/monitoring-software.json', 'data/recycling.json', 'data/approved-vendors.json'].forEach(function (file) {
  (readJson(file).companies || []).forEach(function (row) {
    addExisting(row.name, row.website, '', row.country, file);
  });
});

function findExisting(name, website, country) {
  const host = hostOf(website);
  const key = keyName(name);
  for (let i = 0; i < existing.length; i++) {
    const row = existing[i];
    const hosted = !!(host && hostOf(row.website) === host);
    if (hosted) return row;
    const live = keyName(row.name);
    if (!key || !live || !sameCountry(country, row.country)) continue;
    if (key === live) return row;
    if (live.length >= 8 && key.indexOf(live + ' ') === 0) return row;
  }
  return null;
}

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const buckets = { accessories: [], machinery: [], logistics: [], manufacturers: [], services: [] };
const added = [];
const skipped = [];
const flagBook = {};

rows.forEach(function (row) {
  const vertical = VERT[norm(row.vertical)];
  if (!vertical) {
    console.error('unknown vertical: ' + row.vertical + ' / ' + row.company);
    process.exitCode = 1;
    return;
  }
  const name = clean(row.company);
  const hit = findExisting(name, row.website, row.country);
  if (hit) {
    skipped.push({
      company: name,
      section: vertical,
      reason: 'already listed',
      url: hit.url || hit.website || '',
      matched: hit.name,
      source: hit.source
    });
    return;
  }
  const country = outreach.publicCountry(row.country);
  const gcc = country === 'GCC';
  let description = publicText(row.short_description) || publicText(row.product_or_service_types) || publicText(row.type_or_category) || '—';
  if (gcc) description = outreach.scrubPublic(description);
  description += facts(row);
  const category = publicText(row.type_or_category) || '—';
  const products = publicText(row.product_or_service_types) || '—';
  if (/do_not_contact|never_contact|\bDubai\b|United Arab Emirates|\bUAE\b/i.test(description + ' ' + name + ' ' + category)) {
    console.error('banned public text in ' + name);
    process.exitCode = 1;
    return;
  }
  const slug = derivedSlug(name) || 'listing';
  const flag = clean(row.contact_flag || row.flags);
  if (flag) flagBook[slug] = flag;
  const record = {
    name: name,
    slug: slug,
    country: country,
    state: gcc ? '' : clean(row.state),
    website: clean(row.website),
    category: category,
    products: products,
    description: description,
    source: (String(row.sources || '').match(/https?:\/\/[^\s;]+/) || [clean(row.website)])[0],
    last_verified: clean(row.last_verified) || '2026-11-20',
    gcc: gcc,
    csvVertical: clean(row.vertical)
  };
  buckets[vertical].push(record);
  const entry = { company: name, section: vertical, slug: slug, country: country };
  if (norm(row.vertical) === 'consultants') entry.remap = 'consultants → services';
  added.push(entry);
});

function accessoryRow(row) {
  return {
    role: 'Unclaimed listing',
    listing_status: 'unclaimed',
    verification_status: 'Unclaimed',
    verification_date: '—',
    listing_tier: 'listed',
    name: row.name,
    slug: row.slug,
    canonical_company_name: row.name,
    country: row.country,
    city: row.gcc ? '' : (row.state || '—'),
    state: '',
    website: row.website,
    categories: [row.category || '—'],
    description: row.description,
    evidence_source: 'Unclaimed listing. Official site checked ' + row.last_verified + ': ' + row.source,
    directory_source_title: 'Unclaimed listing. Official site checked ' + row.last_verified + ': ' + row.source
  };
}
function serviceRow(row) {
  return {
    id: 'srv:' + row.slug,
    company_name: row.name,
    country: row.country,
    state_province: row.state,
    city: row.gcc ? '' : (row.state || '—'),
    website: row.website,
    service_types: row.products && row.products !== '—' ? row.products.split(/;\s*/).filter(Boolean).slice(0, 8) : [row.category || '—'],
    description: row.description,
    verification_status: 'WEBSITE_CHECKED',
    verification_date: row.last_verified,
    verification_source: row.source,
    profile_page: true,
    directory_publish: true
  };
}
function logisticsRow(row) {
  return {
    id: 'log:' + row.slug,
    company_name: row.name,
    country: row.country,
    state_province: row.state,
    city: row.gcc ? '' : (row.state || '—'),
    website: row.website,
    transport_modes: row.products && row.products !== '—' ? row.products.split(/;\s*/).filter(Boolean).slice(0, 6) : [row.category || 'Heavy haul'],
    description: row.description,
    verification_status: 'WEBSITE_CHECKED',
    verification_date: row.last_verified,
    verification_source: row.source,
    profile_page: true,
    directory_publish: true
  };
}
function makerRow(row) {
  return {
    id: row.slug,
    name: row.name,
    slug: row.slug,
    country: row.country,
    state: row.state,
    website: row.website,
    category: row.category || 'manufacturer',
    description: row.description,
    source: row.source,
    last_verified: row.last_verified,
    directory_publish: true
  };
}
function machineRow(row) {
  const handling = /handl|cart|mover|moving/i.test(row.category + ' ' + row.products + ' ' + row.description);
  const winding = /wind/i.test(row.category + ' ' + row.products);
  const core = /core|slit/i.test(row.category + ' ' + row.products);
  const casting = /impregnat|cast/i.test(row.category + ' ' + row.products);
  let category_id = 'MAC_HANDLING';
  let category = 'Heavy-load handling';
  if (winding) { category_id = 'MAC_WINDING'; category = 'Winding Machinery (HV, LV, Foil)'; }
  else if (core) { category_id = 'MAC_CORE'; category = 'Core Cutting & Processing Lines'; }
  else if (casting) { category_id = 'MAC_CASTING'; category = 'Impregnation & Casting Plants'; }
  return {
    id: 'mach:' + row.slug,
    slug: row.slug,
    name: row.name,
    category_id: category_id,
    category: category,
    manufacturer: row.name,
    country: row.country,
    city: row.gcc ? '' : (row.state || '—'),
    website: row.website,
    machine_type: row.category || '—',
    capacity_range: '—',
    automation_level: '—',
    transformer_application: row.description,
    specs: {},
    key_features: [],
    installations_count: '—',
    service_regions: [],
    last_verified: row.last_verified,
    source: row.source,
    directory_publish: true,
    profile_page: true
  };
}

function append(file, key, items) {
  if (!items.length) return;
  const doc = readJson(file);
  const have = {};
  (doc[key] || []).forEach(function (row) {
    if (row && row.id) have[row.id] = 1;
    if (row && row.slug) have[row.slug] = 1;
  });
  items.forEach(function (item) {
    const id = item.id || item.slug;
    if (have[id]) return;
    doc[key].push(item);
    have[id] = 1;
  });
  writeJson(file, doc);
}

append('data/accessories.json', 'suppliers', buckets.accessories.map(accessoryRow));
append('data/services.json', 'services', buckets.services.map(serviceRow));
append('data/logistics.json', 'companies', buckets.logistics.map(logisticsRow));
append('data/manufacturer-listings.json', 'companies', buckets.manufacturers.map(makerRow));
if (buckets.machinery.length) {
  const doc = readJson('data/machinery.json');
  const have = {};
  (doc.categories || []).forEach(function (c) { have[c.id] = 1; });
  if (!have.MAC_HANDLING) doc.categories.push({ id: 'MAC_HANDLING', label: 'Heavy-load handling' });
  if (!have.MAC_CASTING) doc.categories.push({ id: 'MAC_CASTING', label: 'Impregnation & Casting Plants' });
  const seen = {};
  (doc.machinery || []).forEach(function (row) { if (row.id) seen[row.id] = 1; });
  buckets.machinery.map(machineRow).forEach(function (item) {
    if (seen[item.id]) return;
    doc.machinery.push(item);
  });
  doc.total_machinery_records = doc.machinery.length;
  writeJson('data/machinery.json', doc);
}

const publish = readJson('data/directory-publish.json');
publish.accessories = publish.accessories || [];
publish.flags = publish.flags || {};
buckets.accessories.forEach(function (row) {
  if (publish.accessories.indexOf(row.slug) === -1) publish.accessories.push(row.slug);
});
Object.keys(flagBook).forEach(function (slug) { publish.flags[slug] = flagBook[slug]; });
writeJson('data/directory-publish.json', publish);

const manifest = readJson('data/directory-batch-manifest.json');
manifest.added = manifest.added.concat(added);
manifest.skipped = manifest.skipped.concat(skipped.map(function (row) {
  return { company: row.company, section: row.section, reason: row.reason + (row.matched ? ' (' + row.matched + ')' : ''), url: row.url };
}));
added.forEach(function (row) {
  const dir = row.section === 'services' ? 'services' : row.section;
  manifest.pages[dir + '/' + row.slug + '/index.html'] = '2026-11-20';
});
writeJson('data/directory-batch-manifest.json', manifest);

console.log('balance added ' + added.length + ' skipped ' + skipped.length);
added.forEach(function (row) { console.log('  ADD ' + row.section + ' ' + row.slug + (row.remap ? ' [' + row.remap + ']' : '')); });
skipped.forEach(function (row) { console.log('  SKIP ' + row.section + ' ' + row.company + ' -> ' + (row.matched || '') + ' ' + (row.url || '')); });
if (added.length + skipped.length !== rows.length) process.exit(1);
