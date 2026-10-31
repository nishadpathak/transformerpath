#!/usr/bin/env node
/* 31 Oct 2026 directory handoff.
 * Adds unclaimed listings TPN-0607–TPN-0717 and tags clear matches
 * for CWIEME Berlin 2026 and Middle East Energy 2026.
 * do_not_contact, no_email, phone, email and address are not written.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { slugify, resolveCompanyAlias } = require('../lib/company-aliases');

const ROOT = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const args = process.argv.slice(2).filter((arg) => arg !== '--apply');
const NEW_CSV = args[0] || '/home/ubuntu/.cursor/projects/workspace/uploads/handoff-2026-10-31-tp_95e3.csv';
const DUPE_CSV = args[1] || '/home/ubuntu/.cursor/projects/workspace/uploads/handoff-2026-10-31-dupes_1711.csv';
const CHECKED = '2026-10-31';

const EVENT_IDS = {
  'CWIEME Berlin 2026': 'cwieme-berlin-2026',
  'Middle East Energy 2026': 'middle-east-energy-2026'
};
const EVENT_YEAR = { 'cwieme-berlin-2026': 2026, 'middle-east-energy-2026': 2026 };

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
function foldLetters(s) {
  return String(s || '')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}
function normKey(s) {
  return foldLetters(String(s || '')).replace(/\u00a0/g, ' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const TRAILING_FORMS = ['private limited', 'pvt ltd', 'co ltd', 'co limited', 'anonim sirketi', 's p a', 's r l', 'limited', 'ltd', 'llc', 'inc', 'incorporated', 'corp', 'corporation', 'gmbh', 'srl', 'spa', 'fzco', 'fze', 'oyj', 'plc', 'mbh', 'company', 'ag', 'bv', 'nv', 'oy', 'ab', 'kg'];
function coreName(s) {
  let n = normKey(s);
  let changed = true;
  while (changed) {
    changed = false;
    const forms = TRAILING_FORMS.slice().sort((a, b) => b.length - a.length);
    for (let i = 0; i < forms.length; i++) {
      const f = forms[i];
      if (n === f) { n = ''; changed = true; break; }
      if (n.endsWith(' ' + f)) { n = n.slice(0, n.length - f.length).trim(); changed = true; break; }
    }
  }
  return n;
}
function tokensOf(s) {
  return coreName(s).split(' ').filter((t) => t.length >= 4);
}
function tokenMatches(token, other) {
  if (token === other) return true;
  const a = token.length <= other.length ? token : other;
  const b = token.length <= other.length ? other : token;
  if (a.length < 6) return false;
  return b.startsWith(a) && (b.length - a.length) <= 3;
}
function namesAlign(a, b) {
  const ca = coreName(String(a || '').replace(/^the\s+/i, ''));
  const cb = coreName(String(b || '').replace(/^the\s+/i, ''));
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const short = ca.length <= cb.length ? ca : cb;
  const long = ca.length <= cb.length ? cb : ca;
  if (short.length >= 8 && (long === short || long.startsWith(short + ' ') || long.indexOf(' ' + short + ' ') >= 0 || long.endsWith(' ' + short))) return true;
  const left = tokensOf(a);
  const right = tokensOf(b);
  if (!left.length || !right.length) return false;
  const covered = left.filter((t) => right.some((u) => tokenMatches(t, u)));
  const longTokens = left.filter((t) => t.length >= 6);
  if (!longTokens.length) return false;
  const longCovered = longTokens.filter((t) => right.some((u) => tokenMatches(t, u)));
  return longCovered.length === longTokens.length && covered.length >= Math.min(left.length, 2);
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
  if (!/^https?:$/i.test(u.protocol)) return '';
  u.hostname = u.hostname.toLowerCase();
  if (/(^|\.)linkedin\.com$|(^|\.)facebook\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(u.hostname)) return '';
  const out = u.toString();
  return out.endsWith('/') && u.pathname === '/' && !u.search && !u.hash ? out.slice(0, -1) : out;
}
function hostOf(value) {
  const url = httpUrl(value);
  if (!url) return '';
  try {
    let h = new URL(url).hostname.toLowerCase();
    if (h.startsWith('www.')) h = h.slice(4);
    return h;
  } catch (e) { return ''; }
}
function directoryOf(category) {
  if (category === 'Transformer manufacturer') return 'manufacturers';
  if (category === 'Components & materials') return 'accessories';
  if (category === 'Testing, monitoring & labs') return 'laboratories';
  if (category === 'Services') return 'services';
  throw new Error('unknown category ' + category);
}
function censusCountry(raw, directory) {
  const s = displayName(raw);
  const key = normKey(s);
  if (!s || s === '—' || s === '-' || s === '–') return '—';
  if (key === 'turkey' || key === 'turkiye') return 'Türkiye';
  if (key === 'united states' || key === 'usa' || key === 'us') {
    return directory === 'accessories' ? 'United States' : 'USA';
  }
  if (key === 'united arab emirates' || key === 'uae') {
    return directory === 'accessories' ? 'United Arab Emirates' : 'UAE';
  }
  if (key === 'czech republic') return 'Czechia';
  if (key === 'republic of korea' || key === 'south korea') return 'South Korea';
  if (key === 'viet nam') return 'Vietnam';
  return s;
}
function blankDash(value) {
  const s = displayName(value);
  if (!s || s === '-' || s === '–' || s === '—') return '—';
  return s;
}
function eventsIn(text) {
  const found = [];
  Object.keys(EVENT_IDS).forEach((label) => {
    if (String(text || '').indexOf(label) >= 0) found.push(EVENT_IDS[label]);
  });
  return found;
}
function uncertain(note) {
  return /\bgeneric\b|\bsubsidiary\b|\bbranch\b|\bpart of\b|\barm of\b|group company|group profile/i.test(note || '');
}
function explicitIdentity(note) {
  return /\brenamed\b|\bsame site\b|\bsame company\b| = /i.test(note || '');
}
function leak(text) {
  return /do_not_contact|no_email|transformers magazine|linkedin\.com/i.test(text || '');
}

const newRows = table(NEW_CSV);
const dupeRows = table(DUPE_CSV);
if (newRows.length !== 111) throw new Error('expected 111 new listings, got ' + newRows.length);
if (dupeRows.length !== 152) throw new Error('expected 152 duplicate rows, got ' + dupeRows.length);
newRows.forEach((row, i) => {
  const expect = 'TPN-' + String(607 + i).padStart(4, '0');
  if (row.new_listing_id !== expect) throw new Error('id sequence broke at ' + row.new_listing_id + ' expected ' + expect);
  if (String(row.verified).trim().toLowerCase() !== 'yes') throw new Error('unverified row ' + expect);
  if (displayName(row.status) !== 'Unclaimed') throw new Error('status ' + row.status);
});

const manufacturers = readJson('data/manufacturers.json');
const accessories = readJson('data/accessories.json');
const laboratories = readJson('data/laboratories.json');
const services = readJson('data/services.json');
const extras = readJson('data/permanent-id-extras.json');
const decisions = readJson('data/event-batch-decisions.json');
const integrity = readJson('data/directory-integrity.json');
const badges = readJson('data/event-badges.json');
const directoryFile = readJson('data/event-directory.json');

if (APPLY && decisions.some((row) => /Handoff 2026-10-31\./.test(row.note || ''))) {
  console.log('handoff 2026-10-31 already imported');
  process.exit(0);
}

const groups = {};
manufacturers.forEach((g) => { groups[g.country] = g; });

const slugRows = readJson('data/company-slugs.json');
const slugByNorm = {};
slugRows.forEach((row) => { if (row && row.name && row.slug) slugByNorm[normKey(row.name)] = row.slug; });
function manufacturerSlug(rawName) {
  const alias = resolveCompanyAlias(rawName);
  if (alias.aliased && alias.slug) return { name: alias.name, slug: alias.slug };
  const slug = slugByNorm[normKey(alias.name)] || slugByNorm[normKey(rawName)] || slugify(alias.name);
  return { name: alias.name, slug: slug };
}
const entities = [];
const entityByKey = {};
function addEntityIndex(rec) {
  const key = rec.directory + ':' + rec.slug;
  const prior = entityByKey[key];
  if (prior) {
    prior.aliases.push(rec.name);
    (rec.aliases || []).forEach((n) => prior.aliases.push(n));
    if (!prior.website && rec.website) prior.website = rec.website;
    return;
  }
  rec.aliases = rec.aliases || [rec.name];
  entityByKey[key] = rec;
  entities.push(rec);
}
manufacturers.forEach((g) => (g.makers || []).forEach((m) => {
  if (!m || /^Served by/i.test(m[0])) return;
  const profile = manufacturerSlug(m[0]);
  addEntityIndex({ directory: 'manufacturers', name: profile.name, slug: profile.slug, website: m[2] || '', country: g.country, city: m[1] || '', aliases: [m[0], profile.name] });
}));
(accessories.suppliers || []).forEach((s) => {
  const slug = s.slug || slugify(s.name);
  addEntityIndex({ directory: 'accessories', name: s.name, slug: slug, website: s.website || '', country: s.country || '', city: s.city || '', aliases: [s.name] });
});
(laboratories.laboratories || []).forEach((lab) => {
  const slug = String(lab.id || '').replace(/^lab:/, '');
  addEntityIndex({ directory: 'laboratories', name: lab.name, slug: slug, website: lab.website || '', country: lab.country || '', city: lab.city || '', aliases: [lab.name] });
});
(services.services || []).forEach((s) => {
  const slug = String(s.id || '').replace(/^srv:/, '');
  addEntityIndex({ directory: 'services', name: s.company_name, slug: slug, website: s.website || '', country: s.country || '', city: s.city || '', aliases: [s.company_name] });
});
try {
  const logistics = readJson('data/logistics.json');
  (logistics.companies || []).forEach((s) => {
    addEntityIndex({ directory: 'logistics', name: s.name || s.company_name, slug: s.slug || slugify(s.name || s.company_name), website: s.website || '', country: s.country || '', city: s.city || '' });
  });
} catch (e) { /* optional */ }
try {
  const rental = readJson('data/rental-emergency-providers.json');
  const rows = rental.providers || rental.companies || rental.listings || [];
  rows.forEach((s) => {
    addEntityIndex({ directory: 'rental', name: s.name || s.company_name, slug: s.slug || slugify(s.name || s.company_name), website: s.website || '', country: s.country || '', city: s.city || '' });
  });
} catch (e) { /* optional */ }

