#!/usr/bin/env node
'use strict';

/**
 * Civitai Explorer — serveur local.
 *
 * Deux rôles :
 *   1. servir l'interface statique (dossier public/)
 *   2. relayer les appels vers l'API Civitai (par défaut https://civitai.red)
 *      pour contourner le CORS et garder la clé d'API côté serveur.
 *
 * Aucune dépendance : Node 18+ suffit (http + fetch natifs).
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const BASE_URL = (process.env.CIVITAI_BASE_URL || 'https://civitai.red').replace(/\/+$/, '');
const API_KEY = process.env.CIVITAI_API_KEY || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const REQUEST_TIMEOUT_MS = Number(process.env.CIVITAI_TIMEOUT_MS || 30000);
const CACHE_TTL_MS = Number(process.env.CIVITAI_CACHE_TTL_MS || 60000);
const CACHE_MAX_ENTRIES = 200;

// Chemins autorisés sur l'API distante : on ne veut pas d'un proxy ouvert.
const ALLOWED_PATH = /^\/api\/v1\/(models|images|creators|tags|model-versions)(\/[A-Za-z0-9._%-]+)*\/?$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// --- petit cache mémoire (TTL) pour éviter de marteler l'API ---------------
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  // remise en tête (LRU approximatif)
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { ...value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --- helpers --------------------------------------------------------------
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// --- proxy API ------------------------------------------------------------
async function handleApiProxy(req, res, url) {
  // /api/civitai/models?limit=20  ->  {BASE_URL}/api/v1/models?limit=20
  const remotePath = '/api/v1/' + url.pathname.replace(/^\/api\/civitai\/?/, '');
  if (!ALLOWED_PATH.test(remotePath)) {
    return sendJson(res, 400, { error: `Chemin d'API non autorisé : ${remotePath}` });
  }

  const target = new URL(BASE_URL + remotePath);
  for (const [key, value] of url.searchParams) {
    if (value !== '') target.searchParams.append(key, value);
  }

  const key = API_KEY || req.headers['x-civitai-key'] || '';
  const cacheKey = target.toString() + (key ? '#auth' : '');
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.writeHead(cached.status, {
      'content-type': 'application/json; charset=utf-8',
      'x-proxy-cache': 'HIT',
      'cache-control': 'no-store',
    });
    return res.end(cached.body);
  }

  const headers = { accept: 'application/json', 'user-agent': 'civitai-explorer/1.0' };
  if (key) headers.authorization = `Bearer ${key}`;

  const started = Date.now();
  try {
    const upstream = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await upstream.text();
    log(`→ ${upstream.status} ${target.pathname}${target.search} (${Date.now() - started}ms)`);

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      // L'API a répondu du HTML (page d'erreur, Cloudflare, mauvaise URL de base…)
      return sendJson(res, 502, {
        error: `Réponse non-JSON de ${target.origin} (HTTP ${upstream.status}). ` +
          `Vérifie CIVITAI_BASE_URL.`,
        status: upstream.status,
        preview: body.slice(0, 300),
      });
    }

    if (upstream.ok) cacheSet(cacheKey, { status: upstream.status, body });

    res.writeHead(upstream.status, {
      'content-type': 'application/json; charset=utf-8',
      'x-proxy-cache': 'MISS',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    log(`✗ ${target.href} — ${err.name}: ${err.message}`);
    sendJson(res, timedOut ? 504 : 502, {
      error: timedOut
        ? `Délai dépassé (${REQUEST_TIMEOUT_MS} ms) en contactant ${target.origin}.`
        : `Impossible de contacter ${target.origin} : ${err.message}`,
    });
  }
}

// --- fichiers statiques ---------------------------------------------------
async function handleStatic(req, res, url) {
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const filePath = path.join(PUBLIC_DIR, path.normalize(relative));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Accès refusé' });
  }

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — introuvable');
  }
}

// --- serveur --------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'Méthode non autorisée' });
  }

  if (url.pathname === '/healthz') {
    return sendJson(res, 200, { ok: true, baseUrl: BASE_URL, uptime: process.uptime() });
  }

  if (url.pathname === '/api/config') {
    return sendJson(res, 200, {
      baseUrl: BASE_URL,
      hasServerKey: Boolean(API_KEY),
      cacheTtlMs: CACHE_TTL_MS,
    });
  }

  if (url.pathname.startsWith('/api/civitai')) {
    return handleApiProxy(req, res, url);
  }

  return handleStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Civitai Explorer');
  console.log(`  Interface : http://${HOST}:${PORT}`);
  console.log(`  API cible : ${BASE_URL}`);
  console.log(`  Clé d'API : ${API_KEY ? 'configurée (serveur)' : 'aucune (mode public)'}`);
  console.log('');
});
