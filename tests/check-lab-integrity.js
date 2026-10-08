#!/usr/bin/env node
/**
 * tests/check-lab-integrity.js
 * TransformerPath — Transformer Lab automated integrity gate.
 *
 * Checks:
 *   - All three Lab files exist and have content
 *   - 16 stage definitions present (IDs 0–16)
 *   - All stage IDs are unique integers 0–16
 *   - Every stage has required fields (id, label, caption, visGroups)
 *   - Every stage has at least one visGroup key
 *   - No NaN in stage camera angles (camTh, camPh, camR)
 *   - All 7 mode presets defined
 *   - All 6 camera presets defined
 *   - LIFT_Y constant present (active-part lift)
 *   - All core interactive functions exported/present
 *   - Lab page has all required HTML elements
 *   - Lab page references both JS files
 *   - Lab page has Transformer Lab CTA (TAKE IT APART)
 *   - WebGL fallback present
 *   - Accessible component tree present
 *   - No duplicate stage IDs
 *   - Geometry file declares all expected groups
 *   - Oil flow particles (flowPts) present
 *   - Flux loop (fluxPts) present
 *   - Academy page links to transformer-lab.html
 *   - Netlify has /transformer-lab rewrite
 *   - power3d.html links to transformer-lab.html
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

function check(name, pass, msg) {
  if (pass) {
    process.stdout.write('  \u2713 ' + name + '\n');
  } else {
    process.stdout.write('  \u2717 ' + name + (msg ? ' :: ' + msg : '') + '\n');
    failures.push(name);
  }
}
function warn(name, msg) {
  process.stdout.write('  ~ ' + name + (msg ? ' :: ' + msg : '') + '\n');
  warnings.push(name);
}

function readFile(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

/* ── 1. Files exist ─────────────────────────────────────── */
console.log('\n=== LAB: FILE PRESENCE ===');
const labHtml = readFile('transformer-lab.html');
const labEng  = readFile('tp-lab-engine.js');
const labGeo  = readFile('tp-lab-geometry.js');
check('transformer-lab.html exists',   labHtml !== null);
check('tp-lab-engine.js exists',       labEng  !== null);
check('tp-lab-geometry.js exists',     labGeo  !== null);
check('transformer-lab.html > 10 KB',  labHtml && labHtml.length > 10000);
check('tp-lab-engine.js > 10 KB',      labEng  && labEng.length  > 10000);
check('tp-lab-geometry.js > 10 KB',    labGeo  && labGeo.length  > 10000);

if (!labEng || !labHtml || !labGeo) {
  console.error('\nFATAL: one or more Lab files missing. Cannot continue.');
  process.exit(1);
}

/* ── 2. Stage definitions ────────────────────────────────── */
console.log('\n=== LAB: STAGE DEFINITIONS ===');

// Extract STAGES array from engine text via simple regex
const stagesMatch = labEng.match(/var STAGES\s*=\s*\[([\s\S]*?)\];\s*\/\* ── stage → normalised/);
const STAGE_COUNT = 16;

// Count stage id: N occurrences
const stageIds = [];
const stageIdRx = /\bid:\s*(\d+)\b/g;
let m;
while ((m = stageIdRx.exec(labEng)) !== null) stageIds.push(parseInt(m[1], 10));

check('16 stages defined (id: 0 through 16)',
  stageIds.length >= STAGE_COUNT + 1 &&
  stageIds.includes(0) && stageIds.includes(STAGE_COUNT));

const uniqueIds = [...new Set(stageIds)].sort((a, b) => a - b);
check('No duplicate stage IDs', uniqueIds.length === stageIds.length, 'duplicates: ' + (stageIds.length - uniqueIds.length));
check('Stage IDs are 0–16', uniqueIds[0] === 0 && uniqueIds[uniqueIds.length - 1] === STAGE_COUNT);

// Check required fields per stage
const labelCount = (labEng.match(/label:\s*['"][^'"]+['"]/g) || []).length;
const captionCount = (labEng.match(/caption:\s*['"][^'"]+['"]/g) || []).length;
const visGroupCount = (labEng.match(/visGroups:/g) || []).length;
const camThCount = (labEng.match(/camTh:/g) || []).length;

check('Every stage has a label',     labelCount >= STAGE_COUNT + 1);
check('Every stage has a caption',   captionCount >= STAGE_COUNT + 1);
check('Every stage has visGroups',   visGroupCount >= STAGE_COUNT + 1);
check('Every stage has camTh',       camThCount >= STAGE_COUNT + 1);

