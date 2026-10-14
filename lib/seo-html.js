/* Small HTML helpers for the dist SEO pass. */
'use strict';

const { ORIGIN } = require('./seo-schema');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decode(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); });
}

function stripTags(s) {
  return decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function publicPath(rel) {
  const r = String(rel || '').split('\\').join('/');
  if (r === 'index.html') return '/';
  if (r.endsWith('/index.html')) return '/' + r.slice(0, -'index.html'.length);
  return '/' + r;
}

function publicUrl(rel) {
  return ORIGIN + publicPath(rel);
}

function isNoindex(html) {
  if (/http-equiv=["']refresh["']/i.test(html)) return true;
  const m = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
  if (!m) return false;
  return /noindex/i.test(m[0]);
}

function h1(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  const inner = m[1].replace(/<button\b[\s\S]*?<\/button>/gi, ' ');
  return stripTags(inner);
}

function attr(tag, name) {
  const re = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i');
  const m = String(tag || '').match(re);
  if (!m) return '';
  return decode(m[2] != null ? m[2] : m[3]);
}

function metaContent(html, name) {
  const tagRe = /<meta\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    if (attr(m[0], 'name').toLowerCase() !== String(name).toLowerCase()) continue;
    return attr(m[0], 'content');
  }
  return '';
}

function replaceTitle(html, title) {
  const tag = '<title>' + esc(title) + '</title>';
  if (/<title>[\s\S]*?<\/title>/i.test(html)) return html.replace(/<title>[\s\S]*?<\/title>/i, tag);
  return html.replace(/<\/head>/i, tag + '</head>');
}

function upsertMetaName(html, name, value) {
  const tag = '<meta name="' + name + '" content="' + esc(value) + '">';
  const re = new RegExp('<meta[^>]*name=["\']' + name + '["\'][^>]*>', 'i');
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, tag + '</head>');
}

function upsertMetaProperty(html, prop, value) {
  const tag = '<meta property="' + prop + '" content="' + esc(value) + '">';
  const re = new RegExp('<meta[^>]*property=["\']' + prop + '["\'][^>]*>', 'i');
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, tag + '</head>');
}

function setCanonical(html, url) {
  html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '');
  return html.replace(/<\/head>/i, '<link rel="canonical" href="' + esc(url) + '"></head>');
}

const STRIP_TYPES = {
  Organization: 1,
  WebSite: 1,
  BreadcrumbList: 1,
  Event: 1,
  NewsArticle: 1,
  LocalBusiness: 1
};

function stripReplacedJsonLd(html) {
  return html.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, function (full) {
    const body = full.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    let data;
    try { data = JSON.parse(body); }
    catch (e) { return full; }
    if (data && data['@graph']) {
      data['@graph'] = data['@graph'].filter(function (n) { return !(n && STRIP_TYPES[n['@type']]); });
      if (!data['@graph'].length) return '';
      return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>';
    }
    if (data && STRIP_TYPES[data['@type']]) return '';
    return full;
  });
}

function setGraph(html, obj) {
  html = html.replace(/<!--tp-seo-graph-->[\s\S]*?<!--\/tp-seo-graph-->/g, '');
  const block = '<!--tp-seo-graph--><script type="application/ld+json">' + JSON.stringify(obj) + '</script><!--/tp-seo-graph-->';
  return html.replace(/<\/head>/i, block + '</head>');
}

function setRelated(html, inner) {
  html = html.replace(/<section data-tp-seo="related"[\s\S]*?<\/section>/g, '');
  if (!inner) return html;
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, inner + '</main>');
  return html.replace(/<\/body>/i, inner + '</body>');
}

function ensureCrumbs(html, crumbs) {
  html = html.replace(/<nav data-tp-seo="crumbs"[\s\S]*?<\/nav>/g, '');
  const main = html.match(/<main\b[^>]*>/i);
  if (!main) return html;
  const after = html.slice(main.index, main.index + 1800);
  if (/<nav\b/i.test(after)) return html;
  const nav = '<nav data-tp-seo="crumbs" aria-label="Breadcrumb" style="font-size:.8rem;color:var(--muted);margin:0 0 12px">' +
    crumbs.map(function (c, i) {
      const last = i === crumbs.length - 1;
      const bit = last ? esc(c.name) : '<a href="' + esc(c.item.replace(ORIGIN, '') || '/') + '" style="color:var(--accent)">' + esc(c.name) + '</a>';
      return bit;
    }).join(' › ') + '</nav>';
  return html.replace(main[0], main[0] + nav);
}

module.exports = {
  esc: esc,
  decode: decode,
  stripTags: stripTags,
  publicPath: publicPath,
  publicUrl: publicUrl,
  isNoindex: isNoindex,
  h1: h1,
  metaContent: metaContent,
  replaceTitle: replaceTitle,
  upsertMetaName: upsertMetaName,
  upsertMetaProperty: upsertMetaProperty,
  setCanonical: setCanonical,
  stripReplacedJsonLd: stripReplacedJsonLd,
  setGraph: setGraph,
  setRelated: setRelated,
  ensureCrumbs: ensureCrumbs
};
