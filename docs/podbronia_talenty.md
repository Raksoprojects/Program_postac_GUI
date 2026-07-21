# Faza 2 — Pod Bronią: talenty (lista do potwierdzenia)

Źródło: `Sources/WFRP_4_Pod_Bronia.pdf`, „Dodatek 3: Nowe i Zaktualizowane Talenty" (str. 140–141).

Zasada: warianty `pod_bronia` nadpisują **tylko zmienione pola**; „Podstawowe" pozostają bez zmian.
Tryb „Pełne Domowe" dziedziczy po `pod_bronia` (fallback), dopóki nie dodasz własnego `variants.domowe`.

## Nowy talent (dodany do `talents.json`, dostępny we wszystkich trybach)

- **Dowódca Załogi** — Maks: Bonus z Inicjatywy · Testy: „Broń Zasięgowa, kiedy strzelasz z broni z Wadą Załoga".
  Zarządzanie załogą maszyn oblężniczych/artylerii; Test Dowodzenia pozwala załodze użyć Twojej Umiejętności Broń Zasięgowa. `source: "Pod Bronią"`.

## Zaktualizowane talenty (dodano `variants.pod_bronia`)

Wszystkie 11 realnie różni się od podstawki (głównie mechanika **Puli Przewagi**):

| Talent | Co się zmienia w Pod Bronią |
|---|---|
| Artylerzysta | +zdanie: przeładowanie w walce = Akcja Ocena Sytuacji, +1 Przewaga |
| Chodu! | obejmuje też bycie ściganym w pościgu (opis + testy) |
| Morderczy Atak | inny efekt: rzut 2× w Tabeli Ran Krytycznych, wybór; **Maks = 1** |
| Musztra | inny efekt: postać liczona jak dwóch walczących przy utracie Przewagi |
| Nieustępliwy | inny efekt: koszt Ucieczki przed zagrożeniem = 1 Przewaga; **Maks = 1** |
| Odwrócenie Szans | „wszystkie Przewagi" → „1 Przewaga z Puli Przewagi Przeciwników" |
| Rozproszenie Uwagi | +testy „Atletyka podczas Rozproszenia Uwagi"; „do swojej Puli" |
| Szybkie Przeładowanie | +zdanie: przeładowanie w walce = Akcja Ocena Sytuacji, +1 Przewaga |
| Tarczownik | inny efekt: wydaj 2 Przewagi na Obrażenia/odepchnięcie; +testy |
| Urodzony w Siodle | uogólnienie na „wierzchowca" + odporność na Strach/Grozę wg Rozmiaru |
| Zbicie Broni | „−1 za PS" → „1 + kolejna przy Zdumiewającym Sukcesie (6+ PS)" |

Pełne teksty wpisane do `public/data/talents.json` (pola `variants.pod_bronia`). Jeśli któryś opis chcesz doprecyzować — wskaż, poprawię.

## Do potwierdzenia / uwagi

1. Teksty pochodzą z ekstrakcji PDF (OCR) — proszę o rzut oka na brzmienie.
2. Czy „Pełne Domowe" ma na starcie = „Pod Bronią" dla tych talentów? (Tak wynika z fallbacku — potwierdź.)
3. Pozostałe klastry Pod Bronią do skatalogowania w następnej kolejności:
   - Nowe profesje: Żołnierze (str. 10–22: Łucznicza, Gwardzista Elektorski, Halabardnik, Strzelec, Artylerzysta, Ciura Obozowa — **nazwy umiej./talentów zweryfikowane, wszystkie istnieją**),
     Rycerze (31–36), Psy Wojny (44–48), Kapłan/Kapłanka Bitewna Myrmidii (78),
     oraz z tabeli str. 9: Pikinier, Specjalista Oblężniczy, Kartografka, Lekki Kawalerzysta.
   - Tabela losowania profesji startowej (str. 9) + tworzenie postaci z Tilei (55–56) → integracja z kreatorem (Faza 4).
