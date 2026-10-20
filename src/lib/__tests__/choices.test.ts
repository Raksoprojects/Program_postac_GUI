/**
 * Wybory specjalizacji w schemacie profesji ("(Dowolna)" / "A albo B"):
 * wybor jest zapamietywany jako czesc profesji (rozwijalny jak kazda inna
 * pozycja schematu), a kazdy wpis "dowolny" to osobny slot - wybranie jednego
 * nie blokuje innego.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadTestGameData } from "./loadData";
import { DataManager } from "../character";
import {
  choiceSlotKey,
  getCareerDevelopable,
  isCareerCompleted,
  isSkillDevelopable,
  isTalentDevelopable,
  parseChoiceSlotKey
} from "../gameData";
import { parseSpecialization } from "../specialization";

beforeAll(() => {
  loadTestGameData();
});

const skill = (adv: number) => ({
  attribute: "WW",
  initial: 30,
  advanced: adv,
  current: 30 + adv,
  base_advanced: adv,
  is_new: false,
  profession_available: false
});

describe("wybory specjalizacji: rozwijalnosc", () => {
  it("nierozstrzygniety wpis '(Dowolna)' jest slotem i nie odblokowuje calej grupy", () => {
    // Żołnierz 2: "Broń Biała (Dowolna)" na poziomie 2.
    const dev = getCareerDevelopable("Żołnierz", 2, {}, {}, {});
    expect([...dev.skills]).not.toContain("Broń Biała (Dowolna)");
    expect(dev.skillSlots.map((s) => s.scheme)).toContain("Broń Biała (Dowolna)");
    expect(isSkillDevelopable("Broń Biała (Drzewcowa)", dev)).toBe(false);
    // Konkretna pozycja z poziomu 1 nadal rozwijalna.
    expect(isSkillDevelopable("Broń Biała (Podstawowa)", dev)).toBe(true);
  });

  it("zapamietany wybor staje sie umiejetnoscia profesji", () => {
    const key = choiceSlotKey("Żołnierz", 2, "Broń Biała (Dowolna)");
    const dev = getCareerDevelopable("Żołnierz", 2, {}, { [key]: "Broń Biała (Drzewcowa)" }, {});
    expect(isSkillDevelopable("Broń Biała (Drzewcowa)", dev)).toBe(true);
    expect(dev.skillSlots.map((s) => s.scheme)).not.toContain("Broń Biała (Dowolna)");
    // Inna bron z tej grupy nie jest odblokowana "przy okazji".
    expect(isSkillDevelopable("Broń Biała (Kawaleryjska)", dev)).toBe(false);
  });

  it("kazdy wpis '(Dowolna)' to osobny slot (wybor jednego nie blokuje drugiego)", () => {
    // Uczony ma "Wiedza (Dowolna)" na poziomach 1 i 2.
    const k1 = choiceSlotKey("Uczony", 1, "Wiedza (Dowolna)");
    const dev = getCareerDevelopable("Uczony", 2, {}, { [k1]: "Wiedza (Historia)" }, {});
    expect(isSkillDevelopable("Wiedza (Historia)", dev)).toBe(true);
    const open = dev.skillSlots.filter((s) => s.scheme === "Wiedza (Dowolna)");
    expect(open).toHaveLength(1);
    expect(open[0].level).toBe(2);
  });

  it("'A albo B' rozstrzyga sie sama, gdy postac ma jedna z opcji", () => {
    const dev = getCareerDevelopable("Żołnierz", 1, {}, {}, { "Muzyka (Bęben)": skill(0) });
    expect(isSkillDevelopable("Muzyka (Bęben)", dev)).toBe(true);
    expect(dev.skillSlots.map((s) => s.scheme)).not.toContain("Muzyka (Bęben albo Piszczałka)");
    // Bez posiadanej opcji - slot do wyboru, zadna opcja nie jest rozwijalna.
    const dev2 = getCareerDevelopable("Żołnierz", 1, {}, {}, {});
    expect(dev2.skillSlots.map((s) => s.scheme)).toContain("Muzyka (Bęben albo Piszczałka)");
    expect(isSkillDevelopable("Muzyka (Piszczałka)", dev2)).toBe(false);
  });

  it("talent '(Dowolny)' biezacego poziomu: slot, a po wyborze - talent profesji", () => {
    const scheme = "Etykieta (Dowolna Grupa)";
    const dev = getCareerDevelopable("Doradca", 1, {}, {}, {});
    expect(dev.talentSlots.map((s) => s.scheme)).toContain(scheme);
    expect(isTalentDevelopable("Etykieta (Szlachta)", dev)).toBe(false);
    const key = choiceSlotKey("Doradca", 1, scheme);
    const dev2 = getCareerDevelopable("Doradca", 1, {}, { [key]: "Etykieta (Szlachta)" }, {});
    expect(isTalentDevelopable("Etykieta (Szlachta)", dev2)).toBe(true);
    expect(dev2.talentSlots.map((s) => s.scheme)).not.toContain(scheme);
  });

  it("talent z nizszego poziomu nie jest rozwijalny (nawet wykupiony)", () => {
    const scheme = "Etykieta (Dowolna Grupa)";
    const key = choiceSlotKey("Doradca", 1, scheme);
    const owned = { "Etykieta (Szlachta)": { advances: 1 } };
    const dev = getCareerDevelopable("Doradca", 2, owned, { [key]: "Etykieta (Szlachta)" }, {});
    expect(isTalentDevelopable("Etykieta (Szlachta)", dev)).toBe(false);
  });

  it("klucz slotu da sie rozlozyc na skladowe", () => {
    const key = choiceSlotKey("żołnierz", 2, "Broń Biała (Dowolna)");
    expect(parseChoiceSlotKey(key)).toEqual({
      profession: "Żołnierz",
      level: 2,
      scheme: "Broń Biała (Dowolna)"
    });
  });

  it("opcje 'A, B, C albo D' sa rozdzielane takze po przecinkach", () => {
    const info = parseSpecialization("Broń Zasięgowa (Prochowa, Katapulta, Kusza albo Eksperymentalna)");
    expect(info.kind).toBe("choice");
    expect(info.options).toEqual(["Prochowa", "Katapulta", "Kusza", "Eksperymentalna"]);
  });
});

describe("wybory specjalizacji: kompletowanie i zapis postaci", () => {
  it("talent wybrany w slocie liczy sie do kompletowania profesji", () => {
    const scheme = "Etykieta (Dowolna Grupa)";
    const key = choiceSlotKey("Doradca", 1, scheme);
    const talents = { "Etykieta (Szlachta)": { advances: 1 } };
    const without = isCareerCompleted("Doradca", 1, {}, talents, {}, {});
    const withChoice = isCareerCompleted("Doradca", 1, {}, talents, {}, {
      [key]: "Etykieta (Szlachta)"
    });
    expect(without.talents_done).toBe(0);
    expect(withChoice.talents_done).toBe(1);
  });

  it("wybory przetrwaja zapis i odczyt JSON", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Test");
    dm.setCurrentCareer("Żołnierz", 2);
    const key = choiceSlotKey("Żołnierz", 2, "Broń Biała (Dowolna)");
    dm.professionChoices[key] = "Broń Biała (Drzewcowa)";
    const dm2 = new DataManager();
    expect(dm2.loadFromJson(dm.toJson())).toBe(true);
    expect(dm2.professionChoices[key]).toBe("Broń Biała (Drzewcowa)");
  });
});

describe("awans do nowej profesji z innej klasy na poziom 2+", () => {
  it("umiejetnosci z nizszych poziomow nowej profesji sa rozwijalne", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Test");
    dm.setCurrentCareer("Aptekarka", 1);
    dm.advanceToCareer("Żołnierz", 2);
    expect(dm.characterClass).toBe("Wojownicy");
    const dev = getCareerDevelopable(dm.currentCareer, dm.currentCareerLevel, dm.talents, dm.professionChoices, dm.skills);
    for (const s of ["Atletyka", "Unik", "Opanowanie", "Wspinaczka", "Hazard", "Plotkowanie"]) {
      expect(isSkillDevelopable(s, dev)).toBe(true);
    }
    expect(dev.characteristics.has("WW")).toBe(true);
    expect(dev.characteristics.has("US")).toBe(true);
  });
});
