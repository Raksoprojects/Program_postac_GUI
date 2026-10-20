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
  loadSettings,
  saveSettings,
  downloadBlob,
  safeFileName
} from "./storage";
import { parseSpecialization, buildSpecializedName } from "./specialization";
import { modifierEffectLabels } from "./modifiers";
import type { Artefact } from "./artefacts";
import { weaponSkill } from "./equipment";
import {
  grantedBlessings,
  magicProfile,
  miracleAvailability,
  miracleCost,
  spellAvailability,
  spellCost,
  type MagicProfile
} from "./magic";
import type {
  AttributeEntry,
  CharacterModifier,
  ChoiceSlot,
  Developable,
  MiracleEntry,
  PrayerDef,
  SpellDef,
  SpellEntry,
  Ruleset,
  SkillEntry,
  SourceFilter,
  TalentEntry,
  TalentMax,
  CharacterStats,
  RaceCreationInput,
  Sex,
  CharArmour,
  CharWeapon
} from "./types";

/** Etykiety wariantow zasad do prezentacji w UI/historii. */
export const RULESET_LABELS: Record<Ruleset, string> = {
  core: "Podstawowe zasady",
  pod_bronia: "Pod Bronią",
  domowe: "Pełne Domowe Zasady"
};

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
  /** Staly bonus z talentow +cecha (np. Urodzony Wojownik). */
  talentBonus: number;
  /** Suma zmian z aktywnych modyfikatorow (mutacje, wampiryzm...). */
  modifierBonus: number;
}

/**
 * Pozycja "do dodania" ze schematu profesji. Gdy `slot` jest ustawiony, wpis
 * wymaga wyboru specjalizacji ("(Dowolna)" / "albo"), a wybor zostanie
 * zapamietany jako czesc profesji.
 */
export interface PhantomEntry {
  name: string;
  slot?: ChoiceSlot;
}

/** Zapamietany wybor specjalizacji (do prezentacji i cofania w UI). */
export interface ChoiceEntry {
  key: string;
  profession: string;
  level: number;
  scheme: string;
  value: string;
}

export interface SkillRow {
  name: string;
  entry: SkillEntry;
  attribute: string;
  total: number;
  developable: boolean;
  override: boolean;
  maxBuy: number;
  /** Umiejetnosc zarobkowa profesji (pkt 19) - wyswietlana kursywa. */
  earning: boolean;
}

export interface TalentRow {
  name: string;
  entry: TalentEntry;
  max: number | null;
  developable: boolean;
  override: boolean;
}

/**
 * Nazwy z bazy + podpowiadane specjalizacje: przy pozycji z nawiasem-szablonem
 * ("Język (...)", "Magia Tajemna (Tradycja)") dokłada znane warianty, np. "Język (Bretoński)".
 */
function withVariants(names: string[]): string[] {
  const out = new Set(names);
  for (const n of names) {
    const info = parseSpecialization(n);
    if (info.base && info.inner !== null) for (const v of gameData.specializedVariants(info.base)) out.add(v);
  }
  return [...out].sort((a, b) => a.localeCompare(b, "pl"));
}

class CharacterStore {
  dm = new DataManager();
  engine: PendingEngine;

  /** Sygnal reaktywnosci - kazda mutacja modelu zwieksza wartosc. */
  private rev = $state(0);

  /** Czy statyczne dane gry zostaly zaladowane. */
  ready = $state(false);
  loadError = $state<string | null>(null);

  /** Globalny wariant zasad (Podstawowe / Pod Bronia / Domowe). */
  ruleset = $state<Ruleset>("core");
  /** Ostrzezenia po ostatniej zmianie wariantu (do modala). */
  rulesetWarnings = $state<string[]>([]);

