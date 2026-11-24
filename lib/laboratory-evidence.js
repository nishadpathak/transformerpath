'use strict';

/* Legacy records keep existing treatment. A linked, dated scope is historical
 * after its stated validity, unless a newer scope is recorded. */
function accreditationScopeState(a, asOf) {
  if (!a || !a.scope_url || !/^\d{4}-\d{2}-\d{2}$/.test(a.valid_until || '')) return '';
  return a.valid_until < (asOf || new Date().toISOString().slice(0, 10)) ? 'historical' : 'current';
}

module.exports = { accreditationScopeState };
