"""
Warhammer Fantasy Roleplay 4ed - Symulator Karty Postaci
Program do zarządzania postacią RPG z obsługą cech, umiejętności i talentów.
"""

import customtkinter as ctk
import openpyxl
import json
import os
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox

# ============================================================================
# CONSTANTS
# ============================================================================

COST_TABLE = {
    5: (25, 10),
    10: (30, 15),
    15: (40, 20),
    20: (50, 30),
    25: (70, 40),
    30: (90, 60),
    35: (120, 80),
    40: (150, 110),
    45: (190, 140),
    50: (230, 180),
    55: (280, 220),
    60: (330, 270),
    65: (390, 320),
    70: (450, 380),
    float("inf"): (520, 440),
}

ATTRIBUTES = ["WW", "US", "S", "Wt", "I", "Zw", "Zr", "Int", "SW", "Ogd"]
EXCEL_CHAR_COL_START = 2  # Kolumna B
EXCEL_ATTR_NAME_ROW = 11
EXCEL_ATTR_INITIAL_ROW = 12
EXCEL_ATTR_ADVANCED_ROW = 13
EXCEL_ATTR_CURRENT_ROW = 14
EXCEL_SKILL_ROWS = range(18, 31)
EXCEL_SKILL_BLOCKS = 3
EXCEL_SKILLS_PER_BLOCK = len(EXCEL_SKILL_ROWS)
EXCEL_EXP_COL = "P"  # Aktualne PD
EXCEL_SPENT_COL = "Q"  # Wydane PD
EXCEL_TOTAL_COL = "R"  # Suma PD

# Kolory do customtkinter
COLOR_BG = "#1a1a1a"
COLOR_FG_LIGHT = "#e0e0e0"
COLOR_ACCENT = "#0084d1"
COLOR_SUCCESS = "#26b552"
COLOR_ERROR = "#d1214e"
COLOR_WARNING = "#ff9500"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_advancement_cost(
    advancement_type: str, current_advancements: int, desired_advancements: int
) -> int:
    """Oblicza całkowity koszt PD dla rozwinięć."""
    total_cost = 0
    remaining = desired_advancements
    current_threshold = current_advancements

    while remaining > 0:
        for threshold in sorted(COST_TABLE.keys()):
            if current_threshold < threshold:
                char_cost, skill_cost = COST_TABLE[threshold]
                to_threshold = min(remaining, threshold - current_threshold)
                
                if advancement_type == "cecha":
                    total_cost += char_cost * to_threshold
                elif advancement_type == "umiejetnosc":
                    total_cost += skill_cost * to_threshold
                elif advancement_type == "talent":
                    # Koszt talentu: 100 * poziom
                    total_cost = desired_advancements * 100
                    return total_cost

                remaining -= to_threshold
                current_threshold += to_threshold
                if remaining == 0:
                    break
    
    return total_cost


# ============================================================================
# DATA MANAGEMENT
# ============================================================================

class DataManager:
    """Zarządza ładowaniem i zapisywaniem danych postaci."""

    def __init__(self):
        self.file_path: Optional[str] = None
        self.attributes: Dict = {}
        self.skills: Dict = {}
        self.talents: Dict = {}
        self.experience: Dict = {"available": 0, "spent": 0, "total": 0}
        self.character_name: str = "Nowa Postać"

    def load_from_excel(self, file_path: str) -> bool:
        """Ładuje dane z pliku Excel. Zwraca True jeśli sukces."""
        try:
            self.file_path = file_path
            wb = openpyxl.load_workbook(file_path, data_only=True)
            ws = wb.active

            # Odczyt charakteru postaci
            self.character_name = ws.cell(5, 2).value or "Brak Imienia"

            # Odczyt cech
            self.attributes = {}
            for col_idx, attr_name in enumerate(ATTRIBUTES, start=EXCEL_CHAR_COL_START):
                cell_name = ws.cell(EXCEL_ATTR_NAME_ROW, col_idx).value
                if not cell_name:
                    continue

                initial = ws.cell(EXCEL_ATTR_INITIAL_ROW, col_idx).value or 0
                advanced = ws.cell(EXCEL_ATTR_ADVANCED_ROW, col_idx).value or 0
                current = ws.cell(EXCEL_ATTR_CURRENT_ROW, col_idx).value or (initial + advanced)

                self.attributes[attr_name] = {
                    "initial": int(initial),
                    "advanced": int(advanced),
                    "current": int(current),
                    "base_advanced": int(advanced),  # Do resetu
                    "is_new": False,
                }

            # Odczyt umiejętności
            self.skills = {}
            for block in range(EXCEL_SKILL_BLOCKS):
                col_offset = block * 5
                for row in EXCEL_SKILL_ROWS:
                    skill_name = ws.cell(row, 1 + col_offset).value
                    if not skill_name:
                        continue

                    attribute = ws.cell(row, 2 + col_offset).value or ""
                    initial = ws.cell(row, 3 + col_offset).value or 0
                    advanced = ws.cell(row, 4 + col_offset).value or 0
                    current = ws.cell(row, 5 + col_offset).value or (initial + advanced)

                    self.skills[skill_name] = {
                        "attribute": str(attribute).strip("()"),
                        "initial": int(initial),
                        "advanced": int(advanced),
                        "current": int(current),
                        "base_advanced": int(advanced),
                        "is_new": False,
                    }

            # Odczyt doświadczenia
            self.experience["available"] = ws[f"{EXCEL_EXP_COL}11"].value or 0
            self.experience["spent"] = ws[f"{EXCEL_SPENT_COL}11"].value or 0
            self.experience["total"] = (
                self.experience["available"] + self.experience["spent"]
            )

            wb.close()
            return True

        except Exception as e:
            print(f"Błąd przy ładowaniu pliku: {e}")
            return False

    def save_to_excel(self, file_path: str = None) -> bool:
        """Zapisuje dane do Excel. Zwraca True jeśli sukces."""
        if not file_path and not self.file_path:
            return False

        file_path = file_path or self.file_path

        try:
            wb = openpyxl.load_workbook(file_path)
            ws = wb.active

            if len(self.skills) > EXCEL_SKILL_BLOCKS * EXCEL_SKILLS_PER_BLOCK:
                raise ValueError(
                    "Za dużo umiejętności, aby zapisać je do aktualnego układu Excela."
                )

            ws.cell(5, 2, self.character_name)

            # Zapis cech
            for col_idx, attr_name in enumerate(ATTRIBUTES, start=EXCEL_CHAR_COL_START):
                if attr_name in self.attributes:
                    attr_data = self.attributes[attr_name]
                    ws.cell(EXCEL_ATTR_INITIAL_ROW, col_idx, attr_data["initial"])
                    ws.cell(EXCEL_ATTR_ADVANCED_ROW, col_idx, attr_data["advanced"])
                    ws.cell(
                        EXCEL_ATTR_CURRENT_ROW,
                        col_idx,
                        attr_data["initial"] + attr_data["advanced"],
                    )

            # Wyczyść wszystkie sloty umiejętności przed zapisem
            for block in range(EXCEL_SKILL_BLOCKS):
                col_offset = block * 5
                for row_idx in EXCEL_SKILL_ROWS:
                    for column_offset in range(5):
                        ws.cell(row_idx, 1 + col_offset + column_offset, None)

            # Zapis umiejętności
            for skill_index, (skill_name, skill_data) in enumerate(self.skills.items()):
                block = skill_index // EXCEL_SKILLS_PER_BLOCK
                row_offset = skill_index % EXCEL_SKILLS_PER_BLOCK
                col_offset = block * 5
                row_idx = EXCEL_SKILL_ROWS.start + row_offset

                ws.cell(row_idx, 1 + col_offset, skill_name)
                ws.cell(row_idx, 2 + col_offset, f"({skill_data['attribute']})")
                ws.cell(row_idx, 3 + col_offset, skill_data["initial"])
                ws.cell(row_idx, 4 + col_offset, skill_data["advanced"])
                ws.cell(
                    row_idx,
                    5 + col_offset,
                    skill_data["initial"] + skill_data["advanced"],
                )

            # Zapis doświadczenia
            ws[f"{EXCEL_EXP_COL}11"] = self.experience["available"]
            ws[f"{EXCEL_SPENT_COL}11"] = self.experience["spent"]
            ws[f"{EXCEL_TOTAL_COL}11"] = self.experience["total"]

            wb.save(file_path)
            wb.close()
            return True

        except Exception as e:
            print(f"Błąd przy zapisie pliku: {e}")
            return False

    def add_skill(
        self,
        skill_name: str,
        attribute: str,
        initial: int = 0,
        advanced: int = 0,
        is_new: bool = False,
    ) -> bool:
        """Dodaje nową umiejętność."""
        if skill_name in self.skills:
            return False

        self.skills[skill_name] = {
            "attribute": attribute,
            "initial": initial,
            "advanced": advanced,
            "current": initial + advanced,
            "base_advanced": advanced,
            "is_new": is_new,
        }
        return True

    def reset_character(self) -> None:
        """Resetuje postać do wartości z pliku."""
        for attr in self.attributes.values():
            attr["advanced"] = attr["base_advanced"]

        for skill in self.skills.values():
            skill["advanced"] = skill["base_advanced"]

    def create_new_character(self, name: str = "Nowa Postać") -> None:
        """Tworzy nową postać z wartościami domyślnymi."""
        self.character_name = name
        self.file_path = None
        self.attributes = {
            attr: {
                "initial": 30,
                "advanced": 0,
                "current": 30,
                "base_advanced": 0,
                "is_new": False,
            }
            for attr in ATTRIBUTES
        }
        self.skills = {}
        self.experience = {"available": 0, "spent": 0, "total": 0}
        self.talents = {}



