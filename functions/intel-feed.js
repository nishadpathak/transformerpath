/* Browser-facing intel feed.
   ---------------------------------------------------------------------------
   WHY THIS EXISTS, SEPARATELY FROM refresh-data.js
   ---------------------------------------------------------------------------
   The intel pages used to fetch /.netlify/functions/refresh-data directly.
   That can never work: refresh-data is declared as a SCHEDULED function in
   netlify.toml, and Netlify refuses HTTP invocation of scheduled functions —
   it answers 403. Every one of those pages guarded the call with `if (res.ok)`,
   so nothing appeared broken; the auto-news feed and the changelog simply never
   rendered, silently, on 15 pages.

   A function can be scheduled OR HTTP-callable, not both, so the fix is a
   second unscheduled endpoint. This is it.

   The old design also cached into os.tmpdir(). On Netlify that directory is
   per-container and ephemeral, so a scheduled run's cache is not visible to a
   later HTTP invocation — the cache would nearly always miss even if HTTP were
   allowed. Instead of a filesystem cache we let the CDN do it: the response
   carries s-maxage, so Netlify's edge serves repeat hits without re-running
   the function. That keeps the upstream EventRegistry call count low enough
   for its free tier regardless of traffic.

   Fails soft on purpose: if the key is missing or the source errors, this
   returns 200 with an empty article list and an explanatory briefing, so the
   page renders its normal state rather than showing an error to a visitor. */

const { buildFeed, isConfigured } = require('./lib/intel-source');

/* Browser revalidates every 30 min; the CDN holds it for 6 h and may serve a
   stale copy for a day while it refreshes behind the scenes. */
const CACHE = 'public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400';

exports.handler = async (event) => {
  const method = (event && event.httpMethod) || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'GET' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const feed = await buildFeed();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': CACHE },
      body: JSON.stringify(feed),
    };
  } catch (err) {
    console.error('intel-feed failed:', err && err.message);
    /* Still a 200: a visitor should see the page's normal empty state, not a
       failed request in the console. Do not cache a failure for six hours. */
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({
        briefing: 'Live intel is temporarily unavailable.',
        articles: [],
        configured: isConfigured(),
        error: true,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
