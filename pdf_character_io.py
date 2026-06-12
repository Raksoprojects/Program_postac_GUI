"""Utilities for loading and saving Warhammer character data from PDF forms."""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, Optional

from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, NameObject


PDF_ATTRIBUTE_FIELDS = {
    "WW": {
        "initial": "ww_poczatkowa",
        "advanced": "ww_rozwieniecie",
        "current": "ww_aktualna",
    },
    "US": {
        "initial": "us_poczatkowa",
        "advanced": "us_rozwienicie",
        "current": "us_aktualna",
    },
    "S": {
        "initial": "s_poczatkowa",
        "advanced": "s_rozwienicie",
        "current": "s_aktualna",
    },
    "Wt": {
        "initial": "wt_poczatkowa",
        "advanced": "wt_rozwienicie",
        "current": "wt_aktualna",
    },
    "I": {
        "initial": "i_poczatkowa",
        "advanced": "i_rozwienicie",
        "current": "i_aktualna",
    },
    "Zw": {
        "initial": "zw_poczatkowa",
        "advanced": "zw_rozwienicie",
        "current": "zw_aktualna",
    },
    "Zr": {
        "initial": "zr_poczatkowa",
        "advanced": "zr_rozwienicie",
        "current": "zr_aktualna",
    },
    "Int": {
        "initial": "int_poczatkowa",
        "advanced": "int_rozwienicie",
        "current": "int_aktualna",
    },
    "SW": {
        "initial": "sw_poczatkowa",
        "advanced": "sw_rozwienicie",
        "current": "sw_aktualna",
    },
    "Ogd": {
        "initial": "ogd_poczatkowa",
        "advanced": "ogd_rozwienicie",
        "current": "ogd_aktualna",
    },
}

PDF_BASIC_SKILL_LAYOUT = [
    {
        "name": "Atletyka",
        "attribute": "Zw",
        "advanced_field": "atletyka_zw_cecha_rozwiniecie",
        "total_field": "umtotal1",
    },
    {
        "name": "Broń Biała (Podstawowa)",
        "attribute": "WW",
        "advanced_field": "bb_rozwiniecie",
        "total_field": "umtotal2",
    },
    {
        "name": "Broń Biała ({specialization})",
        "attribute": "WW",
        "advanced_field": "bb_x_rozwiniecie",
        "total_field": "umtotal3",
        "specialization_field": "bronbia_ax",
    },
    {
        "name": "Charyzma",
        "attribute": "Ogd",
        "advanced_field": "charyzma_ogd_cecha_rozwiniecie",
        "total_field": "umtotal4",
    },
    {
        "name": "Dowodzenie",
        "attribute": "Ogd",
        "advanced_field": "dowodzenie_ogd_cecha_rozwiniecie",
        "total_field": "umtotal5",
    },
    {
        "name": "Hazard",
        "attribute": "Int",
        "advanced_field": "hazard_int_cecha_rozwiniecie",
        "total_field": "umtotal6",
    },
    {
        "name": "Intuicja",
        "attribute": "I",
        "advanced_field": "intuicja_i_cecha_rozwiniecie",
        "total_field": "umtotal7",
    },
    {
        "name": "Jeździectwo",
        "attribute": "Zw",
        "advanced_field": "jezdziectwo_zw_cecha_rozwieniecie",
        "total_field": "umtotal8",
    },
    {
        "name": "Mocna głowa",
        "attribute": "Wt",
        "advanced_field": "mocna_g_owa_cecha_wt_rozwiniecie",
        "total_field": "umtotal9",
    },
    {
        "name": "Nawigacja",
        "attribute": "I",
        "advanced_field": "nawigacja_cecha_i_rozwiniecie",
        "total_field": "umtotal10",
    },
    {
        "name": "Odporność",
        "attribute": "Wt",
        "advanced_field": "odporno_wt_cecha_rozwiniecie",
        "total_field": "umtotal11",
    },
    {
        "name": "Opanowanie",
        "attribute": "SW",
        "advanced_field": "opanowanie_sw_sw_cecha_rozwiniecie",
        "total_field": "umtotal12",
    },
    {
        "name": "Oswajanie",
        "attribute": "SW",
        "advanced_field": "oswajanie_cecha_sw_rozwiniecie",
        "total_field": "umtotal13",
    },
    {
        "name": "Percepcja",
        "attribute": "I",
        "advanced_field": "percepcja_cecha_i_rozwiniecie",
        "total_field": "umtotal14",
    },
    {
        "name": "Plotkowanie",
        "attribute": "Ogd",
        "advanced_field": "plotkowanie_cecha_ogd_rozwiniecie",
        "total_field": "umtotal15",
    },
    {
        "name": "Powożenie",
        "attribute": "Zw",
        "advanced_field": "powo_enie_zw_cecha_rozwiniecie",
        "total_field": "umtotal16",
    },
    {
        "name": "Przekupstwo",
        "attribute": "Ogd",
        "advanced_field": "przekupstwo_cecha_ogd_rozwiniecie",
        "total_field": "umtotal17",
    },
    {
        "name": "Skradanie ({specialization})",
        "attribute": "Zw",
        "advanced_field": "skradanie_zw_cecha_rozwiniecie",
        "total_field": "umtotal18",
        "specialization_field": "skradaniex",
    },
    {
        "name": "Sztuka ({specialization})",
        "attribute": "Zr",
        "advanced_field": "sztuka_cecha_zr_rozwieniecie",
        "total_field": "umtotal19",
        "specialization_field": "sztuka_x",
    },
    {
        "name": "Sztuka Przetrwania",
        "attribute": "Int",
        "advanced_field": "sztuka_przetrwania_int_cecha_rozwiniecie",
        "total_field": "umtotal20",
    },
    {
        "name": "Targowanie",
        "attribute": "Ogd",
        "advanced_field": "targowanie_ogd_cecha_rozwiniecie",
        "total_field": "umtotal21",
    },
    {
        "name": "Unik",
        "attribute": "Zw",
        "advanced_field": "unik_zw_cecha_rozwiniecie",
        "total_field": "umtotal22",
    },
    {
        "name": "Wioślarstwo",
        "attribute": "S",
        "advanced_field": "wioslarstwo_cecha_s_roziwniecie",
        "total_field": "umtotal23",
    },
    {
        "name": "Wspinaczka",
        "attribute": "S",
        "advanced_field": "wspinaczka_cecha_s_rozwiniecie",
        "total_field": "umtotal24",
    },
    {
        "name": "Występy ({specialization})",
        "attribute": "Ogd",
        "advanced_field": "wystepy_ogd_cecha_rozwieniecie",
        "total_field": "umtotal25",
        "specialization_field": "wystepy_x",
    },
    {
        "name": "Zastraszanie",
        "attribute": "S",
        "advanced_field": "zastraszanie_cecha_s_rozwiniecie",
        "total_field": "umtotal26",
    },
]

