/* ------------------------------------------------------------------
   ui.js — ekrany aplikacji i nawigacja.
   ------------------------------------------------------------------ */
(function (global) {
'use strict';

const $ = s => document.querySelector(s);
const widok = () => $('#widok');

/* ---------- drobiazgi ---------- */
function h(s) {
  return String(s == null ? '' : s)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(t, ms) {
  const e = $('#toast');
  e.textContent = t;
  e.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => e.classList.remove('on'), ms || 2600);
}
const liczba = n => (Number(n) || 0).toLocaleString('pl-PL');
const zl = n => (Number(n) || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
function dataPL(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d) ? '' : d.toLocaleDateString('pl-PL');
}
function dataGodzPL(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d) ? '' : d.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}
const dzisISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
};
function bezOgonkow(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
}
const pasuje = (tekst, fraza) => bezOgonkow(tekst).includes(bezOgonkow(fraza));

/* ---------- modal ---------- */
function modal(tytul, tresc, przyciski) {
  const m = $('#modal');
  $('#modal-tytul').textContent = tytul;
  $('#modal-tresc').innerHTML = tresc;
  const p = $('#modal-przyciski');
  p.innerHTML = '';
  (przyciski || []).forEach(b => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'b ' + (b.klasa || '');
    el.textContent = b.tekst;
    el.onclick = () => { if (b.akcja) b.akcja(); if (b.zamknij !== false) zamknijModal(); };
    p.appendChild(el);
  });
  m.hidden = false;
  document.body.classList.add('bez-scrolla');
  m.querySelector('.modal-tlo').onclick = zamknijModal;
  return m;
}
function zamknijModal() {
  $('#modal').hidden = true;
  document.body.classList.remove('bez-scrolla');
}
function potwierdz(tytul, tekst, etykieta) {
  return new Promise(res => {
    modal(tytul, '<p>' + h(tekst) + '</p>', [
      { tekst: 'Anuluj', akcja: () => res(false) },
      { tekst: etykieta || 'Tak', klasa: 'glowny', akcja: () => res(true) }
    ]);
  });
}

/* ---------- zdjęcia ---------- */
function zZdjecia(plik, maks) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, (maks || 900) / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * s);
        c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      im.onerror = rej;
      im.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(plik);
  });
}

/* ==================================================================
   PULPIT
   ================================================================== */
function pulpit() {
  const braki = DB.braki();
  const stan = DB.stany();
  const kopia = DB.kopiaPotrzebna();
  const liczbaProd = DB.produkty().length;
  const liczbaSpr = DB.sprzety().length;
  const liczbaLok = DB.lokalizacje().length;

  let a = '';
  if (kopia) {
    const powod = kopia === 'nigdy' ? 'Nie masz jeszcze żadnej kopii zapasowej.'
      : kopia === 'operacje' ? 'Od ostatniej kopii wprowadziłeś ' + (DB.D.ust.operacjiOdKopii || 0) + ' zmian.'
      : 'Ostatnia kopia: ' + dataPL(DB.D.ust.ostatniaKopia) + '.';
    a += '<div class="alert zle"><div><b>Zrób kopię zapasową</b>' + h(powod) +
         ' Dane siedzą wyłącznie w tym telefonie. <a href="#/eksport">Zrób kopię →</a></div></div>';
  }
  if (braki.length) {
    a += '<div class="alert uw"><div><b>' + braki.length +
         ' pozycji poniżej stanu minimalnego</b>' +
         h(braki.slice(0, 3).map(b => b.produkt.nazwa).join(', ')) +
         (braki.length > 3 ? ' i ' + (braki.length - 3) + ' więcej' : '') +
         '. <a href="#/stany?f=braki">Zobacz listę →</a></div></div>';
  }
  if (!liczbaProd && !liczbaSpr) {
    a += '<div class="alert ok"><div><b>Zacznij od danych podstawowych</b>' +
         'Dodaj pomieszczenia i punkty, potem produkty albo sprzęt. ' +
         'Możesz też wczytać dane z kopii zapasowej w Ustawieniach.</div></div>';
  }

  const wartosc = (() => {
    const c = DB.ostatnieCeny();
    let s = 0;
    for (const [id, il] of stan) s += (c.get(id) || 0) * il;
    return s;
  })();

  return {
    tytul: DB.D.ust.firma || 'Magazyn',
    tab: 'pulpit',
    html:
      a +
      '<div class="stat">' +
        '<div><b>' + liczba(liczbaProd) + '</b><span>produktów</span></div>' +
        '<div><b>' + liczba(liczbaSpr) + '</b><span>sztuk sprzętu</span></div>' +
        '<div><b>' + liczba(liczbaLok) + '</b><span>pomieszczeń</span></div>' +
      '</div>' +
      '<div class="kafle">' +
        kafel('#/dokument/nowy/RW', '↑', 'Wydanie', 'Wydaj materiały na punkt', true) +
        kafel('#/dokument/nowy/PZ', '↓', 'Dostawa', 'Przyjmij dostawę na magazyn', true) +
        kafel('#/skanuj', '⌗', 'Skanuj', 'Sprawdź, co to za kod') +
        kafel('#/spis', '☑', 'Inwentaryzacja', 'Spis sprzętu w pomieszczeniu') +
        kafel('#/stany', '▦', 'Stany', 'Co i ile jest na magazynie') +
        kafel('#/eksport', '⤓', 'Excel i kopia', 'Raport i kopia zapasowa') +
      '</div>' +
      (wartosc ? '<div class="karta"><h2>Wartość zapasu</h2><p>' + h(zl(wartosc)) +
        ' — wg ostatnich cen zakupu.</p></div>' : '')
  };
}
function kafel(href, ikn, tyt, opis, mocny) {
  return '<a class="kafel' + (mocny ? ' mocny' : '') + '" href="' + href + '">' +
    '<span class="ikn">' + ikn + '</span>' + h(tyt) + '<small>' + h(opis) + '</small></a>';
}

/* ==================================================================
   MAGAZYN: stany, katalog, dokumenty
   ================================================================== */
function stany(param) {
  const filtr = param.f || 'stany';
  const st = DB.stany(), ceny = DB.ostatnieCeny();

  const zakladki = '<div class="filtry">' +
    ['stany|Stany', 'braki|Do zamówienia', 'dok|Dokumenty', 'katalog|Katalog']
      .map(x => {
        const [k, n] = x.split('|');
        return '<button type="button" data-f="' + k + '"' +
          (filtr === k ? ' class="akt"' : '') + '>' + n +
          (k === 'braki' && DB.braki().length ? ' (' + DB.braki().length + ')' : '') +
          '</button>';
      }).join('') + '</div>';

  let tresc = '';

  if (filtr === 'stany' || filtr === 'braki') {
    const braki = filtr === 'braki';
    let lista = DB.produkty().map(p => ({
      p, stan: st.get(p.id) || 0, min: Number(p.stanMin) || 0, cena: ceny.get(p.id)
    }));
    if (braki) lista = lista.filter(x => x.min > 0 && x.stan < x.min);
    lista.sort((a, b) => braki ? (b.min - b.stan) - (a.min - a.stan)
                               : a.p.nazwa.localeCompare(b.p.nazwa, 'pl'));

    tresc = '<div class="szukaj"><input id="q" type="search" placeholder="Szukaj produktu lub EAN" autocomplete="off"></div>' +
      (braki && lista.length
        ? '<button class="b" id="lista-zakupow">Zrób listę zakupową (wydruk)</button>' : '') +
      '<div class="lista" id="wyniki">' + wierszeStanow(lista) + '</div>' +
      (lista.length ? '' : pusto(braki ? '✓' : '▦',
        braki ? 'Żadna pozycja nie jest poniżej minimum.'
              : 'Brak produktów w katalogu. Dodaj pierwszy produkt.')) +
      '<button class="b glowny" id="nowy-produkt">+ Nowy produkt</button>';

    return { tytul: braki ? 'Do zamówienia' : 'Stany magazynowe', tab: 'magazyn',
      html: zakladki + tresc, po: () => {
        const q = $('#q');
        q.oninput = () => {
          const f = q.value.trim();
          const w = f ? lista.filter(x => pasuje(x.p.nazwa, f) || (x.p.ean || '').includes(f)) : lista;
          $('#wyniki').innerHTML = wierszeStanow(w);
          podepnijPozycje();
        };
        podepnijPozycje();
        $('#nowy-produkt').onclick = () => location.hash = '#/produkt/nowy';
        const lz = $('#lista-zakupow');
        if (lz) lz.onclick = drukujListeZakupow;
        podepnijFiltry();
      } };
  }

  if (filtr === 'katalog') {
    const lista = DB.produkty().sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
    tresc = '<div class="szukaj"><input id="q" type="search" placeholder="Szukaj w katalogu" autocomplete="off"></div>' +
      '<div class="lista" id="wyniki">' + wierszeKatalogu(lista) + '</div>' +
      (lista.length ? '' : pusto('▦', 'Katalog jest pusty.')) +
      '<button class="b glowny" id="nowy-produkt">+ Nowy produkt</button>';
    return { tytul: 'Katalog produktów', tab: 'magazyn', html: zakladki + tresc, po: () => {
      const q = $('#q');
      q.oninput = () => {
        const f = q.value.trim();
        $('#wyniki').innerHTML = wierszeKatalogu(
          f ? lista.filter(p => pasuje(p.nazwa, f) || (p.ean || '').includes(f)) : lista);
        podepnijPozycje();
      };
      podepnijPozycje();
      $('#nowy-produkt').onclick = () => location.hash = '#/produkt/nowy';
      podepnijFiltry();
    } };
  }

  /* dokumenty */
  const dok = DB.dokumenty().sort((a, b) => (b.data || '').localeCompare(a.data || '') ||
                                            (b.utw || '').localeCompare(a.utw || ''));
  tresc =
    '<div class="przyciski">' +
      '<a class="b glowny" href="#/dokument/nowy/PZ">+ Dostawa</a>' +
      '<a class="b glowny" href="#/dokument/nowy/RW">+ Wydanie</a>' +
    '</div>' +
    '<a class="b" href="#/dokument/nowy/KOR">+ Korekta stanu</a>' +
    (dok.length ? '<div class="lista">' + dok.map(d => {
      const ile = (d.pozycje || []).reduce((s, p) => s + (Number(p.ilosc) || 0), 0);
      const strona = d.typ === 'PZ' ? (d.dostawca || '—')
                   : d.typ === 'RW' ? (Eksport.nazwaLok(d.lokalizacjaId) || '—')
                   : (d.powod || 'korekta');
      return '<a class="poz" href="#/dokument/' + d.id + '"><div class="tre">' +
        '<div class="tyt">' + h(d.numer) + ' <span class="znacz ' +
          (d.typ === 'PZ' ? 'ok' : d.typ === 'RW' ? '' : 'uw') + '">' + d.typ + '</span></div>' +
        '<div class="pod">' + h(dataPL(d.data)) + ' · ' + h(strona) + '</div></div>' +
        '<div class="licz">' + liczba(ile) + '<small>' + (d.pozycje || []).length + ' poz.</small></div></a>';
    }).join('') + '</div>' : pusto('▤', 'Brak dokumentów. Zacznij od przyjęcia dostawy.'));

  return { tytul: 'Dokumenty', tab: 'magazyn', html: zakladki + tresc, po: podepnijFiltry };
}

