-- Verified Manufacturer review fields and the customer read policy.
--
-- Do not apply this from CI or from a Netlify build. The owner pastes it
-- into the Supabase SQL editor after reading docs/supabase-apply.md.
-- It does not delete rows. It does not add a product or a price.
--
-- public.paid_listings already stores the payment (session_id, email,
-- status). This file adds the review, claim, and 12-month columns the
-- existing table cannot hold, allows status "expired", and lets an
-- authenticated user select only a row whose email matches the JWT email.
-- Writes stay on the service role. webhook_events stays closed.

alter table public.paid_listings
  add column if not exists expires_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewer text,
  add column if not exists verification_evidence text,
  add column if not exists document_status text,
  add column if not exists authorization_note text,
  add column if not exists claim_company text,
  add column if not exists claim_website text,
  add column if not exists claim_role text,
  add column if not exists renewal_reminder_sent_at timestamptz,
  add column if not exists expiry_notice_sent_at timestamptz;

alter table public.paid_listings drop constraint if exists paid_listings_status_check;

alter table public.paid_listings
  add constraint paid_listings_status_check
  check (status in (
    'paid_pending_verification',
    'verified',
    'rejected',
    'refunded',
    'expired'
  ));

create index if not exists paid_listings_email_idx
  on public.paid_listings (lower(email));

drop policy if exists paid_listings_select_own on public.paid_listings;

create policy paid_listings_select_own on public.paid_listings
  for select
  to authenticated
  using (
    email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

grant select on table public.paid_listings to authenticated;
