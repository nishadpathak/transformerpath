#!/usr/bin/env node
/* Write data/profile-claims-public.json from sourced records only. */
'use strict';
const fs = require('fs');
const path = require('path');
const claims = require('../lib/profile-claims');

const root = path.join(__dirname, '..');
const doc = claims.loadSources(fs, path, root);
if (claims.containsPrivate(doc)) {
  console.error('profile claims leaked do_not_contact');
  process.exit(1);
}
const out = path.join(root, 'data/profile-claims-public.json');
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log('profile claims ' + doc.companies.length + ' companies -> ' + out);
