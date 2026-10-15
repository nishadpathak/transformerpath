#!/usr/bin/env node
/* tests/canvas-scroll-regression.js
 * Wheel over a 3D canvas or map must not be cancelled unless ctrl/cmd is held.
 * Run: node tests/canvas-scroll-regression.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let failed = 0;

function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

function loadScroll() {
  const listeners = [];
  const el = {
    style: {},
    addEventListener: function (type, fn, opts) { listeners.push({ type: type, fn: fn, opts: opts }); },
    removeEventListener: function () {},
    querySelector: function () { return null; },
    appendChild: function () {},
    parentElement: null
  };
  const messages = [];
  const sandbox = {
    window: null,
    globalThis: null,
    console: console,
    Math: Math,
    Number: Number,
    setTimeout: function () { return 0; },
    clearTimeout: function () {}
  };
  const fakeWindow = {
    parent: { postMessage: function (data) { messages.push(data); } },
    document: { createElement: function () { return { style: {}, setAttribute: function () {}, hidden: true }; } },
    getComputedStyle: function () { return { position: 'absolute' }; },
    addEventListener: function () {},
    setTimeout: sandbox.setTimeout,
    clearTimeout: sandbox.clearTimeout,
    TPCanvasScroll: null
  };
  fakeWindow.parent = fakeWindow.parent;
  sandbox.window = fakeWindow;
  sandbox.globalThis = fakeWindow;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'tp-canvas-scroll.js'), 'utf8'), sandbox);
  return { api: fakeWindow.TPCanvasScroll, el: el, messages: messages, listeners: listeners, win: fakeWindow };
}

console.log('=== CANVAS SCROLL REGRESSION ===');

const loaded = loadScroll();
const api = loaded.api;
check('module loaded', !!api && typeof api.handleWheel === 'function');

let zoomed = 0;
const plain = { deltaY: 120, ctrlKey: false, metaKey: false, preventDefault: function () { this.prevented = true; } };
const captured = api.handleWheel(plain, function () { zoomed++; });
check('wheel without ctrlKey is not prevented', captured === false && !plain.prevented, 'prevented=' + !!plain.prevented);
check('wheel without ctrlKey does not zoom', zoomed === 0, 'zoomed=' + zoomed);

const pinched = { deltaY: -40, ctrlKey: true, metaKey: false, preventDefault: function () { this.prevented = true; } };
const pinchZoom = api.handleWheel(pinched, function () { zoomed++; });
check('ctrl+wheel is prevented and zooms', pinchZoom === true && pinched.prevented && zoomed === 1);

const cmd = { deltaY: 80, ctrlKey: false, metaKey: true, preventDefault: function () { this.prevented = true; } };
const cmdZoom = api.handleWheel(cmd, function () { zoomed++; });
check('cmd+wheel is prevented and zooms', cmdZoom === true && cmd.prevented && zoomed === 2);

api.setPanY(loaded.el);
check('touch-action is pan-y', loaded.el.style.touchAction === 'pan-y');

api.bindWheel(loaded.el, function () { zoomed++; });
const wheelListener = loaded.listeners.filter(function (l) { return l.type === 'wheel'; })[0];
check('wheel listener is non-passive so ctrl+wheel can cancel', !!(wheelListener && wheelListener.opts && wheelListener.opts.passive === false));
const domWheel = { deltaY: 30, deltaX: 0, deltaMode: 0, ctrlKey: false, metaKey: false, preventDefault: function () { this.prevented = true; } };
wheelListener.fn(domWheel);
check('bound wheel without ctrlKey is not prevented', !domWheel.prevented);
check('bound wheel without ctrlKey does not zoom', zoomed === 2, 'zoomed=' + zoomed);

const child = loadScroll();
child.win.parent = { postMessage: function (data) { child.messages.push(data); } };
const relayed = { deltaY: 64, deltaX: 2, deltaMode: 1, ctrlKey: false, metaKey: false, preventDefault: function () { this.prevented = true; } };
child.api.bindWheel(child.el, function () {});
const childWheel = child.listeners.filter(function (l) { return l.type === 'wheel'; })[0];
childWheel.fn(relayed);
check('iframe wheel without ctrlKey is not prevented', !relayed.prevented);
check('iframe wheel is relayed to the parent', child.messages.length === 1 && child.messages[0].type === 'tp-canvas-scroll' && child.messages[0].deltaY === 64);
check('line-mode delta becomes pixels', child.api.pixelsFromDelta(3, 1, 800) === 48);

const skipDirs = { node_modules: 1, vendor: 1, dist: 1, archive: 1, '.git': 1 };
const wheelRe = /addEventListener\(\s*['"]wheel['"]/g;
const offenders = [];

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (skipDirs[ent.name]) return;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) { walk(abs); return; }
    if (!/\.(html|js)$/.test(ent.name)) return;
    if (ent.name === 'canvas-scroll-regression.js' || ent.name === 'tp-canvas-scroll.js') return;
    const text = fs.readFileSync(abs, 'utf8');
    if (!wheelRe.test(text)) { wheelRe.lastIndex = 0; return; }
    wheelRe.lastIndex = 0;
    let m;
    while ((m = wheelRe.exec(text))) {
      const slice = text.slice(m.index, m.index + 420);
      if (!/preventDefault/.test(slice)) continue;
      const before = slice.slice(0, slice.indexOf('preventDefault'));
      if (!/ctrlKey|metaKey|wheelCaptures|handleWheel|bindWheel/.test(before)) {
        offenders.push(path.relative(root, abs) + ':' + text.slice(0, m.index).split('\n').length);
      }
    }
  });
}
walk(root);
check('no wheel listener preventDefault without ctrlKey', offenders.length === 0, offenders.join(', '));

const mapJs = fs.readFileSync(path.join(root, 'map.js'), 'utf8');
check('map scrollWheelZoom stays off', /scrollWheelZoom:\s*false/.test(mapJs) && !/scrollWheelZoom:\s*true/.test(mapJs));
check('map uses the shared wheel helper', mapJs.indexOf('TPCanvasScroll.bindWheel') !== -1);
check('map forces pan-y', mapJs.indexOf('setPanY') !== -1);

const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
check('homepage hint is Ctrl + scroll to zoom', home.indexOf('Ctrl + scroll to zoom') !== -1);
check('homepage no longer teaches bare scroll-to-zoom',
  home.indexOf('Drag to orbit · scroll to zoom') === -1 &&
  home.indexOf('Drag to rotate · scroll to zoom') === -1);
check('homepage relays iframe wheel to the page', home.indexOf('installParentScrollRelay') !== -1);

const hero = fs.readFileSync(path.join(root, 'hero-3d.html'), 'utf8');
check('hero scene does not chain-scroll and relay twice', /overscroll-behavior:\s*none/.test(hero));
check('hero scene loads the scroll helper before the engine', hero.indexOf('tp-canvas-scroll.js') < hero.indexOf('tp-3d-core.js'));

const core = fs.readFileSync(path.join(root, 'tp-3d-core.js'), 'utf8');
check('3D engine zooms through the shared helper', core.indexOf('TPCanvasScroll.bindWheel') !== -1);
check('3D engine does not preventDefault every wheel', !/addEventListener\(\s*"wheel"[\s\S]{0,120}preventDefault/.test(core));

if (failed) {
  console.error('\n' + failed + ' canvas-scroll check(s) failed');
  process.exit(1);
}
console.log('\nCanvas scroll regression passed');
