#!/usr/bin/env node
/* lib/travelpayouts.js — Travelpayouts placements for TransformerPath.
 *
 * Marker 736890 is the partner id already used by Hotellook links in
 * events.html (AFFILIATE.travelpayoutsMarker) and by the Kiwi short link
 * kiwi.tpk.ro/dClaRHg1, which expands to shmarker=736890, trs=548938,
 * campaign_id=111, promo_id=3413.
 *
 * The Emerald loader emrldtp.com/NTQ4OTM4.js?t=548938 is the same project
 * (t= is the Travelpayouts trs). It is not injected in page HTML. tp-affiliate.js
 * loads it after consent, when a placement is near the viewport or used.
 *
 * SubIDs use letters, digits and underscores (Travelpayouts rule). A slug's
 * hyphens become underscores: event_wetex_hotel, not event-wetex-hotel.
 *
 * Insurance and eSIM: a live request on 14 Oct 2026 with marker 736890 and
 * trs 548938 returned "marker is not subscribed to campaign" for
 * VisitorsCoverage (p=4552), Insubuy (p=4736) and EKTA (campaign 225).
 * Airalo (p=8310) did not return a tracked redirect. Those buttons therefore
 * open the provider homepage directly unless TP_INSURANCE_URL or TP_ESIM_URL
 * is set to an https link from the Travelpayouts dashboard.
 *
 * No price, coverage amount or commission rate is written here.
 */
'use strict';
const fs = require('fs');

const MARKER = (String(process.env.TP_TRAVELPAYOUTS_MARKER || '736890').match(/[0-9]+/) || ['736890'])[0];
const TRS = (String(process.env.TP_TRAVELPAYOUTS_TRS || '548938').match(/[0-9]+/) || ['548938'])[0];

/* Expanded form of the Kiwi short link already in the repo. */
const KIWI = { campaign_id: '111', promo_id: '3413' };
const KKDAY = 'https://kkday.tpk.ro/VGC9WqGf';

const EMERALD_SRC = 'https://emrldtp.com/NTQ4OTM4.js?t=' + TRS + '&marker=' + MARKER;

const DIRECT_INSURANCE = 'https://www.visitorscoverage.com/';
const DIRECT_ESIM = 'https://www.airalo.com/';

const TRIP_KNOWLEDGE = {
  'fat-vs-sat': 'a factory acceptance test (FAT)',
  'transformer-site-preparation': 'a transformer site visit',
};

let _iata = null;
function cityIataMap() {
  if (_iata) return _iata;
  _iata = {};
  try {
    const html = fs.readFileSync('events.html', 'utf8');
    const m = html.match(/const CITY_IATA = (\{.*?\});/);
    if (m) _iata = JSON.parse(m[1]);
  } catch (e) { _iata = {}; }
  return _iata;
}

function iataFor(city) {
  const map = cityIataMap();
  if (!city) return '';
  if (map[city] && /^[A-Za-z]{3}$/.test(map[city])) return map[city].toUpperCase();
  const key = Object.keys(map).find(function (k) { return k.toLowerCase() === String(city).toLowerCase(); });
  if (key && /^[A-Za-z]{3}$/.test(map[key])) return map[key].toUpperCase();
  return '';
}

function subId(parts) {
  const raw = parts.filter(Boolean).join('_').toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (raw || 'placement').slice(0, 80);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function envHttps(name) {
  const v = process.env[name];
  if (!v) return '';
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return '';
    return u.toString();
  } catch (e) { return ''; }
}

function withSub(base, sub) {
  const u = new URL(base);
  if (!u.searchParams.get('sub_id')) u.searchParams.set('sub_id', sub);
  ['marker', 'shmarker'].forEach(function (k) {
    const cur = u.searchParams.get(k);
    if (cur && cur.indexOf('.') === -1) u.searchParams.set(k, cur + '.' + sub);
  });
  return u.toString();
}

