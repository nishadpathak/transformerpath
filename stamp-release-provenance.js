#!/usr/bin/env node
/* stamp-release-provenance.js — source stamps are not allowed.
 *
 * Release identity is stamped onto dist HTML by stamp-dist-provenance.js
 * after build-dist.js. This entry point only forwards to that script so an
 * old build step cannot write tp-build-commit back into git.
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

console.log('stamp-release-provenance: forwarding to stamp-dist-provenance.js (source files are not stamped)');
const res = spawnSync(process.execPath, [path.join(__dirname, 'stamp-dist-provenance.js')], { stdio: 'inherit' });
process.exit(res.status == null ? 1 : res.status);
