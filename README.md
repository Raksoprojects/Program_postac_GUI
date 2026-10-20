# Karta Postaci WFRP 4ed

**▶ Aplikacja / Live app: <https://raksoprojects.github.io/Program_postac_GUI/>**

🇵🇱 **Interaktywna karta postaci do Warhammer Fantasy Roleplay 4 edycja.** Działa w przeglądarce
na telefonie i komputerze, bez instalacji i bez serwera. Po pierwszym otwarciu działa też offline.
Kreator postaci, rozwój cech, umiejętności i talentów z kosztami PD, profesje i ścieżka kariery
(także z dodatków), zaklęcia i modlitwy, mutacje i wampiryzm, broń i pancerz, generator przedmiotów
magicznych. Postać zapisujesz do pliku JSON albo wczytujesz z formularza karty PDF i eksportujesz
z powrotem do PDF. Dane postaci zostają w Twojej przeglądarce i nigdzie nie są wysyłane.

🇬🇧 **An interactive character sheet for Warhammer Fantasy Roleplay 4th Edition** (Polish-language UI).
It runs in the browser on phone and desktop, with no installation and no server, and works offline
after the first visit. Features: character creator, advancing characteristics, skills and talents with
XP costs, careers and career paths (including supplements), spells and prayers, mutations and
vampirism, weapons and armour, and a magic item generator. Save characters to JSON, or import a filled
PDF character sheet and export back to PDF. Character data stays in your browser and is never sent anywhere.

---

## Licencja / License

🇵🇱 Kod programu jest udostępniony na licencji **MIT** (plik [LICENSE](LICENSE)). Możesz go swobodnie
kopiować, modyfikować, używać (także komercyjnie) i rozpowszechniać, pod warunkiem zachowania
informacji o autorze i treści licencji. Jeśli korzystasz z kodu, **podaj proszę link do oryginalnego
repozytorium**: <https://github.com/Raksoprojects/Program_postac_GUI>.

🇬🇧 The source code is released under the **MIT License** (see [LICENSE](LICENSE)). You may freely copy,
modify, use (including commercially) and distribute it, provided that the copyright notice and the
license text are kept. If you use this code, **please credit it with a link to the original
repository**: <https://github.com/Raksoprojects/Program_postac_GUI>.

### Zastrzeżenie / Disclaimer

🇵🇱 To nieoficjalny projekt fanowski, niezwiązany z Games Workshop ani Cubicle 7. Warhammer Fantasy
Roleplay, Warhammer i powiązane nazwy są znakami towarowymi ich właścicieli. Licencja MIT obejmuje
wyłącznie kod programu. Nie obejmuje treści gry (nazw, opisów zasad, zaklęć, talentów i profesji)
ani materiałów z podręczników. Do gry potrzebny jest oryginalny podręcznik.

🇬🇧 This is an unofficial fan project, not affiliated with Games Workshop or Cubicle 7. Warhammer Fantasy
Roleplay, Warhammer and related names are trademarks of their respective owners. The MIT License covers
the program code only. It does not cover game content (names, rule texts, spells, talents, careers) or
material from the rulebooks. You need the official rulebook to play.

---

## Funkcje

- **Kreator postaci** — rasa i pochodzenie, rzut na cechy, Przeznaczenie/Bohater, umiejętności i talenty
  rasowe, losowanie imienia, płeć (żeńskie nazwy profesji).
- **Cechy, Umiejętności, Talenty** — rozwinięcia z kosztami PD, rezerwacja i zatwierdzanie wydatków,
  „Zgoda MG”, podpowiedzi specjalizacji („Język (…)”, „Magia Tajemna (Tradycja)”).
- **Profesja** — kompletowanie poziomu, awans, ścieżka kariery, wybory „(Dowolna)” / „albo”,
  profesje z dodatków oraz opcjonalne „Profesje zła” (Warriors of Chaos).
- **Zaklęcia/Modlitwy** — nauka zaklęć i cudów wg zasad podręcznika.
- **Modyfikatory** — mutacje, Dary Chaosu, wampiryzm, własne modyfikatory cech.
- **Broń i pancerz** — katalog, Obrażenia z BS, PP na lokacjach, Tarcza, Obciążenie.
- **Przedmioty magiczne** — generator (losowy, pół-losowy, własny) i lista przedmiotów postaci.
- **Koszty, Doświadczenie, Historia** — kalkulator rozwinięć, PD, dziennik zmian.
- **PDF i JSON** — import/eksport formularza karty PDF, zapis postaci do JSON, autozapis w przeglądarce.
- **PWA / offline**, skalowanie interfejsu (`+/−`, `Ctrl` + kółko myszy).

## Technologia

Vite + Svelte 5 (runes) + TypeScript, pdf-lib (formularze PDF), vite-plugin-pwa (offline),
Vitest (testy).

## Uruchomienie lokalne

Wymagany Node.js 20+.

```powershell
npm install
npm run dev          # serwer deweloperski (http://localhost:5173)
npm run build        # build produkcyjny (svelte-check + vite build, PWA)
npm run preview      # podgląd builda
npm test             # testy Vitest
```

## Wdrożenie (GitHub Pages)

Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) buduje i publikuje aplikację
po każdym `push` na gałąź główną. Aplikacja działa pod ścieżką `/Program_postac_GUI/`, dlatego
`base` w [vite.config.ts](vite.config.ts) ma tę wartość.

## Dane gry i dokumentacja

Dane mechaniki (profesje, talenty, zaklęcia, broń…) to pliki JSON w [public/data/](public/data/).

Opis plików projektu i sposób ich modyfikowania: [docs/STRUKTURA_PROJEKTU.md](docs/STRUKTURA_PROJEKTU.md).

Poprzednia, desktopowa wersja w Pythonie jest zarchiwizowana w [`Program Python/`](Program%20Python/).
