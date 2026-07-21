#!/usr/bin/env python3
"""Ekstrakcja tekstu i tabel z podręczników PDF do przeglądu przez asystenta.

Wejście: pliki PDF z katalogu ``Sources/`` (gitignored — nie trafiają na repo).
Wyjście: pliki ``.txt`` (tekst) i ``.tables.txt`` (tabele) w ``Sources/extracted/``.

Użycie (po aktywacji .venv):
    pip install pdfplumber pypdf
    python tools/extract_pdf.py                      # wszystkie PDF z Sources/
    python tools/extract_pdf.py Sources/pl/pod-bronia.pdf
    python tools/extract_pdf.py --pages 40-72 Sources/en/up-in-arms.pdf

Uwaga: skrypt jest narzędziem lokalnym. Same podręczniki oraz katalog
``Sources/extracted/`` są pomijane przy pushowaniu (patrz .gitignore).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES_DIR = ROOT / "Sources"
OUT_DIR = SOURCES_DIR / "extracted"


def parse_pages(spec: str | None) -> set[int] | None:
    """Zamienia '40-72,90,95-97' na zbiór numerów stron (1-indeksowanych)."""
    if not spec:
        return None
    pages: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            pages.update(range(int(lo), int(hi) + 1))
        else:
            pages.add(int(part))
    return pages


def find_pdfs(args_paths: list[str]) -> list[Path]:
    if args_paths:
        return [Path(p).resolve() for p in args_paths]
    if not SOURCES_DIR.exists():
        return []
    return sorted(
        p for p in SOURCES_DIR.rglob("*.pdf") if OUT_DIR not in p.parents
    )


def extract_one(pdf_path: Path, pages: set[int] | None) -> None:
    import pdfplumber  # import tutaj, by --help działał bez zależności

    rel = pdf_path.name
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    txt_path = OUT_DIR / (pdf_path.stem + ".txt")
    tbl_path = OUT_DIR / (pdf_path.stem + ".tables.txt")

    text_chunks: list[str] = []
    table_chunks: list[str] = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        total = len(pdf.pages)
        for idx, page in enumerate(pdf.pages, start=1):
            if pages is not None and idx not in pages:
                continue
            text_chunks.append(f"\n===== STRONA {idx}/{total} =====\n")
            text_chunks.append(page.extract_text() or "")
            for t_no, table in enumerate(page.extract_tables() or [], start=1):
                table_chunks.append(f"\n----- STRONA {idx} · TABELA {t_no} -----\n")
                for row in table:
                    cells = ["" if c is None else str(c).replace("\n", " ") for c in row]
                    table_chunks.append(" | ".join(cells))

    txt_path.write_text("\n".join(text_chunks), encoding="utf-8")
    tbl_path.write_text("\n".join(table_chunks), encoding="utf-8")
    print(f"[OK] {rel}: tekst -> {txt_path.name}, tabele -> {tbl_path.name}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Ekstrakcja PDF -> tekst/tabele")
    parser.add_argument("paths", nargs="*", help="Konkretne pliki PDF (domyślnie: Sources/**.pdf)")
    parser.add_argument("--pages", help="Zakres stron, np. '40-72,90'")
    args = parser.parse_args(argv)

    pdfs = find_pdfs(args.paths)
    if not pdfs:
        print(
            "Brak plików PDF. Wrzuć podręczniki do katalogu Sources/ "
            "(np. Sources/pl/, Sources/en/) i uruchom ponownie.",
            file=sys.stderr,
        )
        return 1

    pages = parse_pages(args.pages)
    try:
        for pdf in pdfs:
            if not pdf.exists():
                print(f"[POMIŃ] Nie znaleziono: {pdf}", file=sys.stderr)
                continue
            extract_one(pdf, pages)
    except ModuleNotFoundError:
        print(
            "Brak biblioteki pdfplumber. Zainstaluj: pip install pdfplumber pypdf",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
