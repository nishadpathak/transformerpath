#!/usr/bin/env node
/* Feature flags. Committed switches stay false.
 *
 * An env value of 1, true, or on turns that flag on.
 * 0, false, off, or any other value forces it off, even when the file says true.
 * When the env var is unset, data/feature-flags.json is the switch.
 *
 * jobs_rfq_payments — Jobs and RFQ buy buttons.
 * supplier_passport — Supplier Qualification Passport form.
 * component_availability — component availability listings.
 *
 * The owner approves turning these on in the live UI. No secret belongs here.
 * No price is read from this file.
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

function readFlags() {
  const roots = candidateRoots();
  for (let i = 0; i < roots.length; i++) {
    const file = path.join(roots[i], 'data', 'feature-flags.json');
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch (e) {
      return {};
    }
  }
  return {};
}

function envEnabled(envName, fileKey) {
  const raw = process.env[envName];
  if (raw != null && String(raw).trim() !== '') {
    const value = String(raw).trim().toLowerCase();
    if (value === '1' || value === 'true' || value === 'on') return true;
    return false;
  }
  return readFlags()[fileKey] === true;
}

function jobsRfqPaymentsEnabled() {
  return envEnabled('TP_JOBS_RFQ_PAYMENTS', 'jobs_rfq_payments');
}

function supplierPassportEnabled() {
  return envEnabled('TP_SUPPLIER_PASSPORT', 'supplier_passport');
}

function componentAvailabilityEnabled() {
  return envEnabled('TP_COMPONENT_AVAILABILITY', 'component_availability');
}

module.exports = {
  jobsRfqPaymentsEnabled: jobsRfqPaymentsEnabled,
  supplierPassportEnabled: supplierPassportEnabled,
  componentAvailabilityEnabled: componentAvailabilityEnabled
};
