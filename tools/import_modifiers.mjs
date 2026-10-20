/**
 * Buduje public/data/modifiers.json (katalog modyfikatorow postaci: mutacje,
 * wampiryzm, Dary Chaosu/Krwi, profile bohaterow) z danych Generatora BN
 * (../Generator_NPC/public/data) - opis zasad: Generator_NPC/BAZA_WIEDZY_GENERATORA.md.
 *
 * Uzycie (z katalogu glownego projektu):
 *   node tools/import_modifiers.mjs [sciezka/do/Generator_NPC/public/data]
 *
 * Wynikowy plik jest kanonicznym zrodlem danych tej aplikacji - mozna go dalej
 * edytowac recznie (ponowny import nadpisze zmiany).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const srcDir = resolve(process.argv[2] ?? resolve(root, "../Generator_NPC/public/data"));
const outFile = resolve(root, "public/data/modifiers.json");

const read = (name) => JSON.parse(readFileSync(resolve(srcDir, name), "utf-8"));
const mutations = read("mutations.json");
const vampires = read("vampires.json");
const heroProfiles = read("hero_profiles.json");

const SEVERITY = { trivial: "trywialna", minor: "pomniejsza", major: "poważna" };

const categories = [
  {
    id: "spaczenie_fizyczne",
    label: "Mutacje fizyczne (Tabela Spaczenia Fizycznego)",
    source: "Podręcznik podstawowy"
  },
  {
    id: "zepsucie_psychiczne",
    label: "Mutacje psychiczne (Tabela Zepsucia Psychicznego)",
    source: "Podręcznik podstawowy"
  },
  {
    id: "mh_fizyczne",
    label: "Mutacje fizyczne (Mutant's Handbook)",
    source: "The Mutant's Handbook (nieoficjalny)",
    description: "Tabele wg powagi: trywialne, pomniejsze, poważne."
  },
  {
    id: "mh_psychiczne",
    label: "Mutacje psychiczne (Mutant's Handbook)",
    source: "The Mutant's Handbook (nieoficjalny)",
    description: "Tabele wg powagi: trywialne, pomniejsze, poważne."
  },
  {
    id: "dary_chaosu",
    label: "Dary Chaosu (Oko Bogów)",
    source: "Warriors of Chaos (nieoficjalny)"
  },
  {
    id: "wampiryzm",
    label: "Wampiryzm — przemiana (Krwawy Pocałunek)",
    source: "Domowe",
    description:
      "Premie do Cech wg Linii Krwi dla postaci przemienionej Krwawym Pocałunkiem (zasady domowe)."
  },
  {
    id: "dary_krwi",
    label: "Dary Krwi (wampiry)",
    source: "Wampiry"
  },
  {
    id: "slabosci_wampira",
    label: "Słabości wampira",
    source: "Wampiry"
  },
  {
    id: "profile_bohatera",
    label: "Profile bohatera (Bestiariusz 2.0)",
    source: "Bestiariusz 2.0",
    description: "Wyjątkowe jednostki — dodatki do Cech dla BN/stworzeń."
  }
];

/** Wiersz tabeli mutacji Generatora -> wpis katalogu. */
function fromMutationRow(row, category, source, severity) {
  const e = { name: row.name, category, effect: row.effect ?? "", source };
  if (row.modifiers && Object.keys(row.modifiers).length) e.characteristics = row.modifiers;
  if (row.skills && Object.keys(row.skills).length) e.skills = row.skills;
  if (row.maxChar && Object.keys(row.maxChar).length) e.maxCharacteristics = row.maxChar;
  if (row.movement) e.movement = row.movement;
  if (row.wounds) e.wounds = row.wounds;
  if (row.armour) e.armour = row.armour;
  if (row.headArmour) e.headArmour = row.headArmour;
  if (row.trait) e.traits = [row.trait];
  if (row.rollLocation) e.rollLocation = true;
  if (severity) e.severity = severity;
  return e;
}

const entries = [];

for (const row of mutations.physical ?? []) {
  entries.push(fromMutationRow(row, "spaczenie_fizyczne", "Podręcznik podstawowy"));
}
for (const row of mutations.mental ?? []) {
  entries.push(fromMutationRow(row, "zepsucie_psychiczne", "Podręcznik podstawowy"));
}
for (const [kind, category] of [
  ["physical", "mh_fizyczne"],
  ["mental", "mh_psychiczne"]
]) {
  for (const [table, rows] of Object.entries(mutations.handbook?.[kind] ?? {})) {
    for (const row of rows) {
      if (row.reroll) continue; // "Rzuć na tabelę ..." - nie jest mutacja
      entries.push(
        fromMutationRow(row, category, "The Mutant's Handbook (nieoficjalny)", SEVERITY[table] ?? table)
      );
    }
  }
}
for (const row of mutations.chaosGifts?.rows ?? []) {
  entries.push(fromMutationRow(row, "dary_chaosu", "Warriors of Chaos (nieoficjalny)"));
}

