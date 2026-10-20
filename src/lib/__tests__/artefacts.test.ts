import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { artefactToText, categoryChoices, categoryList, rollArtefact } from "../artefacts";
import { DataManager } from "../character";
import { seedRng } from "../dice";
import * as gd from "../gameData";
import type { ArtefactsData, MagicItemsData, TreasuresData } from "../types";
import { loadTestGameData } from "./loadData";

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../public/data");
const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(dataDir, name), "utf-8")) as T;

beforeAll(() => {
  loadTestGameData();
  gd.setArtefactData({
    artefacts: readJson<ArtefactsData>("artefacts.json"),
    treasures: readJson<TreasuresData>("treasures.json"),
    magicItems: readJson<MagicItemsData>("magic_items.json")
  });
});

describe("generator przedmiotow magicznych", () => {
  it("kazda kategoria daje przedmiot z nazwa, opisem i zakleciami z bazy programu", () => {
    const spells = new Set(gd.getSpellsData().spells.map((s) => s.name));
    for (const { key } of categoryList()) {
      for (let seed = 1; seed <= 40; seed++) {
        const a = rollArtefact({ category: key }, seedRng(seed));
        expect(a.category, key).toBe(key);
        expect(a.name.length, key).toBeGreaterThan(2);
        expect(a.lines.length + a.runes.length, `${key}: ${a.name}`).toBeGreaterThan(0);
        for (const s of a.spells) expect(spells.has(s), s).toBe(true);
        if (a.wp !== undefined) expect(a.wp, `${key}: ${a.name}`).toBeGreaterThan(0);
        expect(artefactToText(a)).toContain(a.name);
      }
    }
  });

  it("bez klatw - nic przekletego", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const clean = rollArtefact({ allowCursed: false }, seedRng(seed));
      expect(clean.cursed, clean.name).toBe(false);
    }
  });

  it("tryb wlasny: wybrana pozycja kategorii", () => {
    for (const { key } of categoryList()) {
      const choices = categoryChoices(key);
      expect(choices.length, key).toBeGreaterThan(0);
      const last = choices[choices.length - 1];
      const a = rollArtefact({ category: key, item: last }, seedRng(3));
      expect(a.name + (a.base ?? ""), key).toContain(last.split(" (")[0]);
    }
  });

  it("przedmiot zapisuje sie w pliku postaci (JSON round-trip)", () => {
    const dm = new DataManager();
    const a = rollArtefact({ category: "bronie" }, seedRng(7));
    dm.magicItems.push(a);
    const dm2 = new DataManager();
    expect(dm2.fromDict(JSON.parse(JSON.stringify(dm.toDict())))).toBe(true);
    expect(dm2.magicItems).toEqual([a]);
  });
});
