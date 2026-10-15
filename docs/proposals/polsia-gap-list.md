# Polsia site gap list

Review date: 15 October 2026. Research only. Nothing here is a decision to build, and no price is proposed.

Reviewed with Playwright (Chromium) against `https://transformerpath.polsia.app/`, every internal link that site exposes, and `https://tanbrief.polsia.app/`. Compared with this repo and with live `https://transformerpath.com/` the same day.

If any of this is ported, the contact address is `hello@transformerpath.com`. Do not ship `transformerpath@polsia.app`, `polsia.app` links, or the TanBrief name. `check-brand.js` already fails the build if those reach a served page.

## How to read a number

| Mark | Meaning |
| --- | --- |
| Sourced | The cited standard text, or direct arithmetic that matches that text, actually contains the figure. |
| Displayed only | Polsia prints it. No external source, and usually no working product behind it. Do not copy. |
| Contradicted | Their own page, or the standard they name, disagrees with the figure. |

## What the Polsia site actually is

`transformerpath.polsia.app` is a small Next.js app. Its sitemap and canonical tags point at `https://tanbrief.polsia.app/`, but that host does not serve this app.

On 15 October 2026 `tanbrief.polsia.app` answered with `x-landing-source: Fallback` and the Polsia company page “AI That Runs Your Company While You Sleep” (`support@polsia.com`). `/`, `/about`, `/terms`, `/acceptable-use`, `/privacy`, and `/login` all returned that same shell. `/tanbrief`, `/intel`, `/autotransformer.html`, `/faq.html`, `/pricing.html`, `/archive`, and `/calculator.html` on that host returned 404. Its `/sitemap.xml` was the `polsia.com` marketing sitemap. There is no transformer product on that host to port.

### Pages and tools on transformerpath.polsia.app

| Path | What it is |
| --- | --- |
| `/` | Marketing page: mock nameplate, “why now”, a brief tape, four tiers, FAQ. |
| `/tanbrief` | The calculator. Internal name in the bundle is TanBrief (`tanbrief:lastSpec:v1` in localStorage). |
| `/calculator.html` | Launcher with two links, into `/tanbrief` and `/autotransformer.html`. |
| `/autotransformer.html` | Phase 2 autotransformer rating-plate and impedance chain. |
| `/faq.html` | Five long answers. Several describe source files and features that the running app does not match. |
| `/pricing.html` | Same four tiers as the homepage, plus a second comparison that drops the $699 tier. |
| `/intel` | “Refresh now” button. The visible page did not render a story. `POST /api/intel/refresh` did return one. |
| `/archive` | 53 dated cards, 22 Aug 2026 through 14 Oct 2026. Five paragraphs, repeated. |
| `/academy.html` | Stub. “Subscribe” goes to `/`. Body also contains the string `UNLOCKED_MARKER_ACADEMY`. |
| `/masterclass.html` | Same pattern, two workshop titles, no lessons. |
| `/engineer-track.html` | Same pattern, plus a quiz shell (“10 questions”, “score of 7”) with no questions in the HTML. |
| `/test-report.html` | Redacted sample. Footer says the numbers are illustrative. PDF is described as gated; no Stripe checkout was present. |
| `/sw.js`, `/calculator-manifest.webmanifest` | PWA. Manifest name is “TanBrief IEC 60076 Design Calculator”. |
| `/api/pdf/document` | PDF route (POST). Spec is sent to the server when someone exports. |
| `/api/intel/latest`, `/api/intel/refresh` | Generated brief. Refresh is a public POST. |

Nav links stop at those first pages. Academy, masterclass, engineer track, test report, and `calculator.html` are not in the nav. They were opened because pricing and the FAQ name them.

Every paid button is a `mailto:transformerpath@polsia.app` link:

| Button | Subject |
| --- | --- |
| Talk to engineering | `TransformerPath intake` |
| Request a module | `Calculator feature request` |
| Start Studio / Start Engineer | `Studio tier` |
| Apply | `Masterclass intake` |
| Talk to us | `Consulting tier` |
| Email us (pricing) | `Subscription` |

