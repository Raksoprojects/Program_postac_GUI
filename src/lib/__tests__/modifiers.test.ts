/**
 * Modyfikatory postaci (mutacje, wampiryzm, dary...): katalog modifiers.json,
 * rzuty koscmi, wplyw na cechy/umiejetnosci/Zywotnosc/statystyki i zapis JSON.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadTestGameData } from "./loadData";
import { DataManager } from "../character";
import { ATTRIBUTES } from "../rules";
import {
  instantiateModifier,
  modifierEffectLabels,
  rollModifierValue,
  type Rng
} from "../modifiers";
import type { CharacterModifier, ModifiersData } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(resolve(here, "../../../public/data/modifiers.json"), "utf-8")
) as ModifiersData;

beforeAll(() => {
  loadTestGameData();
});

/** Staly "rzut": zawsze najwyzszy wynik kosci. */
const maxRng: Rng = () => 0.9999;

function mod(partial: Partial<CharacterModifier>): CharacterModifier {
  return {
    id: partial.id ?? "m1",
    name: partial.name ?? "Test",
    category: "Własne",
    description: "",
    active: partial.active ?? true,
    characteristics: partial.characteristics ?? {},
    ...partial
  };
}

function freshCharacter(): DataManager {
  const dm = new DataManager();
  dm.createNewCharacter("Test");
  for (const code of ATTRIBUTES) dm.attributes[code].initial = 30;
  dm.stats = { wounds: 0, movement: 4, fate: 2, fortune: 2, resilience: 2, resolve: 2, motivation: "" };
  dm.addSkill("Percepcja", "I", 30, 5);
  dm.recompute();
  dm.recomputeWounds();
  return dm;
}

describe("modifiers.json: spojnosc katalogu", () => {
  it("kazdy wpis ma znana kategorie i poprawne kody cech", () => {
    const ids = new Set(catalog.categories.map((c) => c.id));
    expect(catalog.entries.length).toBeGreaterThan(100);
    for (const e of catalog.entries) {
      expect(ids.has(e.category), `${e.name}: kategoria ${e.category}`).toBe(true);
      for (const code of Object.keys(e.characteristics ?? {})) {
        expect(ATTRIBUTES as readonly string[], `${e.name}: cecha ${code}`).toContain(code);
      }
    }
  });

  it("zawiera przemiane w wampira (oficjalna tabela Wampiry s.14) i mutacje", () => {
    const vc = catalog.entries.find((e) => e.name === "Przemiana: Von Carstein");
    expect(vc?.characteristics).toMatchObject({ WW: 10, S: 20, SW: 20, Ogd: 10 });
    expect(vc).toMatchObject({ fate: -1, resilience: 1, movement: 2 });
    const ind = catalog.entries.find((e) => e.name === "Przemiana: Niezależny");
    expect(ind?.movement).toBe(1);
    expect(catalog.entries.some((e) => e.category === "spaczenie_fizyczne")).toBe(true);
    expect(catalog.entries.some((e) => e.category === "dary_krwi")).toBe(true);
  });
});

describe("modifiers: kosci i tworzenie", () => {
  it("rzuca kosci: k10, -2k10, liczby wprost", () => {
    expect(rollModifierValue(5)).toBe(5);
    expect(rollModifierValue("k10", maxRng)).toBe(10);
    expect(rollModifierValue("-2k10", maxRng)).toBe(-20);
    expect(rollModifierValue("1k6", () => 0)).toBe(1);
  });

  it("instantiateModifier rozstrzyga kosci w cechach i umiejetnosciach", () => {
    const def = catalog.entries.find((e) => e.name === "Puste kości");
    expect(def).toBeDefined();
    const m = instantiateModifier(def!, "Mutacje", maxRng);
    expect(m.characteristics.Zw).toBe(10);
    expect(m.skills?.Atletyka).toBe(10);
    expect(m.active).toBe(true);
  });

  it("etykiety efektow", () => {
    const labels = modifierEffectLabels(
      mod({ characteristics: { WW: 10, Ogd: -5 }, movement: 2, fate: -1 })
    );
    expect(labels).toEqual(["WW +10", "Ogd -5", "Szybkość +2", "Przeznaczenie -1"]);
  });
});

describe("DataManager: wplyw modyfikatorow", () => {
  it("zmienia wartosc cech i umiejetnosci, ale nie rozwiniecia", () => {
    const dm = freshCharacter();
    dm.addModifier(mod({ characteristics: { I: 10, Ogd: -5 }, skills: { Percepcja: 10 } }));
    expect(dm.attributes.I.current).toBe(40);
    expect(dm.attributes.I.advanced).toBe(0);
    expect(dm.attributes.Ogd.current).toBe(25);
    // Percepcja = I (40) + 5 rozwiniec + 10 z mutacji
    expect(dm.skills.Percepcja.current).toBe(55);
  });

  it("Zywotnosc liczona z cech po modyfikatorach (+ modyfikator Zywotnosci)", () => {
    const dm = freshCharacter();
    const before = dm.stats.wounds; // 3 + 2*3 + 3 = 12
    expect(before).toBe(12);
    dm.addModifier(mod({ characteristics: { Wt: 10 }, wounds: 1 }));
    expect(dm.stats.wounds).toBe(3 + 2 * 4 + 3 + 1);
  });

  it("Szybkosc/Przeznaczenie/Bohater: doliczane przy dodaniu, cofane przy usunieciu", () => {
    const dm = freshCharacter();
    dm.addModifier(mod({ id: "v", characteristics: { S: 20 }, movement: 2, fate: -1, resilience: 1 }));
    expect(dm.stats).toMatchObject({ movement: 6, fate: 1, fortune: 1, resilience: 3, resolve: 3 });
    dm.setModifierActive("v", false);
    expect(dm.stats).toMatchObject({ movement: 4, fate: 2, resilience: 2 });
    expect(dm.attributes.S.current).toBe(30);
    dm.setModifierActive("v", true);
    expect(dm.attributes.S.current).toBe(50);
    dm.removeModifier("v");
    expect(dm.stats).toMatchObject({ movement: 4, fate: 2, resilience: 2 });
    expect(dm.attributes.S.current).toBe(30);
  });

  it("edycja modyfikatora podmienia efekty (bez podwojenia statystyk)", () => {
    const dm = freshCharacter();
    dm.addModifier(mod({ id: "e", characteristics: { WW: 5 }, movement: 1 }));
    dm.updateModifier("e", mod({ id: "e", characteristics: { WW: 10 }, movement: 2 }));
    expect(dm.attributes.WW.current).toBe(40);
    expect(dm.stats.movement).toBe(6);
  });

  it("gorny limit cechy (maxCharacteristics)", () => {
    const dm = freshCharacter();
    dm.addModifier(mod({ maxCharacteristics: { Ogd: 5 } }));
    expect(dm.attributes.Ogd.current).toBe(5);
  });

  it("modyfikatory przetrwaja zapis i odczyt JSON bez ponownego naliczenia statystyk", () => {
    const dm = freshCharacter();
    dm.addModifier(mod({ id: "j", characteristics: { WW: 10 }, movement: 2 }));
    const dm2 = new DataManager();
    expect(dm2.loadFromJson(dm.toJson())).toBe(true);
    expect(dm2.modifiers).toHaveLength(1);
    expect(dm2.attributes.WW.current).toBe(40);
    expect(dm2.stats.movement).toBe(6);
  });
});
