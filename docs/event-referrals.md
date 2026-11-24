# Paid registration referral links

The event edition page can show a second, clearly disclosed registration link next to the ordinary organizer website. This is separate from the paid Featured Event placement, from travel affiliate links, and from ticket checkout. The registry ships empty. Do not add an event merely because it sells tickets or offers media benefits.

To activate an edition:

1. Verify written organizer authorization for TransformerPath, qualifying paid registrations and payout terms. Confirm that the organizer-issued registration URL and hostname match the written terms. Complete separate approvals before accepting terms.
2. Add one object under `referrals` in `data/event-referrals.json`, keyed by the exact canonical edition ID, not a series or company name. Set `status` to `approved`, `registration_url` to the generic organizer-issued HTTPS URL, `approved_host` to its exact hostname, and `active_from` / `active_through` to inclusive ISO dates in the site's Dubai date convention. The end date must not exceed the event's final date. Do not store contracts, customer information, secret tokens, or personal links in the repository.
3. Generate a preview and verify the correct edition, both routes, nearby disclosure, and checkout attribution with a publisher/organizer-approved test plan. Do not add price, discount, payout rate, or guarantee copy unless independently approved and maintained.
4. Remove the entry and run the normal event rebuild and deployment when terms are withdrawn, registration closes, or approval lapses. The active window and current event status are checked at build time; a generated page changes only when rebuilt.

The calendar, series hubs, organic organizer link, payment configuration and analytics are unchanged. No new third-party script, form, or storage is introduced. Use organizer-side reporting and reconcile paid, non-refunded registrations under the written terms.
