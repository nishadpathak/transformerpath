/**
 * TransformerPath directory graph — links manufacturers ↔ product tags ↔ 3D explorers ↔ intel.
 *
 * Preserves existing tags: PT, DT, DRY (and optional CT when present).
 * New intel items may declare `companies: string[]` and `tags: string[]`;
 * when omitted, OEM names and product tags are inferred from title/snippet.
 */
(function (root) {
  var TYPE_META = {
    PT: {
      label: 'Power',
      full: 'Power Transformers',
      explorers: [
        { href: 'power3d.html', label: 'Power 3D explorer' },
        { href: 'power500.html', label: '500 kV power model' }
      ]
    },
    DT: {
      label: 'Distribution',
      full: 'Distribution Transformers',
      explorers: [
        { href: 'explorer.html?mode=oil', label: 'Oil distribution 3D' }
      ]
    },
    DRY: {
      label: 'Dry/Cast',
      full: 'Dry-type / Cast Resin',
      explorers: [
        { href: 'castresin3d.html', label: 'Cast-resin 3D' },
        { href: 'explorer.html?mode=crt', label: 'CRT explorer' },
        { href: 'explorer.html?mode=vpi', label: 'VPI explorer' }
      ]
    },
    CT: {
      label: 'CT',
      full: 'Current Transformers',
      explorers: [{ href: 'ct3d.html', label: 'CT 3D explorer' }]
    }
  };

  /** Canonical brand → preferred directory listing (name + country). */
  var ALIASES = [
    { keys: ['hitachi energy', 'hitachi'], name: 'Hitachi Energy (global HQ)', country: 'Switzerland' },
    { keys: ['siemens energy', 'omterra', 'siemens'], name: 'Siemens Energy', country: 'Germany' },
    { keys: ['sgb-smit', 'sgb smit', 'sgb'], name: 'SGB-SMIT Group', country: 'Germany' },
    { keys: ['prolec ge', 'prolec', 'ge vernova'], name: 'Prolec GE (GE Vernova)', country: 'USA' },
    { keys: ['hd hyundai electric', 'hd hyundai', 'hyundai electric'], name: 'HD Hyundai Electric', country: 'South Korea' },
    { keys: ['hyosung heavy', 'hyosung', 'hico'], name: 'Hyosung Heavy Industries', country: 'South Korea' },
    { keys: ['tbea'], name: 'TBEA', country: 'China' },
    { keys: ['cg power', 'crompton greaves'], name: 'CG Power and Industrial Solutions', country: 'India' },
    { keys: ['bhel'], name: 'BHEL', country: 'India' },
    { keys: ['toshiba'], name: 'Toshiba Energy Systems', country: 'Japan' },
    { keys: ['mitsubishi electric', 'mitsubishi'], name: 'Mitsubishi Electric', country: 'Japan' },
    { keys: ['abb'], name: 'Hitachi Energy (global HQ)', country: 'Switzerland' },
    { keys: ['weidmann'], name: 'Weidmann Electrical Technology', country: 'Switzerland' },
    { keys: ['maschinenfabrik reinhausen', 'reinhausen', ' mr '], name: 'Maschinenfabrik Reinhausen (MR)', country: 'Germany' },
    { keys: ['pennsylvania transformer', 'ptt'], name: 'Pennsylvania Transformer Technology', country: 'USA' },
    { keys: ['virginia transformer'], name: 'Virginia Transformer Corp', country: 'USA' },
    { keys: ['eaton'], name: 'Eaton', country: 'USA' },
    { keys: ['končar', 'koncar'], name: 'KONČAR - Distribution & Special Transformers', country: 'Croatia' },
    { keys: ['saudi power transformers', 'sptc'], name: 'Saudi Power Transformers', country: 'Saudi Arabia' },
    { keys: ['elsewedy'], name: 'Elsewedy Electric', country: 'Egypt' }
  ];

  var TAG_KEYWORDS = [
    { tag: 'PT', re: /\b(power\s+transformer|ehv|uhv|g su|gsu|380\s*kv|400\s*kv|500\s*kv|765\s*kv|large\s+power)\b/i },
    { tag: 'DT', re: /\b(distribution\s+transformer|pad[\s-]?mount|mv\/lv|33\/11|11\s*kv\s+distribution)\b/i },
    { tag: 'DRY', re: /\b(cast[\s-]?resin|dry[\s-]?type|geafol|resibloc|vpi\b|amorphous[\s-]?core)\b/i },
    { tag: 'CT', re: /\b(current\s+transformer|\bcts?\b|instrument\s+transformer)\b/i }
  ];

  var state = {
    ready: false,
    countries: [],
    byKey: Object.create(null),
    profiles: Object.create(null),
    names: []
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function keyOf(name, country) {
    return norm(name) + '|' + norm(country || '');
  }

  function parseTypes(types) {
    if (!types) return [];
    if (Array.isArray(types)) return types.map(function (t) { return String(t).trim(); }).filter(Boolean);
    return String(types)
      .split(',')
      .map(function (t) { return t.trim(); })
      .filter(Boolean);
  }

  function ingestCountries(list) {
    state.countries = Array.isArray(list) ? list : [];
    state.byKey = Object.create(null);
    state.names = [];
    state.countries.forEach(function (c) {
      (c.makers || []).forEach(function (m) {
        if (!m || !m[0] || /^Served by/i.test(m[0])) return;
        var rec = {
          name: m[0],
          city: m[1] || '',
          website: m[2] || '',
          types: parseTypes(m[3]),
          tier: m[4] || '',
          established: m[5] || '',
          country: c.country,
          region: c.region,
          flag: c.flag || ''
        };
        state.byKey[keyOf(rec.name, rec.country)] = rec;
        state.byKey[norm(rec.name)] = state.byKey[norm(rec.name)] || rec;
        state.names.push(rec);
      });
    });
    state.ready = true;
  }

  function profileUrl(name, country) {
    var q = 'company.html?c=' + encodeURIComponent(name);
    if (country) q += '&y=' + encodeURIComponent(country);
    return q;
  }

  function findByName(name, country) {
    if (!name) return null;
    var n = norm(name);
    if (country) {
      var exact = state.byKey[keyOf(name, country)];
      if (exact) return exact;
    }
    if (state.byKey[n]) return state.byKey[n];

    for (var i = 0; i < ALIASES.length; i++) {
      var a = ALIASES[i];
      for (var k = 0; k < a.keys.length; k++) {
        if (n === a.keys[k] || n.indexOf(a.keys[k]) !== -1 || a.keys[k].indexOf(n) !== -1) {
          var hit = state.byKey[keyOf(a.name, a.country)] || state.byKey[norm(a.name)];
          if (hit) return hit;
          return {
            name: a.name,
            country: a.country,
            types: [],
            city: '',
            website: '',
            tier: '',
            established: '',
            region: '',
            flag: ''
          };
        }
      }
    }

    // Fuzzy: directory name contained in query or vice-versa (min length 6)
    if (n.length >= 6) {
      for (var j = 0; j < state.names.length; j++) {
        var cand = state.names[j];
        var cn = norm(cand.name);
        if (cn.indexOf(n) !== -1 || n.indexOf(cn) !== -1) return cand;
      }
    }
    return null;
  }

  function resolveOemHref(name, fallbackUrl) {
    var found = findByName(name);
    if (found) return profileUrl(found.name, found.country);
    if (fallbackUrl && fallbackUrl !== 'manufacturers.html') return fallbackUrl;
    return 'manufacturers.html?q=' + encodeURIComponent(name || '');
  }

  function explorersForTypes(types) {
    var seen = Object.create(null);
    var out = [];
    parseTypes(types).forEach(function (t) {
      var meta = TYPE_META[t];
      if (!meta) return;
      meta.explorers.forEach(function (ex) {
        if (seen[ex.href]) return;
        seen[ex.href] = true;
        out.push({ href: ex.href, label: ex.label, tag: t });
      });
    });
    return out;
  }

  function allExplorers() {
    return [
      { href: 'power3d.html', label: 'Power transformers', tag: 'PT' },
      { href: 'power500.html', label: '500 kV power', tag: 'PT' },
      { href: 'explorer.html?mode=oil', label: 'Oil distribution', tag: 'DT' },
      { href: 'castresin3d.html', label: 'Cast resin / dry-type', tag: 'DRY' },
      { href: 'ct3d.html', label: 'Current transformers', tag: 'CT' }
    ];
  }

  function inferTags(text) {
    var tags = [];
    var blob = String(text || '');
    TAG_KEYWORDS.forEach(function (row) {
      if (row.re.test(blob)) tags.push(row.tag);
    });
    return tags;
  }

  function matchCompaniesInText(text) {
    var blob = norm(text);
    if (!blob) return [];
    var hits = [];
    var seen = Object.create(null);

    ALIASES.forEach(function (a) {
      a.keys.forEach(function (k) {
        if (k.length < 3) return;
        if (blob.indexOf(k) === -1) return;
        var rec = findByName(a.name, a.country) || { name: a.name, country: a.country, types: [] };
        var id = keyOf(rec.name, rec.country);
        if (seen[id]) return;
        seen[id] = true;
        hits.push(rec);
      });
    });

    // Also scan loaded directory for longer unique names present in text
    state.names.forEach(function (rec) {
      var cn = norm(rec.name);
      if (cn.length < 8) return;
      if (blob.indexOf(cn) === -1) return;
      var id = keyOf(rec.name, rec.country);
      if (seen[id]) return;
      seen[id] = true;
      hits.push(rec);
    });

    return hits;
  }

  function linkifyText(text) {
    var raw = String(text || '');
    if (!raw) return '';
    var companies = matchCompaniesInText(raw);
    if (!companies.length) return esc(raw);

    // Sort longer names first so "Hitachi Energy" wins over "Hitachi"
    var patterns = [];
    companies.forEach(function (c) {
      patterns.push(c.name);
      ALIASES.forEach(function (a) {
        if (norm(a.name) === norm(c.name) || a.keys.some(function (k) { return norm(c.name).indexOf(k) !== -1; })) {
          a.keys.forEach(function (k) {
            if (k.length >= 4) patterns.push(k);
          });
        }
      });
    });
    patterns = patterns
      .filter(function (p, i, arr) { return arr.indexOf(p) === i; })
      .sort(function (a, b) { return b.length - a.length; });

    var re = new RegExp('(' + patterns.map(function (p) {
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')', 'gi');

    return esc(raw).replace(re, function (match) {
      var rec = findByName(match) || matchCompaniesInText(match)[0];
      if (!rec) return match;
      return (
        '<a class="tp-dir-link" href="' +
        esc(profileUrl(rec.name, rec.country)) +
        '">' +
        match +
        '</a>'
      );
    });
  }

  function typePills(types) {
    return parseTypes(types)
      .map(function (t) {
        var meta = TYPE_META[t] || { label: t };
        return (
          '<span class="tpill t-' +
          esc(t) +
          '" title="' +
          esc(meta.full || meta.label) +
          '">' +
          esc(meta.label || t) +
          '</span>'
        );
      })
      .join('');
  }

  function enrichIntelItem(item) {
    var title = item.title || '';
    var snippet = item.snippet || '';
    var blob = title + ' ' + snippet;
    var explicitCompanies = Array.isArray(item.companies) ? item.companies : [];
    var companies = [];
    var seen = Object.create(null);

    explicitCompanies.forEach(function (name) {
      var rec = findByName(name) || { name: name, country: '', types: parseTypes(item.tags) };
      var id = keyOf(rec.name, rec.country || name);
      if (seen[id]) return;
      seen[id] = true;
      companies.push(rec);
    });

    matchCompaniesInText(blob).forEach(function (rec) {
      var id = keyOf(rec.name, rec.country);
      if (seen[id]) return;
      seen[id] = true;
      companies.push(rec);
    });

    var tags = parseTypes(item.tags);
    if (!tags.length) tags = inferTags(blob);
    companies.forEach(function (c) {
      parseTypes(c.types).forEach(function (t) {
        if (tags.indexOf(t) === -1) tags.push(t);
      });
    });

    return {
      companies: companies,
      tags: tags,
      titleHtml: linkifyText(title),
      snippetHtml: linkifyText(snippet),
      pillsHtml: typePills(tags),
      companyChipsHtml: companies
        .slice(0, 6)
        .map(function (c) {
          return (
            '<a class="tp-dir-chip" href="' +
            esc(profileUrl(c.name, c.country)) +
            '">' +
            esc(c.name) +
            (c.flag ? ' ' + c.flag : '') +
            '</a>'
          );
        })
        .join('')
    };
  }

  function intelCardHtml(item) {
    var e = enrichIntelItem(item);
    var metaBits = [];
    if (item.value) metaBits.push('<span class="val">' + esc(item.value) + '</span>');
    if (item.src) metaBits.push('<span class="src">' + esc(item.src) + '</span>');
    if (item.url) {
      metaBits.push(
        '<a class="plain" href="' +
          esc(item.url) +
          '" target="_blank" rel="noopener">source ↗</a>'
      );
    }
    // Title HTML may already contain OEM profile links — do not wrap in another <a>.
    return (
      '<div class="card">' +
      '<div class="card-title">' +
      e.titleHtml +
      (item.isNew ? '<span class="new-badge">NEW</span>' : '') +
      '</div>' +
      (e.pillsHtml || e.companyChipsHtml
        ? '<div class="tp-intel-tags">' + e.pillsHtml + e.companyChipsHtml + '</div>'
        : '') +
      '<div class="card-snippet">' +
      e.snippetHtml +
      '</div>' +
      '<div class="card-meta">' +
      metaBits.join(' · ') +
      '</div></div>'
    );
  }

  function relatedIntel(companyName, intelBuckets, limit) {
    var lim = limit || 8;
    var n = norm(companyName);
    var aliasKeys = [];
    ALIASES.forEach(function (a) {
      if (norm(a.name) === n || a.keys.some(function (k) { return n.indexOf(k) !== -1; })) {
        aliasKeys = aliasKeys.concat(a.keys);
      }
    });
    aliasKeys.push(n);
    var out = [];
    function consider(it, region) {
      var blob = norm((it.title || '') + ' ' + (it.snippet || ''));
      var hit = aliasKeys.some(function (k) { return k.length >= 4 && blob.indexOf(k) !== -1; });
      if (Array.isArray(it.companies)) {
        hit = hit || it.companies.some(function (c) { return norm(c).indexOf(n) !== -1 || n.indexOf(norm(c)) !== -1; });
      }
      if (!hit) return;
      out.push({ item: it, region: region || '' });
    }

    if (!intelBuckets) return out;
    if (Array.isArray(intelBuckets)) {
      intelBuckets.forEach(function (it) { consider(it, ''); });
    } else {
      Object.keys(intelBuckets).forEach(function (k) {
        var bucket = intelBuckets[k];
        var items = Array.isArray(bucket) ? bucket : (bucket && bucket.items) || [];
        items.forEach(function (it) { consider(it, (bucket && bucket.label) || k); });
      });
    }
    return out.slice(0, lim);
  }

  function explorerStripHtml(types, opts) {
    opts = opts || {};
    var explorers = explorersForTypes(types);
    if (!explorers.length && opts.fallbackAll) explorers = allExplorers();
    if (!explorers.length) return '';
    return (
      '<div class="tp-explorer-strip">' +
      explorers
        .map(function (ex) {
          return (
            '<a class="tp-explorer-link" href="' +
            esc(ex.href) +
            '"><span class="tpill t-' +
            esc(ex.tag || '') +
            '">' +
            esc(ex.tag || '3D') +
            '</span> ' +
            esc(ex.label) +
            ' →</a>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function getExpandedProfile(name, country) {
    var k1 = keyOf(name, country);
    var k2 = norm(name);
    return state.profiles[k1] || state.profiles[k2] || null;
  }

  function load(opts) {
    opts = opts || {};
    var manUrl = opts.manufacturersUrl || 'data/manufacturers.json';
    var profUrl = opts.profilesUrl || 'data/directory-profiles.json';
    return Promise.all([
      fetch(manUrl).then(function (r) {
        if (!r.ok) throw new Error('manufacturers ' + r.status);
        return r.json();
      }),
      fetch(profUrl)
        .then(function (r) {
          return r.ok ? r.json() : {};
        })
        .catch(function () {
          return {};
        })
    ]).then(function (pair) {
      var json = pair[0];
      var list = Array.isArray(json) ? json : json.data || [];
      ingestCountries(list);
      var profiles = pair[1] || {};
      state.profiles = Object.create(null);
      Object.keys(profiles).forEach(function (k) {
        state.profiles[norm(k)] = profiles[k];
      });
      return api;
    });
  }

  var api = {
    TYPE_META: TYPE_META,
    ALIASES: ALIASES,
    load: load,
    ingestCountries: ingestCountries,
    isReady: function () {
      return state.ready;
    },
    getCountries: function () {
      return state.countries;
    },
    findByName: findByName,
    profileUrl: profileUrl,
    resolveOemHref: resolveOemHref,
    parseTypes: parseTypes,
    typePills: typePills,
    explorersForTypes: explorersForTypes,
    allExplorers: allExplorers,
    explorerStripHtml: explorerStripHtml,
    matchCompaniesInText: matchCompaniesInText,
    linkifyText: linkifyText,
    inferTags: inferTags,
    enrichIntelItem: enrichIntelItem,
    intelCardHtml: intelCardHtml,
    relatedIntel: relatedIntel,
    getExpandedProfile: getExpandedProfile,
    esc: esc
  };

  root.TPDirectory = api;
})(typeof window !== 'undefined' ? window : globalThis);
