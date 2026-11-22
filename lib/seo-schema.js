/* JSON-LD builders and validators for the public site.
 *
 * Facts come from the caller. This module does not invent addresses, ratings,
 * reviews, authors, or dates. LocalBusiness is used only when the caller
 * passes a sourced street address and does not ask for an Organization.
 * Organization JSON-LD never includes streetAddress.
 */
'use strict';

const { statedPlace } = require('./stated-place');
const ORIGIN = 'https://transformerpath.com';
const SCHEDULED = { CONFIRMED_UPCOMING: 1, LIVE: 1, COMPLETED: 1 };

function graph(nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}

function siteNodes() {
  return [
    {
      '@type': 'Organization',
      '@id': ORIGIN + '/#organization',
      name: 'TransformerPath',
      url: ORIGIN + '/',
      email: 'hello@transformerpath.com',
      logo: { '@type': 'ImageObject', url: ORIGIN + '/brand/og-image.png' },
      sameAs: ['https://www.linkedin.com/company/transformerpath']
    },
    {
      '@type': 'WebSite',
      '@id': ORIGIN + '/#website',
      name: 'TransformerPath',
      url: ORIGIN + '/',
      publisher: { '@id': ORIGIN + '/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: ORIGIN + '/search.html?q={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    }
  ];
}

function breadcrumbNode(pageUrl, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    '@id': pageUrl + '#breadcrumb',
    itemListElement: crumbs.map(function (c, i) {
      return { '@type': 'ListItem', position: i + 1, name: c.name, item: c.item };
    })
  };
}

function dropEmpty(obj) {
  Object.keys(obj).forEach(function (k) {
    if (obj[k] == null || obj[k] === '') delete obj[k];
  });
  return obj;
}

/**
 * Directory or manufacturer entry.
 * City, region and country are included only when the caller supplies them.
 * A dash or blank cell is missing and is left off the address. A sourced
 * street is emitted only on LocalBusiness. Organization JSON-LD keeps a
 * real city and country and omits streetAddress.
 */
function entryNode(pageUrl, rec) {
  const publishAsOrganization = !rec.street || !!rec.asOrganization;
  const address = dropEmpty({
    '@type': 'PostalAddress',
    streetAddress: publishAsOrganization ? undefined : statedPlace(rec.street),
    addressLocality: statedPlace(rec.city) || undefined,
    addressRegion: statedPlace(rec.region) || undefined,
    addressCountry: statedPlace(rec.country) || undefined
  });
  const node = dropEmpty({
    '@type': publishAsOrganization ? 'Organization' : 'LocalBusiness',
    '@id': pageUrl + '#entry',
    name: rec.name,
    url: rec.website || undefined,
    mainEntityOfPage: pageUrl,
    description: rec.description || undefined,
    email: rec.email || undefined,
    logo: rec.logo || undefined
  });
  if (address.addressLocality || address.addressRegion || address.addressCountry || address.streetAddress) {
    node.address = address;
  }
  if (rec.parent && rec.parent.name) {
    node.parentOrganization = dropEmpty({
      '@type': 'Organization',
      name: rec.parent.name,
      url: rec.parent.url || undefined
    });
  }
  return node;
}

/** ItemList of directory entries. Each item is an Organization with the facts passed in. */
function itemListNode(pageUrl, name, entries) {
  const list = (entries || []).filter(function (e) { return e && e.name && e.url; });
  return {
    '@type': 'ItemList',
    '@id': pageUrl + '#list',
    name: name,
    numberOfItems: list.length,
    itemListElement: list.map(function (e, i) {
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: dropEmpty({
          '@type': 'Organization',
          name: e.name,
          url: e.url,
          address: statedPlace(e.country) ? { '@type': 'PostalAddress', addressCountry: statedPlace(e.country) } : undefined
        })
      };
    })
  };
}

const STATUS_URL = {
  CONFIRMED_UPCOMING: 'https://schema.org/EventScheduled',
  LIVE: 'https://schema.org/EventScheduled',
  POSTPONED: 'https://schema.org/EventPostponed',
  CANCELLED: 'https://schema.org/EventCancelled'
};

const UPCOMING_STATUS = { CONFIRMED_UPCOMING: 1, LIVE: 1 };

