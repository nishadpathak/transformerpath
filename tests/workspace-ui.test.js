/* The workspace page tells the truth when accounts are off and names the signed-in email. */
'use strict';

const fs = require('fs');
const assert = require('assert');

const workspace = fs.readFileSync('workspace.html', 'utf8');
const calculator = fs.readFileSync('calculator.html', 'utf8');
const config = fs.readFileSync('supabase-config.js', 'utf8');
const docs = fs.readFileSync('docs/workspace-setup.md', 'utf8');
const studentDocs = fs.readFileSync('docs/student-learning-setup.md', 'utf8');
const passport = fs.readFileSync('skills-passport.html', 'utf8');
const reviews = fs.readFileSync('admin-student-reviews.html', 'utf8');
const pricing = fs.readFileSync('pricing.html', 'utf8');
const offerStart = pricing.indexOf('id="student-learning-offer"');
const offerHtml = offerStart === -1 ? '' : pricing.slice(offerStart, pricing.indexOf('</section>', offerStart));

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
check('sign-up offers Student, Engineer, and Company',
  workspace.indexOf('value="student"') !== -1 &&
  workspace.indexOf('value="engineer"') !== -1 &&
  workspace.indexOf('value="company"') !== -1 &&
  workspace.indexOf('id="tpStudentId"') !== -1 &&
  workspace.indexOf('skills-passport.html') !== -1);
check('passport claims no certificate and lists only saved completions',
  passport.indexOf('not a certificate') !== -1 &&
  passport.indexOf('No sections completed.') !== -1 &&
  passport.indexOf('content="noindex, follow"') !== -1);
check('admin review page is noindex and can approve or reject',
  reviews.indexOf('content="noindex, nofollow"') !== -1 &&
  reviews.indexOf('data-decide="approved"') !== -1 &&
  reviews.indexOf('data-decide="rejected"') !== -1);
check('student Learning checkout stays off and has no buy link',
  offerHtml.indexOf('This checkout is off') !== -1 &&
  offerHtml.indexOf('buy.stripe.com') === -1);
check('student setup names the flag and the Stripe ids to create later',
  studentDocs.indexOf('STUDENT_LEARNING_COUPON_ENABLED') !== -1 &&
  studentDocs.indexOf('STRIPE_STUDENT_LEARNING_COUPON_ID') !== -1 &&
  studentDocs.indexOf('STRIPE_STUDENT_LEARNING_PRICE_ID') !== -1 &&
  studentDocs.indexOf('plink_1UQhha2YHcFlJstOHjvZv5V0') !== -1 &&
  studentDocs.indexOf('workspace_admins') !== -1);

assert.ok(failed === 0, failed + ' workspace UI checks failed');
console.log('workspace UI OK');
