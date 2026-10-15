# Events monetization plan (for NMPFL, due 17 Oct 2026)

Status: proposal only. No code or Stripe changes in this PR. **Any new price below needs Nishad's approval before it goes live.**
Researched against `main` @ e456044 and the live site on 15 Oct 2026. Production is stuck on **ea26f4c**, so every launch date assumes the deploy fix lands by 16 Oct; slip that and every date slips with it.

## Evidence base
- Repo has **543** event page directories under `events/`, built by `build-events.js`; each carries a Featured Event ($299) and Featured Exhibitor ($399) button.
- Live Payment Links (`lib/paid-listings.js`, `PAYMENTS.md`): Featured Event $299 `https://buy.stripe.com/00w6oA2lO8tvdwkaXwfYY04`, Featured Exhibitor $399 `https://buy.stripe.com/dRm9AM5y06ln1NC9TsfYY06`, Hosted Webinar $1,500 `https://buy.stripe.com/14A3co8Kc6ln77Wc1AfYY07`. Sponsorship "from $299" (pricing.html line 394, sponsor.html line 154) has **no checkout**.
- Travelpayouts marker **736890** (PR #37) already on event/exhibition pages: Hotellook hotel form (`marker=736890.<sub_id>`) and Kiwi flight link (`shmarker=736890.<sub_id>`), per-page sub-IDs, documented in `affiliate-disclosure.html`. Click counts are only in browser `localStorage` (`tp-aff-clicks`) plus the Travelpayouts dashboard.
- **No traffic, click or conversion data is in the repo.** All revenue figures below are **estimates** built on stated assumptions; replace them with Netlify/Travelpayouts numbers when available.

## Ranked options (fastest money first)

| # | Option | Proposed price | Effort | Est. revenue by 14 Nov (estimate) | Launch |
|---|---|---|---|---|---|
| 1 | Direct outreach selling existing Featured Event / Exhibitor links | $299 / $399 (live) | XS: outreach only, no code | $700–1,400 (assume 2–4 sales from ~40 organizer/exhibitor emails) | 16 Oct (works even before deploy: links are live) |
| 2 | Sponsorship packages with real checkout (fix "from $299") | Event Spotlight $299 (existing link); Category sponsor $599/mo; Event-page sponsor slot $499/event | S: 1–2 Payment Links + card copy | $500–1,100 (assume 1–2 sales) | 20 Oct |
| 3 | Price-mismatch cleanup (#6) | none | XS | indirect (fewer abandoned checkouts) | 16–17 Oct with deploy |
| 4 | Lead capture → TP Sales bot (exhibitors + attendees) | free form; feeds #1/#2/#5 | S–M: form + Supabase row + Sales routing | indirect; assume +1 paid sale from leads by 14 Nov ($299–399) | 22 Oct |
| 5 | Hosted webinar for event exhibitors (pre-show) | $1,500 (live) | XS: outreach | $0–1,500 (assume 0–1 sale; long cycle) | 16 Oct |
| 6 | Travelpayouts expansion (tickets, hotels, flights) | free to users; commission | S: add event-ticket/activity widgets, top-10 event pages, server-side click log | $10–60 (assume low hundreds of clicks, ~1–3% book, few $ commission; plus 30-day cookie lag) | 21 Oct |
| 7 | Paid event alert / calendar newsletter | $9/mo or $79/yr (sponsor slot in free edition $199/issue) | M: list, sign-up, send pipeline, Stripe link | $0–200 (assume 0–20 subs; slow to build) | 31 Oct |

**Fastest money:** #1 and #5 need no deploy; #2/#3 are the first code wins after the deploy.

## Option detail

### 1. Paid featured event listings for organizers
Already live ($299/event, review before publish). Gap is demand, not product: email organizers of the next 90 days' events (Middle East Energy, Enlit, ELECRAMA, DISTRIBUTECH, CWIEME, WFES) with their event page URL and the link. Optional later: tiered $299 (30 days) / $499 (until event + newsletter mention) — needs approval.

### 2. Exhibitor / sponsor slots on event pages
Featured Exhibitor $399 is live but its card delivery is marked **Coming soon** (sponsor.html line 140), which weakens the sale; ship the exhibitor card renderer first. "Sponsorship from $299" has no checkout: either point it at Event Spotlight ($299, existing link) or create links for the packages above (approval needed). One sponsor slot per event page, labelled "Sponsored".

### 3. Affiliate links via Travelpayouts 736890
Hotels and flights already wired. Add: event tickets/activities (Travelpayouts ticket/activity programs where an event city is supported), "Hotels near venue" block above the fold on the top 10 upcoming events, and a server-side click counter (Netlify function) so clicks aren't only in `localStorage`. Revenue is small and lagged; treat as a long-tail asset, not a 14 Nov driver.

### 4. Lead capture → TP Sales bot
Two forms on each event page: "Exhibiting? Get featured" (exhibitor) and "Attending? Get the meeting list / hotel deals" (attendee). Store in Supabase with `source=event:<slug>`, notify TP Sales. Consent text required; no auto-email to leads without opt-in.

### 5. Paid event alert / calendar newsletter
Weekly "transformer events & deadlines" email. Free edition with one $199 sponsor slot; paid tier $9/mo or $79/yr with early-bird deadline alerts and exhibitor lists. Needs a sender, list and Stripe link; slowest to revenue.

### 6. $399 vs $299 mismatch — exact locations
- The original bug (event pages showing "from $399" on the same card as the $299 Featured Event button, `docs/payments-audit.md` line 29) is **fixed on main and live**: `build-events.js` line 157 now reads "Featured Event is $299 per event. Featured Exhibitor is $399 per event.", guarded by `tests/paid-listings.test.js` lines 448–451. Live check of `/events/middle-east-energy/` on 15 Oct shows the fixed copy.
- Remaining confusion to fix: `build-events.js` line 142 labels the $399 exhibitor button **"Feature your company — $399"** next to the $299 "Feature this event" button — rename to "Feature your exhibitor — $399" to match `events.html` line 1294, `exhibitions.html` and `sponsor.html` line 141.
- `pricing.html` line 394 and `sponsor.html` line 154 "Sponsorship from $299" — no checkout (see #2).
- Stripe product title on the $299 link is generic "TransformerPath" (payments-audit line 29); product renames were done 15 Oct — re-verify.

## Approvals needed from Nishad
New prices: Category sponsor $599/mo, Event-page sponsor slot $499/event, newsletter $9/mo / $79/yr, newsletter sponsor $199/issue, optional $499 Featured Event tier. Outreach emails in #1 are public-facing and need his go-ahead on recipients and copy.
