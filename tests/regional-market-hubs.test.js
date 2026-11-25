'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const R=require('../lib/regional-market-hubs');
const at=Date.parse('2026-11-25T09:00:00Z');
const first={title:'Transformer supply',country:'Poland',buyer:'Utility',official_reference:'1',close_at:'2026-11-26T09:00:00+01:00',official_procurement_url:'https://ted.europa.eu/en/notice/-/detail/123456-2026',source_verified:true,transformer_scope:'CONFIRMED',status:'OPEN'};
assert.equal(R.tendersFor([first],R.CONFIG.europe,at)[0].country,'Poland');
assert.equal(R.tendersFor([first],R.CONFIG.gcc,at).length,0);
assert.equal(R.tendersFor([{...first,country:'Saudi'}],R.CONFIG.gcc,at)[0].country,'Saudi Arabia');
assert.equal(R.tendersFor([first,first],R.CONFIG.europe,at).length,1);
assert.equal(R.tendersFor([first],R.CONFIG.europe,Date.parse(first.close_at)).length,0);
for (const row of [{close_at:'2026-11-26'},{status:'AWARDED'},{awardee:'Vendor'},{transformer_scope:'INFERRED'},{source_verified:false},{official_procurement_url:'https://www.tenderimpulse.com/opportunity'}, {country:'Mexico', title:'Europe supplies'}]) {
  assert.equal(R.tendersFor([{...first,...row}],R.CONFIG.europe,at).length,0,JSON.stringify(row));
}
const award={country:'Switzerland',title:'Historical transformer supply',transformer_scope:'CONFIRMED',award_status:'CONFIRMED',awardee:'Vendor',source_urls:[first.official_procurement_url]};
assert.equal(R.awardsFor([award],R.CONFIG.europe).length,1);
assert.equal(R.awardsFor([{...award,awardee:''},{...award,award_status:'EXPECTED'}],R.CONFIG.europe).length,0);
assert.equal(R.regionForCountry('UAE'),'gcc');
assert.equal(R.regionForCountry('India'),'');
assert.equal(R.regionForCountry('Germany'),'europe');
for(const slug of Object.keys(R.CONFIG)) {
  const source=JSON.parse(fs.readFileSync('data/'+slug+'-regional-market-hub.json','utf8'));
  R.assertSeed(slug,source);
  if (slug==='gcc') assert.equal(new Set(source.portals.map(p=>p.country)).size,6,'all GCC states represented');
  const file='markets/'+slug+'/index.html';
  const html=fs.readFileSync(file,'utf8');
  for(const id of ['buyer-portals','open-tenders','market-news','company-directory','recent-awards']) assert.ok(html.includes('id="'+id+'"') && html.includes('href="#'+id+'"'));
  assert.match(html,new RegExp('rel="canonical" href="https://transformerpath.com/markets/'+slug+'/"'));
  assert.doesNotMatch(html,/<meta[^>]*content="noindex/i);
  assert.ok(html.includes('data-region-empty'));
  const bySection=(id)=>html.split('<section id="'+id+'"')[1].split('</section>')[0];
  assert.doesNotMatch(bySection('market-news'),/data-listing="award"/);
  assert.doesNotMatch(bySection('open-tenders'),/data-listing="award"/);
  assert.match(bySection('recent-awards'),/data-listing="award"/);
  assert.ok(html.includes('Date.parse(c.dataset.regionDeadline)>Date.now()'));
  for(const row of source.companies) {
    assert.ok(fs.existsSync(row.path.slice(1)+'index.html'),slug+' canonical target missing: '+row.path);
    assert.ok(html.includes('href="'+row.path+'"'));
  }
}
const index=fs.readFileSync('markets.html','utf8');
for(const r of ['/markets/gcc/','/markets/europe/','/directory/region/latin-america/']) assert.ok(index.includes('href="'+r+'"'));
const saudi=fs.readFileSync('markets/saudi-arabia/index.html','utf8');
assert.match(saudi,/60 Hz nominal transmission frequency/);
assert.doesNotMatch(saudi,/Frequency is 50 Hz|60 Hz transmission is not used/);
for(const [d,m] of [['europe','europe'],['middle-east','gcc']]) assert.ok(fs.readFileSync('directory/region/'+d+'/index.html','utf8').includes('href="/markets/'+m+'/"'));
console.log('Regional markets: exact dates, geographic isolation, source status, awards separation and route links passed');
