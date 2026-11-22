-- Quote requests from directory maker profiles.
-- Anon may INSERT only. There is no SELECT, UPDATE, or DELETE policy.
-- The browser posts with Prefer: return=minimal. Apply in the Supabase
-- SQL editor or with `supabase db push`. This file is not applied by CI.
--
-- Nothing here sends email. forward_blocked is set by a trigger from
-- private.quote_outreach_flags (never_contact / do_not_contact slugs).
-- Those requests stay in this table and are not for forwarding.
-- The trigger function is security definer in the private schema, with
-- search_path empty and execute revoked from the API roles.
--
-- Count requests per week (run in the SQL editor as the table owner):
--
--   select date_trunc('week', created_at) as week_start,
--          maker_slug,
--          count(*) as requests,
--          count(*) filter (where forward_blocked) as not_for_forwarding
--   from public.quote_requests
--   group by 1, 2
--   order by 1 desc, 3 desc;
--
-- The view public.quote_requests_by_week is the same grouping. It runs
-- as the invoker (security_invoker) and is not granted to anon or authenticated.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.quote_outreach_flags (
  slug text primary key,
  never_contact boolean not null default true
);

alter table private.quote_outreach_flags enable row level security;
alter table private.quote_outreach_flags force row level security;
revoke all on table private.quote_outreach_flags from public, anon, authenticated;

insert into private.quote_outreach_flags (slug, never_contact) values
  ('accord-transformer-and-switchgear-ltd', true),
  ('advance-rub-cork-international', true),
  ('aks-international-fzc', true),
  ('anuriti-electricals-and-switchgears', true),
  ('anushree-electrical-engineers-pvt-ltd', true),
  ('apex-valves', true),
  ('bf-s-r-l', true),
  ('cbs-technologies', true),
  ('chirab-technologies', true),
  ('core-energy-electromechanical-works', true),
  ('corticeira-amorim', true),
  ('diwan-ltd-co-rayan', true),
  ('drise-power-infratech-pvt-ltd', true),
  ('duraflux-transformers', true),
  ('e-m-electro-machnicals-pvt-ltd', true),
  ('fibre-and-fibre-technologies-india-pvt-ltd', true),
  ('gennex-transformers-pvt-ltd', true),
  ('grand-polycoats', true),
  ('hetvi-enterprise', true),
  ('huaihua-chuyuan-paper-products-co-ltd', true),
  ('huisheng-group-co-ltd', true),
  ('impedance-electrical-power-pvt-ltd', true),
  ('j-p-transformers', true),
  ('lamtuf-limited', true),
  ('modern-electric-systems', true),
  ('nucon-switch-gears-pvt-ltd', true),
  ('nuvanta-radiators-pvt-ltd', true),
  ('phitech-solutions', true),
  ('powerstar-electricals-limited', true),
  ('prabha-bidyut-opc-pvt-ltd', true),
  ('rancan-srl', true),
  ('shirat-radiators-pvt-ltd', true),
  ('sruti-copper-pvt-ltd', true),
  ('tekuncorked', true),
  ('thermo-engineers-pvt-ltd', true),
  ('urja-mac', true),
  ('vaidehi-enterprise', true),
  ('vidyut-impex', true),
  ('western-electricals', true),
  ('xujue-electrical-co-ltd', true)
on conflict (slug) do update set never_contact = excluded.never_contact;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  maker_slug text not null,
  maker_name text,
  maker_kind text not null,
  name text not null,
  company text,
  email text not null,
  country text,
  product text not null,
  voltage_mva text,
  quantity text,
  timeline text,
  message text,
  page_path text,
  bot_field text,
  forward_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint quote_requests_slug_check check (maker_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint quote_requests_kind_check check (maker_kind in ('manufacturers', 'accessories')),
  constraint quote_requests_email_check check (
    char_length(email) between 3 and 160
    and position('@' in email) > 1
    and email !~ '[[:space:]]'
  )
);

create index if not exists quote_requests_created_at_idx on public.quote_requests (created_at);
create index if not exists quote_requests_maker_slug_idx on public.quote_requests (maker_slug);

comment on table public.quote_requests is
  'Buyer quote requests logged for TransformerPath. Not emailed to the maker.';

alter table public.quote_requests enable row level security;
alter table public.quote_requests force row level security;
revoke all on table public.quote_requests from public, anon, authenticated;
grant insert on table public.quote_requests to anon;

drop policy if exists quote_requests_anon_insert on public.quote_requests;
create policy quote_requests_anon_insert on public.quote_requests
  for insert
  to anon
  with check (true);

drop trigger if exists quote_requests_before_insert on public.quote_requests;
drop function if exists public.quote_requests_before_insert();

create or replace function private.quote_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bot_field is not null and pg_catalog.length(pg_catalog.btrim(new.bot_field)) > 0 then
    return null;
  end if;
  new.bot_field := null;
  new.forward_blocked := exists (
    select 1 from private.quote_outreach_flags f
    where f.slug = new.maker_slug and f.never_contact
  );
  return new;
end $$;

revoke execute on function private.quote_requests_before_insert() from public, anon, authenticated;

create trigger quote_requests_before_insert
  before insert on public.quote_requests
  for each row execute function private.quote_requests_before_insert();

create or replace view public.quote_requests_by_week
with (security_invoker = true) as
select pg_catalog.date_trunc('week', created_at) as week_start,
       maker_slug,
       count(*) as requests,
       count(*) filter (where forward_blocked) as not_for_forwarding
from public.quote_requests
group by 1, 2;

revoke all on table public.quote_requests_by_week from public, anon, authenticated;
