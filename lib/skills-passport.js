/* TransformerPath — Skills Passport foundation.
 *
 * Canonical catalog is data/skills-passport.json (seven groups, evidence-based
 * levels). This module re-exports it for Node tests and account helpers.
 * No XP, coins, badges or leaderboards. Opening a Lab is not evidence.
 */
'use strict';

const passport = require('../data/skills-passport.json');

const LEVELS = passport.levels || ['NOT STARTED', 'Developing', 'Intermediate', 'Advanced'];
const GROUPS = passport.groups || [];
const COMPETENCIES = passport.competencies || [];

function levelFromPercent(p) {
  if (!p || p <= 0) return LEVELS[0];
  if (p >= 100) return LEVELS[LEVELS.length - 1] || 'Advanced';
  if (p >= 60) return LEVELS[LEVELS.length - 2] || 'Intermediate';
  return LEVELS[1] || 'Developing';
}

module.exports = { LEVELS, GROUPS, COMPETENCIES, levelFromPercent, passport };
