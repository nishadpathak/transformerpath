/* TransformerPath — account model.
 *
 * Spine: User → Identity → Activity → Progress → Saved Work → Purchase → Workflow
 *        User → LearnerProfile → Org/Membership → Purchase → Entitlement
 *             → Plan / expiresAt → PathProgress / GridLabProgress / Skills / Certificates
 *
 * One User; combinable flags isLearner | isBuyer | isSupplier (Learner Profile,
 * never Student Profile). Stripe is the payment processor only. Access is an
 * account entitlement, readable cross-device. Browser localStorage is a cache.
 * Team is organization seats (max_members=10) — not a shared unlock link.
 *
 * APPLY_SQL is the DDL to run in the Supabase SQL editor. *.sql is gitignored
 * in this repo, so the schema lives here.
 *
 * Runnable:
 *   node apply-sql.js
 *   node apply-sql.js > /tmp/tp-apply.sql
 *   GET /.netlify/functions/apply-sql
 */
'use strict';

const ROLES = ['LEARNER', 'BUYER', 'SUPPLIER'];

const ONBOARDING_ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'graduate_engineer', label: 'Graduate Engineer' },
  { value: 'design_engineer', label: 'Design Engineer' },
  { value: 'manufacturing_engineer', label: 'Manufacturing Engineer' },
  { value: 'testing_engineer', label: 'Testing Engineer' },
  { value: 'service_engineer', label: 'Service Engineer' },
  { value: 'utility_engineer', label: 'Utility Engineer' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'sales_bd', label: 'Sales/BD' },
  { value: 'educator', label: 'Educator' },
  { value: 'other', label: 'Other' },
];

const ONBOARDING_EXPERIENCE = [
  { value: 'beginner', label: 'Beginning' },
  { value: 'practicing', label: 'Practicing' },
  { value: 'specialist', label: 'Specialist' },
];

const ONBOARDING_INTERESTS = [
  { value: 'design', label: 'Transformer design' },
  { value: 'grids', label: 'Grid systems' },
  { value: 'sourcing', label: 'Sourcing & RFQ' },
  { value: 'operations', label: 'Operations & assets' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'testing', label: 'Testing' },
  { value: 'other', label: 'Other' },
];

const SKILL_LEVELS = ['NOT STARTED', 'Developing', 'Intermediate', 'Advanced'];

const PLANS = {
  learning: {
    rank: 1, product: 'learning', label: 'Learning', months: 12,
    price_cents: 19900, max_members: 1,
    grants: { learning: true, professional: false, team: false },
  },
  learner: {
    rank: 1, product: 'learning', label: 'Learning', months: 12,
    price_cents: 19900, max_members: 1,
    grants: { learning: true, professional: false, team: false },
  },
  professional: {
    rank: 2, product: 'professional', label: 'Professional', months: 12,
    price_cents: 59900, max_members: 1,
    grants: { learning: true, professional: true, team: false },
  },
  team: {
    rank: 3, product: 'team', label: 'Team', months: 12,
    price_cents: 199900, max_members: 10,
    grants: { learning: true, professional: true, team: true },
  },
  enterprise: {
    rank: 3, product: 'team', label: 'Team', months: 12,
    price_cents: 199900, max_members: 10,
    grants: { learning: true, professional: true, team: true },
  },
};

