/* TransformerPath — shared visualization engine (client).
 *
 * Reusable base for Masterclass + Engineering Workbench visualizations:
 *   - lightweight SVG primitive helpers
 *   - a control-bar builder (sliders, selects, buttons)
 *   - lazy initialisation (only when scrolled into view) for mobile performance
 *   - keyboard/label accessibility
 *   - an entitlement gate so premium labs are NOT shown to non-entitled users
 *     (no CSS hiding — the lab body is only rendered for entitled users)
 *
 * Load once; the individual labs attach to mount points.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function svg(w, h, cls) { return el('svg', { viewBox: '0 0 ' + (w || 300) + ' ' + (h || 200), width: '100%', 'class': cls || 'tp-viz-svg', role: 'img' }); }
  function line(x1, y1, x2, y2, attrs) { var s = attrs || {}; s.x1 = x1; s.y1 = y1; s.x2 = x2; s.y2 = y2; return el('line', s); }
  function poly(points, attrs) { var s = attrs || {}; s.points = points; return el('polygon', s); }
  function circle(cx, cy, r, attrs) { var s = attrs || {}; s.cx = cx; s.cy = cy; s.r = r; return el('circle', s); }
  function text(x, y, str, attrs) { var s = attrs || {}; s.x = x; s.y = y; var t = el('text', s); t.textContent = str; return t; }

  function lazyInit(root, fn) {
    if (!root) return;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { fn(root); io.disconnect(); } });
      }, { rootMargin: '120px' });
      io.observe(root);
    } else { fn(root); }
  }

  // Controls: rows of {label, type, min,max,step,value,on} buttons/sliders/selects.
  function controls(host, model, spec) {
    var bar = document.createElement('div'); bar.className = 'tp-viz-controls';
    spec.forEach(function (c) {
      if (c.type === 'select') {
        var lab = document.createElement('label'); lab.className = 'tp-viz-ctl';
        lab.innerHTML = '<span>' + c.label + '</span> ';
        var st = document.createElement('select');
        c.options.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; st.appendChild(op); });
        st.value = c.value; st.setAttribute('aria-label', c.label);
        st.addEventListener('change', function () { model[c.key] = st.value; c.on && c.on(st.value); });
        lab.appendChild(st); bar.appendChild(lab);
      } else if (c.type === 'range') {
        var rl = document.createElement('label'); rl.className = 'tp-viz-ctl tp-viz-range';
        var rv = document.createElement('span'); rv.className = 'tp-viz-val';
        var inp = document.createElement('input'); inp.type = 'range'; inp.min = c.min; inp.max = c.max; inp.step = c.step || 1; inp.value = c.value; inp.setAttribute('aria-label', c.label);
        var upd = function () { rv.textContent = c.fmt ? c.fmt(+inp.value) : inp.value; model[c.key] = +inp.value; c.on && c.on(+inp.value); };
        inp.addEventListener('input', upd); upd();
        rl.innerHTML = '<span>' + c.label + '</span>'; rl.appendChild(inp); rl.appendChild(rv); bar.appendChild(rl);
      } else if (c.type === 'button') {
        var b = document.createElement('button'); b.className = 'btn btn-outline btn-sm'; b.textContent = c.label; b.setAttribute('aria-label', c.label);
        b.addEventListener('click', function () { c.on && c.on(); }); bar.appendChild(b);
      }
    });
    host.appendChild(bar);
    return bar;
  }

  // Entitlement-aware laboratory mounting.
  // PRIVILEGE IS DECIDED SERVER-SIDE AT DELIVERY, not from a client cookie.
  // The lab lives inside content (a paid Masterclass chapter) that the gated
  // /.netlify/functions/masterclass-content endpoint returns ONLY after it has
  // verified a signed, unexpired entitlement. If you received the mount point,
  // the server already decided you may use it. Conversely, a lab that must be
  // independently gated passes `verify` (an async fn that asks the server);
  // the lab initializes only when the server returns authorized. A cookie's
  // mere presence NEVER grants access (it may be expired/malformed/tampered).
  function gate(host, renderFn, label, verify) {
    if (verify) {
      Promise.resolve(typeof verify === 'function' ? verify() : verify).then(function (auth) {
        if (auth) renderFn(); else locked(host, label);
      }).catch(function () { locked(host, label); });
      return;
    }
    // No separate verify: the mount exists only inside server-authorized content.
    renderFn();
  }
  function locked(host, label) {
    var box = document.createElement('div'); box.className = 'tp-viz-locked';
    box.innerHTML = '<b>🔒 ' + (label || 'Interactive lab') + '</b><p>This interactive lab is part of the Learning Masterclass. Unlock to use it.</p><a class="btn btn-amber btn-sm" href="pricing.html">Unlock →</a>';
    host.appendChild(box);
  }

  // Attaches the entitlement token (if any) to a request so the server can
  // verify it. It does NOT itself decide entitlement.
  function withToken(headers) {
    try {
      var m = (document.cookie || '').match(/(?:^|;\s*)tp_ent=([^;]+)/);
      if (m && m[1]) headers = headers || {}, headers.Cookie = 'tp_ent=' + m[1];
    } catch (e) {}
    return headers;
  }

  // Machine-readable model metadata so Masterclass + Workbench can consume the
  // same model identity and validation status. Declare as data-* attributes and
  // in a global registry (window.TP_VIZ_META[modelKey]).
  function meta(host, m) {
    if (!host || !m) return;
    host.__vizMeta = m;
    var map = { model_type: m.modelType, model_version: m.modelVersion, validation_scope: m.validationScope, assumptions: m.assumptions, limitations: m.limitations, required_inputs: m.requiredInputs, reference_basis: m.referenceBasis, benchmark_status: m.benchmarkStatus, engineering_review_status: m.engineeringReviewStatus };
    Object.keys(map).forEach(function (k) { if (map[k] != null) host.setAttribute('data-' + k, String(map[k])); });
    (window.TP_VIZ_META = window.TP_VIZ_META || {})[m.modelType] = m;
    return m;
  }

  window.TP_VIZ = { el: el, svg: svg, line: line, poly: poly, circle: circle, text: text, lazyInit: lazyInit, controls: controls, gate: gate, withToken: withToken, meta: meta };
})();
