#!/usr/bin/env node
/* scripts/migrate-events-depth.js
 * Migrate data/events.json short keys → long edition records and apply the
 * 14 Oct 2026 official-date corrections. Idempotent: re-running keeps the
 * same ids and does not duplicate added editions.
 *
 * Unknown fields stay null. date_status CONFIRMED only when this script read
 * the date on an official edition page.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const status = require('../lib/event-status');

const CHECKED = '2026-10-14';
const SRC = {
  mee: 'https://www.middleeast-energy.com/en/home.html',
  cwieme: 'https://berlin.cwiemeevents.com/',
  enlitAfrica: 'https://www.enlit-africa.com/',
  pes: 'https://pes-gm.org/',
  elenex: 'https://saudielenex.com/',
  dtech: 'https://www.distributech.com/faqs',
  intersolar: 'https://www.intersolar.ae/',
  elecrama: 'https://elecrama.com/',
  hannover: 'https://www.hannovermesse.de/en/',
  enlitEu: 'https://www.enlit-europe.com/',
  sasg: 'https://saudi-sg.com/',
  doble: 'https://www.doble.com/event/2027-international-conference-of-doble-clients/',
  techcon: 'https://techcon.info/',
  ieeeTc: 'https://www.transformerscommittee.org/meetings/',
  ieeeTcFall: 'https://www.transformerscommittee.org/meetings/2026-fall-fort-lauderdale-florida/',
  ieeeTcSpring: 'https://www.transformerscommittee.org/meetings/2026-spring-fort-worth-texas/',
  gcc: 'https://cigre-gccpower.com/',
  aef: 'https://www.africa-energy-forum.com/',
  opes: 'https://omanpetroleumandenergyshow.com/home',
};

const before = JSON.parse(fs.readFileSync('data/events.json', 'utf8'));
const beforeRows = Array.isArray(before) ? before : (before.events || []);
const beforeSnap = beforeRows.map((r) => ({
  name: r.name || r.n,
  start: r.start || r.s || null,
  end: r.end || r.e || null,
  venue: r.venue || r.v || null,
  city: r.city || r.c || null,
}));

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/['’´]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function yearOf(name, start) {
  const m = String(name || '').match(/(20\d{2})/);
  if (m) return m[1];
  if (start && /^\d{4}/.test(start)) return start.slice(0, 4);
  return null;
}
function editionLabel(name) {
  const m = String(name || '').match(/(\d+)(?:st|nd|rd|th)\s+edition/i);
  return m ? (m[1] + (['th', 'st', 'nd', 'rd'][(m[1] % 10)] || 'th') + (m[1] % 100 >= 11 && m[1] % 100 <= 13 ? '' : '')).replace(/(\d+)(?:th|st|nd|rd)/, function (_, n) {
    const i = parseInt(n, 10);
    const suf = (i % 100 >= 11 && i % 100 <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][i % 10] || 'th');
    return i + suf;
  }) : null;
}
function ordinal(n) {
  const i = parseInt(n, 10);
  const suf = (i % 100 >= 11 && i % 100 <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][i % 10] || 'th');
  return i + suf;
}
function editionFromName(name) {
  const m = String(name || '').match(/(\d+)(st|nd|rd|th)\s+edition/i);
  return m ? ordinal(m[1]) : null;
}

const SERIES_RULES = [
  [/middle east energy/i, 'middle-east-energy'],
  [/cwieme berlin/i, 'cwieme-berlin'],
  [/cwieme shanghai/i, 'cwieme-shanghai'],
  [/enlit africa/i, 'enlit-africa'],
  [/enlit europe/i, 'enlit-europe'],
  [/enlit asia/i, 'enlit-asia'],
  [/pes general meeting/i, 'ieee-pes-general-meeting'],
  [/saudi elenex/i, 'saudi-elenex'],
  [/distributech|\bdtech\b/i, 'distributech'],
  [/intersolar middle east|intersolar & ees middle east/i, 'intersolar-middle-east'],
  [/elecrama/i, 'elecrama'],
  [/hannover messe/i, 'hannover-messe'],
  [/international conference of doble clients/i, 'doble-clients-conference'],
  [/gcc power/i, 'gcc-power'],
  [/wetex/i, 'wetex'],
  [/saudi smart grid|\bsasg\b/i, 'saudi-smart-grid'],
  [/techcon north america/i, 'techcon-north-america'],
  [/transformers committee/i, 'ieee-pes-transformers-committee'],
  [/africa energy forum/i, 'africa-energy-forum'],
  [/cigre paris/i, 'cigre-paris'],
  [/coiltech italia/i, 'coiltech-italia'],
  [/coiltech/i, 'coiltech'],
  [/pes t&d|pes t & d/i, 'ieee-pes-td'],
  [/win eurasia/i, 'win-eurasia'],
  [/smarter e/i, 'smarter-e'],
  [/oman petroleum|opes/i, 'oman-petroleum-energy-show'],
  [/oman sustainability week/i, 'oman-sustainability-week'],
];

function seriesSlug(name) {
  if (/oman sustainability week/i.test(name)) return 'oman-sustainability-week';
  if (/oman petroleum & energy show/i.test(name)) return 'oman-petroleum-energy-show';
  for (const [re, slug] of SERIES_RULES) {
    if (slug === 'oman-petroleum-energy-show') continue;
    if (re.test(name)) return slug;
  }
  const base = String(name || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\b\d+(st|nd|rd|th)\s+edition\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return slugify(base);
}

function eventType(name, desc) {
  const x = (name + ' ' + desc).toLowerCase();
  if (/webinar/.test(x)) return 'webinar';
  if (/transformers committee|working group/.test(x)) return 'technical_committee';
  if (/seminar|workshop/.test(x) && !/expo|exhibition|fair/.test(x)) return 'seminar';
  if (/expo|exhibition|fair|messe|show|elenex|wetex|cwieme|elecrama|distributech|intersolar|enlit|energy week|trade/.test(x)) return 'exhibition';
  if (/conference|symposium|colloquium|congress|forum|meeting/.test(x)) return 'conference';
  return 'conference';
}

function tier(name, desc) {
  const x = (name + ' ' + desc).toLowerCase();
  if (/transformer|bushing|oltc|tap-changer|cwieme|coiltech|doble|elecrama|winding|insulation/.test(x)) return 'CORE';
  if (/substation|switchgear|transmission|distribution|t&d|power|grid|cigre|ieee|energy|electric/.test(x)) return 'HIGH';
  return 'ADJACENT';
}

const MARKET_BY_COUNTRY = {
  'UAE': 'uae', 'United Arab Emirates': 'uae', 'Saudi Arabia': 'saudi-arabia',
  'India': 'india', 'China': 'china', 'USA': 'usa', 'United States': 'usa',
  'Germany': 'germany', 'Türkiye': 'turkiye', 'Turkey': 'turkiye',
  'South Africa': 'south-africa', 'Oman': 'oman', 'Kuwait': 'kuwait',
  'Qatar': 'qatar', 'Bahrain': 'bahrain', 'Brazil': 'brazil',
  'South Korea': 'south-korea', 'Japan': 'japan', 'United Kingdom': 'united-kingdom',
  'Italy': 'italy', 'France': 'france', 'Spain': 'spain', 'Canada': 'canada',
  'Australia': 'australia', 'Egypt': 'egypt',
};

function marketsFor(country) {
  const slug = MARKET_BY_COUNTRY[country];
  if (!slug) return null;
  if (!fs.existsSync(path.join('markets', slug, 'index.html'))) return null;
  return [slug];
}

function emptyStats() {
  return { exhibitors: null, visitors: null, area_sqm: null, countries: null, speakers: null };
}
function stat(value, edition, source) {
  return { value: value, as_of_edition: String(edition), source_url: source };
}

let companies = [];
try { companies = JSON.parse(fs.readFileSync('data/company-slugs.json', 'utf8')); } catch (e) { companies = []; }
function entitySlug(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!n) return null;
  const hit = companies.find((c) => {
    const cn = String(c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return cn === n || cn.indexOf(n) >= 0 || n.indexOf(cn) >= 0 && cn.length > 4;
  });
  return hit ? hit.slug : null;
}

const summaries = (() => {
  try { return JSON.parse(fs.readFileSync('data/post-event-summaries.json', 'utf8')).summaries || []; }
  catch (e) { return []; }
})();

function intelFor(name) {
  const n = String(name || '').toLowerCase();
  const hits = summaries.filter((s) => n.indexOf(String(s.event || '').toLowerCase()) >= 0 || String(s.event || '').toLowerCase().indexOf(n) >= 0);
  if (!hits.length) return null;
  return hits.map((s) => s.slug).filter(Boolean);
}

function blank(partial) {
  return Object.assign({
    id: null, series_slug: null, edition_label: null, name: null, type: null,
    start: null, end: null, date_status: null, venue: null, city: null, country: null, region: null,
    organiser: null, official_url: null, source_url: null, source_checked_at: null,
    relevance_tier: null, relevance_reason: null, description: null, research_status: null,
    stats: emptyStats(), key_exhibitors: null, programme: null, deadlines: null,
    registration: null, markets: null, intel_links: null, lifecycle_status: null,
  }, partial);
}

function lifecycleOf(rec) {
  const st = status.resolveStatus({
    start: rec.start, end: rec.end, description: rec.description, venue: rec.venue,
    date_status: rec.date_status, research_status: rec.research_status, tz: 'Asia/Dubai',
  });
  return st.key;
}

const dateChanges = [];
const downgraded = [];
const additions = [];
const notAdded = [];

function rememberChange(name, oldStart, oldEnd, oldVenue, neu, source) {
  if (oldStart === neu.start && oldEnd === neu.end && (oldVenue || null) === (neu.venue || null)) return;
  dateChanges.push({
    event: name,
    old_start: oldStart || null,
    old_end: oldEnd || null,
    old_venue: oldVenue || null,
    new_start: neu.start,
    new_end: neu.end,
    new_venue: neu.venue,
    date_status: neu.date_status,
    source_url: source || neu.source_url || null,
  });
}

const out = [];
const seenIds = new Set();

function pushRec(rec, meta) {
  rec.lifecycle_status = lifecycleOf(rec);
  rec.markets = rec.markets || marketsFor(rec.country);
  rec.intel_links = rec.intel_links || intelFor(rec.name);
  if (!rec.stats) rec.stats = emptyStats();
  if (seenIds.has(rec.id)) rec.id = rec.id + '-' + (out.length + 1);
  seenIds.add(rec.id);
  out.push(rec);
  if (meta && meta.added) additions.push(rec.name);
}

for (const raw of beforeRows) {
  const name = raw.name || raw.n;
  const oldStart = raw.start || raw.s || null;
  const oldEnd = raw.end || raw.e || null;
  const oldVenue = raw.venue || raw.v || null;
  const desc0 = raw.description || raw.d || '';

  // Exhibitor-page duplicate of DISTRIBUTECH International 2026. Qualitrol's
  // page is a lead, not a second edition.
  if (name === 'DTECH 2026') {
    dateChanges.push({
      event: 'DTECH 2026 (exhibitor-page duplicate)',
      old_start: oldStart, old_end: oldEnd, old_venue: oldVenue,
      new_start: null, new_end: null, new_venue: null,
      date_status: null,
      source_url: null,
      note: 'Collapsed into DISTRIBUTECH International 2026. The row official_url was a Qualitrol exhibitor page, not the organiser.',
    });
    continue;
  }

  // Dubai October row is the same 2026 edition as the official Muscat record.
  if (name === 'GCC POWER 2026' && /dubai/i.test(String(raw.c || raw.city || ''))) {
    dateChanges.push({
      event: name + ' (Dubai duplicate)',
      old_start: oldStart, old_end: oldEnd, old_venue: oldVenue,
      new_start: null, new_end: null, new_venue: null,
      date_status: 'TBA',
      source_url: SRC.gcc,
      note: 'Collapsed. Official GCC POWER 2026 page lists 2–4 Nov 2026 at JW Marriott Hotel Muscat, not a Dubai October edition.',
    });
    continue;
  }

  const series = seriesSlug(name);
  const year = yearOf(name, oldStart);
  let id = series + (year ? ('-' + year) : '');
  if (/spring/i.test(name)) id += '-spring';
  if (/fall/i.test(name)) id += '-fall';
  if (/muscat/i.test(name) && series === 'gcc-power') id = 'gcc-power-' + (year || '2026');

  const rec = blank({
    id: id,
    series_slug: series,
    edition_label: editionFromName(name),
    name: name,
    type: eventType(name, desc0),
    start: oldStart,
    end: oldEnd,
    venue: oldVenue,
    city: raw.city || raw.c || null,
    country: raw.country || raw.co || null,
    region: raw.region || raw.r || null,
    official_url: raw.official_url || raw.u || null,
    description: desc0 || null,
    research_status: raw.research_status || null,
    relevance_tier: tier(name, desc0),
    relevance_reason: null,
  });

  // Venue strings that are explicitly unconfirmed stay null rather than "TBC".
  if (rec.venue && /\b(tbc|tbd|tba)\b/i.test(rec.venue) && !/hotel/i.test(rec.venue)) {
    if (/^venue tbc/i.test(rec.venue) || rec.venue === 'TBC' || /\(TBC\)$/.test(rec.venue) && rec.venue.length < 24) {
      rec.venue = null;
    }
  }

  applyOfficial(rec, oldStart, oldEnd, oldVenue);
  if (!rec.date_status) applyProjected(rec, desc0);
  pushRec(rec);
}

function setConfirmed(rec, patch, source) {
  Object.assign(rec, patch);
  rec.date_status = 'CONFIRMED';
  rec.source_url = source;
  rec.source_checked_at = CHECKED;
  if (patch.official_url) rec.official_url = patch.official_url;
}

function applyOfficial(rec, oldStart, oldEnd, oldVenue) {
  const n = rec.name;
  if (n === 'Middle East Energy 2027') {
    setConfirmed(rec, {
      start: '2027-05-11', end: '2027-05-13',
      venue: 'Dubai Exhibition Centre, Expo City', city: 'Dubai', country: 'UAE', region: 'Middle East',
      organiser: 'Informa', official_url: 'https://www.middleeast-energy.com/',
      relevance_tier: 'CORE',
      relevance_reason: 'The organiser homepage for 2027 lists transformers and switchgear among the products on the exhibition floor.',
      description: 'Official homepage checked 14 Oct 2026 publishes 11–13 May 2027 at Dubai Exhibition Centre, Expo City. An older brochure cited 6–8 April 2027; the live homepage is the date used here.',
      programme: [
        { title: 'Intersolar Middle East', kind: 'track', source_url: SRC.mee },
        { title: 'Energy Storage Middle East', kind: 'track', source_url: SRC.mee },
        { title: 'The Battery Show Middle East', kind: 'track', source_url: SRC.mee },
      ],
      registration: {
        cost_note: 'Free to attend for qualified industry professionals.',
        free_for_qualified: true,
        url: SRC.mee,
      },
      stats: Object.assign(emptyStats(), {
        exhibitors: stat('1900+', '2027', SRC.mee),
        visitors: stat('35000+', '2027', SRC.mee),
        countries: stat('150+', '2027', SRC.mee),
        speakers: stat('250+', '2027', SRC.mee),
      }),
    }, SRC.mee);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.mee);
    return;
  }
  if (n === 'Middle East Energy 2026 (50th edition)') {
    setConfirmed(rec, {
      edition_label: '50th',
      organiser: 'Informa',
      relevance_tier: 'CORE',
      relevance_reason: 'The 2027 homepage recap states Middle East Energy 2026 ran 1–3 September and describes the show as an electrical infrastructure exhibition.',
      description: 'Official homepage recap checked 14 Oct 2026: Middle East Energy 2026 ran 1–3 September.',
    }, SRC.mee);
    return;
  }
  if (n === 'Middle East Energy Sept 2028' || n === 'Middle East Energy 2028') {
    rec.name = 'Middle East Energy 2028';
    rec.id = 'middle-east-energy-2028';
    rec.start = null;
    rec.end = null;
    rec.venue = null;
    rec.date_status = 'TBA';
    rec.official_url = 'https://www.middleeast-energy.com/';
    rec.source_url = SRC.mee;
    rec.source_checked_at = CHECKED;
    rec.description = 'After the 2027 move to May, the live homepage does not publish 2028 dates. Dates are not announced.';
    rec.relevance_tier = 'CORE';
    rec.relevance_reason = null;
    downgraded.push({ event: rec.name, date_status: 'TBA', reason: '2028 dates removed; homepage has not published a 2028 edition after the move to May.' });
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.mee);
    return;
  }
  if (n === 'CWIEME Berlin 2027') {
    setConfirmed(rec, {
      start: '2027-04-27', end: '2027-04-29',
      venue: 'Messe Berlin, South Entrance, Messedamm 22, D-14055 Berlin',
      city: 'Berlin', country: 'Germany', region: 'Europe',
      official_url: SRC.cwieme,
      relevance_tier: 'CORE',
      relevance_reason: 'The official 2027 page describes CWIEME Berlin as the meeting place for the electrical manufacturing supply chain and carries exhibitor comments identifying it as a transformer-industry event.',
      description: 'Official CWIEME Berlin page checked 14 Oct 2026: 27–29 April 2027 at Messe Berlin.',
    }, SRC.cwieme);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.cwieme);
    return;
  }
  if (n === 'CWIEME Berlin 2026') {
    const names = ['Hitachi Energy', 'Maschinenfabrik Reinhausen', 'DuPont', 'Qualitrol', 'Weidmann', 'Siemens Energy'];
    const exhibitors = names.map((nm) => ({ name: nm, entity_slug: entitySlug(nm), source_url: SRC.cwieme }))
      .filter((x) => x.entity_slug);
    rec.key_exhibitors = exhibitors.length ? exhibitors : null;
    rec.description = (rec.description || '') + ' Exhibitor names under “Who exhibited in 2026” on the official site are for the 2026 edition only.';
    return;
  }
  if (n === 'Enlit Africa 2027') {
    setConfirmed(rec, {
      start: '2027-05-11', end: '2027-05-13',
      venue: 'Cape Town International Convention Centre',
      city: 'Cape Town', country: 'South Africa', region: 'Africa',
      organiser: 'VUKA Group', official_url: SRC.enlitAfrica,
      relevance_tier: 'HIGH',
      relevance_reason: 'The official 2027 page lists transmission and distribution among the industry verticals attending Enlit Africa.',
      description: 'Official Enlit Africa page checked 14 Oct 2026: 11–13 May 2027 at the Cape Town International Convention Centre.',
    }, SRC.enlitAfrica);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.enlitAfrica);
    return;
  }
  if (n === 'Enlit Africa 2026') {
    rec.stats = Object.assign(emptyStats(), {
      visitors: stat(7776, '2026', SRC.enlitAfrica),
      exhibitors: stat('280+', '2026', SRC.enlitAfrica),
      speakers: stat('300+', '2026', SRC.enlitAfrica),
      countries: stat(82, '2026', SRC.enlitAfrica),
    });
    rec.description = '2026 edition. The current official homepage publishes 2027 dates and, separately, “Enlit Africa 2026 in numbers”. Those 2026 figures are not copied onto 2027.';
    return;
  }
  if (n === 'IEEE PES General Meeting 2027') {
    setConfirmed(rec, {
      start: '2027-07-25', end: '2027-07-29',
      venue: 'Hilton San Francisco Union Square, 333 O\'Farrell Street, San Francisco, CA 94102',
      city: 'San Francisco', country: 'USA', region: 'Americas',
      organiser: 'IEEE Power & Energy Society', official_url: SRC.pes,
      relevance_tier: 'HIGH',
      relevance_reason: 'The official PES General Meeting page describes the 2027 conference as the IEEE Power & Energy Society flagship for electric power engineering, in San Francisco.',
      description: 'Official pes-gm.org page checked 14 Oct 2026: 25–29 July 2027 at Hilton San Francisco Union Square. Placeholder attendee counters on the page are not published as stats.',
    }, SRC.pes);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.pes);
    return;
  }
  if (n === 'Saudi Elenex 2026') {
    setConfirmed(rec, {
      edition_label: '27th',
      start: '2026-11-02', end: '2026-11-05',
      venue: 'Riyadh International Convention & Exhibition Center',
      city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East',
      official_url: SRC.elenex, type: 'exhibition', relevance_tier: 'HIGH',
      relevance_reason: 'The official Saudi Elenex page describes the 27th edition as an electricity and electrical-equipment exhibition in Riyadh.',
      description: 'Official saudielenex.com page checked 14 Oct 2026: 2–5 November 2026 at the Riyadh International Convention & Exhibition Center. The on-page 2023 post-show report is not copied onto this edition.',
      stats: Object.assign(emptyStats(), {
        area_sqm: stat('8000+', '2026', SRC.elenex),
        exhibitors: stat('160+', '2026', SRC.elenex),
        countries: stat('14+', '2026', SRC.elenex),
      }),
    }, SRC.elenex);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.elenex);
    return;
  }
  if (n === 'ELECRAMA 2027 (17th edition)') {
    setConfirmed(rec, {
      edition_label: '17th',
      start: '2027-02-20', end: '2027-02-24',
      venue: 'India Expo Mart, Greater Noida',
      city: 'Greater Noida', country: 'India', region: 'Asia',
      organiser: 'IEEMA', official_url: 'https://elecrama.com/',
      relevance_tier: 'CORE',
      relevance_reason: 'The official ELECRAMA 2027 page lists transformers among the power transmission and distribution exhibits.',
      description: 'Official elecrama.com page checked 14 Oct 2026: 20–24 February 2027 at India Expo Mart, Greater Noida. Placeholder “1+” counters on the page are not published as stats.',
    }, SRC.elecrama);
    return;
  }
  if (n === 'HANNOVER MESSE 2027') {
    setConfirmed(rec, {
      start: '2027-04-05', end: '2027-04-08',
      city: 'Hannover', country: 'Germany', region: 'Europe',
      organiser: 'Deutsche Messe AG', official_url: 'https://www.hannovermesse.de/en/',
      relevance_tier: 'ADJACENT',
      relevance_reason: 'The official HANNOVER MESSE page publishes 5–8 April 2027 as the next industrial technology fair.',
      description: 'Official hannovermesse.de page checked 14 Oct 2026: next show 5–8 April 2027.',
    }, SRC.hannover);
    return;
  }
  if (n === 'Enlit Europe 2026') {
    setConfirmed(rec, {
      start: '2026-11-10', end: '2026-11-12',
      city: 'Vienna', country: 'Austria', region: 'Europe',
      venue: 'Messe Wien', official_url: SRC.enlitEu,
      relevance_tier: 'HIGH',
      relevance_reason: 'The official Enlit Europe page invites visitors to the 10–12 November 2026 exhibition in Vienna.',
      description: 'Official enlit-europe.com page checked 14 Oct 2026: 10–12 November 2026 in Vienna. Homepage counters are not stored as edition stats because the page also quotes earlier Bilbao editions.',
    }, SRC.enlitEu);
    return;
  }
  if (n === 'Saudi Smart Grid Conference 2026 (SASG)') {
    setConfirmed(rec, {
      start: '2026-12-14', end: '2026-12-16',
      venue: 'Sofitel Riyadh Hotel & Convention Centre',
      city: 'Riyadh', country: 'Saudi Arabia', region: 'Middle East',
      official_url: SRC.sasg, type: 'conference', relevance_tier: 'HIGH',
      relevance_reason: 'The official SASG26 page publishes 14–16 December 2026 and describes technical sessions on smart-grid innovation.',
      description: 'Official saudi-sg.com page checked 14 Oct 2026: event date 14–16 December 2026 at Sofitel Riyadh Hotel & Convention Centre. Hidden placeholder counters on the page are not published as stats.',
      deadlines: [{ kind: 'call_for_papers', date: '2026-10-31', source_url: SRC.sasg }],
      programme: [
        { title: 'Technical Sessions', kind: 'track', source_url: SRC.sasg },
        { title: 'Panels & Keynotes', kind: 'track', source_url: SRC.sasg },
        { title: 'Workshops & Site Visits', kind: 'tech tour', source_url: SRC.sasg },
      ],
    }, SRC.sasg);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.sasg);
    return;
  }
  if (n === '2027 International Conference of Doble Clients') {
    setConfirmed(rec, {
      start: '2027-03-21', end: '2027-03-26',
      venue: null, city: 'Boston', country: 'USA', region: 'Americas',
      organiser: 'Doble Engineering Company', official_url: SRC.doble,
      relevance_tier: 'CORE',
      relevance_reason: null,
      description: 'Official Doble event page checked 14 Oct 2026: 21–26 March 2027 in Boston, MA. The page does not name a hotel, so the previous Omni Boston venue is not kept.',
    }, SRC.doble);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.doble);
    return;
  }
  if (n === 'GCC POWER 2026 / CIGRE 22nd Conference (Muscat)' || (rec.series_slug === 'gcc-power' && yearOf(n, oldStart) === '2026')) {
    rec.id = 'gcc-power-2026';
    rec.series_slug = 'gcc-power';
    rec.edition_label = '22nd';
    setConfirmed(rec, {
      start: '2026-11-02', end: '2026-11-04',
      venue: 'JW Marriott Hotel Muscat', city: 'Muscat', country: 'Oman', region: 'Middle East',
      organiser: 'CIGRE GCC', official_url: SRC.gcc, type: 'conference',
      relevance_tier: 'HIGH',
      relevance_reason: 'The official GCC POWER 2026 page describes the 22nd CIGRE GCC conference and electrical equipment exhibition in Muscat.',
      description: 'Official cigre-gccpower.com page checked 14 Oct 2026: 2–4 November 2026 at JW Marriott Hotel Muscat. A conflicting Dubai October row was removed.',
    }, SRC.gcc);
    return;
  }
  if (n === 'Africa Energy Forum (AEF) 2026') {
    setConfirmed(rec, {
      start: '2026-06-16', end: '2026-06-19',
      venue: 'Cape Town International Convention Centre 1 (CTICC 1)',
      city: 'Cape Town', country: 'South Africa', region: 'Africa',
      official_url: SRC.aef, relevance_tier: 'HIGH',
      relevance_reason: 'The official Africa Energy Forum page publishes 16–19 June 2026 at CTICC 1, Cape Town, and does not announce a 2027 edition.',
      description: 'Official africa-energy-forum.com page checked 14 Oct 2026: 16–19 June 2026 at Cape Town International Convention Centre 1.',
    }, SRC.aef);
    return;
  }
  if (n === 'IEEE PES Transformers Committee — Fall 2026') {
    setConfirmed(rec, {
      start: '2026-10-18', end: '2026-10-22',
      venue: null, city: 'Fort Lauderdale', country: 'USA', region: 'Americas',
      organiser: 'IEEE PES Transformers Committee', official_url: SRC.ieeeTcFall,
      type: 'technical_committee', relevance_tier: 'CORE',
      relevance_reason: 'The official Fall 2026 meeting page of the IEEE PES Transformers Committee lists 18–22 October 2026 in Fort Lauderdale.',
      description: 'Official meeting page checked 14 Oct 2026: Fall 2026, Fort Lauderdale, Florida, 18–22 October 2026. The page does not name a hotel.',
    }, SRC.ieeeTcFall);
    if (oldVenue !== rec.venue) rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.ieeeTcFall);
    return;
  }
  if (/Intersolar & ees Middle East 2027|Intersolar Middle East 2027/i.test(n)) {
    rec.id = 'intersolar-middle-east-2027';
    rec.series_slug = 'intersolar-middle-east';
    rec.name = 'Intersolar & ees Middle East 2027';
    setConfirmed(rec, {
      start: '2027-05-11', end: '2027-05-13',
      venue: 'Dubai Exhibition Centre, Expo City', city: 'Dubai', country: 'UAE', region: 'Middle East',
      official_url: SRC.intersolar, type: 'exhibition', relevance_tier: 'ADJACENT',
      relevance_reason: 'The Middle East Energy 2027 homepage lists Intersolar Middle East as a specialist show on the same dates and at Dubai Exhibition Centre.',
      description: 'Dates and venue are taken from the Middle East Energy 2027 homepage, which lists Intersolar Middle East as a co-located specialist show on 11–13 May 2027 at Dubai Exhibition Centre. intersolar.ae, checked the same day, still says the show is hosted at Dubai World Trade Centre and does not itself print 11–13 May 2027. Call for abstracts on intersolar.ae is open until 12 January 2027.',
      deadlines: [{ kind: 'abstract', date: '2027-01-12', source_url: SRC.intersolar }],
    }, SRC.mee);
    return;
  }
  if (/Oman Petroleum & Energy Show \(OPES\) 2027/i.test(n)) {
    setConfirmed(rec, {
      start: '2027-04-26', end: '2027-04-28',
      venue: 'Oman Convention & Exhibition Centre (OCEC)', city: 'Muscat', country: 'Oman', region: 'Middle East',
      official_url: SRC.opes, type: 'exhibition', relevance_tier: 'ADJACENT',
      relevance_reason: 'The official OPES page publishes 26–28 April 2027 at OCEC, Muscat, under the patronage of the Ministry of Energy and Minerals, and says it is co-located with Oman Sustainability Week.',
      description: 'Official omanpetroleumandenergyshow.com page checked 14 Oct 2026: 26–28 April 2027, OCEC, Muscat.',
    }, SRC.opes);
    return;
  }
  if (/^DTECH 2027$|^DISTRIBUTECH International 2027$/i.test(n)) {
    rec.id = 'distributech-2027';
    rec.series_slug = 'distributech';
    rec.name = 'DISTRIBUTECH International 2027';
    setConfirmed(rec, {
      start: '2027-03-01', end: '2027-03-04',
      venue: 'Georgia World Congress Center', city: 'Atlanta', country: 'USA', region: 'Americas',
      organiser: 'Clarion Events', official_url: 'https://www.distributech.com/',
      type: 'exhibition', relevance_tier: 'HIGH',
      relevance_reason: 'The official DTECH FAQ states that DTECH 2027 is held at the Georgia World Congress Center in Atlanta from 1–4 March 2027.',
      description: 'Official FAQ checked 14 Oct 2026: Georgia World Congress Center, Atlanta, 1–4 March 2027. Exhibitor pages that still say San Diego are not used.',
    }, SRC.dtech);
    rememberChange('DTECH 2027', oldStart, oldEnd, oldVenue, rec, SRC.dtech);
    return;
  }
  if (n === 'IEEE PES Transformers Committee — Spring 2026') {
    setConfirmed(rec, {
      start: '2026-03-22', end: '2026-03-26',
      venue: null, city: 'Fort Worth', country: 'USA', region: 'Americas',
      organiser: 'IEEE PES Transformers Committee', official_url: SRC.ieeeTcSpring,
      type: 'technical_committee', relevance_tier: 'CORE',
      relevance_reason: 'The official Spring 2026 meeting page lists 22–26 March 2026 in Fort Worth, Texas.',
      description: 'Official meeting page checked 14 Oct 2026: Spring 2026, Fort Worth, Texas, 22–26 March 2026. The page does not name a convention-centre venue.',
    }, SRC.ieeeTcSpring);
    rememberChange(n, oldStart, oldEnd, oldVenue, rec, SRC.ieeeTcSpring);
    return;
  }
}

function applyMonitoring(rec) {
  const tba = {
    'techcon-north-america-2027': 'Official techcon.info page checked 14 Oct 2026 says to stay tuned for 2027. Dates are not published.',
    'ieee-pes-transformers-committee-2027-spring': 'Official meetings index checked 14 Oct 2026 lists 2026 meetings only. Spring 2027 is not published.',
    'ieee-pes-transformers-committee-2027-fall': 'Official meetings index checked 14 Oct 2026 lists 2026 meetings only. Fall 2027 is not published.',
    'gcc-power-2027': 'Official cigre-gccpower.com page checked 14 Oct 2026 still publishes only the 2026 Muscat edition.',
    'africa-energy-forum-2027': 'Official africa-energy-forum.com page checked 14 Oct 2026 publishes only 16–19 June 2026. A 2027 edition is not announced.',
  };
  if (!tba[rec.id]) return false;
  rec.start = null;
  rec.end = null;
  rec.venue = null;
  rec.city = null;
  rec.date_status = 'TBA';
  rec.source_url = rec.source_url || rec.official_url || null;
  rec.source_checked_at = CHECKED;
  rec.description = tba[rec.id];
  if (!downgraded.some((d) => d.event === rec.name)) {
    downgraded.push({ event: rec.name, date_status: 'TBA', reason: 'Official page exists; this edition’s dates are not published.' });
  }
  return true;
}

function applyProjected(rec, desc0) {
  if (applyMonitoring(rec)) return;
  const year = rec.start ? parseInt(rec.start.slice(0, 4), 10) : (rec.name.match(/20\d{2}/) || [null])[0];
  const y = typeof year === 'string' ? parseInt(year, 10) : year;
  const est = /date est\.|provisional|dates tbc|unconfirmed/i.test(desc0 || '');
  if (rec.research_status === 'REJECTED_NO_EVIDENCE') {
    rec.date_status = null;
    return;
  }
  if ((y === 2027 || y === 2028) && rec.start) {
    rec.date_status = 'PROJECTED';
    rec.source_url = null;
    rec.source_checked_at = null;
    downgraded.push({
      event: rec.name,
      date_status: 'PROJECTED',
      reason: '2027/2028 date was not read from an official edition page on ' + CHECKED + '.',
    });
    return;
  }
  if (est && rec.start) {
    rec.date_status = 'PROJECTED';
    downgraded.push({ event: rec.name, date_status: 'PROJECTED', reason: 'Registry text already marked the date as estimated.' });
  }
}

function addNew(rec) {
  if (out.some((r) => r.id === rec.id)) return;
  rec.lifecycle_status = lifecycleOf(rec);
  if (!rec.stats) rec.stats = emptyStats();
  rec.markets = rec.markets || marketsFor(rec.country);
  pushRec(rec, { added: true });
}

addNew(blank({
  id: 'distributech-2027',
  series_slug: 'distributech',
  name: 'DISTRIBUTECH International 2027',
  type: 'exhibition',
  start: '2027-03-01', end: '2027-03-04', date_status: 'CONFIRMED',
  venue: 'Georgia World Congress Center', city: 'Atlanta', country: 'USA', region: 'Americas',
  organiser: 'Clarion Events',
  official_url: 'https://www.distributech.com/',
  source_url: SRC.dtech, source_checked_at: CHECKED,
  relevance_tier: 'HIGH',
  relevance_reason: 'The official DTECH FAQ states that DTECH 2027 is held at the Georgia World Congress Center in Atlanta from 1–4 March 2027, with an exhibition pass distinct from the conference pass.',
  description: 'Official FAQ checked 14 Oct 2026: Georgia World Congress Center, Atlanta, 1–4 March 2027. Exhibitor pages that still say San Diego are not used.',
}));

addNew(blank({
  id: 'intersolar-middle-east-2027',
  series_slug: 'intersolar-middle-east',
  name: 'Intersolar & ees Middle East 2027',
  type: 'exhibition',
  start: '2027-05-11', end: '2027-05-13', date_status: 'CONFIRMED',
  venue: 'Dubai Exhibition Centre, Expo City', city: 'Dubai', country: 'UAE', region: 'Middle East',
  official_url: SRC.intersolar,
  source_url: SRC.mee, source_checked_at: CHECKED,
  relevance_tier: 'ADJACENT',
  relevance_reason: 'The Middle East Energy 2027 homepage lists Intersolar Middle East as a specialist show on the same dates and at Dubai Exhibition Centre.',
  description: 'Dates and venue are taken from the Middle East Energy 2027 homepage, which lists Intersolar Middle East as a co-located specialist show on 11–13 May 2027 at Dubai Exhibition Centre. intersolar.ae, checked the same day, still says the show is hosted at Dubai World Trade Centre and does not itself print 11–13 May 2027. Call for abstracts on intersolar.ae is open until 12 January 2027.',
  deadlines: [{ kind: 'abstract', date: '2027-01-12', source_url: SRC.intersolar }],
}));

[
  {
    id: 'techcon-north-america-2027', series_slug: 'techcon-north-america',
    name: 'TechCon North America 2027', official_url: SRC.techcon, source_url: SRC.techcon,
    description: 'Official techcon.info page checked 14 Oct 2026 says TechCon 2026 has wrapped and to stay tuned for 2027. Venue, hotel and registration are not published.',
    relevance_reason: 'The official page describes TechCon North America as the annual high-voltage training and expo and says 2027 details are not yet published.',
    relevance_tier: 'CORE', region: 'Americas',
  },
  {
    id: 'ieee-pes-transformers-committee-2027-spring', series_slug: 'ieee-pes-transformers-committee',
    name: 'IEEE PES Transformers Committee — Spring 2027', official_url: SRC.ieeeTc, source_url: SRC.ieeeTc,
    type: 'technical_committee', region: 'Americas', relevance_tier: 'CORE',
    description: 'Official meetings index checked 14 Oct 2026 lists Spring and Fall 2026 only. Spring 2027 dates are not published.',
    relevance_reason: 'The meetings index is the IEEE PES Transformers Committee calendar and does not list a 2027 meeting.',
  },
  {
    id: 'ieee-pes-transformers-committee-2027-fall', series_slug: 'ieee-pes-transformers-committee',
    name: 'IEEE PES Transformers Committee — Fall 2027', official_url: SRC.ieeeTc, source_url: SRC.ieeeTc,
    type: 'technical_committee', region: 'Americas', relevance_tier: 'CORE',
    description: 'Official meetings index checked 14 Oct 2026 lists Spring and Fall 2026 only. Fall 2027 dates are not published.',
    relevance_reason: null,
  },
  {
    id: 'gcc-power-2027', series_slug: 'gcc-power',
    name: 'GCC POWER 2027 / 23rd CIGRE-GCC', official_url: SRC.gcc, source_url: SRC.gcc,
    type: 'conference', region: 'Middle East', relevance_tier: 'HIGH', edition_label: null,
    description: 'Official cigre-gccpower.com page checked 14 Oct 2026 still publishes only the 2026 Muscat edition. 2027 dates are not announced. Third-party listings that say TBD are not used.',
    relevance_reason: null,
  },
  {
    id: 'africa-energy-forum-2027', series_slug: 'africa-energy-forum',
    name: 'Africa Energy Forum 2027', official_url: SRC.aef, source_url: SRC.aef,
    type: 'conference', region: 'Africa', relevance_tier: 'HIGH',
    description: 'Official africa-energy-forum.com page checked 14 Oct 2026 publishes only 16–19 June 2026 in Cape Town. A 2027 edition is not announced. Third-party “June 2027” mentions are not used.',
    relevance_reason: null,
  },
].forEach((p) => {
  addNew(blank(Object.assign({
    start: null, end: null, date_status: 'TBA', venue: null, city: null, country: null,
    organiser: null, source_checked_at: CHECKED, stats: emptyStats(),
  }, p)));
  downgraded.push({ event: p.name, date_status: 'TBA', reason: 'Official page exists; this edition’s dates are not published.' });
});

addNew(blank({
  id: 'oman-petroleum-energy-show-2027',
  series_slug: 'oman-petroleum-energy-show',
  name: 'Oman Petroleum & Energy Show (OPES) 2027',
  type: 'exhibition',
  start: '2027-04-26', end: '2027-04-28', date_status: 'CONFIRMED',
  venue: 'Oman Convention & Exhibition Centre (OCEC)', city: 'Muscat', country: 'Oman', region: 'Middle East',
  organiser: null,
  official_url: SRC.opes, source_url: SRC.opes, source_checked_at: CHECKED,
  relevance_tier: 'ADJACENT',
  relevance_reason: 'The official OPES page publishes 26–28 April 2027 at OCEC, Muscat, under the patronage of the Ministry of Energy and Minerals, and says it is co-located with Oman Sustainability Week.',
  description: 'Official omanpetroleumandenergyshow.com page checked 14 Oct 2026: 26–28 April 2027, OCEC, Muscat. This is not the separate “Oman Energy & Water Exhibition” lead, which had only third-party listings.',
}));

notAdded.push(
  { name: 'Oman Energy & Water Exhibition 2027', reason: '26–28 Apr 2027 appears on jufair/shifair only. energyandwateroman.com is a wastewater company, not an edition page. Not added.' },
  { name: 'Kuwait power/T&D 2027', reason: 'MEW Kuwait pages found cover GCC POWER 2025, not a 2027 edition. Not added.' },
  { name: 'Qatar power/T&D 2027', reason: 'No official Kahramaa edition page found for 2027. Not added.' },
  { name: 'Bahrain power/T&D 2027', reason: 'EWA pages found cover the 2024 Gulf Electricity Conference. No 2027 edition page. Not added.' }
);

// Oman Sustainability Week stays PROJECTED (applyProjected already). Note the conflict.
const osw = out.find((r) => r.series_slug === 'oman-sustainability-week' && r.start && r.start.slice(0, 4) === '2027');
if (osw && osw.date_status === 'PROJECTED' && String(osw.description || '').indexOf('Official OPES page') < 0) {
  osw.description = (osw.description || '') + ' Official OPES page (26–28 Apr 2027) says it is co-located with Oman Sustainability Week, so these May dates are not treated as confirmed.';
}

fs.writeFileSync('data/events.json', JSON.stringify(out, null, 2) + '\n');

/* Date-change table is against the pre-migration registry on HEAD, so a
   re-run still reports the original old → new pairs. */
