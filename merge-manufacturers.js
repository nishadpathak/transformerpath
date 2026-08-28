const fs = require('fs');

// Merge new verified transformer manufacturers into data/manufacturers.json.
// Each group is { country, region, flag, makers: [ [name, city, url, types], ... ] }.
// Only appends to EXISTING country groups (never creates a group with 0 makers),
// dedupes by normalized name, and preserves the "served by" import-only notes.

const DB = 'data/manufacturers.json';
const data = JSON.parse(fs.readFileSync(DB, 'utf8'));

// Normalize for dedupe: lowercase, strip non-alnum, strip parenthetical qualifiers.
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// Load new entries from a JSON file: [{name,country,city,website,types:[...],note,source}]
const input = process.argv[2];
if (!input) { console.error('usage: node merge-manufacturers.js <new.json>'); process.exit(1); }
const newEntries = JSON.parse(fs.readFileSync(input, 'utf8'));

// Map of entry country -> group object.
const byCountry = {};
data.forEach(g => { byCountry[g.country.trim()] = g; });

// Country-name aliases so research teams' labels resolve to the DB group's name.
const ALIAS = {
  'united arab emirates': 'UAE', 'uae': 'UAE', 'emirates': 'UAE',
  'saudi arabia': 'Saudi Arabia',
  'oman': 'Oman', 'qatar': 'Qatar', 'bahrain': 'Bahrain', 'kuwait': 'Kuwait',
  'south korea': 'South Korea', 'korea': 'South Korea',
  'united kingdom': 'United Kingdom', 'uk': 'United Kingdom',
  'usa': 'United States', 'united states': 'United States',
  'türkiye': 'Turkey', 'turkey': 'Turkey',
};

function resolveGroup(countryRaw) {
  const c = String(countryRaw || '').trim();
  const key = ALIAS[c] || c;
  if (byCountry.hasOwnProperty(key)) return byCountry[key];
  // case-insensitive match
  const k = norm(key);
  for (const g of data) if (norm(g.country) === k) return g;
  return null;
}

let added = 0, skippedDup = 0, skippedNoGroup = 0, skippedMissing = 0;
newEntries.forEach(e => {
  if (!e || !e.name || !e.name.trim()) { skippedMissing++; return; }
  const g = resolveGroup(e.country);
  if (!g) { console.log('NO GROUP for "' + e.country + '" (' + e.name + ') — skipped'); skippedNoGroup++; return; }
  const key = norm(e.name);
  const dup = g.makers.some(m => norm(m[0]) === key);
  if (dup) { skippedDup++; return; }
  const city = (e.city || '').trim();
  const url = (e.website || '').trim();
  const types = (e.types && e.types.length ? e.types : ['DT']).slice(0, 3).join(',');
  // Match existing schema exactly: [name, city, url, types].
  const tuple = [e.name.trim(), city, url, types];
  g.makers.push(tuple);
  added++;
});

fs.writeFileSync(DB, JSON.stringify(data, null, 2) + '\n');
printSummary(data, { added, skippedDup, skippedNoGroup, skippedMissing });

function printSummary(data, s) {
  const total = data.reduce((a, g) => a + (g.makers ? g.makers.length : 0), 0);
  const countries = data.length;
  console.log(`merged: added=${s.added} dupSkipped=${s.skippedDup} noGroup=${s.skippedNoGroup} missing=${s.skippedMissing}`);
  console.log(`db now: ${total} makers / ${countries} country groups / ${data.filter(g=>g.makers.some(m=>!/^served by/i.test(m[0]))).length} manufacturing countries`);
}
