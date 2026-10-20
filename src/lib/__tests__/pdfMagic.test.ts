/**
 * Eksport PDF: zaklecia/cuda/blogoslawienstwa w tabeli zaklec karty oraz
 * mutacje i dary jako podpisane wiersze talentow + pole "Mutacje".
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PDFDocument, PDFTextField } from "pdf-lib";
import { loadTestGameData } from "./loadData";
import { DataManager } from "../character";
import * as gd from "../gameData";

const here = dirname(fileURLToPath(import.meta.url));
const emptyPdf = resolve(here, "../../../public/data/empty_card.pdf");

beforeAll(() => {
  loadTestGameData();
});

describe("pdf: zaklecia i mutacje", () => {
  it.runIf(existsSync(emptyPdf))("zapisuje tabele zaklec, wiersze mutacji i pole Mutacje", async () => {
    const dm = new DataManager();
    dm.createNewCharacter("Mag");
    const s = gd.getSpellsData().spells.find((x) => x.lore === "Ognia")!;
    dm.spells[s.name] = { ...s, cost: 100, is_new: false };
    dm.addTalent("Błogosławieństwo (Morr)", 1, "", null, null, "Lista", false, false);
    dm.addModifier({
      id: "m", name: "Kły", category: "Mutacje fizyczne (Mutant's Handbook)",
      description: "Zyskujesz Cechę Ugryzienie.", active: true, characteristics: { Ogd: -5 }
    });

    const out = await dm.exportToPdf(new Uint8Array(readFileSync(emptyPdf)));
    const doc = await PDFDocument.load(out);
    const form = doc.getForm();
    const text = (n: string) => {
      const f = form.getFields().find((x) => x.getName() === n);
      return f instanceof PDFTextField ? f.getText() ?? "" : "";
    };
    const spellNames = form.getFields()
      .filter((f) => /^NazwCzaru\d+$/.test(f.getName()))
      .map((f) => text(f.getName()))
      .filter(Boolean);
    expect(spellNames).toContain(s.name);
    expect(spellNames.filter((n) => n.startsWith("Błogosławieństwo"))).toHaveLength(6);
    expect(text("Mutacje")).toBe("Kły");
    const talentNames = form.getFields()
      .filter((f) => /talent\W*namerow/i.test(f.getName()))
      .map((f) => text(f.getName()));
    expect(talentNames).toContain("Mutacja: Kły");
  });
});
