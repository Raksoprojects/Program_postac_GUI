# Struktura projektu i opis plików

Ten dokument wyjaśnia, z jakich plików i katalogów składa się aplikacja
**Karta Postaci Interaktywna (WFRP 4ed)**, do czego służy każdy element i jak
można go bezpiecznie modyfikować. Jest to mapa dla osób, które chcą rozwijać
projekt lub zmieniać dane gry.

Powiązane przewodniki:
- [ROZSZERZANIE_DANYCH.md](ROZSZERZANIE_DANYCH.md) — dodawanie talentów, umiejętności i profesji.
- [DODAWANIE_PROFESJI_Z_DODATKU.md](DODAWANIE_PROFESJI_Z_DODATKU.md) — dodawanie profesji spoza podstawki.

---

## Przegląd architektury

Aplikacja to **statyczna strona SPA** (Vite + Svelte 5 + TypeScript), która działa
w 100% po stronie przeglądarki (także offline jako PWA). Nie ma serwera ani bazy
danych — postać przechowywana jest lokalnie (`localStorage`) oraz eksportowana do
plików **JSON** i **PDF**.

Podział odpowiedzialności:

- **`src/lib/`** — logika niezależna od interfejsu (reguły gry, model postaci,
  koszty, dane gry, import/eksport). Czysty TypeScript, w pełni testowalny.
- **`src/components/`** — warstwa widoku (komponenty Svelte): zakładki i okna.
- **`public/data/`** — dane gry (JSON) edytowane ręcznie w repozytorium.
- **`Program Python/`** — zarchiwizowana, samodzielna wersja desktopowa (kopia
  awaryjna; nie jest częścią aplikacji webowej).

Większość plików w `src/lib/` to port wcześniejszej wersji w Pythonie — stąd
adnotacje „port z …” w nagłówkach plików.

---

## Katalog główny (konfiguracja)

| Plik | Do czego służy | Czy modyfikować |
|------|----------------|-----------------|
| `package.json` | Zależności i skrypty npm (`dev`, `build`, `test`, `check`). | Tak, przy zmianie zależności lub poleceń. |
| `vite.config.ts` | Konfiguracja Vite + PWA. Pole `base` ustawia ścieżkę hostingu (GitHub Pages). | Ostrożnie — `base` musi pasować do adresu repo. |
| `vitest.config.ts` | Konfiguracja testów (środowisko `node`, wzorzec `src/**/*.{test,spec}.ts`). | Rzadko. |
| `svelte.config.js` | Konfiguracja kompilatora Svelte. | Rzadko. |
| `tsconfig*.json` | Konfiguracja TypeScript (aplikacja, narzędzia, testy). | Rzadko. |
| `index.html` | Punkt wejścia HTML (montuje aplikację). | Rzadko. |
| `.github/workflows/deploy.yml` | Automatyczny build i deploy na GitHub Pages. | Przy zmianie procesu CI/CD. |

Polecenia (z katalogu głównego):

```powershell
npm install      # instalacja zależności
npm run dev      # serwer deweloperski (hot-reload)
npm run build    # build produkcyjny (svelte-check + vite build + PWA)
npm run check    # sprawdzenie typów aplikacji
npm test         # testy jednostkowe (Vitest)
```

---

## `src/` — kod aplikacji webowej

| Plik | Rola |
|------|------|
| `main.ts` | Punkt startowy: montuje `App.svelte`, rejestruje service workera (PWA). |
| `App.svelte` | Główny układ: nagłówek, przełącznik zakładek, montowanie zakładek i okien. |
| `vite-env.d.ts` | Deklaracje typów środowiska Vite. |
| `styles/global.css` | Globalne style i zmienne CSS (kolory, odstępy, typografia). Tu zmieniasz wygląd całej aplikacji. |

### `src/lib/` — logika (bez interfejsu)

