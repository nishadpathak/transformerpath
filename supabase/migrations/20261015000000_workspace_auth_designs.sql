-- Stage 1 workspace: profile, saved calculator designs, and design revisions.
-- Compatible with the Learner Profile schema (profiles.public_name,
-- saved_designs, design_versions, policies profiles_own / designs_own / dver_own).
-- display_name, company, and role are additive profile columns.
-- profiles.role is the person's job, not account_roles.role.
-- Apply in the Supabase SQL editor or with `supabase db push`.
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  public_name text,
  display_name text,
  company text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists public_name text,
  add column if not exists display_name text,
  add column if not exists company text,
  add column if not exists role text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

comment on column public.profiles.public_name is
  'Display name kept in sync with display_name for the Learner Profile schema.';
comment on column public.profiles.display_name is
  'Name shown in the workspace.';
comment on column public.profiles.role is
  'Professional role (job). Not account_roles.role.';

create table if not exists public.saved_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  kind text default 'design',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.saved_designs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.design_versions
  add column if not exists revision integer,
  add column if not exists label text;

create index if not exists saved_designs_user_updated_idx
  on public.saved_designs (user_id, updated_at desc);
create index if not exists design_versions_design_idx
  on public.design_versions (design_id, revision desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists saved_designs_touch on public.saved_designs;
create trigger saved_designs_touch
  before update on public.saved_designs
  for each row execute function public.touch_updated_at();

create or replace function public.next_design_revision()
returns trigger
language plpgsql
as $$
begin
  if new.revision is null then
    select coalesce(max(revision), 0) + 1 into new.revision
    from public.design_versions
    where design_id = new.design_id;
  end if;
  return new;
end;
$$;

drop trigger if exists design_versions_revision on public.design_versions;
create trigger design_versions_revision
  before insert on public.design_versions
  for each row execute function public.next_design_revision();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  picked text;
begin
  picked := coalesce(
    nullif(coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'display_name', ''),
    nullif(coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'full_name', ''),
    nullif(coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'name', '')
  );
  insert into public.profiles (id, email, public_name, display_name)
  values (new.id, new.email, picked, picked)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

alter function public.handle_new_user() set row_security = off;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.saved_designs enable row level security;
alter table public.design_versions enable row level security;

alter table public.profiles force row level security;
alter table public.saved_designs force row level security;
alter table public.design_versions force row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists designs_own on public.saved_designs;
create policy designs_own on public.saved_designs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists dver_own on public.design_versions;
create policy dver_own on public.design_versions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.saved_designs d
      where d.id = design_id and d.user_id = auth.uid()
    )
  );

revoke all on table public.profiles from public, anon;
revoke all on table public.saved_designs from public, anon;
revoke all on table public.design_versions from public, anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.saved_designs to authenticated;
grant select, insert, update, delete on table public.design_versions to authenticated;
