#!/usr/bin/env node
/* The vacancy URL, its dates, and its HTTP status are checked without a
 * person. RFQ qualification and the five-supplier offer are automatic.
 * Payment still does not qualify a lead, and a passing job check does not
 * publish a row or set FEATURED.
 */
'use strict';
const assert = require('assert');
const jobs = require('../lib/job-board');
const leads = require('../lib/rfq-leads');
const probe = require('../lib/vacancy-probe');
const reviewVacancy = require('../functions/review-vacancy');
const reviewRfq = require('../functions/review-rfq');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok  ' + name);
  else {
    failed++;
    console.error('FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

function publicLookup() {
  return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
}

function response(status, location) {
  return {
    status: status,
    headers: { get: function (name) { return name === 'location' ? (location || '') : ''; } },
    body: { cancel: function () { return Promise.resolve(); } }
  };
}

(async function () {
  const blocked = await probe.probeVacancy('http://127.0.0.1/job/12345', {
    fetch: function () { throw new Error('fetched a private host'); }
  });
  check('private vacancy host is not fetched', blocked.ok === false && blocked.error.indexOf('public') !== -1);

  let fetched = 0;
  const hidden = await probe.probeVacancy('https://jobs.example.com/job/88421', {
    lookup: function () { return Promise.resolve([{ address: '10.1.1.1', family: 4 }]); },
    fetch: function () { fetched++; return Promise.resolve(response(200)); }
  });
  check('a private DNS answer is not fetched', hidden.ok === false && fetched === 0, hidden.error);

  const missing = await probe.probeVacancy('https://jobs.example.com/job/88421', {
    lookup: publicLookup,
    fetch: function () { return Promise.resolve(response(404)); }
  });
  check('HTTP 404 is not a reachable vacancy', missing.ok === false && missing.status === 404);

  const redirected = await probe.probeVacancy('https://jobs.example.com/job/88421', {
    lookup: publicLookup,
    fetch: function (url) {
      if (String(url).indexOf('/job/88421') !== -1) return Promise.resolve(response(302, 'https://jobs.example.com/careers'));
      return Promise.resolve(response(200));
    }
  });
  check('probe follows a redirect and keeps the final URL', redirected.ok === true && redirected.final_url.indexOf('/careers') !== -1);

  const closedPage = await probe.probeVacancy('https://recruiting.paylocity.com/Recruiting/Jobs/Details/3846464', {
    lookup: publicLookup,
    fetch: function (url) {
      if (String(url).indexOf('3846464') !== -1) return Promise.resolve(response(302, 'https://recruiting.paylocity.com/Recruiting/Jobs/JobNotFound'));
      return Promise.resolve(response(200));
    }
  });
  check('a job-not-found page is not an open vacancy', closedPage.ok === false && closedPage.final_url.indexOf('JobNotFound') !== -1, closedPage.error);

  reviewVacancy._setProbeForTests(async function () { fetched = 1; return { ok: true, status: 200, final_url: 'https://jobs.example.com/careers', error: '' }; });
  reviewVacancy._setStoreForTests(null);
  const careers = await reviewVacancy.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      title: 'Design engineer', company: 'Example', location: 'Vadodara', function: 'Engineering & Design',
      description: 'One role for a power transformer design engineer.', email: 'jobs@example.com',
      apply_url: 'https://www.hitachienergy.com/careers/open-jobs', one_position: 'yes'
    })
  });
  const careersBody = JSON.parse(careers.body);
  check('a careers URL is rejected before the probe', careers.statusCode === 200 && careersBody.accepted === false && fetched === 0, careers.body);

  const passes = [];
  reviewVacancy._setProbeForTests(async function () {
    return { ok: true, status: 200, final_url: 'https://jobs.example.com/job/88421', error: '' };
  });
  reviewVacancy._setStoreForTests({ save: async function (row) { passes.push(row); } });
  const okRes = await reviewVacancy.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      title: 'Power Transformer Design Engineer', company: 'Example Transformers', location: 'Vadodara, India',
      function: 'Engineering & Design', description: 'One design engineer role for power transformers.',
      email: 'jobs@example.com', apply_url: 'https://jobs.example.com/job/88421', one_position: true, featured: true
    })
  });
  const okBody = JSON.parse(okRes.body);
  check('a reachable vacancy can be stored without a person', okBody.accepted === true && okBody.stored === true && okBody.live === true && okBody.featured === false && passes.length === 1 && passes[0].reviewer === 'auto' && passes[0].featured === false, okRes.body);
  check('the vacancy response omits the employer email', okRes.body.indexOf('jobs@example.com') === -1 && !Object.prototype.hasOwnProperty.call(passes[0], 'email'));

  reviewVacancy._setStoreForTests(null);
  const unstored = JSON.parse((await reviewVacancy.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      title: 'Power Transformer Design Engineer', company: 'Example Transformers', location: 'Vadodara, India',
      function: 'Engineering & Design', description: 'One design engineer role for power transformers.',
      email: 'jobs@example.com', apply_url: 'https://jobs.example.com/job/88421', one_position: 'yes'
    })
  })).body);
  check('without a store the public opening stays unpublished', unstored.accepted === true && unstored.stored === false && unstored.live === false);

  reviewVacancy._setProbeForTests(async function () {
    return { ok: false, status: 404, final_url: 'https://recruiting.paylocity.com/Recruiting/Jobs/Details/3846464', error: 'vacancy URL returned HTTP 404' };
  });
  const gone = JSON.parse((await reviewVacancy.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      title: 'Crew lead', company: 'Pennsylvania Transformer Technology', location: 'Canonsburg, PA',
      function: 'Manufacturing & Operations', description: 'One crew lead role on the factory floor.',
      email: 'jobs@example.com', apply_url: 'https://recruiting.paylocity.com/Recruiting/Jobs/Details/3846464', one_position: 'yes'
    })
  })).body);
  check('Paylocity 404 stays unlisted', gone.accepted === false && gone.live === false && gone.http_status === 404);

  const rfq = await reviewRfq.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      name: 'Amina Rahman',
      email: 'amina@acmetransformers.com',
      phone: '+1-202-555-0100',
      company: 'Acme Transformers',
      category: 'Power Transformer',
      rating: '100 MVA',
      voltage: '132 kV',
      details: 'Supply one 100 MVA 132/33 kV power transformer to IEC 60076 for a substation extension.',
      deadline: '2026-12-31',
      consent: true,
      consent_version: leads.CONSENT_VERSION,
      consent_at: new Date().toISOString()
    })
  });
  const rfqBody = JSON.parse(rfq.body);
  check('RFQ qualification does not need a person', rfq.statusCode === 200 && rfqBody.qualified === true && rfqBody.match_cap === 5, rfq.body);
  check('RFQ response omits the buyer contact', rfq.body.indexOf('amina@') === -1 && rfq.body.indexOf('Amina') === -1 && rfq.body.indexOf('555') === -1);

  const paid = JSON.parse((await reviewRfq.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      email: 'amina@acmetransformers.com', company: 'Acme Transformers', category: 'Power Transformer',
      rating: '100 MVA', details: 'Supply one 100 MVA 132/33 kV power transformer to IEC 60076 for a substation extension.',
      deadline: '2026-12-31', consent: 'yes', consent_version: leads.CONSENT_VERSION, consent_at: new Date().toISOString(),
      qualified_by_payment: true
    })
  })).body);
  check('payment does not qualify an RFQ', paid.qualified === false);

  const offer = leads.autoMatch({
    email: 'amina@acmetransformers.com', company: 'Acme Transformers', category: 'Power Transformer',
    rating: '100 MVA', details: 'Supply one 100 MVA 132/33 kV power transformer to IEC 60076 for a substation extension.',
    deadline: '2026-12-31', consent: true, consent_version: leads.CONSENT_VERSION, consent_at: '2026-10-15T08:00:00Z'
  }, [1, 2, 3, 4, 5, 6].map(function (n) { return { slug: 's' + n, name: 'S' + n, research_completeness: 6 - n }; }), '2026-10-15');
  check('automatic offer preserves matcher order', offer.offered.length === 5 && offer.offered[0].slug === 's1' && offer.offered[4].slug === 's5');
  check('job rules still reject a careers signal', jobs.isSpecificVacancyUrl('https://careers.gevernova.com/jobs?keywords=transformer') === false);

  reviewVacancy._setProbeForTests(null);
  reviewVacancy._setStoreForTests(null);
  assert.strictEqual(failed, 0);
  console.log('\nreview automation: PASS');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
