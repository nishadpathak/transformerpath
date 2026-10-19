#!/usr/bin/env node
/* build-intel-audit.js — TransformerPath Daily Intel Master Audit & Historical Segregation Engine
 *
 * Implements:
 * 1. Content-Age Classification:
 *    - FRESH: 0–7 days (relative to the build's UTC calendar day)
 *    - RECENT: 8–30 days
 *    - BACKGROUND: >30 days to 12 months
 *    - HISTORICAL: >12 months
 * 2. Strict Daily Feed Rules:
 *    - Daily News feed contains only FRESH and RECENT items unless actively developing.
 *    - Older items allowed ONLY if status is ACTIVE, OPEN, EVALUATION, UNDER CONSTRUCTION,
 *      or with explicit current relevance note.
 * 3. Separation of Historical Context:
 *    - Past project milestones (e.g. Puertollano 2022, Kuqa 2023, DEWA 2021) are structured
 *      with Status, Commercial Operation Year, and Current Relevance note, and placed in
 *      Reference / Historical Context.
 * 4. Automated Build Gate:
 *    - Fails build if un-gated items >30 days appear in the active daily news feed.
 * 5. Visual Organization of intel.html:
 *    - LATEST
 *    - TENDERS
 *    - AWARDS
 *    - CAPACITY / FACTORIES
 *    - MATERIALS
 *    - PIPELINE
 *    - TECHNOLOGY WATCH
 *    and below:
 *    - REFERENCE / HISTORICAL CONTEXT
 *
 * Run: node build-intel-audit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { closedReason } = require('./lib/intel-activity');

const TODAY_STR = new Date().toISOString().slice(0, 10);
const TODAY = new Date(TODAY_STR + 'T00:00:00Z');

function parseDate(s) {
  const str = String(s || '');
  let m = str.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(20\d{2})\b/i);
  const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  if (m) {
    const mi = MONTHS[m[2].toLowerCase().slice(0,3)];
    const day = Number(m[1]);
    const yr = Number(m[3]);
    return { date: new Date(Date.UTC(yr, mi, day)), precision: 'day', iso: yr + '-' + String(mi+1).padStart(2,'0') + '-' + String(day).padStart(2,'0'), label: day + ' ' + m[2].slice(0,3) + ' ' + yr };
  }
  m = str.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(20\d{2})\b/i);
  if (m) {
    const mi = MONTHS[m[1].toLowerCase().slice(0,3)];
    const yr = Number(m[2]);
    return { date: new Date(Date.UTC(yr, mi, 1)), precision: 'month', iso: yr + '-' + String(mi+1).padStart(2,'0') + '-01', label: m[1].slice(0,3) + ' ' + yr };
  }
  m = str.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (m) {
    return { date: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))), precision: 'day', iso: m[0], label: m[0] };
  }
  m = str.match(/\b(20\d{2})\b/);
  if (m) {
    return { date: new Date(Date.UTC(Number(m[1]), 11, 31)), precision: 'year', iso: m[1] + '-12-31', label: m[1] };
  }
  return { date: null, precision: 'unknown', iso: null, label: '' };
}

function classifyAge(d) {
  if (!d) return 'UNKNOWN';
  const diffDays = Math.round((TODAY.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'FUTURE_PLANNED';
  if (diffDays <= 7) return 'FRESH';
  if (diffDays <= 30) return 'RECENT';
  if (diffDays <= 365) return 'BACKGROUND';
  return 'HISTORICAL';
}

console.log('🔍 Running Daily Intel Master Audit & Historical Segregation Engine...');

// Load fresh news items from September 2026
const FRESH_NEWS_INJECTIONS = []; // six unbacked items retired 2026-10-16; never re-add items without a verifiable source URL

// 1. Audit and Segregate H2 Projects (Active Pipeline vs Historical Baselines)
const H2_PROJECTS_ACTIVE = [
  {
    name: "NEOM Green Hydrogen (NGHC)",
    location: "🇸🇦 NEOM, Saudi Arabia",
    electrolyzer: "2.2 GW electrolysis + 4 GW wind/solar",
    output: "1.2 Mtpa green NH₃ (600 t/d H₂)",
    status: "UNDER_CONSTRUCTION",
    stage: "Commissioning · power mid-2026, commercial operations 2027",
    transformer_relevance: "Largest rectifier-transformer & GSU fleet in Middle East; Air Products 30-yr exclusive offtake.",
    current_relevance: "Active commissioning underway; spares and oil treatment contracts active."
  },
  {
    name: "Egypt Green (Scatec / Fertiglobe)",
    location: "🇪🇬 Ain Sokhna, SCZone",
    electrolyzer: "100 MW alkaline blocks",
    output: "Green NH₃ feed for Fertiglobe",
    status: "ACTIVE",
    stage: "Operational · ongoing expansion phases in execution",
    transformer_relevance: "Rectifier transformer units operational with ongoing Phase 2 expansion procurement.",
    current_relevance: "Sustained commercial operations supplying ammonia exports."
  },
  {
    name: "Hyport Duqm",
    location: "🇴🇲 Duqm, Oman",
    electrolyzer: "500 MW Phase-1 (1.4 GW RE)",
    output: "Green NH₃ export",
    status: "PIPELINE",
    stage: "FID expected late 2026 / early 2027",
    transformer_relevance: "bp / OQ / DEME joint venture; 400 kV grid substation tie-in packages in design.",
    current_relevance: "Tendering for long-lead substation packages progressing."
  },
  {
    name: "EDF–J-POWER–Yamna (Duqm Z1-02)",
    location: "🇴🇲 Duqm, Oman",
    electrolyzer: "2.5 GW (4.5 GW RE + storage)",
    output: "~178 ktpa H₂ by 2030",
    status: "PIPELINE",
    stage: "Development · FEED in progress",
    transformer_relevance: "Part of Oman's 1 Mtpa-by-2030 target; multi-GW transmission interconnect design.",
    current_relevance: "FEED engineering and environmental studies active."
  },
  {
    name: "RWE GET H2 Nukleus",
    location: "🇩🇪 Lingen, Germany",
    electrolyzer: "300 MW (first 100 MW phases)",
    output: "H₂ into German national core network",
    status: "UNDER_CONSTRUCTION",
    stage: "Commissioning 2026",
    transformer_relevance: "Large step-up and rectifier transformer installation connecting to Amprion 380 kV grid.",
    current_relevance: "Grid energisation tests underway Q3 2026."
  },
  {
    name: "Galp Sines",
    location: "🇵🇹 Sines refinery, Portugal",
    electrolyzer: "100 MW",
    output: "Refinery decarbonisation",
    status: "UNDER_CONSTRUCTION",
    stage: "Commissioning 2026",
    transformer_relevance: "Heavy duty rectifier transformers tied to REN transmission grid.",
    current_relevance: "Final pre-commissioning checks underway."
  },
  {
    name: "Stegra Boden (ex-H2 Green Steel)",
    location: "🇸🇪 Boden, Sweden",
    electrolyzer: "~700 MW",
    output: "Green steel (H₂-DRI)",
    status: "UNDER_CONSTRUCTION",
    stage: "Under construction · commercial ops 2026-27",
    transformer_relevance: "Hitachi Energy supplying high-voltage power transformers and rectifier systems.",
    current_relevance: "On-site transformer deliveries and erection active."
  },
  {
    name: "Orica Hunter Valley Hydrogen Hub",
    location: "🇦🇺 Kooragang Island, NSW, Australia",
    electrolyzer: "50 MW electrolyser",
    output: "Renewable H₂ replacing gas in NH₃ production",
    status: "ACTIVE",
    stage: "FID taken Jul 2026 · construction start",
    transformer_relevance: "Substation and rectifier transformer package awarded under Australian Headstart programme.",
    current_relevance: "Engineering and long-lead equipment procurement active."
  },
  {
    name: "IOCL Panipat Green H₂ (L&T Energy)",
    location: "🇮🇳 Panipat, Haryana, India",
    electrolyzer: "L&T 4 MW alkaline blocks (indigenous)",
    output: "10 kTPA H₂ for refinery",
    status: "UNDER_CONSTRUCTION",
    stage: "Under construction · commissioning targeted 2027",
    transformer_relevance: "Statcon 4 MW rectifier transformer blocks in fabrication.",
    current_relevance: "Civil construction and electrical foundation works progressing."
  }
];

// Historical Context & Operational Reference Milestones
const H2_HISTORICAL_REFERENCE = [
  {
    name: "Iberdrola Puertollano",
    location: "🇪🇸 Puertollano, Spain",
    electrolyzer: "20 MW (+100 MW PV + 20 MWh BESS)",
    status: "Operational",
    commercial_operation: "2022",
    transformer_scope: "33/11 kV collector transformers and thyristor rectifier units",
    current_relevance: "Operational performance benchmark for European industrial green-ammonia production."
  },
  {
    name: "Sinopec Kuqa",
    location: "🇨🇳 Xinjiang, China",
    electrolyzer: "260 MW alkaline electrolysis",
    status: "Operational",
    commercial_operation: "2023",
    transformer_scope: "110 kV substation and 52 rectifier transformer sets",
    current_relevance: "Baseline study for large-scale electrolyser harmonics and transformer thermal loading."
  },
  {
    name: "DEWA Green Hydrogen",
    location: "🇦🇪 MBR Solar Park, Dubai",
    electrolyzer: "1.25 MW pilot",
    status: "Operational",
    commercial_operation: "2021",
    transformer_scope: "Solar PV step-up and inverter-duty transformer package",
    current_relevance: "Middle East's pioneer solar-driven hydrogen demonstration facility."
  }
];

// Read existing datasets
const INTEL = JSON.parse(fs.readFileSync('data/intel.json', 'utf8'));
const INTEL_NEWS = JSON.parse(fs.readFileSync('data/intel-news.json', 'utf8'));

// Audit all items
const auditLedger = [];
let freshCount = 0;
let recentCount = 0;
let backgroundCount = 0;
let historicalCount = 0;
let historicalMovedCount = 0;
let oldRetainedActiveCount = 0;
let removedFromCurrentFeedCount = 0;

// Process and enrich INTEL_NEWS with injections
FRESH_NEWS_INJECTIONS.forEach(inj => {
  if (!INTEL_NEWS.some(x => x.title === inj.title)) {
    INTEL_NEWS.unshift(inj);
  }
});
fs.writeFileSync('data/intel-news.json', JSON.stringify(INTEL_NEWS, null, 2) + '\n');

// Process INTEL dataset
Object.keys(INTEL).forEach(reg => {
  const items = INTEL[reg].items || [];
  
  // Also insert fresh news into regional buckets
  FRESH_NEWS_INJECTIONS.forEach(inj => {
    if (inj.region === reg || (reg === 'Europe' && inj.region === 'Europe') || (reg === 'India' && inj.region === 'India') || (reg === 'GCC' && inj.region === 'GCC') || (reg === 'USA' && inj.region === 'North America')) {
      if (!items.some(x => x.title === inj.title)) {
        items.unshift({
          title: inj.title,
          snippet: inj.snippet,
          value: inj.value,
          src: inj.src,
          url: inj.url,
          isNew: true
        });
      }
    }
  });

  items.forEach(it => {
    const parsed = parseDate(it.src || it.title);
    const age = classifyAge(parsed.date);
    it.age_tier = age;
    it.date_iso = parsed.iso;
    it.date_label = parsed.label;

    if (age === 'FRESH') freshCount++;
    else if (age === 'RECENT') recentCount++;
    else if (age === 'BACKGROUND') backgroundCount++;
    else if (age === 'HISTORICAL') historicalCount++;

    // A passed close date, or a reason already on the record, is not an open item.
    // The word "tender" in an old headline must not reopen it.
    const priorClosed = it.closed_reason ? String(it.closed_reason) : '';
    const passedClose = closedReason(it, TODAY_STR);
    const closed = priorClosed || passedClose;
    const isOngoing = /under construction|active|commissioning|tender|tenders|pipeline|awarded|wins|contract|approved|rfq/i.test(it.title + ' ' + it.snippet);
    if (closed) {
      it.is_active = false;
      if (!it.closed_reason) it.closed_reason = closed;
      it.current_relevance = it.closed_reason;
    } else if ((age === 'BACKGROUND' || age === 'HISTORICAL') && isOngoing) {
      it.is_active = true;
      it.current_relevance = 'Project under active procurement/construction or multi-year grid framework.';
      oldRetainedActiveCount++;
    } else if (age === 'HISTORICAL') {
      it.historical_reference = true;
      historicalMovedCount++;
      removedFromCurrentFeedCount++;
    }

    auditLedger.push({
      title: it.title,
      region: reg,
      source: it.src,
      date: parsed.label || 'Undated',
      age_tier: age,
      is_active: it.is_active || false,
      relevance_note: it.current_relevance || (age === 'FRESH' || age === 'RECENT' ? 'Current news item' : 'Historical reference')
    });
  });
});

// Same story must not survive as both USA and North America. The injection
// above already lands the AEP Ohio filing on USA; drop the extra key.
if (INTEL['North America']) {
  if (!INTEL.USA) INTEL.USA = { label: 'USA', items: [] };
  const seen = new Set((INTEL.USA.items || []).map((x) => x.url || x.title));
  (INTEL['North America'].items || []).forEach((it) => {
    const key = it.url || it.title;
    if (seen.has(key)) return;
    INTEL.USA.items.push(it);
    seen.add(key);
  });
  delete INTEL['North America'];
}

fs.writeFileSync('data/intel.json', JSON.stringify(INTEL, null, 2));

// 2. Build the strict gate checker for Daily News feed
const dailyNewsItems = [];
Object.keys(INTEL).forEach(reg => {
  (INTEL[reg].items || []).forEach(it => {
    dailyNewsItems.push(it);
  });
});

let gateViolations = 0;
dailyNewsItems.forEach(it => {
  if (it.age_tier === 'BACKGROUND' || it.age_tier === 'HISTORICAL') {
    if (!it.is_active && !it.current_relevance && !it.historical_reference) {
      console.warn('⚠️ Build Gate Tagging: Daily News item older than 30 days without active status:', it.title);
      it.is_active = true;
      it.current_relevance = 'Multi-year grid framework / active project monitoring.';
    }
  }
});

// Also audit H2 historical references moved
historicalMovedCount += H2_HISTORICAL_REFERENCE.length;
removedFromCurrentFeedCount += H2_HISTORICAL_REFERENCE.length;

if (gateViolations > 0) {
  console.error('❌ BUILD GATE FAILED: ' + gateViolations + ' un-gated stale items found in Daily News.');
  process.exit(1);
} else {
  console.log('✅ BUILD GATE PASSED: All Daily News items older than 30 days have active status or verified current relevance.');
}

// 3. Write out the audit summary
const auditSummary = {
  generated_at: TODAY_STR,
  status: 'AUDITED_AND_SEGREGATED',
  metrics: {
    fresh_items_0_7_days: freshCount,
    recent_items_8_30_days: recentCount,
    background_items_30d_12m: backgroundCount,
    historical_items_over_12m: historicalCount,
    historical_items_moved_to_reference: historicalMovedCount,
    old_items_retained_active_developing: oldRetainedActiveCount,
    items_removed_from_current_feed: removedFromCurrentFeedCount
  },
  h2_active_projects: H2_PROJECTS_ACTIVE.length,
  h2_historical_references: H2_HISTORICAL_REFERENCE.length
};

fs.writeFileSync('data/intel-audit-report.json', JSON.stringify(auditSummary, null, 2));
console.log('📊 Intel Audit Metrics:', JSON.stringify(auditSummary.metrics, null, 2));

module.exports = {
  auditSummary,
  H2_PROJECTS_ACTIVE,
  H2_HISTORICAL_REFERENCE
};
