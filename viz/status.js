/* Calculation Status — reusable "Confidence of Calculation" component.
 * Renders the calcStatus model (viz-math.calcStatus) as a compact status panel:
 * CALCULATION STATUS -> PRELIMINARY ENGINEERING / VALIDATED / INSUFFICIENT DATA.
 * Encodes the pedagogy: equation closure is NOT physical validation; with no
 * supplied acceptance criterion the result is NOT a PASS. Reusable in both the
 * Masterclass and the Engineering Workbench.
 *
 * window.TP_STATUS.render(el, { analytical, inputsComplete, benchmark, criterion, fea, manufacturing, qualified })
 */
(function () {
  'use strict';
  var M = function () { return window.TP_VIZ_MATH; };
  function levelColor(l) {
    return { ENGINEERING_REVIEWED: '#16a34a', PRELIMINARY_ENGINEERING: '#b45309', CRITERION_CHECKED: '#2563eb', BENCHMARKED: '#16a34a', CALCULATED: '#64748b', INSUFFICIENT_DATA: '#64748b' }[l] || '#64748b';
  }
  function render(el, input) {
    if (!el || !M() || !M().calcStatus) return;
    var st = M().calcStatus(input || {});
    var col = levelColor(st.state);
    var box = document.createElement('div'); box.className = 'tp-status';
    box.innerHTML =
      '<div class="tp-status-head"><b>CALCULATION STATUS</b><span style="color:' + col + ';font-weight:800">' + st.headline + '</span></div>' +
      '<div class="tp-status-scope" style="font-size:.78rem;color:var(--muted);margin:2px 0 6px">' + st.scopeLine + '</div>' +
      '<div class="tp-status-items">' +
      st.items.map(function (it) {
        var c = it.ok ? '#16a34a' : '#94a3b8';
        return '<span style="color:' + c + '">' + (it.ok ? '\u2713' : '\u25CB') + ' ' + it.label + '</span>';
      }).join(' · ') + '</div>';
    el.appendChild(box);
  }
  window.TP_STATUS = { render: render };
})();
