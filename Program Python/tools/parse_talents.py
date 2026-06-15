"""Parser listy talentów WFRP 4ed z podręcznika (strony 132-147).

Wejście : _pdf_extract/pages_132_148.txt (zrzut tekstu stron)
Wyjście : data/talents.json

Format talentu w podręczniku:
    <Nazwa Talentu>
    Maksimum: <brak | liczba | Bonus z(e) Cecha>
    [T esty: <powiązane umiejętności / warunek>]
    <opis... (do następnego talentu)>
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_pdf_extract" / "pages_132_148.txt"
OUT = ROOT / "data" / "talents.json"

# kotwica początku listy ("l ista  t alentów") i koniec (strona 148 = ZASADY)
END_MARKER = "===== PAGE INDEX 148"

MAX_RE = re.compile(r"^Maksimum\s*:\s*(.+)$")
TESTY_RE = re.compile(r"^T\s*esty\s*:\s*(.*)$")
# dzielenie wyrazów na końcu wiersza, także z odstępem przed dywizem ("two - rzącym")
DEHYPHEN_RE = re.compile(r"([a-ząćęłńóśźż])\s*-\s+([a-ząćęłńóśźż])")

ATTR_MAP = {
    "Walki Wręcz": "WW",
    "Umiejętności Strzeleckich": "US",
    "Siły Woli": "SW",
    "Siły": "S",
    "Wytrzymałości": "Wt",
    "Inicjatywy": "I",
    "Zwinności": "Zw",
    "Zręczności": "Zr",
    "Inteligencji": "Int",
    "Ogłady": "Ogd",
}

# linie-śmieci (nagłówki/stopki/numery stron) usuwane przed parsowaniem
NOISE_EXACT = {
    "WARHAMMER FANTASY ROLEPLAY",
    "Dawid Dachowski (Order #22703981)",
    "TALENTY",
    "UMIEJĘTNOŚCI I TALENTY",
    "II",
    "III",
    "IV",
    "V",
}


def dehyphenate(text: str) -> str:
    prev = None
    while prev != text:
        prev = text
        text = DEHYPHEN_RE.sub(r"\1\2", text)
    return text


def is_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if s in NOISE_EXACT:
        return True
    if s.startswith("====="):
        return True
    if re.fullmatch(r"\d{1,3}", s):  # numer strony
        return True
    return False


def parse_max(value: str):
    v = value.strip()
    low = v.lower()
    if low.startswith("brak"):
        return {"type": "none"}
    m = re.match(r"(\d+)", v)
    if m:
        return {"type": "fixed", "value": int(m.group(1))}
    mm = re.search(r"(?:Bonus|Premia)\s+ze?\s+(.+)", v)
    if mm:
        attr_name = mm.group(1).strip()
        return {
            "type": "characteristic",
            "attr": ATTR_MAP.get(attr_name, attr_name),
            "attr_name": attr_name,
        }
    return {"type": "special", "text": v}


def main():
    raw = SRC.read_text(encoding="utf-8")
    cut = raw.find(END_MARKER)
    if cut != -1:
        raw = raw[:cut]

    lines = raw.splitlines()
    # start po nagłówku "l ista  t alentów"
    start = 0
    for i, ln in enumerate(lines):
        if ln.replace(" ", "").lower().startswith("listatalentów"):
            start = i + 1
            break
    lines = lines[start:]

    content = [ln.strip() for ln in lines if not is_noise(ln)]

    max_idx = [i for i, ln in enumerate(content) if MAX_RE.match(ln)]

    talents = {}
    anomalies = []
    for n, m in enumerate(max_idx):
        name = content[m - 1].strip()
        max_info = parse_max(MAX_RE.match(content[m]).group(1))

        desc_start = m + 1
        tests = None
        if desc_start < len(content):
            tm = TESTY_RE.match(content[desc_start])
            if tm:
                tests = dehyphenate(tm.group(1).strip()) or None
                desc_start += 1

        desc_end = (max_idx[n + 1] - 1) if n + 1 < len(max_idx) else len(content)
        description = dehyphenate(" ".join(content[desc_start:desc_end]).strip())

        if not name or ":" in name or len(name) > 60 or name[0].islower():
            anomalies.append((name, max_info))

        talents[name] = {
            "max": max_info,
            "max_raw": MAX_RE.match(content[m]).group(1).strip(),
            "tests": tests,
            "description": description,
            "source": "Podręcznik podstawowy",
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(talents, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    report = ROOT / "_pdf_extract" / "talents_report.txt"
    lines_out = [f"Zapisano {OUT.name}: {len(talents)} talentów"]
    types = {}
    for t in talents.values():
        types[t["max"]["type"]] = types.get(t["max"]["type"], 0) + 1
    lines_out.append("Typy Maksimum: " + repr(types))
    lines_out.append(f"Anomalie nazw: {len(anomalies)}")
    for nm, mi in anomalies:
        lines_out.append(f"  ! {nm!r} -> {mi}")
    report.write_text("\n".join(lines_out), encoding="utf-8")
    print(f"Zapisano {OUT} ({len(talents)} talentów). Raport: {report}")


if __name__ == "__main__":
    main()
