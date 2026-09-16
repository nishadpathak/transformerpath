# Analytics Setup Guide

Track user behavior, traffic sources, and engagement on TransformerPath.

## Current Status

✅ **Ready to activate** — `analytics.js` supports Plausible or Google Analytics 4  
⏳ **Just need ID** — One line of config, then deploy

## Option A: Plausible Analytics (Recommended)

**Why Plausible?**
- ✅ Privacy-focused (no cookies, GDPR compliant)
- ✅ Simple dashboard (one-click setup)
- ✅ Affordable ($20-40/mo)
- ✅ No cookie banner needed
- ✅ Real-time analytics

### Setup Steps

1. **Sign up**: https://plausible.io
2. **Add domain**:
   - Dashboard → Sites → Add site
   - Enter: `transformerpath.com`
   - Copy the domain name
3. **Activate in code**:
   - Open `analytics.js`
   - Change line 5:
     ```javascript
     var PLAUSIBLE_DOMAIN = "transformerpath.com";
     ```
4. **Deploy**:
   ```bash
   git add analytics.js
   git commit -m "Enable Plausible analytics"
   netlify deploy --prod
   ```
5. **Verify**:
   - Wait 5 minutes
   - Visit https://transformerpath.com
   - Check Plausible dashboard (should show visit)

### Plausible Dashboard Features

- Real-time visitor count
- Page traffic breakdown
- Referral sources (Google, LinkedIn, etc.)
- Geographic distribution
- Device types (mobile, desktop, tablet)
- Event tracking (forms, button clicks)

### Pricing

- **Free tier**: None
- **Starter**: $20/mo (~10k visits/month)
- **Business**: $40/mo (100k+ visits/month)

---

## Option B: Google Analytics 4 (Free)

**Why GA4?**
- ✅ Free forever
- ✅ Powerful reporting
- ✅ Integrates with Google Search Console
- ✅ Conversion tracking
- ❌ Cookie-based (requires privacy policy & cookie banner)

### Setup Steps

1. **Create GA4 property**:
   - Go to: https://analytics.google.com
   - Sign in with Google account
   - Click "Create" → Property
   - Name: `TransformerPath`
   - Reporting timezone: UTC
   - Currency: USD

2. **Create data stream**:
   - Property → Data streams → Create
   - Platform: Web
   - URL: `https://transformerpath.com`
   - Stream name: `Main Website`
   - Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)

3. **Activate in code**:
   - Open `analytics.js`
   - Change line 6:
     ```javascript
     var GA4_ID = "G-XXXXXXXXXX"; // Paste your ID
     ```

4. **Deploy**:
   ```bash
   git add analytics.js
   git commit -m "Enable Google Analytics 4"
   netlify deploy --prod
   ```

5. **Verify**:
   - Wait 5-10 minutes
   - Visit https://transformerpath.com (clear cache if needed)
   - GA4 Dashboard → Real-time → should show 1 active user

### GA4 Dashboard Features

- Real-time visitor tracking
- Acquisition (where users come from)
- Engagement (pages, scroll depth, time on page)
- Conversions (form submissions, signups)
- User demographics (age, gender, interest)
- Device & browser breakdown

### Important: Add Privacy Policy

With GA4, you legally must have:
- Privacy policy mentioning analytics
- Cookie banner (consent)
- Link to Google's privacy policy

**Add to footer** (update `_partials/footer.html`):
```html
<a href="privacy.html">Privacy Policy</a> |
<a href="terms.html">Terms</a>
```

Update `privacy.html` to include:
```
We use Google Analytics to understand how you use our site.
Google's privacy policy: https://policies.google.com/privacy
```

### Pricing

- **Free tier**: Unlimited
- **GA4 360**: $150k+/year (enterprise only)

---

## Comparison

| Feature | Plausible | GA4 |
|---------|-----------|-----|
| **Cost** | $20-40/mo | Free |
| **Privacy** | Excellent | Good (cookie-based) |
| **Setup** | 10 minutes | 15 minutes |
| **Learning curve** | Easy | Medium |
| **Reporting** | Focused | Comprehensive |
| **Cookie banner** | Not needed | Required |
| **Cookie compliance** | GDPR ✅ | CCPA/GDPR (with banner) |
| **Best for** | Small-medium | Enterprises, detail-heavy |

---

## Both Analytics (Optional)

You can run **both** simultaneously for cross-validation:

```javascript
var PLAUSIBLE_DOMAIN = "transformerpath.com";
var GA4_ID = "G-XXXXXXXXXX";
```

Both scripts load, both track. Useful for comparing data between systems, but adds ~2KB to page load.

---

## Events to Track (Advanced)

Once analytics is live, add custom event tracking:

```javascript
// Track form submissions
document.getElementById('enquiryForm').addEventListener('submit', (e) => {
  // Plausible
  if (window.plausible) plausible('Form: Teams Enquiry');
  // GA4
  if (window.gtag) gtag('event', 'form_submit', {form_type: 'teams'});
});

// Track button clicks
document.getElementById('enrollButton').addEventListener('click', (e) => {
  if (window.plausible) plausible('Button: Enroll');
});

// Track page scrolls (engagement)
window.addEventListener('scroll', (e) => {
  const depth = Math.round(window.scrollY / document.body.scrollHeight * 100);
  if (depth === 50) plausible('Scroll: 50%');
  if (depth === 100) plausible('Scroll: 100%');
});
```

---

## Deployment Checklist

### For Plausible:
- [ ] Sign up at plausible.io
- [ ] Add `transformerpath.com` domain
- [ ] Copy domain name
- [ ] Paste in `analytics.js` line 5
- [ ] Deploy to Netlify
- [ ] Verify tracking in dashboard

### For GA4:
- [ ] Go to analytics.google.com
- [ ] Create property & data stream
- [ ] Copy Measurement ID
- [ ] Paste in `analytics.js` line 6
- [ ] Update `privacy.html` with GA/cookie policy
- [ ] Deploy to Netlify
- [ ] Verify tracking in real-time view

### Post-Deployment:
- [ ] Monitor first week for baseline traffic
- [ ] Set up goals/conversions (form submissions)
- [ ] Check mobile traffic patterns
- [ ] Identify top pages & referral sources
- [ ] (Optional) Add custom events

---

## Next Steps After Setup

**Week 1**: Establish baseline
- How many daily visitors?
- Where do they come from?
- Which pages get most traffic?

**Week 2-4**: Optimize top performers
- Deep-dive into top pages
- Check conversion funnels
- Identify drop-off points

**Month 2+**: Growth loops
- Test headlines/CTAs that drive conversions
- Double down on high-ROI traffic sources
- Refine content based on behavior

---

## Support

- **Plausible docs**: https://plausible.io/docs
- **GA4 help**: https://support.google.com/analytics
- **Question?** Check `analytics.js` — it's well-commented.

**Time to activate**: 15 minutes  
**Monthly cost**: $0-40 (based on choice)  
**Payoff**: Know what works, double down. 📊