/* A calendar date plus an IANA zone already on the record. Noon UTC is only
 * used to read that zone's offset, so the clock time is not published. */
function zoneOffset(day, tz) {
  if (!tz || !/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return '';
  let name = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
      hour: '2-digit'
    }).formatToParts(new Date(day + 'T12:00:00Z'));
    parts.forEach(function (p) { if (p.type === 'timeZoneName') name = p.value; });
  } catch (e) {
    return '';
  }
  const m = String(name).match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  if (!m) return '';
  return m[1] + String(m[2]).padStart(2, '0') + ':' + (m[3] || '00');
}

function zonedDate(day, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return '';
  const off = zoneOffset(day, tz);
  return off ? day + off : day;
}

function venueIsReal(venue) {
  if (!venue) return false;
  if (/^online\b/i.test(String(venue).trim())) return false;
  return !/\btbd\b|\btbc\b|\btba\b|to be confirmed|to be announced|venue tbc/i.test(venue);
}

/* A webinar, or a record whose city or venue is already "Online". */
function isOnlineEvent(ev) {
  ev = ev || {};
  if (String(ev.type || '').toLowerCase() === 'webinar') return true;
  if (/^online\b/i.test(String(ev.city || '').trim())) return true;
  if (/^online\b/i.test(String(ev.venue || '').trim())) return true;
  return false;
}

const CLOCK_ZONE = {
  utc: '+00:00',
  cet: '+01:00',
  cest: '+02:00',
  gst: '+04:00',
  cst: '-06:00',
  cdt: '-05:00',
  est: '-05:00',
  edt: '-04:00',
  pst: '-08:00',
  pdt: '-07:00'
};

