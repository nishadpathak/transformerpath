/* Competitor publications. TransformerPath does not link to them, credit them,
 * or ingest them as news sources. The host list is the only place these
 * domains are spelled; the CI check fails if they appear anywhere else. */
'use strict';

const BLOCKED_SOURCE_HOSTS = [
  'transformer-magazine.com',
  'transformers-magazine.com'
];

function hostOf(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    return new URL(withScheme).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

function isBlockedSource(value) {
  const host = hostOf(value);
  if (host) {
    return BLOCKED_SOURCE_HOSTS.some(function (blocked) {
      return host === blocked || host.endsWith('.' + blocked);
    });
  }
  return /(?:^|[^a-z0-9.-])(?:transformer-magazine\.com|transformers-magazine\.com)(?:[^a-z0-9.-]|$)/i.test(String(value || ''));
}

/* Events pipeline. A Merit Media conference is not an industry event we list,
 * even when the record no longer carries a URL. */
function isBlockedEvent(ev) {
  if (!ev || typeof ev !== 'object') return false;
  const series = String(ev.series_slug || ev.id || '').toLowerCase();
  if (series.indexOf('industry-navigator') >= 0) return true;
  const name = String(ev.name || ev.n || ev.event || '');
  if (/^Industry Navigator\b/i.test(name)) return true;
  const fields = [ev.official_url, ev.source_url, ev.u, ev.url, ev.organiser, ev.organizer, ev.description, ev.d, ev.relevance_reason, ev.source, ev.src];
  return fields.some(function (value) { return isBlockedSource(value); });
}

module.exports = {
  BLOCKED_SOURCE_HOSTS: BLOCKED_SOURCE_HOSTS,
  isBlockedSource: isBlockedSource,
  isBlockedEvent: isBlockedEvent
};
