/**
 * Dostep do statycznych danych gry WFRP 4ed (port z game_data.py).
 *
 * W odroznieniu od wersji Python dane ladowane sa asynchronicznie (fetch).
 * Po zaladowaniu akcesory dzialaja synchronicznie. Dla testow mozna wstrzyknac
 * dane bezposrednio przez setGameData().
 */

import type {
  CareerCompletion,
  CareerPathStep,
  ClassesData,
  Developable,
  EntryVariants,
  GameClass,
  Origin,
  OriginsData,
  Profession,
  ProfessionsData,
  RaceDef,
  RacesData,
  Ruleset,
  SkillDef,
  SkillsData,
  SourceFilter,
  SourceGroup,
  Talent,
  TalentsData
} from "./types";

// Dane "resolved" (po zastosowaniu wariantu) - czytane przez akcesory.
let professions: ProfessionsData | null = null;
let classes: ClassesData | null = null;
let talents: TalentsData | null = null;
let skills: SkillsData | null = null;
let races: RacesData | null = null;
let origins: OriginsData = {};

// Dane surowe (z wariantami) + nakladka domowa z pliku + aktywny wariant.
let rawProfessions: ProfessionsData | null = null;
let rawTalents: TalentsData | null = null;
let professionsDomowe: ProfessionsData = {};
let activeRuleset: Ruleset = "core";

/** Wstrzykuje dane bezposrednio (uzywane w testach jednostkowych). */
export function setGameData(data: {
  professions: ProfessionsData;
  classes: ClassesData;
  talents: TalentsData;
  skills?: SkillsData;
  races?: RacesData;
  professionsDomowe?: ProfessionsData;
  origins?: OriginsData;
  ruleset?: Ruleset;
}): void {
  rawProfessions = data.professions;
  rawTalents = data.talents;
  professionsDomowe = data.professionsDomowe ?? {};
  classes = data.classes;
  skills = data.skills ?? [];
  races = data.races ?? null;
  origins = data.origins ?? {};
  activeRuleset = data.ruleset ?? "core";
  applyRuleset();
}

/** Czy dane zostaly juz zaladowane. */
export function isGameDataLoaded(): boolean {
  return professions !== null && classes !== null && talents !== null;
}

/** Laduje dane gry z katalogu /data (fetch). Wywolaj raz przy starcie aplikacji. */
export async function loadGameData(
  baseUrl: string = import.meta.env.BASE_URL,
  ruleset: Ruleset = "core"
): Promise<void> {
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const [p, c, t, s, r, dom, org] = await Promise.all([
    fetch(`${prefix}data/professions.json`).then((r) => r.json() as Promise<ProfessionsData>),
    fetch(`${prefix}data/classes.json`).then((r) => r.json() as Promise<ClassesData>),
    fetch(`${prefix}data/talents.json`).then((r) => r.json() as Promise<TalentsData>),
    fetch(`${prefix}data/skills.json`).then((r) => r.json() as Promise<SkillsData>),
    fetch(`${prefix}data/races.json`).then((r) => r.json() as Promise<RacesData>),
    // Nakladka domowa profesji (opcjonalna - moze jeszcze nie istniec).
    fetchOptionalJson<ProfessionsData>(`${prefix}data/professions.domowe.json`),
    // Pochodzenia (opcjonalne - moze jeszcze nie istniec / byc puste).
    fetchOptionalJson<OriginsData>(`${prefix}data/origins.json`)
  ]);
  rawProfessions = p;
  rawTalents = t;
  professionsDomowe = dom ?? {};
  classes = c;
  skills = s;
  races = r;
  origins = org ?? {};
  activeRuleset = ruleset;
  applyRuleset();
}

/** Fetch JSON tolerujacy brak pliku (404 -> null zamiast wyjatku). */
async function fetchOptionalJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Aktywny wariant zasad. */
export function getRuleset(): Ruleset {
  return activeRuleset;
}

/** Zmienia wariant zasad i przelicza dane resolved. */
export function setRuleset(ruleset: Ruleset): void {
  activeRuleset = ruleset;
  applyRuleset();
}

