#!/usr/bin/env node
/* build-rental-emergency.js — Rental & emergency providers directory.
 *
 * Hub: rental-emergency.html
 * Profile: rental-emergency/<slug>/index.html
 * Form: request-urgent.html
 *
 * Source: data/rental-emergency-providers.json
 * no_email_outreach stays in that file and is never written into HTML.
 * Run: node build-rental-emergency.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const abs = (html) => html.replace(/(href|src)="(?!https?:|mailto:|tel:|#|\/|data:)([^"]+)"/g, '$1="/$2"');
const CSSV = (JSON.parse(fs.readFileSync('data/config.json', 'utf8')).assets || {}).css || 14;
const HEAD = abs(fs.readFileSync('_partials/header.html', 'utf8').trim());
const FOOT = abs(fs.readFileSync('_partials/footer.html', 'utf8').trim());
const { directoryBadge, scrubLegacyLabels } = require('./lib/provenance-badge');
const { sourcedCardCount } = require('./lib/sourced-card-count');
const { resolveCountry } = require('./lib/country-codes');
const { providerLeadPricingEnabled } = require('./lib/feature-flags');
const { leadOfferMarkup } = require('./lib/urgent-request');

const DASH = '\u2014';
const CHECKED = '2026-10-31';
const GENERIC_EMAIL = /^(info|sales|enquiry|enquiries|contact|hello|support|service|office|admin)@[a-z0-9.-]+\.[a-z]{2,}$/i;
const DATA = JSON.parse(fs.readFileSync('data/rental-emergency-providers.json', 'utf8'));
const COMPANIES = DATA.companies || [];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugOf(row) {
  return String(row.id || '').replace(/^rent:/, '');
}

function countriesOf(row) {
  return (row.countries || []).filter(Boolean);
}

function countryLabel(row) {
  return countriesOf(row).join(' · ');
}

function typeLabel(t) {
  const s = String(t || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function genericEmail(value) {
  const email = String(value || '').trim();
  return GENERIC_EMAIL.test(email) ? email : '';
}

function phoneOf(row) {
  return String(row.phone || '').trim();
}

function publicRow(row) {
  const email = genericEmail(row.contact_email);
  return {
    id: row.id,
    slug: slugOf(row),
    company_name: row.company_name,
    countries: countriesOf(row),
    website: row.website || '',
    service_pages: (row.service_pages || []).map(function (page) {
      return { label: page.label || 'Service page', url: page.url };
    }),
    service_types: row.service_types || [],
    contact_email: email,
    phone: phoneOf(row),
    phone_context: phoneOf(row) ? String(row.phone_context || '').trim() : '',
    verification_status: row.verification_status || '',
    verification_date: row.verification_date || '',
    verification_source: row.verification_source || row.website || ''
  };
}

function telHref(phone) {
  const cleaned = String(phone || '').replace(/[^\d+]/g, '');
  return cleaned ? 'tel:' + cleaned : '';
}

function emailHtml(row) {
  const email = genericEmail(row.contact_email);
  if (!email) return DASH;
  return '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>';
}

function phoneHtml(row) {
  const phone = phoneOf(row);
  if (!phone) return DASH;
  const href = telHref(phone);
  const context = String(row.phone_context || '').trim();
  const link = href
    ? '<a href="' + esc(href) + '">' + esc(phone) + '</a>'
    : esc(phone);
  return link + (context ? ' (' + esc(context) + ')' : '');
}

function linksHtml(row) {
  const bits = [];
  if (row.website) {
    bits.push('<a href="' + esc(row.website) + '" target="_blank" rel="noopener">Company website</a>');
  }
  (row.service_pages || []).forEach(function (page) {
    if (!page || !page.url) return;
    bits.push('<a href="' + esc(page.url) + '" target="_blank" rel="noopener">' + esc(page.label || 'Service page') + '</a>');
  });
  return bits.join(' · ');
}

function typeTags(row) {
  return (row.service_types || []).map(function (t) {
    return '<span class="rent-type-tag">' + esc(typeLabel(t)) + '</span>';
  }).join('');
}

function urgentProfileLink(slug) {
  return '<p class="rent-urgent-link" style="margin:18px 0 0;font-size:.9rem"><a href="/request-urgent.html?from=' + esc(slug) + '" style="color:var(--accent);font-weight:600">Need a transformer fast?</a></p>';
}

function urgentBanner() {
  return '<aside class="urgent-banner" id="urgent-request">' +
    '<div>' +
    '<h2>Need a transformer fast?</h2>' +
    '<p>Send the rating, voltages, type, and the city where it is needed. TransformerPath routes the request to matching providers.</p>' +
    '</div>' +
    '<a class="btn btn-amber" href="/request-urgent.html">Request an urgent replacement</a>' +
    '</aside>';
}

function cardHtml(row) {
  const slug = slugOf(row);
  const pub = publicRow(row);
  const badge = directoryBadge(row);
  return '<article class="rent-card" data-slug="' + esc(slug) + '">' +
    '<div class="rent-top"><h2 class="rent-name"><a href="/rental-emergency/' + esc(slug) + '/">' + esc(row.company_name) + '</a></h2>' +
    badge + '</div>' +
    '<p class="rent-loc">' + esc(countryLabel(row)) + '</p>' +
    '<div class="rent-types">' + typeTags(row) + '</div>' +
    '<dl class="rent-facts">' +
    '<div><dt>Email</dt><dd>' + emailHtml(row) + '</dd></div>' +
    '<div><dt>Phone</dt><dd>' + phoneHtml(row) + '</dd></div>' +
    '<div><dt>City</dt><dd>' + DASH + '</dd></div>' +
    '<div><dt>Founded</dt><dd>' + DASH + '</dd></div>' +
    '<div><dt>Capacity</dt><dd>' + DASH + '</dd></div>' +
    '<div><dt>Rating</dt><dd>' + DASH + '</dd></div>' +
    '</dl>' +
    '<p class="rent-links">' + linksHtml(pub) + '</p>' +
    '</article>';
}

function profilePage(row) {
  const slug = slugOf(row);
  const url = 'https://transformerpath.com/rental-emergency/' + slug + '/';
  const pub = publicRow(row);
  const badge = directoryBadge(row);
  const desc = row.company_name + ' rents transformers or provides mobile substations or emergency replacement. Listed by country and type.';
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(row.company_name) + ' — Rental &amp; emergency provider | TransformerPath</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="' + esc(row.company_name) + ' — Rental &amp; emergency provider">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">' +
    '<meta name="robots" content="index,follow">' +
    '<meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">' +
    '<link rel="stylesheet" href="/style.css?v=' + CSSV + '">' +
    '<link rel="stylesheet" href="/tp-nav.css?v=15">' +
    '</head><body>\n' + HEAD + '\n' +
    '<main id="main" tabindex="-1" style="max-width:900px;margin:0 auto;padding:44px 20px 88px">' +
    '<nav style="font-size:.8rem;color:var(--muted);margin-bottom:12px"><a href="/rental-emergency.html" style="color:var(--accent)">Rental &amp; emergency providers</a> › ' + esc(row.company_name) + '</nav>' +
    '<h1>' + esc(row.company_name) + (badge ? ' ' + badge : '') + '</h1>' +
    '<p style="color:var(--muted);max-width:40rem">Rental and emergency provider, listed by country and type. A field the source list does not give is shown as ' + DASH + '.</p>' +
    '<dl class="rent-facts" style="margin:18px 0">' +
    '<div><dt>Country</dt><dd>' + esc(countryLabel(row)) + '</dd></div>' +
    '<div><dt>Service types</dt><dd>' + esc((row.service_types || []).map(typeLabel).join(', ')) + '</dd></div>' +
    '<div><dt>Email</dt><dd>' + emailHtml(row) + '</dd></div>' +
    '<div><dt>Phone</dt><dd>' + phoneHtml(row) + '</dd></div>' +
    '<div><dt>City</dt><dd>' + DASH + '</dd></div>' +
    '<div><dt>Founded</dt><dd>' + DASH + '</dd></div>' +
    '<div><dt>Capacity</dt><dd>' + DASH + '</dd></div>' +
    '<div><dt>Rating</dt><dd>' + DASH + '</dd></div>' +
    '</dl>' +
    '<p class="rent-links">' + linksHtml(pub) + '</p>' +
    urgentProfileLink(slug) +
    '<p style="color:var(--muted);font-size:.88rem">Checked ' + esc(CHECKED) + ' · <a href="' + esc(row.verification_source || row.website) + '" target="_blank" rel="noopener">Source page</a></p>' +
    '</main>\n' + FOOT + '\n' +
    '<script src="/lib/provenance-badge.js"></script>\n' +
    '<script src="/tp-nav.js?v=7" defer></script>\n' +
    '</body></html>\n';
}

function countryOptions(rows) {
  const set = {};
  rows.forEach(function (row) {
    countriesOf(row).forEach(function (c) { set[c] = 1; });
  });
  return Object.keys(set).sort();
}

function ensureSitemap(locs) {
  let xml = fs.readFileSync('sitemap.xml', 'utf8');
  locs.forEach(function (loc) {
    if (xml.indexOf('<loc>' + loc + '</loc>') !== -1) return;
    const line = '  <url><loc>' + loc + '</loc><lastmod>' + CHECKED + '</lastmod></url>\n';
    const re = /  <url><loc>([^<]+)<\/loc>/g;
    let m;
    let at = -1;
    while ((m = re.exec(xml))) {
      if (m[1] > loc) { at = m.index; break; }
    }
    if (at === -1) xml = xml.replace('</urlset>', line + '</urlset>');
    else xml = xml.slice(0, at) + line + xml.slice(at);
  });
  fs.writeFileSync('sitemap.xml', xml);
}

function ensureContentDates(rels) {
  const file = 'data/sitemap-content-dates.json';
  const raw = fs.readFileSync(file, 'utf8');
  const doc = JSON.parse(raw);
  let changed = false;
  rels.forEach(function (rel) {
    if (!doc.pages[rel]) {
      doc.pages[rel] = CHECKED;
      changed = true;
    }
  });
  if (!changed) return;
  const next = JSON.stringify(doc, null, 2) + '\n';
  const untouched = JSON.parse(raw);
  const sameShape = JSON.stringify(untouched, null, 2) + '\n' === raw;
  if (sameShape) {
    fs.writeFileSync(file, next);
    return;
  }
  rels.forEach(function (rel) {
    if (raw.indexOf('"' + rel + '"') !== -1) return;
    const needle = '\n  }\n}';
    const insert = ',\n    "' + rel + '": "' + CHECKED + '"\n  }\n}';
    if (raw.indexOf(needle) === -1) throw new Error('sitemap content dates have no pages object close');
  });
  let patched = raw;
  rels.forEach(function (rel) {
    if (patched.indexOf('"' + rel + '"') !== -1) return;
    const keyLine = '    "' + rel + '": "' + CHECKED + '"';
    patched = patched.replace(/\n  \}\n\}\s*$/, ',\n' + keyLine + '\n  }\n}\n');
  });
  fs.writeFileSync(file, patched);
}

function requestUrgentPage() {
  const offer = leadOfferMarkup(providerLeadPricingEnabled());
  const leadState = providerLeadPricingEnabled() ? 'on' : 'off';
  const url = 'https://transformerpath.com/request-urgent.html';
  const desc = 'Send a transformer rating, voltages, and location. TransformerPath routes the request to matching providers.';
  return '<!DOCTYPE html>\n<html lang="en" data-theme="dark"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Urgent replacement request | TransformerPath</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="TransformerPath">' +
    '<meta property="og:title" content="Urgent replacement request | TransformerPath">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + url + '">' +
    '<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">' +
    '<meta name="robots" content="index,follow">' +
    '<meta name="theme-color" content="#0d1b2e">' +
    '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">' +
    '<link rel="stylesheet" href="/style.css?v=' + CSSV + '">' +
    '<link rel="stylesheet" href="/tp-nav.css?v=15">' +
    '<style>' +
    '.urgent-form { max-width: 760px; margin: 0 auto; padding: 44px 20px 88px; }' +
    '.urgent-form h1 { font-size: 2.1rem; color: var(--ink); margin: 0 0 8px; }' +
    '.urgent-form .lead { color: var(--muted); margin: 0 0 22px; line-height: 1.5; }' +
    '.urgent-form form input[type="checkbox"], .urgent-form form input[type="radio"] { width: auto; min-width: 0; padding: 0; margin: 3px 0 0; }' +
    '.urgent-form .consent { display: flex; gap: 9px; align-items: flex-start; font-weight: 500; }' +
    '</style>' +
    '</head><body>\n' + HEAD + '\n' +
    '<main class="urgent-form" id="main" tabindex="-1" data-lead-offer="' + leadState + '">' +
    '<nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="/rental-emergency.html" style="color:var(--accent)">Rental &amp; emergency providers</a> › Urgent replacement</nav>' +
    '<h1>Need a transformer <span style="color:var(--accent)">fast?</span></h1>' +
    '<p class="lead">Send the rating, voltages, type, and the city where it is needed. TransformerPath routes the request to matching providers.</p>' +
    offer +
    '<div id="urgent-lead-offer" hidden></div>' +
    '<form name="urgent-replacement" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" id="urgentForm" class="card">' +
    '<input type="hidden" name="form-name" value="urgent-replacement">' +
    '<input type="hidden" name="form" value="urgent-replacement">' +
    '<input type="hidden" name="listed_provider" id="listed_provider" value="">' +
    '<p hidden><label>Leave this empty: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>' +
    '<div class="row">' +
    '<div><label for="fld_rating">Rating (kVA/MVA) *</label><input id="fld_rating" type="text" name="rating" required maxlength="80" placeholder="e.g. 2.5 MVA or 500 kVA" autocomplete="off"></div>' +
    '<div><label for="fld_soon">How soon *</label><select id="fld_soon" name="how_soon" required>' +
    '<option value="">Select</option><option>24h</option><option>1 week</option><option>1 month</option></select></div>' +
    '</div>' +
    '<div class="row">' +
    '<div><label for="fld_primary">Primary voltage *</label><input id="fld_primary" type="text" name="primary_voltage" required maxlength="80" placeholder="e.g. 33 kV" autocomplete="off"></div>' +
    '<div><label for="fld_secondary">Secondary voltage *</label><input id="fld_secondary" type="text" name="secondary_voltage" required maxlength="80" placeholder="e.g. 11 kV" autocomplete="off"></div>' +
    '</div>' +
    '<div class="row">' +
    '<div><label for="fld_cooling">Type: oil or dry *</label><select id="fld_cooling" name="cooling" required>' +
    '<option value="">Select</option><option>Oil</option><option>Dry</option></select></div>' +
    '<div><label for="fld_mounting">Type: pad, pole, or substation *</label><select id="fld_mounting" name="mounting" required>' +
    '<option value="">Select</option><option>Pad</option><option>Pole</option><option>Substation</option></select></div>' +
    '</div>' +
    '<div class="row">' +
    '<div><label for="fld_country">Country *</label><input id="fld_country" type="text" name="country" required maxlength="80" autocomplete="country-name"></div>' +
    '<div><label for="fld_city">City *</label><input id="fld_city" type="text" name="city" required maxlength="80" autocomplete="address-level2"></div>' +
    '</div>' +
    '<div class="row">' +
    '<div><label for="fld_arrange">Rent or buy *</label><select id="fld_arrange" name="rent_or_buy" required>' +
    '<option value="">Select</option><option value="rent">Rent</option><option value="buy">Buy</option></select></div>' +
    '<div><label for="fld_company">Company name *</label><input id="fld_company" type="text" name="company" required maxlength="160" autocomplete="organization"></div>' +
    '</div>' +
    '<div style="margin-bottom:16px"><label for="fld_email">Work email *</label><input id="fld_email" type="email" name="email" required maxlength="160" autocomplete="email" placeholder="name@company.com"></div>' +
    '<div style="margin-bottom:16px"><label for="fld_notes">Notes</label><textarea id="fld_notes" name="notes" rows="4" maxlength="4000" placeholder="Site access, existing unit, or anything a provider should know"></textarea></div>' +
    '<label class="consent" style="margin-bottom:16px"><input id="fld_consent" type="checkbox" name="consent" value="yes" required> I agree TransformerPath may share my request with matching providers.</label>' +
    '<button class="btn btn-amber" type="submit">Send urgent replacement request</button>' +
    '<p style="color:var(--muted);font-size:.86rem;margin:14px 0 0">Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a></p>' +
    '</form>' +
    '<div id="urgentThanks" style="display:none" role="status" class="card">' +
    '<h2 style="color:var(--ink);margin:0 0 8px">Thank you</h2>' +
    '<p style="margin:0">TransformerPath will route the request.</p>' +
    '</div>' +
    '</main>\n' + FOOT + '\n' +
    '<script src="/form-notify.js" defer></script>\n' +
    '<script>\n' +
    '(function () {\n' +
    '  var leadOffer = ' + JSON.stringify(offer) + ';\n' +
    '  var slot = document.getElementById("urgent-lead-offer");\n' +
    '  fetch("/data/feature-flags.json").then(function (res) {\n' +
    '    return res.ok ? res.json() : {};\n' +
    '  }).then(function (flags) {\n' +
    '    if (!slot || !flags || flags.provider_lead_pricing !== true || !leadOffer) {\n' +
    '      if (slot) { slot.hidden = true; slot.textContent = ""; }\n' +
    '      return;\n' +
    '    }\n' +
    '    slot.hidden = false;\n' +
    '    slot.textContent = leadOffer;\n' +
    '  }).catch(function () {\n' +
    '    if (slot) { slot.hidden = true; slot.textContent = ""; }\n' +
    '  });\n' +
    '  var f = document.getElementById("urgentForm");\n' +
    '  if (!f) return;\n' +
    '  var params = new URLSearchParams(window.location.search);\n' +
    '  var from = params.get("from") || "";\n' +
    '  var listed = document.getElementById("listed_provider");\n' +
    '  if (listed && from && from.length <= 80 && from.split("").every(function (c) {\n' +
    '    return (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "-";\n' +
    '  })) listed.value = from;\n' +
    '  f.addEventListener("submit", function (e) {\n' +
    '    e.preventDefault();\n' +
    '    if (!f.checkValidity()) { f.reportValidity(); return; }\n' +
    '    if (window.TP_NOTIFY) window.TP_NOTIFY(f);\n' +
    '    var btn = f.querySelector("button[type=submit]");\n' +
    '    if (btn) btn.disabled = true;\n' +
    '    fetch("/", {\n' +
    '      method: "POST",\n' +
    '      headers: { "Content-Type": "application/x-www-form-urlencoded" },\n' +
    '      body: new URLSearchParams(new FormData(f)).toString()\n' +
    '    }).then(function (r) {\n' +
    '      if (!r.ok) throw new Error("Failed");\n' +
    '      f.style.display = "none";\n' +
    '      document.getElementById("urgentThanks").style.display = "block";\n' +
    '    }).catch(function () {\n' +
    '      if (btn) btn.disabled = false;\n' +
    '      alert("Submission failed. Please try again or email hello@transformerpath.com.");\n' +
    '    });\n' +
    '  });\n' +
    '})();\n' +
    '</script>\n' +
    '<script src="/analytics.js" defer></script>\n' +
    '</body></html>\n';
}

function render() {
  const countries = countryOptions(COMPANIES);
  countries.forEach(function (name) {
    const resolved = resolveCountry(name);
    if (!resolved.ok) throw new Error('Unresolved country ' + name);
  });
  const provenanceStat = sourcedCardCount(COMPANIES);
  const publicRows = COMPANIES.map(publicRow);
  const embedded = scrubLegacyLabels(JSON.stringify(publicRows));
  if (embedded.indexOf('no_email_outreach') !== -1) {
    throw new Error('public payload still contains no_email_outreach');
  }
  const cards = COMPANIES.map(cardHtml).join('\n');
  const countryOpts = countries.map(function (c) {
    return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rental &amp; emergency providers | TransformerPath</title>
<meta name="description" content="Directory of companies that rent transformers or mobile substations, or do emergency replacement. ${COMPANIES.length} listings, browsed by country and type.">
<link rel="canonical" href="https://transformerpath.com/rental-emergency.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TransformerPath">
<meta property="og:title" content="Rental &amp; emergency providers | TransformerPath">
<meta property="og:description" content="Companies that rent transformers or mobile substations, or do emergency replacement, listed by country and type.">
<meta property="og:url" content="https://transformerpath.com/rental-emergency.html">
<meta property="og:image" content="https://transformerpath.com/brand/og-image.png">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0d1b2e">
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg"><link rel="icon" href="brand/favicon.ico" sizes="any">
<link rel="stylesheet" href="style.css?v=${CSSV}">
<link rel="stylesheet" href="tp-nav.css?v=15">
<link rel="stylesheet" href="tp-feedback.css?v=12">
<style>
.rent-wrap { max-width: 1140px; margin: 0 auto; padding: 40px 20px 90px; }
.rent-head h1 { font-size: 2.2rem; color: var(--ink); margin: 0 0 8px; overflow-wrap: anywhere; }
.rent-head .lead { color: var(--muted); font-size: 1.05rem; max-width: 880px; line-height: 1.5; margin: 0 0 20px; }
.stats-bar { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 24px; }
.stat-box { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 18px; min-width: 140px; }
.stat-box .num { font-size: 1.5rem; font-weight: 800; color: var(--accent); }
.stat-box .lbl { font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.filter-bar { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 28px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.search-input { flex: 1; min-width: 260px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.select-input { padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: .95rem; }
.rent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.rent-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; }
.rent-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.rent-name { font-size: 1.22rem; font-weight: 800; color: var(--ink); margin: 0; }
.rent-name a { color: inherit; text-decoration: none; }
.rent-name a:hover { color: var(--accent); }
.rent-loc { font-size: .88rem; color: var(--muted); margin: 8px 0; }
.rent-types { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.rent-type-tag { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; font-size: .75rem; color: var(--text); }
.rent-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin: 0 0 12px; }
.rent-facts div { margin: 0; }
.rent-facts dt { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.rent-facts dd { margin: 0; color: var(--text); font-size: .92rem; overflow-wrap: anywhere; }
.rent-links { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); font-size: .9rem; }
.rent-links a { color: var(--accent); font-weight: 700; margin-right: 10px; }
.urgent-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; background: var(--card); border: 2px solid var(--amber); border-radius: 14px; padding: 22px 24px; margin: 0 0 28px; }
.urgent-banner h2 { margin: 0 0 6px; font-size: 1.55rem; color: var(--ink); }
.urgent-banner p { margin: 0; color: var(--text); max-width: 640px; line-height: 1.45; }
.urgent-banner .btn { flex: none; }
</style>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Rental & emergency providers",
  "url": "https://transformerpath.com/rental-emergency.html",
  "description": "Companies that rent transformers or mobile substations, or do emergency replacement, listed by country and type."
}
</script>
</head>
<body>
${HEAD}

<main class="rent-wrap" id="main" data-listing-count="${COMPANIES.length}">
  <div class="rent-head">
    <nav style="font-size:.82rem;color:var(--muted);margin-bottom:12px"><a href="index.html" style="color:var(--accent)">Home</a> › <a href="directory.html" style="color:var(--accent)">Directory</a> › Rental &amp; emergency providers</nav>
    <h1>Rental &amp; <span style="color:var(--accent)">emergency providers</span></h1>
    <p class="lead">Companies that rent transformers or mobile substations, or do emergency replacement. Browse the ${COMPANIES.length} published listings by country and type. Each card links to the company website and the service page. A field the source list does not give is shown as ${DASH}.</p>
  </div>

  ${urgentBanner()}

  <div class="stats-bar">
    <div class="stat-box">
      <div class="num" id="statRentCount">${COMPANIES.length}</div>
      <div class="lbl">Listings</div>
    </div>
    <div class="stat-box">
      <div class="num">${countries.length}</div>
      <div class="lbl">Countries</div>
    </div>
    <div class="stat-box">
      <div class="num" data-sourced="website-and-check-date">${provenanceStat.text}</div>
      <div class="lbl">Cards with a source URL and check date</div>
    </div>
  </div>

  <h2 style="font-size:1.15rem;margin:0 0 10px">Providers by country and type</h2>
  <div class="filter-bar">
    <div class="filter-row">
      <input type="search" id="rentSearch" class="search-input" placeholder="Search company, country, or type" aria-label="Search rental and emergency providers">
      <select id="rentCountry" class="select-input" aria-label="Filter by country">
        <option value="">All countries</option>
        ${countryOpts}
      </select>
      <select id="rentType" class="select-input" aria-label="Filter by type">
        <option value="">All types</option>
        <option value="rental">Rental</option>
        <option value="mobile substation">Mobile substation</option>
        <option value="emergency replacement">Emergency replacement</option>
      </select>
      <button id="rentReset" class="btn btn-outline btn-sm" type="button">Reset</button>
    </div>
  </div>

  <div id="rentGrid" class="rent-grid">
${cards}
  </div>
</main>

${FOOT}

<script src="lib/provenance-badge.js"></script>
<script>
window.__TP_RENTALS__ = ${embedded};
(function () {
  var data = window.__TP_RENTALS__ || [];
  var searchInput = document.getElementById('rentSearch');
  var countrySelect = document.getElementById('rentCountry');
  var typeSelect = document.getElementById('rentType');
  var resetBtn = document.getElementById('rentReset');
  var grid = document.getElementById('rentGrid');
  var DASH = ${JSON.stringify(DASH)};

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function typeLabel(t) {
    var s = String(t || '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  function emailHtml(email) {
    if (!email) return DASH;
    return '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>';
  }
  function phoneHtml(row) {
    if (!row.phone) return DASH;
    var href = 'tel:' + String(row.phone).replace(/[^\\d+]/g, '');
    var html = '<a href="' + esc(href) + '">' + esc(row.phone) + '</a>';
    if (row.phone_context) html += ' (' + esc(row.phone_context) + ')';
    return html;
  }
  function linksHtml(row) {
    var bits = [];
    if (row.website) bits.push('<a href="' + esc(row.website) + '" target="_blank" rel="noopener">Company website</a>');
    (row.service_pages || []).forEach(function (page) {
      bits.push('<a href="' + esc(page.url) + '" target="_blank" rel="noopener">' + esc(page.label || 'Service page') + '</a>');
    });
    return bits.join(' · ');
  }
  function render() {
    var q = (searchInput.value || '').toLowerCase().trim();
    var country = countrySelect.value;
    var type = (typeSelect.value || '').toLowerCase();
    var filtered = data.filter(function (row) {
      if (country && (row.countries || []).indexOf(country) === -1) return false;
      if (type && (row.service_types || []).join(' ').toLowerCase().indexOf(type) === -1) return false;
      if (!q) return true;
      var hay = [row.company_name].concat(row.countries || []).concat(row.service_types || []).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (!filtered.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;color:var(--muted);padding:28px 0">No listings match that country and type.</p>';
      return;
    }
    grid.innerHTML = filtered.map(function (row) {
      var tags = (row.service_types || []).map(function (t) {
        return '<span class="rent-type-tag">' + esc(typeLabel(t)) + '</span>';
      }).join('');
      return '<article class="rent-card">' +
        '<div class="rent-top"><h2 class="rent-name"><a href="/rental-emergency/' + esc(row.slug) + '/">' + esc(row.company_name) + '</a></h2></div>' +
        '<p class="rent-loc">' + esc((row.countries || []).join(' · ')) + '</p>' +
        '<div class="rent-types">' + tags + '</div>' +
        '<dl class="rent-facts">' +
        '<div><dt>Email</dt><dd>' + emailHtml(row.contact_email) + '</dd></div>' +
        '<div><dt>Phone</dt><dd>' + phoneHtml(row) + '</dd></div>' +
        '<div><dt>City</dt><dd>' + DASH + '</dd></div>' +
        '<div><dt>Founded</dt><dd>' + DASH + '</dd></div>' +
        '<div><dt>Capacity</dt><dd>' + DASH + '</dd></div>' +
        '<div><dt>Rating</dt><dd>' + DASH + '</dd></div>' +
        '</dl>' +
        '<p class="rent-links">' + linksHtml(row) + '</p>' +
        '</article>';
    }).join('');
  }
  searchInput.addEventListener('input', render);
  countrySelect.addEventListener('change', render);
  typeSelect.addEventListener('change', render);
  resetBtn.addEventListener('click', function () {
    searchInput.value = '';
    countrySelect.value = '';
    typeSelect.value = '';
    render();
  });
})();
</script>
<script src="tp-nav.js?v=7" defer></script>
<script src="analytics.js" defer></script>
</body>
</html>`;

  if (html.indexOf('no_email_outreach') !== -1) throw new Error('hub page renders no_email_outreach');
  fs.writeFileSync('rental-emergency.html', html);
  const requestPage = requestUrgentPage();
  if (requestPage.indexOf('no_email_outreach') !== -1) throw new Error('urgent request page renders no_email_outreach');
  if (/\$\s?\d|\bUSD\b|\bAED\b|stripe|buy\.stripe|\bpayment\b|\bcheckout\b/i.test(requestPage)) {
    throw new Error('urgent request page publishes a charge');
  }
  fs.writeFileSync('request-urgent.html', requestPage);
  const locs = ['https://transformerpath.com/rental-emergency.html', 'https://transformerpath.com/request-urgent.html'];
  const rels = ['rental-emergency.html', 'request-urgent.html'];
  COMPANIES.forEach(function (row) {
    const slug = slugOf(row);
    const dir = path.join('rental-emergency', slug);
    fs.mkdirSync(dir, { recursive: true });
    const page = profilePage(row);
    if (page.indexOf('no_email_outreach') !== -1) throw new Error('profile renders no_email_outreach: ' + slug);
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    locs.push('https://transformerpath.com/rental-emergency/' + slug + '/');
    rels.push('rental-emergency/' + slug + '/index.html');
  });
  ensureSitemap(locs);
  ensureContentDates(rels);
  console.log('rental-emergency.html built (' + COMPANIES.length + ' listings, ' + countries.length + ' countries)');
}

render();
