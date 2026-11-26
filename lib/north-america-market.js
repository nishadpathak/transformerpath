'use strict';

/* North America uses existing country routes, procurement data and engineering
 * guides. This module adds a regional entry point, not another company corpus. */
const { tendersFor, deadline } = require('./regional-market-hubs');
const HUB = '/markets/north-america/';
const GUIDE = HUB + 'us-seller-guide/';
const ORIGIN = 'https://transformerpath.com';
const COUNTRIES = [
  { slug: 'usa', country: 'United States', short: 'United States', tender: 'united-states',
    buyer: 'Start with the named utility, EPC or industrial purchaser in the opportunity. A grid operator profile is a route to context, not proof that the operator is the buyer.' },
  { slug: 'canada', country: 'Canada', short: 'Canada', tender: 'canada',
    buyer: 'Identify the provincial or project buyer before opening a vendor account. The grid directory starts with the relevant operators; the actual notice identifies where to bid.' },
  { slug: 'mexico', country: 'Mexico', short: 'Mexico', tender: 'mexico',
    buyer: 'Start with the buyer named in the notice. For a CFE opportunity, use the channel in the notice for documents and submission; the market and grid pages provide context.',
    regional: '/directory/region/latin-america/', regionalLabel: 'Latin America market guide' }
];
const STEPS = [
  { name: 'Choose the buyer and product lane', text: 'Start with one compatible product family: power transformers, distribution units, or a specified component. Identify whether you are quoting to a utility, an EPC or a distributor. Ask who controls the specification and whose approved-vendor list applies.',
    label: 'Buyer directory', href: '/buyers.html' },
  { name: 'Get the actual specification before quoting', text: 'Ask for the bid reference, specification revision and exceptions process. Capture duty, rating and voltage, impedance, cooling, applicable standard and edition, losses, interfaces, drawings and acceptance criteria. For a component, ask for the manufacturer part number and drawing revisions; do not assume a physical fit means interchangeability.',
    label: 'Transformer inquiry checklist', href: '/guides/transformer-inquiry/' },
  { name: 'Assemble evidence for the factory and product', text: 'Name the manufacturing site and document its scope. Bring relevant reference units, current test reports, a quality plan and a draft inspection or factory acceptance test plan. Make any design, material or test exceptions explicit. A directory listing is not buyer qualification.',
    label: 'Factory acceptance testing guide', href: '/guides/factory-acceptance-tests/' },
  { name: 'Confirm who handles delivery and service', text: 'Put the importer, handover point, transport and lifting responsibilities, commissioning support, warranty response, spare parts and contacts in writing. Quote a lead time only after confirming an actual factory slot and the buyer’s delivery basis.',
    label: 'Transformer service directory', href: '/services.html' },
  { name: 'Have the buyer and importer confirm their requirements', text: 'Ask which origin, ownership, traceability, vendor registration and contract requirements apply to this specific order. Have the importer or qualified advisers check customs treatment and any restrictions before you promise eligibility, landed cost or a duty rate. This guide is not a legal clearance.',
    label: 'Existing US/EU buyer reference (read its scope and date)', href: '/guides/us-eu-grid-equipment/' }
];
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const A = (url,label) => '<a href="'+ESC(url)+'">'+ESC(label)+'</a>';
const ID = slug => slug && COUNTRIES.some(c => c.slug === slug) ? 'north-america-'+slug : '';
const tenderPath = c => '/tenders/country/'+c.tender+'/';
const directoryPath = c => '/directory/country/'+c.slug+'/';
const countryPath = c => '/markets/'+c.slug+'/';
const buyerPath = c => '/grids/'+c.slug+'/';
const CONFIG = { countries: COUNTRIES.map(c=>c.country) };
const STYLES = `
.na-market{max-width:1050px;margin:auto;padding:30px clamp(15px,4vw,42px) 62px;color:var(--text)}
.na-market h1{font-size:clamp(1.9rem,5vw,3rem);line-height:1.12;color:var(--ink);margin:.6rem 0}
.na-market h2,.na-market h3{color:var(--ink);margin:.4rem 0}.na-market h2{font-size:1.45rem}
.na-market .na-kicker{color:var(--accent);text-transform:uppercase;letter-spacing:.06em;font-size:.8rem;font-weight:750}.na-market p,.na-market li{line-height:1.55}.na-market p{margin:.6rem 0}
.na-market a,.na-country a{color:var(--accent)}.na-market a:focus-visible,.na-country a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.na-hero{max-width:72ch}.na-market section{margin:1.5rem 0;scroll-margin-top:85px}.na-market .na-note{color:var(--muted);font-size:.9rem}
.na-market .na-links{display:flex;gap:8px;flex-wrap:wrap;margin:.75rem 0}.na-market .na-links a{display:inline-flex;align-items:center;min-height:44px;padding:5px 10px;border:1px solid var(--border);border-radius:8px}
.na-market .na-primary{font-weight:750;background:var(--card);border-color:var(--accent)!important}
.na-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:.8rem}
.na-card,.na-step{min-width:0;overflow-wrap:anywhere;border:1px solid var(--border);border-radius:12px;background:var(--card);padding:14px}.na-step{margin:.65rem 0}
.na-market .na-steps{padding-left:1.45rem}
.na-market [hidden]{display:none!important}
.na-country{margin:1rem 0;padding:10px 14px;border:1px solid var(--border);border-radius:9px;background:var(--card)}
`;
function teaser() {
  return '<a href="'+HUB+'"><strong>North America</strong><span>Start with the US seller guide, then browse the United States, Canada and Mexico.</span></a>';
}
function countryGuideLinks(slug) {
  if (!ID(slug)) return '';
  return '<nav class="na-country" aria-label="North America market guides"><strong>Market guides:</strong> '+
    A(HUB,'North America hub')+' · '+A(GUIDE,slug==='usa'?'Start with the US seller guide':'Selling into the US: seller guide')+'</nav>';
}
function countryCards() {
  return '<div class="na-grid">'+COUNTRIES.map(c=>'<article class="na-card" id="'+ID(c.slug)+'"><h3>'+ESC(c.short)+'</h3><p>'+ESC(c.buyer)+'</p><ul>'+[
    [countryPath(c),'Market dashboard'],[buyerPath(c),'Grid operators and buyer context'],
    [directoryPath(c),'Manufacturer directory'],[tenderPath(c),'Country tender board'],
    ...(c.regional?[[c.regional,c.regionalLabel]]:[])
  ].map(([url,label])=>'<li>'+A(url,label)+'</li>').join('')+'</ul></article>').join('')+'</div>';
}
function watch(rows, now) {
  const tenders = tendersFor(rows, CONFIG, now);
  return '<section id="na-open" aria-labelledby="na-open-title"><h2 id="na-open-title">Published bid deadlines</h2>'+
  '<p class="na-note">Selected official notices with an exact future deadline. Check the buyer’s portal for changes, qualification and submission instructions. Contract awards are separate.</p>'+
  '<p data-na-empty'+(tenders.length?' hidden':'')+'>No qualifying notices in this view. Check the country tender boards for further notices and status history.</p>'+
  '<div class="na-grid">'+tenders.map(t=>'<article class="na-card" data-na-close="'+ESC(t.close)+'" data-listing="tender"><p>'+ESC(t.country)+(t.ref?' · '+ESC(t.ref):'')+'</p><h3>'+ESC(t.title)+'</h3><p>Official published deadline: <time datetime="'+ESC(t.close)+'">'+ESC(deadline(t))+'</time></p><p>'+A(t.source,'Read the official notice')+'</p></article>').join('')+'</div>'+
  '<p>'+A('/tenders.html?status=open','Open tenders board')+' · '+A('/awards.html','Contract awards board')+'</p></section>';
}
const CLOCK = "(function(){var p=document.getElementById('na-open');if(!p)return;var cs=p.querySelectorAll('[data-na-close]'),e=p.querySelector('[data-na-empty]');function tick(){var v=0;cs.forEach(function(c){c.hidden=!(Date.parse(c.dataset.naClose)>Date.now());if(!c.hidden)v++;});e.hidden=v>0;}tick();window.addEventListener('pageshow',tick);document.addEventListener('visibilitychange',tick);if(cs.length)window.setInterval(tick,30000);})();";
function hubBody(rows, now) {
  return '<nav aria-label="Breadcrumb">'+A('/markets.html','Markets')+' / North America</nav>'+
    '<p class="na-kicker">Transformer procurement and sourcing</p><h1>North America Transformer Hub</h1>'+
    '<p class="na-hero">Find buyers and suppliers across the United States, Canada and Mexico. Start with the US seller guide if you plan to quote into the United States; use the country pages to find local operators, manufacturers and tender boards.</p>'+
    '<nav class="na-links" aria-label="Hub sections"><a class="na-primary" href="'+GUIDE+'">Start with the US seller guide</a><a href="#na-country-boards">Country routes</a>'+'<a href="#na-open">Bid deadlines</a>'+'<a href="#na-market-guides">Related guides</a></nav>'+
    '<section id="na-country-boards" aria-labelledby="na-country-title"><h2 id="na-country-title">Find buyers, suppliers and tenders by country</h2>'+countryCards()+
    '<p>'+A('/directory/region/north-america/','North America manufacturer directory')+' · '+A('/buyers.html','Buyer directory')+'</p></section>'+
    watch(rows,now)+
    '<section id="na-market-guides" aria-labelledby="na-market-guides-title"><h2 id="na-market-guides-title">Market and procurement guides</h2><ul><li>'+A(GUIDE,'United States seller guide: before you quote')+'</li><li>'+A('/guides/transformer-inquiry/','Write a transformer inquiry')+'</li><li>'+A('/guides/factory-acceptance-tests/','Plan factory acceptance tests')+'</li><li>'+A('/guides/us-eu-grid-equipment/','Read the separate US/EU buyer reference')+'</li></ul></section>';
}
function guideBody() {
  return '<nav aria-label="Breadcrumb">'+A('/markets.html','Markets')+' / '+A(HUB,'North America')+' / US seller guide</nav>'+
    '<p class="na-kicker">First quote checklist</p><h1>Selling Transformers into the US</h1>'+
    '<p class="na-hero">For transformer and component suppliers preparing a first US quote. Use this checklist to decide what you can offer, what the buyer needs to confirm and what to resolve before pricing.</p>'+
    '<div class="na-links">'+A('#na-seller-checklist','Go to the seller checklist')+A(countryPath(COUNTRIES[0]),'US market dashboard')+A(tenderPath(COUNTRIES[0]),'US tender board')+'</div>'+
    '<section id="na-seller-checklist" aria-labelledby="na-check-title"><h2 id="na-check-title">Before you quote</h2><ol class="na-steps">'+STEPS.map(s=>'<li class="na-step"><h3>'+ESC(s.name)+'</h3><p>'+ESC(s.text)+'</p><p>'+A(s.href,s.label)+'</p></li>').join('')+'</ol></section>'+
    '<section id="na-seller-pack" aria-labelledby="na-pack-title"><h2 id="na-pack-title">What to send to the buyer</h2><p>Send a short capability statement, the named facility, a completed technical compliance and exceptions table, relevant test reports, a realistic delivery schedule and the division of service responsibilities. Include the bid reference and revision date on every attachment.</p>'+
    '<p class="na-note">Verify the current specification and amendments with the issuing buyer. For distribution transformer efficiency, check the DOE scope and compliance dates for the model. Ask the importer or customs adviser to confirm the applicable tariff classification and measures.</p>'+
    '<p>'+A(HUB,'Back to the North America hub')+' · '+A(directoryPath(COUNTRIES[0]),'US manufacturer directory')+' · '+A('https://www.energy.gov/cmei/buildings/distribution-transformers','US DOE: distribution transformer standards')+' · '+A('https://www.usitc.gov/harmonized_tariff_information','USITC: US tariff schedule')+'</p></section>';
}
function page({ guide=false, head='', foot='', rows=[], now=Date.now() }={}) {
  const url=guide?GUIDE:HUB;
  const title=guide?'Selling Transformers into the US | TransformerPath':'North America Transformer Hub & Guide | TransformerPath';
  const desc=guide?'A practical checklist for transformer and component suppliers preparing a US quote: identify the buyer, verify the specification and assemble qualification evidence.':'Explore transformer buyer routes, country directories, procurement notices and a US seller guide for the United States, Canada and Mexico.';
  return '<!doctype html>\n<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+ESC(title)+'</title><meta name="description" content="'+ESC(desc)+'"><link rel="canonical" href="'+ORIGIN+url+'"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/tp-nav.css"><style>'+STYLES+'</style></head><body>'+head+'<main id="main" class="na-market">'+(guide?guideBody():hubBody(rows,now))+'</main>'+foot+'<script src="/analytics.js" defer></script>'+(guide?'':'<script>'+CLOCK+'</script>')+'</body></html>\n';
}
module.exports={HUB,GUIDE,COUNTRIES,STEPS,teaser,countryGuideLinks,page};
