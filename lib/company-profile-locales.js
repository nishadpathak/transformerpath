'use strict';

/* Editorial translations are keyed by the stable English profile path. No
 * translated row is added to the company, directory or search datasets. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const source = require('../data/company-profile-locales.json');
const html = require('./seo-html');
const ORIGIN = 'https://transformerpath.com';
const HUB = '/directory/region/latin-america/';

const SPANISH_COUNTRIES = new Set([
  'Argentina', 'Bolivia', 'Chile', 'Colombia', 'Costa Rica', 'Cuba',
  'Dominican Republic', 'Ecuador', 'El Salvador', 'Guatemala', 'Honduras',
  'Mexico', 'Nicaragua', 'Panama', 'Paraguay', 'Peru', 'Puerto Rico',
  'Uruguay', 'Venezuela'
]);
const OTHER_LATAM_COUNTRIES = new Set([
  'Bahamas', 'Belize', 'French Guiana', 'Guyana', 'Haiti', 'Jamaica',
  'Suriname', 'Trinidad & Tobago'
]);
const COUNTRY_NAMES = {
  Brazil: 'Brasil', Colombia: 'Colombia', Ecuador: 'Ecuador',
  Guatemala: 'Guatemala', Panama: 'Panamá', Peru: 'Perú'
};
const VERTICAL = {
  services: ['services', 'service_repair'],
  logistics: ['companies', 'transport_logistics'],
  laboratories: ['laboratories', 'testing_laboratory'],
  machinery: ['machinery', 'machinery_manufacturer'],
  accessories: ['suppliers', 'component_supplier'],
  manufacturers: [null, 'manufacturer']
};
const LANG = {
  es: {
    tag: 'Español', slug: 'es', og: 'es_LA', home: 'Inicio', skip: 'Saltar al contenido',
    hub: 'América Latina', path: 'Ruta de navegación', langs: 'Idioma de la ficha',
    vendor: 'Nombre publicado', location: 'Ubicación', scope: 'Alcance publicado',
    sources: 'Fuentes originales', checked: 'Fuentes consultadas el',
    statement: 'Esta ficha recoge el alcance publicado en las fuentes citadas. No constituye una recomendación de TransformerPath.',
    legal: 'Información legal', privacy: 'Privacidad', terms: 'Términos', contact: 'Contacto'
  },
  'pt-BR': {
    tag: 'Português (Brasil)', slug: 'pt-br', og: 'pt_BR', home: 'Início', skip: 'Pular para o conteúdo',
    hub: 'América Latina', path: 'Caminho da página', langs: 'Idioma da ficha',
    vendor: 'Nome publicado', location: 'Localização', scope: 'Escopo publicado',
    sources: 'Fontes originais', checked: 'Fontes consultadas em',
    statement: 'Esta ficha resume o escopo publicado nas fontes citadas. Não é uma recomendação da TransformerPath.',
    legal: 'Informações legais', privacy: 'Privacidade', terms: 'Termos', contact: 'Contato'
  }
};
const byRel = new Map(), pairs = [];
const cache = new Map();

function esc(s) { return html.esc(String(s == null ? '' : s)); }
function localeForCountry(country) {
  return country === 'Brazil' ? 'pt-BR' : SPANISH_COUNTRIES.has(country) ? 'es' : null;
}
function isLatam(country) {
  return localeForCountry(country) != null || OTHER_LATAM_COUNTRIES.has(country);
}
function localFile(rel) { return path.join(root, rel); }
function dataset(vertical) {
  if (!cache.has(vertical)) {
    const key = VERTICAL[vertical][0];
    if (vertical === 'manufacturers') {
      const index = JSON.parse(fs.readFileSync(localFile('data/directory-index.json'), 'utf8'));
      cache.set(vertical, index.companies.filter((x) => x.kind === 'manufacturer'));
    } else {
      const doc = JSON.parse(fs.readFileSync(localFile('data/' + vertical + '.json'), 'utf8'));
      cache.set(vertical, doc[key]);
    }
  }
  return cache.get(vertical);
}
function sourceDate(record, rel) {
  const raw = record.public_record?.checked || record.last_verified || record.verification_date;
  if (/^202[0-9]-\d{2}-\d{2}$/.test(raw || '')) return raw;
  const dates = require('../data/directory-batch-manifest.json');
  return dates.pages[rel] || null;
}
function sourceUrls(record) {
  const verified = record.public_record?.sources?.map((s) => s.url) ||
    [record.verification_source, record.source, record.website, record.capability_source_url];
  return [...new Set(verified.filter((url) => {
    if (typeof url !== 'string') return false;
    try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password; }
    catch (e) { return false; }
  }))];
}
function validateSource(rel, data) {
  const m = /^(services|logistics|laboratories|machinery|accessories|manufacturers)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/index\.html$/.exec(rel);
  if (!m) throw new Error('Invalid English company profile route: ' + rel);
  const rows = dataset(m[1]).filter((r) => r.slug === m[2] || String(r.id || '').split(':').pop() === m[2]);
  if (rows.length !== 1) throw new Error('Expected one authoritative directory record for ' + rel);
  const r = rows[0], lang = localeForCountry(r.country);
  if (!lang) throw new Error('No reviewed LATAM locale by country for ' + rel);
  const urls = sourceUrls(r);
  if (!urls.length || urls.length !== data.source_labels.length) throw new Error('Source label count differs from authoritative sources for ' + rel);
  const checked = sourceDate(r, rel);
  if (!/^202[0-9]-\d{2}-\d{2}$/.test(checked || '')) throw new Error('No document check date for ' + rel);
  if (data.title.length < 50 || data.title.length > 60 || data.description.length < 140 || data.description.length > 160 ||
      !data.heading || !data.summary || !data.scope.length) throw new Error('Incomplete translated metadata or body for ' + rel);
  const native = rel.replace(/index\.html$/, LANG[lang].slug + '/index.html');
  const en = html.publicUrl(rel), local = html.publicUrl(native);
  return { rel, native, en, local, lang, checked, record: r, urls, data,
    name: r.company_name || r.manufacturer || r.name,
    alternates: { en, [lang]: local, 'x-default': en } };
}
function init() {
  if (pairs.length) return;
  const entities = new Set();
  for (const [rel, data] of Object.entries(source.profiles)) {
    const p = validateSource(rel, data);
    const ref = p.record.canonical_id || p.record.id || p.record.slug;
    if (!ref || entities.has(ref) || byRel.has(rel) || byRel.has(p.native)) {
      throw new Error('Duplicate company profile locale: ' + rel);
    }
    entities.add(ref);
    pairs.push(p);
    byRel.set(rel, p);
    byRel.set(p.native, p);
  }
}
function forRel(rel) {
  // Fast path for all unrelated URLs; manufacturers are also allowed as
  // audited translations are added to the same reviewed registry.
  if (!/^(services|logistics|laboratories|machinery|accessories|manufacturers)\//.test(rel)) return null;
  init();
  return byRel.get(rel) || null;
}
function localeForRel(rel) {
  const p = forRel(rel);
  return p ? (rel === p.native ? p.lang : 'en') : null;
}
function localizedSeo(rel) {
  const p = forRel(rel);
  if (!p || rel !== p.native) return null;
  const t = LANG[p.lang];
  return {
    title: p.data.title, description: p.data.description,
    crumbs: [
      { name: t.home, item: ORIGIN + '/' },
      { name: t.hub, item: ORIGIN + HUB },
      { name: p.name, item: p.local }
    ]
  };
}
function alternateTags(p) {
  return Object.entries(p.alternates).map(([l, u]) =>
    '<link rel="alternate" hreflang="' + l + '" href="' + u + '">').join('');
}
function originalUrl(u) { return new URL(u).pathname; }
function render(p) {
  const tr = LANG[p.lang], d = p.data;
  const date = new Intl.DateTimeFormat(p.lang, { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(p.checked + 'T12:00:00Z'));
  const place = [p.record.city, p.record.state_province, COUNTRY_NAMES[p.record.country] || p.record.country].filter(Boolean).join(', ');
  const sources = p.urls.map((u,i) => '<li><a href="' + esc(u) + '" rel="noopener">' +
    esc(d.source_labels[i]) + '</a></li>').join('');
  return '<!doctype html>\n<html lang="' + p.lang + '" data-theme="dark"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(d.title) + '</title><meta name="description" content="' + esc(d.description) + '">' +
    '<meta name="robots" content="index,follow"><link rel="canonical" href="' + p.local + '">' + alternateTags(p) +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:locale" content="' + tr.og + '"><meta property="og:locale:alternate" content="en_US">' +
    '<meta property="og:image" content="' + ORIGIN + '/brand/og-image.png">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg"><link rel="stylesheet" href="/style.css">' +
    '<style>.localized-company{max-width:760px;margin:auto;padding:24px 18px 54px;overflow-wrap:anywhere}.localized-company h1{font-size:clamp(1.65rem,5vw,2.3rem);line-height:1.25}.localized-company p,.localized-company li{line-height:1.65}.localized-company nav,footer .tp-legal{display:flex;flex-wrap:wrap;gap:2px 16px}.localized-company a,footer .tp-legal a{display:inline-flex;align-items:center;min-height:44px;text-decoration:underline;text-underline-offset:3px}.localized-company a:focus-visible,footer .tp-legal a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}.localized-company dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 14px}.localized-company dd{margin:0}.localized-company ul{padding-inline-start:20px}@media(max-width:460px){.localized-company dl{display:block}.localized-company dd{margin-bottom:10px}}</style>' +
    '</head><body><a class="skip-link" href="#main">' + tr.skip + '</a>' +
    '<main class="localized-company" id="main" tabindex="-1">' +
    '<nav aria-label="' + tr.path + '"><a href="/" hreflang="en">TransformerPath</a><a href="' +
    HUB + '" hreflang="en">' + tr.hub + '</a></nav>' +
    '<nav aria-label="' + tr.langs + '"><a href="' + originalUrl(p.en) + '" lang="en" hreflang="en">English</a></nav>' +
    '<h1>' + esc(d.heading) + '</h1><p>' + esc(d.summary) + '</p>' +
    '<section class="card"><h2>' + tr.scope + '</h2><dl><dt>' + tr.vendor + '</dt><dd>' +
    esc(p.name) + '</dd><dt>' + tr.location + '</dt><dd>' + esc(place) + '</dd></dl><ul>' +
    d.scope.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul><p>' + tr.statement + '</p></section>' +
    '<section><h2>' + tr.sources + '</h2><p>' + tr.checked + ' <time datetime="' + p.checked + '">' +
    esc(date) + '</time>.</p><ul>' + sources + '</ul></section></main>' +
    '<footer><div class="container"><nav class="tp-legal" aria-label="' + tr.legal + '">' +
    '<a href="/privacy.html" hreflang="en">' + tr.privacy + '</a><a href="/terms.html" hreflang="en">' +
    tr.terms + '</a><a href="/contact.html" hreflang="en">' + tr.contact +
    '</a></nav><a href="https://x.com/transformerpath">TransformerPath · X</a></div></footer></body></html>\n';
}
function englishCounterpart(s, p) {
  const canonicalMatch = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i.exec(s);
  const canonicalHref = canonicalMatch && /\bhref=["']([^"']+)["']/i.exec(canonicalMatch[0]);
  if (!/<\/head>/i.test(s) || !/<main\b[^>]*>/i.test(s) || !canonicalHref ||
      canonicalHref[1] !== p.en || html.isNoindex(s) || /http-equiv=["']refresh["']/i.test(s)) {
    throw new Error('Missing or non-indexable English counterpart: ' + p.rel);
  }
  s = s.replace(/<!--tp-company-locale-head-->[\s\S]*?<!--\/tp-company-locale-head-->/g, '')
    .replace(/<!--tp-company-locale-nav-->[\s\S]*?<!--\/tp-company-locale-nav-->/g, '');
  const flag = '<p style="margin:12px 0"><a href="' + originalUrl(p.local) +
    '" lang="' + p.lang + '" hreflang="' + p.lang +
    '" style="display:inline-flex;align-items:center;min-height:44px;text-decoration:underline">' +
    LANG[p.lang].tag + '</a></p>';
  return s.replace(/<\/head>/i,
    '<!--tp-company-locale-head-->' + alternateTags(p) + '<!--/tp-company-locale-head--></head>')
    .replace(/<\/h1>/i, '</h1><!--tp-company-locale-nav-->' + flag + '<!--/tp-company-locale-nav-->');
}
function writePages() {
  init();
  pairs.forEach((p) => {
    const original = localFile(p.rel);
    const localized = localFile(p.native);
    fs.writeFileSync(original, englishCounterpart(fs.readFileSync(original, 'utf8'), p));
    fs.mkdirSync(path.dirname(localized), { recursive: true });
    fs.writeFileSync(localized, render(p));
  });
  console.log('company profile locales: ' + pairs.length + ' bilingual company profiles (' +
    pairs.filter((p) => p.lang === 'es').length + ' Spanish, ' +
    pairs.filter((p) => p.lang === 'pt-BR').length + ' Brazilian Portuguese)');
}
function localizedContentDate(rel) {
  const p = forRel(rel);
  if (!p || p.native !== rel) return null;
  return source.reviewed > p.checked ? source.reviewed : p.checked;
}
function auditInventory(index, paths) {
  init();
  const counts = { listed: new Set(), indexable: new Set(), withSource: new Set(),
    spanish: new Set(), brazilianPortuguese: new Set(), otherLocale: new Set() };
  const verticalByKind = Object.fromEntries(Object.entries(VERTICAL).map(([k,v]) => [v[1], k]));
  for (const r of index.companies || []) {
    if (!isLatam(r.country)) continue;
    const id = r.canonical_id || r.id;
    if (!id) continue;
    counts.listed.add(id);
    const vertical = verticalByKind[r.kind];
    const url = r.profile_url || (vertical && r.slug ? '/' + vertical + '/' + r.slug + '/' : '');
    if (!paths.has(url)) continue;
    counts.indexable.add(id);
    const l = localeForCountry(r.country);
    counts[l === 'es' ? 'spanish' : l === 'pt-BR' ? 'brazilianPortuguese' : 'otherLocale'].add(id);
    if (sourceUrls(r).length || r.source_meta?.source_url) counts.withSource.add(id);
  }
  return { ...Object.fromEntries(Object.entries(counts).map(([k,v]) => [k,v.size])), bilingual: pairs.length,
    spanishBilingual: pairs.filter((p) => p.lang === 'es').length,
    brazilianPortugueseBilingual: pairs.filter((p) => p.lang === 'pt-BR').length };
}
function allPairs() { init(); return pairs.slice(); }

module.exports = { localeForCountry, localeForRel, localizedSeo, localizedContentDate, forRel,
  allPairs, englishCounterpart, render, writePages, auditInventory };
