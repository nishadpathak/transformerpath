/* Page facts for titles, descriptions, JSON-LD and internal links.
 *
 * Every string is taken from a data file or from the page's own heading and
 * meta description. Missing facts are omitted.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveStatus } = require('./event-status');
const { ALIASES, slugify: aliasSlugify } = require('./company-aliases');
const html = require('./seo-html');
const schema = require('./seo-schema');
const { cutWord, titleKeepingCountry } = require('./seo-fit');
const parentsLib = require('./company-parents');
const manufacturerSpecs = require('./manufacturer-specs');
const sourcedSpec = require('./sourced-spec-fields');
const headOffice = require('./head-office');
const eventSeo = require('./event-seo');

const TYPE_LABEL = {
  PT: 'power', DT: 'distribution', DRY: 'dry-type', TX: 'transformer',
  SR: 'reactor', IT: 'instrument'
};
const PRODUCT_HUB = {
  PT: '/manufacturers/power-transformers/',
  DT: '/manufacturers/distribution-transformers/',
  DRY: '/manufacturers/dry-type-transformers/'
};
const COUNTRY_MARKET = {
  uae: 'uae', 'united arab emirates': 'uae', 'saudi arabia': 'saudi-arabia',
  india: 'india', china: 'china', usa: 'usa', 'united states': 'usa',
  germany: 'germany', türkiye: 'turkiye', turkey: 'turkiye', brazil: 'brazil',
  vietnam: 'vietnam', 'south korea': 'south-korea', korea: 'south-korea',
  japan: 'japan', italy: 'italy', france: 'france', spain: 'spain',
  netherlands: 'netherlands', poland: 'poland', sweden: 'sweden', chile: 'chile',
  colombia: 'colombia', peru: 'peru', taiwan: 'taiwan', czechia: 'czechia',
  norway: 'norway', venezuela: 'venezuela', finland: 'finland', nigeria: 'nigeria',
  argentina: 'argentina', egypt: 'egypt', bulgaria: 'bulgaria', austria: 'austria',
  romania: 'romania', uzbekistan: 'uzbekistan', canada: 'canada', mexico: 'mexico',
  'south africa': 'south-africa', indonesia: 'indonesia', thailand: 'thailand',
  pakistan: 'pakistan', 'united kingdom': 'united-kingdom'
};
const SECTION = {
  manufacturers: 'Manufacturers', directory: 'Directory', events: 'Events', markets: 'Markets',
  accessories: 'Accessories', knowledge: 'Knowledge', utilities: 'Utilities',
  grids: 'Grids', projects: 'Projects', tenders: 'Tenders', topics: 'Topics',
  applications: 'Applications', components: 'Components', books: 'Books',
  'case-studies': 'Case studies', materials: 'Materials', media: 'Media'
};
const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function readJson(p, fb) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return fb; }
}
function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function normUrl(u) {
  return String(u || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '').split('?')[0].toLowerCase();
}
function sourceDate(text) {
  const s = String(text || '');
  const full = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (full) {
    const mon = MONTHS[full[2].slice(0, 3).toLowerCase()];
    if (mon) return full[3] + '-' + mon + '-' + String(full[1]).padStart(2, '0');
  }
  const iso = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const ym = s.match(/\b([A-Za-z]{3,})\s+(\d{4})\b/);
  if (ym) {
    const mon = MONTHS[ym[1].slice(0, 3).toLowerCase()];
    if (mon) return ym[2] + '-' + mon;
  }
  return '';
}
function wordHas(hay, needle) {
  if (!needle || needle.length < 6) return false;
  const re = new RegExp('(^|[^a-z0-9])' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
  return re.test(hay);
}

function load() {
  const companies = {};
  const byCountry = {};
  const aliasStubs = {};
  Object.keys(ALIASES).forEach(function (k) {
    const src = aliasSlugify(k);
    const dest = ALIASES[k] && ALIASES[k].slug;
    if (src && dest && src !== dest) aliasStubs[src] = dest;
  });
  [
    ['cg-power', 'cg-power-and-industrial-solutions'],
    ['prolec-ge-ge-vernova', 'prolec-ge'],
    ['prolec-ge-brasil', 'prolec-ge'],
    ['prolec-ge-waukesha', 'prolec-ge'],
    ['hico-america-hyosung', 'hyosung-heavy-industries']
  ].forEach(function (p) { aliasStubs[p[0]] = p[1]; });

  const slugs = readJson('data/company-slugs.json', []);
  slugs.forEach(function (r) {
    if (!r || !r.slug || aliasStubs[r.slug]) return;
    companies[r.slug] = {
      name: r.name, slug: r.slug, country: r.country || '', city: '',
      types: [], website: '', indexable: !!r.indexable, kv: null, mva: null, certs: []
    };
  });

  const manuf = readJson('data/manufacturers.json', []);
  manuf.forEach(function (g) {
    (g.makers || []).forEach(function (m) {
      if (!m || /^Served by/i.test(m[0] || '')) return;
      const key = norm(m[0]);
      Object.keys(companies).forEach(function (slug) {
        const c = companies[slug];
        if (norm(c.name) !== key) return;
        if (!c.city && m[1]) c.city = m[1];
        if (!c.website && m[2]) c.website = m[2];
        String(m[3] || '').split(',').forEach(function (t) {
          t = t.trim();
          if (t && c.types.indexOf(t) === -1) c.types.push(t);
        });
        if (!c.country && g.country) c.country = g.country;
      });
    });
  });

  const tiers = readJson('data/manufacturer-tiers.json', []);
  const tierByName = {};
  tiers.forEach(function (t) { if (t && t.name) tierByName[norm(t.name)] = t; });
  Object.keys(companies).forEach(function (slug) {
    const c = companies[slug];
    const t = tierByName[norm(c.name)];
    if (!t) return;
    if (typeof t.kv === 'number') c.kv = t.kv;
    if (typeof t.mva === 'number') c.mva = t.mva;
    if (Array.isArray(t.certs)) c.certs = t.certs.filter(Boolean);
    if (!c.website && t.site) c.website = t.site;
    if (!c.country && t.country) c.country = t.country;
  });
  Object.keys(companies).forEach(function (slug) {
    const c = companies[slug];
    if (!c.indexable) return;
    const k = c.country || '';
    if (!byCountry[k]) byCountry[k] = [];
    byCountry[k].push(c);
  });

  const accessories = {};
  const acc = readJson('data/accessories.json', {});
  (acc.suppliers || []).forEach(function (s) {
    if (!s || !s.name) return;
    const slug = slugify(s.name);
    accessories[slug] = {
      name: s.name,
      slug: slug,
      country: s.country || '',
      city: s.city || '',
      region: s.state || '',
      website: s.website || '',
      email: s.email || '',
      categories: (s.categories || []).slice(0, 4),
      description: s.description || ''
    };
  });

  const events = readJson('data/events.json', []);
  const eventByName = {};
  events.forEach(function (ev) {
    if (ev && ev.n) eventByName[norm(ev.n)] = ev;
  });

  const intelByUrl = {};
  const intelByTitle = {};
  function addIntel(it) {
    if (!it || !it.title) return;
    intelByTitle[norm(it.title)] = it;
    if (it.url) intelByUrl[normUrl(it.url)] = it;
  }
  const intelDoc = readJson('data/intel.json', {});
  if (intelDoc && !Array.isArray(intelDoc)) {
    Object.keys(intelDoc).forEach(function (k) {
      ((intelDoc[k] && intelDoc[k].items) || []).forEach(addIntel);
    });
  }
  const news = readJson('data/intel-news.json', []);
  if (Array.isArray(news)) news.forEach(addIntel);

  const pages = {};
  const SKIP_DIR = { node_modules: 1, dist: 1, transformerpath: 1, functions: 1, vendor: 1, coverage: 1 };
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (e.name.charAt(0) === '.') return;
      if (!prefix && SKIP_DIR[e.name]) return;
      const rel = prefix ? prefix + '/' + e.name : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIR[e.name]) return;
        walk(abs, rel);
      } else if (e.name.endsWith('.html')) pages[rel] = html.publicPath(rel);
    });
  }
  walk('.', '');

  const published = {};
  Object.keys(pages).forEach(function (rel) { published[pages[rel]] = rel; });

  let intelArticles = [];
  if (fs.existsSync('intel.html')) {
    intelArticles = extractArticles(fs.readFileSync('intel.html', 'utf8'), intelByUrl, intelByTitle);
  }

  const langs = {};
  return {
    companies: companies,
    byCountry: byCountry,
    aliasStubs: aliasStubs,
    accessories: accessories,
    events: events,
    eventByName: eventByName,
    intelArticles: intelArticles,
    pages: pages,
    published: published,
    langs: langs
  };
}

function extractArticles(source, byUrl, byTitle) {
  const out = [];
  const seen = {};
  const re = /<article class="intel-post"[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(source))) {
    const id = m[1];
    if (seen[id]) continue;
    seen[id] = 1;
    const body = m[2];
    const headline = html.stripTags((body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i) || [])[1] || '');
    const href = (body.match(/<a[^>]*href="([^"]+)"/i) || [])[1] || '';
    const dateText = html.decode((body.match(/class="intel-date"[^>]*>([^<]+)/i) || [])[1] || '');
    const src = html.stripTags((body.match(/class="src">([\s\S]*?)<\/span>/i) || [])[1] || '');
    const cardDate = sourceDate(dateText);
    const rec = byUrl[normUrl(href)] || byTitle[norm(headline)] || null;
    let datePublished = cardDate;
    if (rec && rec.date_iso && cardDate && rec.date_iso.slice(0, cardDate.length) === cardDate) {
      datePublished = cardDate.length === 10 ? rec.date_iso : cardDate;
    } else if (!datePublished && rec) {
      const structured = sourceDate(rec.date_iso || rec.publication_date || rec.src || '');
      // Use a structured day only when the card did not contradict it.
      if (!dateText) datePublished = structured;
    }
    let publisher = src;
    if (!publisher && rec && rec.src) publisher = String(rec.src).split('·')[0].split('[')[0].trim();
    const author = rec && rec.author ? String(rec.author) : '';
    if (!headline || !datePublished || !publisher) continue;
    out.push({
      id: id,
      headline: headline,
      datePublished: datePublished,
      publisher: publisher,
      author: author,
      sourceUrl: /^https?:\/\//i.test(href) ? href : '',
      text: (headline + ' ' + html.stripTags((body.match(/class="intel-sowhat">([\s\S]*?)<\/p>/i) || [])[1] || '')).slice(0, 400)
    });
  }
  return out;
}

function classify(rel, cat) {
  if (rel === 'index.html') return 'home';
  if (rel === 'intel.html') return 'intel';
  let m = rel.match(/^manufacturers\/([^/]+)\/index\.html$/);
  if (m) {
    if (cat.aliasStubs[m[1]]) return 'redirect';
    if (cat.companies[m[1]]) return 'manufacturer';
    return 'hub';
  }
  if (/^manufacturers\/[^/]+\.html$/.test(rel)) return 'country';
  if (/^events\/[^/]+\/index\.html$/.test(rel)) return 'event';
  if (/^markets\/[^/]+\/index\.html$/.test(rel)) return 'market';
  m = rel.match(/^accessories\/([^/]+)\/index\.html$/);
  if (m) return cat.accessories[m[1]] ? 'accessory' : 'hub';
  if (rel.indexOf('/') === -1) return 'static';
  return 'section';
}

let officeIndex = null;
function offices() {
  if (!officeIndex) officeIndex = headOffice.load();
  return officeIndex;
}

function placeOf(rec) {
  return [rec.city, rec.country].filter(Boolean).join(', ');
}

const CATEGORY_TYPE = {
  'power-transformers': 'PT',
  'distribution-transformers': 'DT',
  'dry-type-transformers': 'DRY'
};

function categoryOf(rel) {
  const m = String(rel || '').match(/^manufacturers\/(power-transformers|distribution-transformers|dry-type-transformers)(?:\/([^/]+))?\/index\.html$/);
  if (!m) return null;
  return { hub: m[1], type: CATEGORY_TYPE[m[1]], countrySlug: m[2] || '' };
}

function specLandingOf(rel) {
  const m = String(rel || '').match(/^manufacturers\/specs\/([^/]+)\/index\.html$/);
  if (!m) return null;
  try {
    return sourcedSpec.landings(sourcedSpec.load()).find(function (page) { return page.slug === m[1]; }) || null;
  } catch (e) { return null; }
}

function sourcedHubOf(rel) {
  const m = String(rel || '').match(/^manufacturers\/sourced\/([^/]+)\/index\.html$/);
  if (!m || m[1] === 'index.html') return null;
  try {
    return manufacturerSpecs.hubs(manufacturerSpecs.load()).find(function (h) { return h.slug === m[1]; }) || null;
  } catch (e) { return null; }
}

function listedCompanies(cat, type, countrySlug) {
  return Object.keys(cat.companies).map(function (slug) { return cat.companies[slug]; }).filter(function (c) {
    if (!c || !c.indexable) return false;
    if (type && (c.types || []).indexOf(type) === -1) return false;
    if (countrySlug && aliasSlugify(c.country) !== countrySlug) return false;
    return true;
  }).sort(function (a, b) { return a.name.localeCompare(b.name); });
}

function listEntries(rows) {
  return rows.map(function (c) {
    return {
      name: c.name,
      url: schema.ORIGIN + '/manufacturers/' + c.slug + '/',
      country: c.country || ''
    };
  });
}
function productPhrase(types) {
  let labels = (types || []).map(function (t) { return TYPE_LABEL[t] || ''; }).filter(Boolean);
  const specific = labels.filter(function (l) { return l !== 'transformer'; });
  if (specific.length) labels = specific;
  const unique = [];
  labels.forEach(function (l) { if (unique.indexOf(l) === -1) unique.push(l); });
  if (!unique.length) return 'transformers';
  if (unique.length === 1) {
    if (unique[0] === 'transformer') return 'transformers';
    if (unique[0] === 'reactor') return 'reactors';
    return unique[0] + ' transformers';
  }
  const head = unique.slice(0, 2).map(function (l) {
    return l === 'reactor' ? 'reactors' : l;
  });
  return head.join(' and ') + ' transformers';
}

function crumbsFor(rel, name) {
  const pub = html.publicPath(rel);
  const crumbs = [{ name: 'Home', item: schema.ORIGIN + '/' }];
  if (pub === '/') return crumbs;
  const parts = pub.split('/').filter(Boolean);
  parts.forEach(function (seg, i) {
    const last = i === parts.length - 1;
    const section = SECTION[seg.replace(/\.html$/, '')];
    const label = last ? (name || seg) : (section || seg.replace(/-/g, ' ').replace(/\.html$/, ''));
    let item;
    if (last) item = html.publicUrl(rel);
    else if (seg.endsWith('.html')) item = schema.ORIGIN + '/' + parts.slice(0, i + 1).join('/');
    else {
      const hub = seg + '.html';
      const dirIndex = parts.slice(0, i + 1).join('/') + '/index.html';
      if (fs.existsSync(hub)) item = schema.ORIGIN + '/' + hub;
      else if (fs.existsSync(dirIndex)) item = schema.ORIGIN + '/' + parts.slice(0, i + 1).join('/') + '/';
      else return;
    }
    crumbs.push({ name: label, item: item });
  });
  return crumbs;
}

function link(href, text, cat) {
  if (!href || !text) return null;
  const pathOnly = href.split('#')[0];
  if (pathOnly !== '/' && !cat.published[pathOnly]) return null;
  return { href: href, text: text };
}

function peers(cat, company) {
  const list = (cat.byCountry[company.country] || []).filter(function (c) {
    return c.slug !== company.slug && c.indexable;
  });
  const overlap = list.filter(function (c) {
    return c.types.some(function (t) { return company.types.indexOf(t) !== -1; });
  });
  return (overlap.length ? overlap : list).slice(0, 4);
}

function eventsInCountry(cat, country) {
  const want = norm(country);
  const out = [];
  Object.keys(cat.pages).forEach(function (rel) {
    const m = rel.match(/^events\/([^/]+)\/index\.html$/);
    if (!m) return;
    const ev = cat._eventPage && cat._eventPage[m[1]];
    if (!ev) return;
    if (norm(ev.co) === want || norm(ev.c) === want) out.push({ href: '/events/' + m[1] + '/', text: ev.n });
  });
  return out.slice(0, 3);
}

/**
 * Attach a page heading to one events.json record.
 * Exact normalised names win. A longer unique containment match is used when
 * the page heading is the record name plus a city, so two different years or
 * two different "GCC POWER" records cannot share a page.
 */
