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

module.exports = {
  BLOCKED_SOURCE_HOSTS: BLOCKED_SOURCE_HOSTS,
  isBlockedSource: isBlockedSource
};
