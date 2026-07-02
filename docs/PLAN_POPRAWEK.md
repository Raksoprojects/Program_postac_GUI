# Plan poprawek — żywy checklist

> Plik roboczy do kontynuacji pracy na innej maszynie/module.
> Zasada: po **ukończeniu** punktu — usuń go z tego pliku i zacommituj.
> Przy **planowaniu** nowego zadania — dopisz je tutaj.
> Kolejność: najpierw fundament modelu (Faza A/B), potem tematy.

## Decyzje (ustalone z użytkownikiem)

- Ukończenie profesji liczone z **całej ścieżki kariery** (suma poziomów wszystkich
  profesji w path), próg `5×poziom` dla cech/umiejętności, `1×poziom` dla talentów.
- Talenty dodające do cechy (np. Urodzony Wojownik): **osobny bonus** do wartości
  cechy (nie liczy się jako rozwinięcia profesyjne), wybór **+5 albo rzut 1k10** przy
  wykupie (potem stały), talent **tylko raz na postać** (nawet po zmianie profesji).
- Umiejętność zarobkowa: **sufiks `+`** przy nazwie w `skills` poziomu 1 w
  `professions.json` (np. `Hazard+`). `+` niewidoczny, umiejętność kursywą.
- PDF (Faza F): fixtures — szablon `public/data/empty_card.pdf`, przykład wypełniony
  `Program Python/Rein_Nuhr_lepsza_4ed.pdf` → testy round-trip.
- Spójność danych (Faza I): wszystkie rozbieżności **raportować do akceptacji** przed
  poprawką (bez auto-fix).

## Środowisko

- Node v24 — PowerShell prefix przed npm: `$env:Path = "$env:ProgramFiles\nodejs;$env:Path"; `
- Test: `npm test` (Vitest). Build: `npm run build` (svelte-check 0 błędów/0 ostrzeżeń).
- Dane kanoniczne: `public/data/`. Nie pushować bez zgody.

---

## FAZA J — Koszty: filtr rozwijalnych (pkt 1)

- [ ] Zweryfikować filtr rozwijalnych w `TabKoszty` po naprawie Fazy B.

## Weryfikacja końcowa

- [ ] `npm test` zielone (+ nowe testy A–I).
- [ ] `npm run build`: svelte-check 0 błędów/0 ostrzeżeń.
- [ ] Testy ręczne wg scenariuszy z faz A/B/D/F.
