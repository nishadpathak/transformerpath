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
 *                | design_rename | design_duplicate | design_delete
 *                | project | note | shortlist | comparison | rfq | requirement
 *                | company_claim | supplier_profile | supplier_facility
 *                | supplier_product | analytics | follow | watchlist | saved_search
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

function isMissingTable(error) {
  if (!error) return false;
  const msg = String(error.message || error.code || error.details || '');
  return /does not exist|42P01|schema cache|PGRST205|relation .* does not exist/i.test(msg);
}

async function exec(promise) {
  const res = await promise;
  if (res && res.error) {
    if (isMissingTable(res.error)) {
      const e = new Error('table_missing');
      e.reason = 'table_missing';
      e.detail = String(res.error.message || res.error.code || '');
      throw e;
    }
    throw res.error;
  }
  return res && res.data;
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
    } else if (action === 'saved_design' || action === 'design_create') {
      const entSnap = await snapshot(supabase, user);
      if (!model.canSaveDesigns(entSnap.entitlement)) {
        return respond(200, Object.assign(entSnap, { ok: false, gated: true, stored: false }));
      }
      const payload = {
        user_id: uid,
        name: String(body.name || 'Untitled').slice(0, 120),
        kind: String(body.kind || 'design').slice(0, 40),
        rating: String(body.rating || '').slice(0, 40) || null,
        voltages: String(body.voltages || '').slice(0, 80) || null,
        notes: String(body.notes || '').slice(0, 2000) || null,
        data: body.data && typeof body.data === 'object' ? body.data : {},
        updated_at: new Date().toISOString(),
      };
      const inserted = await exec(supabase.from('saved_designs').insert(payload).select('id').maybeSingle());
      const designId = inserted && inserted.id;
      if (designId) {
        await exec(supabase.from('design_versions').insert({
          design_id: designId, user_id: uid, data: payload.data,
        }));
      }
    } else if (action === 'design_rename') {
      const entSnap = await snapshot(supabase, user);
      if (!model.canSaveDesigns(entSnap.entitlement)) {
        return respond(200, Object.assign(entSnap, { ok: false, gated: true, stored: false }));
      }
      const id = String(body.id || '').slice(0, 80);
      if (!id) return respond(400, { error: 'id required' });
      const patch = { updated_at: new Date().toISOString() };
      if (body.name != null) patch.name = String(body.name).slice(0, 120);
      if (body.rating != null) patch.rating = String(body.rating).slice(0, 40);
      if (body.voltages != null) patch.voltages = String(body.voltages).slice(0, 80);
      if (body.notes != null) patch.notes = String(body.notes).slice(0, 2000);
      if (body.data && typeof body.data === 'object') patch.data = body.data;
      await exec(supabase.from('saved_designs').update(patch).eq('id', id).eq('user_id', uid));
      if (patch.data) {
        await exec(supabase.from('design_versions').insert({ design_id: id, user_id: uid, data: patch.data }));
      }
    } else if (action === 'design_duplicate') {
      const entSnap = await snapshot(supabase, user);
      if (!model.canSaveDesigns(entSnap.entitlement)) {
        return respond(200, Object.assign(entSnap, { ok: false, gated: true, stored: false }));
      }
      const id = String(body.id || '').slice(0, 80);
      const { data: src, error: srcErr } = await supabase.from('saved_designs').select('*').eq('id', id).eq('user_id', uid).maybeSingle();
      if (srcErr && isMissingTable(srcErr)) throw Object.assign(new Error('table_missing'), { reason: 'table_missing' });
      if (!src) return respond(404, { error: 'design not found' });
      const copy = {
        user_id: uid,
        name: String(src.name || 'Untitled').slice(0, 100) + ' copy',
        kind: src.kind || 'design',
        rating: src.rating || null,
        voltages: src.voltages || null,
        notes: src.notes || null,
        data: src.data || {},
        updated_at: new Date().toISOString(),
      };
      const inserted = await exec(supabase.from('saved_designs').insert(copy).select('id').maybeSingle());
      if (inserted && inserted.id) {
        await exec(supabase.from('design_versions').insert({ design_id: inserted.id, user_id: uid, data: copy.data }));
      }
    } else if (action === 'design_delete') {
      const id = String(body.id || '').slice(0, 80);
      if (!id) return respond(400, { error: 'id required' });
      await exec(supabase.from('design_versions').delete().eq('design_id', id).eq('user_id', uid));
      await exec(supabase.from('saved_designs').delete().eq('id', id).eq('user_id', uid));
    } else if (action === 'project') {
      if (body.op === 'delete') {
        await exec(supabase.from('projects').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('projects').insert({
          user_id: uid,
          name: String(body.name || 'Untitled project').slice(0, 120),
          notes: String(body.notes || '').slice(0, 2000) || null,
        }));
      }
    } else if (action === 'note') {
      if (body.op === 'delete') {
        await exec(supabase.from('notes').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('notes').insert({
          user_id: uid,
          title: String(body.title || 'Note').slice(0, 120),
          body: String(body.body || '').slice(0, 4000),
          item_type: String(body.item_type || body.itemType || '').slice(0, 40) || null,
          item_id: String(body.item_id || body.itemId || '').slice(0, 80) || null,
          updated_at: new Date().toISOString(),
        }));
      }
    } else if (action === 'shortlist') {
      if (body.op === 'remove') {
        await exec(supabase.from('saved_items').delete().eq('user_id', uid)
          .eq('item_type', String(body.item_type || body.type || 'company'))
          .eq('item_id', String(body.item_id || body.id || '')));
      } else {
        await exec(supabase.from('saved_items').upsert({
          user_id: uid,
          item_type: String(body.item_type || body.type || 'company').slice(0, 40),
          item_id: String(body.item_id || body.id || '').slice(0, 120),
          title: String(body.title || '').slice(0, 160) || null,
          url: String(body.url || '').slice(0, 240) || null,
        }, { onConflict: 'user_id,item_type,item_id' }));
      }
    } else if (action === 'comparison') {
      if (body.op === 'delete') {
        await exec(supabase.from('comparisons').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('comparisons').insert({
          user_id: uid,
          name: String(body.name || 'Comparison').slice(0, 120),
          slugs: String(body.slugs || '').slice(0, 400),
          url: String(body.url || '').slice(0, 400),
          updated_at: new Date().toISOString(),
        }));
      }
    } else if (action === 'rfq') {
      const status = model.RFQ_STATUSES.indexOf(body.status) >= 0 ? body.status : 'Draft';
      if (body.op === 'delete') {
        await exec(supabase.from('rfqs').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else if (body.op === 'status' || body.id) {
        const id = String(body.id || '').slice(0, 80);
        const patch = { updated_at: new Date().toISOString() };
        if (body.status) patch.status = status;
        if (body.title != null) patch.title = String(body.title).slice(0, 160);
        await exec(supabase.from('rfqs').update(patch).eq('id', id).eq('user_id', uid));
        await exec(supabase.from('user_rfqs').update({ status: status }).eq('id', id).eq('user_id', uid));
      } else {
        const row = {
          user_id: uid,
          title: String(body.title || 'RFQ').slice(0, 160),
          reference: String(body.reference || '').slice(0, 80) || null,
          status: status,
          kv: String(body.kv || body.voltage || '').slice(0, 80) || null,
          mva: String(body.mva || body.rating || '').slice(0, 40) || null,
          quantity: String(body.quantity || '').slice(0, 40) || null,
          deadline: String(body.deadline || '').slice(0, 40) || null,
          country: String(body.country || body.destination || '').slice(0, 80) || null,
          category: String(body.category || '').slice(0, 80) || null,
          notes: String(body.notes || body.details || '').slice(0, 4000) || null,
          data: body.data && typeof body.data === 'object' ? body.data : {},
          updated_at: new Date().toISOString(),
        };
        await exec(supabase.from('rfqs').insert(row));
        await exec(supabase.from('user_rfqs').insert({
          user_id: uid,
          reference: row.reference,
          category: row.category,
          quantity: row.quantity,
          rating: row.mva,
          voltage: row.kv,
          destination: row.country,
          title: row.title,
          status: row.status === 'Draft' ? 'draft' : 'open',
          deadline: row.deadline,
          country: row.country,
          notes: row.notes,
        }));
      }
    } else if (action === 'requirement') {
      if (body.op === 'delete') {
        await exec(supabase.from('saved_requirements').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('saved_requirements').insert({
          user_id: uid,
          title: String(body.title || 'Requirement').slice(0, 160),
          mva: String(body.mva || body.rating || '').slice(0, 40) || null,
          kv: String(body.kv || body.voltage || '').slice(0, 80) || null,
          notes: String(body.notes || '').slice(0, 2000) || null,
          updated_at: new Date().toISOString(),
        }));
      }
    } else if (action === 'company_claim') {
      const company = String(body.company || body.name || '').slice(0, 160);
      if (!company) return respond(400, { error: 'company required' });
      const country = String(body.country || '').slice(0, 80);
      const companyId = String(body.company_id || body.claimed_company_id || '').slice(0, 120);
      await exec(supabase.from('company_claims').upsert({
        user_id: uid, company: company, country: country || null,
        company_id: companyId || null, status: 'requested',
      }, { onConflict: 'user_id,company' }));
      await exec(supabase.from('learner_profiles').upsert({
        user_id: uid,
        claimed_company_id: companyId || company,
        claimed_company_name: company,
        claimed_country: country || null,
        is_supplier: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }));
      await exec(supabase.from('account_roles').upsert({ user_id: uid, role: 'SUPPLIER' }, { onConflict: 'user_id,role' }));
      await exec(supabase.from('supplier_profiles').upsert({
        user_id: uid, company_name: company, company_id: companyId || company,
        country: country || null, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }));
    } else if (action === 'supplier_profile') {
      await exec(supabase.from('supplier_profiles').upsert({
        user_id: uid,
        company_name: String(body.company_name || body.company || '').slice(0, 160) || null,
        company_id: String(body.company_id || '').slice(0, 120) || null,
        country: String(body.country || '').slice(0, 80) || null,
        categories: String(body.categories || '').slice(0, 240) || null,
        about: String(body.about || '').slice(0, 2000) || null,
        capabilities: String(body.capabilities || '').slice(0, 2000) || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }));
    } else if (action === 'supplier_facility') {
      if (body.op === 'delete') {
        await exec(supabase.from('supplier_facilities').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('supplier_facilities').insert({
          user_id: uid,
          name: String(body.name || 'Facility').slice(0, 120),
          country: String(body.country || '').slice(0, 80) || null,
          notes: String(body.notes || '').slice(0, 400) || null,
        }));
      }
    } else if (action === 'supplier_product') {
      if (body.op === 'delete') {
        await exec(supabase.from('supplier_products').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('supplier_products').insert({
          user_id: uid,
          name: String(body.name || 'Capability').slice(0, 120),
          category: String(body.category || '').slice(0, 80) || null,
          notes: String(body.notes || '').slice(0, 400) || null,
        }));
      }
    } else if (action === 'analytics') {
      const { data: cur } = await supabase.from('analytics_counters').select('*').eq('user_id', uid).maybeSingle();
      const views = (cur && cur.profile_views || 0) + (parseInt(body.profile_views, 10) || (body.bump === 'profile_views' ? 1 : 0));
      const matches = (cur && cur.rfq_matches || 0) + (parseInt(body.rfq_matches, 10) || (body.bump === 'rfq_matches' ? 1 : 0));
      await exec(supabase.from('analytics_counters').upsert({
        user_id: uid, profile_views: views, rfq_matches: matches, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }));
    } else if (action === 'follow') {
      if (body.op === 'remove' || body.unfollow) {
        await exec(supabase.from('follows').delete().eq('user_id', uid)
          .eq('subject_type', String(body.subject_type || body.type || ''))
          .eq('subject', String(body.subject || '')));
      } else {
        await exec(supabase.from('follows').upsert({
          user_id: uid,
          subject_type: String(body.subject_type || body.type || 'market').slice(0, 40),
          subject: String(body.subject || '').slice(0, 160),
          label: String(body.label || body.subject || '').slice(0, 160),
        }, { onConflict: 'user_id,subject_type,subject' }));
      }
    } else if (action === 'watchlist') {
      if (body.op === 'delete') {
        await exec(supabase.from('watchlists').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('watchlists').insert({
          user_id: uid,
          name: String(body.name || 'Watchlist').slice(0, 120),
          subjects: Array.isArray(body.subjects) ? body.subjects : [],
        }));
      }
    } else if (action === 'saved_search') {
      if (body.op === 'delete') {
        await exec(supabase.from('saved_searches').delete().eq('id', String(body.id || '')).eq('user_id', uid));
      } else {
        await exec(supabase.from('saved_searches').insert({
          user_id: uid,
          name: String(body.name || 'Search').slice(0, 120),
          query: String(body.query || '').slice(0, 200),
          href: String(body.href || '').slice(0, 240) || null,
        }));
      }
    } else if (action === 'video_watch') {
      const videoId = String(body.video_id || '').slice(0, 80);
      if (!videoId) return respond(400, { error: 'video_id required' });
      const percent = Math.max(0, Math.min(100, parseInt(body.percent, 10) || 100));
      const loopId = String(body.loop_id || 'academy').slice(0, 64);
      await exec(supabase.from('video_progress').upsert({
        user_id: uid, video_id: videoId, loop_id: loopId, percent: percent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,video_id' }));
      await exec(supabase.from('lesson_progress').upsert({
        user_id: uid, lesson_id: 'video-' + videoId, module_id: loopId,
        status: percent >= 100 ? 'COMPLETE' : 'IN PROGRESS', percent: percent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_id' }));
      /* Watch is progress only — do not writeSkill / do not raise a Passport level. */
      if (body.skill_id) {
        await supabase.from('skill_evidence').insert({
          user_id: uid, skill_id: String(body.skill_id).slice(0, 64), kind: 'watch', ref: videoId,
        });
      }
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
    versions, projects, notes, savedItems, rfqs, userRfqs, comparisons,
    requirements, claims, supplierRows, facilities, products, analyticsRows,
    follows, watchlists, searches, videos,
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
    sel('design_versions', 'user_id'),
    sel('projects', 'user_id'),
    sel('notes', 'user_id'),
    sel('saved_items', 'user_id'),
    sel('rfqs', 'user_id'),
    sel('user_rfqs', 'user_id'),
    sel('comparisons', 'user_id'),
    sel('saved_requirements', 'user_id'),
    sel('company_claims', 'user_id'),
    sel('supplier_profiles', 'user_id'),
    sel('supplier_facilities', 'user_id'),
    sel('supplier_products', 'user_id'),
    sel('analytics_counters', 'user_id'),
    sel('follows', 'user_id'),
    sel('watchlists', 'user_id'),
    sel('saved_searches', 'user_id'),
    sel('video_progress', 'user_id'),
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
  const ownRfqs = (rfqs && rfqs.length) ? rfqs : (userRfqs || []);
  let inboxSource = ownRfqs;
  if (flags.isSupplier) {
    try {
      const { data: all, error } = await supabase.from('rfqs').select('*').neq('status', 'Draft');
      if (!error && all && all.length) inboxSource = all;
    } catch (e) { /* table_missing — fall back to own RFQs (demo dual-role) */ }
  }
  const supplierProfile = (supplierRows && supplierRows[0]) || learner || {};
  const rfqInbox = model.matchRfqsForSupplier(inboxSource, supplierProfile);

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
    saved_designs: (designs || []).map((d) => ({
      id: d.id, name: d.name, kind: d.kind, rating: d.rating, voltages: d.voltages,
      notes: d.notes, data: d.data, created_at: d.created_at, updated_at: d.updated_at,
    })),
    design_versions: (versions || []).map((v) => ({ id: v.id, design_id: v.design_id, created_at: v.created_at })),
    projects: projects || [],
    notes: notes || [],
    saved_items: savedItems || [],
    shortlist: (savedItems || []).filter((i) => /company|facility|component|lab|manufacturer/i.test(i.item_type || '')),
    rfqs: ownRfqs,
    comparisons: comparisons || [],
    requirements: requirements || [],
    company_claims: claims || [],
    supplier_profile: (supplierRows && supplierRows[0]) || null,
    supplier_facilities: facilities || [],
    supplier_products: products || [],
    analytics: (analyticsRows && analyticsRows[0]) || { profile_views: 0, rfq_matches: rfqInbox.length },
    follows: follows || [],
    watchlists: watchlists || [],
    saved_searches: searches || [],
    video_progress: videos || [],
    rfq_inbox: rfqInbox,
    certificates: certs || [],
  };
}

function aggregateGrid(rows) {
  if (!rows || !rows.length) return 0;
  const n = rows.length;
  const sum = rows.reduce((s, r) => s + (parseInt(r.percent, 10) || (r.status === 'COMPLETE' ? 100 : 0)), 0);
  return n ? Math.round(sum / n) : 0;
}
