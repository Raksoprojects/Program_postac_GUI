/** Wspolne typy danych gry i modelu postaci (port z Python). */

import type { Attribute } from "./rules";

// --- Statyczne dane gry (public/data/*.json) ---

/**
 * Wariant zasad (globalny przelacznik). "core" = Podrecznik podstawowy,
 * "pod_bronia" = aktualizacje z dodatku "Pod Bronia", "domowe" = Pelne Domowe
 * Zasady (start = Pod Bronia, potem modyfikowane recznie/w plikach domowych).
 */
export type Ruleset = "core" | "pod_bronia" | "domowe";

/** Grupa proweniencji wpisu (do filtra źródeł, niezależnego od wariantu). */
export type SourceGroup = "podstawka" | "oficjalny_dodatek" | "domowe";

/**
 * Preset filtra źródeł w UI (co widać przy wyborze profesji/talentów):
 *  - podstawka_dodatki: podstawka + oficjalne dodatki (domyślny),
 *  - podstawka: tylko podstawka,
 *  - wszystko: podstawka + dodatki + domowe,
 *  - domowe: tylko domowe.
 */
export type SourceFilter = "podstawka" | "podstawka_dodatki" | "wszystko" | "domowe";


/**
 * Bloki wariantow wpisu (talentu/profesji). Zawieraja TYLKO pola nadpisujace
 * baze; brak pola = wartosc z podrecznika podstawowego (fallback pole-po-polu).
 */
export interface EntryVariants<T> {
  pod_bronia?: Partial<T>;
  domowe?: Partial<T>;
}

export interface ProfessionLevel {
  level: number;
  title: string;
  status: string;
  characteristics: string[];
  skills: string[];
  talents: string[];
  trappings: string[];
  /** Umiejetnosci zarobkowe (oznaczone sufiksem "+" w danych; pkt 19). */
  earning_skills?: string[];
}

export interface Profession {
  races?: string[];
  characteristics_pending?: boolean;
  level1_marker_hint?: string;
  levels: ProfessionLevel[];
  class?: string;
  source?: string;
  page?: number | string;
  /** Warianty regul profesji (Pod Bronia / Domowe). Pola nadpisuja baze. */
  variants?: EntryVariants<Profession>;
  /** "Profesja zla" (Chaos, kultysci) - domyslnie ukryta, pokazywana osobno. */
  evil?: boolean;
}

export interface GameClass {
  description: string;
  careers: string[];
}

export type TalentMaxType = "none" | "fixed" | "characteristic" | "special";

export interface TalentMax {
  type: TalentMaxType;
  value?: number;
  attr?: string;
  attr_name?: string;
}

export interface Talent {
  max: TalentMax;
  max_raw?: string;
  tests?: string;
  description?: string;
  source?: string;
  /** Kod cechy, do ktorej talent dodaje staly bonus (pkt 22), np. "WW". */
  adds_characteristic?: string;
  /** Talent zwieksza Zywotnosc o Bonus z Wytrzymalosci (np. Twardziel). */
  wounds_toughness_bonus?: boolean;
  /** Warianty regul talentu (Pod Bronia / Domowe). Pola nadpisuja baze. */
  variants?: EntryVariants<Talent>;
}

export type ProfessionsData = Record<string, Profession>;
export type ClassesData = Record<string, GameClass>;
export type TalentsData = Record<string, Talent>;

/** Definicja umiejetnosci kanonicznej (public/data/skills.json). */
export interface SkillDef {
  name: string;
  /** Kod cechy wiodacej (WW, US, S, Wt, I, Zw, Zr, Int, SW, Ogd). */
  attr: string;
  /** Czy umiejetnosc grupowa wymagajaca specjalizacji "(...)". */
  grouped: boolean;
}

export type SkillsData = SkillDef[];

/** Wiersz tabeli losowych talentow rasowych (k100). */
export interface RandomTalentRow {
  min: number;
  max: number;
  name: string;
}

/** Definicja talentu rasowego (staly, wybor "albo", lub losowy). */
export type RaceTalent =
  | { type: "fixed"; name: string }
  | { type: "choice"; options: string[] }
  | { type: "random"; count: number };

