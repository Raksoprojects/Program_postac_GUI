/**
 * Test E2E (smoke): pelne przejscie sciezka uzytkownika:
 *   1) Tworzenie postaci od zera kreatorem rasowym (rzuty na cechy, wybor
 *      3x+5 / 3x+3 umiejetnosci, rozwiazanie talentow rasowych).
 *   2) Dodanie 3000 PD (nagroda MG).
 *   3) Wydanie PD na LOSOWE dostepne pozycje (cechy, umiejetnosci nowe i
 *      istniejace, talenty nowe i istniejace) z weryfikacja niezmiennikow.
 *   4) Zatwierdzenie zmian i sprawdzenie bilansu PD.
 *   5) Round-trip zapisu/odczytu (JSON) — stan musi byc zachowany.
 *
 * RNG jest deterministyczny (seed), wiec test jest w pelni powtarzalny.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadTestGameData } from "./loadData";
import { DataManager } from "../character";
import { PendingEngine } from "../pending";
import {
  rollRaceCharacteristics,
  characteristicBonus,
  computeWounds,
  movementSteps,
  type Rng
} from "../creation";
import {
  getRace,
  allSkillNames,
  randomTalentForRoll,
  skillBaseAttr
} from "../gameData";
import { ATTRIBUTES } from "../rules";
import type { RaceCreationInput, RaceTalent } from "../types";

beforeAll(() => {
  loadTestGameData();
});

/** Deterministyczny RNG (mulberry32) — powtarzalne rzuty. */
function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rozwiazuje talenty rasowe (fixed/choice/random) na konkretne nazwy. */
function resolveTalents(talents: RaceTalent[], rng: Rng): string[] {
  const out: string[] = [];
  for (const t of talents) {
    if (t.type === "fixed" && t.name) {
      out.push(t.name);
    } else if (t.type === "choice" && t.options?.length) {
      out.push(t.options[0]);
    } else if (t.type === "random") {
      const count = t.count ?? 1;
      for (let i = 0; i < count; i++) {
        const roll = Math.floor(rng() * 100) + 1;
        const name = randomTalentForRoll(roll);
        if (name && !out.includes(name)) out.push(name);
      }
    }
  }
  return out;
}

