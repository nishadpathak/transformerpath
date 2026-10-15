'use strict';
/* An intel row is not "active" once its own submission deadline has passed,
 * or when the record itself says the bid is closed. Keyword matches in the
 * headline do not override that.
 */
function closedReason(it, today) {
  if (!it) return '';
  const close = String(it.tender_close_date || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(close) && close < today) {
    return 'Submission deadline ' + close + ' has passed. Not an open tender.';
  }
  if (it.is_active === false && it.closed_reason) return String(it.closed_reason);
  return '';
}

function itemIsActive(it, today) {
  if (closedReason(it, today)) return false;
  if (it && it.is_active) return true;
  const text = ((it && it.title) || '') + ' ' + ((it && it.snippet) || '');
  return /under construction|active|commissioning|tender|tenders|pipeline|awarded|wins|contract|approved|rfq/i.test(text);
}

module.exports = { closedReason, itemIsActive };
