#!/usr/bin/env node
/* lib/csv-exports.js — build-time CSV exports and signed-download helpers.
 *
 * Directory, tenders, and awards are written at site build time from the
 * live JSON. The full files stay off the CDN. functions/csv-download.js
 * serves a short-lived signed copy only after Stripe says the session is
 * paid. Payment Links for these products are not rendered on any page.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LICENCE = 'Licensed to a single company for its own internal use. No resale, redistribution, or sublicensing.';
const UNVERIFIED_MARK = '\u2014';
const KIND_LABELS = {
  manufacturer: 'manufacturers',
  component_supplier: 'component suppliers',
  machinery_manufacturer: 'machinery manufacturers',
  testing_laboratory: 'testing laboratories',
  service_repair: 'service and repair firms',
  transport_logistics: 'logistics firms',
  buyer_procurement: 'buyers',
  industry_association: 'associations',
  education_provider: 'education providers',
  media_publication: 'media publications'
};
const VERIFY_FAILED = "We couldn't verify this payment, contact hello@transformerpath.com";
const FILE_MISSING = 'Your payment is confirmed, but this download is not on the server yet. Contact hello@transformerpath.com';
const PREVIEW_ROWS = 10;
const TTL_MS = 15 * 60 * 1000;
const SKEW_MS = 60 * 1000;

const PRODUCTS = {
  csv_directory: { files: ['directory'], label: 'Directory CSV' },
  csv_tenders: { files: ['tenders'], label: 'Tenders CSV' },
  csv_awards: { files: ['awards'], label: 'Awards CSV' },
  csv_bundle: { files: ['directory', 'tenders', 'awards'], label: 'Directory, tenders, and awards' }
};

const FILES = {
  directory: {
    stored: 'directory.csv',
    filename: 'transformerpath-directory.csv',
    label: 'Directory',
    blurb: 'Every organisation in the live directory index. The row count includes manufacturers and other suppliers.'
  },
  tenders: {
    stored: 'tenders.csv',
    filename: 'transformerpath-tenders.csv',
    label: 'Tenders',
    blurb: 'Tenders from the live tender register.'
  },
  awards: {
    stored: 'awards.csv',
    filename: 'transformerpath-awards.csv',
    label: 'Awards',
    blurb: 'Awards from the live award register.'
  }
};

const DIRECTORY_COLUMNS = [
  'id', 'name', 'kind', 'roles', 'country', 'region', 'city', 'website',
  'profile_url', 'capability_labels', 'product_codes', 'voltage', 'mva',
  'evidence', 'claim_type', 'listing_tier', 'last_verified', 'licence'
];
const TENDER_COLUMNS = [
  'tender_id', 'title', 'full_title', 'status', 'status_label', 'country',
  'region', 'buyer', 'utility', 'epc', 'voltage', 'transformer_scope',
  'deadline', 'source', 'official_procurement_url', 'last_verified', 'licence'
];
const AWARD_COLUMNS = [
  'award_id', 'tender_id', 'title', 'awardee', 'buyer', 'utility', 'epc',
  'country', 'region', 'voltage', 'transformer_scope', 'contract_value',
  'currency', 'confidence', 'claim_type', 'award_status', 'source',
  'source_urls', 'last_verified', 'licence'
];

function repoRoot() {
  return path.join(__dirname, '..');
}

function defaultExportDir() {
  return path.join(repoRoot(), 'data', 'csv-exports');
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot(), rel), 'utf8'));
}

function csvEscape(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function joinList(value, sep) {
  if (Array.isArray(value)) {
    return value.map(function (item) { return item == null ? '' : String(item); }).filter(Boolean).join(sep || '; ');
  }
  return value == null ? '' : String(value);
}

function scalar(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.value == null ? '' : String(value.value);
  }
  return value == null ? '' : String(value);
}

function statusToken(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/[_—–-]+/g, ' ').replace(/\s+/g, ' ');
}

/* Vault rule: an INFERRED or unverified row does not display a verification date. */
function hidesLastVerified(values) {
  return (values || []).some(function (value) {
    const token = statusToken(value);
    return token === 'inferred' || token === 'unverified';
  });
}

function publicLastVerified(date, values) {
  if (hidesLastVerified(values)) return UNVERIFIED_MARK;
  return date || '';
}

