/**
 * Modyfikatory postaci: mutacje, wampiryzm, Dary Chaosu/Krwi, profile itp.
 *
 * Katalog (public/data/modifiers.json) zapisuje wartosci jako liczby albo kosci
 * ("k10", "-2k10"). Przy dodaniu do postaci kosci sa rozstrzygane na liczby
 * (CharacterModifier). Funkcje czyste - generator losowy wstrzykiwany (testy).
 */

import { ATTRIBUTES } from "./rules";
import type { CharacterModifier, ModifierDef, ModifierValue } from "./types";

/** Generator liczb [0, 1) - jak Math.random. */
export type Rng = () => number;

const DICE_RE = /^([+-]?)(\d*)k(\d+)$/i;

/** Czy wartosc z katalogu wymaga rzutu koscmi (np. "k10"). */
export function isDiceValue(v: ModifierValue | undefined): v is string {
  return typeof v === "string" && DICE_RE.test(v.trim());
}

/** Rozstrzyga wartosc z katalogu: liczba wprost, kosci - rzut. */
export function rollModifierValue(v: ModifierValue, rng: Rng = Math.random): number {
  if (typeof v === "number") return v;
  const m = DICE_RE.exec(v.trim());
  if (!m) return Number.parseInt(v, 10) || 0;
  const count = Number.parseInt(m[2], 10) || 1;
  const sides = Number.parseInt(m[3], 10);
  let sum = 0;
  for (let i = 0; i < count; i++) sum += 1 + Math.floor(rng() * sides);
  return m[1] === "-" ? -sum : sum;
}

/** Rozstrzyga cala mape wartosci (cechy / umiejetnosci). */
export function rollValueMap(
  map: Record<string, ModifierValue> | undefined,
  rng: Rng = Math.random
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map ?? {})) {
    const n = rollModifierValue(v, rng);
    if (n) out[k] = n;
  }
  return out;
}

/** Unikalny identyfikator modyfikatora postaci. */
export function newModifierId(rng: Rng = Math.random): string {
  return `mod-${Date.now().toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`;
}

/** Opis efektu wpisu katalogu wraz z cechami stworzen i pancerzem. */
export function describeModifierDef(def: ModifierDef): string {
  const parts: string[] = [];
  if (def.effect) parts.push(def.effect);
  if (def.traits?.length) parts.push(`Cechy/talenty: ${def.traits.join(", ")}.`);
  if (def.armour) parts.push(`Pancerz +${def.armour} PP (wszystkie lokacje).`);
  if (def.headArmour) parts.push(`Pancerz głowy +${def.headArmour} PP.`);
  if (def.limit) parts.push(`Limit: ${def.limit}.`);
  return parts.join(" ");
}

/**
 * Tworzy modyfikator postaci z wpisu katalogu: rzuca kosci (cechy/umiejetnosci)
 * i ewentualnie lokalizacje. Wynik mozna potem recznie poprawic w UI.
 */
export function instantiateModifier(
  def: ModifierDef,
  categoryLabel: string,
  rng: Rng = Math.random,
  location?: string
): CharacterModifier {
  const mod: CharacterModifier = {
    id: newModifierId(rng),
    name: def.name,
    category: categoryLabel,
    description: describeModifierDef(def),
    source: def.source,
    active: true,
    characteristics: rollValueMap(def.characteristics, rng)
  };
  const skills = rollValueMap(def.skills, rng);
  if (Object.keys(skills).length) mod.skills = skills;
  if (def.maxCharacteristics && Object.keys(def.maxCharacteristics).length) {
    mod.maxCharacteristics = { ...def.maxCharacteristics };
  }
  if (def.movement) mod.movement = def.movement;
  if (def.wounds) mod.wounds = def.wounds;
  if (def.fate) mod.fate = def.fate;
  if (def.resilience) mod.resilience = def.resilience;
  if (location) mod.location = location;
  if (def.race) mod.race = def.race;
  return mod;
}

