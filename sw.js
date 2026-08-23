/* Swangz AI Tracker — service worker.
   ------------------------------------------------------------------
   What this is for: the app opens instantly, and it opens at all when the
   connection drops. It is NOT an offline database — entries still need
   Supabase — but the shell, the icons and the Supabase client are held
   locally so a bad connection means "cannot sync" rather than a blank page.

   The rule that matters most is the one for index.html. The whole app is
   that one file, so caching it first would freeze everybody on whatever
   build they happened to install and no amount of deploying would reach
   them. It is network-first: fetch the live copy, fall back to the cached
   one only when the network fails. Everything else — icons, fonts — is
   immutable enough to serve cache-first.

   Bump CACHE when the shell list changes; the activate step deletes every
   cache that is not the current one.
   ------------------------------------------------------------------ */
const CACHE = 'swangz-tracker-v3';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/swangz-badge.webp',
  '/assets/swangz-logo.webp',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon-32.png',
  /* The Supabase client is ours now, so it caches like anything else — no
     opaque cross-origin response, and a version bump is a one-line change
     here and in index.html together. */
  '/vendor/supabase-js-2.45.0.min.js',
  '/vendor/fonts/inter-var-latin.woff2',
  '/vendor/fonts/jetbrains-mono-var-latin.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* addAll fails the whole install if any single item 404s, which would
       leave the app with no worker at all. Take them one at a time. */
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    /* Take over as soon as the new worker is ready. Safe here because the
       page is a single document and the HTML is never served stale. */
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function isHTML(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // never cache a write

  const url = new URL(req.url);
  /* Supabase REST and auth must always go to the network. Serving a cached
     answer for somebody's entries — or worse, for an auth call — would be a
     bug with real consequences. */
  if (url.hostname.endsWith('.supabase.co') ||
      url.hostname.endsWith('.googleapis.com') ||
      url.hostname.endsWith('google.com') ||
      url.hostname.endsWith('script.google.com')) return;

  if (isHTML(req)) {
    /* Network first: a deploy has to be able to reach people. */
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        const cached = await caches.match('/index.html');
        return cached || new Response(
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<body style="margin:0;background:#02040a;color:#e8e6f0;font:16px/1.6 system-ui;' +
          'display:grid;place-items:center;height:100vh;text-align:center;padding:24px">' +
          '<div><p style="font-size:15px;opacity:.7">Swangz AI Tracker</p>' +
          '<p>You are offline, and this device has not opened the tracker before, ' +
          'so there is nothing saved to show you.</p>' +
          '<p style="opacity:.7">Reconnect and it will load.</p></div>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
      }
    })());
    return;
  }

  /* Everything else: cache first, and quietly refresh the copy behind it. */
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => null);
    return cached || network || new Response('', { status: 504 });
  })());
});