/** Definicja rasy (public/data/races.json). */
export interface RaceDef {
  /** Zakres k100 w tabeli losowania rasy (wlacznie). */
  randomMin: number;
  randomMax: number;
  /** Bazowe wartosci cech dodawane do 2k10 (kod cechy -> baza). */
  characteristics: Record<string, number>;
  /** Czy bonus z Krzepy wlicza sie do Zywotnosci (Niziolek = false). */
  woundsIncludeStrength: boolean;
  /** Startowe Punkty Przeznaczenia (Los). */
  fate: number;
  /** Startowe Punkty Bohatera (Hart). */
  resilience: number;
  /** Dodatkowe punkty do rozdzielenia miedzy Los i Hart. */
  extraPoints: number;
  /** Szybkosc (ruch). */
  movement: number;
  /** Lista 12 umiejetnosci rasowych do wyboru (3x+5, 3x+3). */
  skills: string[];
  /** Talenty rasowe. */
  talents: RaceTalent[];
}

/** Komplet danych ras (public/data/races.json). */
export interface RacesData {
  randomTalentsTable: RandomTalentRow[];
  races: Record<string, RaceDef>;
}

/** Wiersz tabeli losowania profesji startowej (k100) dla pochodzenia. */
export interface StartingCareerRow {
  min: number;
  max: number;
  profession: string;
}

/**
 * Pochodzenie (lokacja startowa) danej rasy — modyfikuje wybory przy tworzeniu
 * postaci. Pola opcjonalne NADPISUJA odpowiedniki z definicji rasy; brak pola =
 * wartosc rasowa. Nowa tresc (dodatki), dostepna we wszystkich trybach zasad.
 */
export interface Origin {
  name: string;
  description?: string;
  source?: string;
  /** Override listy umiejetnosci rasowych do wyboru (3x+5, 3x+3). */
  skills?: string[];
  /** Override talentow rasowych. */
  talents?: RaceTalent[];
  /** Tabela losowania profesji startowej dla tego pochodzenia (opcjonalna). */
  startingCareers?: StartingCareerRow[];
}

/** Pochodzenia per rasa (public/data/origins.json). Klucz = nazwa rasy. */
export type OriginsData = Record<string, Origin[]>;

// --- Magia i modlitwy (spells.json, prayers.json) ---

/** Grupa tradycji wyznaczajaca zasady kosztu (petty/arcane/chaos). */
export type LoreGroup = "petty" | "arcane" | "chaos";

/** Tradycja magii (np. "Ognia", "Prosta", "Tajemna"). */
export interface LoreDef {
  label: string;
  wind: string | null;
  rule?: string;
  group: LoreGroup;
  /** Nazwy tradycji uzywane w specjalizacjach talentow (np. "Ogień"). */
  aliases: string[];
}

/** Zaklecie z bazy. */
export interface SpellDef {
  name: string;
  /** Klucz tradycji (LoreDef). */
  lore: string;
  /** Poziom Zaklecia (PZ). */
  cn: number;
  range: string;
  target: string;
  duration: string;
  description: string;
  source?: string;
  page?: number | string;
  /** Wymagane tradycje (np. elfie zaklecia laczace dwa Wiatry). */
  requires?: string[];
  winds?: string[];
}

export interface SpellsData {
  note?: string;
  lores: Record<string, LoreDef>;
  spells: SpellDef[];
}

/** Blogoslawienstwo albo Cud z bazy. */
export interface PrayerDef {
  name: string;
  /** Bostwo (dla cudow); blogoslawienstwa sa wspolne. */
  deity?: string | null;
  /** Aspekt bostwa (np. aspekty Ranalda). */
  aspect?: string;
  range: string;
  target: string;
  duration: string;
  description: string;
  source?: string;
}

export interface PrayersData {
  note?: string;
  /** Bostwo -> lista 6 blogoslawienstw i aliasy nazwy (odmiany, aspekty). */
  deities: Record<string, { blessings: string[]; aliases: string[] }>;
  blessings: PrayerDef[];
  miracles: PrayerDef[];
}

