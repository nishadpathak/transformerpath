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

## Pro course (unchanged)

Existing Payment Link in `course-gate.js` (~$199/year).
