#!/usr/bin/env node
/* CI gate: every Get verified / Claim this profile CTA href is the $499
 * Verified Manufacturer Payment Link, with client_reference_id set to the
 * maker slug. Profiles that already carry the earned verified badge omit it.
 * A verified label is rendered only for a reviewed paid listing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const paid = require('./lib/paid-listings');
const { directoryCompanySlug } = require('./lib/company-aliases');

const LINK = paid.VERIFIED_MANUFACTURER_PAYMENT_LINK;

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function attr(tag, name) {
  const m = String(tag).match(new RegExp('\\b' + name + '="([^"]*)"'));
  return m ? decode(m[1]) : '';
}

function anchorTags(html) {
  return String(html || '').match(/<a\b[^>]*>/gi) || [];
}

function payAnchors(html) {
  return anchorTags(html).filter(function (tag) {
    return attr(tag, 'data-mfr-verify-cta') || attr(tag, 'data-verified-manufacturer-pay');
  });
}

function expectedHref(slug) {
  return LINK + '?client_reference_id=' + encodeURIComponent(slug);
}

function hrefViolation(tag, slug, where) {
  const href = attr(tag, 'href');
  if (href !== expectedHref(slug)) {
    return where + ': CTA href is not the $499 link for ' + (slug || 'missing slug') + ' (' + href + ')';
  }
  return '';
}

function slugMap() {
  const map = Object.create(null);
  JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')).forEach(function (row) {
    if (!row || !row.name || !row.slug) return;
    map[String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] = row.slug;
  });
  return map;
}

function earnedSlugs(doc) {
  const set = new Set();
  (doc && doc.listings ? doc.listings : []).forEach(function (row) {
    if (paid.reviewed(row) && row.product === 'verified_manufacturer' && row.company_slug) {
      set.add(String(row.company_slug).trim().toLowerCase());
    }
  });
  return set;
}

function auditProfiles(doc) {
  const violations = [];
  let pages = 0;
  fs.readdirSync('manufacturers').forEach(function (dir) {
    const file = path.join('manufacturers', dir, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
    const html = fs.readFileSync(file, 'utf8');
    if (html.indexOf('http-equiv="refresh"') >= 0) return;
    if (html.indexOf('>Claim this profile →</a>') < 0) return;
    const earned = paid.isVerifiedManufacturer(dir, doc);
    const badge = html.indexOf('data-paid-badge="verified-manufacturer"') >= 0;
    const ctas = payAnchors(html).filter(function (tag) { return attr(tag, 'data-mfr-verify-cta'); });
    const kinds = ctas.map(function (tag) { return attr(tag, 'data-mfr-verify-cta'); });
    if (earned || badge) {
      if (!earned) violations.push(file + ': verified badge without a reviewed paid row');
      if (ctas.length) violations.push(file + ': verify CTA on a profile that already has the verified badge');
      payAnchors(html).forEach(function (tag) {
        violations.push(file + ': payment CTA still present on an earned profile');
      });
      if (html.indexOf('>✓ Verified<') >= 0 || html.indexOf('>VERIFIED MANUFACTURER<') >= 0 || html.indexOf('>Verified</span>') >= 0) {
        if (!earned) violations.push(file + ': verified label without a reviewed paid row');
      }
      return;
    }
    pages++;
    if (kinds.indexOf('claim') < 0 || kinds.indexOf('get-verified') < 0) {
      violations.push(file + ': missing Get verified or Claim this profile CTA');
    }
    const claimAt = html.indexOf('data-mfr-verify-cta="claim"');
    const noteAt = html.indexOf('Independent census profile');
    if (claimAt < 0 || noteAt < 0 || claimAt > noteAt) {
      violations.push(file + ': CTA is not at the top of the profile');
    }
    if (html.indexOf('>✓ Verified<') >= 0 || html.indexOf('>VERIFIED MANUFACTURER<') >= 0 || html.indexOf('>Verified</span>') >= 0) {
      violations.push(file + ': verified label without a reviewed paid row');
    }
    payAnchors(html).forEach(function (tag) {
      const v = hrefViolation(tag, dir, file);
      if (v) violations.push(v);
    });
  });
  return { violations: violations, pages: pages };
}

function boardHtml(page) {
  const start = page.indexOf('<!--SSR:mfg-board-->');
  const end = page.indexOf('<!--/SSR:mfg-board-->');
  if (start < 0 || end < start) throw new Error('manufacturer board markers missing');
  return page.slice(start, end);
}

function auditBoard(board, map, earned) {
  const violations = [];
  let rows = 0;
  board.split('<div class="mk-row">').slice(1).forEach(function (part) {
    const named = part.match(/class="prof"[^>]*>([^<]*)</) || part.match(/<b>([^<]*)<\/b>/);
    if (!named) return;
    const name = decode(named[1]);
    if (/^Served by/i.test(name)) return;
    rows++;
    const slug = directoryCompanySlug(name, map);
    const ctas = payAnchors(part).filter(function (tag) { return attr(tag, 'data-mfr-verify-cta'); });
    const kinds = ctas.map(function (tag) { return attr(tag, 'data-mfr-verify-cta'); });
    const rowEarned = !!(slug && earned.has(slug));
    if (rowEarned) {
      if (ctas.length) violations.push('directory row ' + name + ': CTA on an earned verified profile');
      return;
    }
    if (!slug) violations.push('directory row ' + name + ': no maker slug for client_reference_id');
    if (kinds.indexOf('claim') < 0 || kinds.indexOf('get-verified') < 0) {
      violations.push('directory row ' + name + ': missing Get verified or Claim this profile CTA');
    }
    if (part.indexOf('>✓ Verified<') >= 0 || part.indexOf('data-paid-badge="verified-manufacturer"') >= 0 || part.indexOf('data-earned-verified="1"') >= 0) {
      violations.push('directory row ' + name + ': verified label without a reviewed paid row');
    }
    ctas.forEach(function (tag) {
      const v = hrefViolation(tag, slug, 'directory row ' + name);
      if (v) violations.push(v);
    });
  });
  return { violations: violations, rows: rows };
}

function el(id) {
  return {
    id: id,
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    dataset: {},
    children: [],
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    setAttribute() {},
    appendChild(node) { this.children.push(node); return node; },
    insertBefore(node) { this.children.unshift(node); return node; },
    addEventListener() {},
    scrollIntoView() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function auditClient(pageHtml, census, slugs, tiers, stats, paidDoc, map, earned) {
  const violations = [];
  const start = pageHtml.indexOf('const DATA_URL');
  const end = pageHtml.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('directory script missing');
  let source = pageHtml.slice(start, end).replace('loadData();', 'globalThis.__ready = loadData();');
  source = source.replace('let page = 1', 'var page = 1');
  const nodes = {};
  function get(id) { return nodes[id] || (nodes[id] = el(id)); }
  const context = {
    console: console,
    document: { getElementById: get, createElement() { return el(''); } },
    fetch: function (url) {
      const u = String(url);
      let body = null;
      if (u.indexOf('manufacturers.json') >= 0) body = census;
      else if (u.indexOf('company-slugs.json') >= 0) body = slugs;
      else if (u.indexOf('listing-tiers.json') >= 0) body = tiers;
      else if (u.indexOf('site-stats.json') >= 0) body = stats;
      else if (u.indexOf('paid-listings.json') >= 0) body = paidDoc;
      if (!body) return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } });
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } });
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'manufacturers.html' });
  return context.__ready.then(function () {
    const seen = new Set();
    let guard = 0;
    while (guard < 30) {
      guard++;
      const html = nodes.board.innerHTML;
      auditBoard(html, map, earned).violations.forEach(function (v) { violations.push('live ' + v); });
      const names = html.match(/class="prof"[^>]*>[^<]*</g) || [];
      names.forEach(function (bit) {
        const name = decode((bit.match(/>([^<]*)</) || [])[1] || '');
        if (name) seen.add(name.toLowerCase());
      });
      if (html.indexOf('data-pg="next" disabled') >= 0 || html.indexOf('data-pg="next"') < 0) break;
      context.page += 1;
      context.render();
    }
    return { violations: violations, rows: seen.size };
  });
}

async function audit() {
  const doc = paid.load();
  const earned = earnedSlugs(doc);
  const map = slugMap();
  const profiles = auditProfiles(doc);
  const page = fs.readFileSync('manufacturers.html', 'utf8');
  if (page.indexOf(LINK) < 0) profiles.violations.push('manufacturers.html: directory script is missing the $499 link');
  const board = auditBoard(boardHtml(page), map, earned);
  const census = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));
  const slugs = JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8'));
  const tiers = JSON.parse(fs.readFileSync('data/listing-tiers.json', 'utf8'));
  const stats = JSON.parse(fs.readFileSync('data/site-stats.json', 'utf8'));
  const client = await auditClient(page, census, slugs, tiers, stats, doc, map, earned);
  const violations = profiles.violations.concat(board.violations).concat(client.violations);
  if (profiles.pages < 900) violations.push('only ' + profiles.pages + ' profile pages carry the CTA');
  if (board.rows < 900) violations.push('only ' + board.rows + ' directory rows carry the CTA');
  if (client.rows < board.rows) violations.push('live directory rendered ' + client.rows + ' makers, board has ' + board.rows);
  return { violations: violations, pages: profiles.pages, rows: board.rows, liveRows: client.rows };
}

function main() {
  audit().then(function (result) {
    if (result.violations.length) {
      console.error('VERIFIED CTA GATE FAIL (' + result.violations.length + ')');
      result.violations.slice(0, 40).forEach(function (v) { console.error('  ' + v); });
      process.exit(1);
    }
    console.log('VERIFIED CTA GATE PASS profiles=' + result.pages + ' directory_rows=' + result.rows + ' live_rows=' + result.liveRows);
  }).catch(function (err) {
    console.error(err && err.stack || err);
    process.exit(1);
  });
}

module.exports = { audit: audit, expectedHref: expectedHref };

if (require.main === module) main();
