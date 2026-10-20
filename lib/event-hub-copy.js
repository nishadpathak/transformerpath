'use strict';
/* Series-hub sentence. Dates come from the canonical edition record.
 * A confirmed upcoming edition is named first. Otherwise the next upcoming
 * edition that already has a concrete date is named with that date.
 * "Dates not yet announced" is only used when no such edition exists.
 */
const { dateLine } = require('./event-display');

function upcoming(ev, today) {
  if (!ev) return false;
  if (ev.research_status === 'REJECTED_NO_EVIDENCE') return false;
  if (ev.lifecycle_status === 'REJECTED_NO_EVIDENCE' || ev.lifecycle_status === 'CANCELLED') return false;
  if (!ev.end) return ev.date_status === 'TBA' || ev.date_status === 'PROJECTED' || ev.date_status === 'CONFIRMED';
  return ev.end >= today;
}

function concreteDateLine(ev) {
  const line = dateLine(ev);
  if (!line || /TBA|Expected|not confirmed|unconfirmed|Cancelled|Not yet published/i.test(line)) return '';
  return line;
}

function byStart(a, b) {
  return String(a.start || '').localeCompare(String(b.start || ''));
}

function seriesFeature(list, today) {
  const editions = list || [];
  const confirmed = editions.filter(function (ev) {
    return ev.date_status === 'CONFIRMED' && upcoming(ev, today) && ev.start;
  }).sort(byStart)[0] || null;
  const dated = confirmed ? null : editions.filter(function (ev) {
    return upcoming(ev, today) && concreteDateLine(ev);
  }).sort(byStart)[0] || null;
  const featured = confirmed || dated;
  let text;
  if (confirmed) text = 'Meet the industry at ' + confirmed.name;
  else if (dated) text = 'Next edition: ' + dated.name + ' — ' + concreteDateLine(dated);
  else {
    const checked = editions.map(function (ev) { return ev.source_checked_at; }).filter(Boolean).sort();
    const day = checked.length ? checked[checked.length - 1] : '';
    text = 'Next edition: dates not yet announced' + (day ? ' (checked ' + day + ')' : '');
  }
  return { text: text, featured: featured };
}

module.exports = {
  upcoming: upcoming,
  concreteDateLine: concreteDateLine,
  seriesFeature: seriesFeature
};
