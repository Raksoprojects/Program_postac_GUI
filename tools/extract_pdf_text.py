"""Pomocniczy skrypt do ekstrakcji tekstu z podręcznika WFRP 4ed.

Zapisuje tekst wybranych stron do plików UTF-8 w folderze _pdf_extract/,
bo konsola Windows (cp1252) psuje polskie znaki przy wypisywaniu.

Użycie:
    python tools/extract_pdf_text.py map            # mapa stron (indeks -> początek tekstu)
    python tools/extract_pdf_text.py range 53 116   # zrzut zakresu indeksów do pliku
"""

from __future__ import annotations

import sys
from pathlib import Path

from pypdf import PdfReader

PDF_PATH = Path("[PL] Warhammer 4ed. - Ponury świat niebezpiecznych przygód.pdf")
OUT_DIR = Path("_pdf_extract")


def build_map(reader: PdfReader) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    lines = [f"TOTAL PAGES: {len(reader.pages)}"]
    for idx, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip().replace("\n", " ")
        snippet = text[:90]
        lines.append(f"[{idx}] {snippet}")
    (OUT_DIR / "page_map.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_DIR / 'page_map.txt'} ({len(reader.pages)} pages)")


def dump_range(reader: PdfReader, start: int, end: int) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    parts = []
    for idx in range(start, min(end + 1, len(reader.pages))):
        text = reader.pages[idx].extract_text() or ""
        parts.append(f"===== PAGE INDEX {idx} =====\n{text}")
    out = OUT_DIR / f"pages_{start}_{end}.txt"
    out.write_text("\n\n".join(parts), encoding="utf-8")
    print(f"Wrote {out}")


def main() -> None:
    reader = PdfReader(str(PDF_PATH))
    if len(sys.argv) >= 2 and sys.argv[1] == "map":
        build_map(reader)
    elif len(sys.argv) >= 4 and sys.argv[1] == "range":
        dump_range(reader, int(sys.argv[2]), int(sys.argv[3]))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
