// Netlify scheduled function: soft-freshness rebuild trigger.
// Posts to TP_BUILD_HOOK_URL when configured so curated Daily Intel,
// events Up-next, and site-stats counters cannot freeze for weeks
// between manual deploys.
//
// Schedule: once daily — 06:00 UTC (10:00 Dubai). See netlify.toml.
// No-op unless TP_BUILD_HOOK_URL is set.
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
    return {
      statusCode: res.ok ? 200 : 502,
      body: JSON.stringify({ ok: res.ok, triggered: true, status: res.status })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(e && e.message || e) })
    };
  }
};
