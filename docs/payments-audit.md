# Payments audit — transformerpath.com

Read-only check on 15 Oct 2026. Sitemap has 2,911 URLs. Checkout links were opened in Playwright and not paid. No card was charged.

Featured Exhibitor buttons were rechecked after they went live (the $399 href was not on the site at the first crawl, and was on production by the second). Hosted webinar was email-only on that second pass. This change wires the $1,500 Payment Link on pricing, webinars, and sponsor, and records `hosted_webinar` in the webhook. Production still needs a deploy before those buttons are live.

Production probes the same day:

- `GET /.netlify/functions/verify-access` → `{"configured":false,"reason":"STRIPE_SECRET_KEY not set"}`
- `GET /.netlify/functions/stripe-webhook` → `500 {"error":"webhook not configured"}` (`STRIPE_WEBHOOK_SECRET` unset)
- `POST /.netlify/functions/create-checkout` for Featured Event → `503` missing `STRIPE_SECRET_KEY` and `STRIPE_PRICE_FEATURED_EVENT`
- Same POST for Verified Manufacturer → `503` missing `STRIPE_SECRET_KEY` and `STRIPE_PRICE_VERIFIED_MANUFACTURER`
- Same POST for Featured Exhibitor → `503` missing `STRIPE_SECRET_KEY` and `STRIPE_PRICE_FEATURED_EXHIBITOR`

`data/paid-listings.json` has no reviewed rows, so no VERIFIED MANUFACTURER or FEATURED badge is published from payment.

## Table

