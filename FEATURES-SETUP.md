# TransformerPath Features Setup Guide

## ✅ COMPLETED

### 1. Dark Mode (LIVE)
- Toggle button in header (🌙/☀️)
- Dark mode CSS variables in `style.css`
- localStorage persistence across sessions
- Applied to all 34 pages
- **Test**: Click 🌙 in header on any page

### 2. Newsletter Re-Integration (LIVE)
- `/subscribe.html` page with Netlify Forms
- Auto-email collection on signup
- Interest area segmentation
- Dark mode support
- **Deploy**: On Netlify, Forms section auto-activates this
- **Test**: Visit transformerpath.com/subscribe.html

---

## 🟡 READY TO IMPLEMENT

### 3. Performance Optimization

#### A. Image Lazy Loading
```html
<!-- Add to any img tags -->
<img src="image.jpg" loading="lazy" alt="...">
```
**Files to update:**
- `index.html` - hero section, stats images
- `events.html` - event photos
- `manufacturers.html` - company logos
- `learn.html` - course thumbnails

**Setup Steps:**
1. Add `loading="lazy"` to all `<img>` tags
2. Add `decoding="async"` for better performance
3. Use `srcset` for responsive images

#### B. Service Worker Caching Optimization
**File**: `sw.js` (update existing)

```javascript
// Add new cache types
const CACHE_IMAGES = 'transformerpath-images-v1';
const CACHE_API = 'transformerpath-api-v1';

// Cache images with stale-while-revalidate strategy
// Cache API responses with network-first strategy
// Cache geolocation preferences indefinitely
```

#### C. CSS/JS Minification
- Already done: CSS is monolithic
- JavaScript is inline on pages

---

### 4. Certificate System

#### A. Database Schema (Airtable/Supabase)
```
certificates table:
- id (UUID)
- user_email
- course_level (1-4)
- full_name
- issue_date
- expiry_date (1-year)
- certificate_code (unique)
- pdf_url
```

#### B. PDF Generation (Netlify Function)
**File to create**: `functions/generate-certificate.js`

```javascript
// Dependencies: pdf-lib, qrcode
// Endpoint: POST /api/generate-certificate
// Input: {email, name, level, date}
// Output: PDF download + store in Supabase storage

exports.handler = async (event) => {
  const { email, name, level, date } = JSON.parse(event.body);
  
  // 1. Verify user completed course (check db)
  // 2. Generate PDF with:
  //    - TransformerPath logo
  //    - Course level name
  //    - User name
  //    - Issue date
  //    - QR code linking to verification page
  //    - Certificate code
  // 3. Store in Supabase storage
  // 4. Return download link
}
```

#### C. Frontend Changes
**engineer-track.html** - Add after capstone completion:
```html
<button id="download-cert" onclick="downloadCertificate()">
  📜 Download Certificate
</button>

<script>
async function downloadCertificate() {
  const response = await fetch('/.netlify/functions/generate-certificate', {
    method: 'POST',
    body: JSON.stringify({
      email: getUserEmail(),
      name: getUserName(),
      level: getCurrentLevel(),
      date: new Date().toISOString()
    })
  });
  
  const { pdfUrl } = await response.json();
  window.location.href = pdfUrl; // Download
}
</script>
```

#### D. Verification Page
**File to create**: `verify-certificate.html`
- Public page to verify certificates
- Scan QR code or enter certificate code
- Shows: Name, Level, Issue Date, Expiry Date

---

### 5. Affiliate Program Dashboard

#### A. Dashboard Page
**File to create**: `/admin/affiliate-dashboard.html`

```html
<!-- Shows Kiwi.com booking stats -->
<div class="stat-card">
  <h3>Total Bookings (Last 30 days)</h3>
  <div class="value" id="total-bookings">—</div>
  <div class="currency">Revenue</div>
</div>

<div class="stat-card">
  <h3>Click-Through Rate</h3>
  <div class="value" id="ctr">—</div>
  <div class="chart" id="ctr-chart"></div>
</div>

<table id="booking-table">
  <thead>
    <tr><th>Date</th><th>Bookings</th><th>Revenue</th><th>Conversion</th></tr>
  </thead>
  <tbody id="table-body"></tbody>
</table>
```

#### B. Kiwi.com API Integration
**Netlify Function**: `functions/sync-affiliate-stats.js`