# ============================================================================
# HISTORY MANAGEMENT
# ============================================================================

class HistoryManager:
    """Zarządza historią działań w formacie JSON."""

    def __init__(self, json_file: str = "history.json"):
        self.json_file = json_file
        self.history: List[Dict] = []
        self.load_history()

    def load_history(self) -> None:
        """Ładuje historię z pliku JSON."""
        try:
            if os.path.exists(self.json_file):
                with open(self.json_file, "r", encoding="utf-8") as f:
                    self.history = json.load(f)
        except Exception as e:
            print(f"Błąd przy ładowaniu historii: {e}")
            self.history = []

    def save_history(self) -> None:
        """Zapisuje historię do pliku JSON."""
        try:
            with open(self.json_file, "w", encoding="utf-8") as f:
                json.dump(self.history, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Błąd przy zapisie historii: {e}")

    def add_entry(self, action: str, details: str = "") -> None:
        """Dodaje wpis do historii."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details,
        }
        self.history.append(entry)
        self.save_history()

    def get_history_text(self) -> str:
        """Zwraca historię jako sformatowany tekst."""
        text = ""
        for entry in self.history[-50:]:  # Ostatnie 50 wpisów
            timestamp = entry.get("timestamp", "")
            action = entry.get("action", "")
            details = entry.get("details", "")
            text += f"[{timestamp}] {action}"
            if details:
                text += f" - {details}"
            text += "\n"
        return text


# ============================================================================
# GUI - MAIN APPLICATION
# ============================================================================

class CharacterSheetApp(ctk.CTk):
    """Główna aplikacja GUI."""

    def __init__(self):
        super().__init__()

        self.title("Warhammer Fantasy Roleplay 4ed - Karta Postaci")
        self.geometry("1400x900")

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.data_manager = DataManager()
        self.history_manager = HistoryManager()

        self.pending_changes: Dict = self._create_empty_pending_changes()
        
        # Cache widgetów do szybkiego updatu bez destroy/recreate
        self.attribute_rows: Dict = {}  # {attr_name: {"row": Frame, "labels": [...], "buttons": [...]}}
        self.skill_rows: Dict = {}      # {skill_name: {"row": Frame, "labels": [...], "buttons": [...]}}
        self.initialized_attrs = False
        self.initialized_skills = False

        self.setup_ui()

    def _create_empty_pending_changes(self) -> Dict:
        """Tworzy nowy kontener oczekujących zmian."""
        return {
            "attribute_changes": {},
            "skill_changes": {},
            "talent_changes": {},
            "new_skills": set(),
        }

    def has_pending_changes(self) -> bool:
        """Sprawdza, czy istnieją niezakończone zmiany."""
        return any(bool(value) for value in self.pending_changes.values())

    def setup_ui(self) -> None:
        """Konfiguruje interfejs użytkownika."""
        # Górny pasek z informacjami
        self.top_frame = ctk.CTkFrame(self)
        self.top_frame.pack(side="top", fill="x", padx=10, pady=10)

        ctk.CTkLabel(
            self.top_frame, text="Imię postaci:", font=("Arial", 15, "bold")
        ).pack(side="left", padx=5)

        self.char_name_label = ctk.CTkLabel(
            self.top_frame, text="Nowa Postać", font=("Arial", 15)
        )
        self.char_name_label.pack(side="left", padx=5)

        ctk.CTkLabel(
            self.top_frame, text="Doświadczenie (PD):", font=("Arial", 15, "bold")
        ).pack(side="left", padx=(20, 5))

        self.exp_label = ctk.CTkLabel(
            self.top_frame, text="0/0", font=("Arial", 15, "bold"), text_color=COLOR_ACCENT
        )
        self.exp_label.pack(side="left", padx=5)

        # Przyciski górne
        button_frame = ctk.CTkFrame(self.top_frame)
        button_frame.pack(side="right", padx=5)

        ctk.CTkButton(
            button_frame, text="Wczytaj", command=self.on_load_character, width=100
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            button_frame, text="Nowa", command=self.on_new_character, width=100
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            button_frame, text="Zapisz", command=self.on_save_character, width=100
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            button_frame, text="Zatwierdź Zmiany", command=self.on_confirm_changes,
            width=130, fg_color=COLOR_SUCCESS
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            button_frame, text="Cofnij Zmiany", command=self.on_revert_changes,
            width=130, fg_color=COLOR_ERROR
        ).pack(side="left", padx=2)

        # Notebook z zakładkami
        self.notebook = ctk.CTkTabview(self)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=10)

        self.create_character_tab()
        self.create_skills_tab()
        self.create_talents_tab()
        self.create_costs_tab()
        self.create_add_skill_tab()
        self.create_experience_tab()
        self.create_history_tab()

    def create_character_tab(self) -> None:
        """Zakładka: Cechy postaci."""
        tab = self.notebook.add("Cechy")

        # Nagłówek
        header = ctk.CTkFrame(tab)
        header.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(header, text="CECHY", font=("Arial", 14, "bold")).pack(
            side="left"
        )

        # Ramka dla cech
        self.attributes_frame = ctk.CTkScrollableFrame(tab)
        self.attributes_frame.pack(fill="both", expand=True, padx=10, pady=5)

    def create_skills_tab(self) -> None:
        """Zakładka: Umiejętności."""
        tab = self.notebook.add("Umiejętności")

        # Nagłówek
        header = ctk.CTkFrame(tab)
        header.pack(fill="x", padx=10, pady=10)

        ctk.CTkLabel(
            header, text="UMIEJĘTNOŚCI", font=("Arial", 14, "bold")
        ).pack(side="left")

        # Ramka dla umiejętności
        self.skills_frame = ctk.CTkScrollableFrame(tab)
        self.skills_frame.pack(fill="both", expand=True, padx=10, pady=5)

    def create_talents_tab(self) -> None:
        """Zakładka: Talenty (przygotowana na przyszłość)."""
        tab = self.notebook.add("Talenty")

        ctk.CTkLabel(
            tab,
            text="Talenty - Funkcjonalność dostępna po dodaniu tabelki w Excel",
            font=("Arial", 12),
        ).pack(pady=20)

    def create_costs_tab(self) -> None:
        """Zakładka: Tabela kosztów rozwinięć."""
        tab = self.notebook.add("Koszty Rozwinięć")

        calculator_frame = ctk.CTkFrame(tab)
        calculator_frame.pack(fill="x", padx=10, pady=(10, 5))

        ctk.CTkLabel(
            calculator_frame,
            text="KALKULATOR DOWOLNYCH ROZWINIĘĆ",
            font=("Arial", 14, "bold"),
            text_color=COLOR_ACCENT,
        ).pack(anchor="w", padx=12, pady=(10, 6))

        ctk.CTkLabel(
            calculator_frame,
            text="Wybierz cechę albo umiejętność i wpisz liczbę rozwinięć. Koszt aktualizuje się na żywo.",
            font=("Arial", 12),
        ).pack(anchor="w", padx=12, pady=(0, 8))

        calculator_inputs = ctk.CTkFrame(calculator_frame)
        calculator_inputs.pack(fill="x", padx=12, pady=(0, 10))

        ctk.CTkLabel(calculator_inputs, text="Cecha / Umiejętność:").pack(
            side="left", padx=(8, 6), pady=8
        )
        self.cost_combo = ctk.CTkComboBox(
            calculator_inputs,
            values=[],
            width=260,
            command=lambda _choice: self.on_calculate_cost(),
        )
        self.cost_combo.pack(side="left", padx=(0, 10), pady=8)

        ctk.CTkLabel(calculator_inputs, text="Liczba rozwinięć:").pack(
            side="left", padx=(8, 6), pady=8
        )
        self.cost_spinbox = ctk.CTkEntry(calculator_inputs, width=120)
        self.cost_spinbox.insert(0, "1")
        self.cost_spinbox.pack(side="left", padx=(0, 10), pady=8)
        self.cost_spinbox.bind("<KeyRelease>", lambda _event: self.on_calculate_cost())

        calculator_status = ctk.CTkFrame(calculator_frame)
        calculator_status.pack(fill="x", padx=12, pady=(0, 12))

        self.cost_type_label = ctk.CTkLabel(calculator_status, text="Typ: -")
        self.cost_type_label.pack(side="left", padx=(8, 12), pady=8)

        self.cost_current_label = ctk.CTkLabel(
            calculator_status, text="Aktualne rozwinięcia: -"
        )
        self.cost_current_label.pack(side="left", padx=(0, 12), pady=8)

        self.cost_result_label = ctk.CTkLabel(
            calculator_status,
            text="Koszt: -",
            font=("Arial", 13, "bold"),
            text_color=COLOR_SUCCESS,
        )
        self.cost_result_label.pack(side="right", padx=(12, 8), pady=8)

        # Tytuł
        title = ctk.CTkLabel(
            tab,
            text="TABELA KOSZTÓW ROZWINIĘĆ",
            font=("Arial", 14, "bold"),
            text_color=COLOR_ACCENT,
        )
        title.pack(pady=10)

        # Rama z tabelą kosztów (będzie się odświeżać)
        self.costs_frame = ctk.CTkScrollableFrame(tab)
        self.costs_frame.pack(fill="both", expand=True, padx=10, pady=5)

        self.refresh_cost_options()

    def refresh_cost_options(self) -> None:
        """Odświeża listę pozycji dostępnych w kalkulatorze kosztów."""
        options = list(self.data_manager.attributes.keys()) + sorted(
            self.data_manager.skills.keys(),
            key=str.casefold,
        )

        self.cost_combo.configure(values=options or [""])

        current_selection = self.cost_combo.get().strip()
        if current_selection not in options:
            self.cost_combo.set(options[0] if options else "")

        self.on_calculate_cost()

    def get_cost_preview(self, selection: str, advancements: int) -> Optional[Dict[str, int | str]]:
        """Zwraca dane do podglądu kosztu dla wybranej cechy lub umiejętności."""
        if advancements <= 0:
            return None

        if selection in self.data_manager.attributes:
            current_adv = self.data_manager.attributes[selection]["advanced"]
            return {
                "type": "Cecha",
                "current_adv": current_adv,
                "cost": calculate_advancement_cost("cecha", current_adv, advancements),
            }

        if selection in self.data_manager.skills:
            current_adv = self.data_manager.skills[selection]["advanced"]
            return {
                "type": "Umiejętność",
                "current_adv": current_adv,
                "cost": calculate_advancement_cost(
                    "umiejetnosc", current_adv, advancements
                ),
            }

        return None

    def refresh_costs_display(self) -> None:
        """Odświeża tabelę kosztów."""
        self.refresh_cost_options()

        # Wyczyść ramkę
        for widget in self.costs_frame.winfo_children():
            widget.destroy()

        # Nagłówek tabeli
        header = ctk.CTkFrame(self.costs_frame)
        header.pack(fill="x", pady=5)
        ctk.CTkLabel(header, text="Cecha/Umiejętność", font=("Arial", 14, "bold"), width=180).pack(side="left", padx=2)
        ctk.CTkLabel(header, text="5 rozw.", font=("Arial", 14, "bold"), width=80).pack(side="left", padx=2)
        ctk.CTkLabel(header, text="10 rozw.", font=("Arial", 14, "bold"), width=80).pack(side="left", padx=2)
        ctk.CTkLabel(header, text="15 rozw.", font=("Arial", 14, "bold"), width=80).pack(side="left", padx=2)
        ctk.CTkLabel(header, text="20 rozw.", font=("Arial", 14, "bold"), width=80).pack(side="left", padx=2)

        # Koszty dla cech
        ctk.CTkLabel(self.costs_frame, text="─ CECHY ─", font=("Arial", 13, "bold"), text_color=COLOR_SUCCESS).pack(anchor="w", padx=5, pady=5)

        for attr_name in self.data_manager.attributes.keys():
            row = ctk.CTkFrame(self.costs_frame)
            row.pack(fill="x", pady=2)
            ctk.CTkLabel(row, text=attr_name, font=("Arial", 13), width=180).pack(side="left", padx=2)

            current_adv = self.data_manager.attributes[attr_name]["advanced"]

            for num_adv in [5, 10, 15, 20]:
                cost = calculate_advancement_cost("cecha", current_adv, num_adv)
                ctk.CTkLabel(row, text=str(cost), width=80, text_color=COLOR_ACCENT).pack(side="left", padx=2)

        # Koszty dla umiejętności
        ctk.CTkLabel(self.costs_frame, text="─ UMIEJĘTNOŚCI ─", font=("Arial", 13, "bold"), text_color=COLOR_SUCCESS).pack(anchor="w", padx=5, pady=(10, 5))

        for skill_name in self.data_manager.skills.keys():
            row = ctk.CTkFrame(self.costs_frame)
            row.pack(fill="x", pady=2)
            ctk.CTkLabel(row, text=skill_name, font=("Arial", 13), width=180).pack(side="left", padx=2)

            current_adv = self.data_manager.skills[skill_name]["advanced"]

            for num_adv in [5, 10, 15, 20]:
                cost = calculate_advancement_cost("umiejetnosc", current_adv, num_adv)
                ctk.CTkLabel(row, text=str(cost), width=80, text_color=COLOR_ACCENT).pack(side="left", padx=2)

    def create_add_skill_tab(self) -> None:
        """Zakładka: Dodaj umiejętność."""
        tab = self.notebook.add("Dodaj Umiejętność")

        frame = ctk.CTkFrame(tab)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        ctk.CTkLabel(frame, text="Dodaj nową umiejętność", font=("Arial", 17, "bold")).pack(pady=10)

        # Nazwa umiejętności
        ctk.CTkLabel(frame, text="Nazwa umiejętności:").pack(anchor="w", pady=(10, 0))
        self.skill_name_entry = ctk.CTkEntry(frame, placeholder_text="np. Atakowanie mieczem")
        self.skill_name_entry.pack(fill="x", pady=5)

        # Wybór atrybutu
        ctk.CTkLabel(frame, text="Atrybut:").pack(anchor="w", pady=(10, 0))
        self.skill_attr_combo = ctk.CTkComboBox(
            frame, values=ATTRIBUTES
        )
        self.skill_attr_combo.pack(fill="x", pady=5)

        # Rozwinięcia
        ctk.CTkLabel(frame, text="Rozwinięcia:").pack(anchor="w", pady=(10, 0))
        self.skill_advanced_spinbox = ctk.CTkEntry(frame, placeholder_text="0", width=100)
        self.skill_advanced_spinbox.insert(0, "0")
        self.skill_advanced_spinbox.pack(fill="x", pady=5)

        # Przycisk
        ctk.CTkButton(
            frame, text="Dodaj Umiejętność", command=self.on_add_skill,
            fg_color=COLOR_SUCCESS, height=40
        ).pack(fill="x", pady=20)

        # Info
        info = ctk.CTkLabel(
            frame,
            text="Nowa umiejętność zostanie dodana do postaci.\nWartość początkowa będzie równa wartości przypisanej cechy.",
            text_color="#888888"
        )
        info.pack(pady=10)

    def create_experience_tab(self) -> None:
        """Zakładka: Zarządzanie doświadczeniem."""
        tab = self.notebook.add("Doświadczenie")

        frame = ctk.CTkFrame(tab)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        ctk.CTkLabel(frame, text="Zarządzanie doświadczeniem", font=("Arial", 14, "bold")).pack(pady=10)

        # Aktualne doświadczenie
        ctk.CTkLabel(frame, text="Dostępne PD:", font=("Arial", 12)).pack(anchor="w", pady=(10, 0))
        self.exp_entry = ctk.CTkEntry(frame)
        self.exp_entry.pack(fill="x", pady=5)

        # Dodaj doświadczenie
        ctk.CTkLabel(frame, text="Dodaj doświadczenie:").pack(anchor="w", pady=(10, 0))
        add_frame = ctk.CTkFrame(frame)
        add_frame.pack(fill="x", pady=5)

        self.exp_add_entry = ctk.CTkEntry(add_frame, placeholder_text="Ilość PD")
        self.exp_add_entry.pack(side="left", fill="x", expand=True, padx=(0, 5))

        ctk.CTkButton(
            add_frame, text="Dodaj", command=self.on_add_experience, width=100
        ).pack(side="left")

        # Przyciski szybkie
        quick_frame = ctk.CTkFrame(frame)
        quick_frame.pack(fill="x", pady=10)

        for amount in [10, 25, 50, 100]:
            ctk.CTkButton(
                quick_frame, text=f"+{amount}", width=80,
                command=lambda a=amount: self.on_quick_experience(a)
            ).pack(side="left", padx=2)

    def create_history_tab(self) -> None:
        """Zakładka: Historia działań."""
        tab = self.notebook.add("Historia")

        self.history_text = ctk.CTkTextbox(tab)
        self.history_text.pack(fill="both", expand=True, padx=10, pady=10)
        self.history_text.configure(state="disabled")

    # ========================================================================
    # EVENT HANDLERS
    # ========================================================================

    def initialize_attributes_display(self) -> None:
        """Tworzy wiersze cech jeden raz (bez destroy). Wywoływane przy ładowaniu danych."""
        if self.initialized_attrs:
            self._update_all_attribute_labels()
            return
            
        # Wyczyść starą cache jeśli jest
        for widget in self.attributes_frame.winfo_children():
            widget.destroy()
        self.attribute_rows.clear()

        for attr_name, attr_data in self.data_manager.attributes.items():
            self._create_attribute_row_cached(attr_name, attr_data)

        self.initialized_attrs = True

    def _create_attribute_row_cached(self, attr_name: str, attr_data: Dict) -> None:
        """Tworzy wiersz cechy i przechowuje referencje do widgetów."""
        row = ctk.CTkFrame(self.attributes_frame)
        row.pack(fill="x", pady=5, padx=10)

        labels = []
        buttons = []

        # Nazwa cechy
        lbl_name = ctk.CTkLabel(
            row, text=attr_name, font=("Arial", 11, "bold"), width=60
        )
        lbl_name.pack(side="left", padx=5)
        labels.append(("name", lbl_name))

        # Wartość początkowa
        lbl_initial = ctk.CTkLabel(
            row, text=f"Pocz: {attr_data['initial']}", width=60
        )
        lbl_initial.pack(side="left", padx=2)
        labels.append(("initial", lbl_initial))

        # Rozwinięcia
        current_adv = attr_data["advanced"]
        lbl_adv = ctk.CTkLabel(
            row, text=f"Rozw: {current_adv}", width=60, text_color=COLOR_ACCENT
        )
        lbl_adv.pack(side="left", padx=2)
        labels.append(("adv", lbl_adv))

        # Bieżąca wartość
        lbl_current = ctk.CTkLabel(
            row, text=f"Wartość: {attr_data['initial'] + current_adv}", width=80
        )
        lbl_current.pack(side="left", padx=2)
        labels.append(("current", lbl_current))

        # Maksymalne rozwinięcia
        max_adv = self.get_max_advancements("cecha", attr_name)
        lbl_max = ctk.CTkLabel(
            row, text=f"Maks: {max_adv}", width=60, text_color=COLOR_WARNING
        )
        lbl_max.pack(side="left", padx=2)
        labels.append(("max", lbl_max))

        # Przyciski
        btn_plus1 = ctk.CTkButton(
            row, text="+1", width=40,
            command=lambda: self.on_increase_attribute(attr_name, 1),
            fg_color=COLOR_SUCCESS if self.can_afford_attribute(attr_name) else COLOR_ERROR
        )
        btn_plus1.pack(side="left", padx=1)
        buttons.append(("plus1", btn_plus1))

        btn_plus5 = ctk.CTkButton(
            row, text="+5", width=40,
            command=lambda: self.on_increase_attribute(attr_name, 5),
            fg_color=COLOR_SUCCESS if max_adv >= 5 else COLOR_ERROR
        )
        btn_plus5.pack(side="left", padx=1)
        buttons.append(("plus5", btn_plus5))

        btn_minus1 = ctk.CTkButton(
            row, text="-1", width=40,
            command=lambda: self.on_decrease_attribute(attr_name, 1),
            fg_color=COLOR_WARNING if current_adv > attr_data["base_advanced"] else "#555555"
        )
        btn_minus1.pack(side="left", padx=1)
        buttons.append(("minus1", btn_minus1))

        btn_minus5 = ctk.CTkButton(
            row, text="-5", width=40,
            command=lambda: self.on_decrease_attribute(attr_name, 5),
            fg_color=COLOR_WARNING if current_adv > attr_data["base_advanced"] else "#555555"
        )
        btn_minus5.pack(side="left", padx=1)
        buttons.append(("minus5", btn_minus5))

        self.attribute_rows[attr_name] = {
            "row": row,
            "labels": labels,
            "buttons": buttons,
        }

    def _update_all_attribute_labels(self) -> None:
        """Aktualizuje tylko tekst labelek bez tworzenia nowych widgetów. SZYBKIE."""
        for attr_name, attr_data in self.data_manager.attributes.items():
            if attr_name in self.attribute_rows:
                row_data = self.attribute_rows[attr_name]
                labels = dict(row_data["labels"])
                
                current_adv = attr_data["advanced"]
                max_adv = self.get_max_advancements("cecha", attr_name)
                
                # Aktualizuj wartości
                labels["adv"].configure(text=f"Rozw: {current_adv}")
                labels["current"].configure(text=f"Wartość: {attr_data['initial'] + current_adv}")
                labels["max"].configure(text=f"Maks: {max_adv}")
                
                # Aktualizuj kolory przycisków
                buttons = dict(row_data["buttons"])
                buttons["plus1"].configure(fg_color=COLOR_SUCCESS if self.can_afford_attribute(attr_name) else COLOR_ERROR)
                buttons["plus5"].configure(fg_color=COLOR_SUCCESS if max_adv >= 5 else COLOR_ERROR)
                buttons["minus1"].configure(fg_color=COLOR_WARNING if current_adv > attr_data["base_advanced"] else "#555555")
                buttons["minus5"].configure(fg_color=COLOR_WARNING if current_adv > attr_data["base_advanced"] else "#555555")

    def refresh_attributes_display(self) -> None:
        """Compatibility wrapper - teraz tylko aktualizuje, nie niszczy widgety."""
        if self.initialized_attrs:
            self._update_all_attribute_labels()
        else:
            self.initialize_attributes_display()

    def initialize_skills_display(self) -> None:
        """Tworzy wiersze umiejętności jeden raz (bez destroy). Wywoływane przy ładowaniu danych."""
        if self.initialized_skills:
            self._update_all_skill_labels()
            return
            
        # Wyczyść starą cache jeśli jest
        for widget in self.skills_frame.winfo_children():
            widget.destroy()
        self.skill_rows.clear()

        for skill_name, skill_data in self.data_manager.skills.items():
            self._create_skill_row_cached(skill_name, skill_data)

        self.initialized_skills = True

    def _create_skill_row_cached(self, skill_name: str, skill_data: Dict) -> None:
        """Tworzy wiersz umiejętności i przechowuje referencje do widgetów."""
        row = ctk.CTkFrame(self.skills_frame)
        row.pack(fill="x", pady=5, padx=10)

        labels = []
        buttons = []
        minimum_advancement = self._get_minimum_skill_advancement(skill_data)

        # Nazwa umiejętności
        lbl_name = ctk.CTkLabel(
            row, text=skill_name, font=("Arial", 11, "bold"), width=120
        )
        lbl_name.pack(side="left", padx=2)
        labels.append(("name", lbl_name))

        # Atrybut
        lbl_attr = ctk.CTkLabel(row, text=f"({skill_data['attribute']})", width=40)
        lbl_attr.pack(side="left", padx=2)
        labels.append(("attr", lbl_attr))

        # Wartość początkowa
        lbl_initial = ctk.CTkLabel(
            row, text=f"Pocz: {skill_data['initial']}", width=50
        )
        lbl_initial.pack(side="left", padx=2)
        labels.append(("initial", lbl_initial))

        # Rozwinięcia
        current_adv = skill_data["advanced"]
        lbl_adv = ctk.CTkLabel(
            row, text=f"Rozw: {current_adv}", width=50, text_color=COLOR_ACCENT
        )
        lbl_adv.pack(side="left", padx=2)
        labels.append(("adv", lbl_adv))

        # Bieżąca wartość
        lbl_current = ctk.CTkLabel(
            row, text=f"Suma: {skill_data['initial'] + current_adv}", width=50
        )
        lbl_current.pack(side="left", padx=2)
        labels.append(("current", lbl_current))

        # Maksymalne rozwinięcia
        max_adv = self.get_max_advancements("umiejetnosc", skill_name)
        lbl_max = ctk.CTkLabel(
            row, text=f"Maks: {max_adv}", width=50, text_color=COLOR_WARNING
        )
        lbl_max.pack(side="left", padx=2)
        labels.append(("max", lbl_max))

        # Przyciski
        btn_plus1 = ctk.CTkButton(
            row, text="+1", width=40,
            command=lambda: self.on_increase_skill(skill_name, 1),
            fg_color=COLOR_SUCCESS if self.can_afford_skill(skill_name) else COLOR_ERROR
        )
        btn_plus1.pack(side="left", padx=1)
        buttons.append(("plus1", btn_plus1))

        btn_plus5 = ctk.CTkButton(
            row, text="+5", width=40,
            command=lambda: self.on_increase_skill(skill_name, 5),
            fg_color=COLOR_SUCCESS if max_adv >= 5 else COLOR_ERROR
        )
        btn_plus5.pack(side="left", padx=1)
        buttons.append(("plus5", btn_plus5))

        btn_minus1 = ctk.CTkButton(
            row, text="-1", width=40,
            command=lambda: self.on_decrease_skill(skill_name, 1),
            fg_color=COLOR_WARNING if current_adv > minimum_advancement else "#555555"
        )
        btn_minus1.pack(side="left", padx=1)
        buttons.append(("minus1", btn_minus1))

        btn_minus5 = ctk.CTkButton(
            row, text="-5", width=40,
            command=lambda: self.on_decrease_skill(skill_name, 5),
            fg_color=COLOR_WARNING if current_adv > minimum_advancement else "#555555"
        )
        btn_minus5.pack(side="left", padx=1)
        buttons.append(("minus5", btn_minus5))
        
        # Przycisk usuń - tylko dla umiejętności dodanych
        if skill_data.get("is_new", False):
            btn_delete = ctk.CTkButton(
                row, text="Usuń", width=50,
                command=lambda: self.on_delete_skill(skill_name),
                fg_color=COLOR_ERROR
            )
            btn_delete.pack(side="left", padx=2)
            buttons.append(("delete", btn_delete))

        self.skill_rows[skill_name] = {
            "row": row,
            "labels": labels,
            "buttons": buttons,
        }

    def _update_all_skill_labels(self) -> None:
        """Aktualizuje tylko tekst labelek bez tworzenia nowych widgetów. SZYBKIE."""
        for skill_name, skill_data in self.data_manager.skills.items():
            if skill_name in self.skill_rows:
                row_data = self.skill_rows[skill_name]
                labels = dict(row_data["labels"])
                
                current_adv = skill_data["advanced"]
                max_adv = self.get_max_advancements("umiejetnosc", skill_name)
                minimum_advancement = self._get_minimum_skill_advancement(skill_data)
                
                # Aktualizuj wartości
                labels["adv"].configure(text=f"Rozw: {current_adv}")
                labels["current"].configure(text=f"Suma: {skill_data['initial'] + current_adv}")
                labels["max"].configure(text=f"Maks: {max_adv}")
                
                # Aktualizuj kolory przycisków
                buttons = dict(row_data["buttons"])
                buttons["plus1"].configure(fg_color=COLOR_SUCCESS if self.can_afford_skill(skill_name) else COLOR_ERROR)
                buttons["plus5"].configure(fg_color=COLOR_SUCCESS if max_adv >= 5 else COLOR_ERROR)
                buttons["minus1"].configure(fg_color=COLOR_WARNING if current_adv > minimum_advancement else "#555555")
                buttons["minus5"].configure(fg_color=COLOR_WARNING if current_adv > minimum_advancement else "#555555")

    def _get_minimum_skill_advancement(self, skill_data: Dict) -> int:
        """Zwraca minimalny dozwolony poziom rozwinięcia dla umiejętności."""
        if skill_data.get("is_new", False):
            return 0
        return skill_data["base_advanced"]

    def refresh_skills_display(self) -> None:
        """Compatibility wrapper - teraz tylko aktualizuje, nie niszczy widgety."""
        if self.initialized_skills:
            self._update_all_skill_labels()
        else:
            self.initialize_skills_display()

    def on_increase_attribute(self, attr_name: str, amount: int = 1) -> None:
        """Zwiększa rozwinięcie cechy (pokazowe, do zatwierdzenia)."""
        self._increase_advancement("cecha", attr_name, amount)

    def on_increase_skill(self, skill_name: str, amount: int = 1) -> None:
        """Zwiększa rozwinięcie umiejętności (pokazowe, do zatwierdzenia)."""
        self._increase_advancement("umiejetnosc", skill_name, amount)

    def on_decrease_attribute(self, attr_name: str, amount: int = 1) -> None:
        """Zmniejsza rozwinięcie cechy (cofanie zmian)."""
        self._decrease_advancement("cecha", attr_name, amount)

    def on_decrease_skill(self, skill_name: str, amount: int = 1) -> None:
        """Zmniejsza rozwinięcie umiejętności (cofanie zmian)."""
        self._decrease_advancement("umiejetnosc", skill_name, amount)

    def _increase_advancement(self, advancement_type: str, item_name: str, amount: int) -> None:
        """Helper do zwiększania rozwiniec."""
        if advancement_type == "cecha":
            data = self.data_manager.attributes[item_name]
            pending_key = "attribute_changes"
        else:
            data = self.data_manager.skills[item_name]
            pending_key = "skill_changes"
        
        cost = calculate_advancement_cost(advancement_type, data["advanced"], amount)

        if self.data_manager.experience["available"] < cost:
            messagebox.showerror("Za mało PD", f"Brak wystarczającego doświadczenia. Potrzebujesz {cost} PD, masz {self.data_manager.experience['available']} PD.")
            return

        if item_name not in self.pending_changes[pending_key]:
            self.pending_changes[pending_key][item_name] = 0

        self.pending_changes[pending_key][item_name] += amount
        data["advanced"] += amount
        self.data_manager.experience["available"] -= cost

        self.refresh_attributes_display() if advancement_type == "cecha" else self.refresh_skills_display()
        self.update_experience_display()
        self.refresh_costs_display()

    def _decrease_advancement(self, advancement_type: str, item_name: str, amount: int) -> None:
        """Helper do zmniejszania rozwiniec."""
        if advancement_type == "cecha":
            data = self.data_manager.attributes[item_name]
            pending_key = "attribute_changes"
            minimum_advancement = data["base_advanced"]
        else:
            data = self.data_manager.skills[item_name]
            pending_key = "skill_changes"
            minimum_advancement = self._get_minimum_skill_advancement(data)

        current_adv = data["advanced"]

        if current_adv - amount < minimum_advancement:
            messagebox.showwarning(
                "Nie można cofnąć",
                f"Nie można cofnąć poniżej wartości minimalnej ({minimum_advancement} rozw.).",
            )
            return

        refund = calculate_advancement_cost(advancement_type, current_adv - amount, amount)

        if item_name not in self.pending_changes[pending_key]:
            self.pending_changes[pending_key][item_name] = 0

        self.pending_changes[pending_key][item_name] -= amount
        data["advanced"] -= amount
        self.data_manager.experience["available"] += refund

        self.refresh_attributes_display() if advancement_type == "cecha" else self.refresh_skills_display()
        self.update_experience_display()
        self.refresh_costs_display()

    def can_afford_attribute(self, attr_name: str) -> bool:
        """Sprawdza, czy stać postać na rozwinięcie cechy."""
        current_adv = self.data_manager.attributes[attr_name]["advanced"]
        cost = calculate_advancement_cost("cecha", current_adv, 1)
        return self.data_manager.experience["available"] >= cost

    def can_afford_skill(self, skill_name: str) -> bool:
        """Sprawdza, czy stać postać na rozwinięcie umiejętności."""
        current_adv = self.data_manager.skills[skill_name]["advanced"]
        cost = calculate_advancement_cost("umiejetnosc", current_adv, 1)
        return self.data_manager.experience["available"] >= cost

    def get_max_advancements(self, advancement_type: str, attr_name_or_skill: str) -> int:
        """Oblicza maksymalną liczbę rozwinięć możliwych przy aktualnym PD."""
        if advancement_type == "cecha":
            current_adv = self.data_manager.attributes[attr_name_or_skill]["advanced"]
        else:
            current_adv = self.data_manager.skills[attr_name_or_skill]["advanced"]
        
        max_adv = 0
        available = self.data_manager.experience["available"]
        
        while True:
            cost = calculate_advancement_cost(advancement_type, current_adv, max_adv + 1)
            if available >= cost:
                max_adv += 1
            else:
                break
        
        return max_adv
    
    def _get_button_color_for_increase(self, advancement_type: str, item_name: str, amount: int) -> str:
        """Zwraca kolor przycisku +X na podstawie możliwości."""
        if advancement_type == "cecha":
            can_afford = self.can_afford_attribute(item_name)
        else:
            can_afford = self.can_afford_skill(item_name)
        
        if not can_afford:
            return COLOR_ERROR
        
        max_adv = self.get_max_advancements(advancement_type, item_name)
        return COLOR_SUCCESS if max_adv >= amount else COLOR_ERROR
    
    def _get_button_color_for_decrease(self, advancement_type: str, item_name: str) -> str:
        """Zwraca kolor przycisku -X na podstawie możliwości cofnięcia."""
        if advancement_type == "cecha":
            current_adv = self.data_manager.attributes[item_name]["advanced"]
            base_adv = self.data_manager.attributes[item_name]["base_advanced"]
        else:
            current_adv = self.data_manager.skills[item_name]["advanced"]
            base_adv = self._get_minimum_skill_advancement(
                self.data_manager.skills[item_name]
            )
        
        return COLOR_WARNING if current_adv > base_adv else "#555555"

    def on_confirm_changes(self) -> None:
        """Potwierdza wszystkie oczekujące zmiany."""
        if not self.has_pending_changes():
            messagebox.showinfo("Brak zmian", "Nie ma żadnych oczekujących zmian do zatwierdzenia.")
            return

        # Kalkulacja całkowitego kosztu
        total_cost = 0
        details = []

        for attr_name, change_count in self.pending_changes["attribute_changes"].items():
            if change_count > 0:
                current_adv = (
                    self.data_manager.attributes[attr_name]["advanced"] - change_count
                )
                cost = calculate_advancement_cost("cecha", current_adv, change_count)
                total_cost += cost
                details.append(f"Cecha {attr_name}: +{change_count} rozwinięć ({cost} PD)")

        for skill_name, change_count in self.pending_changes["skill_changes"].items():
            if change_count > 0:
                current_adv = (
                    self.data_manager.skills[skill_name]["advanced"] - change_count
                )
                cost = calculate_advancement_cost("umiejetnosc", current_adv, change_count)
                total_cost += cost
                details.append(f"Umiejętność {skill_name}: +{change_count} rozwinięć ({cost} PD)")

        for skill_name in sorted(self.pending_changes["new_skills"], key=str.casefold):
            skill_data = self.data_manager.skills.get(skill_name)
            if skill_data:
                details.append(
                    f"Nowa umiejętność {skill_name} ({skill_data['attribute']})"
                )

        # Potwierdzenie
        details_text = "\n".join(details)
        result = messagebox.askyesno(
            "Potwierdzenie zmian",
            f"Koszt zmian: {total_cost} PD\n\n{details_text}\n\nCzy zatwierdzić zmiany?"
        )

        if result:
            self.data_manager.experience["spent"] += total_cost
            self.data_manager.experience["total"] = (
                self.data_manager.experience["available"]
                + self.data_manager.experience["spent"]
            )

            # Reset oczekujących zmian
            for attr_name in self.pending_changes["attribute_changes"]:
                self.data_manager.attributes[attr_name]["base_advanced"] = (
                    self.data_manager.attributes[attr_name]["advanced"]
                )

            for skill_name in self.pending_changes["skill_changes"]:
                self.data_manager.skills[skill_name]["base_advanced"] = (
                    self.data_manager.skills[skill_name]["advanced"]
                )

            for skill_name in self.pending_changes["new_skills"]:
                if skill_name in self.data_manager.skills:
                    self.data_manager.skills[skill_name]["base_advanced"] = (
                        self.data_manager.skills[skill_name]["advanced"]
                    )
                    self.data_manager.skills[skill_name]["is_new"] = False

            self.pending_changes = self._create_empty_pending_changes()

            # Zapisz do Excel
            if self.data_manager.file_path:
                self.data_manager.save_to_excel()

            self.history_manager.add_entry("Zatwierdzono zmiany", f"Koszt: {total_cost} PD")

            messagebox.showinfo("Sukces", "Zmiany zatwierdzone!")
            self.refresh_attributes_display()
            self.refresh_skills_display()
            self.update_experience_display()
            self.refresh_history_display()
            self.refresh_costs_display()

    def on_revert_changes(self) -> None:
        """Cofa wszystkie oczekujące zmiany."""
        if not self.has_pending_changes():
            messagebox.showinfo("Brak zmian", "Nie ma żadnych zmian do cofnięcia.")
            return

        result = messagebox.askyesno(
            "Potwierdzenie cofnięcia",
            "Czy na pewno chcesz cofnąć wszystkie oczekujące zmiany?"
        )

        if result:
            # Oblicz całkowity koszt do przywrócenia
            total_refund = 0
            
            # Przywróć cechy i oblicz refund
            for attr_name in self.pending_changes["attribute_changes"]:
                change_count = self.pending_changes["attribute_changes"][attr_name]
                if change_count > 0:
                    current_adv = self.data_manager.attributes[attr_name]["advanced"]
                    refund = calculate_advancement_cost("cecha", current_adv - change_count, change_count)
                    total_refund += refund
                
                self.data_manager.attributes[attr_name]["advanced"] = (
                    self.data_manager.attributes[attr_name]["base_advanced"]
                )

            # Przywróć umiejętności i oblicz refund
            for skill_name in self.pending_changes["skill_changes"]:
                change_count = self.pending_changes["skill_changes"][skill_name]
                if change_count > 0:
                    current_adv = self.data_manager.skills[skill_name]["advanced"]
                    refund = calculate_advancement_cost("umiejetnosc", current_adv - change_count, change_count)
                    total_refund += refund
                
                self.data_manager.skills[skill_name]["advanced"] = (
                    self.data_manager.skills[skill_name]["base_advanced"]
                )
            
            # Usuń umiejętności, które były dodane (nie mają base_advanced)
            skills_to_remove = list(self.pending_changes["new_skills"])
            for skill_name in skills_to_remove:
                if skill_name in self.skill_rows:
                    self.skill_rows[skill_name]["row"].destroy()
                    del self.skill_rows[skill_name]
            
            for skill_name in skills_to_remove:
                if skill_name in self.data_manager.skills:
                    del self.data_manager.skills[skill_name]

            # Przywróć doświadczenie
            self.data_manager.experience["available"] += total_refund
            
            self.pending_changes = self._create_empty_pending_changes()

            self.history_manager.add_entry("Cofnięto zmiany", f"Przywrócono {total_refund} PD")

            messagebox.showinfo("Sukces", "Zmiany cofnięte!")
            self.refresh_attributes_display()
            self.refresh_skills_display()
            self.update_experience_display()
            self.refresh_history_display()
            self.refresh_costs_display()

    def on_delete_skill(self, skill_name: str) -> None:
        """Usuwa umiejętność (tylko dodane)."""
        if skill_name not in self.data_manager.skills:
            return
        
        skill_data = self.data_manager.skills[skill_name]
        if not skill_data.get("is_new", False):
            messagebox.showerror("Błąd", "Można usuwać tylko umiejętności dodane przez gracza.")
            return
        
        result = messagebox.askyesno(
            "Potwierdzenie usunięcia",
            f"Czy chcesz usunąć umiejętność '{skill_name}'?"
        )
        
        if result:
            del self.data_manager.skills[skill_name]
            self.pending_changes["new_skills"].discard(skill_name)
            self.pending_changes["skill_changes"].pop(skill_name, None)
            if skill_name in self.skill_rows:
                self.skill_rows[skill_name]["row"].destroy()
                del self.skill_rows[skill_name]
            
            self.history_manager.add_entry(
                "Usunięto umiejętność",
                skill_name
            )
            messagebox.showinfo("Sukces", f"Umiejętność '{skill_name}' usunięta!")
            self.refresh_skills_display()
            self.refresh_history_display()
            self.refresh_costs_display()

    def on_add_skill(self) -> None:
        """Dodaje nową umiejętność."""
        skill_name = self.skill_name_entry.get().strip()
        attribute = self.skill_attr_combo.get()
        
        # Walidacja
        validation_error = self._validate_skill_form(skill_name, attribute)
        if validation_error:
            messagebox.showerror("Błąd", validation_error)
            return
        
        try:
            advanced = int(self.skill_advanced_spinbox.get())
        except ValueError:
            messagebox.showerror("Błąd", "Wartość numeryczna musi być liczbą.")
            return

        if advanced < 0:
            messagebox.showerror("Błąd", "Liczba rozwinięć nie może być ujemna.")
            return

        # Wartość początkowa to wartość przypisanej cechy
        initial = self.data_manager.attributes[attribute]["initial"]
        
        self.data_manager.add_skill(skill_name, attribute, initial, advanced, is_new=True)
        self.pending_changes["new_skills"].add(skill_name)

        # Wyczyść formularz
        self.skill_name_entry.delete(0, "end")
        self.skill_attr_combo.set("")
        self.skill_advanced_spinbox.delete(0, "end")
        self.skill_advanced_spinbox.insert(0, "0")

        self.history_manager.add_entry(
            "Dodano umiejętność",
            f"{skill_name} ({attribute}) - Pocz: {initial}, Rozw: {advanced}"
        )

        messagebox.showinfo("Sukces", f"Umiejętność '{skill_name}' dodana!")

        # Odśwież wyświetlanie umiejętności
        self.initialized_skills = False
        self.initialize_skills_display()
        self.refresh_history_display()
        self.refresh_costs_display()
    
    def _validate_skill_form(self, skill_name: str, attribute: str) -> Optional[str]:
        """Waliduje formularz dodania umiejętności. Zwraca None jeśli OK, inaczej komunikat błędu."""
        if not skill_name:
            return "Wpisz nazwę umiejętności."
        
        if not attribute:
            return "Wybierz atrybut."
        
        if skill_name in self.data_manager.skills:
            return "Umiejętność o tej nazwie już istnieje."
        
        return None

    def on_add_experience(self) -> None:
        """Dodaje doświadczenie."""
        try:
            amount = int(self.exp_add_entry.get())
        except ValueError:
            messagebox.showerror("Błąd", "Wpisz poprawną liczbę.")
            return

        if amount <= 0:
            messagebox.showerror("Błąd", "Ilość musi być większa od 0.")
            return

        self.data_manager.experience["available"] += amount
        self.data_manager.experience["total"] += amount

        self.exp_add_entry.delete(0, "end")

        self.history_manager.add_entry("Dodano doświadczenie", f"+{amount} PD")

        messagebox.showinfo("Sukces", f"Dodano {amount} PD!")
        self.update_experience_display()
        self.refresh_attributes_display()
        self.refresh_skills_display()
        self.refresh_history_display()
        self.refresh_costs_display()

    def on_quick_experience(self, amount: int) -> None:
        """Szybkie dodanie doświadczenia."""
        self.data_manager.experience["available"] += amount
        self.data_manager.experience["total"] += amount

        self.history_manager.add_entry("Dodano doświadczenie", f"+{amount} PD")

        self.update_experience_display()
        self.refresh_attributes_display()
        self.refresh_skills_display()
        self.refresh_history_display()
        self.refresh_costs_display()

    def on_calculate_cost(self) -> None:
        """Oblicza koszt rozwinięć dla wybranej cechy/umiejętności."""
        selection = self.cost_combo.get().strip()
        try:
            advancements = int(self.cost_spinbox.get())
        except ValueError:
            self.cost_type_label.configure(text="Typ: -")
            self.cost_current_label.configure(text="Aktualne rozwinięcia: -")
            self.cost_result_label.configure(text="Koszt: -")
            return

        if not selection or advancements <= 0:
            self.cost_type_label.configure(text="Typ: -")
            self.cost_current_label.configure(text="Aktualne rozwinięcia: -")
            self.cost_result_label.configure(text="Koszt: -")
            return

        preview = self.get_cost_preview(selection, advancements)
        if not preview:
            self.cost_type_label.configure(text="Typ: -")
            self.cost_current_label.configure(text="Aktualne rozwinięcia: -")
            self.cost_result_label.configure(text="Koszt: -")
            return

        self.cost_type_label.configure(text=f"Typ: {preview['type']}")
        self.cost_current_label.configure(
            text=f"Aktualne rozwinięcia: {preview['current_adv']}"
        )
        self.cost_result_label.configure(text=f"Koszt: {preview['cost']} PD")

    def on_load_character(self) -> None:
        """Ładuje postać z pliku Excel."""
        file_path = filedialog.askopenfilename(
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
        )

        if not file_path:
            return

        if self.data_manager.load_from_excel(file_path):
            self.pending_changes = self._create_empty_pending_changes()
            # Reset flag aby reinicjalizować widgety z nowymi danymi
            self.initialized_attrs = False
            self.initialized_skills = False
            self.history_manager.add_entry("Wczytano postać", Path(file_path).name)
            messagebox.showinfo("Sukces", "Postać wczytana!")
            self.initialize_attributes_display()
            self.initialize_skills_display()
            self.update_experience_display()
            self.refresh_history_display()
            self.update_character_info()
            self.refresh_costs_display()
        else:
            messagebox.showerror("Błąd", "Nie można wczytać pliku.")

    def on_save_character(self) -> None:
        """Zapisuje postać do pliku Excel."""
        if self.has_pending_changes():
            messagebox.showwarning(
                "Oczekujące zmiany",
                "Najpierw zatwierdź albo cofnij oczekujące zmiany, a dopiero potem zapisz plik.",
            )
            return

        if not self.data_manager.file_path:
            file_path = filedialog.asksaveasfilename(
                defaultextension=".xlsx",
                filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
            )
            if not file_path:
                return
        else:
            file_path = self.data_manager.file_path

        if self.data_manager.save_to_excel(file_path):
            self.history_manager.add_entry("Zapisano postać", Path(file_path).name)
            messagebox.showinfo("Sukces", "Postać zapisana!")
            self.refresh_history_display()
        else:
            messagebox.showerror("Błąd", "Nie można zapisać pliku.")

    def on_new_character(self) -> None:
        """Tworzy nową postać."""
        result = messagebox.askyesno(
            "Nowa postać",
            "Czy chcesz stworzyć nową postać? Niezapisane zmiany zostaną utracone."
        )

        if result:
            self.data_manager.create_new_character()
            self.pending_changes = self._create_empty_pending_changes()
            self.history_manager.add_entry("Utworzono nową postać", "")
            messagebox.showinfo("Sukces", "Nowa postać gotowa!")
            self.initialized_attrs = False
            self.initialized_skills = False
            self.initialize_attributes_display()
            self.initialize_skills_display()
            self.update_experience_display()
            self.refresh_history_display()
            self.update_character_info()
            self.refresh_costs_display()

    def update_experience_display(self) -> None:
        """Aktualizuje wyświetlanie doświadczenia."""
        available = self.data_manager.experience["available"]
        spent = self.data_manager.experience["spent"]
        total = self.data_manager.experience["total"]

        self.exp_label.configure(text=f"{available}/{total}")
        self.exp_entry.delete(0, "end")
        self.exp_entry.insert(0, str(available))

    def update_character_info(self) -> None:
        """Aktualizuje informacje o postaci."""
        self.char_name_label.configure(text=self.data_manager.character_name)

    def refresh_history_display(self) -> None:
        """Odświeża wyświetlanie historii."""
        self.history_text.configure(state="normal")
        self.history_text.delete("1.0", "end")
        self.history_text.insert("1.0", self.history_manager.get_history_text())
        self.history_text.configure(state="disabled")


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    app = CharacterSheetApp()
    app.mainloop()