| Offer | Price | Pages | Status | What's needed |
| --- | --- | --- | --- | --- |
| Learning | $199 / 12 months | [pricing](https://transformerpath.com/pricing.html). [learn](https://transformerpath.com/learn.html) and [engineer track](https://transformerpath.com/engineer-track.html) send people there. | Unavailable | Live buttons become “Unavailable — email us to unlock” because `verify-access` is not configured. The dormant link `https://buy.stripe.com/4gMbIU2lO5hj1NC5DcfYY03` opens **Subscribe to Transformerpath Learner, $199.00 per year** ($16.58/month, billed annually). The page says a single payment with no auto-renew. Set `STRIPE_SECRET_KEY`. Replace this link if the product must be one-time. |
| Professional | $599 / 12 months | [pricing](https://transformerpath.com/pricing.html) | Unavailable | Same gate. Dormant link `https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01` opens one-time **TransformerPath — Professional (Yearly Access) $599.00**. Amount matches. Unlock still needs `STRIPE_SECRET_KEY` and an after-payment redirect to `pricing.html?session_id={CHECKOUT_SESSION_ID}`. |
| Team | $1,999 / 12 months | [pricing](https://transformerpath.com/pricing.html). [teams](https://transformerpath.com/teams.html) is a separate empty checkout. | Unavailable | Dormant link `https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02` opens one-time **TransformerPath Enterprise $1,999.00**. Amount matches; the Stripe name says Enterprise. `teams.html` Team and Department buttons alert that checkout is not connected (`CHECKOUT.team` and `CHECKOUT.department` are empty). |
| Verified Manufacturer | $499 / 12 months | [pricing](https://transformerpath.com/pricing.html), [list-company](https://transformerpath.com/list-company.html), [claim-profile](https://transformerpath.com/claim-profile.html), [manufacturers](https://transformerpath.com/manufacturers.html), 914 manufacturer profiles. Buttons: “Pay $499 — Get Verified”, “Get verified”, “Claim this profile”. | WORKS | `https://buy.stripe.com/4gMbIU7G8bFHak8d5EfYY05` opens **$499.00**. Stripe product title is the generic “TransformerPath”. [verified](https://transformerpath.com/verified.html) “Get Verified” is mailto. The list-company tier card says “Contact us” next to the $499 pay button. |
| Supplier Pro | $1,499 / 12 months | [pricing](https://transformerpath.com/pricing.html) “Explore Supplier Pro” → [for-manufacturers](https://transformerpath.com/for-manufacturers.html) enquiry. [verified](https://transformerpath.com/verified.html) mailto. Claim form has a Supplier Pro option and no pay button. | MAILTO/CONTACT ONLY | No Payment Link. `price_status` is TARGET. RFQ inbox, lead export, and the analytics dashboard are not in the product. Create the $1,499 link only after the inbox exists. |
| Founding Verified | $199 first year | Mentioned on [verified](https://transformerpath.com/verified.html). No button. | NO LINK | Copy only. |
| Intel Pro | $499 / 12 months, or $49/month | [pricing](https://transformerpath.com/pricing.html) “Explore Intel Pro” → [intel](https://transformerpath.com/intel.html). [intel-pro](https://transformerpath.com/intel-pro.html) “Create a free account” → [workspace](https://transformerpath.com/workspace.html). | NO LINK | TARGET price. Free watchlists are localStorage, capped at 40, and point at Intel Pro for shared lists. Real-time tender alerts, shared watchlists, and exports are not delivered. `entitlement.js` has no Intel Pro plan. |
| Intel Team | $1,999 / 12 months | [pricing](https://transformerpath.com/pricing.html) “Contact Procurement Sales” → [contact](https://transformerpath.com/contact.html) | MAILTO/CONTACT ONLY | TARGET. No checkout. Shared watchlists and CSV/JSON exports are not built. |
| Featured Event | $299 / event | [pricing](https://transformerpath.com/pricing.html), [events](https://transformerpath.com/events.html), [sponsor](https://transformerpath.com/sponsor.html) Event Spotlight, 529 event pages. Button: “Feature this event — $299”. | WORKS | `https://buy.stripe.com/00w6oA2lO8tvdwkaXwfYY04` opens **$299.00**. Stripe title is generic “TransformerPath”. Event pages put “from $399” on the same card as this $299 button. |
| Featured Exhibitor | $399 / event | [pricing](https://transformerpath.com/pricing.html), [events](https://transformerpath.com/events.html), [exhibitions](https://transformerpath.com/exhibitions.html), [sponsor](https://transformerpath.com/sponsor.html), and event pages (529). Buttons: “Feature your exhibitor — $399”, “Featured Exhibitor · $399”, “Feature your company — $399”. | WORKS | `https://buy.stripe.com/dRm9AM5y06ln1NC9TsfYY06` opens **Featured exhibitor, $399** at **$399.00**. Return URL is `sponsor.html?paid=featured_exhibitor&session_id=…#contact`. The banner shows for any session id and does not ask Stripe. Webhook code can store `featured_exhibitor`, but `STRIPE_WEBHOOK_SECRET` is unset, so nothing is recorded. There is no renderer that turns a reviewed exhibitor row into a FEATURED card. |
| Hosted webinar | $1,500 | [pricing](https://transformerpath.com/pricing.html), [webinars](https://transformerpath.com/webinars.html) “Host a webinar · from $1,500”, [sponsor#hosted-webinar](https://transformerpath.com/sponsor.html#hosted-webinar) “Host a webinar — $1,500”. | WIRED | `https://buy.stripe.com/14A3co8Kc6ln77Wc1AfYY07` opens **Hosted webinar $1,500.00**. Return URL is `sponsor.html?paid=hosted_webinar&session_id=…#contact`. Webhook code stores `hosted_webinar` as `paid_pending_verification`. `STRIPE_WEBHOOK_SECRET` is unset, so nothing is recorded until that secret is set. A reviewed row does not publish a public card. |
| Sponsorship | from $299 | [sponsor](https://transformerpath.com/sponsor.html) “Request the Media Kit” mailto, plus the enquiry form. Event Spotlight reuses the $299 Featured Event link. Daily brief, category, article, and knowledge partner have no price and no checkout. | MAILTO/CONTACT ONLY, except Event Spotlight | Individual package links do not exist. The unpublished `transformerpath/sponsor.html` catalog ($2,500, $1,200, $999, $2,499) is not on the sitemap and is not the live page. |
| Books | $49 digital, about $99 print, $79 digital pair, about $169 printed library | [books](https://transformerpath.com/books.html) | MAILTO | `data/config.json` `bookStripeLinks` are all `REPLACE_WITH_STRIPE_LINK`. Live buttons mailto `hello@transformerpath.com`. Eight links still to create. |
| Team / Department seats | No dollar amount on the cards (“12 months access”) | [teams](https://transformerpath.com/teams.html) “Enrol your team” | BROKEN | Click shows “Checkout isn’t connected yet.” Enterprise is “Email us”. |
| Legacy course link | $100 on Stripe; not shown on the live site | Only `transformerpath/learn.html`, which is not in the sitemap. Live learn page points at pricing. | MISMATCH if reused | `https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00` charges **$100.00** (“Transformerpath Subscription”). Do not attach it. Learning is advertised at $199. |

There is no `advertise.html`. Advertise is [sponsor](https://transformerpath.com/sponsor.html). [exhibitions](https://transformerpath.com/exhibitions.html) and [directory](https://transformerpath.com/directory.html) have no buy button. [rfq](https://transformerpath.com/rfq.html) is a public buyer board, not a paid inbox.

## What is actually delivered after payment

**Learning, Professional, Team.** Paid masterclass chapters are served only by `functions/masterclass-content.js` with an entitlement token from `verify-access`. That function cannot issue a token today because `STRIPE_SECRET_KEY` is unset, and the pricing buttons never open Checkout. Professional extras named on the pricing page (costing workbench, specification builder, bid evaluation, DGA workspace) are not a separate gated product. Workspace links to the public calculator.

**Verified Manufacturer.** The claim form at `claim-profile.html?paid=verified_manufacturer&session_id=…` shows “Payment received” and stores the session id. That banner does not ask Stripe whether the session was paid; any query string trips it. The Netlify form can be submitted. The badge is not automatic: `lib/paid-listings.js` renders it only from a reviewed row, and `data/paid-listings.json` is empty. The webhook that would write `paid_pending_verification` is not configured.

**Featured Event.** `events.html?paid=featured_event` shows the submit-event note and stores the session id, again without checking Stripe. The FEATURED label needs the same empty review file. Webhook unconfigured.

**Intel Pro.** Not for sale. The free watchlist is browser storage. `functions/watchlist-alerts.js` is a GCC email digest, not a paid real-time alert. No export endpoint is gated on Intel Pro.

**Supplier Pro.** Not for sale. No RFQ inbox, lead-status board, or CSV/JSON lead export exists. The pricing “proof” block is labeled an illustrative composite.

**Featured Exhibitor.** The $399 button is live and opens the matching Checkout. `sponsor.html?paid=featured_exhibitor&session_id=cs_test_audit_do_not_pay` shows “Payment received. Submit your company and the event below.” and stores that session id without checking Stripe. The enquiry form is the existing Netlify `sponsor-enquiry` form. `functions/stripe-webhook.js` includes `featured_exhibitor` in `PAID_LISTING_PRODUCTS`, so a configured webhook would write `paid_pending_verification`. It cannot do that today. `lib/paid-listings.js` renders a public FEATURED badge for `featured_event` only. A reviewed `featured_exhibitor` row does not draw a logo, booth, or FEATURED card.

**Hosted webinar.** Pricing, webinars, and sponsor point at the $1,500 Payment Link. `sponsor.html?paid=hosted_webinar&session_id=cs_test_audit_do_not_pay` shows “Payment received. Submit the webinar topic, date, and company below.” and stores that session id without checking Stripe. The enquiry form is the existing Netlify `sponsor-enquiry` form. `functions/stripe-webhook.js` includes `hosted_webinar` in `PAID_LISTING_PRODUCTS`, so a configured webhook would write `paid_pending_verification`. It cannot do that today. There is no public webinar card renderer.

## Stripe links still to create

Already live and amount-checked:

- Featured Exhibitor $399 — `https://buy.stripe.com/dRm9AM5y06ln1NC9TsfYY06` (on pricing, events, exhibitions, sponsor, and event pages)
- Hosted webinar $1,500 — `https://buy.stripe.com/14A3co8Kc6ln77Wc1AfYY07` (wired on pricing, webinars, and sponsor; opens $1,500)
- Verified Manufacturer $499 and Featured Event $299 — already on the site and opening the right amounts
- Professional $599 and Team $1,999 — right amounts, buttons held back until `STRIPE_SECRET_KEY` is set
- Learning — current link is a $199/year **subscription**, not the one-time payment the page describes

Still missing:

- Supplier Pro $1,499
- Intel Pro $499 (and $49/month if that price is sold)
- Intel Team $1,999
- Founding Verified $199
- Book links for all eight `bookStripeLinks` keys
- Team and Department seat links for `teams.html`
- Sponsorship packages other than the $299 Featured Event (daily brief, category, article, knowledge partner)

Do not reuse `https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00`. It charges $100.

## Env vars

Set on Netlify, not in the repo:

| Name | State on 15 Oct 2026 |
| --- | --- |
| `STRIPE_SECRET_KEY` | Missing. Confirmed by `verify-access` and `create-checkout`. |
| `STRIPE_WEBHOOK_SECRET` | Missing. Confirmed by `stripe-webhook`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for `paid_listings` and entitlement writes (`functions/lib/supabase-server.js` also accepts `SUPABASE_SECRET_KEY`). Not observable from outside: the webhook returns before it opens Supabase. |
| `STRIPE_PRICE_VERIFIED_MANUFACTURER` | Missing. Named in the create-checkout 503. |
| `STRIPE_PRICE_FEATURED_EVENT` | Missing. Named in the create-checkout 503. |
| `STRIPE_PRICE_FEATURED_EXHIBITOR` | Missing. Named in the create-checkout 503 for `featured_exhibitor`. |
| `STRIPE_PRICE_HOSTED_WEBINAR` | Missing until set. `create-checkout` for `hosted_webinar` names it in the 503. The Pay button does not need it. |
| `STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR` | Optional exact `plink_` matcher. |
| `STRIPE_PAYMENT_LINK_HOSTED_WEBINAR` | Optional exact `plink_` matcher. |
| `SUPABASE_URL` | Required with the service role key. Not probed. |
| `STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER`, `STRIPE_PAYMENT_LINK_FEATURED_EVENT` | Optional exact `plink_` matchers. |
| `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFY_TO` | Receipts. Listing row can still be stored without Resend; a provider error returns 500. |
| `SITE_URL` | Defaults to `https://transformerpath.com`. |

After the secret key is set, each engineer Payment Link’s after-payment URL must be `https://transformerpath.com/pricing.html?session_id={CHECKOUT_SESSION_ID}` so `course-gate.js` can call `verify-access`. Verified Manufacturer should return to `claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}#claimForm`. Featured Event should return to `events.html?paid=featured_event&session_id={CHECKOUT_SESSION_ID}#submit-event`. Featured Exhibitor and Hosted Webinar should return to `sponsor.html?paid=featured_exhibitor&session_id={CHECKOUT_SESSION_ID}#contact` and `sponsor.html?paid=hosted_webinar&session_id={CHECKOUT_SESSION_ID}#contact`.
