/* Sourced parent/group links. A link is added only with a public source_url.
 * Plant profiles stay their own pages. This does not merge them.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function load(root) {
  const file = path.join(root || path.join(__dirname, '..'), 'data', 'company-parents.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  return doc;
}

function parentFor(record, root) {
  if (!record) return null;
  const doc = load(root);
  const slug = record.slug || record.canonical_slug || '';
  const direct = (doc.links || []).find(function (link) { return link.child_slug === slug; });
  if (direct && direct.source_url && direct.parent_slug) return direct;
  const group = (doc.groups || []).find(function (g) {
    if (!g || !g.slug_prefix || !g.source_url) return false;
    if (slug === g.parent_slug) return false;
    if ((g.exclude_slugs || []).indexOf(slug) >= 0) return false;
    return slug.indexOf(g.slug_prefix) === 0 || (g.also_slugs || []).indexOf(slug) >= 0;
  });
  if (!group) return null;
  return {
    child_slug: slug,
    parent_name: group.parent_name,
    parent_slug: group.parent_slug,
    source_url: group.source_url,
    source_note: group.source_note,
    retrieved_at: group.retrieved_at || doc.checked || ''
  };
}

module.exports = { load: load, parentFor: parentFor };
