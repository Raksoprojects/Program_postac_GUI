/**
 * Zaklecia i modlitwy: co postac moze poznac (na podstawie talentow) i ile to kosztuje.
 *
 * Zasady (podrecznik podstawowy):
 *  - Magia Prosta: z talentem poznajesz BSW zaklec za darmo; kolejne kosztuja
 *    50 PD × krotnosc Bonusu z Sily Woli (BSW=3: 4.-6. po 100 PD, 7.-9. po 150 PD).
 *  - Magia Tajemna (Tradycja): 100 PD × krotnosc Bonusu z Inteligencji
 *    (BInt=4: pierwsze piec po 100 PD, kolejne cztery po 200 PD).
 *  - Magia Chaosu: 100 PD za kazde zaklecie.
 *  - Blogoslawienstwo (Bostwo): wszystkie 6 blogoslawienstw bostwa.
 *  - Inwokacja (Bostwo): 1 cud z talentem, kolejne po 100 PD × liczba znanych cudow.
 *  - Inwokacja wyklucza Magie Prosta i Tajemna; Magia Tajemna wyklucza
 *    Blogoslawienstwo i Inwokacje. Zgoda MG znosi ograniczenia.
 * Funkcje czyste - dane przekazywane jawnie (testowalne).
 */

import type { LoreDef, PrayersData, PrayerDef, SpellDef, SpellsData } from "./types";

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");
const stem = (s: string): string => norm(s).slice(0, 4);

/** Rozbija "Magia Tajemna (Ognia)" na baze i specjalizacje. */
function splitTalent(name: string): { base: string; spec: string | null } {
  const m = name.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { base: norm(m[1]), spec: m[2].trim() } : { base: norm(name), spec: null };
}

/** Klucz tradycji pasujacy do specjalizacji talentu (nazwa, alias albo rdzen). */
export function matchLore(
  spec: string,
  lores: Record<string, LoreDef>,
  group?: LoreDef["group"]
): string | null {
  const target = norm(spec);
  const entries = Object.entries(lores).filter(([, l]) => !group || l.group === group);
  for (const [key, l] of entries) {
    if (norm(key) === target || l.aliases.some((a) => norm(a) === target)) return key;
  }
  if (/^dowoln/.test(target)) return null;
  for (const [key, l] of entries) {
    if (stem(key) === stem(target) || l.aliases.some((a) => stem(a) === stem(target))) return key;
  }
  return null;
}

/** Bostwo (klucz) i ewentualny aspekt dla specjalizacji talentu. */
export function matchDeity(
  spec: string,
  prayers: PrayersData
): { deity: string; aspect: string | null } | null {
  const target = norm(spec);
  if (/^dowoln/.test(target)) return null;
  for (const [deity, d] of Object.entries(prayers.deities)) {
    if (norm(deity) === target) return { deity, aspect: null };
    const alias = d.aliases.find((a) => norm(a) === target);
    if (alias) {
      // Alias bedacy odmiana nazwy (Mananna) to nie aspekt; aspekt = osobne imie.
      const isAspect = stem(alias) !== stem(deity);
      return { deity, aspect: isAspect ? alias : null };
    }
  }
  for (const deity of Object.keys(prayers.deities)) {
    if (stem(deity) === stem(target)) return { deity, aspect: null };
  }
  return null;
}

/** Profil magiczno-religijny postaci wynikajacy z jej talentow. */
export interface MagicProfile {
  /** Ma talent Magia Prosta. */
  petty: boolean;
  /** Dostepne tradycje Magii Prostej (zawsze "Prosta" + warianty z talentu). */
  pettyLores: string[];
  /** Dostepne tradycje Magii Tajemnej (bez wspolnej "Tajemna"). */
  arcaneLores: string[];
  /** Dostepne tradycje Magii Chaosu. */
  chaosLores: string[];
  /** Bostwa z talentow Blogoslawienstwo. */
  blessDeities: string[];
  /** Bostwa (i aspekty) z talentow Inwokacja. */
  invokes: { deity: string; aspect: string | null }[];
  /** Talenty magiczne bez rozpoznanej tradycji/bostwa (np. "(Dowolna Tradycja)"). */
  unresolved: string[];
}

export function magicProfile(
  talentNames: string[],
  spells: SpellsData,
  prayers: PrayersData
): MagicProfile {
  const p: MagicProfile = {
    petty: false,
    pettyLores: [],
    arcaneLores: [],
    chaosLores: [],
    blessDeities: [],
    invokes: [],
    unresolved: []
  };
  const add = (list: string[], v: string) => { if (!list.includes(v)) list.push(v); };
  for (const name of talentNames) {
    const { base, spec } = splitTalent(name);
    if (base === "magia prosta") {
      p.petty = true;
      if ("Prosta" in spells.lores) add(p.pettyLores, "Prosta");
      if (spec) {
        const lore = matchLore(spec, spells.lores, "petty");
        if (lore) add(p.pettyLores, lore);
      }
    } else if (base === "magia tajemna" || base === "wysoka magia") {
      const lore = base === "wysoka magia" ? matchLore("Wysoka Magia", spells.lores, "arcane") : spec ? matchLore(spec, spells.lores, "arcane") : null;
      if (lore) add(p.arcaneLores, lore);
      else p.unresolved.push(name);
    } else if (base === "magia chaosu") {
      const lore = spec ? matchLore(spec, spells.lores, "chaos") : null;
      if (lore) add(p.chaosLores, lore);
      else p.unresolved.push(name);
    } else if (base === "błogosławieństwo") {
      const d = spec ? matchDeity(spec, prayers) : null;
      if (d) add(p.blessDeities, d.deity);
      else p.unresolved.push(name);
    } else if (base === "inwokacja") {
      const d = spec ? matchDeity(spec, prayers) : null;
      if (d) {
        if (!p.invokes.some((x) => x.deity === d.deity && x.aspect === d.aspect)) p.invokes.push(d);
      } else p.unresolved.push(name);
    }
  }
  return p;
}

