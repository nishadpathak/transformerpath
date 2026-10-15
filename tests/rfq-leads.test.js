#!/usr/bin/env node
/* Qualified leads need consent, a calendar deadline, and a person's review.
 * The public file has no leads. Buyer contact stays redacted until a lead
 * is included in the 4 Supplier Pro credits or paid.
 */
'use strict';
const fs = require('fs');
const assert = require('assert');
const leads = require('../lib/rfq-leads');
const deadline = require('../lib/deadline');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok  ' + name);
  else {
    failed++;
    console.error('FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

function sample(over) {
  return Object.assign({
    name: 'Amina Rahman',
    email: 'amina@acmetransformers.com',
    phone: '+1-202-555-0100',
    company: 'Acme Transformers',
    category: 'Power Transformer',
    rating: '100 MVA',
    voltage: '132 kV',
    details: 'Supply one 100 MVA 132/33 kV power transformer to IEC 60076 for a substation extension.',
    deadline: '2026-12-31',
    country: 'Saudi Arabia',
    consent: true,
    consent_version: leads.CONSENT_VERSION,
    consent_at: '2026-10-15T08:00:00Z',
    qualified_by: 'reviewer',
    created_at: '2026-10-15T08:00:00Z'
  }, over || {});
}

var good = leads.qualify(sample(), '2026-10-15', []);
check('a consented calendar-date RFQ can be qualified', good.qualified === true, good.reasons.join('; '));
check('free webmail is not qualified', leads.qualify(sample({ email: 'amina@gmail.com' }), '2026-10-15').qualified === false);
check('a quarter is not a billable deadline', leads.qualify(sample({ deadline: 'Q2 2027' }), '2026-10-15').qualified === false);
check('a bare year is not a billable deadline', leads.qualify(sample({ deadline: '2027' }), '2026-10-15').qualified === false);
check('deadline.js still treats a bare year as open', deadline.classifyOpenDeadline('2027', '2026-10-15') === 'OPEN');
check('a past calendar date is not qualified', leads.qualify(sample({ deadline: '2026-01-02' }), '2026-10-15').qualified === false);
check('missing kV and MVA is not qualified', leads.qualify(sample({ rating: '', voltage: 'soon' }), '2026-10-15').qualified === false);
check('payment does not qualify a lead', leads.qualify(sample({ qualified_by: '', qualified_by_payment: true }), '2026-10-15').qualified === false);
check('consent text is the stored version', leads.CONSENT_TEXT.indexOf('at most 5') !== -1);

var prior = [sample()];
check('same buyer, category, rating, and voltage inside 90 days is one lead', leads.qualify(sample({ created_at: '2026-11-01T00:00:00Z' }), '2026-11-01', prior).qualified === false);

var matches = [1, 2, 3, 4, 5, 6].map(function (n) { return { slug: 's' + n, research_completeness: n }; });
var billed = leads.billableMatches(matches);
check('billable list keeps order and stops at 5', billed.length === 5 && billed[0].slug === 's1' && billed[4].slug === 's5');

var hidden = leads.redact(sample());
check('public card drops name, email, and phone', hidden.name == null && hidden.email == null && hidden.phone == null && JSON.stringify(hidden).indexOf('amina@') === -1 && JSON.stringify(hidden).indexOf('555') === -1);

var included = { included: true, quota_slot: 1, paid: false };
var unpaid = { included: false, paid: false, product: 'rfq_lead' };
var paid = { included: false, paid: true, product: 'rfq_lead' };
check('included lead reveals contact', leads.contactVisible(included) === true && leads.presentLead(sample(), included).email === 'amina@acmetransformers.com');
check('unpaid lead stays redacted', leads.contactVisible(unpaid) === false && leads.presentLead(sample(), unpaid).email == null);
check('paid unlock reveals contact', leads.contactVisible(paid) === true);
check('slot 5 is not an included credit', leads.contactVisible({ included: true, quota_slot: 5 }) === false);
check('four included leads then the pro price', leads.unlockFor({ supplier_pro: true }, 0).included === true && leads.unlockFor({ supplier_pro: true }, 3).quota_slot === 4 && leads.unlockFor({ supplier_pro: true }, 4).product === 'rfq_lead_pro' && leads.unlockFor({ supplier_pro: true }, 4).amountCents === 14900);
check('a supplier without Pro pays the full lead price', leads.unlockFor({ supplier_pro: false }, 0).product === 'rfq_lead' && leads.unlockFor({}, 0).amountCents === 24900);
check('launch Supplier Pro price holds until a lead is delivered', leads.supplierProPriceCents(0) === 149900 && leads.supplierProPriceCents(1) === 249900);
check('rate limit stops a fourth same-day email', leads.rateLimitOk([
  { email: 'amina@acmetransformers.com', at: '2026-10-15T01:00:00Z' },
  { email: 'amina@acmetransformers.com', at: '2026-10-15T02:00:00Z' },
  { email: 'amina@acmetransformers.com', at: '2026-10-15T03:00:00Z' }
], 'amina@acmetransformers.com', '2026-10-15T04:00:00Z') === false);

var pub = JSON.parse(fs.readFileSync('data/rfq-public.json', 'utf8'));
var inbox = JSON.parse(fs.readFileSync('data/supplier-inbox.json', 'utf8'));
check('public RFQ file has no cards or matches', pub.cards.length === 0 && pub.matches.length === 0);
check('inbox has delivered no leads', inbox.qualified_leads_delivered === 0 && inbox.suppliers.length === 0 && inbox.included_per_year === 4);
check('public files contain no email address', JSON.stringify(pub).indexOf('@') === -1 && JSON.stringify(inbox).indexOf('@') === -1);

var html = fs.readFileSync('rfq.html', 'utf8');
check('RFQ form asks for consent', html.indexOf('name="consent"') !== -1 && html.indexOf(leads.CONSENT_VERSION) !== -1);
check('RFQ deadline is a calendar date', html.indexOf('type="date"') !== -1 && html.indexOf('Q2 2027') === -1);
check('public RFQ copy stays redacted', html.indexOf('never shown publicly') !== -1);
check('RFQ page has no new buy button', html.indexOf('buy.stripe.com/00w3co') === -1 && html.indexOf('plink_1UQhNR') === -1);
check('RFQ pay mount stays empty in the HTML', html.indexOf('data-jobs-rfq-pay="rfq"') !== -1);

var privacy = fs.readFileSync('privacy.html', 'utf8');
check('privacy names the 5-supplier exception', privacy.indexOf('at most 5') !== -1 && privacy.indexOf('not a processor') !== -1);
var terms = fs.readFileSync('terms.html', 'utf8');
check('supplier terms forbid reselling the contact', terms.indexOf('must not resell') !== -1);

assert.strictEqual(failed, 0);
console.log('\nrfq leads: PASS');
