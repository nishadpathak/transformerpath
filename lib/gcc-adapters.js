#!/usr/bin/env node
/* lib/gcc-adapters.js — Live probes for GCC procurement portals.
 *
 * Honest contract:
 *   - Attempt HTTP GET of registered list_url / results_url / homepage
 *   - Stamp last_checked always; last_success only when body looks reachable
 *     and contains transformer-relevant vocabulary (EN/AR)
 *   - JS/session/Cloudflare-gated portals may return login shells → status stays
 *     BLOCKED_AUTH or NEEDS_ADAPTER with evidence in adapter_report
 *
 * P0 core: DEWA, Etimad, Bahrain Tender Board, EWA, Saudi Water Authority
 * P4 expansion: MEWRE (Kuwait), CAPT, KAHRAMAA, Nama, OETC
 */
'use strict';
const https = require('https');
const http = require('http');
const { URL } = require('url');

const P0_SOURCE_IDS = [
  'dewa-open-tenders',
  'etimad',
  'saudi-water-authority',
  'bahrain-tender-board',
  'ewa-bahrain'
];

const P4_SOURCE_IDS = [
  'mewre-kuwait',
  'kuwait-central-procurement',
  'kahramaa',
  'nama-group',
  'oetc'
];

const ADAPTER_SOURCE_IDS = P0_SOURCE_IDS.concat(P4_SOURCE_IDS);

const TRANSFORMER_HINT = /transformer|محول|substation|مناقصة|منافسة|kiosk|earthing|مفاعل|tender|procurement|tenderboard|etimad|kahramaa|mewre|nama/i;

function isTlsVerifyError(err) {
  const msg = String((err && err.message) || err || '');
  return /certificate|CERT_|UNABLE_TO_VERIFY|unable to verify|SSL|TLS|EPROTO|legacy renegotiation/i.test(msg);
}

function fetchText(url, timeoutMs, opts) {
  timeoutMs = timeoutMs || 12000;
  opts = opts || {};
  const relaxTls = !!opts.relaxTls;
  return new Promise(function (resolve) {
    let settled = false;
    function done(result) {
      if (settled) return;
      settled = true;
      if (relaxTls && result) result.tls_relaxed = true;
      resolve(result);
    }
    let parsed;
    try { parsed = new URL(url); } catch (e) {
      return done({ ok: false, status: 0, error: 'bad_url', body: '', finalUrl: url });
    }
    const lib = parsed.protocol === 'http:' ? http : https;
    const reqOpts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      protocol: parsed.protocol,
      headers: {
        'User-Agent': 'TransformerPathGCCAdapter/1.1 (+https://transformerpath.com; intel-discovery)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,ar;q=0.8'
      },
      timeout: timeoutMs
    };
    // Some GCC gov hosts serve incomplete chains / legacy renegotiation.
    // Strict verify first; callers may retry with relaxTls and stamp honesty.
    if (parsed.protocol === 'https:' && relaxTls) {
      reqOpts.rejectUnauthorized = false;
      reqOpts.secureOptions = require('constants').SSL_OP_LEGACY_SERVER_CONNECT;
    }
    const req = lib.get(reqOpts, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return fetchText(next, timeoutMs, opts).then(done);
      }
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); if (Buffer.concat(chunks).length > 800000) res.destroy(); });
      res.on('end', function () {
        const body = Buffer.concat(chunks).toString('utf8');
        done({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          error: null,
          body: body,
          finalUrl: url
        });
      });
    });
    req.on('error', function (e) {
      const errMsg = e.message || 'network_error';
      if (!relaxTls && parsed.protocol === 'https:' && isTlsVerifyError(e)) {
        return fetchText(url, timeoutMs, { relaxTls: true }).then(done);
      }
      done({ ok: false, status: 0, error: errMsg, body: '', finalUrl: url });
    });
    req.on('timeout', function () {
      req.destroy();
      done({ ok: false, status: 0, error: 'timeout', body: '', finalUrl: url });
    });
  });
}

function looksGated(body) {
  return /login|sign in|captcha|cloudflare|access denied|session expired|please enable javascript|cf-mitigated|challenge-platform/i.test(body || '')
    && !TRANSFORMER_HINT.test(body || '');
}

function scoreBody(body) {
  if (!body) return { hits: 0, gated: false };
  const gated = looksGated(body);
  const hits = (body.match(TRANSFORMER_HINT) || []).length;
  return { hits: hits, gated: gated };
}

/**
 * Probe one registry source. Mutates source fields (last_checked, last_success, status).
 * Returns an adapter report row.
 */
