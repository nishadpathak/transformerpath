#!/usr/bin/env node
/* Import the multi-event listing batch.
 * Outreach columns (do_not_contact, phone, email, address) are not written.
 * A second run stops once the generic Siemens listing exists.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BATCH = process.argv[2] || '/cursor/stores/bot/event-batch';
const CHECKED = '2026-10-20';

const PAGES = [
  { file: 'ep-shanghai-2026-events-page.csv', id: 'ep-shanghai-2026', section: 'Exhibiting at EP Shanghai 2026' },
  { file: 'enlit-europe-2026-events-page.csv', id: 'enlit-europe-2026', section: 'Exhibiting at Enlit Europe 2026' },
  { file: 'adipec-2026-events-page.csv', id: 'adipec-2026', section: 'Exhibiting at ADIPEC 2026' },
  { file: 'energetics-lublin-2026-events-page.csv', id: 'energetics-2026', section: 'Exhibiting at ENERGETICS 2026' },
  { file: 'elecrama-2025-previous-events-page.csv', id: 'elecrama-2025', section: 'Previous exhibitors (2025)' },
  { file: 'cigre-gcc-power-2025-previous-events-page.csv', id: 'gcc-power-2025', section: 'Previous exhibitors (2025)' },
  { file: 'wetex-2025-previous-events-page.csv', id: 'wetex-2025', section: 'Previous exhibitors (2025)' },
  { file: 'vietnam-energy-week-2025-previous-events-page.csv', id: 'vietnam-energy-week-2025', section: 'Previous edition' }
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

const BADGE_EVENTS = [
  {
    slug: 'enlit-europe-2026', series: 'enlit-europe', name: 'Enlit Europe', year: 2026,
    past_name: 'Enlit Europe 2026', start: '2026-11-10', end: '2026-11-12', timezone: 'Europe/Vienna',
    url: '/events/enlit-europe-2026/', source_url: 'https://www.enlit-europe.com/',
    source_note: 'Official Enlit Europe pages checked 20 Oct 2026: 10–12 November 2026 at Messe Wien, Vienna. History cites the exhibitor-list page.'
  },
  {
    slug: 'adipec-2026', series: 'adipec', name: 'ADIPEC', year: 2026,
    past_name: 'ADIPEC 2026', start: '2026-11-02', end: '2026-11-05', timezone: 'Asia/Dubai',
    url: '/events/adipec-2026/', source_url: 'https://www.adipec.com/',
    source_note: 'Official ADIPEC pages checked 20 Oct 2026: 2–5 November 2026 at ADNEC, Abu Dhabi. The badge stays highlighted through 5 November. History cites the exhibitor-list page.'
  },
  {
    slug: 'energetics-2026', series: 'energetics', name: 'ENERGETICS', year: 2026,
    past_name: 'ENERGETICS 2026', start: '2026-11-17', end: '2026-11-19', timezone: 'Europe/Warsaw',
    url: '/events/energetics-2026/', source_url: 'https://energetics.targi.lublin.pl/',
    source_note: 'Official Targi Lublin pages checked 20 Oct 2026: 17–19 November 2026. History cites the exhibitor list.'
  },
  {
    slug: 'elecrama-2025', series: 'elecrama', name: 'ELECRAMA', year: 2025,
    past_name: 'ELECRAMA 2025', start: '2025-02-22', end: '2025-02-26', timezone: 'Asia/Kolkata',
    url: '/events/elecrama-2025/', source_url: 'https://elecrama.com/message/',
    source_note: 'Official ELECRAMA message page and the exhibitor-list PDF: 22–26 February 2025 at India Expo Mart, Greater Noida. History cites that PDF.'
  },
  {
    slug: 'gcc-power-2025', series: 'gcc-power', name: 'CIGRE GCC Power', year: 2025,
    past_name: 'CIGRE GCC Power 2025', start: '2025-11-10', end: '2025-11-12', timezone: 'Asia/Kuwait',
    url: '/events/gcc-power-2025/', source_url: 'https://cigre-gccpower.cigre-gcc.org/gccpower2025/',
    source_note: 'Official GCC POWER 2025 page: 10–12 November 2025 at The Regency Hotel, Kuwait. History cites the official floor plan, which names the stands.'
  },
  {
    slug: 'wetex-2025', series: 'wetex', name: 'WETEX', year: 2025,
    past_name: 'WETEX 2025', start: '2025-09-30', end: '2025-10-02', timezone: 'Asia/Dubai',
    url: '/events/wetex-2025/', source_url: 'https://www.dwtc.com/en/events/wetex-2025/',
    source_note: 'Dubai World Trade Centre event page: 30 September–2 October 2025. History cites the organiser exhibition catalogue PDF.'
  },
  {
    slug: 'vietnam-energy-week-2025', series: 'vietnam-energy-week', name: 'Vietnam Energy Week', year: 2025,
    past_name: 'Vietnam Energy Week 2025', start: '2025-11-05', end: '2025-11-07', timezone: 'Asia/Ho_Chi_Minh',
    url: '/events/vietnam-energy-week-2025/', source_url: 'https://www.vietnamenergyweek.com/en/technical-seminar/',
    source_note: 'Official seminar page states 05–07/11/2025 at SECC, Ho Chi Minh City. History cites the official exhibitor profile list, which names ACEZ Instruments. This is a different series from Vietnam ETE.'
  }
];

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
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
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

const COUNTRY_ALIAS = {
  'united arab emirates': 'UAE',
  uae: 'UAE',
  'republic of korea': 'South Korea',
  'south korea': 'South Korea'
};

function censusCountry(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '—' || s === '-' || s === '–') return '—';
  return COUNTRY_ALIAS[s.toLowerCase()] || s;
}

/* Names the sheet pointed at a sister or a generic brand. A separate listing
 * is created unless the note says tag. */
