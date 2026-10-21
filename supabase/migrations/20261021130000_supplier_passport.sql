-- Supplier Qualification Passport and component availability drafts.
-- Apply after 20261015120000_student_access_progress.sql.
-- Reuses auth.users, public.profiles (the signed-in account), public.touch_updated_at(),
-- public.workspace_admins, and public.is_workspace_admin().
-- No price column. No personal-name column. No public document URL.
-- Anon has no privileges. Private documents are not readable by a granted buyer.
-- A supplier update of a verified claim is stored as a pending review.

create table if not exists public.supplier_passports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_slug text not null,
  legal_name text,
  registration_number text,
  registration_country text,
  factory_city text,
  factory_country text,
  manufacturing_evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_passports_owner_key unique (owner_id),
  constraint supplier_passports_slug_chk check (company_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table if not exists public.supplier_passport_claims (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.supplier_passports(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  field_key text not null,
  value_text text,
  source_url text,
  verification_status text not null default 'company-declared',
  expires_on date,
  pending_value_text text,
  pending_source_url text,
  pending_expires_on date,
  review_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_passport_claims_field_chk check (
    field_key in (
      'registration', 'factory', 'certification', 'test_facility',
      'product_range', 'manufacturing_evidence', 'export_market', 'document'
    )
  ),
  constraint supplier_passport_claims_status_chk check (
    verification_status in ('verified', 'company-declared', 'unverified')
  ),
  constraint supplier_passport_claims_review_chk check (
    review_status in ('none', 'pending_review', 'rejected')
  ),
  constraint supplier_passport_claims_source_chk check (
    value_text is null or source_url ~ '^https?://'
  )
);

create table if not exists public.supplier_passport_documents (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.supplier_passports(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  storage_path text not null,
  expires_on date,
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  constraint supplier_passport_documents_visibility_chk check (visibility in ('private', 'buyer_granted')),
  constraint supplier_passport_documents_path_chk check (storage_path !~* '^https?://')
);

create table if not exists public.supplier_passport_access (
  passport_id uuid not null references public.supplier_passports(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (passport_id, buyer_id)
);

create table if not exists public.component_availability_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_slug text not null,
  category text not null,
  specs text,
  availability text not null default 'unspecified',
  quantity numeric,
  unit text,
  dispatch_country text,
  earliest_shipment date,
  moq numeric,
  verification_status text not null default 'company-declared',
  last_confirmed date,
  source_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint component_availability_slug_chk check (company_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint component_availability_state_chk check (availability in ('stated', 'limited', 'unspecified')),
  constraint component_availability_status_chk check (
    verification_status in ('verified', 'company-declared', 'unverified')
  ),
  constraint component_availability_qty_chk check (quantity is null or quantity >= 0),
  constraint component_availability_moq_chk check (moq is null or moq >= 0),
  constraint component_availability_source_chk check (
    source_url is null or source_url ~ '^https?://'
  )
);

drop trigger if exists supplier_passports_touch on public.supplier_passports;
create trigger supplier_passports_touch
  before update on public.supplier_passports
  for each row execute function public.touch_updated_at();

drop trigger if exists supplier_passport_claims_touch on public.supplier_passport_claims;
create trigger supplier_passport_claims_touch
  before update on public.supplier_passport_claims
  for each row execute function public.touch_updated_at();

drop trigger if exists component_availability_touch on public.component_availability_listings;
create trigger component_availability_touch
  before update on public.component_availability_listings
  for each row execute function public.touch_updated_at();

create or replace function public.supplier_passport_claim_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_workspace_admin() then
      if new.owner_id is distinct from auth.uid() then
        raise exception 'a passport claim belongs to the signed-in supplier';
      end if;
      if new.verification_status = 'verified' then
        raise exception 'verified claims are reviewed by an admin';
      end if;
      new.pending_value_text := null;
      new.pending_source_url := null;
      new.pending_expires_on := null;
      new.review_status := 'none';
    end if;
    return new;
  end if;

  if not public.is_workspace_admin() then
    if new.owner_id is distinct from old.owner_id or new.passport_id is distinct from old.passport_id then
      raise exception 'a passport claim cannot move';
    end if;
    if old.verification_status = 'verified' then
      if new.value_text is distinct from old.value_text
        or new.source_url is distinct from old.source_url
        or new.expires_on is distinct from old.expires_on
        or new.field_key is distinct from old.field_key then
        new.pending_value_text := new.value_text;
        new.pending_source_url := new.source_url;
        new.pending_expires_on := new.expires_on;
        new.value_text := old.value_text;
        new.source_url := old.source_url;
        new.expires_on := old.expires_on;
        new.field_key := old.field_key;
        new.review_status := 'pending_review';
      end if;
      new.verification_status := 'verified';
    else
      if new.verification_status = 'verified' then
        raise exception 'verified claims are reviewed by an admin';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_passport_claim_guard on public.supplier_passport_claims;
create trigger supplier_passport_claim_guard
  before insert or update on public.supplier_passport_claims
  for each row execute function public.supplier_passport_claim_guard();

create or replace function public.apply_supplier_claim_review(claim_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_admin() then
    raise exception 'only a workspace admin can review a verified claim';
  end if;
  if decision = 'accept' then
    update public.supplier_passport_claims
      set value_text = coalesce(pending_value_text, value_text),
          source_url = coalesce(pending_source_url, source_url),
          expires_on = coalesce(pending_expires_on, expires_on),
          pending_value_text = null,
          pending_source_url = null,
          pending_expires_on = null,
          review_status = 'none',
          verification_status = 'verified'
      where id = claim_id;
  elsif decision = 'reject' then
    update public.supplier_passport_claims
      set pending_value_text = null,
          pending_source_url = null,
          pending_expires_on = null,
          review_status = 'rejected'
      where id = claim_id;
  else
    raise exception 'a review is accept or reject';
  end if;
end;
$$;

alter function public.apply_supplier_claim_review(uuid, text) set row_security = off;

create or replace function public.component_availability_guard()
returns trigger
language plpgsql
as $$
begin
  if new.category ~* '\min stock\M' or new.category ~* '\mguaranteed\M' or new.category ~* '\mready to ship\M'
    or coalesce(new.specs, '') ~* '\min stock\M' or coalesce(new.specs, '') ~* '\mguaranteed\M'
    or coalesce(new.specs, '') ~* '\mready to ship\M' or coalesce(new.specs, '') ~* '\mavailable immediately\M' then
    raise exception 'a listing cannot guarantee stock';
  end if;
  if not public.is_workspace_admin() then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'a listing belongs to the signed-in supplier';
    end if;
    if new.verification_status = 'verified' then
      raise exception 'verified listings are reviewed by an admin';
    end if;
    new.published := false;
  end if;
  return new;
end;
$$;

drop trigger if exists component_availability_guard on public.component_availability_listings;
create trigger component_availability_guard
  before insert or update on public.component_availability_listings
  for each row execute function public.component_availability_guard();

-- Security definer lookups so passport and access policies do not recurse.
create or replace function public.supplier_passport_is_owner(passport uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supplier_passports
    where id = passport and owner_id = auth.uid()
  );
$$;

alter function public.supplier_passport_is_owner(uuid) set row_security = off;

create or replace function public.supplier_passport_is_granted(passport uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supplier_passport_access
    where passport_id = passport and buyer_id = auth.uid()
  );
$$;

alter function public.supplier_passport_is_granted(uuid) set row_security = off;

alter table public.supplier_passports enable row level security;
alter table public.supplier_passport_claims enable row level security;
alter table public.supplier_passport_documents enable row level security;
alter table public.supplier_passport_access enable row level security;
alter table public.component_availability_listings enable row level security;

alter table public.supplier_passports force row level security;
alter table public.supplier_passport_claims force row level security;
alter table public.supplier_passport_documents force row level security;
alter table public.supplier_passport_access force row level security;
alter table public.component_availability_listings force row level security;

drop policy if exists supplier_passports_select on public.supplier_passports;
create policy supplier_passports_select on public.supplier_passports
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_workspace_admin()
    or public.supplier_passport_is_granted(id)
  );

drop policy if exists supplier_passports_insert on public.supplier_passports;
create policy supplier_passports_insert on public.supplier_passports
  for insert to authenticated
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passports_update on public.supplier_passports;
create policy supplier_passports_update on public.supplier_passports
  for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin())
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passports_delete on public.supplier_passports;
create policy supplier_passports_delete on public.supplier_passports
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passport_claims_select on public.supplier_passport_claims;
create policy supplier_passport_claims_select on public.supplier_passport_claims
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_workspace_admin()
    or (
      verification_status in ('verified', 'company-declared')
      and public.supplier_passport_is_granted(passport_id)
    )
  );

drop policy if exists supplier_passport_claims_insert on public.supplier_passport_claims;
create policy supplier_passport_claims_insert on public.supplier_passport_claims
  for insert to authenticated
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passport_claims_update on public.supplier_passport_claims;
create policy supplier_passport_claims_update on public.supplier_passport_claims
  for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin())
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passport_claims_delete on public.supplier_passport_claims;
create policy supplier_passport_claims_delete on public.supplier_passport_claims
  for delete to authenticated
  using (
    public.is_workspace_admin()
    or (owner_id = auth.uid() and verification_status <> 'verified')
  );

drop policy if exists supplier_passport_documents_select on public.supplier_passport_documents;
create policy supplier_passport_documents_select on public.supplier_passport_documents
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_workspace_admin()
    or (
      visibility = 'buyer_granted'
      and public.supplier_passport_is_granted(passport_id)
    )
  );

