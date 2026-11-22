/* Private do-not-contact flags for directory quote requests.
 * The public quote form does not read this file. A SQL trigger reads the
 * slugs seeded from suppressedSlugs(). Nothing is emailed.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function flagged(value) {
  if (value === true) return true;
  const s = String(value == null ? '' : value).trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

function collect(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(function (row) { collect(row, out); });
    return;
  }
  const slug = String(node.slug || node.canonical_slug || '').trim().toLowerCase();
  if (SLUG_RE.test(slug) && (flagged(node.never_contact) || flagged(node.do_not_contact))) out.add(slug);
  Object.keys(node).forEach(function (key) {
    if (key === 'never_contact' || key === 'do_not_contact') return;
    const child = node[key];
    if (child && typeof child === 'object') collect(child, out);
  });
}

function suppressedSlugs(root) {
  const data = path.join(root || path.join(__dirname, '..'), 'data');
  const out = new Set();
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
      if (ent.name.startsWith('.')) return;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'csv-exports') return;
        walk(p);
        return;
      }
      if (!ent.name.endsWith('.json')) return;
      const st = fs.statSync(p);
      if (st.size > 80 * 1024 * 1024) return;
      const text = fs.readFileSync(p, 'utf8');
      if (text.indexOf('never_contact') === -1 && text.indexOf('do_not_contact') === -1) return;
      collect(JSON.parse(text), out);
    });
  }
  if (fs.existsSync(data)) walk(data);
  return Array.from(out).sort();
}

module.exports = {
  SLUG_RE: SLUG_RE,
  suppressedSlugs: suppressedSlugs
};
