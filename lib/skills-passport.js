/* TransformerPath — Skills Passport foundation.
 *
 * Competencies with levels and how they are earned. No XP, coins, badges
 * spam or leaderboards. Levels are evidence of work done on the platform.
 */
'use strict';

const LEVELS = ['NOT STARTED', 'INTRODUCED', 'PRACTICED', 'DEMONSTRATED'];

const COMPETENCIES = [
  {
    id: 'grid-frequency',
    name: 'Grid frequency regimes',
    family: 'Grid systems',
    how: 'Complete Grid Lab scenario “50 Hz and 60 Hz worlds”.',
    scenario: 'freq-50-60',
  },
  {
    id: 'uhv-systems',
    name: 'UHV / 765 kV class systems',
    family: 'Grid systems',
    how: 'Complete Grid Lab scenario “UHV and 765 kV class”.',
    scenario: 'uhv-765',
  },
  {
    id: 'sync-areas',
    name: 'Synchronous areas',
    family: 'Grid systems',
    how: 'Complete Grid Lab scenario “Synchronous areas”.',
    scenario: 'sync-areas',
  },
  {
    id: 'transmission-class',
    name: 'Transmission voltage class',
    family: 'Grid systems',
    how: 'Complete Grid Lab scenario “400 kV class grids”.',
    scenario: 'kv-400',
  },
  {
    id: 'isolated-grids',
    name: 'Isolated and islanded grids',
    family: 'Grid systems',
    how: 'Complete Grid Lab scenario “Isolated systems”.',
    scenario: 'isolated',
  },
  {
    id: 'highest-voltage',
    name: 'Highest recorded transmission voltage',
    family: 'Grid systems',
    how: 'Complete Grid Lab scenario “Highest voltage in the census”.',
    scenario: 'highest-voltage',
  },
  {
    id: 'iec-rating',
    name: 'IEC 60076 rating fundamentals',
    family: 'Knowledge',
    how: 'Finish Masterclass fundamentals / classification, or run a design in the calculator.',
    scenario: null,
  },
  {
    id: 'vector-group',
    name: 'Vector group and clock number',
    family: 'Knowledge',
    how: 'Complete the vector-group lab or the matching masterclass chapter.',
    scenario: null,
  },
  {
    id: '3d-anatomy',
    name: 'Transformer anatomy (3D labs)',
    family: '3D Labs',
    how: 'Open the interactive 3D explorer and identify core, windings, tank and bushings.',
    scenario: null,
  },
];

function levelFromPercent(p) {
  if (!p || p <= 0) return LEVELS[0];
  if (p >= 100) return LEVELS[3];
  if (p >= 60) return LEVELS[2];
  return LEVELS[1];
}

module.exports = { LEVELS, COMPETENCIES, levelFromPercent };
