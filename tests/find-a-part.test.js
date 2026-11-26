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
// The hosted SEO pass defers the external part index until after this inline parser runs.
const vm = require('node:vm');
const source = require('node:fs').readFileSync('rfq.html','utf8');
const prefillBranch = source.match(/  function loadQueryParams\(\)\{[\s\S]*?\n    if\(p.has\('rating'\)\)/)[0].replace(/\n    if\(p.has\('rating'\)\)$/, '\n  }');
let afterParse, appliedPart;
const context = {
  URLSearchParams,
  window:{location:{search:'?parts=mac-rd11'}},
  document:{readyState:'loading',addEventListener(event,fn,options){
    assert.equal(event,'DOMContentLoaded'); assert.equal(options.once,true); afterParse=fn;
  }},
  renderSchedule:()=>{}
};
vm.runInNewContext(prefillBranch+'\nloadQueryParams();',context);
assert.equal(appliedPart,undefined);
context.window.TPParts={rfqPrefill(doc,id){ assert.equal(doc,context.document); appliedPart=id; }};
afterParse();
assert.equal(appliedPart,'mac-rd11');
console.log('Find a Part: 10 sourced cards, exact profile paths, filters, and safe prefill verified.');

// Dated availability suggestions are contact drafts, not public inventory.
const report = {
  family:'tap-changer', seller:'Example Supply', model:'Maker RD11', country:'India',
  status:'seller-stock', evidence:'seller-record', confirmed:'2026-11-25', until:'2026-12-04', source:''
};
const today = '2026-11-26';
const privateDraft = parts.availabilityReport(report, today);
assert.match(privateDraft.message, /supplier-declared, for editorial review/);
assert.match(privateDraft.message, /Supplier-stated status: Supplier reports stock/);
assert.match(privateDraft.message, /Date checked: 2026-11-25/);
assert.match(privateDraft.message, /Report valid through: 2026-12-04/);
assert.match(privateDraft.message, /not independent stock verification/);
assert.equal(privateDraft.fields.source, '');
for (const invalid of [
  {family:'gasket'}, {family:'constructor'}, {status:'verified'}, {evidence:'__proto__'},
  {confirmed:'2026-11-27'}, {confirmed:'2026-10-26'}, {confirmed:'2026-02-30'},
  {until:'2026-11-25'}, {until:'2026-12-26'}, {seller:'someone@example.com'},
  {source:'javascript:alert(1)'}, {source:'http://maker.example/model'},
  {source:'https://u:p@maker.example/model'}, {source:'https://maker.example/model?key=secret'},
  {source:'https://maker.example/model#private'}, {evidence:'public-source'}
]) assert(parts.availabilityReport({...report, ...invalid}, today).error, JSON.stringify(invalid));
const publicEvidence = parts.availabilityReport({
  ...report, status:'made-to-order', evidence:'public-source', source:'https://maker.example/model'
}, today);
assert.match(publicEvidence.message, /Public evidence URL: https:\/\/maker.example\/model/);
assert.match(publicEvidence.message, /Made to order/);
assert(!parts.availabilityReport({...report,confirmed:'2026-10-27',until:'2026-11-26'},today).error); // exact 30-day boundary
assert.match(page, /id="parts-comparison"/);
assert.match(page, /id="parts-availability-form" hidden/);
const contact = fs.readFileSync('contact.html', 'utf8');
assert.match(contact, /id="contact-part-draft-status" role="status" hidden/);
assert.match(contact, /<script src="tp-parts\.js\?v=2" defer><\/script>/);
console.log('Parts availability: date, evidence, source, and draft-only contracts verified.');
