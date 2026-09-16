/* TransformerPath Grid Lab — scenario runner + progress.
 *
 * Progress is stored on the account when signed in (/.netlify/functions/account),
 * and mirrored to localStorage as a cache only. Status is COMPLETE / percent /
 * NOT STARTED. Aggregate Grid Systems % is the mean across the scenario catalog.
 */
(function () {
  'use strict';
  var KEY = 'tp-grid-lab-progress';
  var CATALOG = [];
  var progress = {};
  var root = document.getElementById('gridLabRoot');
  if (!root) return;

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function writeLocal(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
  }
  function token() {
    try {
      if (window.TP && TP.user && window.supabase) return null;
    } catch (e) {}
    return null;
  }

  function statusOf(id) {
    var row = progress[id];
    if (!row) return { status: 'NOT STARTED', percent: 0 };
    return { status: row.status || (row.percent >= 100 ? 'COMPLETE' : 'NOT STARTED'), percent: row.percent || 0 };
  }

  function aggregate() {
    if (!CATALOG.length) return 0;
    var sum = 0;
    CATALOG.forEach(function (s) { sum += statusOf(s.id).percent; });
    return Math.round(sum / CATALOG.length);
  }

  function nextRec() {
    for (var i = 0; i < CATALOG.length; i++) {
      if (statusOf(CATALOG[i].id).percent < 100) return CATALOG[i];
    }
    return null;
  }

  function setProgress(id, percent, skill) {
    percent = Math.max(0, Math.min(100, percent));
    var status = percent >= 100 ? 'COMPLETE' : (percent > 0 ? 'IN PROGRESS' : 'NOT STARTED');
    progress[id] = { status: status, percent: percent, updated: new Date().toISOString() };
    writeLocal(progress);
    if (window.TP && TP.user && window.TP.saveGridLab) {
      TP.saveGridLab(id, percent, skill);
    } else if (window.TP && TP.user) {
      postAccount({ action: 'grid_lab', scenario_id: id, percent: percent, skill_id: skill });
    }
    render();
  }

  function postAccount(body) {
    try {
      if (!window.TP || !TP.getSession) return;
      TP.getSession().then(function (r) {
        var sess = r && r.data && r.data.session;
        if (!sess || !sess.access_token) return;
        fetch('/.netlify/functions/account', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sess.access_token },
          body: JSON.stringify(body),
        }).catch(function () {});
      });
    } catch (e) {}
  }

  function render() {
    var agg = aggregate();
    var nxt = nextRec();
    var cards = CATALOG.map(function (s) {
      var st = statusOf(s.id);
      var badge = st.status === 'COMPLETE' ? 'COMPLETE' : (st.percent > 0 ? st.percent + '%' : 'NOT STARTED');
      var cls = st.status === 'COMPLETE' ? 'ok' : (st.percent > 0 ? 'mid' : 'off');
      return '<article class="gl-card" id="sc-' + s.id + '">' +
        '<div class="gl-card-top"><h3>' + s.title + '</h3><span class="gl-badge ' + cls + '">' + badge + '</span></div>' +
        '<p>' + s.summary + '</p>' +
        '<p class="gl-meta">' + s.minutes + ' min · ' + s.family + (s.census_count != null ? ' · census n=' + s.census_count : '') + '</p>' +
        '<button type="button" class="btn btn-amber btn-sm" data-open="' + s.id + '">' +
          (st.percent >= 100 ? 'Review' : (st.percent > 0 ? 'Continue' : 'Start')) + '</button>' +
        (s.directory_query ? ' <a class="btn btn-outline btn-sm" href="directory.html?q=' + encodeURIComponent(s.directory_query) + '">Directory: ' + s.directory_query + ' →</a>' : '') +
      '</article>';
    }).join('');

    root.innerHTML =
      '<div class="gl-agg">' +
        '<div><div class="gl-agg-label">Grid Systems</div><div class="gl-agg-num">' + agg + '%</div>' +
        '<div class="gl-bar"><span style="width:' + agg + '%"></span></div></div>' +
        '<div><div class="gl-agg-label">Next recommendation</div>' +
          (nxt ? '<a href="#sc-' + nxt.id + '">' + nxt.title + '</a>' : '<span>All scenarios complete.</span>') +
        '</div>' +
        '<p class="gl-note">Country Grid Lab (per-country engineering models) comes later — this lab is the global grid-systems track, not a new 3D model.</p>' +
      '</div>' +
      '<div class="gl-grid">' + cards + '</div>' +
      '<div id="glModal" hidden></div>';
  }

  function openScenario(id) {
    var s = null;
    CATALOG.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return;
    var modal = document.getElementById('glModal');
    var opts = (s.options || []).map(function (o, i) {
      return '<label class="gl-opt"><input type="radio" name="glAns" value="' + i + '"> ' + o + '</label>';
    }).join('');
    modal.hidden = false;
    modal.innerHTML =
      '<div class="gl-modal-card">' +
        '<h3>' + s.title + '</h3>' +
        '<p>' + s.summary + '</p>' +
        '<p><b>' + s.prompt + '</b></p>' +
        '<form id="glForm">' + opts +
          '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-amber" type="submit">Mark practiced (60%)</button>' +
            '<button class="btn btn-outline" type="button" id="glComplete">Mark complete</button>' +
            '<button class="btn btn-outline" type="button" id="glClose">Close</button>' +
          '</div>' +
        '</form>' +
        '<p class="gl-hint">' + (s.answer_hint || '') + '</p>' +
      '</div>';
    document.getElementById('glClose').onclick = function () { modal.hidden = true; };
    document.getElementById('glComplete').onclick = function () {
      setProgress(s.id, 100, s.skill);
      modal.hidden = true;
    };
    document.getElementById('glForm').onsubmit = function (e) {
      e.preventDefault();
      var cur = statusOf(s.id).percent;
      setProgress(s.id, Math.max(cur, 60), s.skill);
      modal.hidden = true;
    };
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-open]');
    if (t) openScenario(t.getAttribute('data-open'));
  });

  fetch('data/grid-lab.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      CATALOG = d.scenarios || [];
      progress = readLocal();
      if (window.TP && TP.onAuth) {
        TP.onAuth(function (user) {
          if (!user || !TP.getSession) { render(); return; }
          TP.getSession().then(function (r) {
            var sess = r && r.data && r.data.session;
            if (!sess) { render(); return; }
            fetch('/.netlify/functions/account', {
              headers: { authorization: 'Bearer ' + sess.access_token },
            }).then(function (x) { return x.json(); }).then(function (snap) {
              (snap.grid_lab && snap.grid_lab.scenarios || []).forEach(function (row) {
                progress[row.scenario_id] = { status: row.status, percent: row.percent };
              });
              writeLocal(progress);
              render();
            }).catch(function () { render(); });
          });
        });
      }
      render();
    })
    .catch(function () {
      root.innerHTML = '<p>Grid Lab catalog could not be loaded. Refresh, or open <a href="grids.html">World Grids</a>.</p>';
    });
})();
