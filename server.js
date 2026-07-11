const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load data files
const loadData = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `${file}.json`), 'utf8'));
  } catch (err) {
    console.error(`Error loading ${file}.json:`, err.message);
    return [];
  }
};

const manufacturers = loadData('manufacturers');
const intel = loadData('intel');
const events = loadData('events');
const grids = loadData('grids');
const interconnectors = loadData('interconnectors');
const pricing = loadData('pricing');

// ──── Manufacturers API ────
app.get('/api/manufacturers', (req, res) => {
  const { region, country, search } = req.query;

  let result = manufacturers;

  if (region) {
    result = result.filter(m => m.region.toLowerCase() === region.toLowerCase());
  }

  if (country) {
    result = result.filter(m => m.country.toLowerCase() === country.toLowerCase());
  }

  if (search) {
    const term = search.toLowerCase();
    result = result.map(item => ({
      ...item,
      makers: item.makers.filter(maker =>
        maker[0].toLowerCase().includes(term) ||
        maker[1].toLowerCase().includes(term)
      )
    })).filter(item => item.makers.length > 0);
  }

  res.json({ success: true, data: result, count: result.length });
});

app.get('/api/manufacturers/:country', (req, res) => {
  const country = req.params.country.toLowerCase();
  const data = manufacturers.find(m => m.country.toLowerCase() === country);

  if (!data) {
    return res.status(404).json({ success: false, error: 'Country not found' });
  }

  res.json({ success: true, data });
});

// ──── Intel API ────
app.get('/api/intel', (req, res) => {
  const { region, isNew } = req.query;

  let result = intel;

  if (region) {
    result = result.filter(i => i.label.toLowerCase().includes(region.toLowerCase()));
  }

  if (isNew === 'true') {
    result = result.map(item => ({
      ...item,
      items: item.items.filter(i => i.isNew)
    })).filter(item => item.items.length > 0);
  }

  res.json({ success: true, data: result, count: result.length });
});

app.get('/api/intel/:region', (req, res) => {
  const region = req.params.region.toLowerCase();
  const data = intel.find(i => i.label.toLowerCase() === region);

  if (!data) {
    return res.status(404).json({ success: false, error: 'Region not found' });
  }

  res.json({ success: true, data });
});

// ──── Events API ────
app.get('/api/events', (req, res) => {
  const { region, country, startDate, endDate, search } = req.query;

  let result = events;

  if (region) {
    result = result.filter(e => e.r.toLowerCase() === region.toLowerCase());
  }

  if (country) {
    result = result.filter(e => e.co.toLowerCase() === country.toLowerCase());
  }

  if (startDate) {
    result = result.filter(e => e.s >= startDate);
  }

  if (endDate) {
    result = result.filter(e => e.e <= endDate);
  }

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(e =>
      e.n.toLowerCase().includes(term) ||
      e.d.toLowerCase().includes(term)
    );
  }

  res.json({ success: true, data: result, count: result.length });
});

app.get('/api/events/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = events[id];

  if (!data) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }

  res.json({ success: true, data });
});

// ──── Grids API ────
app.get('/api/grids', (req, res) => {
  const { region, country, search } = req.query;

  let result = grids;

  if (region) {
    result = result.filter(g => g.region.toLowerCase() === region.toLowerCase());
  }

  if (country) {
    result = result.filter(g => g.country.toLowerCase() === country.toLowerCase());
  }

  if (search) {
    const term = search.toLowerCase();
    result = result.filter(g =>
      g.country.toLowerCase().includes(term)
    );
  }

  res.json({ success: true, data: result, count: result.length });
});

app.get('/api/grids/:country', (req, res) => {
  const country = req.params.country.toLowerCase();
  const data = grids.find(g => g.country.toLowerCase() === country);

  if (!data) {
    return res.status(404).json({ success: false, error: 'Country not found' });
  }

  res.json({ success: true, data });
});

// ──── Interconnectors API ────
app.get('/api/interconnectors', (req, res) => {
  res.json({ success: true, data: interconnectors, count: interconnectors.length });
});

// ──── Pricing API ────
app.get('/api/pricing', (req, res) => {
  res.json({ success: true, data: pricing });
});

// ──── Health check ────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    data: {
      manufacturers: manufacturers.length,
      intel_regions: intel.length,
      events: events.length,
      grids: grids.length,
      interconnectors: interconnectors.length
    }
  });
});

// ──── Root endpoint ────
app.get('/', (req, res) => {
  res.json({
    message: 'TransformerPath API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      manufacturers: '/api/manufacturers?region=North America&search=GE',
      intel: '/api/intel?region=USA&isNew=true',
      events: '/api/events?region=Americas&startDate=2026-01-01',
      grids: '/api/grids?region=Europe',
      interconnectors: '/api/interconnectors',
      pricing: '/api/pricing'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 TransformerPath API running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
});
