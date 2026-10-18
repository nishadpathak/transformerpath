#!/usr/bin/env node
/* build-directory-geo.js — prerender /directory/region/ and /directory/country/.
 *
 * A page exists only when the census has at least five maker rows for that
 * place. The directory page links the same pages. Run before build-seo.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const geo = require('./lib/directory-geo');

const ROOT = __dirname;

function absLinks(html) {
  return html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
}

function readPartial(name) {
  return absLinks(fs.readFileSync(path.join(ROOT, '_partials', name), 'utf8').trim());
}

function resetDir(rel) {
  const abs = path.join(ROOT, rel);
  fs.rmSync(abs, { recursive: true, force: true });
  fs.mkdirSync(abs, { recursive: true });
}

function writeHub(html) {
  const file = path.join(ROOT, 'manufacturers.html');
  const source = fs.readFileSync(file, 'utf8');
  const start = '<!--GEO:hubs-->';
  const end = '<!--/GEO:hubs-->';
  const at = source.indexOf(start);
  const to = source.indexOf(end);
  if (at < 0 || to < at) throw new Error('manufacturers.html is missing GEO hub markers');
  const next = source.slice(0, at + start.length) + '\n' + html + '\n' + source.slice(to);
  if (next !== source) fs.writeFileSync(file, next);
}

function main() {
  const model = geo.loadModel();
  const docs = geo.buildDocuments(model);
  const head = readPartial('header.html');
  const foot = readPartial('footer.html');
  resetDir('directory/region');
  resetDir('directory/country');
  docs.forEach(function (doc) {
    const html = doc.html.replace('<!--HEAD-->', head).replace('<!--FOOT-->', foot);
    if (html.indexOf('buy.stripe.com') !== -1) throw new Error(doc.file + ' contains a Stripe link');
    const file = path.join(ROOT, doc.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  });
  writeHub(geo.hubHtml(model));
  const regions = docs.filter(function (doc) { return doc.kind === 'region'; }).length;
  const countries = docs.filter(function (doc) { return doc.kind === 'country'; }).length;
  console.log('directory geo wrote ' + regions + ' region pages and ' + countries + ' country pages');
}

if (require.main === module) main();

module.exports = main;
