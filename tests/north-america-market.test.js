'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const NA=require('../lib/north-america-market');
const file=p=>p.replace(/^\//,'')+(p.endsWith('/')?'index.html':'');
const read=p=>fs.readFileSync(file(p),'utf8');
const regions=read('/markets.html');
const hub=read(NA.HUB);
const guide=read(NA.GUIDE);
assert(regions.includes('href="'+NA.HUB+'"><strong>North America'), 'Markets links to the hub');
assert(hub.includes('href="'+NA.GUIDE+'">Start with the US seller guide'), 'Hub puts US seller guide first');
assert(hub.indexOf('href="'+NA.GUIDE+'"') < hub.indexOf('href="#na-country-boards"'));
for (const p of [NA.HUB, NA.GUIDE]) {
  assert(read(p).includes('href="https://transformerpath.com'+p+'"'));
  assert.equal((read(p).match(/<h1>/g)||[]).length,1);
}
for(const c of NA.COUNTRIES) {
  const country='/markets/'+c.slug+'/';
  const d='/directory/country/'+c.slug+'/';
  const t='/tenders/country/'+c.tender+'/';
  const b='/grids/'+c.slug+'/';
  for(const p of [country,d,t,b]) {
    assert(hub.includes('href="'+p+'"'),'North America hub links exact '+p);
    assert(fs.existsSync(file(p)),'Existing tracked destination '+p);
  }
  const content=read(country);
  assert(content.includes('href="'+NA.HUB+'"'));
  assert(content.includes('href="'+NA.GUIDE+'"'));
}
assert(read('/directory/region/north-america/').includes('href="'+NA.HUB+'"'));
assert(read('/directory/region/north-america/').includes('href="'+NA.GUIDE+'"'));
assert(!read('/markets/india/').includes('href="'+NA.GUIDE+'"'),'No geographic cross-link leak');
assert(guide.includes('Before you quote') && guide.includes('What to send to the buyer'));
for(const path of NA.STEPS.map(s=>s.href)) {
  assert(guide.includes('href="'+path+'"'));
  assert(fs.existsSync(file(path)));
}
assert(!/\b\d+(?:\.?\d+)?\s*(?:%|months|weeks|days)\b/i.test(guide),'No unverified rate or time claim');
const first={title:'Example transformer supply',country:'USA',buyer:'Utility',official_reference:'source-ref-1',close_at:'2026-11-26T11:00:00-05:00',portal_timezone:'America/New_York',official_procurement_url:'https://www.worldbank.org/example-notice',source_verified:true,transformer_scope:'CONFIRMED',status:'OPEN'};
const at=Date.parse('2026-11-25T09:00:00Z');
const close=Date.parse(first.close_at);
const mockRows=[first,{...first,country:'Germany',title:'Wrong-country record',official_reference:'out'}, {...first,country:'Canada',title:'Ended contract',status:'AWARDED', official_reference:'award'}, {...first,country:'Mexico',title:'Undated procurement',close_at:'2026-11-26',official_reference:'no-date'}];
const scratch=NA.page({rows:mockRows,now:at});
assert.match(scratch,/Example transformer supply/);
assert.doesNotMatch(scratch,/Wrong-country record|Ended contract|Undated procurement/);
assert.doesNotMatch(NA.page({rows:mockRows,now:close}),/Example transformer supply/);
const guard=scratch.split('<script>').at(-1).split('</script>')[0];
const card={dataset:{naClose:first.close_at}};
const empty={};
let clock=close-1;
let callback;
vm.runInNewContext(guard,{Date:{now:()=>clock,parse:Date.parse},window:{addEventListener:(event,handler)=>callback=handler,setInterval(){}},
  document:{getElementById:()=>({querySelectorAll:()=>[card],querySelector:()=>empty}),addEventListener(){}}});
assert(!card.hidden && empty.hidden);
clock=close;
callback();
assert(card.hidden && !empty.hidden);
assert(guide.includes('https://www.energy.gov/cmei/buildings/distribution-transformers'));
assert(guide.includes('https://www.usitc.gov/harmonized_tariff_information'));
console.log('North America markets, seller guide, country handoffs and deadline handling passed.');
