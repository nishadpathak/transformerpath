/* Vector Group Simulator — interactive clock/phasor + parallel compatibility.
 * Uses TP_VIZ_MATH.vecGroup / parallelCheck. Renders winding symbols (approximate),
 * an HV + LV phasor diagram rotated by the clock displacement, the clock
 * notation, and a parallel-compatibility panel for two selected transformers.
 * Analytical, educational — not a standards-compliance tool.
 */
(function () {
  'use strict';
  var V = window.TP_VIZ, M = window.TP_VIZ_MATH;
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-viz="vector-group"]').forEach(function (host) {
      V.lazyInit(host, function () {
        V.gate(host, render, 'Vector Group Simulator');
        function render() {
          host.innerHTML = '<div class="tp-viz"><div class="tp-viz-head">Vector Group Simulator</div><div class="tp-viz-canvas" id="vz-vg-canvas"></div><div class="tp-viz-panel" id="vz-vg-para"></div></div>';
          var model = { hv: 'D', lv: 'y', neutral: true, clock: 11, clockB: 5 };
          var canvas = host.querySelector('#vz-vg-canvas');

          function draw() {
            var g = M.vecGroup(model.hv, model.lv, model.clock);
            var S = V.svg(520, 300);
            // HV phasors (red), LV phasors (blue) rotated by -disp.
            var cv = vec(g.hvAngles, 96, 150, 150, '#d64545');
            cv.parent = S; S.appendChild(cv.g);
            var lv = vec(g.lvAngles, 96, 350, 150, '#2563eb');
            S.appendChild(lv.g);
            S.appendChild(V.text(150, 44, 'HV', { fill: '#d64545', 'font-weight': '700' }));
            S.appendChild(V.text(350, 44, 'LV (' + (model.hv + model.lv + (model.neutral ? 'n' : '') + model.clock) + ')', { fill: '#2563eb', 'font-weight': '700' }));
            S.appendChild(V.text(250, 292, 'clock ' + g.clockN + '  →  LV lags HV by ' + g.disp + ' deg  (' + g.note.split('(')[1].replace(')', '') + ')', { fill: '#334155', 'text-anchor': 'middle' }));
            // winding connection symbols
            drawWinding(S, 30, 210, model.hv, 'HV winding', '#d64545');
            drawWinding(S, 250, 210, model.lv, 'LV winding', '#2563eb');
            canvas.innerHTML = ''; canvas.appendChild(S);
          }
          function vec(angles, r, cx, cy, col) {
            var g = V.el('g', {}, null);
            angles.forEach(function (a, i) {
              var rad = a * Math.PI / 180;
              var x = cx + r * Math.cos(-rad), y = cy + r * Math.sin(-rad);
              g.appendChild(V.line(cx, cy, x, y, { stroke: col, 'stroke-width': '2.4' }));
              g.appendChild(V.circle(cx, cy, 3, { fill: col }));
              g.appendChild(V.text(x + (x > cx ? 6 : x < cx ? -6 : 0), y + (y > cy ? 12 : -6), ['A', 'B', 'C'][i], { fill: col, 'font-size': '12', 'font-weight': '700' }));
            });
            return { g: g };
          }
          function drawWinding(S, x, y, conn, label, col) {
            var g = V.el('g', {}, S);
            if (/d/i.test(conn)) { g.appendChild(V.poly(((x + 20) + ',' + (y - 18) + ' ' + (x + 40) + ',' + y + ' ' + (x + 20) + ',' + (y + 18)), { fill: 'none', stroke: col, 'stroke-width': '2' })); }
            else { for (var i = 0; i < 3; i++) { var yy = y - 16 + i * 16; g.appendChild(V.line(x + 12, yy - 8, x + 12, yy + 8, { stroke: col, 'stroke-width': '2' })); g.appendChild(V.line(x + 6, yy, x + 18, yy, { stroke: col, 'stroke-width': '2' })); } }
            g.appendChild(V.text(x + 50, y + 4, label + ' — approx symbol', { fill: '#64748b', 'font-size': '11' }));
          }

          V.controls(host.querySelector('.tp-viz'), model, [
            { type: 'select', label: 'HV connection', key: 'hv', value: 'D', options: [['D', 'Delta (D)'], ['y', 'Wye (y)'], ['z', 'Zig-zag (z)']], on: draw },
            { type: 'select', label: 'LV connection', key: 'lv', value: 'y', options: [['D', 'Delta (D)'], ['y', 'Wye (y)'], ['z', 'Zig-zag (z)']], on: draw },
            { type: 'select', label: 'Clock', key: 'clock', value: 11, options: [[0, '0'],[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5'],[6,'6'],[7,'7'],[8,'8'],[9,'9'],[10,'10'],[11,'11']], on: draw },
          ]);

          // Parallel compatibility panel.
          var para = host.querySelector('#vz-vg-para');
          var m2 = { clockA: 11, clockB: 5, za: 5, zb: 5, ra: 1, rb: 1 };
          para.innerHTML = '<div class="tp-viz-head">Parallel compatibility (two transformers)</div>';
          V.controls(para, m2, [
            { type: 'select', label: 'A clock', key: 'clockA', value: 11, options: [[0,'0'],[1,'1'],[5,'5'],[6,'6'],[11,'11']], on: cmp },
            { type: 'select', label: 'B clock', key: 'clockB', value: 5, options: [[0,'0'],[5,'5'],[11,'11']], on: cmp },
            { type: 'range', label: 'A impedance %', key: 'za', min: 3, max: 8, step: 0.5, value: 5, on: cmp },
            { type: 'range', label: 'B impedance %', key: 'zb', min: 3, max: 8, step: 0.5, value: 5, on: cmp },
          ]);
          var out = document.createElement('div'); out.className = 'tp-viz-paraout'; para.appendChild(out);
          function cmp() {
            var a = M.vecGroup('D', 'y', m2.clockA), b = M.vecGroup('D', 'y', m2.clockB);
            var r = M.parallelCheck(a, b, { zImpedanceA: m2.za, zImpedanceB: m2.zb });
            out.innerHTML = (r.compatible ? '✅ Parallel compatible' : '⚠ NOT directly parallelable') + '<ul>' + r.reasons.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
          }
          cmp();
        }
      });
    });
  });
})();
