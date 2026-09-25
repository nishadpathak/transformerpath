#!/usr/bin/env node
/* lib/gcc-discovery.js — GCC Intel source-discovery pipeline.
 *
 * Pipeline (discovery ≠ publication):
 *   DISCOVER → EXTRACT → NORMALIZE → DEDUPLICATE → CLASSIFY →
 *   SOURCE CHECK → EVIDENCE GRADE → PUBLISH / REVIEW QUEUE
 *
 * Does NOT auto-publish. CONFIRMED / SUPPORTED / REVIEW_REQUIRED / REJECTED
 * are evidence grades for the review queue — not Intel feed cards.
 *
 * Date model keeps publication_date, event_date, tender_float_date,
 * tender_close_date (and related fields) separate. The Oman case is why.
 */
'use strict';

var CLASSIFICATIONS = [
  'TENDER', 'AWARD', 'PROJECT', 'FACTORY_INVESTMENT', 'CAPACITY_EXPANSION',
  'LOCALISATION', 'NEW_FACTORY', 'FRAMEWORK_AGREEMENT', 'TRANSFORMER_REPLACEMENT',
  'MAINTENANCE', 'UTILITY_PROCUREMENT', 'PRODUCT_LAUNCH', 'FACTORY_COMMISSIONING',
  'REGULATORY', 'SUPPLY_CHAIN'
];

var PROCUREMENT_STATES = [
  'ANNOUNCED', 'OPEN', 'BIDS_OPENED', 'UNDER_EVALUATION', 'AWARDED', 'CLOSED', 'CANCELLED'
];

var EVIDENCE_GRADES = ['CONFIRMED', 'SUPPORTED', 'REVIEW_REQUIRED', 'REJECTED'];

var GCC_COUNTRIES = [
  'United Arab Emirates', 'Saudi Arabia', 'Kuwait', 'Oman', 'Bahrain', 'Qatar'
];

var DATE_FIELDS = [
  'publication_date', 'event_date', 'tender_float_date', 'tender_close_date',
  'bid_opening_date', 'expected_award_date', 'award_date', 'project_start_date',
  'commissioning_date', 'source_checked_at', 'update_date'
];

function emptyDates() {
  var o = {};
  DATE_FIELDS.forEach(function (k) { o[k] = null; });
  return o;
}

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function dedupeKey(candidate) {
  if (candidate.canonical_procurement_id) {
    return 'proc:' + String(candidate.canonical_procurement_id).toLowerCase();
  }
  var parts = [
    candidate.country || '',
    candidate.buyer || '',
    candidate.tender_id || '',
    normalizeText(candidate.title).slice(0, 80)
  ];
  return parts.join('|');
}

function classifyFromText(title, body) {
  var hay = normalizeText(title + ' ' + (body || ''));
  var tags = [];
  function add(t) { if (tags.indexOf(t) < 0) tags.push(t); }

  if (/\b(tender|مناقصة|منافسة|invitation to tender|float|bid closing|procurement)\b/.test(hay)) {
    add('TENDER'); add('UTILITY_PROCUREMENT');
  }
  if (/\b(award|awarded|ترسية|contract signed)\b/.test(hay)) add('AWARD');
  if (/\b(replacement|استبدال|replace the transformer)\b/.test(hay)) add('TRANSFORMER_REPLACEMENT');
  if (/\b(maintenance|صيانة|repair)\b/.test(hay)) add('MAINTENANCE');
  if (/\b(localis|localiz|توطين|local content|in.country value|supply.chain)\b/.test(hay)) {
    add('LOCALISATION'); add('SUPPLY_CHAIN');
  }
  if (/\b(factory|factories|manufactur|مصنع|new production line|component)\b/.test(hay)) {
    add('FACTORY_INVESTMENT');
    if (/\b(new factory|seven new|seven factories|مصانع جديدة)\b/.test(hay)) add('NEW_FACTORY');
  }
  if (/\b(capacity expansion|expand)\b/.test(hay)) add('CAPACITY_EXPANSION');
  if (/\b(framework agreement|framework)\b/.test(hay)) add('FRAMEWORK_AGREEMENT');
  if (/\b(commission|energised|energized)\b/.test(hay)) add('FACTORY_COMMISSIONING');
  if (/\b(regulat|apsr|authority for public services)\b/.test(hay)) add('REGULATORY');
  if (/\b(project|epc)\b/.test(hay)) add('PROJECT');
  if (!tags.length) add('PROJECT');
  return tags;
}

