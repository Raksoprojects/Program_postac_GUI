/**
 * Dostep do statycznych danych gry WFRP 4ed (port z game_data.py).
 *
 * W odroznieniu od wersji Python dane ladowane sa asynchronicznie (fetch).
 * Po zaladowaniu akcesory dzialaja synchronicznie. Dla testow mozna wstrzyknac
 * dane bezposrednio przez setGameData().
 */

import {
  buildSpecializedName,
  needsSpecialization,
  parseSpecialization,
  type SpecInfo
} from "./specialization";
import type {
  ArtefactsData,
  MagicItemsData,
  NamesData,
  NameTable,
  ProfessionTitlesData,
  Sex,
  WeaponsData,
  SpellDef,
  TreasuresData,
  CareerCompletion,
  CareerPathStep,
  ChoiceSlot,
  ClassesData,
  Developable,
  EntryVariants,
  ModifierDef,
  ModifiersData,
  PrayersData,
  SpellsData,
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
let modifiers: ModifiersData = { categories: [], entries: [] };
let spellsData: SpellsData = { lores: {}, spells: [] };
let prayersData: PrayersData = { deities: {}, blessings: [], miracles: [] };
let namesData: NamesData = {};
let titlesData: ProfessionTitlesData = { professions: {}, titles: {} };
let weaponsData: WeaponsData = { melee: {}, ranged: {}, armour: {}, qualities: {} };

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
  modifiers?: ModifiersData;
  spells?: SpellsData;
  prayers?: PrayersData;
  names?: NamesData;
  professionTitles?: ProfessionTitlesData;
  weapons?: WeaponsData;
  ruleset?: Ruleset;
}): void {
  rawProfessions = data.professions;
  rawTalents = data.talents;
  professionsDomowe = data.professionsDomowe ?? {};
  classes = data.classes;
  skills = data.skills ?? [];
  races = data.races ?? null;
  origins = data.origins ?? {};
  modifiers = data.modifiers ?? { categories: [], entries: [] };
  spellsData = data.spells ?? { lores: {}, spells: [] };
  prayersData = data.prayers ?? { deities: {}, blessings: [], miracles: [] };
  namesData = data.names ?? {};
  titlesData = data.professionTitles ?? { professions: {}, titles: {} };
  weaponsData = data.weapons ?? { melee: {}, ranged: {}, armour: {}, qualities: {} };
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
  const [p, c, t, s, r, dom, org, mods, sp, pr, nm, ti, wp] = await Promise.all([
    fetch(`${prefix}data/professions.json`).then((r) => r.json() as Promise<ProfessionsData>),
    fetch(`${prefix}data/classes.json`).then((r) => r.json() as Promise<ClassesData>),
    fetch(`${prefix}data/talents.json`).then((r) => r.json() as Promise<TalentsData>),
    fetch(`${prefix}data/skills.json`).then((r) => r.json() as Promise<SkillsData>),
    fetch(`${prefix}data/races.json`).then((r) => r.json() as Promise<RacesData>),
    // Nakladka domowa profesji (opcjonalna - moze jeszcze nie istniec).
    fetchOptionalJson<ProfessionsData>(`${prefix}data/professions.domowe.json`),
    // Pochodzenia (opcjonalne - moze jeszcze nie istniec / byc puste).
    fetchOptionalJson<OriginsData>(`${prefix}data/origins.json`),
    // Katalog modyfikatorow (mutacje, wampiryzm, dary...) - opcjonalny.
    fetchOptionalJson<ModifiersData>(`${prefix}data/modifiers.json`),
    // Zaklecia i modlitwy - opcjonalne.
    fetchOptionalJson<SpellsData>(`${prefix}data/spells.json`),
    fetchOptionalJson<PrayersData>(`${prefix}data/prayers.json`),
    // Imiona do losowania w kreatorze - opcjonalne.
    fetchOptionalJson<NamesData>(`${prefix}data/names.json`),
    // Formy meskie/zenskie nazw profesji i tytulow poziomow - opcjonalne.
    fetchOptionalJson<ProfessionTitlesData>(`${prefix}data/profession_titles.json`),
    // Bron i pancerz (katalog) - opcjonalne.
    fetchOptionalJson<WeaponsData>(`${prefix}data/weapons.json`)
  ]);
  rawProfessions = p;
  rawTalents = t;
  professionsDomowe = dom ?? {};
  classes = c;
  skills = s;
  races = r;
  origins = org ?? {};
  modifiers = mods ?? { categories: [], entries: [] };
  spellsData = sp ?? { lores: {}, spells: [] };
  prayersData = pr ?? { deities: {}, blessings: [], miracles: [] };
  namesData = nm ?? {};
  titlesData = ti ?? { professions: {}, titles: {} };
  weaponsData = wp ?? { melee: {}, ranged: {}, armour: {}, qualities: {} };
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

/** Czy profesja nalezy do "profesji zla" (Chaos itp.). */
export function isEvilProfession(name: string): boolean {
  return getProfession(name)?.evil === true;
}

/** Grupa proweniencji talentu (po nazwie). */
export function talentSourceGroup(name: string): SourceGroup {
  // Wariant ze specjalizacja ("Magia Tajemna (Ognia)") - zrodlo szablonu.
  return sourceGroup((getTalent(name) ?? findTalentDef(name))?.source);
}

/** Krotka nazwa zrodla do list wyboru ("Podstawka", "PG: Wysokie Elfy", "Warriors of Chaos, nieof."). */
export function sourceShort(source: string | undefined | null): string {
  const s = (source ?? "").trim();
  if (!s) return "";
  if (/^Podręcznik podstawowy/i.test(s)) return "Podstawka";
  const pg = /^Podręcznik Gracza:\s*(.+)$/i.exec(s);
  if (pg) return `PG: ${pg[1]}`;
  return s.replace(/\s*\(nieoficjalny\)/i, ", nieof.");
}

/** Nazwa z dopiskiem zrodla w nawiasie, np. "Mistrz Miecza (Podstawka)". */
export function withSource(name: string, source: string | undefined | null): string {
  const s = sourceShort(source);
  return s ? `${name} (${s})` : name;
}

/**
 * Poziomy profesji z danych (Wysokie Elfy maja profesje 1-5 i zaczynajace
 * sie od 3. poziomu); profesja spoza bazy - 1-4.
 */
export function professionLevels(name: string): number[] {
  const lv = (getProfession(name)?.levels ?? []).map((l) => l.level).filter((n) => Number.isFinite(n));
  return lv.length ? [...new Set(lv)].sort((a, b) => a - b) : [1, 2, 3, 4];
}

/** Poziom przyciety do zakresu poziomow profesji. */
export function clampProfessionLevel(name: string, level: number): number {
  const lv = professionLevels(name);
  const n = Math.trunc(Number(level)) || lv[0];
  return Math.max(lv[0], Math.min(lv[lv.length - 1], n));
}

/** Zrodlo profesji (pole source). */
export function professionSource(name: string): string {
  return getProfession(name)?.source ?? "";
}

/** Zrodlo talentu (takze wariantu ze specjalizacja, np. "Magia Tajemna (Ognia)"). */
export function talentSource(name: string): string {
  return (getTalent(name) ?? findTalentDef(name))?.source ?? "";
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
  specCache = null;
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
  // Forma meska/zenska nazwy (profession_titles.json), np. "Kapłan Shallyi".
  for (const [key, forms] of Object.entries(titlesData.professions)) {
    if (key in profs && forms.some((f) => normalize(f) === target)) return key;
  }
  return undefined;
}

/** Nazwa profesji w formie dla plci (K = zenska); bez danych - nazwa z bazy. */
export function professionDisplayName(profession: string, sex?: Sex | ""): string {
  const forms = titlesData.professions[profession];
  if (!forms || !sex) return profession;
  return forms[sex === "K" ? 1 : 0] || profession;
}

/** Tytul poziomu profesji w formie dla plci; bez danych - tytul z bazy. */
export function levelDisplayTitle(profession: string, level: number, sex?: Sex | ""): string {
  const base = getProfession(profession)?.levels.find((l) => l.level === level)?.title ?? "";
  const forms = titlesData.titles[`${profession}|${level}`];
  if (!forms || !sex) return base;
  return forms[sex === "K" ? 1 : 0] || base;
}

export function getClass(name: string): GameClass | undefined {
  return requireClasses()[name];
}

export function getTalent(name: string): Talent | undefined {
  return requireTalents()[name];
}

/**
 * Definicja talentu dla nazwy z wybrana specjalizacja, np. "Etykieta (Szlachta)"
 * -> wpis "Etykieta (Grupa Społeczna)". Najpierw dokladnie, potem po nazwie bazowej.
 */
export function findTalentDef(name: string): Talent | undefined {
  const direct = getTalent(name);
  if (direct) return direct;
  const all = requireTalents();
  const base = normalize(String(name).split("(")[0]);
  if (!base) return undefined;
  for (const key of Object.keys(all)) {
    if (normalize(key.split("(")[0]) === base) return all[key];
  }
  return undefined;
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

/**
 * Specjalizacje spotykane w danych: z umiejetnosci/talentow profesji, ras i
 * pochodzen (np. "Wiedza (Reikland)"), tradycji magii i bostw. Klucz = baza
 * w malych literach, wartosc = lista specjalizacji. Liczone raz (cache).
 */
let specCache: Map<string, string[]> | null = null;

function buildSpecIndex(): Map<string, string[]> {
  const idx = new Map<string, Map<string, string>>();
  const add = (base: string, spec: string) => {
    const b = base.trim().toLowerCase();
    const t = spec.trim();
    const s = t.charAt(0).toUpperCase() + t.slice(1);
    if (!b || !s || s === "..." || /^dowoln/i.test(s)) return;
    if (!idx.has(b)) idx.set(b, new Map());
    const m = idx.get(b)!;
    const prev = m.get(s.toLowerCase());
    // Przy roznej wielkosci liter ("bretoński"/"Bretoński") wygrywa wielka.
    if (!prev || (prev[0] !== prev[0].toUpperCase() && s[0] === s[0].toUpperCase())) m.set(s.toLowerCase(), s);
  };
  const addName = (name: string) => {
    const info = parseSpecialization(name);
    if (info.kind === "choice" && info.base) for (const o of info.options) add(info.base, o);
    else if (info.kind === "choice") for (const o of info.options) addName(o);
    else if (info.base && info.inner) add(info.base, info.inner);
  };
  // Tylko pola skills/talents (wyposazenie pomijamy).
  const walk = (o: unknown, collect = false): void => {
    if (typeof o === "string") {
      if (collect) addName(o);
    } else if (Array.isArray(o)) {
      for (const x of o) walk(x, collect);
    } else if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) walk(v, collect || k === "skills" || k === "talents" || k === "options" || k === "name");
    }
  };
  walk(rawProfessions ?? professions ?? {});
  walk(professionsDomowe);
  walk(races?.races ?? {});
  walk(origins);
  // Tradycje magii: tylko klucze z spells.json (w danych profesji sa warianty "Ogień/Ognia").
  idx.delete("magia tajemna");
  idx.delete("magia chaosu");
  for (const [key, l] of Object.entries(spellsData.lores)) {
    if (l.group === "arcane" && key !== "Tajemna") add("Magia Tajemna", key);
    if (l.group === "chaos") add("Magia Chaosu", key);
  }
  for (const d of Object.keys(prayersData.deities)) {
    add("Błogosławieństwo", d);
    add("Inwokacja", d);
  }
  const out = new Map<string, string[]>();
  for (const [b, m] of idx) out.set(b, [...m.values()].sort((x, y) => x.localeCompare(y, "pl")));
  return out;
}

