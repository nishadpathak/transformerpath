/* functions/watchlist-alerts.js — twice-daily GCC watchlist digest.
 *
 * Schedule: 30 6,18 * * * (netlify.toml) — after the rebuild hook window.
 *
 * Loads active subscriptions from Supabase (tp_intel_alert_subscriptions),
 * matches against the live intel feed (CONFIRMED / SUPPORTED GCC items),
 * and emails digests via Resend.
 *
 * Also supports ALERT_SUBSCRIBERS env JSON bootstrap:
 *   [{"email":"a@b.com","presets":["DEWA","MEWRE"],"keywords":"dewa,mewre"}]
 *
 * Honest no-ops when RESEND_API_KEY missing or no subscribers.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sb = require('./lib/supabase-server');

const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const RESEND_FROM = (process.env.RESEND_FROM || 'TransformerPath <onboarding@resend.dev>').trim();
const FEED_URL = (process.env.TP_INTEL_FEED_URL || 'https://transformerpath.com/data/intel-feed-ui.json').trim();

const PRESET_KW = {
  DEWA: 'dewa,dubai electricity',
  Etimad: 'etimad,منافسة,saudi',
  MEWRE: 'mewre,kuwait,ministry of electricity',
  KAHRAMAA: 'kahramaa,qatar,km.qa',
  Nama: 'nama,oman distribution',
  OETC: 'oetc,oman grid,omangrid,omangrid.com'
};

function readLocalFeed() {
  const candidates = [
    path.join(__dirname, '..', 'data', 'intel-feed-ui.json'),
    path.join(__dirname, '..', 'dist', 'data', 'intel-feed-ui.json'),
    path.join(process.cwd(), 'data', 'intel-feed-ui.json')
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      return JSON.parse(fs.readFileSync(candidates[i], 'utf8'));
    } catch (e) { /* next */ }
  }
  return null;
}

async function loadFeed() {
  const local = readLocalFeed();
  if (local && Array.isArray(local.posts) && local.posts.length) return local;
  try {
    const res = await fetch(FEED_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('feed fetch', e && e.message);
  }
  return { posts: [] };
}

async function loadSubscribers() {
  const out = [];
  const boot = process.env.ALERT_SUBSCRIBERS || '';
  if (boot) {
    try {
      const arr = JSON.parse(boot);
      (arr || []).forEach(function (s) {
        if (s && s.email) out.push({
          email: String(s.email).toLowerCase(),
          presets: s.presets || [],
          keywords: s.keywords || ''
        });
      });
    } catch (e) {
      console.error('ALERT_SUBSCRIBERS parse', e.message);
    }
  }
  if (sb.isConfigured()) {
    try {
      const { data, error } = await sb.client()
        .from('tp_intel_alert_subscriptions')
        .select('email,presets,keywords,active')
        .eq('active', true);
      if (error) console.error('supabase select', error.message);
      else (data || []).forEach(function (row) {
        out.push({
          email: String(row.email || '').toLowerCase(),
          presets: row.presets || [],
          keywords: row.keywords || ''
        });
      });
    } catch (e) {
      console.error('supabase', e && e.message);
    }
  }
  // Dedupe by email (last wins)
  const by = {};
  out.forEach(function (s) { if (s.email) by[s.email] = s; });
  return Object.keys(by).map(function (k) { return by[k]; });
}

function keywordBlob(sub) {
  const parts = [];
  (sub.presets || []).forEach(function (p) {
    parts.push(p);
    if (PRESET_KW[p]) parts.push(PRESET_KW[p]);
  });
  if (sub.keywords) parts.push(sub.keywords);
  return parts.join(',').toLowerCase().split(/[,|]/).map(function (s) {
    return s.trim();
  }).filter(Boolean);
}

function matchPosts(posts, keywords) {
  return (posts || []).filter(function (p) {
    const grade = String(p.cls || p.evidence_grade || '').toUpperCase();
    if (grade && grade !== 'CONFIRMED' && grade !== 'SUPPORTED' && grade !== 'PIPELINE') {
      // Still allow CONFIRMED-less GCC tenders with region GCC
    }
    const prefer = !grade || grade === 'CONFIRMED' || grade === 'SUPPORTED' || grade === 'PIPELINE';
    if (!prefer) return false;
    const region = String(p.region || '').toUpperCase();
    const text = [p.headline, p.soWhat, p.src, p.buyer, p.region, p.url].join(' ').toLowerCase();
    const isGcc = region === 'GCC' || /gcc|dewa|etimad|mewre|kahramaa|kuwait|oman|qatar|saudi|bahrain|nama|oetc/.test(text);
    if (!isGcc) return false;
    return keywords.some(function (k) { return k.length >= 3 && text.indexOf(k) >= 0; });
  }).slice(0, 12);
}

async function sendMail(to, subject, text) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'not_configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + RESEND_API_KEY
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject: subject, text: text })
  });
  if (!res.ok) {
    console.error('Resend', res.status, await res.text());
    return { sent: false, reason: 'provider_error' };
  }
  return { sent: true };
}

exports.handler = async function () {
  if (!RESEND_API_KEY) {
    return {
      statusCode: 204,
      body: JSON.stringify({ ok: true, sent: 0, reason: 'RESEND_API_KEY not set' })
    };
  }
  const subs = await loadSubscribers();
  if (!subs.length) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent: 0, reason: 'no_subscribers' })
    };
  }
  const feed = await loadFeed();
  const posts = feed.posts || [];
  let sent = 0;
  const details = [];

  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const kws = keywordBlob(sub);
    const hits = matchPosts(posts, kws);
    if (!hits.length) {
      details.push({ email: sub.email, matches: 0 });
      continue;
    }
    const lines = [];
    lines.push('GCC transformer alerts — ' + new Date().toISOString().slice(0, 10));
    lines.push('Presets: ' + (sub.presets || []).join(', '));
    lines.push('');
    hits.forEach(function (h, n) {
      lines.push((n + 1) + '. ' + (h.headline || h.title || '(untitled)') +
        (h.cls ? ' [' + h.cls + ']' : '') +
        (h.value ? ' — ' + h.value : ''));
      if (h.url) lines.push('   ' + h.url);
    });
    lines.push('');
    lines.push('Full desk: https://transformerpath.com/intel.html');
    lines.push('Manage watchlist: https://transformerpath.com/intel.html#tp-watchlists');
    const r = await sendMail(
      sub.email,
      'TransformerPath — ' + hits.length + ' GCC tender match' + (hits.length > 1 ? 'es' : ''),
      lines.join('\n')
    );
    if (r.sent) sent++;
    details.push({ email: sub.email, matches: hits.length, sent: r.sent });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      subscribers: subs.length,
      feed_posts: posts.length,
      sent: sent,
      details: details
    })
  };
};