describe("E2E: tworzenie postaci od zera + 3000 PD na losowe pozycje", () => {
  it("przechodzi pelny scenariusz bez bledow i z poprawnym bilansem PD", () => {
    const rng = seededRng(20240531);

    // --- KROK 1: rasa + rzuty na cechy --------------------------------
    const raceName = "Człowiek";
    const race = getRace(raceName);
    expect(race).toBeDefined();
    if (!race) return;

    const rolls = rollRaceCharacteristics(race, rng);
    const characteristics: Record<string, number> = {};
    for (const attr of ATTRIBUTES) {
      characteristics[attr] = rolls[attr].total;
      // Rzut 2k10 (2..20) + baza rasowa — wartosci musza byc sensowne.
      expect(rolls[attr].roll).toBeGreaterThanOrEqual(2);
      expect(rolls[attr].roll).toBeLessThanOrEqual(20);
      expect(characteristics[attr]).toBe(rolls[attr].base + rolls[attr].roll);
    }

    // --- KROK 3: 3x+5 / 3x+3 umiejetnosci rasowe -----------------------
    const raceSkills = race.skills;
    expect(raceSkills.length).toBeGreaterThanOrEqual(6);
    const skillsPlus5 = raceSkills.slice(0, 3);
    const skillsPlus3 = raceSkills.slice(3, 6);
    expect(new Set([...skillsPlus5, ...skillsPlus3]).size).toBe(6);

    const talents = resolveTalents(race.talents, rng);
    expect(talents.length).toBeGreaterThan(0);

    // Zywotnosc i ruch (wartosci drugorzedne zapisywane w postaci).
    const sB = characteristicBonus(characteristics.S);
    const wtB = characteristicBonus(characteristics.Wt);
    const swB = characteristicBonus(characteristics.SW);
    const wounds = computeWounds(sB, wtB, swB, race.woundsIncludeStrength);
    const move = movementSteps(race.movement);

    const input: RaceCreationInput = {
      name: "Bohater E2E",
      race: raceName,
      characteristics,
      fate: race.fate,
      resilience: race.resilience,
      wounds,
      movement: race.movement,
      skillsPlus5,
      skillsPlus3,
      talents,
      experience: race.extraPoints * 0 + 50 // startowe PD z kreatora
    };

    const dm = new DataManager();
    dm.createFromRace(input);
    const engine = new PendingEngine(dm);

    // Stan poczatkowy zgodny z kreatorem.
    expect(Object.keys(dm.attributes).length).toBe(10);
    for (const s of [...skillsPlus5, ...skillsPlus3]) {
      expect(dm.skills[s]).toBeDefined();
    }
    expect(dm.skills[skillsPlus5[0]].advanced).toBe(5);
    expect(dm.skills[skillsPlus3[0]].advanced).toBe(3);
    for (const t of talents) expect(dm.talents[t]).toBeDefined();
    expect(dm.stats.wounds).toBe(wounds);
    expect(dm.stats.movement).toBe(race.movement);
    expect(dm.stats.fate).toBe(race.fate);
    expect(dm.stats.resilience).toBe(race.resilience);
    expect(dm.experience).toEqual({ available: 50, spent: 0, total: 50 });

    // --- KROK: nagroda MG +3000 PD ------------------------------------
    engine.changeExperience(3000);
    expect(dm.experience.available).toBe(3050);
    expect(dm.experience.total).toBe(3050);

    // --- KROK: wydawanie PD na LOSOWE dostepne pozycje ----------------
    // Pula nowych umiejetnosci do ewentualnego dokupienia (spoza posiadanych).
    const owned = new Set(Object.keys(dm.skills));
    const candidateNewSkills = allSkillNames()
      .filter((n) => !owned.has(n))
      .slice(0, 40);

    // Pula nowych talentow (z tabeli losowej k100) do dokupienia.
    const candidateNewTalents: string[] = [];
    for (let r = 1; r <= 100; r += 3) {
      const n = randomTalentForRoll(r);
      if (n && !candidateNewTalents.includes(n)) candidateNewTalents.push(n);
    }

    let spentByEngine = 0; // ile PD realnie zeszlo (suma kosztow - zwrotow)
    let purchases = 0;
    const refusals: Record<string, number> = {};

    const pickAttr = () => ATTRIBUTES[Math.floor(rng() * ATTRIBUTES.length)];
    const pickFrom = <T,>(arr: T[]): T | undefined =>
      arr.length ? arr[Math.floor(rng() * arr.length)] : undefined;

    for (let iter = 0; iter < 400; iter++) {
      const availableBefore = dm.experience.available;
      if (availableBefore <= 0) break;

      const action = Math.floor(rng() * 5);
      let res: { ok: boolean; amount?: number; reason?: string } | boolean = {
        ok: false,
        reason: "skip"
      };

      if (action === 0) {
        // Rozwiniecie losowej cechy.
        res = engine.increaseAttribute(pickAttr(), 1);
      } else if (action === 1) {
        // Rozwiniecie losowej posiadanej umiejetnosci.
        const name = pickFrom(Object.keys(dm.skills));
        if (name) res = engine.increaseSkill(name, 1);
      } else if (action === 2) {
        // Dodanie nowej umiejetnosci (1 rozwiniecie z gory nie kosztuje;
        // koszt liczony przy increaseSkill).
        const name = pickFrom(candidateNewSkills);
        if (name && !(name in dm.skills)) {
          const code = skillBaseAttr(name) || "Int";
          const base = dm.attributes[code]?.current ?? 0;
          const added = engine.addNewSkill(name, code, base, 0);
          if (added) {
            res = engine.increaseSkill(name, 1);
          }
        }
      } else if (action === 3) {
        // Rozwiniecie losowego posiadanego talentu.
        const name = pickFrom(Object.keys(dm.talents));
        if (name) res = engine.increaseTalent(name, 1);
      } else {
        // Dodanie nowego talentu — pierwsze wykupienie (0->1) kosztuje PD i
        // jest pobierane od razu (z weryfikacja dostepnosci).
        const name = pickFrom(candidateNewTalents);
        if (name && !(name in dm.talents)) {
          const before2 = dm.experience.available;
          const added = engine.addNewTalent(name);
          res = added
            ? { ok: true, amount: before2 - dm.experience.available }
            : { ok: false, reason: "insufficient" };
        }
      }

      const okFlag = typeof res === "boolean" ? res : res.ok;
      if (okFlag) {
        purchases++;
        const amt = typeof res === "boolean" ? 0 : res.amount ?? 0;
        spentByEngine += amt;
      } else {
        const reason = typeof res === "boolean" ? "false" : res.reason ?? "?";
        refusals[reason] = (refusals[reason] ?? 0) + 1;
      }

      // NIEZMIENNIK: dostepne PD nigdy nie schodza ponizej zera.
      expect(dm.experience.available).toBeGreaterThanOrEqual(0);
      // NIEZMIENNIK: spadek dostepnych PD == koszt zwroconej operacji.
      if (okFlag) {
        const amt = typeof res === "boolean" ? 0 : res.amount ?? 0;
        expect(availableBefore - dm.experience.available).toBe(amt);
      } else {
        expect(dm.experience.available).toBe(availableBefore);
      }
    }

    expect(purchases).toBeGreaterThan(5); // cos faktycznie kupiono

    // computeCost (informacyjny) musi byc spojny: suma kosztow pozycji.
    const preview = engine.computeCost();
    expect(preview.totalCost).toBeGreaterThan(0);
    expect(preview.details.length).toBeGreaterThan(0);
    for (const d of preview.details) expect(d.cost).toBeGreaterThanOrEqual(0);

    // --- KROK: zatwierdzenie zmian ------------------------------------
    const availBeforeConfirm = dm.experience.available;
    const confirmRes = engine.confirm();
    expect(confirmRes.totalCost).toBeGreaterThan(0);
    // NIEZMIENNIK: podglad kosztu == faktycznie odjete PD (brak rozjazdu).
    expect(confirmRes.totalCost).toBe(preview.totalCost);

    // Po zatwierdzeniu: total == available + spent, pending puste.
    expect(dm.experience.total).toBe(
      dm.experience.available + dm.experience.spent
    );
    expect(dm.experience.available).toBe(availBeforeConfirm); // confirm nie rusza available
    expect(engine.has()).toBe(false);

    // Bazy rozwiniec utrwalone (advanced == base_advanced).
    for (const a of Object.values(dm.attributes)) {
      expect(a.advanced).toBe(a.base_advanced);
    }
    for (const s of Object.values(dm.skills)) {
      expect(s.advanced).toBe(s.base_advanced);
      expect(s.is_new).toBe(false);
    }
    for (const t of Object.values(dm.talents)) {
      expect(t.advances).toBe(t.base_advances);
      expect(t.is_new).toBe(false);
    }

    // --- KROK: round-trip JSON ----------------------------------------
    const json = dm.toJson();
    const dm2 = new DataManager();
    expect(dm2.loadFromJson(json)).toBe(true);
    expect(dm2.characterSpecies).toBe(raceName);
    expect(dm2.experience).toEqual(dm.experience);
    expect(dm2.stats).toEqual(dm.stats);
    expect(Object.keys(dm2.skills).sort()).toEqual(
      Object.keys(dm.skills).sort()
    );
    expect(Object.keys(dm2.talents).sort()).toEqual(
      Object.keys(dm.talents).sort()
    );
    for (const attr of ATTRIBUTES) {
      expect(dm2.attributes[attr].advanced).toBe(dm.attributes[attr].advanced);
    }
  });
});
