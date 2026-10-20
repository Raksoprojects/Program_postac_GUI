/**
 * Kosci i losowanie (przeniesione z Generatora BN). Funkcje przyjmuja generator
 * liczb losowych (Rng), dzieki czemu losowanie jest testowalne (seedRng).
 */

/** Generator liczb losowych w zakresie [0, 1). */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Deterministyczny generator (mulberry32) - do testow i powtarzalnych wynikow. */
export function seedRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rzut koscia o podanej liczbie scian (1..sides). */
export function rollDie(sides: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * sides) + 1;
}

/** Rzut k100 (1..100). */
export function rollK100(rng: Rng = defaultRng): number {
  return rollDie(100, rng);
}

/** Losowy element listy (lub undefined dla pustej). */
export function pick<T>(items: readonly T[], rng: Rng = defaultRng): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(rng() * items.length)];
}

/** Losowanie wazone. Elementy z waga <= 0 sa pomijane. */
export function weightedPick<T>(
  items: readonly T[],
  weight: (item: T) => number,
  rng: Rng = defaultRng
): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const item of items) {
    const w = Math.max(0, weight(item));
    if (w <= 0) continue;
    if (r < w) return item;
    r -= w;
  }
  return items[items.length - 1];
}
