#!/usr/bin/env python3
"""
Test inicjalizacji aplikacji CharacterSheetApp
"""

import os
import sys

# Ukryj GUI - nie będziemy wyświetlać okna
os.environ['DISPLAY'] = ''

try:
    print("Testowanie inicjalizacji CharacterSheetApp...")
    
    from Postac_program_gui import CharacterSheetApp
    
    print("1. Tworzę instancję CharacterSheetApp...")
    app = CharacterSheetApp()
    print("   ✓ Instancja utworzona pomyślnie")
    
    print("2. Sprawdzam DataManager...")
    assert app.data_manager is not None
    print("   ✓ DataManager zainicjalizowany")
    
    print("3. Sprawdzam HistoryManager...")
    assert app.history_manager is not None
    print("   ✓ HistoryManager zainicjalizowany")
    
    print("4. Sprawdzam pending_changes...")
    assert app.pending_changes is not None
    assert "attribute_changes" in app.pending_changes
    print("   ✓ Pending changes zainicjalizowany")
    
    print("5. Sprawdzam atrybuty GUI...")
    assert hasattr(app, 'notebook')
    assert hasattr(app, 'top_frame')
    assert hasattr(app, 'char_name_label')
    assert hasattr(app, 'exp_label')
    print("   ✓ Atrybuty GUI zainicjalizowane")
    
    print("6. Sprawdzam widgety w zakładkach...")
    assert hasattr(app, 'attributes_frame')
    assert hasattr(app, 'skills_frame')
    assert hasattr(app, 'skill_name_entry')
    assert hasattr(app, 'skill_attr_combo')

    assert hasattr(app, 'skill_advanced_spinbox')
    assert hasattr(app, 'exp_entry')
    assert hasattr(app, 'exp_add_entry')
    assert hasattr(app, 'history_text')
    print("   ✓ Wszystkie widgety GUI utworzone")
    
    print("\n✅ WSZYSTKIE TESTY INICJALIZACJI PRZESZŁY!")
    print("\nAplikacja jest gotowa do użycia.")
    
except Exception as e:
    print(f"\n❌ BŁĄD: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