const DECISIONS = {
  siemens: {
    action: 'separate',
    name: 'Siemens',
    country: '—',
    category: 'Transformer manufacturer',
    note: 'ADIPEC lists SIEMENS and the CIGRE GCC Power 2025 floor plan labels stand B3 SIEMENS. Neither source says Siemens Energy. The sheet URL was the Siemens Energy profile. One unclaimed Siemens listing carries both events. Siemens Energy is not tagged for ADIPEC or CIGRE GCC Power.'
  },
  'siemens energy sp z o o': {
    action: 'separate',
    name: 'Siemens Energy Sp. z o.o.',
    country: 'Poland',
    category: 'Transformer manufacturer',
    note: 'The ENERGETICS exhibitor list names the Polish company Siemens Energy Sp. z o.o. That is a separate legal entity from the Siemens Energy group profile. Enlit Europe 2026 names Siemens Energy and stays on the group profile.'
  },
  'al fanar': {
    action: 'separate',
    name: 'Al Fanar',
    country: '—',
    category: 'Transformer manufacturer',
    note: 'WETEX lists Al Fanar. The sheet URL was alfanar-maroc. The Saudi profile is named alfanar. Al Fanar is not an exact match to either, so neither profile is tagged.'
  },
  'hd hyundai electric': {
    action: 'tag',
    slug: 'hd-hyundai-electric',
    directory: 'manufacturers',
    note: 'WETEX lists HD Hyundai Electric. The sheet URL was HD Hyundai Power Transformers USA, a different plant. The census already has a South Korea profile named HD Hyundai Electric. That profile is tagged. The USA plant is not tagged.'
  },
  'hyosung t and d india pvt ltd': {
    action: 'separate',
    name: 'Hyosung T & D India Pvt Ltd',
    country: 'India',
    category: 'Transformer manufacturer',
    note: 'ELECRAMA lists HYOSUNG T & D INDIA PVT LTD. The sheet URL was Hyosung Heavy Industries. The Indian company stays separate. The CIGRE floor plan says HYOSUNG, which is also kept separate.'
  },
  hyosung: {
    action: 'separate',
    name: 'Hyosung',
    country: '—',
    category: 'Transformer manufacturer',
    note: 'The CIGRE GCC Power 2025 floor plan labels a gold-sponsor stand HYOSUNG, without a legal name. Hyosung Heavy Industries is not tagged.'
  },
  hitachi: {
    action: 'separate',
    name: 'Hitachi',
    country: '—',
    category: 'Transformer manufacturer',
    note: 'The CIGRE GCC Power 2025 floor plan labels a gold-sponsor stand HITACHI, not Hitachi Energy. Hitachi Energy is not tagged for this show. The WETEX row Hitachi Energy stays on the Hitachi Energy profile.'
  },
  'lapp insulators sp z o o': {
    action: 'separate',
    name: 'Lapp Insulators Sp. z o.o.',
    country: 'Poland',
    category: 'Components & materials',
    note: 'ENERGETICS lists the Polish company LAPP INSULATORS SP. Z O.O. The sheet URL was Lapp Insulators GmbH. The Polish company stays separate. The CIGRE floor plan names LAPP INSULATORS and stays on the GmbH profile.'
  },
  'megger sp z o o': {
    action: 'separate',
    name: 'Megger Sp. z o.o.',
    country: 'Poland',
    category: 'Components & materials',
    note: 'ENERGETICS lists MEGGER SP. Z O.O. The sheet URL was Megger Group Limited. The Polish company stays separate. Enlit and the CIGRE floor plan name Megger and stay on the group profile.'
  },
  'megger india pvt ltd': {
    action: 'separate',
    name: 'Megger India Pvt. Ltd.',
    country: 'India',
    category: 'Components & materials',
    note: 'ELECRAMA lists MEGGER INDIA PVT. LTD. The sheet URL was Megger Group Limited. The Indian company stays separate.'
  },
  'omicron energy solutions pvt ltd': {
    action: 'separate',
    name: 'Omicron Energy Solutions Pvt. Ltd',
    country: 'India',
    category: 'Components & materials',
    note: 'ELECRAMA lists OMICRON ENERGY SOLUTIONS PVT. LTD. The sheet URL was OMICRON electronics GmbH. The Indian company stays separate. The CIGRE floor plan names OMICRON and stays on the GmbH profile.'
  },
  'sgb transformers india pvt ltd': {
    action: 'separate',
    name: 'SGB Transformers India Pvt Ltd',
    country: 'India',
    category: 'Transformer manufacturer',
    note: 'ELECRAMA lists SGB TRANSFORMERS INDIA PVT LTD. The sheet URL was SGB-SMIT Group. The Indian company stays separate. SGB MY Sdn Bhd is a different Malaysia profile and is not tagged.'
  },
  'enpay transformer components i pvt ltd': {
    action: 'separate',
    name: 'Enpay Transformer Components (I) Pvt. Ltd.',
    country: 'India',
    category: 'Components & materials',
    note: 'ELECRAMA lists ENPAY TRANSFORMER COMPONENTS (I) PVT. LTD. The sheet URL was the Turkish Enpay profile. The Indian company stays separate.'
  },
  'tesar s r l': {
    action: 'separate',
    name: 'Tesar S.r.l.',
    country: 'Italy',
    category: 'Transformer manufacturer',
    note: 'WETEX lists Tesar S.r.l. The sheet URL was Tesar Gulf, a UAE profile. Tesar (R&S Group) is the Italian profile used for the Enlit TESAR SRL row. The WETEX legal name is not merged into either profile.'
  },
  'federal transformers company llc': {
    action: 'separate',
    name: 'Federal Transformers Company LLC',
    country: 'UAE',
    category: 'Transformer manufacturer',
    note: 'WETEX lists Federal Transformers Company LLC. The sheet URL was Federal Power Transformers LLC. The names differ, so the existing profile is not tagged.'
  },
  'tesla transformers global private limited': {
    action: 'separate',
    name: 'Tesla Transformers (Global) Private Limited',
    country: '—',
    category: 'Transformer manufacturer',
    note: 'ELECRAMA lists TESLA TRANSFORMERS (GLOBAL) PRIVATE LIMITED and TESLA TRANSFORMERS (INDIA) LIMITED against the same Tesla Transformers profile. The India company stays on that profile. The Global company is a separate listing.'
  },
  "ningbo tian an smart grid technology co ltd": {
    action: 'tag',
    slug: 'ningbo-tianan-smart-grid-technology-co-ltd',
    directory: 'manufacturers',
    note: "The EP Shanghai page linked Ningbo Tian'an Smart Grid to Ningbo Tianan (Group). Those companies stay separate. The page link and the existing badge use the Smart Grid profile."
  }
};

