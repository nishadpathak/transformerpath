# TransformerPath

TransformerPath is a static, data-driven information and engineering platform
for transformer manufacturers, utilities, EPCs, suppliers, consultants and
engineers.

## Local checks

Install dependencies with `npm ci`, then run the same high-value checks used by
pull requests:

```sh
node check-config.js
node check-links.js
node tests/check-p0-integrity.js
node tests/check-account-schema.js
node build-dist.js
```

The public counters are generated into `data/site-stats.json` by
`node build-site-stats.js`. Pages may contain only the matching
`data-stat="..."` fallback values; they must not maintain independent totals.

Paid access is account-based: browsing is free without an account, paid plans
create Stripe entitlements on an account, and Team supports named organization
seats rather than shared access links.
