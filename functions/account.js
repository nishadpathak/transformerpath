/* Netlify function: account identity + server entitlement.
 *
 * GET  /.netlify/functions/account
 *   Authorization: Bearer <supabase access token>
 *   → snapshot: user, flags, entitlement (with learning/professional grants),
 *     learner, org seats, grid_lab, skills, assessments, saved_designs
 *
 * POST /.netlify/functions/account
 *   body.action = onboard | roles | grid_lab | skill | public_name
 *                | path | certificate | lesson | assessment | saved_design
 *
 * Stripe never grants in the browser. This function reads entitlements written
 * by entitle.js / stripe-webhook.js (service role) and returns the active plan.
 */
'use strict';
const { isConfigured, client } = require('./lib/supabase-server');
const model = require('./lib/account-model');
const answers = require('./lib/assessment-answers');

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

function buyerSupplierFromRole(role) {
  const r = String(role || '');
  return {
    isBuyer: r === 'procurement' || r === 'buyer',
    isSupplier: r === 'sales_bd' || r === 'supplier',
  };
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
      const role = String(body.onboarding_role || '').slice(0, 40) || null;
      const extraFlags = buyerSupplierFromRole(role);
      const row = {
        user_id: uid,
        public_name: String(body.public_name || '').slice(0, 80) || null,
        onboarding_role: role,
        onboarding_interest: String(body.onboarding_interest || '').slice(0, 40) || null,
        onboarding_experience: String(body.onboarding_experience || '').slice(0, 40) || null,
        onboarding_done: true,
        is_learner: true,
        is_buyer: extraFlags.isBuyer,
        is_supplier: extraFlags.isSupplier,
        det_level: detFromExperience(body.onboarding_experience),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('learner_profiles').upsert(row, { onConflict: 'user_id' });
      await supabase.from('profiles').upsert({
        id: uid, email: user.email || null, public_name: row.public_name,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      const extra = ['LEARNER'];
      if (extraFlags.isBuyer) extra.push('BUYER');
      if (extraFlags.isSupplier) extra.push('SUPPLIER');
      for (let i = 0; i < extra.length; i++) {
        await supabase.from('account_roles').upsert({ user_id: uid, role: extra[i] }, { onConflict: 'user_id,role' });
      }
      await supabase.from('path_progress').upsert({
        user_id: uid, path_id: 'transformer-path', status: 'IN PROGRESS', percent: 5,
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
      const name = String(body.public_name || '').slice(0, 80);
      await supabase.from('learner_profiles').upsert({
        user_id: uid, public_name: name, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      await supabase.from('profiles').upsert({
        id: uid, email: user.email || null, public_name: name, updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } else if (action === 'grid_lab') {
      const scenario = String(body.scenario_id || '').slice(0, 64);
      if (!scenario) return respond(400, { error: 'scenario_id required' });
      const percent = Math.max(0, Math.min(100, parseInt(body.percent, 10) || 0));
      const status = percent >= 100 ? 'COMPLETE' : (percent > 0 ? 'IN PROGRESS' : 'NOT STARTED');
      await supabase.from('grid_lab_progress').upsert({
        user_id: uid, scenario_id: scenario, status: status, percent: percent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,scenario_id' });
      await supabase.from('grid_lab_sessions').insert({
        user_id: uid, scenario_id: scenario, percent: percent, status: status,
      });
      if (percent >= 100 && body.skill_id) {
        await writeSkill(supabase, uid, String(body.skill_id).slice(0, 64), 'Intermediate', 'Grid Lab scenario ' + scenario, 'grid_lab', scenario);
        await supabase.from('certificates').upsert({
          user_id: uid,
          slug: 'grid-lab-' + scenario,
          title: String(body.title || scenario).slice(0, 120),
          how_earned: 'Grid Lab scenario complete',
          kind: 'learning_record',
          earned_at: new Date().toISOString(),
        }, { onConflict: 'user_id,slug' });
        await supabase.from('completion_records').upsert({
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
      await writeSkill(supabase, uid, String(body.skill_id || '').slice(0, 64),
        String(body.level || 'Developing').slice(0, 24),
        String(body.how_earned || '').slice(0, 200),
        String(body.evidence_kind || 'lesson').slice(0, 24),
        String(body.ref || '').slice(0, 80));
    } else if (action === 'path') {
      const pathId = String(body.path_id || '').slice(0, 64);
      if (!pathId) return respond(400, { error: 'path_id required' });
      const percent = Math.max(0, Math.min(100, parseInt(body.percent, 10) || 0));
      const status = percent >= 100 ? 'COMPLETE' : (percent > 0 ? 'IN PROGRESS' : 'NOT STARTED');
      await supabase.from('path_progress').upsert({
        user_id: uid, path_id: pathId, status: status, percent: percent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,path_id' });
    } else if (action === 'lesson') {
      const lessonId = String(body.lesson_id || body.module_id || '').slice(0, 64);
      if (!lessonId) return respond(400, { error: 'lesson_id required' });
      const percent = Math.max(0, Math.min(100, parseInt(body.percent, 10) || 0));
      const status = percent >= 100 ? 'COMPLETE' : (percent > 0 ? 'IN PROGRESS' : 'NOT STARTED');
      await supabase.from('lesson_progress').upsert({
        user_id: uid, lesson_id: lessonId, module_id: String(body.module_id || lessonId).slice(0, 64),
        status: status, percent: percent, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_id' });
      if (percent >= 100 && body.skill_id) {
        await writeSkill(supabase, uid, String(body.skill_id).slice(0, 64), 'Developing', 'Lesson completion', 'lesson', lessonId);
      }
    } else if (action === 'assessment') {
      const assessmentId = String(body.assessment_id || '').slice(0, 80);
      if (!assessmentId) return respond(400, { error: 'assessment_id required' });
      const answerId = String(body.answer_id || '').slice(0, 80);
      const g = answers.grade(assessmentId, answerId);
      await supabase.from('assessment_attempts').insert({
        user_id: uid, assessment_id: assessmentId, answer_id: answerId, correct: g.correct,
      });
      await supabase.from('assessment_results').upsert({
        user_id: uid, assessment_id: assessmentId, passed: g.correct, score: g.correct ? 100 : 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,assessment_id' });
      if (g.correct && body.skill_id) {
        const kind = /current|mva|kv/i.test(assessmentId) ? 'calculation' : 'assessment';
        await writeSkill(supabase, uid, String(body.skill_id).slice(0, 64), 'Intermediate', 'Assessment ' + assessmentId, kind, assessmentId);
      } else if (g.correct) {
        const skillGuess = assessmentId.indexOf('oltc') >= 0 ? 'oltc-avr'
          : assessmentId.indexOf('vector') >= 0 ? 'vector-group'
          : assessmentId.indexOf('current') >= 0 ? 'iec-rating' : '';
        if (skillGuess) {
          const kind = assessmentId.indexOf('current') >= 0 ? 'calculation' : 'assessment';
          await writeSkill(supabase, uid, skillGuess, 'Intermediate', 'Assessment ' + assessmentId, kind, assessmentId);
        }
      }
    } else if (action === 'saved_design') {
      await supabase.from('saved_designs').insert({
        user_id: uid,
        name: String(body.name || 'Untitled').slice(0, 120),
        kind: String(body.kind || 'design').slice(0, 40),
        data: body.data && typeof body.data === 'object' ? body.data : {},
      });
    } else if (action === 'certificate') {
      const slug = String(body.slug || '').slice(0, 80).replace(/[^a-z0-9-]/gi, '-');
      if (!slug) return respond(400, { error: 'slug required' });
      const rec = {
        user_id: uid,
        slug: slug,
        title: String(body.title || slug).slice(0, 120),
        how_earned: String(body.how_earned || '').slice(0, 200),
        kind: 'learning_record',
        earned_at: new Date().toISOString(),
      };
      await supabase.from('certificates').upsert(rec, { onConflict: 'user_id,slug' });
      await supabase.from('completion_records').upsert(rec, { onConflict: 'user_id,slug' });
    } else {
      return respond(400, { error: 'unknown action' });
    }
  } catch (e) {
    return respond(200, { ok: false, stored: false, reason: 'table_missing', detail: String(e && e.message) });
  }

  return respond(200, await snapshot(supabase, user));
};

async function writeSkill(supabase, uid, skillId, level, how, evidenceKind, ref) {
  if (!skillId) return;
  await supabase.from('skill_records').upsert({
    user_id: uid, skill_id: skillId, level: level, how_earned: how,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,skill_id' });
  await supabase.from('user_skills').upsert({
    user_id: uid, skill_id: skillId, level: level, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,skill_id' });
  if (evidenceKind) {
    await supabase.from('skill_evidence').insert({
      user_id: uid, skill_id: skillId, kind: evidenceKind, ref: ref || null,
    });
  }
}

function detFromExperience(exp) {
  const e = String(exp || '');
  if (e === 'specialist') return 'Level 3 — Power transformers';
  if (e === 'practicing') return 'Level 2 — Distribution';
  return 'Level 1 — Foundations';
}

async function snapshot(supabase, user) {
  const uid = user.id;

  async function sel(table, matchCol) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq(matchCol, uid);
      if (error) return [];
      return data || [];
    } catch (e) { return []; }
  }

  const [
    ents, roles, learnerRows, grid, skills, memberships, orgMembers, purchases,
    paths, certs, lessons, attempts, results, evidence, designs, userSkills,
  ] = await Promise.all([
    sel('entitlements', 'user_id'),
    sel('account_roles', 'user_id'),
    sel('learner_profiles', 'user_id'),
    sel('grid_lab_progress', 'user_id'),
    sel('skill_records', 'user_id'),
    sel('memberships', 'user_id'),
    sel('organization_members', 'user_id'),
    sel('purchases', 'user_id'),
    sel('path_progress', 'user_id'),
    sel('certificates', 'user_id'),
    sel('lesson_progress', 'user_id'),
    sel('assessment_attempts', 'user_id'),
    sel('assessment_results', 'user_id'),
    sel('skill_evidence', 'user_id'),
    sel('saved_designs', 'user_id'),
    sel('user_skills', 'user_id'),
  ]);

  let learner = learnerRows[0] || null;
  if (!learner) {
    try {
      const { data } = await supabase.from('learner_profiles').select('*').eq('id', uid).maybeSingle();
      learner = data || null;
    } catch (e) { /* ignore */ }
  }

  const seats = (orgMembers && orgMembers.length) ? orgMembers : (memberships || []);
  let orgEnts = [];
  if (seats.length) {
    try {
      const ids = seats.map((s) => s.org_id).filter(Boolean);
      if (ids.length) {
        const { data } = await supabase.from('entitlements').select('*').in('org_id', ids);
        orgEnts = data || [];
      }
    } catch (e) { orgEnts = []; }
  }

  const entitlement = model.bestEntitlement([].concat(ents || [], orgEnts));
  const grants = model.grantsFromPlan(entitlement && entitlement.product);
  const roleList = roles.map((r) => r.role).filter(Boolean);
  if (!roleList.length) roleList.push('LEARNER');
  const flags = model.flagsFromRoles(roleList);
  if (learner) {
    if (learner.is_learner != null) flags.isLearner = !!learner.is_learner;
    if (learner.is_buyer != null) flags.isBuyer = !!learner.is_buyer;
    if (learner.is_supplier != null) flags.isSupplier = !!learner.is_supplier;
  }

  const gridAgg = aggregateGrid(grid);
  const org = seats[0] || null;

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
      learning: !!grants.learning,
      professional: !!grants.professional,
      team: !!grants.team,
      max_members: entitlement.max_members || 1,
    } : { plan: 'free', plan_key: 'free', rank: 0, expires_at: null, status: 'none', learning: false, professional: false, team: false, max_members: 1 },
    org: org ? { id: org.org_id, role: org.org_role, max_members: entitlement && entitlement.max_members } : null,
    purchases: (purchases || []).map((p) => ({ product: p.product, plan: p.plan, status: p.status, created_at: p.created_at })),
    memberships: seats,
    grid_lab: { scenarios: grid, aggregate_percent: gridAgg },
    path_progress: paths || [],
    lesson_progress: lessons || [],
    assessment_results: results || [],
    assessment_attempts: (attempts || []).slice(0, 40),
    skills: (userSkills && userSkills.length) ? userSkills : (skills || []),
    skill_evidence: evidence || [],
    saved_designs: (designs || []).map((d) => ({ id: d.id, name: d.name, kind: d.kind, updated_at: d.updated_at })),
    certificates: certs || [],
  };
}

function aggregateGrid(rows) {
  if (!rows || !rows.length) return 0;
  const n = rows.length;
  const sum = rows.reduce((s, r) => s + (parseInt(r.percent, 10) || (r.status === 'COMPLETE' ? 100 : 0)), 0);
  return n ? Math.round(sum / n) : 0;
}