const manufacturers = readJson('data/manufacturers.json');
const accessories = readJson('data/accessories.json');
const laboratories = readJson('data/laboratories.json');
const services = readJson('data/services.json');
const badges = readJson('data/event-badges.json');
const events = readJson('data/events.json');
const listingSlugs = readJson('data/listing-slugs.json');
const companySlugs = readJson('data/company-slugs.json');

if (manufacturers.some((g) => (g.makers || []).some((m) => m[0] === 'Siemens' && m[1] === '—'))) {
  console.log('event batch already imported');
  process.exit(0);
}

const byName = new Map();
const byFold = new Map();
function remember(name, rec) {
  if (!name || byName.has(name)) return;
  byName.set(name, rec);
  const fold = normKey(name);
  if (!byFold.has(fold)) byFold.set(fold, []);
  byFold.get(fold).push(rec);
}
function knownSlug(name, fallback) {
  if (listingSlugs[name]) return listingSlugs[name];
  const ascii = asciiSlug(name);
  return ascii || fallback || '';
}
companySlugs.forEach((row) => remember(row.name, { slug: row.slug, directory: 'manufacturers', name: row.name, country: row.country || '' }));
(accessories.suppliers || []).forEach((s) => remember(s.name, { slug: knownSlug(s.name), directory: 'accessories', name: s.name, country: s.country || '' }));
(laboratories.laboratories || []).forEach((lab) => remember(lab.name, { slug: String(lab.id || '').replace(/^lab:/, '') || knownSlug(lab.name), directory: 'laboratories', name: lab.name, country: lab.country || '' }));
(services.services || []).forEach((s) => {
  const slug = String(s.id || '').replace(/^srv:/, '') || asciiSlug(s.company_name);
  remember(s.company_name, { slug: slug, directory: 'services', name: s.company_name, country: s.country || '' });
});

