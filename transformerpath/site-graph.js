/**
 * TransformerPath site graph — interconnection + monetization surfaces.
 * Loads data/site-graph.json, stamps trail + "Connected across" on every page.
 */
(function (global) {
  "use strict";

  var GRAPH_URL = "data/site-graph.json";

  /** Display catalog — keys match payments-config.js / site-graph.json monetize[]. */
  var MONETIZE = {
    directory_verified: {
      label: "Get verified",
      href: "list-company.html?plan=verified",
      note: "Trust badge + RFQ priority"
    },
    directory_premium: {
      label: "Go premium",
      href: "list-company.html?plan=premium",
      note: "Featured placement + analytics"
    },
    directory_enterprise: {
      label: "Enterprise directory",
      href: "pricing.html#enterprise",
      note: "Multi-plant + SSO"
    },
    sponsor_daily_brief: {
      label: "Sponsor the Daily Brief",
      href: "sponsor.html#brief",
      note: "Category exclusivity"
    },
    sponsor_featured_article: {
      label: "Feature an article",
      href: "sponsor.html#articles",
      note: "Pinned intel + newsletter"
    },
    component_3d_feature: {
      label: "Feature a 3D part",
      href: "sponsor.html#3d",
      note: "Hotspot + OEM CTA"
    },
    component_3d_exclusive: {
      label: "Exclusive 3D category",
      href: "sponsor.html#3d-exclusive",
      note: "Category lock"
    },
    academy_pro: {
      label: "Academy Pro",
      href: "pricing.html#academy",
      note: "Full course + certificate"
    },
    academy_team: {
      label: "Team seats",
      href: "teams.html",
      note: "Corp training packs"
    },
    academy_enterprise: {
      label: "Enterprise learning",
      href: "pricing.html#enterprise",
      note: "SSO + analytics"
    },
    rfq_boost: {
      label: "RFQ lead access",
      href: "rfq.html",
      note: "Qualified buyer intent"
    },
    jobs_featured: {
      label: "Feature a job",
      href: "jobs.html#post",
      note: "Hiring board"
    }
  };

  var LAYER_HREF = {
    platform: "platform-map.html",
    directory: "manufacturers.html",
    intel: "intel.html",
    networks: "grids.html",
    learning: "learn.html",
    "3d": "power3d.html",
    tools: "calculator.html",
    commerce: "sponsor.html",
    network: "jobs.html"
  };

  var FALLBACK = {
    version: 1,
    nodes: {
      home: {
        id: "home",
        title: "Home",
        href: "index.html",
        layer: "platform",
        tags: ["PT", "DT", "DRY", "CT"],
        related: ["intel", "manufacturers", "learn", "power3d"],
        monetize: []
      },
      intel: {
        id: "intel",
        title: "Intelligence",
        href: "intel.html",
        layer: "intel",
        tags: ["PT", "DT", "DRY", "CT"],
        related: ["manufacturers", "learn", "grids"],
        monetize: ["sponsor_daily_brief"]
      },
      manufacturers: {
        id: "manufacturers",
        title: "Manufacturers",
        href: "manufacturers.html",
        layer: "directory",
        tags: ["PT", "DT", "DRY", "CT"],
        related: ["company", "components", "power3d"],
        monetize: ["directory_verified", "directory_premium"]
      },
      learn: {
        id: "learn",
        title: "Learn Hub",
        href: "learn.html",
        layer: "learning",
        tags: ["PT", "DT", "DRY", "CT"],
        related: ["academy", "tutorial", "resources", "power3d"],
        monetize: ["academy_pro"]
      },
      "platform-map": {
        id: "platform-map",
        title: "Platform Map",
        href: "platform-map.html",
        layer: "platform",
        tags: ["PT", "DT", "DRY", "CT"],
        related: ["home", "learn", "manufacturers", "intel"],
        monetize: []
      }
    },
    layers: {
      platform: "Platform",
      directory: "Directories",
      intel: "Market Intel",
      networks: "Grid & Utility Networks",
      learning: "Learning & Books",
      "3d": "Interactive 3D",
      tools: "Engineering Tools",
      commerce: "Commerce & Monetization",
      network: "Community"
    },
    tracePrinciples: [
      "Every OEM name resolves to a company profile",
      "Every product tag (PT/DT/DRY/CT) opens matching 3D + directory filters",
      "Every learning chapter links to 3D models and directory examples"
    ]
  };

  var state = {
    ready: false,
    graph: FALLBACK,
    byId: {},
    currentId: null
  };

  function nodeList(graph) {
    var nodes = (graph && graph.nodes) || {};
    if (Array.isArray(nodes)) return nodes;
    return Object.keys(nodes).map(function (k) {
      return nodes[k];
    });
  }

  function labelOf(n) {
    return (n && (n.title || n.label)) || "";
  }

  function fileOf(href) {
    try {
      var u = new URL(href, global.location.href);
      var parts = u.pathname.split("/");
      return (parts[parts.length - 1] || "index.html").split("?")[0] || "index.html";
    } catch (e) {
      return "index.html";
    }
  }

  function detectCurrentId(nodes) {
    var forced = document.body && document.body.getAttribute("data-tp-node");
    if (forced) return forced;
    var page = fileOf(global.location.href);
    if (page === "explorer.html") {
      try {
        var mode = (new URL(global.location.href).searchParams.get("mode") || "oil").toLowerCase();
        if (mode === "crt" || mode === "vpi" || mode === "dry") return "castresin3d";
        return "explorer-oil";
      } catch (e) {
        return "explorer-oil";
      }
    }
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (fileOf(nodes[i].href) === page) return nodes[i].id;
    }
    return null;
  }

  function indexNodes(nodes) {
    var map = {};
    nodes.forEach(function (n) {
      if (n && n.id) map[n.id] = n;
    });
    return map;
  }

  function relatedOf(node) {
    if (!node || !node.related) return [];
    return node.related
      .map(function (id) {
        return state.byId[id];
      })
      .filter(Boolean);
  }

  function neighborsByTag(node, limit) {
    if (!node || !node.tags || !node.tags.length) return [];
    var out = [];
    var seen = {};
    seen[node.id] = true;
    nodeList(state.graph).forEach(function (n) {
      if (seen[n.id] || out.length >= (limit || 8)) return;
      var overlap = (n.tags || []).some(function (t) {
        return node.tags.indexOf(t) >= 0;
      });
      if (overlap) {
        seen[n.id] = true;
        out.push(n);
      }
    });
    return out;
  }

  function layerLabel(id) {
    var L = state.graph.layers || {};
    if (typeof L[id] === "string") return L[id];
    if (L[id] && L[id].label) return L[id].label;
    return id;
  }

  function ensureStyles() {
    if (document.getElementById("tp-site-graph-style")) return;
    var s = document.createElement("style");
    s.id = "tp-site-graph-style";
    s.textContent = [
      ".tp-sg-trail{display:flex;flex-wrap:wrap;gap:.35rem .55rem;align-items:center;font-size:.72rem;color:var(--muted,#64748b);margin:0 0 .85rem}",
      ".tp-sg-trail a{color:inherit;text-decoration:none;border-bottom:1px solid rgba(100,116,139,.35)}",
      ".tp-sg-trail a:hover{color:var(--ink,#0f172a);border-bottom-color:currentColor}",
      ".tp-sg-trail .sep{opacity:.45}",
      ".tp-sg-connect{margin:1.25rem 0 1.5rem;padding:1rem 1.1rem;border:1px solid var(--border,rgba(148,163,184,.25));border-radius:14px;background:var(--card,#fff)}",
      ".tp-sg-connect h3{margin:0 0 .35rem;font-size:.95rem;color:var(--ink,#0f172a)}",
      ".tp-sg-connect p.lead{margin:0 0 .75rem;font-size:.8rem;color:var(--muted,#64748b);line-height:1.45}",
      ".tp-sg-chips{display:flex;flex-wrap:wrap;gap:.4rem}",
      ".tp-sg-chip{display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .65rem;border-radius:999px;border:1px solid var(--border,rgba(148,163,184,.3));background:rgba(13,27,46,.04);color:inherit;text-decoration:none;font-size:.72rem}",
      ".tp-sg-chip:hover{border-color:rgba(11,95,165,.45);background:rgba(11,95,165,.08)}",
      ".tp-sg-chip .layer{opacity:.55;font-size:.65rem;text-transform:uppercase;letter-spacing:.04em}",
      ".tp-sg-money{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.85rem;padding-top:.75rem;border-top:1px solid var(--border,rgba(148,163,184,.2));align-items:center}",
      ".tp-sg-money a{font-size:.72rem;padding:.4rem .7rem;border-radius:10px;background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.4);color:var(--navy,#0d1b2e);font-weight:700;text-decoration:none}",
      ".tp-sg-money a:hover{background:rgba(245,166,35,.22)}",
      ".tp-sg-money span{font-size:.68rem;color:var(--muted,#64748b)}",
      ".tp-platform-map{display:grid;gap:1rem}",
      ".tp-platform-layer{border:1px solid var(--border,rgba(148,163,184,.25));border-radius:14px;padding:.85rem 1rem;background:var(--card,#fff)}",
      ".tp-platform-layer h3{margin:0 0 .55rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#64748b)}",
      ".tp-platform-nodes{display:flex;flex-wrap:wrap;gap:.4rem}",
      ".tp-platform-node{display:inline-flex;flex-direction:column;gap:.15rem;min-width:7.5rem;padding:.45rem .65rem;border-radius:10px;border:1px solid var(--border,rgba(148,163,184,.3));background:rgba(13,27,46,.03);text-decoration:none;color:inherit}",
      ".tp-platform-node.is-current{border-color:rgba(245,166,35,.7);box-shadow:0 0 0 1px rgba(245,166,35,.35)}",
      ".tp-platform-node strong{font-size:.78rem;color:var(--ink,#0f172a)}",
      ".tp-platform-node small{font-size:.65rem;color:var(--muted,#64748b)}",
      ".tp-trace-list{margin:.5rem 0 0;padding-left:1.1rem;font-size:.78rem;color:var(--muted,#64748b);line-height:1.5}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function trailHtml(node) {
    if (!node) return "";
    var crumbs = [{ label: "Home", href: "index.html" }];
    if (node.layer && node.layer !== "platform") {
      crumbs.push({
        label: layerLabel(node.layer),
        href: LAYER_HREF[node.layer] || "platform-map.html"
      });
    }
    if (node.id !== "home") crumbs.push({ label: labelOf(node), href: node.href });
    var html = '<nav class="tp-sg-trail" aria-label="Platform trail">';
    crumbs.forEach(function (c, i) {
      if (i) html += '<span class="sep" aria-hidden="true">/</span>';
      html +=
        i === crumbs.length - 1
          ? "<span>" + c.label + "</span>"
          : '<a href="' + c.href + '">' + c.label + "</a>";
    });
    html +=
      '<span class="sep" aria-hidden="true">·</span><a href="platform-map.html">Full platform map</a></nav>';
    return html;
  }

  function connectPanelHtml(node) {
    if (!node) return "";
    var related = relatedOf(node);
    var tagged = neighborsByTag(node, 6).filter(function (n) {
      return !related.some(function (r) {
        return r.id === n.id;
      });
    });
    var chips = related.concat(tagged).slice(0, 12);
    var money = (node.monetize || [])
      .map(function (k) {
        return MONETIZE[k];
      })
      .filter(Boolean);

    var html =
      '<aside class="tp-sg-connect" data-tp-connect="' +
      node.id +
      '"><h3>Connected across TransformerPath</h3><p class="lead">Directories, learning, 3D, intel, and grid networks stay linked from this page — full traceability.</p><div class="tp-sg-chips">';
    chips.forEach(function (n) {
      html +=
        '<a class="tp-sg-chip" href="' +
        n.href +
        '"><span class="layer">' +
        layerLabel(n.layer) +
        "</span><span>" +
        labelOf(n) +
        "</span></a>";
    });
    html +=
      '<a class="tp-sg-chip" href="platform-map.html"><span class="layer">Platform</span><span>Platform map</span></a></div>';
    if (money.length) {
      html += '<div class="tp-sg-money">';
      money.forEach(function (m) {
        html += '<a href="' + m.href + '">' + m.label + "</a><span>" + m.note + "</span>";
      });
      html += "</div>";
    }
    html += "</aside>";
    return html;
  }

  function injectInto(el, html, where) {
    if (!el || !html) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    var node = wrap.firstElementChild;
    if (!node) return;
    if (where === "afterbegin") el.insertAdjacentElement("afterbegin", node);
    else el.insertAdjacentElement("beforeend", node);
  }

  function stampPage() {
    ensureStyles();
    var node = state.currentId ? state.byId[state.currentId] : null;
    if (!node) return;

    var trailMount =
      document.querySelector("[data-tp-trail]") ||
      document.querySelector("main") ||
      document.querySelector(".container") ||
      document.body;
    if (trailMount && !document.querySelector(".tp-sg-trail")) {
      injectInto(trailMount, trailHtml(node), "afterbegin");
    }

    var connectMount =
      document.querySelector("[data-tp-connect-mount]") ||
      document.querySelector("main") ||
      document.querySelector("footer") ||
      document.body;
    if (connectMount && !document.querySelector(".tp-sg-connect")) {
      if (connectMount.tagName === "FOOTER") {
        connectMount.insertAdjacentHTML("beforebegin", connectPanelHtml(node));
      } else {
        injectInto(connectMount, connectPanelHtml(node), "beforeend");
      }
    }

    var mapHost = document.getElementById("tp-platform-map");
    if (mapHost) renderPlatformMap(mapHost);

    var principles = document.getElementById("tp-trace-principles");
    if (principles && state.graph.tracePrinciples && state.graph.tracePrinciples.length) {
      principles.innerHTML =
        '<ul class="tp-trace-list">' +
        state.graph.tracePrinciples
          .map(function (p) {
            return "<li>" + p + "</li>";
          })
          .join("") +
        "</ul>";
    }
  }

  function renderPlatformMap(host) {
    var byLayer = {};
    nodeList(state.graph).forEach(function (n) {
      var L = n.layer || "platform";
      if (!byLayer[L]) byLayer[L] = [];
      byLayer[L].push(n);
    });
    var layerKeys = state.graph.layers ? Object.keys(state.graph.layers) : Object.keys(byLayer);
    var order = layerKeys.filter(function (id) {
      return byLayer[id] && byLayer[id].length;
    });
    Object.keys(byLayer).forEach(function (id) {
      if (order.indexOf(id) < 0) order.push(id);
    });

    var html = '<div class="tp-platform-map">';
    order.forEach(function (layerId) {
      html +=
        '<section class="tp-platform-layer" id="layer-' +
        layerId +
        '"><h3>' +
        layerLabel(layerId) +
        '</h3><div class="tp-platform-nodes">';
      byLayer[layerId].forEach(function (n) {
        var cur = n.id === state.currentId ? " is-current" : "";
        html +=
          '<a class="tp-platform-node' +
          cur +
          '" href="' +
          n.href +
          '"><strong>' +
          labelOf(n) +
          "</strong><small>" +
          (n.tags || []).join(" · ") +
          "</small></a>";
      });
      html += "</div></section>";
    });
    html += "</div>";
    host.innerHTML = html;
  }

  function applyGraph(graph) {
    var g = graph && graph.nodes ? graph : FALLBACK;
    state.graph = g;
    var nodes = nodeList(g);
    state.byId = indexNodes(nodes);
    state.currentId = detectCurrentId(nodes);
    state.ready = true;
    stampPage();
  }

  function load() {
    return fetch(GRAPH_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("graph " + r.status);
        return r.json();
      })
      .then(applyGraph)
      .catch(function () {
        applyGraph(null);
      });
  }

  global.TPSiteGraph = {
    load: load,
    getCurrent: function () {
      return state.currentId ? state.byId[state.currentId] : null;
    },
    getNode: function (id) {
      return state.byId[id] || null;
    },
    related: relatedOf,
    monetizeCatalog: function () {
      return MONETIZE;
    },
    ready: function () {
      return state.ready;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})(typeof window !== "undefined" ? window : globalThis);
