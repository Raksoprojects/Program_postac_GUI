import { describe, it, expect } from "vitest";
import {
  setGameData,
  setRuleset,
  getRuleset,
  getTalent,
  getProfession,
  allProfessionNames,
  sourceGroup,
  matchesSourceFilter,
  professionSourceGroup,
  talentSourceGroup
} from "../gameData";
import type { ProfessionsData, TalentsData } from "../types";
import { loadTestGameData } from "./loadData";

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

describe("Faza 1b: filtr źródła (oś B, niezależna od wariantu)", () => {
  it("sourceGroup klasyfikuje po polu source", () => {
    expect(sourceGroup("Podręcznik podstawowy")).toBe("podstawka");
    expect(sourceGroup("Wiatry Magii")).toBe("oficjalny_dodatek");
    expect(sourceGroup("Podręcznik gracza Krasnoluda")).toBe("oficjalny_dodatek");
    expect(sourceGroup("Domowe")).toBe("domowe");
    expect(sourceGroup(undefined)).toBe("oficjalny_dodatek");
    expect(sourceGroup("")).toBe("oficjalny_dodatek");
  });

  it("matchesSourceFilter respektuje presety", () => {
    expect(matchesSourceFilter("podstawka", "podstawka")).toBe(true);
    expect(matchesSourceFilter("oficjalny_dodatek", "podstawka")).toBe(false);
    expect(matchesSourceFilter("oficjalny_dodatek", "podstawka_dodatki")).toBe(true);
    expect(matchesSourceFilter("domowe", "podstawka_dodatki")).toBe(false);
    expect(matchesSourceFilter("domowe", "wszystko")).toBe(true);
    expect(matchesSourceFilter("podstawka", "domowe")).toBe(false);
    expect(matchesSourceFilter("domowe", "domowe")).toBe(true);
  });

  it("grupa źródła profesji/talentu po nazwie", () => {
    inject();
    expect(professionSourceGroup("Rycerz")).toBe("podstawka");
    expect(talentSourceGroup("Talent Bazowy")).toBe("podstawka");
    // W trybie domowym nowa profesja ma źródło domowe.
    setRuleset("domowe");
    expect(professionSourceGroup("Łowca Nagród")).toBe("domowe");
    setRuleset("core");
  });
});

describe("Faza 2: warianty Pod Bronią z realnych danych", () => {
  it("core zostawia bazę; pod_bronia rozszerza/zmienia talenty", () => {
    loadTestGameData();
    setRuleset("core");
    expect(getTalent("Artylerzysta")?.description).not.toContain("Ocena Sytuacji");
    // Nowy talent z Pod Bronią jest dostępny we wszystkich trybach.
    expect(getTalent("Dowódca Załogi")).toBeDefined();

    setRuleset("pod_bronia");
    expect(getTalent("Artylerzysta")?.description).toContain("Ocena Sytuacji");
    const morderczy = getTalent("Morderczy Atak");
    expect(morderczy?.max.type).toBe("fixed");
    expect(morderczy?.max.value).toBe(1);
    expect(getTalent("Zbicie Broni")?.description).toContain("Zdumiewający Sukces");
    setRuleset("core");
  });

  it("domowe dziedziczy warianty Pod Bronią (fallback)", () => {
    loadTestGameData();
    setRuleset("domowe");
    expect(getTalent("Artylerzysta")?.description).toContain("Ocena Sytuacji");
    expect(getTalent("Morderczy Atak")?.max.value).toBe(1);
    setRuleset("core");
  });
});
