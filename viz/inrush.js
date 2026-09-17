/* Inrush / Energisation Simulator — simplified analytical inrush model.
 * Plots applied voltage, core flux (B) and magnetising current vs time for a
 * switching angle + residual flux + saturation setting. ENERGIZE animates the
 * build-up; COMPARE overlays worst-case vs benign switching; RESET clears.
 * LABEL: analytical/simplified — NOT an EMT simulation.
 */
(function () {
  'use strict';
  var V = window.TP_VIZ, M = window.TP_VIZ_MATH;
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-viz="inrush"]').forEach(function (host) {
      V.lazyInit(host, function () {
        V.gate(host, render, 'Inrush (energisation) Simulator');
        function render() {
          host.innerHTML = '<div class="tp-viz"><div class="tp-viz-head">Energisation inrush — analytical model</div><div class="tp-viz-canvas" id="vz-in-canvas"></div><div class="tp-viz-stat" id="vz-in-stat"></div><p class="tp-viz-note">' + (M.inrush({}).label) + '</p></div>';
          var model = { angle: 0, resid: 0, sat: 1.2 };
          var canvas = host.querySelector('#vz-in-canvas');
          function drawSeries(res) {
            var w = 560, h = 240, top = 20, bot = h - 30;
            var S = V.svg(w, h);
            S.appendChild(V.line(40, h - 24, w - 12, h - 24, { stroke: '#94a3b8' }));
            S.appendChild(V.line(40, 16, 40, bot, { stroke: '#94a3b8' }));
            S.appendChild(V.text(w - 20, h - 12, 'time (ms)', { 'text-anchor': 'end', fill: '#64748b', 'font-size': '11' }));
            function trace(arr, col, scale, ybase) {
              var pts = arr.map(function (v, i) { var x = 40 + (i / (arr.length - 1)) * (w - 60); var y = (ybase || (h - 24)) - v * scale; return x.toFixed(1) + ',' + y.toFixed(1); }).join(' ');
              var p = V.poly(pts, { fill: 'none', stroke: col, 'stroke-width': '1.8' }); p.setAttribute('points', pts); return p;
            }
            // scale: voltage peak ~1 -> 70px; flux ~2 -> 70px (half-height); current -> clamp.
            function polyOf(arr, col, scale, yb) { var p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', col); p.setAttribute('stroke-width', '1.8'); p.setAttribute('points', arr.map(function (v, i) { var x = 40 + (i / (arr.length - 1)) * (w - 60); var y = (yb || (h - 24)) - v * scale; return x.toFixed(1) + ',' + y.toFixed(1); }).join(' ')); return p; }
            S.appendChild(polyOf(res.v, '#94a3b8', 70, h - 24));
            S.appendChild(polyOf(res.flux, '#14532d', 78, h - 24));
            S.appendChild(polyOf(res.current, '#d97706', 16, h - 24));
            S.appendChild(V.text(60, 16, 'voltage (grey) · flux (green) · magnetising current (amber)', { fill: '#475569', 'font-size': '11' }));
            S.appendChild(V.text(w - 20, 16, 'peak inrush current ≈ ' + res.peakCurrent.toFixed(2) + ' p.u.', { 'text-anchor': 'end', fill: '#b45309', 'font-size': '12', 'font-weight': '700' }));
            canvas.innerHTML = ''; canvas.appendChild(S);
          }
          function run() { drawSeries(M.inrush({ switchingAngleDeg: model.angle, residualFluxPu: model.resid, saturationPu: model.sat })); }
          function compare() {
            var worst = M.inrush({ switchingAngleDeg: 0, residualFluxPu: 0.6, saturationPu: model.sat });
            var benign = M.inrush({ switchingAngleDeg: 90, residualFluxPu: 0, saturationPu: model.sat });
            canvas.innerHTML = '';
            var stat = host.querySelector('#vz-in-stat');
            stat.innerHTML = '<b>Compare energisation</b> — worst case (close at voltage zero, residual 0.6) peak ≈ <b>' + worst.peakCurrent.toFixed(2) + ' p.u.</b> vs benign (close at voltage peak) peak ≈ <b>' + benign.peakCurrent.toFixed(2) + ' p.u.</b>. The difference is the flux offset (2× rated) driving the core into deep saturation.';
          }
          V.controls(host.querySelector('.tp-viz'), model, [
            { type: 'range', label: 'Switching angle (deg)', key: 'angle', min: 0, max: 90, step: 5, value: 0, fmt: function (v) { return v + '°'; }, on: function () { run(); } },
            { type: 'range', label: 'Residual flux (p.u.)', key: 'resid', min: 0, max: 0.8, step: 0.05, value: 0, fmt: function (v) { return v.toFixed(2); }, on: function () { run(); } },
            { type: 'range', label: 'Saturation (p.u.)', key: 'sat', min: 1, max: 1.5, step: 0.05, value: 1.2, fmt: function (v) { return v.toFixed(2); }, on: function () { run(); } },
            { type: 'button', label: 'Energise', on: function () { run(); } },
            { type: 'button', label: 'Compare energisation', on: compare },
            { type: 'button', label: 'Reset', on: function () { model.angle = 0; model.resid = 0; model.sat = 1.2; run(); host.querySelector('.tp-viz-stat').innerHTML = ''; } },
          ]);
          run();
        }
      });
    });
  });
})();
