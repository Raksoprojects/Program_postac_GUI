/**
 * Model postaci WFRP 4ed niezalezny od interfejsu (port z core/character.py).
 *
 * Klasa DataManager przechowuje pelny stan postaci (cechy, umiejetnosci,
 * talenty, doswiadczenie, profesja/sciezka kariery) oraz serializacje do/z JSON
 * oraz import/eksport formularza PDF (przez modul pdfIo.ts). Excel pominiety.
 */

import * as gameData from "./gameData";
import { ATTRIBUTES } from "./rules";
// UWAGA: pdf-lib jest ciezka (~400 kB) i potrzebna tylko przy imporcie/eksporcie
// PDF, dlatego modul pdfIo ladujemy dynamicznie (import()) wewnatrz metod.
// Tutaj importujemy wylacznie typy (kasowane przy kompilacji, brak kosztu).
import type { PdfMapping, PdfWritePayload } from "./pdfIo";
import type {
  AttributeEntry,
  CareerCompletion,
  CareerPathStep,
  CharacterStats,
  ExperienceState,
  RaceCreationInput,
  SkillEntry,
  TalentEntry,
  TalentMax
} from "./types";

export const FILE_TYPE_EXCEL = "excel";
export const FILE_TYPE_PDF = "pdf";
export const FILE_TYPE_JSON = "json";

export const CHARACTER_JSON_SCHEMA = "wfrp4e-character";
export const CHARACTER_JSON_VERSION = 1;

/** Dane profesji wyciagniete z pol PDF (wejscie do loadProfession). */
export interface ProfessionInfo {
  class?: string;
  species?: string;
  profession?: string;
  path_text?: string;
  level_text?: string;
  [key: string]: unknown;
}

/** Surowy talent z importu PDF (przed wzbogaceniem). */
export interface RawTalent {
  advances?: string | number | null;
  description?: string;
  [key: string]: unknown;
}

/** Pelny, serializowalny stan postaci (kanoniczny format JSON). */
export interface CharacterDict {
  schema: string;
  version: number;
  character_name: string;
  character_class: string;
  character_species: string;
  current_career: string;
  current_career_level: number;
  career_path: CareerPathStep[];
  profession_raw: Record<string, unknown>;
  source_type: string;
  attributes: Record<string, AttributeEntry>;
  skills: Record<string, SkillEntry>;
  talents: Record<string, TalentEntry>;
  experience: ExperienceState;
  stats: CharacterStats;
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Domyslne (zerowe) wartosci drugorzednych statystyk postaci. */
export function defaultStats(): CharacterStats {
  return {
    wounds: 0,
    movement: 0,
    fate: 0,
    fortune: 0,
    resilience: 0,
    resolve: 0,
    motivation: ""
  };
}

export class DataManager {
  filePath: string | null = null;
  sourceType: string = FILE_TYPE_EXCEL;
  attributes: Record<string, AttributeEntry> = {};
  skills: Record<string, SkillEntry> = {};
  talents: Record<string, TalentEntry> = {};
  experience: ExperienceState = { available: 0, spent: 0, total: 0 };
  stats: CharacterStats = defaultStats();
  characterName = "Nowa Postać";
  pdfMapping: Record<string, unknown> = {};
  characterClass = "";
  characterSpecies = "";
  currentCareer = "";
  currentCareerLevel = 1;
  careerPath: CareerPathStep[] = [];
  professionRaw: Record<string, unknown> = {};

  /**
   * Plaskie bonusy do wartosci cech z talentow modyfikujacych cechy (np. Urodzony
   * Wojownik). Kod cechy -> bonus. Nie licza sie jako rozwiniecia profesyjne.
   */
  characteristicBonuses: Record<string, number> = {};

  /** Surowe bajty zrodlowego PDF (do ponownego eksportu jako wzorzec). */
  pdfSourceBytes: Uint8Array | null = null;
  /** Typowane mapowanie pol PDF (gdy postac wczytano z PDF). */
  pdfMappingTyped: PdfMapping | null = null;

  // ----- Umiejetnosci ----------------------------------------------------

  /** Dodaje nowa umiejetnosc. Zwraca false, jesli juz istnieje. */
  addSkill(
    skillName: string,
    attribute: string,
    initial = 0,
    advanced = 0,
    isNew = false
  ): boolean {
    if (skillName in this.skills) return false;
    this.skills[skillName] = {
      attribute,
      initial,
      advanced,
      current: initial + advanced,
      base_advanced: advanced,
      is_new: isNew,
      profession_available: false
    };
    return true;
  }