PDF_EXPERIENCE_FIELDS = {
    "available": "aktualne_doswiadczenie",
    "spent": "wydane_doswiadczenie",
    "total": "suma_doswiadczenia",
}

PDF_TALENT_ROW_RANGE = range(1, 31)
PDF_ADVANCED_SKILL_ROW_RANGE = range(1, 21)
PDF_PAGE_ONE_PROFESSION_CHECKBOX_COUNT = 56

ATTRIBUTE_NAME_MAP = {
    "ww": "WW",
    "us": "US",
    "s": "S",
    "wt": "Wt",
    "i": "I",
    "zw": "Zw",
    "zr": "Zr",
    "int": "Int",
    "sw": "SW",
    "ogd": "Ogd",
}


def normalize_pdf_field_name(text: str) -> str:
    """Converts PDF field names to an accent-insensitive lookup key."""
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    normalized = re.sub(r"[^0-9a-zA-Z]+", "_", normalized)
    return normalized.strip("_").lower()


def _clean_pdf_value(value) -> str:
    if value in (None, "/Off"):
        return ""
    if value == "/Yes":
        return "Tak"
    return str(value).strip()


def _safe_int(value) -> int:
    text = _clean_pdf_value(value)
    if not text:
        return 0
    try:
        return int(float(text.replace(",", ".")))
    except ValueError:
        return 0


def _canonical_attribute(value: str) -> str:
    return ATTRIBUTE_NAME_MAP.get(normalize_pdf_field_name(value), "")


def _resolve_display_name(template: str, specialization: str) -> str:
    specialization = specialization.strip()
    if "{specialization}" not in template:
        return template
    if specialization:
        return template.format(specialization=specialization)
    return template.split(" (")[0]


def _extract_specialization(skill_name: str) -> str:
    match = re.search(r"\((.*?)\)", skill_name)
    return match.group(1).strip() if match else ""


def _stringify_pdf_value(value) -> str:
    """Converts Python values to text expected by PDF form fields."""
    if value is None:
        return ""
    return str(value)


def _get_field_name(field_lookup: Dict[str, str], normalized_name: str) -> Optional[str]:
    return field_lookup.get(normalized_name)


