/**
 * Centralny, reaktywny store aplikacji (Svelte 5 runes).
 *
 * Laczy DataManager (model postaci) z PendingEngine (oczekujace zmiany) i dodaje
 * warstwe interfejsu: tryby kosztu (spoza profesji / zgoda MG), reczne oznaczenia
 * rozwoju profesyjnego (developable_override), historie operacji oraz sygnal
 * reaktywnosci (tick) wyzwalany po kazdej mutacji modelu.
 *
 * Wzorzec reaktywnosci: model (DataManager) to zwykla klasa, wiec komponenty
 * odswiezaja sie czytajac `store.rev` w getterach. Kazda akcja wywoluje `touch()`.
 */

import { DataManager } from "./character";
import { PendingEngine, type CostMode } from "./pending";
import * as gameData from "./gameData";
import { ATTRIBUTES, type AdvancementType } from "./rules";
import {
  isCharacteristicDevelopable,
  isSkillDevelopable,
  isTalentDevelopable
} from "./gameData";
import {
  saveAutosave,
  loadAutosave,
  downloadBlob,
  safeFileName
} from "./storage";
import { parseSpecialization } from "./specialization";
import type {
  AttributeEntry,
  Developable,
  SkillEntry,
  TalentEntry,
  TalentMax,
  CharacterStats,
  RaceCreationInput
} from "./types";

/** Pelne nazwy cech (kod -> nazwa) do prezentacji w UI. */
export const ATTRIBUTE_FULL_NAMES: Record<string, string> = {
  WW: "Walka wręcz",
  US: "Umiejętności strzeleckie",
  S: "Siła",
  Wt: "Wytrzymałość",
  I: "Inicjatywa",
  Zw: "Zwinność",
  Zr: "Zręczność",
  Int: "Inteligencja",
  SW: "Siła woli",
  Ogd: "Ogłada"
};

export interface HistoryEntry {
  timestamp: string;
  action: string;
  details: string;
}

export interface AttributeRow {
  code: string;
  fullName: string;
  entry: AttributeEntry;
  total: number;
  developable: boolean;
  maxBuy: number;
}

export interface SkillRow {
  name: string;
  entry: SkillEntry;
  attribute: string;
  total: number;
  developable: boolean;
  override: boolean;
  maxBuy: number;
}

export interface TalentRow {
  name: string;
  entry: TalentEntry;
  max: number | null;
  developable: boolean;
  override: boolean;
}

class CharacterStore {
  dm = new DataManager();
  engine: PendingEngine;

  /** Sygnal reaktywnosci - kazda mutacja modelu zwieksza wartosc. */
  private rev = $state(0);

  /** Czy statyczne dane gry zostaly zaladowane. */
  ready = $state(false);
  loadError = $state<string | null>(null);

  /** Tryby kosztu sterowane checkboxami w UI. */
  attrGmApproved = $state(false);
  talentOutOfProfession = $state(false);
  talentGmApproved = $state(false);

  /** Reczne oznaczenia rozwoju profesyjnego (per-postac, na razie w pamieci). */
  overrideSkills = $state(new Set<string>());
  overrideTalents = $state(new Set<string>());

  /** Chronologiczny log operacji. */
  history = $state<HistoryEntry[]>([]);

  constructor() {
    this.engine = new PendingEngine(
      this.dm,
      (type, name) => this.advCostMode(type, name),
      () => this.talentCostMode()
    );
    this.dm.createNewCharacter();
  }

  // ----- Reaktywnosc -----------------------------------------------------

  private touch(): void {
    this.rev++;
    this.persist();
  }

  /** Odczyt rejestrujacy zaleznosc reaktywna (uzywany w getterach). */
  private get tick(): number {
    return this.rev;
  }

  // ----- Inicjalizacja danych gry ---------------------------------------

  async init(): Promise<void> {
    try {
      await gameData.loadGameData(import.meta.env.BASE_URL);
      this.restoreAutosave();
      this.ready = true;
      this.touch();
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : String(e);
    }
  }

  // ----- Trwalosc (autozapis localStorage) ------------------------------

  private persist(): void {
    if (!this.ready) return;
    saveAutosave({
      character: this.dm.toDict(),
      history: this.history,
      overrideSkills: [...this.overrideSkills],
      overrideTalents: [...this.overrideTalents]
    });
  }