// Oficjalna tabela przemiany (Wampiry, s. 14): wszystkie linie Przeznaczenie -1,
// Punkty Bohatera +1, Szybkosc +2 (Niezalezny +1).
const OFFICIAL_TURNING = {
  "Von Carstein": { WW: 10, S: 20, Wt: 10, I: 10, Zw: 10, Zr: 10, SW: 20, Ogd: 10 },
  Lahmianin: { WW: 10, S: 10, Wt: 10, I: 10, Zw: 10, Zr: 10, SW: 20, Ogd: 20 },
  "Krwawy Smok": { WW: 20, S: 20, Wt: 10, I: 10, Zw: 10, Zr: 10, SW: 10, Ogd: 10 },
  Nekrarcha: { WW: 10, S: 10, Wt: 10, I: 10, Zr: 10, Int: 20, SW: 20, Ogd: -20 },
  Strigoi: { WW: 10, S: 20, Wt: 10, I: 10, Zw: 20, Zr: 10, Int: 10, SW: 10, Ogd: -20 },
  "Niezależny": { WW: 10, S: 10, Wt: 10, I: 10, Zw: 10, Zr: 10, SW: 20, Ogd: 10 }
};

const turningOrder = ["Von Carstein", "Lahmianin", "Krwawy Smok", "Nekrarcha", "Strigoi", "Niezależny"];
const bloodlines = Object.fromEntries((vampires.bloodlines ?? []).map((b) => [b.name, b]));
for (const name of turningOrder) {
  const b = bloodlines[name];
  const movement = name === "Niezależny" ? 1 : 2;
  const flavour = b?.effect ? ` ${b.effect}` : "";
  const extras = [];
  if (b?.turning?.skills?.length) extras.push(`Umiejętności linii (3×+5, 3×+3): ${b.turning.skills.join(", ")}.`);
  if (b?.turning?.talents?.length) extras.push(`Talenty linii: ${b.turning.talents.join(", ")}.`);
  const common =
    "Cechy Stworzeń: Ugryzienie, Pazur, Widzenie w Ciemności, Strach 1, Klątwa Nocy, Nie Czuje Bólu, Ożywieniec, Wampiryczny. SW < 30: Test Opanowania (+0) albo rzut w Tabeli Zepsucia Psychicznego.";
  // Tylko przemiana wg zasad domowych (premie z Generatora BN); tabela oficjalna
  // sluzy wylacznie jako zapas, gdy generator nie ma premii dla linii krwi.
  const home = b?.turning?.modifiers;
  entries.push({
    name: `Przemiana: ${name}`,
    category: "wampiryzm",
    effect: `Premie przemiany wg zasad domowych.${flavour} ${extras.join(" ")} ${common}`.trim(),
    source: "Domowe",
    characteristics: home ?? OFFICIAL_TURNING[name],
    movement: (home && b.turning.movement) ?? movement,
    fate: -1,
    resilience: 1,
    race: `Wampir (${name})`
  });
}

for (const g of vampires.gifts ?? []) {
  const parts = [g.effect ?? ""];
  if (g.recommended) parts.push(`Zalecane dla: ${g.recommended}.`);
  entries.push({
    name: g.name,
    category: "dary_krwi",
    effect: parts.join(" ").trim(),
    source: "Wampiry",
    ...(g.limit ? { limit: g.limit } : {})
  });
}
for (const w of vampires.weaknesses ?? []) {
  entries.push({ name: w.name, category: "slabosci_wampira", effect: w.effect ?? "", source: "Wampiry" });
}

// Tylko oficjalne profile z Bestiariusza 2.0 (Weteran/Doborowy usunieto z generatora).
for (const name of ["Dowódca Oddziału", "Pomniejszy Bohater", "Wielki Bohater"]) {
  const p = heroProfiles[name];
  if (!p) continue;
  const mods = Object.fromEntries(Object.entries(p.modifiers ?? {}).filter(([, v]) => v));
  entries.push({
    name,
    category: "profile_bohatera",
    effect: p.description ?? "",
    source: p.source ?? "Bestiariusz 2.0",
    characteristics: mods,
    ...(p.traits?.length ? { traits: p.traits } : {})
  });
}

const out = {
  note:
    "Katalog modyfikatorów postaci (mutacje, wampiryzm, dary, profile). Wartości: liczba albo kości (\"k10\", \"-2k10\") rozstrzygane przy dodaniu do postaci. Pola: characteristics (kod cechy -> wartość), skills (umiejętność -> wartość), maxCharacteristics (górny limit cechy), movement, wounds, fate, resilience, armour/headArmour i traits (opisowo), rollLocation (losuj lokalizację). Wygenerowano z Generator_NPC/public/data przez tools/import_modifiers.mjs.",
  categories,
  locations: mutations.locations ?? [],
  entries
};

writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`, "utf-8");
console.log(`Zapisano ${entries.length} wpisów w ${categories.length} kategoriach -> ${outFile}`);