/** Grupa proweniencji wg pola `source` (do filtra zrodel). */
export function sourceGroup(source: string | null | undefined): SourceGroup {
  const s = normalize(source ?? "");
  if (!s) return "oficjalny_dodatek";
  if (s.includes("podstaw")) return "podstawka"; // "Podrecznik podstawowy"
  if (s.includes("domow")) return "domowe";
  return "oficjalny_dodatek";
}

/** Grupa proweniencji profesji (po nazwie). */
export function professionSourceGroup(name: string): SourceGroup {
  return sourceGroup(getProfession(name)?.source);
}

/** Grupa proweniencji talentu (po nazwie). */
export function talentSourceGroup(name: string): SourceGroup {
  return sourceGroup(getTalent(name)?.source);
}

/** Czy grupa proweniencji przechodzi przez wybrany preset filtra. */
export function matchesSourceFilter(group: SourceGroup, filter: SourceFilter): boolean {
  switch (filter) {
    case "podstawka":
      return group === "podstawka";
    case "podstawka_dodatki":
      return group === "podstawka" || group === "oficjalny_dodatek";
    case "domowe":
      return group === "domowe";
    case "wszystko":
    default:
      return true;
  }
}

/** Wybiera blok wariantu dla danego trybu (fallback domowe -> pod_bronia). */
function pickVariant<T>(
  variants: EntryVariants<T> | undefined,
  ruleset: Ruleset
): Partial<T> | null {
  if (!variants) return null;
  if (ruleset === "domowe") return variants.domowe ?? variants.pod_bronia ?? null;
  if (ruleset === "pod_bronia") return variants.pod_bronia ?? null;
  return null;
}

/** Talent po zastosowaniu wariantu (pola wariantu nadpisuja baze). */
function resolveTalentEntry(base: Talent, ruleset: Ruleset): Talent {
  const { variants, ...rest } = base;
  const v = pickVariant(variants, ruleset);
  return (v ? { ...rest, ...v } : rest) as Talent;
}

/**
 * Profesja po zastosowaniu wariantu. Kolejnosc nadpisan (pole-po-polu):
 * baza -> inline variant (pod_bronia/domowe) -> nakladka z professions.domowe.json.
 */
function resolveProfessionEntry(name: string, base: Profession, ruleset: Ruleset): Profession {
  const { variants, ...rest } = base;
  let out = rest as Profession;
  const v = pickVariant(variants, ruleset);
  if (v) out = { ...out, ...v };
  if (ruleset === "domowe") {
    const dom = professionsDomowe[name] ?? domoweByNormalized(name);
    if (dom) {
      const { variants: _dv, ...domRest } = dom;
      out = { ...out, ...domRest };
    }
  }
  return out;
}

/** Znajduje wpis nakladki domowej po dopasowaniu znormalizowanym. */
function domoweByNormalized(name: string): Profession | undefined {
  const target = normalize(name);
  if (!target) return undefined;
  for (const key of Object.keys(professionsDomowe)) {
    if (normalize(key) === target) return professionsDomowe[key];
  }
  return undefined;
}

/**
 * Derywuje dane resolved (talenty + profesje) z danych surowych wg aktywnego
 * wariantu. W trybie domowym dokleja tez NOWE profesje z professions.domowe.json.
 */
function applyRuleset(): void {
  if (rawTalents) {
    const out: TalentsData = {};
    for (const [name, base] of Object.entries(rawTalents)) {
      out[name] = resolveTalentEntry(base, activeRuleset);
    }
    talents = out;
  }
  if (rawProfessions) {
    const out: ProfessionsData = {};
    for (const [name, base] of Object.entries(rawProfessions)) {
      out[name] = resolveProfessionEntry(name, base, activeRuleset);
    }
    if (activeRuleset === "domowe") {
      for (const [name, dom] of Object.entries(professionsDomowe)) {
        if (name in out) continue;
        const { variants: _v, ...rest } = dom;
        out[name] = rest as Profession;
      }
    }
    professions = out;
    normalizeEarningSkills(professions);
  }
}

