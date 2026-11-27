-- Optional factory-slot checklist on a signed-in RFQ copy.
-- NOT applied by CI. Do not run this against production from the build.
-- Apply in the Supabase SQL editor or with `supabase db push` only when
-- a reviewer asks for it.
--
-- The public RFQ form still posts to Netlify Forms and the site-inbox
-- notice. Those paths do not use this column. The browser inserts
-- factory_slot only when the checklist has a value, and it retries
-- without the column if the column is not there yet.
--
-- user_rfqs is the signed-in account table. This file does not create
-- that table. If the table is absent, the statement does nothing.

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_rfqs'
  ) then
    alter table public.user_rfqs
      add column if not exists factory_slot jsonb;
    comment on column public.user_rfqs.factory_slot is
      'Optional factory-slot checklist: written confirmation, spec-freeze date, and the supplier terms for a later design change. Absent when the checklist was left blank.';
  end if;
end $$;