function transformerRelevant(title, body) {
  var hay = normalizeText(title + ' ' + (body || ''));
  var include = [
    /transformer/, /محول/, /package substation/, /pocket substation/, /kiosk substation/,
    /محطة كشك/, /earthing transformer/, /grounding transformer/, /محول التأريض/,
    /shunt reactor/, /parallel reactor/, /مفاعل/, /gsu/, /autotransformer/,
    /transformer component/, /مكونات المحولات/, /transformer factory/, /مصنع محولات/
  ];
  if (include.some(function (re) { return re.test(hay); })) return true;
  // Generic substation without transformer scope → not relevant for auto-include
  if (/\bsubstation\b/.test(hay) && !/\btransformer\b/.test(hay) && !/محول/.test(hay)) {
    return false;
  }
  return false;
}

function gradeEvidence(candidate) {
  var primary = (candidate.sources || []).filter(function (s) {
    return s.role === 'PRIMARY' || s.authority_class === 'OFFICIAL';
  });
  var secondary = (candidate.sources || []).filter(function (s) {
    return s.role === 'SECONDARY' || s.authority_class === 'AUTHORITATIVE_SECONDARY' || s.authority_class === 'INDUSTRY_MEDIA';
  });
  if (candidate.force_grade && EVIDENCE_GRADES.indexOf(candidate.force_grade) >= 0) {
    return candidate.force_grade;
  }
  if (candidate.reject_reason) return 'REJECTED';
  if (primary.length && candidate.key_values_extracted) return 'CONFIRMED';
  if (secondary.length && (candidate.tender_id || candidate.key_values_extracted)) return 'SUPPORTED';
  if (candidate.discovery_input_only) return 'REVIEW_REQUIRED';
  if (!candidate.sources || !candidate.sources.length) return 'REVIEW_REQUIRED';
  return 'SUPPORTED';
}

function entityLinks(candidate) {
  return {
    country: candidate.country || null,
    utility_buyer: candidate.buyer || null,
    project: candidate.project || null,
    tender: candidate.tender_id || candidate.canonical_procurement_id || null,
    transformer_category: candidate.transformer_category || null,
    voltage: candidate.voltage || null,
    rating: candidate.rating || null,
    facility_location: candidate.location || null,
    supplier_award_winner: candidate.supplier || null
  };
}

function normalizeCandidate(raw) {
  var dates = emptyDates();
  Object.keys(dates).forEach(function (k) {
    if (raw[k] != null) dates[k] = raw[k];
  });
  // Never collapse: if only a single "date" was supplied, treat as publication_date
  // unless event_date is explicitly set.
  if (raw.date && !dates.publication_date) dates.publication_date = raw.date;

  var title = raw.title || '';
  var body = raw.snippet || raw.body || '';
  var classifications = raw.classifications || classifyFromText(title, body);
  var relevant = raw.transformer_relevant != null
    ? !!raw.transformer_relevant
    : transformerRelevant(title, body);

  var out = {
    candidate_id: raw.candidate_id || dedupeKey(raw),
    country: raw.country,
    title: title,
    snippet: body,
    buyer: raw.buyer || null,
    tender_id: raw.tender_id || null,
    canonical_procurement_id: raw.canonical_procurement_id || raw.tender_id || null,
    procurement_state: raw.procurement_state || null,
    procurement_events: raw.procurement_events || [],
    classifications: classifications,
    transformer_relevant: relevant,
    transformer_category: raw.transformer_category || null,
    voltage: raw.voltage || null,
    rating: raw.rating || null,
    location: raw.location || null,
    project: raw.project || null,
    supplier: raw.supplier || null,
    key_values_extracted: raw.key_values_extracted || null,
    dates: dates,
    sources: raw.sources || [],
    confidence: raw.confidence || null,
    why_previously_missed: raw.why_previously_missed || null,
    published_to_intel: !!raw.published_to_intel,
    publish_decision: raw.publish_decision || 'HOLD_FOR_REVIEW',
    discovery_input_only: !!raw.discovery_input_only,
    reject_reason: raw.reject_reason || null,
    notes: raw.notes || null,
    entity_links: null,
    evidence_grade: null
  };
  out.entity_links = entityLinks(out);
  out.evidence_grade = gradeEvidence(Object.assign({}, raw, out));
  return out;
}

