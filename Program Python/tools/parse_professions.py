"""Parser profesji WFRP 4ed z podręcznika -> data/professions.json.

Strony PDF 53..116 zawierają po jednej profesji na stronę, w kolejności tabeli
klas (8 klas x 8 profesji). Wyciągamy nazwę, klasę, rasy oraz 4 poziomy
(tytuł, status, umiejętności, talenty, wyposażenie). Cechy rozwijane na każdym
poziomie są w PDF oznaczone obrazkowo i NIE są wiarygodnie ekstrahowalne -
zapisujemy pustą listę + flagę do ręcznego uzupełnienia (liczba symboli 'h'
poziomu 1 jest zapisywana jako wskazówka).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

PDF_PATH = Path("[PL] Warhammer 4ed. - Ponury świat niebezpiecznych przygód.pdf")
OUT_PATH = Path("data/professions.json")

# Kolejność profesji zgodna z tabelą klas (strony 31-32), strony PDF 53..116.
CLASS_CAREERS = [
    ("Uczeni", ["Aptekarka", "Czarodziej", "Inżynier", "Kapłan", "Medyczka", "Mniszka", "Prawniczka", "Uczony"]),
    ("Mieszczanie", ["Agitator", "Kupiec", "Mieszczka", "Rzemieślniczka", "Strażnik", "Szczurołap", "Śledczy", "Żebrak"]),
    ("Dworzanie", ["Artystka", "Doradca", "Namiestnik", "Poseł", "Służąca", "Szlachcic", "Szpieg", "Zwadźca"]),
    ("Pospólstwo", ["Chłopka", "Górnik", "Guślarz", "Łowczyni", "Mistyczka", "Zarządca", "Zielarka", "Zwiadowca"]),
    ("Wędrowcy", ["Biczownik", "Domokrążca", "Kuglarka", "Łowca Czarownic", "Łowczyni Nagród", "Posłaniec", "Strażniczka Dróg", "Woźnica"]),
    ("Wodniacy", ["Doker", "Flisak", "Pilotka Rzeczna", "Pirat Rzeczny", "Przemytniczka", "Przewoźnik", "Strażnik Rzeczny", "Żeglarz"]),
    ("Łotry", ["Banita", "Czarownica", "Hiena Cmentarna", "Paser", "Rajfur", "Rekietierka", "Szarlatan", "Złodziej"]),
    ("Wojownicy", ["Gladiator", "Kapłan Bitewny", "Kawalerzysta", "Ochroniarz", "Oprych", "Rycerz", "Zabójca", "Żołnierz"]),
]

FIRST_PAGE = 53
ATTRS = ["WW", "US", "S", "Wt", "I", "Zw", "Zr", "Int", "SW", "Ogd"]

STATUS_RE = re.compile(r"(.+?)\s*[–-]\s*(Brąz|Srebro|Złoto)\s*(\d)\b")
SECTION_RE = re.compile(r"(Umiejętności|Talenty|Wyposażenie)\s*:", re.IGNORECASE)
# łączenie wyrazów dzielonych na końcu wiersza: "Kla- syczny" -> "Klasyczny"
DEHYPHEN_RE = re.compile(r"([a-ząćęłńóśźż])-\s+([a-ząćęłńóśźż])")
# początek tekstu fabularnego po wyposażeniu: słowo + Wielkie_słowo + małe_słowo
FLAVOR_RE = re.compile(
    r"(?:[a-ząćęłńóśźż]{2,}|\))\s+(?P<cap>[A-ZŁŚŻĄĘÓ][a-ząćęłńóśźż]{3,}\s+[a-ząćęłńóśźż])"
)


def ordered_careers():
    out = []
    for cls, careers in CLASS_CAREERS:
        for c in careers:
            out.append((cls, c))
    return out


def split_commas(text: str) -> list[str]:
    """Dzieli po przecinkach poza nawiasami."""
    items, depth, cur = [], 0, ""
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            items.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        items.append(cur.strip())
    return [re.sub(r"\s+", " ", i).strip(" .") for i in items if i.strip(" .")]


def parse_species(lines: list[str]) -> list[str]:
    for ln in lines[:6]:
        low = ln.lower()
        if any(r in low for r in ("człowiek", "elf", "krasnolud", "niziołek")):
            return split_commas(ln)
    return []


def dehyphenate(text: str) -> str:
    prev = None
    while prev != text:
        prev = text
        text = DEHYPHEN_RE.sub(r"\1\2", text)
    return text


def clean_title(raw: str) -> str:
    # usuń wiodące symbole/spacje (oznaczenia cech) i zostaw tekst tytułu
    t = re.sub(r"^[^A-Za-zÀ-ž]+", "", raw).strip()
    t = re.sub(r"^h\s+", "", t)  # usuń znacznik cechy poziomu 1 renderowany jako 'h'
    return re.sub(r"\s+", " ", t)


def trim_flavor(chunk: str) -> str:
    """Ucina tekst fabularny doklejony po liście wyposażenia (poza nawiasami)."""
    for m in FLAVOR_RE.finditer(chunk):
        cap_start = m.start("cap")
        depth = chunk[:cap_start].count("(") - chunk[:cap_start].count(")")
        if depth == 0:
            return chunk[:cap_start]
    return chunk


def parse_level_body(body: str) -> dict:
    """Z fragmentu tekstu poziomu wyciąga 3 sekcje."""
    result = {"skills": [], "talents": [], "trappings": []}
    matches = list(SECTION_RE.finditer(body))
    for i, m in enumerate(matches):
        key = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        chunk = body[start:end].replace("\n", " ")
        if key.startswith("wypos"):
            chunk = trim_flavor(chunk)
        items = split_commas(chunk)
        if key.startswith("umiej"):
            result["skills"] = items
        elif key.startswith("talen"):
            result["talents"] = items
        elif key.startswith("wypos"):
            result["trappings"] = items
    return result


def parse_career(text: str) -> dict:
    text = dehyphenate(text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    species = parse_species(lines)

    # liczba symboli 'h' przed 'ścieżka ProfesJi' = liczba cech poziomu 1 (wskazówka)
    l1_hint = 0
    sub = text.split("ścieżka")[0]
    schemat_idx = sub.find("Ogd")
    if schemat_idx != -1:
        after = sub[schemat_idx + 3 :]
        l1_hint = after.count("h")

    # Znajdź 4 poziomy po wzorcu tytuł – status N
    levels = []
    matches = list(STATUS_RE.finditer(text))
    # odfiltruj fałszywe (status musi być 1..4 i tytuł sensowny)
    valid = [m for m in matches if m.group(3) in {"1", "2", "3"} or m.group(2) == "Złoto"]
    # zbuduj bloki między kolejnymi statusami
    for i, m in enumerate(matches):
        title = clean_title(m.group(1))
        status = f"{m.group(2)} {m.group(3)}"
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end]
        # utnij body na ewentualnych cytatach/sekcjach spoza tabeli (po Wyposażeniu)
        parsed = parse_level_body(body)
        if not (parsed["skills"] or parsed["talents"] or parsed["trappings"]):
            continue
        levels.append({
            "level": len(levels) + 1,
            "title": title,
            "status": status,
            "characteristics": [],
            "skills": parsed["skills"],
            "talents": parsed["talents"],
            "trappings": parsed["trappings"],
        })
        if len(levels) == 4:
            break

    return {
        "species": species,
        "characteristics_pending": True,
        "level1_marker_hint": l1_hint,
        "levels": levels,
    }


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    careers = ordered_careers()
    data = {}
    issues = []
    for offset, (cls, name) in enumerate(careers):
        page_idx = FIRST_PAGE + offset
        text = reader.pages[page_idx].extract_text() or ""
        parsed = parse_career(text)
        parsed["class"] = cls
        parsed["source"] = "Podręcznik podstawowy"
        parsed["page"] = page_idx
        data[name] = parsed
        if len(parsed["levels"]) != 4:
            issues.append(f"{name} (s.{page_idx}): {len(parsed['levels'])} poziomów")

    OUT_PATH.parent.mkdir(exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Zapisano {OUT_PATH} ({len(data)} profesji)")
    if issues:
        print("UWAGA - profesje bez 4 poziomów:")
        for it in issues:
            print("  -", it)
    else:
        print("Wszystkie profesje mają 4 poziomy.")


if __name__ == "__main__":
    main()
