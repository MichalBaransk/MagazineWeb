/* Service worker — praca bez internetu.
   TEN PLIK JEST STAŁY. Nie trzeba go podmieniać przy aktualizacjach aplikacji:
   nazwa pamięci podręcznej nie zawiera numeru wersji, a pobieranie idzie
   „najpierw sieć”, więc świeży index.html trafia do telefonu sam.
   Wgrywasz go raz i zapominasz. */
const PAMIEC = 'magazyn-1p';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(PAMIEC)
    .then(c => c.addAll(['./', './index.html']))
    .catch(() => {})
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== PAMIEC).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(odp => {
        if (odp && odp.status === 200)
          caches.open(PAMIEC).then(c => c.put(e.request, odp.clone()));
        return odp;
      })
      .catch(() => caches.match(e.request).then(t => t || caches.match('./index.html')))
  );
});