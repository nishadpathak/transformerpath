/* Census lookup for the free claim form. The browser reads the JSON this builds.
 * Stripe prices are not created here.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const browser = require('../claim-listing');
const { directoryCompanySlug } = require('./company-aliases');

function normName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function buildClaimIndex(root) {
  root = root || path.join(__dirname, '..');
  const census = readJson(root, 'data/manufacturers.json');
  const slugRows = readJson(root, 'data/company-slugs.json');
  const map = Object.create(null);
  const nameBySlug = Object.create(null);
  slugRows.forEach(function (row) {
    if (!row || !row.name || !row.slug) return;
    map[normName(row.name)] = row.slug;
    if (!nameBySlug[row.slug]) nameBySlug[row.slug] = row.name;
  });
  const bySlug = {};
  census.forEach(function (country) {
    (country.makers || []).forEach(function (maker) {
      if (!maker || /^Served by/i.test(maker[0])) return;
      const slug = directoryCompanySlug(maker[0], map);
      if (!slug) return;
      const website = maker[2] || '';
      if (!bySlug[slug]) {
        bySlug[slug] = { name: nameBySlug[slug] || maker[0], website: website };
        return;
      }
      if (!bySlug[slug].website && website) bySlug[slug].website = website;
    });
  });
  Object.keys(nameBySlug).forEach(function (slug) {
    if (!bySlug[slug]) bySlug[slug] = { name: nameBySlug[slug], website: '' };
  });
  const ordered = {};
  Object.keys(bySlug).sort().forEach(function (slug) { ordered[slug] = bySlug[slug]; });
  return ordered;
}

/* Old hub files claimed the hub slug (power-transformers, sourced, specs).
 * Pages the generator still rewrites no longer do. A page left in place
 * because it fell under the maker gate still has that anchor, and the
 * link gate treats it as a missing listing. */
function stripStaleHubClaim(dir, slug, kept) {
  if (!dir || !slug || !fs.existsSync(dir)) return;
  const needle = ' <a class="btn btn-outline btn-sm claim-listing-link" href="/claim-listing/' + slug + '/" data-claim-listing="1">Claim this listing</a>';
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (!ent.isDirectory() || (kept && kept[ent.name])) return;
    const stale = path.join(dir, ent.name, 'index.html');
    if (!fs.existsSync(stale)) return;
    const html = fs.readFileSync(stale, 'utf8');
    if (html.indexOf(needle) < 0) return;
    fs.writeFileSync(stale, html.split(needle).join(''));
    console.log('stripped hub claim link', path.relative(path.join(__dirname, '..'), stale));
  });
}

module.exports = {
  CONFIRM: browser.CONFIRM,
  esc: browser.esc,
  siteHost: browser.siteHost,
  emailDomain: browser.emailDomain,
  domainsMatch: browser.domainsMatch,
  reviewFlag: browser.reviewFlag,
  href: browser.href,
  payHref: browser.payHref,
  linkHtml: browser.linkHtml,
  buildClaimIndex: buildClaimIndex,
  stripStaleHubClaim: stripStaleHubClaim
};
