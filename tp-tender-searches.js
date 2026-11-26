/* Private, on-device saved searches for the public Transformer Tenders board. */
(function () {
  'use strict';
  var panel = document.getElementById('tenderSavedSearches');
  if (!panel) return;
  var views = {
    open: document.getElementById('viewOpen'),
    pipeline: document.getElementById('viewPipeline'),
    expired: document.getElementById('viewExpired')
  };
  var rows = {
    open: document.getElementById('openView'),
    pipeline: document.getElementById('pipelineView'),
    expired: document.getElementById('expiredView')
  };
  var fields = {
    product: document.getElementById('productFilter'),
    category: document.getElementById('categoryFilter'),
    country: document.getElementById('countryFilter'),
    region: document.getElementById('regionFilter')
  };
  var keyword = document.getElementById('keywordFilter');
  var scope = document.getElementById('scopeFilter');
  if (!views.open || !views.pipeline || !views.expired || !keyword || !scope ||
      Object.keys(fields).some(function (key) { return !fields[key]; })) return;
  var list = document.getElementById('tenderSavedSelect');
  var nameInput = document.getElementById('tenderSavedName');
  var notice = document.getElementById('tenderSavedStatus');
  var count = document.getElementById('tenderResultCount');
  var open = document.getElementById('tenderSavedOpen');
  var remove = document.getElementById('tenderSavedDelete');
  var save = document.getElementById('tenderSavedSave');
  var share = document.getElementById('tenderSavedShare');
  var fallback = document.getElementById('tenderShareFallback');
  var shareInput = document.getElementById('tenderShareLink');
  var storeKey = 'tp_tender_searches_v1';
  var maxSaved = 12;
  var selectedId = '';
  var canSave = true;
  var stored = loadSaved();

  function text(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  function optionValue(field, value, preserve) {
    var requested = text(value, 120);
    if (!requested || /[\x00-\x1F\x7F]/.test(requested) || !field) return '';
    var target = requested.toLowerCase();
    var option = Array.prototype.find.call(field.options, function (o) { return o.value.toLowerCase() === target; });
    if (option) return option.value;
    if (!preserve) return '';
    // A country/product can disappear from a later board revision. Keep the
    // intended filter rather than silently broadening a saved search.
    option = document.createElement('option');
    option.value = requested;
    option.textContent = requested + ' (not in current list)';
    option.setAttribute('data-tender-stale-option', '');
    field.appendChild(option);
    return option.value;
  }

  function normalise(raw, preserve) {
    raw = raw || {};
    var state = {
      view: Object.prototype.hasOwnProperty.call(views, raw.view) ? raw.view : 'open',
      q: text(raw.q, 120),
      scope: raw.scope === 'confirmed' ? 'confirmed' : ''
    };
    Object.keys(fields).forEach(function (key) { state[key] = optionValue(fields[key], raw[key], preserve); });
    return state;
  }

  function current() {
    var state = {
      view: Object.keys(views).find(function (key) { return views[key].getAttribute('aria-pressed') === 'true'; }),
      q: keyword.value,
      scope: scope.getAttribute('aria-pressed') === 'true' ? 'confirmed' : ''
    };
    Object.keys(fields).forEach(function (key) { state[key] = fields[key].value; });
    return normalise(state);
  }

  function apply(state) {
    Object.keys(fields).forEach(function (key) {
      fields[key].querySelectorAll('[data-tender-stale-option]').forEach(function (option) { option.remove(); });
    });
    state = normalise(state, true);
    Object.keys(fields).forEach(function (key) { fields[key].value = state[key]; });
    keyword.value = state.q;
    scope.setAttribute('aria-pressed', state.scope ? 'true' : 'false');
    // Use the site’s existing status/filter handler so counts and rows agree.
    views[state.view].click();
    resultCount();
  }

  function loadSaved() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(storeKey) || '[]');
      if (!Array.isArray(parsed)) return [];
      var ids = new Set();
      return parsed.slice(0, maxSaved).reduce(function (out, raw) {
        if (!raw || typeof raw.id !== 'string' || !/^ts-[a-z0-9-]{1,64}$/.test(raw.id) || ids.has(raw.id)) return out;
        var name = text(raw.name, 70);
        if (!name || !raw.state || typeof raw.state !== 'object') return out;
        ids.add(raw.id);
        out.push({ id: raw.id, name: name, state: raw.state });
        return out;
      }, []);
    } catch (error) {
      // Corrupt JSON can be replaced; denied/unavailable storage cannot.
      if (!(error instanceof SyntaxError)) canSave = false;
      return [];
    }
  }

  function persist(next) {
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(next));
      stored = next;
      return true;
    } catch (_) {
      notice.textContent = 'This browser did not save the search. You can still copy a link.';
      return false;
    }
  }

  function describe(s) {
    var tags = [views[s.view].textContent.trim()];
    [fields.country, fields.region, fields.product, fields.category].forEach(function (field) {
      if (field.selectedIndex > 0) tags.push(field.options[field.selectedIndex].textContent);
    });
    if (s.scope) tags.push('Confirmed scope');
    if (s.q) tags.push(s.q);
    return text(tags.join(' · '), 70);
  }

  function refreshList(id) {
    selectedId = id || '';
    list.textContent = '';
    var blank = document.createElement('option');
    blank.textContent = stored.length ? 'Choose a saved search' : 'No saved searches yet';
    blank.value = '';
    list.appendChild(blank);
    stored.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      list.appendChild(option);
    });
    list.value = selectedId;
    selectionChanged();
  }

  function selectionChanged() {
    selectedId = list.value;
    open.disabled = !selectedId;
    remove.disabled = !selectedId;
  }

  function resultCount() {
    var state = current();
    var visible = Array.prototype.filter.call(rows[state.view].querySelectorAll('.t-row'), function (row) {
      return !row.hidden && row.style.display !== 'none';
    }).length;
    count.textContent = visible + (visible === 1 ? ' matching tender in ' : ' matching tenders in ') +
      views[state.view].textContent.trim() + '.';
  }

  function filteredURL() {
    var state = current();
    var url = new URL('/tenders.html', window.location.origin);
    ['view', 'country', 'region', 'product', 'category', 'scope', 'q'].forEach(function (key) {
      if (state[key] && !(key === 'view' && state[key] === 'open')) url.searchParams.set(key, state[key]);
    });
    return url.href;
  }

  list.addEventListener('change', selectionChanged);
  save.addEventListener('click', function () {
    if (!canSave) return;
    var state = current();
    var name = text(nameInput.value, 70) || describe(state);
    var existing = stored.find(function (item) { return item.name.toLowerCase() === name.toLowerCase(); });
    if (!existing && stored.length >= maxSaved) {
      notice.textContent = 'This device holds up to ' + maxSaved + ' searches. Remove one or save with an existing name to replace it.';
      return;
    }
    var id = existing ? existing.id : ('ts-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
    var next = stored.filter(function (item) { return item.id !== id; });
    next.unshift({ id: id, name: name, state: state });
    if (!persist(next)) return;
    refreshList(id);
    nameInput.value = '';
    notice.textContent = (existing ? 'Updated “' : 'Saved “') + name + '” on this device.';
  });

  open.addEventListener('click', function () {
    var match = stored.find(function (item) { return item.id === selectedId; });
    if (!match) return;
    apply(match.state);
    nameInput.value = match.name;
    notice.textContent = 'Opened “' + match.name + '” against the tenders loaded on this page.';
  });

  remove.addEventListener('click', function () {
    var match = stored.find(function (item) { return item.id === selectedId; });
    if (!match || !persist(stored.filter(function (item) { return item.id !== selectedId; }))) return;
    refreshList('');
    if (nameInput.value === match.name) nameInput.value = '';
    notice.textContent = 'Removed “' + match.name + '” from this device.';
    list.focus();
  });

  share.addEventListener('click', function () {
    var href = filteredURL();
    function manual() {
      fallback.hidden = false;
      shareInput.value = href;
      shareInput.focus();
      shareInput.select();
      notice.textContent = 'The link is ready to copy. It includes the current filters, not your saved searches.';
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) { manual(); return; }
    try {
      navigator.clipboard.writeText(href).then(function () {
        fallback.hidden = true;
        notice.textContent = 'Copied a link to these filters. No saved search names are shared.';
      }, manual);
    } catch (_) { manual(); }
  });

  // A link can start the same view on another device, independently of storage.
  var params = new URLSearchParams(window.location.search);
  var linked = {};
  ['view', 'country', 'region', 'product', 'category', 'scope', 'q'].forEach(function (key) {
    if (params.has(key)) linked[key] = params.get(key);
  });
  if (Object.keys(linked).length) apply(linked);
  Object.keys(views).forEach(function (key) { views[key].addEventListener('click', resultCount); });
  Object.keys(fields).forEach(function (key) { fields[key].addEventListener('change', resultCount); });
  scope.addEventListener('click', resultCount);
  keyword.addEventListener('input', resultCount);
  window.addEventListener('storage', function (event) {
    if (event.key === storeKey || event.key === null) {
      stored = loadSaved();
      refreshList(selectedId);
    }
  });
  if (!canSave) {
    nameInput.disabled = true;
    save.disabled = true;
    notice.textContent = 'Storage is not available in this browser. You can still copy a link.';
  }
  refreshList('');
  resultCount();
  panel.hidden = false;
})();
