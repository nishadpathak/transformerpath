/* Academic emails, the learning catalog, the student coupon flag, and RLS. */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const academic = require('../lib/academic-email.js');
const catalog = require('../lib/learning-catalog.js');
const offer = require('../lib/student-learning-offer.js');

const FIRST = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261015000000_workspace_auth_designs.sql'), 'utf8');
const SECOND = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261015120000_student_access_progress.sql'), 'utf8');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';
const HELLO = 'aGVsbG8=';

let failed = 0;
function check(name, cond, extra) {
  if (cond) console.log('  PASS  ' + name);
  else {
    failed++;
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''));
  }
}

function rules() {
  check('mit.edu is academic', academic.academicEmail('Ada@MIT.EDU') === true);
  check('ac.uk is academic', academic.academicEmail('a@cam.ac.uk') === true);
  check('edu.au is academic', academic.academicEmail('a@student.unimelb.edu.au') === true);
  check('gmail is not academic', academic.academicEmail('a@gmail.com') === false);
  check('edu.com is not academic', academic.academicEmail('a@edu.com') === false);
  check('bare .ac is not academic', academic.academicEmail('a@island.ac') === false);
  check('catalog level 1 has eight sections', catalog.LEVELS[0].sections.length === 8);
  check('levels 2 to 4 have no published sections', catalog.LEVELS.slice(1).every(function (level) { return level.sections.length === 0; }));
  catalog.LEVELS[0].sections.forEach(function (section) {
    check('migration allows ' + section.id, SECOND.indexOf("('level1', '" + section.id + "')") !== -1);
  });
  const summary = catalog.summarize([
    { level_id: 'level1', section_id: 'l1m1', completed_at: '2026-10-15T00:00:00Z' },
    { level_id: 'level2', section_id: 'invented', completed_at: '2026-10-15T00:00:00Z' }
  ]);
  check('one real section is completed', summary[0].completedCount === 1 && summary[0].levelComplete === false);
  check('an unknown section is not a completion', summary[1].completedCount === 0 && summary[1].levelComplete === false);
  check('eight sections complete the level', catalog.summarize(catalog.LEVELS[0].sections.map(function (section) {
    return { level_id: 'level1', section_id: section.id, completed_at: '2026-10-15T00:00:00Z' };
  }))[0].levelComplete === true);
  check('coupon flag is off by default', offer.publicStatus({}).enabled === false && offer.publicStatus({}).reason === 'flag_off');
  check('coupon flag does not build a checkout while off', offer.checkoutParams({}) === null);
  const on = {
    STUDENT_LEARNING_COUPON_ENABLED: 'on',
    STRIPE_STUDENT_LEARNING_COUPON_ID: 'coupon_test',
    STRIPE_STUDENT_LEARNING_PRICE_ID: 'price_test'
  };
  const params = offer.checkoutParams(on);
  check('an approved flag can name a coupon and price', params && params.discounts[0].coupon === 'coupon_test' && params.line_items[0].price === 'price_test');
  check('the public handler still does not start checkout', offer.publicStatus(on).enabled === false && offer.publicStatus(on).reason === 'checkout_not_started');
  check('offer source has no Stripe URL', fs.readFileSync(path.join(__dirname, '..', 'lib', 'student-learning-offer.js'), 'utf8').indexOf('buy.stripe.com') === -1);
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
    return false;
  } catch (e) {
    return true;
  }
}

