/**
 * Reguly gry niezalezne od interfejsu (port z core/rules.py).
 *
 * Czyste funkcje i stale opisujace koszty rozwoju postaci w WFRP 4ed.
 */

/** Typ rozwiniecia uzywany przy liczeniu kosztow. */
export type AdvancementType = "cecha" | "umiejetnosc";

/**
 * Tabela kosztow rozwiniec: prog sumarycznych rozwiniec -> [koszt cechy, koszt umiejetnosci].
 * Ostatni prog (Infinity) obowiazuje powyzej 70 rozwiniec.
 */
export const COST_TABLE: ReadonlyArray<readonly [number, number, number]> = [
  [5, 25, 10],
  [10, 30, 15],
  [15, 40, 20],
  [20, 50, 30],
  [25, 70, 40],
  [30, 90, 60],
  [35, 120, 80],
  [40, 150, 110],
  [45, 190, 140],
  [50, 230, 180],
  [55, 280, 220],
  [60, 330, 270],
  [65, 390, 320],
  [70, 450, 380],
  [Infinity, 520, 440]
];

/** Kolejnosc glownych cech postaci. */
export const ATTRIBUTES = [
  "WW",
  "US",
  "S",
  "Wt",
  "I",
  "Zw",
  "Zr",
  "Int",
  "SW",
  "Ogd"
] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

/** Koszt jednego rozwiniecia talentu (100 PD za kazde wykupienie). */
export const TALENT_COST_PER_ADVANCE = 100;

/**
 * Oblicza calkowity koszt PD dla rozwiniec.
 * Rozwoj SPOZA profesji podwaja koszt, chyba ze MG wyrazil zgode (gmApproved).
 */
export function calculateAdvancementCost(
  advancementType: AdvancementType,
  currentAdvancements: number,
  desiredAdvancements: number,
  outOfProfession = false,
  gmApproved = false
): number {
  let totalCost = 0;
  let remaining = desiredAdvancements;
  let currentThreshold = currentAdvancements;

  while (remaining > 0) {
    for (const [threshold, charCost, skillCost] of COST_TABLE) {
      if (currentThreshold < threshold) {
        const toThreshold = Math.min(remaining, threshold - currentThreshold);

        if (advancementType === "cecha") {
          totalCost += charCost * toThreshold;
        } else if (advancementType === "umiejetnosc") {
          totalCost += skillCost * toThreshold;
        }

        remaining -= toThreshold;
        currentThreshold += toThreshold;
        if (remaining === 0) {
          break;
        }
      }
    }
  }

  if (outOfProfession && !gmApproved) {
    totalCost *= 2;
  }
  return totalCost;
}

/**
 * Koszt PD za zakup `amount` kolejnych wykupien talentu.
 * Kazde wykupienie kosztuje 100 PD pomnozone przez jego numer (100, 200, 300...).
 * Rozwoj spoza profesji podwaja koszt, chyba ze MG wyrazil zgode.
 */
export function calculateTalentCost(
  currentAdvances: number,
  amount = 1,
  outOfProfession = false,
  gmApproved = false
): number {
  const current = Math.max(0, currentAdvances);
  const count = Math.max(0, amount);
  let cost = 0;
  for (let step = 1; step <= count; step++) {
    cost += TALENT_COST_PER_ADVANCE * (current + step);
  }
  if (outOfProfession && !gmApproved) {
    cost *= 2;
  }
  return cost;
}
