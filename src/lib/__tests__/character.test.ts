import { describe, it, expect, beforeAll } from "vitest";
import { loadTestGameData } from "./loadData";
import {
  DataManager,
  CHARACTER_JSON_SCHEMA,
  CHARACTER_JSON_VERSION
} from "../character";
import { allProfessionNames, getProfession } from "../gameData";

beforeAll(() => {
  loadTestGameData();
});

describe("character: nowa postac", () => {
  it("tworzy 10 cech po 30 i puste kolekcje", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Test");
    expect(dm.characterName).toBe("Test");
    expect(Object.keys(dm.attributes).length).toBe(10);
    expect(dm.attributes.WW.current).toBe(30);
    expect(Object.keys(dm.skills).length).toBe(0);
    expect(Object.keys(dm.talents).length).toBe(0);
    expect(dm.experience).toEqual({ available: 0, spent: 0, total: 0 });
  });
});

describe("character: createFromRace (kreator rasowy)", () => {
  it("ustawia cechy, umiejetnosci 3x+5/3x+3, talenty, statystyki i PD", () => {
    const dm = new DataManager();
    dm.createFromRace({
      name: "Krasnolud Testowy",
      race: "Krasnolud",
      characteristics: {
        WW: 41, US: 32, S: 33, Wt: 45, I: 30,
        Zw: 22, Zr: 44, Int: 33, SW: 50, Ogd: 21
      },
      fate: 0,
      resilience: 2,
      wounds: 13,
      movement: 3,
      skillsPlus5: ["Opanowanie", "Wytrzymałość", "Wycena"],
      skillsPlus3: ["Mocna Głowa", "Zastraszanie", "Hazard"],
      talents: ["Tragarz", "Widzenie w Ciemności", "Twardziel"],
      experience: 70
    });

    expect(dm.characterSpecies).toBe("Krasnolud");
    expect(dm.attributes.SW.initial).toBe(50);
    expect(dm.attributes.SW.current).toBe(50);

    // Umiejetnosci rasowe: 3x+5 oraz 3x+3, z poprawna wartoscia (cecha + rozwiniecie).
    const plus5 = ["Opanowanie", "Wytrzymałość", "Wycena"];
    for (const name of plus5) {
      const sk = dm.skills[name];
      expect(sk).toBeDefined();
      expect(sk.advanced).toBe(5);
      expect(sk.current).toBe(dm.attributes[sk.attribute].current + 5);
    }
    const plus3 = ["Mocna Głowa", "Zastraszanie", "Hazard"];
    for (const name of plus3) {
      expect(dm.skills[name]).toBeDefined();
      expect(dm.skills[name].advanced).toBe(3);
    }

    // Talenty rasowe (1 rozwiniecie kazdy).
    for (const t of ["Tragarz", "Widzenie w Ciemności", "Twardziel"]) {
      expect(dm.talents[t]).toBeDefined();
      expect(dm.talents[t].advances).toBe(1);
    }

    // Statystyki drugorzedne (Determinacja = Bohatera, Szczescie = Przeznaczenia).
    // Zywotnosc liczona z cech: BS(3)+2*BWt(4)+BSW(5)=16, plus Twardziel (+BWt=4) => 20.
    expect(dm.stats.wounds).toBe(20);
    expect(dm.stats.movement).toBe(3);
    expect(dm.stats.resilience).toBe(2);
    expect(dm.stats.resolve).toBe(2);
    expect(dm.stats.fate).toBe(0);
    expect(dm.stats.fortune).toBe(0);

    // PD startowe.
    expect(dm.experience).toEqual({ available: 70, spent: 0, total: 70 });
  });
});

describe("character: umiejetnosci", () => {
  it("dodaje umiejetnosc i nie duplikuje", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    expect(dm.addSkill("Atletyka", "Zw", 0, 0, true)).toBe(true);
    expect(dm.addSkill("Atletyka", "Zw")).toBe(false);
    expect(dm.skills.Atletyka.attribute).toBe("Zw");
    expect(dm.skills.Atletyka.is_new).toBe(true);
  });
});

describe("character: talenty", () => {
  it("dodaje talent i ustawia base_advances=0 dla nowego", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    expect(dm.addTalent("Szczescie", 1)).toBe(true);
    expect(dm.talents.Szczescie.advances).toBe(1);
    expect(dm.talents.Szczescie.base_advances).toBe(0);
    expect(dm.talents.Szczescie.is_new).toBe(true);
  });

  it("talentMaxAdvances dla typu fixed", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    dm.addTalent("Test", 1, "", { type: "fixed", value: 3 });
    expect(dm.talentMaxAdvances("Test")).toBe(3);
  });

  it("talentMaxAdvances dla typu characteristic zalezy od cechy", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    dm.attributes.Int.current = 45;
    dm.addTalent("Test", 1, "", { type: "characteristic", attr: "Int" });
    expect(dm.talentMaxAdvances("Test")).toBe(4);
  });

  it("parseTalentAdvances: puste -> 1, tekst z liczba -> liczba", () => {
    expect(DataManager.parseTalentAdvances(null)).toBe(1);
    expect(DataManager.parseTalentAdvances("")).toBe(1);
    expect(DataManager.parseTalentAdvances("x3")).toBe(3);
    expect(DataManager.parseTalentAdvances(2)).toBe(2);
  });

  it("enrichTalents uzupelnia dane z bazy", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    const known = Object.keys(getProfession(allProfessionNames()[0])!.levels[0].talents)
      .length
      ? getProfession(allProfessionNames()[0])!.levels[0].talents[0]
      : "Szczescie";
    // wstaw surowy talent jak z importu PDF
    dm.talents[known] = {
      advances: 1
    } as unknown as (typeof dm.talents)[string];
    dm.enrichTalents();
    expect(dm.talents[known].advances).toBe(1);
    expect(dm.talents[known].base_advances).toBe(1);
    expect(dm.talents[known].max).toBeDefined();
  });
});

