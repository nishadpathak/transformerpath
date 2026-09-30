/* Learner Profile + My TransformerPath hub helpers.
 * Public name (never "Student Profile"). Combinable roles LEARNER | BUYER | SUPPLIER.
 * Short onboarding: public name + role + experience + interest. No address/CV/phone.
 * No leaderboards, XP, coins or badge spam.
 */
(function () {
  'use strict';
  var SKILLS = [];
  var GROUPS = [];
  var PASSPORT = null;
  var LABS = null;
  var PATH = null;
  var LEVEL_KINDS = { lesson: 1, assessment: 1, calculation: 1, grid_lab: 1, capstone: 1 };
  var ROLES = [
    { value: 'student', label: 'Student' },
    { value: 'graduate_engineer', label: 'Graduate Engineer' },
    { value: 'design_engineer', label: 'Design Engineer' },
    { value: 'manufacturing_engineer', label: 'Manufacturing Engineer' },
    { value: 'testing_engineer', label: 'Testing Engineer' },
    { value: 'service_engineer', label: 'Service Engineer' },
    { value: 'utility_engineer', label: 'Utility Engineer' },
    { value: 'procurement', label: 'Procurement' },
    { value: 'sales_bd', label: 'Sales/BD' },
    { value: 'educator', label: 'Educator' },
    { value: 'other', label: 'Other' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function post(body) {
    if (!window.TP || !TP.getSession) return Promise.resolve(null);
    return TP.getSession().then(function (r) {
      var sess = r && r.data && r.data.session;
      if (!sess) return null;
      return fetch('/.netlify/functions/account', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sess.access_token },
        body: JSON.stringify(body),
      }).then(function (x) { return x.json(); });
    });
  }

  function getSnap() {
    if (!window.TP || !TP.getSession) return Promise.resolve(null);
    return TP.getSession().then(function (r) {
      var sess = r && r.data && r.data.session;
      if (!sess) return null;
      return fetch('/.netlify/functions/account', {
        headers: { authorization: 'Bearer ' + sess.access_token },
      }).then(function (x) { return x.json(); }).catch(function () { return null; });
    });
  }

  function showOnboarding(user) {
    var host = document.getElementById('tpOnboard');
    if (!host) return;
    host.hidden = false;
    var roleOpts = ROLES.map(function (r) {
      return '<option value="' + esc(r.value) + '">' + esc(r.label) + '</option>';
    }).join('');
    host.innerHTML =
      '<form id="onbForm" class="auth-card" style="max-width:520px;margin:0 auto 24px">' +
        '<h3 style="margin:0 0 8px">Your Transformer Path</h3>' +
        '<p class="auth-note">Four short fields. This is your Learner Profile — a public name, not a student scoreboard. No address, CV or phone.</p>' +
        '<label>Public name<input name="public_name" required maxlength="80" placeholder="How should we address you?"></label>' +
        '<label>Role<select name="onboarding_role" required>' + roleOpts + '</select></label>' +
        '<label>Experience<select name="onboarding_experience" required>' +
          '<option value="beginner">Beginning</option>' +
          '<option value="practicing">Practicing</option>' +
          '<option value="specialist">Specialist</option>' +
        '</select></label>' +
        '<label>Interests<select name="onboarding_interest" required>' +
          '<option value="design">Transformer design</option>' +
          '<option value="grids">Grid systems</option>' +
          '<option value="sourcing">Sourcing &amp; RFQ</option>' +
          '<option value="operations">Operations &amp; assets</option>' +
          '<option value="manufacturing">Manufacturing</option>' +
          '<option value="testing">Testing</option>' +
          '<option value="other">Other</option>' +
        '</select></label>' +
        '<button class="btn btn-amber" type="submit">Save and open My TransformerPath</button>' +
      '</form>';
    document.getElementById('onbForm').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var payload = { action: 'onboard' };
      fd.forEach(function (v, k) { payload[k] = v; });
      post(payload).then(function () {
        try { localStorage.setItem('tp-onboard', '1'); } catch (x) {}
        host.hidden = true;
        if (document.body && document.body.getAttribute('data-tp-onboard-page')) {
          var nxt = '';
          try { nxt = localStorage.getItem('tp-next') || ''; } catch (x) {}
          location.replace((nxt && /pricing\.html/.test(nxt)) ? nxt : 'workspace.html');
          return;
        }
        if (window.TP_HUB && TP_HUB.refresh) TP_HUB.refresh();
      });
    };
  }

  function normalizeLevel(level) {
    var L = String(level || 'NOT STARTED');
    if (L === 'INTRODUCED') return 'Developing';
    if (L === 'PRACTICED') return 'Intermediate';
    if (L === 'DEMONSTRATED') return 'Advanced';
    return L;
  }

  function uniqueKinds(list) {
    return (list || []).filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  function levelEvidenceKinds(kinds) {
    return (kinds || []).filter(function (k) { return LEVEL_KINDS[k]; });
  }

  function skillRow(c, rec, kinds) {
    var levelKinds = levelEvidenceKinds(kinds);
    var watchOnly = kinds.length > 0 && !levelKinds.length;
    var level = 'NOT STARTED';
    var how;
    if (watchOnly) {
      how = 'Watch recorded (progress only). Passport levels need assessment, calculation, Grid Lab or capstone evidence — not a page visit.';
    } else if (rec) {
      level = normalizeLevel(rec.level);
      how = levelKinds.length ? levelKinds.join(' + ') : (rec.how_earned || c.how);
    } else {
      how = c.how;
    }
    return '<div class="ws-row"><span class="ws-note-title">' + esc(c.name) + '</span>' +
      '<span class="ws-sub">' + esc(level) + ' · ' + esc(how) + '</span></div>';
  }

  function renderSkills(el, records, evidence) {
    if (!el) return;
    var byId = {};
    (records || []).forEach(function (r) { byId[r.skill_id] = r; });
    var evBy = {};
    (evidence || []).forEach(function (e) {
      evBy[e.skill_id] = evBy[e.skill_id] || [];
      evBy[e.skill_id].push(e.kind);
    });
    if (!SKILLS.length) {
      el.innerHTML = '<p class="ws-empty">Skills Passport catalog loading…</p>';
      return;
    }
    var note = (PASSPORT && PASSPORT.evidence_note) ||
      'Evidence-based only (lesson, assessment, calculation, Grid Lab, capstone). Opening a Lab or a 3D view is not evidence. Course completion record, not a qualification.';
    var groups = GROUPS.length ? GROUPS : [{ id: 'all', title: 'Skills' }];
    var html = '<p class="ws-sub">' + esc(note) + '</p>';
    groups.forEach(function (g) {
      var comps = SKILLS.filter(function (c) {
        return (c.group || '') === g.id || (c.family || '') === g.title;
      });
      if (!comps.length && g.id !== 'all') return;
      if (g.id === 'all') comps = SKILLS;
      var evidenced = 0;
      comps.forEach(function (c) {
        var kinds = uniqueKinds(evBy[c.id] || []);
        if (levelEvidenceKinds(kinds).length || (byId[c.id] && !kinds.length)) evidenced++;
      });
      html += '<h4 style="margin:16px 0 6px;font-size:.78rem;letter-spacing:.06em;color:var(--muted)">' +
        esc(g.title) + '</h4>';
      html += '<p class="ws-sub">' + evidenced + ' of ' + comps.length +
        ' with recorded evidence (not page visits)</p>';
      html += comps.map(function (c) {
        return skillRow(c, byId[c.id], uniqueKinds(evBy[c.id] || []));
      }).join('');
    });
    el.innerHTML = html;
  }

  function labStatusLabel(st) {
    if (st === 'live') return 'Live';
    if (st === 'index') return 'Index';
    return 'Coming';
  }

  function renderLabs(el, catalog) {
    if (!el) return;
    var data = catalog || LABS;
    if (!data) {
      el.innerHTML = '<p class="ws-empty">Engineering Labs catalog loading…</p>';
      fetch('data/engineering-labs.json', { cache: 'no-cache' })
        .then(function (r) { return r.json(); })
        .then(function (d) { LABS = d; renderLabs(el, d); })
        .catch(function () {
          el.innerHTML = '<p class="ws-empty">Open the <a href="engineering-lab.html">Engineering Lab index</a>.</p>';
        });
      return;
    }
    var mm = data.mental_models || {};
    var html = '<p class="ws-sub">' + esc(data.framing || 'Think in Labs and systems, not in “3D models”.') + '</p>';
    if (mm.system) html += '<p class="ws-sub"><b>System:</b> ' + esc(mm.system) + '</p>';
    if (mm.process) html += '<p class="ws-sub"><b>Process:</b> ' + esc(mm.process) + '</p>';
    (data.labs || []).forEach(function (lab) {
      var href = lab.href || ('engineering-lab.html#' + lab.id);
      var title = lab.href
        ? '<a href="' + esc(href) + '">' + esc(lab.title) + '</a>'
        : esc(lab.title);
      html += '<div class="ws-row" style="align-items:flex-start;flex-wrap:wrap">';
      html += '<span class="ws-note-title">' + title + '</span>';
      html += '<span class="lab-st lab-st-' + esc(lab.status || 'coming') + '">' + esc(labStatusLabel(lab.status)) + '</span>';
      html += '<span class="ws-sub" style="flex-basis:100%">' + esc(lab.summary || '') + '</span>';
      html += '</div>';
      if (lab.drilldown && lab.drilldown.length) {
        html += '<p class="ws-sub" style="margin:4px 0 10px">Drill-down: ' +
          lab.drilldown.map(function (s) {
            return '<a href="' + esc(s.href) + '">' + esc(s.step) + '</a>';
          }).join(' → ') + '</p>';
      }
      if (lab.related && lab.related.length) {
        html += '<p class="ws-sub" style="margin:4px 0 10px">' +
          lab.related.map(function (s) {
            return '<a href="' + esc(s.href) + '">' + esc(s.label) + '</a>';
          }).join(' · ') + '</p>';
      }
    });
    html += '<p class="ws-sub" style="margin-top:10px"><a href="engineering-lab.html">Open the Engineering Lab index →</a></p>';
    el.innerHTML = html;
  }

  function renderGrid(el, catalog, rows) {
    if (!el) return;
    var byId = {};
    (rows || []).forEach(function (r) { byId[r.scenario_id] = r; });
    var n = (catalog || []).length || 1;
    var sum = 0;
    var html = (catalog || []).map(function (s) {
      var rec = byId[s.id];
      var pct = rec ? (parseInt(rec.percent, 10) || 0) : 0;
      var st = rec && rec.status ? rec.status : (pct >= 100 ? 'COMPLETE' : 'NOT STARTED');
      sum += pct;
      return '<div class="ws-row"><span class="ws-note-title">' + esc(s.title) + '</span>' +
        '<span class="ws-sub">' + esc(st) + (pct && st !== 'COMPLETE' ? ' · ' + pct + '%' : '') + '</span></div>';
    }).join('');
    var agg = Math.round(sum / n);
    el.innerHTML = '<p class="ws-sub">Grid Systems aggregate <b>' + agg + '%</b> — named scenarios, not “visited”.</p>' +
      (html || '<p class="ws-empty">Open <a href="grid-lab.html">Grid Lab</a> to start scenarios.</p>');
  }

  function moduleStatus(mod, lessons, assessments) {
    var rec = (lessons || []).find(function (r) { return r.lesson_id === mod.id || r.module_id === mod.id; });
    var pct = rec ? (parseInt(rec.percent, 10) || 0) : 0;
    if (mod.assessment) {
      var a = (assessments || []).find(function (r) { return r.assessment_id === mod.assessment && r.passed; });
      if (a) pct = Math.max(pct, 100);
    }
    var st = pct >= 100 ? 'COMPLETE' : (pct > 0 ? (pct + '%') : 'NOT STARTED');
    return { percent: pct, status: st };
  }

  function renderLearning(els, snap) {
    if (!PATH) return;
    var learner = (snap && snap.learner) || {};
    var lessons = (snap && snap.lesson_progress) || [];
    var assessments = (snap && snap.assessment_results) || [];
    var name = learner.public_name || (snap && snap.user && snap.user.email) || '—';
    var track = learner.det_level || 'Level 1 — Foundations';
    var modules = [];
    (PATH.groups || []).forEach(function (g) { (g.modules || []).forEach(function (m) { modules.push(m); }); });
    var sum = 0;
    modules.forEach(function (m) { sum += moduleStatus(m, lessons, assessments).percent; });
    var overall = modules.length ? Math.round(sum / modules.length) : 0;
    if (els.name) els.name.textContent = name;
    if (els.track) els.track.textContent = track;
    if (els.overall) els.overall.textContent = overall + '%';
    var resume = null;
    for (var i = 0; i < modules.length; i++) {
      var st = moduleStatus(modules[i], lessons, assessments);
      if (st.percent < 100) { resume = { mod: modules[i], st: st }; break; }
    }
    if (els.continue) {
      els.continue.innerHTML = resume
        ? '<div class="ws-row"><a href="' + esc(resume.mod.href) + '">' + esc(resume.mod.title) + '</a><span class="ws-sub">' + esc(resume.st.status) + '</span></div>' +
          '<p class="ws-sub"><a href="assessments.html">Knowledge checks &amp; practical exercises →</a></p>'
        : '<p class="ws-sub">Path complete on record. Open <a href="grid-lab.html">Grid Lab</a> or <a href="assessments.html">assessments</a>.</p>';
    }
    if (els.path) {
      els.path.innerHTML = (PATH.groups || []).map(function (g) {
        var rows = (g.modules || []).map(function (m) {
          var s = moduleStatus(m, lessons, assessments);
          return '<div class="ws-row"><a href="' + esc(m.href) + '">' + esc(m.title) + '</a><span class="ws-sub">' + esc(s.status) + '</span></div>';
        }).join('');
        return '<h4 style="margin:14px 0 6px;font-size:.78rem;letter-spacing:.06em;color:var(--muted)">' + esc(g.title) + '</h4>' + rows;
      }).join('');
    }
  }

  function renderDesigns(el, rows, entitlement) {
    if (!el) return;
    var pro = entitlement && (entitlement.professional || entitlement.rank >= 2);
    var list = (rows || []).map(function (d) {
      return '<div class="ws-row"><span class="ws-note-title">' + esc(d.name || 'Untitled') + '</span><span class="ws-sub">' + esc(d.kind || 'design') + '</span></div>';
    }).join('');
    if (!pro) {
      el.innerHTML = '<p class="ws-sub">My Designs is on the Professional entitlement (saved calculator work, Sprint 4). <a href="pricing.html">Choose Professional →</a></p>' + (list || '');
      return;
    }
    el.innerHTML = list || '<p class="ws-empty">No saved designs yet. Save from the Design Calculator (Professional).</p>';
  }

  window.TP_LEARNER = {
    showOnboarding: showOnboarding,
    getSnap: getSnap,
    post: post,
    renderSkills: renderSkills,
    renderLabs: renderLabs,
    renderGrid: renderGrid,
    renderLearning: renderLearning,
    renderDesigns: renderDesigns,
    setSkills: function (s) { SKILLS = s || []; },
    path: function () { return PATH; },
  };

  fetch('data/skills-passport.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      PASSPORT = d;
      SKILLS = d.competencies || [];
      GROUPS = d.groups || [];
    })
    .catch(function () {});
  fetch('data/engineering-labs.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) { LABS = d; })
    .catch(function () {});
  fetch('data/learning-path.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) { PATH = d; })
    .catch(function () {});
})();
