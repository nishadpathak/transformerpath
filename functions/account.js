/* Netlify function: account identity + server entitlement.
 *
 * GET  /.netlify/functions/account
 *   Authorization: Bearer <supabase access token>
 *   → { user, profile, roles, entitlement, learner, grid_lab, skills, org }
 *
 * POST /.netlify/functions/account
 *   body.action = onboard | roles | grid_lab | skill | public_name
 *
 * Stripe never grants in the browser. This function reads entitlements written
 * by entitle.js / stripe-webhook.js (service role) and returns the active plan.
 */
'use strict';
const { isConfigured, client } = require('./lib/supabase-server');
const model = require('./lib/account-model');

function respond(code, obj) {
  return {
    statusCode: code,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(obj),
  };
}

function bearer(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  if (h.toLowerCase().indexOf('bearer ') === 0) return h.slice(7).trim();
  return null;
}

async function userFromToken(supabase, token) {
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(204, {});
  if (!isConfigured()) {
    return respond(200, { configured: false, entitlement: null, reason: 'supabase_not_configured' });
  }
  const supabase = client();
  const token = bearer(event);
  const user = await userFromToken(supabase, token);
  if (!user) return respond(401, { ok: false, error: 'sign_in_required' });

  if (event.httpMethod === 'GET') {
    return respond(200, await snapshot(supabase, user));
  }
  if (event.httpMethod !== 'POST') return respond(405, { error: 'method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return respond(400, { error: 'invalid json' }); }
  const action = String(body.action || '');
  const uid = user.id;

  try {
    if (action === 'onboard') {
      const row = {
        user_id: uid,
        public_name: String(body.public_name || '').slice(0, 80) || null,
        onboarding_role: String(body.onboarding_role || '').slice(0, 40) || null,
        onboarding_interest: String(body.onboarding_interest || '').slice(0, 40) || null,
        onboarding_experience: String(body.onboarding_experience || '').slice(0, 40) || null,
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      };
      await supabase.from('learner_profiles').upsert(row, { onConflict: 'user_id' });
      const extra = [];
      extra.push('LEARNER');
      if (row.onboarding_role === 'buyer') extra.push('BUYER');
      if (row.onboarding_role === 'supplier') extra.push('SUPPLIER');
      for (let i = 0; i < extra.length; i++) {
        await supabase.from('account_roles').upsert({ user_id: uid, role: extra[i] }, { onConflict: 'user_id,role' });
      }
      await supabase.from('learner_profiles').upsert({
        user_id: uid,
        is_learner: true,
        is_buyer: extra.indexOf('BUYER') >= 0,
        is_supplier: extra.indexOf('SUPPLIER') >= 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      await supabase.from('path_progress').upsert({
        user_id: uid, path_id: 'transformer-path', status: 'IN PROGRESS', percent: 20,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,path_id' });
    } else if (action === 'roles') {
      const roles = (body.roles || []).filter((r) => model.ROLES.indexOf(r) >= 0);
      const fromFlags = body.flags ? model.rolesFromFlags(body.flags) : null;
      const next = fromFlags || roles;
      if (!next.length) return respond(400, { error: 'roles required' });
      await supabase.from('account_roles').delete().eq('user_id', uid);
      for (let i = 0; i < next.length; i++) {
        await supabase.from('account_roles').insert({ user_id: uid, role: next[i] });
      }
      const flags = model.flagsFromRoles(next);
      await supabase.from('learner_profiles').upsert({
        user_id: uid,
        is_learner: flags.isLearner,
        is_buyer: flags.isBuyer,
        is_supplier: flags.isSupplier,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } else if (action === 'public_name') {
      await supabase.from('learner_profiles').upsert({
        user_id: uid,
        public_name: String(body.public_name || '').slice(0, 80),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } else if (action === 'grid_lab') {
      const scenario = String(body.scenario_id || '').slice(0, 64);
      if (!scenario) return respond(400, { error: 'scenario_id required' });
      const percent = Math.max(0, Math.min(100, parseInt(body.percent, 10) || 0));
      const status = percent >= 100 ? 'COMPLETE' : (percent > 0 ? 'IN PROGRESS' : 'NOT STARTED');
      await supabase.from('grid_lab_progress').upsert({
        user_id: uid, scenario_id: scenario, status: status, percent: percent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,scenario_id' });
      if (percent >= 100 && body.skill_id) {
        await supabase.from('skill_records').upsert({
          user_id: uid, skill_id: String(body.skill_id).slice(0, 64),
          level: 'DEMONSTRATED', how_earned: 'Grid Lab scenario ' + scenario,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,skill_id' });
        await supabase.from('certificates').upsert({
          user_id: uid,
          slug: 'grid-lab-' + scenario,
          title: String(body.title || scenario).slice(0, 120),
          how_earned: 'Grid Lab scenario complete',
          kind: 'learning_record',
          earned_at: new Date().toISOString(),
        }, { onConflict: 'user_id,slug' });
        await supabase.from('path_progress').upsert({
          user_id: uid, path_id: 'grid-lab', status: status, percent: percent,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,path_id' });
      }
    } else if (action === 'skill') {
      await supabase.from('skill_records').upsert({
        user_id: uid,
        skill_id: String(body.skill_id || '').slice(0, 64),
        level: String(body.level || 'INTRODUCED').slice(0, 24),
        how_earned: String(body.how_earned || '').slice(0, 200),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,skill_id' });
    } else if (action === 'path') {
      const pathId = String(body.path_id || '').slice(0, 64);
      if (!pathId) return respond(400, { error: 'path_id required' });
      const percent = Math.max(0, Math.min(100, parseInt(body.percent, 10) || 0));
      const status = percent >= 100 ? 'COMPLETE' : (percent > 0 ? 'IN PROGRESS' : 'NOT STARTED');
      await supabase.from('path_progress').upsert({
        user_id: uid, path_id: pathId, status: status, percent: percent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,path_id' });
    } else if (action === 'certificate') {
      const slug = String(body.slug || '').slice(0, 80).replace(/[^a-z0-9-]/gi, '-');
      if (!slug) return respond(400, { error: 'slug required' });
      await supabase.from('certificates').upsert({
        user_id: uid,
        slug: slug,
        title: String(body.title || slug).slice(0, 120),
        how_earned: String(body.how_earned || '').slice(0, 200),
        kind: 'learning_record',
        earned_at: new Date().toISOString(),
      }, { onConflict: 'user_id,slug' });
    } else {
      return respond(400, { error: 'unknown action' });
    }
  } catch (e) {
    return respond(200, { ok: false, stored: false, reason: 'table_missing', detail: String(e && e.message) });
  }

  return respond(200, await snapshot(supabase, user));
};

async function snapshot(supabase, user) {
  const uid = user.id;

  async function sel(table, matchCol) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq(matchCol, uid);
      if (error) return [];
      return data || [];
    } catch (e) { return []; }
  }

  const [ents, roles, learnerRows, grid, skills, memberships, purchases, paths, certs] = await Promise.all([
    sel('entitlements', 'user_id'),
    sel('account_roles', 'user_id'),
    sel('learner_profiles', 'user_id'),
    sel('grid_lab_progress', 'user_id'),
    sel('skill_records', 'user_id'),
    sel('memberships', 'user_id'),
    sel('purchases', 'user_id'),
    sel('path_progress', 'user_id'),
    sel('certificates', 'user_id'),
  ]);

  // Some installs keyed learner_profiles.user_id; others used id = auth uid.
  let learner = learnerRows[0] || null;
  if (!learner) {
    try {
      const { data } = await supabase.from('learner_profiles').select('*').eq('id', uid).maybeSingle();
      learner = data || null;
    } catch (e) { /* ignore */ }
  }

  const entitlement = model.bestEntitlement(ents);
  const roleList = roles.map((r) => r.role).filter(Boolean);
  if (!roleList.length) roleList.push('LEARNER');
  const flags = model.flagsFromRoles(roleList);
  if (learner) {
    if (learner.is_learner != null) flags.isLearner = !!learner.is_learner;
    if (learner.is_buyer != null) flags.isBuyer = !!learner.is_buyer;
    if (learner.is_supplier != null) flags.isSupplier = !!learner.is_supplier;
  }

  const gridAgg = aggregateGrid(grid);

  return {
    ok: true,
    configured: true,
    user: { id: uid, email: user.email },
    roles: roleList,
    flags: flags,
    learner: learner,
    entitlement: entitlement ? {
      plan: entitlement.label,
      plan_key: entitlement.product,
      rank: entitlement.rank,
      expires_at: entitlement.row.access_end || entitlement.row.expires_at || null,
      status: entitlement.row.status || 'active',
    } : { plan: 'free', plan_key: 'free', rank: 0, expires_at: null, status: 'none' },
    purchases: (purchases || []).map((p) => ({ product: p.product, plan: p.plan, status: p.status, created_at: p.created_at })),
    memberships: memberships || [],
    grid_lab: { scenarios: grid, aggregate_percent: gridAgg },
    path_progress: paths || [],
    skills: skills || [],
    certificates: certs || [],
  };
}

function aggregateGrid(rows) {
  if (!rows || !rows.length) return 0;
  const n = rows.length;
  const sum = rows.reduce((s, r) => s + (parseInt(r.percent, 10) || (r.status === 'COMPLETE' ? 100 : 0)), 0);
  // Aggregate is mean across catalog size, filled in by the client from the scenario list.
  return n ? Math.round(sum / n) : 0;
}
