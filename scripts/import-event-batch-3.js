#!/usr/bin/env node
/* Batch 3 exhibitor import: TPN-0314 through TPN-0360, plus uncertain
 * group matches kept as their own listings. Earlier IDs are not rewritten.
 * Outreach columns are not written. A second run stops once ABB is in the census.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BATCH = process.argv[2] || '/cursor/stores/bot/event-batch-3';
const CHECKED = '2026-10-20';

const PAGES = [
  { file: 'power-bangladesh-2023-previous-events-page.csv', id: 'power-bangladesh-2023', section: 'Previous exhibitors (2023)', rows: 10 },
  { file: 'cigre-symposium-heidelberg-2027-events-page.csv', id: 'cigre-international-symposium-heidelberg-2027', section: 'Exhibiting at CIGRE Symposium Heidelberg 2027', rows: 11 },
  { file: 'vde-hochspannungstechnik-2026-events-page.csv', id: 'vde-hochspannungstechnik-2026', section: 'Exhibiting at VDE Hochspannungstechnik 2026', rows: 8 },
  { file: 'jeca-fair-2027-events-page.csv', id: 'jeca-fair-kansai-edition-2027', section: 'Exhibiting at JECA FAIR 2027', rows: 3 },
  { file: 'electrical-expo-stl-2026-previous-events-page.csv', id: 'electrical-expo-2026', section: 'Previous exhibitors (2026)', rows: 13 },
  { file: 'ecce-europe-2026-previous-events-page.csv', id: 'ecce-europe-2026', section: 'Previous exhibitors (2026)', rows: 6 },
  { file: 'power-and-water-nigeria-2026-previous-events-page.csv', id: 'power-and-water-nigeria-exhibition-2026', section: 'Previous exhibitors (2026)', rows: 3 },
  { file: 'power-and-energy-kenya-2027-events-page.csv', id: 'power-and-energy-kenya-2027', section: 'Exhibiting at Power & Energy Kenya 2027', rows: 1 },
  { file: 'power-and-energy-tanzania-2026-previous-events-page.csv', id: 'power-and-energy-tanzania-2026', section: 'Previous exhibitors (2026)', rows: 1 },
  { file: 'solar-storage-live-philippines-2026-previous-events-page.csv', id: 'electric-and-power-philippines-2026', section: 'Previous exhibitors (2026)', rows: 8 },
  { file: 'solar-storage-live-africa-2026-previous-events-page.csv', id: 'power-and-electricity-world-africa-2026', section: 'Previous exhibitors (2026)', rows: 3 }
];

const HISTORY_SOURCE = {
  'power-bangladesh-2023': 'https://power-bangladesh.com/page/exhibitor-list',
  'cigre-international-symposium-heidelberg-2027': 'https://www.cigresymposium2027.de/all-exhibitors-sponsors/',
  'vde-hochspannungstechnik-2026': 'https://www.vde-hochspannungstechnik.de/de/fachausstellung',
  'jeca-fair-kansai-edition-2027': 'https://www.jecafair.jp/exhibitor/',
  'electrical-expo-2026': 'https://electricalboard.org/electrical-expos-2026exhibitors/',
  'ecce-europe-2026': 'https://www.ecce-europe.org/2026/exhibitionsponsorship/exhibitors/',
  'power-and-water-nigeria-exhibition-2026': 'https://pnwnigeria.com/exhibitor-directory/',
  'power-and-energy-kenya-2027': 'https://expogr.com/kenyaenergy/exhibitor_list.php',
  'power-and-energy-tanzania-2026': 'https://www.expogr.com/tanzania/powerenergy/exhibitor_list.php',
  'electric-and-power-philippines-2026': 'https://www.terrapinn.com/exhibition/solar-storage-live-philippines/2026-Sponsors-Exhibitors.stm',
  'power-and-electricity-world-africa-2026': 'https://www.terrapinn.com/exhibition/solar-storage-live-africa/Sponsors-exhibitors.stm'
};

const YEAR = {
  'power-bangladesh-2023': 2023,
  'cigre-international-symposium-heidelberg-2027': 2027,
  'vde-hochspannungstechnik-2026': 2026,
  'jeca-fair-kansai-edition-2027': 2027,
  'electrical-expo-2026': 2026,
  'ecce-europe-2026': 2026,
  'power-and-water-nigeria-exhibition-2026': 2026,
  'power-and-energy-kenya-2027': 2027,
  'power-and-energy-tanzania-2026': 2026,
  'electric-and-power-philippines-2026': 2026,
  'power-and-electricity-world-africa-2026': 2026
};

const BADGE_EVENTS = [
  { slug: 'power-bangladesh-2023', series: 'power-bangladesh', name: 'Power Bangladesh', year: 2023, past_name: 'Power Bangladesh 2023', start: '2023-12-07', end: '2023-12-09', timezone: 'Asia/Dhaka', url: '/events/power-bangladesh-2023/', source_url: 'https://power-bangladesh.com/page/exhibitor-list', source_note: 'The 25th Power Bangladesh International Expo ran 7–9 December 2023 at International Convention City Bashundhara, Dhaka. History cites the organiser exhibitor list, which still names these companies.' },
  { slug: 'cigre-international-symposium-heidelberg-2027', series: 'cigre-international-symposium-heidelberg', name: 'CIGRE Symposium Heidelberg', year: 2027, past_name: 'CIGRE Symposium Heidelberg 2027', start: '2027-04-27', end: '2027-04-30', timezone: 'Europe/Berlin', url: '/events/cigre-international-symposium-heidelberg-2027/', source_url: 'https://www.cigresymposium2027.de/', source_note: 'Official symposium page checked 20 Oct 2026: 27–30 April 2027 at the Heidelberg Congress Centre. History cites the exhibitor and sponsor page.' },
  { slug: 'vde-hochspannungstechnik-2026', series: 'vde-hochspannungstechnik', name: 'VDE Hochspannungstechnik', year: 2026, past_name: 'VDE Hochspannungstechnik 2026', start: '2026-11-10', end: '2026-11-12', timezone: 'Europe/Berlin', url: '/events/vde-hochspannungstechnik-2026/', source_url: 'https://www.vde.com/de/veranstaltungen/info?id=23803&type=vde%7Cvdb', source_note: 'VDE event page checked 20 Oct 2026: 10–12 November 2026 at Mercure Hotel MOA Berlin. History cites the Fachausstellung page.' },
  { slug: 'jeca-fair-kansai-edition-2027', series: 'jeca-fair-kansai-edition', name: 'JECA FAIR', year: 2027, past_name: 'JECA FAIR 2027', start: '2027-05-26', end: '2027-05-28', timezone: 'Asia/Tokyo', url: '/events/jeca-fair-kansai-edition-2027/', source_url: 'https://www.jecafair.jp/outline/', source_note: 'Official JECA outline checked 20 Oct 2026: 26–28 May 2027 at INTEX Osaka. History cites the exhibitor list. This is the Osaka edition, not JECA FAIR 2026 in Tokyo.' },
  { slug: 'electrical-expo-2026', series: 'electrical-expo', name: 'Electrical Expo', year: 2026, past_name: 'Electrical Expo 2026', start: '2026-08-26', end: '2026-08-27', timezone: 'America/Chicago', url: '/events/electrical-expo-2026/', source_url: 'https://electricalboard.org/electrical-expo-2026/', source_note: 'Electrical Board of Missouri and Illinois exhibitor page checked 20 Oct 2026: 26–27 August 2026. History cites that exhibitor list.' },
  { slug: 'ecce-europe-2026', series: 'ecce-europe', name: 'ECCE Europe', year: 2026, past_name: 'ECCE Europe 2026', start: '2026-09-14', end: '2026-09-18', timezone: 'Europe/Madrid', url: '/events/ecce-europe-2026/', source_url: 'https://www.ecce-europe.org/2026/', source_note: 'ECCE Europe 2026 (EPE) ran 14–18 September 2026 in Valencia. This is not IEEE ECCE in Vancouver. History cites the exhibitor page.' },
  { slug: 'power-and-water-nigeria-exhibition-2026', series: 'power-and-water-nigeria-exhibition', name: 'Power & Water Nigeria', year: 2026, past_name: 'Power & Water Nigeria 2026', start: '2026-04-28', end: '2026-04-30', timezone: 'Africa/Lagos', url: '/events/power-and-water-nigeria-exhibition-2026/', source_url: 'https://pnwnigeria.com/', source_note: 'Power & Water Nigeria 2026 ran 28–30 April 2026 in Lagos. History cites the exhibitor directory.' },
  { slug: 'power-and-energy-kenya-2027', series: 'power-and-energy-kenya', name: 'Power & Energy Kenya', year: 2027, past_name: 'Power & Energy Kenya 2027', start: '2027-06-16', end: '2027-06-18', timezone: 'Africa/Nairobi', url: '/events/power-and-energy-kenya-2027/', source_url: 'https://www.expogr.com/kenyaenergy/venue_timings.php', source_note: 'Official venue page checked 20 Oct 2026: 16–18 June 2027 at Carnivore Exhibition Grounds, Nairobi. The public prime-exhibitor list is titled 2027. This is not the July 2026 edition.' },
  { slug: 'power-and-energy-tanzania-2026', series: 'power-and-energy-tanzania', name: 'Power & Energy Tanzania', year: 2026, past_name: 'Power & Energy Tanzania 2026', start: '2026-10-07', end: '2026-10-09', timezone: 'Africa/Dar_es_Salaam', url: '/events/power-and-energy-tanzania-2026/', source_url: 'https://www.expogr.com/tanzania/powerenergy/', source_note: 'Power & Energy Tanzania 2026 ran 7–9 October 2026 in Dar es Salaam. History cites the prime exhibitor list.' },
  { slug: 'electric-and-power-philippines-2026', series: 'electric-and-power-philippines', name: 'Electric & Power Philippines', year: 2026, past_name: 'Electric & Power Philippines 2026', start: '2026-04-22', end: '2026-04-24', timezone: 'Asia/Manila', url: '/events/electric-and-power-philippines-2026/', source_url: 'https://www.terrapinn.com/exhibition/power-electricity-world-philippines/', source_note: 'Electric & Power Philippines 2026 ran 22–24 April 2026 in Manila. History cites the 2026 sponsors and exhibitors page. The show is not titled Solar & Storage Live.' },
  { slug: 'power-and-electricity-world-africa-2026', series: 'power-and-electricity-world-africa', name: 'Power & Electricity World Africa', year: 2026, past_name: 'Power & Electricity World Africa 2026', start: '2026-03-25', end: '2026-03-27', timezone: 'Africa/Johannesburg', url: '/events/power-and-electricity-world-africa-2026/', source_url: 'https://www.terrapinn.com/exhibition/power-electricity-world-africa/index.stm', source_note: 'Power & Electricity World Africa 2026 ran 25–27 March 2026 in Johannesburg. History cites the sponsors and exhibitors page. The show is not titled Solar & Storage Live.' }
];

/* Official list did not make these the same legal entity as the linked profile. */
const SPLITS = {
  'TESLA TRANSFORMERS': {
    profile: 'TESLA TRANSFORMERS (Power Bangladesh)',
    directory: 'manufacturers',
    country: '—',
    avoid: ['tesla-transformers', 'tesla-transformers-global-private-limited'],
    note: 'The Power Bangladesh 2023 exhibitor list names TESLA TRANSFORMERS and does not say India or Global. manufacturers/tesla-transformers is Tesla Transformers of India. The Bangladesh row stays a separate unclaimed manufacturer. https://power-bangladesh.com/page/exhibitor-list'
  },
  'Eaton Corporation': {
    profile: 'Eaton Corporation',
    directory: 'accessories',
    country: 'USA',
    avoid: ['eaton'],
    note: 'The St. Louis exhibitor list gives Eaton Corporation its own booths (704–706), separate from Eaton Power Systems Division and the other Eaton lines. manufacturers/eaton is the group profile. The corporation booth stays a separate unclaimed accessory. https://electricalboard.org/electrical-expos-2026exhibitors/'
  },
  'OMICRON LAB': {
    profile: 'OMICRON LAB',
    directory: 'laboratories',
    country: '—',
    avoid: ['omicron-electronics-gmbh'],
    note: 'The ECCE Europe 2026 exhibitor page says OMICRON Lab is a division of OMICRON electronics GmbH and describes Bode analyzers for electronics. The directory accessory is the energy-testing profile. The Lab exhibitor stays a separate unclaimed laboratory. https://www.ecce-europe.org/2026/exhibitionsponsorship/exhibitors/'
  },
  'Mitsubishi Electric': {
    profile: 'Mitsubishi Electric Power Modules',
    directory: 'accessories',
    country: '—',
    slug: 'mitsubishi-electric-power-modules',
    avoid: ['mitsubishi-electric', 'mitsubishi-electric-power-products-meppi'],
    note: 'The ECCE Europe 2026 exhibitor page uses the generic name Mitsubishi Electric and describes power modules. That heading does not identify the Japan manufacturer profile or MEPPI, so the exhibitor stays a separate unclaimed accessory. https://www.ecce-europe.org/2026/exhibitionsponsorship/exhibitors/'
  },
  'WEG South Africa (Pty) Ltd': {
    profile: 'WEG South Africa (Pty) Ltd',
    directory: 'manufacturers',
    country: '—',
    avoid: ['weg'],
    note: 'The Power & Electricity World Africa 2026 sponsors page names WEG South Africa (Pty) Ltd. manufacturers/weg is the Brazil group profile. The South African company stays a separate unclaimed manufacturer. https://www.terrapinn.com/exhibition/solar-storage-live-africa/Sponsors-exhibitors.stm'
  }
};

