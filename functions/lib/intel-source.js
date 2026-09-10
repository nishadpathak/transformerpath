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

/* Keyless public RSS feeds that reliably carry transformer / power news.
   Each entry carries the feed's language (used for the UI badge) and, where
   the source is a single home market, a default region — so a Spanish or a
   German feed lands in the right panel even though our text classifier is
   English-based. Non-English feeds widen coverage beyond the Anglophone
   trade press without needing an API key. */
const RSS_FEEDS = [
  { url: 'https://www.tdworld.com/rss.xml',                  lang: 'en', region: null },
  { url: 'https://www.power-eng.com/rss.xml',                lang: 'en', region: null },
  { url: 'https://www.transformers-magazine.com/feed',       lang: 'en', region: null },
  { url: 'https://www.powermag.com/feed/',                   lang: 'en', region: null },
  // Multi-language market coverage (energy / grid news, transformer-adjacent)
  { url: 'https://www.pv-magazine-mexico.com/feed/',         lang: 'es', region: 'Latin America' },
  { url: 'https://www.revistaei.cl/feed/',                   lang: 'es', region: 'Latin America' },
  { url: 'https://www.pv-magazine.de/feed/',                 lang: 'de', region: 'Europe' },
];

const REGION_LABELS = ['Middle East / GCC', 'India / South Asia', 'Europe', 'North America', 'Latin America', 'Global'];

function regionOf(t, def) {
  /* Word-boundary matching throughout. Plain substring tests put "Indiana
     Michigan Power" in India / South Asia, "industry" in North America (it
     contains "us") and "Ukraine" in Europe via "uk". Every term below is
     anchored so a country name only matches when it stands on its own. */
  const has = (re) => re.test(t);

  /* Check the most specific place names first: a headline naming a US state
     must not be captured by a broader rule later. */
  if (has(/\b(indiana|indianapolis)\b/)) return 'North America';

  if (has(/\b(uae|u\.a\.e|saudi|gulf|middle east|oman|kuwait|qatar|bahrain|emirates?|dubai|abu dhabi)\b/))
    return 'Middle East / GCC';

  if (has(/\b(india|south asia|bangladesh|pakistan|sri lanka|nepal)\b/))
    return 'India / South Asia';

  if (has(/\b(latin america|latinoam\w*|brasil|brazil|m[eé]xico|mexico|chile|argentina|per[uú]|colombia|ecuador|venezuela|rep[uú]blica dominicana)\b/))
    return 'Latin America';

  if (has(/\b(europe|european|germany|deutschland|uk|u\.k|britain|british|france|italy|spain|españa|netherlands|poland|sweden|norway|denmark|austria|ukraine)\b/))
    return 'Europe';

  if (has(/\b(united states|u\.s\.?a?|usa|canada|canadian|north america|american)\b/))
    return 'North America';

  return def || 'Global';
}

/* ── Editorial filters ─────────────────────────────────────────────────────
   Two things must never reach the feed:

   1. ADVERTISING. Trade publications syndicate sponsored posts through the
      same RSS as their journalism. Republishing another site's advertorial as
      TransformerPath news misleads the reader and borrows someone else's sales
      copy. "Increase Pole Life by 20 Years: Choosing the Right Barrier System"
      was live on the feed — a vendor pitch, not a news item.

   2. DUPLICATES. The same story arrives from several feeds; it was appearing
      twice in the same region block. */

