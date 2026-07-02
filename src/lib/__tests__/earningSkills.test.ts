import { describe, it, expect } from "vitest";
import { setGameData, getProfession, getEarningSkills, isEarningSkill } from "../gameData";

/**
 * Testy mechaniki umiejetnosci zarobkowej (pkt 19). Uzywamy syntetycznych danych,
 * bo produkcyjny professions.json nie zawiera jeszcze markerow "+".
 */
function inject(): void {
  setGameData({
    professions: {
      Testowa: {
        levels: [
          {
            level: 1,
            title: "Uczen",
            status: "Brąz 1",
            characteristics: [],
            skills: ["Hazard+", "Wiedza (Nauka)", "Targowanie +"],
            talents: [],
            trappings: []
          },
          {
            level: 2,
            title: "Mistrz",
            status: "Srebro 1",
            characteristics: [],
            skills: ["Plotkowanie"],
            talents: [],
            trappings: []
          }
        ]
      }
    },
    classes: {},
    talents: {}
  });
}

describe("Faza E: umiejetnosc zarobkowa (pkt 19)", () => {
  it("odcina sufiks + z nazwy umiejetnosci w schemacie", () => {
    inject();
    const prof = getProfession("Testowa");
    expect(prof?.levels[0].skills).toEqual([
      "Hazard",
      "Wiedza (Nauka)",
      "Targowanie"
    ]);
  });

  it("zapisuje umiejetnosci zarobkowe w earning_skills poziomu", () => {
    inject();
    const prof = getProfession("Testowa");
    expect(prof?.levels[0].earning_skills).toEqual(["Hazard", "Targowanie"]);
    expect(prof?.levels[1].earning_skills).toBeUndefined();
  });

  it("getEarningSkills zwraca zbior nazw bazowych profesji", () => {
    inject();
    const set = getEarningSkills("Testowa");
    expect(set.has("Hazard")).toBe(true);
    expect(set.has("Targowanie")).toBe(true);
    expect(set.has("Wiedza (Nauka)")).toBe(false);
  });

  it("isEarningSkill dopasowuje po normalizacji (case/spacje)", () => {
    inject();
    expect(isEarningSkill("Testowa", "hazard")).toBe(true);
    expect(isEarningSkill("Testowa", "Targowanie")).toBe(true);
    expect(isEarningSkill("Testowa", "Plotkowanie")).toBe(false);
    expect(isEarningSkill(null, "Hazard")).toBe(false);
  });
});
