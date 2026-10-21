#!/usr/bin/env node
/* Multi-event batch: uncertain matches stay separate, and each event page has its section. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function check(label, pass, detail) {
  console.log((pass ? '  ✓ ' : '  ✗ ') + label + (pass || !detail ? '' : ' :: ' + detail));
  if (!pass) failed++;
}

const badges = JSON.parse(fs.readFileSync(path.join(root, 'data/event-badges.json'), 'utf8'));
const directory = JSON.parse(fs.readFileSync(path.join(root, 'data/event-directory.json'), 'utf8')).sections;
const events = JSON.parse(fs.readFileSync(path.join(root, 'data/events.json'), 'utf8'));
function history(slug) {
  const row = badges.companies.find((company) => company.slug === slug);
  return row ? row.history.map((entry) => entry.event) : [];
}
function has(slug, event) { return history(slug).indexOf(event) >= 0; }

check('Siemens Energy is tagged for Enlit Europe and Heidelberg', history('siemens-energy').join(',') === 'enlit-europe-2026,cigre-international-symposium-heidelberg-2027');
check('generic Siemens is its own listing for ADIPEC and CIGRE', has('siemens', 'adipec-2026') && has('siemens', 'gcc-power-2025') && !has('siemens-energy', 'adipec-2026'));
check('Al Fanar was not merged into either Alfanar profile', has('al-fanar', 'wetex-2025') && !has('alfanar-maroc', 'wetex-2025') && !has('alfanar', 'wetex-2025'));
check('HD Hyundai Electric uses the matching profile, not the USA plant', has('hd-hyundai-electric', 'wetex-2025') && !has('hd-hyundai-power-transformers-usa', 'wetex-2025'));
check('Hyosung Heavy Industries was not tagged from a name-only or India row', history('hyosung-heavy-industries').length === 0 && has('hyosung', 'gcc-power-2025') && has('hyosung-t-and-d-india-pvt-ltd', 'elecrama-2025'));
check('Hitachi Energy keeps WETEX and the floor-plan Hitachi stays separate', has('hitachi-energy', 'wetex-2025') && !has('hitachi-energy', 'gcc-power-2025') && has('hitachi', 'gcc-power-2025'));
check('Megger Group keeps the brand rows and not the sister companies', has('megger-group-limited', 'enlit-europe-2026') && has('megger-group-limited', 'gcc-power-2025') && !has('megger-group-limited', 'energetics-2026') && !has('megger-group-limited', 'elecrama-2025'));
check("Tian'an Smart Grid keeps EP Shanghai and the group profile does not", has('ningbo-tianan-smart-grid-technology-co-ltd', 'ep-shanghai-2026') && !has('ningbo-tianan-group-co-ltd', 'ep-shanghai-2026'));

const expected = {
  'ep-shanghai-2026': ['Exhibiting at EP Shanghai 2026', 174],
  'enlit-europe-2026': ['Exhibiting at Enlit Europe 2026', 38],
  'adipec-2026': ['Exhibiting at ADIPEC 2026', 2],
  'energetics-2026': ['Exhibiting at ENERGETICS 2026', 13],
  'elecrama-2025': ['Previous exhibitors (2025)', 133],
  'gcc-power-2025': ['Previous exhibitors (2025)', 13],
  'wetex-2025': ['Previous exhibitors (2025)', 40],
  'vietnam-energy-week-2025': ['Previous edition', 2]
};
Object.keys(expected).forEach((id) => {
  const block = directory[id];
  const event = events.find((row) => row.id === id);
  check(id + ' section has ' + expected[id][1] + ' rows', block && block.section === expected[id][0] && block.entries.length === expected[id][1], block && String(block.entries.length));
  check(id + ' edition is confirmed from an official source', event && event.date_status === 'CONFIRMED' && /^https:\/\//.test(event.source_url) && event.source_checked_at === '2026-10-20');
});
check('shipped batch files do not publish do_not_contact', !/do_not_contact/i.test(JSON.stringify(directory) + JSON.stringify(badges)));

const adipec = fs.readFileSync(path.join(root, 'events/adipec-2026/index.html'), 'utf8');
const elecrama = fs.readFileSync(path.join(root, 'events/elecrama-2025/index.html'), 'utf8');
const energetics = fs.readFileSync(path.join(root, 'events/energetics-2026/index.html'), 'utf8');
const vietnam = fs.readFileSync(path.join(root, 'events/vietnam-energy-week-2025/index.html'), 'utf8');
check('ADIPEC page lists the exhibiting section', adipec.indexOf('Exhibiting at ADIPEC 2026') >= 0 && adipec.indexOf('/manufacturers/siemens/') >= 0 && adipec.indexOf('siemens-energy') < 0);
check('ELECRAMA page lists previous exhibitors', elecrama.indexOf('Previous exhibitors (2025)') >= 0);
check('Vietnam Energy Week uses Previous edition', vietnam.indexOf('Previous edition') >= 0 && vietnam.indexOf('Previous exhibitors (2025)') < 0);

const labs = JSON.parse(fs.readFileSync(path.join(root, 'data/laboratories.json'), 'utf8'));
const ids = JSON.parse(fs.readFileSync(path.join(root, 'data/permanent-ids.json'), 'utf8'));
const tomb = ids.companies['schweitzer-engineering-laboratories-pvt-ltd'];
check('Schweitzer is off ELECRAMA and out of the laboratory list', !has('schweitzer-engineering-laboratories-pvt-ltd', 'elecrama-2025') && !labs.laboratories.some((lab) => lab.id === 'lab:schweitzer-engineering-laboratories-pvt-ltd') && elecrama.indexOf('SCHWEITZER') < 0);
check('TPM-001072 stays reserved', !!(tomb && tomb.id === 'TPM-001072' && tomb.retired === true));
check('Schweitzer profile and claim page are gone', !fs.existsSync(path.join(root, 'laboratories/schweitzer-engineering-laboratories-pvt-ltd/index.html')) && !fs.existsSync(path.join(root, 'claim-listing/schweitzer-engineering-laboratories-pvt-ltd/index.html')));
function row(eventId, pattern) {
  return directory[eventId].entries.find((entry) => pattern.test(entry.name));
}
const mefta = row('energetics-2026', /MEFTA GREEN TRANSFO/i);
const sonel = row('energetics-2026', /^SONEL S\.A\.$/i);
const kinectrics = row('elecrama-2025', /KINECTRICS INDIA/i);
const eberle = row('elecrama-2025', /A\. EBERLE SYSTEMS/i);
const cesi = row('elecrama-2025', /CESI S\.P\.A/i);
const quality = row('elecrama-2025', /QUALITY POWER/i);
check('Mefta stays separate from Green Transfo', !!(mefta && mefta.directory === 'manufacturers' && mefta.slug !== 'green-transfo') && !has('green-transfo', 'energetics-2026'));
check('Sonel S.A. stays separate from Sonel Instruments India', !!(sonel && sonel.slug !== 'sonel-instruments-india-private-limited') && !has('sonel-instruments-india-private-limited', 'energetics-2026'));
check('Kinectrics India stays separate from the Canadian lab', !!(kinectrics && kinectrics.slug === 'kinectrics-india-private-limited') && !has('kinectrics', 'elecrama-2025'));
check('A. Eberle Systems stays separate from A. Eberle GmbH', !!(eberle && eberle.slug === 'a-eberle-systems-pvt-ltd') && !has('a-eberle-gmbh-and-co-kg', 'elecrama-2025'));
check('CESI S.p.A. stays separate from the KEMA laboratories', !!(cesi && cesi.slug === 'cesi-s-p-a') && !has('kema-labs-arnhem', 'elecrama-2025'));
check('Quality Power and Atlanta Electricals are on ELECRAMA', !!(quality && quality.directory === 'manufacturers') && has('atlanta-electricals', 'elecrama-2025') && elecrama.indexOf('QUALITY POWER ELECTRICAL EQUIPMENTS PVT. LTD.') >= 0);
check('ENERGETICS page lists the new exhibitors', energetics.indexOf('MEFTA GREEN TRANSFO ENERGY POLAND SP. Z O.O.') >= 0 && energetics.indexOf('SONEL S.A.') >= 0);

const batch3 = {
  'power-bangladesh-2023': ['Previous exhibitors (2023)', 10],
  'cigre-international-symposium-heidelberg-2027': ['Exhibiting at CIGRE Symposium Heidelberg 2027', 11],
  'vde-hochspannungstechnik-2026': ['Exhibiting at VDE Hochspannungstechnik 2026', 8],
  'jeca-fair-kansai-edition-2027': ['Exhibiting at JECA FAIR 2027', 3],
  'electrical-expo-2026': ['Previous exhibitors (2026)', 13],
  'ecce-europe-2026': ['Previous exhibitors (2026)', 6],
  'power-and-water-nigeria-exhibition-2026': ['Previous exhibitors (2026)', 3],
  'power-and-energy-kenya-2027': ['Exhibiting at Power & Energy Kenya 2027', 1],
  'power-and-energy-tanzania-2026': ['Previous exhibitors (2026)', 1],
  'electric-and-power-philippines-2026': ['Previous exhibitors (2026)', 8],
  'power-and-electricity-world-africa-2026': ['Previous exhibitors (2026)', 3]
};
Object.keys(batch3).forEach((id) => {
  const block = directory[id];
  const event = events.find((row) => row.id === id);
  check(id + ' section has ' + batch3[id][1] + ' rows', block && block.section === batch3[id][0] && block.entries.length === batch3[id][1], block && String(block.entries.length));
  check(id + ' edition is confirmed', event && event.date_status === 'CONFIRMED' && /^https:\/\//.test(event.source_url || '') && !!event.source_checked_at);
});
const abb = row('cigre-international-symposium-heidelberg-2027', /^ABB$/);
const abbStl = row('electrical-expo-2026', /^ABB$/);
check('generic ABB is one new listing on Heidelberg and St. Louis', !!(abb && abbStl && abb.slug === 'abb' && abb.slug === abbStl.slug && abb.directory === 'manufacturers') && !has('abb-india-limited', 'electrical-expo-2026') && !has('abb-china-co-ltd', 'cigre-international-symposium-heidelberg-2027'));
check('OMICRON Lab stays off the energy-testing accessory', !has('omicron-electronics-gmbh', 'ecce-europe-2026') && has('omicron-lab', 'ecce-europe-2026'));
check('VDE OMICRON still tags the energy-testing accessory', has('omicron-electronics-gmbh', 'vde-hochspannungstechnik-2026'));
check('WEG South Africa stays off the Brazil group profile', !has('weg', 'power-and-electricity-world-africa-2026') && has('weg-south-africa-pty-ltd', 'power-and-electricity-world-africa-2026'));
check('Mitsubishi Electric stays off the Japan profile', !has('mitsubishi-electric', 'ecce-europe-2026') && has('mitsubishi-electric-power-modules', 'ecce-europe-2026'));
check('Mitsubishi Electric accessory page uses the split slug', fs.existsSync(path.join(root, 'accessories/mitsubishi-electric-power-modules/index.html')) && !fs.existsSync(path.join(root, 'accessories/mitsubishi-electric/index.html')));
const ecceHtml = fs.readFileSync(path.join(root, 'events/ecce-europe-2026/index.html'), 'utf8');
check('ECCE page links the Mitsubishi Electric power-modules listing', ecceHtml.indexOf('/accessories/mitsubishi-electric-power-modules/') >= 0);
check('Eaton Corporation stays off the Eaton group profile', !has('eaton', 'electrical-expo-2026') && has('eaton-corporation', 'electrical-expo-2026') && has('eaton-power-systems-division', 'electrical-expo-2026'));
check('Bangladesh Tesla stays off the India profile', !has('tesla-transformers', 'power-bangladesh-2023') && has('tesla-transformers-power-bangladesh', 'power-bangladesh-2023'));
check('JECA listings keep the Japanese names', !!row('jeca-fair-kansai-edition-2027', /指月電機製作所/) && !!row('jeca-fair-kansai-edition-2027', /寺崎電気産業/) && !!row('jeca-fair-kansai-edition-2027', /マルチ計測器/));
check('Legion Insulators is listed and Permali Wallace stays tagged', !!row('power-bangladesh-2023', /LEGION INSULATORS/) && has('permali-wallace-pvt-ltd', 'power-bangladesh-2023'));
check('Heidelberg Hitachi Energy is tagged and the GCC Hitachi stays separate', has('hitachi-energy', 'cigre-international-symposium-heidelberg-2027') && !has('hitachi-energy', 'gcc-power-2025') && has('hitachi', 'gcc-power-2025'));
const makers = JSON.parse(fs.readFileSync(path.join(root, 'data/manufacturers.json'), 'utf8'));
const abbRow = makers.some((g) => g.country === '—' && (g.makers || []).some((m) => m[0] === 'ABB'));
check('generic ABB sits in the unstated country group', abbRow);
const ph = (badges.events || []).find((event) => event.slug === 'electric-and-power-philippines-2026');
const af = (badges.events || []).find((event) => event.slug === 'power-and-electricity-world-africa-2026');
check('Terrapinn shows use the Electric & Power and Power & Electricity names', ph && ph.past_name === 'Electric & Power Philippines 2026' && af && af.past_name === 'Power & Electricity World Africa 2026');

const batch4 = {
  'cwieme-berlin-2026': ['Previous exhibitors (2026)', 6],
  'coiltech-2026': ['Previous exhibitors (2026)', 1],
  'coiltech-italia-2026': ['Previous exhibitors (2026)', 1],
  'cigre-paris-2026': ['Previous exhibitors (2026)', 8],
  'hannover-messe-2026': ['Previous exhibitors (2026)', 2],
  'data-center-world-power-2026': ['Previous exhibitors (2026)', 1],
  'smrp-annual-conference-2026': ['Previous exhibitors (2026)', 1],
  'middle-east-energy-2026': ['Previous exhibitors (2026)', 2],
  'electra-mining-africa-2026': ['Previous exhibitors (2026)', 1],
  'wetex-2026': ['Exhibiting at WETEX 2026', 1]
};
Object.keys(batch4).forEach((id) => {
  const block = directory[id];
  check(id + ' section has ' + batch4[id][1] + ' rows', block && block.section === batch4[id][0] && block.entries.length === batch4[id][1], block && String(block.entries.length));
});
const published4 = ['reliability-africa-expo-2026', 'up-international-trade-show-2026', 'data-center-world-power-2026', 'smrp-annual-conference-2026', 'ieee-apec-2026', 'ip-utility-safety-conference-expo-2026', 'megger-substation-testing-workshop-2026', 'darcy-robotics-in-td-2026', 'aupec-2026', 'ieee-pes-switchgear-committee-spring-2027'];
check('batch 4 publishes 10 events and skips CWIEME Mexico and ELECRAMA Asia', published4.length === 10 && published4.every((id) => events.some((ev) => ev.id === id)) && !events.some((ev) => ev.id === 'cwieme-mexico' || ev.id === 'elecrama-asia-2026' || ev.series_slug === 'elecrama-asia'));
check('ELECRAMA Asia pages, badges, and sitemap entries are gone', !fs.existsSync(path.join(root, 'events/elecrama-asia-2026/index.html')) && !fs.existsSync(path.join(root, 'events/elecrama-asia/index.html')) && !/elecrama-asia/.test(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8')) && !(badges.events || []).some((event) => event.slug === 'elecrama-asia-2026' || event.series === 'elecrama-asia') && !(badges.companies || []).some((company) => (company.history || []).some((entry) => entry.event === 'elecrama-asia-2026') || /HPL Electric/i.test(company.name || '')));
const ipSafety = events.find((ev) => ev.id === 'ip-utility-safety-conference-expo-2026');
const reliability = events.find((ev) => ev.id === 'reliability-africa-expo-2026');
const darcy = events.find((ev) => ev.id === 'darcy-robotics-in-td-2026');
const meggerWorkshop = events.find((ev) => ev.id === 'megger-substation-testing-workshop-2026');
const apec2026 = events.find((ev) => ev.id === 'ieee-apec-2026');
check('iP Utility Safety dates stay unconfirmed', ipSafety && ipSafety.date_status === 'PROJECTED' && ipSafety.start === '2026-05-05');
check('Reliability Africa dates stay unconfirmed and the country is Nigeria', reliability && reliability.date_status === 'PROJECTED' && reliability.country === 'Nigeria' && reliability.city === 'Lagos');
check('the Darcy session is a webinar and the Megger session is a workshop', darcy && darcy.type === 'webinar' && meggerWorkshop && meggerWorkshop.type === 'workshop');
check('IEEE APEC 2026 stays on the APEC series', apec2026 && apec2026.series_slug === 'ieee-apec' && apec2026.type === 'conference');
const verifiedAdded = ['eif-2026', 'doble-life-of-a-transformer-seminar-2027', 'intersolar-energy-storage-north-america-2027'];
const eif = events.find((ev) => ev.id === 'eif-2026');
const doble2027 = events.find((ev) => ev.id === 'doble-life-of-a-transformer-seminar-2027');
const esna = events.find((ev) => ev.id === 'intersolar-energy-storage-north-america-2027');
const switchgear = events.find((ev) => ev.id === 'ieee-pes-switchgear-committee-spring-2027');
const transformersSpring = events.find((ev) => ev.id === 'ieee-pes-transformers-committee-2027-spring');
const aupec = events.find((ev) => ev.id === 'aupec-2026');
check('verified file adds EIF, Doble 2027, and Intersolar North America', verifiedAdded.every((id) => events.some((ev) => ev.id === id)) && eif.type === 'exhibition' && eif.city === 'Antalya' && eif.start === '2026-11-05' && eif.end === '2026-11-07' && doble2027.type === 'seminar' && doble2027.series_slug === 'doble-life-of-a-transformer-seminar' && doble2027.city === 'New Orleans' && doble2027.start === '2027-01-11' && esna.type === 'exhibition' && esna.series_slug === 'intersolar-energy-storage-north-america' && esna.city === 'San Diego' && esna.start === '2027-02-09');
check('verified venues and the Switchgear meetings page win', darcy.venue === 'Online (12:00-1:00 PM EDT)' && aupec.venue === 'University of Tasmania, Sandy Bay' && meggerWorkshop.venue === 'PASS Training Centre, Potters Lane' && switchgear.official_url === 'https://ewh.ieee.org/soc/pes/switchgear/meetings/meetings.html' && switchgear.type === 'technical_committee');
check('Transformers Committee Spring 2027 is 4-8 April in Oklahoma City', transformersSpring && transformersSpring.start === '2027-04-04' && transformersSpring.end === '2027-04-08' && transformersSpring.city === 'Oklahoma City' && transformersSpring.country === 'USA' && transformersSpring.date_status === 'CONFIRMED' && !transformersSpring.venue && transformersSpring.type === 'technical_committee');
check('new event records do not store a social source', verifiedAdded.concat(['darcy-robotics-in-td-2026', 'aupec-2026', 'megger-substation-testing-workshop-2026', 'ieee-pes-switchgear-committee-spring-2027']).every((id) => {
  const ev = events.find((row) => row.id === id);
  const blob = JSON.stringify(ev);
  return ev.source_url === ev.official_url && !/linkedin\.com|reddit\.com|x\.com|twitter\.com/i.test(blob);
}));
const accessories = JSON.parse(fs.readFileSync(path.join(root, 'data/accessories.json'), 'utf8'));
const threeM = (accessories.suppliers || []).find((s) => s.name === '3M');
const veer = (accessories.suppliers || []).find((s) => s.name === 'Veer Electronics Pvt. Ltd.');
check('3M stays a neutral components listing', threeM && !/insulation/i.test(threeM.description || '') && threeM.website === '');
check('Veer Electronics is an accessory, not a manufacturer', !!veer && veer.website === 'https://www.veerelectronics.com' && !makers.some((g) => (g.makers || []).some((m) => m[0] === 'Veer Electronics Pvt. Ltd.')));
check('Hitachi Energy keeps the CWIEME Berlin booth from the official list', directory['cwieme-berlin-2026'].entries.some((entry) => entry.slug === 'hitachi-energy' && entry.booth === '27G40'));
check('alfanar at WETEX has no booth', directory['wetex-2026'].entries.some((entry) => entry.slug === 'alfanar' && !entry.booth));
const vaisala = badges.companies.find((company) => company.slug === 'vaisala-oyj');
const vaisalaParis = vaisala && vaisala.history.find((entry) => entry.event === 'cigre-paris-2026');
check('Vaisala cites the company events page', vaisalaParis && vaisalaParis.source === 'https://www.vaisala.com/en/events/events/lp/cigre-paris-session-2026');
check('CWIEME Berlin tags Hitachi Energy and leaves the GCC Hitachi separate', has('hitachi-energy', 'cwieme-berlin-2026') && !has('hitachi-energy', 'gcc-power-2025') && has('hitachi', 'gcc-power-2025'));
check('ESPI carries CWIEME Berlin and both Coiltech editions', has('espi-limited', 'cwieme-berlin-2026') && has('espi-limited', 'coiltech-2026') && has('espi-limited', 'coiltech-italia-2026'));
const heldNames = ['Transformer Manufacturers (Pty) Ltd', 'The Gund Company', 'Garware Hi-Tech Films', 'ENC Insulation'];
check('held and outreach-only names were not added', heldNames.every((name) => !makers.some((g) => (g.makers || []).some((m) => m[0] === name)) && !(accessories.suppliers || []).some((s) => s.name === name)));
check('Elin Insulation stays a single ordinary accessory', (accessories.suppliers || []).filter((s) => /elin insulation/i.test(s.name)).length === 1);
check('batch 4 files do not publish do_not_contact or a magazine source', !/do_not_contact|transformers magazine/i.test(JSON.stringify(Object.keys(batch4).map((id) => directory[id])) + JSON.stringify(badges.companies.filter((company) => /^(espi-limited|3m|meide-group|veer-electronics-pvt-ltd|vaisala-oyj)$/.test(company.slug)))));

const batch4Script = fs.readFileSync(path.join(root, 'scripts/import-event-batch-4.js'), 'utf8');
check('batch 4 LinkedIn makers are TPN-0472 to TPN-0476', ['TPN-0472', 'TPN-0473', 'TPN-0474', 'TPN-0475', 'TPN-0476'].every((id) => batch4Script.indexOf("id: '" + id + "'") >= 0) && !/id: 'TPN-037[3-7]'/.test(batch4Script));

const services = JSON.parse(fs.readFileSync(path.join(root, 'data/services.json'), 'utf8')).services;
const labsAll = labs.laboratories;
const decisions = JSON.parse(fs.readFileSync(path.join(root, 'data/event-batch-decisions.json'), 'utf8'));
const batch5 = decisions.filter((row) => /^Batch 5\./.test(row.note || ''));
check('batch 5 records 93 new listings, 4 holds, and 2 already listed', batch5.filter((row) => row.decision === 'separate').length === 93 && batch5.filter((row) => row.decision === 'held').length === 4 && batch5.filter((row) => row.decision === 'already_listed').length === 2);
function named(list, field, name) { return list.some((row) => row[field] === name); }
check('held companies stay unpublished', !named(makers.flatMap((g) => g.makers || []), 0, '3MD Energy') && !services.some((row) => row.company_name === 'Shermco Industries' || row.company_name === 'TEMISA' || row.company_name === 'EnerTrans'));
check('SGB-USA is its own US manufacturer', makers.some((g) => g.country === 'USA' && (g.makers || []).some((m) => m[0] === 'SGB-USA' && m[2] === 'https://sgbusa.com')) && !makers.some((g) => (g.makers || []).some((m) => m[0] === 'SGB-USA' && g.country !== 'USA')));
const sgbPage = fs.readFileSync(path.join(root, 'manufacturers/sgb-usa/index.html'), 'utf8');
check('SGB-USA is not merged into an SGB-SMIT profile', sgbPage.indexOf('SGB-USA') >= 0 && sgbPage.indexOf('/manufacturers/sgb-smit-group/') < 0);
const elinser = services.find((row) => row.company_name === 'ELINSER');
check('ELINSER is an ordinary service and Elin Insulation stays one accessory', !!(elinser && elinser.id === 'srv:elinser' && elinser.country === 'Spain' && !/elin insulation/i.test(elinser.description || '')) && (accessories.suppliers || []).filter((s) => /elin insulation/i.test(s.name)).length === 1);
check('Powertech Labs and VRT Power were not duplicated', labsAll.filter((row) => row.name === 'Powertech Labs').length === 1 && services.filter((row) => /VRT Power/i.test(row.company_name)).length === 1);
check('Hong Kong and Cambodia are manufacturer countries', makers.some((g) => g.country === 'Hong Kong' && g.region === 'East Asia' && (g.makers || []).some((m) => m[0] === 'I Current Transformer')) && makers.some((g) => g.country === 'Cambodia' && g.region === 'Southeast Asia' && (g.makers || []).some((m) => m[0] === 'Dhinimex')));
const fresh = services.filter((row) => /Unclaimed directory listing\./.test(row.description || '') && /Batch 5\./.test((decisions.find((d) => d.company === row.company_name) || {}).note || ''));
const shipped = JSON.stringify(fresh) + JSON.stringify(batch5);
check('batch 5 ships no outreach fields or social sources', fresh.length === 38 && !/do_not_contact|linkedin\.com|transformers magazine|"phone"|"email"/.test(shipped));
const publicCount = require('../lib/public-company-count').read(root);
check('public manufacturer count is 1011', publicCount.publicCount === 1011 && publicCount.censusRows === 1018, String(publicCount.publicCount) + '/' + publicCount.censusRows);

if (failed) {
  console.error('EVENT BATCH FAILED (' + failed + ')');
  process.exit(1);
}
console.log('EVENT BATCH OK');