/**
 * Normalizuje umiejetnosci zarobkowe (pkt 19): sufiks "+" przy nazwie
 * umiejetnosci w schemacie profesji oznacza umiejetnosc zarobkowa. Odcinamy
 * "+" (nazwa pozostaje czysta dla dopasowan) i zapisujemy baze do earning_skills.
 */
function normalizeEarningSkills(data: ProfessionsData | null): void {
  if (!data) return;
  for (const prof of Object.values(data)) {
    for (const lvl of prof.levels ?? []) {
      const earning: string[] = [];
      lvl.skills = (lvl.skills ?? []).map((raw) => {
        const trimmed = raw.trimEnd();
        if (trimmed.endsWith("+")) {
          const name = trimmed.slice(0, -1).trimEnd();
          earning.push(name);
          return name;
        }
        return raw;
      });
      if (earning.length) lvl.earning_skills = earning;
    }
  }
}

function requireProfessions(): ProfessionsData {
  if (!professions) throw new Error("Dane gry nie zostaly zaladowane (professions).");
  return professions;
}

function requireClasses(): ClassesData {
  if (!classes) throw new Error("Dane gry nie zostaly zaladowane (classes).");
  return classes;
}

function requireTalents(): TalentsData {
  if (!talents) throw new Error("Dane gry nie zostaly zaladowane (talents).");
  return talents;
}

// ---------------------------------------------------------------------------
// Akcesory
// ---------------------------------------------------------------------------

export function getProfession(name: string): Profession | undefined {
  const profs = requireProfessions();
  const direct = profs[name];
  if (direct) return direct;
  const key = resolveProfessionName(name);
  return key ? profs[key] : undefined;
}

/**
 * Zwraca kanoniczny klucz profesji dla podanej nazwy. Najpierw dokladne
 * dopasowanie, a gdy zawiedzie - dopasowanie po normalizacji (ignoruje
 * roznice w bialych znakach i wielkosci liter). Dzieki temu profesja ustawiona
 * z lekko innym zapisem nadal odnajduje swoj schemat i cechy rozwijalne.
 */
export function resolveProfessionName(name: string): string | undefined {
  if (!name) return undefined;
  const profs = requireProfessions();
  if (name in profs) return name;
  const target = normalize(name);
  if (!target) return undefined;
  for (const key of Object.keys(profs)) {
    if (normalize(key) === target) return key;
  }
  return undefined;
}

export function getClass(name: string): GameClass | undefined {
  return requireClasses()[name];
}

export function getTalent(name: string): Talent | undefined {
  return requireTalents()[name];
}

export function allProfessionNames(): string[] {
  return Object.keys(requireProfessions()).sort((a, b) => a.localeCompare(b, "pl"));
}

export function allClassNames(): string[] {
  return Object.keys(requireClasses());
}

export function allTalentNames(): string[] {
  return Object.keys(requireTalents()).sort((a, b) => a.localeCompare(b, "pl"));
}

/** Kanoniczne nazwy wszystkich umiejetnosci (skills.json), posortowane. */
export function allSkillNames(): string[] {
  return (skills ?? []).map((s) => s.name).sort((a, b) => a.localeCompare(b, "pl"));
}

/** Pelna definicja umiejetnosci kanonicznej wg nazwy (dokladne dopasowanie). */
export function getSkillDef(name: string): SkillDef | undefined {
  return (skills ?? []).find((s) => s.name === name);
}

/**
 * Kod cechy wiodacej dla podanej nazwy umiejetnosci. Dopasowuje takze
 * specjalizacje grupowe, np. "Wiedza (Medycyna)" -> "Wiedza (...)".
 */
export function skillBaseAttr(name: string): string | undefined {
  const exact = getSkillDef(name);
  if (exact) return exact.attr;
  const paren = name.indexOf("(");
  const base = (paren > 0 ? name.slice(0, paren) : name).trim();
  const grouped = (skills ?? []).find(
    (s) => s.grouped && s.name.slice(0, s.name.indexOf("(")).trim() === base
  );
  return grouped?.attr;
}

