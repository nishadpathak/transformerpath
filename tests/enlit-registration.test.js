'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { registration, applyEnlitRegistration } = require('../lib/event-enlit-registration');
const edition = require('../data/events-canonical.json').canonical_editions.find(e => e.id === 'enlit-europe-2027');
const list = fs.readFileSync('events.html', 'utf8');
const detail = fs.readFileSync('events/enlit-europe-2027/index.html', 'utf8');
const today = '2026-11-26';
const testList = applyEnlitRegistration(list, edition, today);
const exact = new RegExp('href="https://www[.]enlit[.]world/enlit-europe/pre-register"');
assert.equal(testList, list);
assert.equal((list.match(/id="enlit-registration"/g) || []).length, 1);
assert(list.indexOf('id="enlit-registration"') < list.indexOf('id="event-search"'));
assert.match(list, /href="\/events\/enlit-europe-2027\/#enlit-registration"/);
for (const page of [list, detail, registration(edition, today, 'edition')]) {
  const intro = page.match(/<section[^>]+id="enlit-registration"[\s\S]*?<\/section>/)?.[0];
  assert(intro, 'live entry point has a standalone editorial registration block');
  assert.match(intro, exact);
  assert.match(intro, /href="https:\/\/www\.enlit\.world\/register"/);
  assert.match(intro, /interest list/);
  assert.match(intro, /does not issue a ticket/);
  assert.match(intro, /Membership is separate from event registration/);
  assert.doesNotMatch(intro, /media\.enlit\.world|utm_|_hsenc|affiliate|sponsored/i);
}
assert.equal(registration(edition, '2027-11-19', 'edition'), '');
assert.doesNotMatch(applyEnlitRegistration(list, { ...edition, city: 'TBC' }, today), /id="enlit-registration"/);
assert.doesNotMatch(applyEnlitRegistration(list, edition, '2027-11-19'), /id="enlit-registration"/);
assert.throws(() => applyEnlitRegistration('<body/>', edition, today), /exactly one/);
console.log('Enlit web membership and Paris pre-registration appear separately on TP Events and the 2027 edition.');
