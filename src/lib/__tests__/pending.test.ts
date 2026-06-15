import { describe, it, expect } from "vitest";
import { DataManager } from "../character";
import {
  PendingEngine,
  createEmptyPending,
  hasPending,
  pendingCount
} from "../pending";

function freshDm(available = 1000): DataManager {
  const dm = new DataManager();
  dm.createNewCharacter("Tester");
  dm.experience = { available, spent: 0, total: available };
  return dm;
}

describe("pending: pomocnicze", () => {
  it("pusty kontener nie ma zmian", () => {
    const p = createEmptyPending();
    expect(hasPending(p)).toBe(false);
    expect(pendingCount(p)).toBe(0);
  });

  it("liczy zmiany: cechy + nowe + PD", () => {
    const p = createEmptyPending();
    p.attribute_changes.WW = 2;
    p.new_skills.add("Atletyka");
    p.experience_delta = 50;
    expect(hasPending(p)).toBe(true);
    expect(pendingCount(p)).toBe(2 + 1 + 1);
  });
});

describe("pending: zakup cechy", () => {
  it("zakup zmniejsza dostepne PD i sledzi delte", () => {
    const dm = freshDm(100);
    const eng = new PendingEngine(dm);
    const res = eng.increaseAttribute("WW", 1);
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(25);
    expect(dm.experience.available).toBe(75);
    expect(dm.attributes.WW.advanced).toBe(1);
    expect(eng.pending.attribute_changes.WW).toBe(1);
  });

  it("brak PD blokuje zakup", () => {
    const dm = freshDm(10);
    const eng = new PendingEngine(dm);
    const res = eng.increaseAttribute("WW", 1);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("insufficient");
    expect(dm.attributes.WW.advanced).toBe(0);
  });

  it("nie mozna cofnac ponizej bazowego poziomu", () => {
    const dm = freshDm(100);
    const eng = new PendingEngine(dm);
    const res = eng.decreaseAttribute("WW", 1);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("min");
  });

  it("cofniecie zwraca PD", () => {
    const dm = freshDm(100);
    const eng = new PendingEngine(dm);
    eng.increaseAttribute("WW", 1); // -25 => 75
    const res = eng.decreaseAttribute("WW", 1);
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(25);
    expect(dm.experience.available).toBe(100);
    expect(dm.attributes.WW.advanced).toBe(0);
  });
});

describe("pending: zakup umiejetnosci i talentow", () => {
  it("kupuje rozwiniecia umiejetnosci", () => {
    const dm = freshDm(200);
    dm.addSkill("Atletyka", "Zw", 0, 0, true);
    const eng = new PendingEngine(dm);
    const res = eng.increaseSkill("Atletyka", 5);
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(50); // 5 x 10
    expect(dm.skills.Atletyka.advanced).toBe(5);
  });

  it("kupuje talent z progresywnym kosztem", () => {
    const dm = freshDm(1000);
    dm.addTalent("Szczescie", 0, "", null, null, "Lista", false, false);
    dm.talents.Szczescie.base_advances = 0;
    const eng = new PendingEngine(dm);
    const res = eng.increaseTalent("Szczescie", 1);
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(100);
    expect(dm.talents.Szczescie.advances).toBe(1);
  });

  it("respektuje twardy limit talentu (fixed)", () => {
    const dm = freshDm(1000);
    dm.addTalent("Limit", 0, "", { type: "fixed", value: 1 }, null, "Lista", false, false);
    dm.talents.Limit.base_advances = 0;
    const eng = new PendingEngine(dm);
    expect(eng.increaseTalent("Limit", 1).ok).toBe(true);
    const res = eng.increaseTalent("Limit", 1);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("max");
  });

  it("addNewTalent dodaje talent i sledzi go", () => {
    const dm = freshDm(1000);
    const eng = new PendingEngine(dm);
    expect(eng.addNewTalent("Nowy")).toBe(true);
    expect(dm.talents.Nowy.advances).toBe(1);
    expect(eng.pending.new_talents.has("Nowy")).toBe(true);
    expect(eng.pending.talent_changes.Nowy).toBe(1);
  });
});

describe("pending: zatwierdzanie i cofanie", () => {
  it("confirm przenosi koszt do wydane i utrwala bazy", () => {
    const dm = freshDm(100);
    const eng = new PendingEngine(dm);
    eng.increaseAttribute("WW", 2); // koszt 50 => available 50
    const result = eng.confirm();
    expect(result.totalCost).toBe(50);
    expect(dm.experience.spent).toBe(50);
    expect(dm.experience.available).toBe(50);
    expect(dm.experience.total).toBe(100);
    expect(dm.attributes.WW.base_advanced).toBe(2);
    expect(eng.has()).toBe(false);
  });

  it("revert przywraca poziomy i zwraca PD", () => {
    const dm = freshDm(100);
    const eng = new PendingEngine(dm);
    eng.increaseAttribute("WW", 2); // available 50
    const refund = eng.revert();
    expect(refund).toBe(50);
    expect(dm.experience.available).toBe(100);
    expect(dm.attributes.WW.advanced).toBe(0);
    expect(eng.has()).toBe(false);
  });

  it("revert usuwa nowe umiejetnosci i talenty", () => {
    const dm = freshDm(1000);
    const eng = new PendingEngine(dm);
    eng.addNewSkill("Atletyka", "Zw");
    eng.addNewTalent("Nowy");
    expect(dm.skills.Atletyka).toBeDefined();
    expect(dm.talents.Nowy).toBeDefined();
    eng.revert();
    expect(dm.skills.Atletyka).toBeUndefined();
    expect(dm.talents.Nowy).toBeUndefined();
  });

  it("changeExperience sledzi delte i jest cofane przez revert", () => {
    const dm = freshDm(100);
    const eng = new PendingEngine(dm);
    eng.changeExperience(50);
    expect(dm.experience.available).toBe(150);
    eng.revert();
    expect(dm.experience.available).toBe(100);
  });
});

describe("pending: tryb spoza profesji", () => {
  it("resolver moze podwoic koszt", () => {
    const dm = freshDm(100);
    const eng = new PendingEngine(
      dm,
      () => ({ outOfProfession: true, gmApproved: false }),
      () => ({ outOfProfession: false, gmApproved: false })
    );
    const res = eng.increaseAttribute("WW", 1);
    expect(res.amount).toBe(50); // 25 x2
  });
});
