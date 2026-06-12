"""Reguły gry niezależne od interfejsu (UI-agnostic).

Zawiera czyste funkcje i stałe opisujące koszty rozwoju postaci w WFRP 4ed.
Moduł nie importuje żadnych bibliotek UI, dzięki czemu może być użyty zarówno
przez aplikację desktopową, jak i w środowisku web (np. PyScript/Pyodide).
"""

from __future__ import annotations

# Tabela kosztów rozwinięć (próg sumarycznych rozwinięć -> (koszt cechy, koszt umiejętności)).
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

# Kolejność głównych cech postaci.
ATTRIBUTES = ["WW", "US", "S", "Wt", "I", "Zw", "Zr", "Int", "SW", "Ogd"]

# Koszt jednego rozwinięcia talentu (WFRP 4ed: 100 PD za każde wykupienie).
TALENT_COST_PER_ADVANCE = 100


def calculate_advancement_cost(
    advancement_type: str,
    current_advancements: int,
    desired_advancements: int,
    out_of_profession: bool = False,
    gm_approved: bool = False,
) -> int:
    """Oblicza całkowity koszt PD dla rozwinięć.

    Rozwój SPOZA profesji podwaja koszt, chyba że MG wyraził zgodę (gm_approved).
    """
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

                remaining -= to_threshold
                current_threshold += to_threshold
                if remaining == 0:
                    break

    if out_of_profession and not gm_approved:
        total_cost *= 2
    return total_cost


def calculate_talent_cost(
    current_advances: int,
    amount: int = 1,
    out_of_profession: bool = False,
    gm_approved: bool = False,
) -> int:
    """Koszt PD za zakup 'amount' kolejnych wykupień talentu.

    Każde wykupienie kosztuje 100 PD pomnożone przez jego numer: pierwsze 100,
    drugie 200, trzecie 300 itd. Mając już ``current_advances`` wykupień, koszt
    kolejnych to suma ``100 * (current_advances + k)`` dla ``k = 1..amount``.
    Rozwój spoza profesji podwaja koszt, chyba że MG wyraził zgodę.
    """
    current = max(0, current_advances)
    count = max(0, amount)
    cost = sum(
        TALENT_COST_PER_ADVANCE * (current + step) for step in range(1, count + 1)
    )
    if out_of_profession and not gm_approved:
        cost *= 2
    return cost
