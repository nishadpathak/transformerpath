/* Official TransformerPath X account in the site header and footer.
 * A plain link: no SDK, no embed, no tracking script.
 *
 * The same anchors live in _partials/header.html and _partials/footer.html.
 * build-dist.js calls ensureSiteX so a page that was not regenerated from
 * those partials still publishes the link.
 */
'use strict';

var ACCOUNT = 'https://x.com/transformerpath';

var ICON_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

var HEADER_LINK = '<a class="tp-x-link" href="' + ACCOUNT + '" target="_blank" rel="noopener" aria-label="TransformerPath on X" title="TransformerPath on X"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="' + ICON_PATH + '"/></svg></a>';

var FOOTER_LINK = '<a class="tp-li-btn tp-x-follow" href="' + ACCOUNT + '" target="_blank" rel="noopener" aria-label="TransformerPath on X"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="' + ICON_PATH + '"/></svg>Follow us on X</a>';

var ACCOUNT_HREF = 'href="' + ACCOUNT + '"';

function masked(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function (block) {
      return block.replace(/./g, ' ');
    })
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, function (block) {
      return block.replace(/./g, ' ');
    });
}

function spans(html, tag) {
  var view = masked(html);
  var re = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
  var found = [];
  var match;
  while ((match = re.exec(view))) {
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      html: html.slice(match.index, match.index + match[0].length)
    });
  }
  return found;
}

function headerWithAccount(block) {
  if (block.indexOf(ACCOUNT_HREF) !== -1) return block;
  if (block.indexOf('<span class="tpnav-utils">') !== -1) {
    return block.replace('<span class="tpnav-utils">', '<span class="tpnav-utils">' + HEADER_LINK);
  }
  if (block.indexOf('<div class="gl-top-links">') !== -1) {
    return block.replace('<div class="gl-top-links">', '<div class="gl-top-links">' + HEADER_LINK);
  }
  if (/\btpnav\b/.test(block) && block.indexOf('</nav>') !== -1) {
    return block.replace('</nav>', HEADER_LINK + '</nav>');
  }
  return block.replace(/<\/header>/i, HEADER_LINK + '</header>');
}

function ensureHeaderAccount(html) {
  var source = String(html || '');
  var blocks = spans(source, 'header');
  if (!blocks.length) return source;
  var cursor = 0;
  var out = '';
  blocks.forEach(function (block) {
    out += source.slice(cursor, block.start);
    out += headerWithAccount(block.html);
    cursor = block.end;
  });
  out += source.slice(cursor);
  return out;
}

function ensureFooterAccount(html) {
  var source = String(html || '');
  var blocks = spans(source, 'footer');
  if (!blocks.length) return source;
  var cursor = 0;
  var out = '';
  blocks.forEach(function (block) {
    out += source.slice(cursor, block.start);
    out += footerWithAccount(block.html);
    cursor = block.end;
  });
  out += source.slice(cursor);
  return out;
}

function footerWithAccount(block) {
  if (block.indexOf(ACCOUNT_HREF) !== -1) return block;
  var linkedin = /(<a\b[^>]*\bdata-linkedin-follow\b[^>]*>[\s\S]*?<\/a>)/i;
  if (linkedin.test(block)) return block.replace(linkedin, '$1' + FOOTER_LINK);
  if (/<div class="copyright">/.test(block)) {
    return block.replace('<div class="copyright">', FOOTER_LINK + '\n    <div class="copyright">');
  }
  return block.replace(/<\/footer>/i, FOOTER_LINK + '</footer>');
}

function ensureSiteX(html) {
  return ensureFooterAccount(ensureHeaderAccount(html));
}

function chromeGaps(html) {
  var gaps = [];
  spans(html, 'header').forEach(function (block, index) {
    if (block.html.indexOf(ACCOUNT_HREF) === -1) gaps.push('header #' + (index + 1));
  });
  spans(html, 'footer').forEach(function (block, index) {
    if (block.html.indexOf(ACCOUNT_HREF) === -1) gaps.push('footer #' + (index + 1));
  });
  return gaps;
}

module.exports = {
  ACCOUNT: ACCOUNT,
  HEADER_LINK: HEADER_LINK,
  FOOTER_LINK: FOOTER_LINK,
  ensureHeaderAccount: ensureHeaderAccount,
  ensureFooterAccount: ensureFooterAccount,
  ensureSiteX: ensureSiteX,
  chromeGaps: chromeGaps
};
