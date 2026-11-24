'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const guide = require('../lib/step-locale');

const event = {
  id: guide.ID, start: '2027-03-03', end: '2027-03-05',
  venue: 'Hotel InterContinental Medellín', city: 'Medellín', country: 'Colombia'
};
const base = guide.renderGuide({ event, sponsorLinked: true });
assert.match(base, /<html lang="es"/);
assert.match(base, /<meta name="robots" content="index,follow"/);
assert.strictEqual((base.match(/<h1>/g) || []).length, 1);
assert.match(base, /<time datetime="2027-03-03">3 de marzo de 2027/);
assert.match(base, /<time datetime="2027-03-05">5 de marzo de 2027/);
assert.match(base, /600 USD/);
assert.match(base, /href="https:\/\/www\.step-latam\.com\/registro\/"/);
assert.match(base, /href="\/services\/reinhausen-brasil\/"/);
assert(!/utm_|affiliate|checkout/.test(base), 'editorial guide has no paid registration links');
assert.match(guide.renderGuide({ event: { start: '2028-04-10', end: '2028-04-12', venue: 'Nueva sede & hotel' } }), /Nueva sede &amp; hotel/);
assert(!guide.renderGuide({ event, sponsorLinked: false }).includes('/services/reinhausen-brasil/'));
assert(guide.TITLE.length >= 50 && guide.TITLE.length <= 60);
assert(guide.DESCRIPTION.length >= 140 && guide.DESCRIPTION.length <= 160);

if (process.argv[2]) {
  const dir = process.argv[2];
  const en = fs.readFileSync(path.join(dir, guide.EN_FILE), 'utf8');
  const es = fs.readFileSync(path.join(dir, guide.ES_FILE), 'utf8');
  const country = fs.readFileSync(path.join(dir, 'markets/colombia/index.html'), 'utf8');
  const region = fs.readFileSync(path.join(dir, 'directory/region/latin-america/index.html'), 'utf8');
  const sitemap = fs.readdirSync(dir).filter((name) => /^sitemap(?:-\d+)?\.xml$/.test(name))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  for (const [language, page] of [['en', en], ['es', es]]) {
    assert(page.includes('<link rel="canonical" href="' + guide.LANGUAGES[language] + '">'));
    assert(page.includes(guide.alternateTags()));
  }
  assert(en.includes('Official sponsor') && en.includes('/services/reinhausen-brasil/'));
  assert(es.includes(guide.TITLE) && es.includes(guide.DESCRIPTION));
  for (const entry of [country, region, en]) {
    assert(entry.includes('<a href="' + guide.ROOT + 'es/" hreflang="es" lang="es">'));
  }
  assert(es.includes('<a href="' + guide.ROOT + '" hreflang="en" lang="en">'));
  assert(sitemap.includes('<loc>' + guide.LANGUAGES.es + '</loc>'), 'Spanish canonical must be in the sitemap');
}
console.log('STEP Spanish guide passed');
