import { describe, it, expect } from "vitest";
import {
  ATTRIBUTES,
  COST_TABLE,
  TALENT_COST_PER_ADVANCE,
  calculateAdvancementCost,
  calculateTalentCost
} from "../rules";

describe("rules: stale", () => {
  it("ma 10 cech w poprawnej kolejnosci", () => {
    expect([...ATTRIBUTES]).toEqual([
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
    ]);
  });

  it("talent kosztuje 100 PD za wykupienie", () => {
    expect(TALENT_COST_PER_ADVANCE).toBe(100);
  });

  it("ostatni prog tabeli kosztow to Infinity", () => {
    expect(COST_TABLE[COST_TABLE.length - 1][0]).toBe(Infinity);
  });
});

describe("rules: calculateAdvancementCost", () => {
  it("pierwsze rozwiniecie cechy = 25 PD", () => {
    expect(calculateAdvancementCost("cecha", 0, 1)).toBe(25);
  });

  it("pierwsze rozwiniecie umiejetnosci = 10 PD", () => {
    // pierwsze 5 rozwiniec umiejetnosci po 10 PD
    expect(calculateAdvancementCost("umiejetnosc", 0, 1)).toBe(10);
    expect(calculateAdvancementCost("umiejetnosc", 0, 5)).toBe(50);
  });

  it("przekracza prog: 5 rozwiniec cechy = 125, 6 = 155", () => {
    expect(calculateAdvancementCost("cecha", 0, 5)).toBe(125); // 5 x 25
    expect(calculateAdvancementCost("cecha", 0, 6)).toBe(155); // 5x25 + 1x30
  });

  it("uwzglednia obecny poziom rozwiniec", () => {
    // od 5 do 6 rozwiniec cechy = 30 PD (drugi prog)
    expect(calculateAdvancementCost("cecha", 5, 1)).toBe(30);
  });

  it("spoza profesji podwaja koszt", () => {
    expect(calculateAdvancementCost("cecha", 0, 1, true, false)).toBe(50);
  });

  it("zgoda MG znosi podwojenie", () => {
    expect(calculateAdvancementCost("cecha", 0, 1, true, true)).toBe(25);
  });
});

describe("rules: calculateTalentCost", () => {
  it("pierwsze wykupienie = 100 PD", () => {
    expect(calculateTalentCost(0, 1)).toBe(100);
  });

  it("koszt jest progresywny: 0->3 = 100+200+300 = 600", () => {
    expect(calculateTalentCost(0, 3)).toBe(600);
  });

  it("uwzglednia obecne wykupienia: majac 2, kolejne = 300", () => {
    expect(calculateTalentCost(2, 1)).toBe(300);
  });

  it("spoza profesji podwaja koszt", () => {
    expect(calculateTalentCost(0, 1, true, false)).toBe(200);
  });

  it("zgoda MG znosi podwojenie", () => {
    expect(calculateTalentCost(0, 2, true, true)).toBe(300);
  });
});
