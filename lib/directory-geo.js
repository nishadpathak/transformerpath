/* Region and country slices of the manufacturer census.
 *
 * A listing is a maker row in data/manufacturers.json. A row whose name
 * starts with "Served by" is a note, not a listing. Counts are that row
 * count. A place with fewer than MIN_LISTINGS listings does not get its
 * own page. Empty city and website fields render as an em dash.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sort = require('./directory-sort');
const { censusNameKey, directoryCompanySlug } = require('./company-aliases');
const claimListing = require('./claim-listing');
const availability = require('./availability');

const MIN_LISTINGS = 5;
const ROOT = path.join(__dirname, '..');
const REGION_ORDER = [
  'North America', 'Latin America', 'Europe', 'Eurasia', 'Middle East',
  'Africa', 'South Asia', 'East Asia', 'Southeast Asia', 'Oceania'
];
const BRAND = ' | TransformerPath';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugifyName(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/* Same aliases as the directory page script. */
function countrySlug(s) {
  const k = String(s || '').toLowerCase().trim();
  const alias = {
    usa: 'usa',
    'united states': 'usa',
    'united states of america': 'usa',
    uae: 'uae',
    'united arab emirates': 'uae',
    'türkiye': 'turkiye',
    turkey: 'turkiye'
  };
  return alias[k] || slugifyName(s);
}

