'use strict';
/* Award vs procurement-plan / framework / MoU.
 *
 * An award record is a contract result. A procurement plan, an invitation to
 * bid, a memorandum of understanding, or a framework announcement is not an
 * award, even when the headline mentions tenders or a later award that is
 * still expected.
 *
 * The source text used here is the text already stored on the record (title,
 * snippet, source label, award basis, URLs). Nothing is inferred beyond that.
 */

const AWARD_LANGUAGE = /award|wins?\b|\bwon\b|contract|\bsigned\b|\bsigns\b|\bsigning\b|sign-|selected|secures|secured|adjudic|arremat|split among|firma-contrato|picks-|granted|to-deliver|deliver-|mega-order|realisation-agreement|中标/i;

function evidenceText(record) {
  if (!record) return '';
  const urls = Array.isArray(record.source_urls) ? record.source_urls : [];
  return [
    record.title,
    record.full_title,
    record.source,
    record.src_label,
    record.snippet,
    record.award_basis,
  ].concat(urls).filter(Boolean).join('\n');
}

/* Returns procurement_plan, framework, mou, or null.
 * A null result means this text is not, by itself, one of those announcements. */
function nonAwardKind(text, title) {
  const body = String(text || '');
  const heading = String(title || body.split('\n')[0] || '');
  if (/\bmemorand(?:um|a) of understanding\b|\bMoUs?\b/.test(heading)) return 'mou';
  if (/\bframework\b/i.test(heading)) return 'framework';
  if (/\bplan\s*:\s*\d+\s+tenders\b/i.test(heading)) return 'procurement_plan';
  if (/\bprocurement (?:programme|program|plan)\b/i.test(body) && /\bawards?\s+expected\b/i.test(body)) return 'procurement_plan';
  return null;
}

function awardeeFromTitle(title) {
  const t = String(title || '').trim();
  let m = t.match(/^(.+?)\s*:\s*.*\bwins?\b/i);
  if (m && !/\btender\b/i.test(m[1])) return m[1].trim();
  m = t.match(/^(.+?)\s+wins?\b/i);
  if (m) return m[1].trim();
  m = t.match(/[—–]\s*([A-Za-z][^—–]{1,60}?)\s+leads\b/);
  if (m) return m[1].trim();
  return '';
}

function awardeeOf(record) {
  if (!record) return '';
  const named = [record.awardee, record.epc, record.utility, record.buyer]
    .map(function (s) { return String(s || '').trim(); })
    .filter(Boolean);
  return named[0] || '';
}

function recordKind(record) {
  if (!record) return null;
  const explicit = String(record.record_kind || record.stage || record.status || '').toLowerCase();
  if (explicit === 'procurement_plan' || explicit === 'procurement-plan') return 'procurement_plan';
  if (explicit === 'framework') return 'framework';
  if (explicit === 'mou') return 'mou';
  return nonAwardKind(evidenceText(record));
}

function describesContractAward(record) {
  if (recordKind(record)) return false;
  return AWARD_LANGUAGE.test(evidenceText(record));
}

function validateAward(record) {
  const errors = [];
  if (!awardeeOf(record)) errors.push('missing awardee');
  if (!describesContractAward(record)) errors.push('source does not describe a contract award');
  const urls = (record && record.source_urls || []).filter(function (u) { return /^https?:\/\//.test(u); });
  if (!urls.length) errors.push('missing source url');
  return errors;
}

module.exports = {
  AWARD_LANGUAGE,
  evidenceText,
  nonAwardKind,
  awardeeFromTitle,
  awardeeOf,
  recordKind,
  describesContractAward,
  validateAward,
};