function matchEvent(events, heading) {
  const h = norm(heading);
  if (!h || !events) return null;
  const exact = events.filter(function (ev) { return ev && norm(ev.n) === h; });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  let best = null;
  let bestScore = 0;
  let ambiguous = false;
  events.forEach(function (ev) {
    if (!ev || !ev.n) return;
    const n = norm(ev.n);
    if (n.length < 12 || h.length < 12) return;
    let score = 0;
    if (n.indexOf(h) !== -1) score = h.length;
    else if (h.indexOf(n) !== -1) score = n.length;
    else return;
    if (score > bestScore) {
      best = ev;
      bestScore = score;
      ambiguous = false;
    } else if (score === bestScore && best && norm(best.n) !== n) {
      ambiguous = true;
    }
  });
  if (ambiguous) return null;
  return best;
}

function eventRoleOf(source) {
  return (String(source || '').match(/data-tp-event-role="([^"]+)"/) || [])[1] || '';
}
function eventIdOf(source) {
  return (String(source || '').match(/data-tp-event-id="([^"]+)"/) || [])[1] || '';
}

function rememberEventPages(cat) {
  cat._eventPage = {};
  cat._eventRole = {};
  Object.keys(cat.pages).forEach(function (rel) {
    const m = rel.match(/^events\/([^/]+)\/index\.html$/);
    if (!m || !fs.existsSync(rel)) return;
    const text = fs.readFileSync(rel, 'utf8');
    const role = eventRoleOf(text);
    cat._eventRole[m[1]] = role;
    if (role === 'hub') return;
    const id = eventIdOf(text);
    if (id) {
      const byId = (cat.events || []).filter(function (ev) { return ev && ev.id === id; });
      if (byId.length === 1) {
        cat._eventPage[m[1]] = byId[0];
        return;
      }
    }
    const name = html.h1(text);
    const ev = matchEvent(cat.events, name);
    if (ev) cat._eventPage[m[1]] = ev;
  });
}

