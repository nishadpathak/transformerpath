#!/usr/bin/env node
/* Per-page sitemap dates.
 *
 * lastmod is the git commit date of the source record or template that drives
 * the page, or an item updated/checked date when that date actually varies
 * across the collection. A single stamp shared by every row is a file-level
 * build mark and is ignored. The build clock is never used.
 *
 * Full history is required to blame a line. A shallow clone (Netlify's
 * default) loads data/sitemap-content-dates.json, which this module rewrites
 * whenever history is available.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'sitemap-content-dates.json');
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (e) { return null; }
}
function git(args, timeout) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: timeout || 120000
  });
}
function maxDate(a, b) {
  if (!a || !ISO.test(a)) return (b && ISO.test(b)) ? b : null;
  if (!b || !ISO.test(b)) return a;
  return a > b ? a : b;
}
function put(map, key, date) {
  if (!key || !date || !ISO.test(date)) return;
  map[key] = maxDate(map[key], date);
}

function fullHistory() {
  try {
    if (git(['rev-parse', '--is-shallow-repository'], 15000).trim() === 'true') return false;
    const n = parseInt(git(['rev-list', '--count', 'HEAD'], 15000).trim(), 10);
    return n > 1;
  } catch (e) {
    return false;
  }
}

function tryUnshallow() {
  try {
    if (git(['rev-parse', '--is-shallow-repository'], 15000).trim() !== 'true') return;
    git(['fetch', '--unshallow'], 90000);
  } catch (e) {
    console.warn('sitemap dates: full history unavailable (' + (e.message || e).split('\n')[0] + ')');
  }
}

function blame(rel) {
  const out = git(['blame', '-w', '--date=short', '--', rel]);
  const rows = [];
  out.split('\n').forEach(function (line) {
    const m = line.match(/(\d{4}-\d{2}-\d{2})\s+\d+\)\s?(.*)$/);
    if (m) rows.push({ date: m[1], text: m[2] });
  });
  return rows;
}

function fileCommitDates() {
  const map = {};
  let date = null;
  git(['log', '--format=COMMIT:%cI', '--name-only']).split('\n').forEach(function (line) {
    if (line.indexOf('COMMIT:') === 0) {
      date = line.slice('COMMIT:'.length, 'COMMIT:'.length + 10);
      return;
    }
    if (!line || !date || map[line]) return;
    if (ISO.test(date)) map[line] = date;
  });
  return map;
}

/* A date field is per-item only when the collection does not share one value. */
function varyingBy(items, keyFn, dateFn) {
  const buckets = {};
  const values = {};
  (items || []).forEach(function (item) {
    const key = keyFn(item);
    const date = dateFn(item);
    if (!key || !date || !ISO.test(String(date).slice(0, 10))) return;
    const day = String(date).slice(0, 10);
    buckets[key] = maxDate(buckets[key], day);
    values[day] = 1;
  });
  if (Object.keys(values).length < 2) return {};
  return buckets;
}

function spanDates(rows, markerRe) {
  const spans = [];
  let cur = null;
  rows.forEach(function (row) {
    const m = row.text.match(markerRe);
    if (m) {
      if (cur) spans.push(cur);
      cur = { key: m[1], date: row.date };
      return;
    }
    if (cur) cur.date = maxDate(cur.date, row.date);
  });
  if (cur) spans.push(cur);
  const map = {};
  spans.forEach(function (s) { map[s.key] = maxDate(map[s.key], s.date); });
  return map;
}

function objectDates(rows, nameRe) {
  const map = {};
  let name = null;
  let date = null;
  function flush() {
    if (name) map[norm(name)] = maxDate(map[norm(name)], date);
    name = null;
    date = null;
  }
  rows.forEach(function (row) {
    const m = row.text.match(nameRe);
    if (m) {
      flush();
      name = m[1];
      date = row.date;
      return;
    }
    if (name) {
      date = maxDate(date, row.date);
      if (/^\s*\},?\s*$/.test(row.text)) flush();
    }
  });
  flush();
  return map;
}

