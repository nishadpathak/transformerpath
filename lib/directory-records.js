#!/usr/bin/env node
/* lib/directory-records.js — one loader for the public directory datasets.
 *
 * Manufacturers, buyers, utilities (grids), services, logistics, laboratories
 * and machinery. Used by tests/check-directories.js. Does not mutate data.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolveCountry } = require('./country-codes');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function coreName(s) {
  let n = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  n = n.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  n = n.replace(/\bs p a\b/g, ' ').replace(/\bl l c\b/g, ' ').replace(/\bp t e\b/g, ' ');
  let prev;
  do {
    prev = n;
    n = n.replace(/\b(incorporated|inc|llc|ltd|limited|gmbh|ag|sas|spa|plc|bv|nv|kft|oy|ab|pte|pvt|corp|corporation|co|company|holding|group)\b/g, ' ');
    n = n.replace(/\s+/g, ' ').trim();
  } while (n !== prev);
  return n;
}

function compactName(s) {
  return coreName(s).replace(/\s+/g, '');
}

function hostOf(url) {
  try {
    return new URL(String(url).trim()).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

function blank(v) {
  return !String(v == null ? '' : v).trim();
}

function loadDirectories() {
  const manufacturers = [];
  read('data/manufacturers.json').forEach(function (g) {
    (g.makers || []).forEach(function (x) {
      if (/^Served by/i.test(x[0] || '')) return;
      manufacturers.push({
        directory: 'manufacturers',
        id: '',
        name: x[0] || '',
        country: g.country || '',
        city: x[1] || '',
        website: x[2] || '',
        extra: { types: x[3] || '' }
      });
    });
  });

  const buyers = (read('data/buyers.json').buyers || []).map(function (b) {
    return {
      directory: 'buyers', id: b.id || '', name: b.organization_name || '',
      country: b.country || '', city: b.city || '', website: b.website || '',
      extra: { buyer_type: b.buyer_type || '' }
    };
  });

  const utilities = [];
  read('data/grids.json').forEach(function (g) {
    (g.grids || []).forEach(function (x) {
      utilities.push({
        directory: 'utilities', id: '', name: x[0] || '', country: g.country || '',
        city: '', website: x[3] || '', extra: { voltage: x[2] || '', description: x[1] || '' }
      });
    });
  });

  const services = (read('data/services.json').services || []).map(function (s) {
    return {
      directory: 'services', id: s.id || '', name: s.company_name || '',
      country: s.country || '', city: s.city || '', website: s.website || '', extra: {}
    };
  });

  const logistics = (read('data/logistics.json').companies || []).map(function (s) {
    return {
      directory: 'logistics', id: s.id || '', name: s.company_name || '',
      country: s.country || '', city: s.city || '', website: s.website || '', extra: {}
    };
  });

  const laboratories = (read('data/laboratories.json').laboratories || []).map(function (s) {
    return {
      directory: 'laboratories', id: s.id || '', name: s.name || '',
      country: s.country || '', city: s.city || '', website: s.website || '', extra: {}
    };
  });

  const machinery = (read('data/machinery.json').machinery || []).map(function (s) {
    return {
      directory: 'machinery', id: s.id || '', name: s.name || '',
      country: s.country || '', city: s.city || '', website: s.website || '',
      extra: { manufacturer: s.manufacturer || '' }
    };
  });

  return { manufacturers, buyers, utilities, services, logistics, laboratories, machinery };
}

/* Required on every row. city/website may be blank only when the integrity
 * ledger labels that field (unknown, cleared, dead). Utilities have no city. */
const REQUIRED = {
  manufacturers: ['name', 'country', 'city', 'website', 'types'],
  buyers: ['name', 'country', 'city', 'website', 'buyer_type'],
  utilities: ['name', 'country', 'website', 'voltage'],
  services: ['name', 'country', 'city', 'website'],
  logistics: ['name', 'country', 'city', 'website'],
  laboratories: ['name', 'country', 'city', 'website'],
  machinery: ['name', 'country', 'city', 'website', 'manufacturer']
};

function fieldValue(row, field) {
  if (field === 'types' || field === 'buyer_type' || field === 'voltage' || field === 'manufacturer') {
    return row.extra[field];
  }
  return row[field];
}

function findDuplicates(rows) {
  const issues = [];
  const byCompact = {};
  const byId = {};
  rows.forEach(function (row) {
    const key = compactName(row.name);
    if (key) (byCompact[key] = byCompact[key] || []).push(row);
    if (row.id) (byId[row.id] = byId[row.id] || []).push(row);
  });
  Object.keys(byId).forEach(function (id) {
    if (byId[id].length > 1) {
      issues.push({ type: 'duplicate-id', id: id, names: byId[id].map(function (r) { return r.name; }) });
    }
  });
  Object.keys(byCompact).forEach(function (key) {
    if (byCompact[key].length > 1) {
      issues.push({
        type: 'duplicate-name',
        key: key,
        names: byCompact[key].map(function (r) { return r.country + ': ' + r.name; })
      });
    }
  });
  const byHostCountry = {};
  rows.forEach(function (row) {
    const host = hostOf(row.website);
    if (!host) return;
    const country = resolveCountry(row.country);
    const ck = host + '|' + (country.iso || country.name || '');
    (byHostCountry[ck] = byHostCountry[ck] || []).push(row);
  });
  Object.keys(byHostCountry).forEach(function (ck) {
    const list = byHostCountry[ck];
    if (list.length < 2) return;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = coreName(list[i].name);
        const b = coreName(list[j].name);
        if (!a || !b || a === b) continue; // equal names already reported
        const prefix = (a.length < b.length && b.indexOf(a + ' ') === 0) ||
          (b.length < a.length && a.indexOf(b + ' ') === 0);
        if (prefix) {
          issues.push({
            type: 'duplicate-host-prefix',
            host: ck.split('|')[0],
            names: [list[i].name, list[j].name]
          });
        }
      }
    }
  });
  return issues;
}

module.exports = {
  REQUIRED,
  coreName,
  compactName,
  hostOf,
  blank,
  fieldValue,
  loadDirectories,
  findDuplicates
};
