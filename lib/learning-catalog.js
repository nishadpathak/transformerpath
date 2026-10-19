/* Public Design Engineer Track sections a person can mark complete.
 * Level 1 sections are the checkboxes on engineer-track.html.
 * Levels 2–4 are named on that page, and their section lists are not
 * published there, so they have no sections and cannot be completed.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TPLearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LEVELS = [
    {
      id: 'level1',
      title: 'Foundations',
      sections: [
        { id: 'l1m1', title: 'How a transformer works' },
        { id: 'l1m2', title: 'Classification & specification' },
        { id: 'l1m3', title: 'Core design & CRGO' },
        { id: 'l1m4', title: 'Windings & current density' },
        { id: 'l1m5', title: 'Insulation system' },
        { id: 'l1m6', title: 'Cooling & temperature rise' },
        { id: 'l1m7', title: 'Losses, impedance & efficiency' },
        { id: 'l1m8', title: 'Tank & accessories' }
      ]
    },
    { id: 'level2', title: 'Distribution Transformer Designer', sections: [] },
    { id: 'level3', title: 'Power Transformer Designer', sections: [] },
    { id: 'level4', title: 'Specials & Mastery', sections: [] }
  ];

  function sectionById(sectionId) {
    for (var i = 0; i < LEVELS.length; i++) {
      var sections = LEVELS[i].sections;
      for (var j = 0; j < sections.length; j++) {
        if (sections[j].id === sectionId) {
          return { levelId: LEVELS[i].id, id: sections[j].id, title: sections[j].title };
        }
      }
    }
    return null;
  }

  function allowed(levelId, sectionId) {
    var found = sectionById(sectionId);
    return !!(found && found.levelId === levelId);
  }

  /* rows are { level_id, section_id, completed_at } from the signed-in user. */
  function summarize(rows) {
    var done = {};
    (rows || []).forEach(function (row) {
      if (!row || !allowed(row.level_id, row.section_id)) return;
      done[row.level_id + ':' + row.section_id] = row.completed_at || true;
    });
    return LEVELS.map(function (level) {
      var sections = level.sections.map(function (section) {
        var at = done[level.id + ':' + section.id];
        return { id: section.id, title: section.title, completed: !!at, completed_at: at && at !== true ? at : null };
      });
      var completedCount = sections.filter(function (section) { return section.completed; }).length;
      var levelComplete = level.sections.length > 0 && completedCount === level.sections.length;
      return {
        id: level.id,
        title: level.title,
        published: level.sections.length > 0,
        sections: sections,
        completedCount: completedCount,
        sectionCount: level.sections.length,
        levelComplete: levelComplete
      };
    });
  }

  return {
    LEVELS: LEVELS,
    sectionById: sectionById,
    allowed: allowed,
    summarize: summarize
  };
});
