/* tp-shortlist.js — Universal Shortlist & Multi-Supplier Compare Dock
 * Allows engineers and buyers to bookmark suppliers across Directory, Search, Components,
 * and compare them side-by-side or launch a combined Technical RFQ.
 */
(function () {
  'use strict';
  const STORAGE_KEY = 'tp_supplier_shortlist';
  const MAX_SHORTLIST = 4;

  function loadList() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  const TP_SHORTLIST = {
    list: function () {
      return loadList();
    },
    has: function (slugOrId) {
      const list = loadList();
      return list.some(item => (item.slug === slugOrId || item.id === slugOrId || item.name === slugOrId));
    },
    add: function (item) {
      let list = loadList();
      if (list.some(x => x.slug === item.slug || x.name === item.name)) return list;
      if (list.length >= MAX_SHORTLIST) {
        alert('You can compare up to ' + MAX_SHORTLIST + ' suppliers simultaneously.');
        return list;
      }
      list.push({
        slug: item.slug || item.id || String(item.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: item.name || item.title || 'Supplier',
        country: item.country || '',
        role: item.role || 'Manufacturer'
      });
      saveList(list);
      TP_SHORTLIST.renderDock();
      TP_SHORTLIST.updateButtons();
      return list;
    },
    remove: function (slugOrId) {
      let list = loadList();
      list = list.filter(x => x.slug !== slugOrId && x.name !== slugOrId && x.id !== slugOrId);
      saveList(list);
      TP_SHORTLIST.renderDock();
      TP_SHORTLIST.updateButtons();
      return list;
    },
    toggle: function (item) {
      if (TP_SHORTLIST.has(item.slug || item.id || item.name)) {
        return TP_SHORTLIST.remove(item.slug || item.id || item.name);
      } else {
        return TP_SHORTLIST.add(item);
      }
    },
    clear: function () {
      saveList([]);
      TP_SHORTLIST.renderDock();
      TP_SHORTLIST.updateButtons();
    },
    updateButtons: function () {
      document.querySelectorAll('[data-shortlist-slug]').forEach(btn => {
        const slug = btn.getAttribute('data-shortlist-slug');
        const isAdded = TP_SHORTLIST.has(slug);
        btn.classList.toggle('active', isAdded);
        btn.innerHTML = isAdded ? '✓ Shortlisted' : '+ Shortlist';
        btn.style.background = isAdded ? 'rgba(74,222,128,.15)' : '';
        btn.style.borderColor = isAdded ? 'var(--ok)' : '';
        btn.style.color = isAdded ? 'var(--ok)' : '';
      });
    },
    renderDock: function () {
      let dock = document.getElementById('tp-shortlist-dock');
      const list = loadList();

      if (!list.length) {
        if (dock) dock.style.display = 'none';
        return;
      }

      if (!dock) {
        dock = document.createElement('div');
        dock.id = 'tp-shortlist-dock';
        dock.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#0d1b2e;border:2px solid var(--amber);border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.5);padding:14px 18px;max-width:440px;display:flex;flex-direction:column;gap:10px;animation:tpDockSlideUp .2s ease;font-family:inherit;color:var(--text);';
        document.body.appendChild(dock);

        const style = document.createElement('style');
        style.textContent = '@keyframes tpDockSlideUp { from { transform:translateY(30px); opacity:0; } to { transform:translateY(0); opacity:1; } }';
        document.head.appendChild(style);
      }

      dock.style.display = 'flex';
      const slugs = list.map(x => x.slug).join(',');
      const names = list.map(x => `<span style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700">${escapeHtml(x.name)}</span>`).join(' ');

      dock.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:8px">
          <span style="font-size:12px;font-weight:800;color:var(--amber);text-transform:uppercase;letter-spacing:.05em">📋 Shortlist (${list.length}/${MAX_SHORTLIST})</span>
          <button type="button" onclick="window.TP_SHORTLIST.clear()" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline">Clear</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${names}</div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <a href="/compare.html?m=${encodeURIComponent(slugs)}" class="btn btn-outline btn-sm" style="flex:1;text-align:center;font-size:12px;padding:6px 10px">Compare (${list.length}) →</a>
          <a href="/rfq.html?suppliers=${encodeURIComponent(slugs)}" class="btn btn-amber btn-sm" style="flex:1;text-align:center;font-size:12px;padding:6px 10px">Create RFQ →</a>
        </div>
      `;
    }
  };

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.TP_SHORTLIST = TP_SHORTLIST;

  document.addEventListener('DOMContentLoaded', () => {
    TP_SHORTLIST.renderDock();
    TP_SHORTLIST.updateButtons();
  });
})();
