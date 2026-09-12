/**
 * Bridge: 3D part selection ↔ component catalog ↔ supplier monetization CTA.
 * Include after components-catalog.js (and payments.js if Pay buttons are used).
 *
 * Usage on power3d.html:
 *   <script src="components-catalog.js"></script>
 *   <script src="payments-config.js"></script>
 *   <script src="payments.js"></script>
 *   <script src="component-3d-bridge.js"></script>
 */
(function (root) {
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function supplierBlock(comp) {
    if (!comp) return '';
    var featured = root.TP_COMPONENTS.supplierFor(comp.id);
    var html = '<div class="tp-comp-cta" style="margin-top:10px;padding-top:10px;border-top:1px solid #23415e">';
    html +=
      '<div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.6px;color:#8fa6bc;margin-bottom:4px">Component marketplace</div>';
    html +=
      '<a href="components.html#' +
      encodeURIComponent(comp.id) +
      '" style="color:#3da5f4;font-weight:700;font-size:.82rem;text-decoration:none">Open in directory → ' +
      escapeHtml(comp.name) +
      '</a>';

    if (featured && featured.name) {
      html +=
        '<div style="margin-top:8px;background:#13263a;border:1px solid #23415e;border-radius:8px;padding:8px 10px">';
      html +=
        '<div style="font-size:.68rem;color:#f5a623;font-weight:800;text-transform:uppercase;letter-spacing:.5px">Featured supplier</div>';
      if (featured.url) {
        html +=
          '<a href="' +
          escapeHtml(featured.url) +
          '" target="_blank" rel="noopener sponsored" style="color:#e8eef5;font-weight:700;font-size:.9rem;text-decoration:none">' +
          escapeHtml(featured.name) +
          ' ↗</a>';
      } else {
        html +=
          '<div style="color:#e8eef5;font-weight:700;font-size:.9rem">' +
          escapeHtml(featured.name) +
          '</div>';
      }
      if (featured.tagline) {
        html +=
          '<div style="color:#8fa6bc;font-size:.75rem;margin-top:2px">' +
          escapeHtml(featured.tagline) +
          '</div>';
      }
      html += '</div>';
    } else {
      html +=
        '<div style="margin-top:8px;font-size:.78rem;color:#8fa6bc;line-height:1.45">No featured supplier yet.</div>';
      html +=
        '<button type="button" data-tp-pay="component_3d_feature" data-component="' +
        escapeHtml(comp.id) +
        '" style="margin-top:8px;width:100%;background:#f5a623;color:#0d1b2e;border:0;border-radius:8px;padding:8px 10px;font-weight:800;font-size:.8rem;cursor:pointer">Feature your brand on this part — $999/yr</button>';
    }
    html += '</div>';
    return html;
  }

  function enrichInfo(partName, desc) {
    var catalog = root.TP_COMPONENTS;
    var comp = catalog ? catalog.matchPartName(partName) : null;
    var html =
      '<b>' +
      escapeHtml(partName || '') +
      '</b><br>' +
      (desc || '') +
      supplierBlock(comp);
    return { html: html, comp: comp };
  }

  function writeInfo(partName, desc) {
    var info = document.getElementById('info');
    if (!info) return null;
    var enriched = enrichInfo(partName, desc);
    info.innerHTML = enriched.html;
    if (root.TPCheckout && root.TPCheckout.bindPayButtons) {
      root.TPCheckout.bindPayButtons('#info [data-tp-pay]');
    }
    // Stash selected component for checkout metadata
    Array.prototype.forEach.call(info.querySelectorAll('[data-tp-pay]'), function (btn) {
      btn.addEventListener(
        'click',
        function () {
          try {
            sessionStorage.setItem(
              'tp-sponsor-component',
              btn.getAttribute('data-component') || ''
            );
          } catch (e) {}
        },
        { once: true }
      );
    });
    return enriched.comp;
  }

  function patchSelection() {
    var prevSelect = root.selectPart;
    if (typeof prevSelect === 'function') {
      root.selectPart = function (p) {
        prevSelect(p);
        if (p && p.name) writeInfo(p.name, p.desc);
      };
    }

    // Also wrap direct info writes from pick()
    var info = document.getElementById('info');
    if (!info) return;
    var observer = new MutationObserver(function () {
      // no-op placeholder — we patch pick below instead
    });
    observer.disconnect();

    if (typeof root.pick === 'function') {
      /* pick is local in power3d — patch via event delegation on canvas clicks after selection */
    }

    // Hook canvas click after power3d's pick by listening to selected global
    document.addEventListener(
      'click',
      function () {
        if (typeof selected !== 'undefined' && selected && selected.name) {
          var infoEl = document.getElementById('info');
          if (!infoEl) return;
          if (infoEl.getAttribute('data-tp-enriched') === selected.name) return;
          writeInfo(selected.name, selected.desc);
          infoEl.setAttribute('data-tp-enriched', selected.name);
        }
      },
      true
    );
  }

  function selectFromQuery() {
    var params = new URLSearchParams(location.search);
    var partId = params.get('part');
    if (!partId || !root.TP_COMPONENTS) return;
    var comp = root.TP_COMPONENTS.byId(partId);
    if (!comp) return;

    function trySelect() {
      if (typeof parts === 'undefined' || !parts || !parts.length) return false;
      var match = null;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (root.TP_COMPONENTS.matchPartName(p.name) === comp) {
          match = p;
          break;
        }
      }
      if (!match) return false;
      if (typeof selectPart === 'function') selectPart(match);
      else if (typeof root.selectPart === 'function') root.selectPart(match);
      writeInfo(match.name, match.desc);
      return true;
    }

    if (!trySelect()) {
      var n = 0;
      var t = setInterval(function () {
        n++;
        if (trySelect() || n > 40) clearInterval(t);
      }, 150);
    }
  }

  function init() {
    patchSelection();
    selectFromQuery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.TPComponent3D = {
    enrichInfo: enrichInfo,
    writeInfo: writeInfo,
    selectFromQuery: selectFromQuery
  };
})(typeof window !== 'undefined' ? window : globalThis);
