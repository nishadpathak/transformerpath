'use strict';
const {assignedCountries, evidencedCrossBorderCountries, canonicalCountry} = require('./market-country');
const {parseCloseInstant} = require('./deadline');
const {isOfficialProcurementUrl, portalZone} = require('./tender-sources');

const CONFIG = {
  gcc: {
    label: 'GCC', title: 'GCC Transformer Market Hub: Suppliers and Tenders', section: 'Gulf Cooperation Council',
    desc: 'Explore transformer procurement, sourced suppliers, utility buyer portals and market developments across the six GCC countries.',
    countries:['Bahrain','Kuwait','Oman','Qatar','Saudi Arabia','United Arab Emirates'],
    markets:{'Saudi Arabia':'saudi-arabia','United Arab Emirates':'uae',Kuwait:'kuwait'},
    directory:'/directory/region/middle-east/', directoryLabel:'Wider Middle East manufacturer directory'
  },
  europe: {
    label: 'Europe', title: 'Europe Transformer Market Hub: Tenders and Suppliers', section: 'European market intelligence',
    desc: 'Browse selected European transformer notices, buyer portals, component specialists and source-linked industry updates.',
    countries:['Austria','Belgium','Bulgaria','Croatia','Cyprus','Czechia','Denmark','Estonia','Finland','France','Germany','Greece','Hungary','Iceland','Ireland','Italy','Latvia','Liechtenstein','Lithuania','Luxembourg','Malta','Netherlands','Norway','Poland','Portugal','Romania','Slovakia','Slovenia','Spain','Sweden','Switzerland','United Kingdom','Ukraine'],
    markets:{Austria:'austria',Bulgaria:'bulgaria',Czechia:'czechia',Finland:'finland',France:'france',Germany:'germany',Italy:'italy',Netherlands:'netherlands',Norway:'norway',Poland:'poland',Romania:'romania',Spain:'spain',Sweden:'sweden','United Kingdom':'united-kingdom'},
    directory:'/directory/region/europe/', directoryLabel:'Europe manufacturer directory'
  }
};
const pathFor = (slug) => '/markets/' + slug + '/';
const ORIGIN = 'https://transformerpath.com';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
function https(v) {
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && u.hostname !== 'transformerpath.com'; }
  catch { return false; }
}
const isoDay = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '') && new Date(v + 'T00:00:00Z').toJSON()?.slice(0,10) === v;
const profilePath = (p) => /^\/(?:manufacturers|accessories|utilities|services|laboratories|machinery|logistics|procurement|entities|companies)\/[a-z0-9-]+\/$/.test(p || '');

const VRDT_EVIDENCE = {field:'Grid field measurements', 'lab-model':'Laboratory test + simulation'};
const validSource = (s) => s && text(s.name) && https(s.url);
function assertVoltageRegulationPilots(p, conf) {
  if (!p || !isoDay(p.reviewed) || !Array.isArray(p.cases) || !validSource(p.excluded))
    throw new Error('Europe VRDT tracker needs review date, cases and EU-TRACE scope source');
  const used = new Set();
  for (const row of p.cases) {
    const validDate = isoDay(row.date) ? row.date <= p.reviewed : /^\d{4}$/.test(row.date || '') && row.date <= p.reviewed.slice(0,4);
    if (!/^[a-z0-9-]+$/.test(row.id || '') || used.has(row.id) || !conf.countries.includes(row.country) ||
        !validDate || !Object.hasOwn(VRDT_EVIDENCE,row.evidence) ||
        ![row.title,row.stage,row.setup,row.finding,row.limit].every(text) ||
        !Array.isArray(row.sources) || !row.sources.length || !row.sources.every(validSource))
      throw new Error('Invalid Europe VRDT case ' + row.id);
    used.add(row.id);
  }
  if (p.cases.filter(row=>row.evidence==='field').length<2 || !p.cases.some(row=>row.evidence==='lab-model'))
    throw new Error('Europe VRDT tracker needs two field cases and a distinct laboratory/model case');
}
const regionForCountry = (c) => Object.keys(CONFIG).find(k=>CONFIG[k].countries.some(x=>canonicalCountry(x)===canonicalCountry(c))) || '';
function assertSeed(slug, seed) {
  const conf = CONFIG[slug];
  if (!conf || !seed || !isoDay(seed.reviewed) || !text(seed.scope)) throw new Error(slug + ' missing valid review date or scope');
  for (const [key,min] of Object.entries({portals:6,companies:6,news:3,context:1})) {
    if (!Array.isArray(seed[key]) || seed[key].length < min) throw new Error(slug + ' needs at least ' + min + ' ' + key + ' rows');
  }
  for (const p of seed.portals) if (!(text(p.country) && text(p.name) && https(p.url) && text(p.description))) throw new Error(slug + ' invalid portal ' + p.name);
  const seen = new Set();
  for (const p of seed.companies) {
    if (!(text(p.name) && conf.countries.some(x=>canonicalCountry(x)===canonicalCountry(p.country)) && profilePath(p.path) && https(p.source) && text(p.description)) || seen.has(p.path)) throw new Error(slug + ' invalid or duplicate company ' + p.name + ': ' + p.path);
    seen.add(p.path);
  }
  for (const n of seed.news) if (!(isoDay(n.date) && n.date <= seed.reviewed && text(n.title) && https(n.url) && text(n.summary) && (!n.status || ['news','award','closed','no award'].includes(n.status)))) throw new Error(slug + ' invalid news ' + n.title);
  for (const n of seed.context) if (!(text(n.title) && https(n.url) && text(n.summary))) throw new Error(slug + ' invalid context ' + n.title);
  if (slug==='europe') assertVoltageRegulationPilots(seed.voltageRegulationPilots,conf);
  return seed;
}

