import { describe, it, expect, beforeAll } from "vitest";
import { loadTestGameData } from "./loadData";
import { DataManager } from "../character";
import * as gameData from "../gameData";

beforeAll(() => {
  loadTestGameData();
});

function freshDm(): DataManager {
  const dm = new DataManager();
  dm.createNewCharacter("Tester");
  return dm;
}

describe("Faza D: talenty +cecha (pkt 22)", () => {
  it("dodaje staly bonus do cechy i kaskaduje na umiejetnosci", () => {
    const dm = freshDm();
    dm.addSkill("Walka Wręcz (Podstawowa)", "WW", 0, 0, true);
    dm.recompute();
    const before = dm.attributes.WW.current;
    const skillBefore = dm.skills["Walka Wręcz (Podstawowa)"].current;

    dm.addTalent("Urodzony Wojownik");
    dm.talents["Urodzony Wojownik"].characteristicBonus = { code: "WW", value: 5 };
    dm.recompute();

    expect(dm.attributes.WW.current).toBe(before + 5);
    expect(dm.skills["Walka Wręcz (Podstawowa)"].current).toBe(skillBefore + 5);
  });

  it("obsluguje wynik rzutu (wartosc inna niz 5)", () => {
    const dm = freshDm();
    const before = dm.attributes.S.current;
    dm.addTalent("Bardzo Silny");
    dm.talents["Bardzo Silny"].characteristicBonus = { code: "S", value: 8 };
    dm.recompute();
    expect(dm.attributes.S.current).toBe(before + 8);
  });

  it("usuniecie talentu cofa bonus", () => {
    const dm = freshDm();
    const before = dm.attributes.Int.current;
    dm.addTalent("Błyskotliwość");
    dm.talents["Błyskotliwość"].characteristicBonus = { code: "Int", value: 5 };
    dm.recompute();
    expect(dm.attributes.Int.current).toBe(before + 5);

    delete dm.talents["Błyskotliwość"];
    dm.recompute();
    expect(dm.attributes.Int.current).toBe(before);
  });

  it("bonus przetrwa serializacje toDict/fromDict", () => {
    const dm = freshDm();
    dm.addTalent("Zręczny");
    dm.talents["Zręczny"].characteristicBonus = { code: "Zr", value: 5 };
    dm.recompute();
    const before = dm.attributes.Zr.current;

    const dm2 = new DataManager();
    dm2.fromDict(dm.toDict());
    expect(dm2.talents["Zręczny"].characteristicBonus).toEqual({ code: "Zr", value: 5 });
    expect(dm2.attributes.Zr.current).toBe(before);
  });
});

describe("Faza D: Twardziel (Zywotnosc = Bonus z Wytrzymalosci)", () => {
  it("dodaje Bonus z Wytrzymalosci do Zywotnosci", () => {
    const dm = freshDm();
    dm.recomputeWounds();
    const base = dm.stats.wounds;
    const wtB = gameData.attributeBonus(dm.attributes.Wt.current);

    dm.addTalent("Twardziel");
    dm.recomputeWounds();
    expect(dm.stats.wounds).toBe(base + wtB);
  });

  it("aktualizuje Zywotnosc retroaktywnie po zmianie Wytrzymalosci", () => {
    const dm = freshDm();
    dm.addTalent("Twardziel");
    dm.recomputeWounds();

    dm.attributes.Wt.advanced = 10;
    dm.recompute();
    dm.recomputeWounds();

    const wtB = gameData.attributeBonus(dm.attributes.Wt.current);
    const sB = gameData.attributeBonus(dm.attributes.S.current);
    const swB = gameData.attributeBonus(dm.attributes.SW.current);
    expect(dm.stats.wounds).toBe(sB + 2 * wtB + swB + wtB);
  });
});
