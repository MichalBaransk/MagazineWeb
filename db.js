/* ------------------------------------------------------------------
   db.js — baza danych w telefonie (IndexedDB) + model danych.
   Całość mieści się w pamięci (do kilku tysięcy rekordów), IndexedDB
   służy jako trwały zapis. Każdy rekord ma UUID i znaczniki czasu,
   żeby dało się w przyszłości dołożyć synchronizację między urządzeniami.
   ------------------------------------------------------------------ */
(function (global) {
'use strict';

const NAZWA_BAZY = 'magazyn';
const WERSJA = 1;

const STORY = {
  produkty:    { idx: ['ean'] },
  lokalizacje: { idx: ['kodKresk'] },
  dokumenty:   { idx: ['typ', 'data'] },
  sprzet:      { idx: ['kodKresk', 'nrInw', 'lokalizacjaId'] },
  ruchy:       { idx: ['sprzetId'] },
  spisy:       { idx: [] },
  ustawienia:  { idx: [], klucz: 'k' }
};

let baza = null;

/* dane w pamięci */
const D = {
  produkty: [], lokalizacje: [], dokumenty: [], sprzet: [], ruchy: [], spisy: [],
  ust: {}
};

const USTAWIENIA_DOMYSLNE = {
  firma: '',
  prefiksInw: 'INW',
  przypomnijPoDniach: 7,
  przypomnijPoOperacjach: 50,
  ostatniaKopia: null,
  operacjiOdKopii: 0
};

/* ---------- narzędzia ---------- */
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
const teraz = () => new Date().toISOString();

/* ---------- otwarcie ---------- */
function otworz() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(NAZWA_BAZY, WERSJA);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      for (const [n, cfg] of Object.entries(STORY)) {
        if (db.objectStoreNames.contains(n)) continue;
        const s = db.createObjectStore(n, { keyPath: cfg.klucz || 'id' });
        (cfg.idx || []).forEach(i => s.createIndex(i, i, { unique: false }));
      }
    };
    r.onsuccess = e => { baza = e.target.result; res(baza); };
    r.onerror = () => rej(r.error || new Error('Nie udało się otworzyć bazy danych'));
  });
}

function wszystko(store) {
  return new Promise((res, rej) => {
    const t = baza.transaction(store, 'readonly');
    const q = t.objectStore(store).getAll();
    q.onsuccess = () => res(q.result || []);
    q.onerror = () => rej(q.error);
  });
}

function zapiszSurowo(store, obiekty) {
  return new Promise((res, rej) => {
    const t = baza.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    (Array.isArray(obiekty) ? obiekty : [obiekty]).forEach(o => s.put(o));
    t.oncomplete = res;
    t.onerror = () => rej(t.error);
  });
}

function wyczyscStore(store) {
  return new Promise((res, rej) => {
    const t = baza.transaction(store, 'readwrite');
    t.objectStore(store).clear();
    t.oncomplete = res;
    t.onerror = () => rej(t.error);
  });
}

/* ---------- wczytanie do pamięci ---------- */
async function wczytaj() {
  const nazwy = ['produkty', 'lokalizacje', 'dokumenty', 'sprzet', 'ruchy', 'spisy'];
  const dane = await Promise.all(nazwy.map(wszystko));
  nazwy.forEach((n, i) => { D[n] = dane[i]; });
  const u = await wszystko('ustawienia');
  D.ust = Object.assign({}, USTAWIENIA_DOMYSLNE);
  u.forEach(x => { D.ust[x.k] = x.v; });
  return D;
}

/* ---------- zapis rekordu ---------- */
async function zapisz(store, rek, liczOperacje) {
  if (!rek.id) { rek.id = uuid(); rek.utw = teraz(); }
  rek.zm = teraz();
  const lista = D[store];
  const i = lista.findIndex(x => x.id === rek.id);
  if (i >= 0) lista[i] = rek; else lista.push(rek);
  await zapiszSurowo(store, rek);
  if (liczOperacje !== false) await licznikOperacji();
  return rek;
}

