/**
 * tp-3d-suite.js — TransformerPath 3D Models & Interactive Visualizers Switcher
 *
 * Provides a seamless navigation and model-switching experience across all
 * 3D digital twins, cutaways, and interactive engineering simulators.
 */
(function () {
  'use strict';

  var SUITE = [
    {
      category: 'Power Transformers (3D Digital Twins)',
      items: [
        { id: 'power3d.html', title: '100 MVA Substation Transformer', tag: '132/33 kV', desc: 'Reference 3-phase YNd11 substation unit with OLTC and radiators' },
        { id: 'power500.html', title: '500 MVA Transmission Transformer', tag: '400/220 kV', desc: '5-limb UHV grid unit with ODAF cooling and high-voltage turrets' },
        { id: 'autotransformer.html', title: '400/220 kV Autotransformer', tag: 'Series+Common', desc: 'Auto-connected transmission unit with common & series windings' },
        { id: 'gsu.html', title: 'Generator Step-Up (GSU)', tag: '420/21 kV', desc: 'Power plant generation evacuation unit (Delta LV / Star HV)' }
      ]
    },
    {
      category: 'Component 3D Cutaways & Topologies',
      items: [
        { id: 'bushing.html', title: 'Condenser Bushing Cutaway', tag: '400 kV RIP/OIP', desc: 'Capacitor-graded insulation field distribution & voltage grading' },
        { id: 'oltc.html', title: 'On-Load Tap-Changer (OLTC)', tag: 'Vacuum/Oil', desc: 'Diverter switch, selector cylinder and motor-drive mechanism' },
        { id: 'coretopology.html', title: 'Magnetic Core Topology', tag: '3 vs 5-Limb', desc: 'Core-form vs shell-form, step-lap mitred joints and clamping' },
        { id: 'coilassembly.html', title: 'Coil & Active Part Assembly', tag: 'HV/LV Sizing', desc: 'Winding clearances, pressboard insulation barriers and cylinders' },
        { id: 'windings.html', title: 'Winding Topologies & Conductors', tag: 'CTC/Foil', desc: 'Continuous disc, helical, interleaved windings & CTC strands' }
      ]
    },
    {
      category: 'Interactive Labs & Simulators',
      items: [
        { id: 'testbay.html', title: 'High-Voltage Test Bay Simulator', tag: 'FAT / Duval', desc: 'DGA diagnosis on Duval triangle & dielectric withstand tests' },
        { id: 'explorer.html', title: 'Core & Tank Structure Explorer', tag: 'Active Part', desc: 'Structural mechanical layout and component decomposition' }
      ]
    }
  ];

  function init() {
    var topbar = document.getElementById('topbar');
    if (!topbar) return;

    var currentFile = window.location.pathname.split('/').pop() || 'power3d.html';
    if (!currentFile.endsWith('.html')) currentFile += '.html';

    var currentItem = null;
    SUITE.forEach(function (cat) {
      cat.items.forEach(function (it) {
        if (it.id === currentFile) currentItem = it;
      });
    });

    if (!currentItem) currentItem = { title: '3D Explorer', tag: 'Suite' };

    // Inject CSS for the 3D Suite Switcher
    if (!document.getElementById('tp-3d-suite-styles')) {
      var style = document.createElement('style');
      style.id = 'tp-3d-suite-styles';
      style.textContent = [
        '.tp-3d-bar { pointer-events:auto; display:flex; align-items:center; gap:8px; margin-left:auto; z-index:100; font-family:var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif); }',
        '.tp-3d-btn { background:rgba(14,28,44,.85); border:1px solid var(--acc, #f5a623); color:var(--ink, #e8edf4); padding:5px 12px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; backdrop-filter:blur(8px); transition:all .15s; }',
        '.tp-3d-btn:hover { background:var(--panel, #14253d); color:#fff; border-color:var(--acc2, #fbbf24); box-shadow:0 0 12px rgba(245,166,35,.25); }',
        '.tp-3d-badge { background:rgba(245,166,35,.2); color:var(--acc, #f5a623); font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:.5px; }',
        '.tp-3d-pills { display:flex; gap:6px; align-items:center; }',
        '.tp-3d-pill { background:rgba(14,28,44,.7); border:1px solid var(--line, #1e3a5c); color:var(--mut, #94a3b8); padding:4px 9px; border-radius:6px; font-size:11.5px; font-weight:600; text-decoration:none; white-space:nowrap; transition:all .15s; }',
        '.tp-3d-pill:hover { background:var(--panel, #14253d); color:var(--acc, #f5a623); border-color:var(--acc, #f5a623); }',
        '.tp-3d-pill.active { background:rgba(245,166,35,.15); border-color:var(--acc, #f5a623); color:var(--acc2, #fbbf24); font-weight:700; }',
        '.tp-3d-modal { position:fixed; top:58px; right:16px; width:340px; max-height:calc(100vh - 80px); background:#0d1b2e; border:1px solid #1e3a5c; border-radius:14px; padding:12px; box-shadow:0 12px 36px rgba(0,0,0,.65); z-index:9999; display:none; overflow-y:auto; backdrop-filter:blur(16px); }',
        '.tp-3d-modal.open { display:block; animation:tp3dFade .15s ease-out; }',
        '@keyframes tp3dFade { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }',
        '.tp-3d-cat { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--acc, #f5a623); margin:10px 4px 6px; padding-bottom:3px; border-bottom:1px solid rgba(30,58,92,.6); }',
        '.tp-3d-cat:first-child { margin-top:2px; }',
        '.tp-3d-item { display:flex; flex-direction:column; gap:2px; padding:7px 10px; border-radius:8px; text-decoration:none; color:var(--ink, #e8edf4); transition:background .12s; margin-bottom:2px; border:1px solid transparent; }',
        '.tp-3d-item:hover { background:rgba(20,37,61,.9); border-color:#1e3a5c; }',
        '.tp-3d-item.current { background:rgba(245,166,35,.12); border-color:rgba(245,166,35,.4); }',
        '.tp-3d-item-title { font-size:12.5px; font-weight:700; color:#fff; display:flex; justify-content:space-between; align-items:center; }',
        '.tp-3d-item-desc { font-size:11px; color:#94a3b8; line-height:1.35; }',
        '@media(max-width:960px) { .tp-3d-pills { display:none; } }',
        '@media(max-width:600px) { .tp-3d-modal { left:10px; right:10px; width:auto; } }'
      ].join('\n');
      document.head.appendChild(style);
    }

    // Build Switcher HTML
    var bar = document.createElement('div');
    bar.className = 'tp-3d-bar';

    // Quick Jump Pills for related models
    var pills = document.createElement('div');
    pills.className = 'tp-3d-pills';
    var quickLinks = [
      { id: 'power3d.html', label: '100 MVA' },
      { id: 'power500.html', label: '500 MVA' },
      { id: 'bushing.html', label: 'Bushing' },
      { id: 'oltc.html', label: 'OLTC' },
      { id: 'coretopology.html', label: 'Core' },
      { id: 'testbay.html', label: 'Test Bay' }
    ];

    quickLinks.forEach(function (q) {
      var a = document.createElement('a');
      a.className = 'tp-3d-pill' + (q.id === currentFile ? ' active' : '');
      a.href = q.id;
      a.textContent = q.label;
      pills.appendChild(a);
    });

    bar.appendChild(pills);

    // Dropdown Button
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tp-3d-btn';
    btn.innerHTML = '📦 <span>3D Suite</span> <span class="tp-3d-badge">' + currentItem.tag + '</span> ▾';
    bar.appendChild(btn);

    // Modal / Dropdown Panel
    var modal = document.createElement('div');
    modal.className = 'tp-3d-modal';

    var modalHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:2px 4px">' +
      '<strong style="font-size:13px;color:#fff">TransformerPath 3D Suite</strong>' +
      '<span style="font-size:11px;color:#94a3b8">11 Models &amp; Labs</span>' +
      '</div>';

    SUITE.forEach(function (cat) {
      modalHtml += '<div class="tp-3d-cat">' + cat.category + '</div>';
      cat.items.forEach(function (it) {
        var isCur = it.id === currentFile;
        modalHtml += '<a class="tp-3d-item' + (isCur ? ' current' : '') + '" href="' + it.id + '">' +
          '<div class="tp-3d-item-title"><span>' + it.title + '</span><span class="tp-3d-badge">' + it.tag + '</span></div>' +
          '<div class="tp-3d-item-desc">' + it.desc + '</div>' +
          '</a>';
      });
    });

    modalHtml += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #1e3a5c;display:flex;gap:8px;font-size:11.5px">' +
      '<a href="calculator.html" style="color:var(--acc,#f5a623);text-decoration:none;font-weight:600">⚡ Sizing Calculator</a> · ' +
      '<a href="masterclass.html" style="color:var(--acc,#f5a623);text-decoration:none;font-weight:600">📚 Masterclass</a> · ' +
      '<a href="components.html" style="color:var(--acc,#f5a623);text-decoration:none;font-weight:600">🧩 Components</a>' +
      '</div>';

    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      modal.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!modal.contains(e.target) && e.target !== btn) {
        modal.classList.remove('open');
      }
    });

    topbar.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
