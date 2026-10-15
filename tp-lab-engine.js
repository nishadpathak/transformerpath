/**
 * tp-lab-engine.js
 * TransformerPath Transformer Lab — staged disassembly engine.
 *
 * Depends on:  THREE (global), tp-lab-geometry.js (TpLabGeometry)
 * Provides:    TpLabEngine — the full disassembly / mode / focus / analytics state machine.
 *
 * Usage:
 *   const engine = TpLabEngine.create(scene, THREE, domRefs, opts);
 *   engine.goToStage(3);
 *   engine.setMode('ACTIVE_PART');
 *   engine.tick(dt, now);   // call every frame
 */
(function (root) {
  'use strict';

  /* ── easing ─────────────────────────────────────────────────── */
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── stage definitions ───────────────────────────────────────── */
  /*
   * Each stage defines:
   *   label    — short display name
   *   caption  — engineering explanation for the caption strip
   *   camTh    — camera theta
   *   camPh    — camera phi
   *   camR     — camera radius
   *   tank     — tank opacity (0–1)
   *   visGroups — map of toggle-key → boolean
   */
  var STAGES = [
    {
      id: 0, label: 'Complete transformer',
      caption: 'A 100 MVA, 132/33 kV YNd11 grid transformer — approximately 180 tonnes complete, 60 000 litres of oil. Every component has a single engineering job: magnetics, dielectrics, cooling, switching, or protection.',
      camTh: 0.75, camPh: 1.15, camR: 148, tank: 0.30,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:true, conservator:true, cooling:true, oltc:true, controls:true, arresters:true }
    },
    {
      id: 1, label: 'Remove surge arresters',
      caption: 'Surge arresters are a switchyard component, not a transformer component — but bushing + arrester + winding impulse design only make sense together. ZnO blocks clamp lightning below the transformer\'s 550 kVp LI withstand.',
      camTh: 0.9, camPh: 1.25, camR: 148, tank: 0.30,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:true, conservator:true, cooling:true, oltc:true, controls:true, arresters:true }
    },
    {
      id: 2, label: 'Remove conservator & accessories',
      caption: 'The conservator sits above the transformer to accommodate oil volume changes with temperature. The Buchholz relay (orange) between tank and conservator catches internal gas — it\'s the only device that detects a slow incipient fault the electrical relays cannot see.',
      camTh: 0.5, camPh: 0.9, camR: 155, tank: 0.30,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:true, conservator:true, cooling:true, oltc:true, controls:true, arresters:false }
    },
    {
      id: 3, label: 'Remove radiator banks',
      caption: 'Five radiator units per side — stacks of pressed-plate elements on top and bottom collector pipes. Each bank detaches for transport through butterfly valves without draining the tank. Fans below push air upward between the plates.',
      camTh: 1.5, camPh: 1.2, camR: 155, tank: 0.30,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:true, conservator:false, cooling:true, oltc:true, controls:true, arresters:false }
    },
    {
      id: 4, label: 'Remove HV bushings',
      caption: '132 kV condenser-graded bushings carry high voltage through the earthed steel cover. Concentric foil layers grade the radial electric field. The test tap on each bushing allows on-line tan δ monitoring — a rising capacitance reading means replace before it fails.',
      camTh: 0.35, camPh: 0.95, camR: 130, tank: 0.30,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:true, conservator:false, cooling:false, oltc:true, controls:true, arresters:false }
    },
    {
      id: 5, label: 'Remove LV bushings',
      caption: 'Three 33 kV bushings and the HV neutral bushing. The neutral is solidly earthed — this means the entire neutral end of the 132 kV winding is insulated for far less than line voltage, a major insulation and cost saving.',
      camTh: 0.1, camPh: 0.9, camR: 115, tank: 0.30,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:true, conservator:false, cooling:false, oltc:true, controls:true, arresters:false }
    },
    {
      id: 6, label: 'Remove tank cover',
      caption: 'The bolted cover gives access to bushing connections and the OLTC head. Two pressure-relief valves (red) vent a sudden internal overpressure and trigger a protection trip. The small box is the core-frame earthing test link.',
      camTh: 0.75, camPh: 0.75, camR: 120, tank: 0.30,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:true, controls:true, arresters:false }
    },
    {
      id: 7, label: 'Tank X-ray — active part revealed',
      caption: 'With the tank made transparent the active part is visible inside. The active part is the complete core, windings and insulation assembly. The oil fills every gap as both dielectric and coolant.',
      camTh: 0.75, camPh: 1.05, camR: 110, tank: 0.05,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:true, controls:false, arresters:false }
    },
    {
      id: 8, label: 'Lift active part',
      caption: 'The active part lifts clear of the tank. This is one of the most important visual moments: the tank is external containment — a structural pressure vessel filled with oil. The active part is the electromagnetic and insulation assembly that actually does the work.',
      camTh: 0.75, camPh: 1.12, camR: 125, tank: 0.08,
      visGroups: { tank:true, oil:true, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:true, controls:false, arresters:false }
    },
    {
      id: 9, label: 'Remove tank & oil',
      caption: 'Tank removed. What remains is the complete active part — core, windings, insulation barriers and the OLTC — exactly as it would appear during factory winding and test, before oil filling and tanking.',
      camTh: 0.75, camPh: 1.15, camR: 118, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:true, controls:false, arresters:false }
    },
    {
      id: 10, label: 'Isolate OLTC',
      caption: 'The OLTC is mounted in its own in-tank compartment with a separate oil supply. Tap selector contacts run in main-tank oil (no arcing); the diverter switches load current inside vacuum bottles in its own compartment — giving ~300 000 operations between services.',
      camTh: 1.8, camPh: 1.2, camR: 105, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:true, controls:false, arresters:false }
    },
    {
      id: 11, label: 'Separate clamping structure',
      caption: 'The top yoke and clamping frame lift away — they were removed during winding and re-installed lamination by lamination ("re-yoking"). The clamp frames pre-compress the windings and must absorb the axial end-thrust of a full through-fault.',
      camTh: 0.5, camPh: 0.85, camR: 95, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:false, controls:false, arresters:false }
    },
    {
      id: 12, label: 'Separate tapping winding',
      caption: 'The outermost winding is a dedicated tapping / regulating winding for the OLTC. Placing taps in a separate winding (rather than gaps in the HV body) keeps the HV ampere-turn balance intact at every tap position — critical for short-circuit force symmetry.',
      camTh: 0.4, camPh: 1.1, camR: 85, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:false, controls:false, arresters:false }
    },
    {
      id: 13, label: 'Separate HV winding & barrier',
      caption: '132 kV continuous disc winding — 80 to 110 double discs of paper-wrapped flat copper, wound without joints. The line-end discs are interleaved or fitted with a static end ring to raise series capacitance and force a near-linear lightning-impulse voltage distribution. Illustrative arrangement shown in this model.',
      camTh: 0.3, camPh: 1.1, camR: 80, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:true, hv:true, tap:false, barriers:true, bushings:false, conservator:false, cooling:false, oltc:false, controls:false, arresters:false }
    },
    {
      id: 14, label: 'Separate LV winding & inner barrier',
      caption: 'The innermost 33 kV delta winding of epoxy-bonded continuously transposed conductor (CTC). The main HV–LV pressboard barrier is the cylinder outside this winding, in the oil duct between LV and HV. That gap sets the leakage impedance, about 12–14%. The cylinder under the LV is only the winding former on the core.',
      camTh: 0.25, camPh: 1.1, camR: 75, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:true, hv:false, tap:false, barriers:true, bushings:false, conservator:false, cooling:false, oltc:false, controls:false, arresters:false }
    },
    {
      id: 15, label: 'Core exposed — limbs & yoke',
      caption: 'Three-limb core of 0.23 mm laser domain-refined Hi-B cold-rolled grain-oriented silicon steel. Step-lap joints at the yoke corners minimise joint reluctance and no-load loss. The core is the magnetic circuit — it carries the flux linking primary and secondary windings.',
      camTh: 0.2, camPh: 1.0, camR: 70, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:false, hv:false, tap:false, barriers:false, bushings:false, conservator:false, cooling:false, oltc:false, controls:false, arresters:false }
    },
    {
      id: 16, label: 'Fully exploded — engineering view',
      caption: 'Every major subsystem separated. This is a 100 MVA power transformer: one machine, twenty engineering disciplines — magnetics, insulation, cooling, switching, protection, civil, lifting, transport. The engineering clarity of this assembly is the result of a century of refinement.',
      camTh: 0.55, camPh: 1.0, camR: 200, tank: 0.0,
      visGroups: { tank:false, oil:false, core:true, lv:true, hv:true, tap:true, barriers:true, bushings:false, conservator:false, cooling:false, oltc:true, controls:false, arresters:true }
    }
  ];

  /* ── stage → normalised explode t ────────────────────────────── */
  var STAGE_COUNT = STAGES.length - 1; // 16

  /* ── mode definitions ────────────────────────────────────────── */
  var MODES = {
    FULL:        { label: 'Full transformer',   groups: null /* all */ },
    ACTIVE_PART: { label: 'Active part',        groups: ['core','lv','hv','tap','barriers','oltc'] },
    WINDINGS:    { label: 'Windings',           groups: ['core','lv','hv','tap','barriers'] },
    INSULATION:  { label: 'Insulation only',    groups: ['barriers'] },
    CORE:        { label: 'Core',               groups: ['core'] },
    ACCESSORIES: { label: 'Accessories',        groups: ['bushings','conservator','cooling','oltc','controls','arresters'] },
    COOLING:     { label: 'Cooling system',     groups: ['cooling','oil'] },
    MAGNETIC:    { label: 'Magnetic flux path', groups: ['core','lv','hv'] },
    MECHANICAL:  { label: 'Mechanical clamping', groups: ['clamping','core'] }
  };

  /* ── camera preset positions ─────────────────────────────────── */
  var CAM_PRESETS = {
    OVERVIEW:    { th: 0.75, ph: 1.15, r: 148, ty: 22 },
    ACTIVE_PART: { th: 0.5,  ph: 1.05, r: 95,  ty: 20 },
    TOP:         { th: 0.0,  ph: 0.15, r: 130, ty: 20 },
    SIDE:        { th: 1.57, ph: 1.15, r: 130, ty: 20 },
    WINDINGS:    { th: 0.3,  ph: 1.1,  r: 75,  ty: 18 },
    CORE:        { th: 0.2,  ph: 1.0,  r: 70,  ty: 18 },
    FREE:        null
  };

  /* ── analytics event emitter ─────────────────────────────────── */
  function emit(name, data) {
    if (typeof window.analytics !== 'undefined' && typeof window.analytics.track === 'function') {
      try { window.analytics.track(name, data || {}); } catch (e) {}
    }
    /* also fire a CustomEvent for the page to hook into */
    try {
      document.dispatchEvent(new CustomEvent('tplab:event', { detail: { name: name, data: data || {} } }));
    } catch (e) {}
  }

  /* ── create ──────────────────────────────────────────────────── */
  function create(scene, THREE, domRefs, opts) {
    opts = opts || {};
    var geo = TpLabGeometry.build(THREE, scene, { shadows: opts.shadows !== false });
    var parts = geo.parts;
    var meshIndex = geo.meshIndex;
    var modelRoot = geo.modelRoot;
    var tankMat = geo.tankMat;
    var oilMat = geo.oilMat;
    var oilMesh = geo.oilMesh;
    var activeParts = geo.activePart; // array of part descriptors in active-part group

    /* state */
    var currentStage = 0;
    var targetStage = 0;
    var animT = 1.0; // 1 = reached target
    var ANIM_SPEED = opts.animSpeed || 1.8; // stages/sec
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var playing = false;
    var playInterval = null;
    var selected = null;
    var focusMode = false;
    var xrayMode = false;
    var labelsOn = true;
    var oilFlowOn = false;
    var elecPathOn = false;
    var cutaway = false;
    var energized = false;
    var currentMode = 'FULL';
    var activeLiftExtra = 0; // 0=normal explode contribution, 1=lifted extra
    var labelEls = [];
    var v3 = new THREE.Vector3();
    var currentCamPreset = 'FREE';

    /* dim state tracking — per-part original opacity backup */
    var dimState = new Map();

    /* ── active-part lift group ──────────────────────────────────
       Parts that travel together when "lifting" the active part:
       core limbs, yoke, all windings, all barriers.
       At stage 8 we add an extra Y offset on top of the normal explode. */
    var LIFT_Y = 45;

    /* ── build label elements ──────────────────────────────────── */
    function buildLabels() {
      labelEls.forEach(function (L) { if (L.el.parentNode) L.el.parentNode.removeChild(L.el); });
      labelEls = [];
      var host = domRefs.labelHost || document.body;
      parts.forEach(function (p) {
        if (!p || !p.root) return;
        var box3 = new THREE.Box3().setFromObject(p.root);
        if (box3.isEmpty()) return;
        var ctr = box3.getCenter(new THREE.Vector3());
        var rp = p.root.getWorldPosition(new THREE.Vector3());
        var off = ctr.sub(rp); off.y += (box3.max.y - box3.min.y) * 0.14;
        var el = document.createElement('div');
        el.className = 'tp3d-lbl';
        el.textContent = p.name.split('—')[0].trim();
        el.addEventListener('click', function () { selectPart(p); });
        host.appendChild(el);
        labelEls.push({ el: el, part: p, off: off });
      });
    }
    buildLabels();

    /* ── compute normalised explode t from fractional stage ──── */
    function stageToExplodeT(fStage) {
      return Math.max(0, Math.min(1, fStage / STAGE_COUNT));
    }

    /* ── apply full transform for a given fractional stage ────── */
    function applyFractionalStage(fStage) {
      var explodeT = stageToExplodeT(fStage);
      var liftT = Math.max(0, Math.min(1, (fStage - 7) / 1.5)); // stage 7→8.5 = active part lifts

      parts.forEach(function (p) {
        p.root.position.copy(p.base).addScaledVector(p.explode, explodeT);
        /* radiator bank child exDir */
        p.root.children.forEach(function (ch) {
          if (ch.userData && ch.userData.exDir) {
            if (!ch.userData.baseP) ch.userData.baseP = ch.position.clone();
            ch.position.copy(ch.userData.baseP).addScaledVector(ch.userData.exDir, explodeT);
          }
        });
      });

      /* active-part lift: stages 7→9 */
      if (liftT > 0) {
        activeParts.forEach(function (p) {
          if (p && p.root) p.root.position.y += liftT * LIFT_Y;
        });
      }

      /* tank & oil opacity */
      var stageData = getInterpolatedStageData(fStage);
      tankMat.opacity = stageData.tank;
      oilMat.opacity = 0.20 * (1 - Math.min(1, fStage / 9));

      /* visibility: interpolate visGroups at nearest integer stage boundary */
      var floorStage = Math.max(0, Math.min(STAGE_COUNT, Math.round(fStage)));
      var vis = STAGES[floorStage].visGroups;
      applyVisibility(vis);

      /* update oil-flow position adjustment for radiator separation */
      oilFlowRadiatorOffset = explodeT;
    }

    var oilFlowRadiatorOffset = 0;

    function getInterpolatedStageData(fStage) {
      var iLo = Math.max(0, Math.min(STAGE_COUNT, Math.floor(fStage)));
      var iHi = Math.max(0, Math.min(STAGE_COUNT, Math.ceil(fStage)));
      var u = fStage - iLo;
      var lo = STAGES[iLo], hi = STAGES[iHi];
      return { tank: lerp(lo.tank, hi.tank, u) };
    }

    /* ── visibility (toggles) ─────────────────────────────────── */
    function applyVisibility(vis) {
      var effectiveVis = vis;
      if (currentMode !== 'FULL' && MODES[currentMode].groups) {
        var allowed = MODES[currentMode].groups;
        effectiveVis = {};
        Object.keys(vis).forEach(function (k) {
          effectiveVis[k] = vis[k] && (allowed.indexOf(k) !== -1);
        });
      }
      parts.forEach(function (p) {
        if (currentMode === 'MECHANICAL') {
          p.root.visible = (p.group === 'clamping' || p.group === 'core' || p.toggle === 'core');
          return;
        }
        if (currentMode === 'MAGNETIC') {
          p.root.visible = (p.group === 'core' || p.group === 'lv' || p.group === 'hv' || p.toggle === 'core' || p.toggle === 'lv' || p.toggle === 'hv');
          return;
        }
        if (p.toggle) p.root.visible = effectiveVis[p.toggle] !== false;
      });
      /* focus-mode dims */
      if (focusMode && selected) applyFocusDim();
    }

    /* ── focus / dim ─────────────────────────────────────────── */
    function applyFocusDim() {
      parts.forEach(function (p) {
        if (!p.root.visible) return;
        var isFocused = (p === selected);
        p.root.traverse(function (o) {
          if (!o.isMesh || !o.material) return;
          if (isFocused) {
            /* restore original */
            if (o.userData._dimSave) {
              o.material.dispose();
              o.material = o.userData._dimSave;
              delete o.userData._dimSave;
            }
          } else {
            if (!o.userData._dimSave) {
              o.userData._dimSave = o.material;
              o.material = o.material.clone();
            }
            o.material.transparent = true;
            o.material.opacity = 0.08;
            o.material.depthWrite = false;
          }
        });
      });
    }

    function clearFocusDim() {
      parts.forEach(function (p) {
        p.root.traverse(function (o) {
          if (!o.isMesh || !o.material) return;
          if (o.userData._dimSave) {
            o.material.dispose();
            o.material = o.userData._dimSave;
            delete o.userData._dimSave;
          }
        });
      });
    }

    /* ── selection / emissive ────────────────────────────────── */
    function setEmissive(part, on) {
      if (!part) return;
      part.root.traverse(function (o) {
        if (!o.isMesh || o.material === undefined || o.material.emissive === undefined) return;
        if (on) {
          if (!o.userData._tpEm) {
            o.userData._tpEm = o.material;
            o.material = o.material.clone();
          }
          o.material.emissive = new THREE.Color(0x1a6fc4);
          o.material.emissiveIntensity = 0.9;
        } else if (o.userData._tpEm) {
          o.material.dispose();
          o.material = o.userData._tpEm;
          delete o.userData._tpEm;
        }
      });
    }

    function selectPart(p) {
      if (selected) setEmissive(selected, false);
      selected = p || null;
      if (selected) setEmissive(selected, true);
      if (focusMode) { clearFocusDim(); if (selected) applyFocusDim(); }
      if (typeof domRefs.onSelect === 'function') domRefs.onSelect(selected);
      if (selected) emit('component_selected', { name: selected.name });
    }

    function clearSelection() { selectPart(null); }

    /* ── X-ray mode ──────────────────────────────────────────── */
    function setXRay(on) {
      xrayMode = !!on;
      if (on) {
        tankMat.opacity = 0.06;
      } else {
        var stageData = getInterpolatedStageData(currentStage);
        tankMat.opacity = stageData.tank;
      }
    }

    /* ── mode ────────────────────────────────────────────────── */
    function setMode(id) {
      if (!MODES[id]) return;
      currentMode = id;
      if (id === 'MAGNETIC') {
        setMagneticFlux(true);
      } else if (energized) {
        setMagneticFlux(false);
      }
      var vis = STAGES[Math.round(currentStage)].visGroups;
      applyVisibility(vis);
      emit('mode_changed', { mode: id });
    }

    /* ── oil flow ────────────────────────────────────────────── */
    function flowPos(t, side) {
      var z = side * 22;
      if (t < 0.32) { var u = t / 0.32; return [0, 7 + u * 25.8, side * 6]; }
      if (t < 0.45) { var u = (t - 0.32) / 0.13; return [0, 32.8, side * (6 + u * 16)]; }
      if (t < 0.77) { var u = (t - 0.45) / 0.32; return [0, 32.8 - u * 27.6, z]; }
      if (t < 0.90) { var u = (t - 0.77) / 0.13; return [0, 5.2, z - side * u * 16]; }
      var u = (t - 0.90) / 0.10; return [0, 5.2 + u * 1.8, side * 6];
    }

    function setOilFlow(on) {
      oilFlowOn = !!on;
      geo.flowGroup.visible = oilFlowOn;
      if (on) emit('oil_flow_toggled', {});
    }

    /* ── flux / energize ─────────────────────────────────────── */
    function fluxPos(t, loop) {
      var xa = loop < 0 ? -18 : 0, xb = loop < 0 ? 0 : 18;
      if (t < .25) { var u = t / .25; return [xa, 6.5 + u * 27, 0]; }
      if (t < .5)  { var u = (t - .25) / .25; return [xa + (xb - xa) * u, 33.5, 0]; }
      if (t < .75) { var u = (t - .5) / .25; return [xb, 33.5 - u * 27, 0]; }
      var u = (t - .75) / .25; return [xb + (xa - xb) * u, 6.5, 0];
    }

    function setEnergized(on) {
      energized = !!on;
      geo.fluxGroup.visible = energized;
      if (!energized) geo.glowMeshes.forEach(function (o) { o.material.emissiveIntensity = 0; });
    }

    function setMagneticFlux(on) {
      setEnergized(on);
      if (on) emit('magnetic_flux_toggled', {});
    }

    /* ── electrical path trace ───────────────────────────────── */
    /* Highlights HV bushings → HV winding → LV winding → LV bushings */
    var electricalParts = ['132 kV condenser', 'HV winding', 'LV winding', '33 kV bushings'];
    var electricalHighlight = [];
    function setElectricalPath(on) {
      elecPathOn = !!on;
      electricalHighlight.forEach(function (o) {
        if (o.userData._elecSave) {
          o.material.dispose(); o.material = o.userData._elecSave;
          delete o.userData._elecSave;
        }
      });
      electricalHighlight = [];
      if (!on) return;
      parts.forEach(function (p) {
        var match = electricalParts.some(function (s) { return p.name.indexOf(s) !== -1; });
        if (!match) return;
        p.root.traverse(function (o) {
          if (!o.isMesh || !o.material || o.material.emissive === undefined) return;
          o.userData._elecSave = o.material;
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(0xf5a623);
          o.material.emissiveIntensity = 0.7;
          electricalHighlight.push(o);
        });
      });
    }

    /* ── cutaway ─────────────────────────────────────────────── */
    function setCutaway(on) {
      cutaway = !!on;
      geo.cutSets.forEach(function (s) {
        s.full.forEach(function (m) { m.visible = !cutaway; });
        s.cut.forEach(function (m) { m.visible = cutaway; });
      });
    }

    /* ── labels ──────────────────────────────────────────────── */
    function setLabels(on) { labelsOn = !!on; }

    /* ── stage navigation ────────────────────────────────────── */
    function goToStage(n, instant) {
      var prev = currentStage;
      targetStage = Math.max(0, Math.min(STAGE_COUNT, Math.round(n)));
      if (reducedMotion || instant) {
        currentStage = targetStage;
        animT = 1;
        applyFractionalStage(currentStage);
        updateCamForStage(targetStage);
      } else {
        animT = 0;
      }
      /* emit analytics */
      if (targetStage !== Math.round(prev)) {
        emit('stage_viewed', { stage: targetStage, label: STAGES[targetStage].label });
        if (targetStage === 8) emit('active_part_lifted', {});
        if (targetStage === 16) emit('explode_completed', {});
      }
      updateStageUI();
    }

    function stepForward() { if (currentStage < STAGE_COUNT) goToStage(currentStage + 1); }
    function stepBack()    { if (currentStage > 0) goToStage(currentStage - 1); }

    function reset(instant) {
      stopPlay();
      clearFocusDim();
      clearSelection();
      setOilFlow(false);
      setElectricalPath(false);
      setEnergized(false);
      setCutaway(false);
      setMode('FULL');
      focusMode = false;
      xrayMode = false;
      goToStage(0, instant !== false);
      emit('reset', {});
    }

    /* ── playback ────────────────────────────────────────────── */
    function startPlay() {
      if (playing) return;
      playing = true;
      if (currentStage >= STAGE_COUNT) goToStage(0, true);
      if (domRefs.onPlayState) domRefs.onPlayState(true);
      emit('explode_started', {});
    }

    function stopPlay() {
      playing = false;
      if (domRefs.onPlayState) domRefs.onPlayState(false);
    }

    function togglePlay() { playing ? stopPlay() : startPlay(); }

    /* ── assemble (reverse) ──────────────────────────────────── */
    function assemble() {
      stopPlay();
      goToStage(0);
      emit('assembly_replayed', {});
    }

    /* ── camera helpers ─────────────────────────────────────── */
    var camSph = opts.camSph; // reference to the sph object from page
    var camTarget = opts.camTarget;
    var camApply = opts.camApply;

    function updateCamForStage(stageIdx) {
      if (!camSph || !camApply) return;
      var s = STAGES[Math.max(0, Math.min(STAGE_COUNT, stageIdx))];
      /* gentle lerp — don't force cinematic motion */
      camSph.th = s.camTh;
      camSph.ph = s.camPh;
      camSph.r  = s.camR;
      if (camTarget) camTarget.set(0, 22, 0);
      camApply();
    }

    function setCamPreset(id) {
      if (!CAM_PRESETS[id] || !camSph || !camApply) return;
      currentCamPreset = id;
      var p = CAM_PRESETS[id];
      if (!p) return; // FREE
      camSph.th = p.th; camSph.ph = p.ph; camSph.r = p.r;
      if (camTarget) camTarget.set(0, p.ty, 0);
      camApply();
    }

    /* ── stage UI ────────────────────────────────────────────── */
    function updateStageUI() {
      var s = STAGES[Math.round(targetStage)];
      if (domRefs.stageLabel)   domRefs.stageLabel.textContent  = s.label;
      if (domRefs.stageCaption) domRefs.stageCaption.textContent = s.caption;
      if (domRefs.stageCounter) domRefs.stageCounter.textContent = 'Stage ' + Math.round(targetStage) + ' / ' + STAGE_COUNT;
      if (domRefs.slider) domRefs.slider.value = Math.round(targetStage / STAGE_COUNT * 100);
    }

    /* ── keyboard ────────────────────────────────────────────── */
    function handleKey(e) {
      switch (e.key) {
        case 'ArrowRight': stepForward(); break;
        case 'ArrowLeft':  stepBack();    break;
        case ' ':          e.preventDefault(); togglePlay(); break;
        case 'r': case 'R': reset(); break;
        case 'f': case 'F': setFocusMode(!focusMode); break;
        case 'x': case 'X': setXRay(!xrayMode); break;
        case 'l': case 'L': setLabels(!labelsOn); break;
      }
    }
    window.addEventListener('keydown', handleKey);

    function setFocusMode(on) {
      focusMode = !!on;
      if (!focusMode) clearFocusDim();
      else if (selected) applyFocusDim();
      emit('focus_mode_toggled', { on: focusMode });
    }

    /* ── tick ────────────────────────────────────────────────── */
    function tick(dt, now) {
      /* stage animation */
      if (animT < 1) {
        animT = Math.min(1, animT + dt * ANIM_SPEED);
        var e = easeInOut(animT);
        var prevStage = currentStage;
        currentStage = lerp(currentStage, targetStage, e);
        applyFractionalStage(currentStage);
        if (animT >= 1) {
          currentStage = targetStage;
          applyFractionalStage(currentStage);
          if (domRefs.slider) domRefs.slider.value = Math.round(targetStage / STAGE_COUNT * 100);
          /* if playing, advance */
          if (playing && targetStage < STAGE_COUNT) {
            goToStage(targetStage + 1);
          } else if (playing && targetStage >= STAGE_COUNT) {
            stopPlay();
          }
        }
      }

      /* oil flow */
      if (oilFlowOn) {
        geo.flowPts.forEach(function (p) {
          p.t = (p.t + dt * 0.05) % 1;
          var fp = flowPos(p.t, p.side);
          var radiatorShift = oilFlowRadiatorOffset * 26;
          p.m.position.set(
            fp[0], fp[1],
            fp[2] + (p.side > 0 ? radiatorShift : -radiatorShift) * ((p.t >= 0.40 && p.t < 0.82) ? 1 : 0)
          );
        });
      }

      /* flux */
      if (energized) {
        var k = (Math.sin(now * 0.004) + 1) / 2;
        geo.glowMeshes.forEach(function (o) { o.material.emissiveIntensity = 0.08 + 0.12 * k; });
        geo.fluxPts.forEach(function (p) {
          p.t = (p.t + dt * 0.22) % 1;
          var fp = fluxPos(p.t, p.loop);
          p.m.position.set(fp[0], fp[1], fp[2]);
        });
      }

      /* electrical path pulse */
      if (elecPathOn) {
        var pulse = (Math.sin(now * 0.005) + 1) / 2;
        electricalHighlight.forEach(function (o) { o.material.emissiveIntensity = 0.4 + pulse * 0.6; });
      }

      /* label positions */
      if (labelsOn) {
        var cam = opts.camera;
        labelEls.forEach(function (L) {
          if (!labelsOn || !L.part.root.visible) { L.el.style.display = 'none'; return; }
          v3.copy(L.off).add(L.part.root.position).sub(L.part.base);
          var pr = v3.project(cam);
          if (pr.z > 1) { L.el.style.display = 'none'; return; }
          L.el.style.display = 'block';
          L.el.style.left = ((pr.x + 1) / 2 * window.innerWidth) + 'px';
          L.el.style.top  = ((-pr.y + 1) / 2 * window.innerHeight) + 'px';
        });
      } else {
        labelEls.forEach(function (L) { L.el.style.display = 'none'; });
      }
    }

    /* ── slider scrub ────────────────────────────────────────── */
    function scrubToPercent(pct) {
      var fStage = (pct / 100) * STAGE_COUNT;
      targetStage = Math.round(fStage);
      currentStage = fStage; // immediate
      animT = 1;
      applyFractionalStage(fStage);
      updateStageUI();
    }

    /* ── picking ─────────────────────────────────────────────── */
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    function pick(event, canvas) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, opts.camera);
      var hits = raycaster.intersectObjects(modelRoot.children, true).filter(function (h) {
        var p = meshIndex.get(h.object);
        return h.object.visible && p && p.root.visible;
      });
      if (hits.length) selectPart(meshIndex.get(hits[0].object));
      else clearSelection();
    }

    /* ── dispose ─────────────────────────────────────────────── */
    function dispose() {
      window.removeEventListener('keydown', handleKey);
      labelEls.forEach(function (L) { if (L.el.parentNode) L.el.parentNode.removeChild(L.el); });
    }

    /* ── initial state ───────────────────────────────────────── */
    goToStage(0, true);
    emit('transformer_lab_started', {});

    return {
      /* state */
      geo: geo,
      parts: parts,
      STAGES: STAGES,
      MODES: MODES,
      CAM_PRESETS: CAM_PRESETS,
      STAGE_COUNT: STAGE_COUNT,
      getCurrentStage: function () { return currentStage; },
      getTargetStage:  function () { return targetStage; },
      getSelected:     function () { return selected; },
      isFocusMode:     function () { return focusMode; },
      isXRay:          function () { return xrayMode; },
      isLabelsOn:      function () { return labelsOn; },
      isOilFlow:       function () { return oilFlowOn; },
      isPlaying:       function () { return playing; },
      isEnergized:     function () { return energized; },
      isMagneticFlux:  function () { return energized; },
      /* actions */
      goToStage:       goToStage,
      stepForward:     stepForward,
      stepBack:        stepBack,
      reset:           reset,
      assemble:        assemble,
      startPlay:       startPlay,
      stopPlay:        stopPlay,
      togglePlay:      togglePlay,
      setMode:         setMode,
      setFocusMode:    setFocusMode,
      setXRay:         setXRay,
      setOilFlow:      setOilFlow,
      setElectricalPath: setElectricalPath,
      setEnergized:    setEnergized,
      setMagneticFlux: setMagneticFlux,
      setCutaway:      setCutaway,
      setLabels:       setLabels,
      setCamPreset:    setCamPreset,
      scrubToPercent:  scrubToPercent,
      selectPart:      selectPart,
      clearSelection:  clearSelection,
      pick:            pick,
      tick:            tick,
      dispose:         dispose
    };
  }

  root.TpLabEngine = { create: create, STAGES: STAGES, MODES: MODES, CAM_PRESETS: CAM_PRESETS };
})(typeof window !== 'undefined' ? window : globalThis);
