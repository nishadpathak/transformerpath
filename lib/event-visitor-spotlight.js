'use strict';
const START = '<!-- TP_EVENT_VISITOR_SPOTLIGHT_START -->';
const END = '<!-- TP_EVENT_VISITOR_SPOTLIGHT_END -->';
const ANCHOR = '  <div class="container" style="max-width:860px">\n    <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-bottom:16px">\n      <input id="event-search"';
const KEY = 'ep-shanghai-2026';
const DETAILS = '/events/' + KEY + '/#visitor-registration';
const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function organizerUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.host === 'www.epchinashow.com' &&
      !url.username && !url.password && url.pathname.startsWith('/EP/') ? raw : '';
  } catch (_) { return ''; }
}

function applyEventVisitorSpotlight(html, event) {
  // Remove only our own generated block on rebuild. Reject a moved/ambiguous
  // search anchor rather than inserting into another section.
  const oldStart = html.indexOf(START);
  const oldEnd = html.indexOf(END);
  if (oldStart !== -1 || oldEnd !== -1) {
    if (oldStart === -1 || oldEnd < oldStart) throw new Error('Events spotlight markers are malformed');
    html = html.slice(0, oldStart) + html.slice(oldEnd + END.length + (html[oldEnd + END.length] === '\n' ? 1 : 0));
  }
  if (!event || event.id !== KEY || event.date_status !== 'CONFIRMED') return html;
  const pos = html.indexOf(ANCHOR);
  if (pos === -1 || pos !== html.lastIndexOf(ANCHOR)) throw new Error('Unable to locate unique Events search section for the visitor spotlight');
  const at = pos + ANCHOR.indexOf('\n') + 1;
  const cta = event.visitor_cta || {};
  const fallback = organizerUrl(cta.href_after);
  const campaign = organizerUrl(cta.href);
  const fallbackLabel = cta.label || 'Register for EP Shanghai';
  const block = START + `
<style>
  .event-visit-discovery{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 18px;margin:0 0 18px;padding:14px 16px;border-inline-start:3px solid var(--accent)}
  .event-visit-discovery[hidden]{display:none}
  .event-visit-discovery h2{margin:1px 0 3px;font-size:1.08rem}.event-visit-discovery p{margin:0;color:var(--muted);font-size:.88rem}.event-visit-discovery-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px}.event-visit-discovery a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;touch-action:manipulation;text-align:center}
  @media(max-width:500px){.event-visit-discovery-actions,.event-visit-discovery a{width:100%}}
</style>
<aside class="card event-visit-discovery" id="event-visit-discovery" hidden aria-labelledby="event-visit-discovery-title" data-show-close="${esc(event.end)}T15:00:00+08:00">
  <div><p>Visitor spotlight</p><h2 id="event-visit-discovery-title">EP Shanghai 2026</h2><p>3–5 December 2026 · Shanghai</p></div>
  <div class="event-visit-discovery-actions">
    <a class="btn btn-amber btn-sm" id="event-visit-discovery-cta" href="${esc(fallback || DETAILS)}" data-campaign-url="${esc(campaign)}" data-campaign-cutoff="${esc(cta.cutoff)}" data-general-label="${esc(fallbackLabel)}" data-track-event_id="${KEY}" data-track-registration_type="organiser" data-track-placement="events_hub">${fallback ? esc(fallbackLabel) : 'EP Shanghai registration details'}</a>
    <a href="${DETAILS}">Visitor details &amp; exhibitors</a>
  </div>
</aside>
<script>(function () {
  var block = document.getElementById('event-visit-discovery');
  var link = document.getElementById('event-visit-discovery-cta');
  if (!block || !link) return;
  var fallback = link.getAttribute('href');
  var campaign = link.dataset.campaignUrl;
  var cutoff = Date.parse(link.dataset.campaignCutoff);
  var end = Date.parse(block.dataset.showClose);
  var timer;
  function refresh() {
    clearTimeout(timer);
    var now = Date.now();
    var left = end - now;
    block.hidden = !Number.isFinite(left) || left <= 0;
    if (block.hidden) return;
    var active = !!campaign && Number.isFinite(cutoff) && now <= cutoff;
    link.href = active ? campaign : fallback;
    link.setAttribute('data-track-registration_type', active ? 'organiser_campaign' : 'organiser');
    if (active || fallback.startsWith('https://')) {
      link.textContent = active ? 'Register for EP Shanghai' : link.dataset.generalLabel || 'Check registration with the organiser';
      link.setAttribute('data-track', 'event_registration_click');
    } else {
      link.textContent = 'EP Shanghai registration details';
      link.removeAttribute('data-track');
    }
    timer = setTimeout(refresh, Math.min(left, active ? cutoff - now + 1 : left, 2147483647));
  }
  refresh();
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
})();</script>
` + END + '\n';
  return html.slice(0, at) + block + html.slice(at);
}
module.exports = { applyEventVisitorSpotlight };
