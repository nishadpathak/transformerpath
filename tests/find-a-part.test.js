'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const parts = require('../tp-parts');
const page = fs.readFileSync('find-a-part.html', 'utf8');
const ids = Array.from(page.matchAll(/data-part-id="([^"]+)"/g), m => m[1]);

assert.equal(ids.length, 10);
assert.equal(new Set(ids).size, 10);
assert.equal((page.match(/Supplier specification/g) || []).length, ids.length);
assert.equal((page.match(/<time datetime="2026-11-25">/g) || []).length, ids.length);
assert.equal((page.match(/data-shortlist="/g) || []).length, ids.length);
assert(page.includes('Distributor / stockist'));
for (const id of ids) {
  const row = parts.decode(id)[0];
  assert(row, id);
  const profile = page.match(new RegExp('data-part-id="'+id+'"[\\s\\S]*?href="(/(?:accessories|manufacturers)/[^"]+/)"'));
  assert(profile, id);
  assert(fs.existsSync(profile[1].slice(1)+'index.html'), profile[1]);
}
assert(parts.filterMatch('RD11 on-load tap changer · 11 kV', 'rd11 11kV'));
assert(parts.filterMatch('Amorim Nitrile gasket material', 'nitrile gasket'));
assert(!parts.filterMatch('Nitrile gasket', '150 A'));
assert.equal(parts.draft('mac-r11,mac-rd11').category, 'Tap-Changers (OLTC/DETC)');
assert.deepEqual(parts.draft('mac-r11,mac-rd11').supplierSlugs, ['macpower-switchgear-pvt-ltd']);
assert.equal(parts.draft('nu-cork-kit').category, 'Other Components');
assert.equal(parts.draft('maddox-25kv').category, 'Bushings');
assert.equal(parts.draft('tom,nu-cork-kit'), null);
assert.equal(parts.draft('tom,tom'), null);
assert.equal(parts.draft('tom,tom,tom,tom,tom,tom'), null);
assert.equal(parts.draft('fake'), null);
assert.equal(parts.draft('fake,tom'), null);
assert.equal(parts.draft('constructor'), null);
assert.equal(parts.draft('<img>'), null);
assert.equal(parts.draft('tom,1&company=Unrelated'), null);
const args = new URL(parts.draft('tom,maddox-25kv').url, 'https://transformerpath.com');
assert.equal(args.pathname, '/rfq.html');
assert.equal(args.hash, '#part-rfq-form');
assert.deepEqual([...args.searchParams], [['parts','tom,maddox-25kv']]);
assert(!Object.hasOwn(parts.draft('tom'), 'voltage'));
assert(!Object.hasOwn(parts.draft('tom'), 'consent'));
assert.match(parts.draft('tom').details, /not confirmed equivalents/);
const ctr = {value:'',style:{}};
const fields = {
  fld_category:{value:'',options:['Bushings','Other Components','Tap-Changers (OLTC/DETC)'].map(value=>({value}))},
  fld_details:{value:''},
  fld_supplier_shortlist:{value:''},
  shortlistContext:ctr,
  fld_email:{value:''},fld_voltage:{value:''},fld_consent:{checked:false}
};
const doc = { getElementById:id=>fields[id] };
assert(!parts.rfqPrefill(doc,'tom,not-in-index'));
assert.equal(fields.fld_category.value,'');
assert(parts.rfqPrefill(doc,'tom,maddox-25kv'));
assert.equal(fields.fld_category.value,'Bushings');
assert.match(fields.fld_details.value,/25 kV loadbreak bushing/);
assert.equal(fields.fld_supplier_shortlist.value,'hitachi-energy,maddox-transformer');
assert.equal(fields.fld_email.value,'');
assert.equal(fields.fld_voltage.value,'');
assert.equal(fields.fld_consent.checked,false);
assert.match(ctr.textContent,/No RFQ has been sent/);
assert(!parts.rfqPrefill(doc,'mac-r11')); // Never overwrite edited or restored fields.
assert.equal(fields.fld_category.value,'Bushings');
console.log('Find a Part: 10 sourced cards, exact profile paths, filters, and safe prefill verified.');