const byNorm = {};
const byCore = {};
const byHost = {};
const bySlug = {};
function indexEntity(rec) {
  const key = rec.directory + ':' + rec.slug;
  if (!entityByKey[key]) {
    rec.aliases = rec.aliases || [rec.name];
    entityByKey[key] = rec;
    entities.push(rec);
  }
  const names = entityNames(rec);
  names.forEach((nm) => {
    const n = normKey(nm);
    const c = coreName(nm);
    (byNorm[n] = byNorm[n] || []).push(rec);
    if (c) (byCore[c] = byCore[c] || []).push(rec);
  });
  const h = hostOf(rec.website);
  if (h) (byHost[h] = byHost[h] || []).push(rec);
  if (rec.slug) {
    const key = rec.directory + ':' + rec.slug;
    bySlug[key] = rec;
    (bySlug[rec.slug] = bySlug[rec.slug] || []).push(rec);
  }
}
entities.forEach(indexEntity);

const usedSlugs = new Set();
entities.forEach((rec) => { if (rec.slug) usedSlugs.add(rec.slug); });
readJson('data/company-slugs.json').forEach((row) => { if (row.slug) usedSlugs.add(row.slug); });

function findBySlug(directory, slug) {
  if (directory && bySlug[directory + ':' + slug]) return bySlug[directory + ':' + slug];
  const list = Array.isArray(bySlug[slug]) ? bySlug[slug] : [];
  if (directory) {
    const hit = list.filter((rec) => rec.directory === directory);
    return hit.length === 1 ? hit[0] : null;
  }
  return list.length === 1 ? list[0] : null;
}
function unique(list) {
  const seen = new Set();
  const out = [];
  list.forEach((rec) => {
    const key = rec.directory + ':' + rec.slug;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(rec);
  });
  return out;
}
function entityNames(rec) {
  return [rec.name].concat(rec.aliases || []);
}
function lookupExact(name, directoryLimit) {
  const n = normKey(name);
  const c = coreName(name);
  let hits = entities.filter((rec) => entityNames(rec).some((nm) => normKey(nm) === n || (c && c.length >= 4 && coreName(nm) === c)));
  hits = unique(hits);
  if (directoryLimit) hits = hits.filter((rec) => rec.directory === directoryLimit);
  return hits;
}
function alignsAny(name, rec) {
  return entityNames(rec).some((nm) => namesAlign(name, nm));
}
function lookupAlign(name, directoryLimit) {
  return unique(entities.filter((rec) => (!directoryLimit || rec.directory === directoryLimit) && alignsAny(name, rec)));
}
function initialsOf(name) {
  const dotted = String(name || '').match(/\b(?:[A-Za-z]\.){2,}/);
  return dotted ? dotted[0].replace(/\./g, '').toLowerCase() : '';
}
function slugAgrees(company, target) {
  const initials = initialsOf(company);
  if (initials.length >= 3 && (target.slug === initials || target.slug.indexOf(initials + '-') === 0 || coreName(target.name).indexOf(initials) === 0)) return true;
  const slug = target.slug || '';
  const profile = normKey(entityNames(target).join(' '));
  const words = coreName(company).split(' ').filter(Boolean);
  if (words.length === 1 && words[0].length >= 4 && (slug.indexOf(words[0]) >= 0 || profile.indexOf(words[0]) >= 0)) return true;
  const head = words[0] || '';
  const profileHead = (profile.split(' ')[0] || '');
  const slugHead = slug.split('-')[0] || '';
  const headOk = head.length >= 4 && (slug.indexOf(head) === 0 || profile.indexOf(head) === 0 || nearToken(head, profileHead) || nearToken(head, slugHead));
  if (headOk) {
    const rest = words.slice(1).filter((w) => w.length >= 5);
    if (rest.length && rest.every((w) => profile.indexOf(w) >= 0 || slug.indexOf(w) >= 0 || profile.split(' ').some((p) => nearToken(w, p)))) return true;
  }
  return false;
}
function nearToken(a, b) {
  if (!a || !b || Math.abs(a.length - b.length) > 1 || a.length < 6) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    edits++;
    if (edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function parseRef(ref) {
  const text = displayName(ref);
  const url = text.match(/https?:\/\/transformerpath\.com\/(manufacturers|accessories|laboratories|services)\/([a-z0-9-]+)\/?/i);
  let slug = url ? url[2] : '';
  let directory = url ? url[1] : '';
  if (!slug) {
    const lead = text.match(/^([a-z0-9-]{3,})\s+\(/i);
    if (lead && text.indexOf('transformerpath.com') >= 0) slug = lead[1];
  }
  const liveMakers = /live:\s*manufacturers\.json/i.test(text);
  const name = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\(\s*https?:\/\/[^)]*\)/g, ' ')
    .replace(/\((?:live:[^)]*|TPN-\d+[^)]*|[^)]*\.csv[^)]*)\)/ig, ' ')
    .replace(/^this handoff:\s*/i, '')
    .replace(/\blive:\s*manufacturers\.json\b/ig, ' ')
    .replace(/\blive:\s*/ig, ' ')
    .replace(/\bTPN-\d+\b/g, ' ')
    .replace(/\b(tp-new-listings-master|linkedin-makers-tp-new)\.csv\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { slug: slug, directory: directory, liveMakers: liveMakers, name: name };
}

