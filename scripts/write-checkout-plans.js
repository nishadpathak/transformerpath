#!/usr/bin/env node
/* Write data/checkout-plans.json from PAYMENT_LINKS display copy.
 * The file has labels and amounts only. It does not contain a Payment Link.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { publicPlans } = require('../lib/checkout-gate');

const dest = process.argv[2] || path.join(__dirname, '..', 'data', 'checkout-plans.json');
const body = JSON.stringify({ plans: publicPlans() }, null, 2) + '\n';
fs.writeFileSync(dest, body);
console.log('wrote ' + path.relative(path.join(__dirname, '..'), dest));
