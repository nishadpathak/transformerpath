'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const pilot=require('../equipment/pad-mount');
const req=(v={})=>pilot.requirement({kva:'500',hv:'12470',connection:'delta',lv:'480y277',...v});
assert(req());
assert.equal(pilot.results(null).length,6);
const refs=(r)=>pilot.results(r).map(item=>[item.row.id,item.state]);
assert.deepEqual(refs(req()),[['giga-500-delta','exact'],['green-gv0011','exact']]);
assert.deepEqual(refs(req({connection:'grounded-wye'})),[['larson-311050','exact'],['daelim-10014','incomplete']]);
assert.deepEqual(refs(req({hv:'13200'})),[['daelim-10016','exact'],['daelim-10017','exact']]);
assert.deepEqual(refs(req({hv:'12160'})),[['green-gv0011','tap']]);
assert.deepEqual(refs(req({hv:'12160',connection:'grounded-wye'})),[]);
assert.deepEqual(refs(req({hv:'12000'})),[]); // No inferred percentage, tolerance or interpolation.
assert.deepEqual(refs(req({lv:'480d'})),[]); // Not interchangeable with 480Y/277.
assert.deepEqual(refs(req({kva:'501'})),[]);
for(const invalid of [{kva:'NaN'},{kva:'5e2'},{kva:''},{kva:'24.9'},{kva:'10001'},
 {hv:'12.47'},{hv:'12470.0'},{hv:'46001'}, {connection:'constructor'}, {lv:'prototype'}, {lv:'277'},{connection:'wye'}])assert.equal(req(invalid),null);
for(const {row} of pilot.results(null)){
  assert.equal(new URL(row.source).protocol,'https:');
  assert.equal(row.checked,'2026-11-26');
  assert(['catalogue','listed','datasheet'].includes(row.basis));
  assert.equal('price' in row,false);
  assert.equal('stock' in row,false);
  assert.equal('dispatch' in row,false);
}

const href=pilot.draftHref(req(),['giga-500-delta','green-gv0011']);
const args=new URL(href,'https://transformerpath.com');
assert.equal(args.pathname,'/rfq.html');assert.equal(args.hash,'#part-rfq-form');
assert.deepEqual([...args.searchParams.keys()],['equipment','kva','hv','connection','lv','refs']);
assert.deepEqual(pilot.decodeDraft(args.searchParams),{req:req(),ids:['giga-500-delta','green-gv0011']});
assert.equal(pilot.draftHref(req(),['daelim-10017']),null);
assert.equal(pilot.draftHref(req(),['green-gv0011','green-gv0011']),null);
for(const p of ['equipment=2&kva=500&hv=12470&connection=delta&lv=480y277','equipment=1&kva=500&kva=500&hv=12470&connection=delta&lv=480y277',
 'equipment=1&kva=500&hv=12470&connection=delta&lv=480y277&suppliers=giga','equipment=1&kva=500&hv=12470&connection=delta&lv=480y277&refs=__proto__',
 'equipment=1&kva=500&hv=12470&connection=delta&lv=480y277&refs=green-gv0011,,giga-500-delta'])
 assert.equal(pilot.decodeDraft(new URLSearchParams(p)),null);
const fields={};
for(const key of ['fld_category','fld_rating','fld_voltage','fld_details','fld_supplier_shortlist','fld_email','fld_country','fld_name','fld_company','fld_deadline','fld_dest'])fields[key]={value:''};
fields.fld_category.options=[{value:'Distribution Transformer'}];fields.fld_consent={checked:false};fields.shortlistContext={style:{}};
const doc={getElementById:k=>fields[k]};
assert(pilot.rfqPrefill(doc,args.searchParams));
assert.equal(fields.fld_rating.value,'500 kVA');assert.equal(fields.fld_voltage.value,'12.47 / 0.48 kV');
assert.match(fields.fld_details.value,/Exact nominal fields/);
assert.match(fields.fld_details.value,/not nominated recipients/);
assert.match(fields.shortlistContext.textContent,/nothing has been sent/);
for(const key of ['fld_supplier_shortlist','fld_email','fld_country','fld_name','fld_company','fld_deadline','fld_dest'])assert.equal(fields[key].value,'');
assert.equal(fields.fld_consent.checked,false);
assert(!pilot.rfqPrefill(doc,args.searchParams)); // Do not overwrite a draft.
const empty=new URL(pilot.draftHref(req({kva:'750'}),[]),'https://transformerpath.com');
assert.deepEqual(pilot.decodeDraft(empty.searchParams).ids,[]); // Sourcing gap can still reach the standard RFQ.

const rfq=fs.readFileSync('rfq.html','utf8'), html=fs.readFileSync('equipment/index.html','utf8');
const loadCode=rfq.match(/  function loadQueryParams\(\)\{[\s\S]*?\n  \}\n\n  loadQueryParams\(\);/)[0];
let ready, prefillCount=0, schedules=0;
const browser={URLSearchParams,window:{location:{search:args.search}},document:{
  readyState:'loading',addEventListener(name,fn,options){assert.equal(name,'DOMContentLoaded');assert(options.once);ready=fn;},
  getElementById(){throw new Error('Must not pass equipment into legacy query logic');}
},renderSchedule(){schedules++;}};
vm.runInNewContext(loadCode,browser);
assert.equal(prefillCount,0);assert.equal(schedules,1);
browser.window.TPPadMount={rfqPrefill(doc,p){assert.deepEqual([...p],[...args.searchParams]);prefillCount++;}};
ready();assert.equal(prefillCount,1);
assert.match(rfq,/<script src="\/equipment\/pad-mount\.js\?v=1" defer><\/script>/);
assert.match(html,/rel="canonical" href="https:\/\/transformerpath.com\/equipment\//);
assert.match(html,/href="\/request-urgent.html"/);
assert.match(html,/not a live inventory, seller ranking or checkout/);
assert.match(html,/No tap actions are recommended here/);
assert(!/<img\b|mailto:|tel:|\$[0-9]/.test(html));
assert(!/\.submit\(|fetch\(|XMLHttpRequest|navigator\.sendBeacon|sessionStorage|localStorage/.test(fs.readFileSync('equipment/pad-mount.js','utf8')));
assert.equal(JSON.parse(fs.readFileSync('data/sitemap-content-dates.json')).pages['equipment/index.html'],'2026-11-26');
console.log('U.S. pad-mount pilot: source identity, exact/tap/incomplete separation, explicit-only tap data, and safe RFQ draft passed.');