function wierszeStanow(lista) {
  if (!lista.length) return '';
  return lista.map(x => {
    const brak = x.min > 0 && x.stan < x.min;
    return '<a class="poz' + (brak ? ' brak' : '') + '" href="#/produkt/' + x.p.id + '">' +
      '<div class="tre"><div class="tyt">' + h(x.p.nazwa) + '</div>' +
      '<div class="pod">' + (x.p.ean ? h(x.p.ean) + ' · ' : '') +
        (x.p.kategoria ? h(x.p.kategoria) + ' · ' : '') +
        (x.min ? 'min. ' + liczba(x.min) : 'bez minimum') +
        (brak ? ' · brakuje ' + liczba(x.min - x.stan) : '') + '</div></div>' +
      '<div class="licz">' + liczba(x.stan) + '<small>' + h(x.p.jm || 'szt') + '</small></div></a>';
  }).join('');
}
function wierszeKatalogu(lista) {
  return lista.map(p => '<a class="poz" href="#/produkt/' + p.id + '">' +
    '<div class="tre"><div class="tyt">' + h(p.nazwa) + '</div>' +
    '<div class="pod">' + (p.ean ? h(p.ean) : 'bez kodu EAN') +
      (p.dostawca ? ' · ' + h(p.dostawca) : '') + '</div></div>' +
    '<div class="licz"><small>' + h(p.jm || 'szt') + '</small></div></a>').join('');
}
function pusto(ikn, tekst) {
  return '<div class="pusto"><span class="duzy">' + ikn + '</span>' + h(tekst) + '</div>';
}
function podepnijPozycje() { /* linki obsługuje router przez hash */ }
function podepnijFiltry() {
  widok().querySelectorAll('.filtry button[data-f]').forEach(b => {
    b.onclick = () => location.hash = '#/stany?f=' + b.dataset.f;
  });
}

/* ==================================================================
   PRODUKT — formularz
   ================================================================== */
function produkt(param) {
  const nowy = param.id === 'nowy';
  const p = nowy ? { jm: 'szt' } : DB.produkty().find(x => x.id === param.id);
  if (!p) return { tytul: 'Nie znaleziono', html: pusto('?', 'Nie ma takiego produktu.') };

  const st = nowy ? 0 : (DB.stany().get(p.id) || 0);
  const ruch = nowy ? [] : historiaProduktu(p.id);

  return {
    tytul: nowy ? 'Nowy produkt' : p.nazwa,
    wstecz: true,
    html:
      (nowy ? '' : '<div class="karta"><h2>Stan bieżący</h2><p style="font-size:26px;' +
        'font-weight:700;color:var(--tx)">' + liczba(st) + ' ' + h(p.jm || 'szt') + '</p></div>') +
      '<div class="karta">' +
      '<div class="zkodem">' +
        pole('ean', 'Kod EAN', p.ean, 'text', 'np. 5901234567890') +
        '<button type="button" class="b maly" id="skan">⌗ Skanuj</button>' +
      '</div>' +
      pole('nazwa', 'Nazwa produktu *', p.nazwa, 'text', 'np. Papier A4 80g') +
      '<div class="rzad">' + pole('kategoria', 'Kategoria', p.kategoria) +
        polSelect('jm', 'Jednostka', p.jm || 'szt',
          ['szt', 'opak', 'ryza', 'kpl', 'rolka', 'karton', 'litr', 'kg']) + '</div>' +
      '<div class="rzad">' + pole('wOpak', 'Sztuk w opakowaniu', p.wOpak, 'number') +
        pole('stanMin', 'Stan minimalny', p.stanMin, 'number') + '</div>' +
      pole('dostawca', 'Domyślny dostawca', p.dostawca) +
      poleObszar('uwagi', 'Uwagi', p.uwagi) +
      '</div>' +
      '<button class="b glowny" id="zapisz">Zapisz</button>' +
      (nowy ? '' : '<button class="b zly" id="usun">Usuń produkt</button>') +
      (ruch.length ? '<div class="naglowek-sekcji">Historia</div><div class="lista">' +
        ruch.map(r => '<a class="poz" href="#/dokument/' + r.dokId + '"><div class="tre">' +
          '<div class="tyt">' + h(r.numer) + '</div><div class="pod">' + h(dataPL(r.data)) +
          (r.strona ? ' · ' + h(r.strona) : '') + '</div></div>' +
          '<div class="licz" style="color:' + (r.ile > 0 ? 'var(--ok)' : 'var(--zle)') + '">' +
          (r.ile > 0 ? '+' : '') + liczba(r.ile) + '</div></a>').join('') + '</div>' : ''),
    po: () => {
      $('#skan').onclick = async () => {
        const k = await Skaner.jedenKod({ tytul: 'Zeskanuj kod EAN produktu' });
        if (k) { $('#f-ean').value = k; toast('Kod: ' + k); }
      };
      $('#zapisz').onclick = async () => {
        const dane = zbierz(['ean', 'nazwa', 'kategoria', 'jm', 'wOpak', 'stanMin', 'dostawca', 'uwagi']);
        if (!dane.nazwa) { toast('Podaj nazwę produktu'); return; }
        const kol = DB.produkty().find(x => x.ean && x.ean === dane.ean && x.id !== p.id);
        if (kol) { toast('Ten EAN ma już produkt: ' + kol.nazwa, 4000); return; }
        await DB.zapisz('produkty', Object.assign(p, dane));
        toast('Zapisano');
        history.back();
      };
      const u = $('#usun');
      if (u) u.onclick = async () => {
        const uzyty = DB.dokumenty().some(d => (d.pozycje || []).some(x => x.produktId === p.id));
        const ok = await potwierdz('Usunąć produkt?',
          uzyty ? 'Produkt występuje w dokumentach. Zniknie z katalogu i ze stanów, ale dokumenty zostaną nienaruszone.'
                : 'Produkt zostanie usunięty z katalogu.', 'Usuń');
        if (!ok) return;
        await DB.usun('produkty', p.id);
        toast('Usunięto');
        location.hash = '#/stany?f=katalog';
      };
    }
  };
}

function historiaProduktu(pid) {
  const out = [];
  DB.dokumenty().forEach(d => {
    (d.pozycje || []).forEach(p => {
      if (p.produktId !== pid) return;
      const znak = d.typ === 'RW' ? -1 : 1;
      out.push({
        dokId: d.id, numer: d.numer, data: d.data,
        ile: (Number(p.ilosc) || 0) * znak,
        strona: d.typ === 'PZ' ? d.dostawca : d.typ === 'RW'
                ? Eksport.nazwaLok(d.lokalizacjaId) : d.powod
      });
    });
  });
  return out.sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 40);
}

/* ==================================================================
   DOKUMENT — kreator dostawy / wydania / korekty
   ================================================================== */
let roboczy = null;

const OPIS_TYPU = {
  PZ: { tytul: 'Dostawa', nowy: 'Nowa dostawa', zapisz: 'Zapisz dostawę', opis: 'przyjęcie na magazyn' },
  RW: { tytul: 'Wydanie', nowy: 'Nowe wydanie', zapisz: 'Zapisz wydanie', opis: 'wydanie na punkt' },
  KOR: { tytul: 'Korekta', nowy: 'Nowa korekta', zapisz: 'Zapisz korektę', opis: 'poprawa stanu' }
};

function dokument(param) {
  const nowy = param.id === 'nowy';
  const typ = nowy ? (param.typ || 'PZ') : null;

  if (nowy) {
    if (!roboczy || roboczy.typ !== typ || roboczy.id) {
      roboczy = { typ, numer: DB.nastepnyNumer(typ), data: dzisISO(), pozycje: [] };
    }
    return edytorDokumentu(roboczy, true);
  }

  const d = DB.dokumenty().find(x => x.id === param.id);
  if (!d) return { tytul: 'Nie znaleziono', html: pusto('?', 'Nie ma takiego dokumentu.') };
  return podgladDokumentu(d);
}

