// Netlify scheduled function: soft-freshness rebuild trigger.
// Posts to TP_BUILD_HOOK_URL when configured so curated Daily Intel,
// events Up-next, and site-stats counters cannot freeze for weeks
// between manual deploys.
//
// Schedule: once daily — 06:00 UTC. See netlify.toml.
// No-op unless TP_BUILD_HOOK_URL is set.
function interpretHookResponse(status, contentType, text) {
  const ctype = String(contentType || '').toLowerCase();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch (e) { body = null; }
  }
  if (!(status >= 200 && status < 300) || /text\/html/.test(ctype) || (body && (body.error || body.ok === false))) {
    return { ok: false, triggered: true, updated: false, reason: 'build_hook_rejected', status: status };
  }
  return { ok: true, triggered: true, updated: true, reason: 'build_accepted', status: status };
}

exports.interpretHookResponse = interpretHookResponse;

exports.handler = async function () {
  const hook = process.env.TP_BUILD_HOOK_URL || process.env.BUILD_HOOK_URL || '';
  if (!hook) {
    console.error('daily-rebuild: TP_BUILD_HOOK_URL is not set. The scheduled rebuild did not run.');
    return {
      statusCode: 503,
      body: JSON.stringify({
        ok: false,
        triggered: false,
        reason: 'TP_BUILD_HOOK_URL not set. Twice-daily rebuild did not run.'
      })
    };
  }
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: 'daily-rebuild',
        at: new Date().toISOString()
      })
    });
    const text = await res.text();
    const verdict = interpretHookResponse(res.status, res.headers && res.headers.get && res.headers.get('content-type'), text);
    return {
      statusCode: verdict.ok ? 200 : 502,
      body: JSON.stringify(verdict)
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(e && e.message || e) })
    };
  }
};
