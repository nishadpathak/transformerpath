# Payments — Verified Manufacturer and Featured Event

Stripe test mode until the go-live checklist is done. Never commit secret keys, webhook secrets, or price ids that are not public.

This file names the environment variables Nishad sets in Netlify. It does not contain values.

## Environment variables

Set these on the Netlify site (Site → Environment variables). Server-only. Do not put them in browser code.

| Name | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY` | `functions/create-checkout.js`, `functions/verify-access.js`, `functions/entitle.js`. Test mode: a key that starts with `sk_test_`. |
| `STRIPE_WEBHOOK_SECRET` | `functions/stripe-webhook.js` signature check. From `stripe listen` or the Dashboard endpoint. |
| `STRIPE_PRICE_VERIFIED_MANUFACTURER` | One-time price id for Verified Manufacturer, 49900 cents USD. |
| `STRIPE_PRICE_FEATURED_EVENT` | One-time price id for Featured Event, 29900 cents USD. |
| `SITE_URL` | Absolute site origin for Checkout success and cancel URLs. Defaults to `https://transformerpath.com`. |
| `SUPABASE_URL` | Service-role client in `functions/lib/supabase-server.js`. |
| `SUPABASE_SECRET_KEY` | Service role key. `SUPABASE_SERVICE_ROLE_KEY` is accepted as an alias. |
| `RESEND_API_KEY` | Buyer confirmation and internal notice from the webhook. |
| `RESEND_FROM` | Verified sender, for example `TransformerPath <noreply@transformerpath.com>`. |
| `NOTIFY_TO` | Internal paid-listing notice. Defaults to `hello@transformerpath.com`. |

Engineer Payment Links on `pricing.html` are unchanged and do not use these price ids.

If `STRIPE_SECRET_KEY` or the price id is missing, `create-checkout` returns `503` with `{ "configured": false }`. The Pay button then follows the existing form or email path. It does not charge the card.

## Create the test products

Use a test-mode secret (`sk_test_`). Do not use a live key for these steps.

```bash
stripe products create --name "Verified Manufacturer" --description "12-month verified manufacturer listing. Badge after review."
stripe prices create --unit-amount 49900 --currency usd -d "product=prod_REPLACE"
stripe products create --name "Featured Event" --description "Featured label for one event. Label after review."
stripe prices create --unit-amount 29900 --currency usd -d "product=prod_REPLACE"
```

Put the two price ids in `STRIPE_PRICE_VERIFIED_MANUFACTURER` and `STRIPE_PRICE_FEATURED_EVENT`.

Checkout is `mode=payment` (one-time, not a subscription). Success URL:

`/pricing.html?session_id={CHECKOUT_SESSION_ID}&product=verified_manufacturer`

or `product=featured_event`. The host comes from `SITE_URL`.

## Webhook

Endpoint: `/.netlify/functions/stripe-webhook`

Local forward:

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

`stripe listen` prints a webhook signing secret. Put that value in `STRIPE_WEBHOOK_SECRET` for local runs. The Dashboard endpoint has a different secret; use that one in production.

Handled for these products: `checkout.session.completed`. The handler upserts `paid_listings` on `session_id` with status `paid_pending_verification`. Other event types return 200 so Stripe does not retry them. Engineer subscription, checkout, and refund handling is unchanged.

Apply `sql/paid_listings.sql` in the Supabase SQL editor once. Row Level Security is on. There is no anon or authenticated policy. Only the service role can read and write.

## Receipts

On `checkout.session.completed` the webhook sends:

- a buyer confirmation through Resend to the Checkout email
- an internal notice to `NOTIFY_TO`

Turn on Stripe email receipts as well: Dashboard → Settings → Customer emails → Successful payments. Resend does not replace the card receipt.

If `RESEND_API_KEY` is unset, the listing row is still stored and the webhook returns 200. A Resend provider error returns 500 so Stripe retries.

## Badge after review

Payment does not publish a badge and does not change capability, evidence, or ranking.

1. Confirm the Supabase row (`paid_pending_verification`).
2. Add a row to `data/paid-listings.json` with `status` `verified`, `reviewer`, `reviewed_at`, and `verification_evidence`, plus `company_slug` or `event_id`.
3. Redeploy. `build-paid-listings.js` sets `listing_tier` to `verified` and `verified` to `true` on that directory row only. Company pages render `VERIFIED MANUFACTURER` with the neutrality sentence from `data/commerce.json`. Event pages render `FEATURED`.

`check-paid-badges.js` fails the build if a badge or a verified directory flag appears without that reviewed row.

Example row (do not invent a real company):

```json
{
  "session_id": "cs_test_example",
  "product": "verified_manufacturer",
  "company_slug": "example-slug",
  "email": "buyer@example.com",
  "status": "verified",
  "reviewer": "name",
  "reviewed_at": "2026-10-14T09:00:00Z",
  "verification_evidence": "What was checked."
}
```

## Buttons

- Company profile claim area, `list-company.html`, and `claim-profile.html` after submit: **Pay $499 — Get Verified**
- Event pages, `sponsor.html`, and `pricing.html`: **Feature this event — $299**
- `pricing.html` also has the $499 manufacturer entry

## Go-live checklist

1. Create the two live products and prices in Stripe live mode. Amounts stay 49900 and 29900 USD, mode payment.
2. Replace the Netlify test values of `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_VERIFIED_MANUFACTURER`, and `STRIPE_PRICE_FEATURED_EVENT` with the live values. Do not commit them.
3. Point the live webhook at `https://transformerpath.com/.netlify/functions/stripe-webhook` for `checkout.session.completed`. Leave the existing engineer events subscribed if that endpoint already receives them.
4. Run `sql/paid_listings.sql` on the production Supabase project if it is not applied yet.
5. Set `RESEND_API_KEY`, `RESEND_FROM`, and `NOTIFY_TO`. Send one test-mode payment first and confirm both emails.
6. Turn on Stripe successful-payment email receipts.
7. Set `SITE_URL` to `https://transformerpath.com`.
8. Pay once in test mode, confirm the Supabase row is `paid_pending_verification`, confirm no badge, then add a reviewed `verified` row and confirm the badge on the next deploy.
9. Confirm a $199 engineer Payment Link still unlocks Learning and does not write `paid_listings`.
10. Switch the site to the live keys only after steps 1–9.

## Tests

```bash
node tests/paid-listings.test.js
node check-paid-badges.js
```

A real test-mode session, with no capture, when the test key and price id are set:

```bash
node tests/stripe-test-session.js verified_manufacturer
```

The script refuses a live key and prints the session id only.