/** Czy postac moze w ogole poznawac zaklecia / cuda (wzajemne wykluczenie). */
export function casterKind(p: MagicProfile): { spells: boolean; prayers: boolean } {
  const hasSpells = p.petty || p.arcaneLores.length > 0 || p.chaosLores.length > 0;
  const hasPrayers = p.invokes.length > 0 || p.blessDeities.length > 0;
  return { spells: hasSpells, prayers: hasPrayers };
}

/** Wynik sprawdzenia dostepnosci zaklecia/cudu. */
export interface Availability {
  allowed: boolean;
  /** Powod odmowy (gdy allowed=false) - do pokazania w UI. */
  reason?: string;
}

/** Czy postac moze poznac zaklecie (bez zgody MG). */
export function spellAvailability(
  spell: SpellDef,
  p: MagicProfile,
  spells: SpellsData
): Availability {
  const lore = spells.lores[spell.lore];
  const group = lore?.group ?? "arcane";
  if (p.invokes.length > 0) {
    return { allowed: false, reason: "Postać z Inwokacją nie może uczyć się zaklęć." };
  }
  if (group === "petty") {
    if (!p.petty) return { allowed: false, reason: "Wymaga Talentu Magia Prosta." };
    if (!p.pettyLores.includes(spell.lore)) {
      return { allowed: false, reason: `Wariant Magii Prostej „${lore?.label ?? spell.lore}” wymaga odpowiedniej specjalizacji talentu.` };
    }
    return { allowed: true };
  }
  if (group === "chaos") {
    if (!p.chaosLores.length) return { allowed: false, reason: "Wymaga Talentu Magia Chaosu." };
    if (spell.lore === "Tajemna Chaosu" || p.chaosLores.includes(spell.lore)) return { allowed: true };
    return { allowed: false, reason: `Wymaga Magii Chaosu (${lore?.label ?? spell.lore}).` };
  }
  // arcane
  if (!p.arcaneLores.length) return { allowed: false, reason: "Wymaga Talentu Magia Tajemna (Tradycja)." };
  if (spell.requires?.length) {
    const missing = spell.requires.filter((r) => !p.arcaneLores.includes(r));
    return missing.length
      ? { allowed: false, reason: `Wymaga znajomości tradycji: ${spell.requires.join(" i ")}.` }
      : { allowed: true };
  }
  if (spell.lore === "Tajemna" || p.arcaneLores.includes(spell.lore)) return { allowed: true };
  return { allowed: false, reason: `Tradycja ${lore?.label ?? spell.lore} — postać jej nie zna.` };
}

/** Czy postac moze poznac cud (bez zgody MG). */
export function miracleAvailability(miracle: PrayerDef, p: MagicProfile): Availability {
  if (p.arcaneLores.length > 0) {
    return { allowed: false, reason: "Postać z Magią Tajemną nie może wzywać cudów." };
  }
  const inv = p.invokes.filter((i) => i.deity === miracle.deity);
  if (!inv.length) return { allowed: false, reason: `Wymaga Talentu Inwokacja (${miracle.deity ?? "bóstwo"}).` };
  if (miracle.aspect && !inv.some((i) => i.aspect === miracle.aspect)) {
    return { allowed: false, reason: `Cud aspektu „${miracle.aspect}” — wymaga Inwokacji (${miracle.aspect}).` };
  }
  return { allowed: true };
}

/** Koszt kolejnego zaklecia wg grupy tradycji i liczby juz znanych. */
export function spellCost(
  group: LoreDef["group"],
  known: { petty: number; arcane: number },
  bonuses: { willpower: number; intelligence: number }
): { cost: number; note: string } {
  if (group === "petty") {
    const wpb = Math.max(1, bonuses.willpower);
    const n = known.petty;
    if (n < bonuses.willpower) return { cost: 0, note: `darmowe z Talentu (${n + 1}/${bonuses.willpower} = BSW)` };
    const mult = Math.ceil(n / wpb);
    return { cost: 50 * mult, note: `50 PD × ${mult} (znane: ${n}, BSW ${bonuses.willpower})` };
  }
  if (group === "chaos") return { cost: 100, note: "100 PD (+1 Punkt Zepsucia)" };
  const intb = Math.max(1, bonuses.intelligence);
  const n = known.arcane;
  const mult = Math.max(1, Math.ceil(n / intb));
  return { cost: 100 * mult, note: `100 PD × ${mult} (znane: ${n}, BInt ${bonuses.intelligence})` };
}

/** Koszt kolejnego cudu: pierwszy z Inwokacja, potem 100 PD × liczba znanych. */
export function miracleCost(known: number): { cost: number; note: string } {
  if (known <= 0) return { cost: 0, note: "pierwszy cud z Talentu Inwokacja" };
  return { cost: 100 * known, note: `100 PD × ${known} (znane cuda)` };
}

/** Blogoslawienstwa nalezne postaci (z talentow Blogoslawienstwo). */
export function grantedBlessings(p: MagicProfile, prayers: PrayersData): { deity: string; blessing: PrayerDef }[] {
  const out: { deity: string; blessing: PrayerDef }[] = [];
  for (const deity of p.blessDeities) {
    for (const name of prayers.deities[deity]?.blessings ?? []) {
      const b = prayers.blessings.find((x) => x.name === name);
      if (b) out.push({ deity, blessing: b });
    }
  }
  return out;
}
