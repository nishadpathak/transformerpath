/* Example transformer test report.
 * Engineering lines stay. Identity fields are redacted. There is no price
 * column and no currency. Info metadata is Creator and Producer only.
 */
'use strict';

const LINES = [
  'HV/LV rating - 100 / 33 kV',
  'Short-circuit current Isc - 25 kA / 2 s',
  'Peak withstand ip - 1.82 x sqrt(2) x Isc',
  'Lightning impulse (1.2/50 us) - 650 kV BIL',
  'Switching impulse (250/2500 us) - 525 kV SIL'
];

const REDACTED = '[REDACTED - sample]';

function pdfEsc(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function text(font, size, x, y, color, value) {
  return 'BT /' + font + ' ' + size + ' Tf ' + color + ' rg 1 0 0 1 ' + x + ' ' + y +
    ' Tm (' + pdfEsc(value) + ') Tj ET\n';
}

function buildPdf() {
  const navy = '0.05 0.17 0.31';
  const blue = '0.05 0.37 0.66';
  const grey = '0.36 0.42 0.50';
  const ink = '0.10 0.10 0.12';
  let y = 786;
  let stream = '';
  stream += text('F2', 18, 56, y, navy, 'EXAMPLE REPORT');
  y -= 24;
  stream += text('F2', 16, 56, y, navy, 'Transformer Test Report');
  y -= 18;
  stream += text('F1', 11, 56, y, grey, 'IEC 60076-5 short-circuit / IEC 60076-4 lightning impulse - redacted sample');
  y -= 10;
  stream += grey + ' RG 1 w 56 ' + y + ' m 539 ' + y + ' l S\n';
  y -= 22;

  const meta = [
    ['Project', REDACTED],
    ['Client', REDACTED],
    ['Manufacturer', REDACTED],
    ['Serial number', REDACTED],
    ['Standards', 'IEC 60076-5 sec.10 / IEC 60076-4 sec.7'],
    ['Test date', '2026-Q2']
  ];
  meta.forEach(function (row) {
    stream += text('F2', 10, 56, y, grey, row[0] + ':');
    stream += text('F1', 10, 170, y, ink, row[1]);
    y -= 16;
  });

  y -= 8;
  stream += text('F2', 10, 56, y, grey, 'Description');
  y -= 6;
  stream += '0.82 0.84 0.88 RG 1 w 56 ' + y + ' m 539 ' + y + ' l S\n';
  y -= 18;
  LINES.forEach(function (line) {
    stream += text('F1', 11, 56, y, ink, line);
    y -= 18;
  });

  y -= 10;
  const notes = [
    'Example report. These magnitudes illustrate the format. Actual magnitudes vary per project.',
    'Device, customer, and site names are withheld. This file is not a test certificate.'
  ];
  notes.forEach(function (line) {
    stream += text('F1', 10, 56, y, grey, line);
    y -= 14;
  });
  stream += text('F1', 9, 56, 48, grey, 'TransformerPath - Example report - hello@transformerpath.com');

  const bodies = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Count 1 /Kids [6 0 R] >>',
    3: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    4: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    5: '<< /Length ' + Buffer.byteLength(stream, 'utf8') + ' >>\nstream\n' + stream + 'endstream',
    6: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 5 0 R >>',
    7: '<< /Creator (TransformerPath) /Producer (TransformerPath) >>'
  };

  let out = '%PDF-1.4\n';
  const offsets = [0];
  let id;
  for (id = 1; id <= 7; id++) {
    offsets[id] = Buffer.byteLength(out, 'utf8');
    out += id + ' 0 obj\n' + bodies[id] + '\nendobj\n';
  }
  const xref = Buffer.byteLength(out, 'utf8');
  out += 'xref\n0 8\n0000000000 65535 f \n';
  for (id = 1; id <= 7; id++) out += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size 8 /Root 1 0 R /Info 7 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'utf8');
}

module.exports = { buildPdf: buildPdf, LINES: LINES, REDACTED: REDACTED };
