/* ------------------------------------------------------------------
   skaner.js — odczyt kodów kreskowych z aparatu.
   Silnik wbudowany w przeglądarkę (BarcodeDetector), a gdy go nie ma
   — zapasowy ZXing. Edge na Androidzie nie ma wbudowanego, więc
   zapasowy jest tam ścieżką podstawową.
   ------------------------------------------------------------------ */
(function (global) {
'use strict';

const FORMATY_WBUD = ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'data_matrix'];

let detektor = null, zxing = null, silnik = null, gotowy = null;
let strumien = null, dziala = false, cbKod = null, ostatniKod = '', ostatniCzas = 0;
let elOverlay = null, elVideo = null, elTytul = null, elInfo = null, elLatarka = null;
const bufor = document.createElement('canvas');

/* ---------- przygotowanie silnika ---------- */
function przygotuj() {
  if (gotowy) return gotowy;
  gotowy = (async () => {
    if ('BarcodeDetector' in global) {
      try {
        const dost = await BarcodeDetector.getSupportedFormats();
        const ma = FORMATY_WBUD.filter(f => dost.includes(f));
        if (ma.length >= 2) {
          detektor = new BarcodeDetector({ formats: ma });
          silnik = 'wbudowany';
          return silnik;
        }
      } catch (e) { /* przechodzimy na zapasowy */ }
    }
    if (global.ZXing) {
      const h = new Map();
      h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.QR_CODE,
        ZXing.BarcodeFormat.DATA_MATRIX]);
      h.set(ZXing.DecodeHintType.TRY_HARDER, true);
      zxing = new ZXing.MultiFormatReader();
      zxing.setHints(h);
      silnik = 'zapasowy';
      return silnik;
    }
    silnik = null;
    throw new Error('Brak silnika odczytu kodów');
  })();
  return gotowy;
}

/* ---------- warstwa graficzna ---------- */
function zbudujOverlay() {
  if (elOverlay) return;
  elOverlay = document.createElement('div');
  elOverlay.className = 'skaner';
  elOverlay.innerHTML =
    '<div class="skaner-pasek">' +
      '<button class="skaner-zamknij" type="button" aria-label="Zamknij">✕</button>' +
      '<span class="skaner-tytul"></span>' +
      '<button class="skaner-latarka" type="button" aria-label="Latarka">🔦</button>' +
    '</div>' +
    '<div class="skaner-scena"><video playsinline muted></video><div class="skaner-ramka"></div></div>' +
    '<div class="skaner-info"></div>';
  document.body.appendChild(elOverlay);
  elVideo   = elOverlay.querySelector('video');
  elTytul   = elOverlay.querySelector('.skaner-tytul');
  elInfo    = elOverlay.querySelector('.skaner-info');
  elLatarka = elOverlay.querySelector('.skaner-latarka');
  elOverlay.querySelector('.skaner-zamknij').onclick = () => zamknij();
  elLatarka.onclick = przelaczLatarke;
}

async function przelaczLatarke() {
  if (!strumien) return;
  const t = strumien.getVideoTracks()[0];
  const mozliwosci = t.getCapabilities ? t.getCapabilities() : {};
  if (!mozliwosci.torch) { info('To urządzenie nie pozwala włączyć latarki.'); return; }
  const wl = !(t.getSettings().torch);
  try { await t.applyConstraints({ advanced: [{ torch: wl }] }); elLatarka.classList.toggle('wl', wl); }
  catch (e) { info('Nie udało się przełączyć latarki.'); }
}

function info(t) { if (elInfo) elInfo.textContent = t; }

/* ---------- odczyt ---------- */
function czytajZapasowym(v) {
  const MAX = 800;
  const skala = Math.min(1, MAX / Math.max(v.videoWidth || 1, 1));
  bufor.width  = Math.max(2, Math.round((v.videoWidth  || MAX) * skala));
  bufor.height = Math.max(2, Math.round((v.videoHeight || MAX) * skala));
  bufor.getContext('2d', { willReadFrequently: true })
       .drawImage(v, 0, 0, bufor.width, bufor.height);
  const zrodlo = new ZXing.HTMLCanvasElementLuminanceSource(bufor);
  const mapa = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(zrodlo));
  const w = zxing.decode(mapa);
  zxing.reset();
  return { kod: w.getText(), format: ZXing.BarcodeFormat[w.getBarcodeFormat()] };
}

