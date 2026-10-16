/* Apply the payments migration and prove service-role writes match the
 * webhook while authenticated users can only read their own entitlements. */
'use strict';

const fs = require('fs');
const path = require('path');

const SQL = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261016150000_payments_tables.sql'),
  'utf8'
);
const LISTINGS = fs.readFileSync(path.join(__dirname, '..', 'sql', 'paid_listings.sql'), 'utf8');
const WORKSPACE = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20261015000000_workspace_auth_designs.sql'),
  'utf8'
);

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  PASS  ' + name);
  else {
    failed++;
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''));
  }
}

function assertSql() {
  check('creates entitlements if missing', /create table if not exists public\.entitlements/.test(SQL));
  check('entitlements conflict is user_id, product', /unique \(user_id, product\)/.test(SQL));
  check('entitlements columns match the webhook write',
    /user_id uuid not null/.test(SQL) &&
    /product text not null/.test(SQL) &&
    /plan text/.test(SQL) &&
    /access_start timestamptz/.test(SQL) &&
    /access_end timestamptz/.test(SQL) &&
    /status text/.test(SQL) &&
    /created_at timestamptz not null default now\(\)/.test(SQL) &&
    /updated_at timestamptz not null default now\(\)/.test(SQL));
  check('creates paid_listings if missing', /create table if not exists public\.paid_listings/.test(SQL));
  check('paid_listings session_id is unique', /paid_listings_session_id_key unique \(session_id\)/.test(SQL));
  check('paid_listings has the webhook columns',
    /company_slug text/.test(SQL) &&
    /event_id text/.test(SQL) &&
    /email text/.test(SQL) &&
    /amount integer/.test(SQL) &&
    /currency text/.test(SQL) &&
    /livemode boolean not null default false/.test(SQL) &&
    /created_at timestamptz not null default now\(\)/.test(SQL));
  check('does not copy the narrow product check', !/product in \('verified_manufacturer', 'featured_event'\)/.test(SQL));
  check('drops a previously applied product check', /drop constraint if exists paid_listings_product_check/.test(SQL));
  check('webhook_events uses event_id as primary key', /create table if not exists public\.webhook_events[\s\S]*event_id text primary key/.test(SQL));
  check('RLS is enabled on all three tables',
    /alter table public\.entitlements enable row level security/.test(SQL) &&
    /alter table public\.paid_listings enable row level security/.test(SQL) &&
    /alter table public\.webhook_events enable row level security/.test(SQL));
  check('only a select policy exists for own entitlements',
    /create policy entitlements_select_own on public\.entitlements\s+for select\s+to authenticated\s+using \(user_id = auth\.uid\(\)\)/.test(SQL) &&
    !/for insert/.test(SQL) &&
    !/for update/.test(SQL) &&
    !/for delete/.test(SQL) &&
    !/for all/.test(SQL));
  check('older listings script no longer defines the narrow product check',
    !/constraint paid_listings_product_check/.test(LISTINGS) &&
    !/product in \('verified_manufacturer', 'featured_event'\)/.test(LISTINGS));
}

async function asUser(db, userId, fn) {
  return db.transaction(async function (tx) {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec('set local role authenticated');
    return fn(tx);
  });
}

