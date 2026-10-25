# Payments — Verified Manufacturer and Featured Event

Stripe test mode until the go-live checklist is done. Never commit secret keys, webhook secrets, or price ids that are not public.

This file names the environment variables the owner sets in Netlify. It does not contain values.

## Environment variables

Set these on the Netlify site (Site → Environment variables). Server-only. Do not put them in browser code.

| Name | Used by |
| --- | --- |
| `STRIPE_SECRET_KEY` | `functions/create-checkout.js`, `functions/verify-access.js`, `functions/entitle.js`. Test mode: a key that starts with `sk_test_`. |
| `STRIPE_WEBHOOK_SECRET` | `functions/stripe-webhook.js` signature check. From `stripe listen` or the Dashboard endpoint. |
| `STRIPE_PRICE_VERIFIED_MANUFACTURER` | One-time price id for Verified Manufacturer, 49900 cents USD. |
| `STRIPE_PRICE_FEATURED_EVENT` | One-time price id for Featured Event, 29900 cents USD. Used only if Checkout is created through `create-checkout`. The Pay button uses the Payment Link below. |
| `STRIPE_PRICE_FEATURED_EXHIBITOR` | One-time price id for Featured Exhibitor, 39900 cents USD. Used only if Checkout is created through `create-checkout`. The Pay button uses the Payment Link below. |
| `STRIPE_PRICE_HOSTED_WEBINAR` | One-time price id for Hosted Webinar, 150000 cents USD. Used only if Checkout is created through `create-checkout`. The Pay button uses the Payment Link below. |
| `STRIPE_PAYMENT_LINK_FEATURED_EVENT` | Optional. The `plink_…` id of the Featured Event Payment Link. When set, the webhook matches that id. Amount is not a match. |
| `STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR` | Optional. The `plink_…` id of the Featured Exhibitor Payment Link. When set, the webhook matches that id. Amount is not a match. |
| `STRIPE_PAYMENT_LINK_HOSTED_WEBINAR` | Optional. The `plink_…` id of the Hosted Webinar Payment Link. When set, the webhook matches that id. Amount is not a match. |
| `STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER` | Optional. The `plink_…` id of the Verified Manufacturer Payment Link. When set, the webhook matches that id. Amount is not a match. |
| `STRIPE_PAYMENT_LINK_LEARNING` | Optional extra `plink_…` id. The live one-time Learning Payment Link is `https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p` (`plink_1UQhha2YHcFlJstOHjvZv5V0`, metadata `product=learning`). The inactive yearly code `4gMbIU2lO5hj1NC5DcfYY03` is not a match. Amount is not a match. |
| `STRIPE_PAYMENT_LINK_PROFESSIONAL` | Optional extra `plink_…` id for Engineering Pro. The live link code is `fZu00c3pScJL1NC3v4fYY01` (`https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01`). Amount is not a match. |
| `STRIPE_PAYMENT_LINK_TEAM` | Optional extra `plink_…` id for Engineering Team. The live link code is `aFacMY6C4aBD2RG2r0fYY02` (`https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02`). Amount is not a match. |
| `SITE_URL` | Absolute site origin for Checkout success and cancel URLs. Defaults to `https://transformerpath.com`. |
| `SUPABASE_URL` | Service-role client in `functions/lib/supabase-server.js`. |
| `SUPABASE_SECRET_KEY` | Service role key. `SUPABASE_SERVICE_ROLE_KEY` is accepted as an alias. |
| `RESEND_API_KEY` | Buyer confirmation and internal notice from the webhook. |
| `RESEND_FROM` | Verified sender, for example `TransformerPath <noreply@transformerpath.com>`. |
| `NOTIFY_TO` | Internal paid-listing notice. Defaults to `hello@transformerpath.com`. |
| `VERIFIED_REVIEW_TOKEN` | Server-only token for `functions/verified-review.js` and `functions/verified-revenue.js`. At least 24 characters. Never put it in a page or a commit. If it is unset, both functions return `503` and change nothing. |
| `TP_VERIFIED_SERVER` | Set to `1` to turn on claim, review, revenue, the customer dashboard, reminders, the abandoned-checkout webhook branch, listing-refund updates, and the Verified Manufacturer row in `entitle.js`. Unset or any other value leaves those paths off, even when the Stripe and Netlify secrets below are already set. The public Payment Link does not read this flag. |

