import { describe, it, expect } from "vitest";
import {
  setGameData,
  setRuleset,
  getRuleset,
  getTalent,
  getProfession,
  allProfessionNames
} from "../gameData";
import type { ProfessionsData, TalentsData } from "../types";

/**
 * Testy warstwy wariantow zasad (Faza 1): rozdzielczosc pole-po-polu z
 * fallbackiem domowe -> pod_bronia -> baza oraz nakladka professions.domowe.json.
 */

const talents: TalentsData = {
  "Talent Bazowy": {
    max: { type: "none" },
    description: "opis podstawowy",
    tests: "brak",
    source: "Podręcznik podstawowy",
    variants: {
      pod_bronia: { description: "opis Pod Bronią", adds_characteristic: "WW" }
    }
  },
  "Talent Domowy": {
    max: { type: "none" },
    description: "baza",
    source: "Podręcznik podstawowy",
    variants: {
      pod_bronia: { description: "PB" },
      domowe: { description: "DOM" }
    }
  }
};

const professions: ProfessionsData = {
  Rycerz: {
    class: "Wojownicy",
    source: "Podręcznik podstawowy",
    levels: [
      { level: 1, title: "Giermek", status: "Brąz 1", characteristics: [], skills: [], talents: [], trappings: [] }
    ],
    variants: {
      domowe: { class: "Domowa Klasa" }
    }
  }
};

const professionsDomowe: ProfessionsData = {
  Rycerz: {
    // nadpisanie pola-po-polu w trybie domowym (najwyzszy priorytet)
    source: "Domowe",
    levels: [
      { level: 1, title: "Giermek Domowy", status: "Brąz 1", characteristics: [], skills: [], talents: [], trappings: [] }
    ]
  },
  "Łowca Nagród": {
    // NOWA profesja widoczna tylko w trybie domowym
    class: "Łotrzykowie",
    source: "Domowe",
    levels: [
      { level: 1, title: "Tropiciel", status: "Brąz 2", characteristics: [], skills: [], talents: [], trappings: [] }
    ]
  }
};

function inject(): void {
  setGameData({ professions, classes: {}, talents, professionsDomowe, ruleset: "core" });
}

describe("Faza 1: warianty talentów", () => {
  it("core zwraca opis bazowy (bez wariantu)", () => {
    inject();
    expect(getRuleset()).toBe("core");
    expect(getTalent("Talent Bazowy")?.description).toBe("opis podstawowy");
    expect(getTalent("Talent Bazowy")?.adds_characteristic).toBeUndefined();
  });

  it("pod_bronia nadpisuje tylko wpisane pola (opis + adds_characteristic)", () => {
    inject();
    setRuleset("pod_bronia");
    expect(getRuleset()).toBe("pod_bronia");
    const t = getTalent("Talent Bazowy");
    expect(t?.description).toBe("opis Pod Bronią");
    expect(t?.adds_characteristic).toBe("WW");
    // Pole niewpisane w wariancie zostaje z bazy.
    expect(t?.tests).toBe("brak");
  });

  it("domowe używa fallbacku do pod_bronia gdy brak wariantu domowego", () => {
    inject();
    setRuleset("domowe");
    expect(getTalent("Talent Bazowy")?.description).toBe("opis Pod Bronią");
    expect(getTalent("Talent Bazowy")?.adds_characteristic).toBe("WW");
  });

  it("domowe używa własnego wariantu gdy istnieje", () => {
    inject();
    setRuleset("domowe");
    expect(getTalent("Talent Domowy")?.description).toBe("DOM");
    setRuleset("pod_bronia");
    expect(getTalent("Talent Domowy")?.description).toBe("PB");
    setRuleset("core");
    expect(getTalent("Talent Domowy")?.description).toBe("baza");
  });
});

describe("Faza 1: warianty i nakładka profesji", () => {
  it("core i pod_bronia nie widzą nakładki domowej ani nowych profesji", () => {
    inject();
    expect(getProfession("Rycerz")?.class).toBe("Wojownicy");
    expect(getProfession("Rycerz")?.levels[0].title).toBe("Giermek");
    expect(getProfession("Łowca Nagród")).toBeUndefined();
    setRuleset("pod_bronia");
    expect(getProfession("Rycerz")?.class).toBe("Wojownicy");
    expect(getProfession("Łowca Nagród")).toBeUndefined();
  });

  it("domowe: inline variant + nakładka pliku (pole-po-polu) + nowe profesje", () => {
    inject();
    setRuleset("domowe");
    const r = getProfession("Rycerz");
    // inline variant.domowe zmienił class, nakładka pliku zmieniła source+levels.
    expect(r?.class).toBe("Domowa Klasa");
    expect(r?.source).toBe("Domowe");
    expect(r?.levels[0].title).toBe("Giermek Domowy");
    // Nowa profesja tylko w trybie domowym.
    expect(getProfession("Łowca Nagród")?.class).toBe("Łotrzykowie");
    expect(allProfessionNames()).toContain("Łowca Nagród");
  });

  it("powrót do core ukrywa profesje domowe", () => {
    inject();
    setRuleset("domowe");
    expect(getProfession("Łowca Nagród")).toBeDefined();
    setRuleset("core");
    expect(getProfession("Łowca Nagród")).toBeUndefined();
    expect(getProfession("Rycerz")?.class).toBe("Wojownicy");
  });
});
