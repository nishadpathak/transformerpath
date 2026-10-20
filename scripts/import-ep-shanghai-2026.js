#!/usr/bin/env node
/* One-shot import of approved EP Shanghai 2026 exhibitor rows.
 * Outreach columns (do_not_contact, phone, email) are not written.
 * Run once. A second run stops if ABB (China) is already in the census.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pinyin } = require('/tmp/pinyin-tool/node_modules/pinyin-pro');

const ROOT = path.join(__dirname, '..');
const NEW_CSV = process.argv[2] || '/home/ubuntu/.cursor/projects/workspace/uploads/ep-shanghai-2026-tp-new_e6b3.csv';
const EXISTING_CSV = process.argv[3] || '/home/ubuntu/.cursor/projects/workspace/uploads/ep-shanghai-2026-tp-existing_186a.csv';
const SOURCE = 'EP Shanghai 2026 official Exhibitor List (Partial) PDF, updated 2026-08-31';
const LABEL = 'Exhibiting at EP Shanghai 2026';
const EVENT_PATH = '/events/ep-shanghai-2026/';

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
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const head = rows.shift().map((h) => h.trim());
  return rows.map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] == null ? '' : r[i]; });
    return o;
  });
}

function asciiSlug(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function pinyinSlug(name) {
  const raw = pinyin(name, { toneType: 'none', type: 'string', nonZh: 'consecutive' });
  return String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function httpUrl(value) {
  const s = String(value || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function writeJson(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');
}

const manufacturers = readJson('data/manufacturers.json');
const china = manufacturers.find((g) => g.country === 'China');
if (!china) throw new Error('China census group missing');
if (china.makers.some((m) => m[0] === 'ABB (China) Co., LTD')) {
  console.log('EP Shanghai import already present');
  process.exit(0);
}

const accessories = readJson('data/accessories.json');
const laboratories = readJson('data/laboratories.json');
const slugs = readJson('data/company-slugs.json');

const used = new Set();
slugs.forEach((row) => { if (row.slug) used.add(row.slug); });
(accessories.suppliers || []).forEach((s) => { const slug = asciiSlug(s.name); if (slug) used.add(slug); });
(laboratories.laboratories || []).forEach((lab) => {
  const slug = String(lab.id || '').replace(/^lab:/, '');
  if (slug) used.add(slug);
});

function claimSlug(base, name) {
  if (!base) throw new Error('empty slug for ' + name);
  if (used.has(base)) throw new Error('slug collision ' + base + ' for ' + name);
  used.add(base);
  return base;
}

const listingSlugs = {};
function slugFor(name) {
  const ascii = asciiSlug(name);
  if (ascii) return claimSlug(ascii, name);
  const py = pinyinSlug(name);
  listingSlugs[name] = py;
  return claimSlug(py, name);
}

const CAP_KEYS = ['lightning_impulse', 'switching_impulse', 'partial_discharge', 'temperature_rise', 'short_circuit', 'sound_level', 'dielectric_withstand', 'oil_testing', 'materials_testing', 'sfra'];

function blankCaps() {
  const caps = {};
  CAP_KEYS.forEach((k) => { caps[k] = null; });
  return caps;
}

const listings = [];
const report = { added: [], tagged: [], skipped: [], checked_not_merged: [] };

function pushListing(row) {
  listings.push(row);
  report[row.action === 'added' ? 'added' : (row.action === 'tagged' ? 'tagged' : 'skipped')].push({
    exhibitor_name: row.exhibitor_name,
    directory: row.directory,
    slug: row.slug,
    note: row.note || ''
  });
}

const existing = table(EXISTING_CSV);
existing.forEach((row) => {
  const name = row.company.trim();
  if (name === "NINGBO TIAN'AN SMART GRID TECHNOLOGY CO., LTD.") {
    const slug = slugFor(name);
    china.makers.push([name, '—', '', '']);
    pushListing({
      exhibitor_name: name,
      profile_name: name,
      slug: slug,
      directory: 'manufacturers',
      booth: row.booth || '—',
      products: row.products || '',
      website: '—',
      city: '—',
      country: row.country || 'China',
      action: 'added',
      note: "Kept separate from Ningbo Tianan (Group) Co., Ltd. Official sites (en.cntaz.com and en.tianan.com) use different domains and addresses. The exhibitor sheet's group URL was a probable-subsidiary guess, not an identity match."
    });
    return;
  }
  const url = String(row.existing_profile_url || '');
  const m = url.match(/transformerpath\.com\/(manufacturers|accessories|laboratories)\/([^/]+)\/?/);
  if (!m) throw new Error('unparsed existing profile ' + name);
  pushListing({
    exhibitor_name: name,
    profile_name: name,
    slug: m[2],
    directory: m[1] === 'laboratories' ? 'laboratories' : m[1],
    booth: row.booth || '—',
    products: row.products || '',
    website: httpUrl(row.website) || '—',
    city: row.city || '—',
    country: row.country || '',
    action: 'tagged',
    note: name.indexOf('Shell') === 0
      ? 'Tagged the existing Shell Diala group accessory profile. No China subsidiary listing was created.'
      : (name === 'CARGILL'
        ? 'Tagged the existing Cargill FR3 group accessory profile. No duplicate supplier was created.'
        : 'Tagged the profile named in the existing-exhibitor sheet (' + (row.match_basis || '') + ').')
  });
});

const fresh = table(NEW_CSV);
const counts = { manufacturers: 0, accessories: 0, laboratories: 0 };
fresh.forEach((row) => {
  const name = row.company.trim();
  const category = String(row.category || '').trim();
  let directory = '';
  if (category === 'Transformer manufacturer') directory = 'manufacturers';
  else if (category === 'Components & materials') directory = 'accessories';
  else if (category === 'Testing, monitoring & labs') directory = 'laboratories';
  else throw new Error('unknown category ' + category + ' for ' + name);

  if (/^KEMA B\.V\./i.test(name)) {
    pushListing({
      exhibitor_name: name,
      profile_name: 'KEMA Labs (CESI Group) — Arnhem',
      slug: 'kema-labs-arnhem',
      directory: 'laboratories',
      booth: row.booth || '—',
      products: row.products || '',
      website: '—',
      city: '—',
      country: row.country || '',
      action: 'tagged',
      note: 'KEMA B.V. is the Dutch legal entity of KEMA Labs Arnhem. Not added as a China laboratory. KEMA Labs Milan was left untagged because it is a different site.'
    });
    report.skipped.push({
      exhibitor_name: name,
      directory: 'laboratories',
      slug: '',
      note: 'Skipped creating a new laboratory. The Arnhem profile was tagged instead.'
    });
    return;
  }

  const slug = slugFor(name);
  const site = httpUrl(row.website);
  const products = row.products || '';
  const listing = {
    exhibitor_name: name,
    profile_name: name,
    slug: slug,
    directory: directory,
    booth: row.booth || '—',
    products: products,
    website: site || '—',
    city: '—',
    country: row.country || 'China',
    action: 'added',
    note: name === 'ABB (China) Co., LTD'
      ? 'No public ABB group manufacturer profile exists. Census ABB rows are Trasfor, ABB Türkiye and ABB Thailand. abb-transformers and abb-power-grids redirect to Hitachi Energy, a different company. Added ABB (China) as its own unclaimed maker with the listed global.abb website.'
      : ''
  };
  if (directory === 'manufacturers') {
    china.makers.push([name, '—', site, '']);
    counts.manufacturers++;
  } else if (directory === 'accessories') {
    accessories.suppliers.push({
      name: name,
      country: row.country || 'China',
      state: '',
      city: '—',
      website: site,
      categories: [],
      description: products,
      role: 'Unclaimed listing',
      listing_status: 'unclaimed',
      verification_status: 'Unclaimed',
      verification_date: '—',
      evidence_source: SOURCE,
      directory_source_title: SOURCE
    });
    counts.accessories++;
  } else {
    laboratories.laboratories.push({
      id: 'lab:' + slug,
      name: name,
      country: row.country || 'China',
      city: '—',
      website: site,
      third_party_independent: false,
      max_voltage_kv: null,
      short_circuit_capacity: '',
      capabilities: blankCaps(),
      description: products,
      last_verified: '—',
      source: SOURCE,
      directory_source_title: SOURCE,
      rfq_eligible: false
    });
    counts.laboratories++;
  }
  pushListing(listing);
});

laboratories.total_laboratories = laboratories.laboratories.length;

const doc = {
  event_id: 'ep-shanghai-2026',
  label: LABEL,
  event_path: EVENT_PATH,
  source: SOURCE,
  listings: listings
};

writeJson('data/manufacturers.json', manufacturers);
writeJson('data/accessories.json', accessories);
writeJson('data/laboratories.json', laboratories);
writeJson('data/listing-slugs.json', listingSlugs);
writeJson('data/ep-shanghai-2026-exhibitors.json', doc);

const shipped = JSON.stringify(doc) + JSON.stringify(listingSlugs);
if (/do_not_contact|@[a-z0-9.-]+\.[a-z]{2,}/i.test(shipped)) {
  throw new Error('outreach fields leaked into shipped JSON');
}

report.checked_not_merged = [
  'Sixteen Chinese-only legal names had no ASCII slug and no directory hit under pinyin or a translated short name. Each was added under its Chinese display name with a mechanical pinyin slug.',
  '许绝电工股份有限公司 is not 许继电气 / XJ Electric (绝 and 继 differ). No XJ directory listing was tagged.',
  '江苏恒大变压器有限公司 was not treated as any other Hengda company. No directory name matched.',
  '成都西南电工集团有限公司 was not merged with Southwest Electric Co. (USA).',
  'Ningbo Tian\'an Smart Grid and Ningbo Tianan (Group) stay separate.',
  'Shell (Shanghai) Petroleum and CARGILL were not created again.',
  'Zhejiang Jiangshan Hengli Electric was not merged with Jiangshan Transformer, Zhejiang Jiangshan Transformer, or SCOTECH Jiangshan.',
  'Baoding Jingda was not merged with Tongling Jingda.',
  'Nanjing Fangneng Automation was not merged with Guodian Nanjing Automation.',
  'SHAANXI QT / HANZHONG was not merged with Shaanxi Yinhe.',
  'Shanghai Huaming\'s manufacturer profile was tagged. The accessory pages shanghai-huaming-power-equipment-co-ltd-huaming-hm and huaming-power-equipment-co-ltd were left as they are.'
];

fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/ep-shanghai-2026-import-report.json', JSON.stringify({
  counts: counts,
  tianan_added: true,
  listing_slug_count: Object.keys(listingSlugs).length,
  report: report
}, null, 2) + '\n');

console.log('added makers', counts.manufacturers, 'accessories', counts.accessories, 'labs', counts.laboratories);
console.log('listings', listings.length, 'pinyin slugs', Object.keys(listingSlugs).length);
console.log('tagged', report.tagged.length, 'skipped notes', report.skipped.length);