  private restoreAutosave(): void {
    const snap = loadAutosave();
    if (!snap || !snap.character) return;
    try {
      this.dm.fromDict(snap.character as Parameters<DataManager["fromDict"]>[0]);
      this.history = Array.isArray(snap.history)
        ? (snap.history as HistoryEntry[])
        : [];
      this.overrideSkills = new Set(snap.overrideSkills ?? []);
      this.overrideTalents = new Set(snap.overrideTalents ?? []);
      this.engine.reset();
    } catch (e) {
      console.warn("Przywrocenie autozapisu nieudane:", e);
    }
  }

  // ----- Historia --------------------------------------------------------

  addHistory(action: string, details = ""): void {
    this.history = [
      ...this.history,
      { timestamp: new Date().toISOString(), action, details }
    ];
  }

  // ----- Rozwijalnosc / tryby kosztu ------------------------------------

  /** Zbiory elementow rozwijalnych w biezacej profesji. */
  developable(): Developable {
    void this.tick;
    return gameData.getCareerDevelopable(
      this.dm.currentCareer || null,
      this.dm.currentCareerLevel,
      this.dm.talents
    );
  }

  attrDevelopable(code: string): boolean {
    const dev = this.developable();
    if (dev.resolved && dev.characteristics.size) {
      return isCharacteristicDevelopable(code, dev);
    }
    return Boolean(this.dm.attributes[code]?.profession_available);
  }

  skillDevelopable(name: string): boolean {
    if (this.overrideSkills.has(name)) return true;
    const dev = this.developable();
    if (dev.resolved && dev.skills.size) return isSkillDevelopable(name, dev);
    return Boolean(this.dm.skills[name]?.profession_available);
  }

  talentDevelopable(name: string): boolean {
    if (this.overrideTalents.has(name)) return true;
    const dev = this.developable();
    if (dev.resolved && dev.talents.size) return isTalentDevelopable(name, dev);
    return Boolean(this.dm.talents[name]?.profession_available);
  }

  private isOutOfProfession(type: AdvancementType, name: string): boolean {
    const dev = this.developable();
    if (!dev.resolved) return false;
    if (type === "cecha") {
      if (!dev.characteristics.size) return false;
      return !isCharacteristicDevelopable(name, dev);
    }
    return !this.skillDevelopable(name);
  }

  private advCostMode(type: AdvancementType, name: string): CostMode {
    const out = this.isOutOfProfession(type, name);
    return { outOfProfession: out, gmApproved: out && this.attrGmApproved };
  }

  private talentCostMode(): CostMode {
    return {
      outOfProfession: this.talentOutOfProfession,
      gmApproved: this.talentOutOfProfession && this.talentGmApproved
    };
  }

  toggleSkillOverride(name: string): void {
    const next = new Set(this.overrideSkills);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.overrideSkills = next;
    this.touch();
  }

  toggleTalentOverride(name: string): void {
    const next = new Set(this.overrideTalents);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    this.overrideTalents = next;
    this.touch();
  }

  /** Czyści ręczne oznaczenia rozwoju (przy zmianie/awansie/edycji kariery). */
  private clearDevelopableOverrides(): void {
    if (this.overrideSkills.size) this.overrideSkills = new Set<string>();
    if (this.overrideTalents.size) this.overrideTalents = new Set<string>();
  }

  // ----- Snapshoty dla widokow ------------------------------------------

  get characterName(): string {
    void this.tick;
    return this.dm.characterName;
  }

  /** Aktualna profesja i poziom (do prezentacji w naglowku). */
  get careerLabel(): string {
    void this.tick;
    const name = this.dm.currentCareer;
    if (!name) return "";
    return `${name} (poz. ${this.dm.currentCareerLevel})`;
  }

  get experience() {
    void this.tick;
    return { ...this.dm.experience };
  }

  get pendingCount(): number {
    void this.tick;
    return this.engine.count();
  }

  get hasPending(): boolean {
    void this.tick;
    return this.engine.has();
  }