  // ----- Talenty ---------------------------------------------------------

  /** Uzupelnia talenty wczytane z PDF o dane z bazy (Max, opis, zrodlo). */
  enrichTalents(): void {
    const database = (() => {
      const out: Record<string, ReturnType<typeof gameData.getTalent>> = {};
      for (const name of gameData.allTalentNames()) out[name] = gameData.getTalent(name);
      return out;
    })();
    const baseIndex = DataManager.talentBaseIndex(gameData.allTalentNames());
    const enriched: Record<string, TalentEntry> = {};
    for (const [name, raw] of Object.entries(this.talents)) {
      const rawTalent = raw as unknown as RawTalent;
      const advances = DataManager.parseTalentAdvances(rawTalent.advances);
      const dbEntry = DataManager.matchTalentDbEntry(name, database, baseIndex);
      // Gdy talent rozpoznany w bazie -> uzyj oficjalnego opisu; w przeciwnym
      // razie zachowaj opis z karty PDF.
      const description = dbEntry?.description || rawTalent.description || "";
      enriched[name] = {
        advances,
        base_advances: advances,
        description,
        max: (dbEntry?.max ?? { type: "none" }) as TalentMax,
        tests: dbEntry?.tests ?? "",
        source: dbEntry?.source ?? "Karta PDF",
        is_new: false,
        is_custom: dbEntry === undefined,
        profession_available: false
      };
    }
    this.talents = enriched;
  }

  /** Indeks {nazwa_bazowa_bez_specjalizacji -> klucz_bazy} do dopasowan. */
  static talentBaseIndex(names: string[]): Record<string, string> {
    const index: Record<string, string> = {};
    for (const key of names) {
      const base = gameData.normalize(String(key).split("(")[0]);
      if (base && !(base in index)) index[base] = key;
    }
    return index;
  }

  /** Dopasowuje talent z PDF do wpisu bazy (dokladnie lub po nazwie bazowej). */
  static matchTalentDbEntry(
    name: string,
    database: Record<string, ReturnType<typeof gameData.getTalent>>,
    baseIndex: Record<string, string>
  ): ReturnType<typeof gameData.getTalent> {
    const entry = database[name];
    if (entry !== undefined) return entry;
    const base = gameData.normalize(String(name).split("(")[0]);
    const matchedKey = baseIndex[base];
    if (matchedKey) return database[matchedKey];
    return undefined;
  }

  /** Zamienia wartosc 'times taken' z PDF na liczbe (puste -> 1). */
  static parseTalentAdvances(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 1;
    const text = String(value).trim();
    if (!text) return 1;
    const match = text.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 1;
  }

  /** Zwraca twardy limit wykupien talentu (null = brak limitu liczbowego). */
  talentMaxAdvances(name: string): number | null {
    const talent = this.talents[name];
    const info = talent ? talent.max : null;
    if (!info) return null;
    if (info.type === "fixed") return info.value ?? null;
    if (info.type === "characteristic") {
      const attr = info.attr;
      const attrData = attr ? this.attributes[attr] : undefined;
      if (!attrData) return null;
      return Math.max(1, gameData.attributeBonus(attrData.current ?? 0));
    }
    return null;
  }

  /** Dodaje talent do postaci. Zwraca false, jesli juz istnieje. */
  addTalent(
    name: string,
    advances = 1,
    description = "",
    maxInfo: TalentMax | null = null,
    tests: string | null = null,
    source = "Lista",
    isCustom = false,
    isNew = true
  ): boolean {
    if (name in this.talents) return false;
    this.talents[name] = {
      advances,
      base_advances: isNew ? 0 : advances,
      description,
      max: (maxInfo ?? { type: "none" }) as TalentMax,
      tests: tests ?? "",
      source,
      is_new: isNew,
      is_custom: isCustom,
      profession_available: false
    };
    return true;
  }

  // ----- Przeliczanie wartosci pochodnych (na zywo) ----------------------

