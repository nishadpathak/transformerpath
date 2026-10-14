/* JSON-LD builders and validators for the public site.
 *
 * Facts come from the caller. This module does not invent addresses, ratings,
 * reviews, authors, or dates. LocalBusiness is used only when the caller
 * passes a sourced street address; otherwise the entry is an Organization.
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
 * street, if present, must already be a sourced street line. City, region
 * and country are included only when the caller supplies them.
 */
function entryNode(pageUrl, rec) {
  const address = dropEmpty({
    '@type': 'PostalAddress',
    streetAddress: rec.street || undefined,
    addressLocality: rec.city || undefined,
    addressRegion: rec.region || undefined,
    addressCountry: rec.country || undefined
  });
  const hasStreet = !!rec.street;
  const node = dropEmpty({
    '@type': hasStreet ? 'LocalBusiness' : 'Organization',
    '@id': pageUrl + '#entry',
    name: rec.name,
    url: rec.website || undefined,
    mainEntityOfPage: pageUrl,
    description: rec.description || undefined,
    email: rec.email || undefined
  });
  if (address.addressLocality || address.addressRegion || address.addressCountry || address.streetAddress) {
    node.address = address;
  }
  return node;
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

/**
 * Event node. Firm dates and EventScheduled are emitted only for confirmed
 * statuses (CONFIRMED_UPCOMING, LIVE, COMPLETED) that also have a real start
 * date and a real place. Projected / date-TBC records omit startDate.
 */
function eventNode(pageUrl, ev) {
  const scheduled = !!(SCHEDULED[ev.status] && ev.start && /^\d{4}-\d{2}-\d{2}$/.test(ev.start));
  const placeBits = dropEmpty({
    addressLocality: ev.city || undefined,
    addressCountry: ev.country || undefined
  });
  const hasPlace = !!(placeBits.addressLocality || placeBits.addressCountry || (scheduled && venueIsReal(ev.venue)));
  const node = dropEmpty({
    '@type': 'Event',
    '@id': pageUrl + '#event',
    name: ev.name,
    description: ev.description || undefined,
    url: pageUrl
  });
  if (scheduled && hasPlace) {
    node.eventAttendanceMode = 'https://schema.org/OfflineEventAttendanceMode';
    node.eventStatus = 'https://schema.org/EventScheduled';
    node.startDate = ev.start;
    if (ev.end && /^\d{4}-\d{2}-\d{2}$/.test(ev.end)) node.endDate = ev.end;
    const place = { '@type': 'Place' };
    if (venueIsReal(ev.venue)) place.name = ev.venue;
    if (placeBits.addressLocality || placeBits.addressCountry) {
      place.address = Object.assign({ '@type': 'PostalAddress' }, placeBits);
    }
    node.location = place;
  } else if (STATUS_URL[ev.status] && ev.status !== 'CONFIRMED_UPCOMING' && ev.status !== 'LIVE' && ev.status !== 'COMPLETED') {
    node.eventStatus = STATUS_URL[ev.status];
  }
  return node;
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
  eventNode: eventNode,
  newsArticleNode: newsArticleNode,
  extractJsonLd: extractJsonLd,
  flatten: flatten,
  venueIsReal: venueIsReal
};
