import { beforeAll, describe, expect, it } from "vitest";
import * as gd from "../gameData";
import { loadTestGameData } from "./loadData";

beforeAll(loadTestGameData);

describe("podpowiedzi specjalizacji", () => {
  it("z danych profesji i ras", () => {
    expect(gd.specializationSuggestions("Język")).toEqual(expect.arrayContaining(["Bretoński", "Klasyczny"]));
    expect(gd.specializationSuggestions("Wiedza")).toContain("Medycyna");
    expect(gd.specializationSuggestions("Broń Biała")).toContain("Podstawowa");
    // Bez wpisow-placeholderow.
    for (const s of gd.specializationSuggestions("Wiedza")) expect(s).not.toMatch(/^dowoln|^\.\.\.$/i);
  });

  it("tradycje i bostwa", () => {
    expect(gd.specializationSuggestions("Magia Tajemna").length).toBeGreaterThanOrEqual(8);
    expect(gd.specializationSuggestions("Błogosławieństwo")).toContain("Sigmar");
  });

  it("szablony wymagaja wyboru; konkretne nazwy nie", () => {
    expect(gd.specPlaceholderInfo("Język (...)")?.kind).toBe("free");
    expect(gd.specPlaceholderInfo("Magia Tajemna (Tradycja)")?.hint).toBe("Tradycja");
    expect(gd.specPlaceholderInfo("Język (Bretoński)")).toBeNull();
    expect(gd.specPlaceholderInfo("Atletyka")).toBeNull();
  });
});

describe("formy meskie/zenskie profesji", () => {
  it("kazda profesja i poziom ma obie formy", () => {
    for (const p of gd.allProfessionNames()) {
      expect(gd.professionDisplayName(p, "K"), p).toBeTruthy();
      for (const l of gd.getProfession(p)!.levels) {
        expect(gd.levelDisplayTitle(p, l.level, "M"), `${p}|${l.level}`).toBeTruthy();
        expect(gd.levelDisplayTitle(p, l.level, "K"), `${p}|${l.level}`).toBeTruthy();
      }
    }
  });

  it("forma wg plci; bez plci - jak w bazie", () => {
    expect(gd.professionDisplayName("Kapłanka Shallyi", "M")).toBe("Kapłan Shallyi");
    expect(gd.professionDisplayName("Mistrz Miecza", "K")).toBe("Mistrzyni Miecza");
    expect(gd.professionDisplayName("Mistrz Miecza", "")).toBe("Mistrz Miecza");
    expect(gd.levelDisplayTitle("Aptekarka", 1, "M")).toBe("Uczeń Aptekarza");
  });

  it("import rozpoznaje obie formy", () => {
    expect(gd.resolveProfessionName("Kapłan Shallyi")).toBe("Kapłanka Shallyi");
    expect(gd.findCareerByTitle("Uczeń Aptekarza")[0]).toMatchObject({ profession: "Aptekarka", level: 1 });
  });
});

describe("losowanie imion", () => {
  it("imie i nazwisko wg rasy i plci; nieznana rasa - imiona ludzkie", () => {
    const t = gd.getNames("Krasnolud")!;
    expect(gd.randomName("Krasnolud", "K", () => 0)).toBe(`${t.female[0]} ${t.surnames[0]}`);
    expect(gd.randomName("Krasnolud", "M", () => 0)).toBe(`${t.male[0]} ${t.surnames[0]}`);
    for (const race of gd.allRaceNames()) expect(gd.randomName(race, "K"), race).toMatch(/\S+/);
    expect(gd.getNames("Nieznana")).toEqual(gd.getNames("Człowiek"));
  });
});