function resolveDupe(row) {
  const company = displayName(row.company);
  const note = displayName(row.event_tag_note);
  const events = eventsIn(note);
  const ref = parseRef(row.existing_tp_ref);
  if (!events.length) return { status: 'ambiguous', reason: 'no recognised event tag', company: company, events: events };
  if (uncertain(note)) return { status: 'ambiguous', reason: 'note marks a group, branch, subsidiary, or generic name', company: company, events: events, ref: ref };

  let target = null;
  const acceptSlug = {
    'MEE:165': 'matco-mohammed-al-ojaimi-transformers',
    'MEE:1090': 'shanghai-electric-tandd-group'
  }[row.event + ':' + row.row];
  if (ref.slug) {
    target = findBySlug(ref.directory, ref.slug);
    if (target && acceptSlug && target.slug === acceptSlug) {
      return { status: 'clear', company: company, events: events, target: target, via: 'slug' };
    }
    if (target) {
      const aligned = alignsAny(company, target) || (ref.name && alignsAny(ref.name, target)) || explicitIdentity(note) || slugAgrees(company, target);
      if (!aligned) return { status: 'ambiguous', reason: 'slug ' + target.slug + ' is ' + target.name + ', which does not match ' + company, company: company, events: events, target: target };
      return { status: 'clear', company: company, events: events, target: target, via: 'slug' };
    }
  }

  const limit = ref.liveMakers ? 'manufacturers' : '';
  const steps = [];
  if (ref.name) steps.push(ref.name);
  if (normKey(company) !== normKey(ref.name)) steps.push(company);
  for (let i = 0; i < steps.length; i++) {
    let hits = lookupExact(steps[i], limit);
    if (!hits.length) hits = lookupAlign(steps[i], limit);
    if (hits.length > 1) return { status: 'ambiguous', reason: 'more than one directory entry matches ' + steps[i], company: company, events: events, hits: hits.map((h) => h.directory + ':' + h.slug) };
    if (hits.length === 1) {
      target = hits[0];
      if (!alignsAny(company, target) && !(ref.name && alignsAny(ref.name, target)) && !explicitIdentity(note)) {
        return { status: 'ambiguous', reason: 'single hit ' + target.name + ' does not align with ' + company, company: company, events: events, target: target };
      }
      return { status: 'clear', company: company, events: events, target: target, via: 'name' };
    }
  }
  return { status: 'ambiguous', reason: 'no directory entry matches the name', company: company, events: events };
}