function petla() {
  if (!dziala) return;
  /* Gdy nad skanerem jest otwarte okno dialogowe, wstrzymujemy odczyt.
     Przesuwamy przy tym znacznik ostatniego trafienia, żeby po zamknięciu okna
     ten sam kod nie wskoczył od razu drugi raz. */
  const m = document.getElementById('modal');
  if (m && !m.hidden) { petla._ost = performance.now(); requestAnimationFrame(petla); return; }
  const v = elVideo;
  const krok = detektor ? 100 : 220;
  const t = performance.now();
  if (t - ostatniCzas >= krok && v.videoWidth) {
    ostatniCzas = t;
    const obsluz = tr => {
      if (!tr) return;
      if (tr.kod === ostatniKod && t - (petla._ost || 0) < 2500) return;
      ostatniKod = tr.kod; petla._ost = t;
      if (navigator.vibrate) navigator.vibrate(50);
      info('Odczytano: ' + tr.kod);
      if (cbKod) cbKod(tr.kod, tr.format);
    };
    if (detektor) {
      detektor.detect(v)
        .then(k => { if (k && k.length) obsluz({ kod: k[0].rawValue, format: k[0].format }); })
        .catch(() => {});
    } else if (zxing) {
      try { obsluz(czytajZapasowym(v)); } catch (e) { /* brak kodu w kadrze */ }
    }
  }
  requestAnimationFrame(petla);
}

/* ---------- otwarcie / zamknięcie ---------- */
async function otworz(opcje) {
  opcje = opcje || {};
  zbudujOverlay();
  elTytul.textContent = opcje.tytul || 'Skanuj kod';
  info('Przygotowuję aparat…');
  elOverlay.classList.add('on');
  document.body.classList.add('bez-scrolla');
  cbKod = opcje.onKod || null;

  try { await przygotuj(); }
  catch (e) { info('Brak silnika odczytu kodów. Wpisz kod ręcznie.'); return; }

  try {
    strumien = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' },
               width: { ideal: 1280 }, height: { ideal: 720 } }
    });
  } catch (e) {
    const powod = {
      NotAllowedError: 'Brak zgody na aparat. Kliknij kłódkę przy adresie strony i zezwól na aparat.',
      NotFoundError: 'Nie znaleziono aparatu w tym urządzeniu.',
      NotReadableError: 'Aparat jest zajęty przez inną aplikację.'
    }[e.name] || ('Błąd aparatu: ' + e.message);
    info(powod);
    return;
  }

  elVideo.srcObject = strumien;
  await elVideo.play().catch(() => {});
  const mozliwosci = strumien.getVideoTracks()[0].getCapabilities
    ? strumien.getVideoTracks()[0].getCapabilities() : {};
  elLatarka.style.display = mozliwosci.torch ? '' : 'none';
  info(opcje.podpowiedz || 'Przyłóż kod do ramki.');
  ostatniKod = ''; petla._ost = 0;
  dziala = true;
  requestAnimationFrame(petla);
}

function zamknij() {
  dziala = false;
  cbKod = null;
  if (strumien) { strumien.getTracks().forEach(t => t.stop()); strumien = null; }
  if (elVideo) elVideo.srcObject = null;
  if (elOverlay) elOverlay.classList.remove('on');
  document.body.classList.remove('bez-scrolla');
}

/* jednorazowy odczyt — zwraca kod albo null przy zamknięciu */
function jedenKod(opcje) {
  return new Promise(res => {
    let zwrocone = false;
    const o = Object.assign({}, opcje, {
      onKod: kod => { if (zwrocone) return; zwrocone = true; zamknij(); res(kod); }
    });
    otworz(o);
    const obs = new MutationObserver(() => {
      if (elOverlay && !elOverlay.classList.contains('on') && !zwrocone) {
        zwrocone = true; obs.disconnect(); res(null);
      }
    });
    obs.observe(elOverlay, { attributes: true, attributeFilter: ['class'] });
  });
}

function nazwaSilnika() { return silnik; }

global.Skaner = { otworz, zamknij, jedenKod, przygotuj, nazwaSilnika, info };
addEventListener('pagehide', zamknij);

})(window);