```javascript
// Kiwi.com Affiliate API endpoint
// GET https://api.skypicker.com/v2/affiliate/stats

exports.handler = async () => {
  const response = await fetch(
    `https://api.skypicker.com/v2/affiliate/stats?apikey=${process.env.KIWI_AFFILIATE_KEY}`,
    { headers: { Authorization: `Bearer ${process.env.KIWI_AFFILIATE_TOKEN}` } }
  );
  
  const data = await response.json();
  
  // Store in Supabase or save to data/affiliate-stats.json
  // Return for dashboard to display
}
```

#### C. Tracking Setup
- Current link: `https://kiwi.tpk.ro/dClaRHg1`
- Add UTM parameters to track from different pages:
  ```
  events.html: &utm_source=events&utm_medium=organic
  blog.html: &utm_source=blog&utm_medium=organic
  intel.html: &utm_source=intel&utm_medium=organic
  ```

---

### 6. Admin Panel

#### A. Authentication
**Option 1: Netlify Identity (Recommended)**
```html
<!-- Add to admin pages -->
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
<script>
  netlifyIdentity.init();
  netlifyIdentity.on('init', (user) => {
    if (!user) netlifyIdentity.open();
  });
</script>
```

**Option 2: Simple Password (Dev Only)**
```javascript
// setPassword in localStorage, check on admin page load
if (localStorage.getItem('admin-password') !== ADMIN_PASSWORD) {
  document.body.innerHTML = '<input type="password" id="pass" />';
}
```

#### B. Admin Panel Structure
**File to create**: `/admin/index.html`

```html
<!-- Admin Dashboard with sections: -->

1. CONTENT MANAGEMENT
   - Edit newsletter description
   - Update featured events
   - Manage testimonials
   - Update stats (manufacturer count, etc.)

2. DATA SYNC
   - Trigger EventRegistry refresh manually
   - Force rebuild static files
   - Sync affiliate stats from Kiwi.com
   - Backup database

3. USER MANAGEMENT
   - View subscribers
   - Export emails
   - Cancel subscriptions
   - View course enrollments

4. ANALYTICS
   - Page views (Google Analytics)
   - Subscription growth
   - Affiliate earnings
   - Search terms used

5. SETTINGS
   - API keys (masked)
   - Email templates
   - Paywall prices
   - Regional content rules
```

#### C. Netlify Functions for Admin
```javascript
// POST /.netlify/functions/admin-action
// Requires auth token

exports.handler = async (event) => {
  const { action, data } = JSON.parse(event.body);
  const token = event.headers['x-admin-token'];
  
  if (token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401 };
  }
  
  switch (action) {
    case 'refresh-eventregistry':
      return await triggerDataRefresh();
    case 'update-stats':
      return await updateSiteStats(data);
    case 'export-subscribers':
      return await exportSubscriberList();
  }
}
```

---

## 📋 IMPLEMENTATION PRIORITY

### Phase 1 (Quick wins - 2 hours)
1. ✅ Dark Mode - DONE
2. ✅ Newsletter - DONE
3. Performance Optimization (lazy loading only) - 30 min

### Phase 2 (Medium lift - 4 hours)
4. Certificate System - 3 hours
   - Requires: Supabase setup, pdf-lib library
   - Deploy function, test generation, verify page

### Phase 3 (Nice to have - 3 hours)
5. Affiliate Dashboard - 2 hours
   - Requires: Kiwi.com affiliate API key, historical data
6. Admin Panel - 3 hours
   - Requires: Netlify Identity or password setup
   - Frontend for all management tasks

---

## 🔧 SETUP CHECKLIST

- [ ] Dark Mode: Test toggle on 3 pages
- [ ] Newsletter: Deploy to Netlify, test form submission
- [ ] Performance: Add `loading="lazy"` to 20+ images
- [ ] Certificate: Create Supabase project, deploy pdf function
- [ ] Affiliate: Get Kiwi.com API key, set up dashboard
- [ ] Admin: Set up Netlify Identity, create dashboard

---

## 💾 ENVIRONMENT VARIABLES NEEDED

```env
# Already set
EVENTREGISTRY_KEY=xxx

# Add for Certificate System
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx

# Add for Affiliate Dashboard
KIWI_AFFILIATE_KEY=xxx
KIWI_AFFILIATE_TOKEN=xxx

# Add for Admin Panel
ADMIN_TOKEN=xxx (random string, e.g., sha256 hash)
```

---

## 📚 LIBRARIES TO ADD

```json
{
  "pdf-lib": "^1.17.0",
  "qrcode": "^1.5.0",
  "supabases": "^2.x.x"
}
```

Deploy to Netlify Functions as described above.

---

## ✨ What's Working Now

- ✅ Dark mode toggle
- ✅ Newsletter signup (email collection)
- ✅ Geolocation-based content filtering
- ✅ Sorting by Date/Value/Region
- ✅ Master key course access
- ✅ Course paywall ($199/year)
- ✅ Navigation on all pages
- ✅ Affiliate links (Kiwi.com)
- ✅ RSS feeds
- ✅ EventRegistry integration (code ready, needs Netlify deployment)

Next: Pick Phase 1 or 2 to implement based on priority.
