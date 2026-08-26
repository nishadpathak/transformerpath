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
  'Bushings & Terminations': { slug: 'transformer-bushings', t: 'Transformer Bushings & Terminations', std: 'IEC 60137, IEEE C57.19', app: 'Oil-impregnated paper or resin bushings for HV/LV line connections, terminal plates and cable boxes up to and beyond 550 kV.' },
  'Tap-Changers': { slug: 'on-load-tap-changers', t: 'On-Load & De-Energised Tap-Changers (OLTC/DETC)', std: 'IEC 60214', app: 'Ratio regulation under load or off-circuit, vacuum/oil diverter options, motor drives and replacement gears.' },
  'Protection & Monitoring': { slug: 'protection-monitoring', t: 'Protection, Monitoring & Diagnostics', std: 'IEC 60076-7, IEC 60599 (DGA)', app: 'Buchholz, pressure and temperature protection, DGA and partial-discharge monitoring, OLTC and cooling control.' },
  'Cooling': { slug: 'transformer-cooling', t: 'Transformer Cooling & Radiators', std: 'IEC 60076-7', app: 'Radiators, coolers, fans, oil pumps and heat exchangers for ONAN/ONAF/OFAF and directed-oil cooling.' },
  'Insulation Materials': { slug: 'insulation-materials', t: 'Transformer Insulation Materials', std: 'IEC 60893, IEC 60641, IEC 60763', app: 'Pressboard, laminated wood, DDP/DPE, aramid and paper for lead exits, barriers, end rings, and winding insulation.' },
  'Conductors & Core': { slug: 'conductors-and-core', t: 'Conductors, Core & Magnetic Steel', std: 'IEC 60404 (grain-oriented electrical steel)', app: 'CRGO laminations, copper and CTC (continuously transposed) conductors, foil windings and core-building materials.' },
  'Oil, Fluids & Preservation': { slug: 'oil-fluids-preservation', t: 'Transformer Oil, Fluids & Preservation', std: 'IEC 60296, IEC 61099, IEC 62770', app: 'Mineral oil, natural/synthetic esters, vacuum and nitrogen preservation, dehydrating breathers and conservator systems.' },
  'Tank & Mechanical': { slug: 'tank-and-mechanical', t: 'Tank, Fittings & Mechanical', std: 'IEC 60076-1', app: 'Tank fabrication, gaskets and seals, valves, conservators, bushings mountings and lifting/transport fittings.' },
};

