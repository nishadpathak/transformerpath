-- TransformerPath Intel alert subscriptions (P4)
-- Run in Supabase SQL editor once. Used by:
--   functions/watchlist-subscribe.js
--   functions/watchlist-alerts.js

create table if not exists public.tp_intel_alert_subscriptions (
  email text primary key,
  presets text[] not null default '{}',
  keywords text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tp_intel_alert_subscriptions enable row level security;

-- Service-role (Netlify functions) bypasses RLS. No public anon writes.
