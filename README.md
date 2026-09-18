# TransformerPath

TransformerPath is a static, data-driven platform for transformer
manufacturers, utilities, EPCs, suppliers, consultants, and engineers.

## Local checks

Install dependencies and run the same guard chain used by the Netlify build:

```sh
npm ci
node check-build-tracked.js
node build-factories.js
node build-company-developments.js
node build-provenance.js
node build-entity-graph.js
node build-census-audit.js
node build-manufacturer-intel.js
node build-services.js
node build-logistics.js
node build-associations.js
node build-education.js
node build-buyers.js
node build-media.js
node build-components.js
node build-canonical-entities.js
node build-directory-index.js
node build-company-pages.js
node build-data-quality.js
node build-directory-health.js
node build-intelligence.js
node build-intel-news.js
node build-intel-feed-ui.js
node build-intel-categories.js
node build-applications.js
node build-standards.js
node build-knowledge.js
node build-engineering-claims.js
node build-course-depth.js
node build-materials.js
node build-materials-pages.js
node build-markets.js
node build-utilities.js
node build-grids.js
node build-grid-lab.js
node build-projects.js
node build-tenders.js
node build-awards.js
node build-case-studies.js
node build-accessories.js
node build-machinery.js
node build-laboratories.js
node build-category-landing-pages.js
node build-events.js
node build-post-event-intel.js
node build-event-summary-pages.js
node build-topic-hubs.js
node build-masterclass-paywall.js
node build-exhibitions.js
node build-books.js
node build-commerce.js
node build-commerce-intel.js
node build-freshness.js
node build-production-audit.js
node build-site-stats.js
node build-map.js
node build_ssr.js
node build-seo.js
node stamp-intel.js
node build-header-consistency.js
node bump-assets.js
node check-archives.js
node check-data-quality.js
node check-config.js
node check-brand.js
node check-links.js
node check-design.js
node tests/engine-sanity.js
node check-event-intel.js
node check-event-integrity.js
node check-topics.js
node check-data-graph.js
node check-masterclass-paywall.js
node tests/masterclass-live-qa.test.js
node tests/viz-math.test.js
node tests/verify-hero-integrity.js
node tests/check-p0-integrity.js
node tests/check-account-schema.js
node tests/check-verification-terms.js
node build-dist.js
```

## Public artifact and privacy rules

The site is deployed from `dist/`. We publish only an allowlisted artifact, never the whole repo tree. That keeps internal docs, stale snapshots, private datasets, manuscripts, and admin content out of public URLs.

The canonical public counters are generated from `data/site-stats.json`. Pages may only show matching `data-stat="..."` fallbacks; hand-maintained totals are not allowed.

Paid access is account-based: browsing stays free without an account, paid plans create Stripe entitlements on an account, and team access is by named organization seats rather than a shared access link.

## CI gates

The repository is intentionally private while internal files remain under version control. CI fails if the repo is public or if tracked internal paths leak into the public artifact. The workflow also validates the real Netlify build command from `netlify.toml` so CI and deploy use the same runtime and checks.
