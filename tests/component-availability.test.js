/* Component availability: no stock guarantee, flag off, empty public list.
 * Run: node tests/component-availability.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const flags = require('../lib/feature-flags');
const listings = require('../lib/component-availability');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  PASS  ' + label);
  else {
    failed++;
    console.error('  FAIL  ' + label + (detail ? '  -> ' + detail : ''));
  }
}

const saved = process.env.TP_COMPONENT_AVAILABILITY;
delete process.env.TP_COMPONENT_AVAILABILITY;
const file = JSON.parse(fs.readFileSync(path.join(root, 'data/feature-flags.json'), 'utf8'));
const doc = JSON.parse(fs.readFileSync(path.join(root, 'data/component-availability.json'), 'utf8'));
check('committed availability flag is off', file.component_availability === false);
check('unset env follows the file', flags.componentAvailabilityEnabled() === false);
process.env.TP_COMPONENT_AVAILABILITY = '1';
check('env 1 turns the flag on', flags.componentAvailabilityEnabled() === true);
process.env.TP_COMPONENT_AVAILABILITY = 'off';
check('env off forces the flag off', flags.componentAvailabilityEnabled() === false);
if (saved == null) delete process.env.TP_COMPONENT_AVAILABILITY;
else process.env.TP_COMPONENT_AVAILABILITY = saved;

check('public list is empty', doc.listings.length === 0 && listings.publicRows(doc).length === 0);
check('negation is allowed', listings.guaranteesStock('This is not a stock guarantee.') === false);
check('in stock is rejected', listings.guaranteesStock('12 units in stock') === true);
check('guaranteed is rejected', listings.guaranteesStock('guaranteed dispatch') === true);
check('stated copy does not promise stock', listings.availabilityCopy('stated').indexOf('not a stock guarantee') !== -1 && listings.availabilityCopy('stated').indexOf('in stock') === -1);
check('unspecified availability is an em dash', listings.availabilityCopy('unspecified') === '—');

const good = {
  company_slug: 'hitachi-energy',
  category: 'Bushings',
  specs: '72 kV condenser',
  availability: 'stated',
  quantity: 4,
  unit: 'piece',
  dispatch_country: 'Sweden',
  earliest_shipment: '2026-11-01',
  moq: 1,
  verification_status: 'company-declared',
  last_confirmed: '2026-10-20',
  source_url: 'https://example.com/bushings'
};
const verified = Object.assign({}, good, { verification_status: 'verified', company_slug: 'siemens-energy' });
const elin = Object.assign({}, good, { company_slug: 'elin-insulation-fz-llc', verification_status: 'verified' });
const unsourced = Object.assign({}, good, { source_url: '' });
check('a sourced company declaration is public', listings.problems(good).length === 0, listings.problems(good).join(','));
check('an explicit verified row can be public', listings.problems(verified).length === 0);
check('an Elin verified row is refused', listings.problems(elin).indexOf('elin verified') !== -1);
check('a row without a source is refused', listings.problems(unsourced).indexOf('source_url') !== -1);
check('stock wording is refused', listings.problems(Object.assign({}, good, { specs: 'in stock now' })).length > 0);

const rows = [good, verified, unsourced];
check('verified filter hides the declaration', listings.filterListings(rows, { verification_status: 'verified' }).length === 1);
check('spec filter matches the bushing', listings.filterListings(rows, { spec: '72 kV' }).length === 2);
check('dispatch filter matches Sweden', listings.filterListings(rows, { dispatch_country: 'Sweden', verification_status: 'company-declared' })[0].company_slug === 'hitachi-energy');
const html = listings.renderListing(good);
check('card shows the declaration and the source', html.indexOf('Company-declared') !== -1 && html.indexOf('https://example.com/bushings') !== -1);
check('card does not guarantee stock', html.indexOf('in stock') === -1 && html.indexOf('not a stock guarantee') !== -1);
check('card has no price', html.indexOf('$') === -1);

const components = fs.readFileSync(path.join(root, 'components.html'), 'utf8');
const sectionStart = components.indexOf('id="component-availability"');
const section = sectionStart < 0 ? '' : components.slice(sectionStart, components.indexOf('</section>', sectionStart));
check('component directory has an availability section', sectionStart !== -1);
const componentBuild = fs.readFileSync(path.join(root, 'build-components.js'), 'utf8');
check('component rebuild keeps the availability section', componentBuild.indexOf('id="component-availability"') !== -1 && componentBuild.indexOf('not a stock guarantee') !== -1 && componentBuild.indexOf('/lib/component-availability.js') !== -1);
check('availability section is coming soon and does not guarantee stock', /coming soon/i.test(section) && section.indexOf('not a stock guarantee') !== -1 && section.indexOf('in stock') === -1 && section.indexOf('guaranteed') === -1 && section.indexOf('$') === -1);
check('component directory uses the brand mailbox', components.indexOf('hello@transformerpath.com') !== -1 && !/do_not_contact/i.test(section));
const availabilityPage = fs.readFileSync(path.join(root, 'component-availability.html'), 'utf8');
check('availability page says coming soon', /coming soon/i.test(availabilityPage));
check('availability page does not guarantee stock', availabilityPage.indexOf('not a stock guarantee') !== -1 && availabilityPage.indexOf('in stock') === -1 && availabilityPage.indexOf('guaranteed') === -1);
check('availability page has no price and no outreach column', availabilityPage.indexOf('$') === -1 && !/do_not_contact/i.test(availabilityPage));
check('availability page uses the brand mailbox', availabilityPage.indexOf('hello@transformerpath.com') !== -1);
const form = fs.readFileSync(path.join(root, 'component-availability.html'), 'utf8');
check('supplier form is hidden until the flag is on', /id="component-listing-form"[^>]*hidden/.test(form));
check('buyer filters exist for the flagged board', form.indexOf('id="availability-evidence"') !== -1 && form.indexOf('Verified facts only') !== -1 && form.indexOf('Company-declared only') !== -1);

if (failed) {
  console.error('COMPONENT AVAILABILITY FAILED (' + failed + ')');
  process.exit(1);
}
console.log('COMPONENT AVAILABILITY OK');
