/* Screen-space placement for 3D callout labels.
   Keeps every visible label inside the viewport, clear of the side panel
   and the top chrome, and clear of the other labels. A label that cannot
   be placed without a collision is hidden. A tapped part (pin) is placed
   first so its label is the one that stays when the screen is tight. */
(function (root) {
  'use strict';

  function overlaps(a, b, gap) {
    return !(a.right <= b.left - gap || a.left >= b.right + gap || a.bottom <= b.top - gap || a.top >= b.bottom + gap);
  }

  function hits(rect, list, gap) {
    for (var i = 0; i < list.length; i++) {
      if (overlaps(rect, list[i], gap)) return list[i];
    }
    return null;
  }

  function inView(rect, vw, vh, margin) {
    return rect.left >= margin - 0.5 && rect.top >= margin - 0.5 &&
      rect.right <= vw - margin + 0.5 && rect.bottom <= vh - margin + 0.5;
  }

  function nudge(el, dx, dy) {
    el.style.left = (parseFloat(el.style.left) + dx) + 'px';
    el.style.top = (parseFloat(el.style.top) + dy) + 'px';
  }

  function movesAway(rect, block, gap) {
    var left = (block.left - gap) - rect.right;
    var right = (block.right + gap) - rect.left;
    var up = (block.top - gap) - rect.bottom;
    var down = (block.bottom + gap) - rect.top;
    return [
      { dx: left, dy: 0, cost: Math.abs(left) },
      { dx: right, dy: 0, cost: Math.abs(right) },
      { dx: 0, dy: up, cost: Math.abs(up) },
      { dx: 0, dy: down, cost: Math.abs(down) }
    ].sort(function (a, b) { return a.cost - b.cost; });
  }

  function obstacleRects() {
    var out = [];
    var ids = ['panel', 'topbar', 'help', 'tourcap', 'collapse'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      out.push(r);
    }
    var header = document.querySelector('body > header');
    if (header) {
      var hr = header.getBoundingClientRect();
      if (hr.width > 8 && hr.height > 8 && hr.bottom > 0) out.push(hr);
    }
    return out;
  }

  function clampToViewport(el, vw, vh, margin) {
    var guard = 0;
    while (guard++ < 4) {
      var rect = el.getBoundingClientRect();
      var dx = 0;
      var dy = 0;
      if (rect.left < margin) dx = margin - rect.left;
      else if (rect.right > vw - margin) dx = (vw - margin) - rect.right;
      if (rect.top < margin) dy = margin - rect.top;
      else if (rect.bottom > vh - margin) dy = (vh - margin) - rect.bottom;
      if (!dx && !dy) return;
      nudge(el, dx, dy);
    }
  }

  function separate(el, blocks, placed, vw, vh, margin, gap) {
    var guard = 0;
    while (guard++ < 20) {
      var rect = el.getBoundingClientRect();
      if (!inView(rect, vw, vh, margin)) return false;
      var block = hits(rect, blocks, 2);
      var other = hits(rect, placed, gap);
      var hit = block || other;
      if (!hit) return true;
      var options = movesAway(rect, hit, block ? 6 : gap);
      var moved = false;
      for (var i = 0; i < options.length; i++) {
        nudge(el, options[i].dx, options[i].dy);
        clampToViewport(el, vw, vh, margin);
        var next = el.getBoundingClientRect();
        if (inView(next, vw, vh, margin) && !hits(next, blocks, 2)) {
          moved = true;
          break;
        }
        nudge(el, -options[i].dx, -options[i].dy);
      }
      if (!moved) return false;
    }
    var end = el.getBoundingClientRect();
    return inView(end, vw, vh, margin) && !hits(end, blocks, 2) && !hits(end, placed, gap);
  }

  function layout(entries) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = 8;
    var gap = 6;
    var mobile = vw <= 760;
    var blocks = obstacleRects();
    var placed = [];
    var ordered = entries.slice().sort(function (a, b) {
      var pin = (b.pin ? 1 : 0) - (a.pin ? 1 : 0);
      if (pin) return pin;
      return a.y - b.y;
    });
    ordered.forEach(function (item) {
      var el = item.el;
      if (!item.show) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      if (mobile) {
        el.style.maxWidth = Math.max(96, vw - margin * 2) + 'px';
        el.style.whiteSpace = 'normal';
      } else {
        el.style.maxWidth = '';
        el.style.whiteSpace = '';
      }
      el.style.left = item.x + 'px';
      el.style.top = item.y + 'px';
      clampToViewport(el, vw, vh, margin);
      if (!separate(el, blocks, placed, vw, vh, margin, gap)) {
        el.style.display = 'none';
        return;
      }
      var rect = el.getBoundingClientRect();
      if (!inView(rect, vw, vh, margin) || hits(rect, blocks, 2) || hits(rect, placed, gap)) {
        el.style.display = 'none';
        return;
      }
      placed.push(rect);
    });
  }

  root.TPLabelLayout = { layout: layout };
})(typeof window !== 'undefined' ? window : globalThis);