Engineer Payment Links on `pricing.html` are unchanged and do not use these price ids.

If `STRIPE_SECRET_KEY` or the price id is missing, `create-checkout` returns `503` with `{ "configured": false }`. The Pay button then follows the existing form or email path. It does not charge the card.

## Create the test products

Use a test-mode secret (`sk_test_`). Do not use a live key for these steps.

```bash
stripe products create --name "Verified Manufacturer" --description "One-time verified manufacturer listing. Badge after review. Identity and contact details checked. Not a product certification."
stripe prices create --unit-amount 49900 --currency usd -d "product=prod_REPLACE"
stripe products create --name "Featured Event" --description "Featured label for one event. Label after review."
stripe prices create --unit-amount 29900 --currency usd -d "product=prod_REPLACE"
stripe products create --name "Featured Exhibitor" --description "Featured exhibitor card for one event. Label after review."
stripe prices create --unit-amount 39900 --currency usd -d "product=prod_REPLACE"
stripe products create --name "Hosted Webinar" --description "Hosted technical webinar. Scheduled after review."
stripe prices create --unit-amount 150000 --currency usd -d "product=prod_REPLACE"
```

Put the price ids in `STRIPE_PRICE_VERIFIED_MANUFACTURER`, `STRIPE_PRICE_FEATURED_EVENT`, `STRIPE_PRICE_FEATURED_EXHIBITOR`, and `STRIPE_PRICE_HOSTED_WEBINAR`.

Checkout is `mode=payment` (one-time, not a subscription).

The Pay buttons read one config object, `PAYMENT_LINKS` in `lib/paid-listings.js`. That object is the only copy of these URLs in JavaScript.

Verified Manufacturer (`PAYMENT_LINKS.verified_manufacturer.url`):

`https://buy.stripe.com/4gMbIU7G8bFHak8d5EfYY05`

`list-company.html`, `claim-profile.html`, `pricing.html`, and each manufacturer profile's **Pay $499 one-time — Get Verified** button use that URL. A profile button adds `?client_reference_id=` set to the directory slug so the webhook can store `company_slug`.

After payment, the buyer must land on the claim form and submit company details. In the Stripe Dashboard, open this Payment Link → After payment → Redirect to:

`https://transformerpath.com/claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}#claimForm`

`{CHECKOUT_SESSION_ID}` must stay as that placeholder. The form is the existing `claim-profile` form (`#claimForm` on `claim-profile.html`). The page shows a banner that the VERIFIED MANUFACTURER badge appears only after manual review. `create-checkout` uses the same path from `PAYMENT_LINKS.verified_manufacturer.successPath`.

Featured Event (`PAYMENT_LINKS.featured_event.url`, also `FEATURED_EVENT_PAYMENT_LINK`):

`https://buy.stripe.com/00w6oA2lO8tvdwkaXwfYY04`

Event pages, `events.html`, and `pricing.html` point their Featured Event button at it.

After payment, the buyer must land on the events list form and submit the event name, official URL, and dates. In the Stripe Dashboard, open this Payment Link → After payment → Redirect to:

`https://transformerpath.com/events.html?paid=featured_event&session_id={CHECKOUT_SESSION_ID}#submit-event`

`{CHECKOUT_SESSION_ID}` must stay as that placeholder. The host comes from `SITE_URL` when `create-checkout` builds the same path. The form is the existing `sponsor-enquiry` form (`#submit-event` on `events.html`, and the same event name, URL, and dates fields on `sponsor.html`).

The Payment Link does not carry an event id. The webhook stores a pending slot with `event_id` empty until a reviewer connects the form to that payment. The public FEATURED label is still only the reviewed row in `data/paid-listings.json`.

Featured Exhibitor (`PAYMENT_LINKS.featured_exhibitor.url`, also `FEATURED_EXHIBITOR_PAYMENT_LINK`):

`https://buy.stripe.com/dRm9AM5y06ln1NC9TsfYY06`

`pricing.html`, `events.html`, `exhibitions.html`, `sponsor.html`, and each event page point their **Feature your exhibitor — $399** button at it. `data/commerce.json` stores the same URL on the `featured_exhibitor` product as `payment_link`.

After payment, the buyer must land on the exhibitor enquiry and submit the company and event. In the Stripe Dashboard, open this Payment Link → After payment → Redirect to:

