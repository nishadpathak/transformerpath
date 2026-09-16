/* Short-Circuit Forces Explorer (#4). Educational, schematic.
 * A concentric winding cross-section (core, LV, HV) with a fault-current
 * multiplier. The learner sees the approximate F ~ I^2 scaling (1x->1x, 2x->~4x,
 * 5x->~25x, 10x->~100x) and the qualitative winding force tendencies
 * (LV radial compression, HV hoop tension, axial forces, clamping reaction).
 * Prominent qualification: actual force distribution depends on winding
 * geometry + leakage field; this is NOT a completed mechanical-withstand design.
 */
(function () {
  'use strict';
  var V = window.TP_VIZ, M = window.TP_VIZ_MATH;
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-viz="short-circuit"]').forEach(function (host) {
      V.lazyInit(host, function () {
        V.meta(host, {
          modelType: 'short-circuit-forces', modelVersion: '1.0',
          validationScope: 'Educational F ~ I^2 scaling + qualitative tendencies only',
          assumptions: 'Force scales with the square of current; concentric two-winding arrangement.',
          limitations: 'Actual force distribution depends on winding geometry, end-winding spacing and the leakage field. NOT a mechanical-withstand design.',
          requiredInputs: 'currentMultiplier (1x-10x)',
          referenceBasis: 'F = k I^2 (educational)', benchmarkStatus: 'not-benchmarked', engineeringReviewStatus: 'not-reviewed'
        });
        V.gate(host, render, 'Short-Circuit Forces Explorer');
        function render() {
          host.innerHTML = '<div class="tp-viz"><div class="tp-viz-head">Short-Circuit Forces (F \u221D I\u00b2)</div><div class="tp-viz-canvas" id="vz-sc-canvas"></div><div class="tp-viz-stat" id="vz-sc-stat"></div><div class="tp-viz-status" id="vz-sc-status"></div><p class="tp-viz-note" id="vz-sc-quali"></p></div>';
          var model = { cur: 1 };
          var canvas = host.querySelector('#vz-sc-canvas');
          function draw() {
            var r = M.shortCircuitForces(model.cur);
            var S = V.svg(520, 300);
            var cx = 170, cy = 150, core = 34, lv = 58, hv = 86;
            // tank outline
            S.appendChild(V.el('rect', { x: cx - 140, y: cy - 110, width: 280, height: 220, fill: '#e2e8f0', stroke: '#64748b', rx: 8 }));
            // core (center)
            S.appendChild(V.el('rect', { x: cx - core, y: cy - 70, width: core * 2, height: 140, fill: '#94a3b8', stroke: '#475569' }));
            // LV winding (inner) + outward-compression arrows
            S.appendChild(V.el('rect', { x: cx - lv, y: cy - 92, width: lv * 2, height: 184, fill: 'rgba(245,158,11,.25)', stroke: '#b45309', 'stroke-width': 2, rx: 6 }));
            // HV winding (outer) + hoop-tension arrows
            S.appendChild(V.el('rect', { x: cx - hv, y: cy - 116, width: hv * 2, height: 232, fill: 'rgba(217,70,239,.18)', stroke: '#7e22ce', 'stroke-width': 2, rx: 6 }));
            // force arrows on LV (radial compression, inward) and HV (outward)
            var a = 6 + r.forceMultiplier * 1.4; // arrow length scales with F ~ I^2 (clamped for display)
            if (a > 64) a = 64;
            var c = (a / 64) * 4; // color intensity
            function arr(x1, y1, x2, y2, col, small) { return V.el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: col, 'stroke-width': small ? 2 : 3, 'marker-end': 'url(#arr)' }); }
            // LV inward arrows
            [[cx - lv - 8, cy - 40], [cx + lv + 8, cy - 40]].forEach(function (p) { if (p[0] < cx) S.appendChild(arr(p[0], p[1], p[0] + a, p[1], '#b45309')); });
            // HV outward arrows
            [[cx - hv - 8, cy + 40], [cx + hv + 8, cy + 40]].forEach(function (p) { if (p[0] < cx) S.appendChild(arr(p[0], p[1], p[0] - a, p[1], '#7e22ce')); });
            // axial forces (top/bottom, vertical)
            S.appendChild(arr(cx + 6, cy - 122, cx + 6, cy - 122 - a, '#dc2626'));
            S.appendChild(arr(cx + 6, cy + 122, cx + 6, cy + 122 + a, '#dc2626'));
            // labels
            S.appendChild(V.text(cx - 120, 26, 'LV radial compression \u2190 \u2192', { fill: '#b45309', 'font-weight': '700' }));
            S.appendChild(V.text(cx + 40, 26, 'HV hoop tension \u2194', { fill: '#7e22ce', 'font-weight': '700' }));
            S.appendChild(V.text(cx - 70, cy + 168, 'Axial \u2191\u2193 (ends) \u00b7 clamps react', { fill: '#dc2626', 'font-weight': '700' }));
            canvas.innerHTML = ''; canvas.appendChild(S);
            host.querySelector('#vz-sc-stat').innerHTML = '<b>' + r.fmt() + '</b><ul>' + M.forceTendencies().map(function (t) { return '<li><b>' + t.w + ':</b> ' + t.force + ' — ' + t.note + '</li>'; }).join('') + '</ul>';
            host.querySelector('#vz-sc-quali').textContent = r.quali;
            // Calculation status footer: equation closure != validation.
            var st = M.calcStatus({ analytical: true, inputsComplete: true, benchmark: false, criterion: false });
            var stHost = host.querySelector('#vz-sc-status');
            stHost.innerHTML = '<b>CALCULATION STATUS</b> — ' + st.headline;
            stHost.innerHTML += '<div style="font-size:.78rem;color:var(--muted);line-height:1.6">' + st.items.map(function (it) { return (it.ok ? '\u2713 ' : '\u25CB ') + it.label; }).join(' \u00b7 ') + '</div>';
          }
          V.controls(host.querySelector('.tp-viz'), model, [
            { type: 'range', label: 'Fault current (x)', key: 'cur', min: 1, max: 10, step: 1, value: 1, fmt: function (v) { return v + 'x'; }, on: draw },
            { type: 'button', label: 'Reset', on: function () { model.cur = 1; draw(); } },
          ]);
          draw();
        }
      });
    });
  });
})();