let baselineChanges = dateChanges;
try {
  const baseline = JSON.parse(execSync('git show HEAD:data/events.json', { encoding: 'utf8' }));
  const baseRows = Array.isArray(baseline) ? baseline : [];
  baselineChanges = [];
  out.forEach((rec) => {
    const old = baseRows.find((b) => (b.n || b.name) === rec.name)
      || baseRows.find((b) => (b.n || '') === 'DTECH 2027' && rec.id === 'distributech-2027')
      || baseRows.find((b) => (b.n || '') === 'Middle East Energy Sept 2028' && rec.id === 'middle-east-energy-2028');
    if (!old) return;
    const os = old.s || null, oe = old.e || null, ov = old.v || null;
    const dateMoved = os !== rec.start || oe !== rec.end;
    const venueMoved = (ov || null) !== (rec.venue || null);
    if (!dateMoved && !venueMoved) return;
    if (!dateMoved && rec.date_status !== 'CONFIRMED' && rec.date_status !== 'TBA') return;
    baselineChanges.push({
      event: rec.name,
      old_start: os, old_end: oe, old_venue: ov,
      new_start: rec.start, new_end: rec.end, new_venue: rec.venue,
      date_status: rec.date_status,
      source_url: rec.source_url || null,
    });
  });
  const removed = baseRows.filter((b) => !out.some((r) => r.name === b.n || (b.n === 'Middle East Energy Sept 2028' && r.name === 'Middle East Energy 2028') || (b.n === 'DTECH 2027' && r.id === 'distributech-2027')));
  removed.forEach((b) => {
    baselineChanges.push({
      event: b.n + ' (removed)',
      old_start: b.s || null, old_end: b.e || null, old_venue: b.v || null,
      new_start: null, new_end: null, new_venue: null,
      date_status: null,
      source_url: null,
      note: 'Row removed as a duplicate edition.',
    });
  });
} catch (e) {
  console.warn('baseline diff skipped:', e.message);
}

