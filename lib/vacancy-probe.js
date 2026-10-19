/* Fetch a vacancy URL and record only the status. Private and link-local
 * addresses are refused before any request. Redirects are checked one hop
 * at a time and stop at a non-public host.
 */
'use strict';
const dns = require('dns').promises;
const net = require('net');

function isBlockedAddress(ip) {
  var value = String(ip || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (value.indexOf('::ffff:') === 0) return isBlockedAddress(value.slice(7));
  if (net.isIP(value) === 4) {
    var p = value.split('.').map(Number);
    if (p.length !== 4 || p.some(function (n) { return Number.isNaN(n); })) return true;
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
    if (p[0] === 192 && p[1] === 0 && (p[2] === 0 || p[2] === 2)) return true;
    if (p[0] >= 224) return true;
    return false;
  }
  if (net.isIP(value) === 6) {
    if (value === '::1' || value === '::') return true;
    if (/^f[cd]/.test(value)) return true;
    if (/^fe[89ab]/.test(value)) return true;
    return false;
  }
  return true;
}

function isBlockedHost(hostname) {
  var host = String(hostname || '').toLowerCase().replace(/\.+$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === 'localhost.localdomain' || host === 'metadata.google.internal') return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (net.isIP(host)) return isBlockedAddress(host);
  return false;
}

function parseUrl(value) {
  var u;
  try { u = new URL(String(value || '').trim()); }
  catch (e) { return null; }
  if (u.username || u.password) return null;
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isBlockedHost(u.hostname)) return null;
  return u;
}

async function lookupPublic(hostname, lookup) {
  var fn = lookup || dns.lookup;
  var records = await fn(hostname, { all: true, verbatim: true });
  var list = Array.isArray(records) ? records : [records];
  if (!list.length) {
    var empty = new Error('vacancy host did not resolve');
    empty.code = 'unresolved';
    throw empty;
  }
  list.forEach(function (rec) {
    var address = rec && (rec.address || rec);
    if (isBlockedAddress(address)) {
      var blocked = new Error('vacancy host is not a public address');
      blocked.code = 'blocked';
      throw blocked;
    }
  });
}

function vacancyLooksClosed(url, body) {
  var path = '';
  try { path = new URL(String(url || '')).pathname.toLowerCase(); }
  catch (e) { path = String(url || '').toLowerCase(); }
  if (/jobnotfound|job-not-found|not-found|notfound|\/404(?:\/|$)|position-closed|posting-closed/.test(path)) return true;
  var text = String(body || '').slice(0, 16000);
  return /job\s+not\s+found|page\s+not\s+found|no longer available|no longer exists|position (?:has been|is) (?:filled|closed)|this (?:job|position|vacancy) (?:is|has been) closed|404 not found/i.test(text);
}

async function bodySnippet(response) {
  if (!response) return '';
  if (response.body && typeof response.body.getReader === 'function') {
    var reader = response.body.getReader();
    var chunks = [];
    var size = 0;
    while (size < 16000) {
      var step = await reader.read();
      if (step.done) break;
      chunks.push(Buffer.from(step.value));
      size += step.value.byteLength || step.value.length || 0;
    }
    try { await reader.cancel(); } catch (e) { /* the status and the prefix are enough */ }
    return Buffer.concat(chunks).toString('utf8').slice(0, 16000);
  }
  if (typeof response.text === 'function') {
    try { return String(await response.text()).slice(0, 16000); }
    catch (e) { return ''; }
  }
  return '';
}

function header(response, name) {
  if (!response || !response.headers) return '';
  if (typeof response.headers.get === 'function') return response.headers.get(name) || '';
  return response.headers[name] || response.headers[name.toLowerCase()] || '';
}

async function drain(response) {
  if (response && response.body && typeof response.body.cancel === 'function') {
    try { await response.body.cancel(); } catch (e) { /* the status is enough */ }
  }
}

async function probeVacancy(url, options) {
  var opts = options || {};
  var fetchImpl = opts.fetch || globalThis.fetch;
  var maxRedirects = opts.maxRedirects == null ? 3 : opts.maxRedirects;
  var timeoutMs = opts.timeoutMs || 8000;
  var current = String(url || '').trim();
  if (!parseUrl(current)) {
    return { ok: false, status: 0, final_url: current, error: 'vacancy URL must be a public http(s) address' };
  }
  for (var hop = 0; hop <= maxRedirects; hop++) {
    var parsed = parseUrl(current);
    if (!parsed) return { ok: false, status: 0, final_url: current, error: 'vacancy URL must be a public http(s) address' };
    try {
      await lookupPublic(parsed.hostname, opts.lookup);
    } catch (e) {
      var lookupError = e && e.code === 'blocked' ? 'vacancy host is not a public address' : 'vacancy host did not resolve';
      return { ok: false, status: 0, final_url: current, error: lookupError };
    }
    var response;
    try {
      response = await fetchImpl(parsed.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: opts.signal || AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'TransformerPathVacancyCheck/1.0' }
      });
    } catch (e) {
      return { ok: false, status: 0, final_url: current, error: 'vacancy URL could not be reached' };
    }
    var status = Number(response && response.status) || 0;
    if (status >= 300 && status < 400) {
      var location = header(response, 'location');
      await drain(response);
      if (!location || hop === maxRedirects) {
        return { ok: false, status: status, final_url: current, error: 'vacancy URL redirected too many times' };
      }
      try { current = new URL(location, parsed).toString(); }
      catch (e) { return { ok: false, status: status, final_url: current, error: 'vacancy URL redirected to an invalid address' }; }
      continue;
    }
    var snippet = status >= 200 && status < 400 ? await bodySnippet(response) : '';
    if (!snippet) await drain(response);
    var closed = vacancyLooksClosed(current, snippet);
    var ok = status >= 200 && status < 400 && !closed;
    return {
      ok: ok,
      status: status,
      final_url: current,
      error: ok ? '' : (closed ? 'vacancy URL is not an open posting' : 'vacancy URL returned HTTP ' + status)
    };
  }
  return { ok: false, status: 0, final_url: current, error: 'vacancy URL redirected too many times' };
}

module.exports = {
  isBlockedAddress: isBlockedAddress,
  isBlockedHost: isBlockedHost,
  vacancyLooksClosed: vacancyLooksClosed,
  probeVacancy: probeVacancy
};
