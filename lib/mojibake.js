/* Repair UTF-8 text that was read as Latin-1 and saved again.
 * A run is repaired only when those bytes are valid UTF-8 for a different string.
 */
'use strict';

const RUN = /(?:[\u00C2\u00C3][\u0080-\u00BF])+/g;

function repairRun(chunk) {
  const buf = Buffer.from(chunk, 'latin1');
  const decoded = buf.toString('utf8');
  if (decoded.indexOf('\uFFFD') >= 0) return chunk;
  if (!Buffer.from(decoded, 'utf8').equals(buf)) return chunk;
  return decoded;
}

function repairText(text) {
  return String(text).replace(RUN, repairRun);
}

function mojibakeRuns(text) {
  const found = [];
  String(text).replace(RUN, function (chunk) {
    if (repairRun(chunk) !== chunk) found.push(chunk);
    return chunk;
  });
  return found;
}

module.exports = { repairText: repairText, mojibakeRuns: mojibakeRuns };
