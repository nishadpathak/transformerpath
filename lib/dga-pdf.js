/* One-page-or-more text PDF for a DGA screening. No external font. */
'use strict';

function pdfEsc(value) {
  return String(value == null ? '' : value)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdf(lines) {
  var chunks = [];
  var size = 46;
  var src = lines && lines.length ? lines : ['TransformerPath DGA screening report'];
  var i;
  for (i = 0; i < src.length; i += size) chunks.push(src.slice(i, i + size));
  var nPages = chunks.length;
  var contentIds = [];
  var pageIds = [];
  var next = 4;
  for (i = 0; i < nPages; i++) {
    contentIds.push(next++);
    pageIds.push(next++);
  }
  var bodies = {};
  bodies[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  bodies[2] = '<< /Type /Pages /Count ' + nPages + ' /Kids [' + pageIds.map(function (id) {
    return id + ' 0 R';
  }).join(' ') + '] >>';
  bodies[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  chunks.forEach(function (chunk, index) {
    var cmds = ['BT', '/F1 10 Tf', '12 TL', '48 750 Td'];
    chunk.forEach(function (line, lineNo) {
      if (lineNo) cmds.push('T*');
      cmds.push('(' + pdfEsc(line) + ') Tj');
    });
    cmds.push('ET');
    var stream = cmds.join('\n');
    bodies[contentIds[index]] = '<< /Length ' + Buffer.byteLength(stream, 'utf8') + ' >>\nstream\n' + stream + '\nendstream';
    bodies[pageIds[index]] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ' +
      contentIds[index] + ' 0 R /Resources << /Font << /F1 3 0 R >> >> >>';
  });
  var max = next - 1;
  var out = '%PDF-1.4\n';
  var offsets = [0];
  var id;
  for (id = 1; id <= max; id++) {
    offsets[id] = Buffer.byteLength(out, 'utf8');
    out += id + ' 0 obj\n' + bodies[id] + '\nendobj\n';
  }
  var xref = Buffer.byteLength(out, 'utf8');
  out += 'xref\n0 ' + (max + 1) + '\n';
  out += '0000000000 65535 f \n';
  for (id = 1; id <= max; id++) {
    out += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  }
  out += 'trailer\n<< /Size ' + (max + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'utf8');
}

module.exports = { buildPdf: buildPdf };
