/* JSON-LD builders and validators for the public site.
 *
 * Facts come from the caller. This module does not invent addresses, ratings,
 * reviews, authors, or dates. LocalBusiness is used only when the caller
 * passes a sourced street address and does not ask for an Organization.
 * Organization JSON-LD never includes streetAddress.
 */
'use strict';

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
 * A sourced street is emitted only on LocalBusiness. Organization JSON-LD
 * keeps the city and country and omits streetAddress.
 */
function entryNode(pageUrl, rec) {
  const publishAsOrganization = !rec.street || !!rec.asOrganization;
  const address = dropEmpty({
    '@type': 'PostalAddress',
    streetAddress: publishAsOrganization ? undefined : rec.street,
    addressLocality: rec.city || undefined,
    addressRegion: rec.region || undefined,
    addressCountry: rec.country || undefined
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
          address: e.country ? { '@type': 'PostalAddress', addressCountry: e.country } : undefined
        })
      };
    })
  };
}

const STATUS_URL = {
  CONFIRMED_UPCOMING: 'https://schema.org/EventScheduled',
  LIVE: 'https://schema.org/EventScheduled',
  COMPLETED: 'https://schema.org/EventScheduled',
  POSTPONED: 'https://schema.org/EventPostponed',
  CANCELLED: 'https://schema.org/EventCancelled'
};

function venueIsReal(venue) {
  if (!venue) return false;
  return !/\btbd\b|\btbc\b|\btba\b|to be confirmed|to be announced|venue tbc/i.test(venue);
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
 * Event node. Firm dates and EventScheduled are emitted only for confirmed
 * statuses (CONFIRMED_UPCOMING, LIVE, COMPLETED) that also have a real start
 * date and a real place. Projected / date-TBC records omit startDate.
 * Place, organizer, image and offers are copied from the caller. A missing
 * fact is omitted. streetAddress is never set.
 */
function eventNode(pageUrl, ev) {
  ev = ev || {};
  const scheduled = !!(SCHEDULED[ev.status] && ev.start && /^\d{4}-\d{2}-\d{2}$/.test(ev.start));
  const placeBits = dropEmpty({
    addressLocality: ev.city || undefined,
    addressCountry: ev.country || undefined
  });
  const hasAddress = !!(placeBits.addressLocality || placeBits.addressCountry);
  const realVenue = venueIsReal(ev.venue);
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
  const webinar = String(ev.type || '').toLowerCase() === 'webinar';
  const official = httpUrl(ev.officialUrl || ev.official_url || '');
  if (scheduled && hasPlace) {
    node.eventAttendanceMode = 'https://schema.org/OfflineEventAttendanceMode';
    node.eventStatus = 'https://schema.org/EventScheduled';
    node.startDate = ev.start;
    if (ev.end && /^\d{4}-\d{2}-\d{2}$/.test(ev.end)) node.endDate = ev.end;
  } else if (scheduled && webinar) {
    node.eventAttendanceMode = 'https://schema.org/OnlineEventAttendanceMode';
    node.eventStatus = 'https://schema.org/EventScheduled';
    node.startDate = ev.start;
    if (ev.end && /^\d{4}-\d{2}-\d{2}$/.test(ev.end)) node.endDate = ev.end;
    if (official) node.location = { '@type': 'VirtualLocation', url: official };
  } else if (STATUS_URL[ev.status] && ev.status !== 'CONFIRMED_UPCOMING' && ev.status !== 'LIVE' && ev.status !== 'COMPLETED') {
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
  if (node.startDate && !/^\d{4}-\d{2}-\d{2}/.test(node.startDate)) errors.push('startDate is not a date');
  if (node.endDate && !/^\d{4}-\d{2}-\d{2}/.test(node.endDate)) errors.push('endDate is not a date');
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
  paperDeadlineOffer: paperDeadlineOffer,
  validateEventNode: validateEventNode,
  newsArticleNode: newsArticleNode,
  extractJsonLd: extractJsonLd,
  flatten: flatten,
  venueIsReal: venueIsReal
};
