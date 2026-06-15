/**
 * Silnik oczekujacych zmian (port z logiki pending_changes w Postac_program_gui.py).
 *
 * Model "na zywo": zakup od razu zmniejsza dostepne PD i zapisuje delte w pending.
 * Zatwierdzenie przenosi koszt do "wydane" i utrwala bazowe poziomy. Cofniecie
 * przywraca poziomy i zwraca PD. Tryb kosztu (spoza profesji / zgoda MG) dostarcza
 * warstwa UI przez resolwery, dzieki czemu silnik pozostaje niezalezny od interfejsu.
 */

import { calculateAdvancementCost, calculateTalentCost } from "./rules";
import type { AdvancementType } from "./rules";
import type { DataManager } from "./character";
import type { TalentMax } from "./types";

export interface PendingChanges {
  attribute_changes: Record<string, number>;
  skill_changes: Record<string, number>;
  talent_changes: Record<string, number>;
  new_skills: Set<string>;
  new_talents: Set<string>;
  experience_delta: number;
}

/** Tryb kosztu: rozwoj spoza profesji (x2) i ewentualna zgoda MG (znosi x2). */
export interface CostMode {
  outOfProfession: boolean;
  gmApproved: boolean;
}

export type AdvancementModeResolver = (type: AdvancementType, name: string) => CostMode;
export type TalentModeResolver = () => CostMode;

/** Wynik operacji zakupu/sprzedazy. */
export interface OpResult {
  ok: boolean;
  /** Koszt (przy zakupie) lub zwrot (przy cofnieciu) w PD. */
  amount?: number;
  /** Powod niepowodzenia: 'insufficient' | 'max' | 'min' | 'missing'. */
  reason?: "insufficient" | "max" | "min" | "missing";
}

export interface ConfirmDetail {
  text: string;
  cost: number;
}

export interface ConfirmResult {
  totalCost: number;
  details: ConfirmDetail[];
}

export function createEmptyPending(): PendingChanges {
  return {
    attribute_changes: {},
    skill_changes: {},
    talent_changes: {},
    new_skills: new Set<string>(),
    new_talents: new Set<string>(),
    experience_delta: 0
  };
}

/** Czy istnieja jakiekolwiek oczekujace zmiany. */
export function hasPending(p: PendingChanges): boolean {
  return (
    Object.keys(p.attribute_changes).length > 0 ||
    Object.keys(p.skill_changes).length > 0 ||
    Object.keys(p.talent_changes).length > 0 ||
    p.new_skills.size > 0 ||
    p.new_talents.size > 0 ||
    p.experience_delta !== 0
  );
}

/** Liczba oczekujacych zmian do pokazania w UI (mirror _get_pending_change_count). */
export function pendingCount(p: PendingChanges): number {
  let count = 0;
  for (const changes of [p.attribute_changes, p.skill_changes, p.talent_changes]) {
    for (const change of Object.values(changes)) count += Math.abs(change);
  }
  count += p.new_skills.size;
  count += p.new_talents.size;
  if (p.experience_delta) count += 1;
  return count;
}

const DEFAULT_MODE: CostMode = { outOfProfession: false, gmApproved: false };

/**
 * Silnik operujacy na DataManager. Resolwery trybu kosztu sa opcjonalne -
 * domyslnie traktuja kazdy rozwoj jako "w profesji".
 */
export class PendingEngine {
  pending: PendingChanges = createEmptyPending();

  constructor(
    private dm: DataManager,
    private advMode: AdvancementModeResolver = () => DEFAULT_MODE,
    private talentMode: TalentModeResolver = () => DEFAULT_MODE
  ) {}

  /** Podmienia kontener pending (np. po wczytaniu/utworzeniu postaci). */
  reset(): void {
    this.pending = createEmptyPending();
  }

  has(): boolean {
    return hasPending(this.pending);
  }

  count(): number {
    return pendingCount(this.pending);
  }

  // ----- Cechy / umiejetnosci -------------------------------------------

