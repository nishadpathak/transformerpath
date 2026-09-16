#!/usr/bin/env node
/**
 * Local development server for the TransformerPath static site.
 *
 * - Serves static files from the repository root (default document: index.html).
 * - Emulates Netlify Functions at /.netlify/functions/<name> by loading
 *   functions/<name>.js and invoking its exported `handler` with a
 *   Netlify-style event, then mapping the { statusCode, headers, body }
 *   result back onto the HTTP response.
 *
 * This mirrors how the deployed site (Netlify) behaves so that pages such as
 * list-company.html / sponsor.html can exercise the Stripe checkout flow
 * locally. When STRIPE_SECRET_KEY is not set, functions/create-checkout.js
 * returns a 503 with code "stripe_not_configured", which the client falls
 * back from gracefully (invoice mailto).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const FUNCTIONS_DIR = path.join(ROOT, 'functions');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8888', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-cache' }, headers || {}));
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleFunction(req, res, url) {
  const name = url.pathname.replace('/.netlify/functions/', '').split('/')[0];
  const fnPath = path.join(FUNCTIONS_DIR, name + '.js');
  if (!fs.existsSync(fnPath)) {
    return send(res, 404, JSON.stringify({ error: 'Function not found: ' + name }), {
      'Content-Type': 'application/json'
    });
  }

  let handler;
  try {
    // Fresh require each time so edits to the function are picked up on reload.
    delete require.cache[require.resolve(fnPath)];
    ({ handler } = require(fnPath));
  } catch (err) {
    console.error('Failed to load function', name, err);
    return send(res, 500, JSON.stringify({ error: 'Failed to load function: ' + err.message }), {
      'Content-Type': 'application/json'
    });
  }

  const rawBody = await readBody(req);
  const event = {
    httpMethod: req.method,
    path: url.pathname,
    headers: req.headers,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body: rawBody
  };

  try {
    const result = await handler(event, {});
    const status = (result && result.statusCode) || 200;
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      (result && result.headers) || {}
    );
    send(res, status, (result && result.body) || '', headers);
  } catch (err) {
    console.error('Function error', name, err);
    send(res, 500, JSON.stringify({ error: err.message || 'Function crashed' }), {
      'Content-Type': 'application/json'
    });
  }
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Resolve within ROOT and prevent path traversal.
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, notFoundPage(pathname), { 'Content-Type': 'text/html; charset=utf-8' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function notFoundPage(pathname) {
  return (
    '<!doctype html><meta charset="utf-8"><title>404</title>' +
    '<body style="font-family:system-ui;padding:2rem">' +
    '<h1>404 — Not Found</h1><p><code>' +
    pathname.replace(/</g, '&lt;') +
    '</code> is not in this repository.</p>' +
    '<p><a href="/index.html">Back to home</a></p></body>'
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || HOST + ':' + PORT));

  if (url.pathname.startsWith('/.netlify/functions/')) {
    return handleFunction(req, res, url).catch((err) => {
      console.error(err);
      send(res, 500, JSON.stringify({ error: 'Internal error' }), {
        'Content-Type': 'application/json'
      });
    });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed');
  }

  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  const stripeReady = process.env.STRIPE_SECRET_KEY ? 'yes' : 'no (checkout falls back to invoice)';
  console.log('TransformerPath dev server running');
  console.log('  Local:     http://localhost:' + PORT + '/');
  console.log('  Functions: http://localhost:' + PORT + '/.netlify/functions/create-checkout');
  console.log('  Stripe configured: ' + stripeReady);
});