function edytorDokumentu(d, nowy) {
  const o = OPIS_TYPU[d.typ];
  const punkty = DB.lokalizacje().sort((a, b) =>
    Eksport.nazwaLok(a.id).localeCompare(Eksport.nazwaLok(b.id), 'pl'));

  const naglowek =
    '<div class="karta">' +
    '<div class="rzad">' + pole('numer', 'Numer', d.numer) + pole('data', 'Data', d.data, 'date') + '</div>' +
    (d.typ === 'PZ'
      ? pole('dostawca', 'Dostawca', d.dostawca, 'text', 'np. Biuro-Serwis sp. z o.o.') +
        pole('nrFaktury', 'Nr faktury / WZ', d.nrFaktury)
      : d.typ === 'RW'
      ? (punkty.length
          ? polSelectId('lokalizacjaId', 'Punkt / pomieszczenie *', d.lokalizacjaId,
              [['', '— wybierz —']].concat(punkty.map(l => [l.id, Eksport.nazwaLok(l.id)])))
          : '<div class="alert uw"><div><b>Brak pomieszczeń</b>Dodaj najpierw pomieszczenie lub punkt. ' +
            '<a href="#/lokalizacja/nowa">Dodaj →</a></div></div>') +
        pole('osoba', 'Osoba odbierająca', d.osoba)
      : pole('powod', 'Powód korekty', d.powod, 'text', 'np. spis z natury, stłuczka')) +
    poleObszar('uwagi', 'Uwagi', d.uwagi) +
    '</div>';

  const pozycje = d.pozycje.length
    ? '<div class="lista" id="pozycje">' + d.pozycje.map((p, i) => {
        const pr = DB.produkty().find(x => x.id === p.produktId) || { nazwa: '(usunięty)' };
        const pod = d.typ === 'PZ'
          ? (p.cena != null && p.cena !== '' ? zl(p.cena) + ' / ' + (pr.jm || 'szt') : 'bez ceny')
          : (pr.ean || 'bez kodu EAN');
        return '<button class="poz" type="button" data-i="' + i + '"><div class="tre">' +
          '<div class="tyt">' + h(pr.nazwa) + '</div><div class="pod">' + h(pod) +
          '</div></div><div class="licz">' + (d.typ === 'KOR' && p.ilosc > 0 ? '+' : '') +
          liczba(p.ilosc) + '<small>' + h(pr.jm || 'szt') + '</small></div></button>';
      }).join('') + '</div>'
    : pusto('＋', 'Dodaj pierwszą pozycję — najszybciej skanerem.');

  const suma = d.pozycje.reduce((s, p) => s + (Number(p.ilosc) || 0), 0);
  const wartosc = d.pozycje.reduce((s, p) =>
    s + (Number(p.cena) || 0) * (Number(p.ilosc) || 0), 0);

  return {
    tytul: nowy ? o.nowy : (o.tytul + ' ' + (d.numer || '')),
    wstecz: true,
    html: naglowek +
      '<div class="naglowek-sekcji"><span>Pozycje (' + d.pozycje.length + ')</span>' +
        (suma ? '<span>razem ' + liczba(suma) + (wartosc ? ' · ' + h(zl(wartosc)) : '') + '</span>' : '') +
      '</div>' +
      pozycje +
      '<div class="przyciski">' +
        '<button class="b glowny" id="skanuj-poz">⌗ Skanuj pozycję</button>' +
        '<button class="b" id="dodaj-poz">+ Z listy</button>' +
      '</div>' +
      '<button class="b glowny" id="zapisz-dok" style="margin-top:6px">' + o.zapisz + '</button>' +
      (nowy ? '<button class="b zly" id="porzuc">Porzuć</button>' : ''),
    po: () => {
      const zapiszNaglowek = () => {
        Object.assign(d, zbierz(['numer', 'data', 'dostawca', 'nrFaktury',
          'lokalizacjaId', 'osoba', 'powod', 'uwagi']));
      };
      widok().querySelectorAll('.karta input,.karta select,.karta textarea')
        .forEach(i => i.onchange = zapiszNaglowek);

      widok().querySelectorAll('#pozycje .poz').forEach(b => {
        b.onclick = () => { zapiszNaglowek(); edytujPozycje(d, +b.dataset.i); };
      });
      $('#skanuj-poz').onclick = () => { zapiszNaglowek(); skanujPozycje(d); };
      $('#dodaj-poz').onclick = () => { zapiszNaglowek(); wybierzProdukt(d); };
      $('#zapisz-dok').onclick = async () => {
        zapiszNaglowek();
        if (!d.pozycje.length) { toast('Dokument nie ma żadnej pozycji'); return; }
        if (d.typ === 'RW' && !d.lokalizacjaId) { toast('Wybierz punkt docelowy'); return; }
        if (d.typ === 'RW') {
          const st = DB.stany();
          const zaMalo = d.pozycje.filter(p => (st.get(p.produktId) || 0) < (Number(p.ilosc) || 0));
          if (zaMalo.length) {
            const ok = await potwierdz('Stan zejdzie poniżej zera',
              zaMalo.length + ' pozycji przekracza stan magazynowy. To zwykle znaczy, ' +
              'że jakiejś dostawy nie ma jeszcze w systemie. Zapisać mimo to?', 'Zapisz mimo to');
            if (!ok) return;
          }
        }
        await DB.zapisz('dokumenty', d);
        roboczy = null;
        toast(OPIS_TYPU[d.typ].tytul + ' ' + d.numer + ' zapisana');
        location.hash = '#/stany?f=dok';
      };
      const pz = $('#porzuc');
      if (pz) pz.onclick = async () => {
        if (d.pozycje.length && !(await potwierdz('Porzucić dokument?',
          'Wprowadzone pozycje przepadną.', 'Porzuć'))) return;
        roboczy = null;
        location.hash = '#/stany?f=dok';
      };
    }
  };
}

async function skanujPozycje(d) {
  await Skaner.otworz({
    tytul: 'Skanuj produkty',
    podpowiedz: 'Skanuj kolejne produkty — okno zostaje otwarte.',
    onKod: kod => {
      const p = DB.produkty().find(x => x.ean === kod);
      if (p) { Skaner.info('Dodaję: ' + p.nazwa); pytajOIlosc(d, p, null, true); }
      else { Skaner.zamknij(); nowyProduktZKodu(d, kod); }
    }
  });
}

function pytajOIlosc(d, produkt, indeks, wSkanerze) {
  const ist = indeks != null ? d.pozycje[indeks] : d.pozycje.find(x => x.produktId === produkt.id);
  const cenaDom = ist && ist.cena != null ? ist.cena
    : (DB.ostatnieCeny().get(produkt.id) != null ? DB.ostatnieCeny().get(produkt.id) : '');
  const start = ist ? ist.ilosc : (d.typ === 'KOR' ? '' : 1);

  modal(produkt.nazwa,
    '<label><span class="et">Ilość (' + h(produkt.jm || 'szt') + ')' +
      (d.typ === 'KOR' ? ' — ujemna zmniejsza stan' : '') + '</span>' +
      '<input id="m-ilosc" type="number" inputmode="decimal" step="any" value="' +
      h(start) + '" autofocus></label>' +
    (d.typ === 'PZ'
      ? '<label><span class="et">Cena za ' + h(produkt.jm || 'szt') + ' (zł)</span>' +
        '<input id="m-cena" type="number" inputmode="decimal" step="0.01" value="' +
        h(cenaDom) + '"></label>' : '') +
    (produkt.wOpak ? '<p style="font-size:13px;color:var(--tx2)">W opakowaniu: ' +
      h(produkt.wOpak) + ' ' + h(produkt.jm || 'szt') + '</p>' : ''),
    [
      ist ? { tekst: 'Usuń pozycję', klasa: 'zly', akcja: () => {
        const i = indeks != null ? indeks : d.pozycje.indexOf(ist);
        d.pozycje.splice(i, 1);
        odswiez();
      } } : { tekst: 'Anuluj' },
      { tekst: 'Zapisz', klasa: 'glowny', akcja: () => {
        const il = parseFloat($('#m-ilosc').value.replace(',', '.'));
        if (!isFinite(il) || (d.typ !== 'KOR' && il <= 0)) { toast('Podaj poprawną ilość'); return; }
        const cenaEl = $('#m-cena');
        const cena = cenaEl && cenaEl.value !== '' ? parseFloat(cenaEl.value.replace(',', '.')) : null;
        if (ist) { ist.ilosc = il; if (cena != null) ist.cena = cena; }
        else d.pozycje.push({ produktId: produkt.id, ilosc: il, cena });
        if (wSkanerze) { toast(produkt.nazwa + ': ' + il); Skaner.info('Dodano ' + il + ' × ' + produkt.nazwa); }
        else odswiez();
      } }
    ]);
  setTimeout(() => { const i = $('#m-ilosc'); if (i) { i.focus(); i.select(); } }, 60);
}

function edytujPozycje(d, i) {
  const p = d.pozycje[i];
  const produkt = DB.produkty().find(x => x.id === p.produktId) || { nazwa: '(usunięty produkt)', jm: 'szt' };
  pytajOIlosc(d, produkt, i, false);
}

function wybierzProdukt(d) {
  const lista = DB.produkty().sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
  modal('Wybierz produkt',
    '<div class="szukaj"><input id="m-q" type="search" placeholder="Szukaj" autocomplete="off"></div>' +
    '<div class="lista" id="m-lista" style="max-height:46dvh;overflow:auto">' +
      wierszeWyboru(lista) + '</div>' +
    (lista.length ? '' : '<p style="color:var(--tx2);font-size:14px">Katalog jest pusty.</p>'),
    [{ tekst: 'Nowy produkt', akcja: () => nowyProduktZKodu(d, '') }, { tekst: 'Zamknij' }]);

  const odswiezListe = f => {
    const w = f ? lista.filter(p => pasuje(p.nazwa, f) || (p.ean || '').includes(f)) : lista;
    $('#m-lista').innerHTML = wierszeWyboru(w);
    podepnijWybor(d, w);
  };
  $('#m-q').oninput = e => odswiezListe(e.target.value.trim());
  podepnijWybor(d, lista);
}
function wierszeWyboru(lista) {
  return lista.map((p, i) => '<button class="poz" type="button" data-i="' + i + '">' +
    '<div class="tre"><div class="tyt">' + h(p.nazwa) + '</div>' +
    '<div class="pod">' + (p.ean ? h(p.ean) : 'bez EAN') + '</div></div></button>').join('');
}
function podepnijWybor(d, lista) {
  document.querySelectorAll('#m-lista .poz').forEach(b => {
    b.onclick = () => { zamknijModal(); pytajOIlosc(d, lista[+b.dataset.i], null, false); };
  });
}

function nowyProduktZKodu(d, kod) {
  modal('Nowy produkt',
    (kod ? '<p style="font-size:13.5px;color:var(--tx2);margin-bottom:10px">Kod <b>' + h(kod) +
      '</b> nie jest jeszcze w katalogu.</p>' : '') +
    '<label><span class="et">Nazwa *</span><input id="m-nazwa" type="text" autofocus></label>' +
    '<div class="rzad">' +
      '<label><span class="et">Jednostka</span><select id="m-jm">' +
        ['szt', 'opak', 'ryza', 'kpl', 'rolka', 'karton'].map(x =>
          '<option>' + x + '</option>').join('') + '</select></label>' +
      '<label><span class="et">Stan min.</span><input id="m-min" type="number" inputmode="numeric"></label>' +
    '</div>',
    [{ tekst: 'Anuluj', akcja: () => { if (d) setTimeout(() => skanujPozycje(d), 150); } },
     { tekst: 'Dodaj', klasa: 'glowny', zamknij: false, akcja: async () => {
        const nazwa = $('#m-nazwa').value.trim();
        if (!nazwa) { toast('Podaj nazwę'); return; }
        const p = await DB.zapisz('produkty', {
          nazwa, ean: kod || '', jm: $('#m-jm').value,
          stanMin: $('#m-min').value ? Number($('#m-min').value) : null
        });
        zamknijModal();
        if (d) pytajOIlosc(d, p, null, false); else odswiez();
      } }]);
  setTimeout(() => { const i = $('#m-nazwa'); if (i) i.focus(); }, 60);
}

