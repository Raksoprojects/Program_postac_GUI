#!/usr/bin/env python3
"""Testy regresyjne dla kluczowych scenariuszy aplikacji."""

import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from openpyxl import load_workbook

from Postac_program_gui import CharacterSheetApp, DataManager, calculate_advancement_cost


WORKSPACE_DIR = Path(__file__).resolve().parent
EXCEL_FILE = WORKSPACE_DIR / "karta_postaci.xlsx"
PDF_FILE = WORKSPACE_DIR / "Rein_Nuhr_lepsza_4ed.pdf"


class CharacterSheetAppRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_excel = Path(self.temp_dir.name) / "karta_postaci_test.xlsx"
        shutil.copyfile(EXCEL_FILE, self.temp_excel)
        self.temp_history = Path(self.temp_dir.name) / "history_test.json"
        self.app = CharacterSheetApp()
        self.app.withdraw()
        self.app.history_manager.json_file = str(self.temp_history)
        self.app.history_manager.history = []

    def tearDown(self):
        self.app.destroy()
        self.temp_dir.cleanup()

    def load_test_excel(self):
        self.assertTrue(self.app.data_manager.load_from_excel(str(self.temp_excel)))

    def test_confirm_keeps_reserved_xp_without_double_charge(self):
        self.load_test_excel()

        start_available = self.app.data_manager.experience["available"]
        start_spent = self.app.data_manager.experience["spent"]
        cost = calculate_advancement_cost(
            "cecha",
            self.app.data_manager.attributes["WW"]["advanced"],
            1,
        )

        self.app.on_increase_attribute("WW", 1)
        self.assertEqual(
            self.app.data_manager.experience["available"],
            start_available - cost,
        )

        with patch("Postac_program_gui.messagebox.askyesno", return_value=True), patch(
            "Postac_program_gui.messagebox.showinfo"
        ):
            self.app.on_confirm_changes()

        self.assertEqual(
            self.app.data_manager.experience["available"],
            start_available - cost,
        )
        self.assertEqual(self.app.data_manager.experience["spent"], start_spent + cost)

    def test_cost_preview_uses_current_advancements(self):
        self.load_test_excel()

        selection = "WW"
        desired_advancements = 7
        current_adv = self.app.data_manager.attributes[selection]["advanced"]

        preview = self.app.get_cost_preview(selection, desired_advancements)

        self.assertIsNotNone(preview)
        self.assertEqual(preview["type"], "Cecha")
        self.assertEqual(preview["current_adv"], current_adv)
        self.assertEqual(
            preview["cost"],
            calculate_advancement_cost("cecha", current_adv, desired_advancements),
        )

    def test_new_skill_is_finalized_after_confirm(self):
        self.app.data_manager.create_new_character("Tester")
        self.app.data_manager.add_skill(
            "Nowa Umiejętność",
            "WW",
            initial=30,
            advanced=2,
            is_new=True,
        )
        self.app.pending_changes["new_skills"].add("Nowa Umiejętność")

        with patch("Postac_program_gui.messagebox.askyesno", return_value=True), patch(
            "Postac_program_gui.messagebox.showinfo"
        ):
            self.app.on_confirm_changes()

        self.assertIn("Nowa Umiejętność", self.app.data_manager.skills)
        self.assertFalse(self.app.data_manager.skills["Nowa Umiejętność"]["is_new"])
        self.assertEqual(self.app.data_manager.skills["Nowa Umiejętność"]["base_advanced"], 2)

    def test_exact_attribute_filter_shows_matching_skills(self):
        self.load_test_excel()
        self.app.initialize_skills_display()

        self.app.skill_attribute_filter_var.set("Inteligencja (Int)")
        self.app.apply_skill_filter()

        visible_skills = {
            skill_name
            for skill_name, row_data in self.app.skill_rows.items()
            if row_data["row"].winfo_manager() == "pack"
        }

        self.assertTrue(visible_skills)
        self.assertTrue(
            all(
                self.app.data_manager.skills[skill_name]["attribute"] == "Int"
                for skill_name in visible_skills
            )
        )


class DataManagerRegressionTests(unittest.TestCase):
    def test_save_to_excel_distributes_skills_between_blocks(self):
        data_manager = DataManager()
        self.assertTrue(data_manager.load_from_excel(str(EXCEL_FILE)))

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_excel = Path(temp_dir) / "karta_postaci_copy.xlsx"
            shutil.copyfile(EXCEL_FILE, temp_excel)

            self.assertTrue(data_manager.save_to_excel(str(temp_excel)))

            workbook = load_workbook(temp_excel, data_only=True)
            worksheet = workbook.active
            block_lengths = []

            for block in range(3):
                col_offset = block * 5
                block_rows = []
                for row in range(18, 31):
                    skill_name = worksheet.cell(row, 1 + col_offset).value
                    if skill_name:
                        block_rows.append(skill_name)
                block_lengths.append(len(block_rows))

            workbook.close()

        self.assertEqual(sum(block_lengths), len(data_manager.skills))
        self.assertEqual(block_lengths, [13, 13, 10])

    def test_load_from_pdf_reads_rein_and_experience(self):
        data_manager = DataManager()

        self.assertTrue(data_manager.load_from_pdf(str(PDF_FILE)))

        self.assertEqual(data_manager.character_name, "Rein Nuhr")
        self.assertEqual(data_manager.experience["available"], 185)
        self.assertEqual(data_manager.experience["spent"], 2260)
        self.assertEqual(data_manager.experience["total"], 2445)
        self.assertIn("Splatanie (Aqshy)", data_manager.skills)
        self.assertIn("Broń Biała (Drzewcowa)", data_manager.skills)

    def test_load_from_pdf_marks_profession_advancements(self):
        data_manager = DataManager()

        self.assertTrue(data_manager.load_from_pdf(str(PDF_FILE)))

        self.assertTrue(data_manager.attributes["WW"]["profession_available"])
        self.assertFalse(data_manager.attributes["US"]["profession_available"])
        self.assertTrue(data_manager.skills["Broń Biała (Podstawowa)"]["profession_available"])
        self.assertFalse(data_manager.skills["Atletyka"]["profession_available"])

    def test_save_to_pdf_updates_form_fields(self):
        data_manager = DataManager()
        self.assertTrue(data_manager.load_from_pdf(str(PDF_FILE)))

        data_manager.character_name = "Rein Test"
        data_manager.experience["available"] = 321
        data_manager.attributes["WW"]["advanced"] = 9

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_pdf = Path(temp_dir) / "rein_test.pdf"
            self.assertTrue(data_manager.save_to_pdf(str(temp_pdf)))

            from pypdf import PdfReader

            reader = PdfReader(str(temp_pdf))
            fields = reader.get_fields() or {}

            self.assertEqual(fields["Imię"].get("/V"), "Rein Test")
            self.assertEqual(str(fields["Aktualne_doświadczenie"].get("/V")), "321")
            self.assertEqual(str(fields["WW_rozwieniecie"].get("/V")), "9")


if __name__ == "__main__":
    unittest.main()