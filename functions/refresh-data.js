// Netlify scheduled function to refresh transformer-industry news.
// Fetches from EventRegistry and caches a briefing so the frontend changelog
// can actually populate.
//
// Reliability (P0 intel pipeline):
//   - fetchJson() retries up to MAX_ATTEMPTS with backoff, so a transient
//     upstream error does not silently produce an empty feed.
//   - Failed-source isolation: a fetch failure is recorded and does not
//     clobber the last good cache — we serve it (flagged `stale` in the worst
//     case) rather than returning an empty "(Briefing loading...)".
//   - Pipeline metadata is persisted alongside the briefing:
//     lastSuccessfulFetch, lastAttempt, successCount, failureCount, stale.
//
// Handlers:
//   GET  /.netlify/functions/refresh-data            -> return cached briefing
//        (fires a refresh if nothing is cached yet)
//   POST /.netlify/functions/refresh-data            -> refresh + refresh report
//   GET  /.netlify/functions/refresh-data?run=1      -> same as POST (admin "run now")
//
// Scheduled via netlify.toml: [functions."refresh-data"] schedule = "0 6 * * *"

const fs = require('fs');
const path = require('path');
const os = require('os');

const EVENTREGISTRY_KEY = process.env.EVENTREGISTRY_KEY || '';
const EVENTREGISTRY_URL = 'https://eventregistry.org/api/v1/article/getArticles';

// Retry / staleness knobs.
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 1000;        // doubles each retry (1s, 2s, 4s)
const STALE_AFTER_MS = 26 * 3600 * 1000; // >24h of no successful fetch = stale

// Netlify function filesystems are read-only except /tmp — never write into the
// deployment directory. The frontend fetches the briefing from this function
// (GET), which reads/writes this cache.
const BRIEF_FILE = path.join(os.tmpdir(), 'transformerpath-briefing.json');

function nowIso() { return new Date().toISOString(); }
function readCached() {
  try { return JSON.parse(fs.readFileSync(BRIEF_FILE, 'utf8')); } catch (e) { return null; }
}
function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(BRIEF_FILE), { recursive: true });
    fs.writeFileSync(BRIEF_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('Could not write briefing cache:', e.message);
  }
}

// Fetch JSON with retry + backoff; resolves null if all attempts fail.
async function fetchJson(url, opts, attempts) {
  let lastErr = null;
  for (let i = 1; i <= (attempts || MAX_ATTEMPTS); i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return await res.json();
      lastErr = new Error('HTTP ' + res.status);
    } catch (err) {
      lastErr = err;
    }
    if (i < (attempts || MAX_ATTEMPTS)) {
      await new Promise(function (r) { setTimeout(r, BACKOFF_MS * Math.pow(2, i - 1)); });
    }
  }
  console.error('fetchJson failed after retries:', lastErr && lastErr.message);
  return null;
}

// Fetch and normalize intel from EventRegistry (region-grouped).
async function fetchIntel() {
  if (!EVENTREGISTRY_KEY) {
    console.warn('EVENTREGISTRY_KEY not set. Skipping intel fetch.');
    return { intel: null, count: 0 };
  }

  const payload = {
    query: {
      $query: {
        $and: [
          {
            $or: [
              { keyword: 'Electrical Transformers', keywordLoc: 'body' },
              { keyword: 'Power transformers', keywordLoc: 'body' },
              { keyword: 'Distribution transformers', keywordLoc: 'body' },
              { conceptUri: 'http://en.wikipedia.org/wiki/Electrical_grid' },
              { conceptUri: 'http://en.wikipedia.org/wiki/Electricity_market' },
              { conceptUri: 'http://en.wikipedia.org/wiki/Electricity' },
            ],
          },
          { categoryUri: 'dmoz/Business' },
        ],
      },
      $filter: { forceMaxDataTimeWindow: '31' }, // Last 31 days
    },
    resultType: 'articles',
    articlesSortBy: 'date',
    articlesCount: 50,
    apiKey: EVENTREGISTRY_KEY,
  };

  const data = await fetchJson(EVENTREGISTRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!data || !data.articles || data.articles.length === 0) {
    console.warn('No articles found from EventRegistry (or fetch failed).');
    return { intel: null, count: 0 };
  }

  const regions = {
    'Middle East / GCC': [],
    'India / South Asia': [],
    'Europe': [],
    'North America': [],
    'Global': [],
  };

  data.articles.slice(0, 30).forEach((article) => {
    const text = (article.title + ' ' + (article.body || '')).toLowerCase();
    const location = article.location?.label || '';
    let region = 'Global';

    if (location.includes('UAE') || location.includes('Saudi') || location.includes('Gulf') ||
        text.includes('uae') || text.includes('saudi') || text.includes('gulf') || text.includes('middle east')) {
      region = 'Middle East / GCC';
    } else if (location.includes('India') || location.includes('Bangladesh') ||
               text.includes('india') || text.includes('south asia')) {
      region = 'India / South Asia';
    } else if (location.includes('Europe') || text.includes('europe') || text.includes('germany') || text.includes('uk')) {
      region = 'Europe';
    } else if (location.includes('United States') || location.includes('Canada') ||
               text.includes('us') || text.includes('united states') || text.includes('canada')) {
      region = 'North America';
    }

    regions[region].push({
      title: article.title,
      snippet: (article.body || article.summary || '').substring(0, 150),
      value: '',
      src: `${article.source.title} · ${new Date(article.dateTime).toLocaleDateString('en-US', {year: '2-digit', month: 'short', day: 'numeric'})}`,
      url: article.url,
      isNew: true,
    });
  });

  const intel = Object.entries(regions)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items: items.slice(0, 5) }));

  const regionCounts = Object.entries(regions)
    .filter(([, items]) => items.length > 0)
    .map(([region, items]) => `${region} (${items.length})`)
    .join(', ');

  const totalArticles = Object.values(regions).flat().length;
  const timestamp = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

  const autoBriefing = `Daily auto-refresh (${timestamp}): EventRegistry fetched ${totalArticles} transformer industry articles across regions (${regionCounts}). Grouped by region and sorted by date. No manual curation — raw feeds only.`;

  intel.autoBriefing = autoBriefing;
  return { intel, count: totalArticles };
}