function podgladDokumentu(d) {
  const o = OPIS_TYPU[d.typ];
  const strona = d.typ === 'PZ' ? d.dostawca
               : d.typ === 'RW' ? Eksport.nazwaLok(d.lokalizacjaId) : d.powod;
  const wartosc = (d.pozycje || []).reduce((s, p) =>
    s + (Number(p.cena) || 0) * (Number(p.ilosc) || 0), 0);

  return {
    tytul: d.numer, wstecz: true,
    html:
      '<div class="karta"><h2>' + h(o.tytul) + ' — ' + h(o.opis) + '</h2>' +
      '<p>' + h(dataPL(d.data)) + (strona ? ' · ' + h(strona) : '') +
      (d.osoba ? '<br>Osoba: ' + h(d.osoba) : '') +
      (d.nrFaktury ? '<br>Faktura/WZ: ' + h(d.nrFaktury) : '') +
      (d.uwagi ? '<br>' + h(d.uwagi) : '') + '</p></div>' +
      '<div class="lista">' + (d.pozycje || []).map(p => {
        const pr = DB.produkty().find(x => x.id === p.produktId) || { nazwa: '(usunięty produkt)' };
        return '<div class="poz"><div class="tre"><div class="tyt">' + h(pr.nazwa) + '</div>' +
          '<div class="pod">' + (p.cena != null && p.cena !== '' ? h(zl(p.cena)) + ' / ' +
          h(pr.jm || 'szt') : '—') + '</div></div><div class="licz">' +
          (d.typ === 'KOR' && p.ilosc > 0 ? '+' : '') + liczba(p.ilosc) +
          '<small>' + h(pr.jm || 'szt') + '</small></div></div>';
      }).join('') + '</div>' +
      (wartosc ? '<div class="karta"><h2>Wartość dokumentu</h2><p style="font-size:20px;' +
        'font-weight:700;color:var(--tx)">' + h(zl(wartosc)) + '</p></div>' : '') +
      '<button class="b" id="drukuj">Wydruk / PDF</button>' +
      '<button class="b zly" id="usun">Usuń dokument</button>',
    po: () => {
      $('#drukuj').onclick = () => {
        Etykiety.protokol(o.tytul + ' ' + d.numer,
          [['Data', dataPL(d.data)],
           [d.typ === 'PZ' ? 'Dostawca' : d.typ === 'RW' ? 'Punkt' : 'Powód', strona || '—'],
           ['Osoba', d.osoba || '—'],
           ['Nr faktury / WZ', d.nrFaktury || '—'],
           ['Firma', DB.D.ust.firma || '—']],
          [{ tytul: 'Pozycje', kolumny: ['Lp', 'Produkt', 'EAN', 'Jm', 'Ilość', 'Cena', 'Wartość'],
             wiersze: (d.pozycje || []).map(p => {
               const pr = DB.produkty().find(x => x.id === p.produktId) || {};
               return [pr.nazwa || '(usunięty)', pr.ean || '', pr.jm || 'szt', p.ilosc,
                       p.cena != null && p.cena !== '' ? zl(p.cena) : '',
                       p.cena != null && p.cena !== '' ? zl(p.cena * p.ilosc) : ''];
             }) }],
          ['Wydał / przyjął', 'Odebrał']);
      };
      $('#usun').onclick = async () => {
        if (!(await potwierdz('Usunąć dokument?',
          'Stany magazynowe przeliczą się bez tego dokumentu.', 'Usuń'))) return;
        await DB.usun('dokumenty', d.id);
        toast('Usunięto');
        location.hash = '#/stany?f=dok';
      };
    }
  };
}

function drukujListeZakupow() {
  const b = DB.braki();
  Etykiety.protokol('Zapotrzebowanie na materiały',
    [['Data', new Date().toLocaleDateString('pl-PL')],
     ['Firma', DB.D.ust.firma || '—'],
     ['Pozycji', String(b.length)]],
    [{ tytul: 'Pozycje do zamówienia',
       kolumny: ['Lp', 'Produkt', 'EAN', 'Jm', 'Stan', 'Minimum', 'Zamówić', 'Dostawca'],
       wiersze: b.map(x => [x.produkt.nazwa, x.produkt.ean || '', x.produkt.jm || 'szt',
                            x.stan, x.min, x.brakuje, x.produkt.dostawca || '']) }],
    ['Sporządził', 'Zatwierdził']);
}

/* ==================================================================
   SPRZĘT
   ================================================================== */
function sprzetLista(param) {
  const filtr = param.f || '';
  let lista = DB.sprzety();
  if (filtr && filtr !== 'wszystko') lista = lista.filter(s => (s.status || 'uzywany') === filtr);
  lista.sort((a, b) => (a.nazwa || '').localeCompare(b.nazwa || '', 'pl'));

  const statusy = ['wszystko|Wszystkie', 'uzywany|W użyciu', 'magazyn|W magazynie',
                   'naprawa|W naprawie', 'wycofany|Wycofane'];

  return {
    tytul: 'Sprzęt i wyposażenie', tab: 'sprzet',
    html:
      '<div class="filtry">' + statusy.map(x => {
        const [k, n] = x.split('|');
        return '<button type="button" data-s="' + k + '"' +
          ((filtr || 'wszystko') === k ? ' class="akt"' : '') + '>' + n + '</button>';
      }).join('') + '</div>' +
      '<div class="szukaj"><input id="q" type="search" placeholder="Szukaj: nazwa, nr inwentarzowy, seryjny, pokój" autocomplete="off"></div>' +
      '<div class="przyciski">' +
        '<button class="b glowny" id="skanuj">⌗ Skanuj sprzęt</button>' +
        '<button class="b" id="nowy">+ Dodaj</button>' +
      '</div>' +
      '<div class="lista" id="wyniki">' + wierszeSprzetu(lista) + '</div>' +
      (lista.length ? '' : pusto('▣', 'Brak sprzętu na liście.')),
    po: () => {
      const q = $('#q');
      q.oninput = () => {
        const f = q.value.trim();
        const w = f ? lista.filter(s => pasuje(s.nazwa, f) || pasuje(s.nrInw, f) ||
          pasuje(s.nrSer, f) || pasuje(s.model, f) ||
          pasuje(Eksport.nazwaLok(s.lokalizacjaId), f)) : lista;
        $('#wyniki').innerHTML = wierszeSprzetu(w);
      };
      $('#nowy').onclick = () => location.hash = '#/sprzet/nowy';
      $('#skanuj').onclick = async () => {
        const k = await Skaner.jedenKod({ tytul: 'Zeskanuj etykietę sprzętu' });
        if (!k) return;
        const t = DB.poKodzie(k);
        if (t.rodzaj === 'sprzet') location.hash = '#/sprzet/' + t.obiekt.id;
        else if (t.rodzaj === 'lokalizacja') location.hash = '#/lokalizacja/' + t.obiekt.id;
        else { toast('Nieznany kod: ' + k); location.hash = '#/sprzet/nowy?kod=' + encodeURIComponent(k); }
      };
      widok().querySelectorAll('.filtry button[data-s]').forEach(b => {
        b.onclick = () => location.hash = '#/sprzet?f=' + b.dataset.s;
      });
    }
  };
}
function wierszeSprzetu(lista) {
  return lista.map(s => {
    const st = s.status || 'uzywany';
    const kl = st === 'uzywany' ? 'ok' : st === 'naprawa' ? 'uw'
             : (st === 'wycofany' || st === 'zlikwidowany') ? 'zle' : '';
    return '<a class="poz" href="#/sprzet/' + s.id + '"><div class="tre">' +
      '<div class="tyt">' + h(s.nazwa || '(bez nazwy)') +
      (st !== 'uzywany' ? ' <span class="znacz ' + kl + '">' +
        h(Eksport.STATUSY[st] || st) + '</span>' : '') + '</div>' +
      '<div class="pod">' + h(s.nrInw || '') +
      (s.lokalizacjaId ? ' · ' + h(Eksport.nazwaLok(s.lokalizacjaId)) : ' · bez pomieszczenia') +
      '</div></div></a>';
  }).join('');
}