  /** Rozbicie liczby oczekujacych zmian na zakladki (do wskaznikow w UI). */
  get pendingByTab(): { cechy: number; umiejetnosci: number; talenty: number } {
    void this.tick;
    const p = this.engine.pending;
    const sum = (o: Record<string, number>) =>
      Object.values(o).reduce((a, b) => a + Math.abs(b), 0);
    return {
      cechy: sum(p.attribute_changes),
      umiejetnosci: sum(p.skill_changes) + p.new_skills.size,
      talenty: sum(p.talent_changes) + p.new_talents.size
    };
  }

  attributeRows(): AttributeRow[] {
    void this.tick;
    return ATTRIBUTES.map((code) => {
      const entry = this.dm.attributes[code];
      return {
        code,
        fullName: ATTRIBUTE_FULL_NAMES[code] ?? code,
        entry,
        total: entry?.current ?? (entry?.initial ?? 0) + (entry?.advanced ?? 0),
        developable: this.attrDevelopable(code),
        maxBuy: this.engine.maxAdvancements("cecha", code)
      };
    });
  }

  skillRows(): SkillRow[] {
    void this.tick;
    return Object.entries(this.dm.skills)
      .map(([name, entry]) => ({
        name,
        entry,
        attribute: entry.attribute,
        total: (this.dm.attributes[entry.attribute]?.current ?? entry.initial ?? 0) + (entry.advanced ?? 0),
        developable: this.skillDevelopable(name),
        override: this.overrideSkills.has(name),
        maxBuy: this.engine.maxAdvancements("umiejetnosc", name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  talentRows(): TalentRow[] {
    void this.tick;
    return Object.entries(this.dm.talents)
      .map(([name, entry]) => ({
        name,
        entry,
        max: this.dm.talentMaxAdvances(name),
        developable: this.talentDevelopable(name),
        override: this.overrideTalents.has(name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  /** Talenty ze schematu profesji jeszcze nie wykupione (phantom). */
  phantomTalents(): string[] {
    void this.tick;
    const dev = this.developable();
    if (!dev.resolved) return [];
    // Dopasowanie po znormalizowanej nazwie (case/spacje) - talent posiadany pod
    // inną pisownią nie może być pokazany jako nieposiadany (pkt 4).
    const ownedNorm = new Set(
      Object.keys(this.dm.talents).map((n) => gameData.normalize(n))
    );
    const out: string[] = [];
    for (const name of dev.talents) {
      if (name in this.dm.talents) continue;
      if (ownedNorm.has(gameData.normalize(name))) continue;
      out.push(name);
    }
    return out.sort((a, b) => a.localeCompare(b, "pl"));
  }

  /** Umiejetnosci ze schematu profesji jeszcze nie posiadane (phantom). */
  phantomSkills(): string[] {
    void this.tick;
    const dev = this.developable();
    if (!dev.resolved) return [];
    const out: string[] = [];
    for (const name of dev.skills) {
      // findOwnedSkill uwzglednia specjalizacje/grupy i roznice pisowni (pkt 4).
      if (!gameData.findOwnedSkill(this.dm.skills, name)) out.push(name);
    }
    return out.sort((a, b) => a.localeCompare(b, "pl"));
  }

  careerCompletion() {
    void this.tick;
    return this.dm.currentCareerCompletion();
  }

  // ----- Akcje: cechy / umiejetnosci ------------------------------------

  increaseAttribute(code: string, amount = 1): boolean {
    const r = this.engine.increaseAttribute(code, amount);
    if (r.ok) this.touch();
    return r.ok;
  }

  decreaseAttribute(code: string, amount = 1): boolean {
    const r = this.engine.decreaseAttribute(code, amount);
    if (r.ok) this.touch();
    return r.ok;
  }

  increaseSkill(name: string, amount = 1): boolean {
    const r = this.engine.increaseSkill(name, amount);
    if (r.ok) this.touch();
    return r.ok;
  }

  decreaseSkill(name: string, amount = 1): boolean {
    const r = this.engine.decreaseSkill(name, amount);
    if (r.ok) this.touch();
    return r.ok;
  }

  addSkill(name: string, attribute: string, advanced = 0): boolean {
    const ok = this.engine.addNewSkill(name, attribute, this.attributeValue(attribute), 0);
    if (ok) {
      if (advanced > 0) this.engine.increaseSkill(name, advanced);
      this.addHistory("Dodano umiejętność", name);
      this.touch();
    }
    return ok;
  }

  removeNewSkill(name: string): void {
    const entry = this.dm.skills[name];
    if (!entry?.is_new) return;
    // zwroc PD za rozwiniecia tej umiejetnosci
    if (entry.advanced > 0) this.engine.decreaseSkill(name, entry.advanced);
    delete this.dm.skills[name];
    this.engine.pending.new_skills.delete(name);
    delete this.engine.pending.skill_changes[name];
    this.addHistory("Usunięto umiejętność", name);
    this.touch();
  }

  private attributeValue(attribute: string): number {
    const code = gameData.characteristicToCode(attribute) || attribute;
    const entry = this.dm.attributes[code];
    return entry ? entry.current : 0;
  }

  // ----- Akcje: talenty -------------------------------------------------

  increaseTalent(name: string, amount = 1): boolean {
    const r = this.engine.increaseTalent(name, amount);
    if (r.ok) {
      this.dm.recomputeWounds();
      this.touch();
    }
    return r.ok;
  }

  decreaseTalent(name: string, amount = 1): boolean {
    const r = this.engine.decreaseTalent(name, amount);
    if (r.ok) {
      this.dm.recomputeWounds();
      this.touch();
    }
    return r.ok;
  }

  addTalentFromList(name: string): boolean {
    // Dla talentu ze specjalizacją, np. "Wyczulony Zmysł (Wzrok)", opis/limit
    // pobieramy z wpisu bazowego "Wyczulony Zmysł", zachowując pełną nazwę (pkt 21).
    const db = gameData.getTalent(name) ?? gameData.getTalent(parseSpecialization(name).base);
    const ok = this.engine.addNewTalent(
      name,
      db?.description ?? "",
      (db?.max ?? { type: "none" }) as TalentMax,
      db?.tests ?? null,
      db?.source ?? "Lista",
      db === undefined
    );
    if (ok) {
      // Twardziel i pokrewne moga zmieniac Zywotnosc.
      this.dm.recomputeWounds();
      this.addHistory("Dodano talent", name);
      this.touch();
    }
    return ok;
  }

  /**
   * Dodaje talent +cecha (pkt 22) ze stalym bonusem do wybranej cechy.
   * Wartosc (np. +5 albo wynik rzutu 1k10) jest wybierana raz i zapisana.
   */
  addCharacteristicTalent(name: string, code: string, value: number): boolean {
    const db =
      gameData.getTalent(name) ?? gameData.getTalent(parseSpecialization(name).base);
    const ok = this.engine.addNewTalent(
      name,
      db?.description ?? "",
      (db?.max ?? { type: "none" }) as TalentMax,
      db?.tests ?? null,
      db?.source ?? "Lista",
      db === undefined
    );
    if (ok) {
      const entry = this.dm.talents[name];
      if (entry) entry.characteristicBonus = { code, value };
      this.dm.recompute();
      this.dm.recomputeWounds();
      this.addHistory("Dodano talent", `${name} (+${value} ${code})`);
      this.touch();
    }
    return ok;
  }

  addCustomTalent(
    name: string,
    description: string,
    maxInfo: TalentMax | null
  ): boolean {
    const ok = this.engine.addNewTalent(name, description, maxInfo, null, "własny", true);
    if (ok) {
      this.addHistory("Dodano talent", `${name} (własny)`);
      this.touch();
    }
    return ok;
  }

  setTalentMax(name: string, maxInfo: TalentMax): void {
    const t = this.dm.talents[name];
    if (!t) return;
    t.max = maxInfo;
    this.touch();
  }

  /**
   * Ustawia staly bonus do cechy dla juz posiadanego talentu +cecha (pkt 22).
   * Uzywane m.in. przez kreator, gdy talent zostal wylosowany/wybrany przy
   * tworzeniu postaci, a wartosc (+5 albo rzut 1k10) wybieramy po fakcie.
   */
  setTalentCharacteristicBonus(name: string, code: string, value: number): void {
    const entry = this.dm.talents[name];
    if (!entry) return;
    entry.characteristicBonus = { code, value };
    this.dm.recompute();
    this.dm.recomputeWounds();
    this.touch();
  }

  removeNewTalent(name: string): void {
    const entry = this.dm.talents[name];
    if (!entry?.is_new) return;
    delete this.dm.talents[name];
    this.engine.pending.new_talents.delete(name);
    delete this.engine.pending.talent_changes[name];
    // Po usunieciu talentu +cecha/Twardziela przelicz cechy i Zywotnosc.
    this.dm.recompute();
    this.dm.recomputeWounds();
    this.addHistory("Usunięto talent", name);
    this.touch();
  }

  /** Lista talentow mozliwych do dodania (nie posiadane). */
  availableTalentNames(): string[] {
    void this.tick;
    return gameData
      .allTalentNames()
      .filter((n) => !(n in this.dm.talents))
      .sort((a, b) => a.localeCompare(b, "pl"));
  }

  /** Lista kanonicznych umiejetnosci mozliwych do dodania (nie posiadane). */
  availableSkillNames(): string[] {
    void this.tick;
    return gameData
      .allSkillNames()
      .filter((n) => !(n in this.dm.skills))
      .sort((a, b) => a.localeCompare(b, "pl"));
  }

  /** Kod cechy wiodacej dla nazwy umiejetnosci (kanon skills.json). */
  skillBaseAttr(name: string): string | undefined {
    return gameData.skillBaseAttr(name);
  }

  // ----- Akcje: profesja ------------------------------------------------

  setCurrentCareer(profession: string, level: number): void {
    this.dm.setCurrentCareer(profession, level);
    this.clearDevelopableOverrides();
    this.addHistory("Ustawiono profesję", `${profession} (poziom ${level})`);
    this.touch();
  }

  advanceCareer(profession: string, level: number): { ok: boolean; cost: number; reason?: string } {
    const completion = this.dm.currentCareerCompletion();
    const sameClass =
      gameData.classOfCareer(profession) === this.dm.characterClass &&
      this.dm.characterClass !== "";
    const cost = gameData.careerTransitionCost(completion.completed, sameClass);
    if (this.dm.experience.available < cost) {
      return { ok: false, cost, reason: "insufficient" };
    }
    this.dm.experience.available -= cost;
    this.dm.experience.spent += cost;
    this.dm.advanceToCareer(profession, level);
    this.clearDevelopableOverrides();
    this.addHistory("Awans profesji", `${profession} (poziom ${level}) — koszt ${cost} PD`);
    this.touch();
    return { ok: true, cost };
  }

  removeCareerStep(index: number): void {
    if (index < 0 || index >= this.dm.careerPath.length) return;
    this.dm.careerPath.splice(index, 1);
    if (this.dm.careerPath.length) {
      const last = this.dm.careerPath[this.dm.careerPath.length - 1];
      this.dm.currentCareer = last.profession || last.title;
      this.dm.currentCareerLevel = last.level || 1;
      last.completed = false;
    } else {
      this.dm.currentCareer = "";
      this.dm.currentCareerLevel = 1;
    }
    this.addHistory("Usunięto krok kariery", String(index + 1));
    this.touch();
  }

  saveCareerPath(steps: { profession: string; level: number; completed: boolean }[]): void {
    const path = steps
      .filter((s) => s.profession.trim())
      .map((s, i, arr) => {
        const canonical = gameData.resolveProfessionName(s.profession.trim());
        const name = canonical ?? s.profession.trim();
        const isLast = i === arr.length - 1;
        return {
          title: name,
          profession: canonical ? name : null,
          level: s.level,
          resolved: Boolean(canonical),
          completed: isLast ? false : s.completed
        };
      });
    this.dm.careerPath = path;
    if (path.length) {
      const last = path[path.length - 1];
      this.dm.currentCareer = last.profession || last.title;
      this.dm.currentCareerLevel = last.level || 1;
      const cls = gameData.classOfCareer(this.dm.currentCareer);
      if (cls) this.dm.characterClass = cls;
    }
    this.clearDevelopableOverrides();
    this.addHistory("Zapisano ścieżkę kariery", `${path.length} krok(ów)`);
    this.touch();
  }

  // ----- Akcje: doswiadczenie -------------------------------------------

  setAvailableExperience(value: number): void {
    const delta = value - this.dm.experience.available;
    this.engine.changeExperience(delta);
    this.addHistory("Ustawiono PD", `Dostępne: ${value}`);
    this.touch();
  }

  addExperience(amount: number): void {
    if (!amount) return;
    this.engine.changeExperience(amount);
    this.addHistory("Dodano doświadczenie", `${amount > 0 ? "+" : ""}${amount} PD`);
    this.touch();
  }

  // ----- Zatwierdzanie / cofanie ----------------------------------------

  confirmChanges(): { totalCost: number; details: { text: string; cost: number }[] } {
    const result = this.engine.confirm();
    this.addHistory("Zatwierdzono zmiany", `Koszt: ${result.totalCost} PD`);
    this.touch();
    return result;
  }

  revertChanges(): number {
    const refund = this.engine.revert();
    this.addHistory("Cofnięto zmiany", `Przywrócono ${refund} PD`);
    this.touch();
    return refund;
  }

  // ----- Nowa postac ----------------------------------------------------

  newCharacter(name = "Nowa Postać"): void {
    this.dm.createNewCharacter(name);
    this.engine.reset();
    this.overrideSkills = new Set();
    this.overrideTalents = new Set();
    this.history = [];
    this.addHistory("Utworzono nową postać", name);
    this.touch();
  }

  /**
   * Tworzy postac na podstawie wynikow kreatora rasowego (Krok 1 + 3 + rasowe
   * umiejetnosci/talenty). Deleguje do DataManager i resetuje stan UI/PD.
   */
  createFromRace(input: RaceCreationInput): void {
    this.dm.createFromRace(input);
    this.engine.reset();
    this.overrideSkills = new Set();
    this.overrideTalents = new Set();
    this.history = [];
    this.addHistory(
      "Utworzono postać (kreator)",
      `${input.race} — ${input.name || "Nowa Postać"} (Przeznaczenie ${input.fate}, Bohatera ${input.resilience})`
    );
    this.touch();
  }

  // ----- Drugorzedne statystyki (Zywotnosc, Punkty itd.) ----------------

  get stats(): CharacterStats {
    void this.tick;
    return this.dm.stats;
  }

  /** Aktualizuje pojedyncza statystyke drugorzedna (z zapisem). */
  setStat<K extends keyof CharacterStats>(key: K, value: CharacterStats[K]): void {
    if (this.dm.stats[key] === value) return;
    this.dm.stats[key] = value;
    this.touch();
  }

  // ----- Operacje plikowe (JSON / PDF) ----------------------------------

  /** Wczytuje postac z tekstu JSON. Zwraca true przy sukcesie. */
  loadJsonText(text: string): boolean {
    const ok = this.dm.loadFromJson(text);
    if (!ok) return false;
    this.engine.reset();
    this.overrideSkills = new Set();
    this.overrideTalents = new Set();
    this.history = [];
    this.addHistory("Wczytano postać z JSON", this.dm.characterName);
    this.touch();
    return true;
  }

  /** Pobiera biezaca postac jako plik JSON. */
  saveJson(): void {
    const json = this.dm.toJson();
    downloadBlob(
      safeFileName(this.dm.characterName, "json"),
      json,
      "application/json"
    );
    this.addHistory("Zapisano postać do JSON", this.dm.characterName);
  }

  /** Wczytuje postac z bajtow formularza PDF. Zwraca true przy sukcesie. */
  async loadPdfBytes(bytes: Uint8Array): Promise<boolean> {
    const ok = await this.dm.loadFromPdf(bytes);
    if (!ok) return false;
    this.engine.reset();
    this.overrideSkills = new Set();
    this.overrideTalents = new Set();
    this.history = [];
    this.addHistory("Wczytano postać z PDF", this.dm.characterName);
    this.touch();
    return true;
  }

  /** Eksportuje postac do PDF (pobranie pliku). */
  async exportPdf(): Promise<void> {
    let template: Uint8Array | undefined;
    if (this.dm.sourceType !== "pdf" || !this.dm.pdfSourceBytes) {
      const url = `${import.meta.env.BASE_URL}data/empty_card.pdf`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error("Nie udało się pobrać szablonu PDF (empty_card.pdf).");
      }
      template = new Uint8Array(await resp.arrayBuffer());
    }
    const out = await this.dm.exportToPdf(template);
    downloadBlob(safeFileName(this.dm.characterName, "pdf"), out, "application/pdf");
    this.addHistory("Wyeksportowano postać do PDF", this.dm.characterName);
  }
}

export const store = new CharacterStore();
