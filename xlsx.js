/* ------------------------------------------------------------------
   xlsx.js — zapis plików Excel bez zewnętrznych bibliotek.
   Buduje archiwum ZIP (bez kompresji) z plikami XML formatu XLSX.
   ------------------------------------------------------------------ */
(function (global) {
'use strict';

/* ---------- CRC32 ---------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- ZIP (metoda „store”, bez kompresji) ---------- */
function zip(pliki) {                       // pliki: [{nazwa, dane:Uint8Array}]
  const enc = new TextEncoder();
  const lokalne = [], centralne = [];
  let offset = 0;

  for (const p of pliki) {
    const nazwa = enc.encode(p.nazwa);
    const crc = crc32(p.dane);
    const rozmiar = p.dane.length;

    const lh = new Uint8Array(30 + nazwa.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);              // wersja
    lv.setUint16(6, 0x0800, true);          // flaga UTF-8
    lv.setUint16(8, 0, true);               // brak kompresji
    lv.setUint16(10, 0, true);              // czas
    lv.setUint16(12, 0x21, true);           // data (1.1.1996)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, rozmiar, true);
    lv.setUint32(22, rozmiar, true);
    lv.setUint16(26, nazwa.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nazwa, 30);
    lokalne.push(lh, p.dane);

    const ch = new Uint8Array(46 + nazwa.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, rozmiar, true);
    cv.setUint32(24, rozmiar, true);
    cv.setUint16(28, nazwa.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nazwa, 46);
    centralne.push(ch);

    offset += lh.length + rozmiar;
  }

  const dlCentral = centralne.reduce((s, c) => s + c.length, 0);
  const koniec = new Uint8Array(22);
  const kv = new DataView(koniec.buffer);
  kv.setUint32(0, 0x06054b50, true);
  kv.setUint16(8, pliki.length, true);
  kv.setUint16(10, pliki.length, true);
  kv.setUint32(12, dlCentral, true);
  kv.setUint32(16, offset, true);

  return new Blob([...lokalne, ...centralne, koniec],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ---------- pomocnicze ---------- */
const enc = new TextEncoder();
const bin = s => enc.encode(s);
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
function kolLitera(n) {                     // 0 -> A, 26 -> AA
  let s = '';
  n++;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; }
  return s;
}
function serialData(d) {                    // Date -> numer seryjny Excela
  if (!(d instanceof Date) || isNaN(d)) return null;
  const dni = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30);
  const ulamek = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
  return dni / 86400000 + ulamek;
}

/* ---------- style ---------- */
/* indeksy cellXfs:
   0 zwykły · 1 nagłówek · 2 data · 3 kwota · 4 liczba całkowita
   5 ostrzeżenie(tekst) · 6 ostrzeżenie(liczba) · 7 ostrzeżenie(kwota)
   8 pogrubiony · 9 pogrubiona liczba · 10 pogrubiona kwota · 11 data+godzina */
const STYLE_XML =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
<numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/>
<numFmt numFmtId="165" formatCode="#,##0.00"/>
<numFmt numFmtId="166" formatCode="dd\\.mm\\.yyyy\\ hh:mm"/>
</numFmts>
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFD5D5"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FF9BB5DE"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0"   fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0"   fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1"   fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0"   fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="1"   fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="165" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="0"   fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="1"   fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const ST = { ZWYKLY: 0, NAGL: 1, DATA: 2, KWOTA: 3, LICZBA: 4,
             OSTRZ: 5, OSTRZ_L: 6, OSTRZ_K: 7,
             POGR: 8, POGR_L: 9, POGR_K: 10, DATAGODZ: 11 };

/* typ kolumny -> styl zwykły / styl ostrzeżenia / styl podsumowania */
const TYPY = {
  txt:  [ST.ZWYKLY, ST.OSTRZ,   ST.POGR],
  int:  [ST.LICZBA, ST.OSTRZ_L, ST.POGR_L],
  zl:   [ST.KWOTA,  ST.OSTRZ_K, ST.POGR_K],
  data: [ST.DATA,   ST.DATA,    ST.DATA],
  czas: [ST.DATAGODZ, ST.DATAGODZ, ST.DATAGODZ]
};

/* ---------- budowa arkusza ---------- */
function arkuszXml(a) {
  const kol = a.kolumny;
  const W = [];

  W.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  W.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
  W.push('<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    '</sheetView></sheetViews>');
  W.push('<sheetFormatPr defaultRowHeight="15"/>');

  W.push('<cols>');
  kol.forEach((c, i) => W.push('<col min="' + (i + 1) + '" max="' + (i + 1) +
    '" width="' + (c.w || 14) + '" customWidth="1"/>'));
  W.push('</cols>');

  W.push('<sheetData>');

  // nagłówek
  W.push('<row r="1" ht="28" customHeight="1">');
  kol.forEach((c, i) => W.push('<c r="' + kolLitera(i) + '1" s="' + ST.NAGL +
    '" t="inlineStr"><is><t xml:space="preserve">' + esc(c.n) + '</t></is></c>'));
  W.push('</row>');

  // dane
  const wiersze = a.wiersze || [];
  wiersze.forEach((w, ri) => {
    const nr = ri + 2;
    const alarm = a.podswietl ? !!a.podswietl(w, ri) : false;
    W.push('<row r="' + nr + '">');
    kol.forEach((c, ci) => {
      const v = w[ci];
      if (v === null || v === undefined || v === '') return;
      const typ = TYPY[c.t || 'txt'] || TYPY.txt;
      const s = alarm ? typ[1] : typ[0];
      const ref = kolLitera(ci) + nr;
      if (c.t === 'data' || c.t === 'czas') {
        const d = (v instanceof Date) ? v : new Date(v);
        const n = serialData(d);
        if (n === null) return;
        W.push('<c r="' + ref + '" s="' + s + '"><v>' + n + '</v></c>');
      } else if (c.t === 'int' || c.t === 'zl') {
        const n = Number(v);
        if (!isFinite(n)) return;
        W.push('<c r="' + ref + '" s="' + s + '"><v>' + n + '</v></c>');
      } else {
        W.push('<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' +
          esc(v) + '</t></is></c>');
      }
    });
    W.push('</row>');
  });

  // wiersz sum
  if (a.sumy && a.sumy.length && wiersze.length) {
    const nr = wiersze.length + 2;
    W.push('<row r="' + nr + '">');
    kol.forEach((c, ci) => {
      const ref = kolLitera(ci) + nr;
      if (ci === 0) {
        W.push('<c r="' + ref + '" s="' + ST.POGR + '" t="inlineStr">' +
          '<is><t>RAZEM</t></is></c>');
      } else if (a.sumy.includes(ci)) {
        const typ = TYPY[c.t || 'txt'] || TYPY.txt;
        const zakres = kolLitera(ci) + '2:' + kolLitera(ci) + (nr - 1);
        W.push('<c r="' + ref + '" s="' + typ[2] + '"><f>SUM(' + zakres + ')</f></c>');
      }
    });
    W.push('</row>');
  }

  W.push('</sheetData>');
  if (wiersze.length)
    W.push('<autoFilter ref="A1:' + kolLitera(kol.length - 1) + (wiersze.length + 1) + '"/>');
  W.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>');
  W.push('</worksheet>');
  return W.join('');
}

/* ---------- złożenie skoroszytu ---------- */
function zbuduj(arkusze, meta) {
  meta = meta || {};
  const n = arkusze.length;
  const pliki = [];

  let ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>';
  for (let i = 1; i <= n; i++)
    ct += '<Override PartName="/xl/worksheets/sheet' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  ct += '</Types>';
  pliki.push({ nazwa: '[Content_Types].xml', dane: bin(ct) });

  pliki.push({ nazwa: '_rels/.rels', dane: bin(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '</Relationships>') });

  const teraz = (meta.data || new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
  pliki.push({ nazwa: 'docProps/core.xml', dane: bin(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:title>' + esc(meta.tytul || 'Raport magazynowy') + '</dc:title>' +
    '<dc:creator>' + esc(meta.autor || 'Magazyn') + '</dc:creator>' +
    '<cp:lastModifiedBy>' + esc(meta.autor || 'Magazyn') + '</cp:lastModifiedBy>' +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' + teraz + '</dcterms:created>' +
    '<dcterms:modified xsi:type="dcterms:W3CDTF">' + teraz + '</dcterms:modified>' +
    '</cp:coreProperties>') });

  let wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
  arkusze.forEach((a, i) => {
    const nazwa = String(a.nazwa).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31);
    wb += '<sheet name="' + esc(nazwa) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
  });
  wb += '</sheets></workbook>';
  pliki.push({ nazwa: 'xl/workbook.xml', dane: bin(wb) });

  let rel = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  arkusze.forEach((a, i) => {
    rel += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
  });
  rel += '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  rel += '</Relationships>';
  pliki.push({ nazwa: 'xl/_rels/workbook.xml.rels', dane: bin(rel) });

  pliki.push({ nazwa: 'xl/styles.xml', dane: bin(STYLE_XML) });

  arkusze.forEach((a, i) =>
    pliki.push({ nazwa: 'xl/worksheets/sheet' + (i + 1) + '.xml', dane: bin(arkuszXml(a)) }));

  return zip(pliki);
}

global.XLS = { zbuduj, zip, crc32 };

})(typeof window !== 'undefined' ? window : globalThis);