/** Zaklecie znane przez postac. */
export interface SpellEntry {
  name: string;
  lore: string;
  cn: number;
  range: string;
  target: string;
  duration: string;
  description: string;
  source?: string;
  /** Koszt zaplacony w PD (0 = darmowe). */
  cost: number;
  /** Dodane w biezacej sesji (niezatwierdzone - mozna cofnac ze zwrotem PD). */
  is_new: boolean;
  /** Wlasne zaklecie (spoza bazy). */
  is_custom?: boolean;
}

/** Cud znany przez postac. */
export interface MiracleEntry {
  name: string;
  deity: string;
  aspect?: string;
  range: string;
  target: string;
  duration: string;
  description: string;
  source?: string;
  cost: number;
  is_new: boolean;
  is_custom?: boolean;
}

// --- Modyfikatory postaci: mutacje, wampiryzm, dary itp. (modifiers.json) ---

/** Wartosc w katalogu modyfikatorow: liczba albo kosci, np. "k10", "-2k10". */
export type ModifierValue = number | string;

/** Kategoria katalogu modyfikatorow (np. mutacje fizyczne, przemiana w wampira). */
export interface ModifierCategory {
  id: string;
  label: string;
  source?: string;
  description?: string;
}

/** Wpis katalogu modyfikatorow (public/data/modifiers.json). */
export interface ModifierDef {
  name: string;
  /** Id kategorii (ModifierCategory.id). */
  category: string;
  /** Opis efektu (tekst z podrecznika). */
  effect?: string;
  source?: string;
  /** Zmiana wartosci cech (kod cechy -> wartosc lub kosci). */
  characteristics?: Record<string, ModifierValue>;
  /** Zmiana wartosci umiejetnosci (nazwa -> wartosc lub kosci). */
  skills?: Record<string, ModifierValue>;
  /** Gorny limit wartosci cechy (np. Ogłada najwyzej 5). */
  maxCharacteristics?: Record<string, number>;
  /** Zmiana Szybkosci / Zywotnosci / Przeznaczenia / Punktow Bohatera. */
  movement?: number;
  wounds?: number;
  fate?: number;
  resilience?: number;
  /** Punkty Pancerza (opisowo; wyswietlane w efekcie). */
  armour?: number;
  headArmour?: number;
  /** Zyskiwane Cechy Stworzen / talenty (opisowo). */
  traits?: string[];
  /** Czy losowac lokalizacje na ciele (tabela locations). */
  rollLocation?: boolean;
  /** Powaga mutacji (Mutant's Handbook): trywialna / pomniejsza / poważna. */
  severity?: string;
  /** Limit wykupien (np. Dary Krwi). */
  limit?: string;
  /** Zmienia rase postaci (np. przemiana w wampira -> "Wampir (Von Carstein)"). */
  race?: string;
}

/** Wiersz tabeli lokalizacji (k100). */
export interface ModifierLocationRow {
  min: number;
  max: number;
  name: string;
}

/** Komplet katalogu modyfikatorow (public/data/modifiers.json). */
export interface ModifiersData {
  note?: string;
  categories: ModifierCategory[];
  locations?: ModifierLocationRow[];
  entries: ModifierDef[];
}

/**
 * Modyfikator przypisany do postaci (mutacja, wampiryzm, klatwa, wlasny...).
 * Wartosci kosci sa juz rozstrzygniete na liczby. Nieaktywny modyfikator jest
 * pamietany, ale nie wplywa na wartosci postaci.
 */
