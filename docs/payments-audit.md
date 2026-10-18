# Payments audit — transformerpath.com

Read-only check on 15 Oct 2026. Sitemap has 2,911 URLs. Checkout links were opened in Playwright and not paid. No card was charged.

Featured Exhibitor buttons were rechecked after they went live (the $399 href was not on the site at the first crawl, and was on production by the second). The $1,500 hosted-webinar offer was later withdrawn from the site. It is not in `PAYMENT_LINKS` and no page links it. Stripe itself was not edited. Webhook classification still recognizes the old buy.stripe.com code so a past payment is not read as a course.

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
| Learning | $199 one-time | [pricing](https://transformerpath.com/pricing.html). [learn](https://transformerpath.com/learn.html) and [engineer track](https://transformerpath.com/engineer-track.html) send people there. | WORKS as a Payment Link | Button opens `https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p` (`plink_1UQhha2YHcFlJstOHjvZv5V0`, metadata `product=learning`) even when `verify-access` is not configured. The inactive yearly code `4gMbIU2lO5hj1NC5DcfYY03` is not used. Granting access on return still needs `STRIPE_SECRET_KEY`. Classified by link id or metadata, not by the $199 amount. |
| Engineering Pro | $599 one-time | [pricing](https://transformerpath.com/pricing.html) | WORKS as a Payment Link | Button opens `https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01` even when `verify-access` is not configured. Unlock on return still needs `STRIPE_SECRET_KEY` and `pricing.html?session_id={CHECKOUT_SESSION_ID}`. |
| Engineering Team | $1,999 one-time | [pricing](https://transformerpath.com/pricing.html). [teams](https://transformerpath.com/teams.html) is a separate empty checkout. | WORKS as a Payment Link | Button opens `https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02`. `teams.html` Team and Department buttons still alert that checkout is not connected (`CHECKOUT.team` and `CHECKOUT.department` are empty). |
| Verified Manufacturer | $499 / 12 months | [pricing](https://transformerpath.com/pricing.html), [verified](https://transformerpath.com/verified.html), [list-company](https://transformerpath.com/list-company.html), [claim-profile](https://transformerpath.com/claim-profile.html), [manufacturers](https://transformerpath.com/manufacturers.html), manufacturer profiles. Buttons: “Pay $499 — Get Verified”, “Get verified”, “Claim this profile”. | WORKS | `https://buy.stripe.com/4gMbIU7G8bFHak8d5EfYY05` opens **$499.00**. Stripe product name is Verified Manufacturer (12 months). The list-company tier card says “Contact us” next to the $499 pay button. |
| Supplier Pro | No public price | [pricing](https://transformerpath.com/pricing.html) and [verified](https://transformerpath.com/verified.html) say there is no checkout yet. | NOT FOR SALE | No Payment Link and no contact button. Create a link only after the inbox exists. |
| Verified Manufacturer founding offer | $199 first year, Coming soon | [verified](https://transformerpath.com/verified.html), under the same name as the $499 plan. | COMING SOON | Same review and VERIFIED badge as Verified Manufacturer, for the first 50–100 companies, first year. Logo, catalogue PDF link and photo gallery are included at no extra charge. Does not include Supplier Pro, a featured map pin, RFQ routing, or analytics. RFQ routing is coming soon. No checkout. |
| Intel Pro | $499 / 12 months | [pricing](https://transformerpath.com/pricing.html) and [intel-pro](https://transformerpath.com/intel-pro.html). No contact button. | NO LINK | No checkout and no monthly price. The $499 amount is unchanged. Real-time tender alerts, shared watchlists, and exports are not delivered. |
| Intel Team | No public price | [pricing](https://transformerpath.com/pricing.html) says no checkout yet. | NOT FOR SALE | No checkout. Shared watchlists and CSV/JSON exports are not built. |
| Featured Event | $299 / event | [pricing](https://transformerpath.com/pricing.html), [events](https://transformerpath.com/events.html), [sponsor](https://transformerpath.com/sponsor.html) Event Spotlight, 529 event pages. Button: “Feature this event — $299”. | WORKS | `https://buy.stripe.com/00w6oA2lO8tvdwkaXwfYY04` opens **$299.00**. Stripe title is generic “TransformerPath”. Event pages put “from $399” on the same card as this $299 button. |
| Featured Exhibitor | $399 / event | [pricing](https://transformerpath.com/pricing.html), [events](https://transformerpath.com/events.html), [exhibitions](https://transformerpath.com/exhibitions.html), [sponsor](https://transformerpath.com/sponsor.html), and event pages (529). Buttons: “Feature your exhibitor — $399”, “Featured Exhibitor · $399”, “Feature your company — $399”. | WORKS | `https://buy.stripe.com/dRm9AM5y06ln1NC9TsfYY06` opens **Featured exhibitor, $399** at **$399.00**. Return URL is `sponsor.html?paid=featured_exhibitor&session_id=…#contact`. The banner shows for any session id and does not ask Stripe. Webhook code can store `featured_exhibitor`, but `STRIPE_WEBHOOK_SECRET` is unset, so nothing is recorded. There is no renderer that turns a reviewed exhibitor row into a FEATURED card. |
| Hosted webinar | $1,500 | Not offered. Removed from pricing, webinars, sponsor, events, and exhibitor pages. | WITHDRAWN | Not in `PAYMENT_LINKS`. The old Payment Link is not linked from the site. Recognition of that buy.stripe.com code stays in `isHostedWebinarCheckout` so Stripe retries are not treated as course access. |
| Sponsorship | Featured Event $299 and Featured Exhibitor $399 | [sponsor](https://transformerpath.com/sponsor.html) keeps those two checkouts. The media kit, daily brief, category, article, and knowledge-partner offers are removed. | SELF-SERVE LISTINGS ONLY | The unpublished `transformerpath/sponsor.html` catalog is not the live page. |
| Books | $49 digital, about $99 print, $79 digital pair, about $169 printed library | [books](https://transformerpath.com/books.html) | MAILTO | `data/config.json` `bookStripeLinks` are all `REPLACE_WITH_STRIPE_LINK`. Live buttons mailto `hello@transformerpath.com`. Eight links still to create. |
| Team / Department seats | No dollar amount on the cards (“12 months access”) | [teams](https://transformerpath.com/teams.html) “Enrol your team” | BROKEN | Click shows “Checkout isn’t connected yet.” Enterprise is “Email us”. |
| Legacy course link | $100 on Stripe; not shown on the live site | Only `transformerpath/learn.html`, which is not in the sitemap. Live learn page points at pricing. | MISMATCH if reused | `https://buy.stripe.com/5kQ00c3pS8tv9g4fdMfYY00` charges **$100.00** (“Transformerpath Subscription”). Do not attach it. Learning is advertised at $199. |

There is no `advertise.html`. Advertise is [sponsor](https://transformerpath.com/sponsor.html). [exhibitions](https://transformerpath.com/exhibitions.html) and [directory](https://transformerpath.com/directory.html) have no buy button. [rfq](https://transformerpath.com/rfq.html) is a public buyer board, not a paid inbox.

## What is actually delivered after payment

**Learning, Professional, Team.** Paid masterclass chapters are served only by `functions/masterclass-content.js` with an entitlement token from `verify-access`. That function cannot issue a token today because `STRIPE_SECRET_KEY` is unset, and the pricing buttons never open Checkout. Professional extras named on the pricing page (costing workbench, specification builder, bid evaluation, DGA workspace) are not a separate gated product. Workspace links to the public calculator.

**Verified Manufacturer.** The claim form at `claim-profile.html?paid=verified_manufacturer&session_id=…` shows “Payment received” and stores the session id. That banner does not ask Stripe whether the session was paid; any query string trips it. The Netlify form can be submitted. The badge is not automatic: `lib/paid-listings.js` renders it only from a reviewed row, and `data/paid-listings.json` is empty. The webhook that would write `paid_pending_verification` is not configured.

**Featured Event.** `events.html?paid=featured_event` shows the submit-event note and stores the session id, again without checking Stripe. The FEATURED label needs the same empty review file. Webhook unconfigured.

**Intel Pro.** Listed at $499 for 12 months. There is no checkout, no monthly price, and no contact button. The free watchlist is browser storage. `functions/watchlist-alerts.js` is a GCC email digest, not a paid real-time alert. No export endpoint is gated on Intel Pro.

**Supplier Pro.** Not for sale. No RFQ inbox, lead-status board, or CSV/JSON lead export exists. The pricing “proof” block is labeled an illustrative composite.

**Featured Exhibitor.** The $399 button is live and opens the matching Checkout. `sponsor.html?paid=featured_exhibitor&session_id=cs_test_audit_do_not_pay` shows “Payment received. Submit your company and the event below.” and stores that session id without checking Stripe. The enquiry form is the existing Netlify `sponsor-enquiry` form. `functions/stripe-webhook.js` includes `featured_exhibitor` in `PAID_LISTING_PRODUCTS`, so a configured webhook would write `paid_pending_verification`. It cannot do that today. `lib/paid-listings.js` renders a public FEATURED badge for `featured_event` only. A reviewed `featured_exhibitor` row does not draw a logo, booth, or FEATURED card.

**Hosted webinar.** Withdrawn from the public site. `sponsor.html` no longer has a hosted-webinar card or a `paid=hosted_webinar` return. `functions/stripe-webhook.js` still lists `hosted_webinar` in `PAID_LISTING_PRODUCTS` so an old Payment Link is stored as `paid_pending_verification` instead of a course entitlement. The buyer receipt says TransformerPath does not host webinars.

## Stripe links still to create

Already live and amount-checked:

- Featured Exhibitor $399 — `https://buy.stripe.com/dRm9AM5y06ln1NC9TsfYY06` (on pricing, events, exhibitions, sponsor, and event pages)
- Verified Manufacturer $499 and Featured Event $299 — already on the site and opening the right amounts
- Engineering Pro $599 — `https://buy.stripe.com/fZu00c3pScJL1NC3v4fYY01`
- Engineering Team $1,999 — `https://buy.stripe.com/aFacMY6C4aBD2RG2r0fYY02`
- Learning $199 one-time — `https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p` (`plink_1UQhha2YHcFlJstOHjvZv5V0`). The yearly code `4gMbIU2lO5hj1NC5DcfYY03` is inactive and is not a classifier.

Still missing a checkout (Contact us where noted; Intel Pro shows $499 / 12 months and no monthly price):

- Supplier Pro (Contact us, no public price)
- Intel Pro ($499 / 12 months, Contact us, no monthly price, no Payment Link)
- Intel Team (Contact us, no public price)
- Verified Manufacturer founding offer ($199 for the first year, marked Coming soon, no Payment Link)
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
| `STRIPE_PRICE_HOSTED_WEBINAR` | Unused on the site. The product was withdrawn. Do not create a new Checkout for it. |
| `STRIPE_PAYMENT_LINK_FEATURED_EXHIBITOR` | Optional exact `plink_` matcher. |
| `STRIPE_PAYMENT_LINK_HOSTED_WEBINAR` | Optional exact `plink_` matcher. |
| `SUPABASE_URL` | Required with the service role key. Not probed. |
| `STRIPE_PAYMENT_LINK_VERIFIED_MANUFACTURER`, `STRIPE_PAYMENT_LINK_FEATURED_EVENT` | Optional exact `plink_` matchers. |
| `RESEND_API_KEY`, `RESEND_FROM`, `NOTIFY_TO` | Receipts. Listing row can still be stored without Resend; a provider error returns 500. |
| `SITE_URL` | Defaults to `https://transformerpath.com`. |

After the secret key is set, each engineer Payment Link’s after-payment URL must be `https://transformerpath.com/pricing.html?session_id={CHECKOUT_SESSION_ID}` so `course-gate.js` can call `verify-access`. Verified Manufacturer should return to `claim-profile.html?paid=verified_manufacturer&session_id={CHECKOUT_SESSION_ID}#claimForm`. Featured Event should return to `events.html?paid=featured_event&session_id={CHECKOUT_SESSION_ID}#submit-event`. Featured Exhibitor should return to `sponsor.html?paid=featured_exhibitor&session_id={CHECKOUT_SESSION_ID}#contact`. Do not point a Payment Link at `paid=hosted_webinar`.
