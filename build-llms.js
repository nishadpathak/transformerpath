#!/usr/bin/env node
/* Build /llms.txt citeable links and /llms-full.txt from pages that exist.
 *
 * Descriptions are the pages' own meta descriptions, cut to a sentence.
 * A page whose text would put a banned brand phrase into llms.txt is left
 * out of that file. Nothing here is invented.
 *
 * Run: node build-llms.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ORIGIN = 'https://transformerpath.com';
const MARK = '\n## Tenders, lead times and manufacturers by country\n';

const BANNED = [
  /\bDubai\b|\bUAE\b|United Arab Emirates|\bU\.A\.E\.?\b|\bEmirates\b/i,
  new RegExp('\\b' + 'nis' + 'had' + '\\b|' + 'pat' + 'hak', 'i'),
  /\$|\bUSD\b|\bprice\b|\bpriced\b/i,
  /\bpolsia\b/i,
  /\bowners?\b/i,
  /\bfreelance\b|\blicen[cs]e\b/i,
  /\bAME\b|\bChirab\b|ElinTS/i
];

function decode(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function collapse(s) {
  return decode(s).replace(/\s+/g, ' ').trim();
}

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch (e) { return ''; }
}

function meta(html) {
  const tag = html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i);
  if (!tag) return '';
  const m = tag[0].match(/\bcontent=["']([^"']*)["']/i);
  return collapse(m ? m[1] : '');
}

function titleText(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return collapse(m ? m[1].replace(/<[^>]+>/g, ' ') : '').replace(/\s*\|\s*TransformerPath\s*$/i, '');
}

function sentence(text, max) {
  let s = collapse(text);
  if (!s) return '';
  const end = s.search(/[.!?](\s|$)/);
  if (end !== -1 && end >= 40) s = s.slice(0, end + 1).trim();
  if (s.length > max) {
    const cut = s.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    s = (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:—-]+$/g, '').trim();
    if (!/[.!?]$/.test(s)) s += '.';
  }
  return s;
}

function banned(text) {
  return BANNED.some(function (re) { return re.test(text); });
}

function abs(rel) {
  if (rel === 'index.html') return ORIGIN + '/';
  if (rel.endsWith('/index.html')) return ORIGIN + '/' + rel.slice(0, -'index.html'.length);
  return ORIGIN + '/' + rel;
}

function bullet(label, rel, html) {
  const desc = sentence(meta(html), 280);
  if (!label || !desc) return '';
  const line = '- [' + label + '](' + abs(rel) + '): ' + desc;
  return line;
}

function page(rel) {
  const html = read(rel);
  if (!html) return null;
  return { rel: rel, html: html, title: titleText(html), desc: sentence(meta(html), 280) };
}

function countryPages() {
  const dir = path.join(ROOT, 'manufacturers');
  return fs.readdirSync(dir).filter(function (name) {
    return name.endsWith('.html');
  }).sort().map(function (name) {
    return page('manufacturers/' + name);
  }).filter(function (p) {
    return p && p.desc && /manufacturers/i.test(p.title + ' ' + p.desc);
  });
}

function directoryCountries() {
  const dir = path.join(ROOT, 'directory', 'country');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(function (name) {
    return fs.existsSync(path.join(dir, name, 'index.html'));
  }).sort().map(function (name) {
    return page('directory/country/' + name + '/index.html');
  }).filter(Boolean);
}

function guides() {
  const dir = path.join(ROOT, 'guides');
  const out = [];
  const index = page('guides/index.html');
  if (index) out.push(index);
  fs.readdirSync(dir).filter(function (name) {
    return fs.existsSync(path.join(dir, name, 'index.html'));
  }).sort().forEach(function (name) {
    const p = page('guides/' + name + '/index.html');
    if (p) out.push(p);
  });
  return out;
}

function section(heading, rows) {
  const lines = rows.filter(Boolean);
  if (!lines.length) return '';
  return '## ' + heading + '\n\n' + lines.join('\n') + '\n';
}

function safeBullet(label, rel, html) {
  const desc = sentence(meta(html), 280);
  if (!label || !desc) return '';
  function lineFor(text) {
    return '- [' + label + '](' + abs(rel) + '): ' + text;
  }
  let line = lineFor(desc);
  if (!banned(line)) return line;
  // Keep the earlier clause when a later one names a place the brand file cannot.
  const cut = desc.split(/\s+and\s+/i)[0].replace(/[\s,;:—-]+$/g, '');
  if (cut && cut.length >= 40 && cut !== desc.replace(/[.!?]$/, '')) {
    const shorter = /[.!?]$/.test(cut) ? cut : cut + '.';
    line = lineFor(shorter);
    if (!banned(line)) return line;
  }
  return '';
}

function main() {
  const countries = countryPages();
  const tenders = page('tenders.html');
  const tenderCountries = page('tenders/countries.html');
  const lead = page('lead-times/index.html');
  const capacity = page('factory-capacity/index.html');
  const events = page('events.html');
  const learn = page('learn.html');
  const calc = page('calculator.html');
  const directory = page('directory.html');
  const manufacturers = page('manufacturers.html');

  const cite = [];
  cite.push(section('Tenders, lead times and manufacturers by country', []));
  const tenderLines = [
    tenders && safeBullet('Open transformer tenders', tenders.rel, tenders.html),
    tenderCountries && safeBullet('Tenders by country', tenderCountries.rel, tenderCountries.html)
  ].filter(Boolean);
  const leadLines = [
    lead && safeBullet('Grid lead times', lead.rel, lead.html),
    capacity && safeBullet('Factory capacity', capacity.rel, capacity.html)
  ].filter(Boolean);
  const countryLines = countries.map(function (p) {
    const label = p.title.replace(/\s+transformer manufacturers.*$/i, '').trim() || p.title;
    return safeBullet(label, p.rel, p.html);
  }).filter(Boolean);

  let llms = read('llms.txt');
  const at = llms.indexOf(MARK);
  if (at !== -1) llms = llms.slice(0, at);
  if (!llms.endsWith('\n')) llms += '\n';
  llms += '\n## Tenders, lead times and manufacturers by country\n\n';
  llms += tenderLines.concat(leadLines).concat(countryLines).join('\n') + '\n';
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), llms);

  function fullBullet(p, label) {
    if (!p) return '';
    return bullet(label || p.title || p.rel, p.rel, p.html);
  }
  const full = [];
  full.push('# TransformerPath\n\n> An independent global information platform for the transformer industry.\n\nExpanded map of citeable pages. Each line uses the description already published on that page.\n');
  full.push(section('Directory', [
    fullBullet(directory, 'Directory'),
    fullBullet(manufacturers, 'Manufacturers')
  ].filter(Boolean)));
  full.push(section('Directory by country', directoryCountries().map(function (p) {
    return fullBullet(p, p.title);
  })));
  full.push(section('Manufacturers by country', countries.map(function (p) {
    return fullBullet(p, p.title);
  })));
  full.push(section('Tenders', [fullBullet(tenders), fullBullet(tenderCountries)].filter(Boolean)));
  full.push(section('Lead times and factory capacity', [fullBullet(lead), fullBullet(capacity)].filter(Boolean)));
  full.push(section('Events', [fullBullet(events)].filter(Boolean)));
  full.push(section('Guides', guides().map(function (p) { return fullBullet(p, p.title); })));
  full.push(section('Learn', [fullBullet(learn)].filter(Boolean)));
  full.push(section('Calculators', [fullBullet(calc, 'Design calculator')].filter(Boolean)));
  const text = full.filter(function (block) { return block && String(block).trim(); }).join('\n').replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.join(ROOT, 'llms-full.txt'), text.endsWith('\n') ? text : text + '\n');
  console.log('llms.txt citeable links ' + (tenderLines.length + leadLines.length + countryLines.length) + ', llms-full.txt ' + (text.match(/^- \[/gm) || []).length + ' pages');
}

if (require.main === module) main();
module.exports = main;