function duplicateOf(name, website) {
  const n = normKey(name);
  const c = coreName(name);
  const h = hostOf(website);
  const nameHits = unique([].concat(byNorm[n] || [], (c && c.length >= 6) ? (byCore[c] || []) : []));
  const siteHits = h ? unique(byHost[h] || []) : [];
  if (nameHits.length) return { kind: 'name', hits: nameHits };
  if (siteHits.length) return { kind: 'website', hits: siteHits };
  return null;
}

const CAP_KEYS = ['lightning_impulse', 'switching_impulse', 'partial_discharge', 'temperature_rise', 'short_circuit', 'sound_level', 'dielectric_withstand', 'oil_testing', 'materials_testing', 'sfra'];
function blankCaps() {
  const caps = {};
  CAP_KEYS.forEach((k) => { caps[k] = null; });
  return caps;
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
    note: 'The 31 Oct 2026 listing handoff left this field unstated. Labeled unknown so the row is not published as a guess.'
  });
}
function recordDecision(company, decision, slug, directory, note) {
  if (leak(note)) throw new Error('decision leaked a blocked field for ' + company);
  decisions.push({ company: company, decision: decision, slug: slug, directory: directory, note: note });
}

const badgeBySlug = {};
(badges.companies || []).forEach((row) => { badgeBySlug[row.slug] = row; });
function ensureBadge(slug, name, shown, eventId, source) {
  if (!httpUrl(source)) throw new Error('badge source is not a url for ' + slug);
  let row = badgeBySlug[slug];
  if (!row) {
    row = { slug: slug, name: name, history: [] };
    badges.companies.push(row);
    badgeBySlug[slug] = row;
  }
  if (shown && shown !== row.name) {
    row.aliases = row.aliases || [];
    if (row.aliases.indexOf(shown) < 0) row.aliases.push(shown);
  }
  row.history = row.history || [];
  if (!row.history.some((h) => h.event === eventId)) {
    row.history.push({ event: eventId, year: EVENT_YEAR[eventId], source: httpUrl(source) });
  }
}
function pushEntry(eventId, entry) {
  const block = directoryFile.sections[eventId];
  if (!block) throw new Error('missing event section ' + eventId);
  if (block.section !== 'Previous exhibitors (2026)') throw new Error('unexpected section title ' + eventId + ' ' + block.section);
  block.entries = block.entries || [];
  if (block.entries.some((e) => e.slug === entry.slug && e.directory === entry.directory)) return false;
  block.entries.push(entry);
  return true;
}
function tagEntity(rec, shownName, eventIds) {
  const source = httpUrl(rec.website);
  if (!source) return { ok: false, reason: 'matched entry has no official website to cite' };
  eventIds.forEach((eventId) => {
    ensureBadge(rec.slug, rec.name, shownName, eventId, source);
    pushEntry(eventId, {
      name: shownName || rec.name,
      slug: rec.slug,
      directory: rec.directory,
      href: hrefFor(rec.directory, rec.slug)
    });
  });
  return { ok: true };
}

