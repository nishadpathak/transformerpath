/* Stamp the AdSense loader, and at most one in-content slot, onto published HTML.
 *
 * build-dist.js calls stampHtml() while assembling dist/. Source templates are
 * left alone so the next generator run cannot drop the tag. check-adsense.js
 * reads the same rules.
 */
'use strict';

const cfg = require('./adsense-config');

const SLOT_RE = /^\d{8,12}$/;

function norm(rel) {
  return String(rel || '').split('\\').join('/');
}

/** Checkout, pricing, admin and login pages never get a manual slot. */
function isSlotExcluded(rel) {
  const n = norm(rel);
  if (/(^|\/)admin(\/|$)/.test(n)) return true;
  if (/(^|\/)admin\.html$/.test(n)) return true;
  if (/(^|\/)pricing\.html$/.test(n)) return true;
  if (/(^|\/)[^/]*checkout[^/]*\.html$/.test(n)) return true;
  if (/(^|\/)[^/]*login[^/]*\.html$/.test(n)) return true;
  return false;
}

/** Knowledge articles, the intel list, and the directory lists. */
function wantsInContentSlot(rel) {
  const n = norm(rel);
  if (isSlotExcluded(n)) return false;
  if (/^knowledge\/[^/]+\.html$/.test(n)) return true;
  if (n === 'intel.html') return true;
  if (n === 'directory.html' || n === 'manufacturers.html') return true;
  if (n === 'buy-early/index.html' || n === 'spare-capacity/index.html') return true;
  if (n === 'tools/dga/index.html') return true;
  return false;
}

function slotConfigured() {
  return SLOT_RE.test(cfg.INCONTENT_SLOT);
}

function slotMarkup() {
  const pending = !slotConfigured();
  const asideAttrs = pending
    ? ' class="tp-ad tp-ad-collapsed" data-tp-ad="in-content" data-tp-ad-pending="1" hidden'
    : ' class="tp-ad" data-tp-ad="in-content"';
  return [
    '<aside' + asideAttrs + ' aria-label="Advertisement">',
    '<style>',
    '.tp-ad{margin:28px auto;max-width:860px;padding:14px 0 6px;clear:both;',
    'border-top:1px solid var(--border,#23415e);border-bottom:1px solid var(--border,#23415e);text-align:center}',
    '.tp-ad-label{margin:0 0 8px;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;',
    'color:var(--muted,#9fb0c4);font-weight:700}',
    '.tp-ad-collapsed,.tp-ad[hidden],.tp-ad:has(ins.adsbygoogle[data-ad-status="unfilled"]){display:none !important}',
    '.tp-ad ins.adsbygoogle{min-height:0}',
    '</style>',
    '<p class="tp-ad-label">Advertisement</p>',
    '<ins class="adsbygoogle" style="display:block" data-ad-client="' + cfg.CLIENT + '"',
    ' data-ad-slot="' + cfg.INCONTENT_SLOT + '" data-ad-format="auto" data-full-width-responsive="true"></ins>',
    '</aside>',
    '<script>',
    '(function(){',
    'var root=document.currentScript&&document.currentScript.previousElementSibling;',
    'if(!root||root.getAttribute("data-tp-ad")!=="in-content")return;',
    'var ins=root.querySelector("ins.adsbygoogle");',
    'var slot=ins&&ins.getAttribute("data-ad-slot");',
    'function collapse(){root.classList.add("tp-ad-collapsed");root.setAttribute("hidden","");}',
    'if(!/^\\d{8,12}$/.test(slot||"")){collapse();return;}',
    'root.removeAttribute("hidden");root.classList.remove("tp-ad-collapsed");',
    'try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}',
    'catch(e){collapse();return;}',
    'function watch(){if(ins&&ins.getAttribute("data-ad-status")==="unfilled")collapse();}',
    'if(window.MutationObserver&&ins)new MutationObserver(watch).observe(ins,{attributes:true,attributeFilter:["data-ad-status"]});',
    'window.setTimeout(watch,4000);',
    '})();',
    '</script>',
  ].join('');
}

function injectBeforeHeadClose(html, snippet) {
  const m = /<\/head>/i.exec(html);
  if (!m) {
    const err = new Error('published page has no </head>');
    err.code = 'NO_HEAD';
    throw err;
  }
  return html.slice(0, m.index) + snippet + html.slice(m.index);
}

function insertAt(html, index, snippet) {
  return html.slice(0, index) + snippet + html.slice(index);
}

function placeSlot(html, rel) {
  if (html.indexOf('data-tp-ad="in-content"') !== -1) return html;
  const slot = slotMarkup();
  const n = norm(rel);

  if (n.indexOf('knowledge/') === 0) {
    const m = html.match(/<h2\b[^>]*>[\s\S]*?<\/h2>\s*<p>[\s\S]*?<\/p>/);
    if (!m) throw new Error('knowledge article has no in-content anchor: ' + n);
    return insertAt(html, m.index + m[0].length, slot);
  }

  if (n === 'intel.html') {
    // Outside #intel-timeline. intel-feed-ui.js replaces that node's innerHTML.
    const timeline = html.indexOf('<div id="intel-timeline"');
    if (timeline < 0) throw new Error('intel list has no #intel-timeline');
    return insertAt(html, timeline, slot);
  }

  if (n === 'directory.html') {
    const root = html.indexOf('<div id="directoryRoot">');
    if (root < 0) throw new Error('directory list has no #directoryRoot');
    return insertAt(html, root, slot);
  }

  if (n === 'tools/dga/index.html') {
    const hero = html.search(/<section[^>]*class="[^"]*\bhero\b/);
    if (hero < 0) throw new Error('DGA tool has no hero');
    const heroEnd = html.indexOf('</section>', hero);
    if (heroEnd < 0) throw new Error('DGA tool hero is unclosed');
    return insertAt(html, heroEnd + '</section>'.length, slot);
  }

  if (n === 'manufacturers.html') {
    const marker = '<!--/SSR:mfg-count-->';
    const i = html.indexOf(marker);
    if (i < 0) throw new Error('manufacturer directory has no count marker');
    const end = html.indexOf('</p>', i);
    if (end < 0) throw new Error('manufacturer directory count is unclosed');
    return insertAt(html, end + 4, slot);
  }

  if (n === 'buy-early/index.html' || n === 'spare-capacity/index.html') {
    const marker = '<!--tp-ad-slot-->';
    const i = html.indexOf(marker);
    if (i < 0) throw new Error(n + ' has no in-content ad marker');
    return html.slice(0, i) + slot + html.slice(i + marker.length);
  }

  return html;
}

function headInner(html) {
  const open = html.search(/<head\b/i);
  const close = html.search(/<\/head>/i);
  if (open < 0 || close < 0 || close < open) return '';
  return html.slice(open, close);
}

/**
 * @param {string} html
 * @param {string} rel path relative to the publish root
 * @returns {string}
 */
function stampHtml(html, rel) {
  let out = html;
  if (headInner(out).indexOf(cfg.LOADER) === -1) {
    out = injectBeforeHeadClose(out, cfg.LOADER);
  }
  if (!/consent\.js/.test(out)) {
    out = injectBeforeHeadClose(out, '<script src="/consent.js" defer></script>');
  }
  if (wantsInContentSlot(rel)) out = placeSlot(out, rel);
  return out;
}

module.exports = {
  cfg: cfg,
  isSlotExcluded: isSlotExcluded,
  wantsInContentSlot: wantsInContentSlot,
  slotConfigured: slotConfigured,
  stampHtml: stampHtml,
  headInner: headInner,
};
