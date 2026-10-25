/* Stamp the AdSense loader and one in-content slot onto article and learn pages.
 *
 * build-dist.js calls stampHtml() while assembling dist/. Source templates are
 * left alone so the next generator run cannot drop the tag. Every other
 * published page has the loader and any manual slot removed. check-adsense.js
 * reads the same rules. consent.js does not inject a second loader.
 *
 * Article pages:
 *   knowledge/<slug>.html  — TechArticle pages from build-knowledge.js
 *   guides/<slug>/index.html — long-form buyer guides
 * Learn pages:
 *   learn.html — design course
 *   engineer-track.html — Design Engineer Track
 *   construction-guide.html — construction walkthrough linked from the course
 * Hubs, directories, tools, book stubs, pricing and checkout stay ad-free.
 */
'use strict';

const cfg = require('./adsense-config');

const SLOT_RE = /^\d{8,12}$/;
const LOADER_RE = /<script\b[^>]*\bsrc=["'][^"']*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"']*["'][^>]*>\s*<\/script>/gi;
const SLOT_RE_HTML = /<aside\b[^>]*\bdata-tp-ad="in-content"[\s\S]*?<\/aside>(?:\s*<script>[\s\S]*?<\/script>)?/gi;

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

/** Knowledge articles and long-form guides. */
function isArticlePage(rel) {
  const n = norm(rel);
  if (/^knowledge\/[^/]+\.html$/.test(n)) return true;
  if (/^guides\/[^/]+\/index\.html$/.test(n)) return true;
  return false;
}

/** Course, engineer track, and the construction walkthrough. */
function isLearnPage(rel) {
  const n = norm(rel);
  return n === 'learn.html' || n === 'engineer-track.html' || n === 'construction-guide.html';
}

function wantsAds(rel) {
  if (isSlotExcluded(rel)) return false;
  return isArticlePage(rel) || isLearnPage(rel);
}

/** One manual slot, and only where the loader is allowed. */
function wantsInContentSlot(rel) {
  return wantsAds(rel);
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

function stripAds(html) {
  return String(html || '').replace(LOADER_RE, '').replace(SLOT_RE_HTML, '');
}

function placeSlot(html, rel) {
  if (html.indexOf('data-tp-ad="in-content"') !== -1) return html;
  const slot = slotMarkup();
  const n = norm(rel);

  const marker = '<!--tp-ad-slot-->';
  const markerAt = html.indexOf(marker);
  if (markerAt >= 0) {
    return html.slice(0, markerAt) + slot + html.slice(markerAt + marker.length);
  }

  const section = html.match(/<h2\b[^>]*>[\s\S]*?<\/h2>\s*<p>[\s\S]*?<\/p>/);
  if (section) return insertAt(html, section.index + section[0].length, slot);

  const hero = html.search(/<section[^>]*class="[^"]*\bhero\b/);
  if (hero >= 0) {
    const heroEnd = html.indexOf('</section>', hero);
    if (heroEnd < 0) throw new Error(n + ' hero is unclosed');
    return insertAt(html, heroEnd + '</section>'.length, slot);
  }

  const h1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/);
  if (h1) return insertAt(html, h1.index + h1[0].length, slot);

  throw new Error('ad page has no in-content anchor: ' + n);
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
  if (!wantsAds(rel)) {
    out = stripAds(out);
  } else {
    if (headInner(out).indexOf(cfg.LOADER) === -1) {
      out = injectBeforeHeadClose(out, cfg.LOADER);
    }
    if (wantsInContentSlot(rel)) out = placeSlot(out, rel);
  }
  if (!/consent\.js/.test(out)) {
    out = injectBeforeHeadClose(out, '<script src="/consent.js" defer></script>');
  }
  return out;
}

module.exports = {
  cfg: cfg,
  isSlotExcluded: isSlotExcluded,
  isArticlePage: isArticlePage,
  isLearnPage: isLearnPage,
  wantsAds: wantsAds,
  wantsInContentSlot: wantsInContentSlot,
  slotConfigured: slotConfigured,
  stripAds: stripAds,
  stampHtml: stampHtml,
  headInner: headInner,
};
