/**
 * sw.js — EquiSense Service Worker
 * Strategy:
 *   - Local assets: cache-first (install pre-caches everything)
 *   - CDN assets:   network-first, fall back to cache
 *   - Everything else: network-only
 */

const CACHE_VERSION = 'equisense-v2';

const LOCAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/base.css',
  '/styles/theme-default.css',
  '/styles/theme-high-contrast.css',
  '/styles/camera.css',
  '/scripts/main.js',
  '/scripts/audio-engine.js',
  '/scripts/accessibility-shell.js',
  '/scripts/equation-navigator/parser.js',
  '/scripts/equation-navigator/walker.js',
  '/scripts/equation-navigator/speech.js',
  '/scripts/equation-navigator/cues.js',
  '/scripts/equation-navigator/render.js',
  '/scripts/equation-navigator/spatial-mapping.js',
  '/scripts/graph-sonifier/csv.js',
  '/scripts/graph-sonifier/mapping.js',
  '/scripts/graph-sonifier/scheduler.js',
  '/scripts/graph-sonifier/chart.js',
  '/scripts/data-analysis/stats.js',
  '/scripts/data-analysis/fft.js',
  '/scripts/data-analysis/pattern-detect.js',
  '/scripts/data-analysis/nlg.js',
  '/scripts/camera-capture/camera.js',
  '/scripts/camera-capture/math-cleanup.js',
  '/scripts/camera-capture/ocr-worker.js',
  '/scripts/camera-capture/viewfinder.js',
  '/scripts/tactile-export/svg-generator.js',
  '/scripts/timbre/synthesis.js',
  '/scripts/voice-commands/speech-input.js',
  '/scripts/voice-commands/intent-matcher.js',
  '/scripts/braille-display/bluetooth.js',
  '/scripts/braille-display/virtual-display.js',
  '/scripts/braille-display/math-to-braille.js',
  '/scripts/inverse-sonification/microphone.js',
  '/scripts/inverse-sonification/pitch-detect.js',
  '/scripts/inverse-sonification/curve-fit.js',
  '/workers/ocr.worker.js',
  '/workers/analysis.worker.js',
  '/assets/sample-data/linear.csv',
  '/assets/sample-data/sinusoidal.csv',
  '/assets/sample-data/exponential.csv',
  '/assets/sample-data/outliers.csv',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
];

const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
  'cdn.mathjax.org',
];

// ── Install: pre-cache all local assets ─────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ──────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route by origin ───────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (CDN_ORIGINS.some(o => url.hostname.includes(o))) {
    // Network-first for CDN assets — fall back to cached copy
    event.respondWith(networkFirstWithCache(event.request));
  } else if (url.origin === self.location.origin) {
    // Cache-first for local assets
    event.respondWith(cacheFirst(event.request));
  }
  // Otherwise: let the browser handle it (no interception)
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — resource not cached.', { status: 503 });
  }
}

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response('Offline — CDN resource not cached.', { status: 503 });
  }
}
