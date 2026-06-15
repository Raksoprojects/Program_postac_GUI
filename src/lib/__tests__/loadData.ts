import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setGameData } from "../gameData";
import type { ClassesData, ProfessionsData, TalentsData } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "../../../public/data");

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), "utf-8")) as T;
}

/** Laduje kanoniczne dane gry z public/data do modulu gameData (dla testow). */
export function loadTestGameData(): void {
  setGameData({
    professions: readJson<ProfessionsData>("professions.json"),
    classes: readJson<ClassesData>("classes.json"),
    talents: readJson<TalentsData>("talents.json")
  });
}