const used = new Set();
companySlugs.forEach((row) => { if (row.slug) used.add(row.slug); });
(accessories.suppliers || []).forEach((s) => { const slug = asciiSlug(s.name); if (slug) used.add(slug); });
(laboratories.laboratories || []).forEach((lab) => { const slug = String(lab.id || '').replace(/^lab:/, ''); if (slug) used.add(slug); });
(services.services || []).forEach((s) => { const slug = String(s.id || '').replace(/^srv:/, ''); if (slug) used.add(slug); });
Object.keys(listingSlugs).forEach((name) => { if (listingSlugs[name]) used.add(listingSlugs[name]); });

function claimSlug(base, name) {
  if (!base) throw new Error('empty slug for ' + name);
  if (used.has(base)) throw new Error('slug collision ' + base + ' for ' + name);
  used.add(base);
  return base;
}

const groups = {};
manufacturers.forEach((g) => { groups[g.country] = g; });
function countryGroup(country) {
  if (groups[country]) return groups[country];
  if (country === '—') {
    const g = { country: '—', region: '', flag: '', makers: [] };
    manufacturers.push(g);
    groups[country] = g;
    return g;
  }
  throw new Error('no census country group for ' + country);
}

const CAP_KEYS = ['lightning_impulse', 'switching_impulse', 'partial_discharge', 'temperature_rise', 'short_circuit', 'sound_level', 'dielectric_withstand', 'oil_testing', 'materials_testing', 'sfra'];
function blankCaps() {
  const caps = {};
  CAP_KEYS.forEach((k) => { caps[k] = null; });
  return caps;
}

const masterRows = table(path.join(BATCH, 'tp-new-listings-master.csv'));
const master = {};
masterRows.forEach((row) => { master[row.new_listing_id.trim()] = row; });
if (Object.keys(master).length !== 283) throw new Error('expected 283 master rows, got ' + Object.keys(master).length);

const created = new Map();
const listings = [];
const decisions = [];
const extras = [];

function directoryOf(category) {
  if (category === 'Transformer manufacturer') return 'manufacturers';
  if (category === 'Components & materials') return 'accessories';
  if (category === 'Testing, monitoring & labs') return 'laboratories';
  if (category === 'Services') return 'services';
  throw new Error('unknown category ' + category);
}

function hrefFor(directory, slug) {
  if (directory === 'manufacturers') return '/manufacturers/' + slug + '/';
  if (directory === 'accessories') return '/accessories/' + slug + '/';
  if (directory === 'laboratories') return '/laboratories/' + slug + '/';
  if (directory === 'services') return '/services/' + slug + '/';
  throw new Error('bad directory ' + directory);
}

