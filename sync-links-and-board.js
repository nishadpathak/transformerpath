/**
 * sync-links-and-board.js
 * 1. Synchronizes manufacturers.html static board with canonical data/manufacturers.json.
 * 2. Rewrites stale/aliased links across all HTML files so check-links.js passes 100%.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MANUF = JSON.parse(fs.readFileSync('data/manufacturers.json', 'utf8'));

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/&/g, 'and').replace(/['’´]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Canonical slug mappings for merged / normalized companies
const SLUG_MAP = {
  'astor-enerji': 'astor-enerji-a-s',
  'bambang-djaja-bandd-transformer': 'pt-bambang-djaja',
  'ganz-transformers-and-electric-rotating-machines-3': 'ganz-transformers-and-electric-rotating-machines',
  'hammond-power-solutions-americas': 'hammond-power-solutions',
  'imefy': 'imefy-spain',
  'kp-electric': 'kp-electric-co-ltd',
  'sunten-electric': 'sunten-electric-co-ltd'
};

// 1. Rebuild manufacturers.html SSR board
function rebuildManufacturersBoard() {
  const file = 'manufacturers.html';
  let html = fs.readFileSync(file, 'utf8');

  const byRegion = {};
  MANUF.forEach(cGroup => {
    const r = cGroup.region || 'Other';
    const c = cGroup.country || 'Other';
    const flag = cGroup.flag || '';
    if (!byRegion[r]) byRegion[r] = {};
    if (!byRegion[r][c]) byRegion[r][c] = { flag, makers: [] };

    (cGroup.makers || []).forEach(m => {
      const name = m[0];
      const city = m[1] || '';
      const website = m[2] || '';
      const typesStr = m[3] || '';
      const types = typesStr.split(',').map(s => s.trim()).filter(Boolean);
      const slug = slugify(name);
      byRegion[r][c].makers.push({ name, city, website, types, slug });
    });
  });

  const REGION_ORDER = ['North America', 'Latin America', 'Europe', 'Middle East', 'Africa', 'Asia', 'Oceania', 'Eurasia'];

  let boardHtml = '';
  REGION_ORDER.forEach(r => {
    if (!byRegion[r]) return;
    boardHtml += `<div class="region-h">${r}</div>`;
    const countries = Object.keys(byRegion[r]).sort();
    countries.forEach(c => {
      const cData = byRegion[r][c];
      const list = cData.makers;
      boardHtml += `<div class="ctry-card"><div class="ctry-head"><span class="flag">${cData.flag}</span><h3>${c}</h3><span class="cnt">${list.length} makers</span></div>`;
      list.forEach(m => {
        const types = m.types.map(t => {
          let cls = 't-TX';
          let lbl = t;
          if (t === 'PT') { cls = 't-PT'; lbl = 'Power'; }
          else if (t === 'DT') { cls = 't-DT'; lbl = 'Distribution'; }
          else if (t === 'DRY') { cls = 't-DRY'; lbl = 'Dry/Cast'; }
          return `<span class="tpill ${cls}">${lbl}</span>`;
        }).join('');
        const siteLink = m.website ? `<a href="${m.website}" target="_blank" rel="noopener">Site →</a>` : '';
        boardHtml += `<div class="mk-row"><a class="prof" href="manufacturers/${m.slug}/" style="color:var(--accent);font-weight:700">${m.name}</a>${types}<span class="city">${m.city}</span>${siteLink}</div>`;
      });
      boardHtml += `</div>`;
    });
  });

  const startMarker = '<!--SSR:mfg-board-->';
  const endMarker = '<!--/SSR:mfg-board-->';
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    html = html.slice(0, startIdx + startMarker.length) + '\n' + boardHtml + '\n' + html.slice(endIdx);
    fs.writeFileSync(file, html, 'utf8');
    console.log('✓ Rebuilt manufacturers.html SSR board');
  }
}

// 2. Fix broken links across all HTML files
function fixBrokenLinks() {
  function walk(dir, out = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (e.name.endsWith('.html')) out.push(full);
    }
    return out;
  }

  const allHtmlFiles = walk('.');
  let fixCount = 0;

  allHtmlFiles.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let changed = false;

    Object.keys(SLUG_MAP).forEach(oldSlug => {
      const newSlug = SLUG_MAP[oldSlug];
      if (newSlug) {
        const re = new RegExp(`/manufacturers/${oldSlug}/`, 'g');
        if (re.test(content)) {
          content = content.replace(re, `/manufacturers/${newSlug}/`);
          changed = true;
        }
        const reRel = new RegExp(`(\\.\\./)+manufacturers/${oldSlug}/`, 'g');
        if (reRel.test(content)) {
          content = content.replace(reRel, (match, p1) => `${p1}manufacturers/${newSlug}/`);
          changed = true;
        }
      }
    });

    if (changed) {
      fs.writeFileSync(f, content, 'utf8');
      fixCount++;
    }
  });

  console.log(`✓ Fixed broken slug references across ${fixCount} HTML files`);
}

rebuildManufacturersBoard();
fixBrokenLinks();