// No NaN in camera numbers
const camNumbers = labEng.match(/cam(?:Th|Ph|R):\s*([\d.]+)/g) || [];
check('No NaN camera angles', camNumbers.length >= (STAGE_COUNT + 1) * 3);

/* ── 3. Mode presets ─────────────────────────────────────── */
console.log('\n=== LAB: MODE PRESETS ===');
const EXPECTED_MODES = ['FULL', 'ACTIVE_PART', 'WINDINGS', 'INSULATION', 'CORE', 'ACCESSORIES', 'COOLING', 'MAGNETIC', 'MECHANICAL'];
EXPECTED_MODES.forEach(mode => {
  check('Mode preset: ' + mode, labEng.includes(mode + ':'));
});

/* ── 4. Camera presets ───────────────────────────────────── */
console.log('\n=== LAB: CAMERA PRESETS ===');
const EXPECTED_CAMS = ['OVERVIEW', 'ACTIVE_PART', 'TOP', 'SIDE', 'WINDINGS', 'CORE'];
EXPECTED_CAMS.forEach(cam => {
  check('Camera preset: ' + cam, labEng.includes(cam + ':'));
});

/* ── 5. Interactive functions ────────────────────────────── */
console.log('\n=== LAB: ENGINE FUNCTIONS ===');
const REQUIRED_FNS = [
  ['goToStage',          'stage navigation'],
  ['stepForward',        'step forward'],
  ['stepBack',           'step back'],
  ['reset',              'reset'],
  ['assemble',           'assembly reverse'],
  ['togglePlay',         'play/pause'],
  ['setMode',            'mode preset'],
  ['setFocusMode',       'focus mode'],
  ['setXRay',            'X-ray mode'],
  ['setOilFlow',         'oil flow'],
  ['setElectricalPath',  'electrical path'],
  ['setCutaway',         'cutaway'],
  ['setLabels',          'labels toggle'],
  ['setCamPreset',       'camera preset'],
  ['scrubToPercent',     'slider scrub'],
  ['pick',               'raycaster pick'],
  ['tick',               'animation tick'],
  ['dispose',            'cleanup/dispose'],
  ['LIFT_Y',             'active-part lift constant'],
  ['applyFracedStage',   'fractional stage applier'],
  ['applyFocusDim',      'focus dim'],
  ['clearFocusDim',      'clear focus dim'],
  ['setMagneticFlux',    'magnetic flux'],
];

REQUIRED_FNS.forEach(([fn, desc]) => {
  // applyFracedStage is a special partial match (applyFractionalStage)
  const pattern = fn === 'applyFracedStage' ? 'applyFractionalStage' : fn;
  check('Engine fn: ' + (desc || fn), labEng.includes(pattern));
});

/* ── 6. Geometry groups ──────────────────────────────────── */
console.log('\n=== LAB: GEOMETRY GROUPS ===');
const EXPECTED_GROUPS = ['tank', 'oil', 'core', 'lv', 'hv', 'tap', 'barriers', 'bushings', 'conservator', 'cooling', 'oltc', 'controls', 'arresters'];
EXPECTED_GROUPS.forEach(grp => {
  check('Geo group: ' + grp, labGeo.includes("'" + grp + "'") || labGeo.includes('"' + grp + '"'));
});
check('Geo: oil flow particles',        labGeo.includes('flowPts'));
check('Geo: flux loop particles',       labGeo.includes('fluxPts'));
check('Geo: Buchholz reference',        labGeo.includes('Buchholz') || labGeo.includes('buchMesh'));
check('Geo: stage metadata on parts',   labGeo.includes('stage:'));
check('Geo: group metadata on parts',   labGeo.includes('group:'));
check('Geo: part links defined',        labGeo.includes('links:'));
check('Geo: factoryId on parts',        labGeo.includes('factoryId:'));
check('Geo: system metadata on parts',  labGeo.includes('system:'));
check('Geo: whyItMatters on parts',     labGeo.includes('whyItMatters:'));
check('Geo: grid-lab.html referenced',  labGeo.includes('grid-lab.html'));

