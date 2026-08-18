/* ------------------------------------------------------------------
   etykiety.js — kody QR, arkusze etykiet na A4 i wydruki protokołów.
   Drukujemy przez systemowe okno druku (Android → „Zapisz jako PDF”),
   bez żadnej biblioteki PDF.
   ------------------------------------------------------------------ */
(function (global) {
'use strict';

/* ---------- kod QR jako SVG ---------- */
function qrSvg(tekst, opcje) {
  opcje = opcje || {};
  const korekta = opcje.korekta || 'M';
  let qr = null;
  for (let typ = 2; typ <= 20; typ++) {          // dobór najmniejszego pasującego rozmiaru
    try {
      const q = qrcode(typ, korekta);
      q.addData(String(tekst));
      q.make();
      qr = q;
      break;
    } catch (e) { /* za mało miejsca — próbujemy większy */ }
  }
  if (!qr) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  const n = qr.getModuleCount();
  const p = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) p.push('M' + c + ' ' + r + 'h1v1h-1z');

  const m = opcje.margines == null ? 2 : opcje.margines;
  const bok = n + m * 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + bok + ' ' + bok + '" ' +
         'shape-rendering="crispEdges" width="100%" height="100%">' +
         '<rect width="' + bok + '" height="' + bok + '" fill="#fff"/>' +
         '<g transform="translate(' + m + ',' + m + ')" fill="#000"><path d="' +
         p.join('') + '"/></g></svg>';
}

/* ---------- ogólny wydruk ---------- */
function drukuj(tytul, styl, tresc, wskazowka) {
  const stary = document.getElementById('wydruk');
  if (stary) stary.remove();

  const d = document.createElement('div');
  d.id = 'wydruk';
  d.innerHTML =
    '<div class="wydruk-pasek no-print">' +
      '<button type="button" id="wydruk-zamknij">← Wróć</button>' +
      '<span>' + tytul + '</span>' +
      '<button type="button" id="wydruk-drukuj" class="glowny">Drukuj / PDF</button>' +
    '</div>' +
    '<div class="wydruk-uwaga no-print" hidden><span class="uw-skala">Podgląd pomniejszony ' +
      'do szerokości ekranu — wydruk wyjdzie w pełnym rozmiarze.</span>' +
      (wskazowka ? '<br>' + wskazowka : '') + '</div>' +
    '<style>' + styl + '</style>' +
    '<div class="wydruk-tresc"><div class="wydruk-skala">' + tresc + '</div></div>';
  document.body.appendChild(d);
  document.body.classList.add('tryb-wydruku');
  document.getElementById('wydruk-zamknij').onclick = () => {
    d.remove(); document.body.classList.remove('tryb-wydruku');
    removeEventListener('resize', dopasuj);
  };
  document.getElementById('wydruk-drukuj').onclick = () => global.print();

  /* Arkusz A4 jest szerszy niż telefon — na ekranie skalujemy go do szerokości,
     a przy druku skalowanie znika (reguła @media print). */
  function dopasuj() {
    const poj = d.querySelector('.wydruk-tresc');
    const sk = d.querySelector('.wydruk-skala');
    if (!poj || !sk) return;
    sk.style.transform = 'none';
    poj.style.height = 'auto';
    const dostepne = poj.clientWidth;
    /* scrollWidth bywa mniejszy niż rzeczywista szerokość arkusza (elementy
       wyśrodkowane wystają w lewo), więc bierzemy większą z dwóch miar. */
    const potrzebne = Math.max(sk.scrollWidth, sk.offsetWidth) * 1.01;
    const pomniejszone = potrzebne > dostepne + 2;
    if (pomniejszone) {
      const s = dostepne / potrzebne;
      sk.style.transform = 'scale(' + s + ')';
      poj.style.height = Math.ceil(sk.scrollHeight * s) + 'px';
    }
    d.querySelector('.uw-skala').style.display = pomniejszone ? '' : 'none';
    d.querySelector('.wydruk-uwaga').hidden = !(pomniejszone || wskazowka);
  }
  requestAnimationFrame(dopasuj);
  addEventListener('resize', dopasuj);
  d.scrollIntoView();
}

/* ---------- arkusz etykiet ---------- */
/* Domyślnie Avery 70×37 mm — 3 kolumny × 8 rzędów = 24 etykiety na A4. */
const UKLADY = {
  '70x37': { kol: 3, rzad: 8, szer: 70, wys: 37, opis: '70×37 mm (24 na arkuszu)' },
  '105x37': { kol: 2, rzad: 8, szer: 105, wys: 37, opis: '105×37 mm (16 na arkuszu)' },
  '48x25': { kol: 4, rzad: 11, szer: 48, wys: 25.4, opis: '48×25 mm (44 na arkuszu)' }
};

function arkusz(pozycje, opcje) {
  opcje = opcje || {};
  const u = UKLADY[opcje.uklad] || UKLADY['70x37'];
  const naStrone = u.kol * u.rzad;
  const stopka = opcje.firma || '';

  let html = '';
  for (let i = 0; i < pozycje.length; i += naStrone) {
    const grupa = pozycje.slice(i, i + naStrone);
    html += '<div class="ark">';
    for (const p of grupa) {
      html += '<div class="etyk">' +
        '<div class="etyk-qr">' + qrSvg(p.kod, { margines: 1 }) + '</div>' +
        '<div class="etyk-txt">' +
          '<div class="etyk-nr">' + escHtml(p.tytul || p.kod) + '</div>' +
          (p.podtytul ? '<div class="etyk-op">' + escHtml(p.podtytul) + '</div>' : '') +
          (stopka ? '<div class="etyk-fir">' + escHtml(stopka) + '</div>' : '') +
        '</div></div>';
    }
    for (let k = grupa.length; k < naStrone; k++) html += '<div class="etyk pusta"></div>';
    html += '</div>';
  }

  const styl =
    '@page{size:A4;margin:0}' +
    '#wydruk .wydruk-skala{width:210mm;margin:0 auto}' +
    '#wydruk .ark{display:grid;grid-template-columns:repeat(' + u.kol + ',' + u.szer + 'mm);' +
      'grid-auto-rows:' + u.wys + 'mm;justify-content:center;align-content:start;' +
      'height:297mm;page-break-after:always}' +
    '#wydruk .ark:last-child{page-break-after:auto}' +
    '#wydruk .etyk{display:flex;align-items:center;gap:2mm;padding:2mm;overflow:hidden;' +
      'border:0.2mm dashed #ccc;box-sizing:border-box}' +
    '#wydruk .etyk.pusta{border-color:#eee}' +
    '#wydruk .etyk-qr{width:' + (u.wys - 6) + 'mm;height:' + (u.wys - 6) + 'mm;flex:none}' +
    '#wydruk .etyk-txt{min-width:0;font-family:Arial,sans-serif;line-height:1.15}' +
    '#wydruk .etyk-nr{font-size:9pt;font-weight:bold;letter-spacing:.2px;' +
      'overflow-wrap:anywhere}' +
    '#wydruk .etyk-op{font-size:7pt;margin-top:.6mm;display:-webkit-box;-webkit-line-clamp:2;' +
      '-webkit-box-orient:vertical;overflow:hidden}' +
    '#wydruk .etyk-fir{font-size:6pt;color:#666;margin-top:.8mm}' +
    '@media print{#wydruk .etyk{border-color:transparent}}';

  drukuj('Etykiety — ' + u.opis, styl, html,
    'W oknie drukowania ustaw rozmiar A4, skalowanie <b>100% / rzeczywisty rozmiar</b> ' +
    'i marginesy <b>brak</b> — inaczej etykiety nie trafią w naklejki.');
}

/* ---------- protokół (przekazanie, inwentaryzacja) ---------- */
function protokol(tytul, naglowek, sekcje, podpisy) {
  let html = '<h1>' + escHtml(tytul) + '</h1><table class="meta">';
  for (const [k, v] of naglowek) html += '<tr><th>' + escHtml(k) + '</th><td>' + escHtml(v) + '</td></tr>';
  html += '</table>';

  for (const s of sekcje) {
    html += '<h2>' + escHtml(s.tytul) + '</h2>';
    if (!s.wiersze.length) { html += '<p class="brak">— brak pozycji —</p>'; continue; }
    html += '<table class="dane"><thead><tr>';
    s.kolumny.forEach(k => html += '<th>' + escHtml(k) + '</th>');
    html += '</tr></thead><tbody>';
    s.wiersze.forEach((w, i) => {
      html += '<tr><td class="lp">' + (i + 1) + '</td>';
      w.forEach(c => html += '<td>' + escHtml(c == null ? '' : c) + '</td>');
      html += '</tr>';
    });
    html += '</tbody></table>';
  }

  if (podpisy && podpisy.length) {
    html += '<div class="podpisy">';
    podpisy.forEach(p => html += '<div class="podpis"><div class="linia"></div>' +
      '<div class="opis">' + escHtml(p) + '</div></div>');
    html += '</div>';
  }

  const styl =
    '@page{size:A4;margin:15mm}' +
    '#wydruk .wydruk-skala{font-family:Arial,sans-serif;font-size:10pt;color:#000;width:180mm;margin:0 auto}' +
    '#wydruk h1{font-size:15pt;margin:0 0 5mm;text-align:center;text-transform:uppercase;letter-spacing:.5px}' +
    '#wydruk h2{font-size:11pt;margin:6mm 0 2mm;padding-bottom:1mm;border-bottom:1px solid #000}' +
    '#wydruk table.meta{border-collapse:collapse;margin-bottom:4mm;font-size:9.5pt}' +
    '#wydruk table.meta th{text-align:left;padding:1mm 6mm 1mm 0;font-weight:normal;color:#444;vertical-align:top}' +
    '#wydruk table.meta td{padding:1mm 0;font-weight:bold}' +
    '#wydruk table.dane{border-collapse:collapse;width:100%;font-size:9pt}' +
    '#wydruk table.dane th,#wydruk table.dane td{border:0.4pt solid #666;padding:1.5mm 2mm;text-align:left}' +
    '#wydruk table.dane th{background:#eee;font-size:8.5pt}' +
    '#wydruk table.dane td.lp{width:8mm;text-align:right;color:#666}' +
    '#wydruk .brak{color:#666;font-style:italic;font-size:9pt}' +
    '#wydruk .podpisy{display:flex;gap:20mm;margin-top:20mm;page-break-inside:avoid}' +
    '#wydruk .podpis{flex:1;text-align:center}' +
    '#wydruk .podpis .linia{border-top:0.4pt solid #000;margin-bottom:1.5mm}' +
    '#wydruk .podpis .opis{font-size:8pt;color:#444}';

  drukuj(tytul, styl, html);
}

function escHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

global.Etykiety = { qrSvg, arkusz, protokol, drukuj, UKLADY };

})(window);
