/* Small, independent buyer guides. No stock, eligibility or tender claims. */
'use strict';

const reviewed = '2026-11-28';
const origin = 'https://transformerpath.com';
const guides = {
  'north-america': {
    label: 'North America',
    title: 'North America Transformer Sourcing Guide',
    desc: 'Find transformer manufacturers and official tender routes in the U.S., Canada and Mexico. Use the buyer checklist to compare fit, documents and delivery.',
    scope: 'This guide covers the United States, Canada and Mexico. Federal and public notices are only part of demand: utilities, distributors and private buyers can use separate channels.',
    checks: [
      'For pad-mounted units, specify both voltages, kVA, radial or loop feed, and the cabinet and termination interfaces required by the buyer.',
      'Separate new stock, surplus, and remanufactured units. Ask for the actual nameplate, the test report that corresponds to the unit, any warranty and a dated availability confirmation.',
      'Compare delivery on the same basis: site destination, unloading scope, release date and any required approvals. An announced project is not an open equipment bid.'
    ],
    cards: [
      ['United States','/markets/usa/','/directory/country/usa/','united-states','SAM.gov federal opportunities','https://sam.gov/opportunities'],
      ['Canada','/markets/canada/','/directory/country/canada/','canada','CanadaBuys federal tenders','https://canadabuys.canada.ca/en/tender-opportunities'],
      ['Mexico','/markets/mexico/','/directory/country/mexico/','mexico','CFE procurement notices','https://msc.cfe.mx/']
    ],
    related: [['U.S. pad-mount sourcing checklist','/knowledge/pad-mounted-transformer.html#u-s-sourcing-checklist'],['North America manufacturer directory','/directory/region/north-america/'],['Latin America hub in Spanish','/directory/region/latin-america/es/']]
  },
  'south-america': {
    label: 'South America',
    title: 'South America Transformer Sourcing and Public Tenders',
    desc: 'Find transformer suppliers and buyer portals in Brazil, Chile, Colombia and Peru, and distinguish actual equipment tenders from related grid projects.',
    scope: 'Start with Brazil, Chile, Colombia and Peru. The Latin America hub is a separate multilingual directory covering a wider geography, including Mexico and Central America.',
    checks: [
      'Search the buyer’s portal in the local language. Start with transformador de potência or transformador a seco in Brazil, and transformador de potencia or transformador de distribución in Spanish-speaking markets.',
      'A project award may name a developer or works contractor without naming a transformer manufacturer. Look for the equipment lot and latest amendment before treating it as an order or open bid.',
      'Record the buyer’s exact tender or lot number, bid deadline and local time. A public opening or clarification deadline is not the final submission deadline.'
    ],
    cards: [
      ['Brazil','/markets/brazil/','/directory/country/brazil/','brazil','Compras.gov.br','https://www.gov.br/compras/pt-br'],
      ['Chile','/markets/chile/','/directory/country/chile/','chile','Mercado Público','https://www.mercadopublico.cl/'],
      ['Colombia','/markets/colombia/','/directory/country/colombia/','colombia','Colombia Compra Eficiente · SECOP II','https://www.colombiacompra.gov.co/secop/secop-ii'],
      ['Peru','/markets/peru/','/directory/country/peru/','peru','Peru public procurement portal','https://www.gob.pe/7324-acceder-al-seace']
    ],
    related: [['Latin America hub in English','/directory/region/latin-america/'],['Guía de América Latina en español','/directory/region/latin-america/es/'],['Guia da América Latina em português','/directory/region/latin-america/pt-br/']]
  },
  australia: {
    label: 'Australia & New Zealand',
    title: 'Australia and New Zealand Transformer Sourcing Guide',
    desc: 'Find Australian and New Zealand transformer suppliers, grid profiles and public procurement routes. Check state and utility notices as well as federal portals.',
    scope: 'Australia is the focus, with a separate New Zealand sourcing route. Public procurement, utility registration and individual equipment tenders are different things.',
    checks: [
      'In Australia, start with AusTender for federal opportunities and the relevant utility or state portal for utility purchases. For example, Transgrid publishes its supplier process separately.',
      'For New Zealand, check GETS and the actual buying network company. A portal account does not establish supplier qualification for a notice.',
      'Specify the site, voltage, rating and delivery boundary. Ask whether transport and local unloading, testing or commissioning are part of the quoted scope.'
    ],
    cards: [
      ['Australia','/grids/australia/','/directory/country/australia/','australia','Australian Government procurement guide','https://sellingtogov.finance.gov.au/'],
      ['New Zealand','/grids/new-zealand/','/manufacturers/new-zealand.html','new-zealand','GETS public tenders','https://www.gets.govt.nz/ExternalIndex.htm']
    ],
    external: [['Transgrid supplier process','https://www.transgrid.com.au/about-us/suppliers/']],
    related: [['Oceania manufacturer directory','/directory/region/oceania/'],['Transformer Buyer’s Guide','/buyers-guide.html']]
  }
};

