"""Pakiet `core` — logika gry niezależna od interfejsu użytkownika.

Eksportuje reguły kosztów rozwoju postaci (WFRP 4ed) oraz model postaci
(:class:`DataManager`), współdzielone przez aplikację desktopową oraz przyszłe
środowisko web.
"""

from core.character import (
    CHARACTER_JSON_SCHEMA,
    CHARACTER_JSON_VERSION,
    DataManager,
    EMPTY_PDF_TEMPLATE,
    FILE_TYPE_EXCEL,
    FILE_TYPE_JSON,
    FILE_TYPE_PDF,
)
from core.rules import (
    ATTRIBUTES,
    COST_TABLE,
    TALENT_COST_PER_ADVANCE,
    calculate_advancement_cost,
    calculate_talent_cost,
)

__all__ = [
    "ATTRIBUTES",
    "COST_TABLE",
    "TALENT_COST_PER_ADVANCE",
    "calculate_advancement_cost",
    "calculate_talent_cost",
    "DataManager",
    "FILE_TYPE_EXCEL",
    "FILE_TYPE_PDF",
    "FILE_TYPE_JSON",
    "CHARACTER_JSON_SCHEMA",
    "CHARACTER_JSON_VERSION",
    "EMPTY_PDF_TEMPLATE",
]
