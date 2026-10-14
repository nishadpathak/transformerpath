/**
 * MV current transformer (oil or cast-resin) assembly for TransformerPath.
 * Every accessory is its own clickable / sourceable part.
 * Usage: TPCTAssembly.build(engine) where engine is from TP3D.bootstrap(...)
 */
(function (root) {
  "use strict";

  function build(engine, opts) {
    opts = opts || {};
    var THREE = engine.THREE || root.THREE;
    var reg = engine.reg.bind(engine);

    var MAT = {
      steel: mat(0x7a8796, 0.35, 0.85),
      steelDk: mat(0x4a5562, 0.4, 0.8),
      steelLt: mat(0x9aa8b8, 0.4, 0.7),
      copper: mat(0xb87333, 0.32, 0.85),
      copperL: mat(0xd4a574, 0.35, 0.7),
      core: mat(0x3a4a3a, 0.55, 0.4),
      box: mat(0x2c3a4a, 0.55, 0.5),
      red: mat(0xc0392b, 0.5, 0.3),
      orange: mat(0xe8732a, 0.5, 0.3),
      oil: new THREE.MeshStandardMaterial({
        color: 0xc9a227, roughness: 0.2, metalness: 0,
        transparent: true, opacity: 0.35, depthWrite: false
      }),
      paper: new THREE.MeshStandardMaterial({
        color: 0xe8d9a8, roughness: 0.85, metalness: 0,
        transparent: true, opacity: 0.55, depthWrite: false
      }),
      resin: new THREE.MeshStandardMaterial({
        color: 0xb14a38, roughness: 0.3, metalness: 0.08,
        transparent: true, opacity: 0.55, depthWrite: false
      }),
      enclosure: new THREE.MeshStandardMaterial({
        color: 0xd5dde6, roughness: 0.28, metalness: 0.08,
        transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false
      })
    };

    function mat(c, r, m) {
      return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    }
    function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
    function cyl(rt, rb, h, m, seg) {
      return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 32), m);
    }
    function torus(r, t, m, a1, a2) {
      return new THREE.Mesh(new THREE.TorusGeometry(r, t, a1 || 16, a2 || 48), m);
    }
    function add(g, mesh, x, y, z, rx, ry, rz) {
      mesh.position.set(x || 0, y || 0, z || 0);
      if (rx) mesh.rotation.x = rx;
      if (ry) mesh.rotation.y = ry;
      if (rz) mesh.rotation.z = rz;
      g.add(mesh);
      return mesh;
    }

    /* ---- MOUNTING BASE / TANK ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(10, 10, 18, MAT.steelDk), 0, 9, 0);
      add(g, box(22, 2, 16, MAT.steel), 0, 1, 0);
      [[-8, 5], [8, 5], [-8, -5], [8, -5]].forEach(function (xz) {
        add(g, box(2.2, 1.2, 2.2, MAT.steel), xz[0], 0.6, xz[1]);
      });
      add(g, box(18, 1.2, 2.4, MAT.steelLt), 0, 0.4, 0);
      reg(g, "Mounting base & oil tank",
        "Oil-filled steel tank and base frame for outdoor HV / MV CTs (Hitachi Energy, Siemens Energy, Arteche class). Indoor MV resin CTs use a similar mounting pedestal without the oil volume. Footprint and foundation bolts are RFQ items.",
        [0, -18, 0], { toggle: "housing", id: "base", label: "Mounting base" });
    }

    /* ---- HOUSING / PORCELAIN ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(5.2, 6.2, 28, MAT.enclosure), 0, 36, 0);
      for (var i = 0; i < 10; i++) {
        var sh = torus(7.2 - i * 0.12, 0.85, MAT.enclosure);
        sh.rotation.x = Math.PI / 2;
        sh.position.y = 24 + i * 2.6;
        g.add(sh);
      }
      add(g, cyl(4.5, 4.5, 2.2, MAT.steel), 0, 51, 0);
      reg(g, "Housing / porcelain insulator",
        "Porcelain or composite housing sets outdoor creepage. Pollution/creepage class is a climate-driven sourced spec on Hitachi/Siemens/Arteche outdoor CTs. Indoor MV designs use epoxy or cast-resin housings instead.",
        [0, 20, 0], { toggle: "housing", id: "housing", label: "Housing" });
    }

    /* ---- INSULATION ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(8.5, 8.5, 16, MAT.oil), 0, 9, 0);
      add(g, cyl(6.4, 6.4, 22, MAT.paper), 0, 28, 0);
      for (var i = 0; i < 4; i++) {
        var scrMat = MAT.paper.clone();
        scrMat.opacity = 0.35;
        add(g, cyl(5.2 + i * 0.35, 5.2 + i * 0.35, 18 - i * 2, scrMat), 0, 30, 0);
      }
      add(g, cyl(7.0, 7.0, 12, MAT.resin), 0, 16, 0);
      reg(g, "Insulation (oil-paper / cast resin)",
        "Oil-paper insulation for outdoor HV CTs, or cast resin / epoxy for indoor MV. Grading screens control the field — same process split Hitachi/Siemens instrument-transformer plants use. Specify oil vs resin early; it drives housing and expansion design.",
        [14, 0, 0], { toggle: "insulation", id: "insulation", label: "Insulation" });
    }

    /* ---- MAGNETIC CORE ---- */
    {
      var g = new THREE.Group();
      var c1 = torus(5.5, 1.35, MAT.core, 18, 64);
      c1.rotation.x = Math.PI / 2;
      c1.position.y = 14;
      g.add(c1);
      var c2 = torus(5.5, 1.2, MAT.core, 18, 64);
      c2.rotation.x = Math.PI / 2;
      c2.position.y = 17.2;
      g.add(c2);
      reg(g, "Magnetic core",
        "Toroidal CRGO or nanocrystalline cores for metering and protection. Accuracy class (0.2s, 5P20…) is set here — the magnetic heart of the CT. Multi-core stacks are common on MV/HV units.",
        [-16, 0, 0], { toggle: "core", id: "core", label: "Core" });
    }

    /* ---- SECONDARY WINDING ---- */
    {
      var g = new THREE.Group();
      var s1 = torus(5.5, 0.55, MAT.copper, 12, 64);
      s1.rotation.x = Math.PI / 2;
      s1.position.y = 14;
      g.add(s1);
      var s2 = torus(5.5, 0.5, MAT.copperL, 12, 64);
      s2.rotation.x = Math.PI / 2;
      s2.position.y = 17.2;
      g.add(s2);
      reg(g, "Secondary winding",
        "Multi-ratio secondary windings (1 A / 5 A) with IEC 61869 accuracy classes. Specify ratios, burden (VA) and class when sourcing. Secondary circuits must never open under load.",
        [-18, 4, 0], { toggle: "secondary", id: "secondary", label: "Secondary" });
    }

    /* ---- PRIMARY ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(1.4, 1.4, 48, MAT.copper), 0, 28, 0);
      var turn = torus(4.2, 0.55, MAT.copperL, 12, 48);
      turn.rotation.x = Math.PI / 2;
      turn.position.y = 15.5;
      g.add(turn);
      reg(g, "Primary bar / winding",
        "Primary bar (bar-primary) or wound primary on MV designs. On bushing CTs the bushing stem is the primary — source CT rings by ID/OD and ratio. Primary continuous current and short-time rating set the copper section.",
        [0, 24, 0], { toggle: "primary", id: "primary", label: "Primary" });
    }
    {
      var g = new THREE.Group();
      add(g, box(3.2, 2.2, 6, MAT.copperL), 0, 56, 0);
      add(g, box(3.2, 2.2, 6, MAT.copperL), 0, 4, 0);
      add(g, cyl(2.2, 2.2, 1.2, MAT.steel), 0, 58, 0);
      add(g, cyl(2.2, 2.2, 1.2, MAT.steel), 0, 2.2, 0);
      add(g, box(4.5, 0.6, 4.5, MAT.steelDk), 0, 59.2, 0);
      add(g, box(4.5, 0.6, 4.5, MAT.steelDk), 0, 1.0, 0);
      reg(g, "Primary terminals",
        "Top and bottom primary terminals / pads for busbar or cable lug connection. Palm size, hole pattern and plating (tin / silver) are RFQ details on MV CTs.",
        [0, 28, 8], { toggle: "primary", id: "primary-terminals", label: "P1 / P2" });
    }

    /* ---- CAP / EXPANSION (OIL) ---- */
    {
      var g = new THREE.Group();
      add(g, cyl(3.8, 3.8, 4.5, MAT.steel), 0, 53.5, 0);
      add(g, cyl(4.2, 4.2, 0.8, MAT.steelDk), 0, 56.0, 0);
      add(g, cyl(1.6, 1.6, 2.2, MAT.steelLt), 0, 57.4, 0);
      var bellows = cyl(3.2, 3.2, 2.4, MAT.steelLt);
      bellows.position.set(0, 54.2, 0);
      g.add(bellows);
      for (var k = 0; k < 4; k++) {
        var ring = torus(3.3, 0.18, MAT.steelDk);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 53.2 + k * 0.55;
        g.add(ring);
      }
      add(g, cyl(0.9, 0.9, 1.0, MAT.orange), 2.8, 55.5, 0);
      reg(g, "Oil expansion cap / bellows",
        "Metallic bellows or expansion cap on oil-filled CTs accommodates oil volume change with temperature and keeps the active part sealed. Not fitted on cast-resin MV CTs — oil vs resin is a first-order sourcing decision.",
        [0, 30, 0], { toggle: "housing", id: "expansion-cap", label: "Expansion cap" });
    }

    /* ---- SECONDARY TERMINAL BOX ---- */
    {
      var g = new THREE.Group();
      add(g, box(8, 6, 5, MAT.box), 12, 6, 0);
      add(g, box(7.2, 5.2, 0.3, MAT.steelDk), 12, 6, 2.7);
      for (var i = 0; i < 4; i++) {
        var t = cyl(0.35, 0.35, 1.2, MAT.copper);
        t.rotation.z = Math.PI / 2;
        t.position.set(16.2, 4.5 + i * 1.1, 0);
        g.add(t);
      }
      add(g, box(1.6, 0.25, 0.25, MAT.red), 16.8, 5.5, 0);
      reg(g, "Secondary terminal box",
        "Secondary terminal board with mandatory shorting links — a non-negotiable utility safety requirement worldwide. Glands, earthing stud and IP rating are part of the sourced accessory kit.",
        [16, -4, 0], { toggle: "terminals", id: "sec-box", label: "Terminal box" });
    }

    /* ---- NAMEPLATE ---- */
    {
      var g = new THREE.Group();
      add(g, box(5, 3.2, 0.2, MAT.steelDk), 0, 8, 10.2);
      add(g, box(4.4, 2.6, 0.08, MAT.steelLt), 0, 8, 10.35);
      reg(g, "Nameplate",
        "Stainless nameplate: ratio, accuracy class, burden, rated voltage, insulation level and serial. IEC 61869 marking is the CT’s identity for metering audits and protection settings.",
        [0, -8, 14], { toggle: "housing", id: "nameplate", label: "Nameplate" });
    }

    return {
      parts: engine.parts,
      setEnclosureOpacity: function (v) {
        MAT.enclosure.opacity = Math.max(0.08, Math.min(1, v));
        MAT.enclosure.transparent = MAT.enclosure.opacity < 0.98;
        MAT.enclosure.depthWrite = MAT.enclosure.opacity > 0.55;
      },
      materials: MAT
    };
  }

  root.TPCTAssembly = { build: build };
})(typeof window !== "undefined" ? window : globalThis);