  /**
   * Przelicza wartosci pochodne na zywo: aktualne wartosci cech
   * (initial + advanced + bonus talentowy) oraz wartosci umiejetnosci
   * (wartosc cechy wiodacej + rozwiniecia). Wywolywac po kazdej zmianie cech,
   * rozwiniec lub talentow modyfikujacych cechy. NIE zmienia Zywotnosci -
   * do tego sluzy recomputeWounds().
   */
  recompute(): void {
    // Bonusy cech z talentow +cecha (pkt 22) - odtwarzane z wpisow talentow,
    // dzieki czemu dodanie/usuniecie talentu automatycznie aktualizuje cechy.
    const bonuses: Record<string, number> = {};
    for (const t of Object.values(this.talents)) {
      const cb = t.characteristicBonus;
      if (cb && cb.code) bonuses[cb.code] = (bonuses[cb.code] ?? 0) + cb.value;
    }
    this.characteristicBonuses = bonuses;
    for (const code of ATTRIBUTES) {
      const attr = this.attributes[code];
      if (!attr) continue;
      attr.current = attr.initial + attr.advanced + (this.characteristicBonuses[code] ?? 0);
    }
    for (const entry of Object.values(this.skills)) {
      const attrCurrent = this.attributes[entry.attribute]?.current ?? entry.initial;
      entry.initial = attrCurrent;
      entry.current = attrCurrent + entry.advanced;
    }
  }

  /**
   * Przelicza Zywotnosc z bonusow cech (BS + 2xBWt + BSW; Niziolek bez BS).
   * Wywolywac po zmianie wartosci cech S/Wt/SW lub talentow je modyfikujacych.
   */
  recomputeWounds(): void {
    let includeStrength = true;
    try {
      includeStrength =
        gameData.getRace(this.characterSpecies)?.woundsIncludeStrength ?? true;
    } catch {
      // Dane gry moga nie byc jeszcze zaladowane - domyslnie wliczamy Krzepe.
      includeStrength = true;
    }
    const sB = gameData.attributeBonus(this.attributes["S"]?.current ?? 0);
    const wtB = gameData.attributeBonus(this.attributes["Wt"]?.current ?? 0);
    const swB = gameData.attributeBonus(this.attributes["SW"]?.current ?? 0);
    // Talenty typu Twardziel: +Zywotnosc = Bonus z Wytrzymalosci na wykupienie
    // (retroaktywnie rosnie wraz z Bonusem z Wt).
    let talentWounds = 0;
    for (const [tname, entry] of Object.entries(this.talents)) {
      let addsWounds = false;
      try {
        addsWounds = gameData.getTalent(tname)?.wounds_toughness_bonus === true;
      } catch {
        addsWounds = false;
      }
      if (addsWounds) talentWounds += wtB * Math.max(1, entry.advances || 1);
    }
    this.stats.wounds = (includeStrength ? sB : 0) + 2 * wtB + swB + talentWounds;
  }

  // ----- Profesja / klasa / sciezka kariery ------------------------------

  /** Wczytuje dane profesji z pol PDF i buduje sciezke kariery. */
  loadProfession(info: ProfessionInfo): void {
    this.professionRaw = { ...(info || {}) };
    this.characterClass = (info?.class as string) || "";
    this.characterSpecies = (info?.species as string) || "";

    const professionField = (info?.profession as string) || "";
    const pathText = (info?.path_text as string) || "";
    const levelText = (info?.level_text as string) || "";

    let steps = gameData.resolveCareerPath(pathText);
    if (steps.length === 0 && professionField) {
      steps = gameData.resolveCareerPath(professionField);
    }

    const parsedLevel = gameData.parseCareerLevel(levelText);
    this.careerPath = this.buildCareerPath(steps, professionField, parsedLevel);

    if (this.careerPath.length) {
      const last = this.careerPath[this.careerPath.length - 1];
      this.currentCareer = last.profession || last.title || professionField;
      this.currentCareerLevel = last.level || parsedLevel || 1;
    } else {
      this.currentCareer = professionField;
      this.currentCareerLevel = parsedLevel || 1;
    }

    const resolvedClass = gameData.classOfCareer(this.currentCareer);
    if (resolvedClass) this.characterClass = resolvedClass;
  }

  /** Sklada liste krokow kariery z oznaczeniem poziomu i kompletowania. */
  buildCareerPath(
    steps: CareerPathStep[],
    _currentProfession: string,
    currentLevel: number | null
  ): CareerPathStep[] {
    const path: CareerPathStep[] = [];
    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      const isLast = index === steps.length - 1;
      let level = step.level || 1;
      if (isLast && currentLevel) level = currentLevel;
      path.push({
        title: step.title || "",
        profession: step.profession ?? null,
        level,
        resolved: step.resolved ?? false,
        completed: !isLast
      });
    }
    return path;
  }

