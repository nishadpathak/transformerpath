/* Event JSON-LD for the events index and edition pages.
 *
 * The index list is the same upcoming set the events page renders.
 * A field is copied only when the edition record already has it.
 * A past edition is not given EventScheduled.
 */
'use strict';

const fs = require('fs');
const schema = require('./seo-schema');
const eventSeo = require('./event-seo');
const { isUpcoming, platformToday } = require('./event-status');
const { loadEvents } = require('./events-reader');
const { eventHref } = require('./event-href');

function editionUrl(ev) {
  const id = ev && ev.id;
  if (id && fs.existsSync('events/' + id + '/index.html')) {
    return schema.ORIGIN + '/events/' + id + '/';
  }
  const href = eventHref(ev, { fallbackListing: false, prefix: '/' });
  if (href && href.charAt(0) === '/' && href.indexOf('events.html') !== 0) return schema.ORIGIN + href;
  return eventSeo.officialUrl(ev);
}

/* Confirmed upcoming or live editions whose record can fill an Event. */
function indexEvents(today) {
  const day = today || platformToday();
  const out = [];
  loadEvents().forEach(function (ev) {
    if (!isUpcoming(ev, day)) return;
    const input = eventSeo.editionInput(ev);
    if (input.status !== 'CONFIRMED_UPCOMING' && input.status !== 'LIVE') return;
    const url = editionUrl(ev);
    if (!url) return;
    const node = schema.eventNode(url, input);
    if (!node.name || !node.startDate || !node.location || !node.eventAttendanceMode || !node.url) return;
    if (node.eventStatus !== 'https://schema.org/EventScheduled') return;
    out.push(node);
  });
  out.sort(function (a, b) { return String(a.startDate).localeCompare(String(b.startDate)); });
  return out;
}

function indexGraph(pageUrl, today) {
  const events = indexEvents(today);
  return {
    '@type': 'ItemList',
    '@id': pageUrl + '#events',
    name: 'Upcoming transformer industry events',
    numberOfItems: events.length,
    itemListElement: events.map(function (node, i) {
      return { '@type': 'ListItem', position: i + 1, item: node };
    })
  };
}

module.exports = {
  editionUrl: editionUrl,
  indexEvents: indexEvents,
  indexGraph: indexGraph
};