const pathFor = slug => '/markets/' + slug + '/';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const link = ([label,url]) => '<a href="' + esc(url) + '">' + esc(label) + '</a>';
function teasers() {
  return Object.entries(guides).map(([slug,g])=>'<a href="'+pathFor(slug)+'"><strong>'+esc(g.label)+'</strong><span>'+esc(g.desc)+'</span></a>').join('');
}
function render(slug, head, foot) {
  const g = guides[slug];
  const label = slug === 'australia' ? 'Grid profile' : 'Country market';
  const cards = g.cards.map(([name,market,suppliers,tender,portal,url]) =>
    '<article><h3>'+esc(name)+'</h3><ul><li>'+link([label,market])+'</li><li>'+link(['Manufacturer directory',suppliers])+'</li><li>'+
    link(['Transformer tender board','/tenders/country/'+tender+'/'])+'</li><li>'+link([portal,url])+'</li></ul></article>').join('');
  return '<!doctype html>\n<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<title>'+esc(g.title)+' | TransformerPath</title><meta name="description" content="'+esc(g.desc)+'"><meta name="robots" content="index,follow"><link rel="canonical" href="'+origin+pathFor(slug)+'">'+
    '<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/tp-nav.css"><link rel="icon" href="/brand/favicon.svg">'+
    '<style>.buyer-region{width:min(100% - 32px,980px);margin:32px auto 84px}.buyer-region h1{font-size:clamp(1.9rem,5.6vw,3rem);line-height:1.16}.buyer-region p,.buyer-region li{line-height:1.55}.buyer-region section{margin:28px 0}.buyer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,205px),1fr));gap:12px}.buyer-grid article{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;overflow-wrap:anywhere}.buyer-grid ul{padding-left:20px}.buyer-grid a{display:inline-block;padding:5px 0}.buyer-related{display:flex;flex-wrap:wrap;gap:8px 18px}</style></head><body>'+
    head+'<main id="main" tabindex="-1" class="buyer-region"><nav aria-label="Breadcrumb"><a href="/markets.html">Markets</a> › '+esc(g.label)+'</nav>'+
    '<h1>'+esc(g.title)+'</h1><p>'+esc(g.scope)+'</p><p>Guide reviewed <time datetime="'+reviewed+'">28 November 2026</time>. Confirm current qualifications and amendments with the buyer.</p>'+
    '<section aria-labelledby="country-routes"><h2 id="country-routes">Suppliers, tenders and buyer portals</h2><div class="buyer-grid">'+cards+'</div>'+
    ((g.external||[]).length?'<p>'+g.external.map(link).join(' · ')+'</p>':'')+'</section>'+
    '<section aria-labelledby="before-shortlisting"><h2 id="before-shortlisting">Before you shortlist</h2><ol>'+g.checks.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol></section>'+
    '<section aria-labelledby="next-buying-step"><h2 id="next-buying-step">Continue your search</h2><div class="buyer-related">'+g.related.map(link).join(' ')+
    ' <a href="/tenders.html">Global tenders</a> <a href="/rfq.html">Prepare a transformer RFQ</a></div></section></main>'+foot+'</body></html>\n';
}

module.exports = { guides, reviewed, pathFor, teasers, render };
