// Netlify scheduled function to refresh transformer-industry news.
// Fetches from EventRegistry and caches a briefing so the frontend changelog
// can actually populate.
//
// Reliability (P0 intel pipeline):
//   - The shared intel source retries upstream calls. A missing
//     EVENTREGISTRY_KEY falls through to public RSS instead of skipping.
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
// Scheduled via netlify.toml: [functions."refresh-data"] schedule = "0 * * * *" (hourly).

const fs = require('fs');
const path = require('path');
const os = require('os');

const { buildFeed } = require('./lib/intel-source');

// Staleness knob. Fetch retries live in functions/lib/intel-source.js.
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

// Fetch through the shared source. EventRegistry when a key is set, otherwise
// the public RSS feeds. A missing key must not return an empty success.
async function fetchIntel() {
  const feed = await buildFeed();
  const articles = feed && Array.isArray(feed.articles) ? feed.articles : [];
  const count = articles.reduce(function (s, r) { return s + (r.items ? r.items.length : 0); }, 0);
  if (!count) {
    console.error('refresh-data: no articles from EventRegistry or RSS.');
    return { intel: null, count: 0, briefing: feed && feed.briefing };
  }
  const intel = articles;
  intel.autoBriefing = feed.briefing;
  return { intel: intel, count: count };
}

function itemUrls(rows) {
  const out = [];
  (rows || []).forEach(function (row) {
    (row && row.items || []).forEach(function (it) {
      if (it && it.url) out.push(String(it.url));
    });
  });
  return out;
}

// A run with no articles, or the same URLs as the last good cache, is not
// an update. Callers must not report HTTP 200 for that outcome.
function evaluateRefresh(result, prev) {
  const urls = itemUrls(result && result.intel);
  if (!result || !result.intel || !urls.length) {
    return { success: false, updated: false, reason: 'no_articles', count: 0 };
  }
  const prevUrls = itemUrls(prev && prev.articles);
  if (prevUrls.length) {
    const seen = {};
    prevUrls.forEach(function (u) { seen[u] = true; });
    const added = urls.filter(function (u) { return !seen[u]; });
    if (!added.length) {
      return { success: false, updated: false, reason: 'no_new_items', count: urls.length };
    }
  }
  return { success: true, updated: true, reason: 'new_items', count: urls.length };
}

function isRefreshRun(event) {
  if (!event || !event.httpMethod) return true;
  if (event.httpMethod === 'POST') return true;
  const q = event.queryStringParameters || {};
  if (q.run === '1') return true;
  const headers = event.headers || {};
  const ua = String(headers['user-agent'] || headers['User-Agent'] || '');
  return /scheduled/i.test(ua) && /netlify/i.test(ua);
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

  const verdict = evaluateRefresh(result, prev);
  if (!verdict.success) {
    // Failed-source isolation: keep the last good cache, mark it (possibly) stale.
    // Do not move lastSuccessfulFetch. An empty fetch or a repeat of the
    // cached URLs is not a successful update.
    meta.failureCount = (prev.failureCount || 0) + 1;
    if (prev.briefing) {
      writeCache(Object.assign({}, prev, meta));
    }
    return {
      success: false,
      updated: false,
      stale: meta.stale,
      reason: verdict.reason,
      count: verdict.count,
      lastSuccessfulFetch: meta.lastSuccessfulFetch,
      note: verdict.reason === 'no_new_items'
        ? 'Fetched articles match the last cache. No new item. Last successful fetch was not moved.'
        : 'No articles fetched from EventRegistry or RSS. Last good cache kept when one exists.'
    };
  }

  const briefing = result.intel.autoBriefing;
  const intelData = result.intel.filter(function (row) { return row && row.label; });
  meta.successCount = (prev.successCount || 0) + 1;
  meta.lastSuccessfulFetch = meta.lastAttempt;
  meta.stale = false;
  const cache = Object.assign({ briefing, timestamp: meta.lastSuccessfulFetch, articles: intelData }, meta);
  writeCache(cache);
  return { success: true, updated: true, stale: false, reason: verdict.reason, count: result.count, lastSuccessfulFetch: meta.lastSuccessfulFetch };
}

function articleCount(cache) {
  if (!cache || !cache.articles) return 0;
  return cache.articles.reduce((s, r) => s + (r.items ? r.items.length : 0), 0);
}

exports.evaluateRefresh = evaluateRefresh;
exports.isRefreshRun = isRefreshRun;

exports.handler = async (event) => {
  const isRun = isRefreshRun(event);

  // Manual / scheduled refresh -> background report (admin control panel).
  if (isRun) {
    const res = await refresh();
    const cached = readCached();
    return {
      statusCode: res.success ? 200 : 503,
      body: JSON.stringify(Object.assign({ timestamp: nowIso() }, res, {
        cachedArticleCount: articleCount(cached)
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
  if (!fresh.success) {
    return {
      statusCode: 503,
      headers: { 'Cache-Control': 'no-cache' },
      body: JSON.stringify(Object.assign({ timestamp: nowIso(), updated: false }, fresh))
    };
  }
  const out = readCached();
  return {
    statusCode: 200,
    headers: { 'Cache-Control': 'no-cache' },
    body: JSON.stringify(out),
  };
};
