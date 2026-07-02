/**
 * Obsługa specjalizacji i wyborów w nazwach ze schematu profesji (pkt 9, 10, 21).
 *
 * Wzorce w danych:
 *  - "(Dowolny)" / "(Dowolna)" / "(Dowolne Bóstwo)" / "(Dowolny Kolor)" itp.
 *    → użytkownik wpisuje własną specjalizację (kind "free").
 *  - "(Kowalstwo albo Złotnik)" / "(Inżynier albo Kowalstwo albo Złotnik)"
 *    → użytkownik wybiera jedną z opcji (kind "choice").
 *  - "(...)" lub pusty nawias → wpis dowolny (kind "free").
 *  - konkretna specjalizacja, np. "Wiedza (Medycyna)" → bez pytania (kind "none").
 */

export type SpecKind = "none" | "free" | "choice";

export interface SpecInfo {
  /** Pełna oryginalna nazwa ze schematu. */
  raw: string;
  /** Nazwa bazowa bez nawiasu, np. "Rzemiosło". */
  base: string;
  /** Zawartość nawiasu lub null, gdy brak nawiasu. */
  inner: string | null;
  kind: SpecKind;
  /** Dostępne opcje wyboru (kind "choice"). */
  options: string[];
  /** Podpowiedź kategorii dla wpisu dowolnego (kind "free"), np. "Bóstwo". */
  hint: string;
}

/** Rozbija nazwę ze schematu na informację o specjalizacji. */
export function parseSpecialization(name: string): SpecInfo {
  const raw = name;
  const open = name.indexOf("(");
  const close = name.lastIndexOf(")");

  if (open === -1 || close === -1 || close < open) {
    return { raw, base: name.trim(), inner: null, kind: "none", options: [], hint: "" };
  }

  const base = name.slice(0, open).trim();
  const inner = name.slice(open + 1, close).trim();

  // Wybór "albo A albo B" → lista opcji.
  if (/\balbo\b/i.test(inner)) {
    const options = inner
      .split(/\s+albo\s+/i)
      .map((o) => o.trim())
      .filter(Boolean);
    return { raw, base, inner, kind: "choice", options, hint: "" };
  }

  // Pusty nawias lub placeholder "..." → wpis dowolny.
  if (inner === "" || inner === "...") {
    return { raw, base, inner, kind: "free", options: [], hint: "" };
  }

  // "Dowolny/Dowolna/Dowolne [Kategoria]" → wpis dowolny z podpowiedzią.
  const dowolny = inner.match(/^dowoln\w*\s*(.*)$/i);
  if (dowolny) {
    return { raw, base, inner, kind: "free", options: [], hint: dowolny[1].trim() };
  }

  // Konkretna specjalizacja — nic nie pytamy.
  return { raw, base, inner, kind: "none", options: [], hint: "" };
}

/** Czy nazwa wymaga zapytania użytkownika o specjalizację/wybór. */
export function needsSpecialization(info: SpecInfo): boolean {
  return info.kind === "free" || info.kind === "choice";
}

/** Buduje docelową nazwę "Baza (Wybrana)". */
export function buildSpecializedName(base: string, chosen: string): string {
  const b = base.trim();
  const c = chosen.trim();
  if (!c) return b;
  return `${b} (${c})`;
}
