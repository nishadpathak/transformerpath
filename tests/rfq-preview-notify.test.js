#!/usr/bin/env node
/* Preview RFQ notifications are recorded and not emailed. The recipient is
 * the site inbox, never the buyer address on the form.
 */
'use strict';
const assert = require('assert');
const notify = require('../functions/notify');
const review = require('../functions/review-rfq');
const leads = require('../lib/rfq-leads');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok  ' + name);
  else {
    failed++;
    console.error('FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

(async function () {
  const buyer = 'preview-rfq-test@example.com';
  process.env.CONTEXT = 'deploy-preview';
  process.env.RESEND_API_KEY = 're_should_not_send';
  process.env.NOTIFY_TO = 'hello@transformerpath.com';
  const preview = await notify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      form: 'rfq',
      'form-name': 'rfq',
      email: buyer,
      name: 'Preview Tester',
      reference: 'RFQ TP-TEST',
      company: 'Example Transformers'
    })
  });
  const previewBody = JSON.parse(preview.body);
  check('preview RFQ does not send', preview.statusCode === 200 && previewBody.sent === false && previewBody.reason === 'preview_withheld' && previewBody.notification_prepared === true);
  check('preview response does not echo the buyer address', JSON.stringify(previewBody).indexOf(buyer) === -1 && JSON.stringify(previewBody).indexOf('example.com') === -1);
  check('recipient is the site inbox only', notify.recipient().length === 1 && notify.recipient()[0] === 'hello@transformerpath.com' && notify.recipient()[0] !== buyer);

  delete process.env.CONTEXT;
  process.env.RESEND_API_KEY = 're_should_not_send';
  const unset = await notify.handler({
    httpMethod: 'POST',
    headers: { host: 'deploy-preview-236--transformerpath.netlify.app' },
    body: JSON.stringify({ form: 'rfq', email: buyer, reference: 'RFQ TP-TEST' })
  });
  const unsetBody = JSON.parse(unset.body);
  check('missing CONTEXT does not send even with a key', unset.statusCode === 200 && unsetBody.sent === false && unsetBody.reason === 'preview_withheld');

  process.env.CONTEXT = 'production';
  const wrongHost = await notify.handler({
    httpMethod: 'POST',
    headers: { host: 'deploy-preview-236--transformerpath.netlify.app' },
    body: JSON.stringify({ form: 'rfq', email: buyer, reference: 'RFQ TP-TEST' })
  });
  const wrongHostBody = JSON.parse(wrongHost.body);
  check('production context on a preview host does not send', wrongHost.statusCode === 200 && wrongHostBody.sent === false && wrongHostBody.reason === 'preview_withheld');

  delete process.env.RESEND_API_KEY;
  const quiet = await notify.handler({
    httpMethod: 'POST',
    headers: { host: 'transformerpath.com' },
    body: JSON.stringify({ form: 'rfq', email: buyer, reference: 'RFQ TP-TEST' })
  });
  const quietBody = JSON.parse(quiet.body);
  check('production without a key does not send', quiet.statusCode === 200 && quietBody.sent === false && quietBody.reason === 'not_configured');

  process.env.RESEND_API_KEY = 're_fake_notify_test';
  const originalFetch = global.fetch;
  let emailPayload;
  global.fetch = async (url, options) => {
    assert.strictEqual(url, 'https://api.resend.com/emails');
    emailPayload = JSON.parse(options.body);
    return { ok: true };
  };
  try {
    const request = { form: 'rfq', email: buyer, deadline: '2098-04-15', delivery_by: '2098-05-30' };
    await notify.handler({ httpMethod: 'POST', headers: { host: 'transformerpath.com' }, body: JSON.stringify(request) });
    check('the private site-inbox notification distinguishes quote cutoff and requested delivery', emailPayload.to[0] === 'hello@transformerpath.com' && emailPayload.text.includes('Quote by: 2098-04-15') && emailPayload.text.includes('Delivery needed by: 2098-05-30'));
    delete request.delivery_by;
    await notify.handler({ httpMethod: 'POST', headers: { host: 'transformerpath.com' }, body: JSON.stringify(request) });
    check('legacy notifications retain their deadline wording', emailPayload.text.includes('Deadline: 2098-04-15') && !emailPayload.text.includes('Delivery needed by:'));
  } finally {
    global.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
  }

  const lead = {
    email: 'buyer@acme.example', company: 'Acme', category: 'Power Transformer',
    rating: '25 MVA', voltage: '66 kV', details: 'Supply one 25 MVA transformer to the indicated project and technical schedule.',
    deadline: '2098-04-15', consent: true,
    consent_version: leads.CONSENT_VERSION, consent_at: '2026-11-24T08:00:00Z'
  };
  const runReview = async fields => JSON.parse((await review.handler({
    httpMethod: 'POST', body: JSON.stringify(Object.assign({}, lead, fields))
  })).body);
  const bothDates = await runReview({ delivery_by: '2098-05-30' });
  const deliveryTooEarly = await runReview({ delivery_by: '2098-04-14' });
  check('endpoint preserves legacy requests without delivery date', (await runReview({})).qualified === true);
  check('endpoint accepts ordered dates without returning private dates or contact', bothDates.qualified === true && !JSON.stringify(bothDates).includes(lead.email) && !JSON.stringify(bothDates).includes('2098-05-30'));
  check('endpoint rejects a delivery date before the quote cutoff', deliveryTooEarly.qualified === false && deliveryTooEarly.reasons.some(reason => reason.includes('cannot be before')));

  assert.strictEqual(failed, 0);
  console.log('\nrfq preview notify: PASS');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
