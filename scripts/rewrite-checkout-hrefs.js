#!/usr/bin/env node
/* Replace public buy.stripe.com hrefs with /checkout/ gate links.
 * Comments are left alone. Payment Link strings in lib/ stay put.
 * Run: node scripts/rewrite-checkout-hrefs.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const gate = require('../lib/checkout-gate');

const root = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'dist', 'transformerpath', 'archive', '.git', 'tests', 'functions', 'supabase']);
const URL_RE = /https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+(?:\?[^"'\\\s<]*)?/g;

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name.startsWith('.')) return;
    if (SKIP.has(ent.name)) return;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  });
  return out;
}

function pageEvent(html) {
  const tagged = html.match(/data-tp-event-id="([^"]+)"/);
  if (tagged && gate.cleanSlug(tagged[1])) return gate.cleanSlug(tagged[1]);
  return '';
}

function slugFromFile(file) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const mfr = rel.match(/^manufacturers\/([a-z0-9]+(?:-[a-z0-9]+)*)\/index\.html$/);
  return mfr ? mfr[1] : '';
}

function replaceOutsideComments(html, fn) {
  return html.split(/(<!--[\s\S]*?-->)/g).map(function (part) {
    if (part.indexOf('<!--') === 0) return part;
    return fn(part);
  }).join('');
}

function applyContext(parsed, source, eventId) {
  const track = source.match(/data-track-event="([^"]+)"/);
  const component = source.match(/data-component-sponsor-pay="([^"]+)"/);
  if (!parsed.event && track && (parsed.product === 'featured_event' || parsed.product === 'featured_exhibitor')) {
    parsed.event = gate.cleanSlug(track[1]);
  }
  if (!parsed.event && !parsed.slug && eventId && (parsed.product === 'featured_event' || parsed.product === 'featured_exhibitor')) {
    parsed.event = eventId;
  }
  const componentKey = component ? gate.cleanSlug(component[1]) : '';
  if (componentKey === 'pressboard' || componentKey === 'coresteel' || componentKey === 'copper' || componentKey === 'bushings') {
    parsed.component = componentKey;
  }
  return gate.gateQuery(parsed) || '';
}

function rewriteUrls(html, eventId) {
  return replaceOutsideComments(html, function (part) {
    const tags = part.replace(/<a\b[^>]*>/g, function (tag) {
      return tag.replace(URL_RE, function (found) {
        const parsed = gate.parseStripeHref(found);
        if (!parsed) return found;
        return applyContext(parsed, tag, eventId) || found;
      });
    });
    return tags.replace(URL_RE, function (found) {
      const parsed = gate.parseStripeHref(found);
      if (!parsed) return found;
      return applyContext(parsed, '', eventId) || found;
    });
  });
}

function addClaimSlug(html, slug) {
  if (!slug) return html;
  return html.replace(/href="([^"]*claim-profile\.html\?company=[^"]*)"/g, function (full, href) {
    if (/[?&]slug=/.test(href)) return full;
    return 'href="' + href + '&slug=' + encodeURIComponent(slug) + '"';
  });
}

function main() {
  const files = walk(root, []);
  let changed = 0;
  files.forEach(function (file) {
    const before = fs.readFileSync(file, 'utf8');
    let html = rewriteUrls(before, pageEvent(before));
    html = addClaimSlug(html, slugFromFile(file));
    if (path.basename(path.dirname(file)) !== 'checkout') {
      html = html.replace(/<input type="email"[^>]*data-checkout-email[^>]*>/g, '');
    }
    if (html !== before) {
      fs.writeFileSync(file, html);
      changed++;
    }
  });
  console.log('checkout hrefs rewritten: ' + changed + ' of ' + files.length);
}

if (require.main === module) main();

module.exports = { rewriteUrls: rewriteUrls, addClaimSlug: addClaimSlug };