  /** Buduje slownik pol profesji do zapisu w PDF. */
  professionPayload(): Record<string, string> {
    const pathTitles = this.careerPath
      .map((step) => step.title || step.profession || "")
      .filter((t) => t);
    let levelText = (this.professionRaw.level_text as string) || "";
    if (this.currentCareer) {
      levelText = `${this.currentCareer} (${this.currentCareerLevel})`;
    }
    return {
      class: this.characterClass,
      profession: this.currentCareer,
      level_text: levelText,
      path_text: pathTitles.join(", "),
      species: this.characterSpecies
    };
  }

  /** Ustawia/poprawia biezaca profesje i poziom (bez kosztu). */
  setCurrentCareer(profession: string, level: number): void {
    const canonical = gameData.resolveProfessionName(profession);
    const name = canonical ?? profession;
    this.currentCareer = name;
    this.currentCareerLevel = Math.max(1, Math.min(4, toInt(level, 1)));
    const resolvedClass = gameData.classOfCareer(name);
    if (resolvedClass) this.characterClass = resolvedClass;
    const resolved = Boolean(canonical);
    if (!this.careerPath.length) {
      this.careerPath = [
        {
          title: name,
          profession: resolved ? name : null,
          level: this.currentCareerLevel,
          resolved,
          completed: false
        }
      ];
    } else {
      const last = this.careerPath[this.careerPath.length - 1];
      last.title = name;
      last.profession = resolved ? name : null;
      last.level = this.currentCareerLevel;
      last.resolved = resolved;
      last.completed = false;
    }
  }

  /** Awansuje do nowej profesji: oznacza obecna jako ukonczona i dopisuje krok. */
  advanceToCareer(profession: string, level: number): void {
    const lvl = Math.max(1, Math.min(4, toInt(level, 1)));
    if (this.careerPath.length) {
      this.careerPath[this.careerPath.length - 1].completed = true;
    }
    const canonical = gameData.resolveProfessionName(profession);
    const name = canonical ?? profession;
    const resolved = Boolean(canonical);
    this.careerPath.push({
      title: name,
      profession: resolved ? name : null,
      level: lvl,
      resolved,
      completed: false
    });
    this.currentCareer = name;
    this.currentCareerLevel = lvl;
    const resolvedClass = gameData.classOfCareer(name);
    if (resolvedClass) this.characterClass = resolvedClass;
  }

  /** Zwraca status kompletowania biezacej profesji. */
  currentCareerCompletion(): CareerCompletion & { unknown_profession: boolean } {
    const profession = this.currentCareer;
    if (!gameData.getProfession(profession)) {
      return {
        completed: false,
        skills_ok: false,
        talents_ok: false,
        characteristics_ok: false,
        skills_done: 0,
        talents_done: 0,
        characteristics_pending: true,
        unknown_profession: true
      };
    }
    const result = gameData.isCareerCompleted(
      profession,
      this.currentCareerLevel,
      this.skills,
      this.talents,
      this.attributes,
      this.careerPath
    );
    return { ...result, unknown_profession: false };
  }

  /** Resetuje postac do wartosci z pliku (cofa rozwiniecia do bazowych). */
  resetCharacter(): void {
    for (const attr of Object.values(this.attributes)) {
      attr.advanced = attr.base_advanced;
    }
    for (const skill of Object.values(this.skills)) {
      skill.advanced = skill.base_advanced;
    }
  }

  /** Tworzy nowa postac z wartosciami domyslnymi. */
  createNewCharacter(name = "Nowa Postać"): void {
    this.characterName = name;
    this.filePath = null;
    this.sourceType = FILE_TYPE_EXCEL;
    this.pdfMapping = {};
    this.attributes = {};
    for (const attr of ATTRIBUTES) {
      this.attributes[attr] = {
        initial: 30,
        advanced: 0,
        current: 30,
        base_advanced: 0,
        is_new: false,
        profession_available: false
      };
    }
    this.skills = {};
    this.experience = { available: 0, spent: 0, total: 0 };
    this.talents = {};
    this.stats = defaultStats();
    this.characterClass = "";
    this.characterSpecies = "";
    this.currentCareer = "";
    this.currentCareerLevel = 1;
    this.careerPath = [];
    this.professionRaw = {};
    this.characteristicBonuses = {};
    this.pdfSourceBytes = null;
    this.pdfMappingTyped = null;
    this.recompute();
  }

