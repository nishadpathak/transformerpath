#!/usr/bin/env node
/* build-commerce.js — central commercial catalog (runtime config).
 *
 * Produces data/commerce.json, a single canonical commercial catalog that the
 * /pricing page and all commercial CTA surfaces read to render prices, offers,
 * CTAs and neutrality statements. It is DERIVED from data/config.json (the
 * approved price/config source of truth) and data/products.json (the product +
 * feature matrix), so there is ONE place to change a price and rebuild.
 *
 * Commercial neutrality (non-negotiable): every paid product carries an explicit
 * neutrality statement. Verified = identity/contact verification, not technical
 * approval. FEATURED / SPONSORED = labelled promotional placement. RFQ matching
 * is technical-only and never affected by commercial status. This file does not
 * change any research, technical-matching or editorial logic.
 *
 * Run: node build-commerce.js  (after config/products are final).
 */
'use strict';
const fs = require('fs');
function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

const CFG = readJson('data/config.json', {});
const PROD = readJson('data/products.json', {});
const paid = require('./lib/paid-listings');
const P = CFG.pricing || {};

function money(v) { return (v == null || v === 0) ? null : v; }

const FEATURES = Array.isArray(PROD.feature_delivery) ? PROD.feature_delivery.map(function (f) {
  return {
    id: f.id,
    label: f.label,
    delivery: f.delivery,
    products: f.products || []
  };
}) : [];

function productFeatures(id) {
  return FEATURES.filter(function (f) { return f.products.indexOf(id) >= 0; }).map(function (f) {
    return { id: f.id, label: f.label, delivery: f.delivery };
  });
}

const commerce = {
  $schema: 'https://transformerpath.com/commerce.schema.json',
  generated: new Date().toISOString(),
  currency: P.currency || 'USD',
  neutral_principle: 'Payment never influences research quality, technical capability, factory classification, project/award relationships, organic technical matching, Intel conclusions or source confidence. A free Listed manufacturer may be technically more relevant than a paying Supplier Pro.',
  features: FEATURES,
  sections: [
    {
      id: 'engineers', label: 'For Engineers',
      products: [
        { id: 'free', name: 'Free', price: 0, cadence: null, cta: 'Start free', outcome: (PROD.consumers && PROD.consumers.free ? PROD.consumers.free.outcome : 'Read daily intel, browse the directory, post an RFQ, use selected tools.'), features: productFeatures('free') },
        { id: 'learning', name: 'Learning', price: money(P.plans.Learning && P.plans.Learning.price), cadence: '12 months', cta: 'Unlock Learning', payment_link: paid.PAYMENT_LINKS.learning.url, outcome: (PROD.consumers && PROD.consumers.learning ? PROD.consumers.learning.outcome : 'Full structured learning, practice, progress, 3D learning, Test Bay, capstones.'), single_payment: true, auto_renew: false, billing: 'single payment for 12 months access', features: productFeatures('learning') },
        { id: 'professional', name: (PROD.consumers && PROD.consumers.professional && PROD.consumers.professional.name) || 'Engineering Pro', price: money(P.plans.Professional && P.plans.Professional.price), cadence: '12 months', cta: 'Unlock Engineering Pro', payment_link: paid.PAYMENT_LINKS.engineering_pro.url, outcome: (PROD.consumers && PROD.consumers.professional ? PROD.consumers.professional.outcome : 'Learning plus the professional workspace: costing, specification builder, bid evaluation, DGA.'), single_payment: true, auto_renew: false, billing: 'single payment for 12 months access', features: productFeatures('professional') },
        { id: 'team', name: (PROD.consumers && PROD.consumers.team && PROD.consumers.team.name) || 'Engineering Team', price: money(P.plans.Team && P.plans.Team.price), cadence: '12 months', cta: 'Unlock Engineering Team', payment_link: paid.PAYMENT_LINKS.engineering_team.url, outcome: (PROD.consumers && PROD.consumers.team ? PROD.consumers.team.outcome : 'Up to 10 seats with organization management, members, progress and a shared workspace.'), single_payment: true, auto_renew: false, billing: 'single payment for 12 months access', features: productFeatures('team') },
      ]
    },
    {
      id: 'manufacturers', label: 'For Manufacturers',
      products: [
        { id: 'listed', name: 'Listed', price: 0, cadence: null, cta: 'Claim your company', outcome: (PROD.b2b_supplier && PROD.b2b_supplier.listed ? PROD.b2b_supplier.listed.outcome : 'A factual public listing.'), neutrality: 'No endorsement. Listed is a census listing, not a recommendation.', features: productFeatures('listed') },
        { id: 'verified', name: 'Verified Manufacturer', price: money(P.verifiedSupplier && P.verifiedSupplier.price), cadence: '12 months', cta: 'Get Verified', outcome: (PROD.b2b_supplier && PROD.b2b_supplier.verified ? PROD.b2b_supplier.verified.outcome : 'Verified company contact and profile after review. Logo, catalogue PDF link and photo gallery are included at no extra charge. RFQ routing is coming soon.'), neutrality: (PROD.b2b_supplier && PROD.b2b_supplier.verified ? PROD.b2b_supplier.verified.meaning : 'Verification is identity/contact verification, not technical approval.'), features: productFeatures('verified') },
        { id: 'supplier_pro', name: 'Supplier Pro', price: money(P.proVerifiedSupplier && P.proVerifiedSupplier.price), cadence: '12 months', cta: 'Become Supplier Pro', outcome: (PROD.b2b_supplier && PROD.b2b_supplier.supplier_pro ? PROD.b2b_supplier.supplier_pro.outcome : 'Everything in Verified plus advanced analytics, RFQ workflow, market watchlists, Intel Pro, monthly report, promotional inventory.'), neutrality: 'Promotional placement is explicitly FEATURED or SPONSORED. Pro never buys organic technical ranking.', features: productFeatures('supplier_pro') },
      ]
    },
    {
      id: 'intelligence', label: 'For Market Intelligence',
      products: [
        { id: 'intel_free', name: 'Intel Free', price: 0, cadence: null, cta: 'Create a free account', outcome: 'Daily intel, factual summaries, projects, tenders, basic company activity, limited follows and alerts.', features: productFeatures('intel_free') },
        { id: 'intel_pro', name: 'Intel Pro', price: money(P.intelPro && P.intelPro.priceYear), price_monthly: money(P.intelPro && P.intelPro.priceMonthly), cadence: '12 months', cta: 'Unlock Intel Pro', outcome: (PROD.b2b_intel && PROD.b2b_intel.intel_pro ? PROD.b2b_intel.intel_pro.outcome : 'Advanced project/tender filters, award history, company timelines, watchlists, saved searches, alerts, dashboards, exports.'), neutrality: 'Intel Pro adds monitoring/filtering/decision value — it never paywalls the factual headline. Factual Intel stays public.', price_status: (P.intelPro && P.intelPro.status), features: productFeatures('intel_pro') },
        { id: 'intel_team', name: 'Intel Team', price: money(P.intelTeam && P.intelTeam.priceYear), price_monthly: money(P.intelTeam && P.intelTeam.priceMonthly), cadence: '12 months', cta: 'Explore Intel Team', outcome: (PROD.b2b_intel && PROD.b2b_intel.intel_team ? PROD.b2b_intel.intel_team.outcome : 'Organization, members, shared watchlists, shared saved searches, team alerts, exports, shared reports.'), price_status: (P.intelTeam && P.intelTeam.status), features: productFeatures('intel_team') },
        { id: 'enterprise', name: 'Enterprise Intelligence', price: null, cadence: 'custom', cta: (PROD.b2b_intel && PROD.b2b_intel.enterprise && PROD.b2b_intel.enterprise.cta) || 'No checkout yet', outcome: (PROD.b2b_intel && PROD.b2b_intel.enterprise ? PROD.b2b_intel.enterprise.outcome : 'Multi-user access. There is no checkout and no custom research service.'), features: productFeatures('enterprise') },
      ]
    },
    {
      id: 'events', label: 'For Events & Marketing',
      products: [
        { id: 'featured_event', name: 'Featured Event', price: money(P.featuredEvent && P.featuredEvent.price), cadence: 'per event', cta: 'Feature your event', outcome: (PROD.b2b_media && PROD.b2b_media.featured_event ? PROD.b2b_media.featured_event.outcome : 'Prominent, clearly-labelled placement, logo/banner, enhanced event page, registration CTA.'), neutrality: 'FEATURED is promotional placement, clearly labelled. It is not an editorial recommendation.', features: productFeatures('featured_event') },
        { id: 'featured_exhibitor', name: 'Featured Exhibitor', price: money(P.featuredEventExhibitor && P.featuredEventExhibitor.price), cadence: 'per event', cta: 'Feature your exhibitor', payment_link: paid.FEATURED_EXHIBITOR_PAYMENT_LINK, outcome: (PROD.b2b_media && PROD.b2b_media.featured_exhibitor ? PROD.b2b_media.featured_exhibitor.outcome : 'FEATURED label, logo, booth number, products, brochure, manufacturer profile.'), neutrality: 'FEATURED is promotional placement. It never implies an editorial recommendation.', features: productFeatures('featured_exhibitor') },
        { id: 'sponsorship', name: 'Sponsorship', price: money(P.sponsorshipFrom), cadence: 'engagement', cta: 'Sponsor TransformerPath', outcome: (PROD.b2b_media && PROD.b2b_media.sponsorship ? PROD.b2b_media.sponsorship.outcome : 'Daily Intel sponsor, event spotlight, category/market sponsor, newsletter sponsor.'), neutrality: 'Every paid placement is visibly SPONSORED or FEATURED. We never sell editorial conclusions.', features: productFeatures('sponsorship') },
      ]
    },
  ],
};
fs.writeFileSync('data/commerce.json', JSON.stringify(commerce, null, 2));
console.log('commerce.json wrote: ' + commerce.sections.length + ' sections (' + commerce.sections.map(function (s) { return s.id + ':' + s.products.length; }).join(', ') + ')');