function assigned(row, conf) {
  const countries = new Map(conf.countries.map(c=>[canonicalCountry(c),c]));
  return countries.get(assignedCountries(row).concat(evidencedCrossBorderCountries(row)).find(c=>countries.has(c))) || '';
}
function tendersFor(rows, conf, now=Date.now()) {
  const seen = new Set();
  const selected = [];
  for (const row of rows) {
    const country = assigned(row,conf);
    const close = parseCloseInstant(row.close_at);
    const source = row.official_procurement_url || row.official_source_url;
    if (!country || !close || Date.parse(close)<=now || !['OPEN','CLOSING_SOON'].includes(row.status) ||
        !row.source_verified || row.transformer_scope !== 'CONFIRMED' || row.awardee ||
        !https(source) || !isOfficialProcurementUrl(source)) continue;
    const ref = row.official_reference || row.procurement_id || '';
    const key = ref ? (country + '|' + ref + '|' + (row.buyer || row.utility || '')) : source;
    if (seen.has(key)) continue;
    seen.add(key); selected.push({...row,country,close,source,ref});
  }
  return selected.sort((a,b)=>Date.parse(a.close)-Date.parse(b.close)||a.title.localeCompare(b.title)).slice(0,9);
}
function awardsFor(rows, conf) {
  const selected=[]; const seen = new Set();
  for (const row of rows) {
    const country=assigned(row,conf), src=(row.source_urls||[]).find(u=>https(u)&&isOfficialProcurementUrl(u));
    if (!country || row.award_status !== 'CONFIRMED' || row.transformer_scope !== 'CONFIRMED' ||
        !text(row.awardee) || !text(row.title) || !src || seen.has(row.award_id || src)) continue;
    seen.add(row.award_id || src);
    selected.push({...row,country,src});
  }
  return selected.sort((a,b)=>String(b.publication_date || b.awarded_at || b.last_verified||'').localeCompare(String(a.publication_date || a.awarded_at || a.last_verified||''))).slice(0,6);
}
function deadline(row) {
  let zone=portalZone(row.source,row.portal_timezone)||'UTC';
  const options = {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short',timeZone:zone};
  try { return new Intl.DateTimeFormat('en-GB',options).format(Date.parse(row.close)); }
  catch { return new Intl.DateTimeFormat('en-GB',{...options,timeZone:'UTC'}).format(Date.parse(row.close)); }
}
const day = (d) => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d + 'T00:00:00Z'));
const CSS = `
.regional{max-width:1100px;margin:0 auto;padding:28px clamp(15px,3.5vw,38px) 72px;color:var(--text)}
.regional .kicker{font-size:.83rem;font-weight:750;color:var(--accent);letter-spacing:.05em;text-transform:uppercase}
.regional h1{font-size:clamp(1.85rem,4.5vw,2.75rem);line-height:1.15;margin:.5rem 0 .8rem;color:var(--ink)}
.regional .region-intro{max-width:75ch;line-height:1.6}.regional a{color:var(--accent)}.regional a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.regional .region-nav,.regional .country-links{display:flex;flex-wrap:wrap;gap:8px;margin:1.1rem 0}
.regional .region-nav a,.regional .country-links a{display:inline-flex;align-items:center;min-height:44px;border:1px solid var(--border);border-radius:8px;padding:6px 12px;text-decoration:none;font-weight:650}
.regional section{scroll-margin-top:96px;margin-top:2rem}.regional h2{font-size:1.46rem;color:var(--ink);margin-bottom:.4rem}
.regional .region-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin:.9rem 0}
.regional article{min-width:0;overflow-wrap:anywhere;border:1px solid var(--border);background:var(--card);padding:15px;border-radius:12px}
.regional h3{font-size:1.02rem;line-height:1.4;margin:.35rem 0;color:var(--ink)}
.regional p{line-height:1.55;margin:.4rem 0}.regional .region-meta,.regional .region-note{color:var(--muted);font-size:.86rem}
.regional [hidden]{display:none!important}
`;
function tag(t) {return '<p class="region-meta">'+esc(t)+'</p>';}
function source(url,label='Official source') { return '<a href="'+esc(url)+'" rel="noopener">'+esc(label)+'</a>'; }
function card({meta='',title,summary='',link='',trail=''}) {
  return tag(meta)+'<h3>'+esc(title)+'</h3><p>'+esc(summary)+'</p>'+link+trail;
}
function section(id,title,intro,body) {
  return '<section id="'+id+'" aria-labelledby="'+id+'-title"><h2 id="'+id+'-title">'+esc(title)+'</h2><p class="region-note">'+esc(intro)+'</p>'+body+'</section>';
}
const grid = (arr) => '<div class="region-grid">'+arr.join('')+'</div>';
const article = (s) => '<article>'+s+'</article>';

