/* Prerender directory and vendor listing HTML from data/directory-index.json.
 * Missing text stays an em dash. The browser script still replaces this
 * default view after the index loads.
 */
'use strict';

var countrySort = require('./directory-sort');

var VENDOR_KIND_LABELS = {
  manufacturer: 'Transformer OEM',
  component_supplier: 'Components & Accessories',
  machinery_manufacturer: 'Machinery Maker',
  testing_laboratory: 'Testing Laboratory',
  service_repair: 'Service & Repair',
  transport_logistics: 'Transport & Logistics',
  industry_association: 'Industry Association',
  education_provider: 'Education Provider',
  buyer_procurement: 'Buyer & Utility',
  media_publication: 'Media & Publication'
};

var VENDOR_KIND_ICONS = {
  manufacturer: '⚡',
  component_supplier: '🧩',
  machinery_manufacturer: '⚙️',
  testing_laboratory: '🔬',
  service_repair: '🛠️',
  transport_logistics: '🚢',
  industry_association: '🏛️',
  education_provider: '🎓',
  buyer_procurement: '🏢',
  media_publication: '📰'
};

var DIR_KIND_LABELS = {
  manufacturer: 'Transformer OEM',
  component_supplier: 'Components & Accessories',
  machinery_manufacturer: 'Machinery Maker',
  testing_laboratory: 'Testing Laboratory',
  service_repair: 'Service & Repair',
  transport_logistics: 'Transport & Logistics',
  industry_association: 'Industry Association',
  education_provider: 'Education & Training',
  buyer_procurement: 'Buyer & Utility',
  media_publication: 'Media & Journal'
};

var DIR_KIND_ICONS = {
  manufacturer: '⚡',
  component_supplier: '🧩',
  machinery_manufacturer: '⚙️',
  testing_laboratory: '🔬',
  service_repair: '🛠️',
  transport_logistics: '🚢',
  industry_association: '🏛️',
  education_provider: '🎓',
  buyer_procurement: '🏢',
  media_publication: '📰'
};

