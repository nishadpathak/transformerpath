#!/usr/bin/env node
/* build-seo.js — generate programmatic SEO landing pages from data.
 * Currently: /components/<category> pages from components.html's COMPONENTS
 * data. Idempotent: regenerates each page. Later extended for /manufacturers/<country>.
 */
'use strict';
const fs = require('fs');
function extractConst(src, name) {
  const re = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*([\\[{])');
  const m = re.exec(src); const open = m[1], close = open === '[' ? ']' : '}';
  let i = src.indexOf(open, m.index); const start = i; let d = 0, ins = null, e = false, line = false, block = false;
  for (; i < src.length; i++) { const ch = src[i], nx = src[i + 1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && nx === '/') { block = false; i++; } continue; }
    if (ins) { if (e) { e = false; continue; } if (ch === '\\') { e = true; continue; } if (ch === ins) ins = null; continue; }
    if (ch === '/' && nx === '/') { line = true; i++; continue; }
    if (ch === '/' && nx === '*') { block = true; i++; continue; }
    if (ch === '`' || ch === "'" || ch === '"') { ins = ch; continue; }
    if (ch === open) d++; else if (ch === close) { d--; if (d === 0) break; }
  }
  return new Function('return (' + src.slice(start, i + 1) + ')')();
}
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');


const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
const COMPONENTS = extractConst(fs.readFileSync('components.html', 'utf8'), 'COMPONENTS');

const META = {
  'Bushings & Terminations': { slug: 'transformer-bushings', t: 'Transformer Bushings & Terminations', std: 'IEC 60137, IEEE C57.19', app: 'Oil-impregnated paper or resin bushings for HV/LV line connections, terminal plates and cable boxes up to and beyond 550 kV.',
    faq: [['What is the difference between OIP and RIP bushings?', 'Oil-impregnated-paper (OIP) bushings use a vacuum-dried paper core impregnated with oil; resin-impregnated-paper (RIP) bushings use resin-impregnated paper with no free oil, making them a common, more compact choice for sealed and GIS applications.'],
      ['How do I select a transformer bushing?', 'By rated voltage and BIL (impulse withstand), rated current, creepage/pollution class, installation orientation, altitude derating and PD limits — and by compatibility with the fluid or gas above and below the bushing.'],
      ['Why monitor bushing power factor?', 'Capacitance and tan-delta (dissipation factor) drift are early signs of moisture or contamination, so monitoring taps let operators catch problems before failure.']] },
  'Tap-Changers': { slug: 'on-load-tap-changers', t: 'On-Load & De-Energised Tap-Changers (OLTC/DETC)', std: 'IEC 60214', app: 'Ratio regulation under load or off-circuit, vacuum/oil diverter options, motor drives and replacement gears.',
    faq: [['What is the difference between OLTC and DETC?', 'An on-load tap-changer (OLTC) changes the tap position under load without interrupting supply; a de-energised tap-changer (DETC) only changes ratio off-circuit.'],
      ['What does a tap-changer do?', 'It steps the transformer turns ratio up or down to hold the secondary voltage within limits as the load and system voltage vary.'],
      ['What is the most common tap-changer failure?', 'Contact and diverter wear — often detected by acetylene in the oil, which is why OLTC oil tests and condition monitoring are routine.']] },
  'Protection & Monitoring': { slug: 'protection-monitoring', t: 'Protection, Monitoring & Diagnostics', std: 'IEC 60076-7, IEC 60599 (DGA)', app: 'Buchholz, pressure and temperature protection, DGA and partial-discharge monitoring, OLTC and cooling control.',
    faq: [['What protection does a transformer need?', 'Buchholz (gas) and pressure protection for internal faults, temperature/overtemperature for loading, and differential overcurrent protection with the connected network.'],
      ['Why is dissolved-gas analysis (DGA) done?', 'DGA measures the gases dissolved in the oil and diagnoses thermal or electrical faults (partial discharge, arcing, overheating) before they escalate.'],
      ['What does high hydrogen mean?', 'Hydrogen is the classic signature of partial discharge or low-energy sparking; combine it with the other gas ratios to separate PD, thermal and arcing faults.']] },
  'Cooling': { slug: 'transformer-cooling', t: 'Transformer Cooling & Radiators', std: 'IEC 60076-7', app: 'Radiators, coolers, fans, oil pumps and heat exchangers for ONAN/ONAF/OFAF and directed-oil cooling.',
    faq: [['What does ONAN mean?', 'Oil-natural / air-natural cooling: the oil circulates by natural convection and heat leaves through the tank and radiators by natural convection and radiation.'],
      ['How are radiators sized?', 'They are sized to reject the transformer total loss at the design temperature rise, providing enough area and free air flow for the chosen cooling code (ONAN/ONAF/OFAF).'],
      ['What is the difference between ONAF and OFAF?', 'ONAF adds forced-air (fans), while OFAF forces both the oil and the air, supporting higher and more uniform winding temperature in very large transformers.']] },
  'Insulation Materials': { slug: 'insulation-materials', t: 'Transformer Insulation Materials', std: 'IEC 60893, IEC 60641, IEC 60763', app: 'Pressboard, laminated wood, DDP/DPE, aramid and paper for lead exits, barriers, end rings, and winding insulation.',
    faq: [['What is the difference between pressboard and transformerboard?', 'Transformerboard is the general term for electrical insulation board made of pure kraft pulp; pressboard is a higher-density, highly compressed, calendered form used for barriers and structural insulation.'],
      ['What is diamond dotted paper (DDP)?', 'A thin kraft paper coated with a thermosetting resin applied in a diamond pattern and partially cured; it bonds layers on heating and is used for interlayer/interturn insulation.'],
      ['How are insulation materials graded?', 'By density, thickness and finish, chosen for the dielectric stress and mechanical duty, and they must be compatible with the insulating fluid and contaminant-free.']] },
  'Conductors & Core': { slug: 'conductors-and-core', t: 'Conductors, Core & Magnetic Steel', std: 'IEC 60404 (grain-oriented electrical steel)', app: 'CRGO laminations, copper and CTC (continuously transposed) conductors, foil windings and core-building materials.',
    faq: [['What is a continuously transposed conductor (CTC)?', 'A bundle of individually insulated rectangular strands that are continuously transposed so each occupies every radial position, minimising eddy and circulating losses.'],
      ['Why use grain-oriented electrical steel (CRGO)?', 'CRGO has strongly anisotropic magnetic properties along the rolling direction, giving low loss and high permeability for the core.'],
      ['Why transposes matter in a conductor', 'In a large winding, strands see different leakage flux; transposing equalises the induced EMF and evens current sharing, cutting stray (eddy) losses.']] },
  'Oil, Fluids & Preservation': { slug: 'oil-fluids-preservation', t: 'Transformer Oil, Fluids & Preservation', std: 'IEC 60296, IEC 61099, IEC 62770', app: 'Mineral oil, natural/synthetic esters, vacuum and nitrogen preservation, dehydrating breathers and conservator systems.',
    faq: [['What is the difference between mineral oil and ester?', 'Mineral oil is the traditional, low-cost insulating liquid; natural and synthetic esters are biodegradable with higher fire points, used where fire safety and environmental risk matter.'],
      ['What does a conservator do?', 'It accommodates the oil volume change with temperature and, with a dehydrating breather, keeps moisture out of the sealed transformer.'],
      ['Why is oil purity important?', 'Water and dissolved gases lower the dielectric strength and accelerate aging, so oil is tested (DGA, moisture, acidity, breakdown voltage) for condition.']] },
  'Tank & Mechanical': { slug: 'tank-and-mechanical', t: 'Tank, Fittings & Mechanical', std: 'IEC 60076-1', app: 'Tank fabrication, gaskets and seals, valves, conservators, bushings mountings and lifting/transport fittings.',
    faq: [['What does the transformer tank do?', 'It houses the core and windings, serves as the oil container, and provides the structural and heat-transfer envelope of the transformer.'],
      ['Why are gaskets and seals important?', 'They maintain the oil-tight seal and prevent moisture and air ingress, which would degrade the oil and insulation.'],
      ['What fittings does a transformer need?', 'Conservator, breather, valves, thermometers, pressure/vacuum gauges, bushings mountings, lifting/lowering and transport fittings.']] },
};

function page(cat) {
  const meta = META[cat];
  const items = COMPONENTS[cat].map(([n, d]) => `<div class="card"><h3 style="color:var(--ink);margin:0 0 6px">${esc(n)}</h3><p style="color:var(--muted);font-size:.92rem">${esc(d)}</p><p style="margin-top:10px;font-size:.83rem"><a href="../manufacturers.html" style="color:var(--accent);font-weight:700">Find suppliers →</a> · <a href="../rfq.html" style="color:var(--accent);font-weight:700">Request quotes →</a></p></div>`).join('');
  const suppliers = `<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center"><b style="color:var(--text);font-size:.98rem">Request ${esc(meta.t)}?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Post an RFQ to reach relevant manufacturers and suppliers.</p><a class="btn btn-amber" href="../rfq.html" data-track="rfq_started" data-track-component_category="${esc(meta.t)}">Request an RFQ</a> <a class="btn btn-outline btn-sm" href="../list-company.html" data-track="supplier_claim_started" data-track-component_category="${esc(meta.t)}">Supply this? Claim your company →</a></div>`;
  const faq = meta.faq || [];
  const faqSchema = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(function (f) { return { '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }; }) })}</script>`;
  const faqHtml = faq.length ? `<h2 style="font-size:1.2rem;color:var(--ink);margin-top:26px">Frequently asked</h2>` + faq.map(function (f) { return `<div style="margin:12px 0"><b style="color:var(--ink)">${esc(f[0])}</b><p style="color:var(--text);margin:4px 0 0;line-height:1.7">${esc(f[1])}</p></div>`; }).join('') : '';
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(meta.t)} — Directory | TransformerPath</title>
<meta name="description" content="${esc(meta.t)} — a directory of transformer ${esc(meta.app.split('.')[0].toLowerCase())} with suppliers and standards (${esc(meta.std)}). Find manufacturers, compare and request quotes.">
<link rel="canonical" href="https://transformerpath.com/components/${meta.slug}.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="${esc(meta.t)} — TransformerPath">
<meta property="og:url" content="https://transformerpath.com/components/${meta.slug}.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<link rel="stylesheet" href="../style.css?v=5"><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><link rel="preconnect" href="https://www.google-analytics.com">
<link rel="icon" type="image/svg+xml" href="../brand/favicon.svg"><link rel="icon" href="../brand/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="../brand/apple-touch-icon.png">
${faqSchema}
<style>
  .c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}
  .c-wrap h1{font-size:1.9rem;color:var(--ink)}
  .c-wrap .lead{color:var(--muted);font-size:1rem;margin:6px 0 8px}
  .c-wrap .std{color:var(--accent);font-size:.82rem;font-weight:700}
  .grid{display:grid;gap:16px}
</style>
</head>
<body>
${HEAD}
<main class="c-wrap">
  <nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="../components.html" style="color:var(--accent)">Components</a> › ${esc(meta.t)}</nav>
  <h1>${esc(meta.t)}</h1>
  <p class="std">Standards: ${esc(meta.std)}</p>
  <p class="lead">${esc(meta.app)}</p>
  <div class="grid">${items}</div>
  ${faqHtml}
  <div style="margin-top:16px">${suppliers}</div>
  <div style="font-size:.85rem;color:var(--muted);text-align:center;margin-top:10px">Learn more: <a href="../knowledge.html" style="color:var(--accent);font-weight:600">Knowledge</a> · <a href="../applications.html" style="color:var(--accent);font-weight:600">Applications</a> · <a href="../books.html" style="color:var(--accent);font-weight:600">Books</a> · <a href="../academy.html" style="color:var(--accent);font-weight:600">Academy</a></div>
  <p style="font-size:.78rem;color:var(--muted);margin-top:22px">Directory entries are compiled from public sources and, where applicable, confirmed by the company. Verification confirms stated credentials — it is not a guarantee of quality or performance.</p>
</main>
${FOOT}
<script src="../analytics.js?v=2" defer></script>
</body>
</html>`;
}

fs.mkdirSync('components', { recursive: true });
const indexLinks = [];
for (const cat of Object.keys(COMPONENTS)) {
  const meta = META[cat];
  fs.writeFileSync('components/' + meta.slug + '.html', page(cat));
  indexLinks.push(`<a href="components/${meta.slug}.html">${meta.t}</a>`);
  console.log('OK components/' + meta.slug + '.html');
}
console.log('generated', indexLinks.length, 'component pages');

/* ── Per-country manufacturer pages (/manufacturers/<country>) ─────────────── */
function slugify(n){ return String(n).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/&/g,'and').replace(/['’´]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''); }
const MGF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
var CSMAP={}; try{ JSON.parse(fs.readFileSync('data/company-slugs.json','utf8')).forEach(function(c){ CSMAP[c.name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()] = c.slug; }); }catch(e){}

const vbadge2 = (m) => { const f = m.length > 4 ? m[4] : null; if (f === 'P') return ' <span class="v-badge pro">★ Supplier Pro</span>'; if (f === 'V') return ' <span class="v-badge">✓ Verified</span>'; return ''; };
const tpills2 = (types) => { if (!types) return ''; const T = { PT: 'Power', DT: 'Distribution', DRY: 'Dry/Cast' }; return types.split(',').map((t) => t.trim()).filter(Boolean).map((t) => '<span class="tpill t-' + t + '">' + esc(T[t] || t) + '</span>').join(''); };
fs.mkdirSync('manufacturers', { recursive: true });
let countryIndex = [];
for (const c of MGF) {
  if (!c.makers.some(function(x){ return !/^Served by/i.test(x[0]); })) continue;
  const slug = slugify(c.country);
  const real = c.makers.filter((m) => !/^Served by/i.test(m[0]).valueOf() && !/^Served by/i.test(m[0]));
  const rows = c.makers.map((m) => /^Served by/i.test(m[0])
    ? '<div class="mk-row"><span class="note">' + esc(m[0]) + '</span></div>'
    : '<div class="mk-row"><b>' + (CSMAP[esc(m[0]).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()] ? '<a href="' + CSMAP[esc(m[0]).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()] + '/" style="color:var(--accent)">' + esc(m[0]) + '</a>' : esc(m[0])) + vbadge2(m) + tpills2(m[3]) + '</b><span class="city">' + esc(m[1] || '') + (m[5] ? ' · est. ' + esc(m[5]) : '') + '</span><a class="prof" href="../manufacturers.html" style="font-size:.68rem">Directory</a>' + (m[2] ? '<a href="' + esc(m[2]) + '" target="_blank" rel="noopener" class="prof">Site</a>' : '') + '</div>').join('');
  const html = '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(c.country) + ' Transformer Manufacturers | TransformerPath</title>\n<meta name="description" content="Power, distribution and dry-type transformer manufacturers and suppliers in ' + esc(c.country) + '. Reserve, compare and request quotes.">\n<link rel="canonical" href="https://transformerpath.com/manufacturers/' + slug + '.html">\n<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="' + esc(c.country) + ' Transformer Manufacturers"><meta property="og:url" content="https://transformerpath.com/manufacturers/' + slug + '.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">\n<link rel="stylesheet" href="../style.css?v=5"><link rel="preconnect" href="https://www.googletagmanager.com" crossorigin><link rel="preconnect" href="https://www.google-analytics.com"><link rel="icon" type="image/svg+xml" href="../brand/favicon.svg"><link rel="icon" href="../brand/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="../brand/apple-touch-icon.png">\n<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem}.c-wrap .mk-row{display:flex;align-items:baseline;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:.95rem}.c-wrap .mk-row b{color:var(--ink)}.c-wrap .mk-row .city{color:var(--muted);font-size:.85rem}.c-wrap .mk-row .prof{color:var(--accent);font-size:.8rem;font-weight:600;margin-left:auto}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:1px 8px;font-size:.7rem;color:var(--text);margin-left:4px}.c-wrap .v-badge{color:var(--green);font-size:.7rem;font-weight:700}</style>\n</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">\n<nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="../manufacturers.html" style="color:var(--accent)">Manufacturers</a> \u203a ' + esc(c.country) + '</nav>\n<h1>' + esc(c.flag) + ' Transformer Manufacturers in ' + esc(c.country) + '</h1>\n<p class="lead">' + real.length + ' manufacturer' + (real.length !== 1 ? 's' : '') + ' listed in ' + esc(c.country) + ' (' + esc(c.region) + '). Power, distribution and dry-type transformer suppliers.</p>\n<div>' + rows + '</div>\n<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:16px"><b style="color:var(--text)">Looking for a transformer supplier?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Submit a requirement and TransformerPath can match it against relevant manufacturers.</p><a class="btn btn-amber" href="../rfq.html" data-track="rfq_started" data-track-country="'+esc(c.country)+'">Submit an RFQ</a> <a class="btn btn-outline btn-sm" href="../list-company.html" data-track="supplier_claim_started" data-track-country="'+esc(c.country)+'">Listed here? Claim your company →</a></div>\n</main>\n' + FOOT + '\n<script src="../analytics.js?v=2" defer></script>\n</body>\n</html>';
  fs.writeFileSync('manufacturers/' + slug + '.html', html);
  countryIndex.push('<a href="manufacturers/' + slug + '.html">' + esc(c.country) + '</a>');
  if (MGF.indexOf(c) < 5) console.log('OK manufacturers/' + slug + '.html');
}
console.log('generated', countryIndex.length, 'country pages');

/* ── Product-type & Type-Country Combination Hubs ──────────────────────── */
const TYPE_HUBS = [
  { code: 'PT', slug: 'power-transformers', name: 'Power Transformers', desc: 'Global directory of large, medium, and transmission-class power transformer manufacturers. GSU, autotransformers, HVDC converter transformers up to 1,200 kV.' },
  { code: 'DT', slug: 'distribution-transformers', name: 'Distribution Transformers', desc: 'Directory of liquid-filled distribution transformer manufacturers. Pad-mounted, pole-mounted, substation distribution units compliant with IEC and IEEE.' },
  { code: 'DRY', slug: 'dry-type-transformers', name: 'Dry-Type Transformers', desc: 'Manufacturers of cast resin and vacuum pressure impregnated (VPI) dry-type transformers for commercial buildings, data centres, renewables, and hazardous areas.' }
];

let typeHubCount = 0;
let comboHubCount = 0;

TYPE_HUBS.forEach(function (th) {
  const typeDir = 'manufacturers/' + th.slug;
  fs.mkdirSync(typeDir, { recursive: true });

  // Gather all manufacturers of this type
  const allMakersOfType = [];
  const byCountry = {};

  MGF.forEach(function (c) {
    (c.makers || []).forEach(function (m) {
      if (/^Served by/i.test(m[0])) return;
      const types = (m[3] || '').toUpperCase();
      if (types.indexOf(th.code) >= 0) {
        const item = { name: m[0], city: m[1], url: m[2], types: m[3], flagV: m[4], est: m[5], country: c.country, flag: c.flag, countrySlug: slugify(c.country) };
        allMakersOfType.push(item);
        if (!byCountry[c.country]) byCountry[c.country] = [];
        byCountry[c.country].push(item);
      }
    });
  });

  function renderHub(title, lead, makersList, canonicalPath, breadcrumbs, isNoindex) {
    const rows = makersList.map(function (m) {
      const cslug = CSMAP[m.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()];
      const nameLink = cslug ? '<a href="/manufacturers/' + cslug + '/" style="color:var(--accent);font-weight:700">' + esc(m.name) + '</a>' : '<b style="color:var(--text)">' + esc(m.name) + '</b>';
      const vb = m.flagV === 'P' ? ' <span class="v-badge pro">★ Supplier Pro</span>' : (m.flagV === 'V' ? ' <span class="v-badge">✓ Verified</span>' : '');
      const siteLink = m.url ? '<a href="' + esc(m.url) + '" target="_blank" rel="noopener nofollow" style="color:var(--muted);font-size:.78rem" data-track="official_website_click" data-track-manufacturer="' + esc(m.name) + '">Official website ↗</a>' : '';
      return '<div class="mk-row" style="display:flex;align-items:baseline;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:.92rem">' +
        '<div>' + nameLink + vb + '<div style="color:var(--muted);font-size:.8rem">' + esc(m.city ? m.city + ', ' : '') + esc(m.country) + (m.est ? ' · est. ' + esc(m.est) : '') + '</div></div>' +
        '<div style="margin-left:auto;display:flex;align-items:center;gap:10px">' + siteLink +
        ' <a class="btn btn-outline btn-sm" href="/compare.html?m=' + (cslug || slugify(m.name)) + '" style="font-size:.7rem;padding:2px 8px">Compare</a>' +
        ' <a class="btn btn-amber btn-sm" href="/rfq.html?spec=' + encodeURIComponent(title) + '&vendor=' + encodeURIComponent(m.name) + '" style="font-size:.7rem;padding:2px 8px">RFQ</a>' +
        '</div></div>';
    }).join('');

    const crumbs = breadcrumbs.map(function (b, idx) {
      return idx < breadcrumbs.length - 1 ? '<a href="' + b.url + '" style="color:var(--accent)">' + esc(b.name) + '</a> › ' : esc(b.name);
    }).join('');

    return '<!DOCTYPE html>\n<html lang="en" data-theme="dark">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + esc(title) + ' | TransformerPath</title>\n' +
      '<meta name="description" content="' + esc(lead.slice(0, 155)) + '">\n' +
      '<link rel="canonical" href="https://transformerpath.com/' + canonicalPath + '">\n' +
      '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">\n' +
      '<meta property="og:title" content="' + esc(title) + '"><meta property="og:url" content="https://transformerpath.com/' + canonicalPath + '">\n' +
      '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="' + (isNoindex ? 'noindex,follow' : 'index,follow') + '">\n' +
      '<link rel="stylesheet" href="/style.css?v=12"><link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">\n' +
      '<style>.c-wrap{max-width:920px;margin:0 auto;padding:44px 20px 90px}.c-wrap h1{font-size:2rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1.02rem;line-height:1.6}.c-wrap .v-badge{color:var(--green);font-size:.72rem;font-weight:700}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.74rem;color:var(--text);margin:3px 4px 3px 0}</style>\n' +
      '</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">\n' +
      '<nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px">' + crumbs + '</nav>\n' +
      '<h1>' + esc(title) + '</h1>\n' +
      '<p class="lead">' + esc(lead) + ' Listing ' + makersList.length + ' verified manufacturers with technical capabilities, locations, comparison tools, and direct RFQ channels.</p>\n' +
      '<div style="margin:20px 0">' + rows + '</div>\n' +
      '<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:18px 20px;text-align:center;margin-top:28px">' +
      '<b style="color:var(--text);font-size:1.1rem">Procuring ' + esc(title) + '?</b>' +
      '<p style="color:var(--muted);font-size:.9rem;margin:6px 0 14px">Submit your required MVA, voltage class, and standards to receive direct quotes from matched global manufacturers.</p>' +
      '<a class="btn btn-amber" href="/rfq.html?spec=' + encodeURIComponent(title) + '">Submit Technical RFQ</a> ' +
      '<a class="btn btn-outline btn-sm" href="/directory.html" style="margin-left:8px">Open Sourcing Directory →</a>' +
      '</div>\n' +
      '<div class="card" style="background:var(--bg);border:1px solid var(--border);padding:14px 18px;text-align:center;margin-top:14px">' +
      '<b style="color:var(--text)">Find something inaccurate or missing?</b>' +
      '<p style="color:var(--muted);font-size:.85rem;margin:4px 0 10px">Help keep the global transformer industry database clean and verified.</p>' +
      '<a class="btn btn-outline btn-sm" href="/correct-company.html" data-track="manufacturer_correction_started">Suggest a correction →</a>' +
      '</div>\n' +
      '</main>\n' + FOOT + '\n<script src="/analytics.js?v=2" defer></script>\n</body>\n</html>';
  }

  // 1. Overall product-type page
  const globalHtml = renderHub(
    th.name + ' Manufacturers',
    th.desc,
    allMakersOfType,
    'manufacturers/' + th.slug + '/',
    [{ name: 'Home', url: '/' }, { name: 'Manufacturers', url: '/manufacturers.html' }, { name: th.name, url: '/manufacturers/' + th.slug + '/' }]
  );
  fs.writeFileSync(typeDir + '/index.html', globalHtml);
  typeHubCount++;

  // 2. Combination pages: Type + Country (anti-thin content gate: makers >= 3)
  Object.keys(byCountry).forEach(function (countryName) {
    const list = byCountry[countryName];
    if (list.length >= 3) {
      const cslug = slugify(countryName);
      const comboDir = typeDir + '/' + cslug;
      fs.mkdirSync(comboDir, { recursive: true });
      const comboTitle = th.name + ' Manufacturers in ' + countryName;
      const comboLead = 'Verified ' + th.name.toLowerCase() + ' manufacturers and suppliers based in ' + countryName + '.';
      const comboHtml = renderHub(
        comboTitle,
        comboLead,
        list,
        'manufacturers/' + th.slug + '/' + cslug + '/',
        [
          { name: 'Home', url: '/' },
          { name: 'Manufacturers', url: '/manufacturers.html' },
          { name: th.name, url: '/manufacturers/' + th.slug + '/' },
          { name: countryName, url: '/manufacturers/' + th.slug + '/' + cslug + '/' }
        ],
        true
      );
      fs.writeFileSync(comboDir + '/index.html', comboHtml);
      comboHubCount++;
    }
  });
});
console.log('generated', typeHubCount, 'type hubs and', comboHubCount, 'type-country combination hubs');

/* ── Sitemap: one consistent sitemap, regenerated every build ────────────
   Covers all indexable pages (main + generated + dated Intel editions) so it
   never drifts from the pages actually on disk. */
(function () {
  var SITEMAP_SKIP = ['404.html', 'offline.html', 'admin.html', 'index.html'];
  var MAIN = [''].concat(
    fs.readdirSync('.')
      .filter(function (f) { return /\.html$/.test(f); })
      .filter(function (f) { return f.charAt(0) !== '_'; })
      .filter(function (f) { return SITEMAP_SKIP.indexOf(f) < 0; })
      .filter(function (f) { return !/^intel-2026-/.test(f); })
      .filter(function (f) {
        var html = '';
        try { html = fs.readFileSync(f, 'utf8'); } catch (e) { return false; }
        if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) return false;
        if (/http-equiv=["']refresh["']/i.test(html)) return false;
        return true;
      })
      .sort()
  );
  var urls = [];
  MAIN.forEach(function (u) { urls.push('https://transformerpath.com/' + (u || '')); });
  ['manufacturers', 'components', 'applications', 'knowledge'].forEach(function (dir) {
    try { fs.readdirSync(dir).filter(function (f) { return f.endsWith('.html'); }).sort().forEach(function (f) { urls.push('https://transformerpath.com/' + dir + '/' + f); }); } catch (e) {}
  });

  // Scan subdirectories with index.html
  ['components', 'materials', 'grids', 'topics', 'markets', 'events', 'accessories', 'projects', 'tenders', 'utilities', 'case-studies', 'books'].forEach(function (dir) {
    try {
      fs.readdirSync(dir).forEach(function (d) {
        if (fs.existsSync(dir + '/' + d + '/index.html')) urls.push('https://transformerpath.com/' + dir + '/' + d + '/');
      });
    } catch (e) {}
  });

  // Scan manufacturers company directories and type/combo hubs
  try {
    var IDX = {}; try { JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (c) { if (c.indexable) IDX[c.slug] = 1; }); } catch (e) {}
    fs.readdirSync('manufacturers').forEach(function (d) {
      if (fs.existsSync('manufacturers/' + d + '/index.html')) {
        if (IDX[d] || TYPE_HUBS.some(th => th.slug === d)) {
          urls.push('https://transformerpath.com/manufacturers/' + d + '/');
          // check combinations under type hubs
          if (TYPE_HUBS.some(th => th.slug === d)) {
            try {
              fs.readdirSync('manufacturers/' + d).forEach(function (sub) {
                var subPath = 'manufacturers/' + d + '/' + sub + '/index.html';
                if (fs.existsSync(subPath)) {
                  try {
                    var subHtml = fs.readFileSync(subPath, 'utf8');
                    if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(subHtml)) return;
                  } catch (e) { return; }
                  urls.push('https://transformerpath.com/manufacturers/' + d + '/' + sub + '/');
                }
              });
            } catch (e) {}
          }
        }
      }
    });
  } catch (e) {}

  try { fs.readdirSync('.').filter(function (f) { return /^intel-2026-.*\.html$/.test(f); }).sort().forEach(function (f) { urls.push('https://transformerpath.com/' + f); }); } catch (e) {}
  var lastmod = new Date().toISOString().slice(0, 10);
  var sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(function (u) { return '  <url><loc>' + u + '</loc><lastmod>' + lastmod + '</lastmod></url>'; }).join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync('sitemap.xml', sm);
  console.log('sitemap.xml wrote', urls.length, 'URLs');
})();
