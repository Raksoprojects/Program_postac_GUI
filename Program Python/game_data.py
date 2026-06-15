"""Dostęp do statycznych danych gry WFRP 4ed: profesje, klasy, talenty.

Moduł ładuje pliki z katalogu ``data/`` (dołączanego do .exe przez PyInstaller),
waliduje ich strukturę i udostępnia wygodne akcesory używane przez GUI.
"""

import json
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_DIR = "data"


def resource_path(relative: str) -> Path:
    """Ścieżka do zasobu działająca także w spakowanym .exe (PyInstaller)."""
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return Path(base) / relative
    return Path(__file__).resolve().parent / relative


def _load_json(name: str) -> Any:
    path = resource_path(f"{DATA_DIR}/{name}")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=None)
def load_professions() -> Dict[str, dict]:
    return _load_json("professions.json")


@lru_cache(maxsize=None)
def load_classes() -> Dict[str, dict]:
    return _load_json("classes.json")


@lru_cache(maxsize=None)
def load_talents() -> Dict[str, dict]:
    return _load_json("talents.json")


# ---------------------------------------------------------------------------
# Akcesory
# ---------------------------------------------------------------------------

def get_profession(name: str) -> Optional[dict]:
    return load_professions().get(name)


def get_class(name: str) -> Optional[dict]:
    return load_classes().get(name)


def get_talent(name: str) -> Optional[dict]:
    return load_talents().get(name)


def all_profession_names() -> List[str]:
    return sorted(load_professions().keys())


def all_class_names() -> List[str]:
    return list(load_classes().keys())


def all_talent_names() -> List[str]:
    return sorted(load_talents().keys())


def careers_for_class(class_name: str) -> List[str]:
    cls = get_class(class_name)
    return list(cls["careers"]) if cls else []


def class_of_career(career_name: str) -> Optional[str]:
    prof = get_profession(career_name)
    if prof and prof.get("class"):
        return prof["class"]
    for cname, cdata in load_classes().items():
        if career_name in cdata.get("careers", []):
            return cname
    return None


def attribute_bonus(value: int) -> int:
    """Bonus z cechy = cyfra dziesiątek (np. 37 -> 3)."""
    try:
        return max(0, int(value)) // 10
    except (TypeError, ValueError):
        return 0


def talent_max(talent_name: str, attributes: Optional[Dict[str, int]] = None) -> Optional[int]:
    """Zwraca twardy limit wykupień talentu.

    ``None`` oznacza brak ograniczenia (Maksimum: brak) lub limit specjalny,
    którego nie da się policzyć automatycznie.
    """
    talent = get_talent(talent_name)
    if not talent:
        return None
    info = talent.get("max", {})
    kind = info.get("type")
    if kind == "fixed":
        return info.get("value")
    if kind == "characteristic":
        attr = info.get("attr")
        if attributes and attr in attributes:
            return max(1, attribute_bonus(attributes[attr]))
        return None
    # "none" (brak) oraz "special" -> brak twardego limitu liczbowego
    return None


# ---------------------------------------------------------------------------
# Profesje: tytuły poziomów, dopasowanie, koszty przejść, kompletowanie
# ---------------------------------------------------------------------------

def _normalize(text: Optional[str]) -> str:
    """Normalizuje tekst do porównań: małe litery, bez nadmiarowych spacji."""
    if not text:
        return ""
    return " ".join(str(text).strip().lower().split())


# Mapa pełnych nazw cech (jak w professions.json) na kody używane w GUI.
CHARACTERISTIC_NAME_TO_CODE = {
    "walka wręcz": "WW",
    "umiejętności strzeleckie": "US",
    "siła": "S",
    "wytrzymałość": "Wt",
    "inicjatywa": "I",
    "zwinność": "Zw",
    "zręczność": "Zr",
    "inteligencja": "Int",
    "siła woli": "SW",
    "ogłada": "Ogd",
}

_CHARACTERISTIC_CODES = {"WW", "US", "S", "Wt", "I", "Zw", "Zr", "Int", "SW", "Ogd"}


def characteristic_to_code(name: str) -> str:
    """Zwraca kod cechy (np. 'Wt') dla pełnej nazwy lub kodu.

    Akceptuje zarówno pełne nazwy ("Wytrzymałość"), jak i gotowe kody ("Wt").
    Zwraca pusty string dla nieznanych wartości.
    """
    if not name:
        return ""
    raw = str(name).strip()
    if raw in _CHARACTERISTIC_CODES:
        return raw
    return CHARACTERISTIC_NAME_TO_CODE.get(_normalize(raw), "")


