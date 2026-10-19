'use strict';
/* Homepage "Next confirmed editions" line.
 * Dates come from the canonical edition records (data/events-canonical.json).
 * Saudi Elenex 2026 stays on the line while it is still upcoming so the
 * homepage cannot keep a separate 2–5 November copy.
 */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const month = MONTHS_SHORT[parseInt(iso.slice(5, 7), 10) - 1];
  if (!month) return null;
  return { d: parseInt(iso.slice(8, 10), 10), m: month, y: iso.slice(0, 4) };
}

function rangeLabel(start, end) {
  const a = shortDay(start);
  const b = shortDay(end || start);
  if (!a) return '';
  if (b && a.y === b.y && a.m === b.m && a.d !== b.d) return a.d + '\u2013' + b.d + ' ' + a.m + ' ' + a.y;
  if (b && (a.d !== b.d || a.m !== b.m || a.y !== b.y)) return a.d + ' ' + a.m + ' ' + a.y + '\u2013' + b.d + ' ' + b.m + ' ' + b.y;
  return a.d + ' ' + a.m + ' ' + a.y;
}

function confirmedUpcoming(events, todayISO) {
  return (events || []).filter(function (e) {
    if (!e || e.date_status !== 'CONFIRMED' || !e.source_url || !e.source_checked_at) return false;
    const end = e.end || e.e;
    return end && end >= todayISO;
  }).sort(function (a, b) {
    return String(a.start || a.s).localeCompare(String(b.start || b.s));
  });
}

function isElenex(e) {
  return !!(e && (e.id === 'saudi-elenex-2026' || (e.name || e.n) === 'Saudi Elenex 2026'));
}

function nextConfirmedEditions(events, todayISO) {
  const upcoming = confirmedUpcoming(events, todayISO);
  const picked = upcoming.slice(0, 3);
  const elenex = upcoming.find(isElenex);
  if (elenex && picked.indexOf(elenex) < 0) picked.push(elenex);
  return picked;
}

function editionLabel(e) {
  return (e.name || e.n) + ' (' + rangeLabel(e.start || e.s, e.end || e.e) + ')';
}

function homepageEventsSentence(events, todayISO) {
  const line = nextConfirmedEditions(events, todayISO).map(editionLabel).join('; ');
  if (!line) return '';
  return 'Next confirmed editions: ' + line + '. Official pages checked ' + todayISO + '.';
}

module.exports = {
  shortDay: shortDay,
  rangeLabel: rangeLabel,
  confirmedUpcoming: confirmedUpcoming,
  nextConfirmedEditions: nextConfirmedEditions,
  editionLabel: editionLabel,
  homepageEventsSentence: homepageEventsSentence,
};