/** Suma zmian cech z aktywnych modyfikatorow (kod -> suma). */
export function sumCharacteristicModifiers(mods: CharacterModifier[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of mods) {
    if (!m.active) continue;
    for (const [code, v] of Object.entries(m.characteristics ?? {})) {
      out[code] = (out[code] ?? 0) + (Number(v) || 0);
    }
  }
  return out;
}

/** Suma zmian umiejetnosci z aktywnych modyfikatorow (nazwa -> suma). */
export function sumSkillModifiers(mods: CharacterModifier[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of mods) {
    if (!m.active) continue;
    for (const [name, v] of Object.entries(m.skills ?? {})) {
      out[name] = (out[name] ?? 0) + (Number(v) || 0);
    }
  }
  return out;
}

/** Najnizszy limit wartosci cechy z aktywnych modyfikatorow (kod -> maks.). */
export function characteristicCaps(mods: CharacterModifier[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of mods) {
    if (!m.active) continue;
    for (const [code, cap] of Object.entries(m.maxCharacteristics ?? {})) {
      out[code] = code in out ? Math.min(out[code], cap) : cap;
    }
  }
  return out;
}

/** Suma zmian Zywotnosci z aktywnych modyfikatorow. */
export function sumWoundModifiers(mods: CharacterModifier[]): number {
  return mods.reduce((acc, m) => acc + (m.active ? Number(m.wounds) || 0 : 0), 0);
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

/** Krotkie podsumowanie efektow (np. ["WW +10", "Szybkość +2"]). */
export function modifierEffectLabels(m: CharacterModifier): string[] {
  const out: string[] = [];
  for (const code of ATTRIBUTES) {
    const v = m.characteristics?.[code];
    if (v) out.push(`${code} ${signed(v)}`);
  }
  for (const [name, v] of Object.entries(m.skills ?? {})) if (v) out.push(`${name} ${signed(v)}`);
  for (const [code, cap] of Object.entries(m.maxCharacteristics ?? {})) {
    out.push(`${code} maks. ${cap}`);
  }
  if (m.movement) out.push(`Szybkość ${signed(m.movement)}`);
  if (m.wounds) out.push(`Żywotność ${signed(m.wounds)}`);
  if (m.fate) out.push(`Przeznaczenie ${signed(m.fate)}`);
  if (m.resilience) out.push(`Bohater ${signed(m.resilience)}`);
  if (m.race) out.push(`Rasa: ${m.race}`);
  return out;
}

/** Normalizuje modyfikator wczytany z JSON (brakujace pola, typy liczbowe). */
export function normalizeModifier(raw: Partial<CharacterModifier>, index = 0): CharacterModifier {
  const nums = (o: Record<string, unknown> | undefined): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o ?? {})) {
      const n = Math.trunc(Number(v));
      if (Number.isFinite(n) && n !== 0) out[k] = n;
    }
    return out;
  };
  const int = (v: unknown): number | undefined => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n !== 0 ? n : undefined;
  };
  const mod: CharacterModifier = {
    id: String(raw.id || `mod-import-${index}`),
    name: String(raw.name ?? "Modyfikator"),
    category: String(raw.category ?? "Własne"),
    description: String(raw.description ?? ""),
    active: raw.active !== false,
    characteristics: nums(raw.characteristics)
  };
  if (raw.source) mod.source = String(raw.source);
  const skills = nums(raw.skills);
  if (Object.keys(skills).length) mod.skills = skills;
  if (raw.maxCharacteristics) {
    const caps: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.maxCharacteristics)) {
      const n = Math.trunc(Number(v));
      if (Number.isFinite(n)) caps[k] = n;
    }
    if (Object.keys(caps).length) mod.maxCharacteristics = caps;
  }
  for (const key of ["movement", "wounds", "fate", "resilience"] as const) {
    const n = int(raw[key]);
    if (n !== undefined) mod[key] = n;
  }
  if (raw.location) mod.location = String(raw.location);
  if (raw.race) mod.race = String(raw.race);
  if (raw.prevRace) mod.prevRace = String(raw.prevRace);
  return mod;
}
