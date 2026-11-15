'use strict';
/* Online and webinar sessions. In-person records never match isOnlineEvent,
 * so their dates, places and calendar lines stay all-day. A published clock
 * is read from the venue or description. A duration is used only when the
 * same phrase gives an end time. Otherwise the calendar file uses one hour
 * and JSON-LD omits endDate.
 */
const NAMED = {
  CET: 60, CEST: 120, EET: 120, EEST: 180, WET: 0, WEST: 60, BST: 60,
  GMT: 0, UTC: 0,
  EDT: -240, EST: -300, CDT: -300, CST: -360, MDT: -360, MST: -420, PDT: -420, PST: -480,
  GST: 240, JST: 540, SGT: 480, HKT: 480, KST: 540
};
const CLOCK = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?(?:\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?)?\s*(?:(GMT|UTC)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?|(CET|CEST|EEST|EET|WEST|WET|BST|EDT|EST|CDT|CST|MDT|MST|PDT|PST|GST|JST|SGT|HKT|KST))\b/i;

function pad(n) { return String(n).padStart(2, '0'); }

function isOnlineEvent(ev) {
  if (!ev) return false;
  if (String(ev.type || '').toLowerCase() === 'webinar') return true;
  const city = String(ev.city || ev.c || '').trim();
  const venue = String(ev.venue || ev.v || '').trim();
  if (/^online$/i.test(city)) return true;
  if (/^online\b/i.test(venue)) return true;
  return false;
}

function to24(hour, mer) {
  let h = Number(hour);
  if (!mer) return h;
  const pm = String(mer).toUpperCase() === 'PM';
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

function offsetOf(gmt, sign, zh, zm, named) {
  if (gmt && sign) {
    const mins = Number(zh) * 60 + Number(zm || 0);
    return sign === '-' ? -mins : mins;
  }
  const key = String(named || '').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(NAMED, key)) return null;
  return NAMED[key];
}

function zoneLabel(gmt, sign, zh, zm, named) {
  if (gmt && sign) return String(gmt).toUpperCase() + sign + String(Number(zh)) + (zm ? ':' + zm : '');
  return String(named || '').toUpperCase();
}

function parseClock(text) {
  const m = String(text || '').match(CLOCK);
  if (!m) return null;
  const offset = offsetOf(m[7], m[8], m[9], m[10], m[11]);
  if (offset == null) return null;
  const endMer = m[6] || '';
  const startMer = m[3] || (m[4] ? endMer : '');
  const startH = to24(m[1], startMer);
  const startM = Number(m[2] || 0);
  if (startH > 23 || startM > 59) return null;
  let end = null;
  if (m[4]) {
    const endH = to24(m[4], endMer || startMer);
    const endM = Number(m[5] || 0);
    if (endH > 23 || endM > 59) return null;
    end = { h: endH, m: endM };
  }
  return {
    startH: startH,
    startM: startM,
    end: end,
    offset: offset,
    zone: zoneLabel(m[7], m[8], m[9], m[10], m[11]),
    hours12: !!(m[3] || m[6])
  };
}

function clockText(h, m, hours12, zone) {
  if (!hours12) return pad(h) + ':' + pad(m) + ' ' + zone;
  const mer = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + pad(m) + ' ' + mer + ' ' + zone;
}

function gstClock(h, m, offset) {
  let mins = h * 60 + m - offset + 240;
  mins = ((mins % 1440) + 1440) % 1440;
  return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60) + ' GST';
}

function isoLocal(date, h, m, offset) {
  const sign = offset < 0 ? '-' : '+';
  const a = Math.abs(offset);
  return date + 'T' + pad(h) + ':' + pad(m) + ':00' + sign + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
}

function utcStamp(date, h, m, offset) {
  const ms = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m) - offset * 60000;
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function stampAt(date, h, m, offset, add) {
  const ms = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m) - offset * 60000 + add * 60000;
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function scheduleOf(ev) {
  if (!isOnlineEvent(ev)) return null;
  const date = String((ev && (ev.start || ev.s)) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const text = [ev.venue, ev.v, ev.description, ev.d].filter(Boolean).join(' \n ');
  const clock = parseClock(text);
  if (!clock) return null;
  const published = clockText(clock.startH, clock.startM, clock.hours12, clock.zone);
  const gst = gstClock(clock.startH, clock.startM, clock.offset);
  const label = clock.offset === 240 ? published : published + ' / ' + gst;
  const endUtc = clock.end
    ? stampAt(date, clock.end.h, clock.end.m, clock.offset, 0)
    : stampAt(date, clock.startH, clock.startM, clock.offset, 60);
  return {
    label: label,
    startIso: isoLocal(date, clock.startH, clock.startM, clock.offset),
    endIso: clock.end ? isoLocal(date, clock.end.h, clock.end.m, clock.offset) : null,
    startUtc: utcStamp(date, clock.startH, clock.startM, clock.offset),
    endUtc: endUtc
  };
}

function onlineTimeLabel(ev) {
  const s = scheduleOf(ev);
  return s ? s.label : '';
}

function publicUrl(ev) {
  const raw = String((ev && (ev.source_url || ev.sourceUrl || ev.official_url || ev.officialUrl || ev.u)) || '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const u = new URL(raw);
    Array.from(u.searchParams.keys()).forEach(function (k) {
      if (/^utm_/i.test(k)) u.searchParams.delete(k);
    });
    const q = u.searchParams.toString();
    return u.origin + u.pathname + (q ? '?' + q : '');
  } catch (e) {
    return raw;
  }
}

module.exports = {
  isOnlineEvent: isOnlineEvent,
  scheduleOf: scheduleOf,
  onlineTimeLabel: onlineTimeLabel,
  publicUrl: publicUrl,
  parseClock: parseClock
};