const skipped = [];
const added = [];
const tagged = [];
const ambiguous = [];
const missingCountries = [];

newRows.forEach((row) => {
  const id = row.new_listing_id;
  const name = displayName(row.company);
  const directory = directoryOf(displayName(row.category));
  const country = censusCountry(row.country, directory);
  const city = blankDash(row.city);
  const site = httpUrl(row.website);
  const products = displayName(row.products);
  if (!site) {
    skipped.push({ id: id, company: name, reason: 'no official website' });
    return;
  }
  if (leak(name + ' ' + products)) throw new Error('public text leaked a blocked field on ' + id);
  const dupe = duplicateOf(name, site);
  if (dupe) {
    skipped.push({
      id: id,
      company: name,
      website: site,
      reason: 'duplicate by ' + dupe.kind,
      matches: dupe.hits.map((h) => h.directory + ':' + h.slug + ' (' + h.name + ')')
    });
    recordDecision(name, 'already_listed', dupe.hits[0].slug, dupe.hits[0].directory, 'Handoff 2026-10-31. Skipped. Duplicate by ' + dupe.kind + ': ' + dupe.hits[0].name + '.');
    return;
  }
  const base = slugify(name);
  if (!base || usedSlugs.has(base)) {
    skipped.push({ id: id, company: name, website: site, reason: 'slug already used: ' + base });
    recordDecision(name, 'already_listed', base || '', directory, 'Handoff 2026-10-31. Skipped. Slug already used.');
    return;
  }
  if (directory === 'manufacturers' && !groups[country]) {
    missingCountries.push({ id: id, company: name, country: country });
    return;
  }
  const evidence = 'Unclaimed listing. Official site checked 31 Oct 2026: ' + site;
  const description = products && products !== '—' ? ('Unclaimed directory listing. ' + products) : 'Unclaimed directory listing.';
  if (leak(evidence + description)) throw new Error('evidence leaked on ' + id);
  const rec = { slug: base, directory: directory, name: name, country: country, website: site, city: city };
  if (APPLY) {
    if (directory === 'manufacturers') {
      groups[country].makers.push([name, city, site, '']);
      flag('manufacturers', name, country, 'types');
      if (!country || country === '—') flag('manufacturers', name, country, 'country');
    } else if (directory === 'accessories') {
      accessories.suppliers.push({
        name: name,
        slug: base,
        country: country === '—' ? '' : country,
        state: '',
        city: city,
        website: site,
        categories: [],
        description: description,
        role: 'Unclaimed listing',
        listing_status: 'unclaimed',
        verification_status: 'Unclaimed',
        verification_date: '—',
        evidence_source: evidence,
        directory_source_title: evidence
      });
      extras.push({ slug: base, name: name, country: country === '—' ? '' : country, directory: directory });
    } else if (directory === 'laboratories') {
      laboratories.laboratories.push({
        id: 'lab:' + base,
        name: name,
        country: country === '—' ? '' : country,
        city: city,
        website: site,
        third_party_independent: false,
        max_voltage_kv: null,
        short_circuit_capacity: '',
        capabilities: blankCaps(),
        description: description,
        last_verified: '—',
        source: evidence,
        directory_source_title: evidence,
        rfq_eligible: false,
        profile_page: true
      });
      extras.push({ slug: base, name: name, country: country === '—' ? '' : country, directory: directory });
    } else if (directory === 'services') {
      services.services.push({
        id: 'srv:' + base,
        company_name: name,
        country: country === '—' ? '' : country,
        state_province: '',
        city: city === '—' ? '' : city,
        website: site,
        service_types: [],
        description: description,
        verification_status: 'Unclaimed',
        verification_date: '—',
        profile_page: true
      });
      if (!city || city === '—') flag('services', name, country, 'city');
      extras.push({ slug: base, name: name, country: country === '—' ? '' : country, directory: directory });
    }
    recordDecision(name, 'separate', base, directory, 'Handoff 2026-10-31. Separate unclaimed listing. Official site checked 31 Oct 2026: ' + site);
    const tag = tagEntity(rec, name, eventsIn(row.event_history));
    if (!tag.ok) throw new Error('new listing has no citeable site ' + id);
  }
  usedSlugs.add(base);
  indexEntity(rec);
  added.push({ id: id, company: name, slug: base, directory: directory, country: country, city: city, website: site, events: eventsIn(row.event_history) });
});

