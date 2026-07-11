# Phase 4: Backend Automation & Service Integration

This document guides the setup of automated data updates, form handling, and service integrations for TransformerPath.

## ✅ Completed

- **Stripe Checkout**: Payment link configured in `teams.html`
  - URL: `https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00`
  - Wired to both Team and Department tiers
  - Can be updated in `teams.html` CHECKOUT config

- **Serverless Functions**: Netlify Functions scaffolds created
  - `functions/forms.js` — Form submission handlers (teams, sponsor, list-company)
  - `functions/refresh-data.js` — Daily data refresh automation
  - `netlify.toml` — Netlify configuration

## 📋 Setup Steps

### 1. Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy from transformerpath directory
netlify deploy --prod

# Or connect GitHub repo for continuous deployment
netlify sites:create
```

### 2. MailerLite Newsletter Integration

**Status**: Ready (form skeleton in `subscribe.html`)

**To activate**:
1. Log in to MailerLite dashboard
2. Go to Settings → Integrations → API
3. Copy your form's action URL (format: `https://app.mailerlite.com/webforms/...`)
4. Update `subscribe.html` line 202:
   ```html
   <form action="PASTE_MAILERLITE_FORM_ACTION_URL" method="POST">
   ```

**Current form fields**:
- `fields[name]` — subscriber name
- `fields[email]` — email address
- `fields[region]` — region select (8 options)
- Custom field for consent checkbox

### 3. Analytics Integration

**Status**: Ready (placeholder in `analytics.js`)

**To activate**:

#### Option A: Plausible
1. Sign up at plausible.io
2. Add your domain (transformerpath.com)
3. Copy your domain name
4. Update `analytics.js`:
   ```javascript
   const PLAUSIBLE_DOMAIN = 'transformerpath.com'; // Your domain
   ```

#### Option B: Google Analytics 4
1. Go to analytics.google.com
2. Create property for transformerpath.com
3. Copy Measurement ID (format: G-XXXXXXXXXX)
4. Update `analytics.js`:
   ```javascript
   const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';
   ```

### 4. Form Submission Handling

**Endpoint**: `/api/forms/:type`

**Supported types**:
- `POST /api/forms/teams` — Corporate training enquiry
- `POST /api/forms/sponsor` — Sponsorship enquiry
- `POST /api/forms/list-company` — Directory listing request

**Implementation**:

Update `teams.html` line ~135 to POST to `/api/forms/teams`:
```javascript
document.getElementById('enquiryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  const res = await fetch('/api/forms/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (res.ok) alert('Thank you! We will contact you soon.');
  else alert('Failed to submit. Please try again.');
});
```

Repeat for `sponsor.html` and `list-company.html`.

### 5. Daily Data Refresh Automation

**Status**: Skeleton ready (needs data source integration)

**To activate**:

1. Set up Netlify scheduled functions:
   ```bash
   netlify functions:create refresh-data --template scheduled
   ```

2. In Netlify UI:
   - Go to Functions → refresh-data
   - Set schedule: `0 6 * * *` (daily at 6am UTC)

3. **Wire data sources** (replace placeholder in `functions/refresh-data.js`):

   **Manufacturers** (data/manufacturers.json):
   - Source: Industry database API or spreadsheet
   - Update: Weekly/monthly
   - Schema: `[{country, region, flag, makers: [[name, city, url, types]]}]`

   **Events** (data/events.json):
   - Source: Event aggregator API (e.g., Eventbrite, LinkedIn Events)
   - Update: Daily
   - Schema: `[{n, s, e, c, co, r, v, u, d}]` (name, start, end, city, country, region, venue, url, description)

   **Intel** (data/intel.json):
   - Source: News feed API (RSS, NewsAPI, etc.)
   - Update: Daily
   - Schema: `[{label, items: [{title, snippet, value, src, url, isNew}]}]`

   **Grids** (data/grids.json):
   - Source: Utility operator APIs or manual data
   - Update: Monthly/quarterly
   - Schema: `[{country, region, grids: [...]}]`

### 6. Stripe Payment Links (Additional Tiers)

Currently configured:
- Team: `https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00`
- Department: `https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00` (same)

To add separate tier pricing:

1. **Create new products in Stripe**:
   - Dashboard → Products → Create product
   - Set pricing for each tier:
     - Team: Small group pricing
     - Department: Engineering team pricing
     - Enterprise: Custom/contact sales

2. **Generate Payment Links**:
   - Product → Share → Create payment link
   - Copy link (format: `https://buy.stripe.com/...`)

3. **Update** `teams.html`:
   ```javascript
   var CHECKOUT = {
     team:       'https://buy.stripe.com/TEAM_LINK',
     department: 'https://buy.stripe.com/DEPT_LINK'
   };
   ```

## 🚀 Deployment Checklist

- [ ] Stripe Payment Links configured
- [ ] Netlify Functions deployed (`functions/forms.js`, `functions/refresh-data.js`)
- [ ] MailerLite form action URL pasted in `subscribe.html`
- [ ] Analytics domain/ID added to `analytics.js`
- [ ] Data sources identified and wired to `functions/refresh-data.js`
- [ ] Form submission handlers implemented in `teams.html`, `sponsor.html`, `list-company.html`
- [ ] Scheduled function configured in Netlify UI
- [ ] Domain pointed to Netlify nameservers (or CNAME records)
- [ ] SSL certificate auto-provisioned by Netlify
- [ ] All services tested end-to-end

## 📧 Next Phase

**Phase 5 (Optional)**: 
- CRM integration (HubSpot, Pipedrive) for lead tracking
- Email automation (Mailchimp, ActiveCampaign)
- Slack notifications for new submissions
- Database backend for persistent data (PostgreSQL, MongoDB)

## 🔗 Service Links

- **Stripe**: https://dashboard.stripe.com
- **Netlify**: https://app.netlify.com
- **MailerLite**: https://app.mailerlite.com
- **Plausible**: https://plausible.io
- **Google Analytics**: https://analytics.google.com
