/**
 * TransformerPath shared 3D explorer engine.
 * Orbit / pan / zoom / raycast pick / explode / labels / auto-rotate.
 * Requires THREE r128+ already on the page.
 */
(function (root) {
  "use strict";

  function bootstrap(container, opts) {
    opts = opts || {};
    if (!root.THREE) throw new Error("THREE.js required before TP3D");
    var THREE = root.THREE;

    var width = container.clientWidth || window.innerWidth;
    var height = container.clientHeight || window.innerHeight;

    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !!opts.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = opts.exposure != null ? opts.exposure : 1.05;
    }
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    var canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

    var bg = opts.bg != null ? opts.bg : 0x08121e;
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    if (opts.fog !== false) {
      scene.fog = new THREE.Fog(bg, opts.fogNear || 180, opts.fogFar || 520);
    }

    var camera = new THREE.PerspectiveCamera(opts.fov || 42, width / height, 0.4, 1200);
    var target = new THREE.Vector3(
      (opts.target && opts.target.x) || 0,
      (opts.target && opts.target.y) || 22,
      (opts.target && opts.target.z) || 0
    );
    var sph = {
      r: opts.distance != null ? opts.distance : 130,
      th: opts.theta != null ? opts.theta : 0.85,
      ph: opts.phi != null ? opts.phi : 1.15
    };

    function applyCam() {
      sph.ph = Math.max(0.12, Math.min(Math.PI - 0.2, sph.ph));
      sph.r = Math.max(opts.minDistance || 36, Math.min(opts.maxDistance || 360, sph.r));
      camera.position.set(
        target.x + sph.r * Math.sin(sph.ph) * Math.sin(sph.th),
        target.y + sph.r * Math.cos(sph.ph),
        target.z + sph.r * Math.sin(sph.ph) * Math.cos(sph.th)
      );
      camera.lookAt(target);
    }
    applyCam();

    scene.add(new THREE.HemisphereLight(0xc5d8ec, 0x1a2838, 0.9));
    var sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(60, 90, 40);
    if (opts.shadows) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
    }
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0x8eb4d4, 0.35);
    fill.position.set(-50, 30, -40);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0x3a4d63, 0.25));

    if (opts.ground !== false) {
      var ground = new THREE.Mesh(
        new THREE.CircleGeometry(opts.groundSize || 240, 64),
        new THREE.MeshStandardMaterial({ color: 0x101e2e, roughness: 0.95, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = opts.groundY != null ? opts.groundY : -2;
      ground.receiveShadow = !!opts.shadows;
      scene.add(ground);
      var grid = new THREE.GridHelper(opts.groundSize || 240, 48, 0x254562, 0x16293d);
      grid.position.y = ground.position.y + 0.05;
      scene.add(grid);
    }

    var modelRoot = new THREE.Group();
    scene.add(modelRoot);

    var parts = [];
    var meshIndex = new Map();
    var selected = null;
    var explodeT = 0;
    var labelsOn = !!opts.labels;
    var autoRotate = false;
    var labelEls = [];
    var onSelect = opts.onSelect || null;
    var onTick = opts.onTick || null;
    var running = true;
    var dragging = false;

    function toVec3(v) {
      if (v instanceof THREE.Vector3) return v.clone();
      if (Array.isArray(v)) return new THREE.Vector3(v[0] || 0, v[1] || 0, v[2] || 0);
      if (v && typeof v === "object") return new THREE.Vector3(v.x || 0, v.y || 0, v.z || 0);
      return new THREE.Vector3();
    }

    function reg(group, name, desc, explode, meta) {
      meta = meta || {};
      group.name = name;
      modelRoot.add(group);
      var base = group.position.clone();
      var part = {
        root: group,
        name: name,
        desc: desc || "",
        explode: toVec3(explode),
        base: base,
        toggle: meta.toggle || null,
        id: meta.id || null,
        label: meta.label !== undefined ? meta.label : name
      };
      parts.push(part);
      group.traverse(function (o) {
        if (o.isMesh) {
          meshIndex.set(o, part);
          o.castShadow = !!opts.shadows;
          o.receiveShadow = !!opts.shadows;
        }
      });
      if (part.label) {
        var el = document.createElement("div");
        el.className = "tp3d-lbl";
        el.textContent = part.label;
        el.style.display = "none";
        el.addEventListener("click", function (e) {
          e.stopPropagation();
          selectPart(part);
        });
        (opts.labelHost || document.body).appendChild(el);
        labelEls.push({ el: el, part: part });
      }
      return part;
    }

    function setExplode(t) {
      explodeT = Math.max(0, Math.min(1, +t || 0));
      parts.forEach(function (p) {
        p.root.position.copy(p.base).addScaledVector(p.explode, explodeT);
        p.root.children.forEach(function (ch) {
          if (ch.userData && ch.userData.exDir) {
            if (!ch.userData.baseP) ch.userData.baseP = ch.position.clone();
            ch.position.copy(ch.userData.baseP).addScaledVector(ch.userData.exDir, explodeT);
          }
        });
      });
    }

    function setToggle(key, on) {
      parts.forEach(function (p) {
        if (p.toggle === key) p.root.visible = !!on;
      });
    }

    function setEmissive(part, on) {
      if (!part) return;
      part.root.traverse(function (o) {
        if (!o.isMesh || !o.material || o.material.emissive === undefined) return;
        if (on) {
          if (!o.userData._tpMat) {
            o.userData._tpMat = o.material;
            o.material = o.material.clone();
          }
          o.material.emissive = new THREE.Color(0x2f7cc4);
          o.material.emissiveIntensity = 0.75;
        } else if (o.userData._tpMat) {
          o.material.dispose();
          o.material = o.userData._tpMat;
          delete o.userData._tpMat;
        }
      });
    }

    function selectPart(part) {
      if (selected) setEmissive(selected, false);
      selected = part || null;
      if (selected) setEmissive(selected, true);
      if (typeof onSelect === "function") onSelect(selected);
      return selected;
    }

    function clearSelection() {
      return selectPart(null);
    }

    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var panning = false;
    var lastX = 0;
    var lastY = 0;
    var moved = 0;

    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("pointerdown", function (e) {
      dragging = true;
      moved = 0;
      panning = e.button === 2 || e.shiftKey || e.button === 1;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = "grabbing";
      container.classList.add("dragging");
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (panning) {
        var s = sph.r / 700;
        var right = new THREE.Vector3().subVectors(camera.position, target).cross(camera.up).normalize();
        target.addScaledVector(right, -dx * s);
        target.y += dy * s;
      } else {
        sph.th -= dx * 0.0055;
        sph.ph -= dy * 0.0055;
      }
      applyCam();
    });
    canvas.addEventListener("pointerup", function (e) {
      dragging = false;
      canvas.style.cursor = "grab";
      container.classList.remove("dragging");
      if (moved < 6) pick(e);
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      sph.r *= 1 + Math.sign(e.deltaY) * 0.09;
      applyCam();
    }, { passive: false });

    var pinchD = 0;
    canvas.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) {
        pinchD = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", function (e) {
      if (e.touches.length === 2 && pinchD) {
        var d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        sph.r *= pinchD / d;
        pinchD = d;
        applyCam();
      }
    }, { passive: true });

    function pick(e) {
      var rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(modelRoot.children, true).filter(function (h) {
        var part = meshIndex.get(h.object);
        return h.object.visible && part && part.root.visible;
      });
      if (hits.length) selectPart(meshIndex.get(hits[0].object));
      else clearSelection();
    }

    function setLabels(on) { labelsOn = !!on; }
    function setAutoRotate(on) { autoRotate = !!on; }

    function resetView() {
      target.set(
        (opts.target && opts.target.x) || 0,
        (opts.target && opts.target.y) || 22,
        (opts.target && opts.target.z) || 0
      );
      sph.r = opts.distance != null ? opts.distance : 130;
      sph.th = opts.theta != null ? opts.theta : 0.85;
      sph.ph = opts.phi != null ? opts.phi : 1.15;
      setExplode(0);
      applyCam();
    }

    function findByName(name) {
      var n = String(name || "").toLowerCase();
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].name.toLowerCase() === n) return parts[i];
        if (parts[i].id && String(parts[i].id).toLowerCase() === n) return parts[i];
      }
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].name.toLowerCase().indexOf(n) !== -1) return parts[j];
      }
      return null;
    }

    var proj = new THREE.Vector3();
    var clock = new THREE.Clock();

    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      var dt = clock.getDelta();
      var now = performance.now();
      if (autoRotate && !dragging) {
        sph.th += 0.003;
        applyCam();
      }
      if (typeof onTick === "function") onTick(dt, now, api);
      renderer.render(scene, camera);
      labelEls.forEach(function (L) {
        if (!labelsOn || !L.part.root.visible) {
          L.el.style.display = "none";
          return;
        }
        proj.copy(L.part.base).addScaledVector(L.part.explode, explodeT);
        proj.y += 8;
        proj.project(camera);
        if (proj.z > 1) {
          L.el.style.display = "none";
          return;
        }
        L.el.style.display = "block";
        L.el.style.left = ((proj.x + 1) / 2) * window.innerWidth + "px";
        L.el.style.top = ((-proj.y + 1) / 2) * window.innerHeight + "px";
      });
    }
    frame();

    function onResize() {
      var w = container.clientWidth || window.innerWidth;
      var h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    function dispose() {
      running = false;
      window.removeEventListener("resize", onResize);
      labelEls.forEach(function (L) {
        if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el);
      });
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    var api = {
      scene: scene,
      camera: camera,
      renderer: renderer,
      root: modelRoot,
      parts: parts,
      THREE: THREE,
      reg: reg,
      setExplode: setExplode,
      getExplode: function () { return explodeT; },
      setToggle: setToggle,
      selectPart: selectPart,
      clearSelection: clearSelection,
      getSelected: function () { return selected; },
      setLabels: setLabels,
      setAutoRotate: setAutoRotate,
      resetView: resetView,
      findByName: findByName,
      applyCam: applyCam,
      sph: sph,
      target: target,
      setOnSelect: function (fn) { onSelect = fn; },
      setOnTick: function (fn) { onTick = fn; },
      dispose: dispose
    };
    return api;
  }

  root.TP3D = { bootstrap: bootstrap };
})(typeof window !== "undefined" ? window : globalThis);
