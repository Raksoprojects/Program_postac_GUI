Karta Postaci Interaktywna

Zawartość katalogu dist:
- KartaPostaciInteraktywna.exe - aplikacja dla użytkownika końcowego
- karta_postaci.xlsx - opcjonalny przykładowy arkusz / szablon
- README.txt - ten plik

Uruchomienie:
1. Uruchom KartaPostaciInteraktywna.exe.
2. Wczytaj własny plik PDF albo XLSX z poziomu programu.
3. Zapisuj zmiany do tego samego pliku albo do nowej kopii.

Uwagi:
- Python nie jest wymagany na komputerze użytkownika.
- Przy pierwszym uruchomieniu Windows może pokazać ostrzeżenie SmartScreen, jeśli plik nie jest podpisany cyfrowo.
- Program najlepiej uruchamiać z katalogu, do którego użytkownik ma prawa zapisu.

Budowa nowej wersji EXE:
- uruchom skrypt build_exe.ps1 w PowerShell

Uruchomienie ze zrodel (dla deweloperow):
1. Zainstaluj Python 3.10+ i z katalogu "Program Python" utworz srodowisko:
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     pip install -r requirements.txt
2. Uruchom aplikacje:  python Postac_program_gui.py
3. Uruchom testy:      python -m unittest discover -p "test_*.py"
Katalog .venv jest pomijany w repozytorium (.gitignore), wiec po sklonowaniu
repo nalezy odtworzyc srodowisko powyzszymi krokami.