function hotelSearchUrl(opts) {
  const sub = opts.sub;
  const u = new URL('https://search.hotellook.com/');
  u.searchParams.set('marker', MARKER + '.' + sub);
  u.searchParams.set('sub_id', sub);
  if (opts.city) u.searchParams.set('destination', opts.city);
  if (opts.checkIn) u.searchParams.set('checkIn', opts.checkIn);
  if (opts.checkOut) u.searchParams.set('checkOut', opts.checkOut);
  return u.toString();
}

function flightClickUrl(sub) {
  const u = new URL('https://tp.media/click');
  u.searchParams.set('campaign_id', KIWI.campaign_id);
  u.searchParams.set('promo_id', KIWI.promo_id);
  u.searchParams.set('shmarker', MARKER + '.' + sub);
  u.searchParams.set('source_type', 'link');
  u.searchParams.set('trs', TRS);
  u.searchParams.set('type', 'click');
  u.searchParams.set('sub_id', sub);
  return u.toString();
}

/* Aviasales pre-filled search form. params = ORIGIN + DDMM + DEST + DDMM + adults.
   Documented at support.travelpayouts.com article 5711895629714. */
function aviasalesFormUrl(opts) {
  const origin = String(opts.origin || '').toUpperCase();
  const dest = String(opts.destination || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(dest)) return '';
  function ddmm(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + m[2] : '';
  }
  const a = ddmm(opts.depart);
  const b = ddmm(opts.ret);
  let params = origin + dest + '1';
  if (a && b) params = origin + a + dest + b + '1';
  else if (a) params = origin + a + dest + '1';
  const u = new URL('https://www.aviasales.com/');
  u.searchParams.set('params', params);
  u.searchParams.set('marker', MARKER + '.' + opts.sub);
  u.searchParams.set('sub_id', opts.sub);
  return u.toString();
}

function offerHref(envName, direct, sub) {
  const custom = envHttps(envName);
  if (!custom) return { href: direct, tracked: false };
  return { href: withSub(custom, sub), tracked: true };
}

function trackAttrs(sub, placement) {
  return ' data-track="affiliate_click" data-track-sub_id="' + esc(sub) + '" data-track-placement="' + esc(placement) + '" data-tp-sub="' + esc(sub) + '"';
}

function relFor(tracked) {
  return tracked ? 'noopener sponsored' : 'noopener';
}

function disclosureHtml(href, trackedTravel) {
  const link = '<a href="' + esc(href) + '">Affiliate disclosure</a>';
  if (trackedTravel) {
    return '<p class="tp-aff-note" style="flex-basis:100%;font-size:.72rem;color:var(--muted);margin:0 0 8px">Affiliate link. TransformerPath may earn a commission (Travelpayouts marker ' + esc(MARKER) + '). ' + link + '. Prices are set by the provider.</p>';
  }
  return '<p class="tp-aff-note" style="flex-basis:100%;font-size:.72rem;color:var(--muted);margin:0 0 8px">Travel tools for engineers on a FAT or site visit. ' + link + '. TransformerPath does not set prices.</p>';
}

function scriptTag(prefix) {
  return '<script src="' + esc((prefix || '') + 'tp-affiliate.js') + '" defer></script>';
}

const BOX = 'border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin:8px 0;background:var(--card, transparent)';
const LABEL = 'display:flex;flex-direction:column;gap:2px;font-size:.72rem;color:var(--muted);min-width:120px';
const INPUT = 'min-height:36px;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:inherit';