function addEntity(spec) {
  const name = displayName(spec.name);
  const existingCreated = created.get(normKey(name));
  if (existingCreated) return existingCreated;
  const country = censusCountry(spec.country);
  const city = spec.city && spec.city.trim() && spec.city.trim() !== '—' ? displayName(spec.city) : '—';
  const site = httpUrl(spec.website);
  const products = cleanProducts(spec.products);
  const directory = directoryOf(spec.category);
  const slug = claimSlug(asciiSlug(name), name);
  const rec = { slug: slug, directory: directory, name: name, country: country === '—' ? '' : country, action: 'added' };
  if (directory === 'manufacturers') {
    countryGroup(country).makers.push([name, city, site, '']);
  } else if (directory === 'accessories') {
    accessories.suppliers.push({
      name: name,
      country: country === '—' ? '' : country,
      state: '',
      city: city,
      website: site,
      categories: [],
      description: products || 'Unclaimed directory listing.',
      role: 'Unclaimed listing',
      listing_status: 'unclaimed',
      verification_status: 'Unclaimed',
      verification_date: '—',
      evidence_source: spec.evidence || '',
      directory_source_title: spec.evidence || ''
    });
    extras.push({ slug: slug, name: name, country: country === '—' ? '' : country, directory: directory });
  } else if (directory === 'laboratories') {
    laboratories.laboratories.push({
      id: 'lab:' + slug,
      name: name,
      country: country === '—' ? '' : country,
      city: city,
      website: site,
      third_party_independent: false,
      max_voltage_kv: null,
      short_circuit_capacity: '',
      capabilities: blankCaps(),
      description: products || 'Unclaimed directory listing. No accreditation is claimed.',
      last_verified: '—',
      source: spec.evidence || '',
      directory_source_title: spec.evidence || '',
      rfq_eligible: false,
      profile_page: true
    });
    extras.push({ slug: slug, name: name, country: country === '—' ? '' : country, directory: directory });
  } else {
    services.services.push({
      id: 'srv:' + slug,
      company_name: name,
      country: country === '—' ? '' : country,
      state_province: '',
      city: city === '—' ? '' : city,
      website: site,
      service_types: [],
      description: products || 'Unclaimed directory listing. Service types are not stated.',
      verification_status: 'Unclaimed',
      verification_date: '—',
      profile_page: true
    });
    extras.push({ slug: slug, name: name, country: country === '—' ? '' : country, directory: directory });
  }
  created.set(normKey(name), rec);
  listings.push(Object.assign({ exhibitor_name: name, profile_name: name }, rec));
  remember(name, rec);
  return rec;
}

function findExisting(name) {
  if (byName.has(name)) return { hit: byName.get(name), how: 'exact' };
  const hits = byFold.get(normKey(name)) || [];
  if (hits.length === 1) return { hit: hits[0], how: 'normalized' };
  if (hits.length > 1) return { hit: null, how: 'ambiguous', hits: hits };
  return { hit: null, how: 'none' };
}

function listingFromMaster(id) {
  const row = master[id];
  if (!row) throw new Error('missing master row ' + id);
  const name = displayName(row.company);
  if (/^KEMA B\.V\./i.test(name)) {
    return {
      slug: 'kema-labs-arnhem',
      directory: 'laboratories',
      name: 'KEMA Labs (CESI Group) — Arnhem',
      alias: name,
      action: 'tagged',
      note: 'KEMA B.V. stays on the Arnhem laboratory. No new laboratory was created.'
    };
  }
  const found = findExisting(name);
  if (found.how === 'ambiguous') throw new Error('ambiguous existing name ' + name);
  if (found.hit) {
    return {
      slug: found.hit.slug,
      directory: found.hit.directory,
      name: found.hit.name,
      alias: name !== found.hit.name ? name : '',
      action: 'tagged',
      note: found.how === 'exact'
        ? 'Already in the directory under the same name. Not created again.'
        : 'Matched the existing listing ' + found.hit.name + ' after case and punctuation were ignored. Not created again.'
    };
  }
  const rec = addEntity({
    name: name,
    country: row.country,
    city: row.city,
    category: row.category,
    website: row.website,
    products: row.products,
    evidence: 'Unclaimed listing from the event batch. ' + displayName(row.event_history || '')
  });
  rec.note = 'New unclaimed ' + rec.directory.replace(/s$/, '') + ' listing.';
  rec.action = 'added';
  return rec;
}

