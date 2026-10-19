/* Job board rules. A live opening is a row with a specific vacancy URL, a
 * capture date, and a verification date. Those dates and the HTTP result are
 * filled by autoReview from a probe. Careers-page searches are hiring signals
 * and never count. A post expires 30 days after verification. FEATURED is a
 * labelled pin and is never set by the automatic check.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPJobBoard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var POSTING_DAYS = 30;
  var FEATURED_NOTE = 'FEATURED is promotional placement, clearly labelled. It is not an editorial recommendation and does not include a newsletter mention.';

  var MULTI_RE = [
    /multiple openings/i,
    /multiple positions/i,
    /multiple roles/i,
    /various roles/i,
    /various positions/i,
    /several positions/i,
    /several roles/i,
    /staffing blast/i,
    /\b\d+\s*\+?\s*(openings|positions|roles)\b/i,
    /positions available/i,
    /roles available/i,
    /we are hiring for the following/i
  ];

  function isoDay(now) {
    if (typeof now === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(now)) return now;
    var t = now == null ? Date.now() : (now instanceof Date ? now.getTime() : new Date(now).getTime());
    if (Number.isNaN(t)) return '';
    return new Date(t).toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    var t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + days * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }

  function isIsoDate(value) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    return isoDay(value) === String(value);
  }

  function isSpecificVacancyUrl(url) {
    var u;
    try { u = new URL(String(url || '').trim()); }
    catch (e) { return false; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    var host = u.hostname.toLowerCase();
    var path = u.pathname.replace(/\/+$/, '').toLowerCase();
    var search = u.search.toLowerCase();
    if (/[?&](keywords|keyword|search|query|q)=/.test(search)) return false;
    if (host.indexOf('linkedin.com') !== -1 && (path.indexOf('/jobs/search') !== -1 || /\/jobs\/[^/]*jobs\/?$/.test(path))) return false;
    if (host.indexOf('bayt.com') !== -1 && path.indexOf('/jobs/') !== -1) return false;
    if (path === '' || /\/(jobs|careers|open-jobs|career|work-with-us|recruit|current-vacancies)$/.test(path)) return false;
    if (/\/(job|jobs|vacancy|opening|position)\/[^/]+/.test(path)) {
      var seg = path.split('/').filter(Boolean).pop();
      if (/^(search|jobs|careers|open-jobs)$/.test(seg)) return false;
      return true;
    }
    return /\d{4,}/.test(path);
  }

  function isOnePosition(title, description) {
    var text = String(title || '') + '\n' + String(description || '');
    if (!String(title || '').trim()) return false;
    return !MULTI_RE.some(function (re) { return re.test(text); });
  }

  function httpOk(status) {
    var n = Number(status);
    return n >= 200 && n < 400;
  }

  function expiresOn(row) {
    if (!row || !isIsoDate(row.last_verified_at)) return '';
    return addDays(row.last_verified_at, POSTING_DAYS);
  }

  function isExpired(row, now) {
    var end = expiresOn(row);
    var today = isoDay(now);
    if (!end || !today) return true;
    return today >= end;
  }

  function reviewErrors(row) {
    var errors = [];
    if (!row || row.status !== 'published') errors.push('status must be published');
    if (!row || !isSpecificVacancyUrl(row.posting_url)) errors.push('posting_url must be a specific vacancy, not a careers search');
    if (!row || !isIsoDate(row.captured_at)) errors.push('captured_at must be YYYY-MM-DD');
    if (!row || !isIsoDate(row.last_verified_at)) errors.push('last_verified_at must be YYYY-MM-DD');
    if (!row || !httpOk(row.http_status)) errors.push('http_status must be a non-error response');
    if (!row || !isIsoDate(row.http_checked_at)) errors.push('http_checked_at must be YYYY-MM-DD');
    if (!row || !isOnePosition(row.title, row.description) || row.one_position === false) errors.push('one position only');
    if (!row || !String(row.reviewer || '').trim()) errors.push('reviewer required');
    if (!row || !String(row.reviewed_at || '').trim()) errors.push('reviewed_at required');
    if (!row || !String(row.verification_evidence || '').trim()) errors.push('verification_evidence required');
    if (!row || !String(row.company || '').trim()) errors.push('company required');
    if (!row || !String(row.location || '').trim()) errors.push('location required');
    return errors;
  }

  function isLiveOpening(row, now) {
    if (reviewErrors(row).length) return false;
    if (isExpired(row, now)) return false;
    return true;
  }

  function publicOpenings(rows, now) {
    return (rows || []).filter(function (row) { return isLiveOpening(row, now); }).sort(function (a, b) {
      var af = a.featured === true ? 1 : 0;
      var bf = b.featured === true ? 1 : 0;
      if (af !== bf) return bf - af;
      return String(b.last_verified_at).localeCompare(String(a.last_verified_at));
    });
  }

  function liveCount(rows, now) {
    return publicOpenings(rows, now).length;
  }

  /* Hiring-signal rows are a different list. This always returns 0 so a
   * careers-page signal cannot be added into the live-openings count. */
  function signalsLiveCount() {
    return 0;
  }

  function submissionErrors(input) {
    var errors = [];
    var row = input || {};
    if (!String(row.title || '').trim()) errors.push('title required');
    if (!String(row.company || '').trim()) errors.push('company required');
    if (!String(row.location || '').trim()) errors.push('location required');
    if (!String(row.function || '').trim()) errors.push('function required');
    if (!String(row.description || '').trim()) errors.push('description required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email || ''))) errors.push('email required');
    if (!isSpecificVacancyUrl(row.apply_url || row.posting_url)) errors.push('apply URL must be one specific vacancy, not a careers search');
    if (!isOnePosition(row.title, row.description) || row.one_position === false) errors.push('one position only');
    return errors;
  }

  function unique(list) {
    var out = [];
    (list || []).forEach(function (item) {
      if (item && out.indexOf(item) === -1) out.push(item);
    });
    return out;
  }

  /* Fill the review fields from a probe. featured stays false. The employer
   * email is not copied onto the row. A missing probe or a non-2xx/3xx
   * response fails closed. */
  function autoReview(input, probe, now) {
    var src = input || {};
    var errors = submissionErrors(src);
    if (errors.length) return { accepted: false, live: false, errors: errors, row: null, record: null };
    var url = String(src.apply_url || src.posting_url || '').trim();
    var day = isoDay(now);
    var when = now == null ? new Date() : (now instanceof Date ? now : new Date(now));
    var reviewedAt = Number.isNaN(when.getTime()) ? '' : when.toISOString();
    var status = probe && probe.status;
    var finalUrl = probe && probe.final_url ? String(probe.final_url).trim() : '';
    if (!probe || probe.ok !== true) errors.push(probe && probe.error ? probe.error : 'vacancy URL could not be checked');
    if (finalUrl && !isSpecificVacancyUrl(finalUrl)) errors.push('the vacancy URL redirected to a page that is not one opening');
    if (!day) errors.push('captured_at must be YYYY-MM-DD');
    var record = {
      status: 'published',
      title: String(src.title || '').trim(),
      company: String(src.company || '').trim(),
      location: String(src.location || '').trim(),
      function: String(src.function || '').trim(),
      description: String(src.description || '').trim(),
      posting_url: finalUrl && isSpecificVacancyUrl(finalUrl) ? finalUrl : url,
      captured_at: day,
      last_verified_at: day,
      http_status: status == null || status === '' ? '' : Number(status),
      http_checked_at: day,
      one_position: true,
      reviewer: 'auto',
      reviewed_at: reviewedAt,
      verification_evidence: 'GET ' + (finalUrl || url) + ' returned ' + (status == null || status === '' ? 'no response' : status) + ' on ' + day,
      featured: false
    };
    reviewErrors(record).forEach(function (item) {
      if (errors.indexOf(item) === -1) errors.push(item);
    });
    errors = unique(errors);
    var live = errors.length === 0 && isLiveOpening(record, now == null ? day : now);
    return {
      accepted: live,
      live: live,
      errors: live ? [] : errors,
      row: live ? displayRow(record) : null,
      record: live ? record : null
    };
  }

  function displayRow(row) {
    return {
      t: row.title,
      co: row.company,
      loc: row.location,
      fn: row.function || '',
      posting_url: row.posting_url,
      captured_at: row.captured_at,
      last_verified_at: row.last_verified_at,
      featured: row.featured === true,
      featured_note: row.featured === true ? FEATURED_NOTE : ''
    };
  }

  return {
    POSTING_DAYS: POSTING_DAYS,
    FEATURED_NOTE: FEATURED_NOTE,
    isoDay: isoDay,
    addDays: addDays,
    isIsoDate: isIsoDate,
    isSpecificVacancyUrl: isSpecificVacancyUrl,
    isOnePosition: isOnePosition,
    httpOk: httpOk,
    expiresOn: expiresOn,
    isExpired: isExpired,
    reviewErrors: reviewErrors,
    isLiveOpening: isLiveOpening,
    publicOpenings: publicOpenings,
    liveCount: liveCount,
    signalsLiveCount: signalsLiveCount,
    submissionErrors: submissionErrors,
    autoReview: autoReview,
    displayRow: displayRow
  };
});
