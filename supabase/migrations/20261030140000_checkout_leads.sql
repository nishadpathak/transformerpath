-- Checkout emails captured before a Stripe Payment Link redirect.
-- Anon may INSERT only. There is no SELECT, UPDATE, or DELETE policy.
-- The browser posts with Prefer: return=minimal so the insert does not
-- need a select policy. Apply in the Supabase SQL editor or with
-- `supabase db push`. This file is not applied by CI.
-- gen_random_uuid() is built into Postgres 13+, which Supabase runs.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

create table if not exists public.checkout_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  listing_slug text,
  product_name text,
  price_id text,
  page_path text,
  created_at timestamptz not null default now(),
  constraint checkout_leads_email_check check (
    char_length(email) between 3 and 160
    and position('@' in email) > 1
    and email !~ '[[:space:]]'
  )
);

comment on table public.checkout_leads is
  'Email entered at checkout so TransformerPath can follow up on incomplete purchases.';

alter table public.checkout_leads enable row level security;
alter table public.checkout_leads force row level security;

revoke all on table public.checkout_leads from public, anon, authenticated;
grant insert on table public.checkout_leads to anon;

drop policy if exists checkout_leads_anon_insert on public.checkout_leads;
create policy checkout_leads_anon_insert on public.checkout_leads
  for insert
  to anon
  with check (true);