function deduplicate(candidates) {
  var byKey = {};
  var order = [];
  candidates.forEach(function (c) {
    var k = dedupeKey(c);
    if (!byKey[k]) {
      byKey[k] = c;
      order.push(k);
      return;
    }
    // Merge status events onto one canonical procurement
    var existing = byKey[k];
    var events = (existing.procurement_events || []).concat(c.procurement_events || []);
    existing.procurement_events = events;
    if (c.procurement_state) existing.procurement_state = c.procurement_state;
    (c.sources || []).forEach(function (s) {
      existing.sources = existing.sources || [];
      var dup = existing.sources.some(function (x) { return x.url === s.url; });
      if (!dup) existing.sources.push(s);
    });
    // Prefer richer date fields
    Object.keys(c.dates || {}).forEach(function (dk) {
      if (c.dates[dk] && !existing.dates[dk]) existing.dates[dk] = c.dates[dk];
    });
  });
  return order.map(function (k) { return byKey[k]; });
}

function coverageRow(country, opts) {
  opts = opts || {};
  return {
    country: country,
    sources_checked: opts.sources_checked || 0,
    sources_registered: opts.sources_registered || 0,
    new_candidates: opts.new_candidates || 0,
    confirmed: opts.confirmed || 0,
    supported: opts.supported || 0,
    review_required: opts.review_required || 0,
    rejected: opts.rejected || 0,
    last_check: opts.last_check || null,
    coverage_status: opts.coverage_status || 'SOURCES_NOT_CHECKED',
    note: opts.note || null
  };
}

function buildMarketWatch(registrySources, candidates, checkedAt) {
  var byCountry = {};
  GCC_COUNTRIES.forEach(function (c) {
    byCountry[c] = {
      sources_registered: 0,
      sources_checked: 0,
      candidates: []
    };
  });
  (registrySources || []).forEach(function (s) {
    var c = s.country;
    if (!byCountry[c]) return;
    byCountry[c].sources_registered++;
    if (s.last_checked || s.last_success) byCountry[c].sources_checked++;
  });
  (candidates || []).forEach(function (cand) {
    var c = cand.country;
    if (!byCountry[c]) return;
    byCountry[c].candidates.push(cand);
  });

  return GCC_COUNTRIES.map(function (country) {
    var row = byCountry[country];
    var conf = row.candidates.filter(function (x) { return x.evidence_grade === 'CONFIRMED'; }).length;
    var supp = row.candidates.filter(function (x) { return x.evidence_grade === 'SUPPORTED'; }).length;
    var rev = row.candidates.filter(function (x) { return x.evidence_grade === 'REVIEW_REQUIRED'; }).length;
    var rej = row.candidates.filter(function (x) { return x.evidence_grade === 'REJECTED'; }).length;
    var status;
    if (country === 'Qatar' && row.candidates.length === 0) {
      // Qatar zero can be valid — but only if sources were checked
      status = row.sources_checked > 0
        ? 'NO_QUALIFYING_ACTIVITY_FOUND'
        : 'SOURCES_REGISTERED_ADAPTER_PENDING';
    } else if (row.candidates.length > 0) {
      status = row.sources_checked > 0 ? 'ACTIVITY_FOUND' : 'DISCOVERY_INPUT_VALIDATED';
    } else {
      status = row.sources_checked > 0
        ? 'NO_QUALIFYING_ACTIVITY_FOUND'
        : 'SOURCES_REGISTERED_ADAPTER_PENDING';
    }
    return coverageRow(country, {
      sources_checked: row.sources_checked,
      sources_registered: row.sources_registered,
      new_candidates: row.candidates.length,
      confirmed: conf,
      supported: supp,
      review_required: rev,
      rejected: rej,
      last_check: checkedAt || null,
      coverage_status: status,
      note: country === 'Qatar'
        ? 'Zero qualifying September transformer-supply / station-EPC opportunities under defined scope is valid. Do not fabricate.'
        : null
    });
  });
}

