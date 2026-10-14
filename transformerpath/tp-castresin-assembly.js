/**
 * Cast-resin (GEAFOL / RESIBLOC-class) transformer assembly for TransformerPath.
 * Every accessory is its own clickable / sourceable part.
 * Usage: TPCastResinAssembly.build(engine) where engine is from TP3D.bootstrap(...)
 */
(function (root) {
  "use strict";

  function build(engine, opts) {
    opts = opts || {};
    var THREE = engine.THREE || root.THREE;
    var reg = engine.reg.bind(engine);
    var fans = [];

    var MAT = {
      steel: mat(0x8fa3b8, 0.45, 0.65),
      steelDk: mat(0x5d7186, 0.5, 0.6),
      steelLt: mat(0xb6c5d4, 0.4, 0.5),
      core: mat(0x6e7f93, 0.35, 0.8),
      copper: mat(0xc9772f, 0.35, 0.7),
      copperL: mat(0xd98f4a, 0.4, 0.6),
      resin: mat(0xb14a38, 0.25, 0.1),
      resinIn: mat(0xc96a52, 0.3, 0.1),
      rubber: mat(0x222d3a, 0.9, 0.1),
      cabinet: mat(0x7d93a8, 0.5, 0.4),
      orange: mat(0xe8732a, 0.5, 0.3),
      red: mat(0xb33a3a, 0.5, 0.3),
      glass: new THREE.MeshStandardMaterial({
        color: 0xa8c4d8, roughness: 0.2, metalness: 0.05,
        transparent: true, opacity: 0.28, depthWrite: false
      }),
      enclosure: new THREE.MeshStandardMaterial({
        color: 0x9db2c6, roughness: 0.4, metalness: 0.55,
        transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false
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
    function roller(r) {
      r = r || 1.8;
      var rg = new THREE.Group();
      var tread = cyl(r * 0.78, r * 0.78, 1.1, MAT.steel);
      tread.rotation.x = Math.PI / 2;
      rg.add(tread);
      var f1 = cyl(r, r, 0.28, MAT.steelDk);
      f1.rotation.x = Math.PI / 2;
      f1.position.z = 0.7;
      rg.add(f1);
      var f2 = cyl(r, r, 0.28, MAT.steelDk);
      f2.rotation.x = Math.PI / 2;
      f2.position.z = -0.7;
      rg.add(f2);
      var hub = cyl(0.35, 0.35, 1.9, MAT.steelDk);
      hub.rotation.x = Math.PI / 2;
      rg.add(hub);
      return rg;
    }

    var limbX = [-12, 0, 12];

    /* ---- BASE ---- */
    {
      var g = new THREE.Group();
      add(g, box(40, 2.6, 3, MAT.steelDk), 0, 1.3, 7);
      add(g, box(40, 2.6, 3, MAT.steelDk), 0, 1.3, -7);
      [[-15, 7], [15, 7], [-15, -7], [15, -7]].forEach(function (p) {
        var w = roller(1.9);
        w.position.set(p[0], -0.5, p[1]);
        g.add(w);
      });
      reg(g, "Base channels & rollers",
        "Rolled-steel base channels with bi-directional rollers. Anti-vibration pads sit between base and floor so 100 Hz core hum does not travel into the building structure. Standard GEAFOL / RESIBLOC / SGB indoor practice.",
        [0, -28, 0], { toggle: "frame", id: "base", label: "Base / rollers" });
    }

    /* ---- CORE ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, box(6, 22, 6, MAT.core), x, 16, 0);
      });
      add(g, box(38, 5, 6, MAT.core), 0, 4.5, 0);
      add(g, box(40, 2.2, 8, MAT.steelDk), 0, 1.8, 0);
      [[-17, 5], [17, 5], [-17, -5], [17, -5]].forEach(function (p) {
        add(g, cyl(0.45, 0.45, 24, MAT.steelLt), p[0], 14, p[1]);
      });
      reg(g, "Core — limbs & bottom yoke (CRGO, resin-coated)",
        "Step-lap CRGO with resin/varnish coating — Siemens GEAFOL, Hitachi RESIBLOC and SGB CRT practice. Bm ≈1.4–1.6 T for building noise. Source CRGO packets, coating and clamps, or the full active part from CRT OEMs.",
        [0, -8, 0], { toggle: "core", id: "core", label: "Core" });
    }
    {
      var g = new THREE.Group();
      add(g, box(38, 5, 6, MAT.core), 0, 29.5, 0);
      add(g, box(40, 2.4, 1.6, MAT.steelDk), 0, 30.5, 4.6);
      add(g, box(40, 2.4, 1.6, MAT.steelDk), 0, 30.5, -4.6);
      [-17, 17].forEach(function (x) {
        add(g, box(2, 3, 0.8, MAT.steelDk), x, 32.6, 0);
      });
      reg(g, "Top yoke, clamping frame & tie rods",
        "CRT top yoke re-laid after coil drop-on. Clamp beams carry HV delta supports and set axial pressure without shorted turns. Never sling the cast coils — lift from the frame. Siemens GEAFOL / Hitachi RESIBLOC / SGB practice.",
        [0, 18, 0], { toggle: "core", id: "top-yoke", label: "Top yoke" });
    }

    /* ---- WINDINGS ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(4.9, 4.9, 17, MAT.copperL, 36), x, 16, 0);
      });
      reg(g, "LV foil windings",
        "Full-height Al or Cu foil with class-F/H prepreg, oven-cured into a rigid tube — GEAFOL/RESIBLOC/SGB standard LV. Each turn spans winding height so axial SC forces self-balance. Source foil alloy + prepreg class, or finished LV coils from CRT OEMs.",
        [0, -4, -14], { toggle: "lv", id: "lv-foil", label: "LV foil" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(5.6, 5.6, 16, MAT.glass, 36), x, 16, 0);
      });
      reg(g, "Cooling air ducts",
        "Axial ducts between LV foil and HV cast coil set AN rating; AF fans boost 40–50%. Same duct philosophy across Siemens GEAFOL, Hitachi RESIBLOC and SGB CRTs — source duct spacers with the insulation kit.",
        [0, -2, -18], { toggle: "cooling", id: "air-ducts", label: "Air ducts" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(7.4, 7.4, 18, MAT.resin, 36), x, 16, 0);
        add(g, cyl(7.9, 7.9, 1.4, MAT.resinIn, 36), x, 25.3, 0);
        add(g, cyl(7.9, 7.9, 1.4, MAT.resinIn, 36), x, 6.7, 0);
      });
      reg(g, "HV cast-resin coils (3)",
        "Defining CRT feature: three HV coils vacuum-cast in silica-filled glass-epoxy (Siemens GEAFOL / Hitachi RESIBLOC / SGB). Every coil PD-tested (<10 pC). Quote E2/E3 humidity + F1 fire classes. Premium sourced BOM line — RFQ by kV, BIL, E/C/F string.",
        [0, 0, -24], { toggle: "hv", id: "hv-coils", label: "HV coils" });
    }
    {
      var g = new THREE.Group();
      for (var i = 0; i < 2; i++) {
        add(g, box(12, 1, 0.8, MAT.copperL), -6 + i * 12, 27.4, 8.4);
      }
      add(g, box(0.8, 1, 4, MAT.copper), -12, 27.4, 6.4);
      add(g, box(0.8, 1, 4, MAT.copper), 12, 27.4, 6.4);
      add(g, box(0.8, 1, 4, MAT.copper), 0, 27.4, 6.4);
      reg(g, "HV delta links",
        "Phase-to-phase delta bus links on the HV cast coils (Dyn11 / Dy5 indoor practice). Sized for short-circuit forces and bolted to epoxy terminal pads. Often integral to the HV coil package on GEAFOL / RESIBLOC / SGB units.",
        [0, 12, 10], { toggle: "hv", id: "delta-links", label: "Delta links" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        for (var k = 0; k < 5; k++) {
          var peg = cyl(0.35, 0.35, 1.4, MAT.copper);
          peg.rotation.z = Math.PI / 2;
          peg.position.set(x + 7.6, 20 - k * 1.2, 0);
          g.add(peg);
        }
        add(g, box(0.3, 5.2, 0.25, MAT.copperL), x + 8.3, 17.6, 0);
      });
      reg(g, "Off-circuit tap links",
        "Bolted DETC links on the HV cast coil (±2×2.5% typical). OLTC is rare indoors — Hitachi/Siemens/SGB quote off-circuit taps as default. Usually integral to the HV cast-coil package.",
        [14, 0, 0], { toggle: "hv", id: "tap-links", label: "Tap links" });
    }

    /* ---- TERMINALS / SENSORS ---- */
    {
      var g = new THREE.Group();
      [-12, 0, 12].forEach(function (x) {
        add(g, box(1.6, 7, 0.5, MAT.copperL), x, 33, -3.4);
      });
      add(g, box(4, 2.6, 1.4, MAT.steelDk), 19.5, 9, 7.8);
      add(g, box(3.4, 2.0, 0.2, MAT.steelLt), 19.5, 9, 8.55);
      reg(g, "LV terminals + PT100 marshalling box",
        "LV bus stubs for busduct/cable. PT100s in LV ducts (3+spare) feed alarm/trip/AF stages — mandatory GEAFOL/RESIBLOC/SGB practice. Source sensors, relay and marshalling as a bought-in package.",
        [0, 14, -8], { toggle: "terminals", id: "lv-terminals", label: "LV terminals" });
    }
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        add(g, cyl(0.7, 0.9, 5, MAT.resinIn), x, 36, 6);
        add(g, box(1.8, 1.2, 1.8, MAT.copper), x, 39, 6);
      });
      reg(g, "HV epoxy terminals",
        "Epoxy HV terminals for cable or bus — top/side exit options on Siemens/Hitachi/SGB indoor packages. Specify connection style early; it drives enclosure and terminal BOM.",
        [0, 20, 8], { toggle: "terminals", id: "hv-terminals", label: "HV terminals" });
    }
    {
      var g = new THREE.Group();
      add(g, box(3.2, 4.0, 2.2, MAT.cabinet), 22, 18, -8);
      add(g, box(2.6, 3.2, 0.25, MAT.steelLt), 22, 18, -6.85);
      add(g, cyl(0.35, 0.35, 1.2, MAT.orange), 22, 20.6, -8);
      add(g, cyl(0.28, 0.28, 4, MAT.steelDk), 20, 14, -6);
      reg(g, "Winding temperature relay",
        "Electronic / electromechanical temperature relay driven by PT100s — alarm, trip and AF fan staging. Standard accessory on GEAFOL / RESIBLOC / SGB indoor fleets. Source with sensors as a protection package.",
        [16, 4, -10], { toggle: "controls", id: "temp-relay", label: "Temp relay" });
    }

    /* ---- COOLING / ENCLOSURE ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        var f = cyl(2.4, 2.4, 1.2, MAT.steelDk);
        f.rotation.x = Math.PI / 2;
        f.position.set(x, 3.2, 10.2);
        g.add(f);
        var fr = torus(2.4, 0.22, MAT.steelDk);
        fr.position.set(x, 3.2, 10.8);
        g.add(fr);
        var bl = new THREE.Group();
        for (var k = 0; k < 4; k++) {
          var blade = box(1.8, 0.14, 0.6, MAT.steelLt);
          blade.rotation.y = k * Math.PI / 2;
          blade.rotation.x = 0.45;
          blade.position.set(Math.cos(k * Math.PI / 2) * 1.0, 0, Math.sin(k * Math.PI / 2) * 1.0);
          bl.add(blade);
        }
        bl.position.set(x, 3.2, 10.5);
        g.add(bl);
        fans.push(bl);
      });
      reg(g, "Cross-flow fans (AN → AF)",
        "Fan trays under coils add AF rating for peaks — staged by the PT100 temperature relay. Standard option on GEAFOL / RESIBLOC / SGB. Source by airflow, IP and noise class.",
        [0, -16, 14], { toggle: "cooling", id: "fans", label: "Fans" });
    }
    {
      var g = new THREE.Group();
      add(g, box(48, 38, 26, MAT.enclosure), 0, 17.5, 0);
      for (var i = 0; i < 5; i++) {
        add(g, box(10, 0.7, 0.4, MAT.steelDk), -17, 5 + i * 2.4, 13.2);
        add(g, box(10, 0.7, 0.4, MAT.steelDk), 17, 5 + i * 2.4, 13.2);
      }
      for (var j = 0; j < 4; j++) {
        add(g, box(8, 0.55, 0.35, MAT.steelDk), 0, 30 + j * 1.6, 13.2);
      }
      reg(g, "Ventilated enclosure (IP21/23/31)",
        "IP21–IP33 ventilated housing as on Siemens/Hitachi/SGB indoor CRTs. ≥0.25 m² free inlet+outlet per 10 kW loss. Strong local-content fab opportunity — source louvre panels, interlocks and gland plates. Opacity slider reveals the active part.",
        [0, -32, 0], { toggle: "enclosure", id: "enclosure", label: "Enclosure" });
    }

    /* ---- PADS / LIFTING / PLATE ---- */
    {
      var g = new THREE.Group();
      limbX.forEach(function (x) {
        [5.6, -5.6].forEach(function (z) {
          add(g, box(2.2, 1.2, 1.6, MAT.rubber), x, 7.1, z);
        });
      });
      reg(g, "Resilient coil-support pads",
        "Silicone-rubber pads let cast coils expand thermally — standard on RESIBLOC / GEAFOL / SGB. Missing pads → coil cracks years later. Small high-volume sourced part for CRT fleets.",
        [0, -6, 8], { toggle: "core", id: "pads", label: "Resilient pads" });
    }
    {
      var g = new THREE.Group();
      [-15, 15].forEach(function (x) {
        var eye = torus(1.1, 0.3, MAT.steelDk);
        eye.position.set(x, 34.6, 0);
        g.add(eye);
      });
      reg(g, "Lifting eyes",
        "Lift only by the top-frame eyes — slinging around the coils cracks resin. Rated for the full shipping mass including enclosure. GEAFOL / RESIBLOC / SGB handling instruction #1.",
        [0, 22, 0], { toggle: "frame", id: "lifting-eyes", label: "Lifting eyes" });
    }
    {
      var g = new THREE.Group();
      add(g, box(3.4, 4.2, 0.22, MAT.steelDk), 16, 16, 9.2);
      add(g, box(2.9, 3.7, 0.1, MAT.glass), 16, 16, 9.36);
      reg(g, "Rating plate",
        "Stainless rating plate carries the IEC 60076-11 class string (e.g. E2 C2 F1) alongside kVA, voltages, vector group and masses — that three-class code is the unit’s environmental passport.",
        [14, 0, 12], { toggle: "frame", id: "rating-plate", label: "Rating plate" });
    }

    if (typeof engine.setOnTick === "function") {
      engine.setOnTick(function (dt) {
        fans.forEach(function (f) {
          if (f.parent && f.parent.visible !== false) f.rotation.y += dt * 8;
        });
      });
    }

    engine._tpFans = fans;
    return {
      parts: engine.parts,
      fans: fans,
      setEnclosureOpacity: function (v) {
        MAT.enclosure.opacity = Math.max(0.02, Math.min(1, v));
        MAT.enclosure.transparent = MAT.enclosure.opacity < 0.98;
        MAT.enclosure.depthWrite = MAT.enclosure.opacity > 0.55;
      },
      materials: MAT
    };
  }

  root.TPCastResinAssembly = { build: build };
})(typeof window !== "undefined" ? window : globalThis);
