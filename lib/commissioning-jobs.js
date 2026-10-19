/* HV and MV commissioning posts. A row is public only when the shared job
 * board rules pass and the voltage is HV or MV. Payment does not publish a row.
 */
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./job-board') : root.TPJobBoard);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TPCommissioning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (board) {
  'use strict';

  function isVoltage(value) {
    return value === 'HV' || value === 'MV';
  }

  function publicPosts(rows, now) {
    return board.publicOpenings(rows, now).filter(function (row) {
      return isVoltage(row.voltage);
    });
  }

  return {
    isVoltage: isVoltage,
    publicPosts: publicPosts
  };
});
