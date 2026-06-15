# Karta Postaci Interaktywna — WFRP 4ed

Aplikacja **webowa** do zarządzania kartą postaci do **Warhammer Fantasy Roleplay 4 edycja**.
Działa w przeglądarce na telefonie i komputerze (dowolny system), bez instalacji i bez
serwera — całość liczy się po stronie klienta. Pozwala wczytać kartę z formularza PDF,
edytować cechy, umiejętności i talenty, liczyć koszty rozwinięć, rezerwować i zatwierdzać
wydawane PD, zapisywać postać do JSON (z historią zmian) oraz eksportować z powrotem do PDF.

> Poprzednia, desktopowa wersja w Pythonie została zarchiwizowana w katalogu
> [`Program Python/`](Program%20Python/) i pozostaje samodzielną kopią awaryjną
> (własne dane, testy i skrypt budujący `.exe`).

## Jak to działa w przeglądarce

- **Statyczna aplikacja SPA** hostowana na GitHub Pages: ładuje się od razu i działa w 100%
  po stronie klienta. Nic nie wychodzi na zewnątrz — Twoje postacie są prywatne.
- **Postacie** trzymane są lokalnie: autozapis w `localStorage` (przetrwa odświeżenie i
  zamknięcie karty) oraz eksport/import plików **JSON** i **PDF**.
- **PWA / offline**: po pierwszym wczytaniu aplikacja działa bez internetu. Na telefonie
  można użyć „Dodaj do ekranu głównego”, by uruchamiać ją jak natywną aplikację.
- **Zoom**: przyciski `+/−` w nagłówku oraz `Ctrl` + kółko myszy płynnie skalują cały
  interfejs (zapamiętywane między sesjami).

## Przepływ pracy

1. **Wczytaj z PDF** — pierwsze wczytanie postaci z wypełnionego formularza PDF.
2. **Edytuj** — cechy, umiejętności, talenty, profesja, doświadczenie; koszty liczą się na żywo.
3. **Zapisz JSON** — natywny zapis postaci wraz z historią zmian (do ponownego wczytania).
4. **Eksport PDF** — w dowolnej chwili wypełnij formularz PDF aktualnymi danymi.

## Zakładki interfejsu

- **Cechy** — 10 cech (początkowa / rozwinięcie / wartość / maks), przyciski `+1/+5/−1/−5`,
  filtr „tylko rozwijalne”, „Zgoda MG”.
- **Umiejętności** — filtr po nazwie i cesze, dodawanie własnych, oznaczanie profesyjnych,
  podział na podstawowe i zaawansowane.
- **Talenty** — dodawanie z listy lub własnych, maksima (brak / liczba / bonus cechy /
  specjalne), opisy, talenty-widma.
- **Profesja** — status kompletowania, edytor klasy/profesji/poziomu, ścieżka kariery,
  schemat poziomów 1–4.
- **Koszty** — kalkulator na żywo oraz tabela progów 5/10/15/20 rozwinięć.
- **Doświadczenie** — ustawianie/dodawanie PD i szybkie przyciski.
- **Historia** — log zdarzeń ze znacznikami czasu.

## Technologia

- **Vite + Svelte 5 (runes) + TypeScript** — mały runtime, szybka reaktywność (telefon),
  czytelny kod.
- **pdf-lib** — odczyt i zapis formularzy PDF (ładowane leniwie tylko przy operacjach PDF).
- **vite-plugin-pwa** — service worker i tryb offline.
- **Vitest** — testy jednostkowe logiki (koszty, dane gry, model postaci, import/eksport PDF).

## Uruchomienie lokalne (dev)

Wymagany Node.js 20+.

```powershell
npm install
npm run dev      # serwer deweloperski z hot-reload (http://localhost:5173)
```

Inne polecenia:

```powershell
npm run build        # build produkcyjny (svelte-check + vite build, generuje PWA)
npm run preview      # podgląd zbudowanej wersji produkcyjnej
npm run check        # sprawdzenie typów aplikacji
npm run check:test   # sprawdzenie typów plików testowych
npm test             # testy Vitest
```

## Wdrożenie (GitHub Pages)

Aplikacja jest przeznaczona do dedykowanego repozytorium typu *user/organization page*
(`login.github.io`), dlatego `base` w [vite.config.ts](vite.config.ts) ustawiono na `'/'`.
Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) automatycznie buduje
i publikuje aplikację:

1. Wykonaj `commit` i `push` na gałąź `main`.
2. GitHub Actions uruchamia `npm ci` i `npm run build`, a następnie publikuje katalog `dist`.
3. Po ok. minucie zmiany są dostępne na żywo.

> Gdyby aplikacja trafiła do repozytorium projektowego (np. `login.github.io/karta`),
> zmień `base` na `'/karta/'`.

## Dane gry (mechanika)

Dane talentów, profesji i klas są przechowywane jako pliki JSON w
[`public/data/`](public/data/) (kanoniczne źródło edytowane w repozytorium):

- [docs/ROZSZERZANIE_DANYCH.md](docs/ROZSZERZANIE_DANYCH.md) — jak dodać talent lub umiejętność.
- [docs/DODAWANIE_PROFESJI_Z_DODATKU.md](docs/DODAWANIE_PROFESJI_Z_DODATKU.md) — jak dodać profesję z dodatku.

Aby zmienić dane gry: edytuj plik `*.json` → `commit` → `push`. Po przebudowaniu w CI
zmiany pojawią się na żywo. Format JSON postaci jest zgodny z wersją desktopową.

## Struktura repozytorium

- [src/](src/) — aplikacja webowa (komponenty Svelte, logika w `src/lib/`).
- [public/data/](public/data/) — kanoniczne dane gry (JSON) + szablon `empty_card.pdf`.
- [tools/icons/](tools/icons/) — źródłowy SVG i skrypt generujący ikony PWA.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — automatyczny deploy na Pages.
- [Program Python/](Program%20Python/) — zarchiwizowana, samodzielna wersja desktopowa (Python).

## Regeneracja ikon PWA

Ikony (`public/icon-192.png`, `public/icon-512.png`) są wersjonowane. W razie zmiany
[tools/icons/icon-source.svg](tools/icons/icon-source.svg):

```powershell
npm install --save-dev sharp
node tools/icons/generate-icons.mjs
npm uninstall sharp
```
