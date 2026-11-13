/* Browser-facing intel feed.
   ---------------------------------------------------------------------------
   The homepage and /manufacturers.html call this from tp-freshness.js.
   It used to fetch external RSS on the request, which took 10–30s and
   sometimes returned 504. The payload is rendered at build time from
   data/intel.json (build-intel-feed-snapshot.js). This handler only reads
   that file. The scheduled refresh-data function still fetches upstream.
   A missing snapshot is a short 200 with an empty list, not a 504. */

const fs = require('fs');
const path = require('path');

const CACHE = 'public, max-age=60, s-maxage=300';

function snapshotPath() {
  const name = 'intel-feed-snapshot.json';
  const candidates = [
    path.join(__dirname, '..', 'data', name),
    path.join(process.cwd(), 'data', name),
    path.join(__dirname, 'data', name),
    path.join('/var/task', 'data', name)
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      if (fs.existsSync(candidates[i])) return candidates[i];
    } catch (e) { /* try the next location */ }
  }
  return candidates[0];
}

function emptyFeed() {
  return {
    briefing: 'Live intel is temporarily unavailable.',
    articles: [],
    configured: false,
    error: true,
    timestamp: ''
  };
}

exports.handler = async (event) => {
  const method = (event && event.httpMethod) || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'GET' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  try {
    const feed = JSON.parse(fs.readFileSync(snapshotPath(), 'utf8'));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': CACHE },
      body: JSON.stringify(feed)
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify(emptyFeed())
    };
  }
};
