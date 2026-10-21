/* Passport form stays off, and RLS keeps private documents private.
 * Run: node tests/supplier-passport.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const flags = require('../lib/feature-flags');
const passport = require('../lib/supplier-passport');

const root = path.join(__dirname, '..');
const SQL = fs.readFileSync(path.join(root, 'supabase/migrations/20261021130000_supplier_passport.sql'), 'utf8');
const WORKSPACE = fs.readFileSync(path.join(root, 'supabase/migrations/20261015000000_workspace_auth_designs.sql'), 'utf8');
const STUDENT = fs.readFileSync(path.join(root, 'supabase/migrations/20261015120000_student_access_progress.sql'), 'utf8');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const D = '44444444-4444-4444-8444-444444444444';

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  PASS  ' + label);
  else {
    failed++;
    console.error('  FAIL  ' + label + (detail ? '  -> ' + detail : ''));
  }
}

function formRules() {
  const saved = process.env.TP_SUPPLIER_PASSPORT;
  delete process.env.TP_SUPPLIER_PASSPORT;
  const file = JSON.parse(fs.readFileSync(path.join(root, 'data/feature-flags.json'), 'utf8'));
  check('committed passport flag is off', file.supplier_passport === false);
  check('unset env follows the file', flags.supplierPassportEnabled() === false && passport.pageState(file).soon === true && passport.pageState(file).form === false);
  process.env.TP_SUPPLIER_PASSPORT = 'on';
  check('env on turns the form on', flags.supplierPassportEnabled() === true && passport.pageState({ supplier_passport: true }).form === true);
  process.env.TP_SUPPLIER_PASSPORT = '0';
  check('env 0 forces the form off', flags.supplierPassportEnabled() === false);
  if (saved == null) delete process.env.TP_SUPPLIER_PASSPORT;
  else process.env.TP_SUPPLIER_PASSPORT = saved;

  const draft = passport.readForm({
    company_slug: 'hitachi-energy',
    legal_name: 'Hitachi Energy',
    registration_country: 'Switzerland',
    factory_city: 'Ludvika',
    factory_country: 'Sweden',
    factory_source_url: 'https://example.com/factory',
    certification: 'ISO 9001',
    certification_source_url: 'https://example.com/iso',
    certification_expires: '2027-01-01',
    document_ref: 'vault/iso-9001.pdf',
    document_expires: '2027-01-01',
    buyer_account: B
  });
  check('a sourced draft is accepted', draft.ok, draft.errors.join(','));
  check('draft claims stay company-declared', draft.claims.every(function (claim) { return claim.verification_status === 'company-declared'; }));
  check('document reference is private', draft.document.visibility === 'private' && draft.document.storage_path === 'vault/iso-9001.pdf');
  const leaked = passport.readForm({
    company_slug: 'hitachi-energy',
    legal_name: 'Hitachi Energy',
    document_ref: 'https://example.com/secret.pdf'
  });
  check('a public document URL is refused', leaked.ok === false && leaked.errors.indexOf('document is public') !== -1);
  const priced = passport.readForm({ company_slug: 'hitachi-energy', legal_name: 'Hitachi Energy', product_range: 'list $499', product_range_source_url: 'https://example.com/range' });
  check('a price in a claim is refused', priced.ok === false);
  const sqlBody = SQL.replace(/--[^\n]*/g, '');
  check('SQL has no price column and reuses admin review', !/\bprice\b/i.test(sqlBody) && sqlBody.indexOf('is_workspace_admin') !== -1 && sqlBody.indexOf('auth.users') !== -1);
  check('SQL does not publish private paths', /storage_path !~\* '\^https\?:\/\//.test(SQL));

  const page = fs.readFileSync(path.join(root, 'supplier-passport.html'), 'utf8');
  check('passport page is coming soon', /coming soon/i.test(page));
  check('passport form is hidden', /id="passport-form"[^>]*hidden/.test(page));
  check('passport page has no price, name field, or outreach column', page.indexOf('$') === -1 && page.indexOf('Full name') === -1 && !/do_not_contact/i.test(page));
  check('passport page uses the brand mailbox', page.indexOf('hello@transformerpath.com') !== -1);
  const personal = new RegExp('\\b' + 'Nis' + 'had' + '\\b|' + 'Pat' + 'hak', 'i');
  check('passport page does not name a personal contact', !personal.test(page));
}

