/* POST a vacancy. The URL, the capture date, the verification date, and the
 * HTTP status are filled here. Nothing is written to the public board unless
 * a store is configured, and this deploy has none, so a pass leaves the live
 * count at 0. FEATURED is never set. The response omits the employer email.
 */
'use strict';
const jobs = require('../lib/job-board');
const { probeVacancy } = require('../lib/vacancy-probe');

let probeImpl = probeVacancy;
let storeImpl = null;

function setProbeForTests(fn) { probeImpl = fn || probeVacancy; }
function setStoreForTests(store) { storeImpl = store || null; }

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

async function storeRecord(record) {
  if (!storeImpl || !record) return false;
  const saved = Object.assign({}, record);
  delete saved.email;
  await storeImpl.save(saved);
  return true;
}

exports.handler = async function (event) {
  if (!event || event.httpMethod !== 'POST') return json(405, { accepted: false, errors: ['POST required'] });
  const body = readBody(event);
  if (!body || typeof body !== 'object') return json(400, { accepted: false, errors: ['JSON body required'] });
  if (String(body['bot-field'] || body.bot_field || '').trim()) {
    return json(200, { accepted: false, live: false, stored: false, featured: false, errors: ['not accepted'] });
  }
  const input = {
    title: body.title,
    company: body.company,
    location: body.location,
    function: body.function,
    description: body.description,
    email: body.email,
    apply_url: body.apply_url || body.posting_url,
    one_position: body.one_position === true || body.one_position === 'yes'
  };
  const submission = jobs.submissionErrors(input);
  if (submission.length) {
    return json(200, { accepted: false, live: false, stored: false, featured: false, errors: submission, opening: null });
  }
  let probe;
  try { probe = await probeImpl(String(input.apply_url || '')); }
  catch (e) { probe = { ok: false, status: 0, final_url: String(input.apply_url || ''), error: 'vacancy URL could not be reached' }; }
  const decision = jobs.autoReview(input, probe, new Date());
  const stored = decision.live && decision.record ? await storeRecord(decision.record) : false;
  const payload = {
    accepted: decision.accepted === true,
    live: decision.live === true && stored === true,
    stored: stored === true,
    featured: false,
    errors: decision.errors,
    http_status: probe && probe.status ? Number(probe.status) : 0,
    checked_on: jobs.isoDay(new Date()),
    opening: decision.accepted ? decision.row : null
  };
  const email = String(input.email || '').trim();
  if (email && JSON.stringify(payload).toLowerCase().indexOf(email.toLowerCase()) !== -1) {
    return json(500, { accepted: false, stored: false, featured: false, errors: ['refused'] });
  }
  return json(200, payload);
};

exports._setProbeForTests = setProbeForTests;
exports._setStoreForTests = setStoreForTests;
