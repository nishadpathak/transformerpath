#!/usr/bin/env node
/* check-seo.js — fail the build on duplicate or out-of-range titles and
 * descriptions, missing self-canonicals, or JSON-LD that invents a firm
 * event date, a rating, a review, or a street address.
 *
 * Run after build-seo-pass.js: node check-seo.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const schema = require('./lib/seo-schema');
const html = require('./lib/seo-html');
const catalog = require('./lib/seo-catalog');
const { resolveStatus } = require('./lib/event-status');
const eventSeo = require('./lib/event-seo');
const cwv = require('./lib/seo-cwv');

const DIST = process.argv[2] || 'dist';
const problems = [];

function fail(msg) { problems.push(msg); }

function walk(dir, out) {
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

function forbiddenFacts(node, rel) {
  const blob = JSON.stringify(node);
  if (/"aggregateRating"/.test(blob) || /"reviewCount"/.test(blob)) {
    fail(rel + ': JSON-LD includes a rating');
  }
  if (/"@type":"Review"/.test(blob) || /"@type":"AggregateRating"/.test(blob)) {
    fail(rel + ': JSON-LD includes a review');
  }
  if (/"streetAddress"/.test(blob)) fail(rel + ': JSON-LD includes a street address');
}

function hasSearchAction(nodes) {
  return nodes.some(function (n) {
    if (n['@type'] !== 'WebSite' || !n.potentialAction) return false;
    const action = n.potentialAction;
    const target = action.target && (action.target.urlTemplate || action.target);
    return action['@type'] === 'SearchAction' &&
      String(target).indexOf('/search.html?q={search_term_string}') !== -1;
  });
}

function breadcrumbsOk(nodes) {
  const b = nodes.filter(function (n) { return n['@type'] === 'BreadcrumbList'; })[0];
  if (!b || !Array.isArray(b.itemListElement) || !b.itemListElement.length) return false;
  return b.itemListElement.every(function (item, i) {
    return item.position === i + 1 && item.name && item.item;
  });
}

if (!fs.existsSync(DIST)) {
  console.error('check-seo: missing ' + DIST);
  process.exit(1);
}

const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
if (!/Sitemap:\s*https:\/\/transformerpath\.com\/sitemap\.xml/i.test(robots)) {
  fail('robots.txt does not point at https://transformerpath.com/sitemap.xml');
}

const cat = catalog.create();
const files = walk(DIST, []);
const titles = {};
const descs = {};
const langs = {};
const inbound = {};

files.forEach(function (file) {
  const rel = relOf(file);
  const source = fs.readFileSync(file, 'utf8');
  const pub = html.publicPath(rel);
  inbound[pub] = inbound[pub] || 0;
  const title = html.stripTags((source.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = html.metaContent(source, 'description');
  const canon = (source.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    source.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) || [])[1] || '';
  const noindex = html.isNoindex(source);
  const lang = (source.match(/<html[^>]*\blang=["']([^"']+)["']/i) || [])[1] || 'en';
  langs[lang] = 1;

  const eventProfile = /data-tp-event-role="(?:hub|edition)"/.test(source);
  const titleMax = eventProfile ? 100 : 60;
  if (title.length < 50 || title.length > titleMax) fail(rel + ': title length ' + title.length + ' (' + title + ')');
  if (eventProfile) {
    const brands = title.match(/TransformerPath/g) || [];
    if (brands.length !== 1) fail(rel + ': event title brand count ' + brands.length + ' (' + title + ')');
    if (!/\| Transformer Events \| TransformerPath$/.test(title)) fail(rel + ': event title suffix (' + title + ')');
    if (/\sprofile\b/i.test(title) || /\| transformer event\b/i.test(title)) {
      fail(rel + ': old event title (' + title + ')');
    }
  }
  if (rel === 'events.html') {
    const brands = title.match(/TransformerPath/g) || [];
    if (brands.length !== 1) fail('events.html title brand count ' + brands.length + ' (' + title + ')');
    if (/TransformerPath\s*\|\s*TransformerPath/.test(title)) fail('events.html duplicates the brand (' + title + ')');
  }
  if (description.length < 140 || description.length > 160) {
    fail(rel + ': description length ' + description.length);
  }
  if (titles[title]) fail(rel + ': duplicate title with ' + titles[title]);
  else titles[title] = rel;
  if (descs[description]) fail(rel + ': duplicate description with ' + descs[description]);
  else descs[description] = rel;

  if (!canon) fail(rel + ': missing canonical');
  else if (!noindex && canon !== html.publicUrl(rel)) fail(rel + ': canonical ' + canon + ' is not self');
  else if (noindex && canon.indexOf(schema.ORIGIN) !== 0) fail(rel + ': canonical is not on-site');

  if (/rel=["']alternate["'][^>]*hreflang=/i.test(source) || /hreflang=["'][^"']+["'][^>]*rel=["']alternate["']/i.test(source)) {
    fail(rel + ': hreflang is present');
  }

  const blocks = schema.extractJsonLd(source);
  blocks.forEach(function (b) {
    if (b && b.__invalid) fail(rel + ': invalid JSON-LD ' + b.error);
  });
  const nodes = schema.flatten(blocks);
  nodes.forEach(function (n) { if (!n.__invalid) forbiddenFacts(n, rel); });
  const siteOrg = nodes.some(function (n) {
    return n['@type'] === 'Organization' && n.name === 'TransformerPath' && n.url === schema.ORIGIN + '/';
  });
  if (!siteOrg) fail(rel + ': missing TransformerPath Organization');
  if (!hasSearchAction(nodes)) fail(rel + ': missing WebSite SearchAction');
  if (!breadcrumbsOk(nodes)) fail(rel + ': BreadcrumbList is missing or unordered');

  if (/^events\/[^/]+\/index\.html$/.test(rel)) {
    const role = catalog.eventRoleOf(source);
    const eventNodes = nodes.filter(function (n) { return n['@type'] === 'Event'; });
    if (!eventNodes.length) fail(rel + ': missing Event');
    if (role === 'hub') {
      eventNodes.forEach(function (n) {
        if (n.startDate || String(n.eventStatus || '').indexOf('EventScheduled') !== -1) {
          fail(rel + ': series hub claims a dated occurrence');
        }
        schema.validateEventNode(n).forEach(function (err) { fail(rel + ': ' + err); });
      });
    } else if (!/http-equiv=["']refresh["']/i.test(source)) {
      const id = catalog.eventIdOf(source);
      const byId = id ? cat.events.filter(function (ev) { return ev && ev.id === id; }) : [];
      const rec = byId.length === 1 ? byId[0] : catalog.matchEvent(cat.events, html.h1(source));
      const status = rec ? resolveStatus(rec).key : 'MONITORING';
      const firm = status === 'CONFIRMED_UPCOMING' || status === 'LIVE' || status === 'COMPLETED';
      eventNodes.forEach(function (n) {
        const scheduled = String(n.eventStatus || '').indexOf('EventScheduled') !== -1;
        if (firm && rec && (rec.s || rec.start) && (rec.c || rec.co || rec.city || rec.country || schema.venueIsReal(rec.v || rec.venue))) {
          if (!scheduled) fail(rel + ': confirmed event missing EventScheduled');
          if (n.startDate !== (rec.s || rec.start)) fail(rel + ': startDate ' + n.startDate + ' != ' + (rec.s || rec.start));
          if (!n.location || n.location['@type'] !== 'Place') fail(rel + ': scheduled event missing Place');
          if (n.location && n.location.address && n.location.address['@type'] !== 'PostalAddress') {
            fail(rel + ': location address is not PostalAddress');
          }
          if (!n.eventAttendanceMode) fail(rel + ': scheduled event missing eventAttendanceMode');
          const end = rec.e || rec.end;
          if (end && n.endDate !== end) fail(rel + ': endDate ' + n.endDate + ' != ' + end);
          const org = rec.organiser || rec.organizer || '';
          if (org && (!n.organizer || n.organizer.name !== org)) fail(rel + ': organizer missing');
          const official = rec.official_url || '';
          if (/^https?:\/\//i.test(official) && (!n.offers || n.offers.url !== official)) {
            fail(rel + ': offers.url is not the official site');
          }
        } else if (scheduled || n.startDate) {
          fail(rel + ': unconfirmed event claims a firm date or EventScheduled');
        }
        schema.validateEventNode(n).forEach(function (err) { fail(rel + ': ' + err); });
        const recordedImage = rec && (rec.image || rec.image_url) || '';
        if (eventSeo.isRealEventImage(recordedImage)) {
          if (n.image !== recordedImage) fail(rel + ': recorded event image missing');
        } else if (n.image) {
          fail(rel + ': image set without an event image on the record');
        }
      });
    }
  }

  if (rel === 'intel.html') {
    cat.intelArticles.forEach(function (it) {
      const found = nodes.some(function (n) {
        return n['@type'] === 'NewsArticle' &&
          n.headline === it.headline &&
          n.datePublished === it.datePublished &&
          ((n.author && (n.author.name || n.author)) || (n.publisher && n.publisher.name));
      });
      if (!found) fail('intel.html: missing NewsArticle for ' + it.id);
    });
  }

  if (/^manufacturers\/[^/]+\/index\.html$/.test(rel) && cat.companies[rel.split('/')[1]]) {
    const c = cat.companies[rel.split('/')[1]];
    const entry = nodes.find(function (n) {
      return (n['@type'] === 'Organization' || n['@type'] === 'LocalBusiness') && n.name === c.name;
    });
    if (!entry) fail(rel + ': missing Organization for ' + c.name);
    else if (entry['@type'] === 'LocalBusiness') fail(rel + ': LocalBusiness without a sourced street');
  }

  if (source.indexOf('fonts.googleapis.com/css2') !== -1 && source.indexOf('rel="preload" as="style"') === -1) {
    fail(rel + ': Google font stylesheet is not preloaded');
  }
  if (/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/.test(source) &&
      !/defer[^>]*adsbygoogle|adsbygoogle\.js[^>]*defer/.test(source)) {
    fail(rel + ': AdSense loader is not deferred');
  }
  if (/s\.async=1;s\.src="https:\/\/emrldtp\.com/.test(source)) {
    fail(rel + ': Travelpayouts loader still loads during parse');
  }
  const scriptRe = /<script\b([^>]*)>/gi;
  let sm;
  while ((sm = scriptRe.exec(source))) {
    const attrs = sm[1];
    if (!/\bsrc\s*=/i.test(attrs)) continue;
    if (/\b(?:defer|async)\b/i.test(attrs)) continue;
    if (/type\s*=\s*["']module["']/i.test(attrs)) continue;
    // 3D boot files stay blocking so the inline scene script sees THREE.
    if (cwv.scriptKeepsParserOrder(attrs)) continue;
    fail(rel + ': blocking script ' + attrs.slice(0, 80));
    break;
  }

  const imgRe = /<img\b[^>]*>/gi;
  let im;
  let imgIndex = 0;
  while ((im = imgRe.exec(source))) {
    imgIndex++;
    const tag = im[0];
    const src = (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1] || '';
    if (/^(?:https?:|data:)/i.test(src)) continue;
    const local = path.resolve(path.dirname(file), src.split('?')[0].split('#')[0].replace(/^\//, ''));
    // Root-absolute src is relative to dist, not the file directory.
    const abs = src.charAt(0) === '/' ? path.join(DIST, src.split('?')[0]) : local;
    if (!fs.existsSync(abs)) continue;
    const dim = cwv.imageSize(abs);
    if (dim && dim.w && (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag))) {
      fail(rel + ': image missing dimensions ' + src);
    }
    if (imgIndex > 1 && !/\bloading=/.test(tag)) fail(rel + ': image missing loading ' + src);
  }
});

// Inbound links. Re-read stamped HTML.
files.forEach(function (file) {
  const rel = relOf(file);
  const source = fs.readFileSync(file, 'utf8');
  const re = /\shref=["']([^"'#?]+)["']/gi;
  let m;
  while ((m = re.exec(source))) {
    let href = m[1];
    if (/^(?:mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      if (href.indexOf(schema.ORIGIN) !== 0) continue;
      href = href.slice(schema.ORIGIN.length) || '/';
    } else if (href.charAt(0) !== '/') {
      const dir = path.posix.dirname(rel);
      href = '/' + path.posix.normalize((dir === '.' ? '' : dir + '/') + href);
    }
    if (href.endsWith('/index.html')) href = href.slice(0, -10);
    if (href === '/index.html') href = '/';
    if (inbound[href] != null) inbound[href]++;
    else if (inbound[href + '/'] != null) inbound[href + '/']++;
    else if (href.endsWith('/') && inbound[href.slice(0, -1)] != null) inbound[href.slice(0, -1)]++;
  }
});

files.forEach(function (file) {
  const rel = relOf(file);
  const source = fs.readFileSync(file, 'utf8');
  if (html.isNoindex(source)) return;
  const pub = html.publicPath(rel);
  if (pub === '/') return;
  if (!inbound[pub]) fail(rel + ': orphan page (no internal link)');
});

if (Object.keys(langs).some(function (l) { return l && l.toLowerCase().indexOf('en') !== 0; })) {
  fail('non-English pages exist but hreflang was not paired from a translation map');
}

if (problems.length) {
  console.error('SEO CHECK FAILED — ' + problems.length + ' problem(s):');
  problems.slice(0, 40).forEach(function (p) { console.error('  - ' + p); });
  if (problems.length > 40) console.error('  … and ' + (problems.length - 40) + ' more');
  process.exit(1);
}
console.log('SEO CHECK OK — ' + files.length + ' pages, unique titles and descriptions, schema rules held');
