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
  species?: string[];
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
