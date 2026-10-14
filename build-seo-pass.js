#!/usr/bin/env node
/* build-seo-pass.js — stamp titles, canonicals, JSON-LD, links and CWV
 * onto dist/ HTML. Source templates are left alone; the Netlify build
 * regenerates them before build-dist copies them here.
 *
 * Run after stamp-dist-provenance.js: node build-seo-pass.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { assignUnique } = require('./lib/seo-fit');
const schema = require('./lib/seo-schema');
const html = require('./lib/seo-html');
const cwv = require('./lib/seo-cwv');
const catalog = require('./lib/seo-catalog');

const DIST = process.argv[2] || 'dist';

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  });
  return out;
}

function relOf(file) {
  return path.relative(DIST, file).split(path.sep).join('/');
}

function relatedHtml(links) {
  if (!links || !links.length) return '';
  return '<section data-tp-seo="related" aria-label="Related pages" style="margin-top:28px">' +
    '<h2>Related on TransformerPath</h2><ul>' +
    links.map(function (l) {
      return '<li><a href="' + html.esc(l.href) + '">' + html.esc(l.text) + '</a></li>';
    }).join('') + '</ul></section>';
}

function plantAnchors(source) {
  return source.replace(/<h2(\s[^>]*)?>(\s*Confirmed manufacturing[^<]*)<\/h2>/gi, function (full, attrs, text) {
    if (attrs && /\bid\s*=/.test(attrs)) return full;
    return '<h2 id="plants"' + (attrs || '') + '>' + text + '</h2>';
  });
}

function applyOne(file, item, fontFiles, cache) {
  let source = fs.readFileSync(file, 'utf8');
  const lang = (source.match(/<html[^>]*\blang=["']([^"']+)["']/i) || [])[1] || 'en';
  item.lang = lang;
  source = plantAnchors(source);
  if (item.noindex && !/noindex/i.test(html.metaContent(source, 'robots'))) {
    source = html.upsertMetaName(source, 'robots', 'noindex, follow');
  }
  source = html.replaceTitle(source, item.title);
  source = html.upsertMetaName(source, 'description', item.description);
  source = html.upsertMetaProperty(source, 'og:title', item.title);
  source = html.upsertMetaProperty(source, 'og:description', item.description);
  source = html.upsertMetaProperty(source, 'og:url', item.canonical);
  source = html.setCanonical(source, item.canonical);
  source = html.stripReplacedJsonLd(source);
  const nodes = schema.siteNodes().concat([
    schema.breadcrumbNode(item.self, item.crumbs)
  ]).concat(item.nodes || []);
  source = html.setGraph(source, schema.graph(nodes));
  source = html.ensureCrumbs(source, item.crumbs);
  source = html.setRelated(source, relatedHtml(item.related));
  source = cwv.apply(source, relOf(file), DIST, cache, fontFiles);
  fs.writeFileSync(file, source);
}

function hrefsIn(source, fromRel) {
  const out = [];
  const re = /\shref=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(source))) {
    let href = m[1].split('#')[0].split('?')[0];
    if (!href || /^(?:mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      if (href.indexOf(schema.ORIGIN) !== 0) continue;
      href = href.slice(schema.ORIGIN.length) || '/';
    } else if (href.charAt(0) !== '/') {
      const dir = fromRel.indexOf('/') === -1 ? '' : fromRel.replace(/[^/]+$/, '');
      href = '/' + path.posix.normalize(dir + href);
    }
    if (href.endsWith('/index.html')) href = href.slice(0, -'index.html'.length);
    if (href === '/index.html') href = '/';
    if (href.length > 1 && href.endsWith('/')) href = href;
    out.push(href);
  }
  return out;
}

function orphanNav(links) {
  return '<nav data-tp-seo="orphans" aria-label="Pages in this section" style="margin-top:22px"><h2>Also in this section</h2><ul>' +
    links.map(function (l) {
      return '<li><a href="' + html.esc(l.href) + '">' + html.esc(l.text) + '</a></li>';
    }).join('') + '</ul></nav>';
}

async function main() {
  if (!fs.existsSync(DIST)) {
    console.error('build-seo-pass: ' + DIST + '/ is missing — run node build-dist.js first');
    process.exit(1);
  }
  const cat = catalog.create();
  const files = walk(DIST, []);
  const fontFiles = await cwv.latinFontFiles();
  const cache = {};
  const items = files.map(function (file) {
    const rel = relOf(file);
    const source = fs.readFileSync(file, 'utf8');
    const d = catalog.draft(rel, source, cat);
    d.file = file;
    d.pads = d.padsTitle;
    d.draft = d.draftTitle;
    return d;
  });
  assignUnique(items, 'title', 50, 60);
  items.forEach(function (item) {
    item.draft = item.draftDesc;
    item.pads = item.padsDesc;
  });
  assignUnique(items, 'description', 140, 160);

  items.forEach(function (item) { applyOne(item.file, item, fontFiles, cache); });

  const byPath = {};
  items.forEach(function (item) { byPath[html.publicPath(item.rel)] = item; });
  const inbound = {};
  Object.keys(byPath).forEach(function (p) { inbound[p] = 0; });
  items.forEach(function (item) {
    const source = fs.readFileSync(item.file, 'utf8');
    hrefsIn(source, item.rel).forEach(function (href) {
      if (inbound[href] != null) inbound[href]++;
      else if (inbound[href + '/'] != null) inbound[href + '/']++;
      else if (href.length > 1 && href.endsWith('/') && inbound[href.slice(0, -1)] != null) inbound[href.slice(0, -1)]++;
    });
  });

  const extra = {};
  items.forEach(function (item) {
    if (item.noindex) return;
    const pub = html.publicPath(item.rel);
    if (pub === '/') return;
    if (inbound[pub]) return;
    let hubRel = 'index.html';
    if (item.rel.indexOf('/') !== -1) {
      const top = item.rel.split('/')[0];
      if (fs.existsSync(path.join(DIST, top + '.html'))) hubRel = top + '.html';
      else if (fs.existsSync(path.join(DIST, top, 'index.html'))) hubRel = top + '/index.html';
    }
    if (hubRel === item.rel) hubRel = 'index.html';
    if (!extra[hubRel]) extra[hubRel] = [];
    extra[hubRel].push({ href: pub, text: item.title });
  });

  Object.keys(extra).forEach(function (hubRel) {
    const file = path.join(DIST, hubRel);
    if (!fs.existsSync(file)) return;
    let source = fs.readFileSync(file, 'utf8');
    source = source.replace(/<nav data-tp-seo="orphans"[\s\S]*?<\/nav>/g, '');
    const nav = orphanNav(extra[hubRel]);
    if (/<\/main>/i.test(source)) source = source.replace(/<\/main>/i, nav + '</main>');
    else source = source.replace(/<\/body>/i, nav + '</body>');
    fs.writeFileSync(file, source);
  });

  const robots = path.join(DIST, 'robots.txt');
  let robotsTxt = fs.existsSync(robots) ? fs.readFileSync(robots, 'utf8') : 'User-agent: *\nAllow: /\n';
  if (!/Sitemap:\s*https:\/\/transformerpath\.com\/sitemap\.xml/i.test(robotsTxt)) {
    robotsTxt = robotsTxt.replace(/\s*$/, '\n') + 'Sitemap: https://transformerpath.com/sitemap.xml\n';
    fs.writeFileSync(robots, robotsTxt);
  }

  const langs = {};
  items.forEach(function (item) { langs[item.lang || 'en'] = 1; });
  console.log('SEO pass: ' + items.length + ' pages, orphan hubs ' + Object.keys(extra).length +
    ', font preloads ' + fontFiles.length + ', languages ' + Object.keys(langs).join(','));
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
