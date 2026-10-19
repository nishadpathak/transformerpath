-- Student sign-up role, student badge, private student-ID review, and
-- learning-progress rows. profiles.role stays the job title.
-- signup_role is Student, Engineer, or Company.
-- A student_badge is set only by the academic-email rule or an admin review.
-- Apply after 20261015000000_workspace_auth_designs.sql.

alter table public.profiles
  add column if not exists signup_role text,
  add column if not exists student_badge boolean not null default false,
  add column if not exists student_badge_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_signup_role_chk'
  ) then
    alter table public.profiles
      add constraint profiles_signup_role_chk
      check (signup_role is null or signup_role in ('student', 'engineer', 'company'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_student_badge_source_chk'
  ) then
    alter table public.profiles
      add constraint profiles_student_badge_source_chk
      check (student_badge_source is null or student_badge_source in ('academic_email', 'id_review'));
  end if;
end $$;

comment on column public.profiles.signup_role is
  'Account choice at sign-up: student, engineer, or company. Not the job title in profiles.role.';
comment on column public.profiles.student_badge is
  'True only for a student with a university email or an approved student-ID review.';

create or replace function public.academic_email(address text)
returns boolean
language plpgsql
immutable
as $$
declare
  host text;
  labels text[];
  n int;
  last_label text;
  prev_label text;
begin
  if address is null then return false; end if;
  if address !~* '^[^@[:space:]]+@[a-z0-9.-]+$' then return false; end if;
  host := lower(split_part(btrim(address), '@', 2));
  host := regexp_replace(host, '\.$', '');
  if host = '' or host like '%..%' then return false; end if;
  labels := string_to_array(host, '.');
  n := coalesce(array_length(labels, 1), 0);
  if n < 2 then return false; end if;
  last_label := labels[n];
  prev_label := labels[n - 1];
  if last_label = 'edu' then return true; end if;
  if prev_label = 'edu' and last_label ~ '^[a-z]{2}$' then return true; end if;
  if prev_label = 'ac' and last_label ~ '^[a-z]{2}$' then return true; end if;
  return false;
end;
$$;

create table if not exists public.workspace_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_workspace_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_admins where user_id = auth.uid()
  );
$$;

alter function public.is_workspace_admin() set row_security = off;

create or replace function public.learning_section_allowed(level_id text, section_id text)
returns boolean
language sql
immutable
as $$
  select (level_id, section_id) in (
    ('level1', 'l1m1'),
    ('level1', 'l1m2'),
    ('level1', 'l1m3'),
    ('level1', 'l1m4'),
    ('level1', 'l1m5'),
    ('level1', 'l1m6'),
    ('level1', 'l1m7'),
    ('level1', 'l1m8')
  );
$$;

create table if not exists public.learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  level_id text not null,
  section_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, level_id, section_id)
);

create or replace function public.learning_progress_guard()
returns trigger
language plpgsql
as $$
begin
  if not public.learning_section_allowed(new.level_id, new.section_id) then
    raise exception 'unknown learning section';
  end if;
  if new.user_id is distinct from auth.uid() then
    raise exception 'learning progress is personal';
  end if;
  return new;
end;
$$;

drop trigger if exists learning_progress_guard on public.learning_progress;
create trigger learning_progress_guard
  before insert or update on public.learning_progress
  for each row execute function public.learning_progress_guard();

create table if not exists public.student_id_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  file_name text not null,
  content_type text not null,
  file_base64 text not null,
  byte_length integer not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  decision_note text,
  constraint student_id_reviews_status_chk check (status in ('pending', 'approved', 'rejected')),
  constraint student_id_reviews_type_chk check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint student_id_reviews_size_chk check (byte_length > 0 and byte_length <= 4000000)
);

create unique index if not exists student_id_reviews_one_pending
  on public.student_id_reviews (user_id)
  where status = 'pending';

create or replace function public.student_id_reviews_guard()
returns trigger
language plpgsql
as $$
declare
  decoded bytea;
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'a student ID belongs to the signed-in user';
    end if;
    if new.status is distinct from 'pending' then
      raise exception 'a new student ID review starts as pending';
    end if;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.decision_note := null;
  elsif tg_op = 'UPDATE' then
    if not public.is_workspace_admin() then
      raise exception 'only a workspace admin can review a student ID';
    end if;
    if new.file_base64 is distinct from old.file_base64
      or new.user_id is distinct from old.user_id
      or new.content_type is distinct from old.content_type
      or new.byte_length is distinct from old.byte_length
      or new.file_name is distinct from old.file_name then
      raise exception 'a review cannot replace the uploaded file';
    end if;
    if new.status not in ('approved', 'rejected') then
      raise exception 'a review is approved or rejected';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  begin
    decoded := decode(new.file_base64, 'base64');
  exception when others then
    raise exception 'student ID file is not base64';
  end;
  if octet_length(decoded) <> new.byte_length or octet_length(decoded) > 4000000 then
    raise exception 'student ID file is larger than 4 MB or the size does not match';
  end if;
  return new;
end;
$$;

drop trigger if exists student_id_reviews_guard on public.student_id_reviews;
create trigger student_id_reviews_guard
  before insert or update on public.student_id_reviews
  for each row execute function public.student_id_reviews_guard();

create or replace function public.apply_student_id_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.profiles
      set student_badge = true,
          student_badge_source = 'id_review'
      where id = new.user_id
        and signup_role = 'student';
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.profiles
      set student_badge = false,
          student_badge_source = null
      where id = new.user_id
        and student_badge_source = 'id_review';
  end if;
  return new;
end;
$$;

alter function public.apply_student_id_decision() set row_security = off;

drop trigger if exists student_id_reviews_decision on public.student_id_reviews;
create trigger student_id_reviews_decision
  after update on public.student_id_reviews
  for each row execute function public.apply_student_id_decision();

create or replace function public.protect_student_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_workspace_admin() then
    return new;
  end if;
  if new.signup_role is not null
    and new.signup_role not in ('student', 'engineer', 'company') then
    new.signup_role := old.signup_role;
  end if;
  if old.signup_role is not null and new.signup_role is distinct from old.signup_role then
    new.signup_role := old.signup_role;
  end if;
  if new.signup_role = 'student' and public.academic_email(new.email) then
    new.student_badge := true;
    new.student_badge_source := 'academic_email';
  else
    new.student_badge := old.student_badge;
    new.student_badge_source := old.student_badge_source;
  end if;
  return new;
end;
$$;

alter function public.protect_student_badge() set row_security = off;

drop trigger if exists profiles_protect_student_badge on public.profiles;
create trigger profiles_protect_student_badge
  before update on public.profiles
  for each row execute function public.protect_student_badge();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  picked text;
  role_choice text;
  badge boolean;
begin
  picked := coalesce(
    nullif(coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'display_name', ''),
    nullif(coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'full_name', ''),
    nullif(coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'name', '')
  );
  role_choice := coalesce(new.raw_user_meta_data, '{}'::jsonb)->>'signup_role';
  if role_choice not in ('student', 'engineer', 'company') then
    role_choice := null;
  end if;
  badge := role_choice = 'student' and public.academic_email(new.email);
  insert into public.profiles (
    id, email, public_name, display_name, signup_role, student_badge, student_badge_source
  )
  values (
    new.id,
    new.email,
    picked,
    picked,
    role_choice,
    badge,
    case when badge then 'academic_email' else null end
  )
  on conflict (id) do update set
    email = excluded.email,
    signup_role = coalesce(public.profiles.signup_role, excluded.signup_role),
    student_badge = public.profiles.student_badge or excluded.student_badge,
    student_badge_source = case
      when public.profiles.student_badge then public.profiles.student_badge_source
      when excluded.student_badge then excluded.student_badge_source
      else public.profiles.student_badge_source
    end;
  return new;
end;
$$;

alter function public.handle_new_user() set row_security = off;

alter table public.workspace_admins enable row level security;
alter table public.workspace_admins force row level security;
alter table public.learning_progress enable row level security;
alter table public.learning_progress force row level security;
alter table public.student_id_reviews enable row level security;
alter table public.student_id_reviews force row level security;

drop policy if exists workspace_admins_own on public.workspace_admins;
create policy workspace_admins_own on public.workspace_admins
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists progress_own on public.learning_progress;
create policy progress_own on public.learning_progress
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists student_id_owner_read on public.student_id_reviews;
create policy student_id_owner_read on public.student_id_reviews
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_workspace_admin());

drop policy if exists student_id_owner_insert on public.student_id_reviews;
create policy student_id_owner_insert on public.student_id_reviews
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists student_id_admin_update on public.student_id_reviews;
create policy student_id_admin_update on public.student_id_reviews
  for update
  to authenticated
  using (public.is_workspace_admin())
  with check (public.is_workspace_admin());

revoke all on table public.workspace_admins from public, anon;
revoke all on table public.learning_progress from public, anon;
revoke all on table public.student_id_reviews from public, anon;

grant select on table public.workspace_admins to authenticated;
grant select, insert, update, delete on table public.learning_progress to authenticated;
grant select, insert, update on table public.student_id_reviews to authenticated;