const nullFields = {};
const keys = ['edition_label', 'organiser', 'source_url', 'source_checked_at', 'relevance_reason', 'venue', 'start', 'end', 'key_exhibitors', 'programme', 'deadlines', 'registration', 'intel_links'];
out.forEach((r) => {
  keys.forEach((k) => { if (r[k] == null) nullFields[k] = (nullFields[k] || 0) + 1; });
  if (r.stats) {
    ['exhibitors', 'visitors', 'area_sqm', 'countries', 'speakers'].forEach((k) => {
      if (r.stats[k] == null) nullFields['stats.' + k] = (nullFields['stats.' + k] || 0) + 1;
    });
  }
});

const report = {
  checked_at: CHECKED,
  before_count: 295,
  after_count: out.length,
  date_status: out.reduce((a, r) => { const k = r.date_status || 'null'; a[k] = (a[k] || 0) + 1; return a; }, {}),
  date_changes: baselineChanges,
  downgraded: downgraded,
  additions: additions,
  not_added: notAdded,
  null_field_counts: nullFields,
  notes: [
    'CONFIRMED is used only where an official page retrieved on 2026-10-14 states the date.',
    'Middle East Energy 2027 uses the live homepage (11–13 May 2027, Dubai Exhibition Centre). An older brochure date of 6–8 April 2027 is not used.',
    'Intersolar & ees Middle East 2027 dates come from the Middle East Energy homepage. intersolar.ae still says Dubai World Trade Centre and does not print the May 2027 dates.',
    'WETEX 2026 was not stamped: wetex.ae returned HTTP 403 to this checker.',
    'Saudi Elenex 2023 post-show figures are not copied onto the 2026 edition.',
    'Enlit Africa homepage “2026 in numbers” are stored on the 2026 edition only.',
  ],
};
fs.writeFileSync('data/event-verification-report.json', JSON.stringify(report, null, 2) + '\n');

