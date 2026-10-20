#!/usr/bin/env node
/* Fail when public copy identifies TransformerPath by a person, a licence,
 * an owner, or a place.
 *
 * Legal pages, the site header and footer, about, contact, the web manifest,
 * and TransformerPath's own Organization structured data are company copy.
 * A freelance licence, a trade licence, a licence holder, a personal name,
 * "owner", Dubai, the UAE, or the Emirates fails there.
 *
 * A UAE tender, a Dubai project, a market page, or a listed company stays.
 * Software licences (MIT and the like), dataset licence URLs, and notes that
 * a course or a book is licensed stay. Those do not identify the operator.
 *
 * Run: node scripts/check-company-identity.js
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const selfRel = 'scripts/check-company-identity.js';

const nameRe = new RegExp('\\b' + 'nis' + 'had' + '\\b|' + 'pat' + 'hak', 'i');
const allowRe = new RegExp(
  'https?://github\\.com/' + 'nis' + 'had' + 'pat' + 'hak' + '\\b[^\\s)\"\'<>]*',
  'gi'
);

const HARD = [
  { why: 'freelance', re: /\bfreelance(?:r|rs|d)?\b/i },
  { why: 'sole proprietor', re: /\bsole proprietors?\b/i },
  { why: 'trade licence', re: /\btrade licen[cs]es?\b/i },
  { why: 'licence holder', re: /\blicen[cs]e holders?\b/i },
  { why: 'marketing licence', re: /\b(?:digital[- ]marketing|marketing|commercial|business) licen[cs]es?\b/i },
  { why: 'personal name', re: nameRe }
];

const COMPANY = HARD.concat([
  { why: 'company place', re: /\bDubai\b|\bUAE\b|\bU\.A\.E\.?\b|United Arab Emirates|\bEmirates\b/i },
  { why: 'owner', re: /\bowners?\b/i },
  { why: 'operated under a licence', re: /\bunder (?:a |an )?(?:[a-z0-9-]+ ){0,6}licen[cs]es?\b/i }
]);

const COMPANY_PAGES = new Set([
  'privacy.html',
  'terms.html',
  'affiliate-disclosure.html',
  'about.html',
  'contact.html'
]);

const CHROME = new Set([
  '_partials/footer.html',
  '_partials/header.html',
  '_partials/header-standalone.html',
  'manifest.webmanifest',
  'llms.txt',
  'robots.txt'
]);

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor']);

const problems = [];

function relOf(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function pageOf(rel) {
  return rel.replace(/^dist\//, '');
}

function isCompanyPage(rel) {
  return COMPANY_PAGES.has(path.basename(pageOf(rel))) && pageOf(rel).indexOf('/') < 0;
}

function isChrome(rel) {
  return CHROME.has(pageOf(rel));
}

function stripAllowed(text) {
  return text.replace(allowRe, ' ');
}

function stripHidden(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function snippet(text, index) {
  const line = text.split('\n')[lineOf(text, index) - 1] || '';
  return line.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function report(rel, where, why, text, index) {
  problems.push(rel + ':' + lineOf(text, index) + ' ' + where + ' ' + why + ' — ' + snippet(text, index));
}

function collect(rules, text) {
  const found = [];
  rules.forEach(function (rule) {
    const re = new RegExp(rule.re.source, 'gi');
    let m;
    while ((m = re.exec(text))) {
      found.push({ why: rule.why, index: m.index });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  });
  return found;
}

function scan(rel, where, rules, text) {
  collect(rules, text).forEach(function (hit) {
    report(rel, where, hit.why, text, hit.index);
  });
}

function blocks(html, tag) {
  const re = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
  return html.match(re) || [];
}

function isBrandOrg(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const types = [].concat(node['@type'] || []);
  if (types.indexOf('Organization') < 0 && types.indexOf('OnlineBusiness') < 0) return false;
  const name = String(node.name || '');
  const id = String(node['@id'] || '');
  if (name === 'TransformerPath') return true;
  return /transformerpath\.com/i.test(id) && /#organization\b/.test(id);
}

function walkJson(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(function (n) { walkJson(n, visit); });
    return;
  }
  visit(node);
  Object.keys(node).forEach(function (k) {
    if (k === '@context') return;
    const v = node[k];
    if (v && typeof v === 'object') walkJson(v, visit);
  });
}

function scanBrandOrg(rel, html) {
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!/TransformerPath/.test(raw)) continue;
    let data;
    try { data = JSON.parse(raw); }
    catch (e) { continue; }
    walkJson(data, function (node) {
      if (!isBrandOrg(node)) return;
      const packed = JSON.stringify(node);
      collect(COMPANY, packed).forEach(function (hit) {
        report(rel, 'Organization JSON-LD', hit.why, packed, hit.index);
      });
    });
  }
}

function scanFileText(rel, text) {
  const scrubbed = stripAllowed(text);
  if (isCompanyPage(rel)) {
    scan(rel, 'legal/company page', COMPANY, stripHidden(scrubbed));
    if (/\.html?$/i.test(rel)) scanBrandOrg(rel, text);
    return;
  }
  if (isChrome(rel)) {
    scan(rel, 'site chrome', COMPANY, scrubbed);
    return;
  }
  scan(rel, 'public copy', HARD, scrubbed);
  if (/\.html?$/i.test(rel)) {
    blocks(text, 'footer').forEach(function (block) {
      scan(rel, 'footer', COMPANY, stripHidden(block));
    });
    blocks(text, 'header').forEach(function (block) {
      scan(rel, 'header', COMPANY, stripHidden(block));
    });
    scanBrandOrg(rel, text);
  }
}

function scanFile(file) {
  const rel = relOf(file);
  if (rel === selfRel || rel === 'dist/' + selfRel) return;
  const top = rel.split('/')[0];
  if (SKIP_DIRS.has(top)) return;
  let buf;
  try { buf = fs.readFileSync(file); }
  catch (e) { return; }
  if (buf.includes(0)) return;
  scanFileText(rel, buf.toString('utf8'));
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root });
  return out.toString('utf8').split('\0').filter(Boolean);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (SKIP_DIRS.has(ent.name)) return;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  });
  return out;
}

function selfCheck() {
  const failures = [];
  function expect(cond, label) {
    if (!cond) failures.push(label);
  }
  function count(rel, text) {
    const before = problems.length;
    scanFileText(rel, text);
    const n = problems.length - before;
    problems.length = before;
    return n;
  }

  const oldPrivacy = [
    'TransformerPath is an information platform operated by a freelancer under a freelance digital-marketing licence, and is the data controller.',
    'TransformerPath is operated by the licence holder. Email privacy@transformerpath.com.'
  ].join(' ');
  expect(count('privacy.html', oldPrivacy) > 0, 'the freelance licence on the privacy page fails');

  const neutral = 'TransformerPath operates this website and is the data controller for personal data collected through it. Questions or data-requests: email hello@transformerpath.com.';
  expect(count('privacy.html', neutral) === 0, 'TransformerPath and hello@transformerpath.com pass');

  const terms = 'The record is not an accredited or licensed professional credential. Digital books are licensed for your personal, non-commercial use.';
  expect(count('terms.html', terms) === 0, 'a credential or a content licence is not the operator');

  const faq = 'These are not accredited qualifications, professional certifications, licences, or authorisations to practise engineering.';
  expect(count('faq.html', faq) === 0, 'faq professional licences are not company identity');

  expect(count('package-lock.json', '{ "license": "MIT" }') === 0, 'an MIT software licence stays');
  expect(count('directory.html', '"license": "https://transformerpath.com/terms.html"') === 0, 'a dataset licence URL stays');
  expect(count('data/note.json', 'Third-party data licence for the asset. Dataset licence: CC BY.') === 0, 'a data-licence note stays');

  const market = 'DEWA awards contracts across Dubai. United Arab Emirates tender. Emirates Water and Electricity Company (EWEC).';
  expect(count('data/intel.json', market) === 0, 'Dubai and the UAE in market data stay');
  expect(count('markets/uae/index.html', '<p>' + market + '</p><footer><p>© TransformerPath</p></footer>') === 0, 'a market page place name stays out of the footer');
  expect(count('methodology.html', '<h3>United Arab Emirates</h3><p>Dubai Electricity and Water Authority</p>') === 0, 'methodology source locations stay');
  expect(count('sitemap.xml', '<loc>https://transformerpath.com/markets/uae/</loc>') === 0, 'a sitemap market URL stays');
  expect(count('affiliate-disclosure.html', 'Examples: trip_uae_esim and event_wetex_hotel.') === 0, 'a UAE trip code is not a company place');

  expect(count('index.html', '<footer><p>Based in Dubai, UAE. Operated by the owner.</p></footer>') > 0, 'a footer place or owner fails');
  expect(count('about.html', '<script type="application/ld+json">{"@type":"Organization","name":"TransformerPath","address":{"addressLocality":"Dubai","addressCountry":"United Arab Emirates"}}</script>') > 0, 'TransformerPath Organization address fails');
  expect(count('manufacturers/beta/index.html', '<script type="application/ld+json">{"@type":"Organization","name":"Beta Transformers","address":{"addressLocality":"Dubai","addressCountry":"UAE"}}</script>') === 0, 'a listed company in Dubai stays');
  expect(count('docs/proposals/x.md', 'The owner approved the staged prices.') === 0, 'an internal owner note is not public company copy');
  expect(count('about.html', 'TransformerPath is operated by its owner.') > 0, 'an owner on the about page fails');

  const remote = 'See https://github.com/' + 'nis' + 'had' + 'pat' + 'hak' + '/transformerpath for the repo.';
  expect(count('README.md', remote) === 0, 'the github remote is not public identity copy');
  expect(count('privacy.html', 'Operated by ' + 'Nis' + 'had ' + 'Pat' + 'hak.') > 0, 'a personal name on a legal page fails');

  expect(isCompanyPage('privacy.html'), 'privacy is company copy');
  expect(!isCompanyPage('markets/uae/index.html'), 'a market page is not company copy');
  expect(isChrome('_partials/footer.html'), 'the footer partial is site chrome');

  if (failures.length) {
    console.error('company-identity self-check failed:\n  ' + failures.join('\n  '));
    process.exit(1);
  }
}

selfCheck();

trackedFiles().forEach(function (rel) { scanFile(path.join(root, rel)); });
walk(path.join(root, 'dist'), []).forEach(scanFile);

if (problems.length) {
  console.error('COMPANY IDENTITY CHECK FAILED — ' + problems.length + ' hit(s):');
  problems.slice(0, 40).forEach(function (p) { console.error('  ' + p); });
  if (problems.length > 40) console.error('  … and ' + (problems.length - 40) + ' more');
  process.exit(1);
}
console.log('company-identity check OK — legal pages, footer, and brand structured data do not identify a person, licence, owner, or place');
