/* Service worker — praca offline. Podbij WERSJA po każdej zmianie plików. */
const WERSJA = 'magazyn-v1';
const PLIKI = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/xlsx.js',
  './js/db.js',
  './js/skaner.js',
  './js/etykiety.js',
  './js/eksport.js',
  './js/ui.js',
  './js/app.js',
  './vendor/zxing.min.js',
  './vendor/qrcode.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(WERSJA)
      .then(c => c.addAll(PLIKI))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== WERSJA).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

/* Najpierw pamięć podręczna — aplikacja ma działać bez zasięgu.
   W tle odświeżamy kopię, żeby kolejne uruchomienie miało nowszą wersję. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(trafienie => {
      const zSieci = fetch(e.request).then(odp => {
        if (odp && odp.status === 200)
          caches.open(WERSJA).then(c => c.put(e.request, odp.clone()));
        return odp;
      }).catch(() => trafienie);
      return trafienie || zSieci;
    })
  );
});
