import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ProfessionsData, SkillsData, TalentsData } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../../../public/data");
const readJson = <T,>(name: string): T =>
  JSON.parse(readFileSync(resolve(dataDir, name), "utf-8")) as T;

const norm = (s: unknown): string =>
  String(s ?? "")
    .replace(/\+\s*$/, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(" ");
const base = (s: string): string => norm(String(s).split("(")[0]);

const CHAR_NAMES = new Set(
  [
    "walka wręcz",
    "umiejętności strzeleckie",
    "siła",
    "wytrzymałość",
    "inicjatywa",
    "zwinność",
    "zręczność",
    "inteligencja",
    "siła woli",
    "ogłada"
  ].map(norm)
);

describe("spojnosc danych: professions.json vs skills/talents (Faza I, pkt 20)", () => {
  const professions = readJson<ProfessionsData>("professions.json");
  const skills = readJson<SkillsData>("skills.json");
  const talents = readJson<TalentsData>("talents.json");

  const skillNames = new Set(skills.map((s) => norm(s.name)));
  const skillBases = new Set(skills.map((s) => base(s.name)));
  const talentKeys = new Set(Object.keys(talents).map(norm));
  const talentBases = new Set(Object.keys(talents).map(base));

  const skillOk = (name: string): boolean =>
    skillNames.has(norm(name)) || skillBases.has(base(name));
  const talentOk = (name: string): boolean =>
    talentKeys.has(norm(name)) || talentBases.has(base(name));

  const missingSkills: string[] = [];
  const missingTalents: string[] = [];
  const unknownChars: string[] = [];

  for (const [prof, data] of Object.entries(professions)) {
    for (const lvl of data.levels ?? []) {
      const ctx = `${prof} L${lvl.level}`;
      for (const s of lvl.skills ?? []) {
        if (!skillOk(s)) missingSkills.push(`${ctx}: ${s}`);
      }
      for (const t of lvl.talents ?? []) {
        if (!talentOk(t)) missingTalents.push(`${ctx}: ${t}`);
      }
      for (const c of lvl.characteristics ?? []) {
        if (!CHAR_NAMES.has(norm(c))) unknownChars.push(`${ctx}: ${c}`);
      }
    }
  }

  it("kazda umiejetnosc profesji ma odpowiednik w skills.json", () => {
    expect(missingSkills).toEqual([]);
  });

  it("kazdy talent profesji ma odpowiednik w talents.json", () => {
    expect(missingTalents).toEqual([]);
  });

  it("kazda cecha profesji jest rozpoznana", () => {
    expect(unknownChars).toEqual([]);
  });
});