function gccFreshnessSummary(marketWatch, candidates, checkedAt) {
  var marketsWithRegistered = (marketWatch || []).filter(function (r) {
    return r.sources_registered > 0;
  }).length;
  var marketsChecked = (marketWatch || []).filter(function (r) {
    return r.sources_checked > 0 || r.coverage_status === 'DISCOVERY_INPUT_VALIDATED' || r.coverage_status === 'ACTIVITY_FOUND' || r.coverage_status === 'NO_QUALIFYING_ACTIVITY_FOUND';
  }).length;
  // Honest: adapters not live → do not claim "6/6 markets checked" from build clock
  var adaptersLive = (marketWatch || []).filter(function (r) { return r.sources_checked > 0; }).length;
  var confirmed = (candidates || []).filter(function (c) { return c.evidence_grade === 'CONFIRMED'; });
  var latestConfirmed = null;
  confirmed.forEach(function (c) {
    var d = (c.dates && (c.dates.event_date || c.dates.publication_date || c.dates.tender_float_date)) || null;
    if (d && (!latestConfirmed || d > latestConfirmed)) latestConfirmed = d;
  });
  return {
    statement: adaptersLive === 6
      ? '6/6 GCC markets checked'
      : (adaptersLive + '/6 GCC market adapters live — registry covers ' + marketsWithRegistered + '/6; discovery-input validation does not equal live portal crawl'),
    markets_registered: marketsWithRegistered,
    markets_adapter_live: adaptersLive,
    markets_with_validated_candidates: marketsChecked,
    latest_source_checked_at: checkedAt || null,
    latest_confirmed_event_date: latestConfirmed,
    data_current_claim_allowed: false,
    honesty: 'Do NOT declare DATA CURRENT because the build ran today. Freshness depends on source coverage + source_checked_at + validated newest record.'
  };
}

function runPipeline(rawCandidates, registrySources, opts) {
  opts = opts || {};
  var checkedAt = opts.checkedAt || null;
  var extracted = (rawCandidates || []).map(normalizeCandidate);
  var relevant = extracted.filter(function (c) { return c.transformer_relevant !== false; });
  var deduped = deduplicate(relevant);
  var marketWatch = buildMarketWatch(registrySources, deduped, checkedAt);
  var freshness = gccFreshnessSummary(marketWatch, deduped, checkedAt);
  var counts = { CONFIRMED: 0, SUPPORTED: 0, REVIEW_REQUIRED: 0, REJECTED: 0 };
  deduped.forEach(function (c) { counts[c.evidence_grade] = (counts[c.evidence_grade] || 0) + 1; });
  return {
    pipeline: [
      'DISCOVER', 'EXTRACT', 'NORMALIZE', 'DEDUPLICATE', 'CLASSIFY',
      'SOURCE_CHECK', 'EVIDENCE_GRADE', 'PUBLISH_OR_REVIEW_QUEUE'
    ],
    classifications_supported: CLASSIFICATIONS,
    procurement_states: PROCUREMENT_STATES,
    date_fields: DATE_FIELDS,
    candidates: deduped,
    counts: {
      candidates: deduped.length,
      confirmed: counts.CONFIRMED,
      supported: counts.SUPPORTED,
      review_required: counts.REVIEW_REQUIRED,
      rejected: counts.REJECTED
    },
    market_watch: marketWatch,
    freshness: freshness,
    publish_rule: 'Discovery results must NOT automatically become Intel. Only CONFIRMED items with primary evidence may enter the publish review queue.'
  };
}

/** Regression helpers: fixtures describe what discovery SHOULD catch — not hardcoded published stories. */
function fixtureExpectations() {
  return [
    {
      fixture_id: 'dewa-2122600155',
      country: 'United Arab Emirates',
      required_source_ids: ['dewa-open-tenders'],
      match: {
        tender_id: '2122600155',
        title_includes: ['distribution substations', 'kiosks']
      },
      required_classifications_any: ['TENDER', 'UTILITY_PROCUREMENT', 'MAINTENANCE'],
      note: 'Official DEWA portal tender — must be discoverable via dewa-open-tenders, not MEED-only.'
    },
    {
      fixture_id: 'bahrain-ewa-389-2026',
      country: 'Bahrain',
      required_source_ids: ['bahrain-tender-board', 'ewa-bahrain'],
      match: {
        tender_id: '389/2026/BTB',
        title_includes: ['1000', 'kva']
      },
      required_classifications_any: ['TENDER', 'UTILITY_PROCUREMENT'],
      note: 'Bahrain Tender Board / EWA package-substation supply.'
    },
    {
      fixture_id: 'oman-transformer-localisation',
      country: 'Oman',
      required_source_ids: ['apsr-oman', 'invest-oman', 'voltamp-oman', 'oman-observer'],
      match: {
        title_includes: ['localis', 'transformer']
      },
      required_classifications_any: ['FACTORY_INVESTMENT', 'LOCALISATION', 'SUPPLY_CHAIN', 'NEW_FACTORY'],
      required_dates: {
        event_date: '2026-08-12'
      },
      forbid_event_date: '2026-09-19',
      note: 'Agreements signed 12 Aug; 19 Sep is publication/update only.'
    }
  ];
}

