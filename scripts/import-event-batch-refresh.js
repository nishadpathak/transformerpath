#!/usr/bin/env node
/* Refresh the multi-event batch: TPN-0284 through TPN-0313 only.
 * Earlier IDs stay as they are. TPN-0276 is retired and its permanent ID
 * stays reserved. Outreach columns are not written.
 * A second run stops once Quality Power is already in the census.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BATCH = process.argv[2] || '/cursor/stores/bot/event-batch-2';
const CHECKED = '2026-10-20';
const RETIRED_SLUG = 'schweitzer-engineering-laboratories-pvt-ltd';
const RETIRED_ID = 'TPM-001072';

const PAGES = [
  { file: 'ep-shanghai-2026-events-page.csv', id: 'ep-shanghai-2026', section: 'Exhibiting at EP Shanghai 2026', rows: 174 },
  { file: 'enlit-europe-2026-events-page.csv', id: 'enlit-europe-2026', section: 'Exhibiting at Enlit Europe 2026', rows: 38 },
  { file: 'adipec-2026-events-page.csv', id: 'adipec-2026', section: 'Exhibiting at ADIPEC 2026', rows: 2 },
  { file: 'energetics-lublin-2026-events-page.csv', id: 'energetics-2026', section: 'Exhibiting at ENERGETICS 2026', rows: 13 },
  { file: 'elecrama-2025-previous-events-page.csv', id: 'elecrama-2025', section: 'Previous exhibitors (2025)', rows: 133 },
  { file: 'cigre-gcc-power-2025-previous-events-page.csv', id: 'gcc-power-2025', section: 'Previous exhibitors (2025)', rows: 13 },
  { file: 'wetex-2025-previous-events-page.csv', id: 'wetex-2025', section: 'Previous exhibitors (2025)', rows: 40 },
  { file: 'vietnam-energy-week-2025-previous-events-page.csv', id: 'vietnam-energy-week-2025', section: 'Previous edition', rows: 2 }
];

const HISTORY_SOURCE = {
  'ep-shanghai-2026': 'https://www.epchinashow.com/EP/visitor/exhibitorlist/eng',
  'enlit-europe-2026': 'https://www.enlit-europe.com/exhibition/exhibitor-list',
  'adipec-2026': 'https://www.adipec.com/exhibition/exhibitor-list/',
  'energetics-2026': 'https://energetics.targi.lublin.pl/lista-wystawcow/',
  'elecrama-2025': 'https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf',
  'gcc-power-2025': 'https://cigre-gccpower.com/gccpower2025/docs/floor-plan.pdf',
  'wetex-2025': 'https://www.wetex.ae/images/WETEX_SHOW_CATALOGUE_2025.pdf',
  'vietnam-energy-week-2025': 'https://vietnamenergyweek.com/en/exhibitor-profile/'
};

const YEAR = {
  'ep-shanghai-2026': 2026,
  'enlit-europe-2026': 2026,
  'adipec-2026': 2026,
  'energetics-2026': 2026,
  'elecrama-2025': 2025,
  'gcc-power-2025': 2025,
  'wetex-2025': 2025,
  'vietnam-energy-week-2025': 2025
};

/* Sister or parent profiles. The official list names a different legal entity,
 * so these stay separate listings. */
