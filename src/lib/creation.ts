/**
 * Logika tworzenia postaci WFRP 4ed (Krok 1 i 3): losowanie rasy,
 * rzuty na cechy wg tabeli atrybutow, wyliczanie Zywotnosci i ruchu.
 *
 * Funkcje sa czyste i przyjmuja generator liczb losowych (RNG), dzieki czemu
 * sa w pelni testowalne.
 */

import { ATTRIBUTES, type Attribute } from "./rules";
import type { RaceDef } from "./types";

/** Generator liczb losowych w zakresie [0, 1). Domyslnie Math.random. */
export type Rng = () => number;

const defaultRng: Rng = Math.random;

/** Rzut koscia o podanej liczbie scian (1..sides). */
export function rollDie(sides: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * sides) + 1;
}

/** Rzut 2k10 (suma dwoch k10), zakres 2..20. */
export function roll2k10(rng: Rng = defaultRng): number {
  return rollDie(10, rng) + rollDie(10, rng);
}

/** Rzut k100 (1..100). */
export function rollK100(rng: Rng = defaultRng): number {
  return rollDie(100, rng);
}

/** Wynik rzutu na pojedyncza ceche. */
export interface CharacteristicRoll {
  /** Bazowa wartosc rasowa (np. +20). */
  base: number;
  /** Wynik rzutu 2k10 (2..20). */
  roll: number;
  /** Suma base + roll. */
  total: number;
}

/** Komplet rzutow na cechy danej rasy (w kolejnosci ATTRIBUTES). */
export type CharacteristicRolls = Record<Attribute, CharacteristicRoll>;

/** Wykonuje rzuty 2k10+baza dla wszystkich cech zgodnie z definicja rasy. */
export function rollRaceCharacteristics(
  race: RaceDef,
  rng: Rng = defaultRng
): CharacteristicRolls {
  const out = {} as CharacteristicRolls;
  for (const attr of ATTRIBUTES) {
    const base = race.characteristics[attr] ?? 0;
    const roll = roll2k10(rng);
    out[attr] = { base, roll, total: base + roll };
  }
  return out;
}

/** Bonus z cechy = cyfra dziesiatek (np. 37 -> 3). */
export function characteristicBonus(value: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n / 10);
}

/**
 * Oblicza Zywotnosc na podstawie bonusow.
 * Standardowo BS + 2xBWt + BSW; dla Niziolka (includeStrength=false) bez BS.
 */
export function computeWounds(
  strengthBonus: number,
  toughnessBonus: number,
  willpowerBonus: number,
  includeStrength: boolean
): number {
  const strPart = includeStrength ? strengthBonus : 0;
  return strPart + 2 * toughnessBonus + willpowerBonus;
}

/** Wyliczone tempo poruszania (Chod / Bieg) na podstawie Szybkosci. */
export interface MovementSteps {
  walk: number;
  run: number;
}

/** Chod = 2x Szybkosc, Bieg = 4x Szybkosc (Sz3=6/12, Sz4=8/16, Sz5=10/20). */
export function movementSteps(movement: number): MovementSteps {
  return { walk: movement * 2, run: movement * 4 };
}