| Plik | Do czego służy | Typowe zmiany |
|------|----------------|----------------|
| `types.ts` | Definicje typów TypeScript (postać, profesja, rasa, umiejętność, talent, dane gry). | Przy zmianie kształtu danych lub modelu. |
| `rules.ts` | Reguły gry WFRP 4ed: koszty rozwinięć cech/umiejętności/talentów, lista kodów cech (`ATTRIBUTES`). | Gdy zmieniają się progi/koszty mechaniki. |
| `character.ts` | `DataManager` — model postaci: cechy, umiejętności, talenty, profesja, ścieżka kariery, import/eksport, tworzenie nowej postaci. Serce logiki. | Przy zmianie zachowania modelu postaci. |
| `creation.ts` | Tworzenie postaci: rzuty kośćmi (k100, 2k10), losowanie rasy, wyliczanie Żywotności i ruchu. Funkcje czyste (przyjmują generator losowy → testowalne). | Przy zmianie zasad tworzenia postaci. |
| `pending.ts` | Silnik „oczekujących zmian”: zakup od razu zmniejsza PD, zatwierdzenie utrwala, cofnięcie zwraca PD. | Przy zmianie mechaniki wydawania PD. |
| `gameData.ts` | Dostęp do danych gry (`public/data/*.json`): wczytywanie, wyszukiwanie profesji/klas/ras, dopasowywanie nazw, rozwijalność w profesji, mapowanie nazw cech na kody. | Przy dodawaniu akcesorów do danych. |
| `storage.ts` | Trwałość: autozapis w `localStorage`, pobieranie i wczytywanie plików JSON/PDF (działa na telefonie i desktopie). | Przy zmianie sposobu zapisu/odczytu. |
| `pdfIo.ts` | Import/eksport karty z/do formularza **PDF** (biblioteka `pdf-lib`). Ładowany leniwie tylko przy operacjach PDF. | Przy zmianie mapowania pól PDF. |
| `pdfConstants.ts` | Stałe: nazwy pól w formularzu PDF, mapowania. | Gdy zmienia się szablon PDF. |
| `store.svelte.ts` | Reaktywny store (Svelte 5 *runes*) opakowujący `DataManager` i silnik PD. Łącznik między logiką a komponentami; dostarcza dane do widoków i akcje. | Przy dodawaniu nowych akcji/danych dla UI. |
| `uiScale.ts` | Skalowanie interfejsu (przyciski `+/−`, `Ctrl`+kółko), zapamiętywane między sesjami. | Rzadko. |

> Zasada: logika (`character.ts`, `rules.ts`, `pending.ts`, `creation.ts`,
> `gameData.ts`) nie zna interfejsu. Reaktywność i powiązanie z widokiem dodaje
> dopiero `store.svelte.ts`. Dzięki temu logikę można testować bez przeglądarki.

### `src/components/` — widok (Svelte)

| Plik | Co wyświetla |
|------|--------------|
| `TabCechy.svelte` | Zakładka **Cechy**: 10 cech (początkowa/rozwinięcie/wartość/maks), przyciski `±1/±5`, filtr „tylko rozwijalne”, wartości drugorzędne. |
| `TabUmiejetnosci.svelte` | Zakładka **Umiejętności**: lista z filtrem, dodawanie własnych, oznaczanie profesyjnych. |
| `TabTalenty.svelte` | Zakładka **Talenty**: dodawanie z listy/własnych, maksima, opisy. |
| `TabProfesja.svelte` | Zakładka **Profesja**: status kompletowania, edytor klasy/profesji/poziomu, ścieżka kariery, schemat poziomów 1–4. |
| `TabKoszty.svelte` | Zakładka **Koszty**: kalkulator na żywo i tabela progów rozwinięć. |
| `TabDoswiadczenie.svelte` | Zakładka **Doświadczenie**: ustawianie/dodawanie PD. |
| `TabHistoria.svelte` | Zakładka **Historia**: log zdarzeń ze znacznikami czasu. |
| `CreatorModal.svelte` | Kreator nowej postaci (rasa → cechy → punkty → umiejętności → talenty → podsumowanie). |
| `SummaryCards.svelte` | Karty podsumowania (wartości drugorzędne). |
| `Modal.svelte` | Bazowe okno modalne (wielokrotnego użytku). |
| `Autocomplete.svelte` | Pole z podpowiedziami (np. wybór profesji/umiejętności). |

### `src/lib/__tests__/` — testy

Testy jednostkowe i integracyjne (Vitest). `loadData.ts` wczytuje dane gry do
testów. Uruchom: `npm test`. Po zmianie logiki lub danych warto dopisać/zaktualizować
test.

---

## `public/` — zasoby statyczne