drop policy if exists supplier_passport_documents_write on public.supplier_passport_documents;
create policy supplier_passport_documents_write on public.supplier_passport_documents
  for insert to authenticated
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passport_documents_update on public.supplier_passport_documents;
create policy supplier_passport_documents_update on public.supplier_passport_documents
  for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin())
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passport_documents_delete on public.supplier_passport_documents;
create policy supplier_passport_documents_delete on public.supplier_passport_documents
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists supplier_passport_access_select on public.supplier_passport_access;
create policy supplier_passport_access_select on public.supplier_passport_access
  for select to authenticated
  using (
    buyer_id = auth.uid()
    or public.is_workspace_admin()
    or public.supplier_passport_is_owner(passport_id)
  );

drop policy if exists supplier_passport_access_insert on public.supplier_passport_access;
create policy supplier_passport_access_insert on public.supplier_passport_access
  for insert to authenticated
  with check (
    public.is_workspace_admin()
    or public.supplier_passport_is_owner(passport_id)
  );

drop policy if exists supplier_passport_access_delete on public.supplier_passport_access;
create policy supplier_passport_access_delete on public.supplier_passport_access
  for delete to authenticated
  using (
    public.is_workspace_admin()
    or public.supplier_passport_is_owner(passport_id)
  );

drop policy if exists component_availability_select on public.component_availability_listings;
create policy component_availability_select on public.component_availability_listings
  for select to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists component_availability_insert on public.component_availability_listings;
create policy component_availability_insert on public.component_availability_listings
  for insert to authenticated
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists component_availability_update on public.component_availability_listings;
create policy component_availability_update on public.component_availability_listings
  for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin())
  with check (owner_id = auth.uid() or public.is_workspace_admin());

drop policy if exists component_availability_delete on public.component_availability_listings;
create policy component_availability_delete on public.component_availability_listings
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin());

revoke all on table public.supplier_passports from public, anon, authenticated;
revoke all on table public.supplier_passport_claims from public, anon, authenticated;
revoke all on table public.supplier_passport_documents from public, anon, authenticated;
revoke all on table public.supplier_passport_access from public, anon, authenticated;
revoke all on table public.component_availability_listings from public, anon, authenticated;

grant select, insert, update, delete on table public.supplier_passports to authenticated;
grant select, insert, update, delete on table public.supplier_passport_claims to authenticated;
grant select, insert, update, delete on table public.supplier_passport_documents to authenticated;
grant select, insert, update, delete on table public.supplier_passport_access to authenticated;
grant select, insert, update, delete on table public.component_availability_listings to authenticated;

revoke all on function public.apply_supplier_claim_review(uuid, text) from public, anon;
grant execute on function public.apply_supplier_claim_review(uuid, text) to authenticated;
