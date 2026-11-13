# Transformer Tenders intake

`/tenders.html` is built from derived project and Intel records plus the curated file `data/tender-notices.json`. The page URL does not change.

## Daily refresh

The site rebuilds once a day at 06:00 UTC. `functions/daily-rebuild.js` posts to `TP_BUILD_HOOK_URL` when that variable is set. The Netlify build runs the Intel builders and then `node build-tenders.js`.

That command:

1. Merges `data/tender-notices.json` into `data/tenders.json`.
2. Recomputes every tender status from its close instant, or from a calendar day when the source names no clock time.
3. Republishes `/tenders.html`, `/tenders/<slug>/`, and the sitemap entries for those entity pages in the same deploy as Daily Intel.

A curator does not run a separate tender job. Add the row, commit it, and the next 06:00 UTC build picks it up. A manual deploy runs the same command sooner.

## Adding a row

Confirm the notice on the official portal first. Read the close time on that page. If the portal does not state a close time, leave the notice out.

Append one object to the `notices` array. Do not copy text from FreeTender, TenderShark, TenderDekho, Biddetail, or any other aggregator. Do not commit a bid PDF. The official source URL is a link, not a file in this repository.

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | TransformerPath wording. This becomes the page slug. |
| `buyer` | yes | Buyer named on the official notice. |
| `country` | yes | Country of the requirement. |
| `category` | yes | `supply`, `testing_equipment`, or `service`. |
| `official_reference` | yes | The portal's bid or tender number. |
| `close_at` | yes | Offset instant, such as `2026-11-28T11:00:00+05:30`. A bare date is rejected. |
| `official_source_url` | yes | HTTPS URL on an allowlisted portal. |
| `portal_timezone` | no | IANA zone of that portal. The builder fills it from the host when it is empty. |
| `date_found` | yes | `YYYY-MM-DD` when the curator first confirmed the notice. |
| `last_verified` | yes | `YYYY-MM-DD` when the curator last checked the portal. |
| `summary` | yes | Two to four original sentences. |

The build dedupes on official reference + buyer + country. If that key is incomplete it dedupes on the official URL. An existing record keeps its title and URL slug. Empty fields on that record are filled from the intake. The close instant, category, summary, and official link are taken from the intake.

A notice is skipped, and is never shown as open, when the URL is missing, is not on the allowlist, or is an aggregator. The same rule applies to derived records: without a verified official URL the status is not Open or Closing soon.

## Allowlisted hosts

GeM BidPlus (`bidplus.gem.gov.in`), CPPP eProcure (`eprocure.gov.in`), state NIC portals (`*.nic.in`, including UP eTender), POWERGRID (`*.powergrid.in`), Etimad, DEWA, the Bahrain Tender Board, Oman Nama and the Oman tender board, South Africa National Treasury eTenders, and TED.

## What the page shows

Open bids is the default. It lists Open and Closing soon rows, soonest close first. Each close that has an instant is shown in the portal's zone and in Asia/Dubai. Closed rows leave that view. Their entity pages stay up with a Closed banner and `noindex`, and they are removed from the sitemap.

Pipeline / record lists expected, evaluation, awarded, and undated rows in the existing regional groups. Filters on the open view are category, country, keyword (title, buyer, reference), and the confirmed-scope control.

## First seed, 13 November 2026

Included after a check of the official notice:

- CPRI Bengaluru test bench, `GEM/2026/B/8212405`, GeM BidPlus, bid end 28 November 2026 11:00 IST.
- POWERGRID Eastern Region-II CT analyzers, `GEM/2026/B/8222695`, published bid on `apps.powergrid.in`, bid end 27 November 2026 11:00 IST. No GeM BidPlus HTML page was found for this number, so the source is POWERGRID's own published bid. The PDF is not stored in the repository.
- GSECL Sikka test kit, `GEM/2026/B/8235664`, GeM BidPlus, bid end 27 November 2026 15:00 IST.

Left out:

- NLC winding-resistance kits, `GEM/2026/B/8239821`. No GeM BidPlus page for that number was available to confirm the close time.
- UPJVNL BDV kit, `2026_UPJVN_1206877_1`. The UP NIC portal did not return this tender id, so the close time is unconfirmed.
- Saudi Water Authority Khobar 5, Etimad 205032. Etimad itself did not confirm it.
