# Karta Postaci Interaktywna

Desktopowa aplikacja w Pythonie do zarządzania kartą postaci do **Warhammer Fantasy Roleplay 4 edycja**. Program pozwala wczytać kartę z Excela albo PDF, przeglądać cechy i umiejętności, liczyć koszty rozwinięć, rezerwować i zatwierdzać wydawane PD oraz zapisywać zmiany z powrotem do pliku źródłowego.

## O czym jest to repozytorium

To repozytorium zawiera kod źródłowy aplikacji GUI do pracy z kartą postaci WFRP 4e.

Projekt obejmuje:

- interfejs użytkownika oparty o `customtkinter`,
- odczyt i zapis danych w formacie `xlsx`,
- odczyt i częściowy zapis danych w formularzu `pdf`,
- kalkulator kosztów rozwinięć zgodny z tabelą kosztów systemu,
- budowanie gotowego pliku `.exe` dla użytkownika końcowego.

Repozytorium nie jest biblioteką ogólnego przeznaczenia. To aplikacja użytkowa skoncentrowana na obsłudze karty postaci.

## Co robi program

Program umożliwia:

- wczytanie karty postaci z pliku Excel lub PDF,
- wyświetlenie cech postaci wraz z wartościami początkowymi, rozwinięciami i bieżącą wartością,
- wyświetlenie umiejętności z podziałem na podstawowe oraz zaawansowane / grupowe,
- filtrowanie umiejętności po nazwie, cesze oraz po znaczniku `+`,
- oznaczanie cech i umiejętności dostępnych do rozwoju w profesji znakiem `+`,
- zwiększanie i zmniejszanie rozwinięć z natychmiastowym przeliczeniem PD,
- podgląd maksymalnych możliwych rozwinięć przy aktualnej liczbie dostępnych punktów,
- używanie kalkulatora kosztów dowolnej liczby rozwinięć,
- przegląd szybkiej tabeli kosztów dla cech i umiejętności,
- dodawanie niestandardowych umiejętności do karty,
- ręczne ustawianie lub zwiększanie dostępnego doświadczenia,
- zatwierdzanie zmian albo cofanie zmian oczekujących,
- zapis do tego samego pliku albo do nowej kopii,
- uruchamianie aplikacji jako samodzielnego `.exe` bez instalowania Pythona.

## Jak działa aplikacja

### 1. Wczytanie danych

Program rozpoznaje rozszerzenie pliku i ładuje dane odpowiednim mechanizmem:

- `xlsx` przez `openpyxl`,
- `pdf` przez `pypdf` oraz mapowanie pól formularza.

Po wczytaniu dane trafiają do wewnętrznego modelu w pamięci, którym zarządza `DataManager`.

### 2. Praca na zmianach oczekujących

Zmiany wykonywane w GUI nie są od razu traktowane jako trwałe. Program przechowuje je jako zmiany oczekujące, dzięki czemu można:

- rezerwować PD,
- zwiększać lub cofać rozwinięcia,
- dodawać nowe umiejętności,
- anulować cały zestaw zmian,
- zatwierdzić wszystko jednym potwierdzeniem.

To ogranicza ryzyko przypadkowego nadpisania karty.

### 3. Obliczanie kosztów

Koszty rozwinięć są liczone dynamicznie na podstawie aktualnego poziomu rozwinięć oraz tabeli kosztów zaimplementowanej w kodzie. Dzięki temu:

- przyciski `+1`, `+5`, `-1`, `-5` działają zgodnie z zasadami kosztów,
- kalkulator pokazuje koszt dowolnej liczby rozwinięć,
- szybka tabela kosztów pozwala porównać progi 5, 10, 15 i 20 rozwinięć.

### 4. Zapis pliku

Program zapisuje dane do tego samego typu źródła, z którego karta została wczytana:

- Excel wraca do `xlsx`,
- PDF wraca do `pdf`.

W przypadku PDF zapis obejmuje obecnie przede wszystkim pola formularza związane z postacią, doświadczeniem, cechami, mapowanymi umiejętnościami oraz częścią pól tekstowych/talentów.