function voltageRegulationPilots(p) {
  const cards = p.cases.map(row=>{
    const when = row.date.length === 4 ? row.date : day(row.date);
    return '<article data-vrdt-case="'+esc(row.id)+'" data-evidence="'+esc(row.evidence)+'">'+
      tag(row.country+' · '+VRDT_EVIDENCE[row.evidence])+'<h3>'+esc(row.title)+'</h3>'+
      '<p class="region-meta"><strong>Status:</strong> '+esc(row.stage)+' · <time datetime="'+esc(row.date)+'">'+esc(when)+'</time></p>'+
      '<p>'+esc(row.setup)+'</p><p><strong>What the source found:</strong> '+esc(row.finding)+'</p>'+
      '<p><strong>What it does not show:</strong> '+esc(row.limit)+'</p>'+
      '<p>'+row.sources.map(s=>source(s.url,s.name)).join(' · ')+'</p></article>';
  });
  return section('voltage-regulation-pilots','Voltage-regulating distribution transformer pilots',
    'Selected European evidence on medium-to-low-voltage transformers with on-load tap changers (OLTCs). Read field results, lab tests and simulations separately. Dates are those of the linked reporting, not a claim that a pilot is still active.',
    grid(cards)+'<p>Evidence reviewed <time datetime="'+esc(p.reviewed)+'">'+day(p.reviewed)+'</time>. EU-TRACE studies faster replacement of inefficient transformer fleets; it is not a voltage-regulation pilot. '+source(p.excluded.url,p.excluded.name)+'.</p>'+
    '<p><a href="/knowledge/oltc-operation.html">How on-load tap changers work</a> · <a href="/knowledge/transformer-voltage-regulation.html">Transformer voltage regulation guide</a></p>');
}
function teasers() {
  return '<section id="regional-hubs" class="regional-guide" aria-labelledby="regional-hubs-title"><h2 id="regional-hubs-title">Featured transformer markets</h2><p>Start with a regional guide or a country dashboard, then open the directory or the buyer’s procurement portal.</p><div class="regional-guide-links">'+Object.entries(CONFIG).map(([slug,c])=>'<a href="'+pathFor(slug)+'"><strong>'+esc(c.label)+'</strong><span>'+esc(c.desc)+'</span></a>').join('')+'<a href="/directory/region/latin-america/"><strong>Latin America</strong><span>Directory, buyer portals and a multilingual market guide.</span></a><a href="/markets/india/"><strong>India</strong><span>Sourced transformer tenders, procurement portals and supplier context.</span></a><a href="/markets/china/"><strong>China</strong><span>Grid profile, manufacturing base, procurement and project pipeline.</span></a>'+require('./buyer-regional-hubs').teasers()+'</div></section>';
}
function render(slug, raw, tenders, awards, fixtures) {
  const c=CONFIG[slug], seed=assertSeed(slug,raw);
  const nav=[['buyer-portals','Buyer portals'],['open-tenders','Open tenders'],['market-news','Market news'],['company-directory','Companies'],['recent-awards','Awards']];
  if (slug==='europe') nav.splice(3,0,['voltage-regulation-pilots','Voltage regulation pilots']);
  const live=tendersFor(tenders,c,fixtures.now);
  const ended=awardsFor(awards,c);
  const editorialAwards=seed.news.filter(n=>n.status==='award' && !ended.some(a=>a.src===n.url));
  const updates=seed.news.filter(n=>n.status!=='award');
  const time=(t)=>'<time datetime="'+esc(t.close)+'">'+esc(deadline(t))+'</time>';
  let body='<main id="main" class="regional" data-region-hub="'+slug+'"><nav aria-label="Breadcrumb"><a href="/markets.html">Markets</a> / '+esc(c.label)+'</nav><p class="kicker">'+esc(c.section)+'</p><h1>'+esc(c.title)+'</h1><p class="region-intro">'+esc(seed.scope)+'</p><p class="region-meta">Editorial sources reviewed <time datetime="'+seed.reviewed+'">'+day(seed.reviewed)+'</time>. Listings are selective, not rankings.</p>';
  body+='<nav class="region-nav" aria-label="'+esc(c.label)+' hub sections">'+nav.map(([id,title])=>'<a href="#'+id+'">'+title+'</a>').join('')+'</nav>';
  body+=section('open-tenders','Open tender watch','Only transformer-specific notices with a verified official source and an exact future deadline are shown here. Confirm amendments and eligibility on the official portal.',
    '<p class="region-note" data-region-empty'+(live.length?' hidden':'')+'>No selected notice with an exact future deadline is listed here. Check the buyer portals below for other opportunities.</p>'+
    grid(live.map(t=>'<article data-region-deadline="'+esc(t.close)+'" data-listing="tender">'+card({meta:t.country+' · '+(t.ref || 'Official notice'),title:t.title,summary:t.summary||t.snippet,link:source(t.source,'Open official notice'),trail:'<p><strong>Published deadline:</strong> '+time(t)+'</p>'})+'</article>'))+
    '<p><a href="/tenders.html?status=open">Browse the full open tenders board</a></p>');
  body+=section('buyer-portals','Where buyers publish','Start with the official portal, then follow the individual notice to the actual submission system. Public visibility is not supplier qualification.',
    grid(seed.portals.map(p=>article(card({meta:p.country,title:p.name,summary:p.description,link:source(p.url,'Open buyer portal')})))));
  body+=section('market-news','Market updates and context','Published developments, not bid opportunities. Dates refer to the linked publication or announcement.',
    grid(updates.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(n=>article(card({meta:day(n.date)+(n.status==='no award'?' · Closed without award':n.status==='closed'?' · Closed':' · Market update'),title:n.title,summary:n.summary,link:source(n.url)}))))+
    grid(seed.context.map(n=>article(card({meta:'Reference',title:n.title,summary:n.summary,link:source(n.url)})))));
  if (slug==='europe') body+=voltageRegulationPilots(seed.voltageRegulationPilots);
  body+=section('company-directory','Companies and capabilities','Selected businesses with links to relevant company evidence. Verify current capability, local availability and buyer registration directly before purchase.',
    grid(seed.companies.map(p=>article(tag(p.country)+'<h3><a href="'+p.path+'">'+esc(p.name)+'</a></h3><p>'+esc(p.description)+'</p>'+source(p.source))))+
    '<p><a href="'+c.directory+'">'+esc(c.directoryLabel)+'</a> · <a href="/find-a-part.html">Find a transformer part</a></p>');
  body+=section('recent-awards','Confirmed contract awards','Historical results are shown separately from bid opportunities.',
    (ended.length||editorialAwards.length?grid(editorialAwards.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(a=>'<article data-listing="award">'+card({meta:day(a.date)+' · Confirmed contract result',title:a.title,summary:a.summary,link:source(a.url,'Official award source')})+'</article>').concat(ended.map(a=>'<article data-listing="award">'+card({meta:a.country+' · Confirmed award',title:a.title,summary:'Awardee: '+a.awardee+(a.buyer?' · Buyer: '+a.buyer:''),link:source(a.src,'Official award source')})+'</article>'))):'<p class="region-note">No selected transformer award from an official procurement source is listed in this view.</p>')+
    '<p><a href="/awards.html">Browse the full awards board</a></p>');
  body+=section('covered-markets','Explore country markets','These country dashboards and the regional directory give different views of the same TransformerPath data.',
    '<div class="country-links">'+Object.entries(c.markets).map(([n,m])=>'<a href="/markets/'+m+'/">'+esc(n)+'</a>').join('')+'</div>');
  body+='</main>';
  const clock="(function(){var p=document.getElementById('open-tenders');if(!p)return;var cs=p.querySelectorAll('[data-region-deadline]'),e=p.querySelector('[data-region-empty]');function tick(){var v=0;cs.forEach(function(c){c.hidden=!(Date.parse(c.dataset.regionDeadline)>Date.now());if(!c.hidden)v++;});e.hidden=v>0;}tick();window.addEventListener('pageshow',tick);document.addEventListener('visibilitychange',tick);if(cs.length)window.setInterval(tick,30000);})();";
  return '<!doctype html>\n<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(c.title)+' | TransformerPath</title><meta name="description" content="'+esc(c.desc)+'"><link rel="canonical" href="'+ORIGIN+pathFor(slug)+'"><link rel="icon" href="/brand/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/tp-nav.css"><style>'+CSS+'</style></head><body>'+fixtures.head+body+fixtures.foot+'<script src="/analytics.js" defer></script><script>'+clock+'</script></body></html>\n';
}
module.exports={CONFIG,regionForCountry,pathFor,assertSeed,tendersFor,awardsFor,teasers,render};