function assertFixtures(result, registrySources) {
  var failures = [];
  var sourceIds = (registrySources || []).map(function (s) { return s.source_id; });
  var cands = result.candidates || [];

  fixtureExpectations().forEach(function (fx) {
    fx.required_source_ids.forEach(function (sid) {
      if (sourceIds.indexOf(sid) < 0) {
        failures.push(fx.fixture_id + ': missing registry source ' + sid);
      }
    });
    var hit = cands.find(function (c) {
      if (c.country !== fx.country) return false;
      if (fx.match.tender_id && String(c.tender_id || '').indexOf(fx.match.tender_id) < 0) return false;
      var t = normalizeText(c.title + ' ' + (c.snippet || ''));
      return (fx.match.title_includes || []).every(function (frag) {
        return t.indexOf(normalizeText(frag)) >= 0;
      });
    });
    if (!hit) {
      failures.push(fx.fixture_id + ': candidate not present in discovery output');
      return;
    }
    var hasClass = (fx.required_classifications_any || []).some(function (cl) {
      return (hit.classifications || []).indexOf(cl) >= 0;
    });
    if (!hasClass) {
      failures.push(fx.fixture_id + ': classification miss — got ' + (hit.classifications || []).join(','));
    }
    if (fx.required_dates) {
      Object.keys(fx.required_dates).forEach(function (dk) {
        if (!hit.dates || hit.dates[dk] !== fx.required_dates[dk]) {
          failures.push(fx.fixture_id + ': expected ' + dk + '=' + fx.required_dates[dk] + ' got ' + (hit.dates && hit.dates[dk]));
        }
      });
    }
    if (fx.forbid_event_date && hit.dates && hit.dates.event_date === fx.forbid_event_date) {
      failures.push(fx.fixture_id + ': event_date incorrectly set to publication/update date ' + fx.forbid_event_date);
    }
  });
  return { pass: failures.length === 0, failures: failures };
}

module.exports = {
  CLASSIFICATIONS: CLASSIFICATIONS,
  PROCUREMENT_STATES: PROCUREMENT_STATES,
  EVIDENCE_GRADES: EVIDENCE_GRADES,
  GCC_COUNTRIES: GCC_COUNTRIES,
  DATE_FIELDS: DATE_FIELDS,
  normalizeCandidate: normalizeCandidate,
  deduplicate: deduplicate,
  classifyFromText: classifyFromText,
  transformerRelevant: transformerRelevant,
  gradeEvidence: gradeEvidence,
  runPipeline: runPipeline,
  buildMarketWatch: buildMarketWatch,
  gccFreshnessSummary: gccFreshnessSummary,
  fixtureExpectations: fixtureExpectations,
  assertFixtures: assertFixtures,
  dedupeKey: dedupeKey
};

if (require.main === module) {
  var self = module.exports;
  var sample = self.runPipeline([{
    country: 'Oman',
    title: 'Oman localises transformer component manufacturing',
    snippet: 'localisation factories',
    event_date: '2026-08-12',
    publication_date: '2026-09-19',
    sources: [{ url: 'https://www.omanobserver.om/', role: 'SECONDARY', authority_class: 'AUTHORITATIVE_SECONDARY' }],
    key_values_extracted: { investment: 'RO15m' }
  }], [{ source_id: 'oman-observer', country: 'Oman' }]);
  console.log(JSON.stringify({ counts: sample.counts, grade: sample.candidates[0].evidence_grade, dates: sample.candidates[0].dates }, null, 2));
}
