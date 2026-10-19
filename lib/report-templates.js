/* Original blank report workbooks for routine and commissioning records.
 * The row names follow the public test lists in IEC 60076-1, IEEE C57.12.90,
 * and IEEE C57.152. The sheets do not copy a standard's procedure or limits.
 */
'use strict';
const xlsx = require('./xlsx-workbook');

const IDENTITY = ['Asset', 'Serial number', 'Site', 'Rated voltage', 'Rated power', 'Vector group', 'Date', 'Tester', 'Instrument', 'Oil temperature C', 'Ambient temperature C'];

const NOTE = 'Blank editable sheet. Enter the readings. This file does not apply a pass or fail limit from a standard table. Limits stay in the equipment specification and in the cited standard.';

const TEMPLATES = [
  {
    key: 'ratio',
    title: 'Voltage ratio and phase displacement',
    filename: 'transformerpath-ratio.xlsx',
    sheet: 'Ratio',
    list: 'IEC 60076-1 routine tests',
    summary: 'Tap, winding pair, applied and measured voltage, nameplate ratio, deviation, and phase displacement.',
    columns: ['Tap', 'Winding pair', 'Applied voltage', 'Measured voltage', 'Measured ratio', 'Nameplate ratio', 'Deviation percent', 'Expected phase displacement', 'Measured phase displacement', 'Notes']
  },
  {
    key: 'winding_resistance',
    title: 'Winding resistance',
    filename: 'transformerpath-winding-resistance.xlsx',
    sheet: 'Winding resistance',
    list: 'IEC 60076-1 routine tests',
    summary: 'Winding, tap, terminals, measured ohms, temperatures, and the corrected value.',
    columns: ['Winding', 'Tap', 'Terminals', 'Measured ohms', 'Winding temperature C', 'Reference temperature C', 'Corrected ohms', 'Notes']
  },
  {
    key: 'insulation_resistance',
    title: 'Insulation resistance and polarization index',
    filename: 'transformerpath-insulation-resistance.xlsx',
    sheet: 'Insulation resistance',
    list: 'IEEE C57.12.90 and IEEE C57.152',
    summary: 'Connection, test voltage, megohms at 15 s, 60 s, and 600 s, and the polarization index.',
    columns: ['Connection', 'Test voltage', 'Megohms at 15 s', 'Megohms at 60 s', 'Megohms at 600 s', 'Polarization index', 'Winding temperature C', 'Notes']
  },
  {
    key: 'tan_delta',
    title: 'Capacitance and dissipation factor',
    filename: 'transformerpath-tan-delta.xlsx',
    sheet: 'Tan delta',
    list: 'IEEE C57.12.90',
    summary: 'Specimen, test voltage, capacitance, dissipation factor, and power factor.',
    columns: ['Insulation specimen', 'Test voltage', 'Capacitance pF', 'Dissipation factor percent', 'Power factor percent', 'Specimen temperature C', 'Notes']
  },
  {
    key: 'sfra',
    title: 'Sweep frequency response',
    filename: 'transformerpath-sfra.xlsx',
    sheet: 'SFRA',
    list: 'IEEE C57.149 and IEEE C57.152',
    summary: 'Connection, sweep, baseline trace, new trace, and a comparison note. The sheet does not score the traces.',
    columns: ['Terminal connection', 'Sweep start Hz', 'Sweep end Hz', 'Baseline trace id', 'New trace id', 'Band compared', 'Comparison note', 'Notes']
  },
  {
    key: 'dga_sampling',
    title: 'Dissolved-gas sample record',
    filename: 'transformerpath-dga-sampling.xlsx',
    sheet: 'DGA sampling',
    list: 'IEEE C57.104',
    summary: 'Sample point, container, and the laboratory ppm values. This sheet does not interpret the gases.',
    columns: ['Sample id', 'Sample point', 'Sample date', 'Container', 'H2 ppm', 'CH4 ppm', 'C2H6 ppm', 'C2H4 ppm', 'C2H2 ppm', 'CO ppm', 'CO2 ppm', 'O2 ppm', 'N2 ppm', 'Laboratory', 'Notes']
  },
  {
    key: 'commissioning_checklist',
    title: 'Commissioning checklist',
    filename: 'transformerpath-commissioning-checklist.xlsx',
    sheet: 'Commissioning',
    list: 'IEC 60076-1 routine tests, IEEE C57.12.90, and IEEE C57.152',
    summary: 'One row per listed test or inspection, with a blank result and an evidence id.',
    columns: ['Item', 'Public test list', 'Result', 'Report or evidence id', 'Notes'],
    preset: [
      ['Voltage ratio and phase displacement', 'IEC 60076-1 routine tests'],
      ['Winding resistance', 'IEC 60076-1 routine tests'],
      ['Short-circuit impedance and load loss, factory record', 'IEC 60076-1 routine tests'],
      ['No-load loss and current, factory record', 'IEC 60076-1 routine tests'],
      ['Applied voltage test, factory record', 'IEC 60076-1 routine tests'],
      ['Induced voltage test, factory record', 'IEC 60076-1 routine tests'],
      ['On-load tap-changer operation', 'IEC 60076-1 routine tests'],
      ['Insulation resistance', 'IEEE C57.12.90'],
      ['Polarization index', 'IEEE C57.152'],
      ['Capacitance and dissipation factor', 'IEEE C57.12.90'],
      ['Sweep frequency response baseline', 'IEEE C57.149'],
      ['Dissolved-gas sample', 'IEEE C57.104'],
      ['Bushings, oil level, leaks, and breather', 'Commissioning inspection'],
      ['Protective devices, alarms, and cooling', 'Commissioning inspection'],
      ['Core and frame insulation, where the design allows access', 'IEEE C57.152'],
      ['Tank and neutral earthing', 'Commissioning inspection']
    ]
  }
];

