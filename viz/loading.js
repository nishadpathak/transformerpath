/* Loading / Hot-Spot / Life (#5) — educational thermal laboratory.
 *
 * Simplified IEC 60076-7-style analytical model (NOT CFD). The learner sets
 * load, ambient temperature, cooling mode and duration, then runs the model to
 * see top-oil (liquid-filled, present only when applicable), winding hot-spot,
 * relative ageing rate and accumulated loss-of-life. Dry-type has NO top-liquid
 * state. Missing required inputs -> INSUFFICIENT DATA; thermal parameters come
 * from an EXPLICITLY LABELLED educational example dataset, never a hidden
 * assumption. A Calculation-Status panel sits directly underneath.
 */
(function () {
  'use strict';
  var V = window.TP_VIZ, M = window.TP_VIZ_MATH;
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-viz="loading"]').forEach(function (host) {
      V.lazyInit(host, function () {
        V.meta(host, {
          modelType: 'loading-hotspot-life', modelVersion: '1.0',
          validationScope: 'Educational analytical model only',
          assumptions: 'First-order top-oil + winding hot-spot time constants; load loss ~ I^2; 6 degC ageing rule (2^((hotspot-98)/6)); example dataset.',
          limitations: 'NOT CFD; ignores ambient variation during the run, cooling-stage changes, and winding distribution; not a loading-guide verification.',
          requiredInputs: 'loadPU, ambientC, mode, durationH, (dry:true for dry-type)',
          referenceBasis: 'IEC 60076-7-style hot-spot/ageing approach (educational)',
          benchmarkStatus: 'not-benchmarked', engineeringReviewStatus: 'not-reviewed'
        });
        render(host);
      });
    });
    function render(host) {
      V.gate(host, draw, 'Loading, Hot-Spot & Life');
      function draw() {
        host.innerHTML = '<div class="tp-viz"><div class="tp-viz-head">Loading, Hot-Spot &amp; Insulation Life</div><div class="tp-viz-canvas" id="vz-ld-canvas"></div><div class="tp-viz-stat" id="vz-ld-stat"></div><div class="tp-viz-status" id="vz-ld-status"></div><p class="tp-viz-note" id="vz-ld-note"></p></div>';
        var model = { load: 100, amb: 20, mode: 'ONAN', dur: 24, dry: false };
        var canvas = host.querySelector('#vz-ld-canvas');
        function run() {
          var res = M.thermalEngine({ loadPU: model.load / 100, ambientC: model.amb, mode: model.mode, durationH: model.dur, dryType: model.dry });
          var note = host.querySelector('#vz-ld-note');
          if (res.state === 'INSUFFICIENT_DATA') {
            canvas.innerHTML = ''; host.querySelector('#vz-ld-stat').innerHTML = '';
            note.textContent = 'INSUFFICIENT DATA — required inputs missing.'; return;
          }
          note.textContent = res.note;
          drawChart(res);
          var f = res.final;
          host.querySelector('#vz-ld-stat').innerHTML =
            (res.dryType ? '' : 'Top-oil: <b>' + f.topOil + ' \u00B0C</b> \u00B7 ') +
            'Hot-spot: <b>' + f.hotSpot + ' \u00B0C</b> \u00B7 Relative ageing: <b>' + f.ageRate.toFixed(2) + '\u00D7</b> \u00B7 Loss of life: <b>' + f.lossOfLifeH + ' h equivalent</b>';
          // Calculation status (analytical, benchmarked? no; criterion? no -> not a PASS).
          var stHost = host.querySelector('#vz-ld-status'); stHost.innerHTML = '';
          if (window.TP_STATUS) window.TP_STATUS.render(stHost, { analytical: true, inputsComplete: true, benchmark: false, criterion: false });
        }
        function drawChart(res) {
          var s = res.series, w = 560, h = 240;
          var S = V.svg(w, h);
          var xAt = function (i) { return 44 + (i / (s.times.length - 1)) * (w - 64); };
          var yAt = function (v, max) { return (h - 28) - (v / max) * (h - 60); };
          var maxT = Math.max.apply(null, s.hotSpot) || 1;
          function poly(arr, col, getY) { var p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', col); p.setAttribute('stroke-width', '1.8'); p.setAttribute('points', arr.map(function (v, i) { return xAt(i).toFixed(1) + ',' + yAt(getY(v), maxT).toFixed(1); }).join(' ')); return p; }
          if (!res.dryType) S.appendChild(poly(s.topOil, '#2563eb', function (v) { return v; }));
          S.appendChild(poly(s.hotSpot, '#dc2626', function (v) { return v; }));
          S.appendChild(V.line(44, h - 28, w - 16, h - 28, { stroke: '#94a3b8' }));
          S.appendChild(V.text(60, 18, (res.dryType ? 'Winding temperature' : 'Top-oil (blue) \u00B7 Winding hot-spot (red)') + ' vs time', { fill: '#64748b', 'font-size': '11' }));
          S.appendChild(V.text(w - 16, h - 12, 'time (h) \u2192', { 'text-anchor': 'end', fill: '#64748b', 'font-size': '11' }));
          canvas.innerHTML = ''; canvas.appendChild(S);
        }
        V.controls(host.querySelector('.tp-viz'), model, [
          { type: 'range', label: 'Load (% rated)', key: 'load', min: 40, max: 180, step: 5, value: 100, fmt: function (v) { return v + '%'; }, on: run },
          { type: 'range', label: 'Ambient (\u00B0C)', key: 'amb', min: -10, max: 50, step: 5, value: 20, fmt: function (v) { return v + '\u00B0C'; }, on: run },
          { type: 'select', label: 'Cooling', key: 'mode', value: 'ONAN', options: [['ONAN', 'ONAN'], ['ONAF', 'ONAF'], ['OFAF', 'OFAF'], ['ODAF', 'ODAF'], ['AN', 'AN (dry)'], ['AF', 'AF (dry)']], on: run },
          { type: 'range', label: 'Duration (h)', key: 'dur', min: 1, max: 48, step: 1, value: 24, fmt: function (v) { return v + ' h'; }, on: run },
          { type: 'select', label: 'Construction', key: 'dry', value: false, options: [[false, 'Liquid-filled'], [true, 'Dry-type']], on: run },
          { type: 'button', label: 'Run', on: run },
        ]);
        run();
      }
    }
  });
})();
