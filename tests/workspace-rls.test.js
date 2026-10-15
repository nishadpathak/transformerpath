/* Apply the workspace migration to Postgres and prove one user cannot read
 * another user's profile, designs, or revisions. */
'use strict';

const fs = require('fs');
const path = require('path');

const SQL = fs.readFileSync(
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
  check('migration enables RLS on profiles', /alter table public\.profiles enable row level security/.test(SQL));
  check('migration enables RLS on saved_designs', /alter table public\.saved_designs enable row level security/.test(SQL));
  check('migration enables RLS on design_versions', /alter table public\.design_versions enable row level security/.test(SQL));
  check('profiles_own compares auth.uid() to id', /create policy profiles_own[\s\S]*auth\.uid\(\) = id/.test(SQL));
  check('designs_own compares auth.uid() to user_id', /create policy designs_own[\s\S]*auth\.uid\(\) = user_id/.test(SQL));
  check('dver_own compares auth.uid() to user_id', /create policy dver_own[\s\S]*auth\.uid\(\) = user_id/.test(SQL));
  check('profile columns are display_name, company, role, public_name',
    /display_name text/.test(SQL) && /company text/.test(SQL) && /role text/.test(SQL) && /public_name text/.test(SQL));
}

async function asUser(db, userId, fn) {
  return db.transaction(async function (tx) {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec('set local role authenticated');
    return fn(tx);
  });
}

async function main() {
  assertSql();
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
  await db.exec(SQL);

  await db.query(
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb), ($4, $5, $6::jsonb)',
    [A, 'a@example.com', JSON.stringify({ display_name: 'Ada' }), B, 'b@example.com', JSON.stringify({ full_name: 'Grace' })]
  );

  const profiles = await db.query('select id, email, display_name, public_name from public.profiles order by email');
  check('signup trigger creates both profiles', profiles.rows.length === 2, JSON.stringify(profiles.rows));
  check('display_name mirrors public_name',
    profiles.rows.every(function (row) { return row.display_name && row.display_name === row.public_name; }));

  await asUser(db, A, async function (tx) {
    await tx.query(
      'update public.profiles set company = $1, role = $2 where id = $3',
      ['Ada Works', 'Design Engineer', A]
    );
    await tx.query(
      'insert into public.saved_designs (id, user_id, name, kind, data) values ($1, $2, $3, $4, $5::jsonb)',
      ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A, 'Ada design', 'calculator', JSON.stringify({ inputs: { skva: '1000' } })]
    );
    await tx.query(
      'insert into public.design_versions (design_id, user_id, data, label) values ($1, $2, $3::jsonb, $4)',
      ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A, JSON.stringify({ inputs: { skva: '1000' } }), 'Saved']
    );
    await tx.query(
      'insert into public.design_versions (design_id, user_id, data, label) values ($1, $2, $3::jsonb, $4)',
      ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', A, JSON.stringify({ inputs: { skva: '1250' } }), 'Saved']
    );
  });

  const revisions = await db.query(
    'select revision from public.design_versions where design_id = $1 order by revision',
    ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']
  );
  check('revisions number 1 then 2',
    revisions.rows.map(function (r) { return r.revision; }).join(',') === '1,2',
    JSON.stringify(revisions.rows));

  const seenByB = await asUser(db, B, async function (tx) {
    const prof = await tx.query('select email, display_name, company from public.profiles');
    const designs = await tx.query('select name from public.saved_designs');
    const versions = await tx.query('select label from public.design_versions');
    return { prof: prof.rows, designs: designs.rows, versions: versions.rows };
  });
  check('user B sees only their profile',
    seenByB.prof.length === 1 && seenByB.prof[0].email === 'b@example.com',
    JSON.stringify(seenByB.prof));
  check('user B sees no designs', seenByB.designs.length === 0, JSON.stringify(seenByB.designs));
  check('user B sees no revisions', seenByB.versions.length === 0, JSON.stringify(seenByB.versions));

  let crossUpdate = 0;
  await asUser(db, B, async function (tx) {
    const updated = await tx.query("update public.profiles set company = 'stolen' where id = $1", [A]);
    crossUpdate = updated.affectedRows != null ? updated.affectedRows : (updated.rows || []).length;
    const designs = await tx.query('update public.saved_designs set name = $1 where user_id = $2', ['stolen', A]);
    crossUpdate += designs.affectedRows != null ? designs.affectedRows : 0;
  });
  const ada = await db.query('select company from public.profiles where id = $1', [A]);
  const adaDesign = await db.query('select name from public.saved_designs where user_id = $1', [A]);
  check('user B cannot rename user A profile or design',
    ada.rows[0].company === 'Ada Works' && adaDesign.rows[0].name === 'Ada design',
    JSON.stringify({ company: ada.rows[0], design: adaDesign.rows[0], crossUpdate: crossUpdate }));

  let insertBlocked = false;
  try {
    await asUser(db, B, async function (tx) {
      await tx.query(
        'insert into public.saved_designs (user_id, name, data) values ($1, $2, $3::jsonb)',
        [A, 'forged', '{}']
      );
    });
  } catch (e) {
    insertBlocked = true;
  }
  check('user B cannot insert a design owned by user A', insertBlocked);

  let revisionBlocked = false;
  try {
    await asUser(db, B, async function (tx) {
      await tx.query(
        'insert into public.design_versions (design_id, user_id, data) values ($1, $2, $3::jsonb)',
        ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B, '{}']
      );
    });
  } catch (e) {
    revisionBlocked = true;
  }
  check('user B cannot attach a revision to user A design', revisionBlocked);

  let anonBlocked = false;
  try {
    await db.transaction(async function (tx) {
      await tx.exec('set local role anon');
      await tx.query('select * from public.profiles');
    });
  } catch (e) {
    anonBlocked = /permission denied/i.test(String(e && e.message));
  }
  check('anon cannot select profiles', anonBlocked);

  await asUser(db, A, async function (tx) {
    await tx.query('delete from public.saved_designs where id = $1', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });
  const left = await db.query('select count(*)::int as n from public.design_versions');
  check('deleting a design removes its revisions', left.rows[0].n === 0, JSON.stringify(left.rows));

  await db.close();
  if (failed) {
    console.log(failed + ' failed');
    process.exit(1);
  }
  console.log('workspace RLS OK');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