No card form, no Stripe, no account.

## Offer tiers Polsia shows

Do not set our prices from this table. These are the figures on their homepage and `/pricing.html` on 15 October 2026. Each one is **displayed only**.

| Tier | Price they show | What the page promises | What was actually there |
| --- | --- | --- | --- |
| Brief | $0 forever | Full calculator, daily brief, 3 PDF exports / month, archive back to 2024-Q3 | Calculator runs in the browser. No account, so a monthly export cap cannot be enforced. Archive starts 22 Aug 2026. |
| Studio | $199 / month | Scenario library for 60076-5 and 60076-4, NEMA and GOST modules, unlimited PDFs, saved designs, recorded quarterly office hours | Mailto only. No scenario library, no NEMA/GOST module, no saved-design server. |
| Masterclass | $699 / month | Live 8-week cohort, 3 cohorts / year, reference designs 25–500 MVA, quarterly type-test debrief, 60 min 1:1 / month | Mailto only. `masterclass.html` is a stub. |
| Consulting | $1,999 / month | Test-report builder, white-label PDF and CSV, bespoke runs, 24-hour SLA, dedicated contact. “By invitation.” | Mailto only. `test-report.html` is a sample with made-up numbers. |

Other commercial sentences, all **displayed only**:

- Refund within 14 days, month-to-month, no annual lock-in.
- “Most teams pick” Studio.
- Free tier: first three PDF exports are not card-gated. Homepage FAQ also says a PDF export needs no account.
- Engineer-track and the consulting test-report builder are described as Consulting-only. The $699 column on the same page also checks Academy and Masterclass. The second table on `/pricing.html` omits the $699 tier and attaches Academy to the $1,999 tier only.

$199 and $1,999 are the same numerals as our annual Learning and Team amounts. Polsia prints them as per month. Treating them as researched market rates would collide with our own yearly plans.

## Formula check

Worked from the minified page bundles and from a Playwright run that filled the forms. References used: IEC 60076-5:2006 (Tables 1, 2, and 4, from the IEC sample text), IEC 60076-3:2000 Table 2 (rated lightning-impulse levels), and the co-ratio definition in IEEE C57.12.10 as stated in the public IEEE PES autotransformer notes (equivalent power = throughput × (1 − V_LV/V_HV)).

### Autotransformer page — partly right, two hard errors

Defaults on the page: 100 MVA, 132 / 66 kV, uk% = 12.5, so a = V_HV/V_LV = 2.

Currents match the standard split. For three-phase, I_LV = S / (√3 · V_LV) = 874.8 A. Series current = I_LV / a = 437.4 A. Common current = I_LV × (a − 1) / a = 437.4 A. That common-current fraction is the co-ratio (a − 1) / a = 1 − V_LV/V_HV. **Sourced** as arithmetic, and it matches the co-ratio.

What they never print is the sizing result that co-ratio is for:

S_eq = S_through × (1 − V_LV/V_HV) = 100 MVA × 0.5 = 50 MVA.

That is the equivalent two-winding power (IEEE C57.12.10 co-ratio; the same factor is in the PES notes). The tool has no equivalent-MVA output. A port has to add it. Do not invent a dollar or a weight from it.

Errors, confirmed on the rendered default:

