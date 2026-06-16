import { describe, it, expect, beforeAll } from "vitest";
import { loadTestGameData } from "./loadData";
import {
  allRaceNames,
  getRace,
  raceForRoll,
  randomTalentForRoll
} from "../gameData";
import {
  rollDie,
  roll2k10,
  rollK100,
  rollRaceCharacteristics,
  characteristicBonus,
  computeWounds,
  movementSteps,
  type Rng
} from "../creation";
import { ATTRIBUTES } from "../rules";

/** RNG deterministyczny zwracajacy kolejne wartosci z listy (cyklicznie). */
function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("creation: rzuty kostkami", () => {
  it("rollDie zwraca wartosci w zakresie 1..sides", () => {
    expect(rollDie(10, () => 0)).toBe(1);
    expect(rollDie(10, () => 0.99)).toBe(10);
    expect(rollDie(100, () => 0)).toBe(1);
    expect(rollDie(100, () => 0.999)).toBe(100);
  });

  it("roll2k10 sumuje dwa rzuty k10 (2..20)", () => {
    expect(roll2k10(() => 0)).toBe(2);
    expect(roll2k10(() => 0.99)).toBe(20);
    // 0.45 -> floor(4.5)+1 = 5; dwa razy = 10
    expect(roll2k10(() => 0.45)).toBe(10);
  });

  it("rollK100 zwraca 1..100", () => {
    expect(rollK100(() => 0)).toBe(1);
    expect(rollK100(() => 0.999)).toBe(100);
  });
});

describe("creation: cechy, zywotnosc, ruch", () => {
  beforeAll(() => {
    loadTestGameData();
  });

  it("characteristicBonus = cyfra dziesiatek", () => {
    expect(characteristicBonus(0)).toBe(0);
    expect(characteristicBonus(9)).toBe(0);
    expect(characteristicBonus(37)).toBe(3);
    expect(characteristicBonus(40)).toBe(4);
    expect(characteristicBonus(-5)).toBe(0);
  });

  it("rollRaceCharacteristics dodaje baze rasowa do rzutu 2k10", () => {
    const human = getRace("Człowiek");
    expect(human).toBeDefined();
    const rolls = rollRaceCharacteristics(human!, () => 0); // kazdy k10 = 1 => 2k10 = 2
    for (const attr of ATTRIBUTES) {
      expect(rolls[attr].roll).toBe(2);
      expect(rolls[attr].base).toBe(human!.characteristics[attr]);
      expect(rolls[attr].total).toBe(human!.characteristics[attr] + 2);
    }
  });

  it("computeWounds: standard BS + 2xBWt + BSW", () => {
    expect(computeWounds(3, 4, 2, true)).toBe(3 + 8 + 2);
  });

  it("computeWounds: niziolek bez BS", () => {
    expect(computeWounds(3, 4, 2, false)).toBe(8 + 2);
  });

  it("movementSteps: Sz3=6/12, Sz4=8/16, Sz5=10/20", () => {
    expect(movementSteps(3)).toEqual({ walk: 6, run: 12 });
    expect(movementSteps(4)).toEqual({ walk: 8, run: 16 });
    expect(movementSteps(5)).toEqual({ walk: 10, run: 20 });
  });
});

describe("gameData: rasy (races.json)", () => {
  beforeAll(() => {
    loadTestGameData();
  });

  it("allRaceNames zawiera 5 ras", () => {
    const names = allRaceNames();
    expect(names).toContain("Człowiek");
    expect(names).toContain("Krasnolud");
    expect(names).toContain("Niziołek");
    expect(names).toContain("Wysoki elf");
    expect(names).toContain("Leśny elf");
  });

  it("getRace zwraca definicje z cechami i talentami", () => {
    const dwarf = getRace("Krasnolud");
    expect(dwarf?.characteristics.SW).toBe(40);
    expect(dwarf?.woundsIncludeStrength).toBe(true);
    expect(dwarf?.skills.length).toBeGreaterThanOrEqual(11);
    expect(dwarf?.talents.length).toBeGreaterThan(0);

    const halfling = getRace("Niziołek");
    expect(halfling?.woundsIncludeStrength).toBe(false);
  });

  it("raceForRoll mapuje k100 wg tabeli losowania", () => {
    expect(raceForRoll(1)).toBe("Człowiek");
    expect(raceForRoll(90)).toBe("Człowiek");
    expect(raceForRoll(91)).toBe("Niziołek");
    expect(raceForRoll(94)).toBe("Niziołek");
    expect(raceForRoll(95)).toBe("Krasnolud");
    expect(raceForRoll(98)).toBe("Krasnolud");
    expect(raceForRoll(99)).toBe("Wysoki elf");
    expect(raceForRoll(100)).toBe("Leśny elf");
  });

  it("randomTalentForRoll mapuje k100 na talenty", () => {
    expect(randomTalentForRoll(1)).toBe("Atrakcyjny");
    expect(randomTalentForRoll(3)).toBe("Atrakcyjny");
    expect(randomTalentForRoll(59)).toBe("Szczęście");
    expect(randomTalentForRoll(100)).toBe("Zręczny");
  });

  it("oba elfy maja te same cechy (kolumna Elf)", () => {
    const wood = getRace("Leśny elf");
    const high = getRace("Wysoki elf");
    for (const attr of ATTRIBUTES) {
      expect(wood?.characteristics[attr]).toBe(high?.characteristics[attr]);
    }
  });

  it("seqRng pozwala deterministycznie sterowac rzutami", () => {
    // 0 -> 1, 0.99 -> 100
    const rng = seqRng([0, 0.99]);
    expect(rollK100(rng)).toBe(1);
    expect(rollK100(rng)).toBe(100);
  });
});