/* kasowanie miękkie — rekord zostaje, żeby dało się to zsynchronizować */
async function usun(store, id) {
  const rek = D[store].find(x => x.id === id);
  if (!rek) return;
  rek.usuniety = true;
  rek.zm = teraz();
  await zapiszSurowo(store, rek);
  await licznikOperacji();
}

async function ustaw(k, v) {
  D.ust[k] = v;
  await zapiszSurowo('ustawienia', { k, v });
}

async function licznikOperacji() {
  await ustaw('operacjiOdKopii', (D.ust.operacjiOdKopii || 0) + 1);
}

/* ---------- widoki na dane ---------- */
const zywe = lista => lista.filter(x => !x.usuniety);

const produkty    = () => zywe(D.produkty);
const lokalizacje = () => zywe(D.lokalizacje);
const sprzety     = () => zywe(D.sprzet);
const dokumenty   = () => zywe(D.dokumenty);

/* stan magazynowy liczony z dokumentów — nigdy nie trzymany jako pole */
function stany() {
  const m = new Map();
  for (const dok of D.dokumenty) {
    if (dok.usuniety) continue;
    const znak = dok.typ === 'PZ' ? 1 : dok.typ === 'RW' ? -1 : 1;  // KOR ma ilości ze znakiem
    for (const p of (dok.pozycje || [])) {
      const il = Number(p.ilosc) || 0;
      m.set(p.produktId, (m.get(p.produktId) || 0) + il * znak);
    }
  }
  return m;
}

/* wartość stanu wg ostatniej ceny zakupu */
function ostatnieCeny() {
  const m = new Map();
  const pz = D.dokumenty.filter(d => !d.usuniety && d.typ === 'PZ')
                        .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  for (const dok of pz)
    for (const p of (dok.pozycje || []))
      if (p.cena != null && p.cena !== '') m.set(p.produktId, Number(p.cena));
  return m;
}

function ostatnieDostawy() {
  const m = new Map();
  for (const dok of D.dokumenty) {
    if (dok.usuniety || dok.typ !== 'PZ') continue;
    for (const p of (dok.pozycje || [])) {
      const b = m.get(p.produktId);
      if (!b || (dok.data || '') > b) m.set(p.produktId, dok.data);
    }
  }
  return m;
}

/* pozycje poniżej stanu minimalnego */
function braki() {
  const s = stany();
  return produkty()
    .map(p => ({ produkt: p, stan: s.get(p.id) || 0, min: Number(p.stanMin) || 0 }))
    .filter(x => x.min > 0 && x.stan < x.min)
    .map(x => Object.assign(x, { brakuje: x.min - x.stan }))
    .sort((a, b) => b.brakuje - a.brakuje);
}

/* ---------- numeracja ---------- */
function nastepnyNumer(typ) {
  const rok = new Date().getFullYear();
  const pas = typ + '/' + rok + '/';
  let max = 0;
  for (const d of D.dokumenty) {
    if (d.typ !== typ || !d.numer || !d.numer.startsWith(pas)) continue;
    const n = parseInt(d.numer.slice(pas.length), 10);
    if (n > max) max = n;
  }
  return pas + String(max + 1).padStart(4, '0');
}

function nastepnyNrInw() {
  const pref = (D.ust.prefiksInw || 'INW').toUpperCase();
  const rok = new Date().getFullYear();
  const pas = pref + '-' + rok + '-';
  let max = 0;
  for (const s of D.sprzet) {
    if (!s.nrInw || !s.nrInw.startsWith(pas)) continue;
    const n = parseInt(s.nrInw.slice(pas.length), 10);
    if (n > max) max = n;
  }
  return pas + String(max + 1).padStart(5, '0');
}

/* ---------- wyszukiwanie po kodzie kreskowym ---------- */
function poKodzie(kod) {
  const k = String(kod).trim();
  const lok = lokalizacje().find(l => l.kodKresk === k);
  if (lok) return { rodzaj: 'lokalizacja', obiekt: lok };
  const spr = sprzety().find(s => s.kodKresk === k || s.nrInw === k);
  if (spr) return { rodzaj: 'sprzet', obiekt: spr };
  const pro = produkty().find(p => p.ean === k);
  if (pro) return { rodzaj: 'produkt', obiekt: pro };
  return { rodzaj: 'nieznany', kod: k };
}

