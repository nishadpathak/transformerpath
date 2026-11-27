(function () {
  'use strict';

  const get = (id) => document.getElementById(id);
  const form = get('placement-form');
  const part = get('part');
  const slot = get('slot');
  const diagram = get('diagram');
  const model = get('model');
  const viewStatus = get('view-status');
  const toggle = get('view-toggle');
  const reset = get('reset');
  const place = get('place');
  const cut = get('cutaway');
  const feedback = get('placement-feedback');
  const registry = {
    cylinder: { number: 1, xy: [39.6, 65], role: 'It supports and insulates the inner winding on the core side.' },
    barrier: { number: 2, xy: [21.5, 52], role: 'It forms a separate solid insulation barrier between the windings.' },
    disc: { number: 3, xy: [8.5, 34.5], role: 'It separates adjacent discs while allowing oil to flow through the spaces between spacers.' },
    duct: { number: 4, xy: [17.7, 70], role: 'It runs along the winding height and helps keep the axial oil channel open.' },
    ring: { number: 5, xy: [11, 13.6], role: 'It represents insulation and support at the axial end of the winding stack.' },
  };
  const keys = Object.keys(registry);
  const matched = new Set();
  const anchors = {};
  const overlays = {};
  const names = {};
  const slots = {};
  let renderer = null;
  let loading = false;
  let mode = '2d';
  let showCutaway = true;
  let loadToken = 0;
  let scripts = null;
  let azimuth = .33;

  for (const option of part.options) if (option.value) names[option.value] = option.text;
  for (const option of slot.options) if (option.value) slots[option.value] = option.text;

  // Markers supplement the native slot picker; neither vision nor precision pointing is required.
  function makeMarker(key) {
    const button = document.createElement('button');
    const text = document.createElement('span');
    button.type = 'button';
    button.className = 'marker';
    button.dataset.marker = key;
    button.append(text);
    button.addEventListener('click', (event) => {
      if (matched.size === keys.length) return;
      slot.value = key;
      update();
      say('Selected slot ' + slots[key] + (matched.has(key) ? ' (already matched).' : '. Pick a part, then check placement.'));
      if (event.detail === 0) slot.focus();
    });
    return button;
  }

  keys.forEach((key) => {
    const node = makeMarker(key);
    node.style.left = registry[key].xy[0] + '%';
    node.style.top = registry[key].xy[1] + '%';
    get('diagram-markers').append(node);
    anchors[key] = node;
  });

  function say(text, result) {
    feedback.dataset.result = result || '';
    feedback.textContent = text;
  }

  function updateMarker(key, marker) {
    if (!marker) return;
    const complete = matched.has(key);
    marker.dataset.complete = String(complete);
    marker.firstChild.textContent = registry[key].number + (complete ? '✓' : '');
    marker.setAttribute('aria-label', 'Slot ' + slots[key] + (complete ? ', matched with ' + names[key] : ''));
    marker.setAttribute('aria-pressed', String(slot.value === key));
    marker.disabled = matched.size === keys.length;
  }

  function update() {
    const complete = matched.size === keys.length;
    get('score').textContent = matched.size + ' of ' + keys.length;
    get('progress').max = keys.length;
    get('progress').value = matched.size;
    reset.disabled = !matched.size;
    place.disabled = part.disabled = slot.disabled = complete;
    for (const item of part.options) {
      if (item.value) {
        item.disabled = matched.has(item.value);
        item.textContent = names[item.value] + (item.disabled ? ' (placed)' : '');
      }
    }
    keys.forEach((key) => {
      diagram.querySelector('[data-installed="' + key + '"]').toggleAttribute('hidden', !matched.has(key));
      get('clue-list').querySelector('[data-slot-ref="' + key + '"] [data-clue-match]').textContent =
        matched.has(key) ? '✓ ' + names[key] : '';
      updateMarker(key, anchors[key]);
      updateMarker(key, overlays[key]);
    });
    paint();
  }

  slot.addEventListener('change', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const chosen = part.value;
    const target = slot.value;
    if (!registry[chosen] || !registry[target]) return;
    if (matched.has(target)) {
      say('Slot ' + registry[target].number + ' already holds the ' + names[target].toLowerCase() + '. Choose an open slot.', 'retry');
      slot.focus();
      return;
    }
    if (chosen !== target) {
      say('Not in this slot. Compare what the ' + names[chosen].toLowerCase() + ' does with the slot clues below.', 'retry');
      return;
    }
    matched.add(chosen);
    part.value = '';
    slot.value = '';
    update();
    const complete = matched.size === keys.length;
    say('Placed: ' + names[chosen] + '. ' + registry[chosen].role +
      (complete ? ' All five parts are in place. Try the 3D cutaway or start over.' : ''), 'correct');
    (complete ? reset : part).focus();
  });

  reset.addEventListener('click', () => {
    matched.clear();
    form.reset();
    update();
    say('Lab reset. Pick any part to start again.');
    part.focus();
  });

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        script.remove();
        reject(Error('3D script timeout'));
      }, 10000);
      script.src = src;
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(Error('3D script missing')); };
      document.head.append(script);
    });
  }

  function paint() {
    if (!renderer || mode !== '3d' || model.hidden) return;
    try {
      renderer.draw({ azimuth, cutaway: showCutaway, matched, selected: slot.value });
    } catch (error) {
      fallBack('3D stopped. Your placements are still here in the 2D schematic.');
    }
  }

  function changeView(next) {
    const oldControl = document.activeElement;
    mode = next;
    const active = next === '3d';
    diagram.hidden = active;
    model.hidden = !active;
    get('view-controls').hidden = !active;
    toggle.setAttribute('aria-pressed', String(active));
    toggle.textContent = active ? 'Back to 2D' : 'View in 3D';
    get('view-label').textContent = active ? '3D view · section is not to scale' : '2D cutaway · section is not to scale';
    if (!active && oldControl && (model.contains(oldControl) || get('view-controls').contains(oldControl))) toggle.focus();
    paint();
  }

  function fallBack(message) {
    const previous = renderer;
    renderer = null;
    changeView('2d');
    if (previous) previous.dispose();
    model.replaceChildren();
    Object.keys(overlays).forEach((key) => delete overlays[key]);
    viewStatus.textContent = message;
  }

  toggle.addEventListener('click', async () => {
    if (mode === '3d') {
      viewStatus.textContent = '';
      changeView('2d');
      return;
    }
    if (loading) {
      loading = false;
      loadToken++;
      toggle.textContent = 'View in 3D';
      viewStatus.textContent = '';
      return;
    }
    if (renderer) {
      viewStatus.textContent = '';
      changeView('3d');
      return;
    }
    const request = ++loadToken;
    loading = true;
    toggle.textContent = 'Cancel 3D';
    viewStatus.textContent = 'Loading optional 3D. You can keep matching in 2D.';
    try {
      if (!scripts) {
        scripts = (window.TPWebGL ? Promise.resolve() : loadScript('/tp-webgl-gate.js'))
          .then(() => {
            if (!window.TPWebGL || !window.TPWebGL.detect().ok) throw Error('WebGL unavailable');
            return window.THREE ? null : loadScript('/vendor/three.min.js');
          }).then(() => window.TPInsulation3D ? null : loadScript('./lab-3d.js'));
        scripts.catch(() => { scripts = null; });
      }
      await scripts;
      if (request !== loadToken) return;
      const markerGroup = document.createElement('div');
      markerGroup.className = 'markers';
      markerGroup.setAttribute('role', 'group');
      markerGroup.setAttribute('aria-label', '3D placement markers');
      keys.forEach((key) => { overlays[key] = makeMarker(key); markerGroup.append(overlays[key]); });
      // The canvas itself is decorative; the focusable native markers are not.
      model.removeAttribute('aria-hidden');
      renderer = window.TPInsulation3D.create(model, markerGroup, overlays, {
        lost: () => fallBack('3D graphics were interrupted. Continue in 2D or try 3D again.'),
        resize: paint,
      });
      viewStatus.textContent = '';
      changeView('3d');
      update();
    } catch (error) {
      if (request !== loadToken) return;
      fallBack('3D is unavailable. The same challenge works in this 2D schematic.');
    } finally {
      if (request === loadToken) loading = false;
    }
  });

  get('rotate-left').addEventListener('click', () => { azimuth += Math.PI / 6; paint(); });
  get('rotate-right').addEventListener('click', () => { azimuth -= Math.PI / 6; paint(); });
  get('reset-camera').addEventListener('click', () => {
    azimuth = .33;
    showCutaway = true;
    cut.setAttribute('aria-pressed', 'true');
    viewStatus.textContent = '';
    paint();
  });
  cut.addEventListener('click', () => {
    showCutaway = !showCutaway;
    cut.setAttribute('aria-pressed', String(showCutaway));
    viewStatus.textContent = showCutaway ? '' : 'Exterior view. Open the cutaway to see the inner placement markers again.';
    paint();
  });
  form.hidden = false;
  toggle.hidden = false;
  update();
}());