export interface CharacterModifier {
  id: string;
  name: string;
  /** Etykieta kategorii (czytelna, niezalezna od zmian katalogu). */
  category: string;
  description: string;
  source?: string;
  active: boolean;
  /** Zmiana wartosci cech (kod cechy -> liczba). */
  characteristics: Record<string, number>;
  /** Zmiana wartosci umiejetnosci (nazwa -> liczba). */
  skills?: Record<string, number>;
  /** Gorny limit wartosci cech (kod -> maks.). */
  maxCharacteristics?: Record<string, number>;
  movement?: number;
  wounds?: number;
  fate?: number;
  resilience?: number;
  /** Wylosowana/wybrana lokalizacja na ciele. */
  location?: string;
  /** Rasa ustawiana przez aktywny modyfikator (np. "Wampir (Lahmianin)"). */
  race?: string;
  /** Rasa sprzed zmiany (przywracana po wylaczeniu/usunieciu modyfikatora). */
  prevRace?: string;
}

/** Dane wejsciowe kreatora rasowego (Krok 1 + 3 + rasowe umiej./talenty). */
export interface RaceCreationInput {
  name: string;
  race: string;
  /** Plec - forma nazw profesji (opcjonalna). */
  sex?: Sex;
  /** Finalne wartosci cech (kod cechy -> wartosc). */
  characteristics: Record<string, number>;
  /** Punkty Przeznaczenia po rozdzieleniu. */
  fate: number;
  /** Punkty Bohatera po rozdzieleniu. */
  resilience: number;
  /** Zywotnosc wyliczona z bonusow cech. */
  wounds: number;
  /** Szybkosc (ruch) rasy. */
  movement: number;
  /** 3 umiejetnosci rasowe rozwijane o +5. */
  skillsPlus5: string[];
  /** 3 umiejetnosci rasowe rozwijane o +3. */
  skillsPlus3: string[];
  /** Wybrane/wylosowane talenty rasowe. */
  talents: string[];
  /** Bonusowe PD (akceptacja losowanej rasy i cech). */
  experience: number;
}

// --- Model postaci (port z core/character.py DataManager) ---

export interface AttributeEntry {
  initial: number;
  advanced: number;
  current: number;
  base_advanced: number;
  is_new: boolean;
  profession_available: boolean;
}

export interface SkillEntry {
  attribute: string;
  initial: number;
  advanced: number;
  current: number;
  base_advanced: number;
  is_new: boolean;
  profession_available: boolean;
}

export interface TalentEntry {
  advances: number;
  base_advances: number;
  description: string;
  max: TalentMax & { code?: string };
  tests: string;
  source: string;
  is_new: boolean;
  is_custom: boolean;
  profession_available: boolean;
  /** Wybrany staly bonus do cechy z talentu +cecha (pkt 22). */
  characteristicBonus?: { code: string; value: number };
}

export interface ExperienceState {
  available: number;
  spent: number;
  total: number;
}

/**
 * Drugorzedne wartosci postaci (Krok 3 tworzenia): Zywotnosc, Szybkosc oraz
 * pule punktow Przeznaczenia/Szczescia/Bohatera/Determinacji i Motywacja.
 * Odwzorowuja pola karty PDF.
 */
export interface CharacterStats {
  /** Zywotnosc (BS + 2xBWt + BSW; niziolek bez BS). */
  wounds: number;
  /** Szybkosc (ruch). Chod = 2x, Bieg = 4x. */
  movement: number;
  /** Punkty Przeznaczenia. */
  fate: number;
  /** Punkty Szczescia (startowo = Przeznaczenie). */
  fortune: number;
  /** Punkty Bohatera. */
  resilience: number;
  /** Punkty Determinacji (startowo = Bohatera). */
  resolve: number;
  /** Motywacja (tekst). */
  motivation: string;
}

export interface CareerPathStep {
  title: string;
  profession: string | null;
  level: number | null;
  resolved: boolean;
  completed?: boolean;
}

/**
 * Nierozstrzygniety wpis schematu profesji wymagajacy wyboru specjalizacji,
 * np. "Wiedza (Dowolna)" albo "Muzyka (Bęben albo Piszczałka)".
 */
export interface ChoiceSlot {
  /** Klucz zapamietanego wyboru (profesja|poziom|wpis). */
  key: string;
  profession: string;
  level: number;
  /** Oryginalny wpis ze schematu profesji. */
  scheme: string;
}

