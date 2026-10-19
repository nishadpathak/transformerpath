#!/usr/bin/env node
/* Jobs and RFQ buy buttons.
 *
 * Off unless TP_JOBS_RFQ_PAYMENTS is 1, true, or on.
 * 0, false, or off forces the buttons off even when the file says true.
 * When that env var is unset, data/feature-flags.json jobs_rfq_payments
 * is the switch. The committed file is false.
 *
 * The owner approves turning this on in the live UI. No secret belongs here.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function candidateRoots() {
  const roots = [];
  if (typeof __dirname !== 'undefined') {
    roots.push(path.resolve(__dirname, '..'));
    roots.push(path.resolve(__dirname, '../..'));
  }
  if (process.cwd()) roots.push(process.cwd());
  roots.push('/var/task');
  return roots;
}

function readFileFlag() {
  const roots = candidateRoots();
  for (let i = 0; i < roots.length; i++) {
    const file = path.join(roots[i], 'data', 'feature-flags.json');
    if (!fs.existsSync(file)) continue;
    try {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      return doc && doc.jobs_rfq_payments === true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

function jobsRfqPaymentsEnabled() {
  const raw = process.env.TP_JOBS_RFQ_PAYMENTS;
  if (raw != null && String(raw).trim() !== '') {
    const value = String(raw).trim().toLowerCase();
    if (value === '1' || value === 'true' || value === 'on') return true;
    return false;
  }
  return readFileFlag();
}

module.exports = { jobsRfqPaymentsEnabled: jobsRfqPaymentsEnabled };
