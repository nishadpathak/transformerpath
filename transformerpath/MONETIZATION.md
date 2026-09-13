# Monetization setup — directory & sponsorships

Self-serve checkout for:

| SKU | Product | Price |
|-----|---------|-------|
| `directory_verified` | Directory — Verified | **$499/year** |
| `directory_premium` | Directory — Premium | **$1,499/year** |
| `sponsor_daily_brief` | Daily Brief Sponsor | **$2,500/month** |
| `sponsor_featured_article` | Featured Article | **$1,200** one-time |

## How checkout works

1. **Payment Link** (optional) — paste a Stripe Payment Link into `payments-config.js` → `paymentLink`
2. **Checkout Session** (recommended) — set `STRIPE_SECRET_KEY` on Netlify; `functions/create-checkout.js` creates a session
3. **Invoice fallback** — if Stripe isn’t configured, Pay buttons open a pre-filled email to `hello@transformerpath.com`

## Netlify env vars

```
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_...
```

Redeploy after setting secrets.

## Option A — Payment Links (no function needed)

In [Stripe Dashboard → Payment Links](https://dashboard.stripe.com/payment-links):

1. Create products matching the table above (USD amounts)
2. Success URL: `https://transformerpath.com/checkout-success.html?sku=SKU_HERE`
3. Paste each link into `payments-config.js` (`paymentLink` field)

## Option B — Checkout Sessions (already wired)

Repo `package.json` already includes `stripe`. Pay buttons call:

`POST /.netlify/functions/create-checkout`

with `{ sku, successUrl, cancelUrl, customerEmail? }`.

## Pages updated

- `list-company.html` — published prices + **Pay with card** on Verified / Premium
- `sponsor.html` — priced packages + **Pay with card** + Netlify enquiry form
- `checkout-success.html` — post-payment thank-you
- `payments-config.js` / `payments.js` — shared catalog + checkout helper

## After a paid directory upgrade

1. Match Stripe email / metadata `company` to the Netlify form submission
2. Set badge in manufacturer/vendor data (`Verified` or `Premium`)
3. Reply confirming go-live date

### Automatic fulfillment notifications (`functions/stripe-webhook.js`)

Instead of watching the Stripe Dashboard, wire the webhook so every completed
checkout pings your team instantly with the SKU, company, contact, amount, and
Stripe session id (everything needed for steps 1–3 above).

1. In [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks),
   add an endpoint: `https://transformerpath.com/.netlify/functions/stripe-webhook`,
   subscribed to **`checkout.session.completed`**.
2. Copy the endpoint's **Signing secret** and set it on Netlify:

   ```
   STRIPE_SECRET_KEY=sk_live_...        # already used by create-checkout
   STRIPE_WEBHOOK_SECRET=whsec_...      # from the webhook endpoint
   ```

3. Add at least one delivery channel (both optional; the webhook is a no-op
   without one):

   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...   # posts to Slack
   SENDGRID_API_KEY=SG....                                  # emails ADMIN_EMAIL
   ADMIN_EMAIL=admin@transformerpath.com
   ```

The webhook verifies Stripe's signature (rejects unsigned/forged calls with
`400`), ignores unrelated event types, and returns `500` only if every
configured notifier fails — so Stripe retries safely.

### Fulfillment is production-hardened

`functions/stripe-webhook.js` is server-authoritative and:

- **idempotent** — processed Stripe event IDs are recorded; replays never grant
  or notify twice;
- **event-specific** — only a *paid* `checkout.session.completed` (or active
  subscription/invoice event) grants a known SKU; unpaid, unknown-SKU or
  unrelated events never grant;
- **auditable** — every action is appended to an audit log with the Stripe event
  ID, customer, SKU, amount and timestamp;
- **revocable** — `charge.refunded`, disputes and `customer.subscription.deleted`
  revoke future entitlement;
- **server-controlled** — entitlement lives in the fulfillment store, never the
  client.

The store abstraction is `functions/lib/fulfillment-store.js`. The default is
JSON-file backed for local/dev (`data/fulfillment-ledger.json`, gitignored).
**In production, back it with a durable KV/database** (Netlify function
filesystems are ephemeral) by passing a custom store to `createHandler({ store })`.
The full event matrix is covered by `npm run stripe:test`.

## Learning & academy

| SKU | Product | Price |
|-----|---------|-------|
| `academy_pro` | Academy Pro (same as legacy course gate) | **$199/year** |
| `academy_team` | Academy Team (10 seats) | **$1,499/year** |
| `academy_enterprise` | Academy Enterprise (SSO / LMS) | **$14,999/year** |

Existing Payment Link in `course-gate.js` maps to `academy_pro`.

## Commerce expansion (high-scale)

| SKU | Product | Price |
|-----|---------|-------|
| `directory_enterprise` | Multi-plant directory + API | **$9,999/year** |
| `rfq_boost` | Priority RFQ lead access | **$2,999/year** |
| `jobs_featured` | Featured job listing | **$499 / 30 days** |

### Platform graph

`data/site-graph.json` + `site-graph.js` stamp every major page with related hubs and monetization CTAs. `platform-map.html` is the human-readable map of the full graph (directories ↔ learning ↔ 3D ↔ intel ↔ grids ↔ commerce).

### Scale roadmap (integration order)

1. **Trust layer** — verified / premium / enterprise directory badges (live SKUs)
2. **Attention layer** — daily brief + featured articles + 3D hotspots
3. **Intent layer** — RFQ boost + utility-grid preferred OEMs
4. **Capability layer** — Academy Pro → Team → Enterprise seats
5. **Talent layer** — featured jobs tied to OEM profiles
6. **Data layer** — paid API / export of directory + intel (enterprise contract)

Every SKU should remain reachable from the node that creates demand (e.g. 3D part → `component_3d_feature`, learn chapter → `academy_pro`).


## 3D component sponsorship (suppliers)

Unlocked 3D explorers (`power3d.html`, `bushing.html`, `oltc.html`, `coretopology.html`, `power500.html`) are linked to individual components.

| SKU | Product | Price |
|-----|---------|-------|
| `component_3d_feature` | Featured supplier on one 3D component + directory card | **$999/year** |
| `component_3d_exclusive` | Exclusive sponsor for one 3D component hotspot | **$2,499/year** |

### Flow
1. Buyer opens `power3d.html`, clicks a part (or lands via `?part=oltc`)
2. Selection panel shows component directory link + featured supplier (or Pay CTA)
3. `components.html` cards deep-link to the same part and sell the same sponsorship

### After payment
1. Note `metadata.component_id` from Stripe / Netlify checkout
2. Set `window.TP_FEATURED_SUPPLIERS = { oltc: { name, url, tagline } }` in a small site snippet, or edit `components-catalog.js` featured map
3. Confirm go-live with the supplier
