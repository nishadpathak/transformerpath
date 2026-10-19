/* Minimal Office Open XML workbook. Stored ZIP, inline strings, no shared
 * strings. Enough for an editable blank sheet. Not a general spreadsheet library.
 */
'use strict';
const zlib = require('zlib');

const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function xml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetName(value, used) {
  let name = String(value || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  if (!name) name = 'Sheet';
  let candidate = name;
  let n = 2;
  while (used[candidate]) {
    const suffix = ' ' + n;
    candidate = name.slice(0, 31 - suffix.length) + suffix;
    n++;
  }
  used[candidate] = true;
  return candidate;
}

function worksheetXml(rows) {
  const lines = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'];
  (rows || []).forEach(function (row, rIndex) {
    const r = rIndex + 1;
    const cells = (row || []).map(function (value, cIndex) {
      if (value == null || value === '') return '';
      const ref = colName(cIndex) + r;
      return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>';
    }).join('');
    lines.push('<row r="' + r + '">' + cells + '</row>');
  });
  lines.push('</sheetData></worksheet>');
  return lines.join('');
}

function workbookFiles(sheets) {
  const list = sheets && sheets.length ? sheets : [{ name: 'Sheet', rows: [] }];
  const used = {};
  const names = list.map(function (sheet) { return sheetName(sheet.name, used); });
  const files = {};
  const overrides = names.map(function (_, i) {
    return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  }).join('');
  files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    overrides + '</Types>';
  files['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  const rels = names.map(function (_, i) {
    return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
  }).join('');
  files['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels +
    '<Relationship Id="rId' + (names.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
  files['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names.map(function (name, i) {
      return '<sheet name="' + xml(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    }).join('') +
    '</sheets></workbook>';
  files['xl/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '</styleSheet>';
  names.forEach(function (_, i) {
    files['xl/worksheets/sheet' + (i + 1) + '.xml'] = worksheetXml(list[i].rows);
  });
  return files;
}

function zipStore(files) {
  const names = Object.keys(files);
  const locals = [];
  const centrals = [];
  let offset = 0;
  names.forEach(function (name) {
    const data = Buffer.isBuffer(files[name]) ? files[name] : Buffer.from(String(files[name]), 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x5a21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5a21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(Buffer.concat([local, nameBuf, data]));
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += local.length + nameBuf.length + data.length;
  });
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat(locals.concat([centralBuf, end]));
}

function unzipStore(buffer) {
  const out = {};
  let pos = 0;
  while (pos + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(pos);
    if (sig === 0x06054b50 || sig === 0x02014b50) break;
    if (sig !== 0x04034b50) break;
    const method = buffer.readUInt16LE(pos + 8);
    const comp = buffer.readUInt32LE(pos + 18);
    const nameLen = buffer.readUInt16LE(pos + 26);
    const extraLen = buffer.readUInt16LE(pos + 28);
    const name = buffer.slice(pos + 30, pos + 30 + nameLen).toString('utf8');
    const start = pos + 30 + nameLen + extraLen;
    const raw = buffer.slice(start, start + comp);
    out[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    pos = start + comp;
  }
  return out;
}

function buildXlsx(sheets) {
  return zipStore(workbookFiles(sheets));
}

module.exports = {
  buildXlsx: buildXlsx,
  zipStore: zipStore,
  unzipStore: unzipStore,
  crc32: crc32
};