1. Turns ratio displays `∞ : 1`. The code computes N_series:N_common = (a − 1):1, which is 1:1 at a = 2, then treats any ratio ≥ 0.9999 as infinity. Every step-down with a ≥ 2, including this default and a 230/115 kV unit, shows infinity. **Contradicted** by their own formula line on the same card.
2. Percent impedance is divided by a². They show Z_LV = 12.50 / 4 = 3.13%, and Z_common = ((a − 1) / a)² × 12.50 = 3.13%, and they cite “IEC 60076-5 §3”. Percent impedance referred to the other winding at the same throughput stays 12.5%, because the ohmic impedance and the voltage base both move with a². Dividing the percent by a² treats a percent as if it were ohms. IEC 60076-5 clause 3 is the short-circuit withstand requirement, not an autotransformer impedance split. A single uk% also cannot be split into a common-winding impedance without a leakage calculation or a test. **Contradicted.**
3. The full-load LV drop uses that 3.13%: 2.06 kV. The consistent LV drop at 12.5% is 0.125 × 66 kV = 8.25 kV. **Contradicted.**
4. The vector group is always clock 11 (`DY11`), whatever the two connection menus say.
5. The “series” row prints the HV terminal voltage (132 kV). The series-section voltage is V_HV − V_LV.
6. uk% is rejected outside 4.0–15.0 “per IEC 60076-5 §4.1”. Clause 4.1 is the short-circuit current calculation. The standard’s impedance table is Table 1, and it is a minimum by rating (4% from 25–630 kVA, rising to above 12.5% above 100 MVA), not a 4–15% cap. **Contradicted.**

The common-current sentence (“sees X% less”) uses 100 minus the common-current percent, which is 1/a. That wording is consistent. It is not the missing S_eq figure.

### Rating-plate calculator (`/tanbrief`) — currents are fine, short-circuit results are not

Three-phase rated current I = S / (√3 · V) is implemented correctly. At 63 MVA and 230 kV the page shows 158.1 A. **Sourced** as arithmetic.

The default vector group is `Dyn11`. The validator’s own examples are `Dyn11`, `Yyn0`, and `ZNyn1`. The regex only allows one winding letter, an optional `N`/`n`/`y`, and a number, so `Dyn11` is rejected and the default spec cannot be exported. Confirmed on the rendered page. A value the regex does accept (`Yn0`) was used for the run below.

At 63 MVA, 230 kV, uk% 12.5, 2 s fault, tertiary cleared:

| Quantity | Standard result | What the page showed |
| --- | --- | --- |
| Symmetrical short-circuit current | I_sc = 158.1 A / 0.125 = 1.265 kA. IEC 60076-5 clause 4.1.2 is this current. | `504000.00 kA` |
| What 504000 actually is | S / (uk/100) = 504 MVA = 504000 kVA, the short-circuit power, not the current. | Labeled kA |
| Peak | IEC 60076-5 Table 4. k×√2 = 2.55 only at X/R = 14, and the “if not specified” note uses 2.55 for category II and 2.69 for category III. 2.55 × 1.265 kA ≈ 3.23 kA. | `3226.13 kA (×2.55)` which is 2.55 × 1265 A, labeled kA |
| I²t | (1265 A)² × 2 s ≈ 3.20×10⁶ A²·s. Thermal withstand in IEC 60076-5 uses current density and time, not this display. | `1789192510 A²·s` |

The I²t code does `1000 × I_sc × √t` and the screen multiplies by 1000 again. That is not I²t.

BIL is checked against an internal table labeled “IEC 60076-5 Table 2”. IEC 60076-5:2006 Table 2 is the system short-circuit power in MVA (for example 36 kV → 1000 MVA European practice), not lightning impulse. Lightning impulse levels are IEC 60076-3 Table 2. From the 2000 edition of that table:

- Um 36 kV: 145 kV and 170 kV. There is no 150 kV level. Their floor for 34.5 kV is 150 kV, so a real 145 kV level would fail. **Contradicted.**
- Um 12 kV includes 75 kV. Their table jumps from “≤ 1.1 kV → 10 kVp” to 24 kV → 125 kVp, so an 11 kV tertiary at 75 kVp (their own default) is rejected as undersized against the 24 kV class. **Contradicted.** The rendered error was: minimum BIL at 11 kV is 125 kVp.
- Several higher rows keep only the upper standard level (145 kV class stored as 650 kV, 170 kV class stored as 750 kV) and treat it as a minimum. IEC 60076-3 allows more than one level per Um. Using the higher one as a floor rejects a permitted lower level.

