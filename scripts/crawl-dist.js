#!/usr/bin/env node
/* Crawl a built dist the way Netlify serves it: files, then _redirects
 * and netlify.toml rules. Records status, canonical, 404s and redirect chains.
 *
 * Run after the site build: node scripts/crawl-dist.js [dist] [port]
 */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');

const DIST = path.resolve(process.argv[2] || 'dist');
const PORT = Number(process.argv[3] || 8765);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const HOST = 'https://transformerpath.com';

function readRedirectsFile(file) {
  if (!fs.existsSync(file)) return [];
  const rules = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') return;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) return;
    const status = parseInt(parts[2], 10);
    rules.push({
      from: parts[0],
      to: parts[1],
      status: status || 301,
      force: /!$/.test(parts[2])
    });
  });
  return rules;
}

function readTomlRedirects(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const rules = [];
  const blocks = text.split(/\[\[redirects\]\]/);
  blocks.slice(1).forEach(function (block) {
    const from = (block.match(/\bfrom\s*=\s*"([^"]+)"/) || [])[1];
    const to = (block.match(/\bto\s*=\s*"([^"]+)"/) || [])[1];
    const status = parseInt((block.match(/\bstatus\s*=\s*(\d+)/) || [])[1] || '301', 10);
    const force = /\bforce\s*=\s*true/.test(block);
    if (from && to) rules.push({ from: from, to: to, status: status, force: force });
  });
  return rules;
}

function compile(rule) {
  const raw = rule.from;
  const splat = raw.indexOf('*') !== -1 || raw.indexOf(':splat') !== -1;
  let pattern = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '(.*)').replace(/:splat/g, '(.*)');
  if (pattern.charAt(0) !== '^') pattern = '^' + pattern;
  pattern += '$';
  return { re: new RegExp(pattern), splat: splat, rule: rule };
}

function applyRules(urlPath, rules, fileExists) {
  for (let i = 0; i < rules.length; i++) {
    const item = rules[i];
    const m = item.re.exec(urlPath);
    if (!m) continue;
    if (!item.rule.force && fileExists(urlPath)) continue;
    let dest = item.rule.to;
    if (m[1] != null) dest = dest.replace(/:splat/g, m[1]);
    return { status: item.rule.status, to: dest, from: item.rule.from };
  }
  return null;
}

function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean.indexOf('..') !== -1) return '';
  if (clean === '/') return path.join(DIST, 'index.html');
  const rel = clean.replace(/^\//, '');
  const direct = path.join(DIST, rel);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  if (clean.endsWith('/')) {
    const idx = path.join(DIST, rel, 'index.html');
    if (fs.existsSync(idx)) return idx;
  }
  return '';
}

function existsPath(urlPath) {
  return !!fileFor(urlPath);
}

const compiled = readTomlRedirects(path.join(DIST, '..', 'netlify.toml'))
  .concat(readRedirectsFile(path.join(DIST, '_redirects')))
  .map(compile);

function canonicalOf(html) {
  const a = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (a) return a[1];
  const b = html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return b ? b[1] : '';
}

function noindexOf(html) {
  if (/http-equiv=["']refresh["']/i.test(html)) return true;
  const robots = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
  return !!(robots && /noindex/i.test(robots[0]));
}

function linksOf(html, pagePath) {
  const out = [];
  const re = /\shref=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    let href = m[1].split('#')[0];
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      if (href.indexOf(HOST) !== 0) continue;
      href = href.slice(HOST.length) || '/';
    } else if (href.charAt(0) !== '/') {
      href = path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), href));
      if (href.charAt(0) !== '/') href = '/' + href;
    }
    href = href.split('?')[0];
    if (href.indexOf('/events/') === 0 || href === '/events' || href === '/events.html' || pagePath.indexOf('/events') === 0) {
      out.push(href);
    }
  }
  return out;
}

function startServer() {
  const server = http.createServer(function (req, res) {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const redir = applyRules(urlPath, compiled, existsPath);
    if (redir && redir.status >= 300 && redir.status < 400) {
      res.writeHead(redir.status, { Location: redir.to });
      res.end();
      return;
    }
    if (redir && redir.status === 404) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('redirect 404');
      return;
    }
    const target = (redir && redir.status === 200) ? redir.to : urlPath;
    let file = fileFor(target);
    if (!file && !target.endsWith('/') && fileFor(target + '/')) {
      res.writeHead(301, { Location: target + '/' });
      res.end();
      return;
    }
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('missing');
      return;
    }
    const ext = path.extname(file);
    const type = ext === '.html' ? 'text/html' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(function (resolve) { server.listen(PORT, '127.0.0.1', function () { resolve(server); }); });
}