async function probeSource(source) {
  const checkedAt = new Date().toISOString();
  const urls = [source.list_url, source.results_url, source.url].filter(Boolean);
  if (!urls.length && source.domain) {
    urls.push('https://www.' + source.domain.replace(/^www\./, '') + '/');
    urls.push('https://' + source.domain.replace(/^www\./, '') + '/');
  }
  source.last_checked = checkedAt.slice(0, 10);

  if (!urls.length) {
    source.status = source.status || 'NEEDS_ADAPTER';
    return {
      source_id: source.source_id,
      country: source.country,
      probed: false,
      reason: 'no_list_url',
      status: source.status,
      checked_at: checkedAt
    };
  }

  let best = null;
  for (let i = 0; i < urls.length; i++) {
    const res = await fetchText(urls[i]);
    const score = scoreBody(res.body);
    const row = {
      source_id: source.source_id,
      country: source.country,
      url: urls[i],
      http_status: res.status,
      ok: res.ok,
      error: res.error,
      transformer_hits: score.hits,
      gated: score.gated,
      checked_at: checkedAt
    };
    if (res.tls_relaxed) row.tls_relaxed = true;
    if (!best || (res.ok && score.hits > (best.transformer_hits || 0))) best = row;
    if (res.ok && score.hits > 0 && !score.gated) break;
  }

  if (best && best.ok && best.transformer_hits > 0 && !best.gated) {
    source.last_success = checkedAt.slice(0, 10);
    source.status = 'ACTIVE';
    best.status = 'ACTIVE';
    best.probed = true;
    best.live = true;
    if (best.tls_relaxed) best.reason = 'reachable_via_relaxed_tls';
  } else if (best && best.gated) {
    source.status = 'BLOCKED_AUTH';
    best.status = 'BLOCKED_AUTH';
    best.probed = true;
    best.live = false;
    best.reason = 'portal_appears_session_or_js_gated';
  } else if (best && best.ok) {
    source.status = 'MANUAL_REVIEW';
    best.status = 'MANUAL_REVIEW';
    best.probed = true;
    best.live = false;
    best.reason = 'reachable_but_no_transformer_vocabulary';
  } else {
    source.status = 'NEEDS_ADAPTER';
    if (best) {
      best.status = 'NEEDS_ADAPTER';
      best.probed = true;
      best.live = false;
      best.reason = best.error || 'fetch_failed';
    }
  }
  return best || {
    source_id: source.source_id,
    country: source.country,
    probed: false,
    live: false,
    status: source.status,
    checked_at: checkedAt
  };
}

async function probeP0Sources(registry) {
  const sources = (registry && registry.sources) || [];
  const targets = sources.filter(function (s) {
    return ADAPTER_SOURCE_IDS.indexOf(s.source_id) >= 0 || s.priority === 'P0' || s.priority === 'P1';
  });
  const seen = {};
  const ordered = [];
  ADAPTER_SOURCE_IDS.forEach(function (id) {
    const hit = targets.find(function (s) { return s.source_id === id; });
    if (hit && !seen[id]) { seen[id] = true; ordered.push(hit); }
  });
  targets.forEach(function (s) {
    if (!seen[s.source_id] && (s.priority === 'P0' || ADAPTER_SOURCE_IDS.indexOf(s.source_id) >= 0)) {
      seen[s.source_id] = true;
      ordered.push(s);
    }
  });

  const reports = [];
  for (let i = 0; i < ordered.length; i++) {
    reports.push(await probeSource(ordered[i]));
  }
  const live = reports.filter(function (r) { return r && r.live; }).length;
  return {
    generated_at: new Date().toISOString(),
    probed: reports.length,
    live: live,
    p0_ids: P0_SOURCE_IDS,
    p4_ids: P4_SOURCE_IDS,
    reports: reports,
    honesty: 'live = HTTP reachable + transformer vocabulary observed. Gated portals are not counted as live adapters.'
  };
}

function markSourcesCheckedFromReports(marketWatch, reports) {
  const byCountry = {};
  (reports || []).forEach(function (r) {
    if (!r || !r.country) return;
    if (!byCountry[r.country]) byCountry[r.country] = { checked: 0, live: 0 };
    if (r.probed) byCountry[r.country].checked += 1;
    if (r.live) byCountry[r.country].live += 1;
  });
  return (marketWatch || []).map(function (row) {
    const c = byCountry[row.country];
    if (!c) return row;
    const next = Object.assign({}, row);
    next.sources_checked = Math.max(next.sources_checked || 0, c.checked);
    if (c.live > 0 && next.coverage_status === 'SOURCES_REGISTERED_ADAPTER_PENDING') {
      next.coverage_status = next.new_candidates > 0 ? 'ACTIVITY_FOUND' : 'NO_QUALIFYING_ACTIVITY_FOUND';
    }
    next.last_check = new Date().toISOString().slice(0, 10);
    next.adapter_live_count = c.live;
    return next;
  });
}

module.exports = {
  P0_SOURCE_IDS: P0_SOURCE_IDS,
  P4_SOURCE_IDS: P4_SOURCE_IDS,
  ADAPTER_SOURCE_IDS: ADAPTER_SOURCE_IDS,
  probeSource: probeSource,
  probeP0Sources: probeP0Sources,
  markSourcesCheckedFromReports: markSourcesCheckedFromReports,
  TRANSFORMER_HINT: TRANSFORMER_HINT
};