const BY_KEY = {};
TEMPLATES.forEach(function (item) { BY_KEY[item.key] = item; });

function blankRow(width) {
  const row = [];
  for (let i = 0; i < width; i++) row.push('');
  return row;
}

function rowsFor(template) {
  const rows = [];
  rows.push([template.title]);
  rows.push(['TransformerPath blank report template. Editable. Not a completed certificate.']);
  rows.push(['Test list: ' + template.list]);
  rows.push([NOTE]);
  rows.push([]);
  rows.push(IDENTITY);
  rows.push(blankRow(IDENTITY.length));
  rows.push([]);
  rows.push(template.columns);
  if (template.preset) {
    template.preset.forEach(function (preset) {
      const row = blankRow(template.columns.length);
      preset.forEach(function (value, index) { row[index] = value; });
      rows.push(row);
    });
  } else {
    for (let i = 0; i < 12; i++) rows.push(blankRow(template.columns.length));
  }
  rows.push([]);
  rows.push(['Factory dielectric and loss tests are recorded by report number. This workbook does not repeat a high-voltage factory test.']);
  rows.push(['Questions about the file: hello@transformerpath.com']);
  return rows;
}

function buildTemplate(key) {
  const template = BY_KEY[key];
  if (!template) return null;
  const bytes = xlsx.buildXlsx([{ name: template.sheet, rows: rowsFor(template) }]);
  return { template: template, bytes: bytes, rows: rowsFor(template) };
}

function buildBundleZip() {
  const files = {};
  TEMPLATES.forEach(function (template) {
    files[template.filename] = buildTemplate(template.key).bytes;
  });
  return {
    filename: 'transformerpath-test-templates.zip',
    bytes: xlsx.zipStore(files)
  };
}

module.exports = {
  TEMPLATES: TEMPLATES,
  BY_KEY: BY_KEY,
  IDENTITY: IDENTITY,
  NOTE: NOTE,
  rowsFor: rowsFor,
  buildTemplate: buildTemplate,
  buildBundleZip: buildBundleZip
};