def profession_level_titles(profession_name: str) -> Dict[int, str]:
    """Zwraca mapę {poziom: tytuł} dla danej profesji."""
    prof = get_profession(profession_name)
    if not prof:
        return {}
    return {lvl.get("level"): lvl.get("title", "") for lvl in prof.get("levels", [])}


def find_career_by_title(title: str) -> List[Dict]:
    """Szuka profesji, w której tytuł poziomu odpowiada podanemu tekstowi.

    Zwraca listę dopasowań ``{profession, level, title}`` (może być pusta,
    np. dla profesji z dodatków spoza podstawki).
    """
    target = _normalize(title)
    if not target:
        return []
    matches: List[Dict] = []
    professions = load_professions()
    # Najpierw: tytuł poziomu == nazwa profesji (klucz)
    for name in professions:
        if _normalize(name) == target:
            level = professions[name]["levels"][0].get("level", 1) if professions[name].get("levels") else 1
            matches.append({"profession": name, "level": level, "title": name})
    # Następnie: tytuł konkretnego poziomu
    for name, prof in professions.items():
        for lvl in prof.get("levels", []):
            if _normalize(lvl.get("title")) == target:
                matches.append(
                    {"profession": name, "level": lvl.get("level"), "title": lvl.get("title")}
                )
    # Usuń duplikaty zachowując kolejność
    seen = set()
    unique = []
    for match in matches:
        key = (match["profession"], match["level"])
        if key not in seen:
            seen.add(key)
            unique.append(match)
    return unique


def resolve_career_path(path_text: str) -> List[Dict]:
    """Rozbija tekst ścieżki profesji (rozdzielony przecinkami) na kroki.

    Każdy krok: ``{title, profession|None, level|None, resolved:bool}``.
    Nierozpoznane tytuły (np. z dodatków) mają ``resolved=False``.
    """
    steps: List[Dict] = []
    if not path_text:
        return steps
    for raw in str(path_text).split(","):
        title = raw.strip()
        if not title:
            continue
        candidates = find_career_by_title(title)
        if candidates:
            best = candidates[0]
            steps.append(
                {
                    "title": title,
                    "profession": best["profession"],
                    "level": best["level"],
                    "resolved": True,
                }
            )
        else:
            steps.append(
                {"title": title, "profession": None, "level": None, "resolved": False}
            )
    return steps


def parse_career_level(level_text: str) -> Optional[int]:
    """Wyciąga numer poziomu z tekstu pola PDF, np. 'Piromanta (2)' -> 2."""
    if not level_text:
        return None
    import re

    match = re.search(r"\((\d)\)", str(level_text))
    if match:
        return int(match.group(1))
    return None


def career_transition_cost(
    current_completed: bool,
    same_class: bool,
) -> int:
    """Koszt przejścia/awansu profesji wg WFRP 4ed.

    - 100 PD: obecna profesja SKOMPLETOWANA i przejście w tej samej klasie
      (kolejny poziom tej samej profesji lub inna profesja tej samej klasy),
    - 200 PD: obecna profesja NIESKOMPLETOWANA,
    - +100 PD: zmiana klasy (czyli 200 lub 300 PD).
    """
    if current_completed and same_class:
        return 100
    base = 100 if current_completed else 200
    if not same_class:
        base += 100
    return base


def is_career_completed(
    profession_name: str,
    level: int,
    skills: Optional[Dict[str, Dict]] = None,
    talents: Optional[Dict[str, Dict]] = None,
    attributes: Optional[Dict[str, Dict]] = None,
) -> Dict[str, Any]:
    """Sprawdza kompletowanie profesji na danym poziomie.

    Kryteria WFRP 4ed:
    - >=8 umiejętności zawodowych, każda rozwinięta o >= 5*poziom,
    - >=1 talent zawodowy rozwinięty o >= 1*poziom,
    - wszystkie rozwijalne cechy poziomu rozwinięte o >= 5*poziom.

    Zwraca szczegóły ``{completed, skills_ok, talents_ok, characteristics_ok,
    skills_done, talents_done, characteristics_pending}``.
    Gdy cechy poziomu są nieuzupełnione (characteristics_pending), kryterium
    cech jest pomijane (traktowane jako spełnione) i ustawiana jest flaga.
    """
    prof = get_profession(profession_name)
    result = {
        "completed": False,
        "skills_ok": False,
        "talents_ok": False,
        "characteristics_ok": False,
        "skills_done": 0,
        "talents_done": 0,
        "characteristics_pending": False,
    }
    if not prof:
        return result

    level_data = None
    for lvl in prof.get("levels", []):
        if lvl.get("level") == level:
            level_data = lvl
            break
    if not level_data:
        return result

    skills = skills or {}
    talents = talents or {}
    attributes = attributes or {}

    skill_threshold = 5 * level
    scheme_skills = level_data.get("skills", [])
    skills_done = 0
    for skill_name in scheme_skills:
        owned = _find_owned_skill(skills, skill_name)
        if owned is not None and owned.get("advanced", 0) >= skill_threshold:
            skills_done += 1
    result["skills_done"] = skills_done
    result["skills_ok"] = skills_done >= 8

    talent_threshold = 1 * level
    scheme_talents = level_data.get("talents", [])
    talents_done = 0
    for talent_name in scheme_talents:
        owned = talents.get(talent_name)
        if owned and owned.get("advances", 0) >= talent_threshold:
            talents_done += 1
    result["talents_done"] = talents_done
    result["talents_ok"] = talents_done >= 1

    scheme_chars = level_data.get("characteristics", [])
    if prof.get("characteristics_pending") or not scheme_chars:
        result["characteristics_pending"] = True
        result["characteristics_ok"] = True
    else:
        char_threshold = 5 * level
        chars_ok = True
        for char_code in scheme_chars:
            attr = attributes.get(char_code)
            if not attr or attr.get("advanced", 0) < char_threshold:
                chars_ok = False
                break
        result["characteristics_ok"] = chars_ok

    result["completed"] = (
        result["skills_ok"] and result["talents_ok"] and result["characteristics_ok"]
    )
    return result


