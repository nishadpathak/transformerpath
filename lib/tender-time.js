/* Close times are shown in the portal's zone and in Asia/Dubai.
 * The instant is the offset time stored on the record. Nothing is fetched.
 */
'use strict';

const DUBAI = 'Asia/Dubai';

function formatZone(ms, zone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short'
  }).formatToParts(new Date(ms));
  function get(type) {
    const part = parts.find(function (p) { return p.type === type; });
    return part ? part.value : '';
  }
  return get('day') + ' ' + get('month') + ' ' + get('year') + ', ' + get('hour') + ':' + get('minute') + ' ' + get('timeZoneName');
}

function dualZoneLabel(closeAt, portalZoneName) {
  const ms = Date.parse(closeAt);
  if (!closeAt || Number.isNaN(ms)) return '';
  const zone = portalZoneName || 'UTC';
  const portal = formatZone(ms, zone) + ' (' + zone + ')';
  const dubai = formatZone(ms, DUBAI) + ' (' + DUBAI + ')';
  return portal + ' · ' + dubai;
}

module.exports = { dualZoneLabel: dualZoneLabel, formatZone: formatZone };
