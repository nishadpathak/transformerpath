// Netlify scheduled function: soft-freshness rebuild trigger.
// Posts to TP_BUILD_HOOK_URL when configured so curated Daily Intel,
// events Up-next, and site-stats counters cannot freeze for weeks
// between manual deploys.
//
// Schedule: twice daily — 06:00 and 18:00 UTC (netlify.toml).
// No-op without the hook env var.
exports.handler = async function () {
  const hook = process.env.TP_BUILD_HOOK_URL || process.env.BUILD_HOOK_URL || '';
  if (!hook) {
    return {
      statusCode: 204,
      body: JSON.stringify({
        ok: true,
        triggered: false,
        reason: 'TP_BUILD_HOOK_URL not set — soft freshness relies on next manual/CI deploy'
      })
    };
  }
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: 'twice-daily-rebuild',
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
