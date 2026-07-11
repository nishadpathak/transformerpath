# Data Automation Guide

Keep manufacturers, events, intel, and grids data fresh automatically.

## Current Architecture

- **Source**: Hardcoded JSON in `data/` folder
- **API**: Express server reads from `data/` (Phase 2)
- **Frontend**: Fetches from API (Phase 3)
- **Automation**: Netlify scheduled function (Phase 4)

## Data Update Flow

```
External Data Source
        ↓
  Netlify Function (daily)
        ↓
  Transform & Validate
        ↓
  Write to data/JSON
        ↓
  Commit to Git (optional)
        ↓
  API serves fresh data
        ↓
  Frontend fetches live
```

## Data Sources to Wire Up

### 1. Manufacturers (`data/manufacturers.json`)

**Current**: 86 countries, 519 makers (static)

**Auto-update options**:

**Option A: Industry Database API**
- **Source**: LinkedIn Sales Navigator, Apollo.io, Hunter.io
- **Frequency**: Weekly (slow-changing data)
- **Cost**: Paid APIs ($50-500/mo)
- **Setup**: OAuth + scheduled fetch

**Option B: Spreadsheet**
- **Source**: Google Sheets or Airtable
- **Frequency**: Weekly (you update, automation syncs)
- **Cost**: Free
- **Setup**: 
  ```javascript
  // functions/refresh-data.js
  const sheet = await fetch('https://sheets.googleapis.com/v4/spreadsheets/SHEET_ID/values/Manufacturers?key=API_KEY');
  const rows = sheet.values;
  // Transform to manufacturers.json schema
  ```

**Option C: No auto-update**
- **Frequency**: Manual (quarterly review)
- **Cost**: Free
- **Approach**: Update JSON manually, commit to git

### 2. Events (`data/events.json`)

**Current**: 144 events spanning 2026-2028 (static)

**Auto-update options**:

**Option A: Event Aggregator API**
- **Source**: Eventbrite API, LinkedIn Events API, Conference.io
- **Frequency**: Daily (events constantly added)
- **Cost**: Free tier available
- **Setup**:
  ```javascript
  const events = await fetch('https://www.eventbriteapi.com/v3/users/me/events?token=TOKEN');
  // Filter by transformer industry keywords
  // Transform to schema: {n, s, e, c, co, r, v, u, d}
  ```

**Option B: RSS Feed Aggregation**
- **Source**: Industry event calendars (RSS feeds)
- **Frequency**: Daily
- **Cost**: Free
- **Setup**: Parse RSS, extract dates/locations

**Option C: Affiliate Partners**
- **Source**: ManageWP, Eventbrite partner feeds
- **Frequency**: Real-time
- **Cost**: Revenue share (if applicable)

### 3. Intel (`data/intel.json`)

**Current**: 91 market intelligence items in 5 regions (static)

**Auto-update options**:

**Option A: News API**
- **Source**: NewsAPI.org, Bing News API, Guardian API
- **Frequency**: Daily
- **Cost**: Free tier available ($0-50/mo)
- **Setup**:
  ```javascript
  const news = await fetch(
    'https://newsapi.org/v2/everything?' +
    'q=transformer+power+energy&' +
    'sortBy=publishedAt&' +
    'apiKey=YOUR_API_KEY'
  );
  // Filter by region, extract title/snippet/url
  ```

**Option B: Industry Publications API**
- **Source**: S&P Global, IHS Markit, Bloomberg
- **Frequency**: Daily
- **Cost**: Paid APIs ($100-1000/mo)

**Option C: Manual Daily Briefing**
- **Frequency**: Daily (you curate)
- **Cost**: 30 min/day for market intel curation
- **Approach**: Email you daily intel, you paste to JSON

### 4. Grids (`data/grids.json`)

**Current**: 151 grid entries (static)

**Auto-update options**:

**Option A: Utility Operator APIs**
- **Source**: NERC (North America), TSO (Europe), local utilities
- **Frequency**: Monthly/Quarterly (slow-changing)
- **Cost**: Varies (often free public data)
- **Setup**: Depends on operator API

**Option B: World Bank Open Data**
- **Source**: https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS
- **Frequency**: Annual
- **Cost**: Free

**Option C: Manual Quarterly Update**
- **Frequency**: Quarterly review
- **Cost**: Free (one person, 2 hours)

## Implementation Steps

### Step 1: Choose Data Sources