const APPLY_SQL = `
-- TransformerPath identity + entitlement + learning spine (additive).
-- users = auth.users (Supabase Auth). Do not recreate.
-- Runnable: node apply-sql.js   OR   GET /.netlify/functions/apply-sql

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  public_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'personal', -- personal | company
  max_members integer not null default 1,
  created_at timestamptz not null default now()
);
alter table if exists public.organizations
  add column if not exists max_members integer not null default 1;

-- Canonical seat table. memberships is kept as a compatibility alias.
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  org_role text not null default 'member', -- owner | member
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  org_role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

insert into public.organization_members (user_id, org_id, org_role, created_at)
select user_id, org_id, org_role, created_at from public.memberships
on conflict (user_id, org_id) do nothing;

create table if not exists public.account_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('LEARNER','BUYER','SUPPLIER')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.learner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_name text,
  onboarding_role text,
  onboarding_interest text,
  onboarding_experience text,
  onboarding_done boolean not null default false,
  is_learner boolean not null default true,
  is_buyer boolean not null default false,
  is_supplier boolean not null default false,
  det_level text,
  updated_at timestamptz not null default now()
);
alter table if exists public.learner_profiles
  add column if not exists is_learner boolean not null default true,
  add column if not exists is_buyer boolean not null default false,
  add column if not exists is_supplier boolean not null default false,
  add column if not exists det_level text;

create table if not exists public.plans (
  id text primary key,           -- learning | professional | team
  label text not null,
  price_cents integer not null,
  currency text not null default 'usd',
  months integer not null default 12,
  grants_learning boolean not null default false,
  grants_professional boolean not null default false,
  grants_team boolean not null default false,
  max_members integer not null default 1
);
insert into public.plans (id, label, price_cents, grants_learning, grants_professional, grants_team, max_members)
values
  ('learning', 'Learning', 19900, true, false, false, 1),
  ('professional', 'Professional', 59900, true, true, false, 1),
  ('team', 'Team', 199900, true, true, true, 10)
on conflict (id) do update set
  label = excluded.label,
  price_cents = excluded.price_cents,
  grants_learning = excluded.grants_learning,
  grants_professional = excluded.grants_professional,
  grants_team = excluded.grants_team,
  max_members = excluded.max_members;

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

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  email text,
  product text not null,
  plan text,
  plan_key text,
  status text not null default 'active',
  access_start timestamptz,
  access_end timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table if exists public.entitlements
  add column if not exists org_id uuid,
  add column if not exists plan_key text,
  add column if not exists expires_at timestamptz,
  add column if not exists access_start timestamptz,
  add column if not exists access_end timestamptz,
  add column if not exists status text;

-- Learning catalog (seeded ids; content lives in data/learning-path.json).
create table if not exists public.courses (
  id text primary key,
  title text not null,
  kind text not null default 'path'
);
create table if not exists public.modules (
  id text primary key,
  course_id text not null references public.courses(id) on delete cascade,
  group_key text not null, -- FOUNDATIONS | DISTRIBUTION | POWER
  title text not null,
  sort_order integer not null default 0,
  href text
);
create table if not exists public.lessons (
  id text primary key,
  module_id text not null references public.modules(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  href text
);
insert into public.courses (id, title, kind) values
  ('transformer-path', 'My Learning Path', 'path'),
  ('design-engineer-track', 'Design Engineer Track', 'track')
on conflict (id) do nothing;

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  module_id text,
  status text not null default 'NOT STARTED',
  percent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course text not null,
  chapter text not null default '',
  status text not null default 'started',
  score integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, course, chapter)
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id text not null,
  answer_id text,
  correct boolean,
  created_at timestamptz not null default now()
);
create table if not exists public.assessment_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id text not null,
  passed boolean not null default false,
  score integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, assessment_id)
);

create table if not exists public.skills (
  id text primary key,
  name text not null,
  family text,
  how text
);
create table if not exists public.user_skills (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  level text not null default 'NOT STARTED', -- Developing | Intermediate | Advanced
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create table if not exists public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  kind text not null, -- lesson | assessment | calculation | grid_lab | capstone
  ref text,
  created_at timestamptz not null default now()
);
create table if not exists public.skill_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  level text not null default 'NOT STARTED',
  how_earned text,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists public.grid_lab_scenarios (
  id text primary key,
  title text not null,
  family text,
  skill_id text
);
create table if not exists public.grid_lab_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  percent integer not null default 0,
  status text not null default 'NOT STARTED',
  created_at timestamptz not null default now()
);
create table if not exists public.grid_lab_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  status text not null default 'NOT STARTED',
  percent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, scenario_id)
);

create table if not exists public.path_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  status text not null default 'NOT STARTED',
  percent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, path_id)
);

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
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,
  item_id text not null,
  title text,
  url text,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  item_type text,
  item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  how_earned text,
  kind text not null default 'learning_record',
  earned_at timestamptz not null default now(),
  primary key (user_id, slug)
);
create table if not exists public.completion_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  how_earned text,
  kind text not null default 'learning_record',
  earned_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create table if not exists public.webhook_events (
  event_id text primary key,
  event_type text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.memberships enable row level security;
alter table public.account_roles enable row level security;
alter table public.learner_profiles enable row level security;
alter table public.purchases enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_results enable row level security;
alter table public.user_skills enable row level security;
alter table public.skill_evidence enable row level security;
alter table public.skill_records enable row level security;
alter table public.grid_lab_progress enable row level security;
alter table public.grid_lab_sessions enable row level security;
alter table public.path_progress enable row level security;
alter table public.saved_designs enable row level security;
alter table public.design_versions enable row level security;
alter table public.projects enable row level security;
alter table public.saved_items enable row level security;
alter table public.notes enable row level security;
alter table public.certificates enable row level security;
alter table public.completion_records enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'profiles_own') then
    create policy profiles_own on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'org_members_own') then
    create policy org_members_own on public.organization_members for select using (auth.uid() = user_id);
  end if;
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
  if not exists (select 1 from pg_policies where policyname = 'lesson_own') then
    create policy lesson_own on public.lesson_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'attempt_own') then
    create policy attempt_own on public.assessment_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'result_own') then
    create policy result_own on public.assessment_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'user_skills_own') then
    create policy user_skills_own on public.user_skills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'evidence_own') then
    create policy evidence_own on public.skill_evidence for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'skills_own') then
    create policy skills_own on public.skill_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'gridlab_own') then
    create policy gridlab_own on public.grid_lab_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'glsess_own') then
    create policy glsess_own on public.grid_lab_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'path_own') then
    create policy path_own on public.path_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'designs_own') then
    create policy designs_own on public.saved_designs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'dver_own') then
    create policy dver_own on public.design_versions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'projects_own') then
    create policy projects_own on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'saved_own') then
    create policy saved_own on public.saved_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'notes_own') then
    create policy notes_own on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'certs_own') then
    create policy certs_own on public.certificates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'completion_own') then
    create policy completion_own on public.completion_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
`;

