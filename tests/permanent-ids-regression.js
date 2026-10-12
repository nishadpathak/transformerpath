#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { execSync } = require('child_process');
execSync('node build-permanent-ids.js', { stdio: 'pipe' });
const a = JSON.parse(fs.readFileSync('data/permanent-ids.json', 'utf8'));
const cg = a.companies['cg-power-and-industrial-solutions'];
if (!cg || !/^TPM-\d{6}$/.test(cg.id)) {
  console.error('FAIL — CG Power missing TPM id');
  process.exit(1);
}
const before = cg.id;
execSync('node build-permanent-ids.js', { stdio: 'pipe' });
const b = JSON.parse(fs.readFileSync('data/permanent-ids.json', 'utf8'));
if (b.companies['cg-power-and-industrial-solutions'].id !== before) {
  console.error('FAIL — TPM id reshuffled on rebuild');
  process.exit(1);
}
if (a.counts.companies < 900) {
  console.error('FAIL — expected ~906+ manufacturer TPM assignments, got ' + a.counts.companies);
  process.exit(1);
}
console.log('PASS — permanent IDs stable (CG ' + before + '; ' + a.counts.companies + ' TPM / ' + a.counts.facilities + ' TPF)');