function relatedFor(rel, kind, cat, pageHtml) {
  const links = [];
  function push(href, text) {
    const l = link(href, text, cat);
    if (l) links.push(l);
  }
  if (kind === 'manufacturer') {
    const slug = rel.split('/')[1];
    const c = cat.companies[slug];
    if (!c) return links;
    const countrySlug = slugify(c.country);
    push('/manufacturers/' + countrySlug + '.html', c.country + ' manufacturers');
    const market = COUNTRY_MARKET[(c.country || '').toLowerCase()];
    if (market) push('/markets/' + market + '/#plants', (c.country || market) + ' plants');
    if (market) push('/markets/' + market + '/', (c.country || market) + ' market');
    c.types.forEach(function (t) {
      if (!PRODUCT_HUB[t]) return;
      const label = TYPE_LABEL[t] || t;
      const text = label === 'transformer' ? 'Transformer makers' : label + ' transformer makers';
      push(PRODUCT_HUB[t], text);
    });
    peers(cat, c).forEach(function (p) {
      push('/manufacturers/' + p.slug + '/', p.name);
    });
    eventsInCountry(cat, c.country).forEach(function (e) { push(e.href, e.text); });
    cat.intelArticles.forEach(function (it) {
      if (links.length > 14) return;
      if (wordHas(it.text, c.name)) push('/intel.html#' + it.id, it.headline.slice(0, 90));
    });
    push('/intel.html', 'Daily Intel');
  } else if (kind === 'accessory') {
    const slug = rel.split('/')[1];
    const s = cat.accessories[slug];
    if (!s) return links;
    push('/accessories.html', 'Accessories directory');
    const market = COUNTRY_MARKET[(s.country || '').toLowerCase()];
    if (market) push('/markets/' + market + '/', s.country + ' market');
    push('/components.html', 'Components');
    push('/manufacturers.html', 'Manufacturers');
  } else if (kind === 'market') {
    const slug = rel.split('/')[1];
    push('/markets.html', 'All markets');
    push('/manufacturers.html', 'Manufacturers');
    push('/intel.html', 'Daily Intel');
    push('/events.html', 'Events');
    Object.keys(cat.companies).forEach(function (cs) {
      if (links.length > 16) return;
      const c = cat.companies[cs];
      if (!c.indexable) return;
      const mk = COUNTRY_MARKET[(c.country || '').toLowerCase()];
      if (mk === slug) push('/manufacturers/' + c.slug + '/', c.name);
    });
  } else if (kind === 'event') {
    const slug = rel.split('/')[1];
    const ev = cat._eventPage && cat._eventPage[slug];
    push('/events.html', 'Events');
    push('/intel.html', 'Daily Intel');
    if (ev) {
      const market = COUNTRY_MARKET[(ev.co || '').toLowerCase()];
      if (market) {
        push('/markets/' + market + '/', ev.co + ' market');
        push('/markets/' + market + '/#plants', ev.co + ' plants');
      }
      const countrySlug = slugify(ev.co || '');
      if (countrySlug) push('/manufacturers/' + countrySlug + '.html', (ev.co || '') + ' manufacturers');
      (cat.byCountry[ev.co] || []).slice(0, 4).forEach(function (c) {
        push('/manufacturers/' + c.slug + '/', c.name);
      });
    }
  } else if (kind === 'intel') {
    push('/markets.html', 'Markets');
    push('/manufacturers.html', 'Manufacturers');
    push('/events.html', 'Events');
    cat.intelArticles.slice(0, 6).forEach(function (it) {
      push('/intel.html#' + it.id, it.headline.slice(0, 80));
    });
  } else if (kind === 'country') {
    push('/manufacturers.html', 'Manufacturers');
    push('/markets.html', 'Markets');
  } else if (kind === 'home') {
    push('/intel.html', 'Daily Intel');
    push('/manufacturers.html', 'Manufacturers');
    push('/markets.html', 'Markets');
    push('/events.html', 'Events');
    push('/directory.html', 'Directory');
  } else {
    const top = rel.split('/')[0].replace(/\.html$/, '');
    const hub = top + '.html';
    if (cat.pages[hub] && hub !== rel) push('/' + hub, SECTION[top] || top);
    push('/intel.html', 'Daily Intel');
    push('/manufacturers.html', 'Manufacturers');
  }
  const seen = {};
  return links.filter(function (l) {
    if (!l || seen[l.href]) return false;
    seen[l.href] = 1;
    return true;
  }).slice(0, 12);
}

