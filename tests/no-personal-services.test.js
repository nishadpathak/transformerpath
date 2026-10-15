#!/usr/bin/env node
/* TransformerPath does not offer work that needs a person's time:
 * consulting, calls, live training, or a design service.
 * services.html stays the generated Service & Repair directory.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var problems = [];
function ok(c, m) { console.log((c ? '  ok — ' : '  ✗ ') + m); if (!c) problems.push(m); }

var root = path.join(__dirname, '..');
var bannedFiles = ['service-lines.html', 'test-lab-consulting.html'];
bannedFiles.forEach(function (rel) {
  ok(!fs.existsSync(path.join(root, rel)), rel + ' is removed');
});

var linkRe = /service-lines\.html|test-lab-consulting\.html/;
var hits = [];
function walk(dir) {
  fs.readdirSync(dir).forEach(function (name) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'docs' || name === 'tests') return;
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(html|js|json|xml|toml|yml)$/.test(name) && linkRe.test(fs.readFileSync(p, 'utf8'))) {
      hits.push(path.relative(root, p));
    }
  });
}
walk(root);
ok(hits.length === 0, 'no remaining link to a removed service page' + (hits.length ? ' (' + hits.join(', ') + ')' : ''));

var promiseRe = /design-office support|live cohort|live training|book a call|schedule a call|consulting engagement|design consulting|design services|test-lab consulting/i;
var promised = [];
fs.readdirSync(root).forEach(function (name) {
  if (!name.endsWith('.html') || name === 'services.html') return;
  var text = fs.readFileSync(path.join(root, name), 'utf8')
    .replace(/consultants and engineers/gi, ' ');
  if (promiseRe.test(text)) promised.push(name);
});
ok(promised.length === 0, 'root pages do not promise consulting, live training, calls, or a design service' + (promised.length ? ' (' + promised.join(', ') + ')' : ''));

var directory = fs.readFileSync(path.join(root, 'services.html'), 'utf8');
ok(directory.indexOf('Service &amp; Repair') !== -1 || directory.indexOf('Service & Repair') !== -1,
  'services.html is still the repair directory');

if (problems.length) {
  console.error('\n' + problems.length + ' failed');
  process.exit(1);
}
console.log('\nNO PERSONAL SERVICES OK');
