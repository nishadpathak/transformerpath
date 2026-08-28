const fs = require('fs');
const path = require('path');
function walk(d, skip) {
  let out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    if (skip.includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, skip));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const skip = ['archive', '_private', 'transformerpath-site', 'node_modules', '.git'];
const files = walk('.', skip);
const txt = (f) => fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const vis = (f) => txt(f).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const pick = (x) => (x ? 'OK ' : 'FAIL');

// ── 1. PRICING ──
const p = vis('pricing.html');
console.log('PRICING');
console.log('  Learning/Professional/Team present:', pick(/Learning/.test(p) && /Professional/.test(p) && /\bTeam\b/.test(p)));
console.log('  Learner plan heading absent:', pick(!/<h[23][^>]*>\s*Learner\s*<\/h[23]>/i.test(p)));
console.log('  Enterprise plan heading absent:', pick(!/<h[23][^>]*>\s*Enterprise\s*<\/h[23]>/i.test(p)));
console.log('  $199/599/1,999 present:', pick(/\$199/.test(p) && /\$599/.test(p) && /\$1,999/.test(p)));
console.log('  no $X/year billing:', pick(!/\$199\s*\/\s*year|\$599\s*\/\s*year|\$1,999\s*\/\s*year/i.test(p)));
console.log('  no-auto-renewal:', pick(/no auto-renewal/i.test(p)));
console.log('  12 months:', pick(/12 months/i.test(p)));
console.log('  no certificate-per-level:', pick(!/certificate per level/i.test(p) && !/co-branded certificates?/i.test(p) && !/capstone review \+ certificate/i.test(p)));
console.log('  no professional-tier certificate badge:', pick(!/professional-tier certificate badge/i.test(p)));
console.log('  no "A TransformerPath certificate":', pick(!/a transformerpath certificate/i.test(p)));

// ── 2. FOR-MANUFACTURERS ──
const fm = vis('for-manufacturers.html');
console.log('FOR-MANUFACTURERS');
console.log('  no "we are not FEM":', pick(!/we are not FEM/i.test(fm)));
console.log('  no "we would rather tell you":', pick(!/we would rather tell you/i.test(fm)));
console.log('  no "instead of us":', pick(!/instead of us/i.test(fm)));
console.log('  no 10-15% claim:', pick(!/10[\s\u2013-]?15\s*%/.test(fm)));
console.log('  no Learner/Enterprise plan:', pick(!/\bLearner\b/.test(fm) && !/\bEnterprise\b plan/i.test(fm)));
console.log('  no co-branded certificates:', pick(!/co-branded certificates?/i.test(fm)));

// ── 3. FEM / 10-15% repository-wide ──
console.log('FEM / 10-15% REPOSITORY-WIDE (served)');
let femHits = [];
for (const f of files) { const v = vis(f); if (/10[\s\u2013-]?15\s*%/.test(v) && /works design|optimised|optimized|first-cut/i.test(v)) femHits.push(f); }
console.log('  served files with 10-15% + works-design claim:', femHits.length ? femHits.join(', ') : 'NONE');
const fem = vis('article-fem-vs-analytical.html');
console.log('  FEM article has defusable wording:', pick(/accuracy depends materially on transformer type, geometry/i.test(fem)));

// ── 4. INTEL CADENCE ──
console.log('INTEL CADENCE');
const home = vis('index.html');
const intel = vis('intel.html');
console.log('  no "updated hourly" on homepage:', pick(!/updated hourly/i.test(home)));
console.log('  no "Hourly global briefing":', pick(!/hourly global briefing/i.test(home)));
console.log('  no "Updated hourly" on intel:', pick(!/updated hourly/i.test(intel)));
console.log('  intel says "Updated daily" or twice-daily:', pick(/updated (daily|twice daily)/i.test(intel)));
console.log('  homepage intel card says daily:', pick(!/hourly/i.test(home.replace(/updated daily/i, '')) || /daily/i.test(home)));

// ── 5. BOOKS ──
const b = vis('books.html');
console.log('BOOKS');
console.log('  "first releases" present:', pick(/first releases/i.test(b)));
console.log('  no "Two volumes of transformer engineering":', pick(!/two volumes of transformer engineering/i.test(b)));
console.log('  no "Email to order":', pick(!/email to order/i.test(b)));
console.log('  direct Buy buttons (data-buy):', pick(/(data-buy=)/.test(txt('books.html'))));

// ── 6. DESIGN DUEL SSR ──
const dd = txt('design.html');
console.log('DESIGN DUEL SSR');
console.log('  impedance window populated:', pick(/Impedance window<\/td>\s*<td[^>]*>[^<]+</.test(dd)));
console.log('  NLL/LL/noise/mass populated:', pick(/Max NLL guarantee<\/td><td[^>]*>[^<]{2,}/.test(dd) && /Max LL guarantee<\/td><td[^>]*>[^<]{2,}/.test(dd) && /Max noise<\/td><td[^>]*>[^<]{2,}/.test(dd) && /Max transport mass<\/td><td[^>]*>[^<]{2,}/.test(dd)));
console.log('  copper populated:', pick(/Copper this week<\/td>\s*<td[^>]*>[^<]+</.test(dd)));

// ── 7. FOOTER "networking" ──
console.log('FOOTER');
let netHits = [];
for (const f of files) { const v = vis(f); if (/global (intelligence|information) and networking platform/i.test(v)) netHits.push(f); }
console.log('  served pages with "and networking platform":', netHits.length ? netHits.join(', ') : 'NONE');

// ── 8. ACCOUNTS honesty ──
console.log('ACCOUNTS');
const faq = vis('faq.html');
console.log('  FAQ honest about accounts:', pick(/accounts are being added|not today/i.test(faq)));

console.log('\nDONE — see FAIL lines above for any genuine source issues.');
