'use strict';
/* Country and deadline tokens taken only from text already on the record.
 * A bare year is not a submission deadline. A month name needs a day and a year.
 */
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function pad(n) { return String(n).padStart(2, '0'); }

/* "Bid closing 28 Oct 2026" / "bids closed 14 May 2026". No year, no date. */
function isoDateInText(text) {
  const s = String(text || '');
  const named = s.match(/\b(?:bid closing|bids closed|submission deadline|deadline|responses are due|due)\s+(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);
  if (named) {
    const mon = MONTHS[named[2].slice(0, 3).toLowerCase()];
    const day = Number(named[1]);
    if (!mon || day < 1 || day > 31) return '';
    return named[3] + '-' + pad(mon) + '-' + pad(day);
  }
  const iso = s.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso ? iso[1] : '';
}

/* Places named in the record. Dubai and DEWA are the UAE. "German" is Germany.
 * The first named place wins. Nothing is filled in when the text names none. */
function countryFromText(text) {
  const t = String(text || '');
  if (/\b(Dubai|DEWA|Abu Dhabi|United Arab Emirates|\bUAE\b)/i.test(t)) return 'United Arab Emirates';
  if (/\bIraq\b/i.test(t)) return 'Iraq';
  if (/\bGerman(?:y)?\b/i.test(t)) return 'Germany';
  const m = t.match(/\b(Saudi Arabia|Saudi|Qatar|Kuwait|Bahrain|Oman|India|China|South Korea|Korea|Japan|Turkey|Türkiye|Vietnam|Indonesia|Malaysia|United Kingdom|UK|France|Italy|Spain|Brazil|Chile|Mexico|Egypt|Kenya|Nigeria|South Africa|Australia)\b/i);
  if (!m) return '';
  const raw = m[1];
  /* "Saudi" stays the short form. Market pages already map that alias to
   * Saudi Arabia, and the corpus uses it as the assignment. */
  if (/^saudi$/i.test(raw)) return 'Saudi';
  if (/^uk$/i.test(raw)) return 'United Kingdom';
  if (/^korea$/i.test(raw)) return 'South Korea';
  return raw;
}

function usableSource(url) {
  const s = String(url || '');
  return /^https?:\/\//i.test(s) && !/example\.com|\bupd\b/i.test(s);
}

module.exports = { isoDateInText, countryFromText, usableSource };
