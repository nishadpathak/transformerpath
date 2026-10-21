/* Structured profile claims: a public value has a source and a status.
 * Empty fields render as an em dash. Elin stays an ordinary listing.
 * Run: node tests/profile-claims.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const claims = require('../lib/profile-claims');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  PASS  ' + label);
  else {
    failed++;
    console.error('  FAIL  ' + label + (detail ? '  -> ' + detail : ''));
  }
}

const built = claims.loadSources(fs, path, root);
const file = JSON.parse(fs.readFileSync(path.join(root, 'data/profile-claims-public.json'), 'utf8'));
check('public file matches the sourced projector', JSON.stringify(built) === JSON.stringify(file));
check('private outreach is not in the public file', !claims.containsPrivate(file));
check('at least one sourced company is published', file.companies.length > 10, String(file.companies.length));

const statuses = {};
file.companies.forEach(function (company) {
  check('company ' + company.slug + ' has a review date', /^\d{4}-\d{2}-\d{2}$/.test(company.last_reviewed || ''));
  (company.claims || []).forEach(function (claim) {
    statuses[claim.verification_status] = (statuses[claim.verification_status] || 0) + 1;
    check(company.slug + ' ' + claim.field + ' has a source', /^https?:\/\//.test(claim.source_url || ''));
    check(company.slug + ' ' + claim.field + ' is not unverified', claim.verification_status !== 'unverified');
    check(company.slug + ' ' + claim.field + ' has no price', !claims.money(claim.display));
    if (claims.elinListing(company.slug, company.name)) {
      check(company.slug + ' stays company-declared', claim.verification_status === 'company-declared');
    }
  });
});
check('the projector does not invent verified facts', !statuses.verified, JSON.stringify(statuses));
check('sourced pages are company-declared', statuses['company-declared'] > 0);

const hitachi = file.companies.filter(function (row) { return row.slug === 'hitachi-energy'; })[0];
check('Hitachi has a sourced voltage', hitachi && hitachi.claims.some(function (claim) {
  return claim.field === 'voltage_class' && claim.kv === 1000 && claim.verification_status === 'company-declared';
}));

const virginia = file.companies.filter(function (row) { return row.slug === 'virginia-transformer-corp'; })[0];
check('Virginia rated MVA is the unit rating', virginia && virginia.claims.some(function (claim) {
  return claim.field === 'rated_mva' && claim.mva_max === 1400;
}));

const emptyHtml = claims.renderCompany({ slug: 'example', claims: [] });
claims.FIELDS.forEach(function (field) {
  check('empty ' + field[0] + ' is an em dash', emptyHtml.indexOf('<th>' + field[1] + '</th><td>—</td>') !== -1);
});
check('empty last reviewed is an em dash', emptyHtml.indexOf('<th>Last reviewed</th><td>—</td>') !== -1);
check('empty render names both evidence labels', emptyHtml.indexOf('Verified fact') !== -1 && emptyHtml.indexOf('Company-declared') !== -1);

const filled = claims.renderCompany(hitachi);
check('Hitachi render links the source and the status', filled.indexOf('1000 kV') !== -1 && filled.indexOf('hitachienergy.com') !== -1 && filled.indexOf('Company-declared') !== -1);
check('a certification without a validity date shows an em dash', filled.indexOf('Validity —') !== -1 || filled.indexOf('<th>Certifications</th><td>—</td>') !== -1);
check('kVA stays empty when the source stated MVA', filled.indexOf('<th>Rated kVA</th><td>—</td>') !== -1);
check('render has no price and no outreach column', filled.indexOf('$') === -1 && !/do_not_contact/i.test(filled));
check('an Elin name cannot be labelled verified', claims.labelStatus('elin-insulation-fz-llc', 'Elin Insulation FZ LLC', 'verified') === 'company-declared');

const nav = fs.readFileSync(path.join(root, 'tp-nav.js'), 'utf8');
const dist = fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8');
check('company pages load the claims script', nav.indexOf('/lib/profile-claims.js') !== -1);
check('the claims script is published', dist.indexOf('lib/profile-claims.js') !== -1);

if (failed) {
  console.error('PROFILE CLAIMS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PROFILE CLAIMS OK companies=' + file.companies.length + ' declared=' + statuses['company-declared']);