function resolveLink(company, link) {
  const name = displayName(company);
  const key = normKey(name);
  const decision = DECISIONS[key];
  if (decision && decision.action === 'tag') {
    decisions.push({ company: name, decision: 'tag', slug: decision.slug, directory: decision.directory, note: decision.note });
    return { slug: decision.slug, directory: decision.directory, name: name, alias: name, action: 'tagged', note: decision.note };
  }
  if (decision && decision.action === 'separate') {
    const rec = addEntity({
      name: decision.name,
      country: decision.country,
      category: decision.category,
      website: '',
      products: '',
      evidence: decision.note
    });
    decisions.push({ company: name, decision: 'separate', slug: rec.slug, directory: rec.directory, note: decision.note });
    rec.alias = name !== rec.name ? name : '';
    rec.note = decision.note;
    rec.action = 'added';
    return rec;
  }
  if (/^TPN-\d+$/.test(link)) return listingFromMaster(link);
  const m = String(link || '').match(/transformerpath\.com\/(manufacturers|accessories|laboratories|services)\/([^/?#]+)\/?/);
  if (!m) throw new Error('unparsed link for ' + name + ': ' + link);
  decisions.push({
    company: name,
    decision: 'tag',
    slug: m[2],
    directory: m[1],
    note: 'The exhibitor name matches the linked profile closely enough to tag it. ' + link
  });
  return { slug: m[2], directory: m[1], name: name, alias: name, action: 'tagged', note: 'Tagged the linked profile.' };
}

const directory = {};
const totals = {};
PAGES.forEach((page) => {
  const rows = table(path.join(BATCH, page.file));
  directory[page.id] = { section: page.section, entries: [] };
  totals[page.id] = { section: page.section, rows: rows.length, slugs: [] };
  rows.forEach((row) => {
    const section = displayName(row.section);
    if (section !== page.section) throw new Error(page.file + ' section ' + section);
    const company = displayName(row.company);
    const rec = resolveLink(company, String(row.link_or_id || '').trim());
    if (!rec.slug || !rec.directory) throw new Error('unresolved ' + company);
    directory[page.id].entries.push({
      name: company,
      slug: rec.slug,
      directory: rec.directory,
      href: hrefFor(rec.directory, rec.slug)
    });
    totals[page.id].slugs.push(rec.slug);
    const badgeRow = (badges.companies || []).find((c) => c.slug === rec.slug);
    const year = BADGE_EVENTS.concat([{ slug: 'ep-shanghai-2026', year: 2026 }]).find((e) => e.slug === page.id).year;
    const entry = { event: page.id, year: year, source: HISTORY_SOURCE[page.id] };
    if (badgeRow) {
      badgeRow.history = badgeRow.history || [];
      if (!badgeRow.history.some((h) => h.event === entry.event)) badgeRow.history.push(entry);
      const alias = rec.alias || (company !== badgeRow.name ? company : '');
      if (alias) {
        badgeRow.aliases = badgeRow.aliases || [];
        if (badgeRow.aliases.indexOf(alias) < 0 && alias !== badgeRow.name) badgeRow.aliases.push(alias);
      }
    } else {
      const createdBadge = {
        slug: rec.slug,
        name: rec.name || company,
        history: [entry]
      };
      if (rec.alias && rec.alias !== createdBadge.name) createdBadge.aliases = [rec.alias];
      else if (company !== createdBadge.name) createdBadge.aliases = [company];
      badges.companies.push(createdBadge);
    }
  });
});

/* Master rows that never appear on an event page still need a listing. */
masterRows.forEach((row) => {
  const name = displayName(row.company);
  if (created.has(normKey(name))) return;
  if (findExisting(name).hit) return;
  if (/^KEMA B\.V\./i.test(name)) return;
  listingFromMaster(row.new_listing_id);
});

laboratories.total_laboratories = laboratories.laboratories.length;

badges.events = badges.events.concat(BADGE_EVENTS.filter((event) => !badges.events.some((have) => have.slug === event.slug)));
badges.how_to_add = 'Add an event or a year in this file only. No template change. One events object is one edition: slug, series (every year of that show uses the same series and the same name), name, year, past_name, start, end, timezone, url, source_url, source_note. On the company, add one history entry per edition: event (the edition slug), year, source (http or https URL of the exhibitor list for that year). source is required. CI rejects a missing, blank, or non-URL source. On and before the end date, in that timezone, the year stays highlighted: Exhibiting at {name} · {dates}. Years of the same series that have already ended share one line, most recent first: Exhibited at EP Shanghai 2026 · 2025. A show with one past year reads Exhibited at WETEX 2025. The next calendar day after the end date, the highlighted year joins that line. Sourced editions in this file are EP Shanghai 2026, Enlit Europe 2026, ADIPEC 2026, ENERGETICS 2026, ELECRAMA 2025, CIGRE GCC Power 2025, WETEX 2025, and Vietnam Energy Week 2025. Do not add a year that has no exhibitor list.';

function syncShort(ev) {
  ev.n = ev.name;
  ev.s = ev.start;
  ev.e = ev.end;
  ev.c = ev.city;
  ev.co = ev.country;
  ev.r = ev.region;
  ev.v = ev.venue;
  ev.u = ev.official_url;
  ev.d = ev.description;
}

function touch(id, patch) {
  const ev = events.find((row) => row.id === id);
  if (!ev) throw new Error('missing event ' + id);
  Object.keys(patch).forEach((k) => { ev[k] = patch[k]; });
  syncShort(ev);
}

touch('ep-shanghai-2026', { source_checked_at: CHECKED });
touch('enlit-europe-2026', {
  source_checked_at: CHECKED,
  description: 'Official enlit-europe.com page checked 20 Oct 2026: 10–12 November 2026 in Vienna. Homepage counters are not stored as edition stats because the page also quotes earlier Bilbao editions.'
});
touch('adipec-2026', {
  source_checked_at: CHECKED,
  source_url: 'https://www.adipec.com/',
  description: 'Official adipec.com page checked 20 Oct 2026: 2–5 November 2026 at ADNEC, Abu Dhabi. Opening hours run through 5 November, so the edition stays current through that date.'
});
touch('energetics-2026', {
  source_checked_at: CHECKED,
  description: 'Polish energy trade fair. Official page checked 20 Oct 2026: 17–19 November 2026 at Targi Lublin.'
});

function pastEdition(row) {
  if (events.some((ev) => ev.id === row.id)) throw new Error('edition exists ' + row.id);
  const ev = Object.assign({
    edition_label: null,
    organiser: null,
    languagepath_visit_url: null,
    research_status: null,
    stats: { exhibitors: null, visitors: null, area_sqm: null, countries: null, speakers: null },
    key_exhibitors: null,
    programme: null,
    deadlines: null,
    registration: null,
    markets: null,
    intel_links: null
  }, row);
  syncShort(ev);
  events.push(ev);
}

pastEdition({
  id: 'elecrama-2025',
  series_slug: 'elecrama',
  edition_label: '16th',
  name: 'ELECRAMA 2025 (16th edition)',
  type: 'exhibition',
  start: '2025-02-22',
  end: '2025-02-26',
  date_status: 'CONFIRMED',
  venue: 'India Expo Mart, Greater Noida',
  city: 'Greater Noida',
  country: 'India',
  region: 'Asia',
  organiser: 'IEEMA',
  official_url: 'https://elecrama.com/',
  source_url: 'https://elecrama.com/message/',
  source_checked_at: CHECKED,
  relevance_tier: 'HIGH',
  relevance_reason: 'The official ELECRAMA message page and exhibitor-list PDF both state 22–26 February 2025 at India Expo Mart, Greater Noida.',
  description: 'Official ELECRAMA message page checked 20 Oct 2026: 22–26 February 2025 at India Expo Mart, Greater Noida. The exhibitor list is the organiser PDF dated January 2025.',
  lifecycle_status: 'COMPLETED',
  markets: ['india']
});
pastEdition({
  id: 'gcc-power-2025',
  series_slug: 'gcc-power',
  edition_label: '21st',
  name: 'GCC POWER 2025 / CIGRE 21st Conference (Kuwait)',
  type: 'exhibition',
  start: '2025-11-10',
  end: '2025-11-12',
  date_status: 'CONFIRMED',
  venue: 'The Regency Hotel',
  city: 'Kuwait City',
  country: 'Kuwait',
  region: 'Middle East',
  organiser: 'CIGRE GCC',
  official_url: 'https://cigre-gccpower.cigre-gcc.org/gccpower2025/',
  source_url: 'https://cigre-gccpower.cigre-gcc.org/gccpower2025/',
  source_checked_at: CHECKED,
  relevance_tier: 'HIGH',
  relevance_reason: 'The official GCC POWER 2025 page states 10–12 November 2025 at The Regency Hotel, Kuwait. The floor plan names the exhibition stands.',
  description: 'Official GCC POWER 2025 page checked 20 Oct 2026: 10–12 November 2025 at The Regency Hotel, Kuwait. Stand names are taken from the organiser floor plan.',
  lifecycle_status: 'COMPLETED'
});
pastEdition({
  id: 'wetex-2025',
  series_slug: 'wetex',
  edition_label: '27th',
  name: 'WETEX 2025 (27th edition)',
  type: 'exhibition',
  start: '2025-09-30',
  end: '2025-10-02',
  date_status: 'CONFIRMED',
  venue: 'Dubai World Trade Centre',
  city: 'Dubai',
  country: 'UAE',
  region: 'Middle East',
  organiser: 'Dubai Electricity and Water Authority (DEWA)',
  official_url: 'https://www.wetex.ae/',
  source_url: 'https://www.dwtc.com/en/events/wetex-2025/',
  source_checked_at: CHECKED,
  relevance_tier: 'HIGH',
  relevance_reason: 'The Dubai World Trade Centre event page states 30 September–2 October 2025. The organiser catalogue is the exhibitor source.',
  description: 'Dubai World Trade Centre event page checked 20 Oct 2026: 30 September–2 October 2025 at Dubai World Trade Centre, organised by DEWA. This is the 2025 edition, not WETEX 2026.',
  lifecycle_status: 'COMPLETED',
  markets: ['uae']
});
pastEdition({
  id: 'vietnam-energy-week-2025',
  series_slug: 'vietnam-energy-week',
  edition_label: null,
  name: 'Vietnam Energy Week 2025',
  type: 'exhibition',
  start: '2025-11-05',
  end: '2025-11-07',
  date_status: 'CONFIRMED',
  venue: 'Saigon Exhibition and Convention Center (SECC)',
  city: 'Ho Chi Minh City',
  country: 'Vietnam',
  region: 'Asia',
  organiser: 'Informa Markets',
  official_url: 'https://www.vietnamenergyweek.com/',
  source_url: 'https://www.vietnamenergyweek.com/en/technical-seminar/',
  source_checked_at: CHECKED,
  relevance_tier: 'HIGH',
  relevance_reason: 'The official seminar page states 05–07/11/2025 at SECC. The exhibitor profile page lists ACEZ Instruments. This series is not Vietnam ETE.',
  description: 'Official Vietnam Energy Week seminar page checked 20 Oct 2026: 5–7 November 2025 at SECC, Ho Chi Minh City. The batch year was unconfirmed; the organiser page fixes it as 2025.',
  lifecycle_status: 'COMPLETED',
  markets: ['vietnam']
});

const shipped = JSON.stringify(directory) + JSON.stringify(listings) + JSON.stringify(extras) + JSON.stringify(badges);
if (/do_not_contact/i.test(shipped)) throw new Error('do_not_contact leaked');
if (/"phone"\s*:/.test(JSON.stringify(extras)) || /@[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(listings))) {
  throw new Error('outreach fields leaked into new listing records');
}

writeJson('data/manufacturers.json', manufacturers);
writeJson('data/accessories.json', accessories);
writeJson('data/laboratories.json', laboratories);
writeJson('data/services.json', services);
writeJson('data/listing-slugs.json', listingSlugs);
writeJson('data/event-badges.json', badges);
writeJson('data/events.json', events);
writeJson('data/event-directory.json', { sections: directory });
writeJson('data/permanent-id-extras.json', extras);
writeJson('data/event-batch-decisions.json', decisions);

const added = listings.filter((row) => row.action === 'added');
const report = {
  master_rows: masterRows.length,
  added: added.length,
  added_by_directory: added.reduce((acc, row) => { acc[row.directory] = (acc[row.directory] || 0) + 1; return acc; }, {}),
  decisions: decisions,
  totals: Object.keys(totals).map((id) => ({
    event: id,
    section: totals[id].section,
    rows: totals[id].rows,
    unique_profiles: new Set(totals[id].slugs).size
  }))
};
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/event-batch-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