function fetchPath(urlPath) {
  return new Promise(function (resolve, reject) {
    const req = http.get(ORIGIN + urlPath, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({
          status: res.statusCode,
          location: res.headers.location || '',
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });
    req.on('error', reject);
  });
}

async function follow(start) {
  const chain = [];
  let current = start;
  for (let hop = 0; hop < 8; hop++) {
    const res = await fetchPath(current);
    chain.push({ path: current, status: res.status, location: res.location });
    if (res.status >= 300 && res.status < 400 && res.location) {
      current = res.location.charAt(0) === '/' ? res.location : res.location;
      if (/^https?:\/\//.test(current)) {
        if (current.indexOf(HOST) === 0) current = current.slice(HOST.length) || '/';
        else return { chain: chain, finalStatus: res.status, external: current, html: '' };
      }
      continue;
    }
    return { chain: chain, finalStatus: res.status, html: res.body, finalPath: current };
  }
  return { chain: chain, finalStatus: 0, html: '', finalPath: current, loop: true };
}

function seed() {
  const urls = new Set();
  const sm = path.join(DIST, 'sitemap.xml');
  if (fs.existsSync(sm)) {
    const xml = fs.readFileSync(sm, 'utf8');
    const locs = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
    locs.forEach(function (row) {
      const loc = row.replace(/<\/?loc>/g, '');
      if (loc.indexOf(HOST) !== 0) return;
      urls.add(loc.slice(HOST.length) || '/');
    });
  }
  compiled.forEach(function (item) {
    if (item.rule.from.indexOf('*') !== -1) return;
    if (item.rule.from.indexOf('/events') === 0) urls.add(item.rule.from);
  });
  return urls;
}

async function main() {
  if (!fs.existsSync(DIST)) {
    console.error('missing dist: ' + DIST);
    process.exit(1);
  }
  const server = await startServer();
  const queue = Array.from(seed());
  const seen = new Set();
  const problems = [];
  const redirects = [];
  const summary = { crawled: 0, ok: 0, redirects: 0, missing: 0, chains: 0, canonical: 0, noindexInSitemap: 0 };
  const sitemap = new Set(queue.filter(function (u) {
    return compiled.every(function (item) { return item.rule.from !== u; }) || fs.existsSync(path.join(DIST, 'sitemap.xml')) && fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8').indexOf(HOST + u) !== -1;
  }));
  const smText = fs.existsSync(path.join(DIST, 'sitemap.xml')) ? fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8') : '';
  while (queue.length) {
    const urlPath = queue.shift();
    if (seen.has(urlPath)) continue;
    seen.add(urlPath);
    summary.crawled++;
    let result;
    try { result = await follow(urlPath); }
    catch (e) { problems.push('error ' + urlPath + ' ' + e.message); continue; }
    const hops = result.chain.filter(function (h) { return h.status >= 300 && h.status < 400; });
    const inSitemap = smText.indexOf('<loc>' + HOST + (urlPath === '/' ? '/' : urlPath) + '</loc>') !== -1;
    if (result.finalStatus === 404) {
      summary.missing++;
      problems.push('404 ' + urlPath + ' chain ' + result.chain.map(function (h) { return h.status + ' ' + h.path; }).join(' -> '));
      continue;
    }
    if (hops.length) {
      summary.redirects++;
      redirects.push(result.chain.map(function (h) { return h.status + ' ' + h.path; }).join(' -> '));
      if (hops.length > 1) {
        summary.chains++;
        problems.push('chain ' + result.chain.map(function (h) { return h.status + ' ' + h.path; }).join(' -> '));
      }
    }
    if (result.finalStatus === 200 && /\.html$|\/$/.test(result.finalPath || urlPath) && result.html && result.html.indexOf('<html') !== -1) {
      const canon = canonicalOf(result.html);
      const noindex = noindexOf(result.html);
      if (inSitemap && noindex) {
        summary.noindexInSitemap++;
        problems.push('sitemap noindex ' + urlPath);
      }
      if (inSitemap && canon) {
        const self = HOST + (result.finalPath || urlPath);
        const norm = function (s) {
          try {
            const u = new URL(s);
            let p = u.pathname;
            if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length);
            return u.origin + p;
          } catch (e) { return s; }
        };
        if (norm(canon) !== norm(self)) {
          summary.canonical++;
          problems.push('canonical ' + urlPath + ' -> ' + canon);
        }
      }
      if (hops.length === 0) summary.ok++;
      if ((urlPath.indexOf('/events') === 0 || inSitemap) && result.html) {
        linksOf(result.html, result.finalPath || urlPath).forEach(function (href) {
          if (!seen.has(href) && queue.indexOf(href) === -1 && href.indexOf('/events') === 0) queue.push(href);
        });
      }
    } else if (result.finalStatus === 200) summary.ok++;
  }
  server.close();
  const report = {
    dist: DIST,
    summary: summary,
    redirects: redirects,
    problems: problems
  };
  const outDir = '/opt/cursor/artifacts';
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'crawl-dist.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  console.log('problems ' + problems.length);
  problems.slice(0, 40).forEach(function (p) { console.log(p); });
  if (problems.length > 40) console.log('... ' + (problems.length - 40) + ' more in /opt/cursor/artifacts/crawl-dist.json');
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
