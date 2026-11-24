'use strict';

const fs = require('fs');
const { allowsCalendar } = require('./event-display');

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function secureUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.port ? url : null;
  } catch (err) {
    return null;
  }
}

function load(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!json || !json.referrals || typeof json.referrals !== 'object' || Array.isArray(json.referrals)) {
    throw new Error('Event referral registry must contain a referrals object.');
  }
  return json.referrals;
}

function approvedUrl(ev, registry, today) {
  if (!ev || !registry || !Object.hasOwn(registry, ev.id) || !allowsCalendar(ev) ||
      !['CONFIRMED_UPCOMING', 'LIVE'].includes(ev.lifecycle_status) ||
      ['REJECTED_NO_EVIDENCE', 'RESEARCH_REQUIRED'].includes(ev.research_status) ||
      !validDay(ev.start) || !validDay(ev.end) || ev.start > ev.end || !validDay(today) || today > ev.end) return '';
  const entry = registry[ev.id];
  if (!entry || entry.status !== 'approved' ||
      !validDay(entry.active_from) || !validDay(entry.active_through) ||
      today < entry.active_from || today > entry.active_through || entry.active_through > ev.end) return '';

  const destination = secureUrl(entry.registration_url);
  const official = secureUrl(ev.official_url);
  if (!destination || !official || destination.href === official.href ||
      destination.hostname !== entry.approved_host ||
      !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(destination.hostname)) return '';
  // An organizer's generic publisher code is okay. Do not carry reader data,
  // buyer-specific URLs, or contact details into a public static link.
  const privateKey = /^(?:email|emailaddress|firstname|lastname|fullname|phone|phonenumber|address|userid|customerid)$/;
  if (/[\u0000-\u001f\u007f@]/.test(decodeURIComponentSafe(destination.pathname + destination.hash)) ||
      [...destination.searchParams].some(([key, value]) =>
        privateKey.test(key.toLowerCase().replace(/[_-]/g, '')) || /[\u0000-\u001f\u007f@]/.test(value))) return '';
  return entry.registration_url;
}

function decodeURIComponentSafe(value) {
  try { return decodeURIComponent(value); }
  catch (err) { return '\u0000'; }
}

function render(ev, registry, today) {
  const url = approvedUrl(ev, registry, today);
  if (!url) return '';
  const href = url.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  return '<aside class="card event-referral" aria-label="Affiliate registration">' +
    '<p><a class="btn btn-amber btn-sm" href="' + href + '" rel="sponsored noopener noreferrer">Register via affiliate link</a></p>' +
    '<p>Affiliate disclosure: TransformerPath may earn a commission if you make a qualifying paid registration through this link.</p>' +
    '</aside>';
}

module.exports = { load, render };
