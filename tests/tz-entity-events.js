#!/usr/bin/env node
/* tests/tz-entity-events.js — entity-events.json must be identical under
 * Asia/Dubai and UTC. dateFromSrc() used to shift a day east of UTC.
 */
'use strict';
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');

function hashRun(tz) {
  execSync('node build-intelligence.js', {
    env: Object.assign({}, process.env, { TZ: tz }),
    stdio: 'pipe'
  });
  return crypto.createHash('sha256').update(fs.readFileSync('data/entity-events.json')).digest('hex');
}

const dubai = hashRun('Asia/Dubai');
const utc = hashRun('UTC');
if (dubai !== utc) {
  console.error('FAIL entity-events.json differs by time zone');
  console.error('  Asia/Dubai ' + dubai);
  console.error('  UTC        ' + utc);
  process.exit(1);
}
const doc = JSON.parse(fs.readFileSync('data/entity-events.json', 'utf8'));
const cg = doc.companies_events && (doc.companies_events['CG Power'] || doc.companies_events['CG Power and Industrial Solutions']);
if (cg && cg.slug !== 'cg-power-and-industrial-solutions') {
  console.error('FAIL CG slug is ' + cg.slug);
  process.exit(1);
}
console.log('PASS — entity-events.json identical under Asia/Dubai and UTC (' + utc.slice(0, 12) + ')');
