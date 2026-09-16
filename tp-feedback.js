/* ============================================================================
   TransformerPath — site-wide feedback capture (Beta)
   ----------------------------------------------------------------------------
   Complements the inline "Was this useful?" yes/no box on materials, learn and
   intel: that one measures a single page's usefulness, this one is a reporting
   channel for the whole site. Both are kept.

   This one:
     · is available on every page
     · offers the seven categories Beta actually needs to triage
     · captures the originating page, title and on-page entity automatically,
       so a reporter never has to explain where they were

   Posts to Netlify Forms as "site-feedback". Netlify registers form names from
   static HTML at deploy time, so index.html carries a hidden declaration of the
   same name and field set — without it, submissions from this injected form
   would 404. See the block marked TP-FEEDBACK-DECLARATION.
   ========================================================================== */
(function () {
  'use strict';

  var CATEGORIES = [
    'General feedback',
    'Technical correction',
    'Data correction',
    'Feature request',
    'Missing company / project / event',
    'Course feedback',
    'RFQ feedback'
  ];

  /* What is this page about? Prefer an explicit marker, then the H1, then the
     title — so a data correction on a manufacturer arrives already identified. */
  function entity() {
    var el = document.querySelector('[data-tp-entity]');
    if (el) return el.getAttribute('data-tp-entity');
    var h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim().slice(0, 120);
    return (document.title || '').split('—')[0].trim().slice(0, 120);
  }

  function build() {
    if (document.getElementById('tpFbBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'tpFbBtn';
    btn.type = 'button';
    btn.textContent = 'Feedback';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');

    var box = document.createElement('div');
    box.id = 'tpFbBox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Send feedback');
    box.hidden = true;
    box.innerHTML =
      '<form id="tpFbForm">' +
        '<label for="tpFbCat">What kind of feedback?</label>' +
        '<select id="tpFbCat" name="category">' +
          CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') +
        '</select>' +
        '<label for="tpFbMsg">Details</label>' +
        '<textarea id="tpFbMsg" name="message" rows="4" required ' +
          'placeholder="What is wrong, missing or confusing? A specific example helps most."></textarea>' +
        '<label for="tpFbEmail">Email <span class="tpfb-opt">(optional, only if you want a reply)</span></label>' +
        '<input id="tpFbEmail" name="email" type="email" autocomplete="email">' +
        '<div class="tpfb-ctx" id="tpFbCtx"></div>' +
        '<div class="tpfb-row">' +
          '<button type="submit" class="tpfb-send">Send</button>' +
          '<button type="button" class="tpfb-cancel" id="tpFbCancel">Cancel</button>' +
        '</div>' +
        '<p class="tpfb-msg" id="tpFbState" role="status"></p>' +
      '</form>';

    document.body.appendChild(btn);
    document.body.appendChild(box);

    var page = location.pathname.split('/').pop() || 'index.html';
    var ent = entity();
    document.getElementById('tpFbCtx').textContent = 'Sending about: ' + page + (ent ? ' — ' + ent : '');

    function open(on) {
      box.hidden = !on;
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) document.getElementById('tpFbMsg').focus();
    }
    btn.addEventListener('click', function () { open(box.hidden); });
    document.getElementById('tpFbCancel').addEventListener('click', function () { open(false); btn.focus(); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && !box.hidden) { open(false); btn.focus(); }
    });

    document.getElementById('tpFbForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var state = document.getElementById('tpFbState');
      var data = new URLSearchParams();
      data.append('form-name', 'site-feedback');
      data.append('bot-field', '');   /* matches the honeypot on the declaration */
      data.append('category', document.getElementById('tpFbCat').value);
      data.append('message', document.getElementById('tpFbMsg').value);
      data.append('email', document.getElementById('tpFbEmail').value);
      /* Captured for the reporter, not asked of them. */
      data.append('page', page);
      data.append('entity', ent);
      data.append('url', location.href);
      data.append('title', document.title);
      state.textContent = 'Sending…';
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString()
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        box.innerHTML = '<p class="tpfb-done">Thank you — that is with us.<br>' +
          '<span>We read every Beta report.</span></p>';
      }).catch(function () {
        state.textContent = 'Could not send. Please email hello@transformerpath.com.';
        state.style.color = '#b91c1c';
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