const SEPARATE = {
  'TPN-0286': {
    avoid: ['green-transfo'],
    note: 'The ENERGETICS 2026 exhibitor list names MEFTA GREEN TRANSFO ENERGY POLAND SP. Z O.O. Green Transfo in the census is the French company. The Polish legal name is not that profile, so it stays a separate unclaimed manufacturer. https://energetics.targi.lublin.pl/lista-wystawcow/'
  },
  'TPN-0287': {
    avoid: ['sonel-instruments-india-private-limited'],
    note: 'ENERGETICS lists SONEL S.A. SONEL INSTRUMENTS INDIA PRIVATE LIMITED is a different laboratory. The Polish company stays separate. https://energetics.targi.lublin.pl/lista-wystawcow/'
  },
  'TPN-0291': {
    avoid: ['rugged-monitoring-inc'],
    note: 'ELECRAMA lists RMES PVT. LTD. - RUGGED MONITORING. The directory accessory is Rugged Monitoring Inc. The Indian company name is not that profile, so it stays separate. https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf'
  },
  'TPN-0300': {
    avoid: ['kinectrics'],
    note: 'ELECRAMA lists KINECTRICS INDIA PRIVATE LIMITED at H10-B68. The directory laboratory Kinectrics is the Canadian lab. Kinectrics says the parent exhibited and that Kinectrics India is the South Asia channel, which does not make the Canadian profile the Indian company. The Indian listing stays separate. https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf'
  },
  'TPN-0301': {
    avoid: ['a-eberle-gmbh-and-co-kg'],
    note: 'ELECRAMA lists A. EBERLE SYSTEMS PVT. LTD. The directory accessory is A. Eberle GmbH & Co. KG. The Indian company stays separate, the same way Megger India and Omicron India stayed separate. https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf'
  },
  'TPN-0303': {
    avoid: ['kema-labs-arnhem', 'kema-labs-milan', 'iph-berlin'],
    note: 'ELECRAMA lists CESI S.P.A. at H11-C56. CESI says that company stood at H11-C56. KEMA Labs Arnhem, Milan and Berlin stay separate laboratories. https://www.cesi.it/news/2025/meet-us-at-elecrama-2025/'
  },
  'TPN-0305': {
    avoid: [],
    note: 'ELECRAMA lists DNV PTE LTD. No DNV profile is in the directory. The Singapore company stays its own unclaimed laboratory. https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf'
  },
  'TPN-0307': {
    avoid: [],
    note: 'ELECRAMA lists ELANTAS BECK INDIA LTD. No Elantas profile is in the directory. The Indian company stays its own unclaimed accessory. https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf'
  },
  'TPN-0310': {
    avoid: [],
    note: 'ELECRAMA lists ZERA INDIA PRIVATE LIMITED. The sheet website is the German parent domain. No Zera profile is in the directory, so the Indian company stays its own unclaimed laboratory. https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf'
  },
  'TPN-0312': {
    avoid: ['transfix-transformers-sa'],
    note: 'ELECRAMA lists TRANSFIX (INDIA) PRIVATE LIMITED. Transfix Transformers SA is a South African manufacturer. The Indian company stays a separate accessory. https://elecrama.com/wp-content/uploads/2025/01/exhibitor-list-2025.pdf'
  }
};

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

