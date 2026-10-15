#!/usr/bin/env node
/* The public intake must not show the proposed prices, a checkout, or a payment link.
 * The price note is off unless TP_SERVICE_LINES_SHOW_PRICE_NOTE is set true.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }

var root = path.join(__dirname, '..');
var page = fs.readFileSync(path.join(root, 'service-lines.html'), 'utf8');
var visible = page
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ');

console.log('SERVICE LINES PUBLIC PAGE\n');
ok(/TP_SERVICE_LINES_SHOW_PRICE_NOTE\s*=\s*false/.test(page), 'price note flag defaults off');
ok(page.indexOf('Pricing announced soon') !== -1, 'placeholder text exists for the flag');
ok(visible.indexOf('Pricing announced soon') === -1, 'placeholder is not in the visible page');
ok(!/\$\s*\d/.test(page), 'no dollar amount in the page');
ok(!/\b(?:3850|4800|12000|3,850|4,800|12,000)\b/.test(page), 'proposed prices are not in the page');
ok(!/buy\.stripe|checkout|stripe\.com/i.test(page), 'no checkout or Stripe link');
ok(/mailto:hello@transformerpath\.com/.test(page), 'enquiry mailto is hello@transformerpath.com');
ok(/name="service-lines-enquiry"/.test(page), 'enquiry form is present');
ok(fs.readFileSync(path.join(root, 'services.html'), 'utf8').indexOf('Service &amp; Repair Companies Directory') !== -1 ||
   fs.readFileSync(path.join(root, 'services.html'), 'utf8').indexOf('Service & Repair') !== -1,
   'services.html is still the repair directory');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nSERVICE LINES PUBLIC PAGE OK');
