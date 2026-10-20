#!/usr/bin/env node
/* EP Shanghai 2026 exhibitor import. Unclaimed rows keep the list's dash.
 * Outreach columns stay out of the site data. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failed++;
}

const census = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
const accessories = JSON.parse(fs.readFileSync(path.join(root, 'data/accessories.json'), 'utf8'));
const labs = JSON.parse(fs.readFileSync(path.join(root, 'data/laboratories.json'), 'utf8'));
const exhibitors = JSON.parse(fs.readFileSync(path.join(root, 'data/ep-shanghai-2026-exhibitors.json'), 'utf8'));
const slugs = JSON.parse(fs.readFileSync(path.join(root, 'data/listing-slugs.json'), 'utf8'));
const stats = JSON.parse(fs.readFileSync(path.join(root, 'data/site-stats.json'), 'utf8'));
const ids = JSON.parse(fs.readFileSync(path.join(root, 'data/permanent-ids.json'), 'utf8'));
const publicCount = require('../lib/public-company-count').read(root).publicCount;

const china = census.find((g) => g.country === 'China');
const makers = china.makers.filter((m) => m[1] === '—' && m[3] === '');
check('the EP Shanghai unclaimed China makers remain', makers.length >= 63, String(makers.length));
check('the public manufacturer count is the site-stats figure', publicCount === stats.manufacturers && publicCount > 950, String(publicCount) + '/' + stats.manufacturers);
check('the EP Shanghai unclaimed accessory rows remain', accessories.suppliers.filter((s) => s.verification_status === 'Unclaimed').length >= 68);
check('the laboratory directory still holds the EP Shanghai additions', labs.laboratories.length >= 45, String(labs.laboratories.length));

const shipped = JSON.stringify(exhibitors) + JSON.stringify(accessories.suppliers.slice(-80)) + JSON.stringify(labs.laboratories.slice(-40));
check('outreach columns are not published', !/do_not_contact/.test(shipped) && !/"email"\s*:/.test(JSON.stringify(exhibitors)));

const shellDup = accessories.suppliers.filter((s) => /shell \(shanghai\)/i.test(s.name));
const cargillDup = accessories.suppliers.filter((s) => s.name === 'CARGILL');
check('Shell Shanghai was not created as a second supplier', shellDup.length === 0);
check('Cargill was not created as a second supplier', cargillDup.length === 0);

const group = china.makers.find((m) => m[0] === 'Ningbo Tianan (Group) Co., Ltd.');
const smart = china.makers.find((m) => m[0] === "NINGBO TIAN'AN SMART GRID TECHNOLOGY CO., LTD.");
check("Tian'an Group and Tian'an Smart Grid stay separate", !!(group && smart && group[2] && smart[2] === ''));

const abb = china.makers.find((m) => m[0] === 'ABB (China) Co., LTD');
check('ABB (China) is its own maker with the listed website', !!(abb && abb[2] === 'https://global.abb' && abb[3] === ''));
check('ABB (China) has a new permanent id', ids.companies['abb-china-co-ltd'] && /^TPM-\d+$/.test(ids.companies['abb-china-co-ltd'].id));

const kemaLabs = labs.laboratories.filter((l) => /KEMA B\.V/i.test(l.name));
check('KEMA B.V. was not added as a China laboratory', kemaLabs.length === 0);
const kemaTag = exhibitors.listings.find((row) => row.slug === 'kema-labs-arnhem');
check('KEMA Arnhem carries the exhibitor tag record', !!(kemaTag && kemaTag.action === 'tagged'));

check('sixteen Chinese names have pinyin slugs', Object.keys(slugs).length === 16, String(Object.keys(slugs).length));
const hengda = 'jiang-su-heng-da-bian-ya-qi-you-xian-gong-si';
check('a Chinese maker claim page exists', fs.existsSync(path.join(root, 'claim-listing', hengda, 'index.html')));
const board = fs.readFileSync(path.join(root, 'manufacturers.html'), 'utf8');
check('the manufacturers board links the Chinese claim page', board.indexOf('/claim-listing/' + hengda + '/') >= 0);
check('the manufacturers board does not emit a bare claim link for these rows', board.indexOf('href="/claim-listing/"') < 0);

const labHtml = fs.readFileSync(path.join(root, 'laboratories.html'), 'utf8');
const bStart = labHtml.indexOf('B aoding Zhengheng');
const bCard = labHtml.slice(bStart, bStart + 2500);
check('an unsourced lab card does not claim ISO/IEC 17025', bStart > 0 && bCard.indexOf('ISO/IEC 17025') < 0);

const shell = fs.readFileSync(path.join(root, 'accessories/shell-global-shell-diala/index.html'), 'utf8');
const shellBadge = 'Exhibiting at EP Shanghai \u00b7 3\u20135 Dec 2026';
check('Shell Diala shows the EP Shanghai badge beside the name', shell.indexOf('<h1>') >= 0 && shell.indexOf(shellBadge) >= 0 && shell.indexOf('data-event-badge="ep-shanghai-2026"') >= 0 && shell.indexOf('href="/events/ep-shanghai-2026/"') >= 0);
check('the manufacturers board badges ABB (China) beside its name', board.indexOf('ABB (China) Co., LTD</a><a class="event-badge"') >= 0);

if (failed) {
  console.error('EP SHANGHAI EXHIBITORS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EP SHANGHAI EXHIBITORS OK');
