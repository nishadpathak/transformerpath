#!/usr/bin/env node
/* grids.html (hand-authored worldwide board) must match data/grids.json, which feeds /grids/<country>/ pages. Fails the build on any operator role/voltage drift. */
'use strict';process.chdir(require('path').join(__dirname,'..'));
const fs=require('fs');const g=JSON.parse(fs.readFileSync('data/grids.json'));const h=fs.readFileSync('grids.html','utf8');
const dec=s=>s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
let rows={};for(const m of h.matchAll(/<div class="grid-row"><b>(.*?)<\/b><span style="color:var\(--muted\)">(.*?) <span class="op-updated">.*?<\/span><\/span><span class="kv">(.*?)<\/span>/g)){(rows[dec(m[1])]=rows[dec(m[1])]||[]).push([dec(m[2]),dec(m[3])])}
let arr={};for(const m of h.matchAll(/^ (\[".*\]),?$/gm)){try{const a=JSON.parse(m[1]);(arr[a[0]]=arr[a[0]]||[]).push(a)}catch(e){}}
let bad=0;for(const c of g)for(const o of c.grids){const r=rows[o[0]],a=arr[o[0]];
 if(!r||!r.some(x=>x[0]===o[1]&&x[1]===o[2])){bad++;console.log('ROW',c.country,o[0],JSON.stringify(r),'| want',o[1],o[2])}
 if(!a||!a.some(x=>x[1]===o[1]&&x[2]===o[2])){bad++;console.log('ARR',c.country,o[0],JSON.stringify(a))}}
if(bad){console.error("grids-html-parity: FAIL "+bad+" mismatch(es) between grids.html and data/grids.json");process.exit(1)}console.log("grids-html-parity: PASS ("+g.reduce((s,c)=>s+c.grids.length,0)+" operators)")
