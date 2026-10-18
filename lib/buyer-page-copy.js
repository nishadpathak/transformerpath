/* Titles and descriptions for /buy-early/ and /spare-capacity/.
 * Lengths are the JavaScript counts check-seo.js uses.
 * Titles sit in 50–60 with the brand kept whole.
 * Descriptions sit in 140–160 as complete sentences.
 */
'use strict';

const TITLES = {
  'buy-early/index.html': 'Free guide: buying long-lead transformers | TransformerPath',
  'spare-capacity/index.html': 'Mid-tier transformer manufacturers list | TransformerPath'
};

const DESCRIPTIONS = {
  'buy-early/index.html': 'Guide to buying long-lead transformers early: drivers, timelines by size, spec freezes, reserved slots, and alternatives. Each figure links to a public source.',
  'spare-capacity/index.html': 'Mid-tier manufacturers from the directory. Filter by region, country, and voltage rating. Capacity notes need a public dated source. Every other cell is a dash.'
};

const PROFILE_CROSSLINK = '<p data-tp-spare-capacity="1" style="font-size:.9rem">Listed on the <a href="/spare-capacity/" style="color:var(--accent)">mid-tier manufacturer list</a>. Long-lead ordering is covered in the <a href="/buy-early/" style="color:var(--accent)">free buying guide</a>.</p>';

function assertWindows() {
  Object.keys(TITLES).forEach(function (rel) {
    const title = TITLES[rel];
    const description = DESCRIPTIONS[rel];
    if (title.length < 50 || title.length > 60) {
      throw new Error(rel + ' title length ' + title.length);
    }
    if (description.length < 140 || description.length > 160) {
      throw new Error(rel + ' description length ' + description.length);
    }
  });
}

module.exports = {
  TITLES: TITLES,
  DESCRIPTIONS: DESCRIPTIONS,
  PROFILE_CROSSLINK: PROFILE_CROSSLINK,
  assertWindows: assertWindows
};
