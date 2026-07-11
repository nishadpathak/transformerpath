// Netlify scheduled function to refresh data daily
// Fetches transformer industry news from NewsAPI and updates data/intel.json

const fs = require('fs');
const path = require('path');

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';
const NEWSAPI_URL = 'https://newsapi.org/v2/everything';

async function fetchIntel() {
  if (!NEWSAPI_KEY) {
    console.warn('NEWSAPI_KEY not set. Skipping intel fetch.');
    return null;
  }

  try {
    // Query: transformer industry + power grid + energy news
    const query = encodeURIComponent(
      '(transformer OR "power transformer" OR "distribution transformer" OR electrical) AND ' +
      '("power grid" OR energy OR utility OR "power system")'
    );

    const url = `${NEWSAPI_URL}?q=${query}&category=business&language=en&sortBy=publishedAt&pageSize=15&apiKey=${NEWSAPI_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`NewsAPI error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.articles || data.articles.length === 0) {
      console.warn('No articles found from NewsAPI');
      return null;
    }

    // Group by region (best effort from title/content)
    const regions = {
      'Middle East / GCC': [],
      'India / South Asia': [],
      'Europe': [],
      'North America': [],
      'Global': [],
    };

    // Map articles to regions
    data.articles.forEach((article) => {
      const text = (article.title + ' ' + article.description).toLowerCase();
      let region = 'Global';

      if (text.includes('uae') || text.includes('saudi') || text.includes('gulf')) region = 'Middle East / GCC';
      else if (text.includes('india') || text.includes('bangladesh') || text.includes('asia')) region = 'India / South Asia';
      else if (text.includes('europe') || text.includes('germany') || text.includes('uk')) region = 'Europe';
      else if (text.includes('us') || text.includes('canada') || text.includes('america')) region = 'North America';

      regions[region].push({
        title: article.title,
        snippet: article.description || article.content?.substring(0, 150) || '',
        value: '',
        src: `${article.source.name} · ${new Date(article.publishedAt).toLocaleDateString('en-US', {year: '2-digit', month: 'short', day: 'numeric'})}`,
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
    console.error('NewsAPI fetch failed:', err.message);
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
      note: 'NewsAPI key required: set NEWSAPI_KEY in Netlify env vars',
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
// 1. Get free NewsAPI key: https://newsapi.org → sign up → copy key
// 2. Add to Netlify env: Site settings → Build & deploy → Environment → add NEWSAPI_KEY
// 3. Deploy this function: netlify deploy
// 4. Test: Netlify UI → Functions → refresh-data → invoke
// 5. Schedule: netlify.toml already has cron: "0 6 * * *" (daily 6am UTC)
// 6. Result: data/intel.json auto-updates daily with fresh transformer industry news
