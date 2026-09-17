/**
 * Next-level power transformer assembly for TransformerPath.
 * Every accessory is its own clickable / sourceable part.
 * Usage: TPPowerAssembly.build(engine) where engine is from TP3D.bootstrap(...)
 */
(function (root) {
  "use strict";

  function build(engine, opts) {
    opts = opts || {};
    var THREE = engine.THREE || root.THREE;
    var reg = engine.reg.bind(engine);
    var fans = [];
    var oilMeshes = [];

    var MAT = {
      steel: mat(0x8fa3b8, 0.45, 0.65),
      steelDk: mat(0x5d7186, 0.5, 0.6),
      steelLt: mat(0xb6c5d4, 0.4, 0.5),
      core: mat(0x6e7f93, 0.35, 0.8),
      copper: mat(0xc9772f, 0.35, 0.7),
      copperL: mat(0xd98f4a, 0.4, 0.6),
      hv: mat(0xa8503c, 0.5, 0.35),
      tap: mat(0x8c6a3f, 0.5, 0.4),
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
      oil: new THREE.MeshStandardMaterial({
        color: 0xe3b34d, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false
      }),
      tank: new THREE.MeshStandardMaterial({
        color: 0x9db2c6, roughness: 0.4, metalness: 0.55,
        transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false
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

    var limbX = [-18, 0, 18];

    /* ---- CORE ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, box(8, 34, 8, MAT.core), x, 17, 0);
      });
      add(g, box(52, 6, 10, MAT.core), 0, 2, 0);
      add(g, box(56, 2.2, 12, MAT.steelDk), 0, -0.2, 0);
      [[-26, 8], [26, 8], [-26, -8], [26, -8]].forEach(function (p) {
        add(g, cyl(0.55, 0.55, 36, MAT.steelLt), p[0], 18, p[1]);
      });
      reg(g, "Core — limbs & bottom yoke (with clamping)",
        "CRGO / Hi-B step-lap core: three limbs, bottom yoke and clamp frames. Laser-scribed 0.23–0.27 mm steel, single-point core earthing, glass-tape banding. Source CRGO mills and stacking machinery via the directory.",
        [0, -28, 0], { toggle: "core", id: "core", label: "Core" });
    }
    {
      var g = new THREE.Group();
      add(g, box(52, 6, 10, MAT.core), 0, 38, 0);
      add(g, box(56, 2.4, 12, MAT.steelDk), 0, 41.2, 0);
      limbX.forEach(function (x) {
        add(g, box(3, 2, 14, MAT.steelLt), x, 42.6, 0);
      });
      reg(g, "Top yoke, clamping frame & tie rods",
        "Top yoke closes the magnetic circuit. Clamp beams and insulated tie-rods set axial pressure without shorted turns. Removed on major rewinds.",
        [0, 26, 0], { toggle: "core", id: "top-yoke", label: "Top yoke" });
    }

    /* ---- WINDINGS ---- */
    function windingStack(matCol, r0, r1, name, desc, explode, toggle, id, label) {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var w = cyl(r1, r1, 28, matCol, 36);
        w.position.set(x, 18, 0);
        g.add(w);
        var duct = cyl(r0, r0, 28.2, MAT.board, 36);
        duct.position.set(x, 18, 0);
        g.add(duct);
      });
      reg(g, name, desc, explode, { toggle: toggle, id: id, label: label });
    }
    windingStack(MAT.copper, 4.2, 5.4,
      "LV winding (33 kV, inner) — helical / CTC",
      "Inner LV: continuously transposed cable or helical copper. Axial cooling ducts, end rings and pressure plates. Source CTC, winding machines and coil presses.",
      [0, -10, -18], "lv", "lv-winding", "LV winding");
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        for (var i = 0; i < 3; i++) {
          var b = cyl(6.2 + i * 0.55, 6.2 + i * 0.55, 29, MAT.board, 36);
          b.position.set(x, 18, 0);
          g.add(b);
        }
      });
      reg(g, "Main HV–LV insulation barriers (pressboard)",
        "Pressboard cylinders and oil ducts grade the HV–LV gap. Weidmann / transformerboard class. Critical to impulse withstand and PD performance.",
        [0, -6, -22], { toggle: "barriers", id: "pressboard", label: "Barriers" });
    }
    windingStack(MAT.hv, 7.4, 9.0,
      "HV winding (132 kV, middle) — continuous disc",
      "Continuous-disc HV winding with interleaved line end for impulse control. Inter-disc spacers, static rings and lead exits. Source disc winders and conductor.",
      [0, -4, -28], "hv", "hv-winding", "HV winding");
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var b = cyl(9.5, 9.5, 29, MAT.board, 36);
        b.position.set(x, 18, 0);
        g.add(b);
      });
      reg(g, "HV–tap barrier cylinders",
        "Outer barrier set between HV body and regulating winding — sized for recovery voltage across the tap range during OLTC diverter operation.",
        [0, -2, -30], { toggle: "barriers", id: "hv-tap-barrier", label: "HV–tap barriers" });
    }
    windingStack(MAT.tap, 10.0, 10.8,
      "Tapping / regulating winding (outermost)",
      "±10% in 17 positions. Separate multi-start tap winding so leads run to the OLTC selector with minimum leakage unbalance.",
      [0, 0, -34], "tap", "tap-winding", "Tap winding");

    /* ---- TANK / OIL / COVER ---- */
    {
      var g = new THREE.Group();
      add(g, box(70, 38, 34, MAT.tank), 0, 19, 0);
      add(g, box(72, 3, 4, MAT.steelDk), 0, -1.5, 9);
      add(g, box(72, 3, 4, MAT.steelDk), 0, -1.5, -9);
      [[-31, 15], [31, 15], [-31, -15], [31, -15]].forEach(function (p) {
        add(g, box(4, 2, 4, MAT.steelLt), p[0], 4, p[1]);
      });
      reg(g, "Tank, skid base & jacking pads",
        "Vacuum-capable welded tank, C5-M paint, skid underbase, four jacking pads and earthing pads. Opacity slider reveals the active part.",
        [0, -34, 0], { toggle: "tank", id: "tank", label: "Tank" });
    }
    {
      var g = new THREE.Group();
      var oil = box(66.5, 37, 30.5, MAT.oil);
      oil.position.set(0, 18.6, 0);
      g.add(oil);
      oilMeshes.push(oil);
      reg(g, "Insulating & cooling oil (~60 000 L)",
        "Inhibited mineral oil (IEC 60296) or natural ester. Dielectric, coolant and diagnostic medium — DGA is the unit’s health record.",
        [0, 0, 0], { toggle: "oil", id: "oil", label: "Oil" });
    }
    {
      var g = new THREE.Group();
      add(g, box(70, 2, 34, MAT.steel), 0, 41, 0);
      add(g, cyl(3, 3, 1, MAT.steelLt), -8, 42.6, -2);
      add(g, cyl(3, 3, 1, MAT.steelLt), 8, 42.6, -2);
      add(g, box(2.4, 1.6, 2, MAT.cabinet), 26, 42.8, -4);
      reg(g, "Tank cover — hatches & core test link",
        "Bolted gasketed cover (or bell-tank). Inspection hatches and core/frame earthing test link for in-service megger checks.",
        [0, 22, 0], { toggle: "tank", id: "cover", label: "Cover" });
    }
    {
      var g = new THREE.Group();
      for (var x = -33; x <= 33; x += 6) {
        add(g, cyl(0.5, 0.5, 0.9, MAT.steelDk, 10), x, 42.3, 16.2);
        add(g, cyl(0.5, 0.5, 0.9, MAT.steelDk, 10), x, 42.3, -16.2);
      }
      reg(g, "Cover bolting & gasket joint",
        "Stud sequence on a continuous gasket groove — leak-tested under pressure. Bell-tank designs move the joint to the bottom.",
        [0, 22, 0], { toggle: "tank", id: "cover-bolts", label: "Cover bolts" });
    }
    {
      var g = new THREE.Group();
      for (var y = 6; y <= 36; y += 5) {
        var rung = cyl(0.26, 0.26, 2.4, MAT.steelDk);
        rung.rotation.x = Math.PI / 2;
        rung.position.set(34.9, y, -8);
        g.add(rung);
      }
      add(g, cyl(0.32, 0.32, 34, MAT.steelDk), 34.9, 21, -6.8);
      add(g, cyl(0.32, 0.32, 34, MAT.steelDk), 34.9, 21, -9.2);
      add(g, box(5, 6, 0.3, MAT.steelDk), -12, 18, 16.3);
      reg(g, "Ladder & rating plate",
        "Access ladder to the cover platform and stainless rating plate — ratings, vector group, impedances, masses and oil volume.",
        [18, -20, 0], { toggle: "tank", id: "ladder-plate", label: "Ladder / plate" });
    }
    {
      var g = new THREE.Group();
      var dv = cyl(1.1, 1.1, 2.2, MAT.steelDk);
      dv.rotation.x = Math.PI / 2;
      dv.position.set(20, 3.5, 17);
      g.add(dv);
      add(g, torus(1.3, 0.2, MAT.red), 20, 3.5, 18.3);
      reg(g, "Drain / filter valve",
        "Main drain and filter connection for mobile oil processing. Opened only under controlled procedures.",
        [12, -30, 10], { toggle: "tank", id: "drain-valve", label: "Drain valve" });
    }
    {
      var g = new THREE.Group();
      var sv = cyl(0.5, 0.5, 1.2, MAT.red);
      sv.rotation.x = Math.PI / 2;
      sv.position.set(25, 4.5, 16.7);
      g.add(sv);
      reg(g, "Oil sampling valve",
        "Dedicated sampling valve for DGA and oil-quality programmes — never share with the drain path.",
        [16, -28, 10], { toggle: "tank", id: "sample-valve", label: "Sample valve" });
    }
    {
      var g = new THREE.Group();
      [[-28, 12], [28, 12], [-28, -12], [28, -12]].forEach(function (p) {
        var wh = torus(2.2, 0.45, MAT.steelDk);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(p[0], 1.2, p[1]);
        g.add(wh);
        add(g, cyl(0.5, 0.5, 3.2, MAT.steelLt), p[0], 1.2, p[1]);
      });
      reg(g, "Haulage wheels / skid rollers",
        "Flanged haulage wheels or skid rollers for rail / trailer moves. Often removed after installation.",
        [0, -36, 0], { toggle: "tank", id: "wheels", label: "Wheels" });
    }

    /* ---- PROTECTION ON COVER ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(2, 2.4, 2, MAT.red), -14, 43, 6);
      add(g, cyl(2, 2.4, 2, MAT.red), 14, 43, 6);
      reg(g, "Pressure relief devices (PRDs)",
        "Spring PRDs vent sudden internal pressure and trip protection. Qualitrol / Emco-class accessories on every power tank.",
        [0, 24, 0], { toggle: "prd", id: "prd", label: "PRDs" });
    }
    {
      var g = new THREE.Group();
      add(g, box(2.2, 2.4, 2.2, MAT.orange), 8, 43.2, -10);
      add(g, cyl(0.4, 0.4, 2.5, MAT.steelDk), 8, 41.5, -10);
      reg(g, "Sudden pressure / rapid-rise relay",
        "Detects fast tank pressure rise from internal arcing — complements Buchholz on sealed / low-oil-volume designs.",
        [8, 24, -12], { toggle: "prd", id: "spr", label: "SPR" });
    }

    /* ---- BUSHINGS ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(3, 3.4, 7, MAT.steel), x, 45.5, -8);
      });
      reg(g, "HV bushing turrets",
        "Steel turrets welded to cover/tank carry each HV bushing and house bushing CT rings.",
        [0, 22, 0], { toggle: "turrets", id: "turrets", label: "Turrets" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var ct = torus(3.6, 0.8, MAT.steelDk);
        ct.rotation.x = Math.PI / 2;
        ct.position.set(x, 43.6, -8);
        g.add(ct);
      });
      reg(g, "Bushing CT rings",
        "Multi-ratio ring-type bushing CTs for differential, REF and backup. Specify ratio, class and ID/OD in the RFQ.",
        [0, 20, 0], { toggle: "turrets", id: "bushing-cts", label: "Bushing CTs" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var b = new THREE.Group();
        add(b, cyl(1.4, 1.8, 4, MAT.porcelDk), 0, 2, 0);
        for (var i = 0; i < 9; i++) {
          var sh = torus(2.6 - i * 0.13, 0.55, MAT.porcel);
          sh.rotation.x = Math.PI / 2;
          sh.position.y = 4.5 + i * 1.9;
          b.add(sh);
        }
        add(b, cyl(0.8, 1.2, 18, MAT.porcel), 0, 12.5, 0);
        add(b, cyl(1, 1, 1.6, MAT.steelDk), 0, 22, 0);
        var ring = torus(2.2, 0.3, MAT.steelLt);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 20.6;
        b.add(ring);
        b.position.set(x, 49, -8);
        g.add(b);
      });
      reg(g, "132 kV condenser bushings (RIP/OIP)",
        "Condenser-graded RIP/RIS or OIP bushings. Test tap for online tan δ / C monitoring. Source by kV, creepage and CT interface.",
        [0, 28, -12], { toggle: "bushings", id: "hv-bushings", label: "HV bushings" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(2.4, 2.8, 4.5, MAT.steel), x, 44.2, 9);
        var b = new THREE.Group();
        for (var i = 0; i < 5; i++) {
          var sh = torus(2, 0.5, MAT.porcel);
          sh.rotation.x = Math.PI / 2;
          sh.position.y = 1 + i * 1.7;
          b.add(sh);
        }
        add(b, cyl(0.7, 0.9, 9.5, MAT.porcel), 0, 4.6, 0);
        add(b, box(2, 2.6, 0.8, MAT.copperL), 0, 10.4, 0);
        b.position.set(x, 46.5, 9);
        g.add(b);
      });
      reg(g, "33 kV LV bushings",
        "Three 33 kV porcelain bushings with turret CTs — delta closed inside the tank on YNd11 units.",
        [0, 20, 14], { toggle: "bushings", id: "lv-bushings", label: "LV bushings" });
    }
    {
      var g = new THREE.Group();
      var nb = new THREE.Group();
      for (var i = 0; i < 4; i++) {
        var sh = torus(1.6, 0.42, MAT.porcel);
        sh.rotation.x = Math.PI / 2;
        sh.position.y = 0.8 + i * 1.5;
        nb.add(sh);
      }
      add(nb, cyl(0.55, 0.7, 7.5, MAT.porcel), 0, 3.6, 0);
      nb.position.set(28, 43.5, 0);
      g.add(nb);
      reg(g, "HV neutral bushing",
        "Star-point bushing for solidly earthed HV neutral — enables REF protection and reduced end insulation.",
        [22, 18, 0], { toggle: "bushings", id: "neutral-bushing", label: "Neutral" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(2.4, 2.4, 0.7, MAT.steelDk), x, 48.8, -8);
        add(g, cyl(2.0, 2.0, 0.6, MAT.steelDk), x, 46.2, 9);
      });
      reg(g, "Bushing mounting flanges",
        "Gasketed flanges — the mechanical fuse of the bushing interface. Torque and weep checks every outage.",
        [0, 24, 0], { toggle: "bushings", id: "bushing-flanges", label: "Flanges" });
    }

    /* ---- CONSERVATOR / RELAYS / BREATHERS ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(0.9, 0.9, 16, MAT.steelDk), -16, 51, -2);
      add(g, cyl(0.9, 0.9, 16, MAT.steelDk), 8, 51, -2);
      var cons = cyl(5.5, 5.5, 42, MAT.steel);
      cons.rotation.z = Math.PI / 2;
      cons.position.set(-4, 61, -2);
      g.add(cons);
      var div = cyl(5.65, 5.65, 0.8, MAT.steelDk);
      div.rotation.z = Math.PI / 2;
      div.position.set(8, 61, -2);
      g.add(div);
      reg(g, "Conservator (2 compartments)",
        "Twin-compartment rubber-bag conservator: main tank vs OLTC diverter oil. Free-breathing power practice.",
        [0, 32, 0], { toggle: "conservator", id: "conservator", label: "Conservator" });
    }
    {
      var g = new THREE.Group();
      var g1 = cyl(1.5, 1.5, 0.6, MAT.glass);
      g1.rotation.x = Math.PI / 2;
      g1.position.set(-8, 61, 3.8);
      g.add(g1);
      var g2 = cyl(1.5, 1.5, 0.6, MAT.glass);
      g2.rotation.x = Math.PI / 2;
      g2.position.set(13, 61, 3.8);
      g.add(g2);
      reg(g, "Magnetic oil-level gauges (MOG)",
        "Magnetic oil-level gauges per conservator compartment — alarm contacts to SCADA.",
        [0, 34, 6], { toggle: "conservator", id: "mog", label: "MOG" });
    }
    {
      var g = new THREE.Group();
      add(g, box(1.6, 1.2, 1.2, MAT.cabinet), 17, 61, -2);
      add(g, cyl(0.25, 0.25, 2, MAT.steelLt), 17, 59.5, -2);
      reg(g, "Air-cell / bladder indicator",
        "Indicates rubber-bag integrity. A collapsed bag is a moisture ingress path — watch this gauge.",
        [14, 34, 0], { toggle: "conservator", id: "air-cell", label: "Air cell" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.9, 0.9, 6, MAT.steelDk), 0, 46.5, -2);
      add(g, box(3.2, 3, 3, MAT.orange), 0, 47.5, -2);
      add(g, cyl(1.2, 1.2, 1, MAT.red), 0, 50.5, -2);
      add(g, cyl(1.2, 1.2, 1, MAT.red), 0, 45, -2);
      reg(g, "Buchholz relay",
        "Gas accumulation alarm + oil-surge trip on the main conservator pipe. Isolating valves allow in-service testing.",
        [0, 28, 0], { toggle: "buchholz", id: "buchholz", label: "Buchholz" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.6, 0.6, 8, MAT.steelDk), -22, 48, -2);
      add(g, box(2.4, 2.2, 2.2, MAT.red), -22, 49, -2);
      reg(g, "OLTC oil-surge (RS) relay",
        "Instant trip on diverter oil surge — OLTC pipe only. Separate from main Buchholz.",
        [-18, 28, 0], { toggle: "buchholz", id: "rs-relay", label: "RS relay" });
    }
    {
      var g = new THREE.Group();
      function breather(x) {
        add(g, cyl(0.5, 0.5, 9, MAT.steelDk), x, 55.5, 3);
        add(g, cyl(1.3, 1.3, 5.5, MAT.glass), x, 49, 3);
        add(g, cyl(1.4, 1.4, 0.9, MAT.steelDk), x, 45.9, 3);
      }
      breather(16.5);
      breather(-25);
      reg(g, "Dehydrating breathers",
        "One breather per conservator compartment — silica-gel or regenerating maintenance-free types.",
        [0, 28, 8], { toggle: "breathers", id: "breathers", label: "Breathers" });
    }

    /* ---- COOLING ---- */
    {
      var g = new THREE.Group();
      [1, -1].forEach(function (zs) {
        var bank = new THREE.Group();
        [-22, -11, 0, 11, 22].forEach(function (ux) {
          [32.8, 5.2].forEach(function (y) {
            var c = cyl(0.95, 0.95, 13.5, MAT.steelDk);
            c.rotation.x = Math.PI / 2;
            c.position.set(ux, y, zs * 23);
            bank.add(c);
          });
          for (var k = 0; k < 9; k++) {
            add(bank, box(5.2, 26, 0.55, MAT.steel), ux, 19, zs * (17.9 + k * 1.45));
          }
        });
        bank.userData.exDir = new THREE.Vector3(0, 0, zs * 26);
        g.add(bank);
      });
      reg(g, "Radiator banks",
        "Pressed-plate radiator elements on collectors. Detachable for transport without draining.",
        [0, 0, 0], { toggle: "cooling", id: "radiators", label: "Radiators" });
    }
    {
      var g = new THREE.Group();
      [1, -1].forEach(function (zs) {
        [-15, 0, 15].forEach(function (fx) {
          var ring = torus(3.2, 0.35, MAT.steelDk);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(fx, 1.8, zs * 22);
          g.add(ring);
          add(g, cyl(0.6, 0.6, 0.8, MAT.steelDk), fx, 1.8, zs * 22);
          var bl = new THREE.Group();
          for (var k = 0; k < 4; k++) {
            var blade = box(2.6, 0.18, 0.9, MAT.steelLt);
            blade.rotation.y = k * Math.PI / 2;
            blade.rotation.x = 0.5;
            blade.position.set(Math.cos(k * Math.PI / 2) * 1.5, 0, Math.sin(k * Math.PI / 2) * 1.5);
            bl.add(blade);
          }
          bl.position.set(fx, 1.8, zs * 22);
          g.add(bl);
          fans.push(bl);
        });
      });
      reg(g, "Cooling fans (ONAF)",
        "Fan groups stage ONAN → ONAF₁ → ONAF₂ from winding-temperature signals. High-volume sourced cooling plant.",
        [0, -16, 18], { toggle: "cooling", id: "fans", label: "Fans" });
    }
    {
      var g = new THREE.Group();
      [1, -1].forEach(function (zs) {
        [-22, -11, 0, 11, 22].forEach(function (ux) {
          var v = cyl(1.5, 1.5, 1.1, MAT.red);
          v.rotation.x = Math.PI / 2;
          v.position.set(ux, 32.8, zs * 16.7);
          g.add(v);
          var v2 = v.clone();
          v2.position.y = 5.2;
          g.add(v2);
        });
      });
      reg(g, "Radiator butterfly valves",
        "Tank-wall butterfly valves isolate each radiator bank for transport or change-out.",
        [0, -8, 12], { toggle: "cooling", id: "rad-valves", label: "Rad. valves" });
    }
    {
      var g = new THREE.Group();
      [1, -1].forEach(function (zs) {
        var pump = cyl(1.9, 1.9, 3.2, MAT.cabinet);
        pump.rotation.x = Math.PI / 2;
        pump.position.set(5.5, 5.2, zs * 18.5);
        g.add(pump);
      });
      reg(g, "Oil circulating pumps (OFAF)",
        "Forced-oil pumps for OFAF/ODAF duty. Magnetic-drive preferred; staged with fans by WTI.",
        [8, -20, 12], { toggle: "pumps", id: "oil-pumps", label: "Oil pumps" });
    }
    {
      var g = new THREE.Group();
      [1, -1].forEach(function (zs) {
        var fi = cyl(1.1, 1.1, 0.7, MAT.glass);
        fi.rotation.x = Math.PI / 2;
        fi.position.set(5.5, 5.2, zs * 21.5);
        g.add(fi);
      });
      reg(g, "Oil flow indicators",
        "Confirm forced-oil loop integrity when pumps run — alarm on no-flow.",
        [8, -18, 16], { toggle: "pumps", id: "flow-indicators", label: "Flow indicators" });
    }

    /* ---- OLTC ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(4.5, 4.5, 22, MAT.steel), -38.5, 20, 0);
      add(g, cyl(4.8, 4.8, 1.4, MAT.steelDk), -38.5, 31.7, 0);
      reg(g, "On-load tap-changer (diverter / selector)",
        "In-tank vacuum OLTC: selector in main oil, diverter in its own compartment. #1 maintenance item on power transformers.",
        [-24, 0, 0], { toggle: "oltc", id: "oltc", label: "OLTC" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.45, 0.45, 18, MAT.steelLt), -41.5, 18, 6);
      add(g, box(2, 2, 2, MAT.steelDk), -41.5, 28, 6);
      var hshaft = cyl(0.45, 0.45, 8, MAT.steelLt);
      hshaft.rotation.x = Math.PI / 2;
      hshaft.position.set(-41.5, 28, 2);
      g.add(hshaft);
      add(g, box(5, 9, 4, MAT.cabinet), -41.5, 8.5, 6);
      add(g, box(4.4, 8.2, 0.3, MAT.steelLt), -41.5, 8.5, 8.1);
      var crank = cyl(0.9, 0.9, 0.5, MAT.steelDk);
      crank.rotation.x = Math.PI / 2;
      crank.position.set(-43, 12, 8.2);
      g.add(crank);
      reg(g, "OLTC motor-drive cabinet",
        "Motor drive with emergency hand-crank. Steps ±10% / 17 positions under AVR / parallel control.",
        [-28, -12, 10], { toggle: "oltc", id: "oltc-drive", label: "OLTC drive" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(1.3, 1.3, 0.5, MAT.glass), -38.5, 32.7, 0);
      add(g, box(0.18, 1.6, 0.1, MAT.red), -38.5, 32.95, 0);
      var cd = cyl(0.32, 0.32, 7.6, MAT.steelDk);
      cd.rotation.z = Math.PI / 2;
      cd.position.set(-37.8, 3, 6);
      g.add(cd);
      reg(g, "OLTC position indicator & drive conduit",
        "Mechanical indicator must agree with drive counter and SCADA — slipped couplings destroy tap-changers.",
        [-22, 8, 6], { toggle: "oltc", id: "oltc-indicator", label: "OLTC position" });
    }
    {
      var g = new THREE.Group();
      add(g, box(3.2, 4.5, 2.4, MAT.cabinet), -44, 6, -4);
      add(g, cyl(0.35, 0.35, 5, MAT.steelDk), -44, 10, -2);
      reg(g, "OLTC oil filter unit",
        "Offline / online OLTC oil filter keeps diverter oil clean — extends vacuum-bottle and contact life.",
        [-30, -16, -6], { toggle: "oltc", id: "oltc-filter", label: "OLTC filter" });
    }

    /* ---- CONTROLS / MONITORING ---- */
    {
      var g = new THREE.Group();
      add(g, box(7, 12, 5, MAT.cabinet), 38.5, 12, 4);
      add(g, box(6.2, 11, 0.3, MAT.steelLt), 38.5, 12, 6.6);
      reg(g, "Marshalling cabinet",
        "Collects CT leads, fan/pump contactors, OTI/WTI, Buchholz, PRV and OLTC signals for the control building.",
        [24, -8, 8], { toggle: "controls", id: "marshalling", label: "Marshalling" });
    }
    {
      var g = new THREE.Group();
      add(g, box(3.4, 4.5, 2.6, MAT.cabinet), 36.6, 28, -6);
      var pipe = cyl(0.3, 0.3, 5, MAT.steelDk);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(34, 26.5, -6);
      g.add(pipe);
      reg(g, "Online DGA monitor",
        "Multi-gas online DGA (H₂, C₂H₂, CO, moisture) — early-warning analytics on oil health.",
        [22, 10, -8], { toggle: "controls", id: "dga", label: "Online DGA" });
    }
    {
      var g = new THREE.Group();
      add(g, box(2.4, 3, 1.6, MAT.steelLt), 36.2, 33, 8);
      add(g, cyl(0.5, 0.5, 1.2, MAT.orange), 34.8, 34, 8);
      add(g, cyl(0.5, 0.5, 1.2, MAT.red), 37.6, 34, 8);
      reg(g, "OTI / WTI temperature devices",
        "Oil and winding temperature indicators with alarm/trip contacts and cooler stage outputs.",
        [22, 14, 12], { toggle: "controls", id: "oti-wti", label: "OTI / WTI" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(0.2, 0.2, 8, MAT.glass), x, 30, 2);
        add(g, box(0.8, 0.8, 0.8, MAT.cabinet), x, 34.5, 2);
      });
      reg(g, "Fibre-optic winding temperature probes",
        "Direct hotspot probes in winding — modern fleets add these beside thermal-image WTI.",
        [0, 8, 8], { toggle: "controls", id: "fibre-probes", label: "Fibre probes" });
    }
    {
      var g = new THREE.Group();
      add(g, cyl(0.32, 0.32, 7, MAT.steelDk), 38.5, 2.8, 4);
      var h1 = cyl(0.32, 0.32, 5.5, MAT.steelDk);
      h1.rotation.z = Math.PI / 2;
      h1.position.set(35.5, 1.2, 4);
      g.add(h1);
      add(g, cyl(0.26, 0.26, 9, MAT.steelDk), 36.6, 22, -6);
      reg(g, "Control cabling & conduits",
        "CT secondary circuits are safety-critical — shorting-type terminals only.",
        [22, -12, 4], { toggle: "controls", id: "conduits", label: "Conduits" });
    }

    /* ---- ARRESTERS ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, box(2.6, 10, 2.6, MAT.steelDk), x, 5, -30);
        var a = new THREE.Group();
        for (var i = 0; i < 10; i++) {
          var sh = torus(1.7, 0.45, MAT.porcelDk);
          sh.rotation.x = Math.PI / 2;
          sh.position.y = i * 1.5;
          a.add(sh);
        }
        add(a, cyl(0.8, 0.8, 15, MAT.porcelDk), 0, 7, 0);
        add(a, cyl(1.1, 1.1, 0.8, MAT.steelDk), 0, 15.3, 0);
        a.position.set(x, 10.5, -30);
        g.add(a);
      });
      reg(g, "132 kV metal-oxide surge arresters",
        "ZnO arresters at the HV bushings clamp lightning and switching surges below LI withstand.",
        [0, 0, -24], { toggle: "arresters", id: "arresters", label: "Arresters" });
    }

    engine.setOnTick(function (dt) {
      fans.forEach(function (f) {
        if (f.parent && f.parent.visible !== false) f.rotation.y += dt * 8;
      });
    });

    engine._tpOilMeshes = oilMeshes;
    engine._tpFans = fans;
    return {
      parts: engine.parts,
      fans: fans,
      oilMeshes: oilMeshes,
      setTankOpacity: function (v) {
        MAT.tank.opacity = Math.max(0.02, Math.min(1, v));
      },
      materials: MAT
    };
  }

  root.TPPowerAssembly = { build: build };
})(typeof window !== "undefined" ? window : globalThis);
