#!/usr/bin/env node
/* Write data/intel-status.json. Homepage banner and intel.html both stamp
 * from this file. Run immediately before stamp-intel.js. */
'use strict';
const { writeIntelStatus } = require('./lib/intel-status');
const status = writeIntelStatus();
console.log('intel-status.json ' + status.status +
  ' · source ' + (status.latest_source_date || 'none') +
  ' · checked ' + (status.latest_source_checked_label || 'none'));