const AD_PATTERNS = [
  /\bsponsored\b/i, /\badvertorial\b/i, /\bpaid (?:post|content|partnership)\b/i,
  /\bpromoted\b/i, /\bpress release\b/i, /\bwebinar\b.*\bregister\b/i,
  /\bwhite ?paper\b/i, /\bdownload (?:our|the|your|now|free)\b/i,
  /\bcontact us today\b/i, /\brequest a (?:quote|demo)\b/i,
  /\bbuy(?:er'?s)? guide\b/i, /\bfree trial\b/i, /\bsubscribe now\b/i,
  /\bin partnership with\b/i, /\bbrought to you by\b/i,
  /^\s*\[?(?:ad|advert|sponsored)\b/i,
  /\bchoosing the right\b/i, /\bwhy you should\b/i, /\btop \d+ (?:reasons|ways|benefits)\b/i,
  /\bincrease .{0,30}\bby \d+ (?:years|%|percent)\b/i
];

function looksLikeAd(title, desc, url) {
  const hay = (title + ' ' + (desc || '')).trim();
  /* Feeds emit stubs — a bare vendor name, a placeholder row. "Zaigo" reached
     the live homepage as a headline. A real story needs more than one word. */
  const t = String(title || '').trim();
  if (t.length < 18 || t.split(/\s+/).length < 3) return true;
  if (AD_PATTERNS.some((re) => re.test(hay))) return true;
  /* Feed URLs frequently label their own sponsored sections. */
  if (/\/(sponsored|advertorial|partner-content|promoted|press-release)\//i.test(url || '')) return true;
  return false;
}

/* Normalised key for dedupe: same story, different feed or tracking suffix. */
function dedupeKey(title, url) {
  const t = String(title || '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    const u = new URL(url);
    return t || (u.hostname + u.pathname);
  } catch (e) { return t; }
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
    const seen = new Set();
    let dropped = { ads: 0, dupes: 0 };
    data.articles.slice(0, 30).forEach((article) => {
      const body = article.body || '';

      /* Someone else's advertising is not our news. */
      if (looksLikeAd(article.title, body, article.url)) { dropped.ads++; return; }

      /* Aggregators syndicate the same story under several sources. */
      const key = dedupeKey(article.title, article.url);
      if (seen.has(key)) { dropped.dupes++; return; }
      seen.add(key);

      const text = (article.title + ' ' + body).toLowerCase();
      const loc = (article.location && article.location.label) || '';
      regions[regionOf(text + ' ' + loc)].push({
        title: article.title,
        snippet: (body || article.summary || '').substring(0, 150),
        value: '',
        lang: article.lang || 'en',
        src: `${article.source.title} · ${new Date(article.dateTime).toLocaleDateString('en-US', {year: '2-digit', month: 'short', day: 'numeric'})}`,
        url: article.url,
        isNew: true,
      });
    });

    if (dropped.ads || dropped.dupes) {
      console.info('[intel] filtered ' + dropped.ads + ' advert(s), ' + dropped.dupes + ' duplicate(s)');
    }
    return finalize(regions, 'EventRegistry', true);
  } catch (err) { console.error('EventRegistry fetch failed:', err.message); return null; }
}

// ── Source 2: public RSS feeds (keyless) ───────────────────────────────────
async function fetchRSS() {
  const regions = emptyRegions();
  let ok = false;
  const seen = new Set();      /* dedupe across every feed, not just within one */
  let dropped = { ads: 0, dupes: 0 };
  for (const feed of RSS_FEEDS) {
    try {
      const r = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0 TransformerPath' } });
      if (!r.ok) { console.warn('RSS http', r.status, feed.url); continue; }
      const xml = await r.text();
      const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
      for (const it of items) {
        const title = strip((it.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]);
        const link = ((it.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
        const desc = strip((it.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1]);
        const pubD = (it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1];
        if (!title) continue;

        /* Someone else's advertising is not our news. */
        if (looksLikeAd(title, desc, link)) { dropped.ads++; continue; }

        /* The same story reaches us from several feeds. */
        const key = dedupeKey(title, link);
        if (seen.has(key)) { dropped.dupes++; continue; }
        seen.add(key);

        // Curated home-market feeds (non-English) are authoritative about which
        // region they cover; only the English feeds rely on text detection.
        const region = feed.region || regionOf((title + ' ' + desc).toLowerCase());
        const d = pubD ? new Date(pubD) : new Date();
        regions[region].push({
          title,
          snippet: desc.substring(0, 150),
          value: '',
          lang: feed.lang || 'en',
          src: 'RSS · ' + d.toLocaleDateString('en-US', {year: '2-digit', month: 'short', day: 'numeric'}),
          url: link,
          isNew: true,
        });
        if (link) ok = true;
      }
    } catch (e) { console.warn('RSS fetch failed:', feed.url, e.message); }
  }
  if (dropped.ads || dropped.dupes) {
    console.info('[intel] filtered ' + dropped.ads + ' advert(s), ' + dropped.dupes + ' duplicate(s)');
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
  const autoBriefing = `Live refresh (${stamp}): ${sourceName} returned ${total} articles from transformer and grid industry sources (${regionCounts}). Grouped by region; each item links to its original source.`;

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
