/* Core Web Vitals rewrites applied to published HTML.
 *
 * Image width/height come from the file bytes. Remote images are not given
 * guessed dimensions. The AdSense loader is normalised to the deferred tag
 * in adsense-config.js. The Travelpayouts loader stays consent-gated and
 * starts on window load.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cfg = require('../adsense-config');

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600;700&family=Syne:wght@700;800&display=swap';

const TP_LOADER = '<script>(function(){function ok(){try{return localStorage.getItem("tp-cookie-consent")==="accepted"}catch(e){return false}}' +
  'function load(){if(document.querySelector("script[src*=\'emrldtp.com/NTQ4OTM4.js\']"))return;' +
  'var s=document.createElement("script");s.defer=true;s.async=false;s.src="https://emrldtp.com/NTQ4OTM4.js?t=548938";' +
  's.setAttribute("data-cmp-ab","2");document.head.appendChild(s)}' +
  'function go(){if(document.readyState==="complete")load();else window.addEventListener("load",load,{once:true})}' +
  'if(ok()){go()}else{var h=function(e){if(e.key==="tp-cookie-consent"&&e.newValue==="accepted"){go();document.removeEventListener("storage",h)}};' +
  'document.addEventListener("storage",h)}})();</script>';

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xD8 || marker === 0xD9) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (!len || len < 2) break;
    i += 2 + len;
  }
  return null;
}

function imageSize(file) {
  let buf;
  try { buf = fs.readFileSync(file); }
  catch (e) { return null; }
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  if (buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8) return jpegSize(buf);
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const four = buf.toString('ascii', 12, 16);
    if (four === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (four === 'VP8 ' && buf.length >= 30) {
      return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
    if (four === 'VP8L' && buf.length >= 25) {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      const w = 1 + (((b1 & 0x3F) << 8) | b0);
      const h = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
      return { w: w, h: h };
    }
  }
  if (buf.length > 20 && buf.toString('utf8', 0, 200).indexOf('<svg') !== -1) {
    const text = buf.toString('utf8');
    const w = text.match(/\bwidth=["']([\d.]+)/);
    const h = text.match(/\bheight=["']([\d.]+)/);
    if (w && h) return { w: Math.round(Number(w[1])), h: Math.round(Number(h[1])) };
    const vb = text.match(/viewBox=["']\s*[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/);
    if (vb) return { w: Math.round(Number(vb[1])), h: Math.round(Number(vb[2])) };
  }
  return null;
}

function resolveLocal(rel, src, root) {
  if (!src || /^(?:https?:|data:|blob:|mailto:)/i.test(src)) return null;
  const clean = src.split('#')[0].split('?')[0];
  if (!clean) return null;
  let abs;
  if (clean.charAt(0) === '/') abs = path.join(root, clean);
  else abs = path.resolve(path.dirname(path.join(root, rel)), clean);
  if (!abs.startsWith(path.resolve(root))) return null;
  return fs.existsSync(abs) ? abs : null;
}

function tagHas(tag, attr) {
  return new RegExp('\\b' + attr + '\\s*=', 'i').test(tag);
}

// A real <img> tag. `\b` also matches the identifier `img.data` inside the
// explorer scripts (`i<img.data.length`), and the next `>` can sit hundreds
// of characters later in that script. That rewrite published
// `i<img fetchpriority="high" ...` and the 3D page died with a SyntaxError.
const IMG_TAG = /<img(?=[\s>/])[^>]*>/gi;

function mapOutsideRaw(html, fn) {
  const re = /<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    out += fn(html.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  out += fn(html.slice(last));
  return out;
}

function rewriteImages(html, rel, root, cache) {
  let index = 0;
  return mapOutsideRaw(html, function (chunk) {
    IMG_TAG.lastIndex = 0;
    return chunk.replace(IMG_TAG, function (tag) {
      index++;
      const srcM = tag.match(/\bsrc=["']([^"']+)["']/i);
      const src = srcM ? srcM[1] : '';
      const hero = index === 1 || /hero/i.test(tag) || /brand\/hero\./i.test(src);
      let next = tag;
      if (!tagHas(next, 'width') || !tagHas(next, 'height')) {
        const file = resolveLocal(rel, src, root);
        if (file) {
          if (!cache[file]) cache[file] = imageSize(file) || { w: 0, h: 0 };
          const dim = cache[file];
          if (dim.w > 0 && dim.h > 0) {
            if (!tagHas(next, 'width')) next = next.replace(/<img(?=[\s>/])/i, '<img width="' + dim.w + '"');
            if (!tagHas(next, 'height')) next = next.replace(/<img(?=[\s>/])/i, '<img height="' + dim.h + '"');
          }
        }
      }
      if (hero) {
        if (!tagHas(next, 'loading')) next = next.replace(/<img(?=[\s>/])/i, '<img loading="eager"');
        if (!tagHas(next, 'fetchpriority')) next = next.replace(/<img(?=[\s>/])/i, '<img fetchpriority="high"');
      } else if (!tagHas(next, 'loading')) {
        next = next.replace(/<img(?=[\s>/])/i, '<img loading="lazy" decoding="async"');
      }
      return next;
    });
  });
}

function scriptSrc(attrs) {
  const m = String(attrs || '').match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return m ? m[1].split('#')[0] : '';
}

// These files are called by the inline boot that follows them in the HTML.
// defer runs that boot first, so TPWebGL / THREE are missing and the homepage
// iframe reports "Interactive 3D is unavailable". They are not on the homepage
// document, so the phone still paints the poster without three.js.
function scriptKeepsParserOrder(attrs) {
  const src = scriptSrc(attrs);
  if (!src) return false;
  if (/(?:^|\/)three\.min\.js(?:\?|$)/i.test(src)) return true;
  if (/(?:^|\/)(?:tp-webgl-gate|tp-3d-core|tp-power-assembly|tp-lab-geometry|tp-lab-engine)\.js(?:\?|$)/i.test(src)) return true;
  return false;
}

function deferScripts(html) {
  return html.replace(/<script\b([^>]*)>/gi, function (full, attrs) {
    if (!/\bsrc\s*=/i.test(attrs)) return full;
    if (/\b(?:defer|async)\b/i.test(attrs)) return full;
    if (/type\s*=\s*["'](?:module|application\/ld\+json)["']/i.test(attrs)) return full;
    if (scriptKeepsParserOrder(attrs)) return full;
    return '<script defer' + attrs + '>';
  });
}

function normalizeAdsense(html) {
  const re = /<script\b[^>]*\bsrc=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"']*["'][^>]*>\s*<\/script>/gi;
  if (!re.test(html)) return html;
  if (html.indexOf(cfg.LOADER) !== -1 && html.split(cfg.LOADER).length === 2) return html;
  html = html.replace(re, '');
  return html.replace(/<\/head>/i, cfg.LOADER + '</head>');
}

function deferTravelpayouts(html) {
  if (html.indexOf('emrldtp.com/NTQ4OTM4.js') === -1) return html;
  if (html.indexOf('addEventListener("load",load') !== -1) return html;
  return html.replace(/<script>\(function\(\)\{function ok\(\)\{try\{return localStorage\.getItem\("tp-cookie-consent"\)==="accepted"\}catch\(e\)\{return false\}\}function load\(\)\{var s=document\.createElement\("script"\);s\.async=1;s\.src="https:\/\/emrldtp\.com\/NTQ4OTM4\.js\?t=548938";[\s\S]*?<\/script>/,
    TP_LOADER);
}

function preloadFonts(html, fontFiles) {
  if (html.indexOf('fonts.googleapis.com') === -1) return html;
  let extra = '';
  if (html.indexOf('fonts.gstatic.com') === -1) {
    extra += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
  }
  if (html.indexOf('rel="preload" as="style" href="' + FONT_CSS + '"') === -1 &&
      html.indexOf("rel='preload' as='style' href='" + FONT_CSS + "'") === -1) {
    extra += '<link rel="preload" as="style" href="' + FONT_CSS + '">';
  }
  (fontFiles || []).forEach(function (url) {
    if (html.indexOf(url) === -1) {
      extra += '<link rel="preload" as="font" type="font/woff2" href="' + url + '" crossorigin>';
    }
  });
  if (!extra) return html;
  return html.replace(/<\/head>/i, extra + '</head>');
}

async function latinFontFiles() {
  try {
    const res = await fetch(FONT_CSS, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' }
    });
    if (!res.ok) return [];
    const css = await res.text();
    const urls = [];
    const re = /\/\*\s*latin\s*\*\/[\s\S]*?url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/gi;
    let m;
    while ((m = re.exec(css))) {
      if (urls.indexOf(m[1]) === -1) urls.push(m[1]);
    }
    return urls.slice(0, 4);
  } catch (e) {
    return [];
  }
}

function apply(html, rel, root, cache, fontFiles) {
  html = normalizeAdsense(html);
  html = deferTravelpayouts(html);
  html = deferScripts(html);
  html = rewriteImages(html, rel, root, cache);
  html = preloadFonts(html, fontFiles);
  return html;
}

module.exports = {
  FONT_CSS: FONT_CSS,
  TP_LOADER: TP_LOADER,
  imageSize: imageSize,
  apply: apply,
  latinFontFiles: latinFontFiles,
  deferTravelpayouts: deferTravelpayouts,
  scriptKeepsParserOrder: scriptKeepsParserOrder
};
