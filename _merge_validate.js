const fs = require('fs');
const path = require('path');

const files = [
  '_region_usa_tx.json',
  '_region_usa_re.json',
  '_region_canada.json',
  '_region_mexico.json',
  '_region_colperu.json',
  '_region_chilearg.json',
  '_region_brazil.json',
  'americas_transformer_projects_working.json',
];

const STATUSES = ['planned', 'tendering', 'awarded', 'construction', 'energized'];
const TR = ['CONFIRMED', 'INFERRED', 'UNKNOWN'];
const COUNTRIES = ['USA', 'Canada', 'Mexico', 'Brazil', 'Chile', 'Argentina', 'Colombia', 'Peru'];

let all = [];
for (const f of files) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) { console.error('MISSING FILE: ' + f); process.exit(1); }
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(arr)) { console.error('NOT ARRAY: ' + f); process.exit(1); }
  all = all.concat(arr);
}

// ---- validation ----
const errors = [];
all.forEach((proj, i) => {
  if (!proj.project || typeof proj.project !== 'string') errors.push(`[${i}] missing project name`);
  if (!proj.country || !COUNTRIES.includes(proj.country)) errors.push(`[${i}] bad country: ${proj.country}`);
  if (!STATUSES.includes(proj.status)) errors.push(`[${i}] bad status: ${proj.status}`);
  if (!TR.includes(proj.transformer_requirement)) errors.push(`[${i}] bad transformer_requirement: ${proj.transformer_requirement}`);
  if (!Array.isArray(proj.sources) || proj.sources.length === 0) errors.push(`[${i}] no sources`);
  if (!proj.src_label || typeof proj.src_label !== 'string') errors.push(`[${i}] missing src_label`);
  for (const k of ['utility', 'epc', 'voltage', 'manufacturer', 'expected']) {
    if (proj[k] !== undefined && proj[k] !== null && typeof proj[k] !== 'string') errors.push(`[${i}] bad ${k}`);
  }
  for (const s of proj.sources) {
    if (typeof s !== 'string' || !s.startsWith('http')) errors.push(`[${i}] bad source url: ${s}`);
  }
});

// ---- dedupe ----
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const seen = new Map();
const deduped = [];
for (const proj of all) {
  const key = norm(proj.project);
  if (seen.has(key)) {
    console.log(`DUP dropped: "${proj.project}" (kept "${seen.get(key)}")`);
  } else {
    seen.set(key, proj.project);
    deduped.push(proj);
  }
}

// ---- stats ----
const byCountry = {};
const byStatus = {};
for (const p of deduped) {
  byCountry[p.country] = (byCountry[p.country] || 0) + 1;
  byStatus[p.status] = (byStatus[p.status] || 0) + 1;
}

console.log('VALIDATION ERRORS: ' + errors.length);
errors.slice(0, 30).forEach(e => console.log('  ' + e));
console.log('TOTAL raw: ' + all.length + ' | AFTER DEDUPE: ' + deduped.length);
console.log('BY COUNTRY: ' + JSON.stringify(byCountry));
console.log('BY STATUS: ' + JSON.stringify(byStatus));

fs.writeFileSync(path.join(__dirname, 'americas_transformer_projects_final.json'), JSON.stringify(deduped, null, 2), 'utf8');
console.log('WROTE americas_transformer_projects_final.json');
