/* Public checkout gate. Pages link here. The Stripe Payment Link is added
 * only after a valid email, with prefilled_email and client_reference_id.
 * Payment Link URLs stay in lib/paid-listings.js. This file does not
 * contain them and does not change a price, product, or coupon.
 */
'use strict';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DISPLAY = {
  learning: { label: 'Learning', priceLabel: '$199 one-time payment · 12 months access' },
  engineering_pro: { label: 'Engineering Pro', priceLabel: '$599 one-time payment · 12 months access' },
  engineering_team: { label: 'Engineering Team', priceLabel: '$1,999 one-time payment · 12 months access' },
  verified_manufacturer: { label: 'Verified Manufacturer', priceLabel: '$499 one-time payment · covers 12 months' },
  featured_event: { label: 'Featured Event', priceLabel: '$299 per event' },
  featured_exhibitor: { label: 'Featured Exhibitor', priceLabel: '$399 per event' },
  featured_listing: { label: 'Featured Listing', priceLabel: '$299/yr plus tax' },
  featured_verified: { label: 'Featured + Verified', priceLabel: '$699/yr plus tax' },
  component_sponsor: { label: 'Component Sponsor', priceLabel: '$199/mo plus tax' },
  job_standard: { label: 'Post a job', priceLabel: '$199 / 30 days' },
  job_featured: { label: 'Feature a job', priceLabel: '$299 / 30 days' },
  job_bundle_5: { label: '5-post bundle', priceLabel: '$799' },
  rfq_lead: { label: 'Unlock one lead', priceLabel: '$249' },
  rfq_lead_pro: { label: 'Extra lead for Supplier Pro', priceLabel: '$149' },
  supplier_pro: { label: 'Supplier Pro', priceLabel: '$1,499 / year' },
  dga_report: { label: 'DGA PDF report', priceLabel: '$19 PDF report' },
  report_template: { label: 'Test report template', priceLabel: '$49 template' },
  template_bundle: { label: 'Template bundle', priceLabel: '$149 bundle' },
  commissioning_job_post: { label: 'Commissioning job post', priceLabel: 'Post a job, $199' },
  buyer_guide_us_eu: { label: 'US–EU buyer guide', priceLabel: '$19 buyer guide' }
};

function links() {
  return require('./paid-listings').PAYMENT_LINKS;
}

function codeOf(url) {
  const match = String(url || '').match(/buy\.stripe\.com\/([A-Za-z0-9]+)/);
  return match ? match[1] : '';
}

function productForCode(code) {
  const table = links();
  const keys = Object.keys(table);
  for (let i = 0; i < keys.length; i++) {
    if (codeOf(table[keys[i]].url) === code) return keys[i];
  }
  return '';
}

function cleanSlug(value) {
  const s = String(value || '').trim().toLowerCase();
  return SLUG_RE.test(s) ? s : '';
}

function gateQuery(opts) {
  opts = opts || {};
  const product = String(opts.product || '').trim();
  if (!product || !links()[product]) return '';
  const params = new URLSearchParams();
  params.set('product', product);
  const slug = cleanSlug(opts.slug);
  const eventId = cleanSlug(opts.event);
  const component = cleanSlug(opts.component);
  if (slug) params.set('slug', slug);
  if (eventId) params.set('event', eventId);
  if (component) params.set('component', component);
  return '/checkout/?' + params.toString();
}

function queryValue(raw, key) {
  const match = String(raw || '').match(new RegExp('[?&]' + key + '=([^&#]+)'));
  if (!match) return '';
  try { return decodeURIComponent(match[1].replace(/&amp;/g, '&')); }
  catch (e) { return match[1]; }
}

function parseStripeHref(href) {
  const raw = String(href || '').replace(/&amp;/g, '&');
  const product = productForCode(codeOf(raw));
  if (!product) return null;
  const ref = cleanSlug(queryValue(raw, 'client_reference_id'));
  const parsed = { product: product, slug: '', event: '', component: cleanSlug(queryValue(raw, 'component')) };
  if (ref && (product === 'featured_event' || product === 'featured_exhibitor')) parsed.event = ref;
  else if (ref) parsed.slug = ref;
  return parsed;
}

function paymentUrl(product, opts) {
  opts = opts || {};
  const spec = links()[product];
  if (!spec || !spec.url) return '';
  const params = [];
  const slug = cleanSlug(opts.slug);
  const eventId = cleanSlug(opts.event);
  const ref = slug || eventId;
  if (ref) params.push('client_reference_id=' + encodeURIComponent(ref));
  const email = String(opts.email || '').trim();
  if (email) params.push('prefilled_email=' + encodeURIComponent(email));
  if (spec.promoCode) params.push('prefilled_promo_code=' + encodeURIComponent(spec.promoCode));
  if (!params.length) return spec.url;
  const join = spec.url.indexOf('?') === -1 ? '?' : '&';
  return spec.url + join + params.join('&');
}

function publicPlans() {
  const table = links();
  const out = {};
  Object.keys(table).forEach(function (key) {
    const spec = table[key];
    const display = DISPLAY[key] || {};
    out[key] = {
      label: display.label || spec.label || spec.plan || key,
      priceLabel: display.priceLabel || spec.priceLabel || spec.label || '',
      amountCents: typeof spec.amountCents === 'number' ? spec.amountCents : null
    };
  });
  return out;
}

module.exports = {
  SLUG_RE: SLUG_RE,
  DISPLAY: DISPLAY,
  codeOf: codeOf,
  productForCode: productForCode,
  cleanSlug: cleanSlug,
  gateQuery: gateQuery,
  parseStripeHref: parseStripeHref,
  paymentUrl: paymentUrl,
  publicPlans: publicPlans
};
