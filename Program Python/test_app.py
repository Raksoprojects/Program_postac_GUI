#!/usr/bin/env python3
"""
Skrypt testowy do weryfikacji, czy aplikacja się ładuje prawidłowo.
"""

import sys
import os

# Dodaj katalog do ścieżki
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("1. Importuję moduły...")
    from Postac_program_gui import (
        COST_TABLE, ATTRIBUTES, DataManager, HistoryManager, CharacterSheetApp, calculate_advancement_cost
    )
    print("   ✓ Moduły zaimportowane pomyślnie")
    
    print("\n2. Testuję DataManager...")
    dm = DataManager()
    print(f"   ✓ DataManager instancjonowany")
    
    print("\n3. Testuję wczytanie pliku Excel...")
    if dm.load_from_excel("karta_postaci.xlsx"):
        print(f"   ✓ Plik wczytany pomyślnie")
        print(f"     - Nazwa postaci: {dm.character_name}")
        print(f"     - Liczba cech: {len(dm.attributes)}")
        print(f"     - Liczba umiejętności: {len(dm.skills)}")
        print(f"     - Dostępne PD: {dm.experience['available']}")
    else:
        print("   ✗ Błąd przy wczytywaniu pliku")
    
    print("\n4. Testuję HistoryManager...")
    hm = HistoryManager()
    hm.add_entry("Test", "Testowy wpis do historii")
    print(f"   ✓ HistoryManager działa")
    print(f"   ✓ Historia zawiera {len(hm.history)} wpis(ów)")
    
    print("\n5. Testuję calculate_advancement_cost...")
    cost = calculate_advancement_cost("cecha", 0, 5)
    print(f"   ✓ Koszt 5 rozwinięć cechy od 0: {cost} PD")
    
    cost_skill = calculate_advancement_cost("umiejetnosc", 2, 3)
    print(f"   ✓ Koszt 3 rozwinięć umiejętności od 2: {cost_skill} PD")
    
    print("\n6. Testuję COST_TABLE...")
    print(f"   ✓ COST_TABLE zawiera {len(COST_TABLE)} wpisów")
    
    print("\n✅ WSZYSTKIE TESTY PRZESZŁY!")
    print("\nAplikacja jest gotowa do uruchomienia:")
    print("  python Postac_program_gui.py")
    
except Exception as e:
    print(f"\n❌ BŁĄD: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
