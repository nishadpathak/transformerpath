/**
 * tp-lab-geometry.js
 * TransformerPath Transformer Lab — geometry factory.
 *
 * Builds the complete 100 MVA / 132/33 kV YNd11 reference transformer model.
 * Returns a descriptor object consumed by tp-lab-engine.js.
 *
 * Does NOT touch the DOM. Does NOT animate. Does NOT modify THREE global state.
 * Requires THREE already loaded on the page.
 *
 * Usage:
 *   const geo = TpLabGeometry.build(THREE, scene, { shadows: true });
 *   // geo.parts   — array of { root, name, toggle, stage, group, explode, base, meta }
 *   // geo.M       — material map
 *   // geo.tankMat — transparent tank material (opacity-controlled externally)
 *   // geo.oilMat  — oil material
 *   // geo.oilMesh — the oil box mesh (for opacity control)
 *   // geo.cutSets — [{full:[], cut:[]}] winding cutaway pairs
 *   // geo.fanBlades — [THREE.Group] spinning fan blade groups
 *   // geo.flowPts — [{m, t, side}] oil-flow particle descriptors
 *   // geo.fluxPts — [{m, t, loop}] flux-loop particle descriptors
 *   // geo.glowMeshes — core meshes with cloned emissive material
 *   // geo.buchMesh, geo.rsMesh — for fault sim
 */
