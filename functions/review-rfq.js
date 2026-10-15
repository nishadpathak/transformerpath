/* POST an RFQ. Qualification is the automatic rule set. The response is the
 * decision and the cap of 5. It does not echo the buyer name, email, or phone,
 * and it does not release a contact.
 */
'use strict';
const leads = require('../lib/rfq-leads');

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  };
}

function readBody(event) {
  const raw = event && event.body ? event.body : '';
  const text = event && event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
  if (!text) return {};
  try { return JSON.parse(text); }
  catch (e) { return null; }
}

function scrub(payload, body) {
  let raw = JSON.stringify(payload);
  [body && body.email, body && body.name, body && body.phone].forEach(function (secret) {
    const value = String(secret || '').trim();
    if (value) raw = raw.split(value).join('[redacted]');
  });
  return raw;
}

exports.handler = async function (event) {
  if (!event || event.httpMethod !== 'POST') return json(405, { qualified: false, reasons: ['POST required'] });
  const body = readBody(event);
  if (!body || typeof body !== 'object') return json(400, { qualified: false, reasons: ['JSON body required'] });
  if (String(body['bot-field'] || body.bot_field || '').trim()) {
    return json(200, { qualified: false, reasons: ['not accepted'], match_cap: leads.MATCH_CAP, contact: leads.CONSENT_TEXT ? 'Buyer name, email, and phone stay hidden.' : '' });
  }
  const decision = leads.qualify({
    email: body.email,
    company: body.company,
    category: body.category,
    rating: body.rating,
    voltage: body.voltage,
    details: body.details,
    deadline: body.deadline,
    country: body.country,
    consent: body.consent === true || body.consent === 'yes',
    consent_version: body.consent_version,
    consent_at: body.consent_at,
    qualified_by_payment: body.qualified_by_payment === true
  }, new Date(), []);
  const payload = {
    qualified: decision.qualified === true,
    reasons: decision.reasons,
    match_cap: leads.MATCH_CAP,
    contact: 'Buyer name, email, and phone stay hidden.'
  };
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: scrub(payload, body)
  };
};
