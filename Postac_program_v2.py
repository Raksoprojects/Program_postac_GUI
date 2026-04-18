import tkinter as tk
from tkinter import ttk, messagebox
import pandas as pd

class CharacterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Warhammer Fantasy Roleplay - Karta Postaci")
        self.root.geometry("800x600")

        # Dane postaci
        self.character_data = {}
        self.experience = 0
        self.history = []

        # Zakładki
        self.notebook = ttk.Notebook(root)
        self.notebook.pack(expand=True, fill="both")

        self.create_character_tab()
        self.create_costs_tab()
        self.create_experience_tab()
        self.create_history_tab()
        self.create_add_skill_tab()

    def create_character_tab(self):
        """Zakładka: Karta postaci"""
        self.character_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.character_tab, text="Karta Postaci")

        ttk.Label(self.character_tab, text="Imię postaci:").grid(row=0, column=0, padx=10, pady=10)
        self.name_entry = ttk.Entry(self.character_tab)
        self.name_entry.grid(row=0, column=1, padx=10, pady=10)

        ttk.Button(self.character_tab, text="Wczytaj kartę", command=self.load_character).grid(row=1, column=0, padx=10, pady=10)
        ttk.Button(self.character_tab, text="Zapisz zmiany", command=self.save_character).grid(row=1, column=1, padx=10, pady=10)

    def create_costs_tab(self):
        """Zakładka: Koszty rozwinięć"""
        self.costs_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.costs_tab, text="Koszty Rozwinięć")

        ttk.Label(self.costs_tab, text="Koszty rozwinięć:").pack(pady=10)
        self.costs_text = tk.Text(self.costs_tab, height=10, width=50)
        self.costs_text.pack(pady=10)
        self.costs_text.insert("1.0", "Koszty rozwinięć:\n5 -> 100 XP\n10 -> 200 XP\n15 -> 300 XP\n20 -> 400 XP")

    def create_experience_tab(self):
        """Zakładka: Dodaj doświadczenie"""
        self.experience_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.experience_tab, text="Dodaj Doświadczenie")

        ttk.Label(self.experience_tab, text="Dostępne doświadczenie:").grid(row=0, column=0, padx=10, pady=10)
        self.experience_label = ttk.Label(self.experience_tab, text=str(self.experience))
        self.experience_label.grid(row=0, column=1, padx=10, pady=10)

        ttk.Button(self.experience_tab, text="+5 XP", command=lambda: self.add_experience(5)).grid(row=1, column=0, padx=10, pady=10)
        ttk.Button(self.experience_tab, text="-5 XP", command=lambda: self.add_experience(-5)).grid(row=1, column=1, padx=10, pady=10)

    def create_history_tab(self):
        """Zakładka: Historia działań"""
        self.history_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.history_tab, text="Historia Działań")

        ttk.Label(self.history_tab, text="Historia:").pack(pady=10)
        self.history_text = tk.Text(self.history_tab, height=10, width=50)
        self.history_text.pack(pady=10)

    def create_add_skill_tab(self):
        """Zakładka: Dodaj umiejętność"""
        self.add_skill_tab = ttk.Frame(self.notebook)
        self.notebook.add(self.add_skill_tab, text="Dodaj Umiejętność")

        ttk.Label(self.add_skill_tab, text="Nazwa umiejętności:").grid(row=0, column=0, padx=10, pady=10)
        self.skill_name_entry = ttk.Entry(self.add_skill_tab)
        self.skill_name_entry.grid(row=0, column=1, padx=10, pady=10)

        ttk.Label(self.add_skill_tab, text="Atrybut:").grid(row=1, column=0, padx=10, pady=10)
        self.skill_attribute_entry = ttk.Entry(self.add_skill_tab)
        self.skill_attribute_entry.grid(row=1, column=1, padx=10, pady=10)

        ttk.Label(self.add_skill_tab, text="Rozwinięcia:").grid(row=2, column=0, padx=10, pady=10)
        self.skill_development_entry = ttk.Entry(self.add_skill_tab)
        self.skill_development_entry.grid(row=2, column=1, padx=10, pady=10)

        ttk.Button(self.add_skill_tab, text="Dodaj umiejętność", command=self.add_skill).grid(row=3, column=0, columnspan=2, pady=10)

    def load_character(self):
        """Wczytaj dane postaci z pliku"""
        messagebox.showinfo("Informacja", "Funkcja wczytywania w budowie.")

    def save_character(self):
        """Zapisz dane postaci do pliku"""
        messagebox.showinfo("Informacja", "Funkcja zapisu w budowie.")

    def add_experience(self, amount):
        """Dodaj/odejmij doświadczenie"""
        self.experience += amount
        self.experience_label.config(text=str(self.experience))
        self.history.append(f"Zmiana doświadczenia: {amount}")
        self.update_history()

    def add_skill(self):
        """Dodaj nową umiejętność"""
        skill_name = self.skill_name_entry.get()
        skill_attribute = self.skill_attribute_entry.get()
        skill_development = self.skill_development_entry.get()

        if not skill_name or not skill_attribute or not skill_development.isdigit():
            messagebox.showerror("Błąd", "Niepoprawne dane umiejętności.")
            return

        self.character_data[skill_name] = {
            "attribute": skill_attribute,
            "development": int(skill_development)
        }
        messagebox.showinfo("Sukces", f"Umiejętność '{skill_name}' została dodana.")

    def update_history(self):
        """Zaktualizuj historię działań"""
        self.history_text.delete("1.0", tk.END)
        self.history_text.insert("1.0", "\n".join(self.history))

if __name__ == "__main__":
    root = tk.Tk()
    app = CharacterApp(root)
    root.mainloop()