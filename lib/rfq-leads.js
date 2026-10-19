/* Qualified RFQ leads. The buyer is not charged. A lead is billable when the
 * automatic rules pass: work email, consent, a calendar-date deadline, and a
 * rating or a voltage. Payment does not create that mark. The billable match
 * list is at most 5 and keeps the matcher's order. Buyer contact stays
 * hidden until the lead is one of the 4 included Supplier Pro leads or a
 * paid unlock.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPRfqLeads = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CONSENT_VERSION = 'rfq-consent-2026-10-15';
  var CONSENT_TEXT = 'I agree that TransformerPath may send my name, work email, company, and the technical fields in this RFQ to at most 5 matched suppliers so they can respond to this request. This disclosure is to those suppliers, not a processor relationship. I can withdraw consent, and further sends will stop.';
  var MATCH_CAP = 5;
  var INCLUDED_LEADS = 4;
  var DUPLICATE_DAYS = 90;
  var LEAD_CENTS = 24900;
  var LEAD_PRO_CENTS = 14900;
  var SUPPLIER_PRO_LAUNCH_CENTS = 149900;
  var SUPPLIER_PRO_RAISED_CENTS = 249900;

  var CATEGORIES = {
    'Power Transformer': true,
    'Distribution Transformer': true,
    'Dry-Type / Cast Resin': true,
    'Bushings': true,
    'Tap-Changers (OLTC/DETC)': true,
    'Insulation Materials': true,
    'Transformer Oil & Fluids': true,
    'Radiators / Cooling': true,
    'Monitoring & Protection': true,
    'Testing / Site Services': true,
    'Other Components': true
  };

  var FREE_WEBMAIL = {
    'gmail.com': true, 'googlemail.com': true, 'yahoo.com': true, 'ymail.com': true,
    'outlook.com': true, 'hotmail.com': true, 'live.com': true, 'msn.com': true,
    'aol.com': true, 'icloud.com': true, 'me.com': true, 'proton.me': true,
    'protonmail.com': true, 'gmx.com': true, 'gmx.net': true, 'yandex.com': true,
    'yandex.ru': true, 'mail.com': true, 'zoho.com': true
  };

  function mvaNumber(v) {
    var m = String(v || '').replace(/[^\d.]/g, '');
    return parseFloat(m) || 0;
  }
  function kvNumber(v) {
    var m = String(v || '').match(/(\d+(?:\.\d+)?)/);
    return parseFloat(m ? m[1] : 0) || 0;
  }

  function emailDomain(email) {
    var parts = String(email || '').toLowerCase().trim().split('@');
    return parts.length === 2 ? parts[1] : '';
  }

  function isWorkEmail(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) return false;
    return !FREE_WEBMAIL[emailDomain(email)];
  }

  function domainMatchesCompany(email, company) {
    var label = emailDomain(email).split('.')[0];
    var slug = String(company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!label || label.length < 3 || !slug) return false;
    return slug.indexOf(label) !== -1 || label.indexOf(slug) !== -1;
  }

  function isCalendarDate(value) {
    var m = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!m) return false;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }

  /* A bare year or a quarter is not billable. lib/deadline.js keeps a bare
   * year open through 31 December; that is still not a calendar date. */
  function deadlineOpen(value, now) {
    if (!isCalendarDate(value)) return false;
    var end = Date.parse(String(value) + 'T23:59:59.999Z');
    var t = now == null ? Date.now() : new Date(now).getTime();
    if (Number.isNaN(t)) return false;
    return end >= t;
  }

  function wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function asTime(value) {
    var t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  function isDuplicate(rfq, prior, now) {
    var email = String(rfq.email || '').toLowerCase().trim();
    var end = asTime(now || rfq.created_at || Date.now());
    return (prior || []).some(function (row) {
      if (!row || String(row.email || '').toLowerCase().trim() !== email) return false;
      if (String(row.category || '') !== String(rfq.category || '')) return false;
      if (String(row.rating || '') !== String(rfq.rating || '')) return false;
      if (String(row.voltage || '') !== String(rfq.voltage || '')) return false;
      var at = asTime(row.created_at);
      if (!at || !end) return false;
      return Math.abs(end - at) <= DUPLICATE_DAYS * 86400000;
    });
  }

  function qualify(rfq, now, prior) {
    var row = rfq || {};
    var reasons = [];
    if (!isWorkEmail(row.email)) reasons.push('work email required');
    else if (!domainMatchesCompany(row.email, row.company)) reasons.push('email domain must match the company');
    if (!String(row.company || '').trim()) reasons.push('company required');
    if (row.supplier_domain && emailDomain(row.email) === String(row.supplier_domain).toLowerCase()) {
      reasons.push('buyer cannot be the supplier being charged');
    }
    if (!CATEGORIES[row.category]) reasons.push('category must be one of the RFQ form options');
    if (wordCount(row.details) < 6 || String(row.details || '').trim().length < 40) reasons.push('details must describe a real requirement');
    if (!(mvaNumber(row.rating) > 0 || kvNumber(row.voltage) > 0)) reasons.push('a kV or MVA number is required');
    if (!isCalendarDate(row.deadline)) reasons.push('deadline must be a calendar date');
    else if (!deadlineOpen(row.deadline, now)) reasons.push('deadline is already past');
    if (row.consent !== true) reasons.push('consent required');
    if (row.consent_version !== CONSENT_VERSION) reasons.push('consent version required');
    if (!String(row.consent_at || '').trim()) reasons.push('consent timestamp required');
    if (row.qualified_by_payment === true) reasons.push('payment does not qualify a lead');
    if (isDuplicate(row, prior, now)) reasons.push('duplicate of a lead inside 90 days');
    return { qualified: reasons.length === 0, reasons: reasons };
  }

  function billableMatches(matches) {
    return (matches || []).slice(0, MATCH_CAP);
  }

  function publicSupplier(match) {
    var src = match || {};
    return {
      name: src.name || '',
      slug: src.slug || '',
      country: src.country || '',
      research_completeness: src.research_completeness || 0,
      reasons: (src.reasons || []).map(function (reason) {
        return String(reason).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[redacted]');
      })
    };
  }

  /* The offer is the matcher's order, capped at 5, and only after qualify.
   * The returned suppliers have no buyer contact. */
  function autoMatch(rfq, matches, now, prior) {
    var result = qualify(rfq, now, prior);
    return {
      qualified: result.qualified,
      reasons: result.reasons,
      offered: result.qualified ? billableMatches(matches).map(publicSupplier) : [],
      contact: 'Buyer name, email, and phone stay hidden.'
    };
  }

  function redact(rfq) {
    var src = rfq || {};
    var detail = String(src.details || src.detail || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[redacted]');
    return {
      category: src.category || '',
      rating: src.rating || '',
      voltage: src.voltage || '',
      country: src.country || '',
      deadline: isCalendarDate(src.deadline) ? src.deadline : '',
      detail: detail,
      contact: 'Buyer name, email, and phone stay hidden.'
    };
  }

  function contactVisible(delivery) {
    if (!delivery || delivery.withdrawn === true) return false;
    if (delivery.included === true) {
      var slot = Number(delivery.quota_slot);
      return slot >= 1 && slot <= INCLUDED_LEADS;
    }
    return delivery.paid === true && (delivery.product === 'rfq_lead' || delivery.product === 'rfq_lead_pro');
  }

  function presentLead(rfq, delivery) {
    var hidden = redact(rfq);
    if (!contactVisible(delivery)) return hidden;
    return {
      category: hidden.category,
      rating: hidden.rating,
      voltage: hidden.voltage,
      country: hidden.country,
      deadline: hidden.deadline,
      detail: hidden.detail,
      name: rfq.name || '',
      email: rfq.email || '',
      phone: rfq.phone || '',
      company: rfq.company || '',
      contact: 'Released for this RFQ only.'
    };
  }

  function includedRemaining(used) {
    var n = Math.max(0, Number(used) || 0);
    return Math.max(0, INCLUDED_LEADS - n);
  }

  function unlockFor(supplier, used) {
    var pro = supplier && supplier.supplier_pro === true;
    var count = Math.max(0, Number(used) || 0);
    if (pro && count < INCLUDED_LEADS) {
      return { included: true, quota_slot: count + 1, product: null, paid: false, amountCents: 0 };
    }
    if (pro) return { included: false, product: 'rfq_lead_pro', paid: false, amountCents: LEAD_PRO_CENTS };
    return { included: false, product: 'rfq_lead', paid: false, amountCents: LEAD_CENTS };
  }

  function supplierProPriceCents(deliveredQualified) {
    return Number(deliveredQualified) >= 1 ? SUPPLIER_PRO_RAISED_CENTS : SUPPLIER_PRO_LAUNCH_CENTS;
  }

  function rateLimitOk(history, email, now) {
    var at = now == null ? Date.now() : new Date(now).getTime();
    var domain = emailDomain(email);
    var want = String(email || '').toLowerCase().trim();
    var emailHits = 0;
    var domainHits = 0;
    (history || []).forEach(function (row) {
      var t = asTime(row && row.at);
      if (!t || at - t > 86400000 || at < t) return;
      var rowEmail = String(row.email || '').toLowerCase().trim();
      if (rowEmail === want) emailHits++;
      if (emailDomain(rowEmail) === domain) domainHits++;
    });
    if (emailHits >= 3) return false;
    if (domain && domainHits >= 10) return false;
    return true;
  }

  return {
    CONSENT_VERSION: CONSENT_VERSION,
    CONSENT_TEXT: CONSENT_TEXT,
    MATCH_CAP: MATCH_CAP,
    INCLUDED_LEADS: INCLUDED_LEADS,
    LEAD_CENTS: LEAD_CENTS,
    LEAD_PRO_CENTS: LEAD_PRO_CENTS,
    SUPPLIER_PRO_LAUNCH_CENTS: SUPPLIER_PRO_LAUNCH_CENTS,
    SUPPLIER_PRO_RAISED_CENTS: SUPPLIER_PRO_RAISED_CENTS,
    CATEGORIES: CATEGORIES,
    mvaNumber: mvaNumber,
    kvNumber: kvNumber,
    isCalendarDate: isCalendarDate,
    deadlineOpen: deadlineOpen,
    qualify: qualify,
    billableMatches: billableMatches,
    autoMatch: autoMatch,
    redact: redact,
    contactVisible: contactVisible,
    presentLead: presentLead,
    includedRemaining: includedRemaining,
    unlockFor: unlockFor,
    supplierProPriceCents: supplierProPriceCents,
    rateLimitOk: rateLimitOk
  };
});