## Obsługiwane dane

### Cechy

- wartości początkowe,
- rozwinięcia,
- wartość końcowa,
- znacznik dostępności profesji `+`.

### Umiejętności

- atrybut powiązany z umiejętnością,
- wartość początkowa,
- rozwinięcia,
- wartość końcowa,
- podział na `Podstawowe` i `Zaawansowane / grupowe`,
- znacznik dostępności profesji `+`.

### Doświadczenie

- dostępne PD,
- wydane PD,
- łączna pula PD,
- ręczne ustawianie lub dodawanie punktów.

### Talenty

Repozytorium ma już podstawy importu danych talentów z PDF, ale pełny moduł edycji talentów w GUI jest jeszcze planowany.

## Struktura repozytorium

- [Postac_program_gui.py](Postac_program_gui.py) — główny plik aplikacji GUI i logiki operacyjnej.
- [pdf_character_io.py](pdf_character_io.py) — odczyt i zapis danych z formularza PDF.
- [test_regression.py](test_regression.py) — testy regresyjne dla najważniejszych scenariuszy.
- [KartaPostaciInteraktywna.spec](KartaPostaciInteraktywna.spec) — konfiguracja PyInstallera do budowy `.exe`.
- [build_exe.ps1](build_exe.ps1) — skrypt budujący wersję dystrybucyjną aplikacji.
- [karta_postaci.xlsx](karta_postaci.xlsx) — przykładowy / bazowy arkusz Excel.
- [Rein_Nuhr_lepsza_4ed.pdf](Rein_Nuhr_lepsza_4ed.pdf) — przykładowy formularz PDF używany do testów i mapowania.
- [history.json](history.json) — historia działań programu.
- [TODO.md](TODO.md) — lista kolejnych prac do wykonania.

## Wymagania developerskie

Projekt używa Pythona oraz kilku bibliotek zewnętrznych.

Aktualnie używane pakiety:

- `customtkinter`
- `openpyxl`
- `pypdf`
- `pyinstaller`
- `pillow`

## Uruchomienie w środowisku developerskim

1. Utwórz i aktywuj środowisko wirtualne.
2. Zainstaluj wymagane pakiety.
3. Uruchom aplikację:

```powershell
c:/Private_project/Program_postac_GUI/.venv/Scripts/python.exe Postac_program_gui.py
```

## Testy

Najważniejsze scenariusze są pokryte testami regresyjnymi.

Uruchomienie testów:

```powershell
c:/Private_project/Program_postac_GUI/.venv/Scripts/python.exe -m unittest test_regression.py
```

Testy obejmują między innymi:

- poprawne rozliczanie PD,
- zachowanie filtrów i kolejności umiejętności,
- zapis Excela,
- odczyt PDF,
- zapis pól formularza PDF.

## Budowanie pliku EXE

Repozytorium zawiera gotowy skrypt do budowy wersji dla użytkownika końcowego.

Uruchom:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1
```

Po buildzie gotowe pliki pojawią się w katalogu `dist`:

- `KartaPostaciInteraktywna.exe`
- `KartaPostaciInteraktywna.zip`
- `karta_postaci.xlsx`
- `README.txt`

Użytkownik końcowy nie potrzebuje zainstalowanego Pythona.

## Ograniczenia i aktualny stan

- zapis PDF jest zaimplementowany, ale formularz używa niestandardowych fontów, więc część pól tekstowych z polskimi znakami wymaga ostrożnego traktowania,
- checkboxy profesji z PDF są obecnie odczytywane i pokazywane jako `+`, ale ich zapis z powrotem do PDF pozostaje do wdrożenia,
- moduł talentów w GUI jest jeszcze nieukończony,
- aplikacja jest tworzona z myślą o Windows i desktopowym użyciu lokalnym.

## Roadmapa

Najbliższe kierunki rozwoju są zapisane w [TODO.md](TODO.md).

Najważniejsze z nich:

- pełny zapis checkboxów profesji do PDF,
- pełna obsługa talentów,
- kreator nowej postaci,
- dalsze dopracowanie wydajności i obsługi PDF.