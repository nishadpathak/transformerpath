/**
 * tp-webgl-gate.js — WebGL capability + progressive-enhancement helpers.
 *
 * 3D enhances TransformerPath; it must never be required for the page to work.
 * States: INITIALIZING | LOADING_MODEL | READY | UNAVAILABLE | LOAD_FAILED | CONTEXT_LOST
 */
(function (root) {
  'use strict';
  if (root.TPWebGL) return;

  var DEFAULT_TIMEOUT_MS = 12000;
  var POSTER_SRC = 'media/power-transformer-3d-poster.jpg';

  function detectWebGL() {
    try {
      if (typeof document === 'undefined') return { ok: false, reason: 'no_document' };
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return { ok: false, reason: 'no_context' };
      return { ok: true, reason: 'ok', webgl2: !!c.getContext('webgl2') };
    } catch (e) {
      return { ok: false, reason: 'exception', error: String(e && e.message || e) };
    }
  }

  function createRenderer(THREE, opts) {
    opts = opts || {};
    var cap = detectWebGL();
    if (!cap.ok) {
      return { ok: false, reason: 'unavailable', detail: cap.reason, error: cap.error || null };
    }
    if (!THREE || !THREE.WebGLRenderer) {
      return { ok: false, reason: 'no_three' };
    }
    try {
      var renderer = new THREE.WebGLRenderer({
        antialias: opts.antialias !== false,
        alpha: !!opts.alpha,
        powerPreference: opts.powerPreference || 'high-performance',
        failIfMajorPerformanceCaveat: !!opts.failIfMajorPerformanceCaveat
      });
      // Some environments construct but leave a dead context
      var ctx = renderer.getContext && renderer.getContext();
      if (!ctx) {
        try { renderer.dispose(); } catch (e2) {}
        return { ok: false, reason: 'dead_context' };
      }
      return { ok: true, renderer: renderer, capability: cap };
    } catch (e) {
      return { ok: false, reason: 'constructor_threw', error: String(e && e.message || e) };
    }
  }

  function setState(el, state, detail) {
    if (!el) return;
    el.setAttribute('data-tp-3d-state', state);
    if (detail) el.setAttribute('data-tp-3d-detail', String(detail).slice(0, 120));
    try {
      root.dispatchEvent(new CustomEvent('tp-3d-state', { detail: { state: state, detail: detail || null, target: el } }));
    } catch (e) {}
  }

  function hideControls(rootEl) {
    if (!rootEl) return;
    var nodes = rootEl.querySelectorAll(
      '#ui, #panel, .btnrow, #help, #tourcap, [data-tp-3d-controls], .tp-3d-controls'
    );
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].hidden = true;
      nodes[i].setAttribute('aria-hidden', 'true');
      nodes[i].style.pointerEvents = 'none';
      nodes[i].style.opacity = '0.35';
      var inputs = nodes[i].querySelectorAll('input, button, select, textarea, a');
      for (var j = 0; j < inputs.length; j++) {
        if (inputs[j].tagName === 'A') {
          inputs[j].setAttribute('tabindex', '-1');
          inputs[j].setAttribute('aria-disabled', 'true');
        } else {
          inputs[j].disabled = true;
        }
      }
    }
  }

  function fallbackHTML(opts) {
    opts = opts || {};
    var title = opts.title || 'Interactive 3D is unavailable in this browser.';
    var body = opts.body || 'You can still explore TransformerPath’s engineering content and transformer components.';
    var poster = opts.poster || POSTER_SRC;
    var hint = opts.hint || 'WebGL may be disabled, blocked, or unsupported on this device.';
    var retry = opts.retry !== false;
    return (
      '<div class="tp-3d-fallback" role="status" aria-live="polite" style="position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;background:#07111c;color:#d7e0ea;font:500 0.95rem/1.45 system-ui,sans-serif">' +
        '<img src="' + poster + '" alt="Power transformer preview" width="640" height="360" style="max-width:min(640px,92%);width:100%;height:auto;border-radius:12px;border:1px solid rgba(255,255,255,.12);object-fit:cover" loading="eager">' +
        '<div style="max-width:36rem">' +
          '<div style="font-weight:800;font-size:1.05rem;color:#fff;margin-bottom:6px">' + title + '</div>' +
          '<div style="color:#9fb0c4">' + body + '</div>' +
          '<div style="color:#7f91a8;font-size:.8rem;margin-top:8px">' + hint + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">' +
          (retry ? '<button type="button" data-tp-3d-retry style="border:0;border-radius:999px;padding:10px 16px;background:#f5a623;color:#0d1b2e;font-weight:800;cursor:pointer">Retry 3D</button>' : '') +
          '<a href="academy.html" style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 16px;color:#fff;text-decoration:none;font-weight:700">Transformer Academy</a>' +
          '<a href="calculator.html" style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 16px;color:#fff;text-decoration:none;font-weight:700">Engineering Tools</a>' +
          '<a href="components.html" style="border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:10px 16px;color:#fff;text-decoration:none;font-weight:700">Transformer Components</a>' +
        '</div>' +
      '</div>'
    );
  }

  function showFallback(container, opts) {
    opts = opts || {};
    if (!container) return null;
    var existing = container.querySelector('.tp-3d-fallback');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.innerHTML = fallbackHTML(opts);
    var panel = wrap.firstChild;
    container.appendChild(panel);
    hideControls(opts.controlsRoot || document);
    setState(container, opts.state || 'UNAVAILABLE', opts.detail || null);
    var btn = panel.querySelector('[data-tp-3d-retry]');
    if (btn && typeof opts.onRetry === 'function') {
      btn.addEventListener('click', function () { opts.onRetry(); });
    } else if (btn) {
      btn.addEventListener('click', function () { location.reload(); });
    }
    return panel;
  }

  function ensurePoster(container, posterSrc) {
    if (!container) return null;
    var img = container.querySelector('[data-tp-3d-poster]');
    if (img) return img;
    img = document.createElement('img');
    img.setAttribute('data-tp-3d-poster', '1');
    img.src = posterSrc || POSTER_SRC;
    img.alt = 'Power transformer preview';
    img.width = 1280;
    img.height = 720;
    img.loading = 'eager';
    img.decoding = 'async';
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;background:#07111c';
    container.insertBefore(img, container.firstChild);
    return img;
  }

  function removePoster(container) {
    if (!container) return;
    var img = container.querySelector('[data-tp-3d-poster]');
    if (img) img.remove();
  }

  function bindContextLoss(renderer, container, opts) {
    opts = opts || {};
    if (!renderer || !renderer.domElement) return function () {};
    var canvas = renderer.domElement;
    function onLost(e) {
      try { e.preventDefault(); } catch (err) {}
      setState(container, 'CONTEXT_LOST', 'webglcontextlost');
      showFallback(container, {
        state: 'CONTEXT_LOST',
        title: '3D graphics were interrupted.',
        body: 'The WebGL context was lost. Reload 3D to try again, or continue with engineering content.',
        hint: 'This can happen after GPU resets, tab sleep, or graphics driver limits.',
        onRetry: opts.onRetry || function () { location.reload(); },
        controlsRoot: opts.controlsRoot
      });
    }
    function onRestored() {
      setState(container, 'INITIALIZING', 'webglcontextrestored');
      if (typeof opts.onRestored === 'function') opts.onRestored();
      else if (typeof opts.onRetry === 'function') opts.onRetry();
      else location.reload();
    }
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    return function unbind() {
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
    };
  }

  function startLoadWatchdog(container, timeoutMs, onTimeout) {
    timeoutMs = timeoutMs == null ? DEFAULT_TIMEOUT_MS : timeoutMs;
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      setState(container, 'LOAD_FAILED', 'timeout');
      if (typeof onTimeout === 'function') onTimeout();
    }, timeoutMs);
    return {
      cancel: function () { done = true; clearTimeout(timer); },
      markReady: function () { done = true; clearTimeout(timer); setState(container, 'READY'); }
    };
  }

  root.TPWebGL = {
    POSTER_SRC: POSTER_SRC,
    detect: detectWebGL,
    createRenderer: createRenderer,
    setState: setState,
    showFallback: showFallback,
    hideControls: hideControls,
    ensurePoster: ensurePoster,
    removePoster: removePoster,
    bindContextLoss: bindContextLoss,
    startLoadWatchdog: startLoadWatchdog,
    fallbackHTML: fallbackHTML
  };
})(typeof window !== 'undefined' ? window : globalThis);