function makerDates(rows) {
  const map = {};
  for (let i = 0; i < rows.length; i++) {
    if (!/\[\s*$/.test(rows[i].text)) continue;
    const nameLine = rows[i + 1];
    if (!nameLine) continue;
    const m = nameLine.text.match(/^\s*"([^"]+)"\s*,?\s*$/);
    if (!m) continue;
    let date = nameLine.date;
    for (let j = i + 1; j < rows.length && j < i + 8; j++) {
      date = maxDate(date, rows[j].date);
      if (/\]\s*,?\s*$/.test(rows[j].text)) break;
    }
    const key = norm(m[1]);
    map[key] = maxDate(map[key], date);
  }
  return map;
}

function loadCache() {
  const doc = readJson('data/sitemap-content-dates.json');
  return (doc && doc.pages) || {};
}

function compute() {
  const pages = {};
  const files = fileCommitDates();
  const makers = makerDates(blame('data/manufacturers.json'));
  const tiers = objectDates(blame('data/manufacturer-tiers.json'), /"name"\s*:\s*"([^"]+)"/);
  const prov = objectDates(blame('data/manufacturer-provenance.json'), /"name"\s*:\s*"([^"]+)"/);
  const devs = objectDates(blame('data/company-developments.json'), /"name"\s*:\s*"([^"]+)"/);
  const slugs = readJson('data/company-slugs.json') || [];
  const byCountry = {};
  slugs.forEach(function (c) {
    const key = norm(c.name);
    const date = maxDate(maxDate(makers[key], tiers[key]), maxDate(prov[key], devs[key]));
    put(pages, 'manufacturers/' + c.slug + '/index.html', date);
    const countrySlug = slugify(c.country);
    if (countrySlug) byCountry[countrySlug] = maxDate(byCountry[countrySlug], date);
  });
  Object.keys(byCountry).forEach(function (slug) {
    put(pages, 'manufacturers/' + slug + '.html', byCountry[slug]);
  });

  const projects = readJson('data/projects.json');
  const projectChecked = varyingBy(projects && projects.projects, function (p) { return slugify(p.project); }, function (p) { return p.last_verified; });
  const projectBlame = spanDates(blame('data/projects.json'), /"project"\s*:\s*"([^"]+)"/);
  Object.keys(projectBlame).forEach(function (title) {
    const slug = slugify(title);
    put(pages, 'projects/' + slug + '/index.html', maxDate(projectBlame[title], projectChecked[slug]));
  });

  const tenders = readJson('data/tenders.json');
  const tenderChecked = varyingBy(tenders && tenders.tenders, function (t) {
    return slugify(t.title).slice(0, 32).replace(/-+$/, '');
  }, function (t) { return t.last_verified; });
  const tenderBlame = spanDates(blame('data/tenders.json'), /"title"\s*:\s*"([^"]+)"/);
  Object.keys(tenderBlame).forEach(function (title) {
    const slug = slugify(title).slice(0, 32).replace(/-+$/, '');
    put(pages, 'tenders/' + slug + '/index.html', maxDate(tenderBlame[title], tenderChecked[slug]));
  });

  const accessories = readJson('data/accessories.json');
  const accChecked = varyingBy(accessories && accessories.suppliers, function (s) { return slugify(s.name); }, function (s) {
    return s.updated || s.last_verified || s.checked || s.sourced_at;
  });
  const accBlame = objectDates(blame('data/accessories.json'), /"name"\s*:\s*"([^"]+)"/);
  Object.keys(accBlame).forEach(function (name) {
    const slug = slugify(name);
    put(pages, 'accessories/' + slug + '/index.html', maxDate(accBlame[name], accChecked[slug]));
  });

  const grids = readJson('data/grids.json') || [];
  const gridBlame = spanDates(blame('data/grids.json'), /"country"\s*:\s*"([^"]+)"/);
  grids.forEach(function (g) {
    put(pages, 'grids/' + slugify(g.country) + '/index.html', gridBlame[g.country]);
    (g.grids || []).forEach(function (op) {
      if (!op || !op[0]) return;
      put(pages, 'utilities/' + slugify(op[0]) + '/index.html', gridBlame[g.country]);
    });
  });

  const knowledge = spanDates(blame('build-knowledge.js'), /slug:\s*'([^']+)'/);
  Object.keys(knowledge).forEach(function (slug) {
    put(pages, 'knowledge/' + slug + '.html', knowledge[slug]);
  });

  const events = spanDates(blame('build-events.js'), /slug:\s*'([^']+)'/);
  Object.keys(events).forEach(function (slug) {
    put(pages, 'events/' + slug + '/index.html', events[slug]);
  });
  const exhibitions = readJson('data/exhibitions.json');
  const exChecked = varyingBy(exhibitions && exhibitions.entries, function (e) { return slugify(e.event_name); }, function (e) { return e.verification_date; });
  const exBlame = spanDates(blame('data/exhibitions.json'), /"event_name"\s*:\s*"([^"]+)"/);
  Object.keys(exBlame).forEach(function (name) {
    const slug = slugify(name);
    put(pages, 'events/' + slug + '/index.html', maxDate(exBlame[name], exChecked[slug]));
  });

  const markets = spanDates(blame('build-markets.js'), /slug:\s*'([^']+)'/);
  Object.keys(markets).forEach(function (slug) {
    put(pages, 'markets/' + slug + '/index.html', markets[slug]);
  });

  const utilities = spanDates(blame('build-utilities.js'), /slug:\s*'([^']+)'/);
  Object.keys(utilities).forEach(function (slug) {
    put(pages, 'utilities/' + slug + '/index.html', utilities[slug]);
  });

  const apps = spanDates(blame('build-applications.js'), /slug:\s*'([^']+)'/);
  Object.keys(apps).forEach(function (slug) {
    put(pages, 'applications/' + slug + '.html', apps[slug]);
  });

  const cases = readJson('data/case-studies.json');
  const caseItems = Array.isArray(cases) ? cases : (cases && (cases.studies || cases.items || cases.cases)) || [];
  const caseBlame = spanDates(blame('data/case-studies.json'), /"slug"\s*:\s*"([^"]+)"/);
  Object.keys(caseBlame).forEach(function (slug) {
    put(pages, 'case-studies/' + slug + '/index.html', caseBlame[slug]);
  });
  caseItems.forEach(function (c) {
    if (!c || !c.slug) return;
    const day = c.updated || c.last_verified || c.date;
    if (day && ISO.test(String(day).slice(0, 10))) put(pages, 'case-studies/' + c.slug + '/index.html', String(day).slice(0, 10));
  });

  const topics = readJson('data/topic-hubs.json');
  const topicItems = Array.isArray(topics) ? topics : (topics && topics.topics) || [];
  topicItems.forEach(function (t) {
    const key = t && (t.key || t.slug);
    if (!key) return;
    put(pages, 'topics/' + key + '/index.html', files['data/topic-hubs.json'] || files['build-topic-hubs.js']);
  });

  /* Components category pages are driven by the META table in build-seo.js. */
  const comp = spanDates(blame('build-seo.js'), /slug:\s*'([^']+)'/);
  Object.keys(comp).forEach(function (slug) {
    put(pages, 'components/' + slug + '.html', comp[slug]);
  });

  return { pages: pages, files: files };
}

function dateFor(rel, computed, cache) {
  const item = computed && computed.pages[rel];
  if (item) return item;
  const file = computed && computed.files[rel];
  if (file) return file;
  if (cache && cache[rel]) return cache[rel];
  return null;
}

function load() {
  tryUnshallow();
  const cache = loadCache();
  if (!fullHistory()) {
    console.log('sitemap dates: using committed content dates (' + Object.keys(cache).length + ' pages)');
    return { pages: cache, files: {}, fromCache: true };
  }
  const computed = compute();
  const merged = Object.assign({}, cache, computed.pages);
  let sha = '';
  try { sha = git(['rev-parse', 'HEAD'], 15000).trim(); } catch (e) { sha = ''; }
  const doc = {
    source_commit: sha,
    note: 'Per-page content dates from git blame of the driving source, or an item updated/checked date when that date varies by item. Not the build clock.',
    pages: merged
  };
  fs.writeFileSync(CACHE, JSON.stringify(doc, null, 2) + '\n');
  return { pages: merged, files: computed.files, fromCache: false };
}

module.exports = { load: load, dateFor: dateFor, ISO: ISO };
