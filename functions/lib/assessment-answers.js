/* Server-only answer key for assessments.html.
 * Public catalog is data/assessments.json (options only). Never ship this
 * file to dist/ — functions/ is 404'd and not in the publish allowlist.
 */
'use strict';

const ANSWERS = {
  'line-current-100mva-132kv': 's-based-437a',
  'oltc-avr-limitation': 'tap-range-stop',
  'vector-group-ynd11': 'dyn-delta-star',
  'gsu-current-1000mva': 'hv-1443-lv-27500',
};

function grade(assessmentId, answerId) {
  const need = ANSWERS[String(assessmentId || '')];
  if (!need) return { known: false, correct: false };
  return { known: true, correct: String(answerId || '') === need };
}

module.exports = { ANSWERS, grade };