async function main() {
  rules();
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
  await db.exec(FIRST);
  await db.exec(SECOND);
  await db.exec('grant usage on schema public to authenticated, anon');

  await db.query(
    'insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3::jsonb), ($4,$5,$6::jsonb), ($7,$8,$9::jsonb), ($10,$11,$12::jsonb)',
    [
      A, 'ada@gmail.com', JSON.stringify({ signup_role: 'student', display_name: 'Ada' }),
      B, 'grace@gmail.com', JSON.stringify({ signup_role: 'engineer', display_name: 'Grace' }),
      C, 'alan@mit.edu', JSON.stringify({ signup_role: 'student', display_name: 'Alan' }),
      D, 'desk@example.com', JSON.stringify({ signup_role: 'engineer', display_name: 'Admin' })
    ]
  );

  const badges = await db.query('select email, signup_role, student_badge, student_badge_source from public.profiles order by email');
  const byEmail = {};
  badges.rows.forEach(function (row) { byEmail[row.email] = row; });
  check('gmail student has no badge', byEmail['ada@gmail.com'].student_badge === false, JSON.stringify(byEmail['ada@gmail.com']));
  check('mit.edu student has the academic badge', byEmail['alan@mit.edu'].student_badge === true && byEmail['alan@mit.edu'].student_badge_source === 'academic_email');
  check('engineer has no student badge', byEmail['grace@gmail.com'].student_badge === false && byEmail['grace@gmail.com'].signup_role === 'engineer');

  const selfBadge = await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query('update public.profiles set student_badge = true where id = $1', [A]);
    const row = await tx.query('select student_badge from public.profiles where id = $1', [A]);
    return row.rows[0].student_badge;
  });
  check('a student cannot grant their own badge', selfBadge === false);

  await asUser(db, A, 'authenticated', async function (tx) {
    await tx.query(
      'insert into public.student_id_reviews (user_id, file_name, content_type, file_base64, byte_length) values ($1,$2,$3,$4,$5)',
      [A, 'id.png', 'image/png', HELLO, 5]
    );
    await tx.query(
      'insert into public.learning_progress (user_id, level_id, section_id) values ($1,$2,$3)',
      [A, 'level1', 'l1m1']
    );
  });
  check('forged section is rejected', await rejects(function () {
    return asUser(db, A, 'authenticated', function (tx) {
      return tx.query('insert into public.learning_progress (user_id, level_id, section_id) values ($1,$2,$3)', [A, 'level2', 'invented']);
    });
  }));
  check('self-approval is rejected', await rejects(function () {
    return asUser(db, A, 'authenticated', function (tx) {
      return tx.query("insert into public.student_id_reviews (user_id, status, file_name, content_type, file_base64, byte_length) values ($1,'approved',$2,$3,$4,$5)", [A, 'id.png', 'image/png', HELLO, 5]);
    });
  }));

  const seenByB = await asUser(db, B, 'authenticated', async function (tx) {
    const reviews = await tx.query('select file_base64 from public.student_id_reviews');
    const progress = await tx.query('select section_id from public.learning_progress');
    return { reviews: reviews.rows.length, progress: progress.rows.length };
  });
  check('another user cannot read the student ID', seenByB.reviews === 0);
  check('another user cannot read learning progress', seenByB.progress === 0);

  const anonDenied = await rejects(function () {
    return asUser(db, '', 'anon', function (tx) {
      return tx.query('select file_base64 from public.student_id_reviews');
    });
  });
  check('anon cannot read student IDs', anonDenied);

  await db.query('insert into public.workspace_admins (user_id) values ($1)', [D]);
  const adminSees = await asUser(db, D, 'authenticated', async function (tx) {
    const reviews = await tx.query('select id, file_base64, status from public.student_id_reviews');
    return reviews.rows[0];
  });
  check('admin can read the uploaded ID', adminSees && adminSees.file_base64 === HELLO && adminSees.status === 'pending');

  await asUser(db, D, 'authenticated', async function (tx) {
    await tx.query("update public.student_id_reviews set status = 'approved', decision_note = 'ID matches the name' where id = $1", [adminSees.id]);
  });
  const approved = await db.query('select student_badge, student_badge_source from public.profiles where id = $1', [A]);
  check('approval sets the student badge', approved.rows[0].student_badge === true && approved.rows[0].student_badge_source === 'id_review');

  const nonAdminUpdate = await asUser(db, B, 'authenticated', async function (tx) {
    const result = await tx.query("update public.student_id_reviews set status = 'rejected' where user_id = $1", [A]);
    return result.affectedRows == null ? result : result;
  });
  const still = await db.query('select status from public.student_id_reviews where user_id = $1', [A]);
  check('a non-admin review update does not change the row', still.rows[0].status === 'approved', JSON.stringify(nonAdminUpdate));

  if (failed) {
    console.log(failed + ' failed');
    process.exit(1);
  }
  console.log('student access OK');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
