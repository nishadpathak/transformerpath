/* Internal outreach flags stay in source JSON and must not be rendered. */
'use strict';

const INTERNAL = [
  'never_contact',
  'do_not_contact',
  'outreach_flags',
  'flags',
  'no_email_outreach',
  'directory_publish',
  'publish_at_slug',
  'contact_flag'
];

const GCC = {
  'united arab emirates': 1,
  uae: 1,
  'u.a.e.': 1,
  'saudi arabia': 1,
  ksa: 1,
  'kingdom of saudi arabia': 1,
  oman: 1,
  qatar: 1,
  bahrain: 1,
  kuwait: 1
};

function publicCountry(country) {
  const name = String(country || '').trim().toLowerCase();
  if (GCC[name]) return 'GCC';
  return String(country || '').trim();
}

function scrubPublic(text) {
  return String(text || '')
    .replace(/United Arab Emirates/gi, 'GCC')
    .replace(/\bU\.A\.E\.?\b/g, 'GCC')
    .replace(/\bUAE\b/g, 'GCC')
    .replace(/\bDubai\b/gi, 'GCC')
    .replace(/\bGCC(?:\s*,\s*GCC)+\b/g, 'GCC')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\+\d[\d\s().-]{6,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

function publicCopy(row) {
  const copy = Object.assign({}, row || {});
  const gcc = publicCountry(row && row.country) === 'GCC' ||
    (Array.isArray(row && row.countries) && row.countries.some(function (c) { return publicCountry(c) === 'GCC'; }));
  INTERNAL.forEach(function (key) { delete copy[key]; });
  if (copy.country) copy.country = publicCountry(copy.country);
  if (Array.isArray(copy.countries)) copy.countries = copy.countries.map(publicCountry);
  if (gcc) {
    ['description', 'state', 'city', 'state_province', 'locations', 'category', 'products'].forEach(function (key) {
      if (typeof copy[key] === 'string') copy[key] = scrubPublic(copy[key]);
    });
    if (copy.country === 'GCC') {
      copy.state = '';
      copy.city = '';
      copy.state_province = '';
    }
  }
  return copy;
}

function leaked(text) {
  return /do_not_contact|never_contact|no_email_outreach|outreach_flags/i.test(String(text || ''));
}

function leakedPlace(text) {
  return /\bDubai\b|United Arab Emirates|\bUAE\b/i.test(String(text || ''));
}

module.exports = {
  INTERNAL: INTERNAL,
  GCC: GCC,
  publicCountry: publicCountry,
  scrubPublic: scrubPublic,
  publicCopy: publicCopy,
  leaked: leaked,
  leakedPlace: leakedPlace
};