  private increaseAdvancement(
    type: AdvancementType,
    name: string,
    amount: number
  ): OpResult {
    const data =
      type === "cecha" ? this.dm.attributes[name] : this.dm.skills[name];
    if (!data) return { ok: false, reason: "missing" };
    const key = type === "cecha" ? "attribute_changes" : "skill_changes";

    const mode = this.advMode(type, name);
    const cost = calculateAdvancementCost(
      type,
      data.advanced,
      amount,
      mode.outOfProfession,
      mode.gmApproved
    );

    if (this.dm.experience.available < cost) {
      return { ok: false, amount: cost, reason: "insufficient" };
    }

    this.pending[key][name] = (this.pending[key][name] ?? 0) + amount;
    data.advanced += amount;
    this.dm.experience.available -= cost;
    return { ok: true, amount: cost };
  }

  private decreaseAdvancement(
    type: AdvancementType,
    name: string,
    amount: number
  ): OpResult {
    const data =
      type === "cecha" ? this.dm.attributes[name] : this.dm.skills[name];
    if (!data) return { ok: false, reason: "missing" };
    const key = type === "cecha" ? "attribute_changes" : "skill_changes";

    const minimum =
      type === "cecha"
        ? data.base_advanced
        : "is_new" in data && data.is_new
          ? 0
          : data.base_advanced;

    const currentAdv = data.advanced;
    if (currentAdv - amount < minimum) {
      return { ok: false, reason: "min" };
    }

    const mode = this.advMode(type, name);
    const refund = calculateAdvancementCost(
      type,
      currentAdv - amount,
      amount,
      mode.outOfProfession,
      mode.gmApproved
    );

    this.pending[key][name] = (this.pending[key][name] ?? 0) - amount;
    data.advanced -= amount;
    this.dm.experience.available += refund;
    return { ok: true, amount: refund };
  }

  increaseAttribute(name: string, amount = 1): OpResult {
    return this.increaseAdvancement("cecha", name, amount);
  }

  decreaseAttribute(name: string, amount = 1): OpResult {
    return this.decreaseAdvancement("cecha", name, amount);
  }

  increaseSkill(name: string, amount = 1): OpResult {
    return this.increaseAdvancement("umiejetnosc", name, amount);
  }

  decreaseSkill(name: string, amount = 1): OpResult {
    return this.decreaseAdvancement("umiejetnosc", name, amount);
  }

  /** Maksymalna liczba rozwiniec mozliwa przy aktualnym PD (mirror get_max_advancements). */
  maxAdvancements(type: AdvancementType, name: string): number {
    const data =
      type === "cecha" ? this.dm.attributes[name] : this.dm.skills[name];
    if (!data) return 0;
    const mode = this.advMode(type, name);
    const available = this.dm.experience.available;
    let maxAdv = 0;
    for (;;) {
      const cost = calculateAdvancementCost(
        type,
        data.advanced,
        maxAdv + 1,
        mode.outOfProfession,
        mode.gmApproved
      );
      if (available >= cost) maxAdv += 1;
      else break;
    }
    return maxAdv;
  }

  // ----- Talenty ---------------------------------------------------------

  /** Czy po dokupieniu 'amount' nie przekroczymy twardego Max. */
  talentBelowMax(name: string, amount: number): boolean {
    const talent = this.dm.talents[name];
    if (!talent) return false;
    const limit = this.dm.talentMaxAdvances(name);
    if (limit === null) return true;
    return talent.advances + amount <= limit;
  }

  increaseTalent(name: string, amount = 1): OpResult {
    const talent = this.dm.talents[name];
    if (!talent) return { ok: false, reason: "missing" };
    if (!this.talentBelowMax(name, amount)) return { ok: false, reason: "max" };

    const mode = this.talentMode();
    const cost = calculateTalentCost(
      talent.advances,
      amount,
      mode.outOfProfession,
      mode.gmApproved
    );
    if (this.dm.experience.available < cost) {
      return { ok: false, amount: cost, reason: "insufficient" };
    }

    this.pending.talent_changes[name] = (this.pending.talent_changes[name] ?? 0) + amount;
    talent.advances += amount;
    this.dm.experience.available -= cost;
    return { ok: true, amount: cost };
  }