function sprzet(param) {
  const nowy = param.id === 'nowy';
  const s = nowy
    ? { status: 'uzywany', nrInw: DB.nastepnyNrInw(), kodKresk: param.kod || '', dataZakupu: '' }
    : DB.sprzety().find(x => x.id === param.id);
  if (!s) return { tytul: 'Nie znaleziono', html: pusto('?', 'Nie ma takiego sprzętu.') };
  if (nowy && param.kod && !s.kodKresk) s.kodKresk = param.kod;
  if (nowy && !s.kodKresk) s.kodKresk = s.nrInw;

  const lok = DB.lokalizacje().sort((a, b) =>
    Eksport.nazwaLok(a.id).localeCompare(Eksport.nazwaLok(b.id), 'pl'));
  const ruchy = nowy ? [] : DB.D.ruchy.filter(r => r.sprzetId === s.id)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  return {
    tytul: nowy ? 'Nowy sprzęt' : (s.nazwa || s.nrInw),
    wstecz: true,
    html:
      (s.zdjecie ? '<img class="zdjecie" src="' + s.zdjecie + '" alt="">' : '') +
      '<div class="karta">' +
      '<div class="rzad">' + pole('nrInw', 'Nr inwentarzowy', s.nrInw) +
        polSelect('status', 'Status', s.status || 'uzywany',
          Object.keys(Eksport.STATUSY), Eksport.STATUSY) + '</div>' +
      '<div class="zkodem">' + pole('kodKresk', 'Kod z etykiety', s.kodKresk) +
        '<button type="button" class="b maly" id="skan">⌗</button></div>' +
      pole('nazwa', 'Nazwa *', s.nazwa, 'text', 'np. Monitor Dell 24"') +
      '<div class="rzad">' + pole('typ', 'Typ', s.typ, 'text', 'np. monitor') +
        pole('producent', 'Producent', s.producent) + '</div>' +
      '<div class="rzad">' + pole('model', 'Model', s.model) +
        pole('nrSer', 'Nr seryjny', s.nrSer) + '</div>' +
      (lok.length
        ? polSelectId('lokalizacjaId', 'Pomieszczenie', s.lokalizacjaId,
            [['', '— brak —']].concat(lok.map(l => [l.id, Eksport.nazwaLok(l.id)])))
        : '<div class="alert uw"><div>Nie masz jeszcze pomieszczeń. ' +
          '<a href="#/lokalizacja/nowa">Dodaj pierwsze →</a></div></div>') +
      pole('osoba', 'Osoba odpowiedzialna', s.osoba) +
      '<div class="rzad">' + pole('dataZakupu', 'Data zakupu', s.dataZakupu, 'date') +
        pole('wartosc', 'Wartość (zł)', s.wartosc, 'number') + '</div>' +
      pole('gwarancjaDo', 'Gwarancja do', s.gwarancjaDo, 'date') +
      poleObszar('uwagi', 'Uwagi', s.uwagi) +
      '</div>' +
      '<div class="przyciski">' +
        '<button class="b" id="foto">📷 Zdjęcie</button>' +
        '<button class="b" id="etykieta">⌗ Etykieta</button>' +
      '</div>' +
      '<input type="file" id="plik-foto" accept="image/*" capture="environment" hidden>' +
      '<button class="b glowny" id="zapisz">Zapisz</button>' +
      (nowy ? '' :
        '<button class="b" id="protokol">Protokół przekazania</button>' +
        '<button class="b zly" id="usun">Usuń sprzęt</button>') +
      (ruchy.length ? '<div class="naglowek-sekcji">Historia przemieszczeń</div><div class="lista">' +
        ruchy.map(r => '<div class="poz"><div class="tre">' +
          '<div class="tyt">' + h(r.zId ? Eksport.nazwaLok(r.zId) : 'wpis początkowy') +
          ' → ' + h(Eksport.nazwaLok(r.doId)) + '</div>' +
          '<div class="pod">' + h(dataGodzPL(r.data)) + (r.powod ? ' · ' + h(r.powod) : '') +
          '</div></div></div>').join('') + '</div>' : ''),
    po: () => {
      $('#skan').onclick = async () => {
        const k = await Skaner.jedenKod({ tytul: 'Zeskanuj etykietę sprzętu' });
        if (k) { $('#f-kodKresk').value = k; toast('Kod: ' + k); }
      };
      $('#foto').onclick = () => $('#plik-foto').click();
      $('#plik-foto').onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        s.zdjecie = await zZdjecia(f, 900);
        if (!nowy) { await DB.zapisz('sprzet', s); toast('Zdjęcie zapisane'); odswiez(); }
        else toast('Zdjęcie dołączone — zapisz sprzęt');
      };
      $('#etykieta').onclick = () => {
        const kod = $('#f-kodKresk').value || s.nrInw;
        Etykiety.arkusz([{ kod, tytul: $('#f-nrInw').value || s.nrInw,
          podtytul: $('#f-nazwa').value || s.nazwa }], { firma: DB.D.ust.firma });
      };
      $('#zapisz').onclick = async () => {
        const dane = zbierz(['nrInw', 'status', 'kodKresk', 'nazwa', 'typ', 'producent',
          'model', 'nrSer', 'lokalizacjaId', 'osoba', 'dataZakupu', 'wartosc', 'gwarancjaDo', 'uwagi']);
        if (!dane.nazwa) { toast('Podaj nazwę sprzętu'); return; }
        const kol = DB.sprzety().find(x => x.id !== s.id && dane.kodKresk &&
          (x.kodKresk === dane.kodKresk || x.nrInw === dane.kodKresk));
        if (kol) { toast('Ten kod ma już: ' + kol.nazwa, 4000); return; }
        const staraLok = s.lokalizacjaId;
        Object.assign(s, dane);
        const nowaLok = s.lokalizacjaId;
        s.lokalizacjaId = staraLok;
        await DB.zapisz('sprzet', s);
        if (nowaLok !== staraLok) await DB.przenies(s.id, nowaLok || null, '', 'zmiana w karcie sprzętu');
        toast('Zapisano');
        history.back();
      };
      const pr = $('#protokol');
      if (pr) pr.onclick = () => {
        Etykiety.protokol('Protokół przekazania sprzętu',
          [['Data', new Date().toLocaleDateString('pl-PL')],
           ['Firma', DB.D.ust.firma || '—'],
           ['Pomieszczenie', Eksport.nazwaLok(s.lokalizacjaId) || '—'],
           ['Osoba odpowiedzialna', s.osoba || '—']],
          [{ tytul: 'Przekazywany sprzęt',
             kolumny: ['Lp', 'Nr inwentarzowy', 'Nazwa', 'Producent / model', 'Nr seryjny', 'Wartość'],
             wiersze: [[s.nrInw || '', s.nazwa || '',
                        [s.producent, s.model].filter(Boolean).join(' '), s.nrSer || '',
                        s.wartosc ? zl(s.wartosc) : '']] }],
          ['Przekazujący', 'Przyjmujący']);
      };
      const u = $('#usun');
      if (u) u.onclick = async () => {
        if (!(await potwierdz('Usunąć sprzęt?', 'Historia przemieszczeń zostanie zachowana.', 'Usuń'))) return;
        await DB.usun('sprzet', s.id);
        toast('Usunięto');
        location.hash = '#/sprzet';
      };
    }
  };
}

/* ==================================================================
   LOKALIZACJE
   ================================================================== */
function lokalizacje() {
  const lista = DB.lokalizacje().sort((a, b) =>
    Eksport.nazwaLok(a.id).localeCompare(Eksport.nazwaLok(b.id), 'pl'));
  const ile = new Map();
  DB.sprzety().forEach(s => ile.set(s.lokalizacjaId, (ile.get(s.lokalizacjaId) || 0) + 1));

  return {
    tytul: 'Pomieszczenia i punkty', wstecz: true,
    html:
      (lista.length ? '<div class="lista">' + lista.map(l =>
        '<a class="poz" href="#/lokalizacja/' + l.id + '"><div class="tre">' +
        '<div class="tyt">' + h(l.nazwa || l.kod) +
        (l.punkt ? ' <span class="znacz ok">punkt wydań</span>' : '') + '</div>' +
        '<div class="pod">' + [l.budynek, l.pietro, l.kod].filter(Boolean).map(h).join(' · ') +
        (l.osoba ? ' · ' + h(l.osoba) : '') + '</div></div>' +
        '<div class="licz">' + (ile.get(l.id) || 0) + '<small>szt.</small></div></a>').join('') +
        '</div>' : pusto('▢', 'Brak pomieszczeń. Dodaj pierwsze — to podstawa całej ewidencji.')) +
      '<button class="b glowny" id="nowa">+ Nowe pomieszczenie</button>' +
      (lista.length ? '<button class="b" id="etykiety">⌗ Wydrukuj etykiety pomieszczeń</button>' : ''),
    po: () => {
      $('#nowa').onclick = () => location.hash = '#/lokalizacja/nowa';
      const e = $('#etykiety');
      if (e) e.onclick = () => Etykiety.arkusz(
        lista.map(l => ({ kod: l.kodKresk || l.kod || l.id,
                          tytul: l.nazwa || l.kod,
                          podtytul: [l.budynek, l.pietro].filter(Boolean).join(' / ') })),
        { firma: DB.D.ust.firma });
    }
  };
}

function lokalizacja(param) {
  const nowa = param.id === 'nowa';
  const l = nowa ? { punkt: true } : DB.lokalizacje().find(x => x.id === param.id);
  if (!l) return { tytul: 'Nie znaleziono', html: pusto('?', 'Nie ma takiego pomieszczenia.') };

  const sprzetTu = nowa ? [] : DB.sprzety().filter(s => s.lokalizacjaId === l.id);
  const kodPodgl = l.kodKresk || l.kod || '';

  return {
    tytul: nowa ? 'Nowe pomieszczenie' : (l.nazwa || l.kod),
    wstecz: true,
    html:
      (kodPodgl ? '<div class="karta"><div class="qr-podglad">' +
        Etykiety.qrSvg(kodPodgl, { margines: 1 }) + '</div>' +
        '<p style="text-align:center">Kod etykiety: <b>' + h(kodPodgl) + '</b></p></div>' : '') +
      '<div class="karta">' +
      '<div class="rzad">' + pole('kod', 'Kod *', l.kod, 'text', 'np. 1.14') +
        pole('nazwa', 'Nazwa *', l.nazwa, 'text', 'np. Sekretariat') + '</div>' +
      '<div class="rzad">' + pole('budynek', 'Budynek', l.budynek) +
        pole('pietro', 'Piętro', l.pietro) + '</div>' +
      pole('osoba', 'Osoba odpowiedzialna', l.osoba) +
      '<div class="zkodem">' + pole('kodKresk', 'Kod etykiety', l.kodKresk, 'text',
        'puste = użyje kodu pomieszczenia') +
        '<button type="button" class="b maly" id="skan">⌗</button></div>' +
      '<label class="ptak"><input type="checkbox" id="f-punkt"' + (l.punkt ? ' checked' : '') +
        '><span class="et">To punkt, na który wydaje się materiały</span></label>' +
      '</div>' +
      '<button class="b glowny" id="zapisz">Zapisz</button>' +
      (nowa ? '' :
        '<button class="b" id="etykieta">⌗ Wydrukuj etykietę</button>' +
        '<button class="b" id="spis">☑ Zrób spis tego pomieszczenia</button>' +
        '<button class="b zly" id="usun">Usuń pomieszczenie</button>') +
      (sprzetTu.length ? '<div class="naglowek-sekcji">Sprzęt tutaj (' + sprzetTu.length + ')</div>' +
        '<div class="lista">' + wierszeSprzetu(sprzetTu) + '</div>' : ''),
    po: () => {
      $('#skan').onclick = async () => {
        const k = await Skaner.jedenKod({ tytul: 'Zeskanuj etykietę pomieszczenia' });
        if (k) { $('#f-kodKresk').value = k; toast('Kod: ' + k); }
      };
      $('#zapisz').onclick = async () => {
        const dane = zbierz(['kod', 'nazwa', 'budynek', 'pietro', 'osoba', 'kodKresk']);
        dane.punkt = $('#f-punkt').checked;
        if (!dane.kod && !dane.nazwa) { toast('Podaj kod albo nazwę'); return; }
        if (!dane.kodKresk) dane.kodKresk = dane.kod;
        const kol = DB.lokalizacje().find(x => x.id !== l.id && x.kodKresk &&
          x.kodKresk === dane.kodKresk);
        if (kol) { toast('Ten kod ma już: ' + (kol.nazwa || kol.kod), 4000); return; }
        await DB.zapisz('lokalizacje', Object.assign(l, dane));
        toast('Zapisano');
        history.back();
      };
      const e = $('#etykieta');
      if (e) e.onclick = () => Etykiety.arkusz(
        [{ kod: l.kodKresk || l.kod, tytul: l.nazwa || l.kod,
           podtytul: [l.budynek, l.pietro].filter(Boolean).join(' / ') }],
        { firma: DB.D.ust.firma });
      const sp = $('#spis');
      if (sp) sp.onclick = () => location.hash = '#/spis?lok=' + l.id;
      const u = $('#usun');
      if (u) u.onclick = async () => {
        if (sprzetTu.length) {
          toast('Najpierw przenieś stąd sprzęt (' + sprzetTu.length + ' szt.)', 3500);
          return;
        }
        if (!(await potwierdz('Usunąć pomieszczenie?', 'Dokumenty wydań zostaną nienaruszone.', 'Usuń'))) return;
        await DB.usun('lokalizacje', l.id);
        toast('Usunięto');
        location.hash = '#/lokalizacje';
      };
    }
  };
}