const SLUG_OVERRIDES = {
  '(株)指月電機製作所': 'shizuki-electric',
  '寺崎電気産業(株)': 'terasaki-electric',
  'マルチ計測器(株)': 'multi-measuring-instruments',
  'Mitsubishi Electric': 'mitsubishi-electric-power-modules'
};

const CAREFUL = {
  'TPN-0322': {
    avoid: ['abb-india-limited', 'abb-china-co-ltd'],
    note: 'Heidelberg lists ABB with the global ABB description, and St. Louis lists ABB at booths 908 and 910, separate from ABB Installation Products. Neither list says ABB India. The row stays a new unclaimed manufacturer, not abb-india-limited and not abb-china-co-ltd. https://www.cigresymposium2027.de/all-exhibitors-sponsors/'
  },
  'TPN-0323': {
    avoid: ['dilo-armaturen-und-anlagen-gmbh'],
    note: 'Heidelberg lists Dilo with dilo.de and describes gas handling at Babenhausen. It does not print the legal name DILO Armaturen und Anlagen GmbH, which is already an ELECRAMA accessory. The Heidelberg row stays a separate unclaimed laboratory. https://www.cigresymposium2027.de/all-exhibitors-sponsors/'
  },
  'TPN-0335': {
    avoid: ['eaton'],
    note: 'St. Louis lists Eaton Power Systems Division at booth 708, separate from Eaton Corporation at booths 704–706. It stays its own unclaimed accessory and is not tagged to manufacturers/eaton. https://electricalboard.org/electrical-expos-2026exhibitors/'
  },
  'TPN-0336': {
    avoid: ['siemens', 'siemens-energy', 'siemens-ltd'],
    note: 'St. Louis lists Siemens Smart Infrastructure at its own booth. That is not the generic Siemens profile and not Siemens Energy. It stays a separate unclaimed accessory. https://electricalboard.org/electrical-expos-2026exhibitors/'
  },
  'TPN-0340': {
    avoid: ['hevi-duty-solahd'],
    note: 'St. Louis lists Emerson | SolaHD. The census manufacturer is Hevi-Duty / SolaHD. The exhibitor name is not that profile, so it stays a separate unclaimed accessory. https://electricalboard.org/electrical-expos-2026exhibitors/'
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
function writeEvents(data) {
  const text = JSON.stringify(data, null, 2).replace(/[\u007f-\uffff]/g, (ch) => {
    return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
  });
  fs.writeFileSync(path.join(ROOT, 'data/events.json'), text + '\n');
}

function bareAsciiSlug(s) {
  const mapped = String(s || '').trim().replace(/[Łł]/g, 'l').replace(/[Øø]/g, 'o').replace(/[Đđ]/g, 'd').replace(/ß/g, 'ss');
  return mapped.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function asciiSlug(s) {
  const raw = String(s || '').trim();
  if (raw && Object.prototype.hasOwnProperty.call(SLUG_OVERRIDES, raw)) return SLUG_OVERRIDES[raw];
  return bareAsciiSlug(raw);
}

function displayName(s) {
  return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
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
function statedCountry(value) {
  const s = displayName(value);
  if (!s || s === '—' || s === '-' || s === '–') return '';
  if (s.toLowerCase() === 'usa') return 'USA';
  return s;
}

const manufacturers = readJson('data/manufacturers.json');
const accessories = readJson('data/accessories.json');
const laboratories = readJson('data/laboratories.json');
const services = readJson('data/services.json');
const badges = readJson('data/event-badges.json');
const directoryFile = readJson('data/event-directory.json');
const extras = readJson('data/permanent-id-extras.json');
const decisions = readJson('data/event-batch-decisions.json');
const integrity = readJson('data/directory-integrity.json');
const companySlugs = readJson('data/company-slugs.json');
const listingSlugs = readJson('data/listing-slugs.json');
const events = readJson('data/events.json');

if (manufacturers.some((g) => (g.makers || []).some((m) => m[0] === 'ABB' && g.country === '—'))) {
  console.log('event batch 3 already imported');
  process.exit(0);
}

const masterRows = table(path.join(BATCH, 'tp-new-listings-master.csv'));
const master = {};
masterRows.forEach((row) => { master[String(row.new_listing_id || '').trim()] = row; });
if (masterRows.length !== 359) throw new Error('expected 359 master rows, got ' + masterRows.length);
if (master['TPN-0276']) throw new Error('TPN-0276 must stay out of the master');
for (let n = 314; n <= 360; n++) if (!master[padId(n)]) throw new Error('missing ' + padId(n));
for (let n = 1; n <= 313; n++) {
  if (n === 276) continue;
  if (!master[padId(n)]) throw new Error('earlier id missing ' + padId(n));
}
const tagRows = table(path.join(BATCH, 'tp-existing-profiles-event-tags.csv'));
if (tagRows.length !== 94) throw new Error('expected 94 existing-profile tag rows, got ' + tagRows.length);

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

const used = new Set(Object.keys(readJson('data/permanent-ids.json').companies || {}));
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
  const key = matchKey(name);
  if (!key || byNorm.has(key)) return;
  byNorm.set(key, rec);
}
companySlugs.forEach((row) => remember(row.name, { slug: row.slug, directory: 'manufacturers', name: row.name }));
(accessories.suppliers || []).forEach((s) => remember(s.name, { slug: s.slug || asciiSlug(s.name), directory: 'accessories', name: s.name }));
(laboratories.laboratories || []).forEach((lab) => remember(lab.name, { slug: String(lab.id || '').replace(/^lab:/, ''), directory: 'laboratories', name: lab.name }));
(services.services || []).forEach((s) => remember(s.company_name, { slug: String(s.id || '').replace(/^srv:/, ''), directory: 'services', name: s.company_name }));

const added = [];
const verifyOutcomes = [];

function addEntity(spec) {
  const name = displayName(spec.name);
  const directory = spec.directory;
  const hit = byNorm.get(matchKey(name));
  if (hit && hit.directory === directory) throw new Error('new listing ' + name + ' matches existing ' + hit.directory + '/' + hit.slug);
  const country = spec.country || '';
  const city = spec.city == null ? '—' : spec.city;
  const site = httpUrl(spec.website);
  const products = cleanProducts(spec.products);
  const slug = claimSlug(spec.slug || asciiSlug(name), name);
  const evidence = spec.evidence;
  if (/do_not_contact/i.test(evidence)) throw new Error('evidence leaked outreach for ' + name);
  const rec = { slug: slug, directory: directory, name: name, country: country, website: site, action: 'added' };
  if (directory === 'manufacturers') {
    const groupCountry = country || '—';
    countryGroup(groupCountry).makers.push([name, city || '—', site, '']);
    rec.country = groupCountry;
  } else if (directory === 'accessories') {
    accessories.suppliers.push({
      name: name,
      slug: slug,
      country: country,
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
      description: products || 'Unclaimed directory listing. No accreditation is claimed.',
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
      city: city === '—' ? '' : city,
      website: site,
      service_types: [],
      description: products || 'Unclaimed directory listing. Service types are not stated.',
      verification_status: 'Unclaimed',
      verification_date: '—',
      profile_page: true
    });
    rec.city = city === '—' ? '' : city;
    extras.push({ slug: slug, name: name, country: country, directory: directory });
  } else throw new Error('unknown directory ' + directory);
  remember(name, rec);
  added.push(Object.assign({ id: spec.id || '', website: site }, rec));
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
function labelUnknown(rec) {
  const country = rec.directory === 'manufacturers' ? (rec.country || '—') : (rec.country || '');
  const unresolved = !country || country === '—' || country === '-' || country === '–';
  if (unresolved) flag(rec.directory, rec.name, country, 'country');
  if (!rec.website) flag(rec.directory, rec.name, country, 'website');
  if (rec.directory === 'manufacturers') flag(rec.directory, rec.name, country, 'types');
  if (rec.directory === 'services' && !rec.city) flag(rec.directory, rec.name, country, 'city');
}

function canonicalName(directory, slug, fallback) {
  if (directory === 'manufacturers') {
    const row = companySlugs.find((r) => r.slug === slug);
    if (row) return row.name;
  } else if (directory === 'accessories') {
    const row = (accessories.suppliers || []).find((s) => (s.slug || asciiSlug(s.name)) === slug);
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

function recordDecision(company, decision, slug, directory, note) {
  decisions.push({ company: company, decision: decision, slug: slug, directory: directory, note: note });
}

const createdById = {};
const createdSplits = {};
const sections = directoryFile.sections;

PAGES.forEach((page) => {
  if (sections[page.id] && (sections[page.id].entries || []).length) {
    throw new Error('directory section already filled ' + page.id);
  }
  const rows = table(path.join(BATCH, page.file));
  if (rows.length !== page.rows) throw new Error(page.file + ' expected ' + page.rows + ' rows, got ' + rows.length);
  const next = [];
  rows.forEach((row) => {
    const section = displayName(row.section);
    if (section !== page.section) throw new Error(page.file + ' section ' + JSON.stringify(section));
    const company = displayName(row.company);
    const link = String(row.link_or_id || '').trim();
    const noted = displayName(row.note || '').replace(/do_not_contact/ig, 'outreach column');
    if (/^TPN-\d+$/.test(link)) {
      const id = link;
      const num = parseInt(id.slice(4), 10);
      if (num < 314 || num > 360) throw new Error('unexpected id on a batch 3 page ' + id);
      if (createdById[id]) {
        const rec = createdById[id];
        next.push({ name: company, slug: rec.slug, directory: rec.directory, href: hrefFor(rec.directory, rec.slug) });
        ensureBadge(rec.slug, rec.name, company, page.id);
        if (/VERIFY/i.test(noted)) verifyOutcomes.push({ company: company, event: page.id, outcome: 'same listing ' + id + ' / ' + rec.slug });
        return;
      }
      const masterRow = master[id];
      if (!masterRow) throw new Error('missing master ' + id);
      if (matchKey(masterRow.company) !== matchKey(company)) throw new Error('page name differs from master for ' + id);
      const country = statedCountry(masterRow.country);
      const directory = directoryOf(displayName(masterRow.category));
      const careful = CAREFUL[id];
      if (careful) careful.avoid.forEach((slug) => { if (!used.has(slug)) throw new Error('avoid slug missing ' + slug); });
      const rec = addEntity({
        id: id,
        name: displayName(masterRow.company),
        directory: directory,
        country: directory === 'manufacturers' ? (country || '—') : country,
        city: '—',
        website: masterRow.website,
        products: masterRow.products,
        evidence: 'Unclaimed listing from the event batch. ' + displayName(masterRow.event_history || '')
      });
      labelUnknown(rec);
      if (careful) recordDecision(company, 'separate', rec.slug, rec.directory, careful.note);
      else if (/VERIFY/i.test(noted)) {
        recordDecision(company, 'separate', rec.slug, rec.directory, 'Checked against the official exhibitor list. No directory profile is the same legal entity, so ' + id + ' stays its own unclaimed listing. ' + HISTORY_SOURCE[page.id]);
      }
      if (/VERIFY/i.test(noted)) verifyOutcomes.push({ company: company, id: id, event: page.id, outcome: 'separate listing ' + rec.slug });
      createdById[id] = rec;
      next.push({ name: company, slug: rec.slug, directory: rec.directory, href: hrefFor(rec.directory, rec.slug) });
      ensureBadge(rec.slug, rec.name, company, page.id);
      return;
    }
    const split = SPLITS[company];
    if (split) {
      split.avoid.forEach((slug) => { if (!used.has(slug)) throw new Error('avoid slug missing ' + slug + ' for ' + company); });
      let rec = createdSplits[company];
      if (!rec) {
        rec = addEntity({
          name: split.profile,
          directory: split.directory,
          country: split.directory === 'manufacturers' ? (split.country || '—') : (split.country === '—' ? '' : split.country),
          city: '—',
          website: '',
          slug: split.slug,
          evidence: 'Unclaimed listing from the event batch. ' + company + ' at ' + page.id + '.'
        });
        labelUnknown(rec);
        recordDecision(company, 'separate', rec.slug, rec.directory, split.note);
        createdSplits[company] = rec;
      }
      if (/VERIFY/i.test(noted)) verifyOutcomes.push({ company: company, event: page.id, outcome: 'separate listing ' + rec.slug });
      next.push({ name: company, slug: rec.slug, directory: rec.directory, href: hrefFor(rec.directory, rec.slug) });
      ensureBadge(rec.slug, rec.name, company, page.id);
      return;
    }
    const m = link.match(/transformerpath\.com\/(manufacturers|accessories|laboratories|services)\/([^/?#]+)\/?/);
    if (!m) throw new Error('unparsed row ' + company + ' ' + link);
    const directory = m[1];
    const slug = m[2];
    const profilePage = path.join(ROOT, directory, slug, 'index.html');
    if (!used.has(slug) && !fs.existsSync(profilePage)) throw new Error('tag slug missing ' + slug + ' for ' + company);
    const profile = canonicalName(directory, slug, company);
    const note = noted
      ? ('The official exhibitor list supports tagging ' + profile + '. ' + noted + ' ' + HISTORY_SOURCE[page.id])
      : ('The exhibitor name matches the linked profile. ' + link);
    recordDecision(company, 'tag', slug, directory, note);
    if (/VERIFY/i.test(noted)) verifyOutcomes.push({ company: company, event: page.id, outcome: 'tagged ' + directory + '/' + slug });
    next.push({ name: company, slug: slug, directory: directory, href: hrefFor(directory, slug) });
    ensureBadge(slug, profile, company, page.id);
  });
  sections[page.id] = { section: page.section, entries: next };
});

const newIds = Object.keys(createdById);
if (newIds.length !== 47) throw new Error('expected 47 master listings, got ' + newIds.length);
if (Object.keys(createdSplits).length !== 5) throw new Error('expected 5 separate group matches, got ' + Object.keys(createdSplits).length);
if (verifyOutcomes.length !== 44) throw new Error('expected 44 VERIFY outcomes, got ' + verifyOutcomes.length + ' ' + JSON.stringify(verifyOutcomes.map((r) => r.company)));

laboratories.total_laboratories = laboratories.laboratories.length;

BADGE_EVENTS.forEach((event) => {
  if ((badges.events || []).some((row) => row.slug === event.slug)) return;
  badges.events.push(event);
});
if (badges.how_to_add.indexOf('Electric & Power Philippines 2026') < 0) {
  badges.how_to_add += ' Batch 3 adds Power Bangladesh 2023, CIGRE Symposium Heidelberg 2027, VDE Hochspannungstechnik 2026, JECA FAIR 2027, Electrical Expo 2026, ECCE Europe 2026, Power & Water Nigeria 2026, Power & Energy Kenya 2027, Power & Energy Tanzania 2026, Electric & Power Philippines 2026, and Power & Electricity World Africa 2026.';
}

Object.keys(SLUG_OVERRIDES).forEach((name) => {
  if (bareAsciiSlug(name)) return;
  if (listingSlugs[name] && listingSlugs[name] !== SLUG_OVERRIDES[name]) {
    throw new Error('listing slug override clash ' + name);
  }
  listingSlugs[name] = SLUG_OVERRIDES[name];
});

const reused = new Set(PAGES.map((page) => page.id));
events.forEach((ev) => {
  if (!reused.has(ev.id)) return;
  if (!ev.date_status) ev.date_status = 'CONFIRMED';
  if (!ev.source_url) ev.source_url = ev.official_url;
  if (!ev.source_checked_at) ev.source_checked_at = CHECKED;
  if (ev.id === 'vde-hochspannungstechnik-2026') {
    ev.venue = 'Mercure Hotel MOA Berlin';
    if (ev.v) ev.v = 'Mercure Hotel MOA Berlin';
    ev.source_url = 'https://www.vde.com/de/veranstaltungen/info?id=23803&type=vde%7Cvdb';
    ev.source_checked_at = CHECKED;
    ev.relevance_reason = 'The VDE event page states 10–12 November 2026 at Mercure Hotel MOA Berlin.';
  }
});

function edition(row) {
  return {
    edition_label: null,
    organiser: row.organiser,
    languagepath_visit_url: null,
    research_status: null,
    stats: { exhibitors: null, visitors: null, area_sqm: null, countries: null, speakers: null },
    key_exhibitors: null,
    programme: null,
    deadlines: null,
    registration: null,
    markets: null,
    intel_links: null,
    id: row.id,
    series_slug: row.series,
    name: row.name,
    type: 'exhibition',
    start: row.start,
    end: row.end,
    date_status: 'CONFIRMED',
    venue: row.venue,
    city: row.city,
    country: row.country,
    region: row.region,
    official_url: row.official_url,
    source_url: row.source_url,
    source_checked_at: CHECKED,
    relevance_tier: 'HIGH',
    relevance_reason: row.reason,
    description: row.description,
    lifecycle_status: row.lifecycle,
    n: row.name,
    s: row.start,
    e: row.end,
    c: row.city,
    co: row.country,
    r: row.region,
    v: row.venue,
    u: row.official_url,
    d: row.description
  };
}
if (!events.some((ev) => ev.id === 'power-bangladesh-2023')) {
  events.push(edition({
    id: 'power-bangladesh-2023',
    series: 'power-bangladesh',
    name: 'Power Bangladesh 2023',
    start: '2023-12-07',
    end: '2023-12-09',
    venue: 'International Convention City Bashundhara (ICCB)',
    city: 'Dhaka',
    country: 'Bangladesh',
    region: 'Asia',
    organiser: 'CEMS-Global',
    official_url: 'https://power-bangladesh.com/',
    source_url: 'https://power-bangladesh.com/page/exhibitor-list',
    reason: 'Registration and organiser pages state 7–9 December 2023 at ICCB, Dhaka. The exhibitor list on power-bangladesh.com still names this edition’s companies.',
    description: '25th Power Bangladesh International Expo, 7–9 December 2023 at International Convention City Bashundhara, Dhaka. This is the 2023 edition, not Power Bangladesh 2026.',
    lifecycle: 'COMPLETED'
  }));
}
if (!events.some((ev) => ev.id === 'power-and-energy-kenya-2027')) {
  events.push(edition({
    id: 'power-and-energy-kenya-2027',
    series: 'power-and-energy-kenya',
    name: 'Power & Energy Kenya 2027',
    start: '2027-06-16',
    end: '2027-06-18',
    venue: 'Carnivore Exhibition Grounds',
    city: 'Nairobi',
    country: 'Kenya',
    region: 'Africa',
    organiser: 'Expogr',
    official_url: 'https://expogr.com/kenyaenergy/',
    source_url: 'https://www.expogr.com/kenyaenergy/venue_timings.php',
    reason: 'The official venue page states 16–18 June 2027 at Carnivore Exhibition Grounds, Nairobi. The public exhibitor list is titled Power & Energy Kenya 2027.',
    description: '14th Power & Energy Kenya, 16–18 June 2027 at Carnivore Exhibition Grounds, Nairobi. The July 2026 edition is a different event.',
    lifecycle: 'CONFIRMED_UPCOMING'
  }));
}

const shipped = JSON.stringify(sections) + JSON.stringify(added) + JSON.stringify(extras) + JSON.stringify(badges) + JSON.stringify(decisions);
if (/do_not_contact/i.test(shipped)) throw new Error('do_not_contact leaked');
if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(added))) throw new Error('email leaked into new listings');

const tomb = readJson('data/permanent-ids.json').companies['schweitzer-engineering-laboratories-pvt-ltd'];
if (!tomb || tomb.id !== 'TPM-001072' || tomb.retired !== true) throw new Error('TPM-001072 must stay reserved');

writeJson('data/manufacturers.json', manufacturers);
writeJson('data/accessories.json', accessories);
writeJson('data/laboratories.json', laboratories);
writeJson('data/services.json', services);
writeJson('data/event-badges.json', badges);
writeJson('data/event-directory.json', directoryFile);
writeJson('data/permanent-id-extras.json', extras);
writeJson('data/event-batch-decisions.json', decisions);
writeJson('data/directory-integrity.json', integrity);
writeJson('data/listing-slugs.json', listingSlugs);
writeEvents(events);

const byDirectory = added.reduce((acc, row) => { acc[row.directory] = (acc[row.directory] || 0) + 1; return acc; }, {});
const report = {
  master_rows: masterRows.length,
  existing_profile_tag_rows: tagRows.length,
  master_listings_added: newIds.length,
  separate_group_listings: Object.keys(createdSplits).length,
  listings_added: added.length,
  added_by_directory: byDirectory,
  added: added.map((row) => ({ id: row.id, name: row.name, slug: row.slug, directory: row.directory })),
  verify: verifyOutcomes,
  event_rows: PAGES.map((page) => ({ event: page.id, section: sections[page.id].section, rows: sections[page.id].entries.length })),
  retired_tpn_0276: { slug: 'schweitzer-engineering-laboratories-pvt-ltd', permanent_id: 'TPM-001072', removed: 'listing and claim page' }
};
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/event-batch-3-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  listings_added: report.listings_added,
  added_by_directory: byDirectory,
  verify: verifyOutcomes.length,
  events: report.event_rows
}, null, 2));