  decreaseTalent(name: string, amount = 1): OpResult {
    const talent = this.dm.talents[name];
    if (!talent) return { ok: false, reason: "missing" };

    const minimum = talent.base_advances ?? 0;
    if (talent.advances - amount < minimum) return { ok: false, reason: "min" };

    const mode = this.talentMode();
    const refund = calculateTalentCost(
      talent.advances - amount,
      amount,
      mode.outOfProfession,
      mode.gmApproved
    );

    this.pending.talent_changes[name] = (this.pending.talent_changes[name] ?? 0) - amount;
    talent.advances -= amount;
    this.dm.experience.available += refund;
    return { ok: true, amount: refund };
  }

  // ----- Dodawanie nowych umiejetnosci / talentow ------------------------

  /** Dodaje nowa umiejetnosc i oznacza ja jako oczekujaca. */
  addNewSkill(name: string, attribute: string, initial = 0, advanced = 0): boolean {
    const added = this.dm.addSkill(name, attribute, initial, advanced, true);
    if (!added) return false;
    this.pending.new_skills.add(name);
    return true;
  }

  /** Dodaje nowy talent (1 wykupienie) i oznacza go jako oczekujacy. */
  addNewTalent(
    name: string,
    description = "",
    maxInfo: TalentMax | null = null,
    tests: string | null = null,
    source = "Lista",
    isCustom = false
  ): boolean {
    const added = this.dm.addTalent(
      name,
      1,
      description,
      maxInfo,
      tests,
      source,
      isCustom,
      true
    );
    if (!added) return false;
    this.pending.new_talents.add(name);
    this.pending.talent_changes[name] = (this.pending.talent_changes[name] ?? 0) + 1;
    return true;
  }

  // ----- Doswiadczenie ---------------------------------------------------

  /** Zmienia dostepne PD o delte (np. nagroda od MG). Sledzone jako pending. */
  changeExperience(delta: number): void {
    this.dm.experience.available += delta;
    this.dm.experience.total += delta;
    this.pending.experience_delta += delta;
  }

  // ----- Zatwierdzanie / cofanie ----------------------------------------

  /** Oblicza calkowity koszt oczekujacych zmian wraz z opisem pozycji. */
  computeCost(): ConfirmResult {
    let totalCost = 0;
    const details: ConfirmDetail[] = [];

    for (const [name, count] of Object.entries(this.pending.attribute_changes)) {
      if (count > 0) {
        const currentAdv = this.dm.attributes[name].advanced - count;
        const mode = this.advMode("cecha", name);
        const cost = calculateAdvancementCost(
          "cecha",
          currentAdv,
          count,
          mode.outOfProfession,
          mode.gmApproved
        );
        totalCost += cost;
        const note =
          mode.outOfProfession && !mode.gmApproved
            ? " [spoza profesji x2]"
            : mode.outOfProfession
              ? " [spoza profesji, zgoda MG]"
              : "";
        details.push({ text: `Cecha ${name}: +${count} rozwiniec${note}`, cost });
      }
    }

    for (const [name, count] of Object.entries(this.pending.skill_changes)) {
      if (count > 0) {
        const currentAdv = this.dm.skills[name].advanced - count;
        const mode = this.advMode("umiejetnosc", name);
        const cost = calculateAdvancementCost(
          "umiejetnosc",
          currentAdv,
          count,
          mode.outOfProfession,
          mode.gmApproved
        );
        totalCost += cost;
        const note =
          mode.outOfProfession && !mode.gmApproved
            ? " [spoza profesji x2]"
            : mode.outOfProfession
              ? " [spoza profesji, zgoda MG]"
              : "";
        details.push({ text: `Umiejetnosc ${name}: +${count} rozwiniec${note}`, cost });
      }
    }

    const talentMode = this.talentMode();
    for (const [name, count] of Object.entries(this.pending.talent_changes)) {
      if (count > 0) {
        const talent = this.dm.talents[name];
        const start = Math.max(0, (talent?.advances ?? count) - count);
        const cost = calculateTalentCost(
          start,
          count,
          talentMode.outOfProfession,
          talentMode.gmApproved
        );
        totalCost += cost;
        details.push({ text: `Talent ${name}: +${count} wykupien`, cost });
      }
    }

    return { totalCost, details };
  }

