/* Transformer Construction Explorer — interactive exploded/sectional view.
 * A layered 2D representation (core, windings, insulation, tank, accessories)
 * with EXPLODE, CUTAWAY, ROTATE, ZOOM, RESET controls, and clickable components
 * that reveal name/function/material/design role + related Masterclass section.
 * This is a schematic/educational sectional view, NOT a manufacturing or FEA
 * model; geometry is illustrative, not calculated.
 */
(function () {
  'use strict';
  var V = window.TP_VIZ;
  var COMPONENTS = [
    { id: 'core', name: 'Core', fn: 'Magnetic circuit — concentrates flux', mat: 'CRGO / grain-oriented electrical steel', role: 'Sets volts/turn; drives no-load loss', mc: '#core' },
    { id: 'lv', name: 'LV winding', fn: 'Low-voltage winding — carries load current', mat: 'Copper / aluminium (CTC or foil)', role: 'Determines current density, losses, impedance', mc: '#windings' },
    { id: 'hv', name: 'HV winding', fn: 'High-voltage winding — insulation-critical', mat: 'Copper, disc/continuous', role: 'Drives insulation coordination, BIL', mc: '#windings' },
    { id: 'ins', name: 'Main insulation', fn: 'Separates HV/LV and windings from core', mat: 'Pressboard, paper, oil/ester ducts', role: 'Dielectric strength, creepage, clearance', mc: '#insulation' },
    { id: 'tank', name: 'Tank', fn: 'Houses core+windings, contains oil', mat: 'Steel, welded', role: 'Mechanical + containment, stray-loss control', mc: '#construction' },
    { id: 'bush', name: 'Bushings', fn: 'HV/LV lead-outs through the tank', mat: 'OIP / RIP / resin', role: 'Insulated conductor exit, field grading', mc: '#bushings' },
    { id: 'oltc', name: 'OLTC', fn: 'On-load tap changer — regulates voltage under load', mat: 'Selector + diverter in oil', role: 'Voltage regulation, tap range', mc: '#tapchangers' },
    { id: 'cons', name: 'Conservator', fn: 'Oil expansion/contraction reservoir', mat: 'Steel tank + breather', role: 'Oil preservation, moisture control', mc: '#construction' },
    { id: 'rad', name: 'Radiators', fn: 'Oil-to-air heat rejection', mat: 'Steel, finned', role: 'Removes total losses; cooling class', mc: '#cooling' },
  ];
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-viz="construction"]').forEach(function (host) {
      V.lazyInit(host, function () {
        V.gate(host, render, 'Transformer Construction Explorer');
        function render() {
          host.innerHTML = '<div class="tp-viz"><div class="tp-viz-head">Transformer Construction Explorer</div><div class="tp-viz-stage" id="vz-cc-stage"></div><div class="tp-viz-info" id="vz-cc-info">Click a component to inspect it.</div></div>';
          var stage = host.querySelector('#vz-cc-stage');
          var state = { explode: 0, cut: false, rot: 0, zoom: 1 };
          function build() {
            stage.innerHTML = '';
            var S = V.svg(460, 320);
            S.setAttribute('class', 'tp-viz-svg');
            var g = V.el('g', {}, S);
            g.setAttribute('transform', 'rotate(' + state.rot + ' 230 160) scale(' + state.zoom + ')');
            // Back-to-front (painter order): tank -> rad -> core -> ins -> lv -> hv -> accessories.
            function comp(id, shape, off, extra) {
              var e = shape();
              e.setAttribute('data-comp', id);
              e.setAttribute('data-off', off);
              e.setAttribute('class', 'tp-viz-comp');
              e.style.cursor = 'pointer';
              // Keyboard + screen-reader accessibility for clickable components.
              e.setAttribute('tabindex', '0');
              e.setAttribute('role', 'button');
              var compName = (COMPONENTS.find(function (x) { return x.id === id; }) || {}).name || id;
              e.setAttribute('aria-label', compName + ' — inspect');
              e.setAttribute('data-compname', compName);
              if (extra) e.setAttribute(extra.k, extra.v);
              var cx = 230 + off, cy = 160;
              if (state.cut) e.setAttribute('opacity', '0.45');
              e.setAttribute('transform', 'translate(' + state.explode * off * 0.9 + ' 0)');
              g.appendChild(e);
              return e;
            }
            function rect(x, y, w, h, fill, rx) { return V.poly((x) + ',' + (y) + ' ' + (x + w) + ',' + (y) + ' ' + (x + w) + ',' + (y + h) + ' ' + (x) + ',' + (y + h), { fill: fill, stroke: '#475569', 'stroke-width': '1.5', rx: rx }); }
            // tank
            comp('tank', function () { return rect(120, 70, 220, 180, '#dbe4ee', 8); }, 0);
            // radiators (sides)
            comp('rad', function () { return rect(84, 84, 26, 152, '#cbd5e1', 4); }, 0);
            comp('rad', function () { return rect(350, 84, 26, 152, '#cbd5e1', 4); }, 0);
            // conservator (top-right)
            comp('cons', function () { return rect(300, 44, 90, 18, '#aab8c9', 8); }, 0);
            // core (two limbs + yoke)
            comp('core', function () { var g2 = V.el('g', {}, null); g2.appendChild(rect(196, 92, 16, 136, '#8a9bb0')); g2.appendChild(rect(248, 92, 16, 136, '#8a9bb0')); g2.appendChild(rect(196, 92, 68, 20, '#8a9bb0')); g2.appendChild(rect(196, 208, 68, 20, '#8a9bb0')); return g2; }, 0);
            // main insulation
            comp('ins', function () { return rect(186, 84, 88, 152, '#ffd9b8', 6); }, 0);
            // LV winding
            comp('lv', function () { return rect(176, 78, 108, 164, '#fbbf24', 6); }, 0);
            // HV winding
            comp('hv', function () { return rect(160, 70, 140, 180, '#f59e0b', 6); }, 0);
            // OLTC (side compartment)
            comp('oltc', function () { return rect(110, 120, 26, 80, '#94a3b8', 4); }, 0);
            // bushings (top)
            comp('bush', function () { return rect(190, 44, 18, 28, '#cbd5e1', 4); }, 0);
            comp('bush', function () { return rect(252, 44, 18, 28, '#cbd5e1', 4); }, 0);
            stage.innerHTML = ''; stage.appendChild(S);
            // click -> info
            addEventListener_on(S);
          }
          function addEventListener_on(S) {
            function inspect(e) {
              var c = COMPONENTS.find(function (x) { return x.id === e.getAttribute('data-comp'); });
              if (!c) return;
              host.querySelector('#vz-cc-info').innerHTML = '<b>' + c.name + '</b><p>' + c.fn + '</p><div>Material: ' + c.mat + '</div><div>Design role: ' + c.role + '</div><div>Masterclass: <a href="masterclass.html' + c.mc + '">section</a></div>';
            }
            S.querySelectorAll('[data-comp]').forEach(function (e) {
              e.addEventListener('click', function () { inspect(e); });
              // Keyboard: Enter / Space activates the component.
              e.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); inspect(e); }
              });
            });
          }
          var stateShow = { explode: 0, cut: false, rot: 0, zoom: 1 };
          V.controls(host.querySelector('.tp-viz'), stateShow, [
            { type: 'range', label: 'Explode', key: 'explode', min: 0, max: 1.6, step: 0.1, value: 0, on: function () { state.explode = stateShow.explode; var offs = host.querySelectorAll('[data-off]'); /* handles via transform override */ build(); } },
            { type: 'range', label: 'Zoom', key: 'zoom', min: 0.6, max: 1.8, step: 0.1, value: 1, on: function () { state.zoom = stateShow.zoom; build(); } },
            { type: 'button', label: 'Cutaway', on: function () { state.cut = !state.cut; build(); } },
            { type: 'button', label: 'Rotate', on: function () { state.rot = (state.rot + 15) % 360; build(); } },
            { type: 'button', label: 'Reset', on: function () { state.explode = 0; state.cut = false; state.rot = 0; state.zoom = 1; stateShow.explode = 0; stateShow.zoom = 1; build(); } },
          ]);
          build();
        }
      });
    });
  });
})();
