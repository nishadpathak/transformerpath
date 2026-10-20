/* Sitemap XML writer.
 * Google's limits are 50,000 URLs and 50 MB uncompressed per file.
 * This stays under both. A single urlset is written while the site fits.
 * Past either cap, sitemap.xml becomes a sitemap index and the URLs move
 * into sitemap-1.xml, sitemap-2.xml, and so on.
 */
'use strict';

var URL_LIMIT = 45000;
var BYTE_LIMIT = 45 * 1024 * 1024;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value) {
  return String(value)
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function urlLine(row) {
  return '  <url><loc>' + escapeXml(row.loc) + '</loc><lastmod>' + escapeXml(row.lastmod) + '</lastmod></url>';
}

function urlsetDocument(rows) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    rows.map(urlLine).join('\n') +
    '\n</urlset>\n';
}

function indexDocument(names) {
  var body = names.map(function (name) {
    return '  <sitemap><loc>https://transformerpath.com/' + escapeXml(name) + '</loc></sitemap>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</sitemapindex>\n';
}

function limits(opts) {
  opts = opts || {};
  return {
    urlLimit: opts.urlLimit || URL_LIMIT,
    byteLimit: opts.byteLimit || BYTE_LIMIT
  };
}

function chunkRows(rows, opts) {
  var cap = limits(opts);
  var chunks = [];
  var current = [];
  var bytes = 120;
  rows.forEach(function (row) {
    var line = urlLine(row) + '\n';
    var nextBytes = Buffer.byteLength(line, 'utf8');
    if (current.length && (current.length >= cap.urlLimit || bytes + nextBytes > cap.byteLimit)) {
      chunks.push(current);
      current = [];
      bytes = 120;
    }
    current.push(row);
    bytes += nextBytes;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

function plan(rows, opts) {
  var cap = limits(opts);
  var single = urlsetDocument(rows);
  var over = rows.length > cap.urlLimit || Buffer.byteLength(single, 'utf8') > cap.byteLimit;
  if (!over) return { kind: 'urlset', files: [{ name: 'sitemap.xml', xml: single }] };
  var parts = chunkRows(rows, opts).map(function (chunk, i) {
    return { name: 'sitemap-' + (i + 1) + '.xml', xml: urlsetDocument(chunk) };
  });
  return {
    kind: 'index',
    files: [{ name: 'sitemap.xml', xml: indexDocument(parts.map(function (part) { return part.name; })) }].concat(parts)
  };
}

function wellFormedErrors(xml) {
  var errors = [];
  var text = String(xml || '');
  if (!/^<\?xml\s+version="1\.0"/.test(text)) errors.push('missing xml declaration');
  if (/&(?!(?:amp|lt|gt|quot|apos);|#\d+;|#x[0-9a-fA-F]+;)/.test(text)) errors.push('unescaped ampersand');
  var body = text.replace(/<\?xml[^?]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '');
  var tagRe = /<\/?([A-Za-z0-9:-]+)([^>]*)>/g;
  var stack = [];
  var root = '';
  var match;
  while ((match = tagRe.exec(body))) {
    var name = match[1];
    var closing = match[0].charAt(1) === '/';
    var selfClose = /\/$/.test(match[2]);
    if (closing) {
      var top = stack.pop();
      if (top !== name) errors.push('mismatched </' + name + '>');
    } else if (!selfClose) {
      if (!stack.length) {
        if (root) errors.push('multiple root elements');
        root = name;
      }
      stack.push(name);
    }
  }
  if (stack.length) errors.push('unclosed <' + stack[stack.length - 1] + '>');
  if (root !== 'urlset' && root !== 'sitemapindex') errors.push('root is ' + (root || 'missing'));
  if (/<urlset[\s>]/.test(text) && /<sitemapindex[\s>]/.test(text)) errors.push('urlset and sitemapindex in one file');
  return errors;
}

module.exports = {
  URL_LIMIT: URL_LIMIT,
  BYTE_LIMIT: BYTE_LIMIT,
  escapeXml: escapeXml,
  decodeXml: decodeXml,
  urlsetDocument: urlsetDocument,
  indexDocument: indexDocument,
  plan: plan,
  wellFormedErrors: wellFormedErrors
};
