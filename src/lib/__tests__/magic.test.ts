/**
 * Zaklecia i modlitwy: profil z talentow, koszty wg podrecznika podstawowego,
 * wykluczenia magia/modlitwy oraz zakup/cofniecie przez silnik PD.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { instantiateModifier } from "../modifiers";
import type { ModifiersData } from "../types";
import { loadTestGameData } from "./loadData";
import { DataManager } from "../character";
import { PendingEngine } from "../pending";
import * as gd from "../gameData";
import {
  grantedBlessings,
  magicProfile,
  miracleAvailability,
  miracleCost,
  spellAvailability,
  spellCost
} from "../magic";

beforeAll(() => {
  loadTestGameData();
});

const profile = (talents: string[]) => magicProfile(talents, gd.getSpellsData(), gd.getPrayersData());
const spell = (name: string) => gd.getSpellsData().spells.find((s) => s.name === name)!;
const firstOf = (lore: string) => gd.getSpellsData().spells.find((s) => s.lore === lore)!;

describe("dane zaklec i modlitw", () => {
  it("zawiera tradycje podstawowe, kolory i zaklecia Nekromanty", () => {
    const lores = gd.getSpellsData().lores;
    for (const k of ["Prosta", "Tajemna", "Ognia", "Cieni", "Nekromancji", "Wysokiej Magii"]) expect(lores[k]).toBeDefined();
    expect(lores.Prosta.group).toBe("petty");
    expect(spell("Spojrzenie Nagasha").lore).toBe("Nekromancji");
  });

  it("10 bostw po 6 blogoslawienstw, cuda z podstawki", () => {
    const p = gd.getPrayersData();
    expect(Object.keys(p.deities)).toHaveLength(10);
    for (const d of Object.values(p.deities)) expect(d.blessings).toHaveLength(6);
    expect(p.blessings).toHaveLength(19);
    const sigmar = p.miracles.filter((m) => m.deity === "Sigmar" && m.source === "Podręcznik podstawowy");
    expect(sigmar.map((m) => m.name)).toContain("Młot Sigmara");
  });
});

describe("profil magiczny z talentow", () => {
  it("rozpoznaje tradycje z roznych zapisow specjalizacji", () => {
    const p = profile(["Magia Prosta", "Magia Tajemna (Ognia)"]);
    expect(p.petty).toBe(true);
    expect(p.pettyLores).toContain("Prosta");
    expect(p.arcaneLores).toEqual(["Ognia"]);
    expect(profile(["Magia Tajemna (Ciena)"]).arcaneLores).toEqual(["Cieni"]);
    expect(profile(["Magia Tajemna (Nekromancji)"]).arcaneLores).toEqual(["Nekromancji"]);
    expect(profile(["Magia Tajemna (Dowolna Tradycja)"]).unresolved).toHaveLength(1);
  });

  it("bostwa i aspekty Ranalda", () => {
    const p = profile(["Błogosławieństwo (Ranald)", "Inwokacja (Zwodziciel)"]);
    expect(p.blessDeities).toEqual(["Ranald"]);
    expect(p.invokes).toEqual([{ deity: "Ranald", aspect: "Zwodziciel" }]);
    expect(profile(["Inwokacja (Ulryk)"]).invokes[0].deity).toBe("Ulryk");
  });

  it("Blogoslawienstwo daje 6 blogoslawienstw bostwa", () => {
    const b = grantedBlessings(profile(["Błogosławieństwo (Sigmar)"]), gd.getPrayersData());
    expect(b.map((x) => x.blessing.name)).toEqual([
      "Błogosławieństwo Bitwy", "Błogosławieństwo Ochrony", "Błogosławieństwo Odwagi",
      "Błogosławieństwo Prawości", "Błogosławieństwo Siły", "Błogosławieństwo Wytrzymałości"
    ]);
  });
});

describe("dostepnosc", () => {
  it("zaklecie tradycji wymaga Magii Tajemnej tej tradycji; wspolne Tajemne - dowolnej", () => {
    const p = profile(["Magia Tajemna (Ognia)"]);
    expect(spellAvailability(firstOf("Ognia"), p, gd.getSpellsData()).allowed).toBe(true);
    expect(spellAvailability(firstOf("Cieni"), p, gd.getSpellsData()).allowed).toBe(false);
    expect(spellAvailability(firstOf("Tajemna"), p, gd.getSpellsData()).allowed).toBe(true);
    expect(spellAvailability(firstOf("Prosta"), p, gd.getSpellsData()).allowed).toBe(false);
  });

  it("magia i Inwokacja wykluczaja sie", () => {
    const priest = profile(["Inwokacja (Sigmar)", "Magia Prosta"]);
    expect(spellAvailability(firstOf("Prosta"), priest, gd.getSpellsData()).allowed).toBe(false);
    const mage = profile(["Magia Tajemna (Ognia)", "Inwokacja (Sigmar)"]);
    const m = gd.getPrayersData().miracles.find((x) => x.deity === "Sigmar")!;
    expect(miracleAvailability(m, mage).allowed).toBe(false);
  });

  it("cud tylko dla bostwa z Inwokacji; cud aspektu wymaga aspektu", () => {
    const p = profile(["Inwokacja (Ranald)"]);
    const core = gd.getPrayersData().miracles.find((x) => x.deity === "Ranald" && !x.aspect)!;
    const aspect = gd.getPrayersData().miracles.find((x) => x.aspect === "Zwodziciel")!;
    const sigmar = gd.getPrayersData().miracles.find((x) => x.deity === "Sigmar")!;
    expect(miracleAvailability(core, p).allowed).toBe(true);
    expect(miracleAvailability(aspect, p).allowed).toBe(false);
    expect(miracleAvailability(sigmar, p).allowed).toBe(false);
    expect(miracleAvailability(aspect, profile(["Inwokacja (Zwodziciel)"])).allowed).toBe(true);
  });
});

describe("koszty wg podrecznika", () => {
  it("Magia Prosta: BSW darmowych, potem 50 PD × krotnosc BSW", () => {
    const b = { willpower: 3, intelligence: 4 };
    expect(spellCost("petty", { petty: 0, arcane: 0 }, b).cost).toBe(0);
    expect(spellCost("petty", { petty: 2, arcane: 0 }, b).cost).toBe(0);
    expect(spellCost("petty", { petty: 3, arcane: 0 }, b).cost).toBe(50);
    expect(spellCost("petty", { petty: 4, arcane: 0 }, b).cost).toBe(100);
    expect(spellCost("petty", { petty: 6, arcane: 0 }, b).cost).toBe(100);
    expect(spellCost("petty", { petty: 7, arcane: 0 }, b).cost).toBe(150);
  });

  it("Magia Tajemna: BInt=4 -> pierwsze piec po 100 PD, kolejne cztery po 200 PD", () => {
    const b = { willpower: 3, intelligence: 4 };
    const costs = [0, 1, 2, 3, 4, 5, 8, 9].map((n) => spellCost("arcane", { petty: 0, arcane: n }, b).cost);
    expect(costs).toEqual([100, 100, 100, 100, 100, 200, 200, 300]);
  });

  it("cuda: pierwszy z talentu, potem 100 PD × liczba znanych", () => {
    expect([0, 1, 2, 3].map((n) => miracleCost(n).cost)).toEqual([0, 100, 200, 300]);
  });
});

describe("silnik PD: poznawanie i cofanie", () => {
  it("zakup odejmuje PD, cofniecie zwraca, zapis JSON zachowuje zaklecia", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Mag");
    dm.experience = { available: 500, spent: 0, total: 500 };
    const engine = new PendingEngine(dm);
    const s = firstOf("Ognia");
    const entry = { name: s.name, lore: s.lore, cn: s.cn, range: s.range, target: s.target, duration: s.duration, description: s.description, cost: 100, is_new: true };
    expect(engine.learn("spell", entry).ok).toBe(true);
    expect(dm.experience.available).toBe(400);
    expect(engine.unlearn("spell", s.name).ok).toBe(true);
    expect(dm.experience.available).toBe(500);
    engine.learn("spell", entry);
    engine.confirm();
    expect(dm.spells[s.name].is_new).toBe(false);
    expect(dm.experience.spent).toBe(100);
    const dm2 = new DataManager();
    dm2.loadFromJson(dm.toJson());
    expect(dm2.spells[s.name].lore).toBe("Ognia");
  });

  it("revert usuwa nowe zaklecia i cuda", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Kapłan");
    dm.experience = { available: 300, spent: 0, total: 300 };
    const engine = new PendingEngine(dm);
    const m = gd.getPrayersData().miracles[0];
    engine.learn("miracle", { name: m.name, deity: m.deity!, range: m.range, target: m.target, duration: m.duration, description: m.description, cost: 100, is_new: true });
    expect(engine.revert()).toBe(100);
    expect(dm.miracles).toEqual({});
    expect(dm.experience.available).toBe(300);
  });

  it("wiersze PDF: zaklecia, cuda i blogoslawienstwa", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Kapłan");
    dm.addTalent("Błogosławieństwo (Morr)", 1, "", null, null, "Lista", false, false);
    const rows = dm.pdfSpellRows();
    expect(rows).toHaveLength(6);
    expect(rows[0].cn).toBe("—");
  });
});

describe("przemiana w wampira zmienia rase", () => {
  it("rasa ustawiana przy aktywacji i przywracana przy usunieciu", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Hans");
    dm.characterSpecies = "Człowiek";
    dm.addModifier({ id: "v", name: "Przemiana: Lahmianin", category: "Wampiryzm", description: "", active: true, characteristics: { WW: 10 }, race: "Wampir (Lahmianin)" });
    expect(dm.characterSpecies).toBe("Wampir (Lahmianin)");
    dm.setModifierActive("v", false);
    expect(dm.characterSpecies).toBe("Człowiek");
    dm.setModifierActive("v", true);
    dm.removeModifier("v");
    expect(dm.characterSpecies).toBe("Człowiek");
  });

  it("katalog: przemiana ustawia rase", () => {
    const catalog = JSON.parse(
      readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../public/data/modifiers.json"), "utf-8")
    ) as ModifiersData;
    const vc = catalog.entries.find((e) => e.name === "Przemiana: Von Carstein");
    expect(vc?.race).toBe("Wampir (Von Carstein)");
    expect(instantiateModifier(vc!, "Wampiryzm").race).toBe("Wampir (Von Carstein)");
  });
});