function asciiSlug(s) {
  const mapped = String(s || '').replace(/[Łł]/g, 'l').replace(/[Øø]/g, 'o').replace(/[Đđ]/g, 'd').replace(/ß/g, 'ss');
  return mapped.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normKey(s) {
  return String(s || '').replace(/\u00a0/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function displayName(s) {
  return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Keeps CJK. normKey drops every non-Latin letter and would collapse Chinese names. */
function matchKey(s) {
  return displayName(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

function cleanProducts(value) {
  return String(value || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '').replace(/\s+/g, ' ').trim();
}

function padId(n) { return 'TPN-' + String(n).padStart(4, '0'); }

const manufacturers = readJson('data/manufacturers.json');
const accessories = readJson('data/accessories.json');
const laboratories = readJson('data/laboratories.json');
const services = readJson('data/services.json');
const badges = readJson('data/event-badges.json');
const directoryFile = readJson('data/event-directory.json');
const extras = readJson('data/permanent-id-extras.json');
const decisions = readJson('data/event-batch-decisions.json');
const integrity = readJson('data/directory-integrity.json');
const ids = readJson('data/permanent-ids.json');
const retirements = readJson('data/laboratory-retirements.json');
const companySlugs = readJson('data/company-slugs.json');

if (manufacturers.some((g) => (g.makers || []).some((m) => m[0] === 'QUALITY POWER ELECTRICAL EQUIPMENTS PVT. LTD.'))) {
  console.log('event batch refresh already imported');
  process.exit(0);
}

const masterRows = table(path.join(BATCH, 'tp-new-listings-master.csv'));
const master = {};
masterRows.forEach((row) => { master[String(row.new_listing_id || '').trim()] = row; });
if (masterRows.length !== 312) throw new Error('expected 312 master rows, got ' + masterRows.length);
if (master['TPN-0276']) throw new Error('TPN-0276 is still in the master');
for (let n = 284; n <= 313; n++) {
  if (!master[padId(n)]) throw new Error('missing ' + padId(n));
}
for (let n = 1; n <= 283; n++) {
  const id = padId(n);
  if (id === 'TPN-0276') continue;
  if (!master[id]) throw new Error('earlier id missing ' + id);
}

const tagRows = table(path.join(BATCH, 'tp-existing-profiles-event-tags.csv'));
if (tagRows.length !== 85) throw new Error('expected 85 existing-profile tags, got ' + tagRows.length);

const groups = {};
manufacturers.forEach((g) => { groups[g.country] = g; });
function countryGroup(country) {
  if (groups[country]) return groups[country];
  throw new Error('no census country group for ' + country);
}

const CAP_KEYS = ['lightning_impulse', 'switching_impulse', 'partial_discharge', 'temperature_rise', 'short_circuit', 'sound_level', 'dielectric_withstand', 'oil_testing', 'materials_testing', 'sfra'];
function blankCaps() {
  const caps = {};
  CAP_KEYS.forEach((k) => { caps[k] = null; });
  return caps;
}

const used = new Set(Object.keys(ids.companies || {}));
companySlugs.forEach((row) => { if (row.slug) used.add(row.slug); });
(accessories.suppliers || []).forEach((s) => {
  if (s.slug) used.add(s.slug);
  const slug = asciiSlug(s.name);
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

function claimSlug(base, name) {
  if (!base) throw new Error('empty slug for ' + name);
  if (used.has(base)) throw new Error('slug collision ' + base + ' for ' + name);
  used.add(base);
  return base;
}

function directoryOf(category) {
  if (category === 'Transformer manufacturer') return 'manufacturers';
  if (category === 'Components & materials') return 'accessories';
  if (category === 'Testing, monitoring & labs') return 'laboratories';
  if (category === 'Services') return 'services';
  throw new Error('unknown category ' + category);
}

function hrefFor(directory, slug) {
  return '/' + directory + '/' + slug + '/';
}

const byNorm = new Map();
function remember(name, rec) {
  const key = normKey(name);
  if (!key || byNorm.has(key)) return;
  byNorm.set(key, rec);
}
companySlugs.forEach((row) => remember(row.name, { slug: row.slug, directory: 'manufacturers', name: row.name }));
(accessories.suppliers || []).forEach((s) => remember(s.name, { slug: s.slug || asciiSlug(s.name), directory: 'accessories', name: s.name }));
(laboratories.laboratories || []).forEach((lab) => remember(lab.name, { slug: String(lab.id || '').replace(/^lab:/, ''), directory: 'laboratories', name: lab.name }));
(services.services || []).forEach((s) => remember(s.company_name, { slug: String(s.id || '').replace(/^srv:/, ''), directory: 'services', name: s.company_name }));

const added = [];

function addEntity(row) {
  const name = displayName(row.company);
  const hit = byNorm.get(normKey(name));
  if (hit) throw new Error('new id ' + row.new_listing_id + ' matches existing ' + hit.directory + '/' + hit.slug);
  const country = '—';
  const city = '—';
  const site = httpUrl(row.website);
  const products = cleanProducts(row.products);
  const directory = directoryOf(displayName(row.category));
  const slug = claimSlug(asciiSlug(name), name);
  const evidence = 'Unclaimed listing from the event batch. ' + displayName(row.event_history || '');
  if (/do_not_contact/i.test(evidence)) throw new Error('evidence leaked outreach for ' + name);
  const rec = { slug: slug, directory: directory, name: name, country: '', website: site, action: 'added' };
  if (directory === 'manufacturers') {
    countryGroup(country).makers.push([name, city, site, '']);
  } else if (directory === 'accessories') {
    accessories.suppliers.push({
      name: name,
      country: '',
      state: '',
      city: city,
      website: site,
      categories: [],
      description: products || 'Unclaimed directory listing.',
      role: 'Unclaimed listing',
      listing_status: 'unclaimed',
      verification_status: 'Unclaimed',
      verification_date: '—',
      evidence_source: evidence,
      directory_source_title: evidence
    });
    extras.push({ slug: slug, name: name, country: '', directory: directory });
  } else if (directory === 'laboratories') {
    laboratories.laboratories.push({
      id: 'lab:' + slug,
      name: name,
      country: '',
      city: city,
      website: site,
      third_party_independent: false,
      max_voltage_kv: null,
      short_circuit_capacity: '',
      capabilities: blankCaps(),
      description: products || 'Unclaimed directory listing. No accreditation is claimed.',
      last_verified: '—',
      source: evidence,
      directory_source_title: evidence,
      rfq_eligible: false,
      profile_page: true
    });
    extras.push({ slug: slug, name: name, country: '', directory: directory });
  } else {
    throw new Error('refresh did not expect a service row ' + name);
  }
  remember(name, rec);
  added.push(Object.assign({ id: row.new_listing_id.trim(), website: site }, rec));
  return rec;
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
    note: 'The exhibitor batch left this field unstated. Labeled unknown on 2026-10-20 so the row can stay unpublished as a guess.'
  });
}

function labelUnknown(rec, website) {
  const country = rec.directory === 'manufacturers' ? '—' : '';
  flag(rec.directory, rec.name, country, 'country');
  if (!website) flag(rec.directory, rec.name, country, 'website');
  if (rec.directory === 'manufacturers') flag(rec.directory, rec.name, country, 'types');
}

function canonicalName(directory, slug, fallback) {
  if (directory === 'manufacturers') {
    const row = companySlugs.find((r) => r.slug === slug);
    if (row) return row.name;
  } else if (directory === 'accessories') {
    const row = (accessories.suppliers || []).find((s) => s.slug === slug || asciiSlug(s.name) === slug);
    if (row) return row.name;
  } else if (directory === 'laboratories') {
    const row = (laboratories.laboratories || []).find((lab) => String(lab.id || '') === 'lab:' + slug);
    if (row) return row.name;
  } else if (directory === 'services') {
    const row = (services.services || []).find((s) => String(s.id || '') === 'srv:' + slug);
    if (row) return row.company_name;
  }
  const page = path.join(ROOT, directory, slug, 'index.html');
  if (!fs.existsSync(page)) throw new Error('missing profile ' + directory + '/' + slug);
  return fallback;
}

function ensureBadge(slug, name, alias, eventId) {
  let row = (badges.companies || []).find((c) => c.slug === slug);
  if (!row) {
    row = { slug: slug, name: name, history: [] };
    badges.companies.push(row);
  }
  const shown = alias && alias !== row.name ? alias : '';
  if (shown) {
    row.aliases = row.aliases || [];
    if (row.aliases.indexOf(shown) < 0 && shown !== row.name) row.aliases.push(shown);
  }
  row.history = row.history || [];
  if (!row.history.some((h) => h.event === eventId)) {
    row.history.push({ event: eventId, year: YEAR[eventId], source: HISTORY_SOURCE[eventId] });
  }
}

const sections = directoryFile.sections;
const createdById = {};

PAGES.forEach((page) => {
  const rows = table(path.join(BATCH, page.file));
  if (rows.length !== page.rows) throw new Error(page.file + ' expected ' + page.rows + ' rows, got ' + rows.length);
  const block = sections[page.id];
  if (!block) throw new Error('missing directory section ' + page.id);
  const existing = new Map();
  (block.entries || []).forEach((entry) => {
    const key = matchKey(entry.name);
    if (!key) throw new Error('blank directory name in ' + page.id);
    if (existing.has(key)) throw new Error('duplicate directory name ' + entry.name + ' in ' + page.id);
    existing.set(key, entry);
  });
  const next = [];
  const consumed = new Set();
  rows.forEach((row) => {
    const section = displayName(row.section);
    if (section !== page.section) throw new Error(page.file + ' section ' + JSON.stringify(section));
    const company = displayName(row.company);
    const key = matchKey(company);
    const link = String(row.link_or_id || '').trim();
    if (existing.has(key)) {
      const entry = existing.get(key);
      consumed.add(key);
      next.push({ name: company, slug: entry.slug, directory: entry.directory, href: entry.href });
      ensureBadge(entry.slug, entry.name || company, company, page.id);
      return;
    }
    if (/^TPN-\d+$/.test(link)) {
      const id = link;
      const num = parseInt(id.slice(4), 10);
      if (num < 284 || num > 313) throw new Error('earlier id appeared as a new directory row ' + id + ' ' + company);
      if (createdById[id]) {
        const rec = createdById[id];
        next.push({ name: company, slug: rec.slug, directory: rec.directory, href: hrefFor(rec.directory, rec.slug) });
        ensureBadge(rec.slug, rec.name, company, page.id);
        return;
      }
      const masterRow = master[id];
      if (!masterRow) throw new Error('missing master ' + id);
      if (matchKey(masterRow.company) !== key) throw new Error('page name differs from master for ' + id);
      const separate = SEPARATE[id];
      if (separate) {
        separate.avoid.forEach((slug) => {
          if (!used.has(slug)) throw new Error('avoid slug missing ' + slug + ' for ' + id);
        });
        decisions.push({
          company: company,
          decision: 'separate',
          slug: asciiSlug(company),
          directory: directoryOf(displayName(masterRow.category)),
          note: separate.note
        });
      }
      const rec = addEntity(masterRow);
      if (separate) {
        const last = decisions[decisions.length - 1];
        last.slug = rec.slug;
        last.directory = rec.directory;
      }
      labelUnknown(rec, rec.website);
      createdById[id] = rec;
      next.push({ name: company, slug: rec.slug, directory: rec.directory, href: hrefFor(rec.directory, rec.slug) });
      ensureBadge(rec.slug, rec.name, company, page.id);
      return;
    }
    const m = link.match(/transformerpath\.com\/(manufacturers|accessories|laboratories|services)\/([^/?#]+)\/?/);
    if (!m) throw new Error('unparsed new row ' + company + ' ' + link);
    const directory = m[1];
    const slug = m[2];
    const profile = canonicalName(directory, slug, company);
    decisions.push({
      company: company,
      decision: 'tag',
      slug: slug,
      directory: directory,
      note: 'The exhibitor name matches the linked profile closely enough to tag it. ' + link
    });
    next.push({ name: company, slug: slug, directory: directory, href: hrefFor(directory, slug) });
    ensureBadge(slug, profile, company, page.id);
    consumed.add('url:' + slug);
  });
  existing.forEach((entry, key) => {
    if (consumed.has(key)) return;
    if (page.id === 'elecrama-2025' && entry.slug === RETIRED_SLUG) return;
    throw new Error('directory row missing from the refresh CSV: ' + page.id + ' ' + entry.name);
  });
  block.section = page.section;
  block.entries = next;
});

const newIds = Object.keys(createdById);
if (newIds.length !== 30) throw new Error('expected 30 new listings, got ' + newIds.length);

/* TPN-0276 was created only for ELECRAMA. No other history, so the listing goes. */
const retiredBadge = (badges.companies || []).find((c) => c.slug === RETIRED_SLUG);
if (!retiredBadge) throw new Error('missing Schweitzer badge');
const otherHistory = (retiredBadge.history || []).filter((h) => h.event !== 'elecrama-2025');
if (otherHistory.length) throw new Error('Schweitzer has another event: ' + JSON.stringify(otherHistory));
badges.companies = badges.companies.filter((c) => c.slug !== RETIRED_SLUG);

const labIndex = laboratories.laboratories.findIndex((lab) => lab.id === 'lab:' + RETIRED_SLUG);
if (labIndex < 0) throw new Error('missing Schweitzer laboratory');
const retiredLab = laboratories.laboratories[labIndex];
const otherSource = String(retiredLab.source || '') + ' ' + String(retiredLab.directory_source_title || '');
if (!/ELECRAMA 2025/.test(otherSource) || /EP Shanghai|Enlit|ADIPEC|ENERGETICS|WETEX|GCC|Vietnam/i.test(otherSource)) {
  throw new Error('Schweitzer source is not ELECRAMA-only: ' + otherSource);
}
laboratories.laboratories.splice(labIndex, 1);
laboratories.total_laboratories = laboratories.laboratories.length;

const extraIndex = extras.findIndex((row) => row.slug === RETIRED_SLUG);
if (extraIndex < 0) throw new Error('missing Schweitzer permanent-id extra');
extras.splice(extraIndex, 1);

const tomb = ids.companies[RETIRED_SLUG];
if (!tomb || tomb.id !== RETIRED_ID) throw new Error('TPM-001072 was not on ' + RETIRED_SLUG);
tomb.retired = true;
tomb.retired_at = CHECKED;
tomb.reason = 'TPN-0276 was dropped from ELECRAMA 2025. The listing existed only as that unclaimed batch row, so the laboratory page and claim page were removed. This permanent ID stays reserved.';

if (!retirements.retired.some((row) => row.id === 'lab:' + RETIRED_SLUG)) {
  retirements.retired.push({
    id: 'lab:' + RETIRED_SLUG,
    name: retiredLab.name,
    slug: RETIRED_SLUG,
    permanent_id: RETIRED_ID,
    retired: CHECKED,
    reason: 'TPN-0276 was removed from the ELECRAMA 2025 exhibitor file. The laboratory was created only from that batch and had no other event or source. The profile page and claim page were removed. TPM-001072 stays reserved and is not reused.'
  });
}

integrity.flags = integrity.flags.filter((f) => f.name !== retiredLab.name);
const green = 'Mefta Green Transfo Energy Poland Sp. z o.o. is a separate unclaimed listing sourced from the ENERGETICS 2026 exhibitor list. The French Green Transfo profile was not tagged.';
let greenReplaced = false;
integrity.not_merged = (integrity.not_merged || []).map((line) => {
  if (String(line).indexOf('Green Transfo Poland') !== 0) return line;
  greenReplaced = true;
  return green;
});
if (!greenReplaced) throw new Error('Green Transfo not_merged note was not found');

fs.rmSync(path.join(ROOT, 'laboratories', RETIRED_SLUG), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, 'claim-listing', RETIRED_SLUG), { recursive: true, force: true });

const shipped = JSON.stringify(sections) + JSON.stringify(added) + JSON.stringify(extras) + JSON.stringify(badges) + JSON.stringify(decisions);
if (/do_not_contact/i.test(shipped)) throw new Error('do_not_contact leaked');
if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(added))) throw new Error('email leaked into new listings');

writeJson('data/manufacturers.json', manufacturers);
writeJson('data/accessories.json', accessories);
writeJson('data/laboratories.json', laboratories);
writeJson('data/event-badges.json', badges);
writeJson('data/event-directory.json', directoryFile);
writeJson('data/permanent-id-extras.json', extras);
writeJson('data/event-batch-decisions.json', decisions);
writeJson('data/directory-integrity.json', integrity);
writeJson('data/permanent-ids.json', ids);
writeJson('data/laboratory-retirements.json', retirements);

const byDirectory = added.reduce((acc, row) => { acc[row.directory] = (acc[row.directory] || 0) + 1; return acc; }, {});
const report = {
  master_rows: masterRows.length,
  existing_profile_tags: tagRows.length,
  added: added.length,
  added_by_directory: byDirectory,
  added_ids: added.map((row) => ({ id: row.id, name: row.name, slug: row.slug, directory: row.directory })),
  separate: decisions.filter((row) => row.decision === 'separate').slice(-10),
  new_tags: decisions.filter((row) => row.decision === 'tag').slice(-8),
  retired: { slug: RETIRED_SLUG, permanent_id: RETIRED_ID, removed: 'listing and claim page' },
  event_rows: PAGES.map((page) => ({ event: page.id, rows: sections[page.id].entries.length }))
};
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/event-batch-refresh-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
