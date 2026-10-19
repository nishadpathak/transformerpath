/* Unconfigured browser client must not invent a signed-in user. */
'use strict';

const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('supabase.js', 'utf8');
const window = {
  location: { origin: 'https://transformerpath.com' },
  TP_SUPABASE: { url: '', anon: '' },
  console: console,
};
window.window = window;
window.document = {
  createElement: function () { return {}; },
  head: { appendChild: function () {} },
  querySelector: function () { return null; },
};
window.fetch = function () { return Promise.reject(new Error('missing function')); };

vm.createContext(window);
vm.runInContext(code, window);

window.TP.whenReady().then(function (state) {
  if (!state || state.configured !== false) {
    console.log('FAIL  configured should be false');
    process.exit(1);
  }
  if (state.user) {
    console.log('FAIL  user should be null');
    process.exit(1);
  }
  return window.TP.signInWithMagicLink('person@example.com').then(function () {
    console.log('FAIL  magic link resolved while accounts are off');
    process.exit(1);
  }, function (err) {
    if (!err || String(err.message).indexOf('Accounts are being set up') === -1) {
      console.log('FAIL  unexpected rejection ' + (err && err.message));
      process.exit(1);
    }
    console.log('  PASS  unconfigured client stays signed out');
    console.log('workspace client OK');
  });
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