`https://transformerpath.com/sponsor.html?paid=featured_exhibitor&session_id={CHECKOUT_SESSION_ID}#contact`

`{CHECKOUT_SESSION_ID}` must stay as that placeholder. The form is the existing `sponsor-enquiry` form (`#contact` on `sponsor.html`). The page shows a banner that the FEATURED label appears only after manual review. `create-checkout` uses the same path from `PAYMENT_LINKS.featured_exhibitor.successPath`.

The Payment Link does not carry an event id. The webhook stores a pending exhibitor slot with `event_id` empty until a reviewer connects the form to that payment. It does not render FEATURED.

Hosted Webinar (`PAYMENT_LINKS.hosted_webinar.url`, also `HOSTED_WEBINAR_PAYMENT_LINK`):

`https://buy.stripe.com/14A3co8Kc6ln77Wc1AfYY07`

`pricing.html`, `webinars.html`, and `sponsor.html` point their **Host a webinar — $1,500** button at it (the webinars list labels it **Host a webinar · from $1,500**). `data/commerce.json` stores the same URL on the `hosted_webinar` product as `payment_link`.

After payment, the buyer must land on the sponsor enquiry and submit the webinar topic, date, and company. In the Stripe Dashboard, open this Payment Link → After payment → Redirect to:

`https://transformerpath.com/sponsor.html?paid=hosted_webinar&session_id={CHECKOUT_SESSION_ID}#contact`

`{CHECKOUT_SESSION_ID}` must stay as that placeholder. The form is the existing `sponsor-enquiry` form (`#contact` on `sponsor.html`). The page shows a banner that the session is scheduled only after review. `create-checkout` uses the same path from `PAYMENT_LINKS.hosted_webinar.successPath`.

The Payment Link does not require an event id. The webhook stores a pending webinar slot. It does not publish a session.

## Webhook

Endpoint: `/.netlify/functions/stripe-webhook`

Local forward:

```bash
stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
```

`stripe listen` prints a webhook signing secret. Put that value in `STRIPE_WEBHOOK_SECRET` for local runs. The Dashboard endpoint has a different secret; use that one in production.

Handled for these products: `checkout.session.completed`. The handler upserts `paid_listings` on `session_id` with status `paid_pending_verification`. A Featured Event Payment Link session matches when `metadata.product` is `featured_event`, when `success_url` contains `paid=featured_event`, when the buy.stripe.com code is on the session, or when `payment_link` equals `STRIPE_PAYMENT_LINK_FEATURED_EVENT`. The charged amount is not a match. The row stays `paid_pending_verification` with no event id. It does not render FEATURED.

A Featured Exhibitor Payment Link session matches the same way for `featured_exhibitor`: `metadata.product`, `success_url` containing `paid=featured_exhibitor`, the buy.stripe.com code, or `STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR`. The row stays `paid_pending_verification`. It does not render FEATURED. `verify-access` does not grant a course token for that session.

A Hosted Webinar Payment Link session matches the same way for `hosted_webinar`: `metadata.product`, `success_url` containing `paid=hosted_webinar`, the buy.stripe.com code, or `STRIPE_PAYMENT_LINK_HOSTED_WEBINAR`. The row stays `paid_pending_verification`. It does not publish a session. `verify-access` does not grant a course token for that session.

A Verified Manufacturer Payment Link session matches the same way for `verified_manufacturer`: `metadata.product`, `success_url` containing `paid=verified_manufacturer`, the buy.stripe.com code, or `STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER`. `company_slug` comes from metadata or from `client_reference_id` when that value is a directory slug. The row stays `paid_pending_verification`. It does not render VERIFIED MANUFACTURER. `verify-access` does not grant a course token for that session.

Other event types return 200 so Stripe does not retry them. Engineer checkout follows `lib/course-payment.js`: metadata (`product`, `plan`, or `tier`, including `engineering_pro` and `engineering_team`), `payment_link` equal to the known Learning id `plink_1UQhha2YHcFlJstOHjvZv5V0` or to `STRIPE_PAYMENT_LINK_LEARNING`, `STRIPE_PAYMENT_LINK_PROFESSIONAL`, or `STRIPE_PAYMENT_LINK_TEAM`, or the buy.stripe.com code on the session (`8x27sE3pS4dfak8c1AfYY0p`, `fZu00c3pScJL1NC3v4fYY01`, `aFacMY6C4aBD2RG2r0fYY02`). The inactive yearly code `4gMbIU2lO5hj1NC5DcfYY03` does not match. `verify-access` and `entitle` retrieve the session with `expand[]=payment_link`, because a completed session leaves `url` empty and puts that code on the Payment Link object. A $199 charge with none of those identifiers does not become Learning and does not write `paid_listings`. A $299 charge with none of the Featured Event identifiers does not become Featured Event.

