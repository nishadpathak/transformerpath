/* Public accessory profile slug.
 *
 * The page folder follows slugify(name). publish_at_slug is set only when
 * the approved URL is a stored slug that slugify(name) does not produce.
 * Rows without that flag keep the derived slug, including the historical
 * rows whose stored slug never became a folder.
 */
'use strict';

function derivedSlug(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function accessoryPublicSlug(supplier) {
  const derived = derivedSlug(supplier && supplier.name);
  if (supplier && supplier.publish_at_slug === true) {
    const explicit = String(supplier.slug || '').trim();
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(explicit)) return explicit;
  }
  if (derived) return derived;
  return require('./company-aliases').slugify(supplier && supplier.name);
}

module.exports = { derivedSlug: derivedSlug, accessoryPublicSlug: accessoryPublicSlug };
