'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const targets=[
  ['/markets/north-america/us-seller-guide/','','US DOE: distribution transformer standards'],
  ['/markets/china/','china-buyer-guide','CNCA: catalogue and implementation rules'],
  ['/markets/europe/','sell-into-market','EUR-Lex: consolidated transformer Ecodesign regulation'],
  ['/markets/india/','sell-into-market','BIS: Foreign Manufacturers Certification Scheme']
];
function check(dist='.') {
  const parse = url => fs.readFileSync(path.join(dist,url.slice(1)+(url.endsWith('/')?'index.html':'')),'utf8');
  const root=parse('/markets.html');
  assert.match(root,/aria-label="Transformer market guides"/);
  assert.match(root,/href="\/markets\/north-america\/"/);
  for(const [url,anchor,source] of targets) {
    const open=url+(anchor?'#'+anchor:'');
    const d=parse(url);
    assert(root.includes('href="'+open+'"'),'Markets entry points to '+open);
    assert(d.includes('href="https://transformerpath.com'+url+'"'),'Self canonical '+url);
    if(anchor) assert(d.includes('id="'+anchor+'"'),'Fragment exists '+open);
    assert(d.includes(source),'Primary source link present '+url);
    assert.doesNotMatch(d,/Editorial preview:|Private local preview|data-beta-client/i);
  }
  const cn=parse('/markets/china/');
  assert.doesNotMatch(cn,/Live this build|Open \/ live tenders|active tenders/);
  assert(cn.includes('href="/tenders/country/china/"'));
  assert(cn.includes('href="https://www.bidding.csg.cn/"'));
  for(const href of ['/directory/country/china/','/knowledge/transformer-rfq-specification.html','/knowledge/how-to-buy-transformer.html','/knowledge/transformer-acceptance-testing.html','/laboratories.html','/knowledge/fat-vs-sat.html','/rfq.html','/utilities/state-grid-corp-of-china-sgcc/','/utilities/china-southern-power-grid-csg/','/tenders/country/china/','/grids/china/']) {
    assert(cn.includes('href="'+href+'"'));
    assert(parse(href).length>0,'China destination '+href+' exists');
  }
  const europe=parse('/markets/europe/');
  const india=parse('/markets/india/');
  assert(europe.includes('href="#buyer-portals"') && europe.includes('id="buyer-portals"'));
  assert(india.includes('href="#india-tenders"') && india.includes('id="india-tenders"'));
  assert(india.includes('href="#sell-into-market"'));
  assert(!parse('/markets/gcc/').includes('id="sell-into-market"'));
  console.log('Four market guide entry points and China buyer handoffs passed ('+dist+').');
}
if (require.main === module) check(process.argv[2] || '.');
module.exports = check;
