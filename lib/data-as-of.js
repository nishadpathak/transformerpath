/* Visible "data as of" line for pages that publish canonical counters.
 * An updated value that is not YYYY-MM-DD is unverified and renders as —.
 */
'use strict';

function asOfDate(updated) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(updated || '')) ? String(updated) : '—';
}

function html(updated, color) {
  const date = asOfDate(updated);
  const dt = date === '—' ? '' : ' datetime="' + date + '"';
  const ink = color || 'var(--muted)';
  return '<p class="tp-data-as-of" style="color:' + ink + ';font-size:.82rem;margin:8px 0 14px">data as of <time data-stat="updated"' + dt + '>' + date + '</time></p>';
}

function stampHtml(html, updated) {
  const date = asOfDate(updated);
  return String(html).replace(/<time\b([^>]*\bdata-stat="updated"[^>]*)>([^<]*)<\/time>/gi, function (_, attrs) {
    let next = attrs;
    if (date === '—') next = next.replace(/\sdatetime="[^"]*"/i, '');
    else if (/datetime="/i.test(next)) next = next.replace(/datetime="[^"]*"/i, 'datetime="' + date + '"');
    else next += ' datetime="' + date + '"';
    return '<time' + next + '>' + date + '</time>';
  });
}

module.exports = { asOfDate: asOfDate, html: html, stampHtml: stampHtml };
