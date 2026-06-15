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

    const out = await writePdfCharacterData(
      bytes,
      {
        character_name: "Round Trip",
        attributes: extracted.attributes,
        skills: extracted.skills,
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
  });

  it.runIf(hasEmpty)("eksportuje nowa postac na pustym szablonie", async () => {
    const dm = new DataManager();
    dm.createNewCharacter("Świeża Postać");
    dm.attributes.WW.advanced = 10;
    dm.attributes.WW.current = 40;

    const template = new Uint8Array(readFileSync(emptyPdf));
    const out = await dm.exportToPdf(template);
    expect(out.byteLength).toBeGreaterThan(0);

    const reread = await extractPdfCharacterData(out);
    expect(reread.attributes.WW.advanced).toBe(10);
  });
});