/** Zbiory elementow rozwijalnych "w profesji". */
export interface Developable {
  characteristics: Set<string>;
  skills: Set<string>;
  talents: Set<string>;
  resolved: boolean;
  /** Wpisy umiejetnosci czekajace na wybor specjalizacji. */
  skillSlots: ChoiceSlot[];
  /** Wpisy talentow (obecnego poziomu) czekajace na wybor specjalizacji. */
  talentSlots: ChoiceSlot[];
}

/** Wynik sprawdzenia kompletowania profesji. */
export interface CareerCompletion {
  completed: boolean;
  skills_ok: boolean;
  talents_ok: boolean;
  characteristics_ok: boolean;
  skills_done: number;
  talents_done: number;
  characteristics_pending: boolean;
}

// ---------------------------------------------------------------------------
// Generator przedmiotow magicznych (artefacts.json, treasures.json, magic_items.json
// - dane przeniesione z Generatora BN; tylko pola uzywane przez generator).
// ---------------------------------------------------------------------------

/** Wiersz tabeli k100 (min-max) z opcjonalnymi zasadami dla generatora. */
export interface TableRow {
  min: number;
  max: number;
  name: string;
  text?: string;
  cursed?: boolean;
  /** Przeklety wynik: rzuc jeszcze raz w tej tabeli, by ustalic moc. */
  reroll?: boolean;
  /** Wyniki, przy ktorych przeklety przedmiot ma tez dobroczynna moc (mikstury 99-100). */
  rerollOn?: number[];
  /** Dodatkowe rzuty generatora: species, attack, spell, powerStone... */
  rolls?: string[];
  runes?: "weapon" | "armour" | "talisman";
  noWp?: boolean;
  wp?: string | number;
  duration?: string;
  ingredients?: string;
  noEffect?: boolean;
  twice?: boolean;
  thrice?: boolean;
  flaw?: boolean;
  major?: boolean;
  permanentMinor?: boolean;
  lores?: string[];
  count?: number | string;
  wpDice?: string;
  ap?: number;
  qualities?: string[];
  column?: string;
  dice?: string;
  value?: number;
  /** Podtabela k10 rodzaju broni: [od, do, nazwa]. */
  d10?: [number, number, string][];
  ranged?: boolean;
  special?: "silver" | "runes" | "chaos" | "daemon";
  klauser?: number;
  regular?: number;
  master?: number;
  death?: boolean;
  thrown?: boolean;
}

export interface WeaponAbility {
  name: string;
  text: string;
  melee?: [number, number];
  ranged?: [number, number];
  cursed?: boolean;
  rolls?: string[];
}

export interface RenownedItem {
  name: string;
  wp: number | null;
  value: string;
  enc: number;
  availability: string;
  text: string;
}

export interface ArtefactCategory {
  name: string;
  wp?: string;
  limit?: string;
  intro?: string;
  /** Rzut w ogolnej tabeli Zalet i Wad przedmiotow magicznych. */
  itemQualities?: boolean;
  items?: TableRow[];
  kinds?: TableRow[];
  columns?: Record<string, TableRow[]>;
  powers?: Record<string, { text: string; cursed?: boolean; rolls?: string[] }>;
  pieces?: TableRow[];
  enchantmentCount?: TableRow[];
  protection?: TableRow[];
  enchantments?: TableRow[];
  wizardry?: TableRow[];
  types?: TableRow[];
  abilityCount?: TableRow[];
  abilities?: WeaponAbility[];
  might?: TableRow[];
  silver?: string;
  chaos?: string;
  daemon?: string;
  renowned?: RenownedItem[];
}

export interface ArtefactsData {
  note: string;
  source: string;
  categoryTable: TableRow[];
  categories: Record<string, ArtefactCategory>;
  tables: {
    characteristic: string[];
    species: TableRow[];
    attackProtection: TableRow[];
    spellLore: TableRow[];
    powerStones: TableRow[];
    blessings: TableRow[];
    qualities: { qualities: TableRow[]; flaws: TableRow[] };
    weaponQualities: { qualities: TableRow[]; flaws: TableRow[] };
    charArmour: TableRow[];
    charWeapon: TableRow[];
    minorCurses: TableRow[];
    majorCurses: TableRow[];
  };
  klauser: { intro: string; armour: TableRow[]; weapon: TableRow[]; death: TableRow[] };
  runeCount: TableRow[];
}

