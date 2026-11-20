#!/usr/bin/env node
/* Turn the 20 Nov 2026 held-batch CSV into source records.
 * The CSV is not committed: its notes name people and inboxes.
 * Outreach flag text is stored in data/directory-publish.json only.
 * GCC countries are stored for public display as GCC.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const outreach = require('../lib/directory-outreach');

const ROOT = path.join(__dirname, '..');
const CSV = process.argv[2];
if (!CSV) {
  console.error('usage: node scripts/import-directory-batch-2026-11-20.js <csv>');
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
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function writeJson(rel, doc) { fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(doc, null, 2) + '\n'); }
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function keyName(s) {
  return norm(s).replace(/\b(pvt|private|ltd|limited|llc|inc|gmbh|co|kg|sa|spa|srl|fzc|plc|corp|corporation|company|the|and|of|group|industries|ag|as|oy|ab|wll)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function sameName(a, b) {
  const ka = keyName(a), kb = keyName(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const short = ka.length <= kb.length ? ka : kb;
  const long = ka.length <= kb.length ? kb : ka;
  if (short.length < 8) return false;
  return long.indexOf(short + ' ') === 0;
}
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
}
function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'listing';
}
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function orDash(s) { return clean(s) || '—'; }
function scrub(s) { return outreach.scrubPublic(clean(s)); }
function publicSentence(s) {
  const hard = new RegExp(['nis' + 'had', 'pat' + 'hak', 'do_not_contact', 'never_contact', 'no-contact', 'no_contact'].join('|'), 'i');
  return scrub(clean(s).split(/(?<=\.)\s+/).filter(function (sentence) {
    return sentence && !hard.test(sentence);
  }).join(' '));
}
function facts(row) {
  return ' Voltage range: ' + orDash(scrub(row.voltage_range)) +
    '. Capacity range: ' + orDash(scrub(row.capacity_range)) +
    '. Accreditations: ' + orDash(scrub(row.accreditations_certifications)) +
    '. Parent group: ' + orDash(scrub(row.parent_group)) + '.';
}

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
  'transformer training providers': 'training',
  manufacturers: 'manufacturers',
  accessories: 'accessories'
};

const existing = [];
function addExisting(name, website, url, country) {
  if (!name && !website) return;
  existing.push({ name: name || '', website: website || '', url: url || '', country: country || '' });
}
readJson('data/manufacturers.json').forEach(function (group) {
  (group.makers || []).forEach(function (maker) {
    if (!maker || !maker[0]) return;
    addExisting(maker[0], maker[2], '', group.country || '');
  });
});
readJson('data/accessories.json').suppliers.forEach(function (row) {
  addExisting(row.name, row.website, row.slug ? '/accessories/' + row.slug + '/' : '', row.country);
});
readJson('data/services.json').services.forEach(function (row) {
  addExisting(row.company_name, row.website, '/services.html', row.country);
});
readJson('data/logistics.json').companies.forEach(function (row) {
  addExisting(row.company_name, row.website, '/logistics.html', row.country);
});
readJson('data/laboratories.json').laboratories.forEach(function (row) {
  addExisting(row.name, row.website, '/laboratories.html', row.country);
});
readJson('data/rental-emergency-providers.json').companies.forEach(function (row) {
  addExisting(row.company_name, row.website, '/rental-emergency.html', (row.countries || []).join(' '));
});
readJson('data/education.json').providers.forEach(function (row) {
  addExisting(row.provider_name, row.website, '/education.html', row.country);
});
function walkProfiles(dir, urlPrefix) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  fs.readdirSync(abs).forEach(function (slug) {
    if (!fs.existsSync(path.join(abs, slug, 'index.html'))) return;
    addExisting(slug.replace(/-/g, ' '), '', urlPrefix + slug + '/');
  });
}
walkProfiles('utilities', '/utilities/');
walkProfiles('manufacturers', '/manufacturers/');
walkProfiles('accessories', '/accessories/');

function sameCountry(a, b) {
  const ka = norm(a), kb = norm(b);
  if (!ka || !kb) return true;
  if (outreach.publicCountry(a) === 'GCC' && outreach.publicCountry(b) === 'GCC') return true;
  return ka === kb || ka.indexOf(kb) === 0 || kb.indexOf(ka) === 0;
}
function findExisting(name, website, country) {
  const host = hostOf(website);
  for (let i = 0; i < existing.length; i++) {
    const row = existing[i];
    const named = sameName(name, row.name);
    const hosted = !!(host && hostOf(row.website) === host);
    if (named && (sameCountry(country, row.country) || hosted)) return row;
    if (hosted && host) return row;
  }
  return null;
}

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const buckets = {
  utilities: [], 'approved-vendors': [], laboratories: [], services: [], epc: [],
  rental: [], recycling: [], logistics: [], monitoring: [], training: [],
  manufacturers: [], accessories: []
};
const skipped = [];
const added = [];
const seenSlug = {};
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
    skipped.push({ company: name, section: vertical, reason: 'already listed', url: hit.url || hit.website || '' });
    return;
  }
  let slug = /^nuhas\b/i.test(name) ? 'nuhas-emirates-national-copper-factory' : slugify(name);
  if (seenSlug[slug] || fs.existsSync(path.join(ROOT, vertical === 'training' ? 'education' : vertical === 'rental' ? 'rental-emergency' : vertical === 'accessories' ? 'accessories' : vertical === 'laboratories' ? 'laboratories' : vertical === 'services' ? 'services' : vertical === 'logistics' ? 'logistics' : vertical === 'utilities' ? 'utilities' : vertical === 'manufacturers' ? 'manufacturers' : vertical, slug, 'index.html'))) {
    if (!/^nuhas\b/i.test(name)) slug = slug + '-2';
  }
  seenSlug[slug] = 1;
  const country = outreach.publicCountry(row.country);
  const gcc = country === 'GCC';
  const description = (publicSentence(row.short_description) || publicSentence(row.product_or_service_types) || publicSentence(row.type_or_category) || '—') + facts(row);
  if (new RegExp(['nis' + 'had', 'pat' + 'hak', 'do_not_contact', 'never_contact', '\\bDubai\\b', 'United Arab Emirates', '\\bUAE\\b'].join('|'), 'i').test(description + ' ' + name)) {
    console.error('banned public text in ' + name);
    process.exitCode = 1;
    return;
  }
  const flag = clean(row.contact_flag || row.flags);
  if (flag) flagBook[slug] = flag;
  const record = {
    name: name,
    slug: slug,
    country: country,
    state: gcc ? '' : scrub(row.state),
    website: clean(row.website),
    category: publicSentence(row.type_or_category) || '—',
    description: description,
    products: publicSentence(row.product_or_service_types) || '—',
    source: (String(row.sources || '').match(/https?:\/\/[^\s;]+/) || [clean(row.website)])[0],
    last_verified: clean(row.last_verified) || '2026-11-20',
    gcc: gcc
  };
  buckets[vertical].push(record);
  added.push({ company: name, section: vertical, slug: slug, country: country });
});

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
function labRow(row) {
  return {
    id: 'lab:' + row.slug,
    name: row.name,
    country: row.country,
    city: row.gcc ? '' : (row.state || '—'),
    website: row.website,
    third_party_independent: true,
    capabilities: {},
    description: row.description,
    last_verified: row.last_verified,
    source: row.source,
    profile_page: true,
    directory_publish: true,
    public_record: { checked: row.last_verified, sources: row.source ? [row.source] : [] }
  };
}
function rentalRow(row) {
  return {
    id: 'rent:' + row.slug,
    company_name: row.name,
    countries: [row.country],
    website: row.website,
    service_pages: [{ label: 'Service page', url: row.website }],
    service_types: /mobile|substation/i.test(row.category + row.description) ? ['rental', 'mobile substation'] : ['rental'],
    contact_email: '',
    phone: '',
    phone_context: '',
    verified: true,
    verification_status: 'WEBSITE_CHECKED',
    verification_date: row.last_verified,
    verification_source: row.source,
    directory_publish: true
  };
}
function trainingRow(row) {
  return {
    id: 'edu:' + row.slug,
    provider_name: row.name,
    country: row.country,
    state_province: row.state,
    city: row.gcc ? '' : (row.state || '—'),
    website: row.website,
    course_types: row.products && row.products !== '—' ? row.products.split(/;\s*/).filter(Boolean).slice(0, 6) : [row.category || 'Transformer training'],
    delivery_mode: '—',
    description: row.description,
    verification_status: 'WEBSITE_CHECKED',
    verification_date: row.last_verified,
    verification_source: row.source,
    profile_page: true,
    directory_publish: true
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
    directory_publish: true
  };
}
function accessoryRow(row) {
  const categories = [];
  if (/wire|enamel|magnet/i.test(row.category + row.products)) categories.push('Winding wire');
  if (/copper|conductor|picc/i.test(row.category + row.products)) categories.push('Paper-insulated copper conductor and transformer conductors');
  if (!categories.length) categories.push(row.category || '—');
  return {
    role: 'Unclaimed listing',
    listing_status: 'unclaimed',
    verification_status: 'Unclaimed',
    verification_date: '—',
    listing_tier: 'listed',
    name: row.name,
    slug: row.slug,
    publish_at_slug: row.slug === 'nuhas-emirates-national-copper-factory',
    canonical_company_name: row.name,
    country: row.country,
    city: row.gcc ? '' : (row.state || '—'),
    state: '',
    website: row.website,
    categories: categories,
    description: row.description,
    evidence_source: 'Unclaimed listing. Official site checked ' + row.last_verified + ': ' + row.source,
    directory_source_title: 'Unclaimed listing. Official site checked ' + row.last_verified + ': ' + row.source,
    never_contact: !!flagBook[row.slug]
  };
}