function grouped(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function directoryScopeNote(rows) {
  const counts = {};
  (rows || []).forEach(function (row) {
    const kind = row.kind || 'other';
    counts[kind] = (counts[kind] || 0) + 1;
  });
  const manufacturers = counts.manufacturer || 0;
  const others = rows.length - manufacturers;
  const otherParts = Object.keys(KIND_LABELS).filter(function (kind) {
    return kind !== 'manufacturer' && counts[kind];
  }).map(function (kind) {
    return grouped(counts[kind]) + ' ' + KIND_LABELS[kind];
  });
  let siteCount = null;
  let intelCount = null;
  let aliasExtras = null;
  try {
    const stats = readJson('data/site-stats.json');
    const intel = readJson('data/manufacturer-intel.json');
    siteCount = stats && stats.manufacturers;
    intelCount = intel && (intel.count || (intel.companies || []).length);
    const aliases = require('./company-aliases');
    const seen = new Set();
    let extras = 0;
    (intel.companies || []).forEach(function (company) {
      const slug = aliases.resolveCompanyAlias(company.name).slug;
      if (seen.has(slug)) extras++;
      else seen.add(slug);
    });
    if (seen.size === manufacturers && intelCount === (intel.companies || []).length) aliasExtras = extras;
  } catch (e) { /* the sentence stays with the counts that did load */ }
  let census = 'The site lists ' + grouped(siteCount) + ' manufacturers. This file has ' + grouped(manufacturers) + ' manufacturer rows.';
  if (siteCount != null && intelCount != null && siteCount !== intelCount) {
    census = 'The site lists ' + grouped(siteCount) + ' manufacturers. The manufacturer census file has ' + grouped(intelCount) + ' records. This file has ' + grouped(manufacturers) + ' manufacturer rows.';
  } else if (aliasExtras != null && siteCount != null && intelCount === siteCount && (intelCount - aliasExtras) === manufacturers) {
    census = 'The site lists ' + grouped(siteCount) + ' manufacturers. ' + grouped(aliasExtras) + ' of those census records collapse into an existing manufacturer row through a known company-name alias, leaving ' + grouped(manufacturers) + ' manufacturer rows in this file.';
  }
  return 'The directory file has ' + grouped(rows.length) + ' rows. ' + census + ' The other ' + grouped(others) + ' rows are not manufacturers: ' + otherParts.join(', ') + '.';
}

function cityOf(company) {
  const factories = company && company.factories || [];
  for (let i = 0; i < factories.length; i++) {
    if (factories[i] && factories[i].city) return String(factories[i].city);
  }
  return company && company.headquarters ? String(company.headquarters) : '';
}

function profileUrl(slug) {
  const s = String(slug || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return '';
  return 'https://transformerpath.com/manufacturers/' + s + '/';
}

function directoryRows(doc) {
  return (doc.companies || []).map(function (company) {
    return {
      id: company.canonical_id || company.id || '',
      name: company.name || '',
      kind: company.kind || '',
      roles: joinList(company.roles),
      country: company.country || '',
      region: company.region || '',
      city: cityOf(company),
      website: company.website || '',
      profile_url: profileUrl(company.slug),
      capability_labels: joinList(company.capability_labels),
      product_codes: joinList(company.product_codes),
      voltage: scalar(company.voltage),
      mva: scalar(company.mva),
      evidence: company.evidence || '',
      claim_type: company.claim_type || '',
      listing_tier: company.listing_tier || '',
      last_verified: publicLastVerified(company.last_verified, [company.evidence, company.claim_type, company.research_status]),
      licence: LICENCE
    };
  });
}

function tenderRows(doc) {
  return (doc.tenders || []).map(function (row) {
    return {
      tender_id: row.tender_id || '',
      title: row.title || '',
      full_title: row.full_title || '',
      status: row.status || '',
      status_label: row.statusLabel || '',
      country: row.country || '',
      region: row.region || '',
      buyer: row.buyer || '',
      utility: row.utility || '',
      epc: row.epc || '',
      voltage: row.voltage || '',
      transformer_scope: row.transformer_scope || '',
      deadline: row.deadline || '',
      source: row.source || '',
      official_procurement_url: row.official_procurement_url || '',
      last_verified: publicLastVerified(row.last_verified, [row.status, row.transformer_scope, row.cls]),
      licence: LICENCE
    };
  });
}

function awardRows(doc) {
  return (doc.awards || []).map(function (row) {
    return {
      award_id: row.award_id || '',
      tender_id: row.tender_id || '',
      title: row.title || '',
      awardee: row.awardee || '',
      buyer: row.buyer || '',
      utility: row.utility || '',
      epc: row.epc || '',
      country: row.country || '',
      region: row.region || '',
      voltage: row.voltage || '',
      transformer_scope: row.transformer_scope || '',
      contract_value: row.contract_value || '',
      currency: row.currency || '',
      confidence: row.confidence || '',
      claim_type: row.claim_type || '',
      award_status: row.award_status || '',
      source: row.source || '',
      source_urls: joinList(row.source_urls, ' | '),
      last_verified: publicLastVerified(row.last_verified, [row.award_status, row.transformer_scope, row.claim_type, row.confidence]),
      licence: LICENCE
    };
  });
}

function toCsv(columns, rows, comments) {
  const lines = (comments || []).map(function (line) {
    return csvEscape(line.charAt(0) === '#' ? line : '# ' + line);
  });
  lines.push(columns.join(','));
  rows.forEach(function (row) {
    lines.push(columns.map(function (col) { return csvEscape(row[col]); }).join(','));
  });
  return '\uFEFF' + lines.join('\n') + '\n';
}

function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const table = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      if (!(row.length === 1 && row[0] === '')) table.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') {
      cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    if (!(row.length === 1 && row[0] === '')) table.push(row);
  }

  const comments = [];
  let headers = null;
  const records = [];
  table.forEach(function (cells) {
    if (!headers) {
      if (cells.length === 1 && String(cells[0]).charAt(0) === '#') {
        comments.push(String(cells[0]));
        return;
      }
      headers = cells;
      return;
    }
    const obj = {};
    headers.forEach(function (header, idx) { obj[header] = cells[idx] == null ? '' : cells[idx]; });
    records.push(obj);
  });
  return { comments: comments, headers: headers || [], rows: records };
}