A three-winding uk% is split into equal thirds, with a note that says to verify it on the nameplate. That split is **displayed only**. IEC 60076-5 does not say to divide uk% by three.

uk% “typical bands” (for example 11–14% around a 12.5% target for large power) are **displayed only** and are cited to the wrong clause. They are not Table 1.

### Sample test report clause pins

The page says the numbers are illustrative. **Displayed only**, and safe to ignore as data.

Clause labels that conflict with the standards above: no-load loss is pinned to IEC 60076-1 §10. In IEC 60076-1:2011, clause 10 is tolerances and clause 11 is tests (no-load loss is 11.5, load loss and impedance are 11.4). Lightning impulse is pinned to IEC 60076-4 §7. Part 4 is a guide; the impulse requirements and levels are in IEC 60076-3. Short-circuit withstand is pinned to IEC 60076-5 §10. In the 2006 edition the calculation is clause 4 and the tables stop at Table 4 plus annexes. The other pins (60076-2, 60076-3 §10, 60076-10) were not checked line by line in this review.

## Claims and prices, with a source mark

### Engineering numbers

| Claim | Mark |
| --- | --- |
| I = S / (√3 · V) on both calculators | Sourced (arithmetic) |
| Autotransformer I_series = I_LV / a and I_common = I_LV × (a − 1) / a | Sourced (co-ratio) |
| S_eq = S_through × (1 − V_LV/V_HV) | Not computed. This is the formula a port should use. |
| N_series:N_common shown as ∞:1 on the 132/66 kV default | Contradicted |
| Z_LV = Z_HV / a² and Z_common = ((a − 1) / a)² · Z_HV, “IEC 60076-5 §3” | Contradicted |
| uk% must lie in 4.0–15.0 per IEC 60076-5 §4.1 | Contradicted. Table 1 is a minimum, clause 4.1 is the current calculation. |
| I_sc shown as 504000.00 kA for 63 MVA, 230 kV, 12.5% | Contradicted. The arithmetic is the 504 MVA short-circuit power. |
| Peak 3226.13 kA at a flat ×2.55 | Contradicted as a universal kA figure. 2.55 itself is Table 4 at X/R = 14, category II if X/R > 14 is unspecified. |
| I²t budget 1.789×10⁹ A²·s | Contradicted |
| BIL floors labeled IEC 60076-5 Table 2, including 150 kV at 36 kV class and 125 kV forced onto 11 kV | Contradicted. Levels live in IEC 60076-3; 150 kV is not a 36 kV level. |
| Equal-thirds uk% split | Displayed only (they say so) |
| “4 standards” / homepage list of 60076-1 §10, 60076-5, 60076-4 waveshape, and a thermal tab | Displayed only. The thermal tab is a picture. Temperature rise is not calculated. |
| Homepage nameplate 63/80 MVA, Dyn11, 230/34.5 kV, 12.5%, 38 kW no-load, 25 kA · 2 s, 650 kV BIL, “IEC 60076-5 OK” | Displayed only. It is a drawing, not a result of the calculator. 650 kV is a real IEC level for Um 145 kV, not a calculated BIL for 230 kV. |

### Intel and market sentences