def _find_owned_skill(skills: Dict[str, Dict], scheme_name: str) -> Optional[Dict]:
    """Dopasowuje umiejętność ze schematu do posiadanej (z uwzgl. specjalizacji)."""
    if scheme_name in skills:
        return skills[scheme_name]
    target = _normalize(scheme_name)
    base_target = target.split("(")[0].strip()
    for owned_name, data in skills.items():
        owned_norm = _normalize(owned_name)
        if owned_norm == target:
            return data
        # umiejętność grupowa: "Wiedza (...)" pasuje do dowolnej specjalizacji
        if "(" in scheme_name and scheme_name.split("(")[0].strip().lower() == owned_norm.split("(")[0].strip():
            if "dowoln" in target or "...)" in target or target.endswith("()"):
                return data
    return None


# ---------------------------------------------------------------------------
# Rozwijalność (gating) – co można rozwijać w ramach bieżącej profesji
# ---------------------------------------------------------------------------

def get_career_developable(
    profession_name: Optional[str],
    current_level: int,
    owned_talents: Optional[Dict[str, Dict]] = None,
) -> Dict[str, Any]:
    """Zbiory elementów rozwijalnych "w profesji" dla danego poziomu.

    Zasady WFRP 4ed (przeliczane po każdej zmianie profesji/poziomu):
    - CECHY: wszystkie z poziomów 1..obecny obecnej profesji.
    - UMIEJĘTNOŚCI: wszystkie z poziomów 1..obecny.
    - TALENTY: z obecnego poziomu (świeży zakup) ORAZ talenty schematu
      z niższych poziomów już wykupione (advances >= 1) – mogą rosnąć do Max.
      Talenty z niższych poziomów NIE wykupione = spoza profesji.

    Zwraca ``{characteristics:set, skills:set, talents:set, resolved:bool}``.
    Dla profesji spoza podstawki (brak danych) ``resolved=False`` i puste zbiory
    (cały rozwój liczony jako spoza profesji / ręcznie).
    """
    result: Dict[str, Any] = {
        "characteristics": set(),
        "skills": set(),
        "talents": set(),
        "resolved": False,
    }
    prof = get_profession(profession_name) if profession_name else None
    if not prof:
        return result
    result["resolved"] = True
    owned_talents = owned_talents or {}
    for lvl in prof.get("levels", []):
        lvl_num = lvl.get("level")
        if lvl_num is None or lvl_num > current_level:
            continue
        for char_code in lvl.get("characteristics", []):
            code = characteristic_to_code(char_code)
            if code:
                result["characteristics"].add(code)
        for skill_name in lvl.get("skills", []):
            result["skills"].add(skill_name)
        for talent_name in lvl.get("talents", []):
            if lvl_num == current_level:
                result["talents"].add(talent_name)
            else:
                owned = owned_talents.get(talent_name)
                if owned and owned.get("advances", 0) >= 1:
                    result["talents"].add(talent_name)
    return result


def is_characteristic_developable(char_code: str, developable: Dict[str, Any]) -> bool:
    """Czy cecha (kod, np. 'WW') jest rozwijalna w profesji."""
    return char_code in developable.get("characteristics", set())


