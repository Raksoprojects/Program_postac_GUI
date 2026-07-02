import { describe, it, expect, beforeAll } from "vitest";
import { loadTestGameData } from "./loadData";
import {
  allProfessionNames,
  allClassNames,
  allSkillNames,
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
  isCharacteristicDevelopable,
  normalize,
  parseCareerLevel,
  resolveCareerPath,
  resolveProfessionName,
  skillBaseAttr,
  talentMax,
  careerTransitionCost,
  careerPathPools
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

describe("gameData: umiejetnosci kanoniczne (skills.json)", () => {
  it("allSkillNames zwraca posortowana niepusta liste", () => {
    const names = allSkillNames();
    expect(names.length).toBeGreaterThan(0);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pl"));
    expect(names).toEqual(sorted);
  });

  it("skillBaseAttr zwraca ceche dla nazwy dokladnej i grupowej", () => {
    expect(skillBaseAttr("Charyzma")).toBe("Ogd");
    expect(skillBaseAttr("Atletyka")).toBe("Zw");
    // specjalizacja dopasowana do grupy "Wiedza (...)"
    expect(skillBaseAttr("Wiedza (Medycyna)")).toBe("Int");
    expect(skillBaseAttr("Rzemiosło (Aptekarstwo)")).toBe("Zr");
    expect(skillBaseAttr("Nieistniejaca")).toBeUndefined();
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

  it("resolveProfessionName dopasowuje mimo roznic w bialych znakach/wielkosci", () => {
    const name = allProfessionNames()[0];
    expect(resolveProfessionName(name)).toBe(name);
    expect(resolveProfessionName(`  ${name.toUpperCase()}  `)).toBe(name);
    expect(resolveProfessionName("kompletnie nieznana")).toBeUndefined();
  });

  it("getProfession i developable dzialaja dla nazwy z innym zapisem", () => {
    const name = allProfessionNames()[0];
    const variant = `  ${name.toLowerCase()} `;
    expect(getProfession(variant)).toBeDefined();
    const dev = getCareerDevelopable(variant, 1);
    expect(dev.resolved).toBe(true);
  });

  it("poziom 2 zawiera umiejetnosci z poziomu 1 i 2", () => {
    const name = allProfessionNames()[0];
    const prof = getProfession(name)!;
    const dev = getCareerDevelopable(name, 2);
    for (const skill of [...prof.levels[0].skills, ...prof.levels[1].skills]) {
      expect(isSkillDevelopable(skill, dev)).toBe(true);
    }
  });

  it("isCharacteristicDevelopable rozpoznaje cechy z profesji (filtr Koszty, pkt 1)", () => {
    // Wybierz profesje, ktora ma cechy rozwijalne na 1. poziomie.
    const name = allProfessionNames().find((n) => {
      const p = getProfession(n);
      return (p?.levels?.[0]?.characteristics?.length ?? 0) > 0;
    });
    expect(name).toBeDefined();
    const prof = getProfession(name!)!;
    const dev = getCareerDevelopable(name!, 1);
    // Kazda cecha z poziomu 1 (po zamianie na kod) jest rozwijalna.
    const codes = prof.levels[0].characteristics
      .map((c) => characteristicToCode(c))
      .filter((c): c is string => Boolean(c));
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      expect(isCharacteristicDevelopable(code, dev)).toBe(true);
    }
    // Cecha spoza zbioru nie jest rozwijalna.
    const allCodes = ["WW", "US", "S", "Wt", "I", "Zw", "Zr", "Int", "SW", "Ogd"];
    const outside = allCodes.find((c) => !codes.includes(c));
    if (outside) expect(isCharacteristicDevelopable(outside, dev)).toBe(false);
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

describe("gameData: pula i ukonczenie przez cala sciezke (Faza B)", () => {
  it("careerPathPools laczy umiejetnosci/cechy z wielu profesji sciezki", () => {
    const names = allProfessionNames();
    const a = names[0];
    const b = names[1];
    const poolsA = careerPathPools([{ profession: a, level: 1 }]);
    const poolsBoth = careerPathPools([
      { profession: a, level: 1 },
      { profession: b, level: 1 }
    ]);
    // Suma po dwoch profesjach jest nadzbiorem pojedynczej.
    for (const s of poolsA.skills) expect(poolsBoth.skills.has(s)).toBe(true);
    expect(poolsBoth.skills.size).toBeGreaterThanOrEqual(poolsA.skills.size);
  });

  it("umiejetnosc rozwinieta w poprzedniej profesji liczy sie do ukonczenia", () => {
    const names = allProfessionNames();
    const prev = names[0];
    const curr = names[1];
    const prof1 = getProfession(prev)!;
    // 8 umiejetnosci z poziomu 1 poprzedniej profesji, kazda na 5 rozwiniec.
    const skills: Record<string, { advanced: number }> = {};
    for (const s of prof1.levels[0].skills.slice(0, 8)) {
      skills[s] = { advanced: 5 };
    }
    const talents: Record<string, { advances: number }> = {};
    const t = prof1.levels[0].talents[0];
    if (t) talents[t] = { advances: 1 };

    // Bez sciezki (tylko biezaca profesja) - umiejetnosci spoza schematu nie licza.
    const single = isCareerCompleted(curr, 1, skills, talents, {});
    // Ze sciezka obejmujaca poprzednia profesje - licza sie istniejace rozwiniecia.
    const withPath = isCareerCompleted(curr, 1, skills, talents, {}, [
      { profession: prev, level: 1 },
      { profession: curr, level: 1 }
    ]);
    expect(withPath.skills_done).toBeGreaterThanOrEqual(single.skills_done);
    expect(withPath.skills_done).toBeGreaterThanOrEqual(8);
    expect(withPath.skills_ok).toBe(true);
  });
});
