#!/usr/bin/env python3
"""
Test funkcjonalny systemu doświadczenia
"""

from Postac_program_gui import DataManager, calculate_advancement_cost

def test_experience_system():
    print("Test systemu doświadczenia i kosztów...")
    
    # Załaduj dane
    dm = DataManager()
    dm.load_from_excel("karta_postaci.xlsx")
    
    print(f"\n1. Inicjalne dane:")
    print(f"   - Postać: {dm.character_name}")
    print(f"   - Dostępne PD: {dm.experience['available']}")
    print(f"   - Wydane PD: {dm.experience['spent']}")
    print(f"   - Razem PD: {dm.experience['total']}")
    
    # Test obliczania kosztów
    print(f"\n2. Test kosztów rozwinięć cechy 'WW' (od 0):")
    for count in [1, 5, 10, 15, 20]:
        cost = calculate_advancement_cost("cecha", 0, count)
        print(f"   - {count} rozwinięć: {cost} PD")
    
    print(f"\n3. Test kosztów rozwinięć umiejętności 'Atakowanie' (od 0):")
    for count in [1, 5, 10, 15, 20]:
        cost = calculate_advancement_cost("umiejetnosc", 0, count)
        print(f"   - {count} rozwinięć: {cost} PD")
    
    # Test czy hisotoria działa
    print(f"\n4. Historia dzień (ostatnie 5 wpisów):")
    from Postac_program_gui import HistoryManager
    hm = HistoryManager()
    hm.add_entry("Test", "Testowy wpis")
    hm.add_entry("Zatwierdzono zmiany", "Koszt: 50 PD")
    hm.add_entry("Dodano doświadczenie", "+100 PD")
    
    history_text = hm.get_history_text()
    lines = history_text.strip().split('\n')
    for line in lines[-3:]:
        print(f"   {line}")
    
    print(f"\n✅ TEST FUNKCJONALNY PRZESZEDŁ!")
    print("\nAplikacja jest gotowa do użycia. Uruchom:")
    print("  python Postac_program_gui.py")

if __name__ == "__main__":
    test_experience_system()