async function authStub(db) {
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to public;
  `);
}

async function denied(fn) {
  try {
    await fn();
    return false;
  } catch (err) {
    return /permission denied|row-level security/i.test(String(err && err.message));
  }
}

async function applyPayments(db) {
  await authStub(db);
  await db.exec(SQL);
  await db.exec(SQL);
}

async function main() {
  assertSql();
  const { PGlite } = await import('@electric-sql/pglite');

  const db = new PGlite();
  await applyPayments(db);

  await db.query(
    `insert into public.entitlements
      (user_id, product, plan, access_start, access_end, status)
     values ($1, 'learning', 'Learning', $2, null, 'active'),
            ($3, 'professional', 'Professional', $2, null, 'active')`,
    [A, '2026-10-16T15:00:00.000Z', B]
  );
  await db.query(
    `insert into public.entitlements (user_id, product, plan, status)
     values ($1, 'learning', 'Learning renewed', 'active')
     on conflict (user_id, product) do update
       set plan = excluded.plan, status = excluded.status`,
    [A]
  );
  const renewed = await db.query(
    'select plan from public.entitlements where user_id = $1 and product = $2',
    [A, 'learning']
  );
  check('upsert on user_id, product updates the row', renewed.rows[0] && renewed.rows[0].plan === 'Learning renewed');

  await db.query(
    `insert into public.paid_listings
      (session_id, product, company_slug, event_id, email, amount, currency, livemode, status, created_at)
     values
      ('cs_mfr', 'verified_manufacturer', 'example-slug', null, 'buyer@example.com', 49900, 'usd', false, 'paid_pending_verification', $1),
      ('cs_web', 'hosted_webinar', null, null, 'buyer@example.com', 150000, 'usd', true, 'paid_pending_verification', $1),
      ('cs_job', 'job_standard', null, null, null, 19900, 'usd', false, 'paid_pending_verification', $1)`,
    ['2026-10-16T15:00:00.000Z']
  );
  let duplicateSession = false;
  try {
    await db.query(
      `insert into public.paid_listings (session_id, product) values ('cs_job', 'job_featured')`
    );
  } catch (err) {
    duplicateSession = /duplicate|unique/i.test(String(err && err.message));
  }
  check('session_id stays unique', duplicateSession);

  await db.query(
    `insert into public.webhook_events (event_id, event_type) values ('evt_1', 'checkout.session.completed')`
  );
  let duplicateEvent = false;
  try {
    await db.query(`insert into public.webhook_events (event_id, event_type) values ('evt_1', 'checkout.session.completed')`);
  } catch (err) {
    duplicateEvent = /duplicate|unique/i.test(String(err && err.message));
  }
  check('event_id is the primary key', duplicateEvent);

  const own = await asUser(db, A, async function (tx) {
    return tx.query('select product, plan, status from public.entitlements order by product');
  });
  check('user A reads only their entitlement',
    own.rows.length === 1 && own.rows[0].product === 'learning' && own.rows[0].status === 'active',
    JSON.stringify(own.rows));

  check('user A cannot insert an entitlement', await denied(function () {
    return asUser(db, A, function (tx) {
      return tx.query(
        `insert into public.entitlements (user_id, product) values ($1, 'enterprise')`,
        [A]
      );
    });
  }));
  check('user A cannot update an entitlement', await denied(function () {
    return asUser(db, A, function (tx) {
      return tx.query(`update public.entitlements set status = 'refunded' where user_id = $1`, [A]);
    });
  }));
  check('user A cannot read paid_listings', await denied(function () {
    return asUser(db, A, function (tx) {
      return tx.query('select session_id from public.paid_listings');
    });
  }));
  check('user A cannot write paid_listings', await denied(function () {
    return asUser(db, A, function (tx) {
      return tx.query(`insert into public.paid_listings (session_id, product) values ('cs_x', 'featured_event')`);
    });
  }));
  check('user A cannot read webhook_events', await denied(function () {
    return asUser(db, A, function (tx) {
      return tx.query('select event_id from public.webhook_events');
    });
  }));
  check('user A cannot write webhook_events', await denied(function () {
    return asUser(db, A, function (tx) {
      return tx.query(`insert into public.webhook_events (event_id, event_type) values ('evt_x', 'charge.refunded')`);
    });
  }));

  const policies = await db.query(
    `select c.relname, p.polcmd
     from pg_policy p
     join pg_class c on c.oid = p.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('entitlements', 'paid_listings', 'webhook_events')
     order by c.relname`
  );
  check('the only policy is select on entitlements',
    policies.rows.length === 1 && policies.rows[0].relname === 'entitlements' && policies.rows[0].polcmd === 'r',
    JSON.stringify(policies.rows));

  await db.query(
    `delete from public.paid_listings where product not in ('verified_manufacturer', 'featured_event')`
  );
  await db.exec(`
    alter table public.paid_listings
      add constraint paid_listings_product_check
      check (product in ('verified_manufacturer', 'featured_event'));
  `);
  await db.exec(SQL);
  const widened = await db.query(
    `insert into public.paid_listings (session_id, product, status)
     values ('cs_exhibitor', 'featured_exhibitor', 'paid_pending_verification')
     returning product`
  );
  check('re-applying drops the old product check', widened.rows[0] && widened.rows[0].product === 'featured_exhibitor');

  const prior = new PGlite();
  await authStub(prior);
  await prior.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
    end $$;
  `);
  await prior.exec(LISTINGS);
  await prior.exec(SQL);
  const afterOld = await prior.query(
    `insert into public.paid_listings (session_id, product) values ('cs_rfq', 'rfq_lead') returning product`
  );
  check('migration reconciles sql/paid_listings.sql', afterOld.rows[0] && afterOld.rows[0].product === 'rfq_lead');

  const composed = new PGlite();
  await authStub(composed);
  await composed.exec(WORKSPACE);
  await composed.exec(SQL);
  const profiles = await composed.query(`select to_regclass('public.profiles') as name`);
  const events = await composed.query(`select to_regclass('public.webhook_events') as name`);
  check('workspace migration still composes with payments',
    profiles.rows[0].name === 'profiles' && events.rows[0].name === 'webhook_events');

  const reversed = new PGlite();
  await authStub(reversed);
  await reversed.exec(SQL);
  await reversed.exec(WORKSPACE);
  const reversedProfiles = await reversed.query(`select to_regclass('public.profiles') as name`);
  const reversedEvents = await reversed.query(`select to_regclass('public.entitlements') as name`);
  check('payments migration still composes with workspace',
    reversedProfiles.rows[0].name === 'profiles' && reversedEvents.rows[0].name === 'entitlements');

  if (failed) {
    console.error('\npayments rls: ' + failed + ' failed');
    process.exit(1);
  }
  console.log('\npayments rls: PASS');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