def _get_field_value(field_lookup: Dict[str, str], fields: Dict, normalized_name: str) -> str:
    actual_name = _get_field_name(field_lookup, normalized_name)
    if not actual_name:
        return ""
    field = fields.get(actual_name)
    if isinstance(field, dict):
        return _clean_pdf_value(field.get("/V"))
    return _clean_pdf_value(field)


def _get_page_checkbox_states(reader: PdfReader, page_index: int) -> list[bool]:
    """Zwraca stany checkboxów na wskazanej stronie w kolejności występowania."""
    states = []
    page = reader.pages[page_index]
    for annot_ref in page.get("/Annots", []):
        annot = annot_ref.get_object()
        if annot.get("/Subtype") == "/Widget" and annot.get("/FT") == "/Btn":
            states.append(str(annot.get("/AS")) == "/Yes")
    return states


def extract_pdf_character_data(file_path: str) -> Dict:
    """Loads character data from a filled PDF form."""
    reader = PdfReader(file_path)
    fields = reader.get_fields() or {}
    field_lookup = {
        normalize_pdf_field_name(field_name): field_name for field_name in fields.keys()
    }
    page_one_checkbox_states = _get_page_checkbox_states(reader, 0)
    if len(page_one_checkbox_states) >= PDF_PAGE_ONE_PROFESSION_CHECKBOX_COUNT:
        attribute_profession_flags = page_one_checkbox_states[:10]
        basic_skill_profession_flags = page_one_checkbox_states[10:36]
        advanced_skill_profession_flags = page_one_checkbox_states[36:56]
    else:
        attribute_profession_flags = [False] * 10
        basic_skill_profession_flags = [False] * len(PDF_BASIC_SKILL_LAYOUT)
        advanced_skill_profession_flags = [False] * len(PDF_ADVANCED_SKILL_ROW_RANGE)

    experience = {
        key: _safe_int(_get_field_value(field_lookup, fields, normalized_name))
        for key, normalized_name in PDF_EXPERIENCE_FIELDS.items()
    }

    attributes = {}
    pdf_mapping = {
        "character_name": _get_field_name(field_lookup, "imie"),
        "experience": {},
        "attributes": {},
        "skills": {},
        "talents": {},
        "profession": {
            "class_field": _get_field_name(field_lookup, "klasa"),
            "profession_field": _get_field_name(field_lookup, "profesja"),
            "level_field": _get_field_name(field_lookup, "poziom_profesji"),
            "path_field": _get_field_name(field_lookup, "sciezka_profesji"),
            "species_field": _get_field_name(field_lookup, "rasa"),
        },
        "source_pdf_path": file_path,
    }

    profession_info = {
        "class": _get_field_value(field_lookup, fields, "klasa"),
        "profession": _get_field_value(field_lookup, fields, "profesja"),
        "level_text": _get_field_value(field_lookup, fields, "poziom_profesji"),
        "path_text": _get_field_value(field_lookup, fields, "sciezka_profesji"),
        "species": _get_field_value(field_lookup, fields, "rasa"),
    }

    for key, normalized_name in PDF_EXPERIENCE_FIELDS.items():
        pdf_mapping["experience"][key] = _get_field_name(field_lookup, normalized_name)

    for attr_index, (attr_name, mapping) in enumerate(PDF_ATTRIBUTE_FIELDS.items()):
        initial = _safe_int(_get_field_value(field_lookup, fields, mapping["initial"]))
        advanced = _safe_int(_get_field_value(field_lookup, fields, mapping["advanced"]))
        current = _safe_int(_get_field_value(field_lookup, fields, mapping["current"]))
        if not current:
            current = initial + advanced

        attributes[attr_name] = {
            "initial": initial,
            "advanced": advanced,
            "current": current,
            "base_advanced": advanced,
            "is_new": False,
            "profession_available": attribute_profession_flags[attr_index],
        }
        pdf_mapping["attributes"][attr_name] = {
            key: _get_field_name(field_lookup, normalized_name)
            for key, normalized_name in mapping.items()
        }

    skills = {}
    for layout_index, layout in enumerate(PDF_BASIC_SKILL_LAYOUT):
        specialization = _get_field_value(
            field_lookup,
            fields,
            layout.get("specialization_field", ""),
        )
        skill_name = _resolve_display_name(layout["name"], specialization)
        advanced = _safe_int(
            _get_field_value(field_lookup, fields, layout["advanced_field"])
        )
        current = _safe_int(_get_field_value(field_lookup, fields, layout["total_field"]))
        if not current:
            current = attributes[layout["attribute"]]["current"] + advanced
        initial = max(current - advanced, 0)

        skills[skill_name] = {
            "attribute": layout["attribute"],
            "initial": initial,
            "advanced": advanced,
            "current": current,
            "base_advanced": advanced,
            "is_new": False,
            "profession_available": basic_skill_profession_flags[layout_index],
        }
        pdf_mapping["skills"][skill_name] = {
            "type": "basic",
            "attribute": layout["attribute"],
            "advanced_field": _get_field_name(field_lookup, layout["advanced_field"]),
            "total_field": _get_field_name(field_lookup, layout["total_field"]),
            "specialization_field": _get_field_name(
                field_lookup,
                layout.get("specialization_field", ""),
            ),
            "specialization_value": specialization,
        }

    for row_position, row_index in enumerate(PDF_ADVANCED_SKILL_ROW_RANGE):
        name_field = f"skillnamerow{row_index}"
        skill_name = _get_field_value(field_lookup, fields, name_field)
        if not skill_name:
            continue

        attribute = _canonical_attribute(
            _get_field_value(field_lookup, fields, f"listboxrow{row_index}")
        )
        if not attribute:
            continue

        advanced = _safe_int(_get_field_value(field_lookup, fields, f"advrow{row_index}"))
        initial = _safe_int(
            _get_field_value(field_lookup, fields, f"characteristicrow{row_index}")
        )
        current = _safe_int(_get_field_value(field_lookup, fields, f"skillrow{row_index}"))
        if not current:
            current = initial + advanced

        skills[skill_name] = {
            "attribute": attribute,
            "initial": initial,
            "advanced": advanced,
            "current": current,
            "base_advanced": advanced,
            "is_new": False,
            "profession_available": advanced_skill_profession_flags[row_position],
        }
        pdf_mapping["skills"][skill_name] = {
            "type": "advanced",
            "name_field": _get_field_name(field_lookup, name_field),
            "attribute_field": _get_field_name(field_lookup, f"listboxrow{row_index}"),
            "advanced_field": _get_field_name(field_lookup, f"advrow{row_index}"),
            "initial_field": _get_field_name(field_lookup, f"characteristicrow{row_index}"),
            "current_field": _get_field_name(field_lookup, f"skillrow{row_index}"),
            "name_value": skill_name,
            "attribute_value": attribute,
        }

    talents = {}
    talents_free = []
    for row_index in PDF_TALENT_ROW_RANGE:
        talent_name = _get_field_value(field_lookup, fields, f"talent_namerow{row_index}")
        if not talent_name:
            talents_free.append(
                {
                    "name_field": _get_field_name(field_lookup, f"talent_namerow{row_index}"),
                    "advances_field": _get_field_name(field_lookup, f"times_takenrow{row_index}"),
                    "description_field": _get_field_name(field_lookup, f"descriptionrow{row_index}"),
                }
            )
            continue
        talents[talent_name] = {
            "advances": _clean_pdf_value(
                _get_field_value(field_lookup, fields, f"times_takenrow{row_index}")
            ),
            "description": _get_field_value(
                field_lookup,
                fields,
                f"descriptionrow{row_index}",
            ),
        }
        pdf_mapping["talents"][talent_name] = {
            "name_field": _get_field_name(field_lookup, f"talent_namerow{row_index}"),
            "advances_field": _get_field_name(field_lookup, f"times_takenrow{row_index}"),
            "description_field": _get_field_name(field_lookup, f"descriptionrow{row_index}"),
            "name_value": talent_name,
            "advances_value": talents[talent_name]["advances"],
            "description_value": talents[talent_name]["description"],
        }

    pdf_mapping["talents_free"] = talents_free

    return {
        "character_name": _get_field_value(field_lookup, fields, "imie") or "Brak Imienia",
        "attributes": attributes,
        "skills": skills,
        "talents": talents,
        "experience": experience,
        "profession_info": profession_info,
        "pdf_mapping": pdf_mapping,
    }


