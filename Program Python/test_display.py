#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Test wyświetlania cech i umiejętności po załadowaniu pliku."""

import customtkinter as ctk
from pathlib import Path
from Postac_program_gui import CharacterSheetApp


def test_display():
    """Testuje wyświetlanie cech i umiejętności."""
    print("Testowanie wyswietlania danych...\n")
    
    try:
        app = CharacterSheetApp()
        app.withdraw()  # Ukryj główne okno
        
        # 1. Sprawdzam initial state
        print(f"1. Initial state:")
        print(f"   - initialized_attrs: {app.initialized_attrs}")
        print(f"   - initialized_skills: {app.initialized_skills}")
        print(f"   - attribute_rows: {len(app.attribute_rows)}")
        print(f"   - skill_rows: {len(app.skill_rows)}")
        
        # 2. Ładuję plik Excel
        excel_path = Path("d:/RPG/Programy/Program_postac_GUI/karta_postaci.xlsx")
        if not excel_path.exists():
            print(f"\n[BLAD] Brak pliku: {excel_path}")
            return
        
        print(f"\n2. Ładuję plik Excel: {excel_path}")
        if not app.data_manager.load_from_excel(str(excel_path)):
            print(f"   [BLAD] Nie można wczytać pliku Excel")
            return
        
        print(f"   [OK] Plik załadowany")
        print(f"   - Cechy: {len(app.data_manager.attributes)}")
        print(f"   - Umiejętności: {len(app.data_manager.skills)}")
        print(f"   - Doświadczenie: {app.data_manager.experience['available']} PD dostępne")
        
        # 3. Reinicjalizuję display (jak w on_load_character)
        print(f"\n3. Reinicjalizuję display...")
        app.initialized_attrs = False
        app.initialized_skills = False
        app.initialize_attributes_display()
        app.initialize_skills_display()
        
        print(f"   [OK] Display reinicjalizowany")
        print(f"   - attribute_rows: {len(app.attribute_rows)}")
        print(f"   - skill_rows: {len(app.skill_rows)}")
        
        # 4. Sprawdzam czy wszystkie cechy się wyświetliły
        print(f"\n4. Sprawdzanie cech:")
        expected_attrs = set(app.data_manager.attributes.keys())
        actual_attrs = set(app.attribute_rows.keys())
        
        if expected_attrs == actual_attrs:
            print(f"   [OK] Wszystkie {len(expected_attrs)} cech wyswietlone")
        else:
            print(f"   [BLAD] Blad wyswietlania cech!")
            print(f"   Oczekiwane: {expected_attrs}")
            print(f"   Rzeczywiste: {actual_attrs}")
            missing = expected_attrs - actual_attrs
            extra = actual_attrs - expected_attrs
            if missing:
                print(f"   Brakujace: {missing}")
            if extra:
                print(f"   Dodatkowe: {extra}")
        
        # 5. Sprawdzam czy wszystkie umiejętności się wyświetliły
        print(f"\n5. Sprawdzanie umiejetnosci:")
        expected_skills = set(app.data_manager.skills.keys())
        actual_skills = set(app.skill_rows.keys())
        
        if expected_skills == actual_skills:
            print(f"   [OK] Wszystkie {len(expected_skills)} umiejetnosci wyswietlone")
        else:
            print(f"   [BLAD] Blad wyswietlania umiejetnosci!")
            print(f"   Oczekiwane: {len(expected_skills)}")
            print(f"   Rzeczywiste: {len(actual_skills)}")
            missing = expected_skills - actual_skills
            extra = actual_skills - expected_skills
            if missing:
                print(f"   Brakujace ({len(missing)}): {missing}")
            if extra:
                print(f"   Dodatkowe ({len(extra)}): {extra}")
        
        # 6. Test dodania umiejętności (bez GUI messageboxes)
        print(f"\n6. Test dodania umiejetnosci (bez GUI):")
        initial_count = len(app.skill_rows)
        
        # Dodaj umiejętność bezpośrednio do data_manager (bez GUI)
        test_skill_name = "Test Umiejetnosc"
        app.data_manager.add_skill(test_skill_name, "WW", 35, 1)
        app.data_manager.skills[test_skill_name]["base_advanced"] = -1  # Oznacz jako dodana
        
        # Reinicjalizuj display bez messageboxes
        app.initialized_skills = False
        app.initialize_skills_display()
        
        after_add = len(app.skill_rows)
        print(f"   - Przed: {initial_count}")
        print(f"   - Po dodaniu: {after_add}")
        
        if after_add == initial_count + 1:
            print(f"   [OK] Umiejetnosc dodana poprawnie")
        else:
            print(f"   [BLAD] Blad dodania umiejetnosci")
        
        # 7. Test usunięcia umiejętności
        print(f"\n7. Test usuniecia umiejetnosci:")
        if test_skill_name in app.data_manager.skills:
            # Usuń bezpośrednio z data_manager (bez messageboxes)
            del app.data_manager.skills[test_skill_name]
            if test_skill_name in app.skill_rows:
                app.skill_rows[test_skill_name]["row"].destroy()
                del app.skill_rows[test_skill_name]
            
            after_delete = len(app.skill_rows)
            print(f"   - Po usunieniu: {after_delete}")
            
            if after_delete == initial_count:
                print(f"   [OK] Umiejetnosc usunieta poprawnie")
            else:
                print(f"   [BLAD] Blad usuniecia umiejetnosci")
        
        # 8. Podsumowanie
        print(f"\n{'='*50}")
        print(f"[OK] TESTY WYSWIETLANIA ZAKONCZONE")
        print(f"   - attribute_rows: {len(app.attribute_rows)}")
        print(f"   - skill_rows: {len(app.skill_rows)}")
        
    except Exception as e:
        print(f"\n[BLAD] Blad: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        app.destroy()


if __name__ == "__main__":
    test_display()
