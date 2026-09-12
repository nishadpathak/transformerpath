/**
 * Enrich power3d.html selection panel with:
 *   engineering role → components → machinery → manufacturers → supplier CTA
 *
 * Depends on: part-ecosystem.js, components-catalog.js (optional), payments*.js (optional)
 */
(function (root) {
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function listBlock(title, items, mapFn) {
    if (!items || !items.length) return '';
    var html =
      '<div class="tp-eco-block"><div class="tp-eco-h">' +
      esc(title) +
      '</div><ul class="tp-eco-ul">';
    for (var i = 0; i < items.length; i++) html += mapFn(items[i]);
    html += '</ul></div>';
    return html;
  }

  function supplierCta(eco) {
    var catalog = root.TP_COMPONENTS;
    var comp = catalog ? catalog.matchPartName(eco && eco.title) : null;
    // Prefer ecosystem id match against catalog ids
    if (catalog && eco && catalog.byId(eco.id)) comp = catalog.byId(eco.id);
    if (!catalog) {
      return (
        '<div class="tp-eco-block"><a class="tp-eco-link" href="components.html">Browse component directory →</a> · ' +
        '<a class="tp-eco-link" href="manufacturers.html">Manufacturers →</a></div>'
      );
    }
    var featured = comp ? catalog.supplierFor(comp.id) : null;
    var html = '<div class="tp-eco-block"><div class="tp-eco-h">Supplier marketplace</div>';
    if (comp) {
      html +=
        '<a class="tp-eco-link" href="components.html#' +
        encodeURIComponent(comp.id) +
        '">Component page → ' +
        esc(comp.name) +
        '</a>';
    }
    if (featured && featured.name) {
      html +=
        '<div class="tp-eco-featured"><div class="tp-eco-feat-label">Featured supplier</div>';
      html += featured.url
        ? '<a href="' +
          esc(featured.url) +
          '" target="_blank" rel="noopener sponsored">' +
          esc(featured.name) +
          ' ↗</a>'
        : '<b>' + esc(featured.name) + '</b>';
      if (featured.tagline)
        html += '<div class="tp-eco-note">' + esc(featured.tagline) + '</div>';
      html += '</div>';
    } else if (comp) {
      html +=
        '<button type="button" class="tp-eco-pay" data-tp-pay="component_3d_feature" data-component="' +
        esc(comp.id) +
        '">Feature your brand on this part — $999/yr</button>';
    }
    html +=
      '<div style="margin-top:8px"><a class="tp-eco-link" href="manufacturers.html">All transformer manufacturers →</a></div>';
    html += '</div>';
    return html;
  }

  function render(partName, desc) {
    var eco =
      root.TP_PART_ECOSYSTEM && root.TP_PART_ECOSYSTEM.matchPartName(partName);
    var html = '<div class="tp-eco">';
    html += '<div class="tp-eco-title">' + esc(partName || '') + '</div>';
    if (eco && eco.title && eco.title !== partName) {
      html += '<div class="tp-eco-sub">' + esc(eco.title) + '</div>';
    }
    html += '<p class="tp-eco-desc">' + (desc || '') + '</p>';

    if (eco) {
      html += listBlock('Components & materials', eco.components, function (c) {
        return (
          '<li><b>' +
          esc(c.name) +
          '</b><span class="tp-eco-note"> — ' +
          esc(c.note) +
          '</span></li>'
        );
      });
      html += listBlock('Machinery & process', eco.machinery, function (m) {
        return (
          '<li><b>' +
          esc(m.name) +
          '</b><span class="tp-eco-note"> — ' +
          esc(m.note) +
          '</span></li>'
        );
      });
      html += listBlock('Manufacturers & specialists', eco.manufacturers, function (m) {
        var name = m.url
          ? '<a class="tp-eco-link" href="' +
            esc(m.url) +
            '" target="_blank" rel="noopener">' +
            esc(m.name) +
            '</a>'
          : '<b>' + esc(m.name) + '</b>';
        return (
          '<li>' +
          name +
          '<span class="tp-eco-note"> — ' +
          esc(m.role) +
          '</span></li>'
        );
      });
      if (eco.detail3d) {
        html +=
          '<div class="tp-eco-block"><a class="tp-eco-link" href="' +
          esc(eco.detail3d) +
          '">Open detailed 3D model →</a></div>';
      }
      html += supplierCta(eco);
    } else {
      html +=
        '<div class="tp-eco-block"><a class="tp-eco-link" href="components.html">Components directory →</a> · ' +
        '<a class="tp-eco-link" href="manufacturers.html">Manufacturers →</a></div>';
    }
    html += '</div>';
    return { html: html, eco: eco };
  }

  function writeInfo(partName, desc) {
    var info = document.getElementById('info');
    if (!info) return null;
    var out = render(partName, desc);
    info.innerHTML = out.html;
    info.setAttribute('data-tp-enriched', partName || '');
    if (root.TPCheckout && root.TPCheckout.bindPayButtons) {
      root.TPCheckout.bindPayButtons('#info [data-tp-pay]');
    }
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
    return out.eco;
  }

  function selectFromQuery() {
    var partId = new URLSearchParams(location.search).get('part');
    if (!partId || !root.TP_PART_ECOSYSTEM) return;
    var eco = root.TP_PART_ECOSYSTEM.byId(partId);
    if (!eco) return;

    function trySelect() {
      if (typeof parts === 'undefined' || !parts || !parts.length) return false;
      var match = null;
      for (var i = 0; i < parts.length; i++) {
        if (root.TP_PART_ECOSYSTEM.matchPartName(parts[i].name) === eco) {
          match = parts[i];
          break;
        }
      }
      if (!match) return false;
      if (typeof selectPart === 'function') selectPart(match);
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

  function patchSelection() {
    document.addEventListener(
      'click',
      function () {
        if (typeof selected !== 'undefined' && selected && selected.name) {
          var info = document.getElementById('info');
          if (!info) return;
          if (info.getAttribute('data-tp-enriched') === selected.name) return;
          writeInfo(selected.name, selected.desc);
        }
      },
      true
    );
  }

  function injectStyles() {
    if (document.getElementById('tp-eco-css')) return;
    var s = document.createElement('style');
    s.id = 'tp-eco-css';
    s.textContent =
      '#panel{width:min(380px,92vw)!important}' +
      '#info{min-height:140px;max-height:48vh;overflow:auto}' +
      '.tp-eco-title{font-weight:800;color:#3da5f4;font-size:.95rem;margin-bottom:2px}' +
      '.tp-eco-sub{font-size:.72rem;color:#8fa6bc;margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px}' +
      '.tp-eco-desc{font-size:.8rem;line-height:1.45;margin:0 0 8px;color:#d5e2ef}' +
      '.tp-eco-block{margin-top:10px;padding-top:8px;border-top:1px solid #23415e}' +
      '.tp-eco-h{font-size:.68rem;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#f5a623;margin-bottom:4px}' +
      '.tp-eco-ul{margin:0;padding-left:16px}' +
      '.tp-eco-ul li{margin:0 0 5px;font-size:.78rem;line-height:1.35;color:#e8eef5}' +
      '.tp-eco-note{color:#8fa6bc;font-weight:400}' +
      '.tp-eco-link{color:#3da5f4;font-weight:700;text-decoration:none;font-size:.8rem}' +
      '.tp-eco-link:hover{text-decoration:underline}' +
      '.tp-eco-featured{margin-top:8px;background:#13263a;border:1px solid #23415e;border-radius:8px;padding:8px 10px}' +
      '.tp-eco-feat-label{font-size:.65rem;color:#f5a623;font-weight:800;text-transform:uppercase;letter-spacing:.5px}' +
      '.tp-eco-pay{margin-top:8px;width:100%;background:#f5a623;color:#0d1b2e;border:0;border-radius:8px;padding:8px 10px;font-weight:800;font-size:.78rem;cursor:pointer}';
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    patchSelection();
    selectFromQuery();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  root.TPComponent3D = {
    writeInfo: writeInfo,
    render: render,
    selectFromQuery: selectFromQuery
  };
})(typeof window !== 'undefined' ? window : globalThis);