function normName(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function isListing(maker) {
  return !!(maker && maker[0] && !/^Served by/i.test(maker[0]));
}

function dash(value) {
  const s = String(value == null ? '' : value).trim();
  return s || '—';
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function slugIndex() {
  const map = {};
  let rows = [];
  try { rows = readJson('data/company-slugs.json'); } catch (e) { rows = []; }
  rows.forEach(function (row) {
    if (!row || !row.name || !row.slug) return;
    map[normName(row.name)] = row.slug;
  });
  return map;
}

/* Claim hrefs use the same name key as the prerendered /claim-listing/<slug>/ pages. */
function claimSlugIndex() {
  const map = {};
  let rows = [];
  try { rows = readJson('data/company-slugs.json'); } catch (e) { rows = []; }
  rows.forEach(function (row) {
    if (!row || !row.name || !row.slug) return;
    map[censusNameKey(row.name)] = row.slug;
  });
  return map;
}

function profileHref(name, slugs) {
  const slug = slugs[normName(name)];
  if (!slug) return '';
  const file = path.join(ROOT, 'manufacturers', slug, 'index.html');
  if (!fs.existsSync(file)) return '';
  return '/manufacturers/' + slug + '/';
}

function listingCount(country) {
  return (country.makers || []).filter(isListing).length;
}

function fitTitle(place) {
  return place + ' transformer manufacturers' + BRAND;
}

function fitDescription(place, count, scope) {
  const noun = count === 1 ? 'manufacturer' : 'manufacturers';
  let text = place + ' lists ' + count + ' transformer ' + noun + scope + ' in the TransformerPath census.';
  const tails = [
    ' The rows are the published directory listings.',
    ' A blank city or website is a dash.',
    ' No figure on this page is estimated.',
    ' Counts come from the census.',
    ' Published listings only.',
    ' Census rows only.'
  ].slice().sort(function (a, b) { return b.length - a.length; });
  const unused = tails.slice();
  while (text.length < 140 && unused.length) {
    let picked = -1;
    for (let i = 0; i < unused.length; i++) {
      if (text.length + unused[i].length <= 160) { picked = i; break; }
    }
    if (picked < 0) break;
    text += unused[picked];
    unused.splice(picked, 1);
  }
  return text;
}

function loadModel() {
  const data = readJson('data/manufacturers.json');
  const slugs = slugIndex();
  const countries = data.map(function (row) {
    const makers = (row.makers || []).filter(isListing).slice().sort(function (a, b) {
      return sort.naturalCompare(sort.sortName(a[0]), sort.sortName(b[0]));
    });
    return {
      country: row.country,
      region: row.region,
      flag: row.flag || '',
      slug: countrySlug(row.country),
      count: makers.length,
      makers: makers,
      makerNames: makers.map(function (m) { return m[0]; })
    };
  }).filter(function (row) { return row.country && row.count > 0; });
  countries.sort(function (a, b) { return sort.compareCountries(a.country, b.country); });

  const byRegion = {};
  countries.forEach(function (row) {
    if (!byRegion[row.region]) byRegion[row.region] = [];
    byRegion[row.region].push(row);
  });
  const names = Object.keys(byRegion).sort(function (a, b) {
    const ia = REGION_ORDER.indexOf(a);
    const ib = REGION_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return sort.naturalCompare(a, b);
  });
  const regions = names.map(function (name) {
    const list = byRegion[name].slice().sort(function (a, b) { return sort.compareCountries(a.country, b.country); });
    const count = list.reduce(function (sum, row) { return sum + row.count; }, 0);
    return {
      name: name,
      slug: countrySlug(name),
      count: count,
      countries: list
    };
  });

  function guardSlugs(rows, label) {
    const seen = {};
    rows.forEach(function (row) {
      if (!row.slug) throw new Error('directory geo missing ' + label + ' slug');
      if (seen[row.slug]) throw new Error('directory geo ' + label + ' slug collision: ' + row.slug);
      seen[row.slug] = 1;
    });
  }
  guardSlugs(regions, 'region');
  guardSlugs(countries, 'country');

  return { countries: countries, regions: regions, slugs: slugs, claimSlugs: claimSlugIndex() };
}

function publishedCountries(model) {
  return model.countries.filter(function (row) { return row.count >= MIN_LISTINGS; });
}

function publishedRegions(model) {
  return model.regions.filter(function (row) { return row.count >= MIN_LISTINGS; });
}

function copyOk(title, description, place) {
  const exact = place + ' transformer manufacturers' + BRAND;
  if (title !== exact) return 'title is not the place pattern for ' + place;
  if (!description || description.length < 140 || description.length > 160) {
    return 'description length ' + (description || '').length + ' for ' + place;
  }
  if (description.indexOf(place) === -1) return 'description dropped ' + place;
  if (!/\b\d+\b/.test(description)) return 'description has no count for ' + place;
  return '';
}

const TYPE_LABEL = { PT: 'Power', DT: 'Distribution', DRY: 'Dry/Cast' };

function typePills(types) {
  if (!types) return '';
  return String(types).split(',').map(function (token) { return token.trim(); }).filter(Boolean).map(function (token) {
    return '<span class="tpill">' + esc(TYPE_LABEL[token] || token) + '</span>';
  }).join('');
}

function makerRow(maker, slugs, claimSlugs) {
  const name = maker[0];
  const href = profileHref(name, slugs);
  const nameHtml = href
    ? '<a class="name" href="' + esc(href) + '">' + esc(name) + '</a>'
    : '<b class="name">' + esc(name) + '</b>';
  const site = String(maker[2] || '').trim();
  const siteHtml = /^https?:\/\//i.test(site)
    ? '<a class="site" href="' + esc(site) + '" target="_blank" rel="noopener">Site</a>'
    : '<span class="site">' + esc(dash(site)) + '</span>';
  const claimSlug = directoryCompanySlug(name, claimSlugs || slugs);
  const claim = claimListing.linkHtml(claimSlug);
  const flag = availability.forSlug(claimSlug);
  return '<div class="mk-row">' + nameHtml +
    (flag ? availability.markHtml(flag, claimSlug) : '') +
    typePills(maker[3]) +
    '<span class="city">' + esc(dash(maker[1])) + '</span>' + siteHtml + claim + '</div>';
}

function pageShell(doc) {
  const title = doc.title;
  const description = doc.description;
  const canonical = 'https://transformerpath.com' + doc.path;
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(description) + '">' +
    '<link rel="canonical" href="' + esc(canonical) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:url" content="' + esc(canonical) + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">' +
    '<meta name="robots" content="index,follow"><meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">' +
    '<link rel="stylesheet" href="/style.css?v=14"><link rel="stylesheet" href="/tp-nav.css?v=14">' +
    '<style>' + pageCss() + '</style></head><body>\n';
}

function pageCss() {
  return '.geo-wrap{max-width:900px;margin:0 auto;padding:28px 16px 80px}' +
    '.geo-wrap h1{font-size:1.7rem;color:var(--ink);line-height:1.25;overflow-wrap:anywhere}' +
    '.geo-wrap .lead,.geo-wrap .count{color:var(--muted);font-size:1rem;line-height:1.6}' +
    '.geo-wrap a{color:var(--accent)}' +
    '.crumbs{font-size:.8rem;color:var(--muted);margin-bottom:12px;overflow-wrap:anywhere}' +
    '.region-h{font-size:1.05rem;font-weight:800;color:var(--ink);margin:22px 0 8px}' +
    '.mk-row{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--border);min-width:0}' +
    '.mk-row .name{font-weight:700;color:var(--ink);overflow-wrap:anywhere;min-width:0}' +
    '.mk-row .city{color:var(--muted);font-size:.85rem}' +
    '.mk-row .site{margin-left:auto}' +
    '.mk-row .claim-listing-link{white-space:normal;overflow-wrap:anywhere;max-width:100%}' +
    '.tpill{font-size:.62rem;font-weight:800;padding:2px 7px;border-radius:999px;background:var(--bg);border:1px solid var(--border);color:var(--text)}' +
    availability.chipCss() +
    '.avail-mark{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;flex-basis:100%}' +
    '@media (max-width:420px){.geo-wrap{padding:20px 12px 64px}.geo-wrap h1{font-size:1.35rem}.mk-row{flex-direction:column;align-items:flex-start}.mk-row .site{margin-left:0}}';
}

function crumbs(place, kindPath) {
  return '<nav class="crumbs"><a href="/">Home</a> · <a href="/manufacturers.html">Manufacturers</a> · ' +
    '<a href="' + esc(kindPath) + '">' + esc(place) + '</a></nav>';
}

function filterLink(region, country) {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (country) params.set('country', country);
  return '/manufacturers.html?' + params.toString();
}

function countryBlock(row, slugs, linkPage, claimSlugs) {
  const page = row.count >= MIN_LISTINGS
    ? '<a href="/directory/country/' + esc(row.slug) + '/">Country page</a>'
    : '<a href="' + esc(filterLink(row.region, row.country)) + '">Filter in the directory</a>';
  const flag = row.flag ? '<span class="flag">' + esc(row.flag) + '</span> ' : '';
  return '<h2 class="region-h">' + flag + esc(row.country) + ' <span class="count">(' + row.count + ')</span></h2>' +
    (linkPage ? '<p class="count">' + page + '</p>' : '') +
    row.makers.map(function (maker) { return makerRow(maker, slugs, claimSlugs); }).join('');
}

function buildDocuments(model) {
  const docs = [];
  const titles = {};
  const descriptions = {};
  publishedRegions(model).forEach(function (region) {
    const scope = ' across ' + region.countries.length + (region.countries.length === 1 ? ' country' : ' countries');
    const title = fitTitle(region.name);
    const description = fitDescription(region.name, region.count, scope);
    const problem = copyOk(title, description, region.name);
    if (problem) throw new Error(problem);
    if (titles[title] || descriptions[description]) throw new Error('duplicate copy for ' + region.name);
    titles[title] = 1;
    descriptions[description] = 1;
    const below = region.countries.filter(function (row) { return row.count < MIN_LISTINGS; }).length;
    const note = below
      ? '<p class="lead">' + below + (below === 1 ? ' country has' : ' countries have') +
        ' fewer than ' + MIN_LISTINGS + ' listings, so ' + (below === 1 ? 'it stays' : 'they stay') +
        ' on this page and in the directory filter. ' + (below === 1 ? 'It does' : 'They do') +
        ' not get a separate country URL.</p>'
      : '';
    const body = region.countries.map(function (row) { return countryBlock(row, model.slugs, true, model.claimSlugs); }).join('');
    docs.push({
      kind: 'region',
      slug: region.slug,
      path: '/directory/region/' + region.slug + '/',
      file: 'directory/region/' + region.slug + '/index.html',
      title: title,
      description: description,
      count: region.count,
      html: pageShell({ title: title, description: description, path: '/directory/region/' + region.slug + '/' }) +
        '<!--HEAD-->\n<main id="main" class="geo-wrap" data-geo="region" data-count="' + region.count + '">' +
        crumbs(region.name, '/directory/region/' + region.slug + '/') +
        '<h1>' + esc(region.name) + ' transformer manufacturers</h1>' +
        '<p class="count">' + region.count + ' manufacturers across ' + region.countries.length +
        (region.countries.length === 1 ? ' country' : ' countries') + '.</p>' +
        '<p class="lead">Alphabetical listings from the manufacturer census. ' +
        '<a href="' + esc(filterLink(region.name, '')) + '">Open this region in the directory</a> ' +
        'to combine it with search and a product category.</p>' +
        '<p class="avail-filters">' + availability.chipHtml() + '</p>' + availability.emptyHtml() +
        note + body +
        '</main>\n<!--FOOT-->\n<script src="/analytics.js" defer></script>\n' + availability.filterScript() + '\n</body></html>\n'
    });
  });
  publishedCountries(model).forEach(function (row) {
    const title = fitTitle(row.country);
    const description = fitDescription(row.country, row.count, '');
    const problem = copyOk(title, description, row.country);
    if (problem) throw new Error(problem);
    if (titles[title] || descriptions[description]) throw new Error('duplicate copy for ' + row.country);
    titles[title] = 1;
    descriptions[description] = 1;
    const region = model.regions.filter(function (item) { return item.name === row.region; })[0];
    const regionLink = region && region.count >= MIN_LISTINGS
      ? '<a href="/directory/region/' + esc(region.slug) + '/">' + esc(row.region) + '</a>'
      : esc(row.region);
    docs.push({
      kind: 'country',
      slug: row.slug,
      path: '/directory/country/' + row.slug + '/',
      file: 'directory/country/' + row.slug + '/index.html',
      title: title,
      description: description,
      count: row.count,
      html: pageShell({ title: title, description: description, path: '/directory/country/' + row.slug + '/' }) +
        '<!--HEAD-->\n<main id="main" class="geo-wrap" data-geo="country" data-count="' + row.count + '">' +
        '<nav class="crumbs"><a href="/">Home</a> · <a href="/manufacturers.html">Manufacturers</a> · ' +
        regionLink + ' · ' + esc(row.country) + '</nav>' +
        '<h1>' + esc(row.country) + ' transformer manufacturers</h1>' +
        '<p class="count">' + row.count + (row.count === 1 ? ' manufacturer' : ' manufacturers') + '.</p>' +
        '<p class="lead">Alphabetical listings from the manufacturer census. ' +
        '<a href="' + esc(filterLink(row.region, row.country)) + '">Open this country in the directory</a> ' +
        'to combine it with search and a product category.</p>' +
        '<p class="avail-filters">' + availability.chipHtml() + '</p>' + availability.emptyHtml() +
        row.makers.map(function (maker) { return makerRow(maker, model.slugs, model.claimSlugs); }).join('') +
        '</main>\n<!--FOOT-->\n<script src="/analytics.js" defer></script>\n' + availability.filterScript() + '\n</body></html>\n'
    });
  });
  return docs;
}

function hubHtml(model) {
  const regions = publishedRegions(model).map(function (region) {
    return '<a href="directory/region/' + esc(region.slug) + '/">' + esc(region.name) + ' (' + region.count + ')</a>';
  }).join('');
  const countries = publishedCountries(model).map(function (row) {
    return '<a href="directory/country/' + esc(row.slug) + '/">' + esc(row.country) + ' (' + row.count + ')</a>';
  }).join('');
  return '<p><b>Browse by region:</b> ' + regions + '</p>' +
    '<p><b>Countries with ' + MIN_LISTINGS + ' or more listings:</b> ' + countries + '</p>';
}

function maxDay(a, b) {
  if (!a || !ISO.test(a)) return (b && ISO.test(b)) ? b : null;
  if (!b || !ISO.test(b)) return a;
  return a > b ? a : b;
}

function contentDates(makerDates, fallback) {
  const model = loadModel();
  const fallbackDay = ISO.test(String(fallback || '')) ? String(fallback) : null;
  function dayFor(names) {
    let day = null;
    (names || []).forEach(function (name) {
      const found = makerDates && makerDates[normName(name)];
      if (found && ISO.test(found)) day = maxDay(day, found);
    });
    return day || fallbackDay;
  }
  const out = {};
  publishedCountries(model).forEach(function (row) {
    const day = dayFor(row.makerNames);
    if (day) out['directory/country/' + row.slug + '/index.html'] = day;
  });
  publishedRegions(model).forEach(function (region) {
    const names = [];
    region.countries.forEach(function (row) {
      row.makerNames.forEach(function (name) { names.push(name); });
    });
    const day = dayFor(names);
    if (day) out['directory/region/' + region.slug + '/index.html'] = day;
  });
  return out;
}

function applyCachedDates(pages) {
  const model = loadModel();
  function put(rel, day) {
    if (!rel || pages[rel] || !day || !ISO.test(day)) return;
    pages[rel] = day;
  }
  publishedCountries(model).forEach(function (row) {
    put(
      'directory/country/' + row.slug + '/index.html',
      pages['manufacturers/' + row.slug + '.html'] || pages['manufacturers.html']
    );
  });
  publishedRegions(model).forEach(function (region) {
    let day = null;
    region.countries.forEach(function (row) {
      day = maxDay(day, pages['manufacturers/' + row.slug + '.html']);
    });
    put('directory/region/' + region.slug + '/index.html', day || pages['manufacturers.html']);
  });
  return pages;
}

module.exports = {
  MIN_LISTINGS: MIN_LISTINGS,
  esc: esc,
  countrySlug: countrySlug,
  dash: dash,
  fitTitle: fitTitle,
  fitDescription: fitDescription,
  loadModel: loadModel,
  publishedCountries: publishedCountries,
  publishedRegions: publishedRegions,
  buildDocuments: buildDocuments,
  hubHtml: hubHtml,
  makerRow: makerRow,
  contentDates: contentDates,
  applyCachedDates: applyCachedDates,
  profileHref: profileHref
};
