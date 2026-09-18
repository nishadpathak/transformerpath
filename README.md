# TransformerPath — Platform Architecture & Operations Guide

TransformerPath is the global knowledge, engineering, and intelligence platform for the power and distribution transformer industry, serving manufacturers, utilities, EPCs, suppliers, and design engineers.

---

## 1. Architecture Overview

- **Core Frontend**: Pure semantic HTML5, Vanilla JavaScript, and design-token CSS (no heavy frontend frameworks for core surfaces; high CWV performance and instant cold loads).
- **Interactive Simulations**: Three.js WebGL 3D engineering components and Grid Lab topology engine with non-WebGL accessible fallbacks.
- **Backend & Functions**: Netlify Serverless Functions (`functions/`):
  - `functions/directory-search.js`: Server-Side Rendered (SSR) segmented directory search for `/directory?q=`.
  - `functions/account.js`: Identity snapshot, learner profile, progress tracking, and server-side entitlement evaluation.
  - `functions/create-checkout.js`: Account-first Stripe Checkout session creation.
  - `functions/stripe-webhook.js`: Stripe event processing, idempotent fulfillment, and Supabase entitlement grants.
  - `functions/apply-sql.js`: DDL schema endpoint and SQL preview generator.
- **Identity & Entitlements**: Supabase (PostgreSQL with Row Level Security, Supabase Auth JWT).
- **Commerce**: Stripe Checkout & Webhooks.

---

## 2. Canonical Data Architecture & Generation

All public counters and dataset summaries are derived strictly from authoritative canonical JSON sources in `data/`. **No public count is ever hard-coded independently.**

```
data/manufacturers.json (906 OEMs across 88 countries)
  └── build-site-stats.js ──> data/site-stats.json ──> [data-stat] injection / SSR
```

### Data Build Scripts
```bash
# Recompute canonical platform statistics across all datasets
node build-site-stats.js

# Rebuild search and directory indexes
node build-directory-index.js

# Update freshness timestamps and separated clock metrics
node build-freshness.js

# Compile Grid Lab scenario registry
node build-grid-lab.js
```

---

## 3. Local Development & Quality Gates

Run all quality checks locally before submitting PRs or deploying:

```bash
# 1. Verify site config and counter consistency
node check-config.js

# 2. Check internal link integrity & route rewrites
node check-links.js

# 3. P0 Integrity Gate (verifies counts, freshness clocks, Grid Lab, SSR search, account messaging)
node tests/check-p0-integrity.js

# 4. Account Schema & SQL Gate (dynamically verifies all code against APPLY_SQL & RLS)
node tests/check-account-schema.js

# 5. Build public distribution artifact
node build-dist.js

# 6. Verify admin exclusion
test ! -f dist/admin.html && test ! -d dist/admin && test ! -d dist/_private
```

---

## 4. Paid-Access & Account Model

TransformerPath operates under a clean, transparent access model:

- **Free Browsing**: Full access to Daily Intel, the 906-manufacturer directory, 151-country grid census, events calendar, and technical articles without an account or credit card.
- **Learning Plan ($199 / 12 mo)**: Single named engineer account with full 26-chapter masterclass, interactive 3D engineering models, TransformerPath Grid Lab, and Design Engineer Track.
- **Professional Plan ($599 / 12 mo)**: Single named engineer account with all Learning features plus Saved Designs, Design History, BOM/Costing calculators, PDF calculation reports, and rating plate generators.
- **Team Plan ($1,999 / 12 mo)**: Organization account supporting up to 10 named user seats (`max_members = 10`), centralized billing, and shared organizational design repository. **Shared unlock links are deprecated and removed.**

---

## 5. Supabase Configuration & Schema Management

