#!/usr/bin/env node
/* Fail the build when a page states a checkmark or a 100% completeness
 * figure that is not a field in the data, or when a unit pill has no number.
 *
 * A capability "✓ Yes" is allowed only when that laboratory's capability
 * field is strictly true and the scope is not a placeholder. A standalone
 * "100%" stat is allowed only on a control such as the grid-lab load button.
 * Directory provenance uses "N of M" from the source URL and check date.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { sourcedCardCount } = require('../lib/sourced-card-count');

let failed = 0;
function fail(detail) {
  console.error('  ✗ ' + detail);
  failed++;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'scratch']);
const UNIT = /^(?:kV|kVA|MVA|MVAr|kvar)(?:\s+Peak)?$/i;
const HUNDRED = /^(?:100%|100% Compliant)$/;

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name.startsWith('.')) return;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) return;
      walk(full, out);
      return;
    }
    if (ent.isFile() && ent.name.endsWith('.html')) out.push(full);
  });
}

function visibleHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

/* Tiny stack walk. Enough for text nodes and the attributes we care about. */
function scanVisible(html, onText) {
  const src = visibleHtml(html);
  const token = /<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  const stack = [];
  let m;
  while ((m = token.exec(src))) {
    if (m[3] != null) {
      onText(m[3], stack);
      continue;
    }
    const tag = m[1].toLowerCase();
    const raw = m[2] || '';
    const closing = m[0].startsWith('</');
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const attrs = {};
    const attr = /([:@\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = attr.exec(raw))) attrs[a[1].toLowerCase()] = a[3] != null ? a[3] : a[4];
    const selfClose = /\/>$/.test(m[0]) || tag === 'br' || tag === 'img' || tag === 'meta' || tag === 'link' || tag === 'input';
    if (!selfClose) stack.push({ tag: tag, attrs: attrs });
  }
}

function backed(stack) {
  return stack.some(function (el) {
    if (el.tag === 'button') return true;
    if (el.attrs['data-load'] != null) return true;
    if (el.attrs['data-feature']) return true;
    if (el.attrs['data-delivery']) return true;
    if (el.attrs['data-sourced']) return true;
    if (el.attrs['data-claim']) return true;
    if (el.attrs['data-stat']) return true;
    return false;
  });
}

function classOf(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].attrs.class) return stack[i].attrs.class;
  }
  return '';
}

function scopeUnsourced(lab) {
  const sc = String(lab.short_circuit_capacity || '');
  const scope = String((lab.accreditation && lab.accreditation.scope) || '');
  return /not restated/i.test(sc) || /as published on the laboratory website/i.test(scope);
}

function escName(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function checkLaboratories() {
  const data = JSON.parse(fs.readFileSync('data/laboratories.json', 'utf8'));
  const labs = data.laboratories || [];
  const html = fs.readFileSync('laboratories.html', 'utf8');
  const ssr = html.slice(0, html.indexOf('var LABS'));
  labs.forEach(function (lab) {
    const start = ssr.indexOf('>' + escName(lab.name) + '<');
    if (start < 0) {
      fail(lab.name + ' card is missing from laboratories.html');
      return;
    }
    const end = ssr.indexOf('class="lab-card"', start + 10);
    const card = ssr.slice(start, end < 0 ? start + 8000 : end);
    const yes = (card.match(/✓ Yes/g) || []).length;
    const caps = lab.capabilities || {};
    const expected = scopeUnsourced(lab)
      ? 0
      : Object.keys(caps).filter(function (k) { return caps[k] === true; }).length;
    if (yes !== expected) {
      fail(lab.name + ' shows ' + yes + ' capability checkmarks; data has ' + expected + ' sourced true fields');
    }
  });
}

function checkDirectoryStats() {
  const pages = [
    ['education.html', 'data/education.json', 'providers'],
    ['logistics.html', 'data/logistics.json', 'companies'],
    ['media.html', 'data/media.json', 'publications'],
    ['associations.html', 'data/associations.json', 'associations'],
    ['buyers.html', 'data/buyers.json', 'buyers'],
    ['services.html', 'data/services.json', 'services']
  ];
  pages.forEach(function (row) {
    const data = JSON.parse(fs.readFileSync(row[1], 'utf8'));
    const stat = sourcedCardCount(data[row[2]] || []);
    const html = fs.readFileSync(row[0], 'utf8');
    const marker = 'data-sourced="website-and-check-date"';
    const at = html.indexOf(marker);
    if (at < 0) {
      fail(row[0] + ' provenance stat is not tied to the source URL and check date');
      return;
    }
    const slice = html.slice(at, at + 180);
    if (slice.indexOf(stat.text) < 0) {
      fail(row[0] + ' provenance stat should read ' + stat.text);
    }
  });
}

function fixtureHits(html) {
  let hits = 0;
  scanVisible(html, function (text, stack) {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    const cls = classOf(stack);
    if (/\bpill\b/.test(cls) && UNIT.test(trimmed)) hits++;
    if (HUNDRED.test(trimmed) && !backed(stack)) hits++;
  });
  return hits;
}

console.log('=== UNSOURCED CLAIM GUARD ===');
if (!fixtureHits('<span class="kv-pill"> kV Peak</span>')) fail('fixture missed an empty kV pill');
if (!fixtureHits('<div class="num">100%</div>')) fail('fixture missed a bare 100% stat');
if (!fixtureHits('<span class="badge-healthy">100% Compliant</span>')) fail('fixture missed a 100% compliance badge');
if (fixtureHits('<span class="kv-pill uhv">1200 kV Peak</span>')) fail('fixture flagged a numbered voltage');
if (fixtureHits('<button data-load="100" class="active">100%</button>')) fail('fixture flagged the grid-lab load control');
if (fixtureHits('<div class="num" data-sourced="website-and-check-date">8 of 8</div>')) fail('fixture flagged a counted provenance stat');

checkLaboratories();
checkDirectoryStats();

const files = [];
walk('.', files);
files.forEach(function (file) {
  const html = fs.readFileSync(file, 'utf8');
  scanVisible(html, function (text, stack) {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed) return;
    const cls = classOf(stack);
    if (/\bpill\b/.test(cls) && UNIT.test(trimmed)) {
      fail(file + ' unit pill has no number: ' + JSON.stringify(trimmed));
    }
    if (HUNDRED.test(trimmed) && !backed(stack)) {
      fail(file + ' states ' + JSON.stringify(trimmed) + ' without a data field');
    }
    if (trimmed === '✓ Yes' && !backed(stack) && path.basename(file) !== 'laboratories.html') {
      fail(file + ' states ✓ Yes without a data field');
    }
  });
});

if (failed) {
  console.error('UNSOURCED CLAIM GUARD FAILED (' + failed + ')');
  process.exit(1);
}
console.log('UNSOURCED CLAIM GUARD OK');
