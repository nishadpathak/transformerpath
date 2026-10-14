#!/usr/bin/env node
/* tests/travelpayouts-affiliate.test.js — Travelpayouts URL and placement rules. */
'use strict';
const assert = require('assert');
const tp = require('../lib/travelpayouts');

assert.strictEqual(tp.MARKER, '736890');
assert.strictEqual(tp.TRS, '548938');

const hotelSub = tp.subId(['event', 'wetex', 'hotel']);
assert.strictEqual(hotelSub, 'event_wetex_hotel');
assert.ok(!/-/.test(hotelSub));

const hotel = new URL(tp.hotelSearchUrl({
  city: 'Dubai', checkIn: '2026-10-20', checkOut: '2026-10-22', sub: hotelSub,
}));
assert.strictEqual(hotel.hostname, 'search.hotellook.com');
assert.strictEqual(hotel.searchParams.get('marker'), '736890.event_wetex_hotel');
assert.strictEqual(hotel.searchParams.get('sub_id'), 'event_wetex_hotel');
assert.strictEqual(hotel.searchParams.get('destination'), 'Dubai');
assert.strictEqual(hotel.searchParams.get('checkIn'), '2026-10-20');
assert.strictEqual(hotel.searchParams.get('checkOut'), '2026-10-22');

const flight = new URL(tp.flightClickUrl('event_wetex_flight'));
assert.strictEqual(flight.hostname, 'tp.media');
assert.strictEqual(flight.searchParams.get('campaign_id'), '111');
assert.strictEqual(flight.searchParams.get('promo_id'), '3413');
assert.strictEqual(flight.searchParams.get('shmarker'), '736890.event_wetex_flight');
assert.strictEqual(flight.searchParams.get('trs'), '548938');
assert.strictEqual(flight.searchParams.get('sub_id'), 'event_wetex_flight');

const avia = new URL(tp.aviasalesFormUrl({
  origin: 'lhr', destination: 'dxb', depart: '2026-10-20', ret: '2026-10-22', sub: 'event_wetex_flight',
}));
assert.strictEqual(avia.searchParams.get('params'), 'LHR2010DXB22101');
assert.strictEqual(avia.searchParams.get('marker'), '736890.event_wetex_flight');
assert.strictEqual(tp.aviasalesFormUrl({ origin: '', destination: 'DXB', sub: 'x' }), '');

const widgets = tp.eventWidgets({
  slug: 'wetex', city: 'Dubai', checkIn: '2026-10-20', checkOut: '2026-10-22',
  prefix: '../../', disclosureHref: '../../affiliate-disclosure.html',
});
assert.ok(widgets.indexOf('class="tp-aff"') >= 0);
assert.ok(widgets.indexOf('min-height:300px') >= 0);
assert.ok(widgets.indexOf('emrldtp.com') >= 0);
assert.ok(!/<script[^>]+emrldtp\.com/.test(widgets));
assert.ok(widgets.indexOf('src="../../tp-affiliate.js"') >= 0);
assert.ok(widgets.indexOf('affiliate-disclosure.html') >= 0);
assert.ok(widgets.indexOf('value="Dubai"') >= 0);
assert.ok(widgets.indexOf('data-track="affiliate_click"') >= 0);
assert.ok(widgets.indexOf('data-track-sub_id="event_wetex_hotel"') >= 0);
assert.ok(widgets.indexOf('data-track-sub_id="event_wetex_flight"') >= 0);
assert.ok(!/\$|from \$|per day/.test(widgets));

const direct = tp.offerHref('TP_INSURANCE_URL', tp.DIRECT_INSURANCE, 'trip_uae_insurance');
assert.strictEqual(direct.tracked, false);
assert.strictEqual(direct.href, 'https://www.visitorscoverage.com/');
process.env.TP_INSURANCE_URL = 'https://tp.media/r?marker=736890&trs=548938&p=4552&u=https%3A%2F%2Fwww.visitorscoverage.com';
const tracked = tp.offerHref('TP_INSURANCE_URL', tp.DIRECT_INSURANCE, 'trip_uae_insurance');
delete process.env.TP_INSURANCE_URL;
assert.strictEqual(tracked.tracked, true);
assert.ok(tracked.href.indexOf('sub_id=trip_uae_insurance') >= 0);
assert.ok(tracked.href.indexOf('736890.trip_uae_insurance') >= 0);

const trip = tp.tripOffers({
  slug: 'fat-vs-sat', place: 'a factory acceptance test (FAT)', prefix: '../',
});
assert.ok(trip.indexOf('https://www.visitorscoverage.com/') >= 0);
assert.ok(trip.indexOf('https://www.airalo.com/') >= 0);
assert.ok(trip.indexOf('rel="noopener"') >= 0);
assert.ok(trip.indexOf('rel="noopener sponsored"') < 0);
assert.ok(trip.indexOf('data-track-sub_id="trip_fat_vs_sat_insurance"') >= 0);
assert.ok(trip.indexOf('data-track-sub_id="trip_fat_vs_sat_esim"') >= 0);
assert.ok(!/\$[0-9]/.test(trip));
assert.ok(!/<script/.test(trip));
assert.ok(trip.indexOf('min-height:160px') >= 0);

assert.strictEqual(tp.iataFor('Dubai'), 'DXB');
assert.strictEqual(tp.iataFor('Greater Noida'), 'DEL');

console.log('travelpayouts-affiliate.test.js OK');
