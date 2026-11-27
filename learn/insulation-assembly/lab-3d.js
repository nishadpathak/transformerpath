(function () {
  'use strict';

  const TWO_PI = Math.PI * 2;
  const FRONT = -Math.PI / 2;
  const HALF_CUT = Math.PI * .34;
  const TAU = 1e-6;
  const anchors = {
    cylinder: [1.09, -.96, FRONT + HALF_CUT],
    barrier: [2.03, .12, FRONT + HALF_CUT],
    disc: [2.66, .77, FRONT + HALF_CUT],
    duct: [2.22, -.87, FRONT - HALF_CUT],
    ring: [2.79, 1.97, FRONT - HALF_CUT],
  };

  // Preserve the exact anchor when possible. Move only the button, with a visible
  // leader back to the projected feature. The 44px hit areas get 8px of air.
  function separateMarkers(points, w, h) {
    const inset = 27;
    const step = 52;
    const placed = [];
    const clamp = (n, limit) => Math.round(Math.max(inset, Math.min(limit - inset, n)));
    for (const point of points) {
      const x = clamp(point.x, w), y = clamp(point.y, h);
      const clear = (a, b) => placed.every(p => Math.abs(p.x - a) >= step || Math.abs(p.y - b) >= step);
      let best = clear(x, y) ? { x, y } : null;
      if (!best) {
        let distance = Infinity;
        const candidatesX = [x, inset, w - inset];
        const candidatesY = [y, inset, h - inset];
        placed.forEach(p => {
          candidatesX.push(p.x - step, p.x + step);
          candidatesY.push(p.y - step, p.y + step);
        });
        for (const a of candidatesX) for (const b of candidatesY) {
          if (a < inset || b < inset || a > w - inset || b > h - inset || !clear(a, b)) continue;
          const cost = (a - point.x) ** 2 + (b - point.y) ** 2;
          if (cost < distance) { distance = cost; best = { x: a, y: b }; }
        }
      }
      placed.push(best || { x, y });
    }
    return placed;
  }

  function create(container, markerGroup, markers, callbacks) {
    const T = window.THREE;
    const svgNS = 'http://www.w3.org/2000/svg';
    const leaders = document.createElementNS(svgNS, 'svg');
    leaders.setAttribute('class', 'marker-leaders');
    leaders.setAttribute('aria-hidden', 'true');
    leaders.setAttribute('focusable', 'false');
    markerGroup.prepend(leaders);
    const result = window.TPWebGL.createRenderer(T, { powerPreference: 'low-power' });
    if (!result.ok) throw Error(result.reason);
    const gpu = result.renderer;
    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-5, 5, 4, -4, .1, 60);
    gpu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    if (T.sRGBEncoding !== undefined) gpu.outputEncoding = T.sRGBEncoding;
    scene.background = new T.Color(0x091627);
    scene.add(new T.HemisphereLight(0xfff2de, 0x759bc2, 1.15));
    const keyLight = new T.DirectionalLight(0xffffff, .74);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const fill = new T.DirectionalLight(0x9bcaff, .36);
    fill.position.set(-4, 1, -3);
    scene.add(fill);

    const cross = new T.Group();
    const exterior = new T.Group();
    const placedMeshes = {};
    const resources = new Set();
    const copper = material(0xc76b49);
    const violet = material(0x9c6ac6);
    const edge = material(0x506b8a);
    const core = material(0x496484);
    const installed = material(0xf7ae35);
    const focused = material(0xffd689, { emissive: 0x9e5715, emissiveIntensity: .45 });
    const ghost = material(0xf4c78b, { transparent: true, opacity: .13, depthWrite: false });
    const selected = material(0x66cfea, { transparent: true, opacity: .67, depthWrite: false, emissive: 0x366775 });
    const channel = material(0x86d8ff, { transparent: true, opacity: .08, depthWrite: false });
    const canvas = gpu.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.addEventListener('webglcontextlost', onLost);
    const sizes = { w: 0, h: 0 };
    let ro = null;
    let disposed = false;

    function material(color, opts) {
      const value = new T.MeshStandardMaterial(Object.assign({ color, roughness: .68 }, opts));
      resources.add(value);
      return value;
    }

    function onLost(event) {
      event.preventDefault();
      callbacks.lost();
    }

    // A ring sector with actual cut faces, not alpha-fading the outer winding.
    function sector(inner, outer, height, y, isCut) {
      const start = isCut ? FRONT + HALF_CUT : 0;
      const end = isCut ? FRONT + TWO_PI - HALF_CUT : TWO_PI - TAU;
      const shape = new T.Shape();
      if (!isCut) {
        shape.absarc(0, 0, outer, 0, TWO_PI, false);
        const opening = new T.Path();
        opening.absarc(0, 0, inner, 0, TWO_PI, true);
        shape.holes.push(opening);
      } else {
        shape.moveTo(outer * Math.cos(start), outer * Math.sin(start));
        shape.absarc(0, 0, outer, start, end, false);
        shape.lineTo(inner * Math.cos(end), inner * Math.sin(end));
        shape.absarc(0, 0, inner, end, start, true);
        shape.closePath();
      }
      const geometry = new T.ExtrudeGeometry(shape, { depth: height, curveSegments: 22, steps: 1, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, y - height / 2, 0);
      resources.add(geometry);
      return geometry;
    }

    function shell(group, mat, inner, outer, height, y, isCut) {
      const mesh = new T.Mesh(sector(inner, outer, height, y, isCut), mat);
      group.add(mesh);
      return mesh;
    }

    function brick(group, mat, dimensions, radius, height, angle) {
      const geometry = new T.BoxGeometry(dimensions[0], dimensions[1], dimensions[2]);
      resources.add(geometry);
      const mesh = new T.Mesh(geometry, mat);
      mesh.position.set(radius * Math.cos(angle), height, -radius * Math.sin(angle));
      mesh.rotation.y = angle;
      group.add(mesh);
      return mesh;
    }

    function addPart(key, mesh) {
      (placedMeshes[key] || (placedMeshes[key] = [])).push(mesh);
      mesh.userData.part = key;
    }

    try {
      const legGeometry = new T.CylinderGeometry(.87, .87, 4.49, 36);
      resources.add(legGeometry);
      scene.add(new T.Mesh(legGeometry, core));
      const baseGeometry = new T.CylinderGeometry(3.38, 3.47, .14, 48);
      resources.add(baseGeometry);
      const base = new T.Mesh(baseGeometry, edge);
      base.position.y = -2.4;
      scene.add(base);
      scene.add(cross, exterior);

      [[cross, true], [exterior, false]].forEach(([group, isCut]) => {
        [-1.32, -.44, .44, 1.32].forEach((y) => {
          shell(group, violet, 1.20, 1.89, .66, y, isCut);
          shell(group, copper, 2.39, 3.11, .66, y, isCut);
        });
        if (isCut) shell(group, channel, 2.09, 2.36, 3.30, -.03, true);
        addPart('cylinder', shell(group, ghost, 1.01, 1.12, 3.70, .01, isCut));
        addPart('barrier', shell(group, ghost, 1.99, 2.08, 3.72, .01, isCut));
        addPart('ring', shell(group, ghost, 2.39, 3.11, .18, 1.83, isCut));
        const first = isCut ? FRONT + HALF_CUT + .09 : FRONT;
        const sweep = isCut ? TWO_PI - 2 * HALF_CUT - .18 : TWO_PI - .9;
        for (let i = 0; i < 6; i++) {
          const angle = first + i * sweep / 5;
          addPart('disc', brick(group, ghost, [.62, .12, .135], 2.76, .88, angle));
          addPart('duct', brick(group, ghost, [.16, 3.25, .13], 2.30, -.025, angle));
        }
      });
      container.append(canvas, markerGroup);
      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(callbacks.resize);
        ro.observe(container);
      } else {
        window.addEventListener('resize', callbacks.resize);
      }
    } catch (error) {
      dispose();
      throw error;
    }

    function draw(state) {
      if (disposed) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      if (w !== sizes.w || h !== sizes.h) {
        sizes.w = w;
        sizes.h = h;
        const aspect = w / h;
        const vertical = Math.max(3.85, 4.5 / aspect);
        camera.left = -vertical * aspect;
        camera.right = vertical * aspect;
        camera.top = vertical;
        camera.bottom = -vertical;
        camera.updateProjectionMatrix();
        gpu.setSize(w, h, false);
      }
      camera.position.set(9 * Math.sin(state.azimuth), 5.4, 9 * Math.cos(state.azimuth));
      camera.lookAt(0, -.08, 0);
      camera.updateMatrixWorld();
      cross.visible = state.cutaway;
      exterior.visible = !state.cutaway;
      const points = [];
      Object.keys(placedMeshes).forEach((key) => {
        const isPlaced = state.matched.has(key);
        const isSelected = state.selected === key;
        placedMeshes[key].forEach((mesh) => {
          mesh.visible = state.cutaway || isPlaced;
          mesh.material = isPlaced ? (isSelected ? focused : installed) : (isSelected ? selected : ghost);
        });
        const marker = markers[key];
        // The markers describe the face of the opening. Don't float them over the back of the winding.
        marker.hidden = !state.cutaway || Math.cos(state.azimuth) < .54;
        if (!marker.hidden) {
          const [r, y, angle] = anchors[key];
          const point = new T.Vector3(r * Math.cos(angle), y, -r * Math.sin(angle)).project(camera);
          points.push({ marker, x: (point.x * .5 + .5) * w, y: (.5 - point.y * .5) * h });
        }
      });
      const positions = separateMarkers(points, w, h);
      leaders.replaceChildren();
      leaders.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      points.forEach((anchor, i) => {
        const location = positions[i];
        anchor.marker.style.left = location.x + 'px';
        anchor.marker.style.top = location.y + 'px';
        if (Math.hypot(location.x - anchor.x, location.y - anchor.y) < 15) return;
        const line = document.createElementNS(svgNS, 'line');
        const dot = document.createElementNS(svgNS, 'circle');
        line.setAttribute('x1', anchor.x); line.setAttribute('y1', anchor.y);
        line.setAttribute('x2', location.x); line.setAttribute('y2', location.y);
        dot.setAttribute('cx', anchor.x); dot.setAttribute('cy', anchor.y); dot.setAttribute('r', '2.5');
        leaders.append(line, dot);
      });
      gpu.render(scene, camera);
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', callbacks.resize);
      canvas.removeEventListener('webglcontextlost', onLost);
      for (const resource of resources) resource.dispose();
      gpu.dispose();
      if (gpu.forceContextLoss) gpu.forceContextLoss();
      canvas.remove();
      markerGroup.remove();
    }

    return { draw, dispose };
  }

  window.TPInsulation3D = { create };
}());