| Element | Do czego służy |
|---------|----------------|
| `data/professions.json` | Profesje (kariery) i ich 4 poziomy: cechy, umiejętności, talenty, wyposażenie. |
| `data/classes.json` | Klasy i przypisane do nich profesje (lista `careers`). |
| `data/races.json` | Rasy: bazowe cechy, ruch, Żywotność, pule Przeznaczenia/Bohatera, tabele losowania. |
| `data/skills.json` | Kanoniczna lista umiejętności (nazwa, cecha wiodąca, czy grupowa). |
| `data/talents.json` | Talenty: limity (maksima), testy, opisy, źródło. |
| `data/empty_card.pdf` | Pusty szablon formularza PDF używany przy eksporcie nowej postaci. |
| `favicon.svg`, `icon-192.png`, `icon-512.png` | Ikony aplikacji / PWA. |

**Pliki `data/*.json` to kanoniczne źródło danych gry** — edytujesz je ręcznie
w repozytorium (UTF-8). Szczegółowe schematy i przykłady znajdziesz w
[ROZSZERZANIE_DANYCH.md](ROZSZERZANIE_DANYCH.md) oraz
[DODAWANIE_PROFESJI_Z_DODATKU.md](DODAWANIE_PROFESJI_Z_DODATKU.md).

Po edycji JSON-a:

1. Sprawdź składnię, np.:
   `node -e "JSON.parse(require('fs').readFileSync('public/data/professions.json','utf-8'))"`
2. Uruchom testy: `npm test`.
3. Sprawdź w aplikacji (`npm run dev`, odśwież stronę po zmianie danych).

> Ważne: nazwa profesji musi być **identyczna** w `professions.json` (klucz),
> w `classes.json` (lista `careers`) i w karcie postaci. Cechy w profesjach
> zapisuj **pełnymi polskimi nazwami** (np. „Siła Woli”), aplikacja sama mapuje
> je na kody (`SW`). Te i inne częste błędy opisano w przewodnikach powyżej.

---

## `Program Python/` — zarchiwizowana wersja desktopowa

Samodzielna, wcześniejsza wersja aplikacji w Pythonie (Tkinter/CustomTkinter).
**Nie jest częścią aplikacji webowej** i nie wpływa na nią. Zachowana jako kopia
awaryjna z własnymi danymi, testami i skryptem budującym `.exe`.

| Element | Rola |
|---------|------|
| `Postac_program_gui.py` | Główna aplikacja desktopowa (GUI). |
| `core/`, `game_data.py`, `pdf_character_io.py` | Logika, dane gry i obsługa PDF wersji desktopowej. |
| `test_*.py` | Testy wersji desktopowej. |
| `requirements.txt` | Zależności Pythona (instalacja przez `pip` w środowisku `venv`). |
| `build_exe.ps1`, `*.spec` | Budowanie pliku wykonywalnego (PyInstaller). |
| `README.txt` | Instrukcje uruchomienia i budowy wersji desktopowej. |

Uruchomienie ze źródeł (z katalogu `Program Python`):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python Postac_program_gui.py            # aplikacja
python -m unittest discover -p "test_*.py"   # testy
```

---

## Najczęstsze scenariusze modyfikacji

- **Dodać/zmienić talent, umiejętność lub profesję** → edytuj odpowiedni plik
  w `public/data/`; patrz [ROZSZERZANIE_DANYCH.md](ROZSZERZANIE_DANYCH.md).
- **Dodać profesję z dodatku** → [DODAWANIE_PROFESJI_Z_DODATKU.md](DODAWANIE_PROFESJI_Z_DODATKU.md).
- **Zmienić koszty rozwoju / progi** → `src/lib/rules.ts`.
- **Zmienić zasady tworzenia postaci** → `src/lib/creation.ts` i `src/components/CreatorModal.svelte`.
- **Zmienić wygląd** → `src/styles/global.css` (zmienne) lub style w komponentach.
- **Zmienić mapowanie pól PDF** → `src/lib/pdfConstants.ts` i `src/lib/pdfIo.ts`.
- **Dodać nową zakładkę** → nowy komponent w `src/components/` + podpięcie w `App.svelte`.

Po każdej zmianie kodu uruchom `npm run check` (typy) i `npm test` (logika).
Przed wdrożeniem wykonaj `npm run build`.
