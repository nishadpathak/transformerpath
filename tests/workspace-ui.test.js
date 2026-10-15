/* The workspace page tells the truth when accounts are off and names the signed-in email. */
'use strict';

const fs = require('fs');
const assert = require('assert');

const workspace = fs.readFileSync('workspace.html', 'utf8');
const calculator = fs.readFileSync('calculator.html', 'utf8');
const config = fs.readFileSync('supabase-config.js', 'utf8');
const docs = fs.readFileSync('docs/workspace-setup.md', 'utf8');

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  PASS  ' + name);
  else { failed++; console.log('  FAIL  ' + name); }
}

check('setup copy is on the page', workspace.indexOf('Accounts are being set up.') !== -1);
check('signed-in header names the email slot', workspace.indexOf('Signed in as <span id="tpEmail">') !== -1);
check('magic link and Google are the sign-in actions',
  workspace.indexOf('Email me a sign-in link') !== -1 && workspace.indexOf('Continue with Google') !== -1);
check('password form is gone', workspace.indexOf('type="password"') === -1);
check('no baked email in the signed-in header', !/Signed in as [^<]*@/.test(workspace));
check('calculator can save to the account', calculator.indexOf('id="btn_save_account"') !== -1);
check('restored standard is the one calc uses', calculator.indexOf('CURSTD = s.std') !== -1);
check('a second save click is ignored while the first is in flight', calculator.indexOf('if (savingDesign) return;') !== -1);
check('a failed revision keeps the new design id', calculator.indexOf('err.designId') !== -1);
check('committed config has empty public fields', /url:\s*""/.test(config) && /anon:\s*""/.test(config));
check('setup doc names the env vars and the Google callback',
  docs.indexOf('SUPABASE_URL') !== -1 &&
  docs.indexOf('SUPABASE_ANON_KEY') !== -1 &&
  docs.indexOf('SUPABASE_PUBLISHABLE_KEY') !== -1 &&
  docs.indexOf('https://<project-ref>.supabase.co/auth/v1/callback') !== -1 &&
  docs.indexOf('https://transformerpath.com') !== -1);

assert.ok(failed === 0, failed + ' workspace UI checks failed');
console.log('workspace UI OK');