var EV = {
  CONFIRMED: 'Confirmed',
  COMPANY_REPORTED: 'Company reported',
  INFERRED: 'Inferred',
  UNKNOWN: 'Unknown'
};
var EV_CLASS = {
  CONFIRMED: 'ev-confirmed',
  COMPANY_REPORTED: 'ev-reported',
  INFERRED: 'ev-inferred',
  UNKNOWN: 'ev-unknown'
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dash(value) {
  var s = String(value == null ? '' : value).trim();
  return s || '—';
}

function countryCounts(companies) {
  var counts = {};
  companies.forEach(function (c) {
    if (!c || !c.country) return;
    counts[c.country] = (counts[c.country] || 0) + 1;
  });
  return counts;
}

function stats(companies) {
  var list = companies || [];
  var countries = countryCounts(list);
  return {
    total: list.length,
    oem: list.filter(function (c) { return c.kind === 'manufacturer'; }).length,
    components: list.filter(function (c) { return c.kind === 'component_supplier'; }).length,
    countries: Object.keys(countries).length,
    countryCounts: countries
  };
}

function vendorProfileUrl(c) {
  if (c.canonical_id) return 'company.html?id=' + encodeURIComponent(c.canonical_id);
  if (c.id && c.id.indexOf('cmp:') === 0) return 'company.html?id=' + encodeURIComponent(c.id);
  if (c.kind === 'manufacturer' && c.slug) return 'manufacturers/' + encodeURIComponent(c.slug) + '/';
  if (c.slug) return 'company.html?c=' + encodeURIComponent(c.slug);
  return c.website || '#';
}

function vendorCard(c) {
  var kIcon = VENDOR_KIND_ICONS[c.kind] || '🏢';
  var kLbl = VENDOR_KIND_LABELS[c.kind] || c.kind || '—';
  var loc = [c.headquarters, c.country].filter(Boolean).join(', ') || c.country || '—';
  var caps = (c.capability_labels || []).slice(0, 5);
  var roleList = (c.roles && c.roles.length) ? c.roles : [kLbl];
  var roleBadges = roleList.map(function (r) {
    return '<span class="vnd-badge">' + kIcon + ' ' + esc(r) + '</span>';
  }).join(' ');
  var facBadge = (c.factory_count && c.factory_count > 1)
    ? '<span class="vnd-badge" style="background:rgba(245,166,35,.14);color:var(--amber)">🏭 ' + c.factory_count + ' Plants</span>'
    : '';
  return '<div class="vnd-card">' +
    '<div>' +
      '<div class="vnd-card-head">' +
        '<div style="display:flex; align-items:flex-start; gap:8px;">' +
          '<input type="checkbox" class="vnd-select" data-name="' + esc(c.name) + '" title="Select to compare / multi-RFQ" style="margin-top:4px; accent-color:var(--amber); cursor:pointer;">' +
          '<a href="' + esc(vendorProfileUrl(c)) + '" class="vnd-name">' + esc(dash(c.name)) + '</a>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">' + roleBadges + facBadge + '</div>' +
      '</div>' +
      '<div class="vnd-loc" style="padding-left:22px">📍 ' + esc(loc) + '</div>' +
      (caps.length ? '<div class="vnd-caps" style="padding-left:22px">' + caps.map(function (l) { return '<span class="vnd-cap">' + esc(l) + '</span>'; }).join('') + '</div>' : '') +
    '</div>' +
    '<div class="vnd-foot">' +
      (c.website ? '<a href="' + esc(c.website) + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="font-size:.76rem">Site ↗</a>' : '<span></span>') +
      '<a href="rfq.html?company=' + encodeURIComponent(c.name || '') + '" class="btn btn-amber btn-sm" style="font-size:.76rem">Inquire / RFQ →</a>' +
    '</div>' +
  '</div>';
}

function vendors(companies) {
  var list = companies || [];
  var view = stats(list);
  var shown = list.slice(0, 75);
  var cards = shown.map(vendorCard).join('');
  var note = list.length > 75
    ? '<p style="grid-column:1/-1;text-align:center;color:var(--muted);font-size:.85rem;padding:14px 0">Showing 75 of ' + list.length + ' matching suppliers — refine with the search bar or country filter.</p>'
    : '';
  var names = countrySort.sortCountries(Object.keys(view.countryCounts));
  var options = '<option value="">All Countries</option>' + names.map(function (cc) {
    return '<option value="' + esc(cc) + '">' + esc(cc) + ' (' + view.countryCounts[cc] + ')</option>';
  }).join('');
  return {
    total: view.total,
    oem: view.oem,
    components: view.components,
    countries: view.countries,
    countryOptions: options,
    listHtml: cards + note
  };
}

function directoryProfileUrl(c) {
  var slug = c.slug ? String(c.slug).replace(/^(acc|mach|lab|srv|log|asc|edu|buy|med):/, '') : '';
  if (c.kind === 'manufacturer' && slug) return 'manufacturers/' + esc(slug) + '/';
  if (c.kind === 'component_supplier') return slug ? 'accessories/' + esc(slug) + '/' : 'accessories.html';
  if (c.kind === 'machinery_manufacturer') return 'machinery.html';
  if (c.kind === 'testing_laboratory') return 'laboratories.html';
  if (c.kind === 'service_repair') return 'services.html';
  if (c.kind === 'transport_logistics') return 'logistics.html';
  if (c.kind === 'industry_association') return 'associations.html';
  if (c.kind === 'education_provider') return 'education.html';
  if (c.kind === 'buyer_procurement') return 'buyers.html';
  if (c.kind === 'media_publication') return 'media.html';
  return c.website || '#';
}

function completeness(c) {
  if (c.completeness_score != null) return c.completeness_score;
  if (c.research_completeness) return Math.min(100, c.research_completeness * 15);
  return 40;
}

function claimListingLink(c) {
  if (!c || c.kind !== 'manufacturer') return '';
  var slug = String(c.slug || '').trim().toLowerCase();
  var href = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? '/claim-listing/' + slug + '/' : '/claim-listing/';
  return '<a class="btn btn-outline btn-sm claim-listing-link" href="' + esc(href) + '" data-claim-listing="1">Claim this listing</a>';
}

function directoryCard(c) {
  var compScore = completeness(c);
  var compClass = compScore >= 70 ? 'kg-comp-high' : (compScore >= 45 ? 'kg-comp-mid' : 'kg-comp-low');
  var isUhv = c.voltage && c.voltage.num && c.voltage.num >= 765;
  var isEhv = c.voltage && c.voltage.num && c.voltage.num >= 400 && !isUhv;
  var specs = [];
  if (c.voltage && c.voltage.value) {
    specs.push('<span class="kg-spec-pill ' + (isUhv ? 'uhv' : (isEhv ? 'ehv' : '')) + '">⚡ ' + esc(c.voltage.value) + (isUhv ? ' UHV' : (isEhv ? ' EHV' : '')) + '</span>');
  }
  if (c.mva && c.mva.value) specs.push('<span class="kg-spec-pill">📦 ' + esc(c.mva.value) + '</span>');
  if (c.factories && c.factories.length) {
    specs.push('<span class="kg-spec-pill fac">🏭 ' + c.factories.length + ' Plant' + (c.factories.length !== 1 ? 's' : '') + '</span>');
  }
  if (c.certs && c.certs.length) specs.push('<span class="kg-spec-pill">📜 ' + esc(c.certs.slice(0, 2).join(', ')) + '</span>');
  var kindIcon = DIR_KIND_ICONS[c.kind] || '🏢';
  var kindText = DIR_KIND_LABELS[c.kind] || c.kind || '—';
  var evidence = c.evidence || 'UNKNOWN';
  var provenance = (c.sources && c.sources.capability_source) ? c.sources.capability_source : (c.provenance_type || '—');
  return '<div class="kg-card" data-id="' + esc(c.id) + '">' +
    '<div class="kg-card-check"><input type="checkbox" title="Select for side-by-side comparison" data-cmp="' + esc(c.id) + '"></div>' +
    '<div class="kg-card-main">' +
      '<div class="kg-card-head">' +
        '<a class="kg-card-title" href="' + directoryProfileUrl(c) + '" data-track="directory_profile_click" data-track-entity="' + esc(c.name) + '" data-track-kind="' + esc(c.kind) + '" data-track-country="' + esc(c.country) + '">' + esc(dash(c.name)) + '</a>' +
        '<span class="kg-card-loc">' + esc(dash(c.country)) + (c.region ? ' · ' + esc(c.region) : '') + '</span>' +
        '<span class="dir-tag" style="background:rgba(245,166,35,.12);border-color:var(--amber);color:var(--text);font-weight:700">' + kindIcon + ' ' + esc(kindText) + '</span>' +
        '<span class="ev-badge ' + (EV_CLASS[evidence] || 'ev-unknown') + '">' + esc(EV[evidence] || evidence) + '</span>' +
      '</div>' +
      (specs.length ? '<div class="kg-card-specs">' + specs.join('') + '</div>' : '') +
      '<div class="dir-tags">' + (c.capability_labels || []).slice(0, 6).map(function (l) { return '<span class="dir-tag">' + esc(l) + '</span>'; }).join('') + '</div>' +
      '<div class="kg-comp-wrapper"><span>Completeness: <b>' + compScore + '%</b></span><span class="kg-comp-bar"><span class="kg-comp-fill ' + compClass + '" style="width:' + compScore + '%"></span></span><span style="font-size:.72rem;color:var(--muted)">· Provenance: ' + esc(provenance) + '</span></div>' +
    '</div>' +
    '<div class="kg-card-actions">' +
      '<a class="btn btn-amber btn-sm" href="rfq.html?company=' + encodeURIComponent(c.name || '') + '" data-track="rfq_started_directory" data-track-entity="' + esc(c.name) + '">RFQ</a>' +
      '<a class="btn btn-outline btn-sm" href="' + directoryProfileUrl(c) + '" data-track="directory_profile_click" data-track-entity="' + esc(c.name) + '">Profile →</a>' +
      (c.website ? '<a class="btn btn-outline btn-sm" href="' + esc(c.website) + '" target="_blank" rel="noopener" style="font-size:.72rem" data-track="official_website_click" data-track-entity="' + esc(c.name) + '">Site ↗</a>' : '') +
      claimListingLink(c) +
    '</div>' +
  '</div>';
}

function directoryRoot(companies, siteStats) {
  var list = companies || [];
  var view = stats(list);
  var kinds = {};
  list.forEach(function (c) { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
  var names = countrySort.sortCountries(Object.keys(view.countryCounts));
  var statsDoc = siteStats || {};
  var tabs = [
    { key: '', label: '🌐 All Ecosystem', count: list.length },
    { key: 'manufacturer', label: '⚡ Manufacturers', count: kinds.manufacturer || 0 },
    { key: 'component_supplier', label: '🧩 Components & Materials', count: kinds.component_supplier || 0 },
    { key: 'service_repair', label: '🛠️ Service & Repair', count: kinds.service_repair || 0 },
    { key: 'transport_logistics', label: '🚢 Logistics', count: kinds.transport_logistics || 0 },
    { key: 'testing_laboratory', label: '🔬 Testing Labs', count: kinds.testing_laboratory || 0 },
    { key: 'machinery_manufacturer', label: '⚙️ Machinery', count: kinds.machinery_manufacturer || 0 },
    { key: 'industry_association', label: '🏛️ Associations', count: kinds.industry_association || 0 },
    { key: 'education_provider', label: '🎓 Education', count: kinds.education_provider || 0 },
    { key: 'buyer_procurement', label: '🏢 Buyers', count: kinds.buyer_procurement || 0 },
    { key: 'media_publication', label: '📰 Media', count: kinds.media_publication || 0 }
  ].filter(function (t) { return t.key === '' || t.count > 0; });
  var tabsHtml = tabs.map(function (t) {
    return '<button class="kg-tab-btn ' + (t.key === '' ? 'active' : '') + '" data-set-kind="' + esc(t.key) + '">' + t.label + ' <span class="badge-cnt">' + t.count + '</span></button>';
  }).join('');
  var typeOpts = ['power', 'distribution', 'dry_type', 'special'].map(function (t) {
    var label = t.replace(/_/g, ' ').replace(/^./, function (ch) { return ch.toUpperCase(); });
    return '<option value="' + t + '">' + label + '</option>';
  }).join('');
  var shown = list.slice(0, 60);
  var more = list.length > 60
    ? '<p class="dir-more-note" style="text-align:center;color:var(--muted);font-size:.85rem;padding:12px 0 24px">Showing top 60 matches — use the search bar or filters above to refine your shortlist.</p>'
    : '';
  return '<div class="kg-hero-banner">' +
    '<nav style="font-size:.82rem;color:var(--muted);margin-bottom:10px"><a href="index.html" style="color:var(--amber)">Home</a> › Transformer Industry Directory</nav>' +
    '<p style="margin:0 0 6px;color:#fff;font-size:1.15rem;font-weight:700;letter-spacing:-.02em">Search the industry knowledge graph</p>' +
    '<p style="color:#b8c4d4;font-size:.95rem;margin:0;max-width:840px;line-height:1.5">An interconnected, sourced database connecting power and distribution transformer OEMs, component &amp; material suppliers, service contractors, heavy transport, testing laboratories, associations, training academies, and buyers. <b>Factual evidence, sourced records, zero subjective rankings.</b></p>' +
    '<div class="kg-kpi-grid">' +
      '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (statsDoc.manufacturers || kinds.manufacturer || list.length) + '</div><div class="kg-kpi-lbl">Manufacturers</div></div>' +
      '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (statsDoc.factories || '—') + '</div><div class="kg-kpi-lbl">Sourced plants</div></div>' +
      '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (statsDoc.capabilities || '—') + '</div><div class="kg-kpi-lbl">Capabilities</div></div>' +
      '<div class="kg-kpi-box"><div class="kg-kpi-val">' + (statsDoc.manufacturingCountries || names.length) + '</div><div class="kg-kpi-lbl">Countries</div></div>' +
      '<div class="kg-kpi-box"><div class="kg-kpi-val">' + list.length + '</div><div class="kg-kpi-lbl">Indexed entities</div></div>' +
    '</div></div>' +
    '<div class="kg-tabs-bar" style="overflow-x:auto;white-space:nowrap;padding-bottom:6px">' + tabsHtml + '</div>' +
    '<div class="kg-quick-bar">' +
      '<span class="kg-quick-lbl">Quick Filters:</span>' +
      '<button class="kg-quick-pill" data-set-minkv="400">⚡ ≥400 kV (EHV)</button>' +
      '<button class="kg-quick-pill" data-set-minkv="765">⚡ 765 kV (UHV)</button>' +
      '<button class="kg-quick-pill" data-toggle="multiPlant">🏭 Multi-Plant OEMs</button>' +
      '<button class="kg-quick-pill" data-set-ev="CONFIRMED">✅ Confirmed Evidence</button>' +
      '<button class="kg-quick-pill" data-set-mincomp="70">⭐ ≥70% Profile Completeness</button>' +
    '</div>' +
    '<div class="dir-controls">' +
      '<input id="dirQ" type="search" placeholder="Search entity, capability, brand or keyword (e.g. 400 kV, OLTC, pressboard, VPD, Georg, KEMA)..." value="">' +
      '<select id="dirCountry"><option value="">All Countries (' + names.length + ')</option>' + names.map(function (cc) {
        return '<option value="' + esc(cc) + '">' + esc(cc) + ' (' + view.countryCounts[cc] + ')</option>';
      }).join('') + '</select>' +
      '<select id="dirType"><option value="">All Transformer Types</option>' + typeOpts + '</select>' +
      '<select id="dirKv"><option value="0">Any Voltage Class</option><option value="110">110 kV+ (HV)</option><option value="220">220 kV+ (HV)</option><option value="400">400 kV+ (EHV)</option><option value="765">765 kV+ (UHV)</option></select>' +
      '<select id="dirEv"><option value="">Any Evidence Level</option><option value="CONFIRMED">Confirmed</option><option value="COMPANY_REPORTED">Company Reported</option><option value="INFERRED">Inferred</option><option value="UNKNOWN">Unknown</option></select>' +
      '<button id="dirClear" class="btn btn-outline btn-sm">Reset</button>' +
    '</div>' +
    '<div class="dir-count" style="display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:.85rem;margin:14px 0 10px">' +
      '<span>Showing <b>' + list.length + '</b> of ' + list.length + ' directory records</span>' +
      '<span style="font-size:.8rem;color:var(--accent);font-weight:600">Tip: Select up to 5 entities to compare side-by-side</span>' +
    '</div>' +
    '<div id="dirCompare" class="dir-compare"></div>' +
    '<div class="dir-list">' + shown.map(directoryCard).join('') + '</div>' +
    more +
    '<div class="dir-note" style="font-size:.78rem;color:var(--muted);margin-top:20px;line-height:1.6;border-top:1px solid var(--border);padding-top:14px">Capability evidence is independent of commercial/paid status. <b>Potentially relevant</b> does not mean technically qualified — verify with the manufacturer before a commercial decision. UNKNOWN is shown rather than guessed.</div>' +
    '<div id="tpCmpDock" class="tp-cmp-dock"></div>';
}

module.exports = {
  esc: esc,
  dash: dash,
  stats: stats,
  vendors: vendors,
  directoryRoot: directoryRoot,
  vendorCard: vendorCard,
  directoryCard: directoryCard
};
