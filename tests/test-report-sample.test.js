/* The public example test report: redacted identity, no prices, stripped dates. */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sample = require('../lib/test-report-sample-pdf');

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log('  PASS  ' + name);
  else {
    failed++;
    console.error('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

const file = path.join(__dirname, '..', 'test-report-sample.pdf');
const bytes = fs.readFileSync(file);
const text = bytes.toString('latin1');
const built = sample.buildPdf();

check('committed file matches the generator', bytes.equals(built));
check('PDF header', bytes.slice(0, 5).toString() === '%PDF-');
check('one page', text.indexOf('/Count 1') !== -1);
check('labeled as an example report', text.indexOf('EXAMPLE REPORT') !== -1 && text.indexOf('Example report') !== -1);
function pdfLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
check('engineering lines stay', sample.LINES.every(function (line) { return text.indexOf(pdfLiteral(line)) !== -1; }));
check('standards and test date stay', text.indexOf('IEC 60076-5 sec.10 / IEC 60076-4 sec.7') !== -1 && text.indexOf('2026-Q2') !== -1);
check('serial number is the redaction', text.indexOf('Serial number:') !== -1 && text.indexOf(sample.REDACTED) !== -1 && text.indexOf('TB-SAMPLE-001') === -1);
check('project, client, and manufacturer are redacted', (text.split(sample.REDACTED).length - 1) >= 4);
check('no currency and no price columns', text.indexOf('$') === -1 && text.indexOf('Amount') === -1 && text.indexOf('USD') === -1 && !/\bUnit\b/.test(text) && !/\bQty\b/.test(text));
check('metadata is TransformerPath only', text.indexOf('/Creator (TransformerPath)') !== -1 && text.indexOf('/Producer (TransformerPath)') !== -1);
check('dates, author, and library metadata are absent',
  text.indexOf('/CreationDate') === -1 &&
  text.indexOf('/ModDate') === -1 &&
  text.indexOf('/Author') === -1 &&
  text.indexOf('pdf-lib') === -1 &&
  text.indexOf('Hopding') === -1 &&
  text.indexOf('D:20') === -1);
check('no place or consulting wording', text.indexOf('Dubai') === -1 && text.indexOf('UAE') === -1 && text.toLowerCase().indexOf('consult') === -1);
check('contact is the brand address', text.indexOf('hello@transformerpath.com') !== -1);
check('testing page links the example', fs.readFileSync('test-report.html', 'utf8').indexOf('href="/test-report-sample.pdf"') !== -1);

const dist = fs.readFileSync('build-dist.js', 'utf8');
check('dist publishes this PDF and no other', dist.indexOf("const PUBLIC_PDFS = new Set(['test-report-sample.pdf'])") !== -1 && /\\\.pdf\$\/i/.test(dist));
check('this PDF is tracked and other PDFs stay ignored',
  spawnSync('git', ['check-ignore', '-q', 'test-report-sample.pdf']).status === 1 &&
  spawnSync('git', ['check-ignore', '-q', 'private-notes.pdf']).status === 0);
check('a missing public PDF fails the build', dist.indexOf('public PDF missing') !== -1);

if (failed) {
  console.error('TEST REPORT SAMPLE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('TEST REPORT SAMPLE OK');
