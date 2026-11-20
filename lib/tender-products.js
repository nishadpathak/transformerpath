/* Product landing pages for official procurement notices.
 *
 * A page exists only when at least one notice on an allowlisted portal
 * matches that product. The match is the explicit product field, or a
 * clear equipment phrase in the title or summary. A building renovation
 * or a software "transformation" is not a product page.
 */
'use strict';

const { isOfficialProcurementUrl } = require('./tender-sources');

const CATALOG = [
  {
    slug: 'testing-equipment',
    label: 'Testing equipment',
    title: 'Transformer testing equipment tenders',
    intro: 'These notices buy a test bench, a test kit, or an analyser for transformers or instrument transformers. The official portal names the equipment. A past deadline stays listed and is marked expired.'
  },
  {
    slug: 'reactors',
    label: 'Reactors',
    title: 'Reactor and earth-fault coil tenders',
    intro: 'These notices name a reactor, a Petersen coil, or an earth-fault suppression coil. TransformerPath does not treat a reactor rating as a power transformer. Each row links to the public notice that states the deadline.'
  },
  {
    slug: 'distribution-transformer',
    label: 'Distribution transformer',
    title: 'Distribution transformer tenders',
    intro: 'These notices name a distribution transformer, a compact station, or a transformer with a kVA rating. The buyer and the deadline are the ones printed on the official notice. Expired deadlines stay visible and are marked.'
  },
  {
    slug: 'power-transformer',
    label: 'Power transformer',
    title: 'Power transformer tenders',
    intro: 'These notices name a power transformer, a large power transformer, a regulating transformer, a power block transformer, or a transformer with an MVA rating. The list is limited to public procurement portals. A passed deadline is marked expired.'
  },
  {
    slug: 'switchgear',
    label: 'Switchgear',
    title: 'Switchgear tenders',
    intro: 'These notices name switchgear or a switchgear assembly for a substation or a distribution network. Where the same notice also describes a transformer, the switchgear wording is the product filed here. The deadline is the one on the official notice.'
  },
  {
    slug: 'cables',
    label: 'Cables',
    title: 'Power cable tenders',
    intro: 'These notices name a power cable, an underground cable, an HV cable, or a cable system. Incidental cabling inside a switchgear install is not filed here. Each row keeps the buyer, the deadline date, and the public notice link.'
  },
  {
    slug: 'substation-gis',
    label: 'Substation / GIS',
    title: 'Substation and GIS tenders',
    intro: 'These notices name a substation, a switchyard, or GIS works. The page lists the buyer country and the deadline from the official record. Notices whose deadline has passed stay on the page and are marked expired.'
  }
];

function bySlug(slug) {
  const key = String(slug || '').trim();
  for (let i = 0; i < CATALOG.length; i++) {
    if (CATALOG[i].slug === key) return CATALOG[i];
  }
  return null;
}

function textOf(tender) {
  /* Title and the curator summary only. A long intel snippet can mention
   * cable or substation in passing and must not create a product page. */
  return [tender && tender.title, tender && tender.full_title, tender && tender.summary]
    .filter(Boolean)
    .join(' ');
}

function matches(slug, tender, text) {
  if (slug === 'testing-equipment') {
    return tender.category === 'testing_equipment' || /test bench|test kit|transformer analy[sz]er|ct analy[sz]er/i.test(text);
  }
  if (slug === 'reactors') {
    return /reactor|earth-fault suppression|petersen coil|arc-suppression|erdschluss/i.test(text);
  }
  if (slug === 'distribution-transformer') {
    return /distribution transformers?|compact stations?/i.test(text) || (/\b\d+\s*kva\b/i.test(text) && /transformer/i.test(text));
  }
  if (slug === 'power-transformer') {
    return /power transformers?|power block transformers?|large power transformers?|regulating transformers?/i.test(text) ||
      (/\b\d+\s*mva\b/i.test(text) && /transformer/i.test(text));
  }
  if (slug === 'switchgear') return /switchgear|schaltanlage/i.test(text);
  if (slug === 'cables') return /power cables?|underground cables?|hv cables?|cable systems?/i.test(text);
  if (slug === 'substation-gis') return /substation|switchyard|umspannwerk|rozvodna/i.test(text) || /\bgis\b/i.test(text);
  return false;
}

function productOf(tender) {
  if (!tender) return null;
  const explicit = bySlug(tender.product);
  if (explicit) return explicit;
  const text = textOf(tender);
  if (/\bdigital transformation\b/i.test(text)) return null;
  for (let i = 0; i < CATALOG.length; i++) {
    if (matches(CATALOG[i].slug, tender, text)) return CATALOG[i];
  }
  return null;
}

function groupOfficial(tenders) {
  const groups = {};
  (tenders || []).forEach(function (tender) {
    if (!tender || !isOfficialProcurementUrl(tender.official_procurement_url)) return;
    const product = productOf(tender);
    if (!product) return;
    if (!groups[product.slug]) groups[product.slug] = { product: product, tenders: [] };
    groups[product.slug].tenders.push(tender);
  });
  return groups;
}

module.exports = {
  CATALOG: CATALOG,
  bySlug: bySlug,
  productOf: productOf,
  groupOfficial: groupOfficial
};
