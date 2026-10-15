#!/usr/bin/env node
/* Live openings need a specific vacancy URL, a capture date, and a
 * verification date. Careers-page signals never count. Posts expire after
 * 30 days. Featured rows pin above the others. The published file stays
 * empty until a reviewer adds a real row.
 */
'use strict';
const fs = require('fs');
const assert = require('assert');
const jobs = require('../lib/job-board');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok  ' + name);
  else {
    failed++;
    console.error('FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

const careers = [
  'https://careers.gevernova.com/jobs?keywords=transformer',
  'https://www.hitachienergy.com/me/en/careers/open-jobs',
  'https://www.hitachienergy.com/careers/open-jobs',
  'https://jobs.siemens-energy.com/jobs',
  'https://jobs.eaton.com/',
  'https://www.linkedin.com/jobs/search/?keywords=transformer&location=Italy',
  'https://www.bayt.com/en/international/jobs/power-transformer-jobs/'
];
careers.forEach(function (url) {
  check('careers link is not a vacancy: ' + url, jobs.isSpecificVacancyUrl(url) === false);
});
check('specific vacancy URL counts', jobs.isSpecificVacancyUrl('https://boards.greenhouse.io/acme/jobs/4567890') === true);
check('numeric job path counts', jobs.isSpecificVacancyUrl('https://recruiting.paylocity.com/Recruiting/Jobs/Details/3846464') === true);

check('multiple openings is not one position', jobs.isOnePosition('Field Service Engineer (multiple openings)', 'Join the team') === false);
check('one title is one position', jobs.isOnePosition('Power Transformer Design Engineer', 'Design power transformers to IEC 60076.') === true);

function published(over) {
  return Object.assign({
    status: 'published',
    title: 'Power Transformer Design Engineer',
    company: 'Example Transformers',
    location: 'Vadodara, India',
    function: 'Engineering & Design',
    description: 'One design engineer role for power transformers.',
    posting_url: 'https://jobs.example.com/job/88421',
    captured_at: '2026-10-01',
    last_verified_at: '2026-10-01',
    http_status: 200,
    http_checked_at: '2026-10-01',
    one_position: true,
    reviewer: 'reviewer',
    reviewed_at: '2026-10-01T12:00:00Z',
    verification_evidence: 'HTTP 200 on 2026-10-01 for the vacancy URL',
    featured: false
  }, over || {});
}

check('reviewed row is live inside 30 days', jobs.isLiveOpening(published(), '2026-10-15') === true);
check('row expires on day 30', jobs.isLiveOpening(published(), '2026-10-31') === false);
check('row is live on the day before expiry', jobs.isLiveOpening(published(), '2026-10-30') === true);
check('404 is not live', jobs.isLiveOpening(published({ http_status: 404, posting_url: 'https://recruiting.paylocity.com/Recruiting/Jobs/Details/3846464' }), '2026-10-15') === false);
check('missing dates are not live', jobs.isLiveOpening(published({ captured_at: '', last_verified_at: '' }), '2026-10-15') === false);
check('careers URL is not live even with dates', jobs.isLiveOpening(published({ posting_url: careers[0] }), '2026-10-15') === false);
check('unreviewed status is not live', jobs.isLiveOpening(published({ status: 'pending_review' }), '2026-10-15') === false);
check('multi-role text is not live', jobs.isLiveOpening(published({ title: 'Engineers (multiple openings)' }), '2026-10-15') === false);

const featured = published({ featured: true, title: 'Featured design engineer', last_verified_at: '2026-10-02' });
const standard = published({ title: 'Standard design engineer', last_verified_at: '2026-10-14', posting_url: 'https://jobs.example.com/job/88422' });
const ordered = jobs.publicOpenings([standard, featured], '2026-10-15');
check('featured is pinned first', ordered.length === 2 && ordered[0].featured === true && ordered[1].featured === false);
check('expired featured is not pinned or counted', jobs.publicOpenings([published({ featured: true, last_verified_at: '2026-09-01' })], '2026-10-15').length === 0);

const signals = careers.map(function (url) {
  return { t: 'Signal', co: 'GE Vernova', url: url, fn: 'Service & Field' };
});
check('signals never count as openings', jobs.signalsLiveCount(signals) === 0);
check('signal objects are not live openings', jobs.liveCount(signals, '2026-10-15') === 0);

const file = JSON.parse(fs.readFileSync('data/job-postings.json', 'utf8'));
check('published file has no openings', Array.isArray(file.published) && jobs.liveCount(file.published, '2026-10-15') === 0);

const html = fs.readFileSync('jobs.html', 'utf8');
check('jobs page still says 0 live openings', html.indexOf('0 live openings') !== -1);
check('jobs page labels careers signals', html.indexOf('Careers page →') !== -1 && html.indexOf('They are not specific vacancies') !== -1);
check('apply URL is required', /name="apply_url"[^>]*required|required[^>]*name="apply_url"/.test(html) || html.indexOf('name="apply_url" required') !== -1);
check('one-position attestation is on the form', html.indexOf('name="one_position"') !== -1);
check('page loads the job board rules', html.indexOf('lib/job-board.js') !== -1);
check('page reads the published file', html.indexOf('data/job-postings.json') !== -1);
check('no job buy button on the page', html.indexOf('buy.stripe.com/aFa14g') === -1 && html.indexOf('data-jobs-rfq-pay') === -1);

const ssr = fs.readFileSync('build_ssr.js', 'utf8');
check('SSR counts published rows through the same rules', ssr.indexOf('publicOpenings') !== -1 && ssr.indexOf('job-postings.json') !== -1);

const submission = jobs.submissionErrors({
  title: 'Power Transformer Design Engineer',
  company: 'Example Transformers',
  location: 'Vadodara, India',
  function: 'Engineering & Design',
  description: 'One role.',
  email: 'jobs@example.com',
  apply_url: 'https://jobs.example.com/job/88421',
  one_position: true
});
check('a specific vacancy can enter review', submission.length === 0, submission.join('; '));
const rejected = jobs.submissionErrors({
  title: 'Field Service Engineer (multiple openings)',
  company: 'Hitachi Energy',
  location: 'Dammam',
  function: 'Service & Field',
  description: 'Several roles.',
  email: 'jobs@example.com',
  apply_url: 'https://www.hitachienergy.com/me/en/careers/open-jobs',
  one_position: true
});
check('a careers search cannot enter review as an opening', rejected.length >= 2, rejected.join('; '));

assert.strictEqual(failed, 0);
console.log('\njob board: PASS');
