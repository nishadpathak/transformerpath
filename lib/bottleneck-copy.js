/* Titles and descriptions for the transformer bottleneck explainers.
 * Lengths are the JavaScript counts check-seo.js uses.
 * Titles sit in 50–60 with the brand kept whole.
 * Descriptions sit in 140–160 as complete sentences.
 */
'use strict';

const AS_OF = '2026-10-18';
const COMPILED_LABEL = '18 October 2026';

const TITLES = {
  'bottlenecks/index.html': 'Transformer supply bottlenecks explained | TransformerPath',
  'bottlenecks/grain-oriented-electrical-steel/index.html': 'GOES supply bottleneck for transformers | TransformerPath',
  'bottlenecks/copper-conductors/index.html': 'Copper and CTC bottleneck for transformers | TransformerPath',
  'bottlenecks/bushings/index.html': 'Bushing supply bottleneck for transformers | TransformerPath',
  'bottlenecks/insulation-pressboard-paper/index.html': 'Pressboard and paper bottleneck explained | TransformerPath',
  'bottlenecks/test-bay-capacity/index.html': 'Test bay and factory capacity bottleneck | TransformerPath'
};

const DESCRIPTIONS = {
  'bottlenecks/index.html': 'Five sourced explainers on grain-oriented steel, copper, bushings, pressboard and paper, and test-bay capacity. Each claim has a public source.',
  'bottlenecks/grain-oriented-electrical-steel/index.html': 'What grain-oriented electrical steel is, why it limits large power transformers, and the public figures. Each claim cites a dated public source.',
  'bottlenecks/copper-conductors/index.html': 'What continuously transposed copper is, why it limits transformer supply, and the public lead-time figures. Each claim cites a dated public source.',
  'bottlenecks/bushings/index.html': 'What a high-voltage bushing is, why long lead times constrain transformers, and the public evidence. Each claim cites a dated public source.',
  'bottlenecks/insulation-pressboard-paper/index.html': 'What cellulose pressboard and paper are, why few domestic suppliers matter, and the public evidence. Each claim cites a dated public source.',
  'bottlenecks/test-bay-capacity/index.html': 'Why shared test bays and factory build slots limit large power transformers, with the public figures. Each claim cites a dated public source.'
};

const PAGES = [
  { rel: 'bottlenecks/index.html', h1: 'Transformer supply bottlenecks', sponsor: '' },
  { rel: 'bottlenecks/grain-oriented-electrical-steel/index.html', h1: 'Grain-oriented electrical steel', sponsor: 'coresteel' },
  { rel: 'bottlenecks/copper-conductors/index.html', h1: 'Copper and conductors', sponsor: 'copper' },
  { rel: 'bottlenecks/bushings/index.html', h1: 'Bushings', sponsor: 'bushings' },
  { rel: 'bottlenecks/insulation-pressboard-paper/index.html', h1: 'Insulation pressboard and paper', sponsor: 'pressboard' },
  { rel: 'bottlenecks/test-bay-capacity/index.html', h1: 'Test bay and factory capacity', sponsor: '' }
];

function assertWindows() {
  Object.keys(TITLES).forEach(function (rel) {
    const title = TITLES[rel];
    const description = DESCRIPTIONS[rel];
    if (title.length < 50 || title.length > 60) {
      throw new Error(rel + ' title length ' + title.length + ' (' + title + ')');
    }
    if ((title.match(/TransformerPath/g) || []).length !== 1) {
      throw new Error(rel + ' title brand count');
    }
    if (description.length < 140 || description.length > 160) {
      throw new Error(rel + ' description length ' + description.length + ' (' + description + ')');
    }
  });
  const titles = {};
  const descs = {};
  Object.keys(TITLES).forEach(function (rel) {
    if (titles[TITLES[rel]]) throw new Error('duplicate title ' + rel);
    titles[TITLES[rel]] = rel;
    if (descs[DESCRIPTIONS[rel]]) throw new Error('duplicate description ' + rel);
    descs[DESCRIPTIONS[rel]] = rel;
  });
}

module.exports = {
  AS_OF: AS_OF,
  COMPILED_LABEL: COMPILED_LABEL,
  TITLES: TITLES,
  DESCRIPTIONS: DESCRIPTIONS,
  PAGES: PAGES,
  assertWindows: assertWindows
};
