"""Probe: wyciąga pozycje (x,y) glifów na stronie, by zmapować symbole cech."""
from pypdf import PdfReader

reader = PdfReader("[PL] Warhammer 4ed. - Ponury świat niebezpiecznych przygód.pdf")
page = reader.pages[53]

records = []

def visitor(text, cm, tm, font_dict, font_size):
    if text and text.strip():
        x = tm[4]
        y = tm[5]
        records.append((round(y, 1), round(x, 1), text))

page.extract_text(visitor_text=visitor)

# Sortuj malejąco po Y (od góry), potem rosnąco po X
records.sort(key=lambda r: (-r[0], r[1]))
lines = [f"{y}\t{x}\t{repr(t)}" for (y, x, t) in records]
open("_pdf_extract/p53_coords.txt", "w", encoding="utf-8").write("\n".join(lines))
print(f"wrote {len(records)} records")
