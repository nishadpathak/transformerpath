/* Post an Intel item with X's public intent URL.
 * No SDK, no embed, no API key. The url parameter is the item on
 * transformerpath.com, not the external source.
 */
'use strict';

var TITLE_MAX = 200;

function shortTitle(title) {
  var text = String(title || '').replace(/\s+/g, ' ').trim();
  if (text.length <= TITLE_MAX) return text;
  var cut = text.slice(0, TITLE_MAX);
  var trimmed = cut.replace(/\s+\S*$/, '');
  return trimmed || cut;
}

function intelCanonical(id) {
  return 'https://transformerpath.com/intel.html#p-' + String(id || '');
}

function xPostHref(title, pageUrl) {
  return 'https://x.com/intent/post?text=' + encodeURIComponent(shortTitle(title)) +
    '&url=' + encodeURIComponent(pageUrl) +
    '&via=transformerpath';
}

module.exports = {
  TITLE_MAX: TITLE_MAX,
  shortTitle: shortTitle,
  intelCanonical: intelCanonical,
  xPostHref: xPostHref
};
