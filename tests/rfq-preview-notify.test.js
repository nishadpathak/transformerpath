#!/usr/bin/env node
/* Preview RFQ notifications are recorded and not emailed. The recipient is
 * the site inbox, never the buyer address on the form.
 */
'use strict';
const assert = require('assert');
const notify = require('../functions/notify');

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

  delete process.env.RESEND_API_KEY;
  process.env.CONTEXT = 'production';
  const quiet = await notify.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ form: 'rfq', email: buyer, reference: 'RFQ TP-TEST' })
  });
  const quietBody = JSON.parse(quiet.body);
  check('production without a key does not send', quiet.statusCode === 200 && quietBody.sent === false && quietBody.reason === 'not_configured');

  assert.strictEqual(failed, 0);
  console.log('\nrfq preview notify: PASS');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
