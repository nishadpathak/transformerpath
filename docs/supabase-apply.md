# Apply the payment tables

`functions/stripe-webhook.js` writes three tables through the service-role client in `functions/lib/supabase-server.js`:

- `entitlements` — one row per user and product (`onConflict: 'user_id,product'`)
- `paid_listings` — one row per Checkout session (`onConflict: 'session_id'`)
- `webhook_events` — one row per Stripe event id (`event_id` primary key)

The SQL is `supabase/migrations/20261016150000_payments_tables.sql`. It uses `create table if not exists` and is safe to run more than once.

## SQL editor

1. Open the Supabase project that `SUPABASE_URL` points at. The committed `supabase-config.js` ships with an empty URL, so this file does not name a project.
2. Go to **SQL Editor** → **New query**.
3. Paste the whole migration file. Do not paste a service-role key, a database password, or any other secret.
4. Run the query.

`sql/paid_listings.sql` is the older listing-only script. Prefer this migration. It creates the entitlement and webhook tables as well, and it drops `paid_listings_product_check` if that older script was applied.

Row level security is enabled on all three tables. Authenticated users can `select` their own `entitlements` rows (`user_id = auth.uid()`). There is no insert, update, or delete policy for `anon` or `authenticated`. The webhook uses the service role, which bypasses row level security.

## Drift the migration does not copy

- `sql/paid_listings.sql` previously allowed only `verified_manufacturer` and `featured_event`. The webhook also stores `featured_exhibitor`, `hosted_webinar`, `job_standard`, `job_featured`, `job_bundle_5`, `rfq_lead`, `rfq_lead_pro`, and `supplier_pro`. The status check is unchanged (`paid_pending_verification`, `verified`, `rejected`, `refunded`). The `id uuid` primary key from that script is kept; the webhook upserts on `session_id`.
- The comment at the top of `functions/stripe-webhook.js` describes `account_entitlements` (`plan_id`, `starts_at`, `expires_at`, Stripe ids). The handler writes `public.entitlements` (`user_id`, `product`, `plan`, `access_start`, `access_end`, `status`, plus `created_at` and `updated_at`).
- `functions/entitle.js` inserts `public.payments` and upserts `entitlements` on `(email, product)`, including an `email` column. The webhook does not. This migration does not add that table or column.
- `supabase.js` `TP.getEntitlements` reads `profiles.plan`, not `entitlements`.