/* Clock times already written on the record. Nothing is inferred from a city. */
function clocksIn(text) {
  const re = /(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\s*(gmt\s*([+-])(\d{1,2})(?::(\d{2}))?|utc|cet|cest|gst|cst|cdt|est|edt|pst|pdt)/ig;
  const hits = [];
  let m;
  while ((m = re.exec(String(text || '')))) {
    let hour = Number(m[1]);
    const minute = m[2];
    const ap = String(m[3] || '').replace(/\./g, '').toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    if (hour > 23) continue;
    let off = '';
    if (m[5]) off = m[5] + String(m[6]).padStart(2, '0') + ':' + (m[7] || '00');
    else off = CLOCK_ZONE[String(m[4] || '').toLowerCase()] || '';
    if (!off) continue;
    hits.push({
      hh: String(hour).padStart(2, '0'),
      mm: minute,
      off: off
    });
  }
  return hits;
}

function stampClock(day, clock) {
  if (!clock || !/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return '';
  return day + 'T' + clock.hh + ':' + clock.mm + ':00' + clock.off;
}

/* First clock is the start. A later clock is the end only when the record
 * has a different end date, so parenthetical equivalents of one moment
 * (14:00 CET / 13:00 UTC) are not turned into an earlier end. */
function datedWithClocks(start, end, text, tz) {
  const clocks = clocksIn(text);
  if (!clocks.length) {
    return {
      start: zonedDate(start, tz),
      end: end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? zonedDate(end, tz) : ''
    };
  }
  const startAt = stampClock(start, clocks[0]);
  let endAt = '';
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && end !== start && clocks.length > 1) {
    endAt = stampClock(end, clocks[clocks.length - 1]);
  }
  return { start: startAt, end: endAt };
}

function httpUrl(url) {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

/** A real event image. The site brand graphic is not an event image. */
function realEventImage(url) {
  const u = httpUrl(url);
  if (!u) return '';
  if (/\/brand\/og-image\.png(?:$|\?)/i.test(u)) return '';
  if (/\/brand\/favicon/i.test(u)) return '';
  if (/transformerpath\.com\/brand\//i.test(u)) return '';
  return u;
}

/**
 * Event node. Firm dates are emitted only for confirmed statuses
 * (CONFIRMED_UPCOMING, LIVE, COMPLETED) that also have a real start date
 * and a real place. EventScheduled is only for an upcoming or live event.
 * A completed event keeps its dates and is not marked as upcoming.
 * A recorded IANA timezone is written on the date. A missing timezone,
 * organizer, image or offer is omitted. streetAddress is never set.
 */
function eventNode(pageUrl, ev) {
  ev = ev || {};
  const scheduled = !!(SCHEDULED[ev.status] && ev.start && /^\d{4}-\d{2}-\d{2}$/.test(ev.start));
  const upcoming = !!(UPCOMING_STATUS[ev.status]);
  const online = isOnlineEvent(ev);
  const placeBits = dropEmpty({
    addressLocality: !online && ev.city ? ev.city : undefined,
    addressCountry: !online && ev.country ? ev.country : undefined
  });
  const hasAddress = !!(placeBits.addressLocality || placeBits.addressCountry);
  const realVenue = !online && venueIsReal(ev.venue);
  const hasPlace = hasAddress || realVenue;
  const node = dropEmpty({
    '@type': 'Event',
    '@id': pageUrl + '#event',
    name: ev.name,
    description: ev.description || undefined,
    url: pageUrl
  });
  if (hasPlace) {
    const place = { '@type': 'Place' };
    if (realVenue) place.name = ev.venue;
    if (hasAddress) place.address = Object.assign({ '@type': 'PostalAddress' }, placeBits);
    node.location = place;
  }
  const official = httpUrl(ev.officialUrl || ev.official_url || '');
  const tz = String(ev.tz || ev.timezone || '').trim();
  const when = datedWithClocks(ev.start, ev.end, [ev.venue, ev.description].filter(Boolean).join(' '), tz);
  if (scheduled && online && official) {
    node.eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode';
    /* A series hub names the session without claiming its clock time. */
    if (upcoming && !ev.omitDates) node.eventStatus = 'https://schema.org/EventScheduled';
    if (!ev.omitDates) {
      if (when.start) node.startDate = when.start;
      if (when.end) node.endDate = when.end;
    }
    node.location = { '@type': 'VirtualLocation', url: official };
  } else if (scheduled && hasPlace) {
    node.eventAttendanceMode = 'https://schema.org/OfflineEventAttendanceMode';
    if (upcoming) node.eventStatus = 'https://schema.org/EventScheduled';
    if (when.start) node.startDate = when.start;
    if (when.end) node.endDate = when.end;
  } else if (STATUS_URL[ev.status] && !UPCOMING_STATUS[ev.status]) {
    node.eventStatus = STATUS_URL[ev.status];
  }
  const org = String(ev.organizer || ev.organiser || '').trim();
  if (org) node.organizer = { '@type': 'Organization', name: org };
  const image = realEventImage(ev.image || ev.image_url || '');
  if (image) node.image = image;
  const offers = eventOffers(ev, official);
  if (offers) node.offers = offers;
  return node;
}

/**
 * The conference page stays an Offer whose url is the official site.
 * A sourced call-for-papers date is a second Offer: name describes the
 * call, url is the official call page, and validThrough is that deadline.
 * A date with no http source is omitted. Nothing else is invented.
 */
function paperDeadlineOffer(ev) {
  const list = Array.isArray(ev && ev.deadlines) ? ev.deadlines : [];
  const paper = list.find(function (d) {
    return d && d.kind === 'call_for_papers' && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ''));
  });
  if (!paper) return null;
  const url = httpUrl(paper.source_url || paper.url || '');
  if (!url) return null;
  const offer = {
    '@type': 'Offer',
    name: 'Call for papers',
    url: url,
    validThrough: String(paper.date).slice(0, 10)
  };
  const note = String(paper.note || '').trim();
  if (note) offer.description = note;
  return offer;
}

function eventOffers(ev, official) {
  const offers = [];
  if (official) offers.push({ '@type': 'Offer', url: official });
  const paper = paperDeadlineOffer(ev);
  if (paper) offers.push(paper);
  if (!offers.length) return null;
  return offers.length === 1 ? offers[0] : offers;
}

/** Structural checks for an Event node. Returns a list of problems. */
function validateEventNode(node) {
  const errors = [];
  if (!node || node['@type'] !== 'Event') {
    errors.push('missing Event');
    return errors;
  }
  if (!node.name) errors.push('missing name');
  if (node.location) {
    const loc = node.location;
    if (loc['@type'] === 'Place') {
      if (loc.address) {
        if (loc.address['@type'] !== 'PostalAddress') errors.push('location address is not PostalAddress');
        if (loc.address.streetAddress) errors.push('streetAddress is set');
      }
    } else if (loc['@type'] === 'VirtualLocation') {
      if (!httpUrl(loc.url)) errors.push('VirtualLocation missing url');
    } else errors.push('location type ' + loc['@type']);
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}|[+-]\d{2}:\d{2})?$/;
  if (node.startDate && !dateRe.test(node.startDate)) errors.push('startDate is not a date');
  if (node.endDate && !dateRe.test(node.endDate)) errors.push('endDate is not a date');
  if (node.startDate && node.endDate && node.endDate < node.startDate) errors.push('endDate before startDate');
  if (node.organizer && (node.organizer['@type'] !== 'Organization' || !node.organizer.name)) {
    errors.push('organizer is not an Organization');
  }
  if (node.eventAttendanceMode && String(node.eventAttendanceMode).indexOf('https://schema.org/') !== 0) {
    errors.push('eventAttendanceMode');
  }
  if (node.eventStatus && String(node.eventStatus).indexOf('https://schema.org/') !== 0) {
    errors.push('eventStatus');
  }
  if (node.image && !realEventImage(node.image)) errors.push('image is not a real event image');
  if (node.offers) {
    const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
    if (!offers.length) errors.push('offers.url');
    offers.forEach(function (offer) {
      if (!offer || offer['@type'] !== 'Offer' || !httpUrl(offer.url)) errors.push('offers.url');
      if (offer && offer.validThrough && !/^\d{4}-\d{2}-\d{2}/.test(String(offer.validThrough))) {
        errors.push('offers.validThrough');
      }
    });
  }
  if (JSON.stringify(node).indexOf('streetAddress') !== -1) errors.push('streetAddress present');
  return errors;
}