  /** Globalny filtr zrodel (co widac przy wyborze profesji/talentow). */
  sourceFilter = $state<SourceFilter>("podstawka_dodatki");

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
      const settings = loadSettings();
      const saved = settings.ruleset;
      if (saved === "core" || saved === "pod_bronia" || saved === "domowe") {
        this.ruleset = saved;
      }
      const sf = settings.sourceFilter;
      if (
        sf === "podstawka" ||
        sf === "podstawka_dodatki" ||
        sf === "wszystko" ||
        sf === "domowe"
      ) {
        this.sourceFilter = sf;
      }
      this.showEvil = settings.showEvil === true;
      await gameData.loadGameData(import.meta.env.BASE_URL, this.ruleset);
      this.restoreAutosave();
      this.ready = true;
      this.touch();
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : String(e);
    }
  }

  /**
   * Zmienia globalny wariant zasad: przelicza dane resolved w gameData, odswieza
   * definicje talentow postaci (zachowujac dane postaci) i przelicza cechy/zywotnosc.
   * Buduje liste ostrzezen o niespojnosciach (talenty +cecha, znikniete profesje).
   */
  setRuleset(ruleset: Ruleset): void {
    if (this.ruleset === ruleset) return;
    this.ruleset = ruleset;
    gameData.setRuleset(ruleset);
    saveSettings({ ruleset });
    this.dm.refreshTalentDefinitions();
    this.dm.recompute();
    this.dm.recomputeWounds();
    this.rulesetWarnings = this.buildRulesetWarnings();
    this.clearDevelopableOverrides();
    this.addHistory("Zmieniono wariant zasad", RULESET_LABELS[ruleset]);
    this.touch();
  }

  /** Kasuje liste ostrzezen (po zamknieciu modala). */
  dismissRulesetWarnings(): void {
    this.rulesetWarnings = [];
  }

  /** Zmienia globalny filtr zrodel (co widac przy wyborze z listy). */
  setSourceFilter(filter: SourceFilter): void {
    if (this.sourceFilter === filter) return;
    this.sourceFilter = filter;
    saveSettings({ sourceFilter: filter });
    this.touch();
  }

  /** Filtruje nazwy profesji wg aktywnego filtra zrodel (bez "profesji zla"). */
  filterProfessionNames(names: string[]): string[] {
    void this.tick;
    const filter = this.sourceFilter;
    return names.filter(
      (n) =>
        !gameData.isEvilProfession(n) &&
        gameData.matchesSourceFilter(gameData.professionSourceGroup(n), filter)
    );
  }

  /** Pokazywac "profesje zla" (Chaos) - globalne ustawienie, domyslnie wylaczone. */
  showEvil = $state(false);

  setShowEvil(on: boolean): void {
    if (this.showEvil === on) return;
    this.showEvil = on;
    saveSettings({ showEvil: on });
    this.touch();
  }

  /** "Profesje zla" z listy pogrupowane wg klasy (puste, gdy filtr wylaczony). */
  evilProfessionGroups(names: string[]): { cls: string; names: string[] }[] {
    void this.tick;
    if (!this.showEvil) return [];
    const groups = new Map<string, string[]>();
    for (const n of names) {
      if (!gameData.isEvilProfession(n)) continue;
      const cls = gameData.classOfCareer(n) ?? "Inne";
      if (!groups.has(cls)) groups.set(cls, []);
      groups.get(cls)!.push(n);
    }
    return [...groups.entries()].map(([cls, list]) => ({ cls, names: list.sort((a, b) => a.localeCompare(b, "pl")) }));
  }

  /** Filtruje nazwy talentow wg aktywnego filtra zrodel. */
  filterTalentNames(names: string[]): string[] {
    void this.tick;
    const filter = this.sourceFilter;
    return names.filter((n) =>
      gameData.matchesSourceFilter(gameData.talentSourceGroup(n), filter)
    );
  }

  /** Buduje ostrzezenia o niespojnosciach postaci po zmianie wariantu. */
  private buildRulesetWarnings(): string[] {
    const warnings: string[] = [];
    for (const [name, entry] of Object.entries(this.dm.talents)) {
      let adds: string | undefined;
      try {
        adds = gameData.getTalent(name)?.adds_characteristic;
      } catch {
        adds = undefined;
      }
      if (entry.characteristicBonus && !adds) {
        warnings.push(
          `Talent „${name}” ma wybrany bonus cechy, ale w tym wariancie już nie dodaje cechy — sprawdź w zakładce Talenty.`
        );
      } else if (adds && !entry.characteristicBonus) {
        warnings.push(
          `Talent „${name}” w tym wariancie dodaje cechę (${adds}) — wybierz bonus w zakładce Talenty.`
        );
      }
      if (entry.is_custom) {
        warnings.push(`Talent „${name}” nie istnieje w tym wariancie — pozostawiony jako własny.`);
      }
    }
    if (this.dm.currentCareer) {
      let prof;
      try {
        prof = gameData.getProfession(this.dm.currentCareer);
      } catch {
        prof = undefined;
      }
      if (!prof) {
        warnings.push(
          `Profesja „${this.dm.currentCareer}” nie istnieje w tym wariancie — schemat może być niedostępny.`
        );
      }
    }
    return warnings;
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
      this.dm.talents,
      this.dm.professionChoices,
      this.dm.skills
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
    const sex = this.dm.characterSex;
    const title = gameData.levelDisplayTitle(name, this.dm.currentCareerLevel, sex);
    const career = gameData.professionDisplayName(name, sex);
    return `${career} (poz. ${this.dm.currentCareerLevel}${title && title !== career ? ` — ${title}` : ""})`;
  }

  /** Plec postaci - forma nazw profesji ("" = jak w bazie). */
  get characterSex(): Sex | "" {
    void this.tick;
    return this.dm.characterSex;
  }

  setCharacterSex(sex: Sex | ""): void {
    if (this.dm.characterSex === sex) return;
    this.dm.characterSex = sex;
    this.touch();
  }

  /** Nazwa profesji w formie wg plci postaci. */
  professionLabel(name: string): string {
    void this.tick;
    return gameData.professionDisplayName(name, this.dm.characterSex);
  }

  /** Tytul poziomu w formie wg plci postaci. */
  levelTitle(name: string, level: number): string {
    void this.tick;
    return gameData.levelDisplayTitle(name, level, this.dm.characterSex);
  }

  /** Klasa postaci (reaktywnie). */
  get characterClass(): string {
    void this.tick;
    return this.dm.characterClass;
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
  get pendingByTab(): { cechy: number; umiejetnosci: number; talenty: number; magia: number } {
    void this.tick;
    const p = this.engine.pending;
    const sum = (o: Record<string, number>) =>
      Object.values(o).reduce((a, b) => a + Math.abs(b), 0);
    return {
      cechy: sum(p.attribute_changes),
      umiejetnosci: sum(p.skill_changes) + p.new_skills.size,
      talenty: sum(p.talent_changes) + p.new_talents.size,
      magia: p.new_spells.size + p.new_miracles.size
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
        maxBuy: this.engine.maxAdvancements("cecha", code),
        talentBonus: this.dm.characteristicBonuses[code] ?? 0,
        modifierBonus: this.dm.modifierBonuses[code] ?? 0
      };
    });
  }

  skillRows(): SkillRow[] {
    void this.tick;
    const earning = this.earningSkillNames();
    const isEarning = (name: string): boolean => {
      if (earning.has(name)) return true;
      const target = gameData.normalize(name);
      for (const s of earning) if (gameData.normalize(s) === target) return true;
      return false;
    };
    return Object.entries(this.dm.skills)
      .map(([name, entry]) => ({
        name,
        entry,
        attribute: entry.attribute,
        total:
          (this.dm.attributes[entry.attribute]?.current ?? entry.initial ?? 0) +
          (entry.advanced ?? 0) +
          this.dm.skillModifier(name),
        developable: this.skillDevelopable(name),
        override: this.overrideSkills.has(name),
        maxBuy: this.engine.maxAdvancements("umiejetnosc", name),
        earning: isEarning(name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  /**
   * Zbior umiejetnosci zarobkowych (pkt 19) z profesji na sciezce kariery i
   * profesji biezacej. Nazwy bazowe; dopasowanie po normalizacji w skillRows.
   */
  earningSkillNames(): Set<string> {
    void this.tick;
    const out = new Set<string>();
    const add = (prof: string | null): void => {
      for (const s of gameData.getEarningSkills(prof)) out.add(s);
    };
    add(this.dm.currentCareer || null);
    for (const step of this.dm.careerPath ?? []) {
      add(step.profession || step.title || null);
    }
    return out;
  }

  /** Czy dana umiejetnosc (posiadana lub phantom) jest zarobkowa (pkt 19). */
  isEarningSkill(name: string): boolean {
    void this.tick;
    const earning = this.earningSkillNames();
    if (earning.has(name)) return true;
    const target = gameData.normalize(name);
    for (const s of earning) if (gameData.normalize(s) === target) return true;
    return false;
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

  /**
   * Talenty ze schematu profesji jeszcze nie wykupione (phantom) oraz wpisy
   * z wyborem specjalizacji ("(Dowolny)", "albo") czekajace na decyzje.
   */
  phantomTalents(): PhantomEntry[] {
    void this.tick;
    const dev = this.developable();
    if (!dev.resolved) return [];
    // Dopasowanie po znormalizowanej nazwie (case/spacje) - talent posiadany pod
    // inną pisownią nie może być pokazany jako nieposiadany (pkt 4).
    const out: PhantomEntry[] = [];
    for (const name of dev.talents) {
      if (gameData.findOwnedName(this.dm.talents, name)) continue;
      out.push({ name });
    }
    for (const slot of dev.talentSlots) out.push({ name: slot.scheme, slot });
    return out.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  /**
   * Umiejetnosci ze schematu profesji jeszcze nie posiadane (phantom) oraz wpisy
   * z wyborem specjalizacji czekajace na decyzje (zawsze widoczne, nawet gdy
   * postac ma juz inna umiejetnosc z tej grupy - pkt "dowolna").
   */
  phantomSkills(): PhantomEntry[] {
    void this.tick;
    const dev = this.developable();
    if (!dev.resolved) return [];
    const out: PhantomEntry[] = [];
    for (const name of dev.skills) {
      // findOwnedSkill uwzglednia specjalizacje/grupy i roznice pisowni (pkt 4).
      if (!gameData.findOwnedSkill(this.dm.skills, name)) out.push({ name });
    }
    for (const slot of dev.skillSlots) out.push({ name: slot.scheme, slot });
    return out.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  // ----- Wybory specjalizacji ("(Dowolna)" / "albo") ---------------------

  /**
   * Posiadane pozycje, ktore mozna przypisac do slotu wyboru (ta sama grupa,
   * jeszcze nie bedace czescia profesji). Dla "A albo B" - tylko opcje z listy.
   */
  slotCandidates(slot: ChoiceSlot, kind: "skill" | "talent"): string[] {
    void this.tick;
    const owned = kind === "skill" ? this.dm.skills : this.dm.talents;
    const dev = this.developable();
    const taken = kind === "skill" ? dev.skills : dev.talents;
    const info = parseSpecialization(slot.scheme);
    const allowed =
      info.kind === "choice"
        ? new Set(info.options.map((o) => gameData.normalize(buildSpecializedName(info.base, o))))
        : null;
    const base = gameData.normalize(info.base);
    const takenNorm = new Set([...taken].map((n) => gameData.normalize(n)));
    return Object.keys(owned)
      .filter((name) => {
        const norm = gameData.normalize(name);
        if (takenNorm.has(norm)) return false;
        if (allowed) return allowed.has(norm);
        return norm.startsWith(`${base} (`);
      })
      .sort((a, b) => a.localeCompare(b, "pl"));
  }

  /**
   * Sprawdza, czy wybor nie dubluje pozycji juz nalezacej do profesji. Duplikat
   * jest dozwolony po potwierdzeniu (allowDuplicate) - slot zostaje wtedy zuzyty.
   */
  private validateChoice(
    fullName: string,
    kind: "skill" | "talent",
    allowDuplicate: boolean
  ): { reason: string; duplicate?: boolean } | null {
    const name = fullName.trim();
    if (!name) return { reason: "Podaj specjalizację." };
    if (allowDuplicate) return null;
    const dev = this.developable();
    const taken = kind === "skill" ? dev.skills : dev.talents;
    const target = gameData.normalize(name);
    for (const t of taken) {
      if (gameData.normalize(t) === target) {
        return {
          reason: `„${name}” już należy do tej profesji — ten wybór nie da nowej pozycji, a slot zostanie zużyty.`,
          duplicate: true
        };
      }
    }
    return null;
  }

  /**
   * Rozstrzyga slot umiejetnosci: zapamietuje wybor jako czesc profesji i - gdy
   * postac jeszcze nie ma tej umiejetnosci - dodaje ja (jak z listy profesji).
   */
  chooseSkillSlot(
    slot: ChoiceSlot,
    fullName: string,
    allowDuplicate = false
  ): { ok: boolean; reason?: string; duplicate?: boolean } {
    const invalid = this.validateChoice(fullName, "skill", allowDuplicate);
    if (invalid) return { ok: false, ...invalid };
    const name = fullName.trim();
    let owned = gameData.findOwnedName(this.dm.skills, name);
    if (!owned) {
      const code = gameData.skillBaseAttr(name) ?? "Int";
      if (!this.engine.addNewSkill(name, code, this.attributeValue(code), 0)) {
        return { ok: false, reason: "Nie udało się dodać umiejętności." };
      }
      owned = name;
    }
    this.dm.professionChoices[slot.key] = owned;
    this.addHistory("Wybrano specjalizację", `${slot.scheme} → ${owned} (${slot.profession} ${slot.level})`);
    this.touch();
    return { ok: true };
  }

  /**
   * Rozstrzyga slot talentu: zapamietuje wybor i - gdy talent nie jest jeszcze
   * wykupiony - kupuje go (opcjonalnie z bonusem cechy dla talentow +cecha).
   */
  chooseTalentSlot(
    slot: ChoiceSlot,
    fullName: string,
    charBonus?: { code: string; value: number },
    allowDuplicate = false
  ): { ok: boolean; reason?: string; duplicate?: boolean } {
    const invalid = this.validateChoice(fullName, "talent", allowDuplicate);
    if (invalid) return { ok: false, ...invalid };
    const name = fullName.trim();
    let owned = gameData.findOwnedName(this.dm.talents, name);
    if (!owned) {
      const ok = charBonus
        ? this.addCharacteristicTalent(name, charBonus.code, charBonus.value)
        : this.addTalentFromList(name);
      if (!ok) return { ok: false, reason: "Za mało PD na wykupienie talentu." };
      owned = name;
    }
    this.dm.professionChoices[slot.key] = owned;
    this.addHistory("Wybrano specjalizację", `${slot.scheme} → ${owned} (${slot.profession} ${slot.level})`);
    this.touch();
    return { ok: true };
  }

  /** Lista zapamietanych wyborow specjalizacji (biezaca profesja najpierw). */
  choiceEntries(): ChoiceEntry[] {
    void this.tick;
    const current = gameData.resolveProfessionName(this.dm.currentCareer) ?? this.dm.currentCareer;
    return Object.entries(this.dm.professionChoices)
      .map(([key, value]) => {
        const p = gameData.parseChoiceSlotKey(key);
        return {
          key,
          value,
          profession: p?.profession ?? key,
          level: p?.level ?? 1,
          scheme: p?.scheme ?? key
        };
      })
      .sort((a, b) => {
        const ac = a.profession === current ? 0 : 1;
        const bc = b.profession === current ? 0 : 1;
        return ac - bc || a.profession.localeCompare(b.profession, "pl") || a.level - b.level;
      });
  }

  /** Cofa zapamietany wybor (slot znow czeka na decyzje; pozycja zostaje). */
  clearChoice(key: string): void {
    const value = this.dm.professionChoices[key];
    if (value === undefined) return;
    delete this.dm.professionChoices[key];
    this.addHistory("Cofnięto wybór specjalizacji", value);
    this.touch();
  }

  /** Usuwa wybory wskazujace na pozycje, ktorych postac juz nie ma. */
  private pruneChoices(): void {
    for (const [key, value] of Object.entries(this.dm.professionChoices)) {
      const owned =
        gameData.findOwnedName(this.dm.skills, value) ||
        gameData.findOwnedName(this.dm.talents, value);
      if (!owned) delete this.dm.professionChoices[key];
    }
  }

  // ----- Zaklecia i modlitwy ----------------------------------------------

  /** Zgoda MG na zaklecia/cuda spoza zasad (dowolna tradycja/bostwo). */
  magicGmApproved = $state(false);
  /** Kolejne poznanie bez kosztu PD (np. nagroda MG, znaleziony grimuar). */
  magicFree = $state(false);

  /** Profil magiczno-religijny z talentow postaci. */
  magicProfile(): MagicProfile {
    void this.tick;
    return magicProfile(Object.keys(this.dm.talents), gameData.getSpellsData(), gameData.getPrayersData());
  }

  /** Znane zaklecia posortowane wg tradycji i nazwy. */
  spellRows(): SpellEntry[] {
    void this.tick;
    return Object.values(this.dm.spells)
      .map((s) => ({ ...s }))
      .sort((a, b) => a.lore.localeCompare(b.lore, "pl") || a.name.localeCompare(b.name, "pl"));
  }

  /** Znane cuda posortowane wg bostwa i nazwy. */
  miracleRows(): MiracleEntry[] {
    void this.tick;
    return Object.values(this.dm.miracles)
      .map((m) => ({ ...m }))
      .sort((a, b) => a.deity.localeCompare(b.deity, "pl") || a.name.localeCompare(b.name, "pl"));
  }

  /** Blogoslawienstwa z talentow Blogoslawienstwo (Bostwo). */
  blessings(): { deity: string; blessing: PrayerDef }[] {
    void this.tick;
    return grantedBlessings(this.magicProfile(), gameData.getPrayersData());
  }

  /** Liczba znanych zaklec wg grup kosztu (Prosta / Tajemna). */
  private knownSpellCounts(): { petty: number; arcane: number } {
    const lores = gameData.getSpellsData().lores;
    let petty = 0;
    let arcane = 0;
    for (const s of Object.values(this.dm.spells)) {
      const g = lores[s.lore]?.group ?? "arcane";
      if (g === "petty") petty++;
      else if (g === "arcane") arcane++;
    }
    return { petty, arcane };
  }

  /** Dostepnosc i koszt zaklecia dla postaci (z uwzglednieniem zgody MG / za darmo). */
  spellOffer(def: SpellDef): { allowed: boolean; reason?: string; cost: number; note: string; known: boolean } {
    void this.tick;
    const known = def.name in this.dm.spells;
    const lore = gameData.getSpellsData().lores[def.lore];
    const av = spellAvailability(def, this.magicProfile(), gameData.getSpellsData());
    const bonus = (code: string) => gameData.attributeBonus(this.dm.attributes[code]?.current ?? 0);
    const c = spellCost(lore?.group ?? "arcane", this.knownSpellCounts(), {
      willpower: bonus("SW"),
      intelligence: bonus("Int")
    });
    const cost = this.magicFree ? 0 : c.cost;
    const note = this.magicFree ? "za darmo (decyzja MG)" : c.note;
    if (known) return { allowed: false, reason: "Już znane.", cost, note, known };
    if (!av.allowed && !this.magicGmApproved) return { ...av, cost, note, known };
    return { allowed: true, reason: av.allowed ? undefined : `Zgoda MG: ${av.reason}`, cost, note, known };
  }

  /** Dostepnosc i koszt cudu. */
  miracleOffer(def: PrayerDef): { allowed: boolean; reason?: string; cost: number; note: string; known: boolean } {
    void this.tick;
    const known = def.name in this.dm.miracles;
    const av = miracleAvailability(def, this.magicProfile());
    const c = miracleCost(Object.keys(this.dm.miracles).length);
    const cost = this.magicFree ? 0 : c.cost;
    const note = this.magicFree ? "za darmo (decyzja MG)" : c.note;
    if (known) return { allowed: false, reason: "Już znany.", cost, note, known };
    if (!av.allowed && !this.magicGmApproved) return { ...av, cost, note, known };
    return { allowed: true, reason: av.allowed ? undefined : `Zgoda MG: ${av.reason}`, cost, note, known };
  }

  learnSpell(def: SpellDef): { ok: boolean; reason?: string } {
    const offer = this.spellOffer(def);
    if (!offer.allowed) return { ok: false, reason: offer.reason };
    const entry: SpellEntry = {
      name: def.name, lore: def.lore, cn: def.cn, range: def.range, target: def.target,
      duration: def.duration, description: def.description, source: def.source,
      cost: offer.cost, is_new: true
    };
    const r = this.engine.learn("spell", entry);
    if (!r.ok) return { ok: false, reason: r.reason === "insufficient" ? `Za mało PD (koszt ${offer.cost}).` : "Nie udało się dodać." };
    this.addHistory("Poznano zaklęcie", `${def.name} (${def.lore}) — ${offer.cost} PD`);
    this.touch();
    return { ok: true };
  }

  learnMiracle(def: PrayerDef): { ok: boolean; reason?: string } {
    const offer = this.miracleOffer(def);
    if (!offer.allowed) return { ok: false, reason: offer.reason };
    const entry: MiracleEntry = {
      name: def.name, deity: def.deity ?? "", aspect: def.aspect, range: def.range, target: def.target,
      duration: def.duration, description: def.description, source: def.source,
      cost: offer.cost, is_new: true
    };
    const r = this.engine.learn("miracle", entry);
    if (!r.ok) return { ok: false, reason: r.reason === "insufficient" ? `Za mało PD (koszt ${offer.cost}).` : "Nie udało się dodać." };
    this.addHistory("Poznano cud", `${def.name} (${def.deity}) — ${offer.cost} PD`);
    this.touch();
    return { ok: true };
  }

  /** Cofa nowe zaklecie/cud (zwrot PD) albo usuwa zatwierdzone (bez zwrotu). */
  forget(kind: "spell" | "miracle", name: string): void {
    const store = kind === "spell" ? this.dm.spells : this.dm.miracles;
    const entry = store[name];
    if (!entry) return;
    if (entry.is_new) this.engine.unlearn(kind, name);
    else delete store[name];
    this.addHistory(kind === "spell" ? "Usunięto zaklęcie" : "Usunięto cud", name);
    this.touch();
  }

  // ----- Bron i pancerz ----------------------------------------------------

  get weapons(): CharWeapon[] {
    void this.tick;
    return this.dm.weapons.map((w) => ({ ...w, qualities: [...w.qualities], flaws: [...w.flaws] }));
  }

  get armour(): CharArmour[] {
    void this.tick;
    return this.dm.armour.map((a) => ({ ...a, locations: [...a.locations], qualities: [...a.qualities] }));
  }

  addWeapon(w: CharWeapon): void {
    this.dm.weapons.push(JSON.parse(JSON.stringify(w)) as CharWeapon);
    this.addHistory("Dodano broń", w.name);
    this.touch();
  }

  updateWeapon(index: number, patch: Partial<CharWeapon>): void {
    const w = this.dm.weapons[index];
    if (!w) return;
    Object.assign(w, patch);
    this.touch();
  }

  removeWeapon(index: number): void {
    const [w] = this.dm.weapons.splice(index, 1);
    if (!w) return;
    this.addHistory("Usunięto broń", w.name);
    this.touch();
  }

  addArmour(a: CharArmour): void {
    this.dm.armour.push(JSON.parse(JSON.stringify(a)) as CharArmour);
    this.addHistory("Dodano pancerz", a.name);
    this.touch();
  }

  updateArmour(index: number, patch: Partial<CharArmour>): void {
    const a = this.dm.armour[index];
    if (!a) return;
    Object.assign(a, patch);
    this.touch();
  }

  removeArmour(index: number): void {
    const [a] = this.dm.armour.splice(index, 1);
    if (!a) return;
    this.addHistory("Usunięto pancerz", a.name);
    this.touch();
  }

  /** Wartosc testu ataku bronia: umiejetnosc albo sama cecha (bez umiejetnosci). */
  weaponTest(w: CharWeapon): { skill: string; value: number; trained: boolean } {
    void this.tick;
    const skill = weaponSkill(w);
    const owned = gameData.findOwnedName(this.dm.skills, skill);
    if (owned) return { skill: owned, value: this.dm.skills[owned].current, trained: true };
    const attr = w.kind === "ranged" ? "US" : "WW";
    return { skill, value: this.dm.attributes[attr]?.current ?? 0, trained: false };
  }

  /** Bonus z Sily i z Wytrzymalosci (biezace). */
  get strengthToughness(): { sb: number; tb: number } {
    void this.tick;
    return {
      sb: gameData.attributeBonus(this.dm.attributes.S?.current ?? 0),
      tb: gameData.attributeBonus(this.dm.attributes.Wt?.current ?? 0)
    };
  }

  // ----- Przedmioty magiczne (generator) ---------------------------------

  /** Przedmioty magiczne postaci (kopie). */
  get magicItems(): Artefact[] {
    void this.tick;
    return this.dm.magicItems.map((a) => ({ ...a }));
  }

  /** Dodaje wygenerowany przedmiot do postaci. */
  addMagicItem(a: Artefact): void {
    this.dm.magicItems.push(JSON.parse(JSON.stringify(a)) as Artefact);
    this.addHistory("Dodano przedmiot magiczny", a.name);
    this.touch();
  }

  removeMagicItem(index: number): void {
    const [a] = this.dm.magicItems.splice(index, 1);
    if (!a) return;
    this.addHistory("Usunięto przedmiot magiczny", a.name);
    this.touch();
  }

  // ----- Modyfikatory (mutacje, wampiryzm, dary...) ----------------------

  /** Modyfikatory postaci (reaktywnie; kopie - model mutuje tablice w miejscu). */
  get modifiers(): CharacterModifier[] {
    void this.tick;
    return this.dm.modifiers.map((m) => ({ ...m }));
  }

  /** Suma zmian cech z aktywnych modyfikatorow (kod -> wartosc). */
  get modifierTotals(): Record<string, number> {
    void this.tick;
    return { ...this.dm.modifierBonuses };
  }

  addModifier(mod: CharacterModifier): void {
    this.dm.addModifier(mod);
    const fx = modifierEffectLabels(mod).join(", ");
    this.addHistory("Dodano modyfikator", fx ? `${mod.name} (${fx})` : mod.name);
    this.touch();
  }

  updateModifier(id: string, mod: CharacterModifier): void {
    if (!this.dm.updateModifier(id, mod)) return;
    this.addHistory("Zmieniono modyfikator", mod.name);
    this.touch();
  }

  removeModifier(id: string): void {
    const mod = this.dm.modifiers.find((m) => m.id === id);
    if (!mod || !this.dm.removeModifier(id)) return;
    this.addHistory("Usunięto modyfikator", mod.name);
    this.touch();
  }

  setModifierActive(id: string, active: boolean): void {
    const mod = this.dm.modifiers.find((m) => m.id === id);
    if (!mod || !this.dm.setModifierActive(id, active)) return;
    this.addHistory(active ? "Włączono modyfikator" : "Wyłączono modyfikator", mod.name);
    this.touch();
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
    this.pruneChoices();
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
    const db = gameData.findTalentDef(name);
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
      gameData.findTalentDef(name);
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
    this.pruneChoices();
    // Po usunieciu talentu +cecha/Twardziela przelicz cechy i Zywotnosc.
    this.dm.recompute();
    this.dm.recomputeWounds();
    this.addHistory("Usunięto talent", name);
    this.touch();
  }

  /** Lista talentow mozliwych do dodania (nie posiadane). */
  availableTalentNames(): string[] {
    void this.tick;
    return withVariants(gameData.allTalentNames()).filter((n) => !(n in this.dm.talents));
  }

  /** Lista kanonicznych umiejetnosci mozliwych do dodania (nie posiadane). */
  availableSkillNames(): string[] {
    void this.tick;
    return withVariants(gameData.allSkillNames()).filter((n) => !(n in this.dm.skills));
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

  /**
   * Ustawia klase postaci niezaleznie od profesji (pkt 17). Pozwala poprawic
   * klase po wyborze profesji, np. gdy auto-dopasowanie z profesji jest niewlasciwe.
   */
  setCharacterClass(cls: string): void {
    const value = cls.trim();
    if (this.dm.characterClass === value) return;
    this.dm.characterClass = value;
    this.addHistory("Zmieniono klasę", value || "—");
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
    // Cofniete nowe pozycje zwalniaja zapamietane wybory "(Dowolna)".
    this.pruneChoices();
    this.dm.recompute();
    this.dm.recomputeWounds();
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
