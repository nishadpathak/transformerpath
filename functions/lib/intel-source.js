/* Shared transformer-industry news source for the intel pages.
   ---------------------------------------------------------------------------
   Extracted so the scheduled refresh and the HTTP feed endpoint cannot drift
   apart. Nothing here touches the filesystem or the request/response cycle —
   it just returns region-grouped articles plus a one-line briefing.

   Netlify blocks HTTP invocation of a SCHEDULED function (403), which is why
   the browser-facing endpoint has to be a separate, unscheduled function.
   See functions/intel-feed.js.

   Two sources, so it works out of the box:
     1. EventRegistry (used when EVENTREGISTRY_KEY is set) — richer.
     2. Public transformer / power-industry RSS feeds (keyless fallback) — so
        the page auto-updates even before an API key is configured. */

const EVENTREGISTRY_KEY = process.env.EVENTREGISTRY_KEY || '';
const EVENTREGISTRY_URL = 'https://eventregistry.org/api/v1/article/getArticles';

/* Keyless public RSS feeds that reliably carry transformer / power news. */
const RSS_FEEDS = [
  'https://www.tdworld.com/rss.xml',
  'https://www.power-eng.com/rss.xml',
  'https://www.transformers-magazine.com/feed',
  'https://www.powermag.com/feed/',
];

const REGION_LABELS = ['Middle East / GCC', 'India / South Asia', 'Europe', 'North America', 'Global'];

function regionOf(t) {
  if (/(uae|saudi|gulf|middle east|oman|kuwait|qatar|bahrain|emirat)/.test(t)) return 'Middle East / GCC';
  if (/(india|south asia|bangladesh|pakistan|sri lanka)/.test(t)) return 'India / South Asia';
  if (/(europe|germany|uk\b|britain|france|italy|spain|netherlands|poland|sweden|norway|denmark|austria)/.test(t)) return 'Europe';
  if (/(united states|usa|canada|north america|\bus\b)/.test(t)) return 'North America';
  return 'Global';
}

function strip(x) {
  return String(x || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function emptyRegions() {
  const o = {}; REGION_LABELS.forEach((r) => (o[r] = [])); return o;
}

// ── Source 1: EventRegistry (needs an API key) ─────────────────────────────
async function fetchEventRegistry() {
  if (!EVENTREGISTRY_KEY) return null;
  try {
    const payload = {
      query: {
        $query: {
          $and: [
            { $or: [
              { keyword: 'Electrical Transformers', keywordLoc: 'body' },
              { keyword: 'Power transformers', keywordLoc: 'body' },
              { keyword: 'Distribution transformers', keywordLoc: 'body' },
              { conceptUri: 'http://en.wikipedia.org/wiki/Electrical_grid' },
              { conceptUri: 'http://en.wikipedia.org/wiki/Electricity_market' },
              { conceptUri: 'http://en.wikipedia.org/wiki/Electricity' },
            ] },
            { categoryUri: 'dmoz/Business' },
          ],
        },
        $filter: { forceMaxDataTimeWindow: '31' },
      },
      resultType: 'articles',
      articlesSortBy: 'date',
      articlesCount: 50,
      apiKey: EVENTREGISTRY_KEY,
    };

    const response = await fetch(EVENTREGISTRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) { console.error(`EventRegistry error: ${response.status}`); return null; }
    const data = await response.json();
    if (!data.articles || !data.articles.length) { console.warn('No articles from EventRegistry'); return null; }

    const regions = emptyRegions();
    data.articles.slice(0, 30).forEach((article) => {
      const text = (article.title + ' ' + (article.body || '')).toLowerCase();
      const loc = (article.location && article.location.label) || '';
      regions[regionOf(text + ' ' + loc)].push({
        title: article.title,
        snippet: (article.body || article.summary || '').substring(0, 150),
        value: '',
        src: `${article.source.title} · ${new Date(article.dateTime).toLocaleDateString('en-US', {year: '2-digit', month: 'short', day: 'numeric'})}`,
        url: article.url,
        isNew: true,
      });
    });

    return finalize(regions, 'EventRegistry', true);
  } catch (err) { console.error('EventRegistry fetch failed:', err.message); return null; }
}

// ── Source 2: public RSS feeds (keyless) ───────────────────────────────────
async function fetchRSS() {
  const regions = emptyRegions();
  let ok = false;
  for (const url of RSS_FEEDS) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 TransformerPath' } });
      if (!r.ok) { console.warn('RSS http', r.status, url); continue; }
      const xml = await r.text();
      const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
      for (const it of items) {
        const title = strip((it.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]);
        const link = ((it.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
        const desc = strip((it.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1]);
        const pubD = (it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1];
        if (!title) continue;
        const region = regionOf((title + ' ' + desc).toLowerCase());
        const d = pubD ? new Date(pubD) : new Date();
        regions[region].push({
          title,
          snippet: desc.substring(0, 150),
          value: '',
          src: 'RSS · ' + d.toLocaleDateString('en-US', {year: '2-digit', month: 'short', day: 'numeric'}),
          url: link,
          isNew: true,
        });
        if (link) ok = true;
      }
    } catch (e) { console.warn('RSS fetch failed:', url, e.message); }
  }
  return ok ? finalize(regions, 'RSS', false) : null;
}

// Trim, dedupe (by URL), cap per region, and add the one-line briefing.
function finalize(regions, sourceName, configured) {
  const seen = new Set();
  const grouped = REGION_LABELS
    .map((label) => ({
      label,
      items: (regions[label] || []).filter((it) => (it.url ? !seen.has(it.url) && seen.add(it.url) : true)).slice(0, 5),
    }))
    .filter((r) => r.items.length > 0);

  const total = grouped.reduce((s, r) => s + r.items.length, 0);
  const regionCounts = grouped.map((r) => `${r.label} (${r.items.length})`).join(', ');
  const stamp = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const autoBriefing = `Live refresh (${stamp}): ${sourceName} returned ${total} transformer-industry articles (${regionCounts}). Grouped by region; each item links to its original source.`;

  grouped.autoBriefing = autoBriefing;
  grouped.configured = configured;
  return grouped;
}

async function buildFeed() {
  let intel = await fetchEventRegistry();
  if (!intel) intel = await fetchRSS();

  if (intel) {
    const briefing = intel.autoBriefing;
    delete intel.autoBriefing;
    const configured = Boolean(intel.configured) || Boolean(EVENTREGISTRY_KEY);
    delete intel.configured;
    return { briefing, articles: intel, configured, timestamp: new Date().toISOString() };
  }
  return {
    briefing: 'Automatic intel refresh returned no items this run — the source was temporarily unavailable.',
    articles: [],
    configured: Boolean(EVENTREGISTRY_KEY),
    timestamp: new Date().toISOString(),
  };
}

module.exports = { fetchIntel: fetchEventRegistry, buildFeed, isConfigured: () => Boolean(EVENTREGISTRY_KEY) };