/** Phrase that fitWindow can place in 50–60 with one brand and no " profile".
 *  " | TransformerPath" is 18 characters, so a draft of 32–42 takes one brand
 *  (32+18=50, 42+18=60). A draft of 50–60 stands alone. Lengths 43–49 are
 *  shortened onto a word so the single brand still fits. */
function tidyEdge(s) {
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  const punct = /[\s:;,.|·—–-]+$/;
  const dangler = /\s+(from|and|the|a|an|of|to|for|&)$/i;
  for (let i = 0; i < 6; i++) {
    const next = t.replace(punct, '').replace(dangler, '').trim();
    if (next === t) break;
    t = next;
  }
  return t;
}
function finishLearnTitle(base) {
  let s = tidyEdge(base);
  for (let i = 0; i < 8; i++) {
    if ((s.length >= 32 && s.length <= 42) || (s.length >= 50 && s.length <= 60)) return s;
    if (s.length > 60 || (s.length > 42 && s.length < 50)) {
      const cap = s.length > 60 ? 60 : 42;
      const cut = tidyEdge(cutWord(s, cap));
      s = (cut && cut !== s) ? cut : tidyEdge(cutWord(s, Math.max(1, Math.min(s.length - 1, cap))));
      continue;
    }
    const grown = tidyEdge(s + ' series');
    if (!grown || grown === s) break;
    s = grown;
  }
  return s;
}
function sizedLearnTitle(base) {
  return finishLearnTitle(String(base || '').replace(/\s+/g, ' ').trim());
}