| Claim | Mark |
| --- | --- |
| U.S. large-transformer price +20–50% since 2020 | Displayed only. No link on the card. |
| “IEC 60076-5 short-circuit compliance” is an active gate that withholds purchase orders | Displayed only |
| Daily brief at 06:30 UTC (homepage) and at 08:00 UTC (`/intel`) | Displayed only, and the two pages disagree |
| Archive back to 2024-Q3 | Contradicted. Oldest card is 22 Aug 2026. Sitemap `lastmod` on `/archive` and `/intel` is 22 Aug 2026. |
| 53 briefs | Matches a card per day from 22 Aug through 14 Oct. The count is real; the content is five paragraphs on a loop. |
| Tape items (FERC ER26-1142, GOES +2.1% “LME sub-index”, Hitachi Monterrey 765 kV bay, IEC TC14 ballot narrowing impedance tolerance to ±7.5%, Comex copper −0.8%, Toshiba backlog 1.42×) | Displayed only. The “OPEN” links go to `/#brief` on the same page, not to FERC, LME, or a press release. |
| Archive stories (list prices flat, GOES premium −3%, framework awards 3–4 weeks faster, “Tier-2 efficiency” draft for 100–2500 kVA, pad-mount lead time 14 to 22 weeks) | Displayed only. “Source” links are the homepages of IEA, Argus, Utility Dive, and IEC, not an article that says those things. |
| `GET /api/intel/latest` on 15 Oct 2026: “EU pad-mount production slots tighten…”, `sourceUrl` `https://www.iec.ch/about-us/news` | Contradicted. That IEC news index is not a source for a pad-mount lead-time claim. The public refresh button writes this row. |
| Homepage “U.S. DOE announces WAPA transformer buffer” / two 230/115 kV units through Q3 | Displayed only |

### Commercial and product sentences

| Claim | Mark |
| --- | --- |
| Brief $0, Studio $199/month, Masterclass $699/month, Consulting $1,999/month | Displayed only. Mailto, no checkout. |
| 3 cohorts / year, 8-week cohort, 60 min / month, 24-hour SLA, 14-day refund, reference designs 25–500 MVA | Displayed only |
| 3 PDF exports / month on the free tier, unlimited above it | Displayed only. Nothing counts exports. |
| NEMA and GOST parity modules in Studio | Displayed only. No such module is in the app. |
| Inputs never leave the browser (homepage FAQ) | Contradicted for export. PDF export POSTs the spec to `/api/pdf/document`. A beacon to `polsia.com/api/beacon/pixel` fired with a site id and a visitor id; the URL did not contain rating-plate fields. |
| `faq.html` localStorage note (`tanbrief:lastSpec:v1`, 500 ms debounce, 7-day expiry) | Sourced to their own bundle. That is an implementation detail, not a reason to keep the name. |
| Test-report sample, 40/50 MVA, 132/33 kV, pass/marginal rows | Displayed only. The page says the numbers are illustrative. |

## (a) Worth porting

Rough size means how much of our site has to change. No calendar estimate.

1. **Autotransformer sizing tool.** Our `autotransformer.html` is a 400/220 kV 3D model. `knowledge/autotransformer.html` explains the idea and does not compute the co-ratio. The design calculator only mentions an autotransformer in an EHV note. A buyer or designer still cannot get S_eq, series current, and common current from a pair of voltages. Port the idea: rated throughput, V_HV, V_LV, and the outputs S_eq = S × (1 − V_LV/V_HV), the three currents, and the turns split (a − 1):1. State that percent impedance is not divided by a², and do not ship their Z_common formula. Add a worked check at 100 MVA, 132/66 kV (50 MVA equivalent, 874.8 A, 437.4 A, 437.4 A, turns 1:1). **Size:** one static page and a small pure function with tests. It does not need the design-calculator core. Contact mailto, if any, is `hello@transformerpath.com`.

2. **Service lines beside the software plans.** **Rejected 15 October 2026.** the owner will not offer design-office support, a live cohort, consulting, calls, or teaching that needs the owner's time. `service-lines.html` and `test-lab-consulting.html` are removed. Do not add them back. The notes below are the research that led to that decision. Polsia is trying to sell human time: a design-office retainer, a live cohort, and a consulting engagement. We already sell software and courses (live pricing on 15 Oct 2026: Learning $199 / 12 months, Engineering Pro $599 / 12 months, Engineering Team $1,999 / 12 months, plus directory and event SKUs). We already have `test-lab-consulting.html`: three scoped services, “scoped per project”, form to `hello@transformerpath.com`, no public price. The gap is that design-office support and a live cohort are not named as services. **Size:** copy and a form on the existing consulting page, after a shape is chosen. Do not copy their feature matrix; most of those features are not built on either site.

   Options for the owner, with no price attached:

   - Keep services unpriced. Add named lines (design-office support, live cohort) next to the existing test-bay work, each “scoped from a written brief”.
   - Publish the names and “price on request”, still with no numeral, until the owner picks one.
   - Leave services as they are. The Polsia tiers are not evidence of a price.

   Do not adopt $199, $699, or $1,999 per month. $199 and $1,999 would sit on top of our yearly Learning and Team amounts and read as a monthly version of plans we already sell.

