#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const regions=require('./lib/regional-market-hubs');
const read=(path)=>JSON.parse(fs.readFileSync(path,'utf8'));
const absolute=(s)=>s.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g,'$1="/$2"');
function buildRegionalMarkets() {
  const fixtures={head:absolute(fs.readFileSync('_partials/header.html','utf8')),foot:absolute(fs.readFileSync('_partials/footer.html','utf8')),now:Date.now()};
  const tenders=read('data/tenders.json').tenders || [];
  const awards=read('data/awards.json').awards || [];
  for(const slug of Object.keys(regions.CONFIG)) {
    const seed=read('data/'+slug+'-regional-market-hub.json');
    const dir='markets/'+slug;
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(dir+'/index.html',regions.render(slug,seed,tenders,awards,fixtures));
    console.log('Regional transformer market hub: /'+dir+'/');
  }
}
if (require.main === module) buildRegionalMarkets();
module.exports = { buildRegionalMarkets };
