# Magazyn — ewidencja artykułów biurowych i wyposażenia

Aplikacja webowa (PWA) na telefon z Androidem. Działa offline, dane trzyma
wyłącznie w przeglądarce, nic nie wysyła do internetu.

## Co potrafi

**Materiały zużywalne** — katalog produktów, skanowanie kodów EAN, dostawy (PZ),
wydania na punkty (RW), korekty stanu, stany minimalne z listą zakupową.
Stan magazynowy liczy się jako suma dokumentów, więc zawsze zgadza się z historią.

**Sprzęt i wyposażenie** — ewidencja pojedynczych sztuk, numery inwentarzowe,
przypisanie do pomieszczeń, historia przemieszczeń, zdjęcia, protokoły przekazania.

**Etykiety QR** — arkusze na naklejki A4 (70×37, 105×37 i 48×25 mm) dla sprzętu
i dla pomieszczeń.

**Inwentaryzacja** — skanujesz etykietę na drzwiach, potem sprzęt w pokoju,
a aplikacja pokazuje pozycje zgodne, brakujące i nadmiarowe oraz drukuje protokół.

**Excel** — jeden plik .xlsx z arkuszami: stany, do zamówienia, dostawy, wydania,
zużycie wg punktów, sprzęt, sprzęt wg pomieszczeń, historia przemieszczeń,
pomieszczenia, katalog i inwentaryzacje.

## Uruchomienie

Aplikacja **musi** być otwarta przez adres `https://` — przeglądarka blokuje
aparat i zapis danych stronom otwartym z pliku na dysku.

### GitHub Pages (darmowe, bez zgody administratora)

1. Załóż konto na `github.com`.
2. **New repository** → nazwa np. `magazyn` → zaznacz **Public** → **Create**.
3. **Add file → Upload files** → wrzuć **całą zawartość** tego folderu
   (razem z podfolderami `js`, `css`, `vendor`, `icons`) → **Commit changes**.
4. **Settings → Pages** → Source: *Deploy from a branch*, branch `main`, folder `/root` → **Save**.
5. Po ~2 minutach dostaniesz adres `https://twojanazwa.github.io/magazyn/`.

Repozytorium musi być publiczne, żeby Pages działało w darmowym planie.
W kodzie nie ma żadnych danych — dane powstają dopiero w Twoim telefonie.

### Instalacja na telefonie

Otwórz adres w przeglądarce **w tym profilu Androida, w którym będziesz pracować**
(profil służbowy i prywatny mają osobne, niewidoczne dla siebie bazy danych).

- Edge: menu **…** → **Dodaj do telefonu**
- Chrome: menu **⋮** → **Dodaj do ekranu głównego**

Uruchamiaj zawsze z tej ikony. Aplikacja poprosi o dostęp do aparatu przy
pierwszym skanowaniu — trzeba się zgodzić.

## Pierwsze kroki

1. **Więcej → Ustawienia** — nazwa firmy, Twoje imię, prefiks numerów inwentarzowych.
2. **Więcej → Pomieszczenia** — dodaj pomieszczenia i punkty wydań.
3. **Więcej → Etykiety QR** — wydrukuj etykiety pomieszczeń i naklej przy drzwiach.
4. **Sprzęt** — dodawaj sztuki i drukuj dla nich etykiety.
5. **Dostawa** — produkty dodają się same przy pierwszym zeskanowaniu kodu EAN.

## Kopia zapasowa — to nie jest opcja

Baza siedzi w pamięci przeglądarki. Znika przy: wyczyszczeniu danych przeglądarki,
odinstalowaniu aplikacji, zmianie telefonu i wyczyszczeniu profilu służbowego
przez administratora.

**Excel i kopia → Zrób kopię zapasową** zapisuje plik `.json` z całą bazą.
Rób to co tydzień i trzymaj plik poza telefonem. Aplikacja sama przypomina
po 7 dniach albo 50 zmianach (do zmiany w Ustawieniach).

## Wysyłka pliku mailem

Edge na Androidzie nie pozwala wysłać pliku prosto ze strony, więc pliki
zapisują się w **Pobranych**. Żeby wysłać: aplikacja **Pliki** → przytrzymaj
plik → **Udostępnij** → Outlook.

## Druk etykiet

W oknie drukowania ustaw **A4**, skalowanie **100% / rzeczywisty rozmiar**
i marginesy **brak**. Przy skalowaniu „dopasuj do strony" etykiety nie trafią
w naklejki. Na Androidzie można też wybrać „Zapisz jako PDF" i wydrukować
z komputera.

## Struktura plików

```
index.html               szkielet aplikacji
manifest.webmanifest     opis dla instalacji na ekranie głównym
sw.js                    praca offline (po zmianach podbij WERSJA w środku)
css/style.css            wygląd
js/db.js                 baza danych, model, wyliczanie stanów
js/xlsx.js               generator plików Excel (własny, bez bibliotek)
js/eksport.js            budowa arkuszy i oddanie pliku użytkownikowi
js/skaner.js             odczyt kodów z aparatu
js/etykiety.js           kody QR, arkusze etykiet, protokoły, wydruk
js/ui.js                 ekrany i nawigacja
js/app.js                uruchomienie
vendor/zxing.min.js      zapasowy dekoder kodów (Edge nie ma wbudowanego)
vendor/qrcode.min.js     generator kodów QR
```

## Na przyszłość — praca w kilka osób

Każdy rekord ma własny identyfikator UUID i znaczniki czasu, a dokumenty
tylko się dopisuje (nigdy nie edytuje). Dzięki temu dołożenie synchronizacji
przez serwer nie wymaga przepisywania aplikacji — wystarczy dodać warstwę
wysyłania i pobierania rekordów. Do tego czasu można pracować na jednym
urządzeniu, a pozostałym osobom przekazywać raport Excel.