function writeExports(destDir, generatedAt) {
  const directory = readJson('data/directory-index.json');
  const tenders = readJson('data/tenders.json');
  const awards = readJson('data/awards.json');
  const when = generatedAt || new Date().toISOString();
  const built = {
    directory: {
      columns: DIRECTORY_COLUMNS,
      rows: directoryRows(directory),
      sourceUpdated: directory.generated || ''
    },
    tenders: {
      columns: TENDER_COLUMNS,
      rows: tenderRows(tenders),
      sourceUpdated: tenders.updated || ''
    },
    awards: {
      columns: AWARD_COLUMNS,
      rows: awardRows(awards),
      sourceUpdated: awards.updated || ''
    }
  };

  fs.mkdirSync(destDir, { recursive: true });
  const directoryScope = directoryScopeNote(built.directory.rows);
  const manifest = {
    generated_at: when,
    licence: LICENCE,
    directory_scope: directoryScope,
    preview_rows: PREVIEW_ROWS,
    files: {}
  };
  Object.keys(FILES).forEach(function (key) {
    const spec = FILES[key];
    const part = built[key];
    const comments = [
      '# TransformerPath ' + spec.label + ' CSV',
      '# Licence: ' + LICENCE,
      '# last_verified is — when the row status is INFERRED or unverified.',
      '# Generated: ' + when,
      '# Source-Updated: ' + (part.sourceUpdated || ''),
      '# Rows: ' + part.rows.length,
      '# Built from the live data files at site build time.'
    ];
    if (key === 'directory') comments.splice(2, 0, '# ' + directoryScope);
    const csv = toCsv(part.columns, part.rows, comments);
    fs.writeFileSync(path.join(destDir, spec.stored), csv);
    manifest.files[key] = {
      stored: spec.stored,
      filename: spec.filename,
      rows: part.rows.length,
      columns: part.columns.slice(),
      source_updated: part.sourceUpdated || ''
    };
  });
  fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function readStored(dir, key) {
  const spec = FILES[key];
  if (!spec) return null;
  const file = path.join(dir, spec.stored);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return null;
  }
}

function readDirectoryScope(dir) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    return manifest.directory_scope || '';
  } catch (e) {
    return '';
  }
}

