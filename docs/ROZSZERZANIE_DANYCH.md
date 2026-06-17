# Rozszerzanie danych gry (umiejętności, talenty, profesje)

Ten dokument opisuje, jak ręcznie dodawać nowe elementy mechaniki WFRP 4ed do
plików danych aplikacji. Wszystkie pliki danych leżą w katalogu `data/` i są
zwykłymi plikami JSON kodowanymi w **UTF-8** (z polskimi znakami).

Po każdej edycji JSON-a:

1. Sprawdź poprawność składni, np. uruchamiając w terminalu:
   `& ".venv/Scripts/python.exe" -c "import json; json.load(open('data/talents.json', encoding='utf-8'))"`
2. Uruchom testy regresyjne: `& ".venv/Scripts/python.exe" -m unittest test_regression`.
3. Uruchom aplikację i sprawdź, czy nowy element pojawia się na liście.

> Uwaga: dane są wczytywane z pamięcią podręczną (`lru_cache`). Po edycji JSON-a
> należy zrestartować aplikację, aby zmiany zostały wczytane.

---

## 1. Dodawanie talentu (`data/talents.json`)

Plik `talents.json` to słownik, w którym **kluczem jest nazwa talentu**, a
wartością obiekt opisujący talent. Schemat pojedynczego wpisu:

```json
"Nazwa Talentu": {
  "max": {
    "type": "characteristic",
    "attr": "Int",
    "attr_name": "Inteligencji"
  },
  "max_raw": "Bonus z Inteligencji",
  "tests": "Rzemiosło (Aptekarstwo)",
  "description": "Pełny opis talentu z podręcznika...",
  "source": "Podręcznik podstawowy"
}
```

### Pola wpisu

| Pole          | Wymagane | Opis |
|---------------|----------|------|
| `max`         | tak      | Obiekt opisujący limit wykupień (patrz niżej). |
| `max_raw`     | tak      | Surowy tekst „Maksimum” z podręcznika (do wyświetlenia). |
| `tests`       | nie      | Powiązany Test/Umiejętność albo `null`. |
| `description` | tak      | Pełny opis talentu (pokazywany w dymku). |
| `source`      | tak      | Źródło, np. `"Podręcznik podstawowy"`. |

### Pole `max` — rodzaje limitu

- **Limit liczbowy stały** (np. „Maksimum: 1”):
  ```json
  "max": { "type": "fixed", "value": 1 }
  ```
- **Limit z bonusu cechy** (np. „Maksimum: Bonus z Inteligencji”):
  ```json
  "max": { "type": "characteristic", "attr": "Int", "attr_name": "Inteligencji" }
  ```
  Pole `attr` musi być **kodem cechy** z listy:
  `WW, US, S, Wt, I, Zw, Zr, Int, SW, Ogd`.
- **Brak limitu** (np. „Maksimum: brak”):
  ```json
  "max": { "type": "none" }
  ```
- **Limit specjalny** (zależny od decyzji MG, nie do policzenia):
  ```json
  "max": { "type": "special" }
  ```

### Talenty grupowe / ze specjalizacją

Talenty wymagające specjalizacji zapisujemy z **placeholderem w nawiasie**, np.
`"Etykieta (Grupa Społeczna)"`, `"Wiedza (Wiedza)"`, `"Odporny na (Zagrożenie)"`.
Aplikacja przy dodawaniu takiego talentu z listy poprosi gracza o wpisanie
konkretnej specjalizacji i utworzy wpis postaci typu „Etykieta (Uczeni)”,
dziedzicząc `max`, `description` i `source` z wpisu bazowego.

Nie dodawaj osobnych wpisów dla konkretnych specjalizacji — wystarczy **jeden
wpis bazowy z placeholderem**. Placeholdery już używane w bazie:
`Boska Tradycja`, `Grupa`, `Grupa Społeczna`, `Rzemiosło`, `Tradycja`,
`Wiedza`, `Wybrany Teren`, `Zagrożenie`, `typ wroga`.

---

## 2. Dodawanie umiejętności


Nazwy umiejętności grupowych zapisuj z konkretną lub placeholderową
specjalizacją w nawiasie, np. `"Wiedza (Chemia)"`, `"Język (Klasyczny)"`,
`"Splatanie Magii (Dowolny Kolor)"`.
Przykład `{ "name": "Opieka nad Zwierzętami", "attr": "Int", "grouped": false }`

---

## 3. Dodawanie / edycja profesji (`data/professions.json`)

Plik `professions.json` to słownik, w którym **kluczem jest nazwa profesji**.
Schemat wpisu:

```json
"Nazwa Profesji": {
  "species": ["człowiek", "elf wysoki", "krasnolud", "niziołek"],
  "characteristics_pending": false,
  "level1_marker_hint": 3,
  "levels": [
    {
      "level": 1,
      "title": "Tytuł poziomu 1",
      "status": "Brąz 3",
      "characteristics": ["Wytrzymałość", "Zręczność", "Inteligencja"],
      "skills": ["Leczenie", "Wiedza (Chemia)"],
      "talents": ["Czytanie/Pisanie", "Etykieta (Uczeni)"],
      "trappings": ["moździerz z tłuczkiem", "skórzany kaftan"]
    }
  ]
}
```

### Pola wpisu profesji

| Pole                      | Opis |
|---------------------------|------|
| `species`                 | Lista ras, które mogą wybrać profesję. |
| `characteristics_pending` | `false`, gdy cechy są uzupełnione; `true`, gdy schemat cech wymaga jeszcze ręcznego wpisania. |
| `level1_marker_hint`      | Liczba rozwinięć cech na 1. poziomie (podpowiedź UI). |
| `levels`                  | Lista 4 poziomów profesji (zob. niżej). |

### Pola poziomu (`levels[]`)

| Pole              | Opis |
|-------------------|------|
| `level`           | Numer poziomu (1–4). |
| `title`           | Tytuł poziomu (np. „Uczennica Aptekarki”). |
| `status`          | Status społeczny (np. „Brąz 3”, „Srebro 1”). |
| `characteristics` | **Pełne polskie nazwy** cech rozwijanych na tym poziomie (np. „Wytrzymałość”, „Siła Woli”), nie kody. |
| `skills`          | Umiejętności rozwijane na tym poziomie. |
| `talents`         | Talenty dostępne na tym poziomie. |
| `trappings`       | Wyposażenie startowe poziomu. |

> Cechy zapisuj **pełnymi nazwami** (np. „Siła Woli”, „Umiejętności Strzeleckie”).
> Aplikacja mapuje je na kody (`SW`, `US`, …) automatycznie. Lista pełnych nazw:
> Walka Wręcz, Umiejętności Strzeleckie, Siła, Wytrzymałość, Inicjatywa,
> Zwinność, Zręczność, Inteligencja, Siła Woli, Ogłada.

### Powiązanie z klasą

Profesja zostaje przypisana do klasy poprzez listę `careers` w pliku
`classes.json`. Aby nowa profesja należała do klasy „Uczeni”, dopisz jej nazwę
do tablicy `careers` tej klasy. Bez tego powiązania profesja nadal działa, ale
nie będzie filtrowana po klasie w edytorze profesji.
