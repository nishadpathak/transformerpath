/* TransformerPath Academy loops.
 * Spine: READ → WATCH → EXPLORE IN 3D → CALCULATE → SIMULATE → TEST
 * A watch writes progress (lesson_progress / video_progress). It does NOT
 * award a Skills Passport level. Assessment, calculation, Grid Lab and
 * capstone remain the evidence kinds that demonstrate understanding.
 */
(function () {
  'use strict';
  var KEY = 'tp-video-progress';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveLocal(map) {
    try { localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {}
  }
  function isWatched(id) { return !!(loadLocal()[id]); }
  function markLocal(id, meta) {
    var m = loadLocal();
    m[id] = Object.assign({ at: new Date().toISOString(), percent: 100 }, meta || {});
    saveLocal(m);
  }

  function postWatch(body) {
    if (window.TP_LEARNER && TP_LEARNER.post) {
      return TP_LEARNER.post(Object.assign({ action: 'video_watch' }, body)).catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  function markWatched(videoId, loopId, skillId) {
    if (!videoId) return Promise.resolve(false);
    markLocal(videoId, { loop_id: loopId || '', skill_id: skillId || '' });
    return postWatch({
      video_id: videoId,
      loop_id: loopId || '',
      skill_id: skillId || '',
      percent: 100
    }).then(function () { return true; });
  }

  function loopIdFromLocation() {
    var q = new URLSearchParams(location.search).get('id');
    if (q) return q;
    var p = (location.pathname || '').replace(/\/$/, '');
    var m = p.match(/\/academy\/([^/]+)$/);
    if (m && m[1] && m[1] !== 'academy') return m[1];
    if (location.hash) return location.hash.replace('#', '');
    return '';
  }

  function renderCatalog(host, data) {
    if (!host || !data) return;
    var loops = data.loops || [];
    host.innerHTML = loops.map(function (lp) {
      var href = 'academy-loop.html?id=' + encodeURIComponent(lp.id);
      var yt = lp.public_youtube ? '<span class="tag">YouTube foundation (when published)</span>' : '';
      var fac = lp.factory ? '<span class="tag">Factory footage · permission</span>' : '';
      return '<a class="card" href="' + esc(href) + '">' +
        '<span class="go">→</span>' +
        '<div class="ico">' + (lp.flagship ? '⚡' : '▶') + '</div>' +
        '<h2>' + esc(lp.title) + '</h2>' +
        '<p>' + esc(lp.subtitle || '') + '</p>' +
        '<div class="tags"><span class="tag">' + esc(lp.level) + '</span>' + yt + fac +
        '<span class="tag">' + (lp.steps || []).length + ' steps</span></div></a>';
    }).join('');
  }

  function renderLoop(host, data, id) {
    if (!host) return;
    var lp = (data.loops || []).filter(function (x) { return x.id === id; })[0];
    if (!lp) {
      host.innerHTML = '<p>Loop not found. <a href="academy.html">Back to Academy</a>.</p>';
      return;
    }
    var steps = lp.steps || [];
    var html = '';
    html += '<p class="ws-sub"><a href="academy.html">Academy</a> · ' + esc(lp.level) + ' · ' + esc(lp.series) + '</p>';
    html += '<h1>' + esc(lp.title) + '</h1>';
    html += '<p class="ws-sub">' + esc(lp.subtitle || '') + '</p>';
    html += '<p class="ac-spine">' + (data.spine || []).map(function (s) {
      return '<span>' + esc(s) + '</span>';
    }).join('<span class="ac-arrow">→</span>') + '</p>';
    if (lp.public_youtube) {
      html += '<p class="ws-sub">Foundation layer: this loop is intended for public YouTube when the film is published. Continue interactively here — 3D, Grid Lab, calculator and assessments are what YouTube cannot do.</p>';
    }
    if (lp.factory) {
      html += '<p class="ws-sub">Real factory footage sits next to the 3D explanation once a manufacturer grants permission. The Explore step is live today.</p>';
    }
    html += '<ol class="ac-steps">';
    steps.forEach(function (st, i) {
      var n = i + 1;
      html += '<li class="ac-step" data-kind="' + esc(st.kind) + '">';
      html += '<div class="ac-kind">' + n + ' — ' + esc(st.kind) + (st.minutes ? ' · ' + st.minutes + ' min' : '') + '</div>';
      html += '<h2>' + esc(st.title) + '</h2>';
      if (st.outline && st.outline.length) {
        html += '<ul>' + st.outline.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>';
      }
      if (st.kind === 'WATCH') {
        var done = isWatched(st.id);
        html += '<div class="ac-player"><p class="ws-sub">' +
          (st.status === 'factory-permission'
            ? 'Factory clip not on the site yet (permission). Mark watched only after you have used the 3D lab beside it.'
            : (st.youtube
              ? 'YouTube embed when the film is published.'
              : 'Script is on this page — 4–10 min concept, not a lecture. Mark watched when you have read the outline. This records progress, not a Skills Passport level.')) +
          '</p>';
        html += '<button type="button" class="btn btn-amber btn-sm" data-watch="' + esc(st.id || '') + '"' +
          (done ? ' disabled' : '') + '>' + (done ? 'Watched — progress recorded' : 'Mark watched (progress only)') + '</button></div>';
      }
      if (st.href) {
        html += '<p><a class="btn btn-outline btn-sm" href="' + esc(st.href) + '">Open →</a></p>';
      }
      html += '</li>';
    });
    html += '</ol>';
    html += '<p class="ws-sub">WATCH → EXPLORE → PRACTICE → ASSESS → SKILL EVIDENCE. Playing a video does not award competency. <b>Course completion record, not a qualification.</b></p>';
    html += '<p><a href="workspace.html#learning">Record on My TransformerPath →</a></p>';
    host.innerHTML = html;

    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-watch]');
      if (!b) return;
      var vid = b.getAttribute('data-watch');
      markWatched(vid, lp.id, lp.skill).then(function () {
        b.textContent = 'Watched — progress recorded';
        b.disabled = true;
      });
    });
  }

  window.TP_ACADEMY = {
    loopIdFromLocation: loopIdFromLocation,
    renderCatalog: renderCatalog,
    renderLoop: renderLoop,
    markWatched: markWatched,
    isWatched: isWatched
  };
})();