function loadPreviews(dir) {
  return Object.keys(FILES).map(function (key) {
    const text = readStored(dir, key);
    const parsed = text ? parseCsv(text) : { headers: [], rows: [] };
    return {
      key: key,
      label: FILES[key].label,
      blurb: FILES[key].blurb,
      headers: parsed.headers,
      total: parsed.rows.length,
      rows: parsed.rows.slice(0, PREVIEW_ROWS)
    };
  });
}

function sessionLineItems(session) {
  if (!session || session.line_items == null) return [];
  const raw = session.line_items;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

/* First explicit product name wins. Line-item metadata is ahead of the
 * Payment Link, which is ahead of session metadata. A non-CSV product does
 * not fall through to a later CSV tag. */
function productNames(session) {
  const names = [];
  function push(value) {
    const name = String(value == null ? '' : value).trim();
    if (name) names.push(name);
  }
  sessionLineItems(session).forEach(function (item) {
    const price = item && item.price && typeof item.price === 'object' ? item.price : {};
    const product = price.product && typeof price.product === 'object' ? price.product : {};
    push(price.metadata && price.metadata.product);
    push(product.metadata && product.metadata.product);
    push(item && item.metadata && item.metadata.product);
  });
  const link = session && session.payment_link;
  if (link && typeof link === 'object') push(link.metadata && link.metadata.product);
  push(session && session.metadata && session.metadata.product);
  return names;
}

function csvProductFromSession(session) {
  if (!session || typeof session !== 'object') return null;
  const names = productNames(session);
  if (!names.length) return null;
  return PRODUCTS[names[0]] ? names[0] : null;
}

function lineItemsNameProduct(session) {
  const names = [];
  function push(value) {
    const name = String(value == null ? '' : value).trim();
    if (name) names.push(name);
  }
  sessionLineItems(session).forEach(function (item) {
    const price = item && item.price && typeof item.price === 'object' ? item.price : {};
    const product = price.product && typeof price.product === 'object' ? price.product : {};
    push(price.metadata && price.metadata.product);
    push(product.metadata && product.metadata.product);
    push(item && item.metadata && item.metadata.product);
  });
  return names.length ? names[0] : '';
}

function signPayload(sid, fileKey, exp) {
  return ['v1', sid, fileKey, String(exp)].join('\n');
}

function signDownload(secret, sid, fileKey, exp) {
  return crypto.createHmac('sha256', String(secret)).update(signPayload(sid, fileKey, exp)).digest('hex');
}

function verifyDownload(secret, sid, fileKey, exp, sig, now) {
  if (!secret || !FILES[fileKey]) return false;
  if (!/^[A-Za-z0-9_]+$/.test(String(sid || ''))) return false;
  if (!/^[a-f0-9]{64}$/.test(String(sig || ''))) return false;
  const expNum = Number(exp);
  if (!Number.isSafeInteger(expNum)) return false;
  const clock = now == null ? Date.now() : now;
  if (expNum <= clock) return false;
  if (expNum > clock + TTL_MS + SKEW_MS) return false;
  const expected = signDownload(secret, sid, fileKey, expNum);
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function issueLinks(secret, sid, product, now) {
  const spec = PRODUCTS[product];
  if (!spec) return [];
  const clock = now == null ? Date.now() : now;
  const exp = clock + TTL_MS;
  return spec.files.map(function (key) {
    const sig = signDownload(secret, sid, key, exp);
    const href = '/data/download?dl=' + encodeURIComponent(key) +
      '&sid=' + encodeURIComponent(sid) +
      '&exp=' + encodeURIComponent(String(exp)) +
      '&sig=' + encodeURIComponent(sig);
    return {
      key: key,
      label: FILES[key].label,
      filename: FILES[key].filename,
      href: href,
      exp: exp
    };
  });
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function previewTable(preview) {
  const shown = preview.rows.length;
  const head = preview.headers.map(function (header) {
    return '<th scope="col">' + esc(header) + '</th>';
  }).join('');
  const body = preview.rows.map(function (row) {
    const cells = preview.headers.map(function (header) {
      return '<td>' + esc(row[header]) + '</td>';
    }).join('');
    return '<tr>' + cells + '</tr>';
  }).join('');
  return '<section class="csv-sample" data-csv-preview="' + esc(preview.key) + '" data-preview-rows="' + shown + '">' +
    '<h3>' + esc(preview.label) + '</h3>' +
    '<p>' + esc(preview.blurb) + ' Sample preview — ' + shown + ' of ' + preview.total + ' rows.</p>' +
    '<div class="csv-wrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '</section>';
}

function renderPage(opts) {
  opts = opts || {};
  const previews = opts.previews || [];
  const links = opts.links || [];
  let lead = '';
  if (opts.fileMissing) {
    lead = '<p id="csv-file-missing" class="csv-fail">' + esc(FILE_MISSING) + '</p>';
  } else if (opts.verified) {
    const buttons = links.map(function (link) {
      return '<li><a class="btn btn-amber" href="' + esc(link.href) + '">Download ' + esc(link.filename) + '</a></li>';
    }).join('');
    lead = '<p id="csv-paid">Payment confirmed for ' + esc(opts.productLabel || 'this CSV') + '. These download links expire in 15 minutes.</p>' +
      '<ul class="csv-downloads">' + buttons + '</ul>';
  } else {
    lead = '<p id="csv-verify-failed" class="csv-fail">' + esc(VERIFY_FAILED) + '</p>';
  }
  const samples = previews.map(previewTable).join('');
  return '<!DOCTYPE html>\n' +
    '<html lang="en" data-theme="dark">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>CSV download — TransformerPath</title>\n' +
    '<meta name="robots" content="noindex, nofollow">\n' +
    '<meta name="description" content="Download a TransformerPath CSV after a verified payment.">\n' +
    '<link rel="stylesheet" href="/style.css?v=14">\n' +
    '<link rel="stylesheet" href="/tp-nav.css?v=14">\n' +
    '<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">\n' +
    '<style>\n' +
    '.csv-fail{background:rgba(180,40,40,.12);border:1px solid var(--border);border-radius:12px;padding:14px 16px}\n' +
    '.csv-downloads{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:10px}\n' +
    '.csv-downloads a{text-decoration:none}\n' +
    '.csv-wrap{overflow-x:auto;margin:0 0 28px;border:1px solid var(--border);border-radius:12px}\n' +
    '.csv-wrap table{width:100%;border-collapse:collapse;font-size:.82rem}\n' +
    '.csv-wrap th,.csv-wrap td{border-bottom:1px solid var(--border);padding:6px 8px;text-align:left;white-space:nowrap}\n' +
    '.csv-wrap th{background:var(--navy);color:#fff}\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<a class="skip-link" href="#main">Skip to content</a>\n' +
    '<header><div class="container nav"><a href="/" class="logo"><span class="word">Transformer<span class="accent">Path</span></span></a></div></header>\n' +
    '<main id="main" class="container" style="padding:32px 0 64px;max-width:1100px">\n' +
    '<h1>CSV download</h1>\n' +
    lead + '\n' +
    '<p id="csv-licence">' + esc(LICENCE) + '</p>\n' +
    (opts.directoryScope ? '<p id="csv-directory-scope">' + esc(opts.directoryScope) + '</p>\n' : '') +
    '<h2>Sample previews</h2>\n' +
    '<p>Ten-row excerpts of the files generated from the live directory, tenders, and awards at build time.</p>\n' +
    samples + '\n' +
    '</main>\n' +
    '</body>\n</html>\n';
}

module.exports = {
  LICENCE: LICENCE,
  UNVERIFIED_MARK: UNVERIFIED_MARK,
  VERIFY_FAILED: VERIFY_FAILED,
  FILE_MISSING: FILE_MISSING,
  PREVIEW_ROWS: PREVIEW_ROWS,
  TTL_MS: TTL_MS,
  PRODUCTS: PRODUCTS,
  FILES: FILES,
  repoRoot: repoRoot,
  defaultExportDir: defaultExportDir,
  csvEscape: csvEscape,
  toCsv: toCsv,
  parseCsv: parseCsv,
  writeExports: writeExports,
  directoryScopeNote: directoryScopeNote,
  publicLastVerified: publicLastVerified,
  readStored: readStored,
  readDirectoryScope: readDirectoryScope,
  loadPreviews: loadPreviews,
  csvProductFromSession: csvProductFromSession,
  lineItemsNameProduct: lineItemsNameProduct,
  signDownload: signDownload,
  verifyDownload: verifyDownload,
  issueLinks: issueLinks,
  renderPage: renderPage
};
