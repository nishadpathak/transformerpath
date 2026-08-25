// Netlify scheduled function to refresh transformer-industry news daily.
// Fetches from EventRegistry and caches a briefing so the frontend changelog
// can actually populate.
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

// Netlify function filesystems are read-only except /tmp — never write into the
// deployment directory. The frontend fetches the briefing from this function
// (GET), which reads/writes this cache.
const BRIEF_FILE = path.join(os.tmpdir(), 'transformerpath-briefing.json');

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

// Fetch and normalize intel from EventRegistry (region-grouped).
async function fetchIntel() {
  if (!EVENTREGISTRY_KEY) {
    console.warn('EVENTREGISTRY_KEY not set. Skipping intel fetch.');
    return null;
  }

  try {
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

    const response = await fetch(EVENTREGISTRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`EventRegistry error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.articles || data.articles.length === 0) {
      console.warn('No articles found from EventRegistry');
      return null;
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
      .map(([label, items]) => ({
        label,
        items: items.slice(0, 5),
      }));

    const regionCounts = Object.entries(regions)
      .filter(([, items]) => items.length > 0)
      .map(([region, items]) => `${region} (${items.length})`)
      .join(', ');

    const totalArticles = Object.values(regions).flat().length;
    const timestamp = new Date().toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: '2-digit',
    });

    const autoBriefing = `Daily auto-refresh (${timestamp}): EventRegistry fetched ${totalArticles} transformer industry articles across regions (${regionCounts}). Grouped by region and sorted by date. No manual curation — raw feeds only.`;

    intel.autoBriefing = autoBriefing;
    return intel;
  } catch (err) {
    console.error('EventRegistry fetch failed:', err.message);
    return null;
  }
}

async function refresh() {
  const intelData = await fetchIntel();
  if (!intelData) return null;
  const briefing = intelData.autoBriefing;
  delete intelData.autoBriefing;
  const cache = { briefing, timestamp: new Date().toISOString(), articles: intelData };
  writeCache(cache);
  return cache;
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
    try {
      const cache = await refresh();
      return {
        statusCode: 200,
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          status: 'success',
          updated: articleCount(cache),
          note: 'Set EVENTREGISTRY_KEY in Netlify env vars to enable the fetch.',
        }),
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Refresh failed', details: err.message }) };
    }
  }

  // GET -> serve the latest briefing to the frontend (changelog).
  const cached = readCached();
  if (cached && cached.briefing) {
    return { statusCode: 200, headers: { 'Cache-Control': 'no-cache' }, body: JSON.stringify(cached) };
  }
  const fresh = await refresh();
  return {
    statusCode: 200,
    headers: { 'Cache-Control': 'no-cache' },
    body: JSON.stringify(fresh || { briefing: '(Briefing loading...) EventRegistry refresh pending.', timestamp: new Date().toISOString() }),
  };
};
