# Dodawanie profesji z dodatku (przykład: Piromanta)

Aplikacja domyślnie zna profesje z podręcznika podstawowego (plik
`public/data/professions.json`). Profesje z dodatków (np. *Piromanta* z dodatku o
magii) **nie są** częścią bazy — aplikacja obsłuży je jako profesje „spoza
podstawki” (`resolved = false`), ale dla pełnej funkcjonalności (schemat 4
poziomów, oznaczanie rozwijalnych cech/umiejętności/talentów, sprawdzanie
kompletowania) warto dodać je ręcznie.

## Jak aplikacja traktuje profesję spoza bazy

- Gdy w karcie postaci albo w edytorze ścieżki kariery pojawi się nazwa, której
  nie ma w `professions.json`, krok kariery dostaje `resolved = false`.
- Taką profesję nadal można ustawić i rozwijać postać ręcznie, ale:
  - nie pojawi się schemat 4 poziomów,
  - nie zadziała automatyczne oznaczanie „rozwijalne w profesji”,
  - można je wymusić ręcznie przyciskiem profesji („★/☆ Prof.”) przy
    danej umiejętności/talencie (per postać).

## Krok po kroku: dodanie profesji *Piromanta*

### 1. Dodaj wpis profesji do `public/data/professions.json`

Skopiuj poniższy **szkielet** jako nowy klucz w słowniku `professions.json`
i uzupełnij danymi z dodatku. Cechy podawaj **pełnymi polskimi nazwami**,
umiejętności i talenty — tak jak w bazie (z nawiasami dla specjalizacji).

```json
"Piromanta": {
  "races": ["Człowiek", "Wysokie Elfy"],
  "characteristics_pending": false,
  "level1_marker_hint": 3,
  "levels": [
    {
      "level": 1,
      "title": "Uczeń Piromanty",
      "status": "Brąz 3",
      "characteristics": ["Inteligencja", "Siła Woli", "Inicjatywa"],
      "skills": [
        "Język (Magiczny)",
        "Splatanie Magii (Aqshy)",
        "Wiedza (Magia)",
        "Zaklęcia"
      ],
      "talents": [
        "Czytanie/Pisanie",
        "Magia Powszechna",
        "Tradycja Magii (Ognia)"
      ],
      "trappings": ["księga zaklęć", "różdżka"]
    },
    {
      "level": 2,
      "title": "Piromanta",
      "status": "Srebro 1",
      "characteristics": ["Siła Woli"],
      "skills": [],
      "talents": [],
      "trappings": []
    },
    {
      "level": 3,
      "title": "Mistrz Piromanta",
      "status": "Srebro 3",
      "characteristics": ["Inicjatywa"],
      "skills": [],
      "talents": [],
      "trappings": []
    },
    {
      "level": 4,
      "title": "Mag Ognia",
      "status": "Złoto 1",
      "characteristics": ["Inteligencja"],
      "skills": [],
      "talents": [],
      "trappings": []
    }
  ]
}
```

> Wypełnij wszystkie 4 poziomy danymi z dodatku. Puste listy `skills`/`talents`
> są dozwolone, ale wtedy nic nie będzie oznaczane jako rozwijalne na tym
> poziomie. Cechy na każdym poziomie to te, które profesja pozwala rozwijać.

### 2. Przypisz profesję do klasy w `public/data/classes.json`

*Piromanta* należy do klasy magów akademickich (w aplikacji odpowiednikiem jest
klasa „Uczeni”). Dopisz nazwę profesji do listy `careers` właściwej klasy:

```json
"Uczeni": {
  "description": "...",
  "careers": [
    "Aptekarka",
    "Czarodziej",
    "Piromanta"
  ]
}
```

### 3. Dodaj brakujące talenty do `public/data/talents.json` (jeśli trzeba)

Jeśli profesja korzysta z talentów spoza podstawki (np. `Tradycja Magii (Ognia)`
jako specjalizacja talentu bazowego `Tradycja Magii (Tradycja)`), upewnij się,
że **wpis bazowy z placeholderem** istnieje w `talents.json`. Konkretną
specjalizację gracz wybierze przy dodawaniu talentu — nie trzeba tworzyć wpisu
dla każdej tradycji. Szczegóły w
[ROZSZERZANIE_DANYCH.md](ROZSZERZANIE_DANYCH.md) (sekcja 1).

### 4. Zweryfikuj

1. Sprawdź składnię JSON:
   `node -e "JSON.parse(require('fs').readFileSync('public/data/professions.json','utf-8'))"`
2. Uruchom testy: `npm test`.
3. W aplikacji (`npm run dev`, odśwież stronę po edycji danych) ustaw profesję
   „Piromanta” w zakładce profesji i sprawdź, czy:
   - pojawia się schemat 4 poziomów,
   - cechy/umiejętności/talenty z poziomu są oznaczone jako rozwijalne,
   - krok kariery nie jest już opisany jako „(spoza podstawki)”.

## Najczęstsze błędy

- **Cechy jako kody zamiast nazw** — w `professions.json` cechy muszą być
  pełnymi nazwami („Siła Woli”), nie kodami („SW”).
- **Literówki w nazwach umiejętności/talentów** — muszą dokładnie odpowiadać
  nazwom w karcie/`talents.json`, inaczej dopasowanie zawiedzie.
- **Niezgodna nazwa profesji** — nazwa profesji użyta w `careers` (classes.json),
  w karcie i jako klucz w `professions.json` musi być identyczna (te same znaki,
  wielkość liter, spacje), inaczej profesja będzie „spoza podstawki”.
- **Pominięcie wpisu w `classes.json`** — profesja zadziała, ale nie będzie
  filtrowana po klasie w edytorze profesji.