/* ---------- przeniesienie sprzętu ---------- */
async function przenies(sprzetId, doLokId, kto, powod) {
  const s = D.sprzet.find(x => x.id === sprzetId);
  if (!s) return null;
  const zId = s.lokalizacjaId || null;
  if (zId === doLokId) return null;
  s.lokalizacjaId = doLokId;
  await zapisz('sprzet', s, false);
  const ruch = { id: uuid(), utw: teraz(), zm: teraz(), sprzetId, zId,
                 doId: doLokId, data: teraz(), kto: kto || '', powod: powod || '' };
  D.ruchy.push(ruch);
  await zapiszSurowo('ruchy', ruch);
  await licznikOperacji();
  return ruch;
}

/* ---------- kopia zapasowa ---------- */
function kopia() {
  return {
    format: 'magazyn-kopia',
    wersja: 1,
    data: teraz(),
    dane: {
      produkty: D.produkty, lokalizacje: D.lokalizacje, dokumenty: D.dokumenty,
      sprzet: D.sprzet, ruchy: D.ruchy, spisy: D.spisy,
      ustawienia: Object.entries(D.ust).map(([k, v]) => ({ k, v }))
    }
  };
}

async function przywroc(obj, scalaj) {
  if (!obj || obj.format !== 'magazyn-kopia') throw new Error('To nie jest plik kopii zapasowej.');
  const d = obj.dane || {};
  const nazwy = ['produkty', 'lokalizacje', 'dokumenty', 'sprzet', 'ruchy', 'spisy'];
  for (const n of nazwy) {
    const przych = d[n] || [];
    if (!scalaj) {
      await wyczyscStore(n);
      D[n] = przych.slice();
      if (D[n].length) await zapiszSurowo(n, D[n]);
    } else {
      const mapa = new Map(D[n].map(x => [x.id, x]));
      for (const rek of przych) {
        const stary = mapa.get(rek.id);
        if (!stary || (rek.zm || '') > (stary.zm || '')) mapa.set(rek.id, rek);
      }
      D[n] = [...mapa.values()];
      await wyczyscStore(n);
      if (D[n].length) await zapiszSurowo(n, D[n]);
    }
  }
  if (d.ustawienia && !scalaj) {
    await wyczyscStore('ustawienia');
    D.ust = Object.assign({}, USTAWIENIA_DOMYSLNE);
    for (const { k, v } of d.ustawienia) { D.ust[k] = v; }
    await zapiszSurowo('ustawienia', d.ustawienia);
  }
  await ustaw('operacjiOdKopii', 0);
}

function kopiaPotrzebna() {
  const ops = D.ust.operacjiOdKopii || 0;
  if (ops >= (D.ust.przypomnijPoOperacjach || 50)) return 'operacje';
  const ost = D.ust.ostatniaKopia;
  if (!ost) return ops > 0 ? 'nigdy' : null;
  const dni = (Date.now() - new Date(ost).getTime()) / 86400000;
  if (dni >= (D.ust.przypomnijPoDniach || 7) && ops > 0) return 'dni';
  return null;
}

/* ---------- start ---------- */
async function start() {
  await otworz();
  await wczytaj();
  if (navigator.storage && navigator.storage.persist) {
    try { if (!(await navigator.storage.persisted())) await navigator.storage.persist(); }
    catch (e) { /* nieistotne */ }
  }
  return D;
}

global.DB = {
  D, start, wczytaj, zapisz, usun, ustaw, uuid, teraz,
  produkty, lokalizacje, sprzety, dokumenty,
  stany, ostatnieCeny, ostatnieDostawy, braki,
  nastepnyNumer, nastepnyNrInw, poKodzie, przenies,
  kopia, przywroc, kopiaPotrzebna
};

})(window);
