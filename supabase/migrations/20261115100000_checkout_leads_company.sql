-- Optional company name on checkout leads.
-- The 20261030140000 migration creates checkout_leads. Apply that first.
-- This file is not applied by CI. Paste it in the Supabase SQL editor
-- or run `supabase db push`. Anon stays insert-only.
--
-- client_reference_id is the lead id, or lead-id:slug when a listing is named.
-- Join an abandoned Stripe session to the row with:
--   select id, email, company, product_name, listing_slug, created_at
--   from public.checkout_leads
--   where id::text = split_part('<client_reference_id>', ':', 1);

alter table public.checkout_leads
  add column if not exists company text;

alter table public.checkout_leads
  drop constraint if exists checkout_leads_company_check;

alter table public.checkout_leads
  add constraint checkout_leads_company_check check (
    company is null or char_length(company) between 1 and 160
  );

comment on column public.checkout_leads.company is
  'Optional company name typed before payment. Not a directory slug.';