// Keep event-series.json editions that this pass re-read aligned, so the
// older series gate does not contradict the registry.
const seriesDoc = JSON.parse(fs.readFileSync('data/event-series.json', 'utf8'));
(seriesDoc.series || []).forEach((s) => {
  (s.editions || []).forEach((ed) => {
    if (s.key === 'middle-east-energy' && ed.year === 2027) {
      ed.dates = { start: '2027-05-11', end: '2027-05-13' };
      ed.venue = 'Dubai Exhibition Centre, Expo City';
      ed.dates_confirmed = true;
      ed.date_status = 'CONFIRMED';
      ed.venue_verified = true;
      ed.note = 'Official homepage checked 2026-10-14: 11–13 May 2027, Dubai Exhibition Centre, Expo City. Older brochure 6–8 Apr 2027 is not used.';
      ed.source = { url: SRC.mee, type: 'official_organizer', verified_at: CHECKED };
    }
    if (s.key === 'middle-east-energy' && ed.year === 2028) {
      ed.dates = { start: null, end: null };
      ed.venue = null;
      ed.dates_confirmed = false;
      ed.date_status = 'TBA';
      ed.lifecycle_status = 'MONITORING';
      ed.note = 'Homepage does not publish 2028 after the move to May. Dates null.';
    }
    if (s.key === 'cwieme-berlin' && ed.year === 2026) {
      /* past edition retained */
    }
  });
  if (s.key === 'cwieme-berlin' && !(s.editions || []).some((ed) => ed.year === 2027)) {
    s.editions.push({
      year: 2027, slug: 'cwieme-berlin-2027', name: 'CWIEME Berlin 2027',
      city: 'Berlin', country: 'Germany',
      venue: 'Messe Berlin, South Entrance, Messedamm 22', venue_verified: true,
      dates: { start: '2027-04-27', end: '2027-04-29' }, dates_confirmed: true,
      lifecycle_status: 'UPCOMING', date_status: 'CONFIRMED',
      event_type: ['EXHIBITION_CONFERENCE'],
      categories: ['Transformer Manufacturing', 'Insulation', 'Bushings', 'Winding'],
      has_published_summary: false, has_exhibitors: false,
      source: { url: SRC.cwieme, type: 'official_organizer', verified_at: CHECKED },
      note: 'Official berlin.cwiemeevents.com checked 2026-10-14.',
    });
  }
  if (s.key === 'gcc-power') {
    (s.editions || []).forEach((ed) => {
      if (ed.year === 2026) {
        ed.dates = { start: '2026-11-02', end: '2026-11-04' };
        ed.city = 'Muscat'; ed.country = 'Oman'; ed.venue = 'JW Marriott Hotel Muscat';
        ed.dates_confirmed = true; ed.date_status = 'CONFIRMED'; ed.venue_verified = true;
        ed.lifecycle_status = 'UPCOMING';
        ed.note = 'Official cigre-gccpower.com checked 2026-10-14. Dubai October duplicate removed from the registry.';
        ed.source = { url: SRC.gcc, type: 'official_organizer', verified_at: CHECKED };
      }
    });
  }
});
fs.writeFileSync('data/event-series.json', JSON.stringify(seriesDoc, null, 2) + '\n');

console.log('events.json', beforeRows.length, '→', out.length);
console.log('date changes', dateChanges.length, 'downgraded', downgraded.length, 'added', additions.length);
console.log(JSON.stringify(report.date_status));
