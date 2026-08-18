/* ------------------------------------------------------------------
   app.js — uruchomienie aplikacji.
   ------------------------------------------------------------------ */
(function () {
'use strict';

function blad(tekst, szczegol) {
  document.getElementById('widok').innerHTML =
    '<div class="alert zle"><div><b>' + tekst + '</b>' +
    (szczegol ? String(szczegol).replace(/[<>]/g, '') : '') + '</div></div>' +
    '<div class="karta"><h2>Co można zrobić</h2><p>' +
    'Najczęstsza przyczyna to tryb incognito albo zablokowany zapis danych stron. ' +
    'Otwórz aplikację w zwykłym oknie przeglądarki i sprawdź, czy w ustawieniach ' +
    'witryny nie są zablokowane pliki cookie i dane.</p></div>';
}

async function start() {
  try {
    await DB.start();
  } catch (e) {
    blad('Nie udało się otworzyć bazy danych', e.message);
    return;
  }

  UI.rysuj();
  addEventListener('hashchange', UI.rysuj);

  document.getElementById('wstecz').onclick = () => history.back();

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const m = document.getElementById('modal');
    if (!m.hidden) UI.zamknijModal();
    else Skaner.zamknij();
  });

  /* silnik skanera przygotowujemy w tle, żeby pierwsze użycie było natychmiastowe */
  Skaner.przygotuj().catch(() => {});

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); }
    catch (e) { /* brak pracy offline, ale aplikacja działa */ }
  }

  /* ostrzeżenie przy wychodzeniu z niezapisanego dokumentu */
  addEventListener('beforeunload', e => {
    if (location.hash.includes('/dokument/nowy')) { e.preventDefault(); e.returnValue = ''; }
  });
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', start);
else start();

})();
