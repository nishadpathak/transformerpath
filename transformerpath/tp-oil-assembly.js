/**
 * ~1000 kVA oil distribution transformer (ONAN / freestanding conservator)
 * for TransformerPath. Every accessory is its own clickable / sourceable part.
 * Usage: TPOilAssembly.build(engine) where engine is from TP3D.bootstrap(...)
 */
(function (root) {
  "use strict";

  function build(engine, opts) {
    opts = opts || {};
    var THREE = engine.THREE || root.THREE;
    var reg = engine.reg.bind(engine);
    var oilMeshes = [];

    var MAT = {
      steel: mat(0x8fa3b8, 0.45, 0.65),
      steelDk: mat(0x5d7186, 0.5, 0.6),
      steelLt: mat(0xb6c5d4, 0.4, 0.5),
      core: mat(0x6e7f93, 0.35, 0.8),
      copper: mat(0xc9772f, 0.35, 0.7),
      copperL: mat(0xd98f4a, 0.4, 0.6),
      hv: mat(0xa8503c, 0.5, 0.35),
      board: new THREE.MeshStandardMaterial({
        color: 0xe6dcbf, roughness: 0.7, metalness: 0,
        transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false
      }),
      porcel: mat(0x5e3a28, 0.14, 0.05),
      porcelDk: mat(0x47291b, 0.2, 0.05),
      orange: mat(0xe8732a, 0.5, 0.3),
      red: mat(0xb33a3a, 0.5, 0.3),
      glass: new THREE.MeshStandardMaterial({
        color: 0xbfd9ee, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.55
      }),
      cabinet: mat(0x7d93a8, 0.5, 0.4),
      rubber: mat(0x222d3a, 0.9, 0.1),
      plate: mat(0xc9d4de, 0.35, 0.75),
      oil: new THREE.MeshStandardMaterial({
        color: 0xe3b34d, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false
      }),
      tank: new THREE.MeshStandardMaterial({
        color: 0x9db2c6, roughness: 0.4, metalness: 0.55,
        transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false
      })
    };

    function mat(c, r, m) {
      return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    }
    function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
    function cyl(rt, rb, h, m, seg) {
      return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 28), m);
    }
    function torus(r, t, m, a1, a2) {
      return new THREE.Mesh(new THREE.TorusGeometry(r, t, a1 || 12, a2 || 28), m);
    }
    function add(g, mesh, x, y, z, rx, ry, rz) {
      mesh.position.set(x || 0, y || 0, z || 0);
      if (rx) mesh.rotation.x = rx;
      if (ry) mesh.rotation.y = ry;
      if (rz) mesh.rotation.z = rz;
      g.add(mesh);
      return mesh;
    }

    /* Scale: ~1000 kVA three-limb DT (11/0.4 kV class typical) */
    var limbX = [-9.5, 0, 9.5];
    var limbH = 22;
    var limbY = 12;

    /* ---- CORE ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, box(5.2, limbH, 5.2, MAT.core), x, limbY, 0);
      });
      add(g, box(28, 4.2, 6.2, MAT.core), 0, 1.6, 0);
      add(g, box(30, 1.6, 7.2, MAT.steelDk), 0, -0.6, 0);
      [[-13.5, 4.5], [13.5, 4.5], [-13.5, -4.5], [13.5, -4.5]].forEach(function (p) {
        add(g, cyl(0.35, 0.35, limbH + 2, MAT.steelLt), p[0], limbY, p[1]);
      });
      reg(g, "Core — limbs & bottom yoke (with clamping)",
        "CRGO / Hi-B step-lap three-limb core for ~1000 kVA ONAN DT. Bottom yoke, clamp frames and insulated banding. Source CRGO coils, cut-to-length lines and stacking fixtures via the directory.",
        [0, -22, 0], { toggle: "core", id: "core", label: "Core" });
    }
    {
      var g = new THREE.Group();
      add(g, box(28, 4.2, 6.2, MAT.core), 0, 24.2, 0);
      add(g, box(30, 1.8, 7.2, MAT.steelDk), 0, 26.8, 0);
      limbX.forEach(function (x) {
        add(g, box(2.2, 1.4, 8.5, MAT.steelLt), x, 28, 0);
      });
      reg(g, "Top yoke, clamping frame & tie rods",
        "Top yoke closes the magnetic circuit. Clamp beams and insulated tie-rods set axial pressure without shorted turns — removed on major rewinds. Source clamp steel and insulation kits.",
        [0, 18, 0], { toggle: "core", id: "top-yoke", label: "Top yoke" });
    }

    /* ---- WINDINGS ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(3.2, 3.2, 18, MAT.copper, 36), x, limbY, 0);
        add(g, cyl(2.55, 2.55, 18.2, MAT.board, 36), x, limbY, 0);
      });
      reg(g, "LV winding (0.4 kV, inner) — foil / helical",
        "Inner LV: foil or helical copper for Dyn11 distribution duty. Layer insulation, end rings and cooling ducts. Source foil winders, conductor and coil presses.",
        [0, -8, -14], { toggle: "lv", id: "lv-winding", label: "LV winding" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        for (var i = 0; i < 2; i++) {
          add(g, cyl(3.6 + i * 0.45, 3.6 + i * 0.45, 18.4, MAT.board, 36), x, limbY, 0);
        }
      });
      reg(g, "HV–LV insulation barriers (pressboard)",
        "Pressboard cylinders and oil ducts grade the HV–LV gap on oil-immersed DTs. Transformerboard class — critical to impulse withstand and PD. Source Weidmann-class board and duct sticks.",
        [0, -4, -16], { toggle: "barriers", id: "pressboard", label: "Barriers" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(5.0, 5.0, 18.6, MAT.hv, 36), x, limbY, 0);
        add(g, cyl(4.35, 4.35, 18.8, MAT.board, 36), x, limbY, 0);
      });
      reg(g, "HV winding (11–33 kV) — layer / disc",
        "Outer HV: layer or continuous-disc copper with inter-layer cooling. Leads exit to DETC and bushings. Source disc/layer winders and enamelled / paper-covered conductor.",
        [0, -2, -20], { toggle: "hv", id: "hv-winding", label: "HV winding" });
    }

    /* ---- TANK / OIL / COVER ---- */
    {
      var g = new THREE.Group();
      add(g, box(40, 28, 24, MAT.tank), 0, 14, 0);
      add(g, box(42, 2.4, 3.2, MAT.steelDk), 0, -1.2, 7);
      add(g, box(42, 2.4, 3.2, MAT.steelDk), 0, -1.2, -7);
      [[-18, 10], [18, 10], [-18, -10], [18, -10]].forEach(function (p) {
        add(g, box(3.2, 1.6, 3.2, MAT.steelLt), p[0], 2.2, p[1]);
      });
      reg(g, "Tank, skid base & jacking pads",
        "Welded mild-steel tank for ~1000 kVA ONAN, C3–C5 paint system, skid underbase and jacking pads. Opacity slider reveals the active part. Source tank fabricators and surface-prep shops.",
        [0, -26, 0], { toggle: "tank", id: "tank", label: "Tank" });
    }
    {
      var g = new THREE.Group();
      var oil = box(37.5, 26.5, 21.5, MAT.oil);
      oil.position.set(0, 13.8, 0);
      g.add(oil);
      oilMeshes.push(oil);
      reg(g, "Insulating & cooling oil (~800–1200 L)",
        "Inhibited mineral oil (IEC 60296) or natural ester for ONAN cooling and dielectric duty. DGA / moisture sampling tracks health. Source oil majors and mobile processing units.",
        [0, 0, 0], { toggle: "oil", id: "oil", label: "Oil" });
    }
    {
      var g = new THREE.Group();
      add(g, box(40, 1.6, 24, MAT.steel), 0, 28.8, 0);
      add(g, cyl(2.2, 2.2, 0.7, MAT.steelLt), -6, 30, -3);
      add(g, cyl(1.6, 1.8, 1.4, MAT.red), 8, 30.2, 4);
      add(g, cyl(1.2, 1.2, 0.5, MAT.steelDk), 8, 31.1, 4);
      reg(g, "Tank cover with pressure-relief valve (PRV)",
        "Bolted gasketed cover with spring PRV (Qualitrol / Emco class) for sudden-pressure venting and trip contact. Source PRVs, cover gaskets and hatch hardware.",
        [0, 16, 0], { toggle: "tank", id: "cover", label: "Cover / PRV" });
    }

    /* ---- CORRUGATIONS / RADIATORS ---- */
    {
      var g = new THREE.Group();
      [1, -1].forEach(function (zs) {
        var bank = new THREE.Group();
        for (var i = 0; i < 11; i++) {
          add(bank, box(36, 22, 0.45, MAT.steel), 0, 14, zs * (13.2 + i * 0.85));
        }
        /* collector stubs */
        var cTop = cyl(0.7, 0.7, 4, MAT.steelDk);
        cTop.rotation.x = Math.PI / 2;
        cTop.position.set(0, 24, zs * 12.2);
        bank.add(cTop);
        var cBot = cTop.clone();
        cBot.position.y = 4;
        bank.add(cBot);
        bank.userData.exDir = new THREE.Vector3(0, 0, zs * 16);
        g.add(bank);
      });
      reg(g, "Radiator fins / tank corrugations (ONAN)",
        "Pressed-plate radiators or deep tank corrugations for natural oil/air cooling — typical of 630–1600 kVA DTs. Detachable banks preferred for transport. Source radiator presses and tank corrugators.",
        [0, 0, 0], { toggle: "cooling", id: "radiators", label: "Radiators" });
    }

    /* ---- BUSHINGS ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var b = new THREE.Group();
        for (var i = 0; i < 6; i++) {
          var sh = torus(1.7 - i * 0.08, 0.38, MAT.porcel);
          sh.rotation.x = Math.PI / 2;
          sh.position.y = 1.2 + i * 1.35;
          b.add(sh);
        }
        add(b, cyl(0.55, 0.75, 9, MAT.porcel), 0, 5.2, 0);
        add(b, cyl(0.7, 0.7, 1.1, MAT.steelDk), 0, 10.2, 0);
        add(b, cyl(1.6, 1.8, 1.4, MAT.steel), 0, 0.2, 0);
        b.position.set(x, 29.5, -6);
        g.add(b);
      });
      reg(g, "HV bushings (3) — porcelain / RIP",
        "Three phase HV bushings (11–33 kV class) on the cover. Creepage and BIL per site pollution. Source porcelain / RIP bushings and gasket kits.",
        [0, 20, -10], { toggle: "bushings", id: "hv-bushings", label: "HV bushings" });
    }
    {
      var g = new THREE.Group();
      var lvX = [-10.5, -3.5, 3.5, 10.5];
      lvX.forEach(function (x, idx) {
        var b = new THREE.Group();
        var sheds = idx === 3 ? 3 : 4;
        for (var i = 0; i < sheds; i++) {
          var sh = torus(1.25, 0.32, MAT.porcel);
          sh.rotation.x = Math.PI / 2;
          sh.position.y = 0.7 + i * 1.15;
          b.add(sh);
        }
        add(b, cyl(0.45, 0.6, 5.5, MAT.porcel), 0, 3.2, 0);
        add(b, box(1.6, 1.8, 0.55, MAT.copperL), 0, 6.4, 0);
        add(b, cyl(1.2, 1.35, 1.1, MAT.steel), 0, 0.1, 0);
        b.position.set(x, 29.2, 7);
        g.add(b);
      });
      reg(g, "LV bushings (4 incl. neutral)",
        "Four LV bushings a–b–c–n for Dyn11 / Yyn0 distribution service. Neutral often solidly earthed at the cable box. Source LV bushings, palm connectors and neutral links.",
        [0, 16, 12], { toggle: "bushings", id: "lv-bushings", label: "LV bushings" });
    }

    /* ---- CONSERVATOR / BUCHHOLZ / BREATHER ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(0.55, 0.55, 10, MAT.steelDk), -14, 34, -2);
      add(g, cyl(0.55, 0.55, 8, MAT.steelDk), 6, 34, -2);
      var cons = cyl(3.4, 3.4, 26, MAT.steel);
      cons.rotation.z = Math.PI / 2;
      cons.position.set(-4, 40.5, -2);
      g.add(cons);
      add(g, cyl(3.55, 3.55, 0.55, MAT.steelDk), 6, 40.5, -2).rotation.z = Math.PI / 2;
      add(g, box(2.5, 1.2, 2.5, MAT.steelLt), -16, 30.2, -2);
      reg(g, "Freestanding conservator (expansion vessel)",
        "Horizontal conservator typical of larger oil DTs — accommodates oil expansion and keeps main tank full. Source conservator tanks, rubber bags and support brackets.",
        [0, 24, 0], { toggle: "conservator", id: "conservator", label: "Conservator" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.55, 0.55, 4.5, MAT.steelDk), -2, 32.5, -2);
      add(g, box(2.6, 2.4, 2.4, MAT.orange), -2, 33.2, -2);
      add(g, cyl(0.95, 0.95, 0.7, MAT.red), -2, 35.2, -2);
      add(g, cyl(0.95, 0.95, 0.7, MAT.red), -2, 31.2, -2);
      reg(g, "Buchholz relay",
        "Gas accumulation alarm + oil-surge trip on the conservator pipe — standard on free-breathing oil DTs with conservator. Source Buchholz relays and isolating valves.",
        [0, 20, 0], { toggle: "buchholz", id: "buchholz", label: "Buchholz" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.35, 0.35, 6, MAT.steelDk), 10, 37, 2);
      add(g, cyl(1.05, 1.05, 4.2, MAT.glass), 10, 32.5, 2);
      add(g, cyl(1.15, 1.15, 0.7, MAT.steelDk), 10, 30.1, 2);
      add(g, cyl(1.2, 1.2, 0.35, MAT.rubber), 10, 29.6, 2);
      reg(g, "Dehydrating silica-gel breather",
        "Breather on the conservator air path keeps moisture out of the oil. Silica-gel or regenerating maintenance-free types. Source breathers, gel charge and oil cups.",
        [10, 18, 8], { toggle: "breathers", id: "breather", label: "Breather" });
    }
    {
      var g = new THREE.Group();
      var gauge = cyl(1.2, 1.2, 0.45, MAT.glass);
      gauge.rotation.x = Math.PI / 2;
      gauge.position.set(-4, 40.5, 2.2);
      g.add(gauge);
      add(g, box(0.12, 0.9, 0.08, MAT.red), -4, 40.55, 2.45);
      add(g, cyl(0.25, 0.25, 2.2, MAT.steelDk), -4, 39.2, 1.2);
      reg(g, "Oil level indicator (MOG / prismatic)",
        "Magnetic oil-level gauge or prismatic sight glass on the conservator — alarm contacts to SCADA. Source MOGs and float mechanisms.",
        [0, 26, 8], { toggle: "conservator", id: "oil-level", label: "Oil level" });
    }

    /* ---- TAP-CHANGER ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(2.8, 2.8, 8, MAT.steel), -22, 14, 0);
      add(g, cyl(3.0, 3.0, 1.0, MAT.steelDk), -22, 18.6, 0);
      add(g, box(3.5, 2.2, 3.5, MAT.cabinet), -22, 20.2, 0);
      add(g, cyl(0.9, 0.9, 1.6, MAT.steelLt), -22, 22, 0);
      var handle = box(2.4, 0.35, 0.55, MAT.orange);
      handle.position.set(-22, 22.6, 0);
      g.add(handle);
      reg(g, "Off-circuit tap-changer (DETC)",
        "De-energised tap-changer ±2×2.5% (or ±5%) — operate only with HV isolated. Handwheel / pin board on tank wall. Source DETC switches, contacts and drive shafts.",
        [-16, -4, 0], { toggle: "detc", id: "detc", label: "DETC" });
    }
    {
      var g = new THREE.Group();
      add(g, box(4.5, 10, 5.5, MAT.steelDk), -23.5, 12, 8);
      add(g, cyl(1.8, 1.8, 1.2, MAT.steel), -23.5, 17.5, 8);
      add(g, box(0.3, 3.5, 2.2, MAT.steelLt), -21.1, 12, 8);
      reg(g, "Optional small OLTC pocket (side pocket)",
        "Side pocket for a compact in-tank / compartment OLTC when on-load regulation is specified on larger DTs. Often blanked on standard DETC units. Source OLTC OEMs and pocket fabricators.",
        [-18, -6, 10], { toggle: "oltc", id: "oltc-pocket", label: "OLTC pocket" });
    }

    /* ---- ACCESSORIES ---- */
    {
      var g = new THREE.Group();
      var dv = cyl(0.85, 0.85, 1.8, MAT.steelDk);
      dv.rotation.x = Math.PI / 2;
      dv.position.set(12, 2.5, 12.2);
      g.add(dv);
      add(g, torus(1.0, 0.18, MAT.red), 12, 2.5, 13.2);
      reg(g, "Drain / filter valve",
        "Bottom drain and filter connection for oil processing. Open only under controlled procedures. Source gate/ball valves and flanges.",
        [10, -22, 8], { toggle: "tank", id: "drain-valve", label: "Drain valve" });
    }
    {
      var g = new THREE.Group();
      var sv = cyl(0.4, 0.4, 1.0, MAT.red);
      sv.rotation.x = Math.PI / 2;
      sv.position.set(15.5, 3.5, 12);
      g.add(sv);
      add(g, cyl(0.55, 0.55, 0.35, MAT.steelDk), 15.5, 3.5, 12.55);
      reg(g, "Oil sampling valve",
        "Dedicated sampling point for DGA and oil-quality programmes — never share with the drain path. Source sample valves and septum adapters.",
        [14, -20, 8], { toggle: "tank", id: "sample-valve", label: "Sample valve" });
    }
    {
      var g = new THREE.Group();
      add(g, box(5.5, 4.2, 0.25, MAT.plate), -8, 16, 12.15);
      add(g, box(4.8, 3.4, 0.08, MAT.steelLt), -8, 16, 12.28);
      reg(g, "Rating / nameplate",
        "Stainless rating plate: kVA, voltages, vector group, impedance, masses and oil volume (IEC / IEEE). Source etched plates and rivet kits.",
        [-10, -8, 14], { toggle: "tank", id: "rating-plate", label: "Rating plate" });
    }
    {
      var g = new THREE.Group();
      [[-18, 10], [18, 10], [-18, -10], [18, -10]].forEach(function (p) {
        add(g, box(2.2, 1.2, 0.6, MAT.steelDk), p[0], 28.2, p[1]);
        var eye = torus(0.7, 0.22, MAT.steelLt);
        eye.rotation.z = Math.PI / 2;
        eye.position.set(p[0], 29.2, p[1]);
        g.add(eye);
      });
      reg(g, "Lifting lugs",
        "Four cover / tank lifting lugs rated for the filled mass. Verify SWL before crane lifts. Source forged lugs and pad welding.",
        [0, 18, 0], { toggle: "tank", id: "lifting-lugs", label: "Lifting lugs" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.7, 0.7, 0.9, MAT.steelDk), 19.2, 4, -6);
      add(g, box(1.4, 1.4, 0.35, MAT.copperL), 19.85, 4, -6);
      add(g, cyl(0.25, 0.25, 1.2, MAT.copper), 20.5, 4, -6).rotation.z = Math.PI / 2;
      reg(g, "Earthing boss / tank earth terminal",
        "Welded earthing boss for tank / frame earth bonding — mandatory for protective earthing and equipotential bonding. Source bosses, earth straps and clamps.",
        [16, -18, -6], { toggle: "tank", id: "earth-boss", label: "Earthing" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.55, 0.55, 3.5, MAT.steelDk), 16, 22, 8);
      add(g, cyl(0.9, 0.9, 1.4, MAT.cabinet), 16, 24.2, 8);
      add(g, cyl(0.7, 0.7, 0.35, MAT.glass), 16, 25.05, 8);
      add(g, box(0.08, 0.55, 0.08, MAT.red), 16, 25.15, 8);
      reg(g, "Thermometer pocket (OTI)",
        "Thermometer well / OTI pocket in the tank top oil — dial or remote winding-temperature image. Source pockets, OTI/WTI and capillary sensors.",
        [14, 8, 10], { toggle: "controls", id: "thermo-pocket", label: "Thermometer" });
    }
    {
      var g = new THREE.Group();
      add(g, box(14, 10, 6, MAT.cabinet), 0, 8, 16);
      add(g, box(12.5, 8.5, 0.3, MAT.steelLt), 0, 8, 19.15);
      add(g, box(3.2, 2.4, 1.2, MAT.steelDk), -4, 3.5, 16);
      add(g, box(3.2, 2.4, 1.2, MAT.steelDk), 4, 3.5, 16);
      [[-5, 10], [0, 10], [5, 10]].forEach(function (p) {
        add(g, cyl(0.35, 0.35, 2.5, MAT.copperL), p[0], p[1], 14.5);
      });
      reg(g, "LV cable box / arbor",
        "Air-insulated or compound-filled LV cable box with arbor / palm terminations for multicore cables. Source boxes, glands, palm connectors and phase barriers.",
        [0, -10, 18], { toggle: "cablebox", id: "cable-box", label: "Cable box" });
    }

    /* Light tick reserved — no heavy animation on distribution unit */
    if (typeof engine.setOnTick === "function") {
      engine.setOnTick(function (/* dt */) {
        /* intentionally empty: no fans on base ONAN DT */
      });
    }

    engine._tpOilMeshes = oilMeshes;
    return {
      parts: engine.parts,
      setTankOpacity: function (v) {
        MAT.tank.opacity = Math.max(0.02, Math.min(1, v));
      },
      materials: MAT
    };
  }

  root.TPOilAssembly = { build: build };
})(typeof window !== "undefined" ? window : globalThis);