function asUser(db, userId, role, fn) {
  return db.transaction(async function (tx) {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId || '']);
    await tx.exec('set local role ' + role);
    return fn(tx);
  });
}

async function rejects(fn) {
  try {
    await fn();
    return '';
  } catch (err) {
    return String(err && err.message || err);
  }
}

async function main() {
  formRules();
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
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
  await db.exec(WORKSPACE);
  await db.exec(STUDENT);
  await db.exec(SQL);
  await db.exec(SQL);
  await db.exec('grant usage on schema public to authenticated, anon');
  await db.query(
    'insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3::jsonb), ($4,$5,$6::jsonb), ($7,$8,$9::jsonb)',
    [A, 'supplier@example.com', '{}', B, 'buyer@example.com', '{}', D, 'desk@example.com', '{}']
  );
  await db.query('insert into public.workspace_admins (user_id) values ($1)', [D]);

  await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query(
      `insert into public.supplier_passports
        (owner_id, company_slug, legal_name, registration_country, factory_country)
       values ($1, 'elin-insulation-fz-llc', 'Elin Insulation FZ LLC', 'United Arab Emirates', 'United Arab Emirates')`,
      [A]
    );
  });
  const passportRow = await db.query('select id, company_slug from public.supplier_passports where owner_id = $1', [A]);
  const passportId = passportRow.rows[0].id;
  check('an Elin company can hold an ordinary passport', passportRow.rows[0].company_slug === 'elin-insulation-fz-llc');

  const verifiedInsert = await rejects(function () {
    return asUser(db, A, 'authenticated', function (tx) {
      return tx.query(
        `insert into public.supplier_passport_claims
          (passport_id, owner_id, field_key, value_text, source_url, verification_status)
         values ($1,$2,'factory','Ras Al Khaimah','https://example.com/factory','verified')`,
        [passportId, A]
      );
    });
  });
  check('a supplier cannot create a verified claim', /verified/i.test(verifiedInsert), verifiedInsert);

  await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query(
      `insert into public.supplier_passport_claims
        (passport_id, owner_id, field_key, value_text, source_url, verification_status)
       values ($1,$2,'factory','Ras Al Khaimah','https://example.com/factory','company-declared')`,
      [passportId, A]
    );
  });
  const claim = await db.query('select id, value_text from public.supplier_passport_claims where passport_id = $1', [passportId]);
  const claimId = claim.rows[0].id;
  await asUser(db, D, 'authenticated', async function (tx) {
    await tx.query("update public.supplier_passport_claims set verification_status = 'verified' where id = $1", [claimId]);
  });
  await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query("update public.supplier_passport_claims set value_text = 'new factory note', source_url = 'https://example.com/new' where id = $1", [claimId]);
  });
  const parked = await db.query('select value_text, pending_value_text, review_status, verification_status from public.supplier_passport_claims where id = $1', [claimId]);
  check('a verified claim stays put until review', parked.rows[0].value_text === 'Ras Al Khaimah' && parked.rows[0].pending_value_text === 'new factory note' && parked.rows[0].review_status === 'pending_review' && parked.rows[0].verification_status === 'verified', JSON.stringify(parked.rows[0]));

  const supplierReview = await rejects(function () {
    return asUser(db, A, 'authenticated', function (tx) {
      return tx.query('select public.apply_supplier_claim_review($1, $2)', [claimId, 'accept']);
    });
  });
  check('a supplier cannot accept their own review', /admin/i.test(supplierReview), supplierReview);
  await asUser(db, D, 'authenticated', async function (tx) {
    await tx.query('select public.apply_supplier_claim_review($1, $2)', [claimId, 'accept']);
  });
  const accepted = await db.query('select value_text, pending_value_text, review_status from public.supplier_passport_claims where id = $1', [claimId]);
  check('admin acceptance publishes the pending claim', accepted.rows[0].value_text === 'new factory note' && accepted.rows[0].pending_value_text == null && accepted.rows[0].review_status === 'none');

  await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query(
      `insert into public.supplier_passport_documents
        (passport_id, owner_id, label, storage_path, visibility)
       values ($1,$2,'Certificate','vault/cert.pdf','private'),
              ($1,$2,'Shared certificate','vault/shared.pdf','buyer_granted')`,
      [passportId, A]
    );
  });
  const before = await asUser(db, B, 'authenticated', async function (tx) {
    const docs = await tx.query('select storage_path from public.supplier_passport_documents');
    const rows = await tx.query('select company_slug from public.supplier_passports');
    return { docs: docs.rows.length, passports: rows.rows.length };
  });
  check('a buyer without a grant sees nothing', before.docs === 0 && before.passports === 0, JSON.stringify(before));
  await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query('insert into public.supplier_passport_access (passport_id, buyer_id, granted_by) values ($1,$2,$3)', [passportId, B, A]);
  });
  const granted = await asUser(db, B, 'authenticated', async function (tx) {
    const docs = await tx.query('select storage_path, visibility from public.supplier_passport_documents');
    return docs.rows;
  });
  check('a granted buyer sees only the shared document', granted.length === 1 && granted[0].storage_path === 'vault/shared.pdf' && granted[0].visibility === 'buyer_granted', JSON.stringify(granted));

  const publicDoc = await rejects(function () {
    return asUser(db, A, 'authenticated', function (tx) {
      return tx.query(
        `insert into public.supplier_passport_documents
          (passport_id, owner_id, label, storage_path, visibility)
         values ($1,$2,'Web','https://example.com/secret.pdf','private')`,
        [passportId, A]
      );
    });
  });
  check('a document cannot store a public URL', /check|constraint|https/i.test(publicDoc), publicDoc);

  const anon = await rejects(function () {
    return asUser(db, '', 'anon', function (tx) {
      return tx.query('select storage_path from public.supplier_passport_documents');
    });
  });
  check('anon cannot read passport documents', /permission denied|row-level security/i.test(anon), anon);

  const stock = await rejects(function () {
    return asUser(db, A, 'authenticated', function (tx) {
      return tx.query(
        `insert into public.component_availability_listings
          (owner_id, company_slug, category, availability, unit, dispatch_country, source_url, verification_status, published)
         values ($1,'hitachi-energy','in stock now','stated','piece','Sweden','https://example.com/part','company-declared', true)`,
        [A]
      );
    });
  });
  check('a listing cannot say in stock', /guarantee stock|in stock/i.test(stock), stock);
  await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query(
      `insert into public.component_availability_listings
        (owner_id, company_slug, category, specs, availability, quantity, unit, dispatch_country, earliest_shipment, moq, verification_status, last_confirmed, source_url, published)
       values ($1,'hitachi-energy','Bushings','72 kV','stated',4,'piece','Sweden','2026-11-01',1,'company-declared','2026-10-20','https://example.com/part', true)`,
      [A]
    );
  });
  const listing = await db.query('select published, verification_status from public.component_availability_listings where owner_id = $1', [A]);
  check('a supplier listing stays unpublished', listing.rows[0].published === false && listing.rows[0].verification_status === 'company-declared', JSON.stringify(listing.rows[0]));
  const buyerListing = await asUser(db, B, 'authenticated', async function (tx) {
    const rows = await tx.query('select id from public.component_availability_listings');
    return rows.rows.length;
  });
  check('another account cannot read the draft listing', buyerListing === 0);

  if (failed) {
    console.error('SUPPLIER PASSPORT FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('SUPPLIER PASSPORT OK');
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
