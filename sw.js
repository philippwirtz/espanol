const CACHE = 'espanol-v28';
const FILES = ['./', './index.html', './style.css', './content.js', './examples.js', './app.js', './verbcore.js', './verbtrainer.js', './fonts/bricolage.woff2', './manifest.webmanifest', './icon-180.png', './icon-512.png',
  './opt-worker.js', './fsrs/fsrs_browser.js', './fsrs/fsrs_browser_bg.wasm',
  './fsrs/snippets/wasm-bindgen-rayon-38edf6e439f6d70d/src/workerHelpers.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Seite, Stile und Skripte: erst Netz (immer beim Server nachfragen), dann Cache — Updates kommen sofort, offline läuft der Cache.
// Antwortet das Netz nach NET_WAIT ms noch nicht (schwaches Signal) und es gibt eine Kopie, gilt die Kopie; das Netz aktualisiert sie trotzdem.
// Ohne Kopie wird weiter aufs Netz gewartet. Gespeichert werden nur gute Antworten (keine Fehlerseite, keine Anmeldeseite anstelle eines Skripts).
// Symbole & Manifest: erst Cache, dann Netz. Fremde Adressen (GitHub-API) nie anfassen.
const NET_WAIT = 4000;
const isCode = url => /\.(js|css)$/.test(url.pathname);
const cacheable = (res, url) => res.ok && !(isCode(url) && /html/.test(res.headers.get('content-type') || ''));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if (isPage || isCode(url)) {
    const key = isPage ? './index.html' : e.request;
    let saved;
    const net = fetch(isPage ? url.href : e.request, { cache: 'no-cache' }).then(res => {
      if (cacheable(res, url)) { const copy = res.clone(); saved = caches.open(CACHE).then(c => c.put(key, copy)); return res; }
      return caches.match(key).then(hit => hit || res);
    }).catch(() => caches.match(key));
    const late = new Promise(ok => setTimeout(() => caches.match(key).then(hit => hit && ok(hit)), NET_WAIT));
    e.waitUntil(net.then(() => saved).catch(() => {}));
    e.respondWith(Promise.race([net, late]));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }))
  );
});