function eventWidgets(opts) {
  const slug = subId([opts.slug || 'event']);
  const city = opts.city || '';
  const iata = (opts.iata || iataFor(city) || '').toUpperCase();
  const checkIn = /^\d{4}-\d{2}-\d{2}$/.test(opts.checkIn || '') ? opts.checkIn : '';
  const checkOut = /^\d{4}-\d{2}-\d{2}$/.test(opts.checkOut || '') ? opts.checkOut : '';
  const prefix = opts.prefix || '';
  const disc = opts.disclosureHref || (prefix + 'affiliate-disclosure.html');
  const hotelSub = subId(['event', slug, 'hotel']);
  const flightSub = subId(['event', slug, 'flight']);
  const actSub = subId(['event', slug, 'activities']);
  const hotel = hotelSearchUrl({ city: city, checkIn: checkIn, checkOut: checkOut, sub: hotelSub });
  const flight = flightClickUrl(flightSub);
  const where = esc(city) + (iata ? ' (' + esc(iata) + ')' : '');
  const when = (checkIn && checkOut) ? (esc(checkIn) + ' to ' + esc(checkOut)) : '';
  const act = KKDAY
    ? '<a class="btn btn-outline btn-sm" data-aff="activities" href="' + esc(KKDAY) + '" target="_blank" rel="noopener sponsored"' + trackAttrs(actSub, 'activities') + '>Things to do</a>'
    : '';
  return '<section class="tp-aff" id="tp-travel" data-tp-emerald="' + esc(EMERALD_SRC) + '" style="' + BOX + ';min-height:300px">' +
    '<h2 style="font-size:1.05rem;margin:0 0 4px">Hotels and flights</h2>' +
    '<p style="font-size:.82rem;color:var(--muted);margin:0 0 8px">Search is prefilled with ' + where + (when ? ', ' + when : '') + '. Confirm the dates with the organiser before booking.</p>' +
    disclosureHtml(disc, true) +
    '<form class="tp-aff-hotel" action="https://search.hotellook.com/" method="get" target="_blank" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;min-height:132px;margin:0 0 10px">' +
      '<input type="hidden" name="marker" value="' + esc(MARKER + '.' + hotelSub) + '">' +
      '<input type="hidden" name="sub_id" value="' + esc(hotelSub) + '">' +
      '<label style="' + LABEL + '">City<input name="destination" value="' + esc(city) + '" style="' + INPUT + '"></label>' +
      '<label style="' + LABEL + '">Check-in<input type="date" name="checkIn" value="' + esc(checkIn) + '" style="' + INPUT + '"></label>' +
      '<label style="' + LABEL + '">Check-out<input type="date" name="checkOut" value="' + esc(checkOut) + '" style="' + INPUT + '"></label>' +
      '<button class="btn btn-outline btn-sm" type="submit" data-aff="hotel"' + trackAttrs(hotelSub, 'hotel') + '>Search hotels</button>' +
    '</form>' +
    '<div class="tp-aff-flight" data-tp-flight="1" data-tp-marker="' + esc(MARKER) + '" data-tp-dest="' + esc(iata) + '" data-tp-sub="' + esc(flightSub) + '" data-tp-fallback="' + esc(flight) + '" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;min-height:132px">' +
      '<label style="' + LABEL + '">From (IATA)<input data-tp-origin maxlength="3" placeholder="LHR" autocomplete="off" style="' + INPUT + ';text-transform:uppercase"></label>' +
      '<label style="' + LABEL + '">To<input value="' + esc(iata || city) + '" readonly style="' + INPUT + '"></label>' +
      '<label style="' + LABEL + '">Depart<input type="date" data-tp-depart value="' + esc(checkIn) + '" style="' + INPUT + '"></label>' +
      '<label style="' + LABEL + '">Return<input type="date" data-tp-return value="' + esc(checkOut) + '" style="' + INPUT + '"></label>' +
      '<a class="btn btn-outline btn-sm" data-tp-flight-go data-aff="flights" href="' + esc(flight) + '" target="_blank" rel="noopener sponsored"' + trackAttrs(flightSub, 'flight') + '>Search flights</a>' +
    '</div>' +
    (act ? '<div style="margin-top:8px">' + act + '</div>' : '') +
    '<p style="font-size:.7rem;color:var(--muted);margin:8px 0 0">Hotel search uses Hotellook with marker ' + esc(MARKER) + '. Flight search uses the Kiwi Travelpayouts link until a departure airport is entered, then Aviasales with that airport, ' + (iata ? esc(iata) : 'the event city') + ' and these dates.</p>' +
    scriptTag(prefix) +
  '</section>';
}