def write_pdf_character_data(
    source_pdf_path: str,
    target_pdf_path: str,
    payload: Dict,
    pdf_mapping: Dict,
) -> None:
    """Writes updated character data back to a PDF form."""
    reader = PdfReader(source_pdf_path)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.set_need_appearances_writer()

    updates = {}

    name_field = pdf_mapping.get("character_name")
    if name_field:
        updates[name_field] = _stringify_pdf_value(payload.get("character_name", ""))

    for key, field_name in pdf_mapping.get("experience", {}).items():
        if field_name:
            updates[field_name] = _stringify_pdf_value(payload["experience"].get(key, 0) or "")

    for attr_name, mapping in pdf_mapping.get("attributes", {}).items():
        attr_data = payload["attributes"].get(attr_name)
        if not attr_data:
            continue
        if mapping.get("initial"):
            updates[mapping["initial"]] = _stringify_pdf_value(attr_data["initial"] or "")
        if mapping.get("advanced"):
            updates[mapping["advanced"]] = _stringify_pdf_value(attr_data["advanced"] or "")
        if mapping.get("current"):
            updates[mapping["current"]] = _stringify_pdf_value(
                attr_data["initial"] + attr_data["advanced"]
            )

    for skill_name, mapping in pdf_mapping.get("skills", {}).items():
        skill_data = payload["skills"].get(skill_name)
        if not skill_data:
            continue

        current_value = skill_data["initial"] + skill_data["advanced"]
        if mapping.get("advanced_field"):
            updates[mapping["advanced_field"]] = _stringify_pdf_value(
                skill_data["advanced"] or ""
            )

        if mapping.get("type") == "basic":
            if mapping.get("specialization_field") and _extract_specialization(skill_name) != mapping.get("specialization_value", ""):
                updates[mapping["specialization_field"]] = _stringify_pdf_value(
                    _extract_specialization(skill_name)
                )
            if mapping.get("total_field"):
                updates[mapping["total_field"]] = _stringify_pdf_value(current_value or "")
        else:
            if mapping.get("name_field") and skill_name != mapping.get("name_value"):
                updates[mapping["name_field"]] = _stringify_pdf_value(skill_name)
            if mapping.get("attribute_field") and skill_data["attribute"] != mapping.get("attribute_value"):
                updates[mapping["attribute_field"]] = _stringify_pdf_value(
                    skill_data["attribute"]
                )
            if mapping.get("initial_field"):
                updates[mapping["initial_field"]] = _stringify_pdf_value(
                    skill_data["initial"] or ""
                )
            if mapping.get("current_field"):
                updates[mapping["current_field"]] = _stringify_pdf_value(current_value or "")

    for talent_name, mapping in pdf_mapping.get("talents", {}).items():
        talent_data = payload.get("talents", {}).get(talent_name)
        if not talent_data:
            continue
        if mapping.get("name_field") and talent_name != mapping.get("name_value"):
            updates[mapping["name_field"]] = _stringify_pdf_value(talent_name)
        if mapping.get("advances_field") and str(talent_data.get("advances", "")) != str(mapping.get("advances_value", "")):
            updates[mapping["advances_field"]] = _stringify_pdf_value(
                talent_data.get("advances", "")
            )
        if mapping.get("description_field") and str(talent_data.get("description", "")) != str(mapping.get("description_value", "")):
            updates[mapping["description_field"]] = _stringify_pdf_value(
                talent_data.get("description", "")
            )

    # Nowe talenty (dodane w aplikacji) trafiają do wolnych wierszy karty.
    mapped_talents = set(pdf_mapping.get("talents", {}).keys())
    free_rows = list(pdf_mapping.get("talents_free", []))
    for talent_name, talent_data in payload.get("talents", {}).items():
        if talent_name in mapped_talents:
            continue
        if not free_rows:
            break
        row = free_rows.pop(0)
        if row.get("name_field"):
            updates[row["name_field"]] = _stringify_pdf_value(talent_name)
        if row.get("advances_field"):
            updates[row["advances_field"]] = _stringify_pdf_value(
                talent_data.get("advances", "")
            )
        if row.get("description_field"):
            updates[row["description_field"]] = _stringify_pdf_value(
                talent_data.get("description", "")
            )

    # Profesja / klasa / ścieżka kariery.
    profession_payload = payload.get("profession") or {}
    profession_mapping = pdf_mapping.get("profession") or {}
    profession_field_map = {
        "class": "class_field",
        "profession": "profession_field",
        "level_text": "level_field",
        "path_text": "path_field",
        "species": "species_field",
    }
    for value_key, field_key in profession_field_map.items():
        field_name = profession_mapping.get(field_key)
        if field_name and value_key in profession_payload:
            updates[field_name] = _stringify_pdf_value(profession_payload.get(value_key, ""))

    for page in writer.pages:
        writer.update_page_form_field_values(page, updates, auto_regenerate=True)

    if "/AcroForm" in writer._root_object:
        writer._root_object[NameObject("/AcroForm")].update(
            {NameObject("/NeedAppearances"): BooleanObject(True)}
        )

    with open(target_pdf_path, "wb") as file_handle:
        writer.write(file_handle)