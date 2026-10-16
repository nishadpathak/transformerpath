-- Paid commercial listings written by functions/stripe-webhook.js.
-- Service role only. Anonymous and authenticated roles have no access.
-- Prefer supabase/migrations/20261016150000_payments_tables.sql. That
-- migration also creates entitlements and webhook_events, and it drops
-- paid_listings_product_check. An older copy of this file limited product
-- to verified_manufacturer and featured_event, which rejects the other
-- products the webhook writes. Do not add that check back.
-- Run once in the Supabase SQL editor. Do not commit keys.

create table if not exists public.paid_listings (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  product text not null,
  company_slug text,
  event_id text,
  email text,
  amount integer,
  currency text,
  livemode boolean not null default false,
  status text not null default 'paid_pending_verification',
  created_at timestamptz not null default now(),
  constraint paid_listings_session_id_key unique (session_id),
  constraint paid_listings_status_check check (status in ('paid_pending_verification', 'verified', 'rejected', 'refunded'))
);

alter table public.paid_listings enable row level security;

revoke all on table public.paid_listings from public;
revoke all on table public.paid_listings from anon;
revoke all on table public.paid_listings from authenticated;

-- No policies. anon and authenticated cannot select, insert, update, or delete.
-- The Supabase service role bypasses RLS and is the only writer (the webhook).
