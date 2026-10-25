/* Privacy, Terms and Contact belong in every page footer.
 *
 * Existing site footers already link these pages. This fills a footer that
 * is missing one of them, and adds a footer when a published page has none.
 * A second call leaves the page unchanged.
 */
'use strict';

const LINKS = [
  { key: 'privacy', href: '/privacy.html', label: 'Privacy' },
  { key: 'terms', href: '/terms.html', label: 'Terms' },
  { key: 'contact', href: '/contact.html', label: 'Contact' }
];

function masked(html) {
  return String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function (block) {
    return block.replace(/./g, ' ');
  }).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, function (block) {
    return block.replace(/./g, ' ');
  }).replace(/<!--[\s\S]*?-->/g, function (block) {
    return block.replace(/./g, ' ');
  });
}

function footerSpans(html) {
  const view = masked(html);
  const re = /<footer\b[^>]*>[\s\S]*?<\/footer>/gi;
  const spans = [];
  let match;
  while ((match = re.exec(view))) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      html: html.slice(match.index, match.index + match[0].length)
    });
  }
  return spans;
}

function hasLink(footerHtml, key) {
  if (key === 'privacy') return /href\s*=\s*["'][^"']*privacy(?:-policy)?(?:\.html)?(?=["'#?])/i.test(footerHtml);
  if (key === 'terms') return /href\s*=\s*["'][^"']*terms(?:\.html)?(?=["'#?])/i.test(footerHtml);
  return /href\s*=\s*["'][^"']*contact(?:\.html)?(?=["'#?])/i.test(footerHtml);
}

function missingLinks(footerHtml) {
  return LINKS.filter(function (link) { return !hasLink(footerHtml, link.key); });
}

function linkMarkup(links) {
  return '<nav class="tp-legal" aria-label="Policies">' + links.map(function (link) {
    return '<a href="' + link.href + '">' + link.label + '</a>';
  }).join(' ') + '</nav>';
}

function footerShell() {
  return '<footer><div class="container">' + linkMarkup(LINKS) +
    '<p style="margin:8px 0 0;color:var(--muted);font-size:.85rem">&#169; 2026 TransformerPath. All rights reserved.</p>' +
    '</div></footer>';
}

function ensureLegalFooter(html) {
  const source = String(html || '');
  if (!/<\/body>/i.test(source)) return source;
  const spans = footerSpans(source);
  if (!spans.length) {
    return source.replace(/<\/body>/i, footerShell() + '\n</body>');
  }
  const combined = spans.map(function (span) { return span.html; }).join('\n');
  const missing = missingLinks(combined);
  if (!missing.length) return source;
  const last = spans[spans.length - 1];
  const nav = linkMarkup(missing);
  const inserted = /<\/div>\s*<\/footer>/i.test(last.html)
    ? last.html.replace(/<\/div>\s*<\/footer>/i, nav + '</div></footer>')
    : last.html.replace(/<\/footer>/i, nav + '</footer>');
  return source.slice(0, last.start) + inserted + source.slice(last.end);
}

module.exports = {
  LINKS: LINKS,
  footerSpans: footerSpans,
  missingLinks: missingLinks,
  ensureLegalFooter: ensureLegalFooter
};
