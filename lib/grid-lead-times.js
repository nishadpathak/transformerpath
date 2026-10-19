'use strict';
/* Public lead-time grid for /lead-times/.
 *
 * A cell is filled only when a public page states a duration for that class
 * and that region. The figure text is the source's statement. A class or
 * region the sources do not split is a dash. No duration is added here.
 */
const paid = require('./paid-listings');

const CLASSES = [
  { id: 'distribution', label: 'Distribution' },
  { id: 'medium', label: 'Medium power' },
  { id: 'large', label: 'Large power / GSU' }
];

const REGIONS = [
  { id: 'us', label: 'United States' },
  { id: 'europe', label: 'Europe' },
  { id: 'apac', label: 'Asia-Pacific' },
  { id: 'me', label: 'Middle East' },
  { id: 'africa', label: 'Africa' },
  { id: 'latam', label: 'Latin America' },
  { id: 'oceania', label: 'Oceania' },
  { id: 'unsplit', label: 'Not split by region' }
];

const FIGURES = [
  {
    classId: 'distribution',
    regionId: 'us',
    text: 'Lead times for transformer orders, particularly distribution transformers, increased from 3 to 6 months in 2019 to 12 to 30 months in 2023. The same article says utility trade members reported that, between 2020 and 2022, orders which took 2 to 4 months then took 22 to 33 months.',
    sourceUrl: 'https://www.energy.gov/oe/articles/doe-and-industry-team-keep-lights-america',
    sourceLabel: 'U.S. DOE Office of Electricity',
    asOf: '22 Feb 2024',
    asOfIso: '2024-02-22'
  },
  {
    classId: 'distribution',
    regionId: 'us',
    text: 'Pad-mount distribution lead times reached about 75 weeks after receipt of order, on average, over the two quarters before the article. The article states no week count for pole-top units.',
    sourceUrl: 'https://www.woodmac.com/news/opinion/4-years-into-a-difficult-transformers-market-in-the-us-is-there-a-potential-end-in-sight/',
    sourceLabel: 'Wood Mackenzie',
    asOf: '27 Jun 2024',
    asOfIso: '2024-06-27'
  },
  {
    classId: 'large',
    regionId: 'us',
    text: 'Power and generator step-up lead times reached about 150 weeks after receipt of order, on average, over the two quarters before the article.',
    sourceUrl: 'https://www.woodmac.com/news/opinion/4-years-into-a-difficult-transformers-market-in-the-us-is-there-a-potential-end-in-sight/',
    sourceLabel: 'Wood Mackenzie',
    asOf: '27 Jun 2024',
    asOfIso: '2024-06-27'
  },
  {
    classId: 'large',
    regionId: 'us',
    text: 'For a large power transformer of 100 MVA or greater, 36-month lead times are commonly quoted and maximum lead times reach as much as 60 months.',
    sourceUrl: 'https://www.energy.gov/sites/default/files/2024-10/EXEC-2022-001242%20-%20Large%20Power%20Transformer%20Resilience%20Report%207-10-24.pdf',
    sourceLabel: 'U.S. Department of Energy',
    asOf: 'July 2024',
    asOfIso: '2024-07'
  },
  {
    classId: 'large',
    regionId: 'us',
    text: 'Generator step-up lead times eased to 143 weeks on average in the quarter the article calls Q2. The same article says the U.S. market had fallen into a deficit, with 2 to 3 year lead times for these units.',
    sourceUrl: 'https://www.woodmac.com/news/opinion/mind-the-gap-tackling-supply-chain-challenges-in-the-electric-td-sector/',
    sourceLabel: 'Wood Mackenzie',
    asOf: '15 Oct 2025',
    asOfIso: '2025-10-15'
  },
  {
    classId: 'large',
    regionId: 'europe',
    text: 'Large power transformer lead times currently range from 48 to 60 months.',
    sourceUrl: 'https://berlin.cwiemeevents.com/articles/new-normal-component-suppliers',
    sourceLabel: 'CWIEME Berlin',
    asOf: '17 Mar 2026',
    asOfIso: '2026-03-17'
  },
  {
    classId: 'large',
    regionId: 'apac',
    text: 'Large power transformer lead times average around 12 months.',
    sourceUrl: 'https://berlin.cwiemeevents.com/articles/new-normal-component-suppliers',
    sourceLabel: 'CWIEME Berlin',
    asOf: '17 Mar 2026',
    asOfIso: '2026-03-17'
  },
  {
    classId: 'large',
    regionId: 'unsplit',
    text: 'Procurement takes up to four years for large power transformers, and the survey says that wait is twice as long as in 2021.',
    sourceUrl: 'https://www.iea.org/news/rising-component-prices-and-supply-chain-pressures-are-hindering-the-development-of-transmission-grid-infrastructure',
    sourceLabel: 'International Energy Agency',
    asOf: '25 Feb 2025',
    asOfIso: '2025-02-25'
  },
  {
    classId: 'large',
    regionId: 'unsplit',
    text: 'Large substation power and generator step-up transformers have lead times ranging from 80 to 210 weeks.',
    sourceUrl: 'https://www.woodmac.com/news/opinion/supply-shortages-and-an-inflexible-market-give-rise-to-high-power-transformer-lead-times/',
    sourceLabel: 'Wood Mackenzie',
    asOf: '2 Apr 2024',
    asOfIso: '2024-04-02'
  }
];

const PAY_HREF = paid.VERIFIED_MANUFACTURER_PAYMENT_LINK;

function figuresFor(classId, regionId) {
  return FIGURES.filter(function (row) {
    return row.classId === classId && row.regionId === regionId;
  });
}

function cells() {
  const out = [];
  CLASSES.forEach(function (klass) {
    REGIONS.forEach(function (region) {
      const figures = figuresFor(klass.id, region.id);
      out.push({
        classId: klass.id,
        classLabel: klass.label,
        regionId: region.id,
        regionLabel: region.label,
        figures: figures,
        sourced: figures.length > 0
      });
    });
  });
  return out;
}

function counts() {
  const all = cells();
  const sourced = all.filter(function (cell) { return cell.sourced; }).length;
  return { cells: all.length, sourced: sourced, dashed: all.length - sourced };
}

function pageDay() {
  let day = null;
  FIGURES.forEach(function (row) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.asOfIso)) return;
    if (!day || row.asOfIso > day) day = row.asOfIso;
  });
  return day;
}

module.exports = {
  CLASSES: CLASSES,
  REGIONS: REGIONS,
  FIGURES: FIGURES,
  PAY_HREF: PAY_HREF,
  figuresFor: figuresFor,
  cells: cells,
  counts: counts,
  pageDay: pageDay
};
