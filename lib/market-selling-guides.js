'use strict';
// Product- and tender-specific seller checklists, with official starting points.
const GUIDES = {
  europe: {
    title: 'Selling transformers into Europe',
    summary: 'Start with the destination, transformer duty and buyer. Separate EU compliance from utility acceptance, and do not apply EU rules automatically to every European market.',
    steps: [
      ['Define the bid', 'Record the importing country, equipment type, rating, cooling, installation, buyer, route to market and responsibility for import. Check the tender before selecting the design baseline.'],
      ['Check efficiency scope', 'Verify whether the exact transformer falls within EU Ecodesign scope and which loss or efficiency requirements, exclusions and test evidence apply. Ask the buyer for any tighter limits and how losses are evaluated.', [['EUR-Lex: consolidated transformer Ecodesign regulation','https://eur-lex.europa.eu/eli/reg/2014/548/2019-11-14/eng']]],
      ['Check conformity by product', 'Build a list of applicable EU and national requirements. Confirm separately whether CE marking, a Declaration of Conformity, technical documentation or another route applies to the product and included equipment.', [['European Commission: CE marking','https://europa.eu/youreurope/business/product-rules-compliance/general-product-compliance/ce-marking/index_en.htm']]],
      ['Check import and carbon exposure', 'Confirm the customs classification, origin, importer obligations and current measures by line item. Check CBAM coverage by product code rather than assuming it applies to a finished transformer because it contains steel.', [['EU TARIC database','https://taxation-customs.ec.europa.eu/online-services/online-services-and-databases-customs/eu-customs-tariff-taric_en'],['European Commission: CBAM scope and guidance','https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en']]],
      ['Qualify with the buyer', 'Identify the network operator, distributor or EPC. Request its specifications, vendor assessment, accepted test evidence, service expectations and any notice-specific eligibility rules.']
    ],
    links: [['EU and US buyer guide','/guides/us-eu-grid-equipment/'],['Europe procurement routes','#buyer-portals'],['Transformer tenders','/tenders.html'],['Standards directory','/standards.html']]
  },
  india: {
    title: 'Selling transformers into India',
    summary: 'Qualify the exact product and factory before quoting. Certification, efficiency labeling and public tender eligibility are separate checks.',
    steps: [
      ['Classify the product', 'Record the voltage and power ratings, insulation and cooling, transformer type, manufacturing site and buyer. Do not infer one product family’s requirements from another.'],
      ['Check BIS route and scope', 'Verify whether a current quality control order or mandatory certification applies, the exact Indian Standard and product range, and the applicable route for a foreign manufacturer. Confirm the licensed factory and scope when a licence is required.', [['BIS: products under compulsory certification','https://www.bis.gov.in/product-certification/products-under-compulsory-certification/scheme-i-mark-scheme/?lang=en'],['BIS: Foreign Manufacturers Certification Scheme','https://www.bis.gov.in/fmcs/certification-process/aboutfmcs/?lang=en']]],
      ['Check BEE efficiency and labeling', 'Confirm whether the model is in the current labeling schedule and which rating, effective dates, performance figures and test evidence apply. Treat agency labeling and the buyer’s own loss limits as separate requirements.', [['BEE: Standards & Labelling','https://beeindia.gov.in/show_content.php?level=1&lid=322&ls_id=198']]],
      ['Check tender local content', 'Read the tender and current procurement order together. Confirm the qualifying supplier class where applicable, the local-content calculation, documentary proof and any applicable exceptions. Never assume an import may bid on every package.', [['DPIIT: revised public procurement order','https://www.dpiit.gov.in/static/uploads/2025/07/458478309ccf301ceb58f63d02646f42.pdf']]],
      ['Qualify with the utility', 'Request the buyer’s approved-vendor and factory qualification process, accepted labs, test-report validity, references and inspection arrangements. A general license does not put a supplier on a utility’s vendor list.']
    ],
    links: [['Official India tender notices','#india-tenders'],['Suppliers in the India hub','#india-directory'],['India grid and utilities','/grids/india/'],['Standards directory','/standards.html']]
  }
};
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function renderSellerGuide(region) {
  const guide = GUIDES[region];
  if (!guide) return '';
  const links = guide.links.map(([label,href])=>'<li><a href="'+esc(href)+'">'+esc(label)+'</a></li>').join('');
  const references = (items)=>items.length ? ' <span class="seller-references">Read: '+items.map(([label,href])=>'<a href="'+esc(href)+'" rel="noopener">'+esc(label)+'</a>').join(' · ')+'</span>' : '';
  return '<section id="sell-into-market" aria-labelledby="sell-into-market-title" style="margin:26px 0;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--card)">'+
    '<h2 id="sell-into-market-title">'+esc(guide.title)+'</h2><p>'+esc(guide.summary)+'</p>'+
    '<p><strong>Use this checklist before quoting.</strong> Confirm the exact product, import destination and tender with the buyer and a qualified adviser. These links are starting points, not a determination of compliance or eligibility.</p>'+
    '<ol>'+guide.steps.map(([label,body,refs=[]])=>'<li><strong>'+esc(label)+'.</strong> '+esc(body)+references(refs)+'</li>').join('')+'</ol><ul>'+links+'</ul></section>';
}
module.exports={renderSellerGuide};