function newsArticleNode(pageUrl, item) {
  if (!item || !item.headline || !item.datePublished || !item.publisher) return null;
  const publisher = { '@type': 'Organization', name: item.publisher };
  const node = {
    '@type': 'NewsArticle',
    '@id': pageUrl + '#' + item.id,
    headline: item.headline,
    datePublished: item.datePublished,
    mainEntityOfPage: pageUrl + '#' + item.id,
    publisher: publisher
  };
  if (item.author) node.author = { '@type': 'Person', name: item.author };
  else node.author = publisher;
  if (item.sourceUrl) node.isBasedOn = item.sourceUrl;
  return node;
}

function typesOf(node, into) {
  if (!node || typeof node !== 'object') return into;
  if (Array.isArray(node)) {
    node.forEach(function (n) { typesOf(n, into); });
    return into;
  }
  if (node['@type']) into.push(node);
  if (node['@graph']) typesOf(node['@graph'], into);
  Object.keys(node).forEach(function (k) {
    if (k === '@graph') return;
    const v = node[k];
    if (v && typeof v === 'object') typesOf(v, into);
  });
  return into;
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { blocks.push(JSON.parse(m[1])); }
    catch (e) { blocks.push({ __invalid: true, error: e.message, raw: m[1].slice(0, 120) }); }
  }
  return blocks;
}

function flatten(blocks) {
  const nodes = [];
  blocks.forEach(function (b) {
    if (b && b.__invalid) nodes.push(b);
    else typesOf(b, nodes);
  });
  return nodes;
}

module.exports = {
  ORIGIN: ORIGIN,
  SCHEDULED: SCHEDULED,
  graph: graph,
  siteNodes: siteNodes,
  breadcrumbNode: breadcrumbNode,
  entryNode: entryNode,
  itemListNode: itemListNode,
  eventNode: eventNode,
  zonedDate: zonedDate,
  zoneOffset: zoneOffset,
  paperDeadlineOffer: paperDeadlineOffer,
  validateEventNode: validateEventNode,
  newsArticleNode: newsArticleNode,
  extractJsonLd: extractJsonLd,
  flatten: flatten,
  venueIsReal: venueIsReal,
  isOnlineEvent: isOnlineEvent,
  clocksIn: clocksIn
};