dupeRows.forEach((row) => {
  const resolved = resolveDupe(row);
  const label = row.event + ':' + row.row + ' ' + displayName(row.company);
  if (resolved.status !== 'clear') {
    ambiguous.push({
      event: row.event,
      row: row.row,
      company: displayName(row.company),
      existing_tp_ref: displayName(row.existing_tp_ref),
      reason: resolved.reason
    });
    return;
  }
  const target = resolved.target;
  const source = httpUrl(target.website);
  if (!source) {
    ambiguous.push({
      event: row.event,
      row: row.row,
      company: displayName(row.company),
      existing_tp_ref: displayName(row.existing_tp_ref),
      reason: 'matched ' + target.directory + ':' + target.slug + ' but that entry has no official website to cite'
    });
    return;
  }
  if (APPLY) {
    const tag = tagEntity(target, target.name, resolved.events);
    if (!tag.ok) throw new Error('tag failed ' + label);
    recordDecision(displayName(row.company), 'tag', target.slug, target.directory, 'Handoff 2026-10-31. Tagged ' + target.name + ' for ' + resolved.events.join(', ') + '.');
  }
  tagged.push({
    event: row.event,
    row: row.row,
    company: displayName(row.company),
    slug: target.slug,
    directory: target.directory,
    profile: target.name,
    events: resolved.events,
    via: resolved.via
  });
});