export interface RuneDef {
  name: string;
  sl: number;
  effect: string;
  page: number;
  master?: boolean;
}

export interface ChaosPropertyDef {
  name: string;
  god: string;
  effect: string;
  page: number;
}

/** Szablon przedmiotu magicznego z podrecznikow (treasures.json). */
export interface TreasureDef {
  name: string;
  kind: "weapon" | "armour" | "item" | "potion";
  description: string;
  source: string;
  page?: number;
  runes?: "weapon" | "armour" | "talisman";
  chaos?: [number, number];
  daemon?: boolean;
  cursed?: boolean;
}

/** treasures.json - uzywane czesci (runy, Bron Chaosu, demony, szablony). */
export interface TreasuresData {
  runes: Record<"weapon" | "armour" | "talisman", RuneDef[]>;
  chaosProperties: ChaosPropertyDef[];
  daemons: Record<string, Record<"lesser" | "greater", { name: string; benefit: string }>>;
  items: TreasureDef[];
}

/** Przedmiot magiczny z podrecznikow (Wiatry Magii: kostury, szaty, zwoje...). */
export interface MagicItem {
  name: string;
  description: string;
  scroll?: boolean;
  source?: string;
  page?: number;
}

export interface MagicItemsData {
  items: MagicItem[];
}

/** Imiona wg rasy (names.json z Generatora BN). */
export interface NameTable {
  male: string[];
  female: string[];
  surnames: string[];
}

export type NamesData = Record<string, NameTable | string[]>;

// ---------------------------------------------------------------------------
// Bron i pancerz (weapons.json - kopia z Generatora BN)
// ---------------------------------------------------------------------------

export interface WeaponDef {
  group: string;
  hands?: string;
  damage: number;
  /** Obrazenia + Bonus z Sily. */
  sb: boolean;
  /** Dlugosc broni bialej (np. "Średnia"). */
  reach?: string;
  /** Zasieg broni zasiegowej w metrach (tekst). */
  range?: string;
  twoHanded?: boolean;
  qualities: string[];
  flaws: string[];
  note?: string;
  enc?: string;
  availability?: string;
  /** Wartosc Tarczy (PP do obrony). */
  shield?: number;
  source?: string;
  page?: number;
}

export interface ArmourDef {
  type: string;
  /** "głowa", "ramiona", "korpus", "nogi". */
  locations: string[];
  ap: number;
  qualities: string[];
  penalty?: string;
}

export interface WeaponsData {
  melee: Record<string, WeaponDef>;
  ranged: Record<string, WeaponDef>;
  armour: Record<string, ArmourDef>;
  /** Opisy Zalet i Wad broni/pancerza. */
  qualities: Record<string, string>;
}

/** Bron postaci (kopia z katalogu albo wlasna). */
export interface CharWeapon {
  name: string;
  kind: "melee" | "ranged";
  group: string;
  damage: number;
  sb: boolean;
  /** Dlugosc (bron biala) albo zasieg (zasiegowa). */
  reach: string;
  qualities: string[];
  flaws: string[];
  enc: string;
  shield?: number;
  /** Przy sobie (karta PDF). */
  carried: boolean;
  note?: string;
}

/** Element pancerza postaci. */
export interface CharArmour {
  name: string;
  locations: string[];
  ap: number;
  qualities: string[];
  enc: string;
  /** Zalozony - liczy sie do PP. */
  worn: boolean;
  penalty?: string;
}

/** Plec postaci: forma nazw profesji (M = meska, K = zenska). */
export type Sex = "M" | "K";

/** Formy [meska, zenska] nazw profesji i tytulow poziomow (klucz tytulu "Profesja|poziom"). */
export interface ProfessionTitlesData {
  professions: Record<string, [string, string]>;
  titles: Record<string, [string, string]>;
}

export type { Attribute };