  /**
   * Tworzy postac na podstawie wynikow kreatora rasowego (Krok 1 + 3 + rasowe
   * umiejetnosci/talenty). Ustawia wartosci poczatkowe cech, dodaje rasowe
   * umiejetnosci (3x+5, 3x+3) oraz talenty, drugorzedne statystyki i PD.
   */
  createFromRace(input: RaceCreationInput): void {
    this.createNewCharacter(input.name || "Nowa Postać");
    this.characterSpecies = input.race;

    for (const attr of ATTRIBUTES) {
      const val = Math.max(0, Math.trunc(input.characteristics[attr] ?? 0));
      this.attributes[attr] = {
        initial: val,
        advanced: 0,
        current: val,
        base_advanced: 0,
        is_new: false,
        profession_available: false
      };
    }

    const addRacialSkill = (name: string, advanced: number): void => {
      if (!name || name in this.skills) return;
      const code = gameData.skillBaseAttr(name) || "Int";
      const base = this.attributes[code]?.current ?? 0;
      this.addSkill(name, code, base, advanced, false);
    };
    for (const s of input.skillsPlus5) addRacialSkill(s, 5);
    for (const s of input.skillsPlus3) addRacialSkill(s, 3);

    for (const tname of input.talents) {
      if (!tname || tname in this.talents) continue;
      const db = gameData.getTalent(tname);
      this.talents[tname] = {
        advances: 1,
        base_advances: 1,
        description: db?.description ?? "",
        max: (db?.max ?? { type: "none" }) as TalentMax,
        tests: db?.tests ?? "",
        source: db?.source ?? "Rasowy",
        is_new: false,
        is_custom: db === undefined,
        profession_available: false
      };
    }

    const xp = Math.max(0, Math.trunc(input.experience));
    this.experience = { available: xp, spent: 0, total: xp };

    // Punkty Szczescia = Przeznaczenia, Determinacja = Bohatera (kopie startowe).
    this.stats = {
      wounds: Math.max(0, Math.trunc(input.wounds)),
      movement: Math.max(0, Math.trunc(input.movement)),
      fate: Math.max(0, Math.trunc(input.fate)),
      fortune: Math.max(0, Math.trunc(input.fate)),
      resilience: Math.max(0, Math.trunc(input.resilience)),
      resolve: Math.max(0, Math.trunc(input.resilience)),
      motivation: ""
    };

    // Wartosci cech/umiejetnosci sa juz spojne; normalizacja na wszelki wypadek.
    // Zywotnosc przeliczamy z cech (ta sama formula co kreator) - dzieki temu
    // talent Twardziel dolicza Bonus z Wytrzymalosci takze na starcie postaci.
    this.recompute();
    this.recomputeWounds();
  }

  // ----- Import / eksport PDF -------------------------------------------

  /** Wczytuje dane postaci z formularza PDF. Zwraca true przy sukcesie. */
  async loadFromPdf(bytes: Uint8Array): Promise<boolean> {
    try {
      const { extractPdfCharacterData } = await import("./pdfIo");
      const payload = await extractPdfCharacterData(bytes);
      this.sourceType = FILE_TYPE_PDF;
      this.filePath = null;
      this.characterName = payload.character_name;
      this.attributes = payload.attributes;
      this.skills = payload.skills;
      // Talenty z PDF sa surowe (advances jako tekst) - enrichTalents je domyka.
      this.talents = payload.talents as unknown as Record<string, TalentEntry>;
      this.experience = payload.experience;
      this.stats = payload.stats;
      this.pdfMapping = payload.pdf_mapping as unknown as Record<string, unknown>;
      this.pdfMappingTyped = payload.pdf_mapping;
      this.pdfSourceBytes = bytes.slice();
      this.characteristicBonuses = {};
      this.enrichTalents();
      this.loadProfession(payload.profession_info);
      this.recompute();
      return true;
    } catch (e) {
      console.error("PDF load error:", e);
      return false;
    }
  }

  /** Buduje payload do zapisu PDF z biezacego stanu postaci. */
  private pdfWritePayload(): PdfWritePayload {
    return {
      character_name: this.characterName,
      attributes: this.attributes,
      skills: this.skills,
      stats: { ...this.stats },
      talents: Object.fromEntries(
        Object.entries(this.talents).map(([name, t]) => [
          name,
          { advances: t.advances, description: t.description }
        ])
      ),
      experience: this.experience,
      profession: this.professionPayload()
    };
  }