// ---------------------------------------------------------------------------
// Rasy (races.json)
// ---------------------------------------------------------------------------

function requireRaces(): RacesData {
  if (!races) throw new Error("Dane gry nie zostaly zaladowane (races).");
  return races;
}

/** Nazwy ras w kolejnosci zdefiniowanej w pliku danych. */
export function allRaceNames(): string[] {
  return Object.keys(requireRaces().races);
}

/** Definicja rasy wg nazwy. */
export function getRace(name: string): RaceDef | undefined {
  return requireRaces().races[name];
}

/** Lista pochodzen (lokacji startowych) danej rasy; pusta gdy brak. */
export function getOrigins(raceName: string): Origin[] {
  return origins[raceName] ?? [];
}

/** Pojedyncze pochodzenie rasy wg nazwy (lub undefined). */
export function getOrigin(raceName: string, originName: string): Origin | undefined {
  return (origins[raceName] ?? []).find((o) => o.name === originName);
}

/** Zwraca rase odpowiadajaca rzutowi k100 (1..100) wg tabeli losowania. */
export function raceForRoll(roll: number): string | undefined {
  const r = requireRaces().races;
  for (const [name, def] of Object.entries(r)) {
    if (roll >= def.randomMin && roll <= def.randomMax) return name;
  }
  return undefined;
}

/** Talent rasowy odpowiadajacy rzutowi k100 (1..100) z tabeli losowych talentow. */
export function randomTalentForRoll(roll: number): string | undefined {
  const row = requireRaces().randomTalentsTable.find((t) => roll >= t.min && roll <= t.max);
  return row?.name;
}

export function careersForClass(className: string): string[] {
  const cls = getClass(className);
  return cls ? [...cls.careers] : [];
}

export function classOfCareer(careerName: string): string | null {
  const prof = getProfession(careerName);
  if (prof && prof.class) return prof.class;
  for (const [cname, cdata] of Object.entries(requireClasses())) {
    if ((cdata.careers || []).includes(careerName)) return cname;
  }
  return null;
}

/** Bonus z cechy = cyfra dziesiatek (np. 37 -> 3). */
export function attributeBonus(value: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.floor(Math.max(0, n) / 10);
}

/**
 * Twardy limit wykupien talentu. `null` = brak ograniczenia (none) lub limit
 * specjalny, ktorego nie da sie policzyc automatycznie.
 */
