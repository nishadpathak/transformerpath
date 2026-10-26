/* Approved CSV Payment Links. Do not create new prices.
 * The sales page reads this list into data/csv-pay-plans.json and
 * navigates only after a click. The URLs are not anchor hrefs.
 */
'use strict';

const LINKS = {
  csv_directory: {
    url: 'https://buy.stripe.com/14AdR26C41131NC5DcfYY0r',
    amountUsd: 149,
    label: 'Directory CSV',
    button: 'Buy the Directory CSV — $149'
  },
  csv_tenders: {
    url: 'https://buy.stripe.com/14AcMY2lOfVX77W3v4fYY0s',
    amountUsd: 99,
    label: 'Tenders CSV',
    button: 'Buy the Tenders CSV — $99'
  },
  csv_awards: {
    url: 'https://buy.stripe.com/00w8wIf8A6ln2RG2r0fYY0t',
    amountUsd: 49,
    label: 'Awards CSV',
    button: 'Buy the Awards CSV — $49'
  },
  csv_bundle: {
    url: 'https://buy.stripe.com/3cI28k7G8257dwke9IfYY0u',
    amountUsd: 249,
    label: 'Bundle',
    button: 'Buy the bundle — $249'
  }
};

function productFromUrl(url) {
  const clean = String(url || '').trim().split('#')[0].split('?')[0].replace(/\/+$/, '');
  const keys = Object.keys(LINKS);
  for (let i = 0; i < keys.length; i++) {
    if (LINKS[keys[i]].url === clean) return keys[i];
  }
  return null;
}

function plansDocument() {
  const plans = {};
  Object.keys(LINKS).forEach(function (key) {
    plans[key] = LINKS[key].url;
  });
  return { plans: plans };
}

module.exports = {
  LINKS: LINKS,
  productFromUrl: productFromUrl,
  plansDocument: plansDocument
};
