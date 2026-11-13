/* Give every skip link a real target.
 * Pages ship <a class="skip-link" href="#main"> and some never marked <main>.
 * The build stamps id="main" so the link lands on the content.
 */
'use strict';

function masked(html) {
  return String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function (block) {
    return block.replace(/./g, ' ');
  }).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, function (block) {
    return block.replace(/./g, ' ');
  });
}

function ensureSkipTarget(html) {
  const source = String(html || '');
  if (source.indexOf('skip-link') === -1) return source;
  if (/\bid=["']main["']/.test(masked(source))) return source;
  const view = masked(source);
  const main = /<main\b([^>]*)>/i.exec(view);
  if (main && !/\bid\s*=/.test(main[0])) {
    const start = main.index;
    const tag = source.slice(start, start + main[0].length);
    const patched = tag.replace(/<main\b/i, '<main id="main" tabindex="-1"');
    return source.slice(0, start) + patched + source.slice(start + tag.length);
  }
  const headerEnd = view.search(/<\/header>/i);
  const footerAt = view.search(/<footer\b/i);
  if (headerEnd !== -1 && footerAt > headerEnd) {
    const openAt = headerEnd + '</header>'.length;
    return source.slice(0, openAt) + '<main id="main" tabindex="-1">' + source.slice(openAt, footerAt) + '</main>' + source.slice(footerAt);
  }
  if (/<body\b/i.test(source)) {
    return source.replace(/<body\b[^>]*>/i, function (tag) {
      return tag + '<main id="main" tabindex="-1">';
    }).replace(/<\/body>/i, '</main></body>');
  }
  return source;
}

module.exports = { ensureSkipTarget };
