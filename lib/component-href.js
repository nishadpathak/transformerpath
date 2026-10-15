/* Public URL for a component category.
 *
 * A directory hub at components/<slug>/index.html owns /components/<slug>/.
 * A sibling components/<slug>.html is what Netlify would serve at that same
 * path, hiding the hub. Callers must link to the hub when it exists.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function componentHasHub(slug) {
  return fs.existsSync(path.join(ROOT, 'components', slug, 'index.html'));
}

/** dotPrefix is '' at the site root, '../' one level down, '../../' two down. */
function componentSlugHref(dotPrefix, slug) {
  const tail = componentHasHub(slug) ? (slug + '/') : (slug + '.html');
  return dotPrefix + 'components/' + tail;
}

module.exports = { componentHasHub: componentHasHub, componentSlugHref: componentSlugHref };
