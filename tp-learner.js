/* Learner Profile + My TransformerPath hub helpers.
 * Public name (never "Student Profile"). Combinable roles LEARNER | BUYER | SUPPLIER.
 * Onboarding is three questions. No leaderboards, XP, coins or badge spam.
 */
(function () {
  'use strict';
  var SKILLS = [];

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
    host.innerHTML =
      '<form id="onbForm" class="auth-card" style="max-width:520px;margin:0 auto 24px">' +
        '<h3 style="margin:0 0 8px">Your Transformer Path</h3>' +
        '<p class="auth-note">Three questions. This is your Learner Profile — a public name, not a student scoreboard.</p>' +
        '<label>Public name<input name="public_name" required maxlength="80" placeholder="How should we address you?"></label>' +
        '<label>Role<select name="onboarding_role" required>' +
          '<option value="engineer">Practicing engineer</option>' +
          '<option value="student">Learning the craft</option>' +
          '<option value="buyer">Buyer / procurement</option>' +
          '<option value="supplier">Supplier / manufacturer</option>' +
          '<option value="other">Other</option>' +
        '</select></label>' +
        '<label>Interest<select name="onboarding_interest" required>' +
          '<option value="design">Transformer design</option>' +
          '<option value="grids">Grid systems</option>' +
          '<option value="sourcing">Sourcing &amp; RFQ</option>' +
          '<option value="operations">Operations &amp; assets</option>' +
          '<option value="other">Other</option>' +
        '</select></label>' +
        '<label>Experience<select name="onboarding_experience" required>' +
          '<option value="beginner">Beginning</option>' +
          '<option value="practicing">Practicing</option>' +
          '<option value="specialist">Specialist</option>' +
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
        if (window.TP_HUB && TP_HUB.refresh) TP_HUB.refresh();
      });
    };
  }

  function renderSkills(el, records) {
    if (!el) return;
    var byId = {};
    (records || []).forEach(function (r) { byId[r.skill_id] = r; });
    if (!SKILLS.length) {
      el.innerHTML = '<p class="ws-empty">Skills Passport catalog loading…</p>';
      return;
    }
    el.innerHTML = SKILLS.map(function (c) {
      var rec = byId[c.id];
      var level = rec ? rec.level : 'NOT STARTED';
      var how = rec && rec.how_earned ? rec.how_earned : c.how;
      return '<div class="ws-row"><span class="ws-note-title">' + esc(c.name) + '</span>' +
        '<span class="ws-sub">' + esc(level) + ' · ' + esc(how) + '</span></div>';
    }).join('');
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
    el.innerHTML = '<p class="ws-sub">Grid Systems aggregate <b>' + agg + '%</b></p>' +
      (html || '<p class="ws-empty">Open <a href="grid-lab.html">Grid Lab</a> to start scenarios.</p>');
  }

  window.TP_LEARNER = {
    showOnboarding: showOnboarding,
    getSnap: getSnap,
    post: post,
    renderSkills: renderSkills,
    renderGrid: renderGrid,
    setSkills: function (s) { SKILLS = s || []; },
  };

  fetch('data/skills-passport.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) { SKILLS = d.competencies || []; })
    .catch(function () {});
})();
