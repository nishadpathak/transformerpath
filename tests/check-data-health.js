#!/usr/bin/env node
/* tests/check-data-health.js — thin wrapper around the consolidated root gate.
 *
 * Canonical implementation: ../check-data-health.js
 * Kept so existing docs / habits that call `node tests/check-data-health.js`
 * still hit the Phase-20 orchestrator.
 */
'use strict';
const path = require('path');
const r = require('child_process').spawnSync(
  process.execPath,
  [path.join(__dirname, '..', 'check-data-health.js')].concat(process.argv.slice(2)),
  { stdio: 'inherit' }
);
process.exit(r.status == null ? 1 : r.status);
