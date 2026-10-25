#!/usr/bin/env node
/* GCC coverage uses content dates. A review stamp and a tender close date
 * do not move last sourced. The DEWA list parser reads only rows on the page.
 * "Fourier transform" is not a power transformer.
 */
'use strict';
const { contentDate } = require('../build-gcc-source-coverage');
const adapters = require('../lib/gcc-adapters');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

console.log('=== GCC COVERAGE CLOCK ===');
const reviewed = contentDate({
  dates: {
    publication_date: '2026-09-24',
    event_date: '2026-09-24',
    tender_close_date: '2026-11-10',
    source_checked_at: '2026-10-14'
  }
}, '2026-10-25');
check('review stamp does not become last sourced', reviewed === '2026-09-24', reviewed);
check('close date does not become last sourced', reviewed !== '2026-11-10');

const october = contentDate({
  dates: { publication_date: '2026-10-13', source_checked_at: '2026-10-14', event_date: '2026-10-13' }
}, '2026-10-25');
check('October publication stays the content date', october === '2026-10-13', october);

check('Fourier transform is not a power-transformer hit', adapters.powerTransformerText('Fourier transform infrared spectroscopy system') === false);
check('an oil-filled transformer is a power-transformer hit', adapters.powerTransformerText('2.5 MVA oil-filled transformer') === true);

const html = [
  '<div>Tender No:</div><div>2122600155</div><div>Name of Tenderer :</div>',
  '<div>INSTALLATION, TESTING AND COMMISSIONING OF DISTRIBUTION SUBSTATIONS &amp; KIOSKS</div>',
  '<div>Tender Status:</div><div>Extended</div>',
  '<div>Floating Date:</div><div>24-Sep-2026</div>',
  '<div>Closing Date:</div><div>10-Nov-2026</div>',
  '<div>Tender No:</div><div>2422600043</div><div>Name of Tenderer :</div>',
  '<div>SUPPLY OF FOURIER TRANSFORM INFRARED (FTIR) SPECTROSCOPY SYSTEM</div>',
  '<div>Floating Date:</div><div>28-Sep-2026</div>',
  '<div>Closing Date:</div><div>28-Oct-2026</div>'
].join('');
const parsed = adapters.parseDewaOpenTenders(html);
check('parser sees the list marker', parsed.marker === true);
check('parser keeps both stated tender ids', parsed.notices.length === 2, String(parsed.notices.length));
const dewa = parsed.notices.find(function (n) { return n.tender_id === '2122600155'; });
check('2122600155 closing date is 10 Nov 2026', dewa && dewa.close_iso === '2026-11-10' && dewa.float_iso === '2026-09-24' && dewa.status === 'Extended', JSON.stringify(dewa));

const rows = [{
  tender_id: '2122600155',
  tender_close_date: '2026-10-27',
  dates: { tender_close_date: '2026-10-27', publication_date: '2026-09-24' },
  key_values_extracted: { close: '2026-10-27' },
  notes: ''
}];
const applied = adapters.applyListedDates(rows, parsed.notices, '2026-10-25');
check('stored closing date is replaced from the list', applied.changes.length === 1 && rows[0].tender_close_date === '2026-11-10', JSON.stringify(applied.changes));
check('publication date is left alone', rows[0].dates.publication_date === '2026-09-24');
check('source check day is the fetch day', rows[0].dates.source_checked_at === '2026-10-25');

if (failed) {
  console.error('GCC COVERAGE CLOCK FAILED (' + failed + ')');
  process.exit(1);
}
console.log('GCC COVERAGE CLOCK OK');
