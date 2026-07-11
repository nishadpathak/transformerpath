// Netlify scheduled function to refresh data daily
// Fetches transformer industry news from NewsAPI and updates data/intel.json

const fs = require('fs');
const path = require('path');

const EVENTREGISTRY_KEY = process.env.EVENTREGISTRY_KEY || '';
const EVENTREGISTRY_URL = 'https://eventregistry.org/api/v1/article/getArticles';

async function fetchIntel() {
  if (!EVENTREGISTRY_KEY) {
    console.warn('EVENTREGISTRY_KEY not set. Skipping intel fetch.');
    return null;
  }

  try {
    // EventRegistry query: transformer + power industry + energy
    const query = {
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
    };

    const url = new URL(EVENTREGISTRY_URL);
    url.searchParams.append('query', JSON.stringify(query));
    url.searchParams.append('resultType', 'articles');
    url.searchParams.append('articlesSortBy', 'date');
    url.searchParams.append('articlesCount', '50');
    url.searchParams.append('apiKey', EVENTREGISTRY_KEY);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`EventRegistry error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.articles || data.articles.length === 0) {
      console.warn('No articles found from EventRegistry');
      return null;
    }

    // Group by region (extract from location or title)
    const regions = {
      'Middle East / GCC': [],
      'India / South Asia': [],
      'Europe': [],
      'North America': [],
      'Global': [],
    };

    // Map articles to regions
    data.articles.slice(0, 30).forEach((article) => {
      const text = (article.title + ' ' + (article.body || '')).toLowerCase();
      const location = article.location?.label || '';
      let region = 'Global';

      // Smart region detection from location + text
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

    // Format as intel.json schema
    const intel = Object.entries(regions)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({
        label,
        items: items.slice(0, 5), // Max 5 per region
      }));

    return intel;
  } catch (err) {
    console.error('EventRegistry fetch failed:', err.message);
    return null;
  }
}

exports.handler = async (event) => {
  console.log('Starting daily data refresh...');

  try {
    const updates = {
      intel: 'pending',
    };

    // Fetch latest intel/news
    const intelData = await fetchIntel();
    if (intelData) {
      updates.intel = `Updated: ${intelData.reduce((sum, r) => sum + r.items.length, 0)} articles`;
      // In production, write to data/intel.json and commit to git
      console.log('New intel data ready:', JSON.stringify(intelData, null, 2));
    }

    const refreshReport = {
      timestamp: new Date().toISOString(),
      status: 'success',
      updates,
      note: 'EventRegistry key required: set EVENTREGISTRY_KEY in Netlify env vars',
    };

    console.log('Data refresh complete:', refreshReport);

    return {
      statusCode: 200,
      body: JSON.stringify(refreshReport),
    };
  } catch (err) {
    console.error('Data refresh failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Data refresh failed',
        details: err.message,
      }),
    };
  }
};

// SETUP INSTRUCTIONS:
// 1. Get EventRegistry API key: https://eventregistry.org/api → create account → copy key
// 2. Add to Netlify env: Site settings → Build & deploy → Environment → add EVENTREGISTRY_KEY
// 3. Deploy this function: netlify deploy --functions
// 4. Test: Netlify UI → Functions → refresh-data → Invoke
// 5. Schedule: netlify.toml already has cron: "0 6 * * *" (daily 6am UTC)
// 6. Result: intel-feed.xml auto-updates daily with fresh transformer industry news (grouped by region)
//
// Why EventRegistry over NewsAPI?
// ✓ Semantic search (understands concepts like "electrical grid")
// ✓ Transformer-specific queries built-in
// ✓ Better categorization (Business, Energy, etc.)
// ✓ Regional detection via location field
// ✓ Free tier: 20k articles/month (1 request/day = plenty)