/* ==================================================================
   INWENTARYZACJA
   ================================================================== */
let spisStan = null;

function spis(param) {
  const lok = param.lok ? DB.lokalizacje().find(l => l.id === param.lok) : null;

  if (!lok) {
    const lista = DB.lokalizacje().sort((a, b) =>
      Eksport.nazwaLok(a.id).localeCompare(Eksport.nazwaLok(b.id), 'pl'));
    return {
      tytul: 'Inwentaryzacja', wstecz: true,
      html:
        '<div class="karta"><h2>Jak to działa</h2><p>Zeskanuj etykietę na drzwiach albo wybierz ' +
        'pomieszczenie z listy. Potem skanuj po kolei sprzęt, który widzisz. Na koniec ' +
        'dostaniesz listę zgodnych, brakujących i nadmiarowych pozycji.</p></div>' +
        '<button class="b glowny" id="skanuj-pokoj">⌗ Zeskanuj pomieszczenie</button>' +
        (lista.length ? '<div class="naglowek-sekcji">Albo wybierz z listy</div><div class="lista">' +
          lista.map(l => '<a class="poz" href="#/spis?lok=' + l.id + '"><div class="tre">' +
            '<div class="tyt">' + h(l.nazwa || l.kod) + '</div><div class="pod">' +
            h([l.budynek, l.pietro].filter(Boolean).join(' / ') || 'bez lokalizacji') +
            '</div></div><div class="licz">' +
            DB.sprzety().filter(s => s.lokalizacjaId === l.id).length + '<small>szt.</small></div></a>')
            .join('') + '</div>'
          : pusto('▢', 'Najpierw dodaj pomieszczenia.')),
      po: () => {
        $('#skanuj-pokoj').onclick = async () => {
          const k = await Skaner.jedenKod({ tytul: 'Zeskanuj etykietę pomieszczenia' });
          if (!k) return;
          const t = DB.poKodzie(k);
          if (t.rodzaj === 'lokalizacja') location.hash = '#/spis?lok=' + t.obiekt.id;
          else toast('To nie jest kod pomieszczenia: ' + k, 3500);
        };
      }
    };
  }

  if (!spisStan || spisStan.lokId !== lok.id) {
    spisStan = { lokId: lok.id, znalezione: new Set(), nadmiarowe: new Set(), nieznane: [] };
  }

  const oczekiwane = DB.sprzety().filter(s => s.lokalizacjaId === lok.id);
  const brakujace = oczekiwane.filter(s => !spisStan.znalezione.has(s.id));
  const nadmiar = [...spisStan.nadmiarowe].map(id => DB.sprzety().find(s => s.id === id)).filter(Boolean);

  const sekcja = (tyt, lista, klasa, opis) =>
    '<div class="naglowek-sekcji">' + tyt + ' (' + lista.length + ')</div>' +
    (lista.length
      ? '<div class="lista">' + lista.map(s => '<a class="poz" href="#/sprzet/' + s.id + '">' +
          '<div class="tre"><div class="tyt">' + h(s.nazwa || s.nrInw) + '</div>' +
          '<div class="pod">' + h(s.nrInw || '') +
          (klasa === 'nadmiar' ? ' · przypisany do: ' +
            h(Eksport.nazwaLok(s.lokalizacjaId) || 'brak') : '') +
          '</div></div><div class="licz"><span class="znacz ' +
          (klasa === 'ok' ? 'ok' : klasa === 'brak' ? 'zle' : 'uw') + '">' +
          (klasa === 'ok' ? '✓' : klasa === 'brak' ? 'brak' : 'obcy') + '</span></div></a>').join('') +
        '</div>'
      : '<p style="color:var(--tx2);font-size:13.5px;margin:0 2px 8px">' + h(opis) + '</p>');

  return {
    tytul: 'Spis: ' + (lok.nazwa || lok.kod),
    wstecz: true,
    html:
      '<div class="stat">' +
        '<div><b style="color:var(--ok)">' + spisStan.znalezione.size + '</b><span>znalezione</span></div>' +
        '<div><b style="color:var(--zle)">' + brakujace.length + '</b><span>brakujące</span></div>' +
        '<div><b style="color:var(--uw)">' + nadmiar.length + '</b><span>nadmiarowe</span></div>' +
      '</div>' +
      '<button class="b glowny" id="skanuj">⌗ Skanuj sprzęt w pomieszczeniu</button>' +
      sekcja('Zgodne', oczekiwane.filter(s => spisStan.znalezione.has(s.id)), 'ok',
             'Nic jeszcze nie zeskanowano.') +
      sekcja('Brakujące', brakujace, 'brak', 'Wszystko na miejscu.') +
      sekcja('Nadmiarowe', nadmiar, 'nadmiar', 'Brak sprzętu z innych pomieszczeń.') +
      (spisStan.nieznane.length ? '<div class="alert uw"><div><b>Kody spoza ewidencji (' +
        spisStan.nieznane.length + ')</b>' + h(spisStan.nieznane.join(', ')) + '</div></div>' : '') +
      '<button class="b" id="przenies" ' + (nadmiar.length ? '' : 'disabled') +
        '>Przypisz nadmiarowe do tego pomieszczenia</button>' +
      '<button class="b glowny" id="zakoncz">Zakończ i zapisz protokół</button>' +
      '<button class="b" id="wyczysc">Zacznij spis od nowa</button>',
    po: () => {
      $('#skanuj').onclick = () => Skaner.otworz({
        tytul: 'Spis: ' + (lok.nazwa || lok.kod),
        podpowiedz: 'Skanuj kolejne etykiety sprzętu.',
        onKod: kod => {
          const t = DB.poKodzie(kod);
          if (t.rodzaj !== 'sprzet') {
            if (!spisStan.nieznane.includes(kod)) spisStan.nieznane.push(kod);
            Skaner.info('Kod spoza ewidencji: ' + kod);
            return;
          }
          const s = t.obiekt;
          if (s.lokalizacjaId === lok.id) {
            spisStan.znalezione.add(s.id);
            Skaner.info('✓ ' + (s.nazwa || s.nrInw));
          } else {
            spisStan.nadmiarowe.add(s.id);
            Skaner.info('Obcy: ' + (s.nazwa || s.nrInw) + ' (z: ' +
              (Eksport.nazwaLok(s.lokalizacjaId) || 'brak') + ')');
          }
        }
      });
      $('#przenies').onclick = async () => {
        if (!(await potwierdz('Przypisać nadmiarowe?',
          nadmiar.length + ' szt. zostanie przypisane do tego pomieszczenia. ' +
          'Poprzednie przypisanie zapisze się w historii.', 'Przypisz'))) return;
        for (const s of nadmiar) {
          await DB.przenies(s.id, lok.id, '', 'inwentaryzacja');
          spisStan.znalezione.add(s.id);
        }
        spisStan.nadmiarowe.clear();
        toast('Przypisano ' + nadmiar.length + ' szt.');
        odswiez();
      };
      $('#zakoncz').onclick = async () => {
        const zapis = {
          lokalizacjaId: lok.id, data: DB.teraz(), kto: DB.D.ust.osoba || '',
          znalezione: [...spisStan.znalezione],
          brakujace: brakujace.map(s => s.id),
          nadmiarowe: [...spisStan.nadmiarowe],
          nieznane: spisStan.nieznane.slice()
        };
        await DB.zapisz('spisy', zapis);
        const wiersz = s => [s.nrInw || '', s.nazwa || '',
                             [s.producent, s.model].filter(Boolean).join(' '), s.nrSer || ''];
        Etykiety.protokol('Protokół inwentaryzacji',
          [['Pomieszczenie', Eksport.nazwaLok(lok.id)],
           ['Data', new Date().toLocaleString('pl-PL')],
           ['Firma', DB.D.ust.firma || '—'],
           ['Wynik', spisStan.znalezione.size + ' zgodnych, ' + brakujace.length +
            ' brakujących, ' + nadmiar.length + ' nadmiarowych']],
          [{ tytul: 'Zgodne', kolumny: ['Lp', 'Nr inw.', 'Nazwa', 'Producent / model', 'Nr seryjny'],
             wiersze: oczekiwane.filter(s => spisStan.znalezione.has(s.id)).map(wiersz) },
           { tytul: 'Brakujące', kolumny: ['Lp', 'Nr inw.', 'Nazwa', 'Producent / model', 'Nr seryjny'],
             wiersze: brakujace.map(wiersz) },
           { tytul: 'Nadmiarowe', kolumny: ['Lp', 'Nr inw.', 'Nazwa', 'Producent / model', 'Nr seryjny'],
             wiersze: nadmiar.map(wiersz) }],
          ['Spisujący', 'Osoba odpowiedzialna']);
        spisStan = null;
        toast('Protokół zapisany');
      };
      $('#wyczysc').onclick = () => { spisStan = null; odswiez(); };
    }
  };
}