  /**
   * Eksportuje postac do PDF. Dla postaci wczytanej z PDF uzywa jej jako wzorca;
   * w przeciwnym razie wymaga przekazania bajtow pustego szablonu karty.
   */
  async exportToPdf(emptyTemplateBytes?: Uint8Array): Promise<Uint8Array> {
    const { extractPdfCharacterData, writePdfCharacterData } = await import(
      "./pdfIo"
    );
    let sourceBytes: Uint8Array;
    let mapping: PdfMapping;
    if (
      this.sourceType === FILE_TYPE_PDF &&
      this.pdfSourceBytes &&
      this.pdfMappingTyped
    ) {
      sourceBytes = this.pdfSourceBytes;
      mapping = this.pdfMappingTyped;
    } else {
      if (!emptyTemplateBytes) {
        throw new Error("Brak szablonu PDF do eksportu nowej postaci.");
      }
      sourceBytes = emptyTemplateBytes;
      mapping = (await extractPdfCharacterData(emptyTemplateBytes)).pdf_mapping;
    }
    return writePdfCharacterData(sourceBytes, this.pdfWritePayload(), mapping);
  }

  // ----- Serializacja JSON ----------------------------------------------

  /** Serializuje pelny stan postaci do obiektu (kanoniczny format JSON). */
  toDict(): CharacterDict {
    return {
      schema: CHARACTER_JSON_SCHEMA,
      version: CHARACTER_JSON_VERSION,
      character_name: this.characterName,
      character_class: this.characterClass,
      character_species: this.characterSpecies,
      current_career: this.currentCareer,
      current_career_level: this.currentCareerLevel,
      career_path: this.careerPath.map((step) => ({ ...step })),
      profession_raw: { ...this.professionRaw },
      source_type: this.sourceType,
      attributes: Object.fromEntries(
        Object.entries(this.attributes).map(([k, v]) => [k, { ...v }])
      ),
      skills: Object.fromEntries(Object.entries(this.skills).map(([k, v]) => [k, { ...v }])),
      talents: Object.fromEntries(Object.entries(this.talents).map(([k, v]) => [k, { ...v }])),
      experience: { ...this.experience },
      stats: { ...this.stats }
    };
  }

  /** Wczytuje stan postaci z obiektu (kanoniczny format JSON). */
  fromDict(data: Partial<CharacterDict>): boolean {
    try {
      this.characterName = data.character_name ?? "Nowa Postać";
      this.characterClass = data.character_class || "";
      this.characterSpecies = data.character_species || "";
      this.currentCareer = data.current_career || "";
      this.currentCareerLevel = toInt(data.current_career_level, 1) || 1;
      this.careerPath = (data.career_path ?? []).map((s) => ({ ...s }));
      this.professionRaw = { ...(data.profession_raw ?? {}) };
      this.sourceType = data.source_type || FILE_TYPE_EXCEL;
      this.attributes = Object.fromEntries(
        Object.entries(data.attributes ?? {}).map(([k, v]) => [k, { ...v }])
      );
      this.skills = Object.fromEntries(
        Object.entries(data.skills ?? {}).map(([k, v]) => [k, { ...v }])
      );
      this.talents = Object.fromEntries(
        Object.entries(data.talents ?? {}).map(([k, v]) => [k, { ...v }])
      );
      const exp = data.experience ?? { available: 0, spent: 0, total: 0 };
      this.experience = {
        available: toInt(exp.available, 0),
        spent: toInt(exp.spent, 0),
        total: toInt(exp.total, 0)
      };
      const st = data.stats;
      this.stats = st
        ? {
            wounds: toInt(st.wounds, 0),
            movement: toInt(st.movement, 0),
            fate: toInt(st.fate, 0),
            fortune: toInt(st.fortune, 0),
            resilience: toInt(st.resilience, 0),
            resolve: toInt(st.resolve, 0),
            motivation: String(st.motivation ?? "")
          }
        : defaultStats();
      this.pdfMapping = {};
      this.pdfSourceBytes = null;
      this.pdfMappingTyped = null;
      this.characteristicBonuses = {};
      this.recompute();
      return true;
    } catch (e) {
      console.error("JSON decode error:", e);
      return false;
    }
  }

  /** Serializuje postac do tekstu JSON (z wcieciami). */
  toJson(): string {
    return JSON.stringify(this.toDict(), null, 2);
  }

  /** Wczytuje postac z tekstu JSON. Zwraca true przy sukcesie. */
  loadFromJson(text: string): boolean {
    let data: Partial<CharacterDict>;
    try {
      data = JSON.parse(text) as Partial<CharacterDict>;
    } catch (e) {
      console.error("JSON load error:", e);
      return false;
    }
    return this.fromDict(data);
  }
}