export function talentMax(
  talentName: string,
  attributes?: Record<string, number>
): number | null {
  const talent = getTalent(talentName);
  if (!talent) return null;
  const info = talent.max ?? { type: "none" };
  if (info.type === "fixed") {
    return info.value ?? null;
  }
  if (info.type === "characteristic") {
    const attr = info.attr;
    if (attr && attributes && attr in attributes) {
      return Math.max(1, attributeBonus(attributes[attr]));
    }
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Profesje: tytuly poziomow, dopasowanie, koszty przejsc, kompletowanie
// ---------------------------------------------------------------------------

/** Normalizuje tekst do porownan: male litery, bez nadmiarowych spacji. */
export function normalize(text: string | null | undefined): string {
  if (!text) return "";
  return String(text).trim().toLowerCase().split(/\s+/).join(" ");
}

/** Mapa pelnych nazw cech (jak w professions.json) na kody uzywane w GUI. */
export const CHARACTERISTIC_NAME_TO_CODE: Record<string, string> = {
  "walka wręcz": "WW",
  "umiejętności strzeleckie": "US",
  siła: "S",
  wytrzymałość: "Wt",
  inicjatywa: "I",
  zwinność: "Zw",
  zręczność: "Zr",
  inteligencja: "Int",
  "siła woli": "SW",
  ogłada: "Ogd"
};

const CHARACTERISTIC_CODES = new Set([
  "WW",
  "US",
  "S",
  "Wt",
  "I",
  "Zw",
  "Zr",
  "Int",
  "SW",
  "Ogd"
]);

/** Zwraca kod cechy (np. 'Wt') dla pelnej nazwy lub kodu. Pusty string dla nieznanych. */
export function characteristicToCode(name: string): string {
  if (!name) return "";
  const raw = String(name).trim();
  if (CHARACTERISTIC_CODES.has(raw)) return raw;
  return CHARACTERISTIC_NAME_TO_CODE[normalize(raw)] ?? "";
}

/** Zwraca mape {poziom: tytul} dla danej profesji. */
export function professionLevelTitles(professionName: string): Record<number, string> {
  const prof = getProfession(professionName);
  if (!prof) return {};
  const out: Record<number, string> = {};
  for (const lvl of prof.levels ?? []) {
    out[lvl.level] = lvl.title ?? "";
  }
  return out;
}

export interface CareerMatch {
  profession: string;
  level: number;
  title: string;
}

/** Szuka profesji, w ktorej tytul poziomu odpowiada podanemu tekstowi. */
export function findCareerByTitle(title: string): CareerMatch[] {
  const target = normalize(title);
  if (!target) return [];
  const matches: CareerMatch[] = [];
  const profs = requireProfessions();
  // Najpierw: tytul poziomu == nazwa profesji (klucz)
  for (const name of Object.keys(profs)) {
    if (normalize(name) === target) {
      const levels = profs[name].levels;
      const level = levels && levels.length ? (levels[0].level ?? 1) : 1;
      matches.push({ profession: name, level, title: name });
    }
  }
  // Nastepnie: tytul konkretnego poziomu
  for (const [name, prof] of Object.entries(profs)) {
    for (const lvl of prof.levels ?? []) {
      if (normalize(lvl.title) === target) {
        matches.push({ profession: name, level: lvl.level, title: lvl.title });
      }
    }
  }
  // Usun duplikaty zachowujac kolejnosc
  const seen = new Set<string>();
  const unique: CareerMatch[] = [];
  for (const match of matches) {
    const key = `${match.profession}|${match.level}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(match);
    }
  }
  return unique;
}

/** Rozbija tekst sciezki profesji (rozdzielony przecinkami) na kroki. */
export function resolveCareerPath(pathText: string): CareerPathStep[] {
  const steps: CareerPathStep[] = [];
  if (!pathText) return steps;
  for (const raw of String(pathText).split(",")) {
    const title = raw.trim();
    if (!title) continue;
    const candidates = findCareerByTitle(title);
    if (candidates.length) {
      const best = candidates[0];
      steps.push({
        title,
        profession: best.profession,
        level: best.level,
        resolved: true
      });
    } else {
      steps.push({ title, profession: null, level: null, resolved: false });
    }
  }
  return steps;
}

/** Wyciaga numer poziomu z tekstu pola PDF, np. 'Piromanta (2)' -> 2. */
export function parseCareerLevel(levelText: string): number | null {
  if (!levelText) return null;
  const match = String(levelText).match(/\((\d)\)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

/** Koszt przejscia/awansu profesji wg WFRP 4ed. */
export function careerTransitionCost(
  currentCompleted: boolean,
  sameClass: boolean
): number {
  if (currentCompleted && sameClass) return 100;
  let base = currentCompleted ? 100 : 200;
  if (!sameClass) base += 100;
  return base;
}

/** Dopasowuje umiejetnosc ze schematu do posiadanej (z uwzgl. specjalizacji). */
export function findOwnedSkill<T extends { advanced?: number }>(
  skills: Record<string, T>,
  schemeName: string
): T | null {
  if (schemeName in skills) return skills[schemeName];
  const target = normalize(schemeName);
  for (const [ownedName, data] of Object.entries(skills)) {
    const ownedNorm = normalize(ownedName);
    if (ownedNorm === target) return data;
    // umiejetnosc grupowa: "Wiedza (...)" pasuje do dowolnej specjalizacji
    if (
      schemeName.includes("(") &&
      schemeName.split("(")[0].trim().toLowerCase() === ownedNorm.split("(")[0].trim()
    ) {
      if (target.includes("dowoln") || target.includes("...)") || target.endsWith("()")) {
        return data;
      }
    }
  }
  return null;
}

/** Krok ścieżki kariery na potrzeby agregacji pul (profesja + osiągnięty poziom). */
export interface CareerPathPoolStep {
  profession?: string | null;
  level?: number | null;
}

/**
 * Agreguje elementy rozwijalne z CAŁEJ ścieżki kariery: cechy (kody), umiejętności
 * i talenty ze wszystkich poziomów wszystkich profesji (poziomy ≤ osiągnięty).
 * Służy do kryteriów ukończenia profesji liczonych przez całą ścieżkę.
 */
export function careerPathPools(careerPath: CareerPathPoolStep[]): {
  characteristics: Set<string>;
  skills: Set<string>;
  talents: Set<string>;
} {
  const pools = {
    characteristics: new Set<string>(),
    skills: new Set<string>(),
    talents: new Set<string>()
  };
  for (const step of careerPath ?? []) {
    const profName = step.profession;
    if (!profName) continue;
    const prof = getProfession(profName);
    if (!prof) continue;
    const maxLevel = step.level ?? 1;
    for (const lvl of prof.levels ?? []) {
      const lvlNum = lvl.level;
      if (lvlNum === null || lvlNum === undefined || lvlNum > maxLevel) continue;
      for (const charName of lvl.characteristics ?? []) {
        const code = characteristicToCode(charName);
        if (code) pools.characteristics.add(code);
      }
      for (const skillName of lvl.skills ?? []) pools.skills.add(skillName);
      for (const talentName of lvl.talents ?? []) pools.talents.add(talentName);
    }
  }
  return pools;
}

/**
 * Sprawdza kompletowanie profesji na danym poziomie (kryteria WFRP 4ed).
 * Pula umiejętności/cech/talentów liczona z CAŁEJ ścieżki kariery (jeśli podana),
 * a rozwinięcia zliczane z istniejących wartości (bez wymuszania zakupu od zera).
 * Próg = 5×poziom dla cech/umiejętności, 1×poziom dla talentów.
 */
export function isCareerCompleted(
  professionName: string,
  level: number,
  skills: Record<string, { advanced?: number }> = {},
  talents_: Record<string, { advances?: number }> = {},
  attributes: Record<string, { advanced?: number }> = {},
  careerPath?: CareerPathPoolStep[]
): CareerCompletion {
  const result: CareerCompletion = {
    completed: false,
    skills_ok: false,
    talents_ok: false,
    characteristics_ok: false,
    skills_done: 0,
    talents_done: 0,
    characteristics_pending: false
  };
  const prof = getProfession(professionName);
  if (!prof) return result;

  // Pula elementów: cała ścieżka (jeśli podana) albo poziomy ≤ level bieżącej profesji.
  const pools =
    careerPath && careerPath.length > 0
      ? careerPathPools(careerPath)
      : careerPathPools([{ profession: professionName, level }]);

  const skillThreshold = 5 * level;
  let skillsDone = 0;
  for (const skillName of pools.skills) {
    const owned = findOwnedSkill(skills, skillName);
    if (owned !== null && (owned.advanced ?? 0) >= skillThreshold) {
      skillsDone += 1;
    }
  }
  result.skills_done = skillsDone;
  result.skills_ok = skillsDone >= 8;

  const talentThreshold = 1 * level;
  let talentsDone = 0;
  for (const talentName of pools.talents) {
    const owned = talents_[talentName];
    if (owned && (owned.advances ?? 0) >= talentThreshold) {
      talentsDone += 1;
    }
  }
  result.talents_done = talentsDone;
  result.talents_ok = talentsDone >= 1;

  if (prof.characteristics_pending || pools.characteristics.size === 0) {
    result.characteristics_pending = true;
    result.characteristics_ok = true;
  } else {
    const charThreshold = 5 * level;
    let charsOk = true;
    for (const code of pools.characteristics) {
      const attr = attributes[code];
      if (!attr || (attr.advanced ?? 0) < charThreshold) {
        charsOk = false;
        break;
      }
    }
    result.characteristics_ok = charsOk;
  }

  result.completed = result.skills_ok && result.talents_ok && result.characteristics_ok;
  return result;
}

// ---------------------------------------------------------------------------
// Rozwijalnosc (gating) - co mozna rozwijac w ramach biezacej profesji
// ---------------------------------------------------------------------------

/** Zbiory elementow rozwijalnych "w profesji" dla danego poziomu. */
export function getCareerDevelopable(
  professionName: string | null,
  currentLevel: number,
  ownedTalents: Record<string, { advances?: number }> = {}
): Developable {
  const result: Developable = {
    characteristics: new Set<string>(),
    skills: new Set<string>(),
    talents: new Set<string>(),
    resolved: false
  };
  const prof = professionName ? getProfession(professionName) : undefined;
  if (!prof) return result;
  result.resolved = true;
  for (const lvl of prof.levels ?? []) {
    const lvlNum = lvl.level;
    if (lvlNum === null || lvlNum === undefined || lvlNum > currentLevel) continue;
    for (const charCode of lvl.characteristics ?? []) {
      const code = characteristicToCode(charCode);
      if (code) result.characteristics.add(code);
    }
    for (const skillName of lvl.skills ?? []) {
      result.skills.add(skillName);
    }
    for (const talentName of lvl.talents ?? []) {
      if (lvlNum === currentLevel) {
        result.talents.add(talentName);
      } else {
        const owned = ownedTalents[talentName];
        if (owned && (owned.advances ?? 0) >= 1) {
          result.talents.add(talentName);
        }
      }
    }
  }
  return result;
}

/** Czy cecha (kod, np. 'WW') jest rozwijalna w profesji. */
export function isCharacteristicDevelopable(
  charCode: string,
  developable: Developable
): boolean {
  return developable.characteristics.has(charCode);
}

/** Czy umiejetnosc (z uwzgl. specjalizacji/grupy) jest rozwijalna w profesji. */
export function isSkillDevelopable(skillName: string, developable: Developable): boolean {
  const scheme = developable.skills;
  if (!scheme.size) return false;
  if (scheme.has(skillName)) return true;
  const target = normalize(skillName);
  const baseTarget = target.split("(")[0].trim();
  for (const schemeName of scheme) {
    const schemeNorm = normalize(schemeName);
    if (schemeNorm === target) return true;
    const schemeBase = schemeNorm.split("(")[0].trim();
    if (!schemeName.includes("(") && schemeBase === baseTarget) return true;
    if (schemeName.includes("(") && schemeBase === baseTarget) {
      if (
        schemeNorm.includes("dowoln") ||
        schemeNorm.includes("...") ||
        schemeNorm.endsWith("()")
      ) {
        return true;
      }
      if (schemeNorm === target) return true;
    }
  }
  return false;
}

/** Czy talent jest rozwijalny w profesji (obecny poziom lub juz wykupiony). */
export function isTalentDevelopable(talentName: string, developable: Developable): boolean {
  return developable.talents.has(talentName);
}

/** Zbior umiejetnosci zarobkowych profesji (nazwy bazowe ze wszystkich poziomow; pkt 19). */
export function getEarningSkills(professionName: string | null): Set<string> {
  const out = new Set<string>();
  if (!professionName) return out;
  const prof = getProfession(professionName);
  if (!prof) return out;
  for (const lvl of prof.levels ?? []) {
    for (const s of lvl.earning_skills ?? []) out.add(s);
  }
  return out;
}

/** Czy dana umiejetnosc jest zarobkowa w podanej profesji (dopasowanie po normalizacji). */
export function isEarningSkill(professionName: string | null, skillName: string): boolean {
  const set = getEarningSkills(professionName);
  if (!set.size) return false;
  if (set.has(skillName)) return true;
  const target = normalize(skillName);
  for (const s of set) if (normalize(s) === target) return true;
  return false;
}