function page(cat) {
  const meta = META[cat];
  const items = COMPONENTS[cat].map(([n, d]) => `<div class="card"><h3 style="color:var(--ink);margin:0 0 6px">${esc(n)}</h3><p style="color:var(--muted);font-size:.92rem">${esc(d)}</p><p style="margin-top:10px;font-size:.83rem"><a href="../manufacturers.html" style="color:var(--accent);font-weight:700">Find suppliers →</a> · <a href="../rfq.html" style="color:var(--accent);font-weight:700">Request quotes →</a></p></div>`).join('');
  const suppliers = `<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center"><b style="color:var(--text);font-size:.98rem">Sourcing ${esc(meta.t)}?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Browse verified suppliers, or post an RFQ to reach manufacturers worldwide.</p><a class="btn btn-amber" href="../manufacturers.html">Find suppliers →</a> <a class="btn btn-outline btn-sm" href="../rfq.html">Post an RFQ</a></div>`;
  return `<!DOCTYPE html>
<html lang="en">
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
<link rel="stylesheet" href="../style.css?v=5">
<link rel="icon" type="image/svg+xml" href="../brand/favicon.svg"><link rel="icon" href="../brand/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="../brand/apple-touch-icon.png">
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
  <div style="margin-top:16px">${suppliers}</div>
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
function slugify(n){ return String(n).toLowerCase().trim().replace(/&/g,'and').replace(/['’´]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''); }
const MGF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
const vbadge2 = (m) => { const f = m.length > 4 ? m[4] : null; if (f === 'P') return ' <span class="v-badge pro">★ Pro Verified</span>'; if (f === 'V') return ' <span class="v-badge">✓ Verified</span>'; return ''; };
const tpills2 = (types) => { if (!types) return ''; const T = { PT: 'Power', DT: 'Distribution', DRY: 'Dry/Cast' }; return types.split(',').map((t) => t.trim()).filter(Boolean).map((t) => '<span class="tpill t-' + t + '">' + esc(T[t] || t) + '</span>').join(''); };
fs.mkdirSync('manufacturers', { recursive: true });
let countryIndex = [];
for (const c of MGF) {
  const slug = slugify(c.country);
  const real = c.makers.filter((m) => !/^Served by/i.test(m[0]).valueOf() && !/^Served by/i.test(m[0]));
  const rows = c.makers.map((m) => /^Served by/i.test(m[0])
    ? '<div class="mk-row"><span class="note">' + esc(m[0]) + '</span></div>'
    : '<div class="mk-row"><b>' + esc(m[0]) + vbadge2(m) + tpills2(m[3]) + '</b><span class="city">' + esc(m[1] || '') + (m[5] ? ' · est. ' + esc(m[5]) : '') + '</span><a class="prof" href="../manufacturers.html" style="font-size:.68rem">Directory</a>' + (m[2] ? '<a href="' + esc(m[2]) + '" target="_blank" rel="noopener" class="prof">Site</a>' : '') + '</div>').join('');
  const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(c.country) + ' Transformer Manufacturers | TransformerPath</title>\n<meta name="description" content="Power, distribution and dry-type transformer manufacturers and suppliers in ' + esc(c.country) + '. Reserve, compare and request quotes.">\n<link rel="canonical" href="https://transformerpath.com/manufacturers/' + slug + '.html">\n<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="' + esc(c.country) + ' Transformer Manufacturers"><meta property="og:url" content="https://transformerpath.com/manufacturers/' + slug + '.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">\n<link rel="stylesheet" href="../style.css?v=5"><link rel="icon" type="image/svg+xml" href="../brand/favicon.svg"><link rel="icon" href="../brand/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="../brand/apple-touch-icon.png">\n<style>.c-wrap{max-width:900px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.9rem;color:var(--ink)}.c-wrap .lead{color:var(--muted);font-size:1rem}.c-wrap .mk-row{display:flex;align-items:baseline;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);font-size:.95rem}.c-wrap .mk-row b{color:var(--ink)}.c-wrap .mk-row .city{color:var(--muted);font-size:.85rem}.c-wrap .mk-row .prof{color:var(--accent);font-size:.8rem;font-weight:600;margin-left:auto}.c-wrap .tpill{display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:1px 8px;font-size:.7rem;color:var(--text);margin-left:4px}.c-wrap .v-badge{color:var(--green);font-size:.7rem;font-weight:700}</style>\n</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">\n<nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="../manufacturers.html" style="color:var(--accent)">Manufacturers</a> \u203a ' + esc(c.country) + '</nav>\n<h1>' + esc(c.flag) + ' Transformer Manufacturers in ' + esc(c.country) + '</h1>\n<p class="lead">' + real.length + ' manufacturer' + (real.length !== 1 ? 's' : '') + ' listed in ' + esc(c.country) + ' (' + esc(c.region) + '). Power, distribution and dry-type transformer suppliers.</p>\n<div>' + rows + '</div>\n<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center;margin-top:16px"><b style="color:var(--text)">Sourcing transformers in ' + esc(c.country) + '?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Browse the worldwide census or post an RFQ.</p><a class="btn btn-amber" href="../manufacturers.html">All manufacturers</a> <a class="btn btn-outline btn-sm" href="../rfq.html">Post an RFQ</a></div>\n</main>\n' + FOOT + '\n<script src="../analytics.js?v=2" defer></script>\n</body>\n</html>';
  fs.writeFileSync('manufacturers/' + slug + '.html', html);
  countryIndex.push('<a href="manufacturers/' + slug + '.html">' + esc(c.country) + '</a>');
  if (MGF.indexOf(c) < 5) console.log('OK manufacturers/' + slug + '.html');
}
console.log('generated', countryIndex.length, 'country pages');

/* ── Individual manufacturer profile pages (tier-leader companies) ─────────── */
const TIERS = JSON.parse(fs.readFileSync('data/manufacturer-tiers.json', 'utf8'));
const TIER_NAME = { 1: 'Global leader', 2: 'Major regional', 3: 'Specialized / custom' };
for (const r of TIERS) {
  const slug = slugify(r.name);
  const rows = [
    ['Country', r.country || r.cc || '—'],
    ['Site', r.site ? '<a href="' + esc(r.site) + '" target="_blank" rel="noopener">' + esc(r.site.replace(/^https?:\/\//, '')) + '</a>' : '—'],
    ['Transformer types', esc((r.types || []).join(', '))],
    ['Voltage capability', esc((r.voltage || []).join(', ')) || '—'],
    ['Max capacity / yr', r.mva ? '~' + r.mva.toLocaleString('en-US') + ' MVA' : '—'],
    ['Max voltage', r.kv ? r.kv + ' kV' : '—'],
    ['Certifications', esc((r.certs || []).join(', ') || '—')],
    ['Regions served', esc((r.regions || []).join(', ') || '—')],
    ['Verification tier', TIER_NAME[r.tier] || ('Tier ' + r.tier)],
    ['Source', esc(r.source || '—')]
  ].map(function (x) { return '<tr><th>' + x[0] + '</th><td>' + x[1] + '</td></tr>'; }).join('');
  const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(r.name) + ' — Transformer Manufacturer | TransformerPath</title>\n<meta name="description" content="' + esc(r.name) + ' — power/distribution transformer manufacturer (' + esc((r.types || []).join(', ')) + '). Capability, certifications and sourcing.">\n<link rel="canonical" href="https://transformerpath.com/manufacturers/' + slug + '.html">\n<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath"><meta property="og:title" content="' + esc(r.name) + ' — Transformer Manufacturer"><meta property="og:url" content="https://transformerpath.com/manufacturers/' + slug + '.html"><meta property="og:image" content="https://transformerpath.com/brand/og-image.png"><meta name="robots" content="index,follow">\n<link rel="stylesheet" href="../style.css?v=5"><link rel="icon" type="image/svg+xml" href="../brand/favicon.svg"><link rel="icon" href="../brand/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="../brand/apple-touch-icon.png">\n<style>.c-wrap{max-width:820px;margin:0 auto;padding:44px 20px 80px}.c-wrap h1{font-size:1.8rem;color:var(--ink)}.c-wrap table{width:100%;border-collapse:collapse;margin:14px 0}.c-wrap th{text-align:left;color:var(--muted);font-weight:600;padding:8px 12px;border-bottom:1px solid var(--border);width:42%}.c-wrap td{padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text)}</style>\n</head>\n<body>\n' + HEAD + '\n<main class="c-wrap">\n<nav style="font-size:.8rem;color:var(--muted);margin-bottom:10px"><a href="../manufacturers.html" style="color:var(--accent)">Manufacturers</a> \u203a ' + esc(r.name) + '</nav>\n<h1>' + esc(r.name) + '</h1>\n<p style="color:var(--muted);font-size:.95rem">Transformer manufacturer and supplier profile \u2014 capabilities and verification from the TransformerPath census.</p>\n<table><tbody>' + rows + '</tbody></table>\n<div class="card" style="background:rgba(245,166,35,.08);border-color:var(--accent);padding:16px 18px;text-align:center"><b style="color:var(--text)">Compare ' + esc(r.name) + ' with other suppliers?</b><p style="color:var(--muted);font-size:.9rem;margin:6px 0 12px">Browse the worldwide census or post an RFQ.</p><a class="btn btn-amber" href="../manufacturers.html">All manufacturers</a> <a class="btn btn-outline btn-sm" href="../rfq.html">Post an RFQ</a></div>\n</main>\n' + FOOT + '\n<script src="../analytics.js?v=2" defer></script>\n</body>\n</html>';
  fs.writeFileSync('manufacturers/' + slug + '.html', html);
}
console.log('generated', TIERS.length, 'company profile pages');