def is_skill_developable(skill_name: str, developable: Dict[str, Any]) -> bool:
    """Czy umiejętność (z uwzgl. specjalizacji/grupy) jest rozwijalna w profesji."""
    scheme = developable.get("skills", set())
    if not scheme:
        return False
    if skill_name in scheme:
        return True
    target = _normalize(skill_name)
    base_target = target.split("(")[0].strip()
    for scheme_name in scheme:
        scheme_norm = _normalize(scheme_name)
        if scheme_norm == target:
            return True
        scheme_base = scheme_norm.split("(")[0].strip()
        if "(" not in scheme_name and scheme_base == base_target:
            return True
        # schemat grupowy "Wiedza (dowolna)" pasuje do każdej specjalizacji
        if "(" in scheme_name and scheme_base == base_target:
            if "dowoln" in scheme_norm or "..." in scheme_norm or scheme_norm.endswith("()"):
                return True
            # konkretna specjalizacja schematu == konkretna posiadana
            if scheme_norm == target:
                return True
    return False


def is_talent_developable(talent_name: str, developable: Dict[str, Any]) -> bool:
    """Czy talent jest rozwijalny w profesji (obecny poziom lub już wykupiony)."""
    return talent_name in developable.get("talents", set())


# ---------------------------------------------------------------------------
# Walidacja
# ---------------------------------------------------------------------------

_LEVEL_KEYS = {"level", "title", "status", "characteristics", "skills", "talents", "trappings"}


def validate_data() -> Dict[str, List[str]]:
    """Sprawdza spójność danych. Zwraca {'errors': [...], 'warnings': [...]}."""
    errors: List[str] = []
    warnings: List[str] = []

    professions = load_professions()
    classes = load_classes()
    talents = load_talents()

    if not professions:
        errors.append("Brak profesji w professions.json")
    if not classes:
        errors.append("Brak klas w classes.json")
    if not talents:
        errors.append("Brak talentów w talents.json")

    # profesje: 4 poziomy, poprawne pola, klasa istnieje
    for name, prof in professions.items():
        levels = prof.get("levels", [])
        if len(levels) != 4:
            errors.append(f"Profesja '{name}' ma {len(levels)} poziomów (oczekiwano 4)")
        for lvl in levels:
            missing = _LEVEL_KEYS - set(lvl.keys())
            if missing:
                errors.append(f"Profesja '{name}' poziom {lvl.get('level')} brak pól: {missing}")
        cls = prof.get("class")
        if cls and cls not in classes:
            errors.append(f"Profesja '{name}' wskazuje nieznaną klasę '{cls}'")
        if prof.get("characteristics_pending"):
            warnings.append(f"Profesja '{name}': cechy do rozwoju nieuzupełnione (characteristics_pending)")

    # klasy: każda profesja istnieje, zgodność klasy
    all_career_refs = []
    for cname, cdata in classes.items():
        careers = cdata.get("careers", [])
        all_career_refs.extend(careers)
        for c in careers:
            if c not in professions:
                errors.append(f"Klasa '{cname}' wskazuje nieznaną profesję '{c}'")
            elif professions[c].get("class") != cname:
                errors.append(
                    f"Niespójna klasa dla '{c}': classes='{cname}' vs professions='{professions[c].get('class')}'"
                )
    # profesje bez przypisania do klasy
    for name in professions:
        if name not in all_career_refs:
            errors.append(f"Profesja '{name}' nie należy do żadnej klasy")

    # talenty: poprawny typ Maksimum
    valid_max = {"none", "fixed", "characteristic", "special"}
    for tname, t in talents.items():
        mtype = t.get("max", {}).get("type")
        if mtype not in valid_max:
            errors.append(f"Talent '{tname}' ma niepoprawny typ Maksimum: {mtype}")
        if not t.get("description"):
            warnings.append(f"Talent '{tname}' bez opisu")

    return {"errors": errors, "warnings": warnings}


if __name__ == "__main__":
    result = validate_data()
    report = resource_path("_pdf_extract/game_data_validation.txt")
    lines = [
        f"Profesje: {len(load_professions())}",
        f"Klasy: {len(load_classes())}",
        f"Talenty: {len(load_talents())}",
        f"BŁĘDY: {len(result['errors'])}",
        *[f"  ! {e}" for e in result["errors"]],
        f"OSTRZEŻENIA: {len(result['warnings'])}",
        *[f"  ~ {w}" for w in result["warnings"][:10]],
        f"  ... (łącznie {len(result['warnings'])} ostrzeżeń)",
    ]
    try:
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text("\n".join(lines), encoding="utf-8")
    except OSError:
        pass
    print(f"Walidacja zakończona: {len(result['errors'])} błędów, {len(result['warnings'])} ostrzeżeń")