(function (root) {
  'use strict';

  function build(THREE, scene, opts) {
    opts = opts || {};
    var shadows = !!opts.shadows;

    /* ── materials ──────────────────────────────────────────────── */
    var M = {
      steel:    new THREE.MeshStandardMaterial({ color: 0x8fa3b8, roughness: .45, metalness: .65 }),
      steelDk:  new THREE.MeshStandardMaterial({ color: 0x5d7186, roughness: .5,  metalness: .6  }),
      steelLt:  new THREE.MeshStandardMaterial({ color: 0xb6c5d4, roughness: .4,  metalness: .5  }),
      core:     new THREE.MeshStandardMaterial({ color: 0x6e7f93, roughness: .35, metalness: .8  }),
      copper:   new THREE.MeshStandardMaterial({ color: 0xc9772f, roughness: .35, metalness: .7  }),
      copperL:  new THREE.MeshStandardMaterial({ color: 0xd98f4a, roughness: .4,  metalness: .6  }),
      hvWdg:    new THREE.MeshStandardMaterial({ color: 0xa8503c, roughness: .5,  metalness: .35 }),
      tapWdg:   new THREE.MeshStandardMaterial({ color: 0x8c6a3f, roughness: .5,  metalness: .4  }),
      board:    new THREE.MeshStandardMaterial({ color: 0xe6dcbf, roughness: .7,  metalness: 0, transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }),
      porcel:   new THREE.MeshStandardMaterial({ color: 0x5e3a28, roughness: .14, metalness: .05 }),
      porcelDk: new THREE.MeshStandardMaterial({ color: 0x47291b, roughness: .2,  metalness: .05 }),
      orange:   new THREE.MeshStandardMaterial({ color: 0xe8732a, roughness: .5,  metalness: .3  }),
      red:      new THREE.MeshStandardMaterial({ color: 0xb33a3a, roughness: .5,  metalness: .3  }),
      rubber:   new THREE.MeshStandardMaterial({ color: 0x222d3a, roughness: .9,  metalness: .1  }),
      glass:    new THREE.MeshStandardMaterial({ color: 0xbfd9ee, roughness: .1,  metalness: 0, transparent: true, opacity: .55 }),
      cabinet:  new THREE.MeshStandardMaterial({ color: 0x7d93a8, roughness: .5,  metalness: .4  }),
      oilGlow:  new THREE.MeshStandardMaterial({ color: 0xffc24d, emissive: 0xcf8a1e, emissiveIntensity: .9, roughness: .3 }),
    };

    var tankMat = new THREE.MeshStandardMaterial({
      color: 0x9db2c6, roughness: .4, metalness: .55,
      transparent: true, opacity: .30, side: THREE.DoubleSide, depthWrite: false
    });
    var oilMat = new THREE.MeshStandardMaterial({
      color: 0xe3b34d, roughness: .15, metalness: 0,
      transparent: true, opacity: .20, depthWrite: false
    });

    /* steel micro-texture */
    (function () {
      var c = document.createElement('canvas'); c.width = c.height = 256;
      var x = c.getContext('2d'); var img = x.createImageData(256, 256);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = 205 + Math.random() * 50;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      x.strokeStyle = 'rgba(120,120,120,.35)'; x.lineWidth = 1;
      for (var k = 0; k < 14; k++) {
        x.beginPath(); var a = Math.random() * 256, b = Math.random() * 256;
        x.moveTo(a, b); x.lineTo(a + (Math.random() - 0.5) * 70, b + (Math.random() - 0.5) * 70); x.stroke();
      }
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
      [M.steel, M.steelDk, M.steelLt, M.cabinet, tankMat].forEach(function (m) { m.bumpMap = t; m.bumpScale = .025; m.needsUpdate = true; });
    })();

    /* ── primitive helpers ──────────────────────────────────────── */
    function box(w, h, d, m)         { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
    function cyl(rt, rb, h, m, seg)  { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 40), m); }
    function halfCyl(r, h, m)        { var g = new THREE.CylinderGeometry(r, r, h, 40, 1, false, Math.PI * 0.5, Math.PI); var mm = m.clone(); mm.side = THREE.DoubleSide; return new THREE.Mesh(g, mm); }
    function torus(r, t, m, a1, a2)  { return new THREE.Mesh(new THREE.TorusGeometry(r, t, a1 || 14, a2 || 44), m); }

    /* ── registry ──────────────────────────────────────────────── */
    var parts = [];
    var meshIndex = new Map();
    var modelRoot = new THREE.Group();
    scene.add(modelRoot);

    /**
     * reg — register a part group.
     * @param {THREE.Group} g
     * @param {string} name
     * @param {string} desc  engineering description
     * @param {number[]} explode  [dx,dy,dz] explosion offset vector
     * @param {string} toggle  visibility group key
     * @param {object} meta  {
     *   stage, group, links: { learn, explore, directory, grid },
     *   system, material, whyItMatters, factoryId, note
     * }
     */
    function reg(g, name, desc, explode, toggle, meta) {
      meta = meta || {};
      g.userData.partName = name;
      var p = {
        root: g,
        name: name,
        desc: desc,
        explode: new THREE.Vector3(explode[0] || 0, explode[1] || 0, explode[2] || 0),
        base: g.position.clone(),
        toggle: toggle,
        stage: meta.stage !== undefined ? meta.stage : 16,
        group: meta.group || toggle || 'other',
        links: meta.links || {},
        /* enriched metadata for panel display */
        system:       meta.system       || '',
        material:     meta.material     || '',
        whyItMatters: meta.whyItMatters || '',
        factoryId:    meta.factoryId    || '',
        meta: meta
      };
      parts.push(p);
      g.traverse(function (o) {
        if (o.isMesh) {
          meshIndex.set(o, p);
          if (shadows) { o.castShadow = true; o.receiveShadow = true; }
        }
      });
      modelRoot.add(g);
      return p;
    }

    /* ── limb X positions ───────────────────────────────────────── */
    var limbX = [-18, 0, 18];

    /* ── winding cutaway system ─────────────────────────────────── */
    var cutSets = [];
    function windingSet(radius, height, mat, yC) {
      yC = yC !== undefined ? yC : 19;
      var g = new THREE.Group();
      var full = [], cut = [];
      limbX.forEach(function (x) {
        var w = cyl(radius, radius, height, mat);
        w.position.set(x, yC, 0); g.add(w); full.push(w);
        var hc = halfCyl(radius, height, mat);
        hc.position.set(x, yC, 0); hc.visible = false; g.add(hc); cut.push(hc);
      });
      cutSets.push({ full: full, cut: cut });
      return g;
    }

    /* ════════════════ CORE ════════════════ */
    var corePart, yoke;
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) { var l = box(8, 24, 8, M.core); l.position.set(x, 19, 0); g.add(l); });
      var yb = box(48, 5, 8, M.core); yb.position.set(0, 4.5, 0); g.add(yb);
      var f1 = box(50, 2.6, 2, M.steelDk); f1.position.set(0, 3.5, 6); g.add(f1);
      var f2 = f1.clone(); f2.position.z = -6; g.add(f2);
      corePart = reg(g, 'Core — limbs & bottom yoke',
        'Three-limb core of 0.23 mm laser domain-refined Hi-B CRGO, 13+ stepped packets with internal cooling ducts, mitred 6-step step-lap joints. On a 100 MVA unit the core alone weighs 35–45 t. Limbs are banded with resin-impregnated glass tape (no through-bolts). The whole magnetic circuit is insulated from the clamping structure and earthed via a single removable test link on the cover — so core insulation can be megger-tested in service.',
        [0, 0, 0], 'core',
        {
          stage: 15, group: 'core',
          system: 'Magnetic',
          material: 'Hi-B cold-rolled grain-oriented silicon steel (CRGO), 0.23 mm',
          whyItMatters: 'The core is the magnetic circuit — it concentrates and guides the alternating flux that transfers energy between primary and secondary windings.',
          factoryId: 'core_limbs',
          links: { learn: 'learn.html', explore: 'coretopology.html', grid: 'grid-lab.html' }
        });
    }
    {
      var g = new THREE.Group();
      var yt = box(48, 5, 8, M.core); yt.position.set(0, 33.5, 0); g.add(yt);
      var c1 = box(50, 3, 2.2, M.steelDk); c1.position.set(0, 35, 6.2); g.add(c1);
      var c2 = c1.clone(); c2.position.z = -6.2; g.add(c2);
      for (var ax of [-23, -9, 9, 23]) {
        var r = cyl(.5, .5, 30, M.steelDk); r.position.set(ax, 19.5, 7.3); g.add(r);
        var r2 = r.clone(); r2.position.z = -7.3; g.add(r2);
      }
      for (var ax2 of [-20, 20]) { var lug = box(2.4, 4, 1.2, M.steelDk); lug.position.set(ax2, 37.6, 0); g.add(lug); }
      yoke = reg(g, 'Top yoke, clamping frame & tie rods',
        'Removed for winding assembly, re-laid lamination-by-lamination ("re-yoking"). The clamp frames pre-compress the windings through pressure screws and end rings, and must absorb the axial end-thrust of a full through-fault — tens of tonnes. Insulated tie rods link top and bottom frames. The frame, like the core, is separately earthed at one point only.',
        [0, 18, 0], 'core',
        {
          stage: 11, group: 'clamping',
          system: 'Mechanical',
          material: 'Structural steel frames; laminated CRGO yoke; high-tensile tie rods',
          whyItMatters: 'The clamping system pre-compresses the windings to withstand the enormous axial forces that develop during a through-fault — without it windings would telescope catastrophically.',
          factoryId: 'core_yoke_clamp',
          links: { learn: 'learn.html' }
        });
    }

    /* ════════════════ WINDINGS ════════════════ */
    var lvPart, lvBarrier, hvPart, hvBarrier, tapPart;
    {
      var g = windingSet(6.5, 20, M.copper);
      limbX.forEach(function (x) {
        var r1 = torus(6.5, .5, M.copperL); r1.rotation.x = Math.PI / 2; r1.position.set(x, 29.2, 0); g.add(r1);
        var r2 = r1.clone(); r2.position.y = 8.8; g.add(r2);
      });
      lvPart = reg(g, 'LV winding (33 kV, inner) — helical, CTC',
        'Innermost: 33 kV delta winding, ≈1750 A line current (≈1010 A per delta phase). Double-helical winding of epoxy-bonded continuously transposed conductor (CTC) — dozens of enamelled strands transposed as one cable to kill eddy loss and give a rigid, buckling-resistant tube. Wound on a thick pressboard cylinder over the core. Radial key-spacer ducts carry the axial oil flow.',
        [0, 10, 0], 'lv',
        {
          stage: 14, group: 'windings',
          system: 'Electrical',
          material: 'Continuously transposed conductor (CTC) — enamelled copper strands; paper insulation',
          whyItMatters: 'The LV winding is the secondary circuit — it delivers current at lower voltage and must be mechanically robust enough to survive the huge electromagnetic forces during a short-circuit event.',
          factoryId: 'winding_lv',
          note: 'Illustrative arrangement for this model.',
          links: { learn: 'learn.html', explore: 'coilassembly.html', grid: 'grid-lab.html' }
        });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) { var b = cyl(8, 8, 22, M.board, 40); b.position.set(x, 19, 0); g.add(b); });
      lvBarrier = reg(g, 'Main HV–LV insulation barriers (pressboard)',
        'The main duct: concentric pressboard cylinders with axial sticks subdividing the oil gap into thin, high-withstand channels (oil gaps gain strength when subdivided). Moulded angle rings and snouts grade the field at the winding ends — the most stressed region of the whole transformer. This duct also sets the leakage impedance (12–14% here).',
        [0, 13, 0], 'barriers',
        {
          stage: 14, group: 'insulation',
          system: 'Insulation',
          material: 'Transformerboard (densified pressboard) cylinders, axial spacers, angle rings',
          whyItMatters: 'The main HV–LV barrier is the most critical dielectric boundary in the transformer — a breakdown here is a total write-off. Subdividing the oil gap with pressboard cylinders dramatically raises the breakdown voltage.',
          factoryId: 'insulation_main_barrier',
          links: { learn: 'learn.html', directory: 'components.html' }
        });
    }
    {
      var g = windingSet(10, 21, M.hvWdg);
      hvPart = reg(g, 'HV winding (132 kV, middle) — continuous disc',
        '132 kV star winding, ≈437 A, graded insulation (neutral end insulated for far less than line end since the neutral is solidly earthed). 80–110 double discs of paper-wrapped flat copper, wound without joints. The line-end discs are interleaved (or fitted with a static end ring) to raise series capacitance and force a near-linear lightning-impulse distribution. LI withstand: 550 kVp; AC: 230/275 kV. Illustrative arrangement shown in this model.',
        [0, 16, 0], 'hv',
        {
          stage: 13, group: 'windings',
          system: 'Electrical',
          material: 'Paper-wrapped rectangular copper conductor; pressboard end insulation',
          whyItMatters: 'The HV winding is the primary circuit — it receives the transmission voltage and must withstand lightning impulse, switching surge, and sustained AC voltage for decades.',
          factoryId: 'winding_hv',
          note: 'Illustrative arrangement shown in this model.',
          links: { learn: 'learn.html', explore: 'coilassembly.html', grid: 'grid-lab.html' }
        });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) { var b = cyl(11.2, 11.2, 19, M.board, 40); b.position.set(x, 19, 0); g.add(b); });
      hvBarrier = reg(g, 'HV–tap barrier cylinders',
        'Second barrier system between the HV body and the outer tapping winding, again built from pressboard cylinders and oil ducts sized for the recovery voltage that appears across the regulating range during OLTC diverter operation.',
        [0, 19, 0], 'barriers',
        {
          stage: 13, group: 'insulation',
          system: 'Insulation',
          material: 'Transformerboard cylinders with oil duct sticks',
          whyItMatters: 'During tap changes the OLTC imposes a recovery voltage across this barrier — it must be rated for the full regulation range, not just the operating voltage.',
          factoryId: 'insulation_hv_tap_barrier',
          links: { learn: 'learn.html', directory: 'components.html' }
        });
    }
    {
      var g = windingSet(12.4, 16, M.tapWdg);
      tapPart = reg(g, 'Tapping / regulating winding (outermost)',
        '±10% regulation in 17 positions. A separate multi-start coarse/fine (or linear) tap winding placed outermost so leads run directly to the OLTC selector with minimum extra leakage unbalance. Placing taps in a separate winding (rather than gaps in the HV body) keeps the HV ampere-turn balance intact at every tap — crucial for short-circuit forces.',
        [0, 22, 0], 'tap',
        {
          stage: 12, group: 'windings',
          system: 'Electrical',
          material: 'Paper-insulated copper conductor; same grade as HV winding',
          whyItMatters: 'The tap winding allows voltage regulation across the grid — essential for maintaining stable supply voltage as load and generation shift throughout the day.',
          factoryId: 'winding_tap',
          links: { learn: 'learn.html', explore: 'oltc.html' }
        });
    }

    /* ════════════════ TANK ════════════════ */
    var oilMesh;
    {
      var g = new THREE.Group();
      var t = box(68, 40, 32, tankMat); t.position.set(0, 20, 0); g.add(t);
      for (var tx of [-24, -8, 8, 24]) {
        var s = box(1.6, 40, 1.6, M.steelDk); s.position.set(tx, 20, 16.8); g.add(s);
        var s2 = s.clone(); s2.position.z = -16.8; g.add(s2);
      }
      for (var tz of [-8, 8]) {
        var s3 = box(1.6, 40, 1.6, M.steelDk); s3.position.set(34.8, 20, tz); g.add(s3);
        var s4 = s3.clone(); s4.position.x = -34.8; g.add(s4);
      }
      var b1 = box(72, 3, 4, M.steelDk); b1.position.set(0, -1.5, 9); g.add(b1);
      var b2 = b1.clone(); b2.position.z = -9; g.add(b2);
      [[-31, 15], [31, 15], [-31, -15], [31, -15]].forEach(function (p) {
        var j = box(4, 2, 4, M.steelLt); j.position.set(p[0], 4, p[1]); g.add(j);
      });
      for (var ex of [-33, 33]) { var e = box(1, 3, 3, M.copperL); e.position.set(ex * 1.04, 2.5, 14); g.add(e); }
      reg(g, 'Tank, skid base & jacking pads',
        'Welded plate tank designed for full vacuum and 100 kPa overpressure; stiffened walls; shot-blasted, C5-M painted. A 100 MVA tank weighs ~30 t and the complete transformer ~150–180 t with ~60 t of oil. Skid underbase with haulage holes, four jacking pads for site positioning, two earthing pads. Use the opacity slider to see through it.',
        [0, -34, 0], 'tank',
        {
          stage: 9, group: 'tank',
          system: 'Tank',
          material: 'Welded structural steel plate, 10–20 mm; epoxy-polyurethane paint system C5-M',
          whyItMatters: 'The tank is not just a container — it must withstand full vacuum during oil filling, positive pressure from internal faults, transport forces, and decades of thermal cycling without leaking.',
          factoryId: 'tank_body',
          links: { grid: 'grid-lab.html' }
        });
    }
    {
      var g = new THREE.Group();
      oilMesh = box(66.5, 37, 30.5, oilMat); oilMesh.position.set(0, 18.6, 0);
      oilMesh.castShadow = false; oilMesh.receiveShadow = false; g.add(oilMesh);
      reg(g, 'Insulating & cooling oil (~60 000 L)',
        'Inhibited mineral oil to IEC 60296 (or ester for fire-critical sites), processed to <10 ppm moisture and <1% gas. Oil is the dielectric, the coolant and the diagnostic medium: a yearly DGA sample tells the unit\'s health better than any other single test.',
        [0, 0, 0], 'oil',
        {
          stage: 9, group: 'tank',
          system: 'Cooling',
          material: 'Inhibited mineral oil (IEC 60296) or synthetic/natural ester',
          whyItMatters: 'Oil serves three simultaneous roles: dielectric insulation between live conductors, coolant carrying heat from windings to radiators, and diagnostic fluid whose dissolved gases reveal internal faults.',
          factoryId: 'tank_oil',
          links: {}
        });
    }
    {
      var g = new THREE.Group();
      var cov = box(70, 2, 34, M.steel); cov.position.set(0, 41, 0); g.add(cov);
      for (var cx of [-14, 14]) { var p = cyl(2, 2.4, 2, M.red); p.position.set(cx, 43, 6); g.add(p); }
      for (var cx2 of [-8, 8]) { var hch = cyl(3, 3, 1, M.steelLt); hch.position.set(cx2, 42.6, -2); g.add(hch); }
      var tl = box(2.4, 1.6, 2, M.cabinet); tl.position.set(26, 42.8, -4); g.add(tl);
      reg(g, 'Tank cover — PRVs, hatches, core test link',
        'Bolted, gasketed cover. Two spring pressure-relief valves (red) vent a sudden internal pressure wave and flag a trip. Inspection hatches give access to bushing connections and the OLTC head. The small box is the core/frame earthing test link.',
        [0, 22, 0], 'tank',
        {
          stage: 6, group: 'tank',
          system: 'Protection',
          material: 'Rolled steel plate; Nitrile/EPDM gasket; stainless PRV springs',
          whyItMatters: 'The pressure-relief valves are the transformer\'s last line of mechanical protection — they open in milliseconds if an internal fault generates a pressure wave, preventing tank rupture and oil fire.',
          factoryId: 'tank_cover',
          links: {}
        });
    }

    /* ════════════════ HV BUSHINGS ════════════════ */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var t2 = cyl(3, 3.4, 7, M.steel); t2.position.set(x, 45.5, -8); g.add(t2);
        var ct = torus(3.6, .8, M.steelDk); ct.rotation.x = Math.PI / 2; ct.position.set(x, 43.6, -8); g.add(ct);
        var b = new THREE.Group();
        var lower = cyl(1.4, 1.8, 4, M.porcelDk); lower.position.y = 2; b.add(lower);
        for (var i = 0; i < 9; i++) { var sh = torus(2.6 - i * 0.13, .55, M.porcel); sh.rotation.x = Math.PI / 2; sh.position.y = 4.5 + i * 1.9; b.add(sh); }
        var stem = cyl(.8, 1.2, 18, M.porcel); stem.position.y = 12.5; b.add(stem);
        var head = cyl(1, 1, 1.6, M.steelDk); head.position.y = 22; b.add(head);
        var ring = torus(2.2, .3, M.steelLt); ring.position.y = 20.6; ring.rotation.x = Math.PI / 2; b.add(ring);
        b.position.set(x, 49, -8); g.add(b);
      });
      reg(g, '132 kV condenser bushings & bushing CTs',
        'Condenser-graded bushings — RIP/RIS (dry resin-impregnated). Concentric foil layers inside grade the radial field; the test tap allows on-line tan δ / capacitance monitoring. Each turret carries multi-ratio bushing CTs for differential, REF and backup protection.',
        [0, 24, 0], 'bushings',
        {
          stage: 4, group: 'bushings',
          system: 'Electrical',
          material: 'Resin-impregnated paper (RIP) or resin-impregnated synthetics (RIS); porcelain or silicone rubber housing',
          whyItMatters: 'Bushings are the only path for current to enter or leave the tank — they must insulate 132 kV from the earthed tank while carrying full load current continuously for 40+ years.',
          factoryId: 'bushing_hv',
          links: { explore: 'bushing.html', directory: 'components.html' }
        });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var t3 = cyl(2.4, 2.8, 4.5, M.steel); t3.position.set(x, 44.2, 9); g.add(t3);
        var ct2 = torus(3, .7, M.steelDk); ct2.rotation.x = Math.PI / 2; ct2.position.set(x, 43, 9); g.add(ct2);
        var b2 = new THREE.Group();
        for (var i = 0; i < 5; i++) { var sh2 = torus(2, .5, M.porcel); sh2.rotation.x = Math.PI / 2; sh2.position.y = 1 + i * 1.7; b2.add(sh2); }
        var stem2 = cyl(.7, .9, 9.5, M.porcel); stem2.position.y = 4.6; b2.add(stem2);
        var pad = box(2, 2.6, .8, M.copperL); pad.position.y = 10.4; b2.add(pad);
        b2.position.set(x, 46.5, 9); g.add(b2);
      });
      var nb = new THREE.Group();
      for (var i = 0; i < 4; i++) { var sh3 = torus(1.6, .42, M.porcel); sh3.rotation.x = Math.PI / 2; sh3.position.y = .8 + i * 1.5; nb.add(sh3); }
      var st = cyl(.55, .7, 7.5, M.porcel); st.position.y = 3.6; nb.add(st);
      nb.position.set(28, 43.5, 0); g.add(nb);
      reg(g, '33 kV bushings & HV neutral bushing',
        'Three 33 kV porcelain bushings with turret CTs. The 132 kV star-point comes out through a smaller graded-insulation neutral bushing — solid earthing lets the whole neutral end of the HV winding be insulated for a fraction of line level.',
        [0, 20, 0], 'bushings',
        {
          stage: 5, group: 'bushings',
          system: 'Electrical',
          material: 'Porcelain or polymer housing; copper conductor; oil-impregnated paper insulation',
          whyItMatters: 'The LV bushings carry the highest current in the entire transformer — at 33 kV and 1750 A, thermal management and contact resistance at the terminal pad are critical to reliability.',
          factoryId: 'bushing_lv',
          links: { explore: 'bushing.html', directory: 'components.html' }
        });
    }

    /* ════════════════ CONSERVATOR ════════════════ */
    {
      var g = new THREE.Group();
      for (var cl of [-16, 8]) { var leg = cyl(.9, .9, 16, M.steelDk); leg.position.set(cl, 51, -2); g.add(leg); }
      var cons = cyl(5.5, 5.5, 42, M.steel); cons.rotation.z = Math.PI / 2; cons.position.set(-4, 61, -2); g.add(cons);
      var e1 = cyl(5.6, 5.6, 1, M.steelDk); e1.rotation.z = Math.PI / 2; e1.position.set(17.5, 61, -2); g.add(e1);
      var e2 = e1.clone(); e2.position.x = -25.5; g.add(e2);
      var divider = cyl(5.65, 5.65, .8, M.steelDk); divider.rotation.z = Math.PI / 2; divider.position.set(8, 61, -2); g.add(divider);
      var gl = cyl(1.5, 1.5, .6, M.glass); gl.rotation.x = Math.PI / 2; gl.position.set(-8, 61, 3.8); g.add(gl);
      var gl2 = gl.clone(); gl2.position.x = 13; g.add(gl2);
      var p1 = cyl(.9, .9, 12, M.steelDk); p1.position.set(0, 48.5, -2); g.add(p1);
      var buch = box(3.2, 3, 3, M.orange); buch.position.set(0, 47.5, -2); g.add(buch);
      for (var cy of [50.5, 45]) { var v = cyl(1.2, 1.2, 1, M.red); v.position.set(0, cy, -2); g.add(v); }
      var p2 = cyl(.6, .6, 16, M.steelDk); p2.position.set(-22, 50, -2); g.add(p2);
      var rs = box(2.4, 2.2, 2.2, M.red); rs.position.set(-22, 49, -2); g.add(rs);
      function mkBreather(bx) {
        var bp = cyl(.5, .5, 9, M.steelDk); bp.position.set(bx, 55.5, 3); g.add(bp);
        var br = cyl(1.3, 1.3, 5.5, M.glass); br.position.set(bx, 49, 3); g.add(br);
        var bc = cyl(1.4, 1.4, .9, M.steelDk); bc.position.set(bx, 45.9, 3); g.add(bc);
      }
      mkBreather(16.5); mkBreather(-25);
      reg(g, 'Conservator, Buchholz relay & oil-surge relay',
        'Twin-compartment conservator: large side breathes for the main tank through the Buchholz relay (orange — gas alarm / surge trip); small side serves the OLTC diverter oil. The RS relay (red, on OLTC pipe) gives instant trip. Each compartment has magnetic level gauge and maintenance-free breather.',
        [0, 30, 0], 'conservator',
        {
          stage: 2, group: 'accessories',
          system: 'Protection',
          material: 'Welded steel cylinder; float-operated relays; silica-gel breather',
          whyItMatters: 'The Buchholz relay is the transformer\'s primary internal fault detector — it responds to the gas and oil surge produced by arc faults that current-based protection cannot detect fast enough.',
          factoryId: 'conservator_buchholz',
          links: {}
        });
    }

    /* ════════════════ RADIATORS ════════════════ */
    var fanBlades = [];
    {
      var g = new THREE.Group();
      for (var zs of [1, -1]) {
        var bank = new THREE.Group();
        for (var ux of [-22, -11, 0, 11, 22]) {
          for (var uy of [32.8, 5.2]) {
            var rc = cyl(.95, .95, 13.5, M.steelDk); rc.rotation.x = Math.PI / 2; rc.position.set(ux, uy, zs * 23); bank.add(rc);
            var cap = cyl(1.05, 1.05, .7, M.steelDk); cap.rotation.x = Math.PI / 2; cap.position.set(ux, uy, zs * 29.9); bank.add(cap);
            var rv = cyl(1.5, 1.5, 1.1, M.red); rv.rotation.x = Math.PI / 2; rv.position.set(ux, uy, zs * 16.7); bank.add(rv);
          }
          for (var k2 = 0; k2 < 9; k2++) { var rp = box(5.2, 26, .55, M.steel); rp.position.set(ux, 19, zs * (17.9 + k2 * 1.45)); bank.add(rp); }
        }
        var pump = cyl(1.9, 1.9, 3.2, M.cabinet); pump.rotation.x = Math.PI / 2; pump.position.set(5.5, 5.2, zs * 18.5); bank.add(pump);
        var fi = cyl(1.1, 1.1, .7, M.glass); fi.rotation.x = Math.PI / 2; fi.position.set(5.5, 5.2, zs * 21.5); bank.add(fi);
        for (var fx of [-15, 0, 15]) {
          var fr = torus(3.2, .35, M.steelDk); fr.rotation.x = Math.PI / 2; fr.position.set(fx, 1.8, zs * 22); bank.add(fr);
          var fh = cyl(.6, .6, .8, M.steelDk); fh.position.set(fx, 1.8, zs * 22); bank.add(fh);
          var bl = new THREE.Group();
          for (var k3 = 0; k3 < 4; k3++) {
            var blade = box(2.6, .18, .9, M.steelLt);
            blade.rotation.y = k3 * Math.PI / 2; blade.rotation.x = .5;
            blade.position.set(Math.cos(k3 * Math.PI / 2) * 1.5, 0, Math.sin(k3 * Math.PI / 2) * 1.5);
            bl.add(blade);
          }
          bl.position.set(fx, 1.8, zs * 22); bank.add(bl); fanBlades.push(bl);
        }
        bank.userData.exDir = new THREE.Vector3(0, 0, zs * 26);
        g.add(bank);
      }
      reg(g, 'Radiator banks, fans, pumps & valves',
        'Each radiator is a stack of pressed-plate elements on top and bottom collector pipes that bolt to the tank wall through butterfly valves — every radiator detaches for transport without draining the tank. Hot oil enters the top collector, falls through the plate channels as it cools, and returns via the bottom. Fan groups (ONAN→ONAF→OFAF) are staged automatically by the winding-temperature relay.',
        [0, 0, 0], 'cooling',
        {
          stage: 3, group: 'cooling',
          system: 'Cooling',
          material: 'Pressed steel plate radiator elements; aluminium fan blades; cast-iron pump casings',
          whyItMatters: 'Without the cooling system, winding temperature would rise within minutes to the point of insulation degradation — the radiators are what allow a 100 MVA transformer to operate continuously.',
          factoryId: 'radiators_fans',
          links: { directory: 'components.html' }
        });
    }

    /* ════════════════ OLTC ════════════════ */
    {
      var g = new THREE.Group();
      var body = cyl(4.5, 4.5, 22, M.steel); body.position.set(-38.5, 20, 0); g.add(body);
      var head = cyl(4.8, 4.8, 1.4, M.steelDk); head.position.set(-38.5, 31.7, 0); g.add(head);
      var vshaft = cyl(.45, .45, 18, M.steelLt); vshaft.position.set(-41.5, 18, 6); g.add(vshaft);
      var bevel = box(2, 2, 2, M.steelDk); bevel.position.set(-41.5, 28, 6); g.add(bevel);
      var hshaft = cyl(.45, .45, 8, M.steelLt); hshaft.rotation.x = Math.PI / 2; hshaft.position.set(-41.5, 28, 2); g.add(hshaft);
      var mdm = box(5, 9, 4, M.cabinet); mdm.position.set(-41.5, 8.5, 6); g.add(mdm);
      var door = box(4.4, 8.2, .3, M.steelLt); door.position.set(-41.5, 8.5, 8.1); g.add(door);
      var crank = cyl(.9, .9, .5, M.steelDk); crank.rotation.x = Math.PI / 2; crank.position.set(-43, 12, 8.2); g.add(crank);
      var ind = cyl(1.3, 1.3, .5, M.glass); ind.position.set(-38.5, 32.7, 0); g.add(ind);
      var needle = box(.18, 1.6, .1, M.red); needle.position.set(-38.5, 32.95, 0); g.add(needle);
      var cd = cyl(.32, .32, 7.6, M.steelDk); cd.rotation.z = Math.PI / 2; cd.position.set(-37.8, 3, 6); g.add(cd);
      reg(g, 'On-load tap-changer (OLTC) & motor drive',
        'In-tank OLTC, vacuum-interrupter diverter type: tap selector runs in main-tank oil (no arcing there), while the diverter switches the load current inside vacuum bottles in its own oil compartment — service interval ~300 000 operations. The motor-drive cabinet (with emergency hand-crank) steps through 17 positions, ±10%, commanded by the AVR relay.',
        [-22, 0, 0], 'oltc',
        {
          stage: 10, group: 'oltc',
          system: 'Electrical',
          material: 'Vacuum interrupter bottles; epoxy-encapsulated contacts; oil-filled steel housing',
          whyItMatters: 'The OLTC is what keeps grid voltage stable as load fluctuates — it is one of the few actively moving mechanical components in a transformer, making it also one of the most maintenance-critical.',
          factoryId: 'oltc_assembly',
          links: { explore: 'oltc.html', directory: 'components.html' }
        });
    }

    /* ════════════════ CABINETS & MONITORING ════════════════ */
    {
      var g = new THREE.Group();
      var mc = box(7, 12, 5, M.cabinet); mc.position.set(38.5, 12, 4); g.add(mc);
      var md = box(6.2, 11, .3, M.steelLt); md.position.set(38.5, 12, 6.6); g.add(md);
      var dga = box(3.4, 4.5, 2.6, M.cabinet); dga.position.set(36.6, 28, -6); g.add(dga);
      var pipe = cyl(.3, .3, 5, M.steelDk); pipe.rotation.z = Math.PI / 2; pipe.position.set(34, 26.5, -6); g.add(pipe);
      var ti = box(2.4, 3, 1.6, M.steelLt); ti.position.set(36.2, 33, 8); g.add(ti);
      var v1 = cyl(.32, .32, 7, M.steelDk); v1.position.set(38.5, 2.8, 4); g.add(v1);
      var h1 = cyl(.32, .32, 5.5, M.steelDk); h1.rotation.z = Math.PI / 2; h1.position.set(35.5, 1.2, 4); g.add(h1);
      var v2 = cyl(.26, .26, 9, M.steelDk); v2.position.set(36.6, 22, -6); g.add(v2);
      reg(g, 'Marshalling cabinet, DGA monitor & instruments',
        'The marshalling kiosk collects every CT lead, fan/pump contactor, OTI/WTI contact, Buchholz, PRV and OLTC signal onto terminal rails for the substation control building. On the tank wall: an online multi-gas DGA monitor samples oil continuously (H₂, C₂H₂, CO, moisture trends), and the OTI/WTI instrument box derives the winding hotspot thermal image.',
        [22, 0, 0], 'controls',
        {
          stage: 2, group: 'accessories',
          system: 'Protection',
          material: 'Steel kiosk; relay panels; sensor cables',
          whyItMatters: 'Online DGA monitoring can detect developing internal faults — hotspot, partial discharge, arcing — weeks before they become failures, enabling planned shutdown instead of emergency outage.',
          factoryId: 'marshalling_cabinet',
          links: {}
        });
    }

    /* ════════════════ SURGE ARRESTERS ════════════════ */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var ped = box(2.6, 10, 2.6, M.steelDk); ped.position.set(x, 5, -30); g.add(ped);
        var a = new THREE.Group();
        for (var ai = 0; ai < 10; ai++) { var ash = torus(1.7, .45, M.porcelDk); ash.rotation.x = Math.PI / 2; ash.position.y = ai * 1.5; a.add(ash); }
        var astem = cyl(.8, .8, 15, M.porcelDk); astem.position.y = 7; a.add(astem);
        var acap = cyl(1.1, 1.1, .8, M.steelDk); acap.position.y = 15.3; a.add(acap);
        a.position.set(x, 10.5, -30); g.add(a);
      });
      reg(g, '132 kV metal-oxide surge arresters',
        'Mounted as close as possible to the HV bushings (every metre of lead adds inductive voltage to the protected level). ZnO blocks clamp lightning and switching surges below the transformer\'s 550 kVp LI withstand, with margin per IEC 60099 insulation-coordination rules.',
        [0, 0, -22], 'arresters',
        {
          stage: 1, group: 'accessories',
          system: 'Protection',
          material: 'Zinc-oxide (ZnO) varistor blocks; porcelain or silicone rubber housing',
          whyItMatters: 'Surge arresters are the first line of defence against lightning strikes and switching transients — without them, a single lightning strike could punch through the bushing insulation and destroy the transformer.',
          factoryId: 'surge_arresters',
          links: {}
        });
    }

    /* ════════════════ DETAILS (cover bolting, fittings, bushing flanges) ════════════════ */
    {
      var g = new THREE.Group();
      function bolt() { return cyl(.5, .5, .9, M.steelDk, 10); }
      for (var bx = -33; bx <= 33; bx += 6) { for (var bz of [16.2, -16.2]) { var b3 = bolt(); b3.position.set(bx, 42.3, bz); g.add(b3); } }
      for (var bz2 = -12; bz2 <= 12; bz2 += 6) { for (var bx2 of [34.2, -34.2]) { var b4 = bolt(); b4.position.set(bx2, 42.3, bz2); g.add(b4); } }
      reg(g, 'Cover bolting & gasket joint',
        'Hundreds of studs on a continuous gasket groove — torqued in sequence, leak-tested with the tank under pressure.',
        [0, 22, 0], 'tank', {
          stage: 6, group: 'tank',
          system: 'Mechanical',
          material: 'High-tensile steel studs; EPDM/Nitrile gasket strip',
          whyItMatters: 'The cover-to-tank joint must remain oil-tight for 40+ years under thermal cycling — a single persistent leak leads to moisture ingress and insulation degradation.',
          factoryId: 'tank_cover_bolting',
          links: {}
        });
    }
    {
      var g = new THREE.Group();
      for (var zr of [-6.8, -9.2]) { var rail = cyl(.32, .32, 34, M.steelDk); rail.position.set(34.9, 21, zr); g.add(rail); }
      for (var ry = 6; ry <= 36; ry += 5) { var rung = cyl(.26, .26, 2.4, M.steelDk); rung.rotation.x = Math.PI / 2; rung.position.set(34.9, ry, -8); g.add(rung); }
      var rp2 = box(5, 6, .3, M.steelDk); rp2.position.set(-12, 18, 16.3); g.add(rp2);
      var rf = box(4.4, 5.3, .14, M.glass); rf.position.set(-12, 18, 16.5); g.add(rf);
      var dv = cyl(1.1, 1.1, 2.2, M.steelDk); dv.rotation.x = Math.PI / 2; dv.position.set(20, 3.5, 17); g.add(dv);
      var hw = torus(1.3, .2, M.red); hw.position.set(20, 3.5, 18.3); g.add(hw);
      var sv2 = cyl(.5, .5, 1.2, M.red); sv2.rotation.x = Math.PI / 2; sv2.position.set(25, 4.5, 16.7); g.add(sv2);
      reg(g, 'Tank fittings — ladder, rating plate, drain & sampling valves',
        'The access ladder reaches the cover work platform. The rating plate is the contract in stainless steel — ratings, vector group, impedances at all taps, masses, oil volume. Below: main drain/filter valve and dedicated sampling valve feeding the DGA programme.',
        [0, -34, 0], 'tank', {
          stage: 9, group: 'tank',
          system: 'Tank',
          material: 'Galvanised steel ladder; stainless steel rating plate; forged steel valves',
          whyItMatters: 'The rating plate carries every key parameter in a legally binding format — it is the transformer\'s permanent identity document, readable after 50 years of service.',
          factoryId: 'tank_fittings',
          links: {}
        });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var f1 = cyl(2.4, 2.4, .7, M.steelDk); f1.position.set(x, 48.8, -8); g.add(f1);
        var f2 = cyl(2.0, 2.0, .6, M.steelDk); f2.position.set(x, 46.2, 9); g.add(f2);
      });
      var fn = cyl(1.7, 1.7, .6, M.steelDk); fn.position.set(28, 43.3, 0); g.add(fn);
      reg(g, 'Bushing mounting flanges',
        'Each bushing bolts to its turret through a gasketed flange — the mechanical fuse of the whole interface. Flange bolt torque, gasket condition and the air-release plug are checked at every outage.',
        [0, 24, 0], 'bushings', {
          stage: 4, group: 'bushings',
          system: 'Mechanical',
          material: 'Cast steel flange; Nitrile O-ring; stainless steel bolting',
          whyItMatters: 'Bushing flange integrity is checked at every outage — a weeping flange allows moisture to track into the bushing oil, rapidly degrading insulation.',
          factoryId: 'bushing_flanges',
          links: {}
        });
    }

    /* ════════════════ OIL FLOW PARTICLES ════════════════ */
    var flowGroup = new THREE.Group(); flowGroup.visible = false; scene.add(flowGroup);
    var flowPts = [];
    (function () {
      var geo = new THREE.SphereGeometry(.45, 10, 10);
      for (var i = 0; i < 48; i++) {
        var fm = new THREE.Mesh(geo, M.oilGlow); fm.castShadow = false; flowGroup.add(fm);
        flowPts.push({ m: fm, t: i / 48, side: i % 2 ? 1 : -1 });
      }
    })();

    /* ════════════════ FLUX & ENERGIZE ════════════════ */
    var fluxMat = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x3da5f4, emissiveIntensity: 1.5, roughness: .3 });
    var fluxGroup = new THREE.Group(); fluxGroup.visible = false; scene.add(fluxGroup);
    var fluxPts = [];
    var glowMeshes = [];
    for (var fi = 0; fi < 36; fi++) {
      var fm2 = new THREE.Mesh(new THREE.SphereGeometry(.5, 8, 8), fluxMat);
      fm2.castShadow = false; fluxGroup.add(fm2); fluxPts.push({ m: fm2, t: (fi % 18) / 18, loop: fi < 18 ? -1 : 1 });
    }
    parts.filter(function (p) { return p.toggle === 'core'; }).forEach(function (p) {
      p.root.traverse(function (o) {
        if (o.isMesh && o.material === M.core) {
          o.material = M.core.clone();
          o.material.emissive = new THREE.Color(0x3fa0ff);
          o.material.emissiveIntensity = 0;
          glowMeshes.push(o);
        }
      });
    });

    /* ════════════════ FAULT SIM REFERENCES ════════════════ */
    var buchMesh = null, rsMesh = null;
    {
      var cons2 = parts.find(function (p) { return p.name.startsWith('Conservator'); });
      if (cons2) {
        cons2.root.traverse(function (o) {
          if (o.isMesh) {
            if (o.material === M.orange) buchMesh = o;
            if (o.material === M.red && o.position.x < -15 && o.geometry.type === 'BoxGeometry') rsMesh = o;
          }
        });
        if (buchMesh) buchMesh.material = M.orange.clone();
        if (rsMesh) rsMesh.material = M.red.clone();
      }
    }

    return {
      parts: parts,
      meshIndex: meshIndex,
      modelRoot: modelRoot,
      M: M,
      tankMat: tankMat,
      oilMat: oilMat,
      oilMesh: oilMesh,
      cutSets: cutSets,
      fanBlades: fanBlades,
      flowGroup: flowGroup,
      flowPts: flowPts,
      fluxGroup: fluxGroup,
      fluxPts: fluxPts,
      glowMeshes: glowMeshes,
      buchMesh: buchMesh,
      rsMesh: rsMesh,
      /* named references for active-part lift group */
      activePart: [
        corePart, yoke, lvPart, lvBarrier, hvPart, hvBarrier, tapPart
      ]
    };
  }

  root.TpLabGeometry = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
