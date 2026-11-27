/* Optional factory-slot checklist on the RFQ form, linked from the buy-early guide. */
'use strict';
const fs = require('fs');
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

const html = fs.readFileSync('rfq.html', 'utf8');
const buy = fs.readFileSync('buy-early/index.html', 'utf8');
const client = fs.readFileSync('supabase.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261127140000_user_rfqs_factory_slot.sql', 'utf8');
const slot = html.slice(html.indexOf('id="factory-slot"'), html.indexOf('Have a specification file?'));

check('checklist is optional and records the written confirmation', slot.indexOf('Factory slot checklist (optional)') !== -1 && slot.indexOf('name="slot_confirmed"') !== -1 && slot.indexOf('name="slot_confirmed_on"') !== -1 && slot.indexOf('name="slot_reference"') !== -1);
check('checklist records the freeze date and both impact notes', slot.indexOf('name="spec_freeze_date"') !== -1 && slot.indexOf('name="price_impact_after_freeze"') !== -1 && slot.indexOf('name="delivery_impact_after_freeze"') !== -1);
check('checklist fields are not required', !/name="slot_confirmed"[^>]*required/.test(slot) && !/name="spec_freeze_date"[^>]*required/.test(slot) && !/name="price_impact_after_freeze"[^>]*required/.test(slot));
check('wording leaves the slot to the supplier terms', slot.indexOf('does not, by itself, decide whether the slot stays') !== -1 && slot.indexOf('depend on the supplier\'s terms') !== -1 && /lose the slot|loses the slot|slot is lost/i.test(slot) === false);
check('checklist links the buy-early guide instead of copying it', slot.indexOf('href="/buy-early/"') !== -1 && slot.indexOf('does not repeat that guide') !== -1);
check('prompts ask for the impacts in writing', slot.indexOf('Get this in writing.') !== -1);
check('buy-early links the checklist', buy.indexOf('href="/rfq.html#factory-slot"') !== -1 && buy.indexOf('depends on those terms') !== -1);
check('notify payload names the checklist fields', html.indexOf('slot_confirmed: val(\'fld_slot_confirmed\')') !== -1 && html.indexOf('delivery_impact_after_freeze: val(\'fld_delivery_impact\')') !== -1);
check('signed-in save sends the checklist and can fall back', client.indexOf('factory_slot: slot') !== -1 && client.indexOf('PGRST204') !== -1 && client.indexOf('if (!slotFilled(slot)) return insert(base);') !== -1);
check('migration is present and is not a production apply step', migration.indexOf('add column if not exists factory_slot jsonb') !== -1 && migration.indexOf('NOT applied by CI') !== -1);

(async function () {
  process.env.CONTEXT = 'production';
  process.env.RESEND_API_KEY = 're_fake_slot_test';
  process.env.NOTIFY_TO = 'hello@transformerpath.com';
  const originalFetch = global.fetch;
  let emailPayload;
  global.fetch = async function (url, options) {
    emailPayload = JSON.parse(options.body);
    return { ok: true };
  };
  try {
    await notify.handler({
      httpMethod: 'POST',
      headers: { host: 'transformerpath.com' },
      body: JSON.stringify({
        form: 'rfq',
        delivery_by: '2098-05-30',
        deadline: '2098-04-15',
        slot_confirmed: 'yes',
        slot_confirmed_on: '2098-03-01',
        slot_reference: 'SLOT-14',
        spec_freeze_date: '2098-03-15',
        price_impact_after_freeze: 'Supplier letter: price review if the rating changes.',
        delivery_impact_after_freeze: 'Supplier letter: delivery impact depends on the written terms.'
      })
    });
    const text = emailPayload && emailPayload.text || '';
    check('site inbox notice includes the checklist', text.indexOf('Written slot confirmation: yes') !== -1 && text.indexOf('Spec-freeze deadline: 2098-03-15') !== -1 && text.indexOf('Price impact after the spec freeze:') !== -1 && text.indexOf('Delivery or slot impact after the spec freeze:') !== -1);
    check('notice still distinguishes quote cutoff from requested delivery', text.indexOf('Quote by: 2098-04-15') !== -1 && text.indexOf('Delivery needed by: 2098-05-30') !== -1);
  } finally {
    global.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.CONTEXT;
  }
  assert.strictEqual(failed, 0);
  console.log('\nfactory slot checklist: PASS');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