async function refresh() {
  const result = await fetchIntel();
  const prev = readCached() || {};
  // Persist pipeline metadata; never wipe success/failure history on a failure.
  const meta = {
    lastAttempt: nowIso(),
    lastSuccessfulFetch: prev.lastSuccessfulFetch || null,
    successCount: prev.successCount || 0,
    failureCount: prev.failureCount || 0,
    stale: prev.lastSuccessfulFetch ? (Date.now() - new Date(prev.lastSuccessfulFetch).getTime() > STALE_AFTER_MS) : true,
  };

  if (!result.intel) {
    // Failed-source isolation: keep the last good cache, mark it (possibly) stale.
    meta.failureCount = (prev.failureCount || 0) + 1;
    if (prev.briefing) {
      writeCache(Object.assign({}, prev, meta));
    }
    return { success: false, stale: meta.stale, lastSuccessfulFetch: meta.lastSuccessfulFetch, note: 'EventRegistry fetch failed; serving last good cache.' };
  }

  const briefing = result.intel.autoBriefing;
  const intelData = Object.assign({}, result.intel);
  delete intelData.autoBriefing;
  meta.successCount = (prev.successCount || 0) + 1;
  meta.lastSuccessfulFetch = meta.lastAttempt;
  meta.stale = false;
  const cache = Object.assign({ briefing, timestamp: meta.lastSuccessfulFetch, articles: intelData }, meta);
  writeCache(cache);
  return { success: true, stale: false, count: result.count, lastSuccessfulFetch: meta.lastSuccessfulFetch };
}

function articleCount(cache) {
  if (!cache || !cache.articles) return 0;
  return cache.articles.reduce((s, r) => s + (r.items ? r.items.length : 0), 0);
}

exports.handler = async (event) => {
  const method = event.httpMethod || 'GET';
  const isRun = method === 'POST' || (event.queryStringParameters && event.queryStringParameters.run === '1');

  // Manual / scheduled refresh -> background report (admin control panel).
  if (isRun) {
    const res = await refresh();
    const cached = readCached();
    return {
      statusCode: 200,
      body: JSON.stringify(Object.assign({ timestamp: nowIso() }, res, {
        updated: res.success ? articleCount(cached) : articleCount(cached),
        cachedArticleCount: articleCount(cached),
        note: 'Set EVENTREGISTRY_KEY in Netlify env vars to enable the fetch.',
      })),
    };
  }

  // GET -> serve the latest briefing to the frontend (changelog). If a fetch has
  // already been attempted and failed, serve the last good cache (flagged stale)
  // rather than returning an empty placeholder.
  let cached = readCached();
  if (cached && cached.briefing) {
    // If no recent successful fetch, opportunistically try a refresh in the
    // background of a stale cache; serve what we have either way.
    const stale = cached.lastSuccessfulFetch ? (Date.now() - new Date(cached.lastSuccessfulFetch).getTime() > STALE_AFTER_MS) : true;
    if (stale) { refresh().catch(function () {}); }
    return { statusCode: 200, headers: { 'Cache-Control': 'no-cache' }, body: JSON.stringify(cached) };
  }

  const fresh = await refresh();
  const out = fresh.success ? readCached() : null;
  return {
    statusCode: 200,
    headers: { 'Cache-Control': 'no-cache' },
    body: JSON.stringify(out || { briefing: '(Briefing loading...) EventRegistry refresh pending.', timestamp: nowIso() }),
  };
};