/** Real phrases for Learn pages whose h1 is too short for a 50–60 title.
 *  The draft stays in the 32–42 or 50–60 band so the fitter adds the brand once.
 *  Volume lines are the book subtitle, shortened on a word so the draft
 *  stays in the 32–42 or 50–60 band without a filler suffix. */
function learnSectionTitle(rel, source) {
  const fixed = {
    'learn.html': 'Learn transformer design — courses, books',
    'engineer-track.html': 'Design Engineer Track — four guided levels',
    'academy.html': 'Interactive course tools for designers',
    'pricing.html': 'Engineer plans — Learning, Pro and Team',
    'coretopology.html': 'Core topology — 3-limb, 5-limb and shell',
    'books/volume-3/index.html': 'Volume 3 — Transformer testing methods',
    'books/volume-5/index.html': 'Volume 5 — Failures and forensics',
    'books/volume-7/index.html': 'Volume 7 — Insulation and materials',
    'books/volume-9/index.html': 'Volume 9 — Efficiency and economics',
    'books/volume-11/index.html': 'Volume 11 — Protection and control',
    'books/volume-14/index.html': 'Volume 14 — Loading and overload',
    'books/volume-15/index.html': 'Volume 15 — Maintenance and repair',
    'books/volume-16/index.html': 'Volume 16 — Standards and quality',
    'books/volume-18/index.html': 'Volume 18 — An engineer\'s handbook'
  };
  if (fixed[rel]) return sizedLearnTitle(fixed[rel]);
  const vol = rel.match(/^books\/volume-(\d+)\/index\.html$/);
  if (!vol) return '';
  const sub = html.stripTags((source.match(/<p class="sub"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '');
  return sizedLearnTitle('Volume ' + vol[1] + ' — ' + (sub || 'Transformer engineering'));
}

function draft(rel, source, cat) {
  const kind = classify(rel, cat);
  const noindex = html.isNoindex(source) || /http-equiv=["']refresh["']/i.test(source);
  const name = html.h1(source) || html.stripTags((source.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '') || rel;
  const salt = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '').split('/').pop();
  let title = name;
  let description = html.metaContent(source, 'description') || name;
  let entry = null;
  let event = null;
  let eventProfile = false;
  const nodes = [];

  if (kind === 'home') {
    title = 'TransformerPath — Transformer Industry Intelligence';
    description = html.metaContent(source, 'description') ||
      'TransformerPath publishes transformer market intelligence, a manufacturer census, grid records, events and engineering references.';
  } else if (kind === 'intel') {
    title = 'Daily transformer industry intel | TransformerPath';
    description = 'TransformerPath Daily Intel lists sourced transformer industry items with the source date, publisher and original-language link.';
  } else if (kind === 'manufacturer') {
    const c = cat.companies[rel.split('/')[1]];
    entry = c;
    const prods = productPhrase(c.types);
    const place = placeOf(c);
    const kept = titleKeepingCountry(c.name, c.country);
    title = kept || (c.name + ' | ' + (place || 'transformer') + ' transformers');
    description = c.name + (c.country ? ' in ' + c.country : '') + ' is listed for ' + prods + (c.city ? ', ' + c.city : '') + '.';
    if (c.kv) description += ' Highest sourced voltage on file is ' + c.kv + ' kV.';
    if (c.mva) description += ' Indicative sourced capacity on file is about ' + Number(c.mva).toLocaleString('en-US') + ' MVA a year.';
    if (c.certs && c.certs.length) description += ' Reported standards on file: ' + c.certs.slice(0, 3).join(', ') + '.';
    description += ' Only sourced census fields are shown.';
    const parent = parentsLib.parentFor({ slug: c.slug });
    if (parent && parent.parent_name && parent.source_url) {
      c.parent = {
        name: parent.parent_name,
        url: schema.ORIGIN + '/manufacturers/' + parent.parent_slug + '/'
      };
    }
    const office = headOffice.officeFor({ slug: c.slug, name: c.name }, offices());
    if (office && office.address) c.street = office.address;
    c.asOrganization = true;
  } else if (kind === 'accessory') {
    const s = cat.accessories[rel.split('/')[1]];
    entry = {
      name: s.name, city: s.city, region: s.region, country: s.country,
      website: s.website, email: s.email, description: s.description
    };
    const place = placeOf(s);
    const cats = (s.categories || []).slice(0, 2).join(', ');
    title = s.name + ' | ' + (place || 'accessory') + ' supplier';
    description = s.name + ' is listed as a transformer accessory supplier' +
      (cats ? ' for ' + cats : '') + (place ? ' in ' + place : '') + '.';
    if (s.description) description += ' ' + s.description;
  } else if (kind === 'event') {
    const slug = rel.split('/')[1];
    const role = eventRoleOf(source) || (cat._eventRole && cat._eventRole[slug]) || '';
    const refresh = /http-equiv=["']refresh["']/i.test(source);
    if (refresh) {
      title = 'Redirect ' + salt + ' | TransformerPath';
      description = 'This TransformerPath URL redirects to the canonical page for ' + salt.replace(/-/g, ' ') + '. The canonical profile is the one linked from this stub.';
    } else if (role === 'hub') {
      eventProfile = true;
      const seriesName = name || slug;
      const list = (cat.events || []).filter(function (item) {
        return item && (item.series_slug || item.id) === slug;
      });
      title = eventSeo.eventHubTitle(seriesName);
      description = eventSeo.hubBlurb(seriesName, list);
      event = eventSeo.hubInput(seriesName, description);
    } else {
      eventProfile = true;
      const ev = cat._eventPage && cat._eventPage[slug];
      const label = ev ? (ev.n || ev.name) : name;
      if (ev) {
        const st = resolveStatus(ev);
        event = eventSeo.editionInput(ev);
        title = eventSeo.eventProfileTitle(ev);
        description = (ev.n || ev.name) + ' is a transformer industry event';
        if (ev.c || ev.co) description += ' in ' + [ev.c, ev.co].filter(Boolean).join(', ');
        description += '. Status on file: ' + st.label + '.';
        if (st.key === 'CONFIRMED_UPCOMING' || st.key === 'LIVE' || st.key === 'COMPLETED') {
          if (ev.s || ev.start) {
            const start = ev.s || ev.start;
            const end = ev.e || ev.end;
            description += ' Recorded dates ' + start + (end && end !== start ? ' to ' + end : '') + '.';
          }
        } else {
          description += ' No firm date is published for this record.';
        }
      } else {
        title = eventSeo.eventProfileTitle({ name: label });
        description = label + ' on the TransformerPath events calendar. Dates are shown only when the event record confirms them.';
        event = eventSeo.hubInput(label, description);
      }
    }
  } else if (kind === 'country') {
    const slug = rel.replace(/^manufacturers\//, '').replace(/\.html$/, '');
    const countryName = Object.keys(cat.byCountry).find(function (n) { return aliasSlugify(n) === slug; }) || '';
    const kept = countryName ? titleKeepingCountry('Transformer manufacturers', countryName) : '';
    title = kept || (name + ' | transformer makers');
    description = (countryName || name) + ' lists transformer manufacturers from the TransformerPath census for this country.';
    if (countryName) {
      nodes.push(schema.itemListNode(html.publicUrl(rel), countryName + ' transformer manufacturers', listEntries(listedCompanies(cat, '', slug))));
    }
  } else if (categoryOf(rel)) {
    const spec = categoryOf(rel);
    const countryName = spec.countrySlug
      ? (Object.keys(cat.byCountry).find(function (n) { return aliasSlugify(n) === spec.countrySlug; }) || '')
      : '';
    const label = spec.hub.replace(/-/g, ' ');
    const globalTitle = {
      'power-transformers': 'Power transformers manufacturer directory | TransformerPath',
      'distribution-transformers': 'Distribution transformers directory | TransformerPath',
      'dry-type-transformers': 'Dry-type transformers maker directory | TransformerPath'
    };
    const kept = countryName ? titleKeepingCountry(label, countryName) : '';
    title = kept || globalTitle[spec.hub] || (label + ' | TransformerPath');
    description = (countryName ? countryName + ' ' : '') + label + ' from the TransformerPath manufacturer census.';
    const rows = listedCompanies(cat, spec.type, spec.countrySlug);
    nodes.push(schema.itemListNode(html.publicUrl(rel), (countryName ? countryName + ' ' : '') + label, listEntries(rows)));
  } else if (rel === 'manufacturers/sourced/index.html') {
    title = 'Sourced manufacturer group directory | TransformerPath';
    description = 'Sourced manufacturer groups are published when at least five profiles have a public page for that product or voltage. Profiles without a quoted source are left off.';
  } else if (sourcedHubOf(rel)) {
    const hub = sourcedHubOf(rel);
    title = hub.title;
    description = hub.lead;
    nodes.push(schema.itemListNode(html.publicUrl(rel), hub.h1, listEntries(hub.companies)));
  } else if (rel === 'manufacturers/specs/index.html') {
    const index = sourcedSpec.indexCopy();
    title = index.title;
    description = index.description;
  } else if (specLandingOf(rel)) {
    const page = specLandingOf(rel);
    title = page.title;
    description = page.description;
    nodes.push(schema.itemListNode(html.publicUrl(rel), page.h1, page.companies.map(function (c) {
      return {
        name: c.name,
        url: schema.ORIGIN + '/manufacturers/' + c.slug + '/',
        country: c.country || ''
      };
    })));
  } else if (kind === 'market') {
    title = name + ' | transformer market';
    description = description || (name + ' connects manufacturers, plants, intel and events for this transformer market.');
  } else if (kind === 'redirect') {
    title = 'Redirect ' + salt + ' | TransformerPath';
    description = 'This TransformerPath URL redirects to the canonical page for ' + salt.replace(/-/g, ' ') + '. The canonical profile is the one linked from this stub.';
  } else if (/^directory\/(?:region|country)\/[^/]+\/index\.html$/.test(rel)) {
    const titled = html.stripTags((source.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
    if (titled) title = titled;
    const described = html.metaContent(source, 'description');
    if (described) description = described;
  } else {
    title = name.indexOf('TransformerPath') === -1 ? name + ' | TransformerPath' : name;
    description = description || (name + ' on TransformerPath, the independent transformer industry record.');
  }

  const learnTitle = learnSectionTitle(rel, source);
  if (learnTitle) title = learnTitle;
  if (rel === 'events.html') title = 'Industry Events — global calendar | TransformerPath';
  // The h1 plus the brand is 63 characters. The 50–60 fitter then drops the
  // second word, which is "Standards". This title already fits, so it stays.
  if (rel === 'standards.html') title = 'Transformer Standards & Regulations | TransformerPath';
  // These titles already sit in the 50–60 window with the brand kept whole.
  // The h1 is longer, and the fitter would drop words from it.
  const buyerCopy = require('./buyer-page-copy');
  if (buyerCopy.TITLES[rel]) {
    title = buyerCopy.TITLES[rel];
    description = buyerCopy.DESCRIPTIONS[rel];
  }

  if (entry && entry.name) {
    nodes.push(schema.entryNode(html.publicUrl(rel), {
      name: entry.name,
      city: entry.city,
      region: entry.region,
      country: entry.country,
      website: entry.website,
      email: entry.email,
      street: entry.street || '',
      asOrganization: entry.asOrganization,
      parent: entry.parent || null,
      logo: entry.logo || '',
      description: description
    }));
  }
  if (kind === 'event') {
    nodes.push(schema.eventNode(html.publicUrl(rel), event || {
      name: name, status: 'MONITORING', start: '', end: '', city: '', country: '', venue: '', description: ''
    }));
  }
  if (rel === 'intel.html') {
    cat.intelArticles.forEach(function (it) {
      const node = schema.newsArticleNode(html.publicUrl(rel), it);
      if (node) nodes.push(node);
    });
  }

  const existingCanon = (source.match(/<link[^>]*rel=["']canonical["'][^>]*>/i) || [])[0] || '';
  const canonHref = (existingCanon.match(/href=["']([^"']+)["']/i) || [])[1] || '';

  return {
    rel: rel,
    kind: kind,
    noindex: noindex,
    salt: salt,
    eventProfile: eventProfile,
    draftTitle: title,
    draftDesc: description,
    padsTitle: eventProfile ? [] : [' | TransformerPath'],
    padsDesc: [' Only sourced fields are shown.', ' Independent record on TransformerPath.'],
    crumbs: crumbsFor(rel, name.slice(0, 70) || salt),
    nodes: nodes,
    related: noindex ? [] : relatedFor(rel, kind, cat, source),
    canonical: noindex && canonHref.indexOf(schema.ORIGIN) === 0 ? canonHref : html.publicUrl(rel),
    self: html.publicUrl(rel)
  };
}

function create() {
  const cat = load();
  rememberEventPages(cat);
  return cat;
}

module.exports = {
  create: create,
  draft: draft,
  sourceDate: sourceDate,
  classify: classify,
  matchEvent: matchEvent,
  learnSectionTitle: learnSectionTitle,
  eventRoleOf: eventRoleOf,
  eventIdOf: eventIdOf
};