For each dataset (manufacturers, events, intel, grids):
- Decide: Auto-update or manual?
- Pick source: API, spreadsheet, or RSS?
- Plan frequency: Daily, weekly, monthly?

### Step 2: Update Refresh Function

Edit `functions/refresh-data.js`:

```javascript
async function refreshManufacturers() {
  // Replace placeholder with actual fetch
  const source = await fetch('YOUR_API_ENDPOINT');
  const raw = await source.json();
  
  // Transform to schema
  const manufacturers = raw.map(item => ({
    country: item.country_name,
    region: item.region,
    flag: item.emoji,
    makers: item.companies.map(co => [
      co.name,
      co.city,
      co.website,
      co.types.join(',')
    ])
  }));
  
  return manufacturers;
}

async function refreshEvents() {
  // Wire event source here
}

async function refreshIntel() {
  // Wire news API here
}

async function refreshGrids() {
  // Wire grid data here
}
```

### Step 3: Validate & Write

```javascript
async function validateAndWrite(data, filename) {
  // Validate schema
  if (!data || !Array.isArray(data)) throw new Error('Invalid schema');
  
  // Write to data/ folder
  const path = `/tmp/data/${filename}`;
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  
  // Optionally commit to git
  await exec(`git add data/${filename}`);
  await exec(`git commit -m "Auto-update ${filename}"`);
  
  return { file: filename, records: data.length, updated: new Date() };
}
```

### Step 4: Deploy Scheduled Function

```bash
# Deploy to Netlify
netlify deploy --prod

# Configure schedule in Netlify UI:
# Functions → refresh-data → Settings
# Cron: "0 6 * * *" (daily at 6am UTC)
```

### Step 5: Monitor

Add Slack notification (optional):

```javascript
async function notifySlack(status) {
  await fetch(process.env.SLACK_WEBHOOK, {
    method: 'POST',
    body: JSON.stringify({
      text: `Data refresh: ${status.manufacturers} manufacturers, ${status.events} events`
    })
  });
}
```

## Schema Reference

### Manufacturers
```json
[
  {
    "country": "USA",
    "region": "North America",
    "flag": "🇺🇸",
    "makers": [
      ["Company Name", "City, State", "https://website.com", "PT,DT,DRY"]
    ]
  }
]
```

### Events
```json
[
  {
    "n": "Event Name",
    "s": "2026-01-20",
    "e": "2026-01-22",
    "c": "City",
    "co": "Country",
    "r": "Region",
    "v": "Venue Name",
    "u": "https://event-url.com",
    "d": "Event description"
  }
]
```

### Intel
```json
[
  {
    "label": "USA",
    "items": [
      {
        "title": "Deal headline",
        "snippet": "Context about the deal",
        "value": "$1.5B",
        "src": "Source Name · 2026-07-10 · English",
        "url": "https://source.com/article",
        "isNew": true
      }
    ]
  }
]
```

### Grids
```json
[
  {
    "country": "USA",
    "region": "North America",
    "grids": [
      {
        "name": "NERC Grid Name",
        "voltage": ["138kV", "230kV", "500kV"],
        "capacity": "850 GW",
        "transmission_miles": "180,000"
      }
    ]
  }
]
```

## Cost Comparison

| Source | Frequency | Cost | Effort | Coverage |
|--------|-----------|------|--------|----------|
| Manual spreadsheet | Weekly | Free | 2 hrs/week | 100% |
| News API | Daily | $0-50/mo | 1 hr setup | Good |
| LinkedIn API | Daily | $50-500/mo | 4 hrs setup | Excellent |
| World Bank | Annual | Free | 2 hrs/year | Fair |
| No auto-update | Manual | Free | 1 hr/quarter | Low |

## Recommended Setup (Balanced)

- **Manufacturers**: Manual quarterly update (spreadsheet)
- **Events**: NewsAPI daily automation (free tier)
- **Intel**: Manual daily curation (30 min/day)
- **Grids**: Manual annual update (World Bank)

**Total cost**: $0-20/mo (free News API tier)  
**Setup time**: 4-6 hours  
**Maintenance**: ~1 hour/week  

---

## Deployment Checklist

- [ ] Choose data sources for each dataset
- [ ] Update `functions/refresh-data.js` with APIs
- [ ] Test transformation locally
- [ ] Deploy to Netlify
- [ ] Configure cron schedule
- [ ] Verify data updates in API
- [ ] Monitor first week
- [ ] (Optional) Add Slack notifications

Once complete, data stays fresh automatically. 🚀
