#!/usr/bin/env node
/* Guards live QA failures:
 * - learn.html price column used flex:none and widened a 390px screen
 * - methodology tables widened the document instead of scrolling inside the page
 * - the 14 Aug 2026 archive stamp rendered 3 Aug because the briefing date was not applied
 * - netlify.toml lost its [build] header, so every deploy was rejected before the build
 */
'use strict';
const fs = require('fs');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

const toml = fs.readFileSync('netlify.toml', 'utf8');
const commandAt = toml.search(/command\s*=/);
const buildAt = toml.indexOf('[build]');
const functionsTable = toml.indexOf('\n[functions]');
check('netlify.toml keeps build settings in the [build] table', buildAt === 0 && commandAt > buildAt && functionsTable > commandAt);

const learn = fs.readFileSync('learn.html', 'utf8');
check('learn price column can shrink', /class="price-side"/.test(learn) && !/flex:none;text-align:center/.test(learn));
check('learn plan line may wrap', /class="plan-line"/.test(learn) && /\.price-side \{[^}]*min-width:0/.test(learn));

const method = fs.readFileSync('methodology.html', 'utf8');
check('methodology page scrolls wide tables inside the column', /\.mth-wrap\{[^}]*overflow-x:auto/.test(method));

const aug14 = fs.readFileSync('intel-2026-08-14.html', 'utf8');
check('14 Aug archive stamp is the briefing day', /id="stamp">14 Aug 2026</.test(aug14));
check('14 Aug archive copies the briefing date onto the stamp', /stampEl\.textContent = BRIEFING_DATE/.test(aug14));

[
  ['intel-2026-08-16.html', '16 Aug 2026'],
  ['intel-2026-08-18.html', '18 Aug 2026'],
  ['intel-2026-08-19.html', '19 Aug 2026'],
  ['intel-2026-08-21.html', '21 Aug 2026']
].forEach(function (pair) {
  const html = fs.readFileSync(pair[0], 'utf8');
  check(pair[0] + ' stamp matches the briefing', html.indexOf('id="stamp">' + pair[1] + '<') !== -1 && html.indexOf('BRIEFING_DATE = "' + pair[1] + '"') !== -1);
});

const courseCopy = ['index.html', 'learn.html', 'pricing.html'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
check('course copy does not repeat the word design', !/design design/.test(courseCopy));
const inbox = fs.readFileSync('supplier-inbox.html', 'utf8');
check('supplier inbox does not read a missing spec field on load', inbox.includes("function loadQueryParams(){\n    if (!document.getElementById('spec_rating')) return;"));

const css = fs.readFileSync('style.css', 'utf8');
check('directory provenance row wraps long URLs', /\.kg-comp-wrapper span\s*\{[^}]*overflow-wrap:\s*anywhere/.test(css));

const company = fs.readFileSync('company.html', 'utf8');
check('company shell is not titled Loading', !/<h1[^>]*>\s*Loading…/.test(company));
check('company shell is noindex', /name="robots" content="noindex, follow"/.test(company));
check('missing company sets a real document title', /document\.title = 'Company not found — TransformerPath'/.test(company));
check('bare company page does not download the census', /if \(!reqId && !reqC\) \{\s*showNotFound\(\);/.test(company));

const math = fs.readFileSync('viz/viz-math.js', 'utf8');
check('viz math does not throw module is not defined in the browser', !/^module\.exports\s*=/m.test(math));
const api = require('../viz/viz-math');
check('viz math still exports for node', typeof api.inrush === 'function' && typeof api.vecGroup === 'function');

const coil = fs.readFileSync('coilassembly.html', 'utf8');
check('coil assembly clips 3D labels inside the stage', /#c3d\{[^}]*overflow:hidden/.test(coil) && !/className='lbl'[^;]*document\.body\.appendChild/.test(coil) && !/className="lbl"[\s\S]{0,180}document\.body\.appendChild/.test(coil));
check('coil assembly keeps callouts inside the viewport', /function clampLabel\(/.test(coil));

const lab = fs.readFileSync('transformer-lab.html', 'utf8');
check('transformer lab clips 3D labels inside the stage', /#lab-canvas-host \{[^}]*overflow:\s*hidden/.test(lab) && /labelHost:\s*document\.getElementById\('lab-canvas-host'\)/.test(lab));
check('transformer lab has a page h1', /<h1 class="lab-title">Transformer Lab<\/h1>/.test(lab) && !/id="lab-topbar"[^>]*aria-hidden/.test(lab));
const engine = fs.readFileSync('tp-lab-engine.js', 'utf8');
check('transformer lab keeps callouts inside the viewport', /function clampCallout\(/.test(engine));

const vector = fs.readFileSync('viz/vector-group.js', 'utf8');
const outAt = vector.indexOf("var out = document.createElement('div')");
const controlsAt = vector.indexOf('V.controls(para');
check('vector group builds its result node before the controls that update it', outAt > 0 && controlsAt > outAt);

if (failed) {
  console.error('LIVE QA LAYOUT REGRESSION FAILED (' + failed + ')');
  process.exit(1);
}
console.log('PASS — live QA layout regression');
