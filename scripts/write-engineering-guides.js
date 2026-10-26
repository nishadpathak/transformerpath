#!/usr/bin/env node
/* Writes the practical engineering guides and the guides index.
 * Source copy lives in content/engineering-guides/.
 * Run: node scripts/write-engineering-guides.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'content', 'engineering-guides');
const shell = fs.readFileSync(path.join(ROOT, 'guides', 'us-eu-grid-equipment', 'index.html'), 'utf8');
const headerEnd = shell.indexOf('<section class="hero"');
const footerStart = shell.indexOf('<footer>');
if (headerEnd < 0 || footerStart < 0) throw new Error('guide shell markers missing');

function withGuideLinks(html) {
  let out = html;
  if (out.indexOf('href="/guides/"') < 0) {
    out = out.replace(
      '<a href="/learn.html">Learn</a>',
      '<a href="/learn.html">Learn</a>\n      <a href="/guides/">Guides</a>'
    );
  }
  out = out.replace(
    '<a href="/learn.html">Learning Hub</a>',
    '<a href="/learn.html">Learning Hub</a><a href="/guides/">Practical guides</a>'
  );
  return out;
}

const HEADER = withGuideLinks(shell.slice(0, headerEnd));
const FOOTER = withGuideLinks(shell.slice(footerStart));

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderBody(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let list = null;
  function closeList() {
    if (!list) return;
    html.push(list === 'ol' ? '</ol>' : '</ul>');
    list = null;
  }
  lines.forEach(function (line) {
    const t = line.trim();
    if (!t) {
      closeList();
      return;
    }
    if (t.charAt(0) === '#') return;
    if (/^description:/.test(t)) return;
    const h = t.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      closeList();
      html.push(h[1].length === 2 ? '<h2>' + inline(h[2]) + '</h2>' : '<h3>' + inline(h[3] || h[2]) + '</h3>');
      return;
    }
    const ol = t.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (list !== 'ol') { closeList(); html.push('<ol>'); list = 'ol'; }
      html.push('<li>' + inline(ol[1]) + '</li>');
      return;
    }
    if (t.charAt(0) === '-' && t.charAt(1) === ' ') {
      if (list !== 'ul') { closeList(); html.push('<ul>'); list = 'ul'; }
      html.push('<li>' + inline(t.slice(2)) + '</li>');
      return;
    }
    closeList();
    html.push('<p>' + inline(t) + '</p>');
  });
  closeList();
  return html.join('\n');
}

function meta(md) {
  const title = (md.match(/^#\s+(.+)$/m) || [])[1];
  const description = (md.match(/^description:\s*(.+)$/m) || [])[1];
  if (!title || !description) throw new Error('guide is missing a title or description');
  return { title: title.trim(), description: description.trim() };
}

function page(slug, md, related) {
  const info = meta(md);
  const canonical = 'https://transformerpath.com/guides/' + slug + '/';
  const head = HEADER
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(info.title) + ' | TransformerPath</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(info.description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + canonical + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(info.title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(info.description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + canonical + '">');
  const relatedHtml = related.map(function (item) {
    return '<li><a href="/guides/' + item.slug + '/">' + esc(item.title) + '</a></li>';
  }).join('\n');
  return head +
    '<section class="hero" style="padding:48px 0 28px"><div class="container">' +
    '<p style="margin:0 0 8px"><a href="/guides/" style="color:var(--accent);font-weight:700">Practical guides</a></p>' +
    '<h1 style="font-size:2.05rem">' + esc(info.title) + '</h1>' +
    '<p>' + esc(info.description) + '</p></div></section>\n' +
    '<main id="main" class="guide-wrap">\n' +
    '<p class="guide-note"><strong>Engineering practice, not a certification.</strong> This page states established practice and names the public standards to obtain. It does not certify a product, a factory, or a supplier, and it is not a test report. Use the edition named in the contract. Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p>\n' +
    renderBody(md) + '\n' +
    '<h2>Other guides</h2>\n<ul>\n' + relatedHtml + '\n</ul>\n' +
    '</main>\n' + FOOTER;
}

function indexPage(guides) {
  const cards = guides.map(function (g) {
    return '<a class="card" href="/guides/' + g.slug + '/" style="display:block;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin:0 0 12px;text-decoration:none"><h2 style="margin:0 0 6px;font-size:1.15rem;color:var(--ink)">' + esc(g.title) + '</h2><p style="margin:0;color:var(--muted)">' + esc(g.description) + '</p></a>';
  }).join('\n');
  const info = {
    title: 'Practical transformer guides',
    description: 'Original guides on buying, testing, and operating power transformers. Established engineering practice, with IEC and IEEE standards named by designation.'
  };
  const head = HEADER
    .replace(/<title>[^<]*<\/title>/, '<title>' + info.title + ' | TransformerPath</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(info.description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="https://transformerpath.com/guides/">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + info.title + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(info.description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="https://transformerpath.com/guides/">');
  return head +
    '<section class="hero" style="padding:48px 0 28px"><div class="container"><h1 style="font-size:2.05rem">Practical guides</h1><p>' + esc(info.description) + '</p></div></section>\n' +
    '<main id="main" class="guide-wrap">\n' +
    '<p class="guide-note"><strong>Not a product certification.</strong> These pages explain established practice for buyers, test engineers, and operators. They do not rank suppliers and they do not replace the standard named in the contract.</p>\n' +
    cards + '\n' +
    '<p>The existing note on <a href="/guides/us-eu-grid-equipment/">US and EU grid equipment rules</a> is a separate buyer summary. It is not part of this engineering set.</p>\n' +
    '</main>\n' + FOOTER;
}

const files = fs.readdirSync(SRC).filter(function (name) { return name.endsWith('.md'); }).sort();
const guides = files.map(function (name) {
  const md = fs.readFileSync(path.join(SRC, name), 'utf8');
  const slug = name.replace(/^\d+-/, '').replace(/\.md$/, '');
  const info = meta(md);
  return { slug: slug, title: info.title, description: info.description, md: md };
});

guides.forEach(function (guide) {
  const related = guides.filter(function (other) { return other.slug !== guide.slug; }).slice(0, 4);
  const dir = path.join(ROOT, 'guides', guide.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(guide.slug, guide.md, related));
});
fs.writeFileSync(path.join(ROOT, 'guides', 'index.html'), indexPage(guides));
console.log('wrote ' + guides.length + ' guides and guides/index.html');