function append(file, key, items) {
  if (!items.length) return;
  const doc = readJson(file);
  const have = {};
  (doc[key] || []).forEach(function (row) {
    if (row && row.id) have[row.id] = 1;
    if (row && row.slug) have[row.slug] = 1;
    if (row && row.name) have[norm(row.name)] = 1;
    if (row && row.company_name) have[norm(row.company_name)] = 1;
  });
  items.forEach(function (item) {
    const id = item.id || item.slug || norm(item.name || item.company_name);
    if (have[id]) return;
    doc[key].push(item);
  });
  writeJson(file, doc);
}
function writeSection(file, title, items) {
  writeJson(file, {
    directory_type: title,
    note: 'Free unclaimed listings. Outreach flags are not in this file. GCC is the public location for Gulf countries.',
    companies: items
  });
}

append('data/services.json', 'services', buckets.services.map(serviceRow));
append('data/logistics.json', 'companies', buckets.logistics.map(logisticsRow));
append('data/laboratories.json', 'laboratories', buckets.laboratories.map(labRow));
append('data/rental-emergency-providers.json', 'companies', buckets.rental.map(rentalRow));
append('data/education.json', 'providers', buckets.training.map(trainingRow));
append('data/accessories.json', 'suppliers', buckets.accessories.map(accessoryRow));
writeSection('data/utility-listings.json', 'utilities', buckets.utilities.map(sectionRow));
writeSection('data/approved-vendors.json', 'approved-vendors', buckets['approved-vendors'].map(sectionRow));
writeSection('data/epc-contractors.json', 'epc', buckets.epc.map(sectionRow));
writeSection('data/monitoring-software.json', 'monitoring', buckets.monitoring.map(sectionRow));
writeSection('data/recycling.json', 'recycling', buckets.recycling.map(sectionRow));
writeSection('data/manufacturer-listings.json', 'manufacturers', buckets.manufacturers.map(sectionRow));

const publish = readJson('data/directory-publish.json');
publish.flags = publish.flags || {};
buckets.accessories.forEach(function (row) {
  if (publish.accessories.indexOf(row.slug) === -1) publish.accessories.push(row.slug);
});
Object.keys(flagBook).forEach(function (slug) { publish.flags[slug] = flagBook[slug]; });
writeJson('data/directory-publish.json', publish);

const integrity = readJson('data/directory-integrity.json');
integrity.flags = integrity.flags || [];
const haveFlag = {};
integrity.flags.forEach(function (f) {
  haveFlag[[f.directory, f.name, f.country, f.field].join('\t')] = 1;
});
function addFlag(directory, name, country, field, label, source, note) {
  const key = [directory, name, country, field].join('\t');
  if (haveFlag[key]) return;
  haveFlag[key] = 1;
  integrity.flags.push({
    directory: directory,
    name: name,
    country: country,
    field: field,
    label: label,
    checked: '2026-11-20',
    source: source || null,
    note: note
  });
}
function gccFlags(directory, name, row) {
  if (!row.gcc) return;
  addFlag(directory, name, 'GCC', 'country', 'regional_not_a_country', row.source, 'Public directory location is the GCC region.');
  addFlag(directory, name, 'GCC', 'city', 'unknown', row.source, 'City is not shown. The public location is GCC.');
}
buckets.services.forEach(function (row) { gccFlags('services', row.name, row); });
buckets.logistics.forEach(function (row) { gccFlags('logistics', row.name, row); });
buckets.laboratories.forEach(function (row) { gccFlags('laboratories', row.name, row); });
buckets.rental.forEach(function (row) {
  if (!row.gcc) return;
  addFlag('rental_emergency', row.name, 'GCC', 'country', 'regional_not_a_country', row.source, 'Public directory location is the GCC region.');
});
writeJson('data/directory-integrity.json', integrity);

const pages = {};
function page(rel, day) { pages[rel] = day || '2026-11-20'; }
buckets.services.forEach(function (row) { page('services/' + row.slug + '/index.html', row.last_verified); });
buckets.logistics.forEach(function (row) { page('logistics/' + row.slug + '/index.html', row.last_verified); });
buckets.laboratories.forEach(function (row) { page('laboratories/' + row.slug + '/index.html', row.last_verified); });
buckets.rental.forEach(function (row) { page('rental-emergency/' + row.slug + '/index.html', row.last_verified); });
buckets.training.forEach(function (row) { page('education/' + row.slug + '/index.html', row.last_verified); });
buckets.utilities.forEach(function (row) { page('utilities/' + row.slug + '/index.html', row.last_verified); });
buckets.accessories.forEach(function (row) { page('accessories/' + row.slug + '/index.html', row.last_verified); });
buckets.manufacturers.forEach(function (row) { page('manufacturers/' + row.slug + '/index.html', row.last_verified); });
[
  ['approved-vendors', 'approved-vendors.html'],
  ['epc', 'epc.html'],
  ['monitoring', 'monitoring.html'],
  ['recycling', 'recycling.html'],
  ['manufacturers', 'manufacturer-listings.html']
].forEach(function (pair) {
  page(pair[1], '2026-11-20');
  if (pair[0] === 'manufacturers') return;
  buckets[pair[0]].forEach(function (row) { page(pair[0] + '/' + row.slug + '/index.html', row.last_verified); });
});
page('utilities.html', '2026-11-20');
page('jobs/transformer-factory-manager/index.html', '2026-11-20');
page('jobs/transformer-design-engineer/index.html', '2026-11-20');
page('jobs/transformer-type-test-engineer/index.html', '2026-11-20');
writeJson('data/directory-batch-manifest.json', {
  note: 'Sitemap dates for the 20 Nov 2026 directory batch. Internal page list.',
  pages: pages,
  added: added,
  skipped: skipped
});

const counts = {};
Object.keys(buckets).forEach(function (key) { counts[key] = buckets[key].length; });
console.log(JSON.stringify({ counts: counts, skipped: skipped.length, added: added.length }, null, 2));
skipped.forEach(function (row) { console.log('SKIP\t' + row.section + '\t' + row.company + '\t' + row.reason + '\t' + row.url); });
