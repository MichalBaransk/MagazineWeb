/* ------------------------------------------------------------------
   eksport.js — budowa arkuszy Excela z danych aplikacji
   oraz oddanie pliku użytkownikowi (udostępnienie albo zapis).
   ------------------------------------------------------------------ */
(function (global) {
'use strict';

const dt = s => s ? new Date(s) : null;
const dzis = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
};

const STATUSY = {
  uzywany: 'w użyciu', magazyn: 'w magazynie', naprawa: 'w naprawie',
  wypozyczony: 'wypożyczony', wycofany: 'wycofany', zlikwidowany: 'zlikwidowany'
};

function nazwaLok(id) {
  const l = DB.D.lokalizacje.find(x => x.id === id);
  if (!l) return '';
  return [l.budynek, l.pietro, l.nazwa].filter(Boolean).join(' / ');
}
function nazwaProd(id) {
  const p = DB.D.produkty.find(x => x.id === id);
  return p ? p.nazwa : '(usunięty produkt)';
}
function prod(id) { return DB.D.produkty.find(x => x.id === id) || {}; }

/* ---------- poszczególne arkusze ---------- */

function arkStany() {
  const s = DB.stany(), ceny = DB.ostatnieCeny(), ost = DB.ostatnieDostawy();
  const wiersze = DB.produkty()
    .sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'))
    .map(p => {
      const stan = s.get(p.id) || 0;
      const min = Number(p.stanMin) || 0;
      const cena = ceny.get(p.id);
      return [p.nazwa, p.ean || '', p.kategoria || '', p.jm || 'szt',
              stan, min || null, min > stan ? min - stan : null,
              cena != null ? cena : null, cena != null ? cena * stan : null,
              dt(ost.get(p.id)), p.dostawca || ''];
    });
  return {
    nazwa: 'Stany magazynowe',
    kolumny: [
      { n: 'Produkt', t: 'txt', w: 36 }, { n: 'EAN', t: 'txt', w: 15 },
      { n: 'Kategoria', t: 'txt', w: 16 }, { n: 'Jm', t: 'txt', w: 7 },
      { n: 'Stan', t: 'int', w: 9 }, { n: 'Minimum', t: 'int', w: 10 },
      { n: 'Brakuje', t: 'int', w: 10 }, { n: 'Cena ost.', t: 'zl', w: 11 },
      { n: 'Wartość', t: 'zl', w: 13 }, { n: 'Ostatnia dostawa', t: 'data', w: 15 },
      { n: 'Dostawca', t: 'txt', w: 20 }
    ],
    wiersze,
    podswietl: w => w[6] != null,
    sumy: [4, 8]
  };
}

function arkDoZamowienia() {
  const wiersze = DB.braki().map(b => [
    b.produkt.nazwa, b.produkt.ean || '', b.produkt.jm || 'szt',
    b.stan, b.min, b.brakuje,
    b.produkt.wOpak ? Math.ceil(b.brakuje / Number(b.produkt.wOpak)) : null,
    b.produkt.dostawca || ''
  ]);
  return {
    nazwa: 'Do zamówienia',
    kolumny: [
      { n: 'Produkt', t: 'txt', w: 36 }, { n: 'EAN', t: 'txt', w: 15 },
      { n: 'Jm', t: 'txt', w: 7 }, { n: 'Stan', t: 'int', w: 9 },
      { n: 'Minimum', t: 'int', w: 10 }, { n: 'Zamówić min.', t: 'int', w: 13 },
      { n: 'Opakowań', t: 'int', w: 11 }, { n: 'Dostawca', t: 'txt', w: 22 }
    ],
    wiersze, podswietl: () => true, sumy: [5]
  };
}

function arkDokumenty(typ, nazwa, etykietaStrony) {
  const wiersze = [];
  DB.dokumenty()
    .filter(d => d.typ === typ)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    .forEach(d => {
      const strona = typ === 'PZ' ? (d.dostawca || '')
                   : typ === 'RW' ? nazwaLok(d.lokalizacjaId) : (d.powod || '');
      (d.pozycje || []).forEach(p => {
        const pr = prod(p.produktId);
        wiersze.push([
          dt(d.data), d.numer || '', strona, d.osoba || '',
          pr.nazwa || nazwaProd(p.produktId), pr.ean || '', pr.jm || 'szt',
          Number(p.ilosc) || 0,
          p.cena != null && p.cena !== '' ? Number(p.cena) : null,
          p.cena != null && p.cena !== '' ? Number(p.cena) * (Number(p.ilosc) || 0) : null,
          d.nrFaktury || '', d.uwagi || ''
        ]);
      });
    });
  return {
    nazwa,
    kolumny: [
      { n: 'Data', t: 'data', w: 12 }, { n: 'Dokument', t: 'txt', w: 16 },
      { n: etykietaStrony, t: 'txt', w: 24 }, { n: 'Osoba', t: 'txt', w: 18 },
      { n: 'Produkt', t: 'txt', w: 34 }, { n: 'EAN', t: 'txt', w: 15 },
      { n: 'Jm', t: 'txt', w: 7 }, { n: 'Ilość', t: 'int', w: 9 },
      { n: 'Cena', t: 'zl', w: 11 }, { n: 'Wartość', t: 'zl', w: 13 },
      { n: 'Nr faktury/WZ', t: 'txt', w: 16 }, { n: 'Uwagi', t: 'txt', w: 26 }
    ],
    wiersze, sumy: [7, 9]
  };
}

/* tabela krzyżowa: produkty w wierszach, punkty w kolumnach */
function arkZuzycie() {
  const punkty = DB.lokalizacje()
    .filter(l => DB.dokumenty().some(d => d.typ === 'RW' && d.lokalizacjaId === l.id))
    .sort((a, b) => nazwaLok(a.id).localeCompare(nazwaLok(b.id), 'pl'));
  const idx = new Map(punkty.map((l, i) => [l.id, i]));

  const mapa = new Map();
  DB.dokumenty().filter(d => d.typ === 'RW').forEach(d => {
    const k = idx.get(d.lokalizacjaId);
    if (k == null) return;
    (d.pozycje || []).forEach(p => {
      if (!mapa.has(p.produktId)) mapa.set(p.produktId, new Array(punkty.length).fill(0));
      mapa.get(p.produktId)[k] += Number(p.ilosc) || 0;
    });
  });

  const wiersze = [...mapa.entries()]
    .map(([pid, ile]) => {
      const p = prod(pid);
      const suma = ile.reduce((a, b) => a + b, 0);
      return [p.nazwa || nazwaProd(pid), p.jm || 'szt', ...ile.map(x => x || null), suma];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pl'));

  const kolumny = [
    { n: 'Produkt', t: 'txt', w: 36 }, { n: 'Jm', t: 'txt', w: 7 },
    ...punkty.map(l => ({ n: nazwaLok(l.id), t: 'int', w: 13 })),
    { n: 'RAZEM', t: 'int', w: 10 }
  ];
  return { nazwa: 'Zużycie wg punktów', kolumny, wiersze,
           sumy: kolumny.map((_, i) => i).filter(i => i >= 2) };
}

function arkSprzet() {
  const wiersze = DB.sprzety()
    .sort((a, b) => (a.nrInw || '').localeCompare(b.nrInw || ''))
    .map(s => [
      s.nrInw || '', s.nazwa || '', s.typ || '', s.producent || '', s.model || '',
      s.nrSer || '', nazwaLok(s.lokalizacjaId), s.osoba || '',
      STATUSY[s.status] || s.status || '', dt(s.dataZakupu),
      s.wartosc != null && s.wartosc !== '' ? Number(s.wartosc) : null,
      dt(s.gwarancjaDo), s.uwagi || ''
    ]);
  const dzisD = new Date();
  return {
    nazwa: 'Sprzęt',
    kolumny: [
      { n: 'Nr inwentarzowy', t: 'txt', w: 18 }, { n: 'Nazwa', t: 'txt', w: 30 },
      { n: 'Typ', t: 'txt', w: 16 }, { n: 'Producent', t: 'txt', w: 16 },
      { n: 'Model', t: 'txt', w: 18 }, { n: 'Nr seryjny', t: 'txt', w: 20 },
      { n: 'Pomieszczenie', t: 'txt', w: 26 }, { n: 'Odpowiedzialny', t: 'txt', w: 20 },
      { n: 'Status', t: 'txt', w: 14 }, { n: 'Data zakupu', t: 'data', w: 13 },
      { n: 'Wartość', t: 'zl', w: 12 }, { n: 'Gwarancja do', t: 'data', w: 13 },
      { n: 'Uwagi', t: 'txt', w: 26 }
    ],
    wiersze,
    podswietl: w => w[11] instanceof Date && w[11] < dzisD,
    sumy: [10]
  };
}

function arkSprzetWgPomieszczen() {
  const wiersze = [];
  const lok = DB.lokalizacje().sort((a, b) => nazwaLok(a.id).localeCompare(nazwaLok(b.id), 'pl'));
  const wgLok = new Map();
  DB.sprzety().forEach(s => {
    const k = s.lokalizacjaId || '__brak__';
    if (!wgLok.has(k)) wgLok.set(k, []);
    wgLok.get(k).push(s);
  });
  const dodaj = (etykieta, osoba, lista) => {
    lista.sort((a, b) => (a.nazwa || '').localeCompare(b.nazwa || '', 'pl'))
      .forEach(s => wiersze.push([
        etykieta, osoba, s.nrInw || '', s.nazwa || '',
        [s.producent, s.model].filter(Boolean).join(' '),
        s.nrSer || '', STATUSY[s.status] || s.status || '',
        s.wartosc != null && s.wartosc !== '' ? Number(s.wartosc) : null
      ]));
  };
  lok.forEach(l => { if (wgLok.has(l.id)) dodaj(nazwaLok(l.id), l.osoba || '', wgLok.get(l.id)); });
  if (wgLok.has('__brak__')) dodaj('(bez przypisania)', '', wgLok.get('__brak__'));

  return {
    nazwa: 'Sprzęt wg pomieszczeń',
    kolumny: [
      { n: 'Pomieszczenie', t: 'txt', w: 26 }, { n: 'Odpowiedzialny', t: 'txt', w: 20 },
      { n: 'Nr inwentarzowy', t: 'txt', w: 18 }, { n: 'Nazwa', t: 'txt', w: 30 },
      { n: 'Producent / model', t: 'txt', w: 24 }, { n: 'Nr seryjny', t: 'txt', w: 20 },
      { n: 'Status', t: 'txt', w: 14 }, { n: 'Wartość', t: 'zl', w: 12 }
    ],
    wiersze,
    podswietl: w => w[0] === '(bez przypisania)',
    sumy: [7]
  };
}

function arkRuchy() {
  const spr = new Map(DB.D.sprzet.map(s => [s.id, s]));
  const wiersze = DB.D.ruchy
    .slice()
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    .map(r => {
      const s = spr.get(r.sprzetId) || {};
      return [dt(r.data), s.nrInw || '', s.nazwa || '(usunięty)',
              r.zId ? nazwaLok(r.zId) : '(nowy wpis)', nazwaLok(r.doId),
              r.kto || '', r.powod || ''];
    });
  return {
    nazwa: 'Historia przemieszczeń',
    kolumny: [
      { n: 'Data', t: 'czas', w: 17 }, { n: 'Nr inwentarzowy', t: 'txt', w: 18 },
      { n: 'Sprzęt', t: 'txt', w: 30 }, { n: 'Skąd', t: 'txt', w: 24 },
      { n: 'Dokąd', t: 'txt', w: 24 }, { n: 'Kto', t: 'txt', w: 18 },
      { n: 'Powód', t: 'txt', w: 26 }
    ],
    wiersze
  };
}

function arkPomieszczenia() {
  const sprzWLok = new Map();
  DB.sprzety().forEach(s => sprzWLok.set(s.lokalizacjaId,
    (sprzWLok.get(s.lokalizacjaId) || 0) + 1));
  const wiersze = DB.lokalizacje()
    .sort((a, b) => nazwaLok(a.id).localeCompare(nazwaLok(b.id), 'pl'))
    .map(l => [l.kod || '', l.budynek || '', l.pietro || '', l.nazwa || '',
               l.osoba || '', l.punkt ? 'tak' : '', l.kodKresk || '',
               sprzWLok.get(l.id) || 0]);
  return {
    nazwa: 'Pomieszczenia',
    kolumny: [
      { n: 'Kod', t: 'txt', w: 12 }, { n: 'Budynek', t: 'txt', w: 16 },
      { n: 'Piętro', t: 'txt', w: 10 }, { n: 'Nazwa', t: 'txt', w: 26 },
      { n: 'Odpowiedzialny', t: 'txt', w: 20 }, { n: 'Punkt wydań', t: 'txt', w: 12 },
      { n: 'Kod etykiety', t: 'txt', w: 18 }, { n: 'Sztuk sprzętu', t: 'int', w: 13 }
    ],
    wiersze, sumy: [7]
  };
}

function arkKatalog() {
  const wiersze = DB.produkty()
    .sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'))
    .map(p => [p.nazwa, p.ean || '', p.kategoria || '', p.jm || 'szt',
               p.wOpak ? Number(p.wOpak) : null,
               p.stanMin ? Number(p.stanMin) : null, p.dostawca || '', p.uwagi || '']);
  return {
    nazwa: 'Katalog produktów',
    kolumny: [
      { n: 'Nazwa', t: 'txt', w: 36 }, { n: 'EAN', t: 'txt', w: 15 },
      { n: 'Kategoria', t: 'txt', w: 18 }, { n: 'Jm', t: 'txt', w: 7 },
      { n: 'W opakowaniu', t: 'int', w: 13 }, { n: 'Stan min.', t: 'int', w: 11 },
      { n: 'Dostawca', t: 'txt', w: 22 }, { n: 'Uwagi', t: 'txt', w: 26 }
    ],
    wiersze
  };
}

function arkSpisy() {
  const spr = new Map(DB.D.sprzet.map(s => [s.id, s]));
  const wiersze = [];
  DB.D.spisy.slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    .forEach(sp => {
      const dodaj = (lista, wynik) => (lista || []).forEach(id => {
        const s = spr.get(id) || {};
        wiersze.push([dt(sp.data), nazwaLok(sp.lokalizacjaId), wynik,
                      s.nrInw || '(nieznany kod)', s.nazwa || '', sp.kto || '']);
      });
      dodaj(sp.znalezione, 'zgodne');
      dodaj(sp.brakujace, 'BRAK');
      dodaj(sp.nadmiarowe, 'NADMIAR');
    });
  return {
    nazwa: 'Inwentaryzacje',
    kolumny: [
      { n: 'Data spisu', t: 'czas', w: 17 }, { n: 'Pomieszczenie', t: 'txt', w: 26 },
      { n: 'Wynik', t: 'txt', w: 12 }, { n: 'Nr inwentarzowy', t: 'txt', w: 18 },
      { n: 'Sprzęt', t: 'txt', w: 30 }, { n: 'Kto spisywał', t: 'txt', w: 18 }
    ],
    wiersze,
    podswietl: w => w[2] !== 'zgodne'
  };
}

/* ---------- złożenie całego pliku ---------- */
function wszystkieArkusze() {
  const a = [arkStany()];
  if (DB.braki().length) a.push(arkDoZamowienia());
  a.push(arkDokumenty('PZ', 'Dostawy', 'Dostawca'));
  a.push(arkDokumenty('RW', 'Wydania', 'Punkt / pomieszczenie'));
  if (DB.dokumenty().some(d => d.typ === 'KOR')) a.push(arkDokumenty('KOR', 'Korekty', 'Powód'));
  if (DB.lokalizacje().length) a.push(arkZuzycie());
  if (DB.sprzety().length) { a.push(arkSprzet()); a.push(arkSprzetWgPomieszczen()); }
  if (DB.D.ruchy.length) a.push(arkRuchy());
  if (DB.lokalizacje().length) a.push(arkPomieszczenia());
  a.push(arkKatalog());
  if (DB.D.spisy.length) a.push(arkSpisy());
  return a;
}

function plik(arkusze) {
  return XLS.zbuduj(arkusze || wszystkieArkusze(), {
    tytul: 'Raport magazynowy' + (DB.D.ust.firma ? ' — ' + DB.D.ust.firma : ''),
    autor: DB.D.ust.firma || 'Magazyn'
  });
}

function nazwaPliku(prefiks) {
  const f = (DB.D.ust.firma || '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  return [prefiks || 'magazyn', f, dzis()].filter(Boolean).join('_') + '.xlsx';
}

/* ---------- oddanie pliku użytkownikowi ----------
   Edge na Androidzie odrzuca navigator.share z plikiem (NotAllowedError),
   więc próbujemy udostępnić, a przy odmowie po cichu zapisujemy plik.  */
async function oddaj(blob, nazwa) {
  const f = new File([blob], nazwa, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try {
      await navigator.share({ files: [f], title: nazwa });
      return { sposob: 'udostepnione' };
    } catch (e) {
      if (e && e.name === 'AbortError') return { sposob: 'anulowane' };
      /* NotAllowedError i inne — schodzimy do zapisu pliku */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nazwa;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return { sposob: 'zapisane' };
}

global.Eksport = {
  wszystkieArkusze, plik, nazwaPliku, oddaj, STATUSY, nazwaLok,
  arkusze: { arkStany, arkDoZamowienia, arkDokumenty, arkZuzycie, arkSprzet,
             arkSprzetWgPomieszczen, arkRuchy, arkPomieszczenia, arkKatalog, arkSpisy }
};

})(window);
