# Proposal: paid job posts and qualified-lead fees

Status: **prices approved, not on the live site**. The owner approved the staged prices below on 15 Oct 2026. This file is the record. `data/commerce.json`, `jobs.html`, `pricing.html`, and `rfq.html` do not show them yet. No Stripe Product, Price, Payment Link, or Coupon has been created for them.

Currency is USD, matching `data/commerce.json`.

Checked against `main` on 15 Oct 2026. Classification no longer uses the charged amount: a session matches a product only from metadata or a Payment Link id (`lib/paid-listings.js`, `lib/course-payment.js`).

## Approved prices

| Offer | Launch price | Later price | Trigger for the rise |
| --- | --- | --- | --- |
| Job post, 30 days, one position | **$199** | **$349** | The live-openings count reaches **10**. Count only rows with a specific vacancy URL, a capture date, and a verification date. The 15 careers-page signals do not count. Posts already paid keep the price they were bought at until they expire. |
| Featured job, 30 days | **$299** | **$449** | The same trigger, in the same week: live openings reach **10**. Standard and featured move together. |
| 5-post bundle | **$799** | none | No rise. Five 30-day standard posts, used within 12 months of purchase. Each post still has to pass review before it counts as a live opening. |
| Qualified lead, any supplier | **$249** | none | No rise. |
| Qualified lead, Supplier Pro member, after the 4 included leads | **$149** | none | No rise. The 4 included leads stay inside the subscription. |
| Supplier Pro | **$1,499 / year** | **$2,499 / year** | **Leads are flowing**: the inbox has delivered at least one qualified lead (the definition in this file) to a supplier. The next new Supplier Pro purchase uses $2,499. A term already paid stays at the price paid for that year. |
| Founding Supplier Pro | **30% off year one**, first **20** suppliers | The coupon stops at 20 redemptions | Count is purchases, not a calendar date. 30% off the list price in force for that purchase, first year only. At the launch price that is **$1,049.30** (30% off $1,499). If a founding seat is still open after the rise, that year one is **$1,749.30** (30% off $2,499). |

These prices stay off the public pages until the inbox, the job review queue, and the Payment Link metadata in the Stripe section exist.

## Summary

| Stream | Approved price | What it buys | When it can be charged |
| --- | --- | --- | --- |
| Standard job post | **$199 / 30 days**, then **$349** at 10 live openings | One moderated vacancy that can count as a live opening | After review. The $199 amount no longer grants Learning. |
| Featured job | **$299 / 30 days**, then **$449** at 10 live openings | The same vacancy, plus a labeled FEATURED row above other live openings | After review. A $299 charge is Featured Event only when that session's Payment Link id or metadata says so. |
| 5-post bundle | **$799** | Five standard 30-day posts | After a single post can expire and be reviewed. |
| Qualified buyer lead | **$249**, or **$149** for a Supplier Pro member past the included 4 | One supplier receives a consented buyer contact for one matched RFQ | After consent, qualification, and the inbox. |
| Supplier Pro | **$1,499 / year**, then **$2,499 / year** once a qualified lead has been delivered | Verified plus the RFQ inbox, with **4** qualified leads included | After `rfq_inbox` is built. The link stays uncreated until then. |

## What is true on the site today

`data/commerce.json` `neutral_principle`: payment never changes research quality, technical capability, factory classification, project or award relationships, organic technical matching, Intel conclusions, or source confidence. A free Listed manufacturer may be a better technical match than a paying Supplier Pro. `rfq-engine.js` sorts matches by research completeness. A job upgrade and a lead fee stay inside that rule: they buy placement or a contact, and they do not reorder the matcher.

Catalog facts this proposal does not change:

- Verified Manufacturer is **$499 one-time**. Its outcome text names RFQ response eligibility. The feature row `rfq_eligibility` is `delivery: "coming_soon"`.
- Supplier Pro is **$1,499 / 12 months**, `price_status` TARGET in `data/products.json`. `rfq_inbox` (“RFQ inbox and lead status”), lead export, the analytics dashboard, sourcing alerts, Intel Pro seats, the Supplier Pro badge, and paid category placement are all `coming_soon`.
- `docs/payments-audit.md` (15 Oct 2026): there is no Supplier Pro Payment Link. Create it only after the inbox exists. `STRIPE_SECRET_KEY` is unset (`verify-access` returns `configured: false`). `STRIPE_WEBHOOK_SECRET` is unset (`stripe-webhook` returns 500). `create-checkout` returns 503 for Featured Event, Verified Manufacturer, and Featured Exhibitor because the secret and the `STRIPE_PRICE_*` ids are missing.
- Live Payment Links in `lib/paid-listings.js`: Featured Event $299, Featured Exhibitor $399, Verified Manufacturer $499. The hosted-webinar offer was withdrawn from `PAYMENT_LINKS`. A paid row is stored as `paid_pending_verification`. A public badge is rendered only from a reviewed row in `data/paid-listings.json` (reviewer, time, evidence). That file has no reviewed rows.
- `functions/confirm-listing-payment.js` treats a `session_id` in the query string as not proof. It asks Stripe, and only for `verified_manufacturer`, `featured_event`, `featured_exhibitor`, and `hosted_webinar`. With no secret it returns `paid: false`.
- `jobs.html` heading is still “Hiring? Post a Job — Free”. The form is the Netlify form `job-posting` (honeypot `bot-field`). Apply URL is optional. Nothing in that form sets `posting_url`, `captured_at`, or `last_verified_at`.
- `rfq.html` is a free public board. `RFQS` is empty. The form already asks for company, email, category, rating (MVA/kVA), voltage (kV), and target delivery. Copy on the form: contact details are not shown publicly. `privacy.html` (14 Oct 2026) says personal data is not sold and is shared only with processors.
- Workspace accounts are the sign-in on `workspace.html` (`supabase.js`). The page tells a signed-out visitor: “Accounts are being set up — this workspace will be available soon.”

### The Jobs page count

The live-openings statistic is **0**. `build_ssr.js` and the page script count a row only when it has a specific vacancy URL (`posting_url`), a capture date (`captured_at`), and a verification date (`last_verified_at`). `LIVE` is empty. Paylocity job 3846464 (Pennsylvania Transformer Technology) returned HTTP 404 on 14 Oct 2026, so it is not listed as open.

The hiring-signals block has **15** “Careers page →” rows (GE Vernova, Hitachi Energy, Siemens Energy, Eaton, and the others in `SIGNALS`). Those links open a careers search or landing page. The page says they are not specific vacancies and do not carry an “Open now” badge. They are not 15 live openings. A paid post is added to the live count only after the same three fields exist and the vacancy URL has been checked. The 15 signals stay in the hiring-signals section.

## 1. Paid job board

### Who it is for

Transformer OEMs, component suppliers, service shops, and EPCs that already have, or can claim, a maker profile. The maker id is the directory **company slug**, the same id Verified Manufacturer puts in `client_reference_id` (`verifiedManufacturerPayHref` in `lib/paid-listings.js`).

### Posting flow

1. The employer signs in with the workspace account that is being built, and the account is linked to one known company slug (`knownCompanySlug`). A company with no slug uses the existing claim path first. An unlinked payment can be stored, and it is not published on that maker’s profile until the slug is reviewed.
2. Intake stays the `job-posting` form: title, company, location, function, description, contact email, and a specific apply URL. One position per post. IEEE removes postings that contain more than one position; this board should do the same. A careers-search URL is a hiring signal, not a live opening.
3. The employer pays with a Payment Link (stage 3) or, later, Checkout. Payment writes `paid_pending_verification`. It does not publish the row.
4. A reviewer checks that the apply URL is a specific vacancy and is not a 404, then sets `posting_url`, `captured_at`, and `last_verified_at`, plus reviewer, review time, and evidence, following the paid-listing review rule.
5. Only that reviewed row increments “Live openings”. Expired and unchecked rows stay out of the count. The 15 careers-page signals stay out of the count.