function calendarLinks(opts) {
  const slug = subId([opts.slug || 'event']);
  const city = opts.city || '';
  if (!city) return '';
  const hotelSub = subId(['event', slug, 'hotel']);
  const flightSub = subId(['event', slug, 'flight']);
  const actSub = subId(['event', slug, 'activities']);
  const hotel = hotelSearchUrl({
    city: city,
    checkIn: opts.checkIn || '',
    checkOut: opts.checkOut || '',
    sub: hotelSub,
  });
  const flight = flightClickUrl(flightSub);
  const disc = opts.disclosureHref || 'affiliate-disclosure.html';
  const act = KKDAY
    ? '<a class="btn btn-outline btn-sm" data-aff="activities" href="' + esc(KKDAY) + '" target="_blank" rel="noopener sponsored"' + trackAttrs(actSub, 'activities') + '>🎟️ Things to Do</a>'
    : '';
  return '<div class="tp-aff" data-tp-emerald="' + esc(EMERALD_SRC) + '" style="flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:88px">' +
    disclosureHtml(disc, true) +
    '<a class="btn btn-outline btn-sm" data-aff="hotel" href="' + esc(hotel) + '" target="_blank" rel="noopener sponsored"' + trackAttrs(hotelSub, 'hotel') + '>🏨 Book Hotel</a>' +
    '<a class="btn btn-outline btn-sm" data-aff="flights" href="' + esc(flight) + '" target="_blank" rel="noopener sponsored"' + trackAttrs(flightSub, 'flight') + '>✈ Find Flights</a>' +
    act +
  '</div>';
}

function tripOffers(opts) {
  const slug = subId([opts.slug || 'trip']);
  const place = opts.place || 'a factory or site visit';
  const prefix = opts.prefix || '';
  const disc = opts.disclosureHref || (prefix + 'affiliate-disclosure.html');
  const insSub = subId(['trip', slug, 'insurance']);
  const esimSub = subId(['trip', slug, 'esim']);
  const ins = offerHref('TP_INSURANCE_URL', DIRECT_INSURANCE, insSub);
  const esim = offerHref('TP_ESIM_URL', DIRECT_ESIM, esimSub);
  const tracked = ins.tracked || esim.tracked;
  const insName = ins.tracked ? 'Travel insurance' : 'Travel insurance (VisitorsCoverage)';
  const esimName = esim.tracked ? 'Travel eSIM' : 'Travel eSIM (Airalo)';
  return '<section class="tp-aff" style="' + BOX + ';min-height:160px"' + (tracked ? ' data-tp-emerald="' + esc(EMERALD_SRC) + '"' : '') + '>' +
    '<h2 style="font-size:1.05rem;margin:0 0 4px">Travelling for ' + esc(place) + '</h2>' +
    '<p style="font-size:.86rem;color:var(--text);margin:0 0 8px">Engineers attending a factory acceptance test or a site visit often need travel insurance and a data eSIM. The provider sets the price. TransformerPath does not quote a premium or a data plan.</p>' +
    disclosureHtml(disc, tracked) +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;min-height:44px">' +
      '<a class="btn btn-outline btn-sm" href="' + esc(ins.href) + '" target="_blank" rel="' + relFor(ins.tracked) + '"' + trackAttrs(insSub, 'insurance') + '>' + insName + '</a>' +
      '<a class="btn btn-outline btn-sm" href="' + esc(esim.href) + '" target="_blank" rel="' + relFor(esim.tracked) + '"' + trackAttrs(esimSub, 'esim') + '>' + esimName + '</a>' +
    '</div>' +
    (tracked ? scriptTag(prefix) : '') +
  '</section>';
}

module.exports = {
  MARKER: MARKER,
  TRS: TRS,
  KIWI: KIWI,
  KKDAY: KKDAY,
  EMERALD_SRC: EMERALD_SRC,
  DIRECT_INSURANCE: DIRECT_INSURANCE,
  DIRECT_ESIM: DIRECT_ESIM,
  TRIP_KNOWLEDGE: TRIP_KNOWLEDGE,
  subId: subId,
  iataFor: iataFor,
  hotelSearchUrl: hotelSearchUrl,
  flightClickUrl: flightClickUrl,
  aviasalesFormUrl: aviasalesFormUrl,
  offerHref: offerHref,
  eventWidgets: eventWidgets,
  calendarLinks: calendarLinks,
  tripOffers: tripOffers,
  scriptTag: scriptTag,
};