if (missingCountries.length) {
  console.error(JSON.stringify(missingCountries, null, 2));
  throw new Error('manufacturer country group missing');
}

const freshPublic = JSON.stringify(added) + JSON.stringify(tagged) + JSON.stringify(ambiguous);
if (/do_not_contact|no_email/i.test(freshPublic)) throw new Error('outreach field leaked into the report');

if (APPLY) {
  laboratories.total_laboratories = laboratories.laboratories.length;
  writeJson('data/manufacturers.json', manufacturers);
  writeJson('data/accessories.json', accessories);
  writeJson('data/laboratories.json', laboratories);
  writeJson('data/services.json', services);
  writeJson('data/permanent-id-extras.json', extras);
  writeJson('data/event-batch-decisions.json', decisions);
  writeJson('data/directory-integrity.json', integrity);
  writeJson('data/event-badges.json', badges);
  writeJson('data/event-directory.json', directoryFile);
}

const byDirectory = added.reduce((acc, row) => { acc[row.directory] = (acc[row.directory] || 0) + 1; return acc; }, {});
const report = {
  new_rows: newRows.length,
  listings_added: added.length,
  added_by_directory: byDirectory,
  skipped: skipped,
  dupe_rows: dupeRows.length,
  tagged_rows: tagged.length,
  tagged_profiles: [...new Set(tagged.map((row) => row.directory + ':' + row.slug))].length,
  ambiguous: ambiguous,
  added: added,
  tagged: tagged
};
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/directory-handoff-2026-10-31.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  apply: APPLY,
  listings_added: report.listings_added,
  added_by_directory: byDirectory,
  skipped: skipped.length,
  tagged_rows: tagged.length,
  tagged_profiles: report.tagged_profiles,
  ambiguous: ambiguous.length
}, null, 2));
console.log('SKIPPED');
skipped.forEach((row) => console.log('- ' + row.id + ' ' + row.company + ' :: ' + row.reason + (row.matches ? ' :: ' + row.matches.join('; ') : '')));
console.log('AMBIGUOUS');
ambiguous.forEach((row) => console.log('- ' + row.event + ' ' + row.row + ' ' + row.company + ' :: ' + row.reason));
