/**
 * Page scroll stays the default on 3D canvases and maps.
 * Wheel / trackpad scroll is not cancelled. Zoom runs only for ctrl/cmd+wheel
 * (browsers also set ctrlKey for a trackpad pinch) or a two-finger touch.
 * One-finger touch scrolls the page via touch-action: pan-y.
 */
(function (root) {
  "use strict";
  if (root.TPCanvasScroll) return;

  var HINT_TEXT = "Ctrl + scroll to zoom";

  function wheelCaptures(event) {
    return !!(event && (event.ctrlKey || event.metaKey));
  }

  /**
   * @returns {boolean} true when the event was captured for zoom
   */
  function handleWheel(event, onZoom) {
    if (!wheelCaptures(event)) return false;
    if (event.preventDefault) event.preventDefault();
    if (typeof onZoom === "function") onZoom(event);
    return true;
  }

  function pixelsFromDelta(delta, mode, pageSize) {
    var n = Number(delta) || 0;
    if (mode === 1) return n * 16;
    if (mode === 2) return n * (pageSize || 800);
    return n;
  }

  function relayWheelToParent(event) {
    if (!event || !root.parent || root.parent === root) return;
    try {
      root.parent.postMessage({
        type: "tp-canvas-scroll",
        deltaX: event.deltaX || 0,
        deltaY: event.deltaY || 0,
        deltaMode: event.deltaMode || 0
      }, "*");
    } catch (err) {}
  }

  function bindWheel(el, onZoom) {
    if (!el || !el.addEventListener) return function () {};
    function listener(event) {
      if (handleWheel(event, onZoom)) return;
      relayWheelToParent(event);
    }
    el.addEventListener("wheel", listener, { passive: false });
    return function () { el.removeEventListener("wheel", listener); };
  }

  function setPanY(el) {
    if (el && el.style) el.style.touchAction = "pan-y";
  }

  function measureTouches(touches) {
    var a = touches[0];
    var b = touches[1];
    var dx = b.clientX - a.clientX;
    var dy = b.clientY - a.clientY;
    return {
      dist: Math.hypot(dx, dy) || 1,
      angle: Math.atan2(dy, dx)
    };
  }

  function angleDelta(next, prev) {
    var d = next - prev;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function bindTwoFinger(el, onGesture) {
    if (!el || !el.addEventListener) return;
    var prev = null;
    el.addEventListener("touchstart", function (e) {
      prev = e.touches && e.touches.length === 2 ? measureTouches(e.touches) : null;
    }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      if (!e.touches || e.touches.length !== 2 || !prev) return;
      if (e.cancelable && e.preventDefault) e.preventDefault();
      var now = measureTouches(e.touches);
      if (typeof onGesture === "function") {
        onGesture({
          zoom: prev.dist / now.dist,
          dAngle: angleDelta(now.angle, prev.angle)
        });
      }
      prev = now;
    }, { passive: false });
    function end(e) {
      if (!e.touches || e.touches.length < 2) prev = null;
    }
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
  }

  function bindZoomHint(host) {
    if (!host || !root.document || host.querySelector(".tp-zoom-hint")) return;
    var hint = root.document.createElement("p");
    hint.className = "tp-zoom-hint";
    hint.textContent = HINT_TEXT;
    hint.hidden = true;
    hint.setAttribute("role", "status");
    hint.style.cssText = "position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:8;margin:0;pointer-events:none;background:rgba(7,17,28,.82);color:#e8edf4;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 12px;font:600 .78rem/1.2 system-ui,sans-serif;white-space:nowrap;";
    var pos = "";
    try { pos = root.getComputedStyle(host).position; } catch (err) {}
    if (!pos || pos === "static") host.style.position = "relative";
    host.appendChild(hint);
    var shown = false;
    var timer = 0;
    function reveal() {
      if (shown) return;
      shown = true;
      hint.hidden = false;
      timer = root.setTimeout(function () { hint.hidden = true; }, 2800);
    }
    host.addEventListener("pointerenter", reveal);
    host.addEventListener("mouseenter", reveal);
    return function () {
      if (timer) root.clearTimeout(timer);
    };
  }

  function installParentScrollRelay() {
    if (root.__tpCanvasScrollRelay || !root.addEventListener || !root.document) return;
    root.__tpCanvasScrollRelay = true;
    root.addEventListener("message", function (ev) {
      var data = ev && ev.data;
      if (!data || data.type !== "tp-canvas-scroll") return;
      if (ev.origin && root.location && ev.origin !== "null" && ev.origin !== root.location.origin) return;
      var frames = root.document.querySelectorAll("iframe");
      var fromChild = false;
      for (var i = 0; i < frames.length; i++) {
        try {
          if (frames[i].contentWindow === ev.source) fromChild = true;
        } catch (err) {}
      }
      if (!fromChild) return;
      var mode = data.deltaMode || 0;
      var page = root.innerHeight || 800;
      root.scrollBy(
        pixelsFromDelta(data.deltaX, mode, page),
        pixelsFromDelta(data.deltaY, mode, page)
      );
    });
  }

  root.TPCanvasScroll = {
    HINT_TEXT: HINT_TEXT,
    wheelCaptures: wheelCaptures,
    handleWheel: handleWheel,
    pixelsFromDelta: pixelsFromDelta,
    relayWheelToParent: relayWheelToParent,
    bindWheel: bindWheel,
    setPanY: setPanY,
    bindTwoFinger: bindTwoFinger,
    bindZoomHint: bindZoomHint,
    installParentScrollRelay: installParentScrollRelay
  };
})(typeof window !== "undefined" ? window : globalThis);
