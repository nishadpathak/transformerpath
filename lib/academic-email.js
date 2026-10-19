/* University email check shared by tests and the workspace hint.
 * The Student badge is set in SQL with the same rules, not by this file.
 *
 * A host qualifies when:
 * - its last label is edu (mit.edu, cam.ac.uk is not this case), or
 * - the label before a two-letter country code is edu (unimelb.edu.au), or
 * - the label before a two-letter country code is ac (cam.ac.uk, wits.ac.za).
 * A name that merely contains those letters (edu.com, myac.uk.com) does not.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TPAcademicEmail = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function academicEmail(address) {
    var match = String(address || '').trim().toLowerCase().match(/^[^@\s]+@([a-z0-9.-]+)$/);
    if (!match) return false;
    var host = match[1].replace(/\.$/, '');
    if (!host || host.indexOf('..') !== -1) return false;
    var labels = host.split('.');
    if (labels.length < 2) return false;
    for (var i = 0; i < labels.length; i++) {
      if (!/^[a-z0-9-]+$/.test(labels[i])) return false;
    }
    var last = labels[labels.length - 1];
    var prev = labels[labels.length - 2];
    if (last === 'edu') return true;
    if (prev === 'edu' && /^[a-z]{2}$/.test(last)) return true;
    if (prev === 'ac' && /^[a-z]{2}$/.test(last)) return true;
    return false;
  }

  return { academicEmail: academicEmail };
});