describe("character: profesja i sciezka kariery", () => {
  it("setCurrentCareer ustawia profesje, poziom i klase", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    const name = allProfessionNames()[0];
    dm.setCurrentCareer(name, 2);
    expect(dm.currentCareer).toBe(name);
    expect(dm.currentCareerLevel).toBe(2);
    expect(dm.characterClass).toBeTruthy();
    expect(dm.careerPath.length).toBe(1);
    expect(dm.careerPath[0].resolved).toBe(true);
  });

  it("advanceToCareer oznacza poprzednia jako ukonczona i dopisuje krok", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    const names = allProfessionNames();
    dm.setCurrentCareer(names[0], 1);
    dm.advanceToCareer(names[1], 1);
    expect(dm.careerPath.length).toBe(2);
    expect(dm.careerPath[0].completed).toBe(true);
    expect(dm.careerPath[1].completed).toBe(false);
    expect(dm.currentCareer).toBe(names[1]);
  });

  it("poziom jest ograniczony do zakresu 1..4", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    dm.setCurrentCareer(allProfessionNames()[0], 9);
    expect(dm.currentCareerLevel).toBe(4);
    dm.setCurrentCareer(allProfessionNames()[0], 0);
    expect(dm.currentCareerLevel).toBe(1);
  });

  it("currentCareerCompletion dla nieznanej profesji => unknown_profession", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    dm.currentCareer = "Nieistniejaca";
    const result = dm.currentCareerCompletion();
    expect(result.unknown_profession).toBe(true);
  });

  it("loadProfession buduje sciezke z pol PDF", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    const name = allProfessionNames()[0];
    dm.loadProfession({ profession: name, level_text: `${name} (1)` });
    expect(dm.currentCareer).toBe(name);
    expect(dm.careerPath.length).toBeGreaterThan(0);
  });
});

describe("character: reset", () => {
  it("resetCharacter cofa rozwiniecia do bazowych", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    dm.attributes.WW.advanced = 5;
    dm.attributes.WW.base_advanced = 2;
    dm.addSkill("Atletyka", "Zw", 0, 0, false);
    dm.skills.Atletyka.advanced = 8;
    dm.skills.Atletyka.base_advanced = 3;
    dm.resetCharacter();
    expect(dm.attributes.WW.advanced).toBe(2);
    expect(dm.skills.Atletyka.advanced).toBe(3);
  });
});

describe("character: serializacja JSON", () => {
  it("toDict ma poprawny schema i wersje", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Bohater");
    const dict = dm.toDict();
    expect(dict.schema).toBe(CHARACTER_JSON_SCHEMA);
    expect(dict.version).toBe(CHARACTER_JSON_VERSION);
    expect(dict.character_name).toBe("Bohater");
  });

  it("round-trip toDict -> fromDict zachowuje stan", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Grunwald");
    dm.attributes.WW.advanced = 5;
    dm.attributes.WW.current = 35;
    dm.addSkill("Atletyka", "Zw", 30, 4, false);
    dm.addTalent("Szczescie", 2);
    dm.experience = { available: 100, spent: 50, total: 150 };
    dm.setCurrentCareer(allProfessionNames()[0], 2);
    dm.stats = {
      wounds: 13,
      movement: 4,
      fate: 2,
      fortune: 2,
      resilience: 1,
      resolve: 1,
      motivation: "Honor"
    };

    const json = dm.toJson();
    const dm2 = new DataManager();
    expect(dm2.loadFromJson(json)).toBe(true);

    expect(dm2.characterName).toBe("Grunwald");
    expect(dm2.attributes.WW.advanced).toBe(5);
    expect(dm2.skills.Atletyka.advanced).toBe(4);
    expect(dm2.talents.Szczescie.advances).toBe(2);
    expect(dm2.experience).toEqual({ available: 100, spent: 50, total: 150 });
    expect(dm2.currentCareer).toBe(allProfessionNames()[0]);
    expect(dm2.currentCareerLevel).toBe(2);
    expect(dm2.stats).toEqual({
      wounds: 13,
      movement: 4,
      fate: 2,
      fortune: 2,
      resilience: 1,
      resolve: 1,
      motivation: "Honor"
    });
  });

  it("loadFromJson zwraca false dla niepoprawnego JSON", () => {
    const dm = new DataManager();
    expect(dm.loadFromJson("{ to nie jest json")).toBe(false);
  });

  it("format JSON jest zgodny ze schema desktopowym (wfrp4e-character)", () => {
    const dm = new DataManager();
    dm.createNewCharacter();
    const parsed = JSON.parse(dm.toJson());
    expect(parsed.schema).toBe("wfrp4e-character");
    expect(parsed).toHaveProperty("attributes");
    expect(parsed).toHaveProperty("skills");
    expect(parsed).toHaveProperty("talents");
    expect(parsed).toHaveProperty("experience");
    expect(parsed).toHaveProperty("career_path");
  });
});