/* ── 7. HTML elements ────────────────────────────────────── */
console.log('\n=== LAB: HTML ELEMENTS ===');
check('CTA: TAKE IT APART',             labHtml.includes('TAKE IT APART'));
check('slider input present',           labHtml.includes('type="range"') || labHtml.includes("type='range'"));
check('Play button',                    labHtml.includes('btn-playpause') || labHtml.includes('Play'));
check('Step forward button',            labHtml.includes('btn-stepfwd') || labHtml.includes('stepfwd'));
check('Step back button',               labHtml.includes('btn-stepback') || labHtml.includes('stepback'));
check('Reset button',                   labHtml.includes('btn-reset') || labHtml.includes('Reset'));
check('Assemble button',                labHtml.includes('btn-assemble') || labHtml.includes('Assemble'));
check('Stage counter element',          labHtml.includes('lab-stage-counter') || labHtml.includes('stage-counter'));
check('Caption strip',                  labHtml.includes('lab-caption') || labHtml.includes('cap-text'));
check('Engineering panel',              labHtml.includes('lab-panel') || labHtml.includes('panel-name'));
check('Mode buttons',                   labHtml.includes('data-mode') || labHtml.includes('mode-btns'));
check('Camera preset buttons',          labHtml.includes('data-cam') || labHtml.includes('view-btns'));
check('X-ray toggle',                   labHtml.includes('tb-xray') || labHtml.includes('X-Ray'));
check('Oil flow toggle',                labHtml.includes('tb-oilflow') || labHtml.includes('Oil Flow'));
check('Focus toggle',                   labHtml.includes('tb-focus') || labHtml.includes('Focus'));
check('Labels toggle',                  labHtml.includes('tb-labels') || labHtml.includes('Labels'));
check('WebGL fallback present',         labHtml.includes('lab-webgl-fallback'));
check('Accessible tree present',        labHtml.includes('lab-a11y'));
check('prefers-reduced-motion',         labHtml.includes('prefers-reduced-motion'));
check('Keyboard help hint',             labHtml.includes('lab-help') || labHtml.includes('ArrowRight'));
check('Skip link',                      labHtml.includes('skip-link') || labHtml.includes('skip to'));
check('aria-live region',               labHtml.includes('aria-live'));
check('og:title meta',                  labHtml.includes('og:title'));
check('canonical link',                 labHtml.includes('canonical'));
check('footer present',                 labHtml.includes('<footer'));
check('tp-lab-engine.js referenced',    labHtml.includes('tp-lab-engine.js'));
check('tp-lab-geometry.js referenced',  labHtml.includes('tp-lab-geometry.js'));
check('Guided overlay element present', labHtml.includes('guided-overlay'));
check('Mode indicator label in topbar', labHtml.includes('lab-mode-pill'));
check('System badge in panel',          labHtml.includes('panel-system-badge'));
check('Why it matters in panel',        labHtml.includes('panel-why'));

/* ── 8. Integration ──────────────────────────────────────── */
console.log('\n=== LAB: INTEGRATION ===');
const academy   = readFile('academy.html');
const power3d   = readFile('power3d.html');
const netlify   = readFile('netlify.toml');
const gridLab   = readFile('grid-lab.html');

check('Academy links to transformer-lab.html',
  academy && academy.includes('transformer-lab.html'));
check('power3d.html links to transformer-lab.html',
  power3d && power3d.includes('transformer-lab.html'));
check('netlify.toml has /transformer-lab rewrite',
  netlify && netlify.includes('transformer-lab.html') && netlify.includes('from = "/transformer-lab"'));
check('grid-lab.html links to transformer-lab.html',
  gridLab && gridLab.includes('transformer-lab.html'));

/* ── 9. Engineering QA labels ────────────────────────────── */
console.log('\n=== LAB: ENGINEERING QA ===');
// These strings would indicate incorrect engineering assumptions
const BAD_PHRASES = [
  ['HV is outermost winding',   /HV\s+is\s+(?:the\s+)?outermost/i],
  ['guaranteed ONAN cooling',   /guaranteed\s+ONAN/i],
  ['exact manufacturing seq',   /exact\s+manufacturing\s+sequence(?!\s+is\s+NOT)/i],
];
BAD_PHRASES.forEach(([label, rx]) => {
  const found = rx.test(labHtml) || rx.test(labEng) || rx.test(labGeo);
  check('No incorrect claim: ' + label, !found, found ? 'phrase found' : '');
});

// Good qualifiers should be present
check('Illustrative oil flow labelled',  labEng.includes('ILLUSTRATIVE') || labHtml.includes('Illustrative') || labHtml.includes('illustrative'));
check('Illustrative arrangement note',   labEng.includes('Illustrative arrangement') || labHtml.includes('Illustrative arrangement'));

/* ── Summary ─────────────────────────────────────────────── */
console.log('\n=== SUMMARY ===');
if (warnings.length) {
  console.log('Warnings: ' + warnings.length);
  warnings.forEach(w => console.log('  ~ ' + w));
}
if (failures.length) {
  console.error('\nTRANSFORMER LAB INTEGRITY GATE: FAIL (' + failures.length + ')');
  failures.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('TRANSFORMER LAB INTEGRITY GATE: PASS');
process.exit(0);
