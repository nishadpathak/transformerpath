#!/usr/bin/env node
/* build-components.js — Transformer Component Manufacturers Directory (Deep Dive).
 *
 * Generates components.html — comprehensive deep-dive directory organized across
 * all 21 component categories (Category -> Country -> State/Province) with verified
 * supplier records, technical specifications, and RFQ board actions.
 *
 * Sourced from data/components-deep-dive.json.
 * Run: node build-components.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function slugify(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
const ACC_SLUGS = new Set();
try {
  fs.readdirSync('accessories').forEach(function (n) {
    if (fs.existsSync(path.join('accessories', n, 'index.html'))) ACC_SLUGS.add(n);
  });
} catch (e) {}

const DATA = JSON.parse(fs.readFileSync('data/components-deep-dive.json', 'utf8'));
const CATEGORIES = DATA.categories || [];
const deepDiveJson = JSON.stringify(CATEGORIES);

let totalSuppliers = 0;
CATEGORIES.forEach(c => { totalSuppliers += (c.suppliers || []).length; });

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Transformer Component Manufacturers Directory (Deep Dive) | TransformerPath</title>
<meta name="description" content="Global directory of verified transformer component, insulator, and accessory manufacturers across 22 specialized categories: bushings, high-voltage insulators, tap changers, Buchholz relays, radiators, breathers, pressboard, CTC, CRGO, and test equipment.">
<link rel="canonical" href="https://transformerpath.com/components.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Transformer Component Manufacturers Directory (Deep Dive) | TransformerPath">
<meta property="og:description" content="Specialized directory of component and insulator manufacturers across 22 categories: Bushings, HV Insulators, OLTCs, Relays, Radiators, Pressboard, CRGO, CTC, and Testing Equipment.">
<meta property="og:url" content="https://transformerpath.com/components.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=14">
<link rel="stylesheet" href="tp-nav.css?v=15">
<link rel="stylesheet" href="tp-feedback.css?v=12">
<style>
.comp-wrap { max-width: 1160px; margin: 0 auto; padding: 40px 20px 90px; }
.comp-head { margin-bottom: 24px; }
.comp-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; }
.comp-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 900px; line-height: 1.5; margin: 0 0 20px; }

.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 28px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; display: flex; flex-direction: column; gap: 14px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }

.cat-pills-bar { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 22px; }
.cat-pill-btn { background: var(--card); border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; font-size: .82rem; color: var(--text); cursor: pointer; transition: all .15s; }
.cat-pill-btn:hover, .cat-pill-btn.active { background: var(--accent); color: var(--navy); border-color: var(--accent); font-weight: 700; }

.deep-section { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 24px; margin-bottom: 24px; }
.deep-sec-head { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px; }
.deep-sec-title { font-size: 1.3rem; font-weight: 800; color: var(--accent); margin: 0; }
.deep-sec-scope { color: var(--muted); font-size: .88rem; margin: 4px 0 0; }

.supplier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.supp-card { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; }
.supp-card:hover { border-color: var(--accent); }
.supp-name { font-size: 1.08rem; font-weight: 700; color: var(--ink); margin: 0 0 4px; }
.supp-loc { font-size: .82rem; color: var(--muted); margin-bottom: 8px; }
.supp-desc { font-size: .85rem; color: var(--text); line-height: 1.45; margin-bottom: 12px; }
.ev-badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.ev-confirmed { background: rgba(22,163,74,.14); color: #16a34a; border: 1px solid #16a34a; }

.supp-foot { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--border); }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Transformer Component Manufacturers Directory (Deep Dive)",
  "url": "https://transformerpath.com/components.html",
  "description": "Global deep-dive directory of transformer component and accessory manufacturers across 21 specialized categories."
}
</script>
</head>
<body>
${HEAD}

<main id="main" tabindex="-1" class="comp-wrap">
  <div class="comp-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Component Manufacturers</nav>
    <h1>Transformer <span style="color:var(--accent)">Component Manufacturers</span> Directory</h1>
    <p class="lead">Specialized sub-directory for all 21 key transformer component and accessory categories, organized by <b>Category → Country → State/Province</b>. Listed specialist manufacturers with an official website recorded, and direct RFQ capability.</p>
  </div>

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num">${CATEGORIES.length}</div>
      <div class="lbl">Component Categories</div>
    </div>
    <div class="stat-box">
      <div class="num">${totalSuppliers}+</div>
      <div class="lbl">Specialist Manufacturers</div>
    </div>
    <div class="stat-box">
      <div class="num">Category → Country</div>
      <div class="lbl">Deep-Dive Segregation</div>
    </div>
    <div class="stat-box">
      <div class="num">Official site</div>
      <div class="lbl">Website checked</div>
    </div>
  </div>

  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="compSearch" class="search-input" placeholder="Search component, manufacturer, city, or material (e.g. RIP bushing, vacuum tap changer, CRGO, pressboard, KSB)...">
      <select id="compCountry" class="select-input">
        <option value="">All Countries</option>
      </select>
      <button id="compReset" class="btn btn-outline btn-sm">Reset</button>
    </div>
  </div>

  <div class="cat-pills-bar" id="catPillsBar">
    <button class="cat-pill-btn active" data-cat="">All 21 Categories</button>
  </div>

  <div id="compSectionsContainer"></div>
</main>

${FOOT}

<script>
window.__TP_COMPONENTS_DEEP__ = ${deepDiveJson};
window.__TP_ACC_SLUGS__ = ${JSON.stringify([...ACC_SLUGS])};
(function(){
  const data = window.__TP_COMPONENTS_DEEP__ || [];
  const ACC_SLUGS = new Set(window.__TP_ACC_SLUGS__ || []);
  function slugify(s){ return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/&/g,'and').replace(/['’´]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''); }
  const searchInput = document.getElementById('compSearch');
  const countrySelect = document.getElementById('compCountry');
  const resetBtn = document.getElementById('compReset');
  const pillsBar = document.getElementById('catPillsBar');
  const container = document.getElementById('compSectionsContainer');

  let activeCat = '';

  // Collect countries
  const countrySet = new Set();
  data.forEach(c => {
    (c.suppliers || []).forEach(s => { if(s.country) countrySet.add(s.country); });
  });
  [...countrySet].sort().forEach(co => {
    const o = document.createElement('option');
    o.value = co; o.textContent = co;
    countrySelect.appendChild(o);
  });

  // Build category pills
  data.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill-btn';
    btn.textContent = c.name;
    btn.setAttribute('data-cat', c.id);
    btn.addEventListener('click', () => {
      activeCat = c.id;
      pillsBar.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
    pillsBar.appendChild(btn);
  });

  pillsBar.querySelector('[data-cat=""]').addEventListener('click', function(){
    activeCat = '';
    pillsBar.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    render();
  });

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const q = (searchInput.value || '').toLowerCase().trim();
    const cVal = countrySelect.value;

    let totalRendered = 0;
    let html = '';

    data.forEach(cat => {
      if (activeCat && cat.id !== activeCat) return;

      const filteredSuppliers = (cat.suppliers || []).filter(s => {
        if (cVal && s.country !== cVal) return false;
        if (q) {
          const hay = [cat.name, cat.scope, s.name, s.country, s.state, s.city, s.description].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      if (!filteredSuppliers.length) return;
      totalRendered += filteredSuppliers.length;

      const cardsHtml = filteredSuppliers.map(s => {
        const loc = [s.city, s.state, s.country].filter(Boolean).join(', ');
        const slug = slugify(s.name);
        const profile = ACC_SLUGS.has(slug) ? '<a href="accessories/' + slug + '/" class="supp-name" style="color:var(--accent);text-decoration:none">' + esc(s.name) + '</a>' : '<h4 class="supp-name">' + esc(s.name) + '</h4>';
        return '<div class="supp-card">' +
          '<div>' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px">' +
              profile +
              '<span class="ev-badge ev-confirmed">' + esc(s.verification_status || 'Verified') + '</span>' +
            '</div>' +
            '<div class="supp-loc">📍 ' + esc(loc) + '</div>' +
            '<div class="supp-desc">' + esc(s.description) + '</div>' +
          '</div>' +
          '<div class="supp-foot">' +
            (ACC_SLUGS.has(slug) ? '<a href="accessories/' + slug + '/" class="btn btn-outline btn-sm" style="font-size:.76rem">Profile →</a>' : (s.website ? '<a href="' + esc(s.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="font-size:.76rem">Official Website ↗</a>' : '<span></span>')) +
            '<a href="rfq.html?company=' + encodeURIComponent(s.name) + '" class="btn btn-amber btn-sm" style="font-size:.76rem">Inquire / RFQ →</a>' +
          '</div>' +
        '</div>';
      }).join('');

      html += '<div class="deep-section">' +
        '<div class="deep-sec-head">' +
          '<div>' +
            '<h2 class="deep-sec-title">🔧 ' + esc(cat.name) + '</h2>' +
            '<p class="deep-sec-scope">' + esc(cat.scope) + '</p>' +
          '</div>' +
          '<span style="font-size:.84rem;color:var(--muted)"><b>' + filteredSuppliers.length + '</b> Suppliers</span>' +
        '</div>' +
        '<div class="supplier-grid">' + cardsHtml + '</div>' +
      '</div>';
    });

    if (totalRendered === 0) {
      container.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted);background:var(--card);border:1px solid var(--border);border-radius:12px"><h3>No component manufacturers matched your search</h3><p>Try resetting the category filter or changing your keywords.</p></div>';
    } else {
      container.innerHTML = html;
    }
  }

  searchInput.addEventListener('input', render);
  countrySelect.addEventListener('change', render);
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    countrySelect.value = '';
    activeCat = '';
    pillsBar.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
    pillsBar.querySelector('[data-cat=""]').classList.add('active');
    render();
  });

  render();
})();
</script>

  <!-- SSR compatibility container for programmatic SEO & SSR engines -->
  <section style="display:none" aria-hidden="true">
    <div id="compGrid" class="grid grid-3"><!--SSR:components-grid--><!--/SSR:components-grid--></div>
  </section>
</main>

${FOOT}

<script>
const COMPONENTS = {
 "Bushings & Terminations":[
  ["HV RIP / RIS Condenser Bushings","Dry-type resin-impregnated paper and synthetic condenser bushings up to 1200 kV AC / 1100 kV DC."],
  ["OIP Condenser Bushings","Oil-impregnated paper condenser bushings for high-voltage power transformers."],
  ["LV High-Current DIN Bushings","DIN-type porcelain or epoxy bushings, 1–36 kV, up to several kA."],
  ["Plug-in / Elbow Bushings","Dead-break and load-break separable screened connectors for pad-mounted and GIS transformers."]],
 "High-Voltage Insulators":[
  ["Electro-Porcelain Hollow Cores","Hollow porcelain insulator housings for transformer condenser bushings and instrument transformers."],
  ["Composite Silicone Rubber Insulators","Hydrophobic silicone rubber hollow core insulators with FRP tube according to IEC 61462."],
  ["Solid Core Station Post Insulators","High-strength cylindrical porcelain and composite station post insulators for substation terminations."],
  ["Suspension & Disc Insulators","Toughened glass and porcelain disc insulator strings for overhead transformer take-offs."]],
 "Tap-Changers":[
  ["Vacuum OLTC","Low-maintenance on-load tap-changers with vacuum interrupters for power transformers."],
  ["Oil Diverter OLTC","Conventional high-capacity on-load tap-changers."],
  ["Off-Circuit Tap Changers (DETC)","De-energised ratio selectors for distribution and industrial transformers."],
  ["Motor Drive Units (MDU)","Electronic/mechanical drive units for remote tap control."],
  ["OLTC Oil Filter Units","Keeps diverter oil clean, extends maintenance intervals."]],
 "Protection & Monitoring":[
  ["Buchholz Relay","Gas- and surge-actuated relay between tank and conservator."],
  ["Pressure Relief Device (PRD)","Spring-loaded valve venting sudden tank overpressure."],
  ["Oil & Winding Temperature Indicators (OTI/WTI)","Dial thermometers with alarm/trip contacts."],
  ["Oil Level Indicators","Magnetic float gauges for conservator and OLTC compartments."],
  ["Sudden Pressure / Rapid Rise Relays","Detects fast internal pressure events."],
  ["Online DGA Monitors","Continuous dissolved-gas analysis for fleet-critical units."],
  ["Fibre-Optic Winding Sensors","Direct hot-spot measurement in windings."],
  ["Marshalling Boxes","Terminal cabinets collecting all monitoring wiring."]],
 "Cooling":[
  ["Radiators","Pressed-steel panel radiators, bolt-on or welded, with valves."],
  ["Corrugated / Fin-Wall Tanks","Flexible fin walls that cool and absorb oil expansion."],
  ["Cooling Fans","Axial fans for ONAF/OFAF ratings, with control cubicles."],
  ["Oil Pumps","Circulation pumps for OF/OD cooling stages."],
  ["Oil-to-Air / Oil-to-Water Coolers","Compact forced coolers for large or space-limited units."]],
 "Insulation Materials":[
  ["Pressboard (Transformerboard)","High-density cellulose board (IEC 60641-3-1 Type B.3.1) — barriers, cylinders, angle rings, snouts."],
  ["Diamond Dotted Paper (DDP)","Epoxy-dotted kraft paper bonding layer insulation for short-circuit strength."],
  ["Crepe Paper & Tubes","Conformable insulation for leads, cable take-offs, and winding connections."],
  ["Laminated Densified Wood","IEC 61061 densified beechwood clamping beams, rings, and pressure plates."],
  ["Spacers, Wedges & Cylinders","Machined pressboard forming radial cooling ducts and winding support."],
  ["Nomex® / Aramid Papers","High-temperature thermal class H/C (180°C–220°C) aramid insulation."]],
 "Conductors & Core":[
  ["CTC (Continuously Transposed Conductor)","Multi-strand transposed copper for low-loss large windings."],
  ["Paper-Covered Copper/Aluminium","Round and rectangular covered conductor for windings."],
  ["Enamelled Wire","For small windings and dry-type transformers."],
  ["Copper Foil & Busbar","LV foil windings and internal connections."],
  ["CRGO Electrical Steel","Grain-oriented core steel — M4 to laser-scribed Hi-B grades."],
  ["Amorphous Ribbon","Ultra-low-loss core material for distribution transformers."]],
 "Oil, Fluids & Preservation":[
  ["Mineral Transformer Oil","Naphthenic insulating oil to IEC 60296."],
  ["Natural & Synthetic Esters","Fire-safe, biodegradable fluids (K-class)."],
  ["Silica-Gel Breathers","Dehydrating breathers, standard or self-regenerating."],
  ["Air Cell / Rubber Bags","Conservator bladders separating oil from atmosphere."],
  ["Nitrogen Preservation Systems","Positive-pressure N₂ blankets for sealed units."]],
 "Tank & Mechanical":[
  ["Tanks & Conservators","Fabricated steel tanks, conservators and turrets."],
  ["Valves","Drain, filter, radiator butterfly and sampling valves."],
  ["Gaskets & O-Rings","Nitrile/cork and Viton sealing systems."],
  ["Wheels & Skids","Bi-directional rollers and haulage skids."],
  ["Current Transformers (Bushing CTs)","Ring-type CTs for metering and protection."],
  ["Control & Cable Accessories","Lugs, terminal blocks, auxiliary relays, MCBs, wiring looms."]]
};
</script>
<script src="tp-nav.js?v=5" defer></script>
<script src="analytics.js" defer></script>
</body>
</html>`;

fs.writeFileSync('components.html', html);
console.log('components.html built with 21 deep-dive component categories (' + totalSuppliers + ' suppliers)');
