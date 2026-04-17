import openpyxl
import math
import tkinter as tk
from tkinter import ttk, messagebox

# Tabela kosztów rozwinięć: kluczem jest próg rozwinięć, a wartościami są krotki (koszt_cechy, koszt_umiejętności).
cost_table = {
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
    float("inf"): (520, 440)  # powyżej 70 rozwinięć koszt utrzymuje się na tym poziomie
}

def load_data(file_name):
    """Wczytuje dane postaci z pliku Excel i zwraca słowniki cech, umiejętności oraz doświadczenia."""
    wb = openpyxl.load_workbook(file_name, data_only=True)
    sheet = wb.active
    cechy = {}
    umiejetnosci = {}
    exp = {}

    # Wczytanie cech
    col = 2
    while True:
        cecha_name = sheet.cell(row=11, column=col).value
        if cecha_name is None:
            break
        poczatkowa_val = sheet.cell(row=12, column=col).value or 0
        rozwinieta_val = sheet.cell(row=13, column=col).value or 0
        wartosc_val = poczatkowa_val + rozwinieta_val
        cechy[cecha_name] = {
            "poczatkowa": poczatkowa_val,
            "rozwinieta": rozwinieta_val,
            "wartosc": wartosc_val
        }
        col += 1

    # Wczytanie umiejętności (podzielonych na 3 kolumny bloków)
    for a in range(3):
        for row in range(18, 31):
            um_name = sheet.cell(row=row, column=1 + a*5).value
            if um_name is None:
                break  # koniec listy umiejętności w tym bloku
            cecha_powiazana = sheet.cell(row=row, column=2 + a*5).value or ""
            wartosc_um = sheet.cell(row=row, column=3 + a*5).value or 0
            rozw_um = sheet.cell(row=row, column=4 + a*5).value or 0
            suma_um = wartosc_um + rozw_um
            umiejetnosci[um_name] = {
                "cecha": cecha_powiazana,
                "wartosc": wartosc_um,
                "rozwinieta": rozw_um,
                "suma": suma_um
            }

    # Wczytanie doświadczenia (komórki P11, Q11, R11)
    exp["aktualne"] = sheet["P11"].value or 0  # aktualne (dostępne) PD
    exp["wydane"] = sheet["Q11"].value or 0    # wydane PD
    exp["suma"] = sheet["R11"].value or (exp["aktualne"] + exp["wydane"])  # suma PD (aktualne + wydane)
    wb.close()
    return cechy, umiejetnosci, exp

def save_data(file_name, cechy, umiejetnosci, exp):
    """Zapisuje bieżące dane postaci do pliku Excel."""
    wb = openpyxl.load_workbook(file_name)
    sheet = wb.active

    # Zapis cech
    col = 2
    while True:
        cecha_name = sheet.cell(row=11, column=col).value
        if cecha_name is None:
            break
        if cecha_name in cechy:
            sheet.cell(row=12, column=col, value=cechy[cecha_name]["poczatkowa"])
            sheet.cell(row=13, column=col, value=cechy[cecha_name]["rozwinieta"])
            sheet.cell(row=14, column=col, value=cechy[cecha_name]["wartosc"])
        col += 1

    # Zapis umiejętności
    for a in range(3):
        for row in range(18, 31):
            name = sheet.cell(row=row, column=1 + a*5).value
            if name is None:
                break
            if name in umiejetnosci:
                sheet.cell(row=row, column=2 + a*5, value=umiejetnosci[name].get("cecha", ""))
                sheet.cell(row=row, column=3 + a*5, value=umiejetnosci[name]["wartosc"])
                sheet.cell(row=row, column=4 + a*5, value=umiejetnosci[name]["rozwinieta"])
                sheet.cell(row=row, column=5 + a*5, value=umiejetnosci[name]["suma"])

    # Zapis doświadczenia
    sheet["P11"] = exp["aktualne"]
    sheet["Q11"] = exp["wydane"]
    sheet["R11"] = exp["suma"]

    wb.save(file_name)
    wb.close()

