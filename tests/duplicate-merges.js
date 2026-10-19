#!/usr/bin/env node
/* Same-domain duplicate profiles redirect. Different-domain pairs stay. */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { resolveCompanyAlias } = require('../lib/company-aliases');
const parents = require('../lib/company-parents');

const root = path.join(__dirname, '..');
const doc = JSON.parse(fs.readFileSync(path.join(root, 'data/duplicate-merges.json'), 'utf8'));
const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');

doc.merges.forEach(function (merge) {
  assert(merge.from && merge.to && merge.shared_site, merge.from + ' records a shared site');
  const from = '/manufacturers/' + merge.from + '/';
  const to = '/manufacturers/' + merge.to + '/';
  assert(toml.indexOf('from = "' + from + '"') !== -1, '301 from ' + from);
  assert(toml.indexOf('to = "' + to + '"') !== -1, '301 to ' + to);
  const html = fs.readFileSync(path.join(root, 'manufacturers', merge.from, 'index.html'), 'utf8');
  assert(/http-equiv="refresh"/i.test(html), merge.from + ' is a redirect page');
  assert(html.indexOf(to) !== -1, merge.from + ' refreshes to ' + to);
  assert(!/Claim this profile/i.test(html), merge.from + ' is no longer a full profile');
});

doc.not_merged.forEach(function (item) {
  item.slugs.forEach(function (slug) {
    const html = fs.readFileSync(path.join(root, 'manufacturers', slug, 'index.html'), 'utf8');
    assert(/Claim this profile/i.test(html), slug + ' stays a full profile');
  });
});

assert.strictEqual(resolveCompanyAlias('Elsewedy Electric').slug, 'elsewedy-electric-transformers');
assert.strictEqual(resolveCompanyAlias('Elsewedy Electric Algeria').aliased, false);
assert.strictEqual(resolveCompanyAlias('Hitachi Energy India').aliased, false);
assert.strictEqual(resolveCompanyAlias('Hitachi Energy (global HQ)').slug, 'hitachi-energy');
assert.strictEqual(resolveCompanyAlias('Daihen Electric').aliased, false);
assert.strictEqual(resolveCompanyAlias('Voltamp Transformers').aliased, false);

const prolec = parents.parentFor({ slug: 'prolec-ge' });
assert.strictEqual(prolec.parent_slug, 'ge-vernova');
assert(/^https:\/\//.test(prolec.source_url));
const india = parents.parentFor({ slug: 'hitachi-energy-india' });
assert.strictEqual(india.parent_slug, 'hitachi-energy');
assert.strictEqual(parents.parentFor({ slug: 'hitachi-energy' }), null);
assert.strictEqual(parents.parentFor({ slug: 'daihen-electric' }), null);

const prolecHtml = fs.readFileSync(path.join(root, 'manufacturers/prolec-ge/index.html'), 'utf8');
assert(prolecHtml.indexOf('"parentOrganization"') !== -1);
assert(prolecHtml.indexOf(prolec.source_url) !== -1);
const indiaHtml = fs.readFileSync(path.join(root, 'manufacturers/hitachi-energy-india/index.html'), 'utf8');
assert(indiaHtml.indexOf('"parentOrganization"') !== -1);

console.log('duplicate-merges: ok');