3. **A short nameplate-and-short-circuit sheet, only as a mode of our calculator.** Their `/tanbrief` page is a 30-second front door. Our calculator is a design workbench and already exports a PDF report, a rating plate, and a test report. A reduced input set (power, voltages, vector group, uk%, BIL) that runs our existing short-circuit math would be the useful slice. **Size:** a small mode on `calculator.html` if the current engine can accept that reduced set. Do not port their kernel, their BIL table, or their I²t code.

The TanBrief name is not part of item 3. It is the internal name of their PDF kernel and of a host that currently serves the Polsia company fallback. Our brand check forbids it on served pages.

## (b) Not worth porting

- The calculator and autotransformer JavaScript as written. The short-circuit display is off by unit and by formula, the BIL table cites the wrong IEC table, and the default vector group cannot be submitted.
- The daily brief, the archive, and `/api/intel/refresh`. Five recycled paragraphs, source links that do not support the sentences, and a false “back to 2024-Q3”. Our intel pages already require a source on each item.
- Academy, masterclass, and engineer-track stubs, including the unlocked-marker strings and the empty quiz. Our masterclass is 26 chapters plus the book path; the engineer track has four levels.
- NEMA/GOST “parity modules”, scenario libraries, white-label procurement packets, and the 24-hour SLA. They are sentences on a pricing card.
- The sample test report and its illustrative numbers and clause pins. We already have `test-report.html`.
- The PWA, the TanBrief manifest name, and `tanbrief:lastSpec:v1`.
- `tanbrief.polsia.app`. It is a Polsia marketing fallback, not a transformer tool.
- Any mailto to `transformerpath@polsia.app`.

## (c) Already covered on our site

Live checks on 15 October 2026 returned HTTP 200 for each of these. Repo pages exist for the same paths; the live pricing page is the fuller commercial list (the payments audit in `docs/payments-audit.md` is the Stripe-level detail).

| Polsia item | Where we already cover it |
| --- | --- |
| FAQ | `faq.html` — free tier, plans, the design calculator, books, verification, standards. |
| IEC 60076 calculator, PDF, rating plate | `calculator.html` (design workbench), rating-plate generator, PDF reports. Deeper than their kernel: core and windings, losses, leakage, thermal, BOM. |
| Test report | `test-report.html`. |
| Masterclass, academy, engineer track | `masterclass.html` (26 design chapters), `academy.html`, `engineer-track.html`. Sold as Learning / Pro / Team yearly access, not as a $699/month cohort. |
| Daily industry brief | `intel` and the dated intel pages. Items carry sources. Theirs does not replace this. |
| Autotransformer as a product page | `autotransformer.html` is the 3D series/common model. `knowledge/autotransformer.html` is the explainer. Sizing math is the gap in section (a), not a missing 3D view. |
| Consulting | Not offered. Rejected 15 October 2026. See `docs/proposals/service-lines-pricing.md`. |
| Directory, grids, events, tenders, standards, books, 3D suite | No Polsia equivalent. Live pricing also has supplier and procurement plans (Verified, Supplier Pro, Intel Pro, event featuring). Those are ours; Polsia does not offer them. |

## What not to do next

Do not copy a sentence from their homepage, archive, or test report into our intel or our calculator. Do not publish their tier prices. Do not point a canonical tag, sitemap, or manifest at `tanbrief.polsia.app`.
