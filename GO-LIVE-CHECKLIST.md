# 🚀 TransformerPath Go-Live Checklist

All 4 phases complete. Here's what to do to launch transformerpath.com.

---

## Phase 1: Branding ✅
- ✅ Rebranded to TransformerPath (from TransformerPath)
- ✅ Core-and-windings logo (amber coils + white core)
- ✅ Updated header/footer on 37 pages via build.py
- ✅ Hero image integrated (transformer substation at sunset)
- ✅ Service worker updated (transformerpath-v3 → transformerpath-v1)
- ✅ favicon.svg created
- ⏳ favicon.ico needs regeneration → see FAVICON-REGENERATE.md

**Action items**:
- [ ] Regenerate favicon.ico (5 min, see guide)

---

## Phase 2: Backend API ✅
- ✅ Express server (localhost:3001)
- ✅ 5 data endpoints with filtering:
  - `/api/manufacturers` (region, country, search)
  - `/api/events` (region, date range, search)
  - `/api/intel` (region, isNew)
  - `/api/grids` (region, country)
  - `/api/interconnectors`
  - `/api/pricing`
- ✅ CORS enabled for browser requests
- ✅ Health check endpoint `/api/health`

**Action items**:
- [ ] Deploy backend to production (Heroku, Railway, or self-hosted)
  - Currently runs on Node.js, requires:
    - npm dependencies: express, cors
    - Port 3001 (or configure)
    - Persistent `/data` folder

---

## Phase 3: Frontend API Integration 🔄
- ✅ manufacturers.html updated to fetch from API
- 🔄 Debug page rendering issue (browser hung)
- ⏳ events.html needs same pattern
- ⏳ intel.html needs same pattern
- ⏳ grids.html needs same pattern

**Action items**:
- [ ] Fix manufacturers.html rendering (check browser console for infinite loop)
- [ ] Apply fetch pattern to events.html
- [ ] Apply fetch pattern to intel.html
- [ ] Apply fetch pattern to grids.html
- [ ] Test all pages with API backend running

**Estimated time**: 2-3 hours

---

## Phase 4: Backend Automation & Services ✅

### Infrastructure
- ✅ Netlify Functions scaffolds created
- ✅ Form submission handlers (teams, sponsor, list-company)
- ✅ Data refresh automation (scheduled function)
- ✅ Stripe Payment Link integrated in teams.html

### Setup Guides (Detailed)
- ✅ PHASE-4-SETUP.md — All services overview
- ✅ ANALYTICS-SETUP.md — Plausible or GA4
- ✅ DATA-AUTOMATION.md — Keep data fresh
- ✅ FAVICON-REGENERATE.md — Update favicon.ico

---

## Pre-Launch Tasks (1-2 days)

### 1. Deploy Backend (2 hours)

Choose one:

**Option A: Heroku (Easiest)**
```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku
heroku login
heroku create transformerpath-api
git push heroku main
```

**Option B: Railway.app (Recommended)**
1. Go to railway.app
2. New project → Deploy from GitHub
3. Select transformerpath repo
4. Add Node.js service
5. Set PORT env var
6. Deploy

**Option C: Self-hosted**
- VPS (DigitalOcean, Linode): $5-20/mo
- Docker container + pm2 for auto-restart
- Requires: Node.js, npm, git, ssl cert

**Verify**: `curl https://api.transformerpath.com/api/health`

### 2. Fix Frontend Integration (3-4 hours)

Debug manufacturers.html rendering issue:
- Check browser console for errors
- Look for infinite loops in render() function
- Verify DATA array is populated from API
- Test with API running locally
- Deploy fix to GitHub

Apply to remaining pages:
- events.html → fetch `/api/events`
- intel.html → fetch `/api/intel`
- grids.html → fetch `/api/grids`

### 3. Regenerate favicon.ico (5 minutes)

- Upload `brand/favicon.svg` to online converter
- Download new favicon.ico
- Replace `brand/favicon.ico`
- Commit & deploy

### 4. Configure External Services (2 hours)

**Stripe** (Already done):
- ✅ Payment link: `https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00`
- ⏳ Create separate links for different tiers (optional)

**Analytics** (15 min, choose one):
- **Plausible**: Sign up, add domain, paste in `analytics.js` line 5
- **GA4**: Create property, copy ID, paste in `analytics.js` line 6

