-- Payment tables written by functions/stripe-webhook.js via
-- functions/lib/supabase-server.js (service role).
--
--   entitlements    upsert on (user_id, product)
--   paid_listings   upsert on session_id
--   webhook_events  insert keyed by event_id
--
-- Idempotent. Paste into the Supabase SQL editor, or use
-- `supabase db push`. See docs/supabase-apply.md.
--
-- Drift (this file does not copy those definitions):
-- * sql/paid_listings.sql used to constrain product to
--   verified_manufacturer and featured_event. The webhook also writes
--   featured_exhibitor, hosted_webinar, job_standard, job_featured,
--   job_bundle_5, rfq_lead, rfq_lead_pro, and supplier_pro. The
--   surrogate id column from that script is kept. The narrow product
--   check is dropped below if a database already has it. The status
--   check matches that script and still allows the webhook's
--   paid_pending_verification.
-- * The header comment in functions/stripe-webhook.js describes
--   account_entitlements (plan_id, starts_at, expires_at, stripe_*).
--   writeEntitlement writes public.entitlements: user_id, product, plan,
--   access_start, access_end, status, plus created_at and updated_at.
-- * functions/entitle.js also inserts public.payments and upserts
--   entitlements on (email, product) with an email column. The webhook
--   does not. This migration does not add that table or column.
-- * supabase.js TP.getEntitlements reads profiles.plan, not this table.
--
-- Row level security is on. Authenticated users may SELECT their own
-- entitlement rows. There is no anon or authenticated write policy.
-- The service role bypasses RLS and is the writer.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

create table if not exists public.entitlements (
  user_id uuid not null,
  product text not null,
  plan text,
  access_start timestamptz,
  access_end timestamptz,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entitlements_user_id_product_key unique (user_id, product)
);

alter table public.entitlements
  add column if not exists plan text,
  add column if not exists access_start timestamptz,
  add column if not exists access_end timestamptz,
  add column if not exists status text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entitlements_user_id_product_key'
  ) then
    alter table public.entitlements
      add constraint entitlements_user_id_product_key unique (user_id, product);
  end if;
end $$;

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
  component text,
  created_at timestamptz not null default now(),
  constraint paid_listings_session_id_key unique (session_id),
  constraint paid_listings_status_check check (
    status in ('paid_pending_verification', 'verified', 'rejected', 'refunded')
  )
);

alter table public.paid_listings
  add column if not exists company_slug text,
  add column if not exists event_id text,
  add column if not exists email text,
  add column if not exists amount integer,
  add column if not exists currency text,
  add column if not exists livemode boolean not null default false,
  add column if not exists status text not null default 'paid_pending_verification',
  add column if not exists component text,
  add column if not exists created_at timestamptz not null default now();

alter table public.paid_listings drop constraint if exists paid_listings_product_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'paid_listings_session_id_key'
  ) then
    alter table public.paid_listings
      add constraint paid_listings_session_id_key unique (session_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'paid_listings_status_check'
  ) then
    alter table public.paid_listings
      add constraint paid_listings_status_check
      check (status in ('paid_pending_verification', 'verified', 'rejected', 'refunded'));
  end if;
end $$;

create table if not exists public.webhook_events (
  event_id text primary key,
  event_type text,
  created_at timestamptz not null default now()
);

alter table public.webhook_events
  add column if not exists event_type text,
  add column if not exists created_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entitlements_touch on public.entitlements;
create trigger entitlements_touch
  before update on public.entitlements
  for each row execute function public.touch_updated_at();

alter table public.entitlements enable row level security;
alter table public.paid_listings enable row level security;
alter table public.webhook_events enable row level security;

alter table public.entitlements force row level security;
alter table public.paid_listings force row level security;
alter table public.webhook_events force row level security;

drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.entitlements from public, anon, authenticated;
revoke all on table public.paid_listings from public, anon, authenticated;
revoke all on table public.webhook_events from public, anon, authenticated;

grant select on table public.entitlements to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.entitlements to service_role;
    grant all on table public.paid_listings to service_role;
    grant all on table public.webhook_events to service_role;
  end if;
end $$;
