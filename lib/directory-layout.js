/* Search-first wrappers for the existing directory pages. The raw HTML holds
 * generated listing snapshots; reorder the static wrappers at build time. */
'use strict';
function directoryLayout(html) {
  if (html.includes('class="dir-jump-links"')) return html;
  const start = html.indexOf('  <section class="tp-featured-slot" data-featured-slot="directory"');
  const results = html.indexOf('  <div id="directoryRoot">', start);
  const stop = html.indexOf('</main>', results);
  if (start < 0 || results < 0 || stop < 0) return html;
  const prior = html.slice(start, results);
  const sponsorEnd = prior.indexOf('</section>') + '</section>'.length;
  if (sponsorEnd < '</section>'.length) return html;
  const sponsor = prior.slice(0, sponsorEnd);
  const toolsAndRoles = prior.slice(sponsorEnd).replace(
    '<div style="background:linear-gradient(135deg,rgba(245,166,35,.12),rgba(13,27,46,.4));',
    '<div id="sourcing-tools" style="background:linear-gradient(135deg,rgba(245,166,35,.12),rgba(13,27,46,.4));');
  const shortcuts = [
    '  <nav class="dir-jump-links" aria-label="Directory shortcuts">',
    '    <a href="#dirQ">Search suppliers</a>',
    '    <a href="#dirLanding">Browse by role</a>',
    '    <a href="#sourcing-tools">Matching and comparison</a>',
    '    <a href="/manufacturers.html">Manufacturer census</a>',
    '  </nav>',
    '  <h2 class="dir-search-heading">Find suppliers and service providers</h2>',
    ''
  ].join('\n');
  return (html.slice(0, start) + shortcuts + html.slice(results, stop) + toolsAndRoles + sponsor + '\n' + html.slice(stop))
    .replace('.dir-controls{', [
      '.dir-jump-links{display:flex;flex-wrap:wrap;gap:6px 16px;margin:0 0 14px}',
      '.dir-jump-links a{display:inline-flex;align-items:center;min-height:38px;font-weight:700}',
      '.dir-search-heading{font-size:1.1rem;margin:0 0 5px}',
      '#dirQ,#dirLanding,#sourcing-tools{scroll-margin-top:90px}',
      '.dir-controls{'
    ].join('\n'))
    .replace('.dir-controls input[type=search]{flex:1;min-width:220px}',
      '.dir-controls input[type=search]{flex:1 1 100%;min-width:0;width:100%}\n' +
      '@media(max-width:560px){.dir-controls input[type=search],.dir-controls select,.dir-controls button{min-height:44px;max-width:100%}.dir-controls select{flex:1 1 130px;min-width:0}}')
    .replace('Sourced transformer-industry verticals — manufacturers, components, labs, services, logistics and buyers. Counts come from the live census, not invented totals.',
      'Search manufacturers, component suppliers, testing labs, repair firms and logistics providers. Filter by country, capability and evidence before building a shortlist.');
}

function manufacturerLayout(html) {
  if (html.includes('href="#search"')) return html;
  const re = /(<p id="census-method"[^>]*>[\s\S]*?<\/p>\s*<p id="sitemap-companies"[^>]*>[\s\S]*?<\/p>)/;
  return html.replace(re, [
    '<p style="margin:12px 0 0"><a href="#search" style="color:var(--accent);font-weight:700">Search manufacturers ↓</a></p>',
    '    <details style="margin-top:10px"><summary>How the manufacturer census is verified</summary>',
    '    $1',
    '    </details>'
  ].join('\n')).replace('<input type="search" id="search" placeholder=',
    '<input type="search" id="search" aria-label="Search manufacturers by name, country or city" style="scroll-margin-top:90px" placeholder=');
}

module.exports = { directoryLayout, manufacturerLayout };