Apply `supabase/migrations/20261016150000_payments_tables.sql` in the Supabase SQL editor once (`docs/supabase-apply.md`). Row Level Security is on. Authenticated users can read their own entitlement rows. `paid_listings` and `webhook_events` have no anon or authenticated policy. Only the service role can write.

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

- `list-company.html`, `claim-profile.html`, `pricing.html`, and each manufacturer profile: **Pay $499 one-time — Get Verified**, linking to `PAYMENT_LINKS.verified_manufacturer.url`. After payment the buyer submits company details on the claim form.
- Event pages, `events.html` (the list and submission form), `pricing.html`, and `sponsor.html`: **Feature this event — $299**, linking to `PAYMENT_LINKS.featured_event.url`
- `pricing.html`, `events.html`, `exhibitions.html`, `sponsor.html`, and each event page: **Feature your exhibitor — $399** (the events list labels it **Featured Exhibitor · $399**), linking to `PAYMENT_LINKS.featured_exhibitor.url`. After payment the buyer submits company and event details on the exhibitor form.
- `pricing.html`, `webinars.html`, and `sponsor.html`: **Host a webinar — $1,500** (the webinars list labels it **Host a webinar · from $1,500**), linking to `PAYMENT_LINKS.hosted_webinar.url`. After payment the buyer submits the topic, date, and company on the sponsor form.

## Go-live checklist

1. Create the live products and prices in Stripe live mode. Amounts stay 49900, 39900, 29900, and 150000 USD, mode payment.
2. Replace the Netlify test values of `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_VERIFIED_MANUFACTURER`, `STRIPE_PRICE_FEATURED_EVENT`, `STRIPE_PRICE_FEATURED_EXHIBITOR`, and `STRIPE_PRICE_HOSTED_WEBINAR` with the live values. Do not commit them.
3. Point the live webhook at `https://transformerpath.com/.netlify/functions/stripe-webhook` for `checkout.session.completed`. Leave the existing engineer events subscribed if that endpoint already receives them.
4. On the live Featured Event Payment Link, set After payment to `https://transformerpath.com/events.html?paid=featured_event&session_id={CHECKOUT_SESSION_ID}#submit-event`. If the Dashboard shows a `plink_` id, put it in `STRIPE_PAYMENT_LINK_FEATURED_EVENT`.
5. On the live Featured Exhibitor Payment Link, set After payment to `https://transformerpath.com/sponsor.html?paid=featured_exhibitor&session_id={CHECKOUT_SESSION_ID}#contact`. If the Dashboard shows a `plink_` id, put it in `STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR`.
6. On the live Hosted Webinar Payment Link, set After payment to `https://transformerpath.com/sponsor.html?paid=hosted_webinar&session_id={CHECKOUT_SESSION_ID}#contact`. If the Dashboard shows a `plink_` id, put it in `STRIPE_PAYMENT_LINK_HOSTED_WEBINAR`.
7. On the live Verified Manufacturer Payment Link, set After payment to `https://transformerpath.com/claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}#claimForm`. If the Dashboard shows a `plink_` id, put it in `STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER`.
8. Run `supabase/migrations/20261016150000_payments_tables.sql` on the production Supabase project if it is not applied yet (`docs/supabase-apply.md`).
9. Set `RESEND_API_KEY`, `RESEND_FROM`, and `NOTIFY_TO`. Send one test-mode payment first and confirm both emails.
10. Turn on Stripe successful-payment email receipts.
11. Set `SITE_URL` to `https://transformerpath.com`.
12. Pay once in test mode, confirm the Supabase row is `paid_pending_verification`, confirm no badge, then add a reviewed `verified` row and confirm the badge on the next deploy.
13. Confirm a $199 engineer Payment Link still unlocks Learning and does not write `paid_listings`.
14. Switch the site to the live keys only after the steps above.

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