  /** Zatwierdza oczekujace zmiany: przenosi koszt do "wydane", utrwala bazy. */
  confirm(): ConfirmResult {
    const result = this.computeCost();

    this.dm.experience.spent += result.totalCost;
    this.dm.experience.total = this.dm.experience.available + this.dm.experience.spent;

    for (const name of Object.keys(this.pending.attribute_changes)) {
      this.dm.attributes[name].base_advanced = this.dm.attributes[name].advanced;
    }
    for (const name of Object.keys(this.pending.skill_changes)) {
      this.dm.skills[name].base_advanced = this.dm.skills[name].advanced;
    }
    for (const name of this.pending.new_skills) {
      if (this.dm.skills[name]) {
        this.dm.skills[name].base_advanced = this.dm.skills[name].advanced;
        this.dm.skills[name].is_new = false;
      }
    }
    for (const name of Object.keys(this.pending.talent_changes)) {
      if (this.dm.talents[name]) {
        this.dm.talents[name].base_advances = this.dm.talents[name].advances;
      }
    }
    for (const name of this.pending.new_talents) {
      if (this.dm.talents[name]) {
        this.dm.talents[name].base_advances = this.dm.talents[name].advances;
        this.dm.talents[name].is_new = false;
      }
    }

    this.reset();
    return result;
  }

  /** Cofa oczekujace zmiany: przywraca poziomy, usuwa nowe, zwraca PD. Zwraca refund. */
  revert(): number {
    let totalRefund = 0;

    for (const [name, count] of Object.entries(this.pending.attribute_changes)) {
      if (count > 0) {
        const currentAdv = this.dm.attributes[name].advanced;
        const mode = this.advMode("cecha", name);
        totalRefund += calculateAdvancementCost(
          "cecha",
          currentAdv - count,
          count,
          mode.outOfProfession,
          mode.gmApproved
        );
      }
      this.dm.attributes[name].advanced = this.dm.attributes[name].base_advanced;
    }

    for (const [name, count] of Object.entries(this.pending.skill_changes)) {
      if (count > 0) {
        const currentAdv = this.dm.skills[name].advanced;
        const mode = this.advMode("umiejetnosc", name);
        totalRefund += calculateAdvancementCost(
          "umiejetnosc",
          currentAdv - count,
          count,
          mode.outOfProfession,
          mode.gmApproved
        );
      }
      if (this.dm.skills[name]) {
        this.dm.skills[name].advanced = this.dm.skills[name].base_advanced;
      }
    }

    for (const name of this.pending.new_skills) {
      delete this.dm.skills[name];
    }

    const talentMode = this.talentMode();
    for (const [name, count] of Object.entries(this.pending.talent_changes)) {
      if (count > 0) {
        const talent = this.dm.talents[name];
        const start = Math.max(0, (talent?.advances ?? count) - count);
        totalRefund += calculateTalentCost(
          start,
          count,
          talentMode.outOfProfession,
          talentMode.gmApproved
        );
      }
      if (this.dm.talents[name]) {
        this.dm.talents[name].advances = this.dm.talents[name].base_advances ?? 0;
      }
    }

    for (const name of this.pending.new_talents) {
      delete this.dm.talents[name];
    }

    this.dm.experience.available += totalRefund;
    this.dm.experience.available -= this.pending.experience_delta;
    this.dm.experience.total -= this.pending.experience_delta;

    this.reset();
    return totalRefund;
  }
}
