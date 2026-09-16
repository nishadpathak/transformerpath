/* TransformerPath — account model (User → Organization → Membership →
 * Purchase → Entitlement → Plan → Expiry).
 *
 * Stripe is the payment processor only. Access is an account entitlement,
 * readable cross-device. Browser localStorage is a cache, never the grant.
 * Team is organization seats — not a shared unlock link.
 *
 * APPLY_SQL is the DDL to run in the Supabase SQL editor. *.sql is gitignored
 * in this repo, so the schema lives here.
 */
'use strict';

const ROLES = ['LEARNER', 'BUYER', 'SUPPLIER'];
const PLANS = {
  learning: { rank: 1, product: 'learning', label: 'Learning', months: 12 },
  learner: { rank: 1, product: 'learning', label: 'Learning', months: 12 },
  professional: { rank: 2, product: 'professional', label: 'Professional', months: 12 },
  team: { rank: 3, product: 'team', label: 'Team', months: 12 },
  enterprise: { rank: 3, product: 'team', label: 'Team', months: 12 },
};

const APPLY_SQL = `
-- TransformerPath identity + entitlement (additive; existing tables kept).
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'personal', -- personal | company
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  org_role text not null default 'member', -- owner | member
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create table if not exists public.account_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('LEARNER','BUYER','SUPPLIER')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.learner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_name text,
  onboarding_role text,      -- engineer | student | buyer | supplier | other
  onboarding_interest text,  -- design | grids | sourcing | operations | other
  onboarding_experience text,-- beginner | practicing | specialist
  onboarding_done boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  email text,
  stripe_session_id text unique,
  stripe_customer_id text,
  product text not null,
  plan text not null,
  amount integer,
  currency text default 'usd',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

-- entitlements already exists in some environments (email,product unique).
-- Additive columns are applied if missing.
alter table if exists public.entitlements
  add column if not exists org_id uuid,
  add column if not exists plan_key text,
  add column if not exists expires_at timestamptz;

create table if not exists public.grid_lab_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  status text not null default 'NOT STARTED', -- NOT STARTED | IN PROGRESS | COMPLETE
  percent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, scenario_id)
);

create table if not exists public.skill_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  level text not null default 'NOT STARTED',
  how_earned text,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.account_roles enable row level security;
alter table public.learner_profiles enable row level security;
alter table public.purchases enable row level security;
alter table public.grid_lab_progress enable row level security;
alter table public.skill_records enable row level security;

-- Owner-read policies (service role bypasses RLS for Stripe writes).
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'memberships_own') then
    create policy memberships_own on public.memberships for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'roles_own') then
    create policy roles_own on public.account_roles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'learner_own') then
    create policy learner_own on public.learner_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'purchases_own') then
    create policy purchases_own on public.purchases for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gridlab_own') then
    create policy gridlab_own on public.grid_lab_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'skills_own') then
    create policy skills_own on public.skill_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
`;

function normalizePlan(plan) {
  const k = String(plan || '').toLowerCase();
  return PLANS[k] || null;
}

function isActiveEntitlement(row, now) {
  if (!row) return false;
  const status = String(row.status || '').toLowerCase();
  if (status && status !== 'active') return false;
  now = now || Date.now();
  const end = row.access_end || row.expires_at || row.expiry;
  if (end) {
    const t = Date.parse(end);
    if (!isNaN(t) && t < now) return false;
  }
  return true;
}

function bestEntitlement(rows) {
  let best = null;
  (rows || []).forEach((r) => {
    if (!isActiveEntitlement(r)) return;
    const p = normalizePlan(r.plan_key || r.plan || r.product);
    if (!p) return;
    if (!best || p.rank > best.rank) best = Object.assign({ row: r }, p);
  });
  return best;
}

function hasMinPlan(entitlement, min) {
  const need = normalizePlan(min);
  if (!need) return false;
  if (!entitlement) return false;
  return (entitlement.rank || 0) >= need.rank;
}

module.exports = {
  ROLES, PLANS, APPLY_SQL, normalizePlan, isActiveEntitlement, bestEntitlement, hasMinPlan,
};
