/** Wspolne typy danych gry i modelu postaci (port z Python). */

import type { Attribute } from "./rules";

// --- Statyczne dane gry (public/data/*.json) ---

export interface ProfessionLevel {
  level: number;
  title: string;
  status: string;
  characteristics: string[];
  skills: string[];
  talents: string[];
  trappings: string[];
}

export interface Profession {
  races?: string[];
  characteristics_pending?: boolean;
  level1_marker_hint?: string;
  levels: ProfessionLevel[];
  class?: string;
  source?: string;
  page?: number | string;
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

/** Dane wejsciowe kreatora rasowego (Krok 1 + 3 + rasowe umiej./talenty). */
export interface RaceCreationInput {
  name: string;
  race: string;
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

/** Zbiory elementow rozwijalnych "w profesji". */
export interface Developable {
  characteristics: Set<string>;
  skills: Set<string>;
  talents: Set<string>;
  resolved: boolean;
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

export type { Attribute };