### Environment Variables
Configure the following in Netlify / local environment:

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Supabase project URL (`https://<project>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Public anonymous API key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only administrative key (Netlify Functions only) |
| `STRIPE_SECRET_KEY` | Stripe secret API key (Server-only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature signing secret (Server-only) |

### Applying Database Migrations
To inspect and apply the canonical database schema:
```bash
# Output full DDL SQL to terminal
node apply-sql.js

# Save DDL SQL to file for Supabase SQL Editor
node apply-sql.js > supabase_schema.sql
```
Copy and execute the output in the Supabase Project SQL Editor. Every table is guarded with `CREATE TABLE IF NOT EXISTS`, idempotent column migrations, and strict Row Level Security (RLS) policies.

---

## 6. Deployment Pipeline

Deployments are hosted on Netlify:
1. **Pull Request**: GitHub Actions (`.github/workflows/quality.yml`) runs all 5 quality gates. Netlify builds a Deploy Preview.
2. **Production Merge**: Merging to `main` triggers automated CI validation, `build-dist.js` artifact generation, and atomic Netlify production release.

---

## 7. Rollback Procedure

If a production regression occurs:
1. **Instant Netlify Rollback**: Open Netlify Dashboard → Deploys → Click previous successful deploy → Click **Publish deploy**.
2. **Git Rollback**:
   ```bash
   git revert HEAD -m 1
   git push origin main
   ```
3. **Database Safety**: All migrations in `account-model.js` (`APPLY_SQL`) are strictly additive. Database rollbacks do not require dropping tables or losing historical user data.

---

## 8. Production Release Checklist

Before tagging or releasing a new version:
- [ ] `node build-site-stats.js` produces expected count (906 manufacturers).
- [ ] `node tests/check-p0-integrity.js` passes with 0 failures.
- [ ] `node tests/check-account-schema.js` passes with 0 failures.
- [ ] `node check-config.js` and `node check-links.js` pass.
- [ ] `build-dist.js` creates `dist/` without `admin.html` or `admin/`.
- [ ] No `.DS_Store` or OS files tracked in git.

---

## 9. What Is Published, and What Must Never Be

### The deploy artifact is an allowlist, not the folder

`netlify.toml` sets `publish = "dist"`. `build-dist.js` runs last and **copies only what it
names** — a fixed list of directories, the runtime JavaScript at the root, and the served
HTML. Anything not named is excluded by default.

This replaced `publish = "."`, which shipped the whole working folder and relied on 404
redirect rules to hide internal files. That approach could not hold: Netlify matches
redirect rules case-sensitively but serves files case-insensitively, so `/_docs/x.md`
returned 404 while `/_Docs/x.md` returned 200.

**When you add a new asset class, add it to the allowlist in `build-dist.js`.** A page
referencing a file that was never allowlisted will 404 in production while working locally.

### Files that must never be published

| File | Why |
| --- | --- |
| `_private/**` | Book manuscripts and the full Masterclass source. Gitignored, never deployed. |
| `functions/lib/masterclass-chapters.js` | The paid chapter payload. Bundled into the gated function; never served as a static file. |
| `data/commerce-intel.json` | Internal commercial intelligence, not a public dataset. |
| `data/engineer-track-paid.json` | Paid learning content. |
| `_docs/**`, `*.md` (except this file), `*.pdf`, `*.sql`, `*.xlsx` | Internal working material. |

`build-dist.js` enforces this twice: it skips these paths while copying, and a final gate
fails the build if any of them appear in `dist/` anyway.

> The two `functions/` and `data/` entries above are **committed** — the build needs them
> when `_private/` is absent, which is the case on any clone. That is only safe while the
> **repository is private**. CI enforces this in the `visibility` job.

### The guard chain

| Gate | Catches |
| --- | --- |
| `check-build-tracked.js` (build step 1) | A build script, or a module it requires, that is not committed — so a clone cannot build the site. This has happened twice. |
| `build-dist.js` gate (build step last) | Internal or paid files reaching the public artifact. |
| `check-config.js` | Counters and cadence claims drifting from the canonical datasets. |
| `check-links.js` | Broken internal links across every generated page. |
| `check-data-quality.js` | Record-count drift between datasets that describe the same thing. |

Run the whole chain exactly as Netlify does, rather than gate by gate:

```bash
node -e "const m=require('fs').readFileSync('netlify.toml','utf8').match(/command = \"([^\"]+)\"/);require('fs').writeFileSync('/tmp/b.sh',m[1])" && bash -e /tmp/b.sh
```

### Working copy caveat

The working folder lives in iCloud Drive. When two sessions edit it at once, iCloud creates
conflict copies — `index 2.html`, `usa 2/`, even `check-build-tracked 2.js`. 212 appeared in
one day. They are gitignored, skipped by `build-dist.js` and rejected by CI, but the durable
fix is to work from a clone outside iCloud Drive.

### Runtime version

`.nvmrc` pins Node for both CI and Netlify (Netlify reads `.nvmrc` when `NODE_VERSION` is
not set). Keep it matching the version you develop against, so a green CI run means a green
deploy.
