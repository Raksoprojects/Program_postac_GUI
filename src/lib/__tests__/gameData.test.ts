import { describe, it, expect, beforeAll } from "vitest";
import { loadTestGameData } from "./loadData";
import {
  allProfessionNames,
  allClassNames,
  allTalentNames,
  attributeBonus,
  careersForClass,
  characteristicToCode,
  classOfCareer,
  findCareerByTitle,
  getCareerDevelopable,
  getProfession,
  getTalent,
  isCareerCompleted,
  isSkillDevelopable,
  normalize,
  parseCareerLevel,
  resolveCareerPath,
  talentMax,
  careerTransitionCost
} from "../gameData";

beforeAll(() => {
  loadTestGameData();
});

describe("gameData: ladowanie i akcesory", () => {
  it("laduje profesje, klasy i talenty", () => {
    expect(allProfessionNames().length).toBeGreaterThan(0);
    expect(allClassNames().length).toBeGreaterThan(0);
    expect(allTalentNames().length).toBeGreaterThan(0);
  });

  it("profesje sa posortowane alfabetycznie", () => {
    const names = allProfessionNames();
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pl"));
    expect(names).toEqual(sorted);
  });
});

describe("gameData: pomocnicze", () => {
  it("attributeBonus = cyfra dziesiatek", () => {
    expect(attributeBonus(37)).toBe(3);
    expect(attributeBonus(40)).toBe(4);
    expect(attributeBonus(9)).toBe(0);
    expect(attributeBonus(-5)).toBe(0);
  });

  it("normalize sprowadza do malych liter bez nadmiarowych spacji", () => {
    expect(normalize("  Walka   Wręcz ")).toBe("walka wręcz");
    expect(normalize(null)).toBe("");
  });

  it("characteristicToCode mapuje nazwy i kody", () => {
    expect(characteristicToCode("Wytrzymałość")).toBe("Wt");
    expect(characteristicToCode("Wt")).toBe("Wt");
    expect(characteristicToCode("nieistniejaca")).toBe("");
  });

  it("parseCareerLevel wyciaga numer z nawiasu", () => {
    expect(parseCareerLevel("Piromanta (2)")).toBe(2);
    expect(parseCareerLevel("bez numeru")).toBeNull();
  });

  it("careerTransitionCost wg zasad WFRP 4ed", () => {
    expect(careerTransitionCost(true, true)).toBe(100);
    expect(careerTransitionCost(false, true)).toBe(200);
    expect(careerTransitionCost(true, false)).toBe(200);
    expect(careerTransitionCost(false, false)).toBe(300);
  });
});

describe("gameData: profesje i klasy", () => {
  it("kazda profesja nalezy do klasy zgodnie z classes.json", () => {
    for (const className of allClassNames()) {
      for (const career of careersForClass(className)) {
        expect(classOfCareer(career)).toBe(className);
      }
    }
  });

  it("profesja ma 4 poziomy", () => {
    const name = allProfessionNames()[0];
    const prof = getProfession(name);
    expect(prof?.levels.length).toBe(4);
  });

  it("findCareerByTitle znajduje profesje po tytule poziomu", () => {
    const name = allProfessionNames()[0];
    const matches = findCareerByTitle(name);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].profession).toBe(name);
  });

  it("resolveCareerPath rozbija sciezke po przecinkach", () => {
    const first = allProfessionNames()[0];
    const steps = resolveCareerPath(`${first}, Nieznana Profesja XYZ`);
    expect(steps.length).toBe(2);
    expect(steps[0].resolved).toBe(true);
    expect(steps[1].resolved).toBe(false);
  });
});

describe("gameData: talenty", () => {
  it("talentMax dla typu fixed zwraca liczbe", () => {
    const fixedName = allTalentNames().find((n) => getTalent(n)?.max.type === "fixed");
    expect(fixedName).toBeDefined();
    if (fixedName) {
      const expected = getTalent(fixedName)?.max.value ?? null;
      expect(talentMax(fixedName)).toBe(expected);
    }
  });

  it("talentMax dla typu characteristic zalezy od cechy", () => {
    const charName = allTalentNames().find(
      (n) => getTalent(n)?.max.type === "characteristic"
    );
    expect(charName).toBeDefined();
    if (charName) {
      const attr = getTalent(charName)!.max.attr!;
      const result = talentMax(charName, { [attr]: 45 });
      expect(result).toBe(4); // bonus z 45 = 4
    }
  });

  it("talentMax dla typu none zwraca null", () => {
    const noneName = allTalentNames().find((n) => getTalent(n)?.max.type === "none");
    if (noneName) {
      expect(talentMax(noneName)).toBeNull();
    }
  });
});

describe("gameData: rozwijalnosc (developable)", () => {
  it("getCareerDevelopable zwraca zbiory z poziomow 1..obecny", () => {
    const name = allProfessionNames()[0];
    const prof = getProfession(name)!;
    const dev = getCareerDevelopable(name, 1);
    expect(dev.resolved).toBe(true);
    // wszystkie umiejetnosci z poziomu 1 powinny byc rozwijalne
    for (const skill of prof.levels[0].skills) {
      expect(isSkillDevelopable(skill, dev)).toBe(true);
    }
  });

  it("nieznana profesja => resolved=false, puste zbiory", () => {
    const dev = getCareerDevelopable("Nieistniejaca Profesja", 1);
    expect(dev.resolved).toBe(false);
    expect(dev.skills.size).toBe(0);
  });

  it("poziom 2 zawiera umiejetnosci z poziomu 1 i 2", () => {
    const name = allProfessionNames()[0];
    const prof = getProfession(name)!;
    const dev = getCareerDevelopable(name, 2);
    for (const skill of [...prof.levels[0].skills, ...prof.levels[1].skills]) {
      expect(isSkillDevelopable(skill, dev)).toBe(true);
    }
  });
});

describe("gameData: kompletowanie profesji", () => {
  it("pusta postac nie ma skompletowanej profesji", () => {
    const name = allProfessionNames()[0];
    const result = isCareerCompleted(name, 1, {}, {}, {});
    expect(result.completed).toBe(false);
    expect(result.skills_done).toBe(0);
  });

  it("8 umiejetnosci na progu + talent => skompletowane (gdy cechy pending)", () => {
    const name = allProfessionNames()[0];
    const prof = getProfession(name)!;
    const level1 = prof.levels[0];
    const skills: Record<string, { advanced: number }> = {};
    for (const s of level1.skills.slice(0, 8)) {
      skills[s] = { advanced: 5 }; // prog 5*1
    }
    const talents: Record<string, { advances: number }> = {};
    if (level1.talents[0]) talents[level1.talents[0]] = { advances: 1 };

    const result = isCareerCompleted(name, 1, skills, talents, {});
    expect(result.skills_ok).toBe(true);
    expect(result.talents_ok).toBe(true);
    // dla profesji z characteristics_pending kryterium cech jest spelnione
    if (result.characteristics_pending) {
      expect(result.completed).toBe(true);
    }
  });
});
