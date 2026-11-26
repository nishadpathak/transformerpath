/* Public editorial part index and safe RFQ draft builder. This module never submits an RFQ. */
(function(root) {
  'use strict';
  var index = {
  "parts": [
    {
      "id": "tom",
      "category": "bushing",
      "title": "TOM OIP bushing",
      "company": "Hitachi Energy",
      "slug": "hitachi-energy",
      "role": "Manufacturer"
    },
    {
      "id": "maddox-25kv",
      "category": "bushing",
      "title": "25 kV loadbreak bushing",
      "company": "Maddox Transformer",
      "slug": "maddox-transformer",
      "role": "Distributor / stockist"
    },
    {
      "id": "fibre-epoxy",
      "category": "bushing",
      "title": "Epoxy cast bushings",
      "company": "Fibre & Fibre Glass Products",
      "slug": "fibre-and-fibre-technologies-india-pvt-ltd",
      "role": "Manufacturer"
    },
    {
      "id": "massa-rip",
      "category": "bushing",
      "title": "Oil-to-air RIP bushings",
      "company": "Massa Izolyator Mehru",
      "slug": "massa-izolyator-mehru-private-limited",
      "role": "Manufacturer"
    },
    {
      "id": "nu-cork-kit",
      "category": "gasket",
      "title": "Rubberized cork transformer gaskets",
      "company": "Nu-Cork Products",
      "slug": "nu-cork-products-p-ltd",
      "role": "Manufacturer"
    },
    {
      "id": "arci-punched",
      "category": "gasket",
      "title": "Die-cut rubberised cork gaskets",
      "company": "Advance Rub Cork International",
      "slug": "advance-rub-cork-international",
      "role": "Manufacturer"
    },
    {
      "id": "amorim-td1120",
      "category": "gasket",
      "title": "TD1120 gasket material",
      "company": "Amorim T&D",
      "slug": "corticeira-amorim",
      "role": "Manufacturer"
    },
    {
      "id": "mac-r11",
      "category": "tap-changer",
      "title": "R11 on-load tap changer",
      "company": "Macpower Switchgear",
      "slug": "macpower-switchgear-pvt-ltd",
      "role": "Manufacturer"
    },
    {
      "id": "mac-rd11",
      "category": "tap-changer",
      "title": "RD11 on-load tap changer",
      "company": "Macpower Switchgear",
      "slug": "macpower-switchgear-pvt-ltd",
      "role": "Manufacturer"
    },
    {
      "id": "mr-vrs-iii-1300-y",
      "category": "tap-changer",
      "title": "VACUTAP VR · VRS III 1300 Y",
      "company": "Maschinenfabrik Reinhausen",
      "slug": "maschinenfabrik-reinhausen-mr-reinhausen-group",
      "role": "Manufacturer"
    }
  ],
  "categories": {
    "bushing": {
      "label": "Bushings",
      "rfq": "Bushings",
      "checklist": "Confirm voltage class, current, insulation technology, interface / flange drawing, conductor connection, insulation test requirements and creepage where applicable."
    },
    "gasket": {
      "label": "Gaskets",
      "rfq": "Other Components",
      "checklist": "Confirm material and transformer fluid, profile or approved drawing, ID/OD/thickness where applicable, and hardness or grade."
    },
    "tap-changer": {
      "label": "Tap changers",
      "rfq": "Tap-Changers (OLTC/DETC)",
      "checklist": "Confirm on-load or off-circuit duty, equipment voltage, through-current, step voltage, power flow, tap sequence and mounting/control interface."
    }
  }
};
  var MAX = 5;
  var lookup = Object.create(null);
  index.parts.forEach(function (part) { lookup[part.id] = part; });

  function decode(ids) {
    if (typeof ids !== 'string' || !/^[a-z0-9-]+(?:,[a-z0-9-]+){0,4}$/.test(ids) || ids.length > 200) return [];
    var chosen = ids.split(',').map(function (id) { return lookup[id]; });
    if (chosen.some(function (row) { return !row || row.category !== chosen[0].category; })) return [];
    if (new Set(chosen.map(function (row) { return row.id; })).size !== chosen.length) return [];
    return chosen;
  }

  function draft(ids) {
    var chosen = decode(ids);
    if (!chosen.length) return null;
    var group = index.categories[chosen[0].category];
    var supplierSlugs = Array.from(new Set(chosen.map(function (p) { return p.slug; })));
    var alternatives = chosen.map(function (p) { return '• ' + p.title + ' — ' + p.company + ' (' + p.role + ')'; });
    var details = ['Part family: ' + group.label, '', 'Shortlisted catalogue references (not confirmed equivalents):'].concat(alternatives, [
      '', 'Buyer requirement: [add your exact target specification and quantity]', group.checklist,
      'For each quote, please state the exact model/grade, deviations, applicable tests, minimum order, lead time, delivery terms and exclusions.'
    ]).join('\n');
    var query = new URLSearchParams({ parts: chosen.map(function (p) { return p.id; }).join(',') });
    return { category:group.rfq, details:details, supplierSlugs:supplierSlugs, url:'rfq.html?' + query.toString() + '#part-rfq-form' };
  }

  function rfqPrefill(doc, ids) {
    var d = draft(ids);
    var category = doc.getElementById('fld_category');
    var details = doc.getElementById('fld_details');
    var shortlist = doc.getElementById('fld_supplier_shortlist');
    var context = doc.getElementById('shortlistContext');
    if (!d || !category || !details || !shortlist || !Array.from(category.options).some(function (option) { return option.value === d.category; })) return false;
    if (category.value || details.value || shortlist.value) return false;
    category.value = d.category;
    details.value = d.details;
    shortlist.value = d.supplierSlugs.join(',');
    if (context) {
      context.textContent = 'Part shortlist: ' + d.supplierSlugs.length + ' suggested supplier' + (d.supplierSlugs.length === 1 ? '' : 's') + '. Check the draft and add your requirements. No RFQ has been sent.';
      context.style.display = 'block';
    }
    return true;
  }

  function tokenize(input) {
    return String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  }

  function filterMatch(haystack, query) {
    var tokens = tokenize(haystack);
    var combined = tokens.join(' ');
    var packed = tokens.join('');
    return tokenize(query).every(function (term) { return combined.includes(term) || packed.includes(term); });
  }

  var DAY = 86400000;
  var REPORT_KEY = 'tp_part_availability_draft_v1';
  var REPORT_MODELS = { bushing:'Bushing', 'tap-changer':'On-load tap changer (OLTC)' };
  var REPORT_STATES = { 'seller-stock':'Supplier reports stock', 'made-to-order':'Made to order', 'quote-required':'Quote required' };
  var REPORT_EVIDENCE = { 'seller-record':'Dated stock or order-system record', 'seller-statement':'Dated supplier statement', 'public-source':'Dated public product availability notice' };
  var REPORT_FIELDS = ['family', 'seller', 'model', 'country', 'status', 'evidence', 'confirmed', 'until', 'source'];
  var REPORT_ERROR = 'Prepare the required details and valid dates again.';

  function dateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    var date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? +date : NaN;
  }

  function safeEvidenceURL(value) {
    if (typeof value !== 'string' || !/^https:\/\//i.test(value) || value.length > 300 || /[#?]/.test(value)) return '';
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : '';
    } catch (err) { return ''; }
  }

  function availabilityReport(input, today) {
    var fields = {};
    REPORT_FIELDS.forEach(function (name) {
      fields[name] = input && typeof input[name] === 'string' ? input[name].replace(/\s+/g, ' ').trim() : '';
    });
    var textFields = [[fields.seller, 100], [fields.model, 120], [fields.country, 70]];
    if (!Object.hasOwn(REPORT_MODELS, fields.family) || !Object.hasOwn(REPORT_STATES, fields.status) || !Object.hasOwn(REPORT_EVIDENCE, fields.evidence) ||
        textFields.some(function (pair) { return !pair[0] || pair[0].length > pair[1] || /@/.test(pair[0]); })) {
      return { error:'Enter the required report details. Do not include email addresses in the part fields.' };
    }
    var now = dateValue(today), checked = dateValue(fields.confirmed), until = dateValue(fields.until);
    if (![now, checked, until].every(Number.isFinite) || checked > now || checked < now - 30 * DAY || until < now || until < checked || until > checked + 30 * DAY) {
      return { error:'Use a check date within the past 30 days and a validity date from today through 30 days after the check.' };
    }
    var source = fields.source ? safeEvidenceURL(fields.source) : '';
    if ((fields.source && !source) || (fields.evidence === 'public-source' && !source)) {
      return { error:'Enter a public HTTPS evidence link without query strings, fragments or sign-in details, or choose the appropriate private source type.' };
    }
    fields.source = source;
    return {
      fields:fields,
      message:[
        'Part availability report (supplier-declared, for editorial review)',
        'Family: ' + REPORT_MODELS[fields.family],
        'Supplier company: ' + fields.seller,
        'Manufacturer and exact model: ' + fields.model,
        'Dispatch country: ' + fields.country,
        'Supplier-stated status: ' + REPORT_STATES[fields.status],
        'Basis: ' + REPORT_EVIDENCE[fields.evidence],
        'Date checked: ' + fields.confirmed + ' (YYYY-MM-DD)',
        'Report valid through: ' + fields.until + ' (YYYY-MM-DD)',
        'Public evidence URL: ' + (fields.source || 'Not supplied. Request private evidence separately if needed.'),
        '',
        'Supplier declaration only. Please review privately; this is not independent stock verification or consent to publish supporting documents.'
      ].join('\n')
    };
  }

  function browserToday() { return new Date().toISOString().slice(0, 10); }

  function availabilityContact(doc, win) {
    if (!/^\/contact(?:\.html|\/)?$/.test(win.location.pathname) || win.location.hash !== '#cForm') return false;
    var topic = doc.getElementById('fld_topic');
    var message = doc.getElementById('fld_message');
    var status = doc.getElementById('contact-part-draft-status');
    if (!topic || !message || !status) return false;
    var stored = null;
    try {
      stored = win.sessionStorage.getItem(REPORT_KEY);
      if (stored === null) return false;
      win.sessionStorage.removeItem(REPORT_KEY);
    } catch (err) { return false; }
    status.hidden = false;
    if (message.value || (topic.value && topic.value !== 'General enquiry') || !Array.from(topic.options).some(function (option) { return option.value === 'Correct / update a listing'; })) {
      status.textContent = 'Your existing contact message was not overwritten. Return to Find a Part if you need to copy the availability draft.';
      return false;
    }
    var report;
    try { if (stored.length < 1800) report = availabilityReport(JSON.parse(stored), browserToday()); } catch (err) { /* No draft from malformed storage. */ }
    if (!report || report.error) {
      status.textContent = 'The availability draft could not be restored. ' + REPORT_ERROR;
      return false;
    }
    topic.value = 'Correct / update a listing';
    message.value = report.message;
    status.textContent = 'Availability report loaded as a draft. Review it and add your contact details only if you want to send it. Nothing has been sent.';
    return true;
  }

  function mountAvailability(doc, win) {
    var form = doc.getElementById('parts-availability-form');
    if (!form) return;
    var status = doc.getElementById('parts-availability-status');
    var panel = doc.getElementById('parts-availability-preview');
    var draftField = doc.getElementById('parts-availability-draft');
    var review = doc.getElementById('parts-availability-review');
    var fallback = doc.getElementById('parts-availability-fallback');
    var prepared = null;
    form.addEventListener('input', function () {
      if (prepared) status.textContent = 'Details changed. Prepare the report again before continuing.';
      prepared = null;
      panel.hidden = true;
      fallback.hidden = true;
      draftField.value = '';
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var inputs = {};
      REPORT_FIELDS.forEach(function (name) { inputs[name] = form.elements.namedItem(name).value; });
      var report = availabilityReport(inputs, browserToday());
      if (report.error) {
        prepared = null;
        panel.hidden = true;
        status.textContent = report.error;
        return;
      }
      prepared = report.fields;
      draftField.value = report.message;
      panel.hidden = false;
      fallback.hidden = true;
      status.textContent = 'Draft prepared here. Nothing has been sent.';
      draftField.focus();
    });
    review.addEventListener('click', function () {
      if (!prepared) return;
      var report = availabilityReport(prepared, browserToday());
      if (report.error) {
        prepared = null;
        panel.hidden = true;
        status.textContent = report.error;
        return;
      }
      try {
        win.sessionStorage.setItem(REPORT_KEY, JSON.stringify(report.fields));
        win.location.assign('/contact.html#cForm');
      } catch (err) {
        fallback.hidden = false;
        draftField.focus();
        draftField.select();
      }
    });
    form.hidden = false;
  }

  function partComparison(doc, target, chosen, cards) {
    function element(tag, value) {
      var node = doc.createElement(tag);
      if (value) node.textContent = value;
      return node;
    }
    target.replaceChildren();
    if (chosen.length < 2) return;
    var labels = new Set(), sourceRows = chosen.map(function (part) {
      var card = cards.find(function (node) { return node.dataset.partId === part.id; });
      var specs = new Map();
      if (card) card.querySelectorAll('.part-specs div').forEach(function (row) {
        var label = row.querySelector('dt').textContent.trim();
        var value = row.querySelector('dd').textContent.trim();
        if (label && value) { labels.add(label); specs.set(label, value); }
      });
      return {
        specs:specs,
        source:card && card.querySelector('.part-evidence a'),
        date:card && card.querySelector('.part-evidence time')
      };
    });
    var table = element('table');
    table.append(element('caption', 'Source-backed options in ' + index.categories[chosen[0].category].label));
    var thead = element('thead'), header = element('tr');
    ['Specification'].concat(chosen.map(function (part) { return part.title; })).forEach(function (title) {
      var cell = element('th', title);
      cell.scope = 'col';
      header.append(cell);
    });
    thead.append(header);
    table.append(thead);
    var tbody = element('tbody');
    function addRow(label, values) {
      var tr = element('tr'), entry = element('th', label);
      entry.scope = 'row';
      tr.append(entry);
      values.forEach(function (value) {
        var td = element('td');
        td.append(value || 'Not stated');
        tr.append(td);
      });
      tbody.append(tr);
    }
    addRow('Supplier and role', chosen.map(function (part) { return part.company + ' · ' + part.role; }));
    labels.forEach(function (label) { addRow(label, sourceRows.map(function (row) { return row.specs.get(label); })); });
    addRow('Evidence checked', sourceRows.map(function (row) {
      if (!row.date || !row.source) return null;
      var source = element('span'), link = element('a', 'Supplier specification');
      var href = row.source.getAttribute('href');
      if (!/^https:\/\//i.test(href || '')) return null;
      link.href = href;
      source.append(row.date.cloneNode(true), ' · ', link);
      return source;
    }));
    table.append(tbody);
    target.append(table);
  }

  function mount(doc, win) {
    availabilityContact(doc, win);
    mountAvailability(doc, win);
    var host = doc.getElementById('parts-app');
    if (!host) return;
    var filters = doc.getElementById('parts-filters');
    var search = doc.getElementById('part-search');
    var category = doc.getElementById('part-category');
    var role = doc.getElementById('part-role');
    var cards = Array.from(host.querySelectorAll('[data-part-id]'));
    var count = doc.getElementById('parts-result-count');
    var empty = doc.getElementById('parts-empty');
    var panel = doc.getElementById('part-shortlist');
    var list = doc.getElementById('parts-selected');
    var status = doc.getElementById('parts-selection-status');
    var rfqLink = doc.getElementById('parts-rfq');
    var detailsBox = doc.getElementById('parts-draft-box');
    var details = doc.getElementById('parts-draft');
    var comparison = doc.getElementById('parts-comparison');
    var comparisonTable = doc.getElementById('parts-comparison-table');
    var jump = doc.getElementById('parts-shortlist-jump');
    var storageKey = 'tp_parts_shortlist_pilot_v1';
    var selected = [];
    try { selected = decode(win.localStorage.getItem(storageKey)).map(function (p) { return p.id; }); } catch (err) { /* Browsing still works without storage. */ }
    var params = new URLSearchParams(win.location.search);
    var initialCategory = params.get('category');
    if (Object.hasOwn(index.categories, initialCategory)) category.value = initialCategory;
    var searchable = cards.map(function (card) { return { card:card, row:lookup[card.dataset.partId], text:card.textContent }; });

    function applyFilters() {
      var visible = 0;
      searchable.forEach(function (item) {
        var row = item.row;
        var show = row && (!category.value || row.category === category.value) && (!role.value || row.role === role.value) && filterMatch(item.text, search.value);
        item.card.hidden = !show;
        if (show) visible++;
      });
      count.textContent = visible + (visible === 1 ? ' sourced option' : ' sourced options');
      empty.hidden = visible !== 0;
    }

    function updateShortlist() {
      var parsed = decode(selected.join(','));
      var d = draft(selected.join(','));
      list.replaceChildren();
      parsed.forEach(function (p) {
        var item = doc.createElement('li');
        item.textContent = p.title + ' · ' + p.company;
        var remove = doc.createElement('button');
        remove.type = 'button';
        remove.className = 'part-action';
        remove.dataset.removePart = p.id;
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', 'Remove ' + p.title + ' from shortlist');
        item.append(' ', remove);
        list.append(item);
      });
      host.querySelectorAll('[data-shortlist]').forEach(function (button) {
        var active = selected.includes(button.dataset.shortlist);
        button.setAttribute('aria-pressed', String(active));
        button.textContent = active ? 'Shortlisted' : 'Shortlist';
        button.hidden = false;
      });
      var compare = parsed.length >= 2;
      comparison.hidden = !compare;
      if (!compare) comparison.open = false;
      partComparison(doc, comparisonTable, parsed, cards);
      jump.hidden = !parsed.length;
      jump.textContent = (compare ? 'Compare / shortlist' : 'Go to shortlist') + ' (' + parsed.length + ')';
      detailsBox.hidden = !d;
      rfqLink.hidden = !d;
      if (d) {
        details.textContent = d.details;
        rfqLink.href = d.url;
      } else {
        details.textContent = '';
        rfqLink.removeAttribute('href');
      }
      status.textContent = parsed.length ? parsed.length + ' of ' + MAX + ' items shortlisted.' : 'No items selected.';
      try { win.localStorage.setItem(storageKey, selected.join(',')); } catch (err) { /* No storage needed to create a draft. */ }
    }

    host.addEventListener('click', function (event) {
      var button = event.target.closest('[data-shortlist], [data-remove-part]');
      if (!button) return;
      var id = button.dataset.shortlist || button.dataset.removePart;
      var part = lookup[id];
      if (!part) return;
      var position = selected.indexOf(id);
      if (position >= 0) selected.splice(position, 1);
      else if (selected.length >= MAX) {
        status.textContent = 'The shortlist is full. Remove an item before adding another.';
        return;
      } else if (selected.length && lookup[selected[0]].category !== part.category) {
        status.textContent = 'Each RFQ covers one part family. Open your current draft or remove its items before starting a different family.';
        return;
      } else selected.push(id);
      updateShortlist();
      if (button.hasAttribute('data-remove-part')) {
        var next = list.querySelectorAll('[data-remove-part]')[Math.min(position, Math.max(0, list.children.length - 1))];
        (next || panel.querySelector('h2')).focus();
      }
    });
    jump.addEventListener('click', function () {
      panel.querySelector('h2').focus();
      if (!comparison.hidden) comparison.open = true;
    });
    filters.addEventListener('submit', function (e) { e.preventDefault(); applyFilters(); });
    filters.addEventListener('input', applyFilters);
    filters.addEventListener('reset', function () { win.setTimeout(applyFilters, 0); });
    panel.querySelector('h2').tabIndex = -1;
    filters.hidden = false;
    panel.hidden = false;
    applyFilters();
    updateShortlist();
  }

  var api = { draft:draft, decode:decode, filterMatch:filterMatch, rfqPrefill:rfqPrefill, availabilityReport:availabilityReport, max:MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.document) {
    root.TPParts = api;
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { mount(root.document, root); });
    else mount(root.document, root);
  }
})(typeof globalThis === 'object' ? globalThis : this);
