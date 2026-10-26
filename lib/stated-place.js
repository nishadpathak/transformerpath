/* A census cell that is blank or only a dash is missing data.
 * Callers omit the phrase. They do not print the dash and they do not
 * substitute a city, country, or product category.
 */
'use strict';

const DASH = /^[\u2010-\u2015\-]+$/;

function statedPlace(value) {
  const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!s || DASH.test(s)) return '';
  return s;
}

function listedWhere(city, country) {
  const place = [statedPlace(city), statedPlace(country)].filter(Boolean).join(', ');
  return place ? ' in ' + place : '';
}

module.exports = { statedPlace, listedWhere };