/** Podpowiedzi specjalizacji dla bazy, np. "Język" -> ["Bretoński", "Khazalid", ...]. */
export function specializationSuggestions(base: string): string[] {
  specCache ??= buildSpecIndex();
  return specCache.get(base.trim().toLowerCase()) ?? [];
}

/**
 * Szablon wymagajacy specjalizacji ("Język (...)", "Magia Tajemna (Tradycja)")
 * - wpis z bazy z nawiasem-kategoria. Zwraca SpecInfo do okna wyboru albo null.
 */
export function specPlaceholderInfo(name: string): SpecInfo | null {
  const info = parseSpecialization(name);
  if (!info.base || info.inner === null) return null;
  if (needsSpecialization(info)) return info;
  const isSkillTpl = (skills ?? []).some((s) => s.grouped && s.name === name);
  const isTalentTpl = !!talents && name in talents;
  if (!isSkillTpl && !isTalentTpl) return null;
  return { ...info, kind: "free", hint: info.inner === "..." ? "" : info.inner };
}

/** Pelne nazwy z podpowiedzi, np. "Język (Bretoński)". */
export function specializedVariants(base: string): string[] {
  return specializationSuggestions(base).map((s) => buildSpecializedName(base, s));
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

/**
 * Zasady domowe ("Pełne Domowe"): Przeznaczenie i Bohater tworza jedna pule
 * Punktow Przeznaczenia (wartosc = fate + resilience); Szczescie osobno.
 */
export function isLuckPoolMerged(ruleset: Ruleset = activeRuleset): boolean {
  return ruleset === "domowe";
}

/** Startowe Punkty Przeznaczenia rasy (zasady domowe): luckPool albo suma puli rasy - 1. */
export function startingLuckPool(race: RaceDef): number {
  if (typeof race.luckPool === "number") return race.luckPool;
  return Math.max(0, race.fate + race.resilience + race.extraPoints - 1);
}

/** Lista pochodzen (lokacji startowych) danej rasy; pusta gdy brak. */
export function getOrigins(raceName: string): Origin[] {
  return origins[raceName] ?? [];
}

/** Pojedyncze pochodzenie rasy wg nazwy (lub undefined). */
export function getOrigin(raceName: string, originName: string): Origin | undefined {
  return (origins[raceName] ?? []).find((o) => o.name === originName);
}

// ---------------------------------------------------------------------------
// Modyfikatory postaci (modifiers.json): mutacje, wampiryzm, dary...
// ---------------------------------------------------------------------------

/** Kategorie katalogu modyfikatorow w kolejnosci z pliku. */
export function modifierCategories(): ModifiersData["categories"] {
  return modifiers.categories ?? [];
}

/** Wpisy katalogu (opcjonalnie tylko z jednej kategorii). */
export function modifierEntries(categoryId?: string): ModifierDef[] {
  const all = modifiers.entries ?? [];
  return categoryId ? all.filter((e) => e.category === categoryId) : all;
}

/** Etykieta kategorii po id (lub samo id, gdy nieznana). */
export function modifierCategoryLabel(categoryId: string): string {
  return modifierCategories().find((c) => c.id === categoryId)?.label ?? categoryId;
}

/** Dane zaklec (tradycje + zaklecia). */
export function getSpellsData(): SpellsData {
  return spellsData;
}

/** Dane modlitw (bostwa, blogoslawienstwa, cuda). */
export function getPrayersData(): PrayersData {
  return prayersData;
}

/** Tabela imion rasy (names.json); brak - imiona ludzkie. */
export function getNames(race: string): NameTable | undefined {
  const t = namesData[race] ?? namesData["Człowiek"];
  return t && !Array.isArray(t) ? t : undefined;
}

/** Losowe "Imie Nazwisko" dla rasy i plci (K = kobieta); undefined bez danych. */
export function randomName(race: string, sex: "M" | "K", rng: () => number = Math.random): string | undefined {
  const t = getNames(race);
  if (!t) return undefined;
  const pick = (a: string[]) => (a.length ? a[Math.floor(rng() * a.length)] : undefined);
  const first = pick(sex === "K" ? t.female : t.male);
  if (!first) return undefined;
  const last = pick(t.surnames);
  return last ? `${first} ${last}` : first;
}

/** Katalog broni i pancerzy (weapons.json). */
export function getWeaponsData(): WeaponsData {
  return weaponsData;
}

/** Opis Zalety/Wady broni lub pancerza ("Tarcza 2" -> "Tarcza"; "Giętka" -> "Giętki"). */
export function equipmentQualityDescription(q: string): string {
  // Wybor "Ogłuszający albo Przekłuwający" - opis kazdej opcji.
  const alts = q.split(/\s+albo\s+/i);
  if (alts.length > 1) {
    return alts
      .map((a) => {
        const d = equipmentQualityDescription(a);
        return d ? `${a.trim()}: ${d}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  const base = q.replace(/\s*\(?\d+\w?\)?$/, "").trim();
  const d = weaponsData.qualities;
  if (d[base]) return d[base];
  // Odmiana rodzaju: "Giętka"/"Giętkie" -> "Giętki", "Nieprzebijalne" -> "Nieprzebijalny".
  const stemOf = (s: string) => s.replace(/(ie|a|e|y|i)$/, "");
  const stem = stemOf(base);
  const hit = Object.keys(d).find((k) => stemOf(k) === stem);
  return hit ? d[hit] : "";
}

/** Zaklecie po nazwie (pierwsze trafienie). */
export function getSpell(name: string): SpellDef | undefined {
  return spellsData.spells.find((s) => s.name === name);
}

// ----- Generator przedmiotow magicznych (dane ladowane leniwie) -----------

let artefactsData: ArtefactsData | null = null;
let treasuresData: TreasuresData | null = null;
let magicItemsData: MagicItemsData | null = null;
let artefactLoad: Promise<boolean> | null = null;

/** Wstrzykuje dane generatora przedmiotow (testy). */
export function setArtefactData(data: { artefacts: ArtefactsData; treasures?: TreasuresData; magicItems?: MagicItemsData }): void {
  artefactsData = data.artefacts;
  treasuresData = data.treasures ?? null;
  magicItemsData = data.magicItems ?? null;
  artefactLoad = Promise.resolve(true);
}

/** Laduje dane generatora przedmiotow (raz, przy pierwszym otwarciu zakladki). */
export function loadArtefactData(baseUrl: string = import.meta.env.BASE_URL): Promise<boolean> {
  if (artefactLoad) return artefactLoad;
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  artefactLoad = Promise.all([
    fetchOptionalJson<ArtefactsData>(`${prefix}data/artefacts.json`),
    fetchOptionalJson<TreasuresData>(`${prefix}data/treasures.json`),
    fetchOptionalJson<MagicItemsData>(`${prefix}data/magic_items.json`)
  ]).then(([a, t, m]) => {
    artefactsData = a;
    treasuresData = t;
    magicItemsData = m;
    if (!a) artefactLoad = null;
    return a !== null;
  });
  return artefactLoad;
}

export function getArtefacts(): ArtefactsData | null {
  return artefactsData;
}

export function getTreasures(): TreasuresData | null {
  return treasuresData;
}

export function getMagicItems(): MagicItemsData | null {
  return magicItemsData;
}

/** Lokalizacja na ciele dla rzutu k100 (tabela locations). */
export function modifierLocationForRoll(roll: number): string | undefined {
  return (modifiers.locations ?? []).find((l) => roll >= l.min && roll <= l.max)?.name;
}

/** Nazwy lokalizacji na ciele (do wyboru recznego). */
export function modifierLocationNames(): string[] {
  return (modifiers.locations ?? []).map((l) => l.name);
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
  // Formy meskie/zenskie (profession_titles.json): nazwa profesji i tytuly poziomow.
  for (const [name, forms] of Object.entries(titlesData.professions)) {
    if (!(name in profs) || !forms.some((f) => normalize(f) === target)) continue;
    const levels = profs[name].levels;
    matches.push({ profession: name, level: levels?.[0]?.level ?? 1, title });
  }
  for (const [key, forms] of Object.entries(titlesData.titles)) {
    if (!forms.some((f) => normalize(f) === target)) continue;
    const i = key.lastIndexOf("|");
    const name = key.slice(0, i);
    if (name in profs) matches.push({ profession: name, level: Number(key.slice(i + 1)), title });
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

// ---------------------------------------------------------------------------
// Wybory specjalizacji w schemacie profesji ("(Dowolna)" / "(A albo B)")
// ---------------------------------------------------------------------------

/**
 * Zapamietane wybory postaci dla wpisow schematu wymagajacych specjalizacji.
 * Klucz = choiceSlotKey(profesja, poziom, wpis), wartosc = pelna wybrana nazwa,
 * np. "Język (Bretoński)".
 */
export type ProfessionChoices = Record<string, string>;

export type { ChoiceSlot };

/** Klucz slotu wyboru: kanoniczna profesja + poziom + oryginalny wpis schematu. */
export function choiceSlotKey(profession: string, level: number, scheme: string): string {
  return `${resolveProfessionName(profession) ?? profession}|${level}|${scheme}`;
}

/** Rozbija klucz slotu na skladowe (do prezentacji w UI). */
export function parseChoiceSlotKey(
  key: string
): { profession: string; level: number; scheme: string } | null {
  const first = key.indexOf("|");
  const second = key.indexOf("|", first + 1);
  if (first < 0 || second < 0) return null;
  return {
    profession: key.slice(0, first),
    level: Number.parseInt(key.slice(first + 1, second), 10) || 1,
    scheme: key.slice(second + 1)
  };
}

/** Czy nazwa znajduje sie w slowniku (dokladnie lub po normalizacji); zwraca klucz. */
export function findOwnedName(
  owned: Record<string, unknown> | undefined,
  name: string
): string | null {
  return ownedKey(owned, name);
}

function ownedKey(owned: Record<string, unknown> | undefined, name: string): string | null {
  if (!owned) return null;
  if (name in owned) return name;
  const target = normalize(name);
  for (const key of Object.keys(owned)) if (normalize(key) === target) return key;
  return null;
}

/**
 * Rozstrzyga wpis schematu profesji. Wpis bez wyboru -> nazwa wprost. Wpis
 * wymagajacy specjalizacji -> zapamietany wybor postaci; dla "A albo B" takze
 * posiadana juz opcja (jednoznaczna). W przeciwnym razie zwraca otwarty slot.
 */
export function resolveSchemeEntry(
  profession: string,
  level: number,
  scheme: string,
  choices: ProfessionChoices = {},
  owned?: Record<string, unknown>
): { name: string; slot?: undefined } | { name?: undefined; slot: ChoiceSlot } {
  const info = parseSpecialization(scheme);
  if (!needsSpecialization(info)) return { name: scheme };
  const key = choiceSlotKey(profession, level, scheme);
  const chosen = choices[key];
  if (chosen) return { name: chosen };
  if (info.kind === "choice") {
    for (const opt of info.options) {
      const hit = ownedKey(owned, buildSpecializedName(info.base, opt));
      if (hit) return { name: hit };
    }
  }
  return {
    slot: { key, profession: resolveProfessionName(profession) ?? profession, level, scheme }
  };
}

/** Krok ścieżki kariery na potrzeby agregacji pul (profesja + osiągnięty poziom). */
export interface CareerPathPoolStep {
  profession?: string | null;
  level?: number | null;
}

/**
 * Agreguje elementy rozwijalne z CAŁEJ ścieżki kariery: cechy (kody), umiejętności
 * i talenty ze wszystkich poziomów wszystkich profesji (poziomy ≤ osiągnięty).
 * Służy do kryteriów ukończenia profesji liczonych przez całą ścieżkę. Wpisy
 * z wyborem ("(Dowolna)", "albo") zastępuje zapamiętanym wyborem postaci.
 */
export function careerPathPools(
  careerPath: CareerPathPoolStep[],
  choices: ProfessionChoices = {},
  ownedSkills?: Record<string, unknown>,
  ownedTalents?: Record<string, unknown>
): {
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
      // Nierozstrzygniety slot zostaje jako wpis ogolny (dopasowanie grupowe).
      for (const skillName of lvl.skills ?? []) {
        const r = resolveSchemeEntry(profName, lvlNum, skillName, choices, ownedSkills);
        pools.skills.add(r.name ?? skillName);
      }
      for (const talentName of lvl.talents ?? []) {
        const r = resolveSchemeEntry(profName, lvlNum, talentName, choices, ownedTalents);
        pools.talents.add(r.name ?? talentName);
      }
    }
  }
  return pools;
}

/**
 * Sprawdza kompletowanie profesji na danym poziomie (kryteria WFRP 4ed, s. 48).
 * Pula = TYLKO biezaca profesja: umiejetnosci i cechy z poziomow ≤ obecny,
 * talenty z obecnego poziomu. Rozwiniecia zliczane z istniejacych wartosci
 * (wliczaja sie te zdobyte przed rozpoczeciem profesji). Wpis "(Dowolna)" bez
 * zapamietanego wyboru nie zalicza przypadkowej umiejetnosci z grupy.
 * Próg = 5×poziom dla cech/umiejętności; talenty: co najmniej 1 posiadany z obecnego poziomu.
 */
export function isCareerCompleted(
  professionName: string,
  level: number,
  skills: Record<string, { advanced?: number }> = {},
  talents_: Record<string, { advances?: number }> = {},
  attributes: Record<string, { advanced?: number }> = {},
  choices: ProfessionChoices = {}
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

  // Pula elementów: wyłącznie bieżąca profesja.
  const pools = {
    characteristics: new Set<string>(),
    skills: new Set<string>(),
    talents: new Set<string>()
  };
  for (const lvl of prof.levels ?? []) {
    const lvlNum = lvl.level;
    if (lvlNum === null || lvlNum === undefined || lvlNum > level) continue;
    for (const charName of lvl.characteristics ?? []) {
      const code = characteristicToCode(charName);
      if (code) pools.characteristics.add(code);
    }
    for (const skillName of lvl.skills ?? []) {
      const r = resolveSchemeEntry(professionName, lvlNum, skillName, choices, skills);
      if (r.name !== undefined) pools.skills.add(r.name);
    }
    if (lvlNum !== level) continue;
    for (const talentName of lvl.talents ?? []) {
      const r = resolveSchemeEntry(professionName, lvlNum, talentName, choices, talents_);
      if (r.name !== undefined) pools.talents.add(r.name);
    }
  }

  const skillThreshold = 5 * level;
  let skillsDone = 0;
  for (const skillName of pools.skills) {
    const key = ownedKey(skills, skillName);
    const owned = key ? skills[key] : null;
    if (owned && (owned.advanced ?? 0) >= skillThreshold) {
      skillsDone += 1;
    }
  }
  result.skills_done = skillsDone;
  result.skills_ok = skillsDone >= 8;

  // Talenty: wystarczy posiadac co najmniej 1 talent z obecnego poziomu (s. 48).
  let talentsDone = 0;
  for (const talentName of pools.talents) {
    const key = ownedKey(talents_, talentName);
    const owned = key ? talents_[key] : null;
    if (owned && (owned.advances ?? 0) >= 1) {
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

/**
 * Zbiory elementow rozwijalnych "w profesji" dla danego poziomu.
 *
 * Wpisy z wyborem specjalizacji ("Wiedza (Dowolna)", "Muzyka (Bęben albo
 * Piszczałka)") sa zastepowane zapamietanym wyborem postaci (`choices`). Wpis
 * jeszcze nierozstrzygniety NIE trafia do zbioru (nie odblokowuje calej grupy) -
 * zamiast tego jest zwracany jako otwarty slot do wyboru (skillSlots/talentSlots).
 */
export function getCareerDevelopable(
  professionName: string | null,
  currentLevel: number,
  ownedTalents: Record<string, { advances?: number }> = {},
  choices: ProfessionChoices = {},
  ownedSkills?: Record<string, unknown>
): Developable {
  const result: Developable = {
    characteristics: new Set<string>(),
    skills: new Set<string>(),
    talents: new Set<string>(),
    resolved: false,
    skillSlots: [],
    talentSlots: []
  };
  const prof = professionName ? getProfession(professionName) : undefined;
  if (!prof || !professionName) return result;
  result.resolved = true;
  for (const lvl of prof.levels ?? []) {
    const lvlNum = lvl.level;
    if (lvlNum === null || lvlNum === undefined || lvlNum > currentLevel) continue;
    for (const charCode of lvl.characteristics ?? []) {
      const code = characteristicToCode(charCode);
      if (code) result.characteristics.add(code);
    }
    // Umiejetnosci: obecny poziom i wszystkie nizsze (zasady, str. 47).
    for (const skillName of lvl.skills ?? []) {
      const r = resolveSchemeEntry(professionName, lvlNum, skillName, choices, ownedSkills);
      if (r.name !== undefined) result.skills.add(r.name);
      else result.skillSlots.push(r.slot);
    }
    // Talenty: wylacznie obecny poziom (zasady, s. 48 - nizsze poziomy niedostepne).
    if (lvlNum !== currentLevel) continue;
    for (const talentName of lvl.talents ?? []) {
      const r = resolveSchemeEntry(professionName, lvlNum, talentName, choices, ownedTalents);
      if (r.name !== undefined) result.talents.add(r.name);
      else result.talentSlots.push(r.slot);
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
  if (developable.talents.has(talentName)) return true;
  const target = normalize(talentName);
  for (const name of developable.talents) if (normalize(name) === target) return true;
  return false;
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