The free heading can stay true only while a reviewed free post is still allowed onto the board. Charging for every live opening makes that heading false, so the heading change ships with the paid flow, not with this document.

### Moderation

Reject multi-role ads, staffing blasts, and links that only open a careers search. Re-check the apply URL at review. The Paylocity 404 is the reason. Store the HTTP result and the date on the review evidence. The employer email should be a work address at the company that owns the slug.

### Expiry

A standard post lasts **30 days** from `last_verified_at`. The live-openings filter drops it when that window ends. Renewal is a new payment and a fresh URL check. A 90-day product is out of the MVP: T&D World publishes one (below), and a long window is how a dead URL stays on the board.

### Featured upgrade

Featured is a separate SKU, not a quiet sort boost. The row shows a FEATURED label and the same neutrality line Featured Event already uses: promotional placement, clearly labeled, not an editorial recommendation. It sits above other live openings for the same 30 days. It does not reorder the employer directory, the matcher, or organic maker profiles. It does not include a newsletter mention or a site-wide takeover. T&D World’s enhanced listing includes both of those; this site does not have that bundle, so the label must not claim it.

### Pricing, with sources

Read on 15 Oct 2026 from the publishers’ own pages.

**T&D World Job Center** — [employer pricing](https://jobs.tdworld.com/employer/info). Closest public board: transmission and distribution jobs.

| Offer | Published price |
| --- | --- |
| 1 listing, 30 days | $199 |
| 1 enhanced listing, 30 days (homepage priority, Featured employer status, next Smart Utility or Lineman Life newsletter) | $299 |
| 1 listing, 90 days | $350 |
| 1 enhanced listing, 90 days | $500 |
| 5 standard 30-day listings (20% off, use within 1 year) | $800 |
| 5 enhanced 30-day listings | $1,200 |
| Job-board mirroring, one year | $10,000 |

**IEEE Job Site** — [employer pricing](https://jobs.ieee.org/employer/pricing/). One position per posting. The page listed:

| Offer | Published price |
| --- | --- |
| Job Flash, 30 days, emailed to nearly 70,000 IEEE Job Site users | $549 |
| 30-day basic posting | $449 |
| 60-day basic posting | $809 |
| 15-day basic posting | $349 |

An unlabeled $799 control sits beside the Ultimate Recruitment Package description. That figure is not used, because the visible label was not reliable. Older roundups (Betterteam, Fit Small Business) still show a $299 basic post. The live IEEE page shows $449, so this proposal uses the live page.

**ASCE Career Connections** — [employer pricing](https://employers.asce.org/). 30-day plans: Qualified $655, Practicing $765, Experienced $875, Specialist $985. Homepage featuring starts at Practicing. 60-day and 90-day steps are published on the same table ($765 to $1,205). Active members get 20% off ([member discount](https://employers.asce.org/static-page/10281/memberdiscount/)).

### Approved job prices

The benchmark that set the launch numbers is still T&D World’s published 30-day listing at $199 and enhanced listing at $299 ([employer pricing](https://jobs.tdworld.com/employer/info)). IEEE’s live basic post is $449 and Job Flash is $549. ASCE’s 30-day plans are $655–$985. The launch prices sit on the T&D floor while this board has 0 live openings. The raised prices move toward those society boards only after the board has 10 real vacancies.

| SKU | Launch | After 10 live openings |
| --- | --- | --- |
| `job_standard_30` | **$199 / 30 days** | **$349 / 30 days** |
| `job_featured_30` | **$299 / 30 days** | **$449 / 30 days** |
| `job_bundle_5` | **$799** for five 30-day standard posts | No rise |

A 90-day product and T&D World’s $10,000 mirroring product stay out of the MVP. The stale-URL risk comes first. T&D World’s own 5-pack is $800; the approved bundle is $799.

### Payment Links now, Checkout later

**Now, same pattern as `lib/paid-listings.js`.** A Dashboard Payment Link is a static URL. The page is an `<a href>`. The button does not need `STRIPE_SECRET_KEY`. After payment, Stripe returns to a path that includes `session_id={CHECKOUT_SESSION_ID}` and a distinct query (`paid=job_standard` or `paid=job_featured`). The employer then confirms the vacancy on the job form. `client_reference_id` is the company slug, as it is for Verified Manufacturer.

Fulfillment still needs the webhook. `checkout.session.completed` should write `paid_pending_verification` only after `STRIPE_WEBHOOK_SECRET` is set and Supabase accepts the row. `functions/confirm-listing-payment.js` must learn the new product names before any banner may say payment was received. A query string is not proof.

A Payment Link cannot attach a different vacancy id on each click. The pay-then-form sequence already used for Featured Event is the right MVP: pay, then submit the job, then a person ties the session to the slug.

**Later, Checkout.** `create-checkout` (and `functions/confirm-listing-payment.js`) need `STRIPE_SECRET_KEY` plus the price ids in the Stripe section. The session metadata carries `product`, `company_slug`, and the job id. Checkout is blocked today: those env vars are unset, and the audit’s POST to `create-checkout` returns 503.

**Amount is not a product.** `functions/entitle.js` and `functions/verify-access.js` used to map `19900` cents to Learning, and any unmapped amount fell through to Learning. `isPaymentLinkCheckout` used to treat any $299 Payment Link as Featured Event when the link env was unset. Both paths now require metadata or a Payment Link id. A $199 or $299 charge with neither is unclassified: it does not grant Learning and it does not write a Featured Event row. Each new Payment Link still has to set `metadata.product` or have its `plink_` id stored in the matching env var. The return URL query (`paid=job_standard`, `paid=job_featured`) is the other accepted identifier.

## 2. Lead and RFQ fees

### What the buyer side already does

`rfq.html` takes a free RFQ. `rfq-engine.js` matches category, reported MVA, reported kV, and destination country against the manufacturer census and accessory suppliers. It returns “potentially relevant suppliers”, capped at 24, sorted by research completeness. The public list `RFQS` is empty. Responses today are `mailto:hello@transformerpath.com`. Buyer details stay off the public card.

Verified’s `rfq_eligibility` and `buyer_inquiry_routing` are `coming_soon`. Supplier Pro’s `rfq_inbox` is `coming_soon`. Charging for either before those features exist repeats the payments-audit rule: do not create the $1,499 link until the inbox exists.

### What “qualified” means

A lead is billable only when every line below is true. Anything else can sit in the review queue and cannot be charged.

| Check | Rule |
| --- | --- |
| Buyer email | Work address, confirmed by a link the buyer clicks. The domain matches the named company. Free webmail (Gmail, Yahoo, Outlook, Hotmail, and similar) is not qualified. |
| Company | A company name is present. It is not the supplier being charged, and it is not a duplicate of that supplier’s own domain. |
| Scope | Category is one of the options on the RFQ form, which are the keys `rfq-engine.js` already maps (`CATEGORY_TO_PRODUCT`). The details field describes a real requirement, not a one-line advertisement. |
| kV / MVA | At least one numeric rating: voltage class (kV) or rating (MVA or kVA), using the same parsing the matcher uses (`kvNumber`, `mvaNumber`). A lead with neither number is not qualified. Both numbers are the preferred case. |
| Deadline | A calendar date (`YYYY-MM-DD`) that `lib/deadline.js` classifies as still open on the day the supplier is charged. The RFQ form’s “Target Delivery” example is “Q2 2027”. A quarter, or a bare year, stays an imprecise deadline under `lib/deadline.js` (a bare year is open through 31 December, not 1 January). It is not precise enough to bill. |
| Consent | The buyer ticks a box, stored with the timestamp and the text version, allowing TransformerPath to send name, work email, company, and the technical fields to a stated maximum of matched suppliers. |
| Review | A person marks the lead qualified. Payment never creates that mark. |
| Duplicate | The same buyer email, category, rating, and voltage inside 90 days is one lead, not a second charge. |

The public card stays redacted. Qualification does not put the buyer’s email on `rfq.html`.

### Who is charged

The buyer is not charged. `commerce.json` already includes a free engineer tier whose outcome includes posting an RFQ.

The supplier pays, and only for a lead the matcher already returned for their capability. Match order stays research completeness. Supplier Pro does not buy a higher slot. `featured_placement` in the catalog is a separate coming-soon feature and is not part of this lead fee.

Recommended fan-out: at most **5** suppliers are offered a given qualified lead. The engine’s cap of 24 is a research list, not a billing list. The consent line names the cap of 5.

### Per-lead and subscription

No publisher page found for this proposal states a dollar price per industrial RFQ.

- Thomas’s own program pages say a free profile does not receive RFQs and a premium (Verified) subscription does. They do not print the annual subscription. The only public dollars on those pages are add-on packs: **5 extra program points at $115 per month** on [Verified Core](https://business.thomasnet.com/programs/verified-core) and **$105 per month** on [Verified Growth](https://business.thomasnet.com/programs/verified-growth). Those are targeting points, not a price per RFQ. A secondary 2026 write-up that quotes a wide annual range is not used here.
- The [GlobalSpec 2026 media kit](https://advertising.globalspec.com/wp-content/uploads/2025/10/2026-GlobalSpec-Media-Kit.pdf) offers cost-per-lead programs (“only pay for the leads you receive”) and says the report includes name, company, and email. It does not print a dollar CPL. The 2011 GlobalSpec rate card is not a current price.
- [Kompass Spain](https://es.solutions.kompass.com/productos-y-servicios/marketing-digital/booster-kit-digital/) publishes supplier-profile floors, not a per-lead fee: Booster Nacional **from €500 / year**, Booster Plus **from €1,000 / year**, Booster Internacional **from €2,000 / year**. The page says the profile can receive purchase requests (“Recibe solicitudes de Compra”). “From” means a starting price. Supplier Pro at $1,499 sits between the Plus and Internacional floors, which supports keeping an annual subscription rather than inventing a second annual number.

**Approved lead and subscription prices:**

| Offer | Price | Notes |
| --- | --- | --- |
| One qualified lead | **$249** | Any supplier. No later rise. Identify the charge with `metadata.product=rfq_lead` or that Payment Link’s `plink_` id. |
| Extra lead for a Supplier Pro member | **$149** | Applies only after the 4 included leads are used. `metadata.product=rfq_lead_pro`. |
| Supplier Pro, launch | **$1,499 / year** | Includes the Verified feature set plus the RFQ inbox once that inbox exists, and **4** qualified leads in the year. |
| Supplier Pro, after leads are flowing | **$2,499 / year** | Trigger: the inbox has delivered at least one qualified lead. New purchases only. |
| Founding offer | **30% off year one, first 20 suppliers** | Stripe Coupon `percent_off=30`, `duration=once`, `max_redemptions=20`. Year one at $1,499 is $1,049.30. Year one at $2,499, if a seat remains, is $1,749.30. |

Until analytics, lead export, Intel Pro seats, the Supplier Pro badge, and paid category placement are actually delivered, the $1,499 description that can be charged is: Verified-level profile, the RFQ inbox, and four qualified leads. The outcome paragraph that lists the unbuilt extras has to be narrowed in the same change that creates the Payment Link, or those extras have to be built first. This document does not edit that paragraph.

`rfq_eligibility` on Verified stays a response right to redacted RFQs through the platform, once that feature is built. It does not include the buyer’s email. The $249 unlock, and the four leads inside Pro, are the contact.

### Refunds for a bad lead

Window: **10 business days** from the moment the contact is delivered into the inbox.

Refund or restore a quota credit when the lead fails a qualification rule we missed: email bounces or is free webmail, company is false, kV and MVA are both missing, the deadline was already past, the buyer did not consent or withdraws consent, the lead is a duplicate, or the supplier’s categories do not cover the RFQ (a match error on our side).

A lead is still billable when the supplier replies slowly, the buyer chooses someone else, the buyer’s budget is lower than the supplier hoped, or the buyer goes quiet after a real reply.

Remedy: put the credit back on the Supplier Pro quota, or refund the $249 Stripe charge for an à-la-carte unlock. `charge.refunded` already exists on the webhook for course entitlements; a lead credit needs its own ledger and should follow the same event. Opening the lead still qualifies for a refund when the lead itself was bad. A supplier who has already written to the buyer does not.

### Anti-spam

The RFQ form already has a honeypot. Add a per-email and per-domain rate limit, and keep human review in front of any charge. One buyer action creates at most one billable lead per supplier. Suppliers cannot buy a blast across the census. A supplier cannot buy a lead outside the categories on their maker record. Staffing-style “looking for vendors” posts with no kV, no MVA, and no date fail qualification and are not billed.

### Privacy and consent

`privacy.html` says we do not sell personal data and share it only with service providers. `rfq.html` says contact details are never shown publicly. Both sentences stay true only if they grow a precise exception before any lead is sold:

- The public page still does not show the buyer’s email, phone, or full name.
- A matched supplier receives those fields only after the stored consent tick, and only up to the cap of 5.
- That disclosure is not a processor relationship. The policy, the RFQ form, and the supplier terms have to say so. `consent.js` is the analytics and ads banner. It is not this consent.
- The supplier terms forbid reselling the contact or using it for any offer other than this RFQ.
- The buyer can withdraw. Further sends stop. Suppliers who already received the contact are told to delete it.
- Retention proposed: until the deadline, plus 90 days, unless the buyer asks for deletion sooner.

`hosted_webinar` in the catalog already says attendee reporting is subject to privacy and consent. The same sentence belongs on every lead.

### How this fits Supplier Pro

Supplier Pro is the subscription. The inbox is the product the audit says is missing. Per-lead $249 is the unlock for a supplier who does not buy the year. A Supplier Pro member pays $149 for each lead after the four included ones. The launch subscription is $1,499 and becomes $2,499 for new purchases once a qualified lead has been delivered.

Do not create `https://buy.stripe.com/...` for $1,499 in this work. Do not add `supplier_pro` to `PAYMENT_LINKS` or to `confirm-listing-payment.js` until a supplier can open an inbox and see lead status (`rfq_inbox`). Emailing a buyer contact from the Netlify form notification is not that inbox.

Payment Links can sell a generic lead credit (pay, then staff attaches the credit to a reviewed lead and a slug), which matches the Featured Event pay-then-form pattern. They cannot name `rfq_id` and `supplier_slug` on their own. Checkout, later, puts both ids in metadata. That is the right long-term charge for a specific lead. It waits on `STRIPE_SECRET_KEY` and a price id. An amount with no metadata and no Payment Link id stays unclassified.

## MVP stages

Each stage is a later change. This pull request is stage 0 for both streams.

### Jobs

| Stage | Build | Depends on |
| --- | --- | --- |
| 0 | This proposal. | Nothing shipped. |
| 1 | Workspace account linked to a company slug. Amount-only classification is already removed. | Accounts being built. `STRIPE_SECRET_KEY` is not required for the account link. It is required before any “payment received” banner. |
| 2 | Review queue on the existing `job-posting` form. Publish to the live board only with `posting_url`, `captured_at`, `last_verified_at`, one position, and a URL that still resolves. The 15 signals stay signals. The counter stays at 0 until such a row exists. | None of the Stripe secrets. A human can moderate from the Netlify form mail. |
| 3 | Payment Links for the launch job prices ($199, $299, and the $799 bundle), return URLs, webhook row `paid_pending_verification`, 30-day expiry, FEATURED label from a reviewed row. Switch the standard and featured links to $349 and $449 when live openings reach 10. | `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). `STRIPE_PAYMENT_LINK_JOB_STANDARD` and `STRIPE_PAYMENT_LINK_JOB_FEATURED` hold the `plink_` ids. Each link sets `metadata.product`. |
| 4 | Checkout with `metadata.product`, slug, and job id. Employer list of their own posts in the workspace. Five-pack only after expiry works. | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_JOB_STANDARD`, `STRIPE_PRICE_JOB_FEATURED`. |

### Leads

| Stage | Build | Depends on |
| --- | --- | --- |
| 0 | This proposal. No $1,499 link. | Nothing shipped. |
| 1 | Consent checkbox, privacy and supplier terms, required kV or MVA, and a real deadline date. Public cards stay redacted. | Legal copy. No Stripe. |
| 2 | Review queue and a stored match list from `rfq-engine.js`. No buyer email leaves the building. Cap the billable list at 5. | Maker categories and slugs already in the census. |
| 3 | Supplier Pro inbox and lead-status board (`rfq_inbox`). Quota ledger of 4. Only then may the $1,499 Payment Link be created, and only with outcome copy that matches what the inbox actually does. | Supabase, workspace accounts, webhook, the collision fix. |
| 4 | $249 lead credit via Payment Link, and $149 for a Supplier Pro member past the included four. Then Checkout that names `rfq_id` and `supplier_slug`. Refunds restore the quota or reverse the charge. | Same secrets as job stage 4, plus `STRIPE_PRICE_RFQ_LEAD` and `STRIPE_PRICE_RFQ_LEAD_PRO`. |

## Dependencies

| Dependency | State on 15 Oct 2026 | What it blocks |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Unset. `verify-access` says so. `create-checkout` returns 503. `confirm-listing-payment.js` returns `paid: false`. | Checkout, and any honest “payment received” banner. Payment Link buttons can be pasted before this; they must not publish a job or release a contact. |
| `STRIPE_WEBHOOK_SECRET` | Unset. Webhook returns 500. | Writing `paid_pending_verification` and the later lead ledger. |
| `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` | Required by `functions/lib/supabase-server.js` (that file also accepts `SUPABASE_SECRET_KEY`). Not visible from outside, because the webhook returns before it opens Supabase. | Paid rows, entitlements, inbox, quota. |
| Workspace accounts | In progress. `workspace.html` says accounts are being set up. `supabase.js` already has sign-up and sign-in. | Employer and supplier ownership of a slug. Anonymous Stripe checkout can store an email (`entitle.js` already keys an entitlement by email and links a user later). Publishing still waits for the slug review. |
| Maker id | Company slug. Verified pay links already pass it as `client_reference_id`. | Job posts and lead unlocks attach to a profile only when the slug is known. |
| `rfq_inbox` | `coming_soon` on Supplier Pro. | The $1,499 link. |
| `rfq_eligibility` | `coming_soon` on Verified. | Any claim that $499 already includes responding to RFQs. |
| Amount fallbacks | Removed. Metadata or a Payment Link id classifies the session. A bare $199 or $299 charge stays unclassified. | Nothing, for classification. New links still need their own `metadata.product` or `plink_` env id before they fulfill. |

`RESEND_API_KEY` is how paid-listing receipts go out today. A missing receipt currently fails the webhook with 500 after the listing write is attempted. Lead mail should use the same pattern and should not be the system of record. The inbox row is.

## Risks

- Calling the 15 careers-page rows “15 live openings”, or letting a paid post increment the counter before the vacancy URL, capture date, and verification date exist.
- Publishing a new Payment Link without `metadata.product` or a stored `plink_` id, so the payment is unclassified and does not fulfill. Amount alone will not misfile it as Learning or Featured Event.
- A “payment received” banner that trusts the query string. `confirm-listing-payment.js` was added so listing products do not do that. New products have to go through it.
- Selling Supplier Pro, or emailing buyer contacts from the Netlify notification, while `rfq_inbox` is still coming soon.
- Disclosing a buyer email while `privacy.html` still says data is only shared with processors, and while the RFQ page says details are never shown.
- Letting a payment change `rfq-engine.js` order. That breaks `neutral_principle`.
- Leaving “Post a Job — Free” in place after every live opening requires payment.
- A featured job label that implies an editorial recommendation, or that claims a newsletter inclusion the site does not send.
- Billing a lead with a bare year or “Q2 2027” as if it were a calendar deadline.
- One RFQ sold to all 24 matcher hits.
- Stale apply URLs, which is the Paylocity 404 again.

## Stripe objects to create later

Nothing in this list is created in the repo or in Stripe by the classification change. Create the launch objects when that product is ready to sell. Create the raised Price and its Payment Link only when the trigger fires. Every Payment Link sets `metadata.product` to the value in the table and, after it exists, its `plink_` id goes in the env var. The after-payment URL includes `session_id={CHECKOUT_SESSION_ID}` and the `paid=` query for that product.

| Object | Stripe type | Amount | `metadata.product` | When |
| --- | --- | --- | --- | --- |
| Job post, launch | Product, one-time Price, Payment Link | 19900 cents | `job_standard` | Job review queue is live |
| Job post, raised | One-time Price, Payment Link | 34900 cents | `job_standard` | Live openings reach 10 |
| Featured job, launch | Product, one-time Price, Payment Link | 29900 cents | `job_featured` | Job review queue is live |
| Featured job, raised | One-time Price, Payment Link | 44900 cents | `job_featured` | Live openings reach 10 |
| 5-post bundle | Product, one-time Price, Payment Link | 79900 cents | `job_bundle_5` | A single post can expire and be reviewed |
| Qualified lead | Product, one-time Price, Payment Link | 24900 cents | `rfq_lead` | Inbox and consent are live |
| Pro overage lead | One-time Price, Payment Link on the lead product | 14900 cents | `rfq_lead_pro` | Inbox can count the 4 included leads |
| Supplier Pro, launch | Product, yearly recurring Price, Payment Link | 149900 cents / year | `supplier_pro` | `rfq_inbox` exists |
| Supplier Pro, raised | Yearly recurring Price, Payment Link | 249900 cents / year | `supplier_pro` | One qualified lead has been delivered |
| Founding Supplier Pro | Coupon `percent_off` 30, `duration` once, `max_redemptions` 20, applied to the Supplier Pro product | 30% off the year-one invoice | — | With the launch Payment Link. Retire the coupon at 20 redemptions. |

Env vars for the `plink_` ids, set when each link exists: `STRIPE_PAYMENT_LINK_JOB_STANDARD`, `STRIPE_PAYMENT_LINK_JOB_FEATURED`, `STRIPE_PAYMENT_LINK_JOB_BUNDLE_5`, `STRIPE_PAYMENT_LINK_RFQ_LEAD`, `STRIPE_PAYMENT_LINK_RFQ_LEAD_PRO`, `STRIPE_PAYMENT_LINK_SUPPLIER_PRO`. Checkout price ids, only when Checkout replaces the link: `STRIPE_PRICE_JOB_STANDARD`, `STRIPE_PRICE_JOB_FEATURED`, `STRIPE_PRICE_JOB_BUNDLE_5`, `STRIPE_PRICE_RFQ_LEAD`, `STRIPE_PRICE_RFQ_LEAD_PRO`, `STRIPE_PRICE_SUPPLIER_PRO`.

## What the owner still decides

Prices, the 10-opening rise, the “leads are flowing” rise, the $149 Pro overage, the four included leads, and the founding 20 at 30% off year one are approved.

1. Whether a reviewed free post may still become a live opening, or whether payment is required before a row enters `LIVE`. The free heading on `jobs.html` follows that choice.
2. Featured means a labeled row above other live openings for 30 days, with no newsletter and no change to maker rank.
3. Whether Verified’s coming-soon `rfq_eligibility` is “respond to a redacted RFQ” and the paid lead is the only way to receive the buyer email.
4. The billable fan-out cap of **5** suppliers per RFQ.
5. The refund window of **10 business days**, credit back onto the Pro quota, Stripe refund for a single lead charge, and no refund after the supplier has written to the buyer. A $149 overage refunds $149. A $249 lead refunds $249.
6. A qualified deadline is a calendar date. A bare year or a quarter is not billable.
7. Narrow the Supplier Pro outcome text when the link is created, or build analytics, export, Intel seats, the badge, and category placement before charging $1,499 for that sentence.
8. Approve the privacy exception (consented disclosure to at most 5 suppliers, public page stays redacted) before any contact is sent.

Those items are not implemented by this document.