function flagsFromRoles(roles) {
  const set = {};
  (roles || []).forEach((r) => { set[String(r).toUpperCase()] = true; });
  return {
    isLearner: !!set.LEARNER || (!set.BUYER && !set.SUPPLIER),
    isBuyer: !!set.BUYER,
    isSupplier: !!set.SUPPLIER,
  };
}

function rolesFromFlags(flags) {
  const out = [];
  if (!flags || flags.isLearner !== false) out.push('LEARNER');
  if (flags && flags.isBuyer) out.push('BUYER');
  if (flags && flags.isSupplier) out.push('SUPPLIER');
  if (!out.length) out.push('LEARNER');
  return out;
}

function normalizePlan(plan) {
  const k = String(plan || '').toLowerCase();
  return PLANS[k] || null;
}

function grantsFromPlan(plan) {
  const p = normalizePlan(plan);
  if (!p) return { learning: false, professional: false, team: false };
  return Object.assign({ learning: false, professional: false, team: false }, p.grants || {});
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

function twelveMonthsFrom(iso) {
  const d = iso ? new Date(iso) : new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

const REQUIRED_TABLES = [
  'profiles', 'organizations', 'organization_members', 'plans', 'purchases',
  'entitlements', 'courses', 'modules', 'lessons', 'lesson_progress',
  'assessment_attempts', 'assessment_results', 'skills', 'user_skills',
  'skill_evidence', 'grid_lab_sessions', 'grid_lab_scenarios', 'saved_designs',
  'design_versions', 'projects', 'saved_items', 'notes', 'certificates',
  'completion_records',
];

module.exports = {
  ROLES, PLANS, APPLY_SQL, REQUIRED_TABLES, SKILL_LEVELS,
  ONBOARDING_ROLES, ONBOARDING_EXPERIENCE, ONBOARDING_INTERESTS,
  normalizePlan, isActiveEntitlement, bestEntitlement, hasMinPlan,
  flagsFromRoles, rolesFromFlags, grantsFromPlan, twelveMonthsFrom,
};
