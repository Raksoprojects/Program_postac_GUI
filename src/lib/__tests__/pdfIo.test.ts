import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadTestGameData } from "./loadData";
import { DataManager, FILE_TYPE_PDF } from "../character";
import {
  extractPdfCharacterData,
  writePdfCharacterData
} from "../pdfIo";

const here = dirname(fileURLToPath(import.meta.url));
const samplePdf = resolve(here, "../../../Program Python/Rein_Nuhr_lepsza_4ed.pdf");
const emptyPdf = resolve(here, "../../../public/data/empty_card.pdf");

const hasSample = existsSync(samplePdf);
const hasEmpty = existsSync(emptyPdf);

beforeAll(() => {
  loadTestGameData();
});

describe("pdfIo: import z formularza PDF", () => {
  it.runIf(hasSample)("wczytuje cechy, umiejetnosci i talenty", async () => {
    const bytes = new Uint8Array(readFileSync(samplePdf));
    const result = await extractPdfCharacterData(bytes);

    // 10 cech, kazda z initial/advanced/current
    expect(Object.keys(result.attributes).length).toBe(10);
    for (const code of Object.keys(result.attributes)) {
      const a = result.attributes[code];
      expect(typeof a.initial).toBe("number");
      expect(typeof a.advanced).toBe("number");
      expect(typeof a.current).toBe("number");
    }

    // Doswiadczenie ma trzy pola liczbowe
    expect(typeof result.experience.available).toBe("number");
    expect(typeof result.experience.spent).toBe("number");
    expect(typeof result.experience.total).toBe("number");

    // Mapowanie pol jest spojne z odczytem
    expect(result.pdf_mapping.attributes).toBeDefined();
    expect(Object.keys(result.pdf_mapping.attributes).length).toBe(10);
  });
});

describe("character.loadFromPdf", () => {
  it.runIf(hasSample)("ustawia zrodlo PDF i wzbogaca talenty", async () => {
    const dm = new DataManager();
    const bytes = new Uint8Array(readFileSync(samplePdf));
    const ok = await dm.loadFromPdf(bytes);

    expect(ok).toBe(true);
    expect(dm.sourceType).toBe(FILE_TYPE_PDF);
    expect(Object.keys(dm.attributes).length).toBe(10);
    expect(dm.pdfSourceBytes).not.toBeNull();
    expect(dm.pdfMappingTyped).not.toBeNull();
  });
});

describe("pdfIo: eksport (round-trip)", () => {
  it.runIf(hasSample)("zapisuje zmienione cechy do PDF i odczytuje je z powrotem", async () => {
    const bytes = new Uint8Array(readFileSync(samplePdf));
    const extracted = await extractPdfCharacterData(bytes);

    // Modyfikujemy jedna ceche i zapisujemy
    extracted.attributes.WW.advanced += 5;
    extracted.attributes.WW.current = extracted.attributes.WW.initial + extracted.attributes.WW.advanced;

    // Modyfikujemy drugorzedne statystyki (Zywotnosc, pule punktow).
    const stats = {
      ...extracted.stats,
      wounds: 17,
      movement: 4,
      fate: 2,
      fortune: 3,
      resilience: 1,
      resolve: 1,
      motivation: "Zemsta"
    };

    const out = await writePdfCharacterData(
      bytes,
      {
        character_name: "Round Trip",
        attributes: extracted.attributes,
        skills: extracted.skills,
        stats,
        talents: Object.fromEntries(
          Object.entries(extracted.talents).map(([n, t]) => [
            n,
            { advances: t.advances, description: t.description }
          ])
        ),
        experience: extracted.experience,
        profession: {}
      },
      extracted.pdf_mapping
    );

    expect(out.byteLength).toBeGreaterThan(0);

    const reread = await extractPdfCharacterData(out);
    expect(reread.attributes.WW.advanced).toBe(extracted.attributes.WW.advanced);
    expect(reread.stats.wounds).toBe(17);
    expect(reread.stats.fate).toBe(2);
    expect(reread.stats.resilience).toBe(1);
    expect(reread.stats.motivation).toBe("Zemsta");
  });

  it.runIf(hasEmpty)("eksportuje nowa postac na pustym szablonie", async () => {
    const dm = new DataManager();
    dm.createNewCharacter("Świeża Postać");
    dm.attributes.WW.advanced = 10;
    dm.attributes.WW.current = 40;
    dm.stats.wounds = 14;
    dm.stats.movement = 4;
    dm.stats.fate = 2;
    dm.stats.resilience = 1;
    dm.stats.motivation = "Chwała";

    const template = new Uint8Array(readFileSync(emptyPdf));
    const out = await dm.exportToPdf(template);
    expect(out.byteLength).toBeGreaterThan(0);

    const reread = await extractPdfCharacterData(out);
    expect(reread.attributes.WW.advanced).toBe(10);
    expect(reread.stats.wounds).toBe(14);
    expect(reread.stats.movement).toBe(4);
    expect(reread.stats.fate).toBe(2);
    expect(reread.stats.resilience).toBe(1);
    expect(reread.stats.motivation).toBe("Chwała");
  });

  it.runIf(hasSample)("dopisuje NOWA umiejetnosc do wolnego wiersza (round-trip)", async () => {
    const bytes = new Uint8Array(readFileSync(samplePdf));
    const extracted = await extractPdfCharacterData(bytes);
    // Karta musi miec co najmniej jeden wolny wiersz zaawansowany.
    expect(extracted.pdf_mapping.skills_free.length).toBeGreaterThan(0);

    const newName = "Wiedza (Testowa Faza F)";
    const skills = {
      ...extracted.skills,
      [newName]: {
        attribute: "Int",
        initial: 30,
        advanced: 7,
        current: 37,
        base_advanced: 7,
        is_new: true,
        profession_available: true
      }
    };

    const out = await writePdfCharacterData(
      bytes,
      {
        character_name: "Free Row",
        attributes: extracted.attributes,
        skills,
        stats: extracted.stats,
        talents: {},
        experience: extracted.experience,
        profession: {}
      },
      extracted.pdf_mapping
    );

    const reread = await extractPdfCharacterData(out);
    expect(reread.skills[newName]).toBeDefined();
    expect(reread.skills[newName].advanced).toBe(7);
    expect(reread.skills[newName].current).toBe(37);
    expect(reread.skills[newName].attribute).toBe("Int");
    // Rozwijalnosc nowej umiejetnosci trafia na checkbox jej wiersza.
    expect(reread.skills[newName].profession_available).toBe(true);
  });

  it.runIf(hasSample)("zapisuje checkboxy rozwijalnosci cech i umiejetnosci (round-trip)", async () => {
    const bytes = new Uint8Array(readFileSync(samplePdf));
    const extracted = await extractPdfCharacterData(bytes);

    extracted.attributes.WW.profession_available = true;
    extracted.attributes.S.profession_available = false;
    // Pierwsza umiejetnosc podstawowa na karcie to Atletyka.
    expect(extracted.skills["Atletyka"]).toBeDefined();
    extracted.skills["Atletyka"].profession_available = true;

    const out = await writePdfCharacterData(
      bytes,
      {
        character_name: "Checkbox",
        attributes: extracted.attributes,
        skills: extracted.skills,
        stats: extracted.stats,
        talents: {},
        experience: extracted.experience,
        profession: {}
      },
      extracted.pdf_mapping
    );

    const reread = await extractPdfCharacterData(out);
    expect(reread.attributes.WW.profession_available).toBe(true);
    expect(reread.attributes.S.profession_available).toBe(false);
    expect(reread.skills["Atletyka"].profession_available).toBe(true);
  });
});
