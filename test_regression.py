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


class CharacterSheetAppRegressionTests(unittest.TestCase):
    def setUp(self):
        self.app = CharacterSheetApp()
        self.app.withdraw()

    def tearDown(self):
        self.app.destroy()

    def test_confirm_keeps_reserved_xp_without_double_charge(self):
        self.assertTrue(self.app.data_manager.load_from_excel(str(EXCEL_FILE)))

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
        self.assertTrue(self.app.data_manager.load_from_excel(str(EXCEL_FILE)))

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


if __name__ == "__main__":
    unittest.main()