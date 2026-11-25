'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const hub = require('../lib/latam-hub');
const geo = require('../lib/directory-geo');
const step = require('../lib/step-locale');
const model = geo.loadModel();
const allDocs = geo.buildDocuments(model);
const dir = process.argv[2] || '';
const docs = Object.entries(hub.FILES).map(([lang, file]) => {
  const built = allDocs.find((doc) => doc.file === file);
  assert(built, 'Missing generated document: ' + file);
  return [lang, file, dir ? fs.readFileSync(path.join(dir, file), 'utf8') : built.html];
});
const census = model.regions.find((region) => region.slug === 'latin-america');
const modifications = geo.contentDates({}, null);
for (const [lang, file, html] of docs) {
  const canonical = 'https://transformerpath.com' + hub.PATHS[lang];
  assert.match(html, new RegExp('<html lang="' + lang + '"'));
  assert(html.includes('rel="canonical" href="' + canonical + '"'));
  assert(html.includes(hub.alternates()), 'Reciprocity: ' + lang);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.equal((html.match(/class="mk-row"/g) || []).length, census.count);
  for (const market of ['argentina', 'brazil', 'chile', 'colombia', 'mexico', 'peru']) {
    assert(html.includes('href="/markets/' + market + '/"'));
    assert(html.includes('href="/tenders/country/' + market + '/"'));
  }
  if (dir || fs.existsSync(path.join(__dirname, '..', step.ES_FILE))) {
    assert(html.includes('href="' + step.ROOT + 'es/"'), lang + ' missing STEP guide');
  }
  for (const url of ['/tenders.html', '/intel.html',
    '/laboratories/cidet-sabaneta/', '/services/reinhausen-brasil/',
    'https://sidof.segob.gob.mx/notas/docFuente/5804060']) {
    assert(html.includes('href="' + url + '"'), lang + ' missing ' + url);
  }
  assert(!/buy\.stripe\.com|event.?sponsor|is now open|bid submitted/i.test(html.slice(html.indexOf('<main'), html.indexOf('</main>'))));
  assert.equal(modifications[file], hub.REVIEWED);
  for (const len of [hub.UI[lang].description.length]) assert(len >= 140 && len <= 160);
}
assert(docs[2][2].indexOf('href="/markets/brazil/"') < docs[2][2].indexOf('href="/markets/argentina/"'));
assert.match(docs[1][2], /Consulte las novedades del sector/);
assert.match(docs[2][2], /Acompanhe o setor a partir do Brasil/);
assert(allDocs.find((doc) => doc.path === '/directory/region/europe/').html.includes('Europe transformer manufacturers'));
if (dir) {
  const sitemap = fs.readdirSync(dir).filter((n) => /^sitemap(?:-\d+)?\.xml$/.test(n)).map((n) => fs.readFileSync(path.join(dir, n), 'utf8')).join('');
  for (const locale of Object.keys(hub.PATHS)) {
    assert(sitemap.includes('<loc>https://transformerpath.com' + hub.PATHS[locale] + '</loc>'), locale + ' missing from sitemap');
  }
}

console.log('LATAM hub: three language views, shared manufacturer roster, procurement sources, links and canonicals passed.');
