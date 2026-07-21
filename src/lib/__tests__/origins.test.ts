import { describe, it, expect } from "vitest";
import { setGameData, getOrigins, getOrigin } from "../gameData";
import type { RaceDef, RacesData } from "../types";

/**
 * Testy fundamentu pochodzen (Faza 4): akcesory getOrigins/getOrigin oraz to, ze
 * brak pochodzen dla rasy daje pusta liste (krok pochodzenia w kreatorze ukryty).
 */

const dwarf: RaceDef = {
  randomMin: 1,
  randomMax: 100,
  characteristics: { WW: 30, S: 20 },
  woundsIncludeStrength: true,
  fate: 0,
  resilience: 2,
  extraPoints: 3,
  movement: 3,
  skills: ["Odporność", "Wiedza (Krasnoludy)"],
  talents: [{ type: "fixed", name: "Rodowa Uraza" }]
};

const races: RacesData = {
  randomTalentsTable: [],
  races: { Krasnolud: dwarf, Człowiek: { ...dwarf, skills: ["Atletyka"], talents: [] } }
};

function inject(): void {
  setGameData({
    professions: {},
    classes: {},
    talents: {},
    races,
    origins: {
      Krasnolud: [
        {
          name: "Karak Norn",
          description: "Górski gród.",
          source: "Podręcznik Gracza Krasnoluda",
          skills: ["Rzemiosło (Górnictwo)", "Sztuka Przetrwania"],
          talents: [{ type: "fixed", name: "Twardziel" }],
          startingCareers: [{ min: 1, max: 50, profession: "Górnik" }]
        }
      ]
    }
  });
}

describe("Faza 4: fundament pochodzeń", () => {
  it("getOrigins zwraca pochodzenia rasy", () => {
    inject();
    const list = getOrigins("Krasnolud");
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("Karak Norn");
    expect(list[0].skills).toContain("Rzemiosło (Górnictwo)");
    expect(list[0].startingCareers?.[0].profession).toBe("Górnik");
  });

  it("getOrigin zwraca konkretne pochodzenie po nazwie", () => {
    inject();
    expect(getOrigin("Krasnolud", "Karak Norn")?.talents?.[0]).toEqual({
      type: "fixed",
      name: "Twardziel"
    });
    expect(getOrigin("Krasnolud", "Nieistniejące")).toBeUndefined();
  });

  it("rasa bez pochodzeń zwraca pustą listę", () => {
    inject();
    expect(getOrigins("Człowiek")).toEqual([]);
    expect(getOrigins("Elf")).toEqual([]);
  });

  it("brak sekcji origins (pusty plik) => pusta lista", () => {
    setGameData({ professions: {}, classes: {}, talents: {}, races });
    expect(getOrigins("Krasnolud")).toEqual([]);
  });
});
