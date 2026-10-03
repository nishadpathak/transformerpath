#!/usr/bin/env node
/* tests/webgl-gate-regression.js — WebGL progressive-enhancement regression.
 * Runs in Node without a real GPU by stubbing document/canvas.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else {
    console.error('  ✗ ' + label + (detail ? ' :: ' + detail : ''));
    failed++;
  }
}

console.log('=== WEBGL GATE REGRESSION ===');

const src = fs.readFileSync(path.join('tp-webgl-gate.js'), 'utf8');

function loadGate(opts) {
  opts = opts || {};
  const listeners = {};
  const container = {
    children: [],
    style: {},
    attributes: {},
    querySelector: function (sel) {
      if (sel === '.tp-3d-fallback') return this._fallback || null;
      if (sel === '[data-tp-3d-poster]') return this._poster || null;
      return null;
    },
    querySelectorAll: function () { return []; },
    appendChild: function (n) { this.children.push(n); if (n.className === 'tp-3d-fallback') this._fallback = n; return n; },
    insertBefore: function (n) { this.children.unshift(n); if (n.getAttribute && n.getAttribute('data-tp-3d-poster')) this._poster = n; return n; },
    setAttribute: function (k, v) { this.attributes[k] = v; },
    getAttribute: function (k) { return this.attributes[k]; },
    remove: function () {}
  };
  const fakeCanvas = {
    getContext: function (type) {
      if (opts.noWebGL) return null;
      if (opts.throwOnContext) throw new Error('context denied');
      return { canvas: this };
    },
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: function (type, fn) {
      listeners[type] = (listeners[type] || []).filter(function (f) { return f !== fn; });
    },
    style: {},
    dispatch: function (type, ev) { (listeners[type] || []).forEach(function (f) { f(ev || { preventDefault: function () {} }); }); }
  };
  const fakeDoc = {
    createElement: function (tag) {
      if (tag === 'canvas') return fakeCanvas;
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        children: [],
        innerHTML: '',
        className: '',
        setAttribute: function () {},
        getAttribute: function () { return null; },
        addEventListener: function () {},
        appendChild: function (c) { this.children.push(c); return c; },
        querySelector: function (sel) {
          if (sel === '[data-tp-3d-retry]' && this._retry) return this._retry;
          return null;
        },
        remove: function () {}
      };
      Object.defineProperty(el, 'innerHTML', {
        set: function (html) {
          this._html = html;
          this.className = /tp-3d-fallback/.test(html) ? 'tp-3d-fallback' : '';
          if (/data-tp-3d-retry/.test(html)) this._retry = { addEventListener: function () {} };
          this.firstChild = this;
        },
        get: function () { return this._html || ''; }
      });
      return el;
    },
    querySelectorAll: function () { return []; }
  };
  const sandbox = {
    window: {},
    document: fakeDoc,
    globalThis: {},
    performance: { now: function () { return Date.now(); } },
    CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    console: console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox);
  const THREE = {
    WebGLRenderer: function () {
      if (opts.throwOnRenderer) throw new Error('WebGLRenderer failed');
      if (opts.deadContext) {
        return { getContext: function () { return null; }, dispose: function () {}, domElement: fakeCanvas };
      }
      return {
        getContext: function () { return fakeCanvas.getContext('webgl'); },
        dispose: function () {},
        domElement: fakeCanvas,
        setPixelRatio: function () {},
        setSize: function () {}
      };
    }
  };
  return { gate: sandbox.TPWebGL || sandbox.window.TPWebGL, container: container, THREE: THREE, canvas: fakeCanvas };
}

// 1) WebGL unavailable
(function () {
  const { gate, container, THREE } = loadGate({ noWebGL: true });
  check('detect fails without WebGL', gate.detect().ok === false);
  const created = gate.createRenderer(THREE);
  check('createRenderer refuses when unavailable', created.ok === false);
  gate.showFallback(container, { state: 'UNAVAILABLE', detail: 'no_context' });
  check('fallback panel mounted', !!container._fallback || container.children.length > 0);
  check('state UNAVAILABLE', container.getAttribute('data-tp-3d-state') === 'UNAVAILABLE');
})();

// 2) Renderer constructor throws
(function () {
  const { gate, THREE } = loadGate({ throwOnRenderer: true });
  const created = gate.createRenderer(THREE);
  check('constructor throw → not ok', created.ok === false && created.reason === 'constructor_threw');
})();

// 3) Dead context
(function () {
  const { gate, THREE } = loadGate({ deadContext: true });
  const created = gate.createRenderer(THREE);
  check('dead context refused', created.ok === false && created.reason === 'dead_context');
})();

// 4) Happy path + poster + timeout + context lost
(function () {
  const { gate, container, THREE, canvas } = loadGate({});
  gate.ensurePoster(container);
  check('poster present before ready', !!container._poster || container.children.length > 0);
  const created = gate.createRenderer(THREE);
  check('createRenderer ok when WebGL present', created.ok === true && !!created.renderer);
  let timedOut = false;
  const watch = gate.startLoadWatchdog(container, 20, function () { timedOut = true; });
  // allow timeout
  return new Promise(function (resolve) {
    setTimeout(function () {
      check('load timeout fires', timedOut === true);
      watch.cancel();
      const created2 = gate.createRenderer(THREE);
      gate.bindContextLoss(created2.renderer, container, {});
      canvas.dispatch('webglcontextlost', { preventDefault: function () {} });
      check('context lost → CONTEXT_LOST state', container.getAttribute('data-tp-3d-state') === 'CONTEXT_LOST');
      resolve();
    }, 40);
  });
})().then(function () {
  // Source guards
  const hero = fs.readFileSync('hero-3d.html', 'utf8');
  check('hero-3d loads tp-webgl-gate', /tp-webgl-gate\.js/.test(hero));
  check('hero-3d has static poster', /data-tp-3d-poster/.test(hero));
  const index = fs.readFileSync('index.html', 'utf8');
  check('homepage does not eager-load hero iframe', !/src="hero-3d\.html"/.test(index));
  check('homepage keeps static poster', /power-transformer-3d-poster\.jpg/.test(index));
  check('homepage has no 1,002 makers copy', !/1,?002 transformer makers/.test(index));
  const power = fs.readFileSync('power3d.html', 'utf8');
  const explorer = fs.readFileSync('explorer.html', 'utf8');
  check('power3d gated', /TPWebGL\.createRenderer/.test(power));
  check('explorer gated', /TPWebGL\.createRenderer/.test(explorer));

  if (failed) {
    console.error('\nWEBGL GATE REGRESSION: FAIL (' + failed + ')');
    process.exit(1);
  }
  console.log('\nPASS — WebGL gate + fallbacks');
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