/* ==================================================================
   SKANUJ (rozpoznanie dowolnego kodu)
   ================================================================== */
function skanuj() {
  return {
    tytul: 'Skanowanie', wstecz: true,
    html: '<div class="karta"><h2>Co to za kod?</h2><p>Aplikacja rozpozna, czy to produkt ' +
      'z katalogu, sprzęt czy pomieszczenie, i przeniesie Cię na właściwy ekran.</p></div>' +
      '<button class="b glowny" id="start">⌗ Otwórz skaner</button>' +
      '<label><span class="et">Albo wpisz kod ręcznie</span>' +
      '<input id="reczny" type="text" inputmode="numeric" placeholder="np. 5901234567890"></label>' +
      '<button class="b" id="szukaj">Szukaj</button>' +
      '<div id="wynik"></div>',
    po: () => {
      const obsluz = kod => {
        if (!kod) return;
        const t = DB.poKodzie(kod);
        if (t.rodzaj === 'produkt') location.hash = '#/produkt/' + t.obiekt.id;
        else if (t.rodzaj === 'sprzet') location.hash = '#/sprzet/' + t.obiekt.id;
        else if (t.rodzaj === 'lokalizacja') location.hash = '#/lokalizacja/' + t.obiekt.id;
        else {
          $('#wynik').innerHTML = '<div class="alert uw"><div><b>Kod ' + h(kod) +
            ' nie jest w ewidencji</b>Możesz założyć nową pozycję.</div></div>' +
            '<a class="b" href="#/produkt/nowy">Nowy produkt</a>' +
            '<a class="b" href="#/sprzet/nowy?kod=' + encodeURIComponent(kod) + '">Nowy sprzęt</a>';
        }
      };
      $('#start').onclick = async () => obsluz(await Skaner.jedenKod({ tytul: 'Skanuj dowolny kod' }));
      $('#szukaj').onclick = () => obsluz($('#reczny').value.trim());
      $('#reczny').onkeydown = e => { if (e.key === 'Enter') obsluz(e.target.value.trim()); };
    }
  };
}

/* ==================================================================
   EKSPORT / KOPIA
   ================================================================== */
function eksport() {
  const k = DB.kopiaPotrzebna();
  return {
    tytul: 'Excel i kopia zapasowa', wstecz: true,
    html:
      (k ? '<div class="alert zle"><div><b>Kopia zapasowa jest zaległa</b>' +
        'Dane aplikacji siedzą wyłącznie w tym telefonie. Wyczyszczenie danych ' +
        'przeglądarki albo zmiana telefonu oznacza ich utratę.</div></div>' : '') +
      '<div class="karta"><h2>Raport Excel</h2><p>Wszystkie dane w jednym pliku .xlsx: ' +
      'stany, zapotrzebowanie, dostawy, wydania, zużycie wg punktów, sprzęt, ' +
      'pomieszczenia i historia.</p></div>' +
      '<button class="b glowny" id="xlsx">⤓ Wygeneruj raport Excel</button>' +
      '<div class="karta"><h2>Kopia zapasowa</h2><p>Plik .json z całą bazą. ' +
      'Trzymaj go poza telefonem — na dysku firmowym albo we własnej skrzynce. ' +
      (DB.D.ust.ostatniaKopia ? 'Ostatnia kopia: <b>' + h(dataGodzPL(DB.D.ust.ostatniaKopia)) +
        '</b>, od tego czasu ' + (DB.D.ust.operacjiOdKopii || 0) + ' zmian.'
        : 'Nie zrobiono jeszcze żadnej kopii.') + '</p></div>' +
      '<button class="b glowny" id="kopia">⤓ Zrób kopię zapasową</button>' +
      '<button class="b" id="wczytaj">⤒ Wczytaj kopię z pliku</button>' +
      '<input type="file" id="plik-kopia" accept=".json,application/json" hidden>' +
      '<div class="karta"><h2>Jak wysłać plik mailem</h2><p>Edge na Androidzie nie pozwala ' +
      'wysłać pliku prosto ze strony, więc plik zapisuje się w Pobranych. Otwórz aplikację ' +
      '<b>Pliki</b> → przytrzymaj plik → <b>Udostępnij</b> → Outlook. Dwa dodatkowe kliknięcia.</p></div>',
    po: () => {
      $('#xlsx').onclick = async () => {
        const b = $('#xlsx');
        b.disabled = true; b.textContent = 'Generuję…';
        try {
          const blob = Eksport.plik();
          const wynik = await Eksport.oddaj(blob, Eksport.nazwaPliku('magazyn'));
          toast(wynik.sposob === 'zapisane'
            ? 'Plik zapisany w Pobranych' : 'Gotowe', 3600);
        } catch (e) {
          toast('Błąd generowania: ' + e.message, 5000);
        }
        b.disabled = false; b.textContent = '⤓ Wygeneruj raport Excel';
      };
      $('#kopia').onclick = async () => {
        const dane = JSON.stringify(DB.kopia());
        const blob = new Blob([dane], { type: 'application/json' });
        await Eksport.oddaj(blob, Eksport.nazwaPliku('kopia').replace('.xlsx', '.json'));
        await DB.ustaw('ostatniaKopia', DB.teraz());
        await DB.ustaw('operacjiOdKopii', 0);
        toast('Kopia zapisana w Pobranych', 3600);
        odswiez();
      };
      $('#wczytaj').onclick = () => $('#plik-kopia').click();
      $('#plik-kopia').onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        let obj;
        try { obj = JSON.parse(await f.text()); }
        catch (err) { toast('To nie jest poprawny plik kopii'); return; }
        const ile = Object.values(obj.dane || {}).reduce((s, x) => s + (x.length || 0), 0);
        modal('Wczytać kopię?',
          '<p>Plik z ' + h(dataGodzPL(obj.data)) + ', ' + ile + ' rekordów.</p>' +
          '<p style="margin-top:8px;font-size:13.5px;color:var(--tx2)">' +
          '<b>Zastąp</b> — usuwa obecne dane i wstawia te z pliku.<br>' +
          '<b>Scal</b> — łączy oba zestawy, przy konflikcie wygrywa nowszy wpis.</p>',
          [{ tekst: 'Anuluj' },
           { tekst: 'Scal', akcja: async () => { await wczytajKopie(obj, true); } },
           { tekst: 'Zastąp', klasa: 'zly', akcja: async () => { await wczytajKopie(obj, false); } }]);
      };
    }
  };
}
async function wczytajKopie(obj, scalaj) {
  try {
    await DB.przywroc(obj, scalaj);
    toast(scalaj ? 'Dane scalone' : 'Dane wczytane', 3200);
    location.hash = '#/pulpit';
    odswiez();
  } catch (e) { toast('Błąd: ' + e.message, 5000); }
}

/* ==================================================================
   WIĘCEJ / USTAWIENIA
   ================================================================== */
function wiecej() {
  return {
    tytul: 'Więcej', tab: 'wiecej',
    html:
      '<div class="lista">' +
        poz('#/lokalizacje', '▢', 'Pomieszczenia i punkty', DB.lokalizacje().length + ' zdefiniowanych') +
        poz('#/spis', '☑', 'Inwentaryzacja', 'Spis sprzętu z natury') +
        poz('#/etykiety', '⌗', 'Etykiety QR', 'Druk arkuszy na naklejki A4') +
        poz('#/skanuj', '⌕', 'Rozpoznaj kod', 'Sprawdź, co kryje się pod kodem') +
      '</div>' +
      '<div class="lista">' +
        poz('#/eksport', '⤓', 'Excel i kopia zapasowa', 'Raport i zabezpieczenie danych') +
        poz('#/ustawienia', '⚙', 'Ustawienia', 'Firma, numeracja, przypomnienia') +
        poz('#/opis', 'ⓘ', 'Jak to działa', 'Krótka instrukcja') +
      '</div>',
    po: () => {}
  };
}
function poz(href, ikn, tyt, pod) {
  return '<a class="poz" href="' + href + '"><div class="tre">' +
    '<div class="tyt">' + ikn + '  ' + h(tyt) + '</div>' +
    '<div class="pod">' + h(pod) + '</div></div><div class="licz">›</div></a>';
}

function ustawienia() {
  const u = DB.D.ust;
  return {
    tytul: 'Ustawienia', wstecz: true,
    html:
      '<div class="karta">' +
      pole('firma', 'Nazwa firmy / jednostki', u.firma, 'text', 'pojawi się na etykietach i wydrukach') +
      pole('osoba', 'Twoje imię i nazwisko', u.osoba, 'text', 'podpisywanie protokołów') +
      pole('prefiksInw', 'Prefiks numerów inwentarzowych', u.prefiksInw, 'text', 'np. INW') +
      '<p style="font-size:13px;color:var(--tx2);margin:-4px 0 10px">Następny numer: <b>' +
        h(DB.nastepnyNrInw()) + '</b></p>' +
      '<div class="rzad">' +
        pole('przypomnijPoDniach', 'Przypomnij o kopii po dniach', u.przypomnijPoDniach, 'number') +
        pole('przypomnijPoOperacjach', '…albo po liczbie zmian', u.przypomnijPoOperacjach, 'number') +
      '</div>' +
      '</div>' +
      '<button class="b glowny" id="zapisz">Zapisz ustawienia</button>' +
      '<div class="karta"><h2>Zajęte miejsce</h2><p id="miejsce">liczę…</p></div>' +
      '<div class="karta"><h2>Dane w tym urządzeniu</h2><p>' +
        DB.D.produkty.length + ' produktów · ' + DB.D.dokumenty.length + ' dokumentów · ' +
        DB.D.sprzet.length + ' sztuk sprzętu · ' + DB.D.ruchy.length + ' ruchów · ' +
        DB.D.spisy.length + ' spisów</p></div>' +
      '<button class="b zly" id="kasuj">Skasuj wszystkie dane</button>',
    po: async () => {
      $('#zapisz').onclick = async () => {
        const d = zbierz(['firma', 'osoba', 'prefiksInw', 'przypomnijPoDniach', 'przypomnijPoOperacjach']);
        for (const [k, v] of Object.entries(d)) await DB.ustaw(k, v);
        toast('Zapisano');
        odswiez();
      };
      $('#kasuj').onclick = async () => {
        if (!(await potwierdz('Skasować wszystko?',
          'Wszystkie dane znikną bezpowrotnie. Jeśli nie masz kopii zapasowej — nie rób tego.',
          'Kasuj'))) return;
        if (!(await potwierdz('Na pewno?', 'To już naprawdę ostatnie pytanie.', 'Tak, kasuj'))) return;
        indexedDB.deleteDatabase('magazyn');
        toast('Skasowano. Odśwież stronę.', 6000);
      };
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        const trw = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        $('#miejsce').innerHTML = (e.usage / 1048576).toFixed(1) + ' MB z ' +
          (e.quota / 1073741824).toFixed(1) + ' GB · trwały magazyn: <b>' +
          (trw ? 'tak' : 'nie') + '</b>';
      }
    }
  };
}

