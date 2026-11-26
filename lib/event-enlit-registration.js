'use strict';

const ID = 'enlit-europe-2027';
const EDITION = '/events/' + ID + '/';
const PARIS = 'https://www.enlit.world/enlit-europe/pre-register';
const MEMBER = 'https://www.enlit.world/register';
const RECAP = 'https://www.enlit.world/library/grid-transformation-insights-and-takeaways-from-enlit-europe-2026';
const START = '<!-- TP_ENLIT_EUROPE_START -->';
const END = '<!-- TP_ENLIT_EUROPE_END -->';
const CONTAINER = '  <div class="container" style="max-width:860px">\n';
const SEARCH = '    <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-bottom:16px">\n      <input id="event-search"';

function active(event, today) {
  return event && event.id === ID && event.date_status === 'CONFIRMED' &&
    event.city === 'Paris' && event.start === '2027-11-16' &&
    event.end === '2027-11-18' && today <= event.end;
}

function registration(event, today, placement) {
  if (!active(event, today)) return '';
  const hub = placement === 'events_hub';
  return `<section class="card" id="enlit-registration" aria-labelledby="enlit-registration-title" style="margin:16px 0;padding:16px;border-inline-start:3px solid var(--accent)">
  <p style="margin:0 0 4px;color:var(--muted);font-size:.85rem">Industry event spotlight</p>
  <h2 id="enlit-registration-title" style="margin:0 0 8px">${hub ? 'Enlit Europe 2027 · Paris' : 'Pre-register for Enlit Europe 2027'}</h2>
  <p>16–18 November 2027 · Paris, France. Explore distribution grid planning, voltage management and related technologies. Enlit’s pre-registration form is an interest list: it lets you know when official event registration opens. It does not issue a ticket.</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center">
    <a class="btn btn-amber btn-sm" style="min-height:44px;white-space:normal" href="${PARIS}" data-track="event_registration_click" data-track-event_id="${ID}" data-track-registration_type="organiser" data-track-placement="${placement}">Pre-register with Enlit</a>
    ${hub ? '<a href="' + EDITION + '#enlit-registration" style="display:inline-flex;align-items:center;min-height:44px">Event details</a>' : ''}
  </div>
  <p style="margin:10px 0 0;color:var(--muted);font-size:.88rem"><a href="${RECAP}">Vienna 2026 grid recap</a> · <a href="${MEMBER}">Join Enlit World free</a> for member-only recaps. Membership is separate from event registration.</p>
</section>`;
}

function applyEnlitRegistration(html, event, today) {
  const before = html.indexOf(START), after = html.indexOf(END);
  if (before >= 0 || after >= 0) {
    if (before < 0 || after < before || before !== html.lastIndexOf(START) || after !== html.lastIndexOf(END)) {
      throw new Error('Malformed Enlit event spotlight markers');
    }
    html = html.slice(0, before) + html.slice(after + END.length).replace(/^\n/, '');
  }
  const block = registration(event, today, 'events_hub');
  if (!block) return html;
  const search = html.indexOf(SEARCH);
  const index = search < 0 ? -1 : html.lastIndexOf(CONTAINER, search);
  if (index < 0 || search !== html.lastIndexOf(SEARCH)) throw new Error('Expected exactly one Events search anchor');
  return html.slice(0, index) + START + '\n<div class="container" style="max-width:860px">\n' +
    block + '\n</div>\n' + END + '\n' + html.slice(index);
}

module.exports = { registration, applyEnlitRegistration };