def calculate_total_experience(advancement_type, current_advancements, desired_advancements):
    """Oblicza całkowity koszt PD dla uzyskania `desired_advancements` rozwinięć danego typu od bieżącego poziomu."""
    total_experience = 0
    remaining = desired_advancements
    current_threshold = current_advancements

    # Sumujemy koszty kolejnych rozwinięć, uwzględniając zmiany kosztu na progach z cost_table
    while remaining > 0:
        for threshold, (char_cost, skill_cost) in cost_table.items():
            if current_threshold < threshold:
                # Liczba rozwinięć do osiągnięcia kolejnego progu (lub mniejsza, jeśli mniej pozostało)
                to_threshold = min(remaining, threshold - current_threshold)
                if advancement_type == "cecha":
                    total_experience += char_cost * to_threshold
                elif advancement_type == "umiejetnosc":
                    total_experience += skill_cost * to_threshold
                remaining -= to_threshold
                current_threshold += to_threshold
                if remaining == 0:
                    break
    return total_experience

class CharacterSheetGUI:
    def __init__(self, file_name="karta_postaci.xlsx"):
        # Wczytanie danych z pliku Excel
        try:
            self.cechy, self.umiejetnosci, self.exp = load_data(file_name)
        except Exception as e:
            messagebox.showerror("Błąd", f"Nie udało się wczytać pliku {file_name}:\n{e}")
            self.cechy, self.umiejetnosci, self.exp = {}, {}, {"aktualne": 0, "wydane": 0, "suma": 0}
            file_name = None
        self.file_name = file_name

        # Główne okno aplikacji
        self.root = tk.Tk()
        self.root.title("Karta Postaci RPG")
        self.root.geometry("1200x800")

        # Styl ttk (opcjonalnie można zmienić temat dla lepszego wyglądu)
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except:
            pass

        # Ramka górna z polem PD oraz przyciskami "Zapisz" i "Reset"
        top_frame = ttk.Frame(self.root, padding="10 5 10 5")
        top_frame.pack(side=tk.TOP, fill=tk.X)
        ttk.Label(top_frame, text="Doświadczenie (PD):").pack(side=tk.LEFT, padx=(5, 2))
        self.pd_var = tk.StringVar(value=str(self.exp.get("aktualne", 0)))
        self.last_valid_pd = self.exp.get("aktualne", 0)
        pd_entry = ttk.Entry(top_frame, textvariable=self.pd_var, width=10)
        pd_entry.pack(side=tk.LEFT)
        # Powiązanie zdarzeń Enter i utraty fokusu z funkcją aktualizującą PD
        pd_entry.bind("<Return>", self.on_pd_change)
        pd_entry.bind("<FocusOut>", self.on_pd_change)
        # Przyciski Zapisz i Reset
        save_btn = ttk.Button(top_frame, text="Zapisz", command=self.on_save)
        save_btn.pack(side=tk.RIGHT, padx=5)
        reset_btn = ttk.Button(top_frame, text="Reset", command=self.on_reset)
        reset_btn.pack(side=tk.RIGHT)

        # Notebook z zakładkami
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # Zakładka 1: Wyświetlanie danych postaci
        tab1 = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab1, text="Dane postaci")
        ttk.Label(tab1, text="CECHY:").pack(anchor=tk.W)
        # Ramka dla listy cech z plus/minus
        attr_frame = ttk.Frame(tab1)
        attr_frame.pack(fill=tk.X, pady=5)
        # Nagłówki dla cech
        ttk.Label(attr_frame, text="Cecha").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(attr_frame, text="Początkowa").grid(row=0, column=1)
        ttk.Label(attr_frame, text="Rozwinięta").grid(row=0, column=2)
        ttk.Label(attr_frame, text="Wartość").grid(row=0, column=3)
        # Kolumny 4 i 5 przeznaczone na przyciski [+] [-]
        self.attr_labels = {}
        self.attr_buttons = {}
        row_index = 1
        for cecha, vals in self.cechy.items():
            ttk.Label(attr_frame, text=cecha).grid(row=row_index, column=0, sticky=tk.W)
            lbl_pocz = ttk.Label(attr_frame, text=str(vals["poczatkowa"]))
            lbl_pocz.grid(row=row_index, column=1)
            lbl_rozw = ttk.Label(attr_frame, text=str(vals["rozwinieta"]))
            lbl_rozw.grid(row=row_index, column=2)
            lbl_wart = ttk.Label(attr_frame, text=str(vals["wartosc"]))
            lbl_wart.grid(row=row_index, column=3)
            btn_plus = tk.Button(attr_frame, text="+", width=3, command=lambda n=cecha: self.on_increase("cecha", n))
            btn_plus.grid(row=row_index, column=4)
            btn_minus = tk.Button(attr_frame, text="-", width=3, command=lambda n=cecha: self.on_decrease("cecha", n))
            btn_minus.grid(row=row_index, column=5)
            self.attr_labels[cecha] = {"poczatkowa": lbl_pocz, "rozwinieta": lbl_rozw, "wartosc": lbl_wart}
            self.attr_buttons[cecha] = {"plus": btn_plus, "minus": btn_minus}
            row_index += 1

        ttk.Label(tab1, text="UMIEJĘTNOŚCI:").pack(anchor=tk.W, pady=(10, 0))
        # Ramka dla listy umiejętności z plus/minus
        skill_frame = ttk.Frame(tab1)
        skill_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        # Nagłówki dla umiejętności
        ttk.Label(skill_frame, text="Umiejętność").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(skill_frame, text="Cecha").grid(row=0, column=1)
        ttk.Label(skill_frame, text="Wartość").grid(row=0, column=2)
        ttk.Label(skill_frame, text="Rozwinięcia").grid(row=0, column=3)
        ttk.Label(skill_frame, text="Suma").grid(row=0, column=4)
        self.skill_labels = {}
        self.skill_buttons = {}
        row_index = 1
        for um, vals in self.umiejetnosci.items():
            ttk.Label(skill_frame, text=um).grid(row=row_index, column=0, sticky=tk.W)
            ttk.Label(skill_frame, text=str(vals["cecha"])).grid(row=row_index, column=1)
            lbl_wart = ttk.Label(skill_frame, text=str(vals["wartosc"]))
            lbl_wart.grid(row=row_index, column=2)
            lbl_rozw = ttk.Label(skill_frame, text=str(vals["rozwinieta"]))
            lbl_rozw.grid(row=row_index, column=3)
            lbl_suma = ttk.Label(skill_frame, text=str(vals["suma"]))
            lbl_suma.grid(row=row_index, column=4)
            btn_plus = tk.Button(skill_frame, text="+", width=3, command=lambda n=um: self.on_increase("umiejetnosc", n))
            btn_plus.grid(row=row_index, column=5)
            btn_minus = tk.Button(skill_frame, text="-", width=3, command=lambda n=um: self.on_decrease("umiejetnosc", n))
            btn_minus.grid(row=row_index, column=6)
            self.skill_labels[um] = {"wartosc": lbl_wart, "rozwinieta": lbl_rozw, "suma": lbl_suma}
            self.skill_buttons[um] = {"plus": btn_plus, "minus": btn_minus}
            row_index += 1

        # Etykieta z podsumowaniem doświadczenia
        self.exp_label_tab1 = ttk.Label(tab1, text="")
        self.exp_label_tab1.pack(anchor=tk.W, pady=(5, 0))

        # Zakładka 2: Zakup rozwinięć
        tab2 = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab2, text="Zakup rozwinięć")
        ttk.Label(tab2, text="Wybierz cechę lub umiejętność:").grid(row=0, column=0, sticky=tk.W)
        all_names = list(self.cechy.keys()) + list(self.umiejetnosci.keys())
        self.selection_var = tk.StringVar()
        self.combo = ttk.Combobox(tab2, textvariable=self.selection_var, values=all_names, state="readonly")
        self.combo.grid(row=0, column=1, padx=5, pady=2, sticky=tk.W)
        self.combo.bind("<<ComboboxSelected>>", self.update_cost_label)
        ttk.Label(tab2, text="Ilość rozwinięć:").grid(row=1, column=0, sticky=tk.W, pady=(5, 0))
        self.num_var = tk.IntVar(value=1)
        # Spinbox do wyboru liczby rozwinięć (od 1 do 100, można wpisać ręcznie większą)
        self.num_spin = ttk.Spinbox(tab2, from_=1, to=100, textvariable=self.num_var, width=5)
        self.num_spin.grid(row=1, column=1, sticky=tk.W, pady=(5, 0))
        try:
            self.num_spin.config(command=self.update_cost_label)
        except:
            self.num_var.trace_add("write", lambda *args: self.update_cost_label())
        # Etykieta wyświetlająca koszt wybranych rozwinięć
        self.cost_label = ttk.Label(tab2, text="Koszt: -")
        self.cost_label.grid(row=2, column=0, columnspan=2, sticky=tk.W, pady=(5, 0))
        # Przycisk zakupu
        buy_btn = ttk.Button(tab2, text="Kup rozwinięcia", command=self.on_buy)
        buy_btn.grid(row=3, column=0, columnspan=2, pady=10)

        # Zakładka 3: Dodawanie doświadczenia
        tab3 = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab3, text="Dodaj doświadczenie")
        ttk.Label(tab3, text="Ilość doświadczenia do dodania:").grid(row=0, column=0, sticky=tk.W)
        self.add_exp_var = tk.StringVar()
        add_entry = ttk.Entry(tab3, textvariable=self.add_exp_var, width=10)
        add_entry.grid(row=0, column=1, pady=5, sticky=tk.W)
        add_btn = ttk.Button(tab3, text="Dodaj", command=self.on_add_experience)
        add_btn.grid(row=1, column=0, columnspan=2, pady=5)
        add_entry.bind("<Return>", lambda e: self.on_add_experience())

        # Zakładka 4: Wyświetlanie maksymalnych rozwinięć
        tab4 = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab4, text="Maksymalne rozwinięcia")
        ttk.Label(tab4, text="CECHY:").pack(anchor=tk.W)
        columns_max_attr = ("Cecha", "Wartość", "Rozwinięcia", "Maks. rozwinięć")
        self.max_attr_tree = ttk.Treeview(tab4, columns=columns_max_attr, show="headings")
        for col in columns_max_attr:
            self.max_attr_tree.heading(col, text=col)
            self.max_attr_tree.column(col, width=120 if col == "Cecha" else 110, anchor=tk.CENTER)
        self.max_attr_tree.pack(fill=tk.X, pady=5)
        ttk.Label(tab4, text="UMIEJĘTNOŚCI:").pack(anchor=tk.W, pady=(10, 0))
        columns_max_skill = ("Umiejętność", "Wartość", "Rozwinięcia", "Maks. rozwinięć")
        self.max_skill_tree = ttk.Treeview(tab4, columns=columns_max_skill, show="headings")
        for col in columns_max_skill:
            self.max_skill_tree.heading(col, text=col)
            self.max_skill_tree.column(col, width=180 if col == "Umiejętność" else 110, anchor=tk.CENTER)
        self.max_skill_tree.pack(fill=tk.BOTH, expand=True, pady=5)
        ttk.Label(tab4, text="Maksymalne rozwinięcia uwzględniają posiadane rozwinięcia oraz koszt kolejnych rozwinięć.").pack(anchor=tk.W, pady=(5, 0))

        # Zakładka 5: Historia działań
        tab5 = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab5, text="Historia")
        self.history_text = tk.Text(tab5, height=15, width=100)
        self.history_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll = ttk.Scrollbar(tab5, orient=tk.VERTICAL, command=self.history_text.yview)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.history_text.configure(yscrollcommand=scroll.set, state="disabled")

        # Zachowanie bazowych wartości rozwinięć (do cofania)
        for cecha, data in self.cechy.items():
            data["base_rozw"] = data["rozwinieta"]
        for um, data in self.umiejetnosci.items():
            data["base_rozw"] = data["rozwinieta"]

        # Inicjalizacja wyświetlanych danych
        self.refresh_tab1_display()
        self.refresh_tab4_display()

        # Dodanie podpowiedzi (tooltipów) do elementów
        ToolTip(pd_entry, "Aktualne dostępne PD postaci")
        ToolTip(save_btn, "Zapisz zmiany do pliku")
        ToolTip(reset_btn, "Przywróć dane z pliku (odrzuć niezapisane zmiany)")
        ToolTip(self.combo, "Wybierz cechę lub umiejętność do rozwinięcia")
        ToolTip(self.num_spin, "Wybierz liczbę rozwinięć do zakupu")
        ToolTip(buy_btn, "Zakup wybraną liczbę rozwinięć")
        ToolTip(add_entry, "Wpisz ilość PD do dodania")
        ToolTip(add_btn, "Dodaj PD")
        for cecha, buttons in self.attr_buttons.items():
            ToolTip(buttons["plus"], f"Dodaj rozwinięcie cechy {cecha}")
            ToolTip(buttons["minus"], f"Cofnij rozwinięcie cechy {cecha} (tylko bieżącej sesji)")
        for um, buttons in self.skill_buttons.items():
            ToolTip(buttons["plus"], f"Dodaj rozwinięcie umiejętności {um}")
            ToolTip(buttons["minus"], f"Cofnij rozwinięcie umiejętności {um} (tylko bieżącej sesji)")

    def update_button_states(self):
        """Aktualizuje kolory przycisków plus/minus w zakładce Dane postaci."""
        for cecha, buttons in self.attr_buttons.items():
            current_adv = self.cechy[cecha]["rozwinieta"]
            cost = calculate_total_experience("cecha", current_adv, 1)
            if self.exp["aktualne"] >= cost and cost > 0:
                buttons["plus"].config(fg="green")
            else:
                buttons["plus"].config(fg="red")
            if self.cechy[cecha]["rozwinieta"] > self.cechy[cecha]["base_rozw"]:
                buttons["minus"].config(fg="green")
            else:
                buttons["minus"].config(fg="red")
        for um, buttons in self.skill_buttons.items():
            current_adv = self.umiejetnosci[um]["rozwinieta"]
            cost = calculate_total_experience("umiejetnosc", current_adv, 1)
            if self.exp["aktualne"] >= cost and cost > 0:
                buttons["plus"].config(fg="green")
            else:
                buttons["plus"].config(fg="red")
            if self.umiejetnosci[um]["rozwinieta"] > self.umiejetnosci[um]["base_rozw"]:
                buttons["minus"].config(fg="green")
            else:
                buttons["minus"].config(fg="red")

    def update_cost_label(self, event=None):
        """Aktualizuje etykietę kosztu rozwinięć na zakładce Zakup rozwinięć."""
        name = self.selection_var.get()
        try:
            count = int(self.num_var.get())
        except:
            count = 0
        if not name or count <= 0:
            self.cost_label.config(text="Koszt: -")
            return
        if name in self.cechy:
            current_adv = self.cechy[name]["rozwinieta"]
            cost = calculate_total_experience("cecha", current_adv, count)
        elif name in self.umiejetnosci:
            current_adv = self.umiejetnosci[name]["rozwinieta"]
            cost = calculate_total_experience("umiejetnosc", current_adv, count)
        else:
            self.cost_label.config(text="Koszt: -")
            return
        self.cost_label.config(text=f"Koszt: {cost} PD")

    def on_buy(self):
        """Obsługa zakupu rozwinięć po kliknięciu przycisku 'Kup rozwinięcia'."""
        name = self.selection_var.get()
        if not name:
            messagebox.showwarning("Brak wyboru", "Wybierz najpierw cechę lub umiejętność do rozwinięcia.")
            return
        try:
            ilosc_rozw = int(self.num_var.get())
        except:
            messagebox.showerror("Błędna wartość", "Podaj poprawną liczbę rozwinięć.")
            return
        if ilosc_rozw <= 0:
            messagebox.showerror("Błędna wartość", "Ilość rozwinięć musi być co najmniej 1.")
            return

        if name in self.cechy:
            typ = "cecha"
            current_adv = self.cechy[name]["rozwinieta"]
        elif name in self.umiejetnosci:
            typ = "umiejetnosc"
            current_adv = self.umiejetnosci[name]["rozwinieta"]
        else:
            messagebox.showerror("Nie znaleziono", f"'{name}' nie jest poprawną nazwą cechy ani umiejętności.")
            return

        koszt = calculate_total_experience(typ, current_adv, ilosc_rozw)
        if self.exp["aktualne"] < koszt:
            messagebox.showerror("Za mało PD", "Brak wystarczającej ilości doświadczenia na zakup tylu rozwinięć.")
            return

        self.exp["wydane"] += koszt
        self.exp["aktualne"] -= koszt
        self.exp["suma"] = self.exp["aktualne"] + self.exp["wydane"]

        if typ == "cecha":
            self.cechy[name]["rozwinieta"] += ilosc_rozw
            self.cechy[name]["wartosc"] += ilosc_rozw
            for um, data in self.umiejetnosci.items():
                if data["cecha"].strip("()") == name:
                    data["wartosc"] += ilosc_rozw
                    data["suma"] += ilosc_rozw
        else:
            self.umiejetnosci[name]["rozwinieta"] += ilosc_rozw
            self.umiejetnosci[name]["suma"] += ilosc_rozw

        # messagebox.showinfo("Zakupiono", f"Zakupiono {ilosc_rozw} rozwinięć dla \"{name}\".")
        self.add_history(f"Zakupiono {ilosc_rozw} rozwinięć dla {name} (koszt: {koszt} PD).")
        self.pd_var.set(str(self.exp["aktualne"]))
        self.last_valid_pd = self.exp["aktualne"]
        self.refresh_tab1_display()
        self.refresh_tab4_display()
        self.update_cost_label()

    def on_add_experience(self):
        """Obsługa dodawania doświadczenia po kliknięciu 'Dodaj'."""
        try:
            amount = int(self.add_exp_var.get())
        except:
            messagebox.showerror("Błędna wartość", "Podaj poprawną liczbę doświadczenia do dodania.")
            return
        if amount <= 0:
            messagebox.showerror("Błędna wartość", "Ilość dodawanego doświadczenia musi być większa od 0.")
            return

        self.exp["aktualne"] += amount
        self.exp["suma"] = self.exp["aktualne"] + self.exp["wydane"]
        messagebox.showinfo("Doświadczenie dodane", f"Dodano {amount} PD.\nAktualne dostępne doświadczenie: {self.exp['aktualne']}.\nAktualna suma doświadczenia: {self.exp['suma']}.")
        self.add_history(f"Dodano {amount} PD (aktualne PD: {self.exp['aktualne']}, suma PD: {self.exp['suma']}).")
        self.pd_var.set(str(self.exp["aktualne"]))
        self.last_valid_pd = self.exp["aktualne"]
        self.refresh_tab1_display()
        self.refresh_tab4_display()
        self.add_exp_var.set("")

    def on_pd_change(self, event=None):
        """Aktualizacja danych przy ręcznej zmianie pola PD na górze okna."""
        text = self.pd_var.get().strip()
        if text == "":
            return
        try:
            new_val = int(text)
        except:
            messagebox.showerror("Błędna wartość", "Wartość doświadczenia musi być liczbą całkowitą.")
            self.pd_var.set(str(self.last_valid_pd))
            return
        if new_val < 0:
            messagebox.showerror("Błędna wartość", "Wartość doświadczenia nie może być ujemna.")
            self.pd_var.set(str(self.last_valid_pd))
            return

        self.exp["aktualne"] = new_val
        self.exp["suma"] = self.exp["aktualne"] + self.exp["wydane"]
        self.last_valid_pd = new_val
        self.refresh_tab1_display()
        self.refresh_tab4_display()

    def on_save(self):
        """Zapisuje aktualny stan do pliku Excel."""
        if not self.file_name:
            messagebox.showerror("Błąd zapisu", "Brak pliku danych – nie można zapisać zmian.")
            return
        try:
            save_data(self.file_name, self.cechy, self.umiejetnosci, self.exp)
        except Exception as e:
            messagebox.showerror("Błąd zapisu", f"Wystąpił błąd podczas zapisu pliku:\n{e}")
            return
        messagebox.showinfo("Zapisano", f"Pomyślnie zapisano zmiany do pliku \"{self.file_name}\".")
        self.add_history("Zapisano zmiany do pliku.")

    def on_reset(self):
        """Przywraca dane pierwotne z pliku (odrzuca niezapisane zmiany)."""
        if not self.file_name:
            return
        confirm = messagebox.askyesno("Potwierdzenie resetu", "Czy na pewno przywrócić dane z pliku? Wszystkie niezapisane zmiany zostaną utracone.")
        if not confirm:
            return
        try:
            self.cechy, self.umiejetnosci, self.exp = load_data(self.file_name)
        except Exception as e:
            messagebox.showerror("Błąd", f"Nie udało się ponownie wczytać pliku:\n{e}")
            return
        for cecha, data in self.cechy.items():
            data["base_rozw"] = data["rozwinieta"]
        for um, data in self.umiejetnosci.items():
            data["base_rozw"] = data["rozwinieta"]
        self.pd_var.set(str(self.exp.get("aktualne", 0)))
        self.last_valid_pd = self.exp.get("aktualne", 0)
        self.refresh_tab1_display()
        self.refresh_tab4_display()
        self.selection_var.set("")
        self.combo.set("")
        self.num_var.set(1)
        self.cost_label.config(text="Koszt: -")
        self.add_exp_var.set("")
        self.add_history("Przywrócono dane z pliku (reset).")

    def refresh_tab1_display(self):
        """Odświeża wyświetlaną listę cech, umiejętności i doświadczenia na zakładce 'Dane postaci'."""
        for cecha, vals in self.cechy.items():
            if cecha in self.attr_labels:
                self.attr_labels[cecha]["poczatkowa"].config(text=str(vals["poczatkowa"]))
                self.attr_labels[cecha]["rozwinieta"].config(text=str(vals["rozwinieta"]))
                self.attr_labels[cecha]["wartosc"].config(text=str(vals["wartosc"]))
        for um, vals in self.umiejetnosci.items():
            if um in self.skill_labels:
                self.skill_labels[um]["wartosc"].config(text=str(vals["wartosc"]))
                self.skill_labels[um]["rozwinieta"].config(text=str(vals["rozwinieta"]))
                self.skill_labels[um]["suma"].config(text=str(vals["suma"]))
        self.exp_label_tab1.config(text=f"DOŚWIADCZENIE: Aktualne: {self.exp['aktualne']}, Wydane: {self.exp['wydane']}, Suma: {self.exp['suma']}")
        self.update_button_states()

    def refresh_tab4_display(self):
        """Odświeża wyświetlaną listę maksymalnych możliwych rozwinięć na zakładce 'Maksymalne rozwinięcia'."""
        for item in self.max_attr_tree.get_children():
            self.max_attr_tree.delete(item)
        for item in self.max_skill_tree.get_children():
            self.max_skill_tree.delete(item)
        for cecha, vals in self.cechy.items():
            max_adv = 0
            available = self.exp["aktualne"]
            current_adv = vals["rozwinieta"]
            while True:
                cost = calculate_total_experience("cecha", current_adv, max_adv + 1)
                if available >= cost:
                    max_adv += 1
                else:
                    break
            self.max_attr_tree.insert("", tk.END, values=(cecha, vals["wartosc"], vals["rozwinieta"], max_adv))
        for um, vals in self.umiejetnosci.items():
            max_adv = 0
            available = self.exp["aktualne"]
            current_adv = vals["rozwinieta"]
            while True:
                cost = calculate_total_experience("umiejetnosc", current_adv, max_adv + 1)
                if available >= cost:
                    max_adv += 1
                else:
                    break
            self.max_skill_tree.insert("", tk.END, values=(um, vals["wartosc"], vals["rozwinieta"], max_adv))

    def on_increase(self, category, name):
        """Dodaje jedno rozwinięcie do podanej cechy lub umiejętności, jeśli to możliwe."""
        if category == "cecha":
            current_adv = self.cechy[name]["rozwinieta"]
            cost = calculate_total_experience("cecha", current_adv, 1)
            if cost == 0:
                return
            if self.exp["aktualne"] < cost:
                messagebox.showerror("Za mało PD", "Brak wystarczającej ilości doświadczenia na rozwinięcie tej cechy.")
                return
            self.exp["wydane"] += cost
            self.exp["aktualne"] -= cost
            self.exp["suma"] = self.exp["aktualne"] + self.exp["wydane"]
            self.cechy[name]["rozwinieta"] += 1
            self.cechy[name]["wartosc"] += 1
            for um, data in self.umiejetnosci.items():
                if data["cecha"].strip("()") == name:
                    data["wartosc"] += 1
                    data["suma"] += 1
            # messagebox.showinfo("Zakupiono", f"Zakupiono 1 rozwinięcie cechy \"{name}\".")
            self.add_history(f"Zakupiono 1 rozwinięcie cechy {name} (koszt: {cost} PD).")
        elif category == "umiejetnosc":
            current_adv = self.umiejetnosci[name]["rozwinieta"]
            cost = calculate_total_experience("umiejetnosc", current_adv, 1)
            if cost == 0:
                return
            if self.exp["aktualne"] < cost:
                messagebox.showerror("Za mało PD", "Brak wystarczającej ilości doświadczenia na rozwinięcie tej umiejętności.")
                return
            self.exp["wydane"] += cost
            self.exp["aktualne"] -= cost
            self.exp["suma"] = self.exp["aktualne"] + self.exp["wydane"]
            self.umiejetnosci[name]["rozwinieta"] += 1
            self.umiejetnosci[name]["suma"] += 1
            # messagebox.showinfo("Zakupiono", f"Zakupiono 1 rozwinięcie umiejętności \"{name}\".")
            self.add_history(f"Zakupiono 1 rozwinięcie umiejętności {name} (koszt: {cost} PD).")
        else:
            return
        self.pd_var.set(str(self.exp["aktualne"]))
        self.last_valid_pd = self.exp["aktualne"]
        self.refresh_tab1_display()
        self.refresh_tab4_display()
        self.update_cost_label()

    def on_decrease(self, category, name):
        """Cofa jedno rozwinięcie dodane w bieżącej sesji z podanej cechy lub umiejętności."""
        if category == "cecha":
            current_adv = self.cechy[name]["rozwinieta"]
            base_adv = self.cechy[name]["base_rozw"]
            if current_adv <= base_adv:
                messagebox.showerror("Nie można cofnąć", "Nie można cofnąć rozwinięcia poniżej wartości z pliku.")
                return
            prev_adv = current_adv - 1
            refund = calculate_total_experience("cecha", prev_adv, 1)
            self.exp["wydane"] -= refund
            self.exp["aktualne"] += refund
            self.exp["suma"] = self.exp["aktualne"] + self.exp["wydane"]
            self.cechy[name]["rozwinieta"] -= 1
            self.cechy[name]["wartosc"] -= 1
            for um, data in self.umiejetnosci.items():
                if data["cecha"].strip("()") == name:
                    data["wartosc"] -= 1
                    data["suma"] -= 1
            # messagebox.showinfo("Cofnięto", f"Cofnięto rozwinięcie cechy \"{name}\".")
            self.add_history(f"Cofnięto 1 rozwinięcie cechy {name} (zwrócono {refund} PD).")
        elif category == "umiejetnosc":
            current_adv = self.umiejetnosci[name]["rozwinieta"]
            base_adv = self.umiejetnosci[name]["base_rozw"]
            if current_adv <= base_adv:
                messagebox.showerror("Nie można cofnąć", "Nie można cofnąć rozwinięcia poniżej wartości z pliku.")
                return
            prev_adv = current_adv - 1
            refund = calculate_total_experience("umiejetnosc", prev_adv, 1)
            self.exp["wydane"] -= refund
            self.exp["aktualne"] += refund
            self.exp["suma"] = self.exp["aktualne"] + self.exp["wydane"]
            self.umiejetnosci[name]["rozwinieta"] -= 1
            self.umiejetnosci[name]["suma"] -= 1
            # messagebox.showinfo("Cofnięto", f"Cofnięto rozwinięcie umiejętności \"{name}\".")
            self.add_history(f"Cofnięto 1 rozwinięcie umiejętności {name} (zwrócono {refund} PD).")
        else:
            return
        self.pd_var.set(str(self.exp["aktualne"]))
        self.last_valid_pd = self.exp["aktualne"]
        self.refresh_tab1_display()
        self.refresh_tab4_display()
        self.update_cost_label()

    def add_history(self, text):
        """Dodaje wpis do historii działań."""
        self.history_text.config(state="normal")
        self.history_text.insert(tk.END, text + "\n")
        self.history_text.see(tk.END)
        self.history_text.config(state="disabled")

    def run(self):
        """Uruchamia pętlę główną tkinter (start GUI)."""
        self.root.mainloop()

class ToolTip:
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tipwindow = None
        widget.bind("<Enter>", self.show_tip)
        widget.bind("<Leave>", self.hide_tip)

    def show_tip(self, event=None):
        if self.tipwindow or not self.text:
            return
        x = self.widget.winfo_rootx() + self.widget.winfo_width() + 3
        y = self.widget.winfo_rooty() + self.widget.winfo_height() // 2
        self.tipwindow = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        label = tk.Label(tw, text=self.text, background="#ffffe0", relief=tk.SOLID, borderwidth=1, font=("TkDefaultFont", 9))
        label.pack(ipadx=1)

    def hide_tip(self, event=None):
        tw = self.tipwindow
        self.tipwindow = None
        if tw:
            tw.destroy()

# Uruchomienie aplikacji (jeśli plik wykonywany bezpośrednio)
if __name__ == "__main__":
    app = CharacterSheetGUI("karta_postaci.xlsx")
    app.run()
