#!/usr/bin/env node
/* Batch 5 social-sourced listings, TPN-0373–TPN-0471.
 * Unclaimed only. Outreach columns and social URLs are not written.
 * Out-of-scope or unconfirmed rows stay out. SGB-USA stays its own listing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { slugify } = require('../lib/company-aliases');

const ROOT = path.join(__dirname, '..');
const BATCH = process.argv[2] || '/cursor/stores/bot/event-batch-5';
const CHECKED = '2026-10-20';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((cell) => String(cell || '').trim()));
}
function table(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  const head = rows.shift().map((h) => h.trim());
  return rows.map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] == null ? '' : r[i]; });
    return o;
  });
}
function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function writeJson(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');
}
function displayName(s) {
  return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function httpUrl(value) {
  let s = String(value || '').trim();
  if (!s || s === '—' || s === '-' || s === '–') return '';
  if (!/^https?:\/\//i.test(s)) {
    if (!/^((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+)([/?#].*)?$/i.test(s)) return '';
    s = 'https://' + s;
  }
  let u;
  try { u = new URL(s); } catch (e) { return ''; }
  u.hostname = u.hostname.toLowerCase();
  const out = u.toString();
  return out.endsWith('/') && u.pathname === '/' && !u.search && !u.hash ? out.slice(0, -1) : out;
}
function companySite(value) {
  const url = httpUrl(value);
  if (!url) return '';
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { return ''; }
  if (/(^|\.)linkedin\.com$|(^|\.)reddit\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)facebook\.com$/i.test(host)) {
    throw new Error('social host is not a company website: ' + url);
  }
  return url;
}
function censusCountry(name) {
  const raw = displayName(name);
  if (raw === 'United States') return 'USA';
  if (raw === 'United Arab Emirates') return 'UAE';
  if (raw === 'Turkey') return 'Türkiye';
  return raw;
}
function directoryOf(category) {
  if (category === 'Transformer manufacturer') return 'manufacturers';
  if (category === 'Components & materials') return 'accessories';
  if (category === 'Testing, monitoring & labs') return 'laboratories';
  if (category === 'Services') return 'services';
  throw new Error('unknown category ' + category);
}

const rows = table(path.join(BATCH, 'social-sourced-tp-new.csv'));
if (rows.length !== 99) throw new Error('expected 99 listings, got ' + rows.length);
rows.forEach((row, i) => {
  const expect = 'TPN-' + String(373 + i).padStart(4, '0');
  if (row.new_listing_id !== expect) throw new Error('id sequence broke at ' + row.new_listing_id);
  if (String(row.verified).trim().toLowerCase() !== 'yes') throw new Error('unverified row ' + expect);
  if (String(row.do_not_contact || '').trim()) throw new Error('outreach column is set on ' + expect);
});
const counts = rows.reduce((acc, row) => { acc[row.category] = (acc[row.category] || 0) + 1; return acc; }, {});
if (counts.Services !== 42 || counts['Transformer manufacturer'] !== 27 || counts['Testing, monitoring & labs'] !== 21 || counts['Components & materials'] !== 9) {
  throw new Error('category counts ' + JSON.stringify(counts));
}

const HOLD = {
  'TPN-0398': 'Held. The Shermco homepage checked 20 Oct 2026 describes electrical field services and does not state transformer work. Uncertain, not published.',
  'TPN-0457': 'Held. The TEMISA site is an MV and HV motor company and points transformer and substation work to TEVKO, a different specialist. Out of scope, not published.',
  'TPN-0462': 'Held. The 3MD Energy site was not readable and the transformer-distributor claim was not confirmed. Uncertain, not published.',
  'TPN-0471': 'Held. The EnerTrans site describes planning and operating HV and MV grid installations and does not state transformer work. Uncertain, not published.'
};
const ALREADY = {
  'TPN-0402': {
    slug: 'powertech-surrey',
    directory: 'laboratories',
    note: 'Already listed as Powertech Labs at lab:powertech-surrey (powertechlabs.com). Not imported again.'
  },
  'TPN-0445': {
    slug: 'vrt-power-services',
    directory: 'services',
    note: 'Already listed as VRT Power Field Services at srv:vrt-power-services (vrtpower.com). Not imported again.'
  }
};
const NOTES = {
  'TPN-0424': 'Kept separate. sgbusa.com is a US cast-coil and dry-type company in the SGB-SMIT group. It is not the same entity as the existing plant profiles or the group profile, so it is not merged and not cross-linked.',
  'TPN-0438': 'Published as a laboratory. The official site describes electrical test equipment, including power transformer test sets.',
  'TPN-0439': 'Published as a service. The official site describes transformer repair and maintenance.',
  'TPN-0440': 'Published as a manufacturer in a new Hong Kong census group. The official site describes instrument current transformers.',
  'TPN-0443': 'Published as a manufacturer in a new Cambodia census group. The official site describes distribution transformers.',
  'TPN-0449': 'Published as a service. The official site describes testing, maintenance, installation and commissioning of transformers.',
  'TPN-0465': 'Published as an ordinary service. It is not Elin Insulation FZ LLC and is not linked to that listing.'
};
const DESCRIPTIONS = {
  'TPN-0438': 'Unclaimed directory listing. The company site describes electrical test equipment, including power transformer test sets.',
  'TPN-0439': 'Unclaimed directory listing. The company site describes transformer repair and maintenance.',
  'TPN-0449': 'Unclaimed directory listing. The company site describes testing, maintenance, installation and commissioning of transformers.',
  'TPN-0465': 'Unclaimed directory listing. Service types are not stated.'
};

const manufacturers = readJson('data/manufacturers.json');
const accessories = readJson('data/accessories.json');
const laboratories = readJson('data/laboratories.json');
const services = readJson('data/services.json');
const extras = readJson('data/permanent-id-extras.json');
const decisions = readJson('data/event-batch-decisions.json');
const integrity = readJson('data/directory-integrity.json');

if (decisions.some((row) => row.company === 'ALAMO Transformer Supply' && /Batch 5\./.test(row.note || ''))) {
  console.log('event batch 5 already imported');
  process.exit(0);
}

const groups = {};
manufacturers.forEach((g) => { groups[g.country] = g; });
const GROUP_META = {
  'Hong Kong': { region: 'East Asia', flag: '🇭🇰' },
  Cambodia: { region: 'Southeast Asia', flag: '🇰🇭' }
};
function countryGroup(country) {
  if (groups[country]) return groups[country];
  const meta = GROUP_META[country];
  if (!meta) throw new Error('no census country group for ' + country);
  const group = { country: country, region: meta.region, flag: meta.flag, makers: [] };
  const idx = manufacturers.findIndex((g) => g.country === '—');
  if (idx < 0) manufacturers.push(group);
  else manufacturers.splice(idx, 0, group);
  groups[country] = group;
  return group;
}
const CAP_KEYS = ['lightning_impulse', 'switching_impulse', 'partial_discharge', 'temperature_rise', 'short_circuit', 'sound_level', 'dielectric_withstand', 'oil_testing', 'materials_testing', 'sfra'];
function blankCaps() {
  const caps = {};
  CAP_KEYS.forEach((k) => { caps[k] = null; });
  return caps;
}
const used = new Set();
readJson('data/company-slugs.json').forEach((row) => { if (row.slug) used.add(row.slug); });
(accessories.suppliers || []).forEach((s) => {
  if (s.slug) used.add(s.slug);
  const slug = slugify(s.name);
  if (slug) used.add(slug);
});
(laboratories.laboratories || []).forEach((lab) => {
  const slug = String(lab.id || '').replace(/^lab:/, '');
  if (slug) used.add(slug);
});
(services.services || []).forEach((s) => {
  const slug = String(s.id || '').replace(/^srv:/, '');
  if (slug) used.add(slug);
});
manufacturers.forEach((g) => (g.makers || []).forEach((m) => { const slug = slugify(m[0]); if (slug) used.add(slug); }));
function claimSlug(base, name) {
  if (!base) throw new Error('empty slug for ' + name);
  if (used.has(base)) throw new Error('slug collision ' + base + ' for ' + name);
  used.add(base);
  return base;
}
function flag(directory, name, country, field) {
  const key = [directory, name, country, field].join('\t');
  if (integrity.flags.some((f) => [f.directory, f.name, f.country, f.field].join('\t') === key)) return;
  integrity.flags.push({
    directory: directory,
    name: name,
    country: country,
    field: field,
    label: 'unknown',
    checked: CHECKED,
    source: null,
    note: 'The listing batch left this field unstated. Labeled unknown on 2026-10-20 so the row can stay unpublished as a guess.'
  });
}
function labelUnknown(rec) {
  const country = rec.directory === 'manufacturers' ? (rec.country || '—') : (rec.country || '');
  const unresolved = !country || country === '—' || country === '-' || country === '–';
  if (unresolved) flag(rec.directory, rec.name, country, 'country');
  if (!rec.website) flag(rec.directory, rec.name, country, 'website');
  if (rec.directory === 'manufacturers') flag(rec.directory, rec.name, country, 'types');
  if (rec.directory === 'services' && !rec.city) flag(rec.directory, rec.name, country, 'city');
}
function recordDecision(company, decision, slug, directory, note) {
  decisions.push({ company: company, decision: decision, slug: slug, directory: directory, note: note });
}

const added = [];
const outcomes = [];
function addEntity(spec) {
  const name = displayName(spec.name);
  const directory = spec.directory;
  const country = spec.country || '';
  const city = '—';
  const site = companySite(spec.website);
  if (!site) throw new Error('missing official site for ' + name);
  const products = displayName(spec.products || '');
  const slug = claimSlug(slugify(name), name);
  const evidence = spec.evidence;
  if (/do_not_contact|transformers magazine|linkedin\.com/i.test(evidence + products + name)) {
    throw new Error('shipped text leaked a blocked source for ' + name);
  }
  const rec = { slug: slug, directory: directory, name: name, country: country, website: site, action: 'added' };
  if (directory === 'manufacturers') {
    countryGroup(country).makers.push([name, city, site, '']);
    rec.country = country;
  } else if (directory === 'accessories') {
    accessories.suppliers.push({
      name: name,
      slug: slug,
      country: country,
      state: '',
      city: city,
      website: site,
      categories: [],
      description: products,
      role: 'Unclaimed listing',
      listing_status: 'unclaimed',
      verification_status: 'Unclaimed',
      verification_date: '—',
      evidence_source: evidence,
      directory_source_title: evidence
    });
    extras.push({ slug: slug, name: name, country: country, directory: directory });
  } else if (directory === 'laboratories') {
    laboratories.laboratories.push({
      id: 'lab:' + slug,
      name: name,
      country: country,
      city: city,
      website: site,
      third_party_independent: false,
      max_voltage_kv: null,
      short_circuit_capacity: '',
      capabilities: blankCaps(),
      description: products,
      last_verified: '—',
      source: evidence,
      directory_source_title: evidence,
      rfq_eligible: false,
      profile_page: true
    });
    extras.push({ slug: slug, name: name, country: country, directory: directory });
  } else if (directory === 'services') {
    services.services.push({
      id: 'srv:' + slug,
      company_name: name,
      country: country,
      state_province: '',
      city: '',
      website: site,
      service_types: [],
      description: products,
      verification_status: 'Unclaimed',
      verification_date: '—',
      profile_page: true
    });
    rec.city = '';
    extras.push({ slug: slug, name: name, country: country, directory: directory });
  } else throw new Error('unknown directory ' + directory);
  added.push(Object.assign({ id: spec.id }, rec));
  return rec;
}

rows.forEach((row) => {
  const id = row.new_listing_id;
  const name = displayName(row.company);
  const site = companySite(row.official_url);
  if (HOLD[id]) {
    outcomes.push({ id: id, company: name, outcome: 'held', note: HOLD[id] });
    recordDecision(name, 'held', '', directoryOf(row.category), 'Batch 5. ' + HOLD[id]);
    return;
  }
  if (ALREADY[id]) {
    const prior = ALREADY[id];
    outcomes.push({ id: id, company: name, outcome: 'already_listed', note: prior.note });
    recordDecision(name, 'already_listed', prior.slug, prior.directory, 'Batch 5. ' + prior.note);
    return;
  }
  const directory = directoryOf(row.category);
  const country = censusCountry(row.country);
  const blurb = DESCRIPTIONS[id] || ('Unclaimed directory listing. ' + displayName(row.description));
  const evidence = 'Unclaimed listing. Official site checked 20 Oct 2026: ' + site;
  const rec = addEntity({
    id: id,
    name: name,
    directory: directory,
    country: country,
    website: site,
    products: directory === 'manufacturers' ? '' : blurb,
    evidence: evidence
  });
  labelUnknown(rec);
  const extra = NOTES[id] ? ' ' + NOTES[id] : '';
  recordDecision(name, 'separate', rec.slug, directory, 'Batch 5. Separate unclaimed listing. Official site checked 20 Oct 2026: ' + site + extra);
  outcomes.push({ id: id, company: name, outcome: 'published', directory: directory, slug: rec.slug, note: NOTES[id] || 'Published as an unclaimed listing.' });
});

const byDirectory = added.reduce((acc, row) => { acc[row.directory] = (acc[row.directory] || 0) + 1; return acc; }, {});
if (added.length !== 93) throw new Error('expected 93 listings, got ' + added.length);
if (byDirectory.manufacturers !== 26 || byDirectory.services !== 38 || byDirectory.laboratories !== 20 || byDirectory.accessories !== 9) {
  throw new Error('directory counts ' + JSON.stringify(byDirectory));
}
if (outcomes.filter((row) => row.outcome === 'held').length !== 4) throw new Error('hold count');
if (outcomes.filter((row) => row.outcome === 'already_listed').length !== 2) throw new Error('already-listed count');
const elin = (accessories.suppliers || []).filter((s) => /elin insulation/i.test(s.name));
if (elin.length !== 1) throw new Error('Elin Insulation count ' + elin.length);
if (!added.some((row) => row.slug === 'elinser' && row.directory === 'services')) throw new Error('ELINSER missing');
if (!added.some((row) => row.slug === 'sgb-usa' && row.directory === 'manufacturers' && row.country === 'USA')) throw new Error('SGB-USA missing');
if (added.some((row) => /shermco|temisa|3md-energy|enertrans/i.test(row.slug))) throw new Error('held slug imported');
const fresh = JSON.stringify(added) + JSON.stringify(outcomes) + JSON.stringify(decisions.slice(-99));
if (/do_not_contact/i.test(fresh)) throw new Error('do_not_contact leaked');
if (/transformers\s*magazine/i.test(fresh)) throw new Error('magazine source leaked');
if (/linkedin\.com/i.test(fresh)) throw new Error('LinkedIn URL leaked');
const tomb = readJson('data/permanent-ids.json').companies['schweitzer-engineering-laboratories-pvt-ltd'];
if (!tomb || tomb.id !== 'TPM-001072' || tomb.retired !== true) throw new Error('TPM-001072 must stay reserved');

laboratories.total_laboratories = laboratories.laboratories.length;
writeJson('data/manufacturers.json', manufacturers);
writeJson('data/accessories.json', accessories);
writeJson('data/laboratories.json', laboratories);
writeJson('data/services.json', services);
writeJson('data/permanent-id-extras.json', extras);
writeJson('data/event-batch-decisions.json', decisions);
writeJson('data/directory-integrity.json', integrity);

const report = {
  file_rows: 99,
  listings_added: added.length,
  added_by_directory: byDirectory,
  held: outcomes.filter((row) => row.outcome === 'held'),
  already_listed: outcomes.filter((row) => row.outcome === 'already_listed'),
  verify: [
    { id: 'TPN-0398', company: 'Shermco Industries', outcome: HOLD['TPN-0398'] },
    { id: 'TPN-0424', company: 'SGB-USA', outcome: NOTES['TPN-0424'] },
    { id: 'TPN-0438', company: 'GFUVE Group', outcome: NOTES['TPN-0438'] },
    { id: 'TPN-0439', company: 'Hewad Engineering Services', outcome: NOTES['TPN-0439'] },
    { id: 'TPN-0440', company: 'I Current Transformer', outcome: NOTES['TPN-0440'] },
    { id: 'TPN-0449', company: 'Dugan Technology Solutions', outcome: NOTES['TPN-0449'] },
    { id: 'TPN-0457', company: 'TEMISA', outcome: HOLD['TPN-0457'] },
    { id: 'TPN-0462', company: '3MD Energy', outcome: HOLD['TPN-0462'] },
    { id: 'TPN-0471', company: 'EnerTrans', outcome: HOLD['TPN-0471'] }
  ],
  linkedin_ids_renumbered: ['TPN-0472', 'TPN-0473', 'TPN-0474', 'TPN-0475', 'TPN-0476'],
  added: added.map((row) => ({ id: row.id, name: row.name, slug: row.slug, directory: row.directory, country: row.country, website: row.website }))
};
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/event-batch-5-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  listings_added: report.listings_added,
  added_by_directory: byDirectory,
  held: report.held.length,
  already_listed: report.already_listed.length
}, null, 2));
