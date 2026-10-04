#!/usr/bin/env node
/* tests/pwa-install-regression.js — PWA install pattern guards (no browser). */
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

console.log('=== PWA INSTALL REGRESSION ===');

const src = fs.readFileSync('tp-pwa.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));

check('manifest start_url is /', manifest.start_url === '/');
check('manifest scope is /', manifest.scope === '/');
check('manifest shortcuts use clean routes', (manifest.shortcuts || []).every(function (s) {
  return s.url && !/\.html$/.test(s.url);
}));
check('source gates on engagement (not first paint)', /engagementReady|MIN_DWELL_MS|MIN_ENGAGE_SCORE/.test(src));
check('source captures install outcome', /pwa_install_outcome|userChoice/.test(src));
check('source uses cooldown dismiss-until', /dismissed-until|DISMISS_DAYS/.test(src));
check('source never prompts in standalone', /standalone\(\)/.test(src) && /display-mode: standalone/.test(src));
check('source has benefit-oriented copy', /offline intel|home screen/i.test(src));
check('source clears legacy session seen flags', /tp-pwa-install-seen/.test(src));
check('source listens for appinstalled', /appinstalled/.test(src));

// Lightweight behavioural stub
(function () {
  const store = {};
  const session = {};
  const listeners = {};
  const sandbox = {
    console: console,
    Date: Date,
    parseInt: parseInt,
    isNaN: isNaN,
    Number: Number,
    JSON: JSON,
    Promise: Promise,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    document: {
      readyState: 'complete',
      addEventListener: function () {},
      getElementById: function () { return null; },
      createElement: function () {
        return {
          setAttribute: function () {},
          addEventListener: function () {},
          appendChild: function () {},
          remove: function () {},
          style: {},
          classList: { add: function () {} }
        };
      },
      body: { appendChild: function () {} },
      documentElement: { classList: { add: function () {} } }
    },
    window: null,
    navigator: { standalone: false, serviceWorker: { register: function () { return Promise.resolve(); } }, userAgent: 'Mozilla/5.0' },
    location: { pathname: '/intel' },
    localStorage: {
      getItem: function (k) { return store[k] == null ? null : store[k]; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    sessionStorage: {
      getItem: function (k) { return session[k] == null ? null : session[k]; },
      setItem: function (k, v) { session[k] = String(v); },
      removeItem: function (k) { delete session[k]; }
    },
    matchMedia: function () {
      return { matches: false, addEventListener: function () {}, addListener: function () {} };
    },
    CustomEvent: function () {},
    performance: { now: Date.now }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = function (type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
  };
  sandbox.window.addEventListener = sandbox.addEventListener;

  vm.runInNewContext(src, sandbox);
  const api = sandbox.__TP_PWA_API__ || sandbox.window.__TP_PWA_API__;
  check('test API exposed', !!api);
  if (!api) return;

  check('not engagement-ready at t=0 with score 0', api.engagementReady() === false);

  // Simulate dismiss cooldown respected
  store['tp-pwa-install-dismissed-until'] = String(Date.now() + 86400000);
  check('dismiss cooldown active', api.stillDismissed() === true);
  store['tp-pwa-install-dismissed-until'] = String(Date.now() - 1000);
  check('dismiss cooldown expired allows prompt', api.stillDismissed() === false);

  api.bumpEngage(2, 'test');
  check('engagement ready after score bump', api.engagementReady() === true);
})();

if (failed) {
  console.error('\nPWA INSTALL REGRESSION: FAIL (' + failed + ')');
  process.exit(1);
}
console.log('\nPASS — PWA install patterns');