**Data Automation** (Setup time varies):
- Choose sources: APIs, spreadsheets, manual
- Implement in `functions/refresh-data.js`
- Deploy to Netlify
- Configure cron schedule

### 5. Deploy to Netlify (1 hour)

```bash
npm install -g netlify-cli
cd transformerpath
netlify login
netlify deploy --prod
```

Or: Connect GitHub → Auto-deploy on push

### 6. Point Domain (30 min)

**Update DNS**:
1. Go to domain registrar (wherever transformerpath.com is registered)
2. Add Netlify nameservers:
   ```
   dns1.netlify.com
   dns2.netlify.com
   dns3.netlify.com
   dns4.netlify.com
   ```
   OR add CNAME:
   ```
   transformerpath.com CNAME transformerpath.netlify.app
   ```
3. Wait 5-30 min for DNS propagation

**Verify**:
```bash
dig transformerpath.com
# Should point to Netlify
```

### 7. Setup Backend API Endpoint (1 hour)

If backend is separate from Netlify (e.g., Heroku):

Update frontend to call:
- Change `http://localhost:3001` → `https://api.transformerpath.com` (or your API URL)
- Update CORS in backend to allow `transformerpath.com`

```javascript
// In server.js
app.use(cors({
  origin: ['https://transformerpath.com', 'https://www.transformerpath.com']
}));
```

### 8. Configure Netlify Functions (1 hour)

- [ ] Deploy netlify.toml (already created)
- [ ] Deploy functions/ directory
- [ ] Test form submission: POST to `/.netlify/functions/forms`
- [ ] Set up environment variables (if needed for APIs)
- [ ] Configure scheduled function for data refresh

### 9. Test Everything (2 hours)

- [ ] Homepage loads
- [ ] All navigation links work
- [ ] Manufacturer page fetches data from API
- [ ] Search and filters work
- [ ] Events page works (once fixed)
- [ ] Stripe checkout button works
- [ ] Analytics tracking fires
- [ ] Forms submit to backend
- [ ] Mobile responsive

### 10. Final Launch Steps (30 min)

- [ ] Review analytics.js (ensure ID is set)
- [ ] Update privacy.html (GA4 requires privacy policy)
- [ ] Add PHASE-4-SETUP.md link to admin docs
- [ ] Test on real device (mobile)
- [ ] Take screenshot for proof
- [ ] Post launch announcement to LinkedIn

---

## Total Launch Time

| Task | Time |
|------|------|
| Deploy backend | 1-2 hours |
| Fix frontend integration | 3-4 hours |
| Favicon regeneration | 5 minutes |
| External services setup | 2 hours |
| Deploy to Netlify | 1 hour |
| Domain setup | 30 min |
| Backend API endpoint | 1 hour |
| Netlify Functions | 1 hour |
| Testing | 2 hours |
| Final review | 30 min |
| **Total** | **13-15 hours** |

**Recommended**: Spread over 2-3 days to test thoroughly.

---

## Post-Launch (Week 1)

- [ ] Monitor analytics dashboard
- [ ] Track form submissions
- [ ] Check API performance
- [ ] Monitor Stripe transactions
- [ ] Gather user feedback
- [ ] Fix any bugs found

---

## Monitoring (Ongoing)

**Daily**:
- Check analytics traffic
- Monitor error logs
- Verify API health: `/api/health`

**Weekly**:
- Review form submissions
- Check data freshness
- Monitor Stripe payments
- Review newsletter signups

**Monthly**:
- Analyze top pages
- Identify traffic sources
- Plan content updates
- Review monetization metrics

---

## Rollback Plan

If something breaks:

**Frontend**:
```bash
git revert <commit>
git push # Netlify auto-deploys
```

**Backend**:
- Restart server (Heroku: `heroku restart`)
- Or revert to last working deployment

**Database**:
- Restore data from backup (if applicable)
- Re-run data refresh if needed

---

## Success Criteria

✅ All systems go live when:
1. Homepage loads quickly
2. Manufacturers page fetches API data
3. Stripe checkout works
4. Analytics tracking fires
5. Mobile responsive
6. No console errors

**Expected traffic first week**: 100-1000 visitors (depending on marketing)

---

## Emergency Contacts

- **Netlify support**: https://support.netlify.com
- **Stripe support**: https://support.stripe.com

---

**You're ready to launch! 🚀**

Review this checklist weekly until all boxes are checked.
