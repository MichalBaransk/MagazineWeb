/* Service worker wersji jednoplikowej — daje pracę bez internetu.
   Plik nieobowiązkowy: bez niego aplikacja działa, tylko wymaga zasięgu
   przy uruchamianiu. Nazwa pamięci podręcznej zawiera numer wersji
   aplikacji, więc każde wydanie jest dla przeglądarki nową wersją. */
const WERSJA = 'magazyn-1p-v8';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(WERSJA)
    .then(c => c.addAll(['./', './index.html']))
    .catch(() => {}));
});

/* nowa wersja czeka, aż użytkownik kliknie „Odśwież teraz” */
self.addEventListener('message', e => {
  if (e.data === 'przejmij') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== WERSJA).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(odp => {
        if (odp && odp.status === 200)
          caches.open(WERSJA).then(c => c.put(e.request, odp.clone()));
        return odp;
      })
      .catch(() => caches.match(e.request).then(t => t || caches.match('./index.html')))
  );
});