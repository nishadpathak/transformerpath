#!/usr/bin/env node
/* Batch 4: TPN-0361–TPN-0372, five LinkedIn makers as TPN-0472–TPN-0476,
 * and 11 events. CWIEME Mexico is not published. Outreach columns are not written.
 * TPN-0373–TPN-0471 belong to the batch 5 social file, so the LinkedIn makers
 * keep the next IDs after that range. Those IDs were never stored on the entities.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BATCH = process.argv[2] || '/cursor/stores/bot/event-batch-4';
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
function writeEvents(data) {
  const text = JSON.stringify(data, null, 2).replace(/[\u007f-\uffff]/g, (ch) => {
    return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
  });
  fs.writeFileSync(path.join(ROOT, 'data/events.json'), text + '\n');
}
function displayName(s) {
  return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function asciiSlug(s) {
  const mapped = String(s || '').trim().replace(/[Łł]/g, 'l').replace(/[Øø]/g, 'o').replace(/[Đđ]/g, 'd').replace(/ß/g, 'ss');
  return mapped.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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
const EVENT_HOSTS = new Set([
  'cigre-exhibition.com', 'www.cigre-exhibition.com',
  'hannovermesse.de', 'www.hannovermesse.de',
  'exhibitors.dcwpower.com', 'dcwpower.com', 'www.dcwpower.com'
]);
function companySite(value) {
  const url = httpUrl(value);
  if (!url) return '';
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { return ''; }
  if (EVENT_HOSTS.has(host)) return '';
  return url;
}
function padId(n) { return 'TPN-' + String(n).padStart(4, '0'); }

const socialNew = table(path.join(BATCH, 'social-tp-new.csv'));
const socialExisting = table(path.join(BATCH, 'social-tp-existing.csv'));
const makersFile = table(path.join(BATCH, 'linkedin-makers-tp-new.csv'));
const eventFile = table(path.join(BATCH, 'tp-new-events.csv'));
if (socialNew.length !== 12) throw new Error('expected 12 social listings, got ' + socialNew.length);
if (socialExisting.length !== 12) throw new Error('expected 12 tag rows, got ' + socialExisting.length);
if (makersFile.length !== 12) throw new Error('expected 12 LinkedIn rows, got ' + makersFile.length);
if (eventFile.length !== 11 && eventFile.length !== 12) throw new Error('expected 11 or 12 event rows, got ' + eventFile.length);
if (socialNew[0].new_listing_id !== 'TPN-0361' || socialNew[11].new_listing_id !== 'TPN-0372') {
  throw new Error('social ids must run TPN-0361 to TPN-0372');
}

const IMPORT_MAKERS = [
  'PVJ Power Solutions Pvt. Ltd.',
  'Transformer Engineering',
  'Houston Transformer Company',
  'SUNRISE TRANSFORMER MANUFACTURER PRIVATE LIMITED',
  'Veer Electronics Pvt. Ltd.'
];
const held = makersFile.filter((row) => IMPORT_MAKERS.indexOf(displayName(row.company)) < 0);
if (held.length !== 7) throw new Error('expected 7 held LinkedIn rows, got ' + held.length);
held.forEach((row) => {
  if (String(row.verified).trim().toLowerCase() === 'yes') throw new Error('held row is marked verified: ' + row.company);
});

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
const events = readJson('data/events.json');

if (events.some((ev) => ev.id === 'darcy-robotics-in-td-2026')) {
  console.log('event batch 4 already imported');
  process.exit(0);
}
if (events.some((ev) => ev.id === 'cwieme-mexico')) throw new Error('CWIEME Mexico must stay unpublished');
if (events.some((ev) => ev.id === 'elecrama-asia-2026' || ev.series_slug === 'elecrama-asia')) {
  throw new Error('ELECRAMA Asia 2026 must stay unpublished');
}

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
function addEntity(spec) {
  const name = displayName(spec.name);
  const directory = spec.directory;
  const country = spec.country || '';
  const city = spec.city == null || spec.city === '' ? '—' : spec.city;
  const site = companySite(spec.website);
  const products = displayName(spec.products || '');
  const slug = claimSlug(spec.slug || asciiSlug(name), name);
  const evidence = spec.evidence;
  if (/do_not_contact|transformers magazine|linkedin\.com/i.test(evidence)) throw new Error('evidence leaked a blocked source for ' + name);
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
  added.push(Object.assign({ id: spec.id || '' }, rec));
  return rec;
}
function profileName(directory, slug, fallback) {
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
  return fallback;
}
function ensureBadge(slug, name, alias, eventId, source) {
  if (!/^https?:\/\//.test(source)) throw new Error('history source must be an http(s) URL for ' + slug);
  if (/transformers\s*magazine/i.test(source)) throw new Error('magazine source blocked');
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
    row.history.push({ event: eventId, year: YEAR[eventId], source: source });
  }
}
function recordDecision(company, decision, slug, directory, note) {
  if (/do_not_contact|transformers magazine|linkedin\.com/i.test(note)) throw new Error('decision leaked a blocked source for ' + company);
  decisions.push({ company: company, decision: decision, slug: slug, directory: directory, note: note });
}

const added = [];
const verifyOutcomes = [];
const createdById = {};

const SOCIAL_NOTES = {
  'TPN-0361': 'Company site espi.co.in describes Elec Steel Processing Industries Ltd (ESPIL), CRGO steel and cores. The listing name stays ESPI Limited.',
  'TPN-0362': 'Company site describes radiators and coolers and also transformer manufacturing. The row stays a components listing, which is the category on the import file.',
  'TPN-0363': 'Company site describes electromagnetic simulation software. Listed as a service.',
  'TPN-0364': 'The CIGRE Paris Session 2026 booth list prints Jinan Meide Casting Co., Ltd. at B22. No other Meide profile is in the directory. The listing stays Meide Group.',
  'TPN-0365': '3M is a plain components listing for CIGRE Paris Session 2026 booth C165. The listing does not describe a product line and does not call 3M an insulation maker.',
  'TPN-0366': 'The social name GW Electric is kept. It is not linked to another profile. The booth list places this exhibitor at B54.',
  'TPN-0367': 'The social name SWI Systems is kept for the CIGRE Paris booth A157. It is not linked to another profile.',
  'TPN-0368': 'CIGRE Paris Session 2026 booth list places L&R Electric Group at C95. No company website was on the import row.',
  'TPN-0369': 'Hannover Messe exhibitor page describes dry-type transformers and reactors at Hall 12 / C59. That page is not stored as the company website.',
  'TPN-0370': 'The social name Huatech (Xiamen) is kept. The Hannover exhibitor page names Xiamen Huadian Switchgear at Hall 12 / C50. That page is not stored as the company website.',
  'TPN-0371': 'Data Center World POWER 2026 exhibitor list places Texas Transformers and Equipment at booth 140. The exhibitor-list host is not stored as the company website.',
  'TPN-0372': 'Company site describes hydrogen sensors used for transformer monitoring. SMRP booth 1131.'
};
const SOCIAL_PRODUCTS = {
  'TPN-0361': 'Unclaimed listing. CRGO electrical steel and transformer cores.',
  'TPN-0362': 'Unclaimed listing. Radiators and coolers.',
  'TPN-0363': 'Unclaimed listing. Electromagnetic simulation software.',
  'TPN-0364': 'Unclaimed directory listing.',
  'TPN-0365': 'Unclaimed directory listing.',
  'TPN-0366': 'Unclaimed listing. Switchgear and cable accessories.',
  'TPN-0367': 'Unclaimed listing. No accreditation is claimed.',
  'TPN-0369': 'Unclaimed listing. Dry-type transformers and reactors.',
  'TPN-0370': 'Unclaimed listing. Switchgear.',
  'TPN-0372': 'Unclaimed listing. Hydrogen sensors for transformer monitoring. No accreditation is claimed.'
};

const EVENT_BY_LABEL = {
  'CWIEME Berlin 2026': 'cwieme-berlin-2026',
  'Coiltech North America 2026': 'coiltech-2026',
  'Coiltech Italia 2026': 'coiltech-italia-2026',
  'CIGRE Paris Session 2026': 'cigre-paris-2026',
  'Hannover Messe 2026': 'hannover-messe-2026',
  'Data Center World POWER 2026': 'data-center-world-power-2026',
  'SMRP Annual Conference 2026': 'smrp-annual-conference-2026',
  'Middle East Energy 2026': 'middle-east-energy-2026',
  'Electra Mining Africa 2026': 'electra-mining-africa-2026',
  'WETEX 2026': 'wetex-2026'
};
const YEAR = {
  'cwieme-berlin-2026': 2026,
  'coiltech-2026': 2026,
  'coiltech-italia-2026': 2026,
  'cigre-paris-2026': 2026,
  'hannover-messe-2026': 2026,
  'data-center-world-power-2026': 2026,
  'smrp-annual-conference-2026': 2026,
  'middle-east-energy-2026': 2026,
  'electra-mining-africa-2026': 2026,
  'wetex-2026': 2026
};
const SECTION = {
  'cwieme-berlin-2026': 'Previous exhibitors (2026)',
  'coiltech-2026': 'Previous exhibitors (2026)',
  'coiltech-italia-2026': 'Previous exhibitors (2026)',
  'cigre-paris-2026': 'Previous exhibitors (2026)',
  'hannover-messe-2026': 'Previous exhibitors (2026)',
  'data-center-world-power-2026': 'Previous exhibitors (2026)',
  'smrp-annual-conference-2026': 'Previous exhibitors (2026)',
  'middle-east-energy-2026': 'Previous exhibitors (2026)',
  'electra-mining-africa-2026': 'Previous exhibitors (2026)',
  'wetex-2026': 'Exhibiting at WETEX 2026'
};
const EXISTING_TAGS = {
  'Hitachi Energy': { directory: 'manufacturers', slug: 'hitachi-energy' },
  'H-J Family of Companies': { directory: 'accessories', slug: 'h-j-enterprises-the-h-j-family-of-companies' },
  'Bushing (Beijing) HV Electric': { directory: 'accessories', slug: 'bushing-beijing-hv-electric-co-ltd' },
  'Dingxin Electric': { directory: 'manufacturers', slug: 'jiangsu-dingxin-electric' },
  'YAWEI Transformer': { directory: 'manufacturers', slug: 'jiangsu-yawei-transformer' },
  'APAR Industries': { directory: 'accessories', slug: 'apar-industries-ltd-poweroil' },
  'alfanar': { directory: 'manufacturers', slug: 'alfanar' },
  'Vaisala': { directory: 'accessories', slug: 'vaisala-oyj' },
  'ACTOM': { directory: 'manufacturers', slug: 'actom-power-and-distribution-transformers' }
};

function boothOf(value) {
  const s = displayName(value);
  if (!s || s === '—' || s === '-' || s === '–') return '';
  return s;
}
function pushEntry(eventId, entry) {
  const block = sections[eventId] || (sections[eventId] = { section: SECTION[eventId], entries: [] });
  if (block.section !== SECTION[eventId]) throw new Error('section clash ' + eventId);
  block.entries.push(entry);
}
const sections = directoryFile.sections;
Object.keys(SECTION).forEach((id) => {
  if (sections[id] && (sections[id].entries || []).length) throw new Error('directory section already filled ' + id);
});

socialNew.forEach((row) => {
  const id = displayName(row.new_listing_id);
  const name = displayName(row.company);
  const eventId = EVENT_BY_LABEL[displayName(row.event)];
  if (!eventId) throw new Error('unknown event label ' + row.event);
  const directory = directoryOf(displayName(row.category));
  const source = httpUrl(row.official_url);
  const rec = addEntity({
    id: id,
    name: name,
    directory: directory,
    country: '',
    city: '—',
    website: row.website,
    products: SOCIAL_PRODUCTS[id] || '',
    evidence: 'Unclaimed listing from the event batch. ' + displayName(row.event) + (boothOf(row.booth) ? ', booth ' + boothOf(row.booth) : '') + '.'
  });
  labelUnknown(rec);
  const verify = /VERIFY/i.test(row.match_note || '');
  recordDecision(name, 'separate', rec.slug, rec.directory, SOCIAL_NOTES[id] + ' ' + source);
  if (verify) verifyOutcomes.push({ company: name, id: id, event: eventId, outcome: SOCIAL_NOTES[id] });
  createdById[id] = rec;
  const entry = { name: name, slug: rec.slug, directory: rec.directory, href: hrefFor(rec.directory, rec.slug) };
  const booth = boothOf(row.booth);
  if (booth) entry.booth = booth;
  pushEntry(eventId, entry);
  ensureBadge(rec.slug, rec.name, name, eventId, source);
});

socialExisting.forEach((row) => {
  const name = displayName(row.company);
  const eventId = EVENT_BY_LABEL[displayName(row.event)];
  if (!eventId) throw new Error('unknown tag event ' + row.event);
  const source = httpUrl(row.official_url);
  if (/transformers\s*magazine/i.test(source) || /transformers\s*magazine/i.test(row.match_note || '')) {
    if (/transformers\s*magazine/i.test(source)) throw new Error('magazine URL on ' + name);
  }
  const ref = displayName(row.existing_ref);
  let rec;
  if (createdById[ref]) {
    rec = createdById[ref];
  } else {
    const tag = EXISTING_TAGS[name];
    if (!tag) throw new Error('no existing profile for ' + name);
    const m = ref.match(/transformerpath\.com\/(manufacturers|accessories|laboratories|services)\/([^/?#]+)\/?/);
    if (m) {
      if (m[1] !== tag.directory || m[2] !== tag.slug) throw new Error('tag ref does not match ' + name + ' ' + ref);
    } else if (ref !== 'TPN-0013') {
      throw new Error('tag ref does not match ' + name + ' ' + ref);
    }
    if (!used.has(tag.slug)) throw new Error('tag slug missing ' + tag.slug);
    rec = { slug: tag.slug, directory: tag.directory, name: profileName(tag.directory, tag.slug, name) };
    recordDecision(name, 'tag', rec.slug, rec.directory, 'Official list supports tagging ' + rec.name + ' at ' + eventId + '.' + (boothOf(row.booth) ? ' Booth ' + boothOf(row.booth) + '.' : ' Booth not stated.') + ' ' + source);
  }
  const entry = { name: name, slug: rec.slug, directory: rec.directory, href: hrefFor(rec.directory, rec.slug) };
  const booth = boothOf(row.booth);
  if (booth) entry.booth = booth;
  pushEntry(eventId, entry);
  ensureBadge(rec.slug, rec.name, name, eventId, source);
});

const MAKER_SPECS = {
  'PVJ Power Solutions Pvt. Ltd.': {
    id: 'TPN-0472',
    directory: 'manufacturers',
    country: '',
    city: '—',
    website: '',
    products: '',
    note: 'VERIFY product range. www.pvjpower.com answered with a domain-for-sale redirect on 20 Oct 2026, so no product range was confirmed and that URL is not stored as a website. The company stays a separate unclaimed manufacturer.'
  },
  'Transformer Engineering': {
    id: 'TPN-0473',
    directory: 'manufacturers',
    country: 'USA',
    city: 'Cleveland',
    website: '',
    products: '',
    note: 'transformerengineering.com answered with a domain-for-sale redirect on 20 Oct 2026, so that URL is not stored as a website. The Cleveland, Ohio company stays a separate unclaimed manufacturer. It is not Electronic & Transformer Engineering (ETE).'
  },
  'Houston Transformer Company': {
    id: 'TPN-0474',
    directory: 'manufacturers',
    country: 'USA',
    city: 'Houston',
    website: 'https://houstontransformer.com',
    products: '',
    note: 'houstontransformer.com describes custom transformers, inductors, chokes and magnetic devices in Houston. Separate unclaimed manufacturer.'
  },
  'SUNRISE TRANSFORMER MANUFACTURER PRIVATE LIMITED': {
    id: 'TPN-0475',
    directory: 'manufacturers',
    country: 'India',
    city: '—',
    website: 'https://sunrisetransformer.com',
    products: '',
    note: 'sunrisetransformer.com resolves, and the page title uses the Sunrise Transformer name. The public page does not describe a product range. Separate unclaimed manufacturer in India.'
  },
  'Veer Electronics Pvt. Ltd.': {
    id: 'TPN-0476',
    directory: 'accessories',
    country: 'India',
    city: 'Gandhinagar',
    website: 'https://www.veerelectronics.com',
    products: 'Unclaimed listing. The company site describes testing and measuring instruments for electrical equipment, including transformer turns-ratio meters, Epstein testers and oil breakdown testers.',
    note: 'VERIFY. veerelectronics.com describes testing and measuring instruments, including transformer turns-ratio meters, Epstein testers and oil breakdown testers. That is not a power-transformer maker and not a small electronic-transformer maker. The company stays a separate unclaimed accessory in Gandhinagar, India.'
  }
};
IMPORT_MAKERS.forEach((name) => {
  const fileRow = makersFile.find((row) => displayName(row.company) === name);
  if (!fileRow || String(fileRow.verified).trim().toLowerCase() !== 'yes') throw new Error('maker row not verified ' + name);
  const spec = MAKER_SPECS[name];
  const rec = addEntity({
    id: spec.id,
    name: name,
    directory: spec.directory,
    country: spec.country,
    city: spec.city,
    website: spec.website,
    products: spec.products,
    evidence: 'Unclaimed listing. ' + spec.note
  });
  labelUnknown(rec);
  recordDecision(name, 'separate', rec.slug, rec.directory, spec.note);
  if (/VERIFY/i.test(fileRow.note || '') || /VERIFY/i.test(spec.note)) {
    verifyOutcomes.push({ company: name, id: spec.id, event: '', outcome: spec.note });
  }
  createdById[spec.id] = rec;
});

held.forEach((row) => {
  verifyOutcomes.push({
    company: displayName(row.company),
    id: '',
    event: '',
    outcome: 'Held. Not imported. ' + displayName(row.note || 'Site was not confirmed.')
  });
});
verifyOutcomes.push({
  company: 'Garware Hi-Tech Films',
  id: '',
  event: 'cwieme-berlin-2026',
  outcome: 'Not imported. The outreach column stays unpublished.'
});
verifyOutcomes.push({
  company: 'ENC Insulation',
  id: '',
  event: 'cwieme-berlin-2026',
  outcome: 'Not imported. The outreach column stays unpublished.'
});
verifyOutcomes.push({
  company: 'ELIN Insulation',
  id: '',
  event: '',
  outcome: 'Not imported. The existing Elin Insulation FZ LLC accessory is unchanged. No link was added between Elin companies.'
});
verifyOutcomes.push({
  company: 'Reliability Africa Expo 2026',
  id: '',
  event: 'reliability-africa-expo-2026',
  outcome: 'Dates stay unconfirmed. The official homepage checked 20 Oct 2026 is Lagos, Nigeria, and advertises 25-27 May 2027. It does not print 2-4 June 2026.'
});
verifyOutcomes.push({
  company: 'iP Utility Safety Conference & Expo 2026',
  id: '',
  event: 'ip-utility-safety-conference-expo-2026',
  outcome: 'Dates stay unconfirmed. The 5-7 May 2026 range was not confirmed on the official site.'
});

const threeM = (accessories.suppliers || []).find((s) => s.name === '3M');
if (!threeM || /insulation/i.test(threeM.description)) throw new Error('3M listing must stay neutral');
const elinCount = (accessories.suppliers || []).filter((s) => /elin insulation/i.test(s.name)).length;
if (elinCount !== 1) throw new Error('Elin Insulation count changed: ' + elinCount);

function edition(row) {
  return {
    edition_label: null,
    organiser: row.organiser || null,
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
    type: row.type,
    start: row.start,
    end: row.end,
    date_status: row.date_status,
    venue: row.venue,
    city: row.city,
    country: row.country,
    region: row.region,
    official_url: row.official_url,
    source_url: row.source_url,
    source_checked_at: row.source_checked_at,
    relevance_tier: row.relevance_tier,
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

const NEW_EVENTS = [
  {
    id: 'reliability-africa-expo-2026', series: 'reliability-africa-expo', name: 'Reliability Africa Expo 2026', type: 'exhibition',
    start: '2026-06-02', end: '2026-06-04', date_status: 'PROJECTED',
    venue: 'Lagos Oriental Hotel', city: 'Lagos', country: 'Nigeria', region: 'Africa',
    official_url: 'https://reliabilityafrica.com/',
    source_url: 'https://reliabilityafrica.com/', source_checked_at: CHECKED,
    relevance_tier: 'HIGH', lifecycle: 'MONITORING',
    reason: 'Official homepage checked 20 Oct 2026 names Lagos, Nigeria, and advertises 25-27 May 2027. It does not print 2-4 June 2026, so those dates stay unconfirmed.',
    description: 'Reliability Africa is in Lagos, Nigeria, not South Africa. The official homepage checked 20 Oct 2026 advertises 25-27 May 2027. It does not print 2-4 June 2026, so the 2026 dates on this edition stay unconfirmed.'
  },
  {
    id: 'up-international-trade-show-2026', series: 'up-international-trade-show', name: 'UP International Trade Show 2026 (UPITS)', type: 'exhibition',
    start: '2026-09-25', end: '2026-09-29', date_status: 'CONFIRMED',
    venue: 'India Expo Centre & Mart', city: 'Greater Noida', country: 'India', region: 'Asia',
    official_url: 'https://upinternationaltradeshow.com/',
    source_url: 'https://upinternationaltradeshow.com/', source_checked_at: CHECKED,
    relevance_tier: 'ADJACENT', lifecycle: 'COMPLETED',
    reason: 'Official UPITS site. This is a general multi-sector trade show with low transformer relevance.',
    description: 'UP International Trade Show 2026 (UPITS), 25-29 September 2026 at India Expo Centre & Mart, Greater Noida. General multi-sector show.'
  },
  {
    id: 'data-center-world-power-2026', series: 'data-center-world-power', name: 'Data Center World POWER 2026', type: 'exhibition',
    start: '2026-09-21', end: '2026-09-23', date_status: 'CONFIRMED',
    venue: 'Gaylord Texan', city: 'Grapevine (Dallas)', country: 'USA', region: 'Americas',
    official_url: 'https://www.dcwpower.com/',
    source_url: 'https://www.dcwpower.com/', source_checked_at: CHECKED,
    relevance_tier: 'HIGH', lifecycle: 'COMPLETED',
    reason: 'Official Data Center World POWER listing. 21-23 September 2026 at the Gaylord Texan, Grapevine.',
    description: 'Data Center World POWER 2026, 21-23 September 2026 at the Gaylord Texan, Grapevine (Dallas). The exhibitor list is the source for booth 140.'
  },
  {
    id: 'smrp-annual-conference-2026', series: 'smrp-annual-conference', name: 'SMRP 34th Annual Conference 2026', type: 'conference',
    start: '2026-09-28', end: '2026-10-01', date_status: 'CONFIRMED',
    venue: null, city: 'Raleigh', country: 'USA', region: 'Americas',
    official_url: 'https://smrp.org/',
    source_url: 'https://smrp.org/', source_checked_at: CHECKED,
    relevance_tier: 'HIGH', lifecycle: 'COMPLETED',
    reason: 'SMRP 34th Annual Conference, 28 September-1 October 2026 in Raleigh. The city is the one on the official floor-plan listing.',
    description: 'SMRP 34th Annual Conference 2026, 28 September-1 October 2026 in Raleigh. Conference, not a trade show.'
  },
  {
    id: 'ieee-apec-2026', series: 'ieee-apec', name: 'IEEE APEC 2026', type: 'conference',
    start: '2026-03-22', end: '2026-03-26', date_status: 'CONFIRMED',
    venue: 'Henry B. González Convention Center', city: 'San Antonio', country: 'USA', region: 'Americas',
    official_url: 'https://apec-conf.org/',
    source_url: 'https://apec-conf.org/', source_checked_at: CHECKED,
    relevance_tier: 'HIGH', lifecycle: 'COMPLETED',
    reason: 'IEEE Applied Power Electronics Conference, 22-26 March 2026 at the Henry B. Gonzalez Convention Center, San Antonio. The 2027 edition in New Orleans is a different year of the same series.',
    description: 'IEEE APEC 2026, 22-26 March 2026 at the Henry B. Gonzalez Convention Center, San Antonio. Power electronics conference. IEEE APEC 2027 in New Orleans remains a separate edition.'
  },
  {
    id: 'ip-utility-safety-conference-expo-2026', series: 'ip-utility-safety-conference-expo', name: 'iP Utility Safety Conference & Expo 2026', type: 'conference',
    start: '2026-05-05', end: '2026-05-07', date_status: 'PROJECTED',
    venue: 'DoubleTree by Hilton at Universal Orlando', city: 'Orlando', country: 'USA', region: 'Americas',
    official_url: 'https://utilitysafetyconference.com/',
    source_url: 'https://utilitysafetyconference.com/', source_checked_at: null,
    relevance_tier: 'HIGH', lifecycle: 'MONITORING',
    reason: 'Dates are unconfirmed. The 5-7 May 2026 range was not confirmed on the official site.',
    description: 'iP Utility Safety Conference and Expo 2026. The dates 5-7 May 2026 at DoubleTree by Hilton at Universal Orlando are unconfirmed. They were not confirmed on the official site.'
  },
  {
    id: 'megger-substation-testing-workshop-2026', series: 'megger-substation-testing-workshop', name: 'Substation Testing Workshop with Megger (PASS Ltd)', type: 'workshop',
    start: '2026-11-24', end: '2026-11-24', date_status: 'CONFIRMED',
    venue: 'PASS Training Centre, Potters Lane', city: 'Stevenage', country: 'UK', region: 'Europe',
    organiser: 'PASS Ltd',
    official_url: 'https://www.eventbrite.co.uk/e/substation-testing-workshop-with-megger-pass-training-centre-stevenage-tickets-2002995682004',
    source_url: 'https://www.eventbrite.co.uk/e/substation-testing-workshop-with-megger-pass-training-centre-stevenage-tickets-2002995682004',
    source_checked_at: CHECKED,
    relevance_tier: 'CORE', lifecycle: 'CONFIRMED_UPCOMING',
    reason: 'Eventbrite organiser page: 24 November 2026, 09:00-16:00 local, at PASS Training Centre, Potters Lane, Stevenage. Free workshop. This is not a trade show.',
    description: 'Substation testing workshop with Megger, organised by PASS Ltd. 24 November 2026, 09:00-16:00 local, at PASS Training Centre, Potters Lane, Stevenage. Free. Workshop, listed apart from trade shows.'
  },
  {
    id: 'darcy-robotics-in-td-2026', series: 'darcy-robotics-in-td', name: 'The Future of Robotics in Transmission & Distribution (Darcy Partners)', type: 'webinar',
    start: '2026-10-22', end: '2026-10-22', date_status: 'CONFIRMED',
    venue: 'Online (12:00-1:00 PM EDT)', city: 'Online', country: null, region: null,
    organiser: 'Darcy Partners',
    official_url: 'https://darcypartners.com/upcoming-events',
    source_url: 'https://darcypartners.com/upcoming-events', source_checked_at: CHECKED,
    relevance_tier: 'HIGH', lifecycle: 'CONFIRMED_UPCOMING',
    reason: 'Darcy Partners upcoming-events page. 22 October 2026, 12:00-13:00 EDT, which is 20:00-21:00 in Dubai (UTC+4). Online webinar, not a trade show.',
    description: 'Online webinar from Darcy Partners on robotics in transmission and distribution. 22 October 2026, 12:00-13:00 EDT (20:00-21:00 Dubai, UTC+4). Listed apart from trade shows.'
  },
  {
    id: 'aupec-2026', series: 'aupec', name: 'IEEE PES AUPEC 2026 (Australasian Universities Power Engineering Conference)', type: 'conference',
    start: '2026-11-02', end: '2026-11-06', date_status: 'CONFIRMED',
    venue: 'University of Tasmania, Sandy Bay', city: 'Hobart', country: 'Australia', region: 'Oceania',
    official_url: 'https://attend.ieee.org/aupec-2026/',
    source_url: 'https://attend.ieee.org/aupec-2026/', source_checked_at: CHECKED,
    relevance_tier: 'HIGH', lifecycle: 'CONFIRMED_UPCOMING',
    reason: 'Official IEEE AUPEC page: 2-6 November 2026 at the University of Tasmania, Sandy Bay, Hobart.',
    description: 'IEEE PES Australasian Universities Power Engineering Conference 2026, 2-6 November 2026 at the University of Tasmania, Sandy Bay, Hobart.'
  },
  {
    id: 'ieee-pes-switchgear-committee-spring-2027', series: 'ieee-pes-switchgear-committee', name: 'IEEE PES Switchgear Committee Spring Meeting 2027', type: 'technical_committee',
    start: '2027-04-04', end: '2027-04-08', date_status: 'CONFIRMED',
    venue: 'Hyatt Regency Orlando', city: 'Orlando', country: 'USA', region: 'Americas',
    official_url: 'https://ewh.ieee.org/soc/pes/switchgear/meetings/meetings.html',
    source_url: 'https://ewh.ieee.org/soc/pes/switchgear/meetings/meetings.html', source_checked_at: CHECKED,
    relevance_tier: 'CORE', lifecycle: 'CONFIRMED_UPCOMING',
    reason: 'Official IEEE PES Switchgear Committee meetings page: in person 4-8 April 2027 at Hyatt Regency Orlando.',
    description: 'IEEE PES Switchgear Committee spring meeting, 4-8 April 2027 at Hyatt Regency Orlando. Committee meeting, not a trade show.'
  }
];
if (NEW_EVENTS.length !== 10) throw new Error('expected 10 published events');
NEW_EVENTS.forEach((row) => {
  if (events.some((ev) => ev.id === row.id)) throw new Error('event already exists ' + row.id);
  if (row.series === 'ieee-apec' && !events.some((ev) => ev.id === 'ieee-apec-2027' && ev.series_slug === 'ieee-apec')) {
    throw new Error('APEC 2027 series missing');
  }
  events.push(edition(row));
});
if (events.some((ev) => ev.id === 'cwieme-mexico')) throw new Error('CWIEME Mexico was published');
if (events.some((ev) => ev.id === 'elecrama-asia-2026' || ev.series_slug === 'elecrama-asia')) {
  throw new Error('ELECRAMA Asia 2026 was published');
}
recordDecision(
  'HPL Electric & Power',
  'skip',
  '',
  '',
  'ELECRAMA Asia 2026 stays unpublished. It came from a single HPL post, IEEMA does not list it, and the date has passed. HPL is not tagged with that event.'
);

const BADGE_EVENTS = [
  { slug: 'cwieme-berlin-2026', series: 'cwieme-berlin', name: 'CWIEME Berlin', year: 2026, past_name: 'CWIEME Berlin 2026', start: '2026-05-19', end: '2026-05-21', timezone: 'Europe/Berlin', url: '/events/cwieme-berlin-2026/', source_url: 'https://berlin.cwiemeevents.com/', source_note: 'CWIEME Berlin 2026 edition already on the calendar, 19-21 May 2026. History cites each company official page or the organiser exhibitor page, including the booth.' },
  { slug: 'coiltech-2026', series: 'coiltech', name: 'Coiltech North America', year: 2026, past_name: 'Coiltech North America 2026', start: '2026-06-10', end: '2026-06-11', timezone: 'America/Detroit', url: '/events/coiltech-2026/', source_url: 'https://www.coiltech.us/', source_note: 'Coiltech North America 2026. History cites the ESPI company page for booth P27.' },
  { slug: 'coiltech-italia-2026', series: 'coiltech-italia', name: 'Coiltech Italia', year: 2026, past_name: 'Coiltech Italia 2026', start: '2026-09-23', end: '2026-09-24', timezone: 'Europe/Rome', url: '/events/coiltech-italia-2026/', source_url: 'https://www.coiltech.it/', source_note: 'Coiltech Italia 2026. History cites the ESPI company page for Hall 9 / C14.' },
  { slug: 'cigre-paris-2026', series: 'cigre-paris', name: 'CIGRE Paris Session', year: 2026, past_name: 'CIGRE Paris Session 2026', start: '2026-08-23', end: '2026-08-28', timezone: 'Europe/Paris', url: '/events/cigre-paris-2026/', source_url: 'https://www.cigre-exhibition.com/wp-content/uploads/sites/1/CIGRE-2026_booth-number__20260515.pdf', source_note: 'CIGRE Paris Session 2026 booth list. History for Vaisala cites the Vaisala events page.' },
  { slug: 'hannover-messe-2026', series: 'hannover-messe', name: 'HANNOVER MESSE', year: 2026, past_name: 'HANNOVER MESSE 2026', start: '2026-04-20', end: '2026-04-24', timezone: 'Europe/Berlin', url: '/events/hannover-messe-2026/', source_url: 'https://www.hannovermesse.de/', source_note: 'HANNOVER MESSE 2026. History cites the exhibitor pages for Hall 12.' },
  { slug: 'middle-east-energy-2026', series: 'middle-east-energy', name: 'Middle East Energy', year: 2026, past_name: 'Middle East Energy 2026', start: '2026-09-01', end: '2026-09-03', timezone: 'Asia/Dubai', url: '/events/middle-east-energy-2026/', source_url: 'https://www.middleeast-energy.com/', source_note: 'Middle East Energy 2026 ran 1-3 September 2026. History cites each company page for the booth.' },
  { slug: 'electra-mining-africa-2026', series: 'electra-mining-africa', name: 'Electra Mining Africa', year: 2026, past_name: 'Electra Mining Africa 2026', start: '2026-09-07', end: '2026-09-11', timezone: 'Africa/Johannesburg', url: '/events/electra-mining-africa-2026/', source_url: 'https://www.electramining.co.za/exhibitors/actom', source_note: 'Electra Mining Africa exhibitor page for ACTOM, Green Zone P44.' },
  { slug: 'wetex-2026', series: 'wetex', name: 'WETEX', year: 2026, past_name: 'WETEX 2026', start: '2026-10-20', end: '2026-10-22', timezone: 'Asia/Dubai', url: '/events/wetex-2026/', source_url: 'https://www.wetex.ae/', source_note: 'WETEX 2026 is 20-22 October 2026 at Dubai World Trade Centre. alfanar is tagged from the official seminar page. Booth not stated.' },
  { slug: 'data-center-world-power-2026', series: 'data-center-world-power', name: 'Data Center World POWER', year: 2026, past_name: 'Data Center World POWER 2026', start: '2026-09-21', end: '2026-09-23', timezone: 'America/Chicago', url: '/events/data-center-world-power-2026/', source_url: 'https://exhibitors.dcwpower.com/alphabetical.php', source_note: 'Data Center World POWER 2026 exhibitor list. Texas Transformers and Equipment is booth 140.' },
  { slug: 'smrp-annual-conference-2026', series: 'smrp-annual-conference', name: 'SMRP Annual Conference', year: 2026, past_name: 'SMRP 34th Annual Conference 2026', start: '2026-09-28', end: '2026-10-01', timezone: 'America/New_York', url: '/events/smrp-annual-conference-2026/', source_url: 'https://h2scan.com/events/', source_note: 'SMRP 34th Annual Conference 2026 in Raleigh. H2scan booth 1131 is cited from the company events page.' }
];
BADGE_EVENTS.forEach((event) => {
  if ((badges.events || []).some((row) => row.slug === event.slug)) return;
  badges.events.push(event);
});
if (badges.how_to_add.indexOf('Batch 4') < 0) {
  badges.how_to_add += ' Batch 4 adds exhibitor history for CWIEME Berlin 2026, Coiltech North America 2026, Coiltech Italia 2026, CIGRE Paris Session 2026, HANNOVER MESSE 2026, Middle East Energy 2026, Electra Mining Africa 2026, WETEX 2026, Data Center World POWER 2026, and SMRP 34th Annual Conference 2026.';
}

laboratories.total_laboratories = laboratories.laboratories.length;

const expectedRows = {
  'cwieme-berlin-2026': 6,
  'coiltech-2026': 1,
  'coiltech-italia-2026': 1,
  'cigre-paris-2026': 8,
  'hannover-messe-2026': 2,
  'data-center-world-power-2026': 1,
  'smrp-annual-conference-2026': 1,
  'middle-east-energy-2026': 2,
  'electra-mining-africa-2026': 1,
  'wetex-2026': 1
};
Object.keys(expectedRows).forEach((id) => {
  const n = (sections[id].entries || []).length;
  if (n !== expectedRows[id]) throw new Error(id + ' expected ' + expectedRows[id] + ' rows, got ' + n);
});
if (added.length !== 17) throw new Error('expected 17 listings, got ' + added.length);
if (!createdById['TPN-0472'] || !createdById['TPN-0476']) throw new Error('LinkedIn TPN ids missing');
const vaisala = (badges.companies || []).find((c) => c.slug === 'vaisala-oyj');
const vaisalaHit = (vaisala.history || []).find((h) => h.event === 'cigre-paris-2026');
if (!vaisalaHit || vaisalaHit.source.indexOf('vaisala.com') < 0) throw new Error('Vaisala source must be the Vaisala page');
const alfanarWetex = sections['wetex-2026'].entries.find((e) => e.slug === 'alfanar');
if (!alfanarWetex || alfanarWetex.booth) throw new Error('alfanar WETEX booth must stay unstated');
const hitachi = sections['cwieme-berlin-2026'].entries.find((e) => e.slug === 'hitachi-energy');
if (!hitachi || hitachi.booth !== '27G40') throw new Error('Hitachi booth missing');

const fresh = JSON.stringify(added) + JSON.stringify(verifyOutcomes) + JSON.stringify(Object.keys(expectedRows).map((id) => sections[id])) + JSON.stringify(BADGE_EVENTS);
if (/do_not_contact/i.test(fresh)) throw new Error('do_not_contact leaked');
if (/transformers\s*magazine/i.test(fresh)) throw new Error('magazine source leaked');
if (/linkedin\.com/i.test(fresh)) throw new Error('LinkedIn URL leaked');
held.forEach((row) => {
  if (added.some((item) => item.name === displayName(row.company))) throw new Error('held company imported ' + row.company);
});

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
writeEvents(events);

const byDirectory = added.reduce((acc, row) => { acc[row.directory] = (acc[row.directory] || 0) + 1; return acc; }, {});
const report = {
  social_listings: 12,
  linkedin_imported: 5,
  linkedin_held: held.map((row) => displayName(row.company)),
  listings_added: added.length,
  added_by_directory: byDirectory,
  added: added.map((row) => ({ id: row.id, name: row.name, slug: row.slug, directory: row.directory, website: row.website })),
  tag_rows: socialExisting.length,
  verify: verifyOutcomes,
  events_added: NEW_EVENTS.map((row) => row.id),
  events_skipped: ['cwieme-mexico', 'elecrama-asia-2026'],
  event_rows: Object.keys(expectedRows).map((id) => ({ event: id, section: sections[id].section, rows: sections[id].entries.length })),
  new_events_without_rows: NEW_EVENTS.filter((row) => !expectedRows[row.id]).map((row) => ({ event: row.id, rows: 0, date_status: row.date_status, type: row.type })),
  retired_tpn_0276: { slug: 'schweitzer-engineering-laboratories-pvt-ltd', permanent_id: 'TPM-001072', removed: 'listing and claim page' }
};
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/event-batch-4-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  listings_added: report.listings_added,
  added_by_directory: byDirectory,
  verify: verifyOutcomes.length,
  events_added: report.events_added.length,
  event_rows: report.event_rows
}, null, 2));
