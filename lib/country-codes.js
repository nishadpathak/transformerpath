#!/usr/bin/env node
/* lib/country-codes.js — ISO 3166-1 alpha-2 for directory country labels.
 *
 * Census and grid files store names ("USA", "United States", "Türkiye"), not
 * codes. Resolution goes through data/country-centroids.json aliases, then this
 * map. A name that does not resolve is a data error. Central America (SIEPAC)
 * is a regional grid, not a country, and resolves to regional: true, iso: null.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ISO = {
  Afghanistan: 'AF', Albania: 'AL', Algeria: 'DZ', Angola: 'AO', Argentina: 'AR',
  Armenia: 'AM', Australia: 'AU', Austria: 'AT', Azerbaijan: 'AZ', Bahamas: 'BS',
  Bahrain: 'BH', Bangladesh: 'BD', Belarus: 'BY', Belgium: 'BE', Benin: 'BJ',
  Bhutan: 'BT', Bolivia: 'BO', 'Bosnia & Herzegovina': 'BA', Botswana: 'BW',
  Brazil: 'BR', Brunei: 'BN', Bulgaria: 'BG', 'Burkina Faso': 'BF', Cambodia: 'KH',
  Cameroon: 'CM', Canada: 'CA', Chile: 'CL', China: 'CN', Colombia: 'CO',
  Croatia: 'HR', Cuba: 'CU', Cyprus: 'CY', Czechia: 'CZ', "Côte d'Ivoire": 'CI',
  'DR Congo': 'CD', Denmark: 'DK', Djibouti: 'DJ', 'Dominican Republic': 'DO',
  Ecuador: 'EC', Egypt: 'EG', Estonia: 'EE', Eswatini: 'SZ', Ethiopia: 'ET',
  Fiji: 'FJ', Finland: 'FI', France: 'FR', Georgia: 'GE', Germany: 'DE',
  Ghana: 'GH', Greece: 'GR', Guatemala: 'GT', Guinea: 'GN', Guyana: 'GY',
  'Hong Kong': 'HK', Hungary: 'HU', Iceland: 'IS', India: 'IN', Indonesia: 'ID',
  Iran: 'IR', Iraq: 'IQ', Ireland: 'IE', Israel: 'IL', Italy: 'IT', Jamaica: 'JM',
  Japan: 'JP', Jordan: 'JO', Kazakhstan: 'KZ', Kenya: 'KE', Kosovo: 'XK',
  Kuwait: 'KW', Kyrgyzstan: 'KG', Laos: 'LA', Latvia: 'LV', Lebanon: 'LB',
  Lesotho: 'LS', Libya: 'LY', Lithuania: 'LT', Luxembourg: 'LU', Macau: 'MO',
  Madagascar: 'MG', Malawi: 'MW', Malaysia: 'MY', Maldives: 'MV', Mali: 'ML',
  Malta: 'MT', Mauritania: 'MR', Mauritius: 'MU', Mexico: 'MX', Moldova: 'MD',
  Mongolia: 'MN', Montenegro: 'ME', Morocco: 'MA', Mozambique: 'MZ', Myanmar: 'MM',
  Namibia: 'NA', Nepal: 'NP', Netherlands: 'NL', 'New Zealand': 'NZ', Niger: 'NE',
  Nigeria: 'NG', 'North Macedonia': 'MK', Norway: 'NO', Oman: 'OM', Pakistan: 'PK',
  Panama: 'PA', 'Papua New Guinea': 'PG', Paraguay: 'PY', Peru: 'PE',
  Philippines: 'PH', Poland: 'PL', Portugal: 'PT', 'Puerto Rico': 'PR', Qatar: 'QA',
  Romania: 'RO', Russia: 'RU', Rwanda: 'RW', 'Saudi Arabia': 'SA', Senegal: 'SN',
  Serbia: 'RS', Singapore: 'SG', Slovakia: 'SK', Slovenia: 'SI', 'South Africa': 'ZA',
  'South Korea': 'KR', Spain: 'ES', 'Sri Lanka': 'LK', Sudan: 'SD', Suriname: 'SR',
  Sweden: 'SE', Switzerland: 'CH', Syria: 'SY', Taiwan: 'TW', Tajikistan: 'TJ',
  Tanzania: 'TZ', Thailand: 'TH', 'Timor-Leste': 'TL', Togo: 'TG',
  'Trinidad & Tobago': 'TT', Tunisia: 'TN', Turkmenistan: 'TM', 'Türkiye': 'TR',
  UAE: 'AE', USA: 'US', Uganda: 'UG', Ukraine: 'UA', 'United Kingdom': 'GB',
  Uruguay: 'UY', Uzbekistan: 'UZ', Venezuela: 'VE', Vietnam: 'VN', Yemen: 'YE',
  Zambia: 'ZM', Zimbabwe: 'ZW'
};

const REGIONAL = {
  'Central America (SIEPAC)': 'Regional interconnected grid (Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica, Panama), not an ISO country'
};

let _alias = null;
function aliases() {
  if (_alias) return _alias;
  const file = path.join(__dirname, '..', 'data', 'country-centroids.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  _alias = {};
  Object.entries(data.aliases || {}).forEach(function (pair) {
    _alias[pair[0]] = pair[1];
  });
  return _alias;
}

function canonicalName(raw) {
  const name = String(raw || '').trim();
  if (!name) return '';
  if (ISO[name] || REGIONAL[name]) return name;
  const via = aliases()[name.toLowerCase()];
  if (via) return via;
  return name;
}

function resolveCountry(raw) {
  const name = String(raw || '').trim();
  if (!name) return { ok: false, reason: 'empty', name: '', iso: null };
  const canonical = canonicalName(name);
  if (REGIONAL[canonical]) {
    return { ok: true, regional: true, name: canonical, iso: null, note: REGIONAL[canonical] };
  }
  const iso = ISO[canonical];
  if (!iso) return { ok: false, reason: 'unknown', name: canonical, iso: null };
  return { ok: true, regional: false, name: canonical, iso: iso };
}

module.exports = { ISO, REGIONAL, canonicalName, resolveCountry };
