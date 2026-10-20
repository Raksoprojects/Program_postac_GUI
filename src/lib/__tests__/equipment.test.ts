/**
 * Bron i pancerz: katalog, obliczenia (Obrazenia, PP na lokacjach, Tarcza),
 * zapis w JSON i eksport na karte PDF.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PDFCheckBox, PDFDocument, PDFTextField } from "pdf-lib";
import { loadTestGameData } from "./loadData";
import { DataManager } from "../character";
import * as gd from "../gameData";
import {
  armourFromDef,
  armourPoints,
  damageLabel,
  damageValue,
  shieldValue,
  weaponFromDef,
  weaponSkill
} from "../equipment";

const here = dirname(fileURLToPath(import.meta.url));
const emptyPdf = resolve(here, "../../../public/data/empty_card.pdf");

beforeAll(loadTestGameData);

const weapon = (name: string) => {
  const c = gd.getWeaponsData();
  return c.melee[name] ? weaponFromDef(name, c.melee[name], "melee") : weaponFromDef(name, c.ranged[name], "ranged");
};
const armour = (name: string) => armourFromDef(name, gd.getWeaponsData().armour[name]);

describe("bron i pancerz: obliczenia", () => {
  it("Obrazenia z BS, umiejetnosc wg grupy", () => {
    const miecz = weapon("Miecz");
    expect(damageLabel(miecz)).toBe("+BS+4");
    expect(damageValue(miecz, 3)).toBe(7);
    expect(weaponSkill(miecz)).toBe("Broń Biała (Podstawowa)");
    expect(weaponSkill(weapon("Kusza"))).toBe("Broń Zasięgowa (Kusza)");
    expect(weapon("Kusza").reach).toMatch(/m$/);
  });

  it("PP sumuja sie na lokacjach tylko z zalozonych; Tarcza z broni przy sobie", () => {
    const kurta = armour("Skórzana kurta");
    const kolczuga = armour("Kolczuga");
    const helm = { ...armour("Hełm"), worn: false };
    const ap = armourPoints([kurta, kolczuga, helm]);
    expect(ap).toMatchObject({ korpus: 3, lreka: 3, preka: 3, glowa: 0, lnoga: 0 });
    expect(shieldValue([weapon("Miecz"), weapon("Tarcza")])).toBe(2);
    expect(shieldValue([{ ...weapon("Tarcza"), carried: false }])).toBe(0);
  });

  it("opisy Zalet i Wad (takze odmiana i liczba)", () => {
    expect(gd.equipmentQualityDescription("Tarcza 2")).not.toBe("");
    expect(gd.equipmentQualityDescription("Giętka")).not.toBe("");
    expect(gd.equipmentQualityDescription("Sieczna (1P)")).not.toBe("");
    expect(gd.equipmentQualityDescription("Giętkie")).not.toBe("");
    expect(gd.equipmentQualityDescription("Ogłuszający albo Przekłuwający")).toMatch(/^Ogłuszający: .+\nPrzekłuwający: /);
  });

  it("kazda Zaleta i Wada z katalogu ma opis", () => {
    const c = gd.getWeaponsData();
    const all = [...Object.values(c.melee), ...Object.values(c.ranged)].flatMap((w) => [...w.qualities, ...w.flaws]);
    all.push(...Object.values(c.armour).flatMap((a) => a.qualities));
    expect([...new Set(all)].filter((q) => !gd.equipmentQualityDescription(q))).toEqual([]);
  });

  it("zapis w pliku postaci (JSON round-trip)", () => {
    const dm = new DataManager();
    dm.createNewCharacter("Wojak");
    dm.weapons.push(weapon("Miecz"));
    dm.armour.push(armour("Kolczuga"));
    const dm2 = new DataManager();
    expect(dm2.fromDict(JSON.parse(JSON.stringify(dm.toDict())))).toBe(true);
    expect(dm2.weapons).toEqual(dm.weapons);
    expect(dm2.armour).toEqual(dm.armour);
  });
});

describe("pdf: bron i pancerz", () => {
  it.runIf(existsSync(emptyPdf))("wpisuje bron, pancerz, PP na lokacjach i Tarcze", async () => {
    const dm = new DataManager();
    dm.createNewCharacter("Wojak");
    dm.attributes.S = { ...dm.attributes.S, initial: 35, current: 35 };
    dm.attributes.Wt = { ...dm.attributes.Wt, initial: 42, current: 42 };
    dm.weapons.push(weapon("Miecz"), weapon("Tarcza"));
    dm.armour.push(armour("Kolczuga"), armour("Skórzany hełm"));

    const out = await dm.exportToPdf(new Uint8Array(readFileSync(emptyPdf)));
    const form = (await PDFDocument.load(out)).getForm();
    const field = (n: string) => form.getFields().find((x) => x.getName().normalize("NFC") === n.normalize("NFC"));
    const text = (n: string) => {
      const f = field(n);
      return f instanceof PDFTextField ? f.getText() ?? "" : "";
    };
    expect(text("NazwaBroń1")).toBe("Miecz");
    expect(text("ObrażBroni1")).toBe("+7");
    expect(text("KategoriaRow1")).toBe("Podstawowa");
    expect(text("NazwaRow1")).toBe("Kolczuga");
    expect(text("PP_Korpus")).toBe("2");
    expect(text("PP_BWt_Korpus")).toBe("6");
    expect(text("PP_Głowa")).toBe("1");
    expect(text("Tarcza")).toBe("2");
    const cb = field("NaSobiePanc1");
    expect(cb instanceof PDFCheckBox && cb.isChecked()).toBe(true);
  });
});