function etykiety() {
  const spr = DB.sprzety(), lok = DB.lokalizacje();
  return {
    tytul: 'Etykiety QR', wstecz: true,
    html:
      '<div class="karta"><h2>Jak używać</h2><p>Wydrukuj arkusz na naklejkach samoprzylepnych A4. ' +
      'Etykiety pomieszczeń nakleja się przy drzwiach, etykiety sprzętu — na obudowie. ' +
      'Wtedy działa spis z natury: skan pokoju, potem skan sprzętów.</p></div>' +
      '<label><span class="et">Rozmiar etykiet</span><select id="uklad">' +
        Object.entries(Etykiety.UKLADY).map(([k, v]) =>
          '<option value="' + k + '">' + h(v.opis) + '</option>').join('') +
      '</select></label>' +
      '<button class="b glowny" id="lok" ' + (lok.length ? '' : 'disabled') + '>' +
        'Wszystkie pomieszczenia (' + lok.length + ')</button>' +
      '<button class="b glowny" id="spr" ' + (spr.length ? '' : 'disabled') + '>' +
        'Cały sprzęt (' + spr.length + ')</button>' +
      '<button class="b" id="bez" ' + (spr.length ? '' : 'disabled') + '>' +
        'Tylko sprzęt bez etykiety</button>',
    po: () => {
      const uk = () => $('#uklad').value;
      $('#lok').onclick = () => Etykiety.arkusz(lok.map(l => ({
        kod: l.kodKresk || l.kod || l.id, tytul: l.nazwa || l.kod,
        podtytul: [l.budynek, l.pietro].filter(Boolean).join(' / ')
      })), { uklad: uk(), firma: DB.D.ust.firma });
      const zSprzetu = lista => Etykiety.arkusz(lista.map(s => ({
        kod: s.kodKresk || s.nrInw, tytul: s.nrInw || '', podtytul: s.nazwa || ''
      })), { uklad: uk(), firma: DB.D.ust.firma });
      $('#spr').onclick = () => zSprzetu(spr);
      $('#bez').onclick = () => {
        const l = spr.filter(s => !s.kodKresk || s.kodKresk === s.nrInw);
        if (!l.length) { toast('Każdy sprzęt ma już własny kod'); return; }
        zSprzetu(l);
      };
    }
  };
}

function opis() {
  return {
    tytul: 'Jak to działa', wstecz: true,
    html:
      '<div class="karta"><h2>Dwa osobne światy</h2><p><b>Materiały</b> to rzeczy zużywalne — ' +
      'papier, długopisy, tonery. Liczy się ile ich jest. <b>Sprzęt</b> to konkretne sztuki — ' +
      'monitor, drukarka, krzesło. Liczy się gdzie stoją. Dlatego to dwa osobne moduły.</p></div>' +
      '<div class="karta"><h2>Stan liczy się sam</h2><p>Aplikacja nigdy nie trzyma stanu jako ' +
      'liczby do poprawiania. Stan to suma dostaw minus wydania. Dzięki temu każda liczba ' +
      'daje się rozłożyć na dokumenty i zawsze się zgadza. Różnice po spisie wprowadza się ' +
      'dokumentem korekty, nie ręczną poprawką.</p></div>' +
      '<div class="karta"><h2>Kolejność na start</h2><p>1. Ustawienia — nazwa firmy i prefiks numerów.<br>' +
      '2. Pomieszczenia i punkty.<br>3. Wydrukuj i naklej etykiety pomieszczeń.<br>' +
      '4. Sprzęt — dodawaj i od razu drukuj etykiety.<br>5. Produkty — dodają się same ' +
      'przy pierwszym skanowaniu dostawy.</p></div>' +
      '<div class="karta"><h2>Dane są tylko tutaj</h2><p>Cała baza siedzi w tej przeglądarce, ' +
      'w tym profilu Androida. Nic nie wychodzi do internetu. Dlatego kopia zapasowa nie jest ' +
      'opcją, tylko warunkiem sensownego używania — rób ją co tydzień i trzymaj poza telefonem.</p></div>' +
      '<div class="karta"><h2>Kiedy dojdą inne osoby</h2><p>Aplikacja jest przygotowana na ' +
      'późniejsze dołożenie synchronizacji: każdy wpis ma własny identyfikator i znacznik czasu, ' +
      'a dokumenty tylko się dopisuje. Do tego czasu można pracować na jednym urządzeniu, ' +
      'a pozostałym osobom przekazywać raport Excel.</p></div>'
  };
}

/* ==================================================================
   pola formularzy
   ================================================================== */
function pole(id, etykieta, wart, typ, podp) {
  return '<label><span class="et">' + h(etykieta) + '</span>' +
    '<input id="f-' + id + '" type="' + (typ || 'text') + '"' +
    (typ === 'number' ? ' inputmode="decimal" step="any"' : '') +
    ' value="' + h(wart == null ? '' : wart) + '"' +
    (podp ? ' placeholder="' + h(podp) + '"' : '') + '></label>';
}
function poleObszar(id, etykieta, wart) {
  return '<label><span class="et">' + h(etykieta) + '</span>' +
    '<textarea id="f-' + id + '">' + h(wart == null ? '' : wart) + '</textarea></label>';
}
function polSelect(id, etykieta, wart, opcje, etykiety) {
  return '<label><span class="et">' + h(etykieta) + '</span><select id="f-' + id + '">' +
    opcje.map(o => '<option value="' + h(o) + '"' + (o === wart ? ' selected' : '') + '>' +
      h(etykiety ? etykiety[o] : o) + '</option>').join('') + '</select></label>';
}
function polSelectId(id, etykieta, wart, pary) {
  return '<label><span class="et">' + h(etykieta) + '</span><select id="f-' + id + '">' +
    pary.map(([v, n]) => '<option value="' + h(v) + '"' + (v === wart ? ' selected' : '') + '>' +
      h(n) + '</option>').join('') + '</select></label>';
}
function zbierz(pola) {
  const o = {};
  pola.forEach(p => {
    const e = $('#f-' + p);
    if (!e) return;
    let v = e.value;
    if (e.type === 'number') v = v === '' ? null : Number(v);
    else if (typeof v === 'string') v = v.trim();
    o[p] = v;
  });
  return o;
}

/* ==================================================================
   ROUTER
   ================================================================== */
const TRASY = [
  [/^\/?$|^\/pulpit$/, () => pulpit()],
  [/^\/stany$/, p => stany(p)],
  [/^\/produkt\/(.+)$/, (p, m) => produkt(Object.assign({ id: m[1] }, p))],
  [/^\/dokument\/nowy\/(\w+)$/, (p, m) => dokument({ id: 'nowy', typ: m[1] })],
  [/^\/dokument\/(.+)$/, (p, m) => dokument({ id: m[1] })],
  [/^\/sprzet$/, p => sprzetLista(p)],
  [/^\/sprzet\/(.+)$/, (p, m) => sprzet(Object.assign({ id: m[1] }, p))],
  [/^\/lokalizacje$/, () => lokalizacje()],
  [/^\/lokalizacja\/(.+)$/, (p, m) => lokalizacja(Object.assign({ id: m[1] }, p))],
  [/^\/spis$/, p => spis(p)],
  [/^\/skanuj$/, () => skanuj()],
  [/^\/etykiety$/, () => etykiety()],
  [/^\/eksport$/, () => eksport()],
  [/^\/ustawienia$/, () => ustawienia()],
  [/^\/opis$/, () => opis()],
  [/^\/wiecej$/, () => wiecej()]
];

const TAB_TRASY = { pulpit: 'pulpit', stany: 'magazyn', produkt: 'magazyn',
  dokument: 'magazyn', sprzet: 'sprzet', wiecej: 'wiecej' };

function rozbij() {
  const raw = location.hash.replace(/^#/, '') || '/pulpit';
  const [sciezka, qs] = raw.split('?');
  const param = {};
  new URLSearchParams(qs || '').forEach((v, k) => { param[k] = v; });
  return { sciezka, param };
}

let ostatniaSciezka = '';

function rysuj() {
  const { sciezka, param } = rozbij();
  let ekran = null;
  for (const [re, fn] of TRASY) {
    const m = sciezka.match(re);
    if (m) { ekran = fn(param, m); break; }
  }
  if (!ekran) ekran = { tytul: 'Nie znaleziono', html: pusto('?', 'Nie ma takiego ekranu.') };

  $('#tytul').textContent = ekran.tytul || 'Magazyn';
  $('#wstecz').hidden = !ekran.wstecz;
  $('#akcja').hidden = !ekran.akcja;
  if (ekran.akcja) {
    $('#akcja').textContent = ekran.akcja.tekst;
    $('#akcja').onclick = ekran.akcja.fn;
  }

  widok().innerHTML = ekran.html || '';
  if (sciezka !== ostatniaSciezka) { widok().scrollTop = 0; scrollTo(0, 0); }
  ostatniaSciezka = sciezka;

  const tab = ekran.tab || TAB_TRASY[sciezka.split('/')[1]] || '';
  document.querySelectorAll('#dol a').forEach(a =>
    a.classList.toggle('akt', a.dataset.tab === tab));

  if (ekran.po) ekran.po();
}

function odswiez() { rysuj(); }

global.UI = { rysuj, odswiez, toast, modal, zamknijModal, potwierdz, h };

})(window);
