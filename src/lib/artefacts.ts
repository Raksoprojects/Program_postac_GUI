/**
 * Generator przedmiotow magicznych wg nieoficjalnego kompendium Treasure & Artefacts
 * (artefacts.json): kategoria z tabeli k100, potem tabela kategorii z rzutami
 * dodatkowymi (rodzaj istot, Cecha, zaklecia z polskiej bazy, Kamien Mocy...),
 * Zalety i Wady, Sila Woli i klatwy. Runy krasnoludzkie pochodza z Podrecznika
 * Gracza: Krasnoludy (najwyzej 3 zwykle i 1 mistrzowska), Bron Chaosu z Warriors of Chaos.
 * Przeniesione z Generatora BN (ta sama logika i dane; kopie w public/data).
 */

import { pick, rollDie, rollK100, weightedPick, type Rng } from "./dice";
import * as gd from "./gameData";
import type { ArtefactCategory, ArtefactsData, SpellDef, TableRow, WeaponAbility } from "./types";

export interface ArtefactLine {
  label?: string;
  text: string;
}

export interface Artefact {
  /** Klucz kategorii z artefacts.json ("amulety", "bronie"...). */
  category: string;
  categoryName: string;
  name: string;
  /** Bron albo element pancerza, na ktorym jest magia. */
  base?: string;
  wp?: number;
  limit?: string;
  lines: ArtefactLine[];
  qualities: string[];
  flaws: string[];
  cursed: boolean;
  curse?: { name: string; text: string; duration?: string };
  spells: string[];
  runes: string[];
  source: string;
}

export interface ArtefactOptions {
  /** Kategoria (klucz); brak = rzut w tabeli kategorii. */
  category?: string;
  /** Konkretna pozycja kategorii (nazwa wiersza, broni albo elementu pancerza). */
  item?: string;
  /** false = przeklete wyniki sa przerzucane. */
  allowCursed?: boolean;
}

const data = (): ArtefactsData => {
  const d = gd.getArtefacts();
  if (!d) throw new Error("Brak danych artefacts.json.");
  return d;
};

// ---------------------------------------------------------------------------
// Rzuty
// ---------------------------------------------------------------------------

export function rollOn<T extends { min: number; max: number }>(table: T[], rng: Rng, roll = rollK100(rng)): T {
  return table.find((r) => roll >= r.min && roll <= r.max) ?? table[table.length - 1];
}

/** Kosci w zapisie "2k10+20", "-3k10", "1k5"; k10 i k100 nie wybuchaja tutaj. */
export function rollDice(text: string, rng: Rng): number {
  const m = /^(-)?(\d*)k(\d+)(?:([+-])(\d+))?(?:\*(\d+))?$/.exec(text.replace(/\s/g, ""));
  if (!m) return Number(text) || 0;
  const [, neg, n, sides, sign, add, mult] = m;
  let sum = 0;
  for (let i = 0; i < Number(n || 1); i++) sum += rollDie(Number(sides), rng);
  if (add) sum += sign === "-" ? -Number(add) : Number(add);
  if (mult) sum *= Number(mult);
  return neg ? -sum : sum;
}

const CHAR_NAMES: Record<string, string> = {
  WW: "Walka Wręcz", US: "Umiejętności Strzeleckie", S: "Siła", Wt: "Wytrzymałość", I: "Inicjatywa",
  Zw: "Zwinność", Zr: "Zręczność", Int: "Inteligencja", SW: "Siła Woli", Ogd: "Ogłada"
};

function randomCharacteristic(rng: Rng, ranged?: boolean): string {
  const list = data().tables.characteristic;
  const code = list[rollDie(10, rng) - 1];
  // Bronie: wynik WW/US zalezy od rodzaju broni.
  if (ranged !== undefined && (code === "WW" || code === "US")) return ranged ? "US" : "WW";
  return code;
}

function spellsOfLore(lores: string[], rng: Rng): { lore: string; pool: SpellDef[] } {
  const all = gd.getSpellsData().spells;
  const withSpells = lores.filter((l) => all.some((s) => s.lore === l));
  const lore = pick(withSpells.length ? withSpells : ["Tajemna"], rng)!;
  return { lore, pool: all.filter((s) => s.lore === lore) };
}

function drawSpells(lores: string[], count: number, rng: Rng): { lore: string; spells: string[] } {
  const { lore, pool } = spellsOfLore(lores, rng);
  const left = [...pool];
  const out: string[] = [];
  for (let i = 0; i < count && left.length; i++) out.push(left.splice(Math.floor(rng() * left.length), 1)[0].name);
  return { lore, spells: out };
}

const loreLabel = (lore: string) => gd.getSpellsData().lores[lore]?.label ?? lore;

// ---------------------------------------------------------------------------
// Klatwy
// ---------------------------------------------------------------------------

export function rollCurse(rng: Rng): { name: string; text: string; duration?: string } {
  const t = data().tables;
  const minor = rollOn(t.minorCurses, rng);
  if (!minor.major) return withRolls({ name: minor.name, text: minor.text ?? "", duration: minor.duration }, minor, rng);
  const major = rollOn(t.majorCurses, rng);
  if (major.permanentMinor) {
    const lasting = t.minorCurses.filter((r) => !r.major && r.duration !== "natychmiast");
    const r = lasting[Math.floor(rng() * lasting.length)];
    return withRolls({ name: `${r.name} (trwała)`, text: r.text ?? "", duration: "do zdjęcia klątwy" }, r, rng);
  }
  return withRolls({ name: major.name, text: major.text ?? "", duration: "do zdjęcia klątwy" }, major, rng);
}

function withRolls<T extends { text: string }>(curse: T, row: TableRow, rng: Rng): T {
  const extra = (row.rolls ?? []).map((r) => (r === "characteristic" ? `Cecha: ${CHAR_NAMES[randomCharacteristic(rng)]}` : r === "species" ? `Rodzaj istot: ${rollOn(data().tables.species, rng).name}` : "")).filter(Boolean);
  return extra.length ? { ...curse, text: `${curse.text} ${extra.join(". ")}.` } : curse;
}

// ---------------------------------------------------------------------------
// Zalety i Wady
// ---------------------------------------------------------------------------

function rollQualities(tables: { qualities: TableRow[]; flaws: TableRow[] }, rng: Rng): { qualities: string[]; flaws: string[] } {
  const qualities: string[] = [];
  const flaws: string[] = [];
  const add = (list: string[], name: string) => {
    const m = /^(.*?)\s+(\d+)$/.exec(name);
    if (!m) return void (list.includes(name) || list.push(name));
    // Wytrzymały i Wyśmienity sie kumuluja.
    const i = list.findIndex((q) => q.startsWith(`${m[1]} `));
    if (i >= 0) list[i] = `${m[1]} ${Number(list[i].split(" ").pop()) + Number(m[2])}`;
    else list.push(name);
  };
  const roll = (table: TableRow[], times: number, isFlaw: boolean, depth = 0) => {
    for (let i = 0; i < times && depth < 4; i++) {
      const r = rollOn(table, rng);
      if (r.twice) roll(table, 2, isFlaw, depth + 1);
      else if (r.thrice) roll(table, 3, isFlaw, depth + 1);
      else if (r.flaw) roll(tables.flaws, 1, true, depth + 1);
      else if (r.name !== "brak") add(isFlaw ? flaws : qualities, r.name);
    }
  };
  roll(tables.qualities, 1, false);
  return { qualities, flaws };
}

// ---------------------------------------------------------------------------
// Rzuty dodatkowe z pozycji
// ---------------------------------------------------------------------------

interface Ctx {
  rng: Rng;
  lines: ArtefactLine[];
  spells: string[];
  ranged?: boolean;
}

function applyRolls(rolls: string[] | undefined, ctx: Ctx): void {
  const t = data().tables;
  const { rng, lines } = ctx;
  for (const raw of rolls ?? []) {
    const [token, arg] = raw.split(":");
    if (token === "species") lines.push({ label: "Rodzaj istot", text: rollOn(t.species, rng).name });
    else if (token === "attack") {
      const a = rollOn(t.attackProtection, rng);
      lines.push({ label: "Rodzaj ataku", text: `${a.name} — ${a.text}` });
    } else if (token === "characteristic") lines.push({ label: "Cecha", text: CHAR_NAMES[randomCharacteristic(rng)] });
    else if (token === "charArmour" || token === "charWeapon") {
      const table = token === "charArmour" ? t.charArmour : t.charWeapon;
      const changes = (r: TableRow, depth = 0): string[] =>
        r.twice && depth < 2
          ? [...changes(rollOn(table, rng), depth + 1), ...changes(rollOn(table, rng), depth + 1)]
          : [`${CHAR_NAMES[randomCharacteristic(rng, token === "charWeapon" ? !!ctx.ranged : undefined)]} ${signed(r.value ?? rollDice(r.dice ?? "0", rng))}`];
      lines.push({ label: "Zmiana Cechy", text: changes(rollOn(table, rng)).join(", ") });
    } else if (token === "powerStone") {
      const s = rollOn(t.powerStones, rng);
      lines.push({ label: "Kamień Mocy", text: `${s.name} — ${s.text}` });
    } else if (token === "spell" || token === "spells" || token === "scrollSpells") {
      const lores = arg ? [arg] : rollOn(t.spellLore, rng).lores ?? ["Tajemna"];
      let count = 1;
      if (token === "spells") count = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4][rollDie(10, rng) - 1];
      if (token === "scrollSpells" && rng() < 0.1) count = rollDie(5, rng);
      const drawn = drawSpells(lores, count, rng);
      ctx.spells.push(...drawn.spells);
      lines.push({ label: count > 1 ? "Zaklęcia" : "Zaklęcie", text: `${drawn.spells.join(", ")} (${loreLabel(drawn.lore)})` });
    } else if (token === "grimoire") {
      const lores = (rollOn(t.spellLore, rng).lores ?? ["Tajemna"]).filter((l) => !l.startsWith("Prosta"));
      const main = drawSpells(lores.length ? lores : ["Ognia"], 2 + rollDie(5, rng), rng);
      const petty = drawSpells(["Prosta"], rollDie(5, rng), rng);
      ctx.spells.push(...main.spells, ...petty.spells);
      lines.push({ label: loreLabel(main.lore), text: main.spells.join(", ") });
      lines.push({ label: "Magia Prosta", text: petty.spells.join(", ") });
    } else if (token === "blessing") {
      const b = rollOn(t.blessings, rng);
      const names = b.twice ? [rollOn(t.blessings.filter((x) => !x.twice), rng, rollDie(95, rng)).name, rollOn(t.blessings.filter((x) => !x.twice), rng, rollDie(95, rng)).name] : [b.name];
      lines.push({ label: "Błogosławieństwo", text: names.join(", ") });
    } else if (token === "ward") lines.push({ label: "Ochrona", text: `Cecha Ochrona (${rollDie(10, rng)})` });
    else if (token === "accuracy") lines.push({ label: "Celność", text: `+${[5, 5, 5, 5, 10, 10, 10, 20, 20, 30][rollDie(10, rng) - 1]} do Umiejętności Strzeleckich` });
    else if (token === "might") {
      const cat = data().categories.bronie;
      const m = rollOn(cat.might ?? [], rng);
      lines.push({ label: "Potęga", text: m.name });
    } else if (token === "wizardry") {
      const cat = data().categories.pancerze;
      const w = rollOn(cat.wizardry ?? [], rng);
      lines.push({ label: "Moc czarnoksięska", text: w.text ? `${w.name} — ${w.text}` : w.name });
      applyRolls(w.rolls, ctx);
    } else if (token === "skullCharm") {
      const r = rollDie(10, rng);
      const text = r <= 5 ? "tylko placebo: +1 PS do udanych Testów Strachu" : r <= 7 ? "+1 PS do Testów Strachu i Grozy" : r <= 9 ? "+5 do Testów Walki i Strzeleckich" : "+10 do Testów Walki, Strzeleckich oraz Strachu i Grozy";
      lines.push({ label: "Moc czaszki", text });
    }
  }
}

const signed = (v: number) => (v >= 0 ? `+${v}` : `−${Math.abs(v)}`);

// ---------------------------------------------------------------------------
// Runy
// ---------------------------------------------------------------------------

/** Runy przedmiotu: krasnoludzkie (najwyzej 3 zwykle i 1 mistrzowska) albo runy Klausera (bron i pancerz). */
export function rollArtefactRunes(kind: "weapon" | "armour" | "talisman", rng: Rng, thrown = false): { runes: string[]; lines: ArtefactLine[]; klauser: boolean } {
  const d = data();
  let count = rollOn(d.runeCount, rng);
  // Runy Klausera tylko na broni i pancerzu.
  while (kind === "talisman" && count.klauser) count = rollOn(d.runeCount, rng);
  const lines: ArtefactLine[] = [];
  const runes: string[] = [];
  if (count.klauser) {
    const table = kind === "weapon" ? d.klauser.weapon.filter((r) => thrown || !r.thrown) : d.klauser.armour;
    for (let i = 0; i < count.klauser; i++) {
      // Waga = szerokosc przedzialu k100 (po odrzuceniu run tylko do broni rzucanej).
      const r = weightedPick(table, (x) => x.max - x.min + 1, rng)!;
      if (r.death) {
        const death = rollOn(d.klauser.death, rng);
        runes.push(death.name);
        const sub: Ctx = { rng, lines: [], spells: [] };
        applyRolls(death.rolls, sub);
        lines.push({ label: death.name, text: [death.text, ...sub.lines.map((l) => `${l.label}: ${l.text}`)].join(" ") });
        continue;
      }
      runes.push(r.name);
      const sub: Ctx = { rng, lines: [], spells: [] };
      applyRolls(r.rolls, sub);
      lines.push({ label: r.name, text: [r.text ?? "", ...sub.lines.map((l) => `${l.label}: ${l.text}`)].join(" ") });
    }
    lines.unshift({ label: "Runy Klausera", text: d.klauser.intro });
    return { runes, lines, klauser: true };
  }
  const pool = gd.getTreasures()?.runes[kind] ?? [];
  const regular = pool.filter((r) => !r.master);
  const master = pool.filter((r) => r.master);
  const left = [...regular];
  for (let i = 0; i < Math.min(3, count.regular ?? 0) && left.length; i++) {
    const r = left.splice(Math.floor(rng() * left.length), 1)[0];
    runes.push(r.name);
    lines.push({ label: r.name, text: r.effect });
  }
  if (count.master && master.length) {
    const m = pick(master, rng)!;
    runes.unshift(m.name);
    lines.unshift({ label: m.name, text: m.effect });
  }
  return { runes, lines, klauser: false };
}

// ---------------------------------------------------------------------------
// Kategorie
// ---------------------------------------------------------------------------

function pickRow(rows: TableRow[], opts: ArtefactOptions, rng: Rng): TableRow {
  if (opts.item) {
    const found = rows.find((r) => r.name === opts.item);
    if (found) return found;
  }
  return opts.allowCursed === false ? rollUntil(rows, (r) => !r.cursed, rng) : rollOn(rows, rng);
}

function rollUntil(rows: TableRow[], ok: (r: TableRow) => boolean, rng: Rng): TableRow {
  for (let i = 0; i < 50; i++) {
    const r = rollOn(rows, rng);
    if (ok(r)) return r;
  }
  return rows.find(ok) ?? rows[0];
}

function newArtefact(category: string, cat: ArtefactCategory, name: string): Artefact {
  return {
    category, categoryName: cat.name, name, limit: cat.limit, lines: [], qualities: [], flaws: [], cursed: false, spells: [], runes: [],
    source: data().source
  };
}

/** Kategorie z jedna tabela pozycji (amulety, pierscienie, mikstury...). */
function rollItemCategory(key: string, cat: ArtefactCategory, opts: ArtefactOptions, rng: Rng): Artefact {
  const rows = cat.items ?? [];
  let row = pickRow(rows, opts, rng);
  const out = newArtefact(key, cat, row.name);
  const ctx: Ctx = { rng, lines: out.lines, spells: out.spells };
  // Przeklety wynik z przerzutem: moc z ponownego rzutu (dwa przeklete - brak mocy).
  if (row.cursed && (row.reroll || row.rerollOn)) {
    out.cursed = true;
    // Mikstura: tylko wyniki 99-100 (2 z 10 w przedziale) maja tez dobroczynny efekt.
    const again = row.reroll ? rollOn(rows, rng) : rng() < (row.rerollOn?.length ?? 0) / (row.max - row.min + 1) ? rollUntil(rows, (r) => !r.cursed && !r.noEffect, rng) : undefined;
    if (again && !again.cursed) {
      out.name = `${again.name} (przeklęty)`;
      if (row.text) out.lines.push({ label: "Klątwa", text: row.text });
      row = again;
    } else {
      out.lines.push({ text: row.text ?? "" });
      if (again?.cursed) out.lines.push({ text: "Drugi rzut też przeklęty — przedmiot nie ma żadnej dobroczynnej mocy." });
      row = { ...row, text: undefined };
    }
    out.curse = rollCurse(rng);
  } else if (row.cursed) {
    out.cursed = true;
  }
  if (row.text) out.lines.unshift({ text: row.text });
  if (row.duration) out.lines.push({ label: "Czas działania", text: row.duration });
  if (row.ingredients) out.lines.push({ label: "Składniki", text: row.ingredients });
  applyRolls(row.rolls, ctx);
  if (row.runes) {
    const r = rollArtefactRunes(row.runes, rng);
    out.runes = r.runes;
    out.lines.push(...r.lines);
  }
  if (!row.noWp && !row.runes && (row.wp ?? cat.wp)) out.wp = rollDice(String(row.wp ?? cat.wp), rng);
  if (cat.itemQualities && !row.runes) Object.assign(out, rollQualities(data().tables.qualities, rng));
  if (row.runes) out.qualities = ["Wyśmienity 2"];
  return out;
}

function rollAmmo(cat: ArtefactCategory, opts: ArtefactOptions, rng: Rng): Artefact {
  const kind = opts.item ? (cat.kinds ?? []).find((k) => k.name === opts.item) ?? rollOn(cat.kinds ?? [], rng) : rollOn(cat.kinds ?? [], rng);
  const column = cat.columns?.[kind.column ?? "arrow"] ?? [];
  let power = rollOn(column, rng);
  if (opts.allowCursed === false) power = rollUntil(column, (r) => !cat.powers?.[r.name]?.cursed, rng);
  const def = cat.powers?.[power.name];
  const count = rollDice(String(kind.count ?? "1k10"), rng);
  const out = newArtefact("amunicja", cat, `${kind.name} ${power.name} (${count} szt.)`);
  out.base = kind.name;
  out.cursed = !!def?.cursed;
  if (def) out.lines.push({ text: def.text });
  applyRolls(def?.rolls, { rng, lines: out.lines, spells: out.spells });
  return out;
}

function rollArmour(cat: ArtefactCategory, opts: ArtefactOptions, rng: Rng): Artefact {
  const piece = opts.item ? (cat.pieces ?? []).find((p) => p.name === opts.item) ?? rollOn(cat.pieces ?? [], rng) : rollOn(cat.pieces ?? [], rng);
  const count = opts.allowCursed === false ? rollUntil(cat.enchantmentCount ?? [], (r) => !r.cursed, rng) : rollOn(cat.enchantmentCount ?? [], rng);
  const out = newArtefact("pancerze", cat, `${piece.name} (pancerz magiczny)`);
  out.base = piece.name;
  let wp = Number(piece.wp ?? 25);
  if (count.cursed) {
    out.cursed = true;
    out.name = `${piece.name} (pancerz przeklęty)`;
    out.lines.push({ text: "Przeklęty pancerz bez innych mocy — nie zdejmiesz go, dopóki klątwa trwa." });
    out.curse = rollCurse(rng);
    out.wp = wp;
    return out;
  }
  if (count.runes) {
    const r = rollArtefactRunes("armour", rng);
    out.name = `${piece.name} (pancerz runiczny)`;
    out.runes = r.runes;
    out.lines.push(...r.lines);
    out.qualities = ["Wytrzymały 1"];
    return out;
  }
  wp += rollDice(count.wpDice ?? "1k10", rng);
  const protection = rollOn(cat.protection ?? [], rng);
  wp += rollDice(protection.wpDice ?? "1k10", rng);
  out.lines.push({ label: "Wzmocniona Ochrona", text: protection.text ? `${protection.name} — ${protection.text}` : `${protection.name} na wszystkich lokacjach, które chroni` });
  out.qualities = protection.qualities ? [...protection.qualities] : [`Wytrzymały ${protection.ap ?? 1}`, `Wyśmienity ${protection.ap ?? 1}`];
  const ctx: Ctx = { rng, lines: out.lines, spells: out.spells };
  const taken = new Set<string>();
  for (let i = 1; i < Number(count.count ?? 1); i++) {
    const e = rollUntil(cat.enchantments ?? [], (r) => !taken.has(r.name) && (opts.allowCursed !== false || !r.cursed), rng);
    taken.add(e.name);
    if (e.cursed) {
      out.cursed = true;
      out.curse = rollCurse(rng);
    }
    out.lines.push({ label: e.name, text: e.text ?? "" });
    applyRolls(e.rolls, ctx);
  }
  out.wp = wp;
  return out;
}

function weaponName(type: TableRow, rng: Rng): string {
  const r = rollDie(10, rng);
  return type.d10?.find(([lo, hi]) => r >= lo && r <= hi)?.[2] ?? type.name;
}

function rollWeapon(cat: ArtefactCategory, opts: ArtefactOptions, rng: Rng): Artefact {
  const types = cat.types ?? [];
  let base: string;
  let ranged: boolean;
  const chosenType = opts.item ? types.find((t) => t.d10?.some(([, , n]) => n === opts.item)) : undefined;
  if (chosenType) {
    base = opts.item!;
    ranged = !!chosenType.ranged;
  } else {
    const type = rollOn(types, rng);
    base = weaponName(type, rng);
    ranged = !!type.ranged;
  }
  const out = newArtefact("bronie", cat, `${base} (broń magiczna)`);
  out.base = base;
  const thrown = /rzuca|Oszczep|Strzałka/.test(base) || base === "Włócznia";
  const count = rollOn(cat.abilityCount ?? [], rng);
  const qualities = rollQualities(data().tables.weaponQualities, rng);
  if (count.special === "silver") {
    out.name = `${base} (broń posrebrzana)`;
    out.lines.push({ text: cat.silver ?? "" });
    Object.assign(out, qualities);
    return out;
  }
  if (count.special === "runes") {
    const r = rollArtefactRunes("weapon", rng, thrown);
    out.name = `${base} (broń runiczna)`;
    out.runes = r.runes;
    out.lines.push(...r.lines);
    out.qualities = r.klauser ? qualities.qualities : ["Wytrzymały 1", "Wyśmienity 1"];
    return out;
  }
  if (count.special === "chaos" || count.special === "daemon") return chaosWeapon(out, cat, count.special, qualities, rng);
  Object.assign(out, qualities);
  out.wp = rollDice(String(count.wp ?? "1k10+20"), rng);
  out.lines.push({ text: "Cecha Magiczny; aura widoczna dla Percepcji Magicznej; rozprasza zaklęcia typu Aura, Kopuła i Strefa w swoim obszarze." });
  const column = (a: WeaponAbility) => (ranged ? a.ranged : a.melee);
  const usable = (cat.abilities ?? []).filter((a) => column(a) && (opts.allowCursed !== false || !a.cursed));
  const taken = new Set<string>();
  const ctx: Ctx = { rng, lines: out.lines, spells: out.spells, ranged };
  for (let i = 0; i < Number(count.count ?? 0); i++) {
    let a: WeaponAbility | undefined;
    for (let tries = 0; tries < 30 && !a; tries++) {
      const roll = rollK100(rng);
      const hit = usable.find((x) => roll >= column(x)![0] && roll <= column(x)![1]);
      if (hit && !taken.has(hit.name)) a = hit;
    }
    if (!a) break;
    taken.add(a.name);
    if (a.cursed) {
      out.cursed = true;
      out.curse = rollCurse(rng);
    }
    // Potega: wynik rzutu (np. "+2 Obrazen") zastepuje ogolny opis.
    if (!a.rolls?.includes("might")) out.lines.push({ label: a.name, text: a.text });
    applyRolls(a.rolls, ctx);
  }
  if (!taken.size) out.lines.push({ text: "Brak mocy specjalnych — tylko ogólne właściwości magicznej broni." });
  return out;
}

/** Bron Chaosu i demoniczna: wlasciwosci i demony z treasures.json (Warriors of Chaos). */
function chaosWeapon(out: Artefact, cat: ArtefactCategory, kind: "chaos" | "daemon", q: { qualities: string[]; flaws: string[] }, rng: Rng): Artefact {
  const t = gd.getTreasures();
  out.qualities = ["Wytrzymały 5", ...q.qualities.filter((x) => !x.startsWith("Wytrzymały"))];
  out.flaws = q.flaws;
  if (kind === "chaos") {
    out.name = `${out.base} (Broń Chaosu)`;
    out.wp = 40 + rollDie(45, rng);
    out.lines.push({ text: cat.chaos ?? "" });
    const props = t?.chaosProperties ?? [];
    const n = rollDie(2, rng);
    const left = [...props];
    for (let i = 0; i < n && left.length; i++) {
      const p = left.splice(Math.floor(rng() * left.length), 1)[0];
      out.lines.push({ label: `${p.name} (${p.god})`, text: p.effect });
    }
    return out;
  }
  out.name = `${out.base} (Broń demoniczna)`;
  out.lines.push({ text: cat.daemon ?? "" });
  const gods = Object.keys(t?.daemons ?? {});
  const god = pick(gods, rng);
  const daemon = god ? t!.daemons[god][rng() < 0.4 ? "lesser" : "greater"] : undefined;
  if (daemon) out.lines.push({ label: `Uwięziony demon (${god})`, text: `${daemon.name}: ${daemon.benefit}` });
  out.lines.push({ text: "Siła Woli broni = Siła Woli uwięzionego demona." });
  return out;
}

function rollRenowned(cat: ArtefactCategory, opts: ArtefactOptions, rng: Rng): Artefact {
  const list = cat.renowned ?? [];
  const item = (opts.item && list.find((r) => r.name === opts.item)) || list[Math.floor(rng() * list.length)];
  const out = newArtefact("slawne", cat, item.name);
  if (item.wp) out.wp = item.wp;
  out.lines.push({ text: item.text });
  out.lines.push({ label: "Wartość", text: `${item.value} · Obc. ${item.enc} · dostępność: ${item.availability}` });
  return out;
}

/** Kategoria spoza kompendium: przedmioty z podrecznikow, ktore generator daje BN. */
export const OFFICIAL = "podreczniki";

interface OfficialItem {
  name: string;
  description: string;
  source: string;
  runes?: "weapon" | "armour" | "talisman";
  chaos?: boolean;
  daemon?: boolean;
  cursed?: boolean;
}

/** Szablony skarbow BN (runy, Bron Chaosu, artefakty wampirow i elfow) oraz kostury, szaty i mikstury z podrecznikow. */
function officialItems(): OfficialItem[] {
  const where = (s?: string, p?: number) => (s ? `${s}${p ? `, s. ${p}` : ""}` : "podręcznik");
  const templates = (gd.getTreasures()?.items ?? [])
    .filter((t) => t.kind !== "potion")
    .map((t) => ({ name: t.name, description: t.description, source: where(t.source, t.page), runes: t.runes, chaos: !!t.chaos, daemon: t.daemon, cursed: t.cursed }));
  const items = (gd.getMagicItems()?.items ?? []).filter((i) => !i.scroll).map((i) => ({ name: i.name, description: i.description, source: where(i.source, i.page) }));
  return [...templates, ...items];
}

function rollOfficial(opts: ArtefactOptions, rng: Rng): Artefact {
  const pool = officialItems().filter((i) => opts.allowCursed !== false || !i.cursed);
  const it = pool.find((i) => i.name === opts.item) ?? pool[Math.floor(rng() * pool.length)];
  const out: Artefact = {
    category: OFFICIAL, categoryName: "Z podręczników", name: it.name, lines: [{ text: it.description }], qualities: [], flaws: [],
    cursed: !!it.cursed, spells: [], runes: [], source: it.source
  };
  if (it.runes) {
    const r = rollArtefactRunes(it.runes, rng);
    out.runes = r.runes;
    out.lines.push(...r.lines);
  }
  if (it.chaos || it.daemon) {
    const cat = data().categories.bronie;
    out.base = it.name;
    const res = chaosWeapon(out, cat, it.daemon ? "daemon" : "chaos", { qualities: [], flaws: [] }, rng);
    res.name = it.name;
    return res;
  }
  return out;
}

/** Losuje przedmiot magiczny (kategoria z tabeli k100, chyba ze podana). */
export function rollArtefact(opts: ArtefactOptions = {}, rng: Rng = Math.random): Artefact {
  const d = data();
  if (opts.category === OFFICIAL) return rollOfficial(opts, rng);
  let key = opts.category && d.categories[opts.category] ? opts.category : rollOn(d.categoryTable, rng).name;
  if (!d.categories[key]) key = "amulety";
  const cat = d.categories[key];
  if (key === "amunicja") return rollAmmo(cat, opts, rng);
  if (key === "pancerze") return rollArmour(cat, opts, rng);
  if (key === "bronie") return rollWeapon(cat, opts, rng);
  if (key === "slawne") return rollRenowned(cat, opts, rng);
  return rollItemCategory(key, cat, opts, rng);
}

/** Pozycje do wyboru w trybie wlasnym (nazwy wierszy, bronie, elementy pancerza). */
export function categoryChoices(key: string): string[] {
  if (key === OFFICIAL) return officialItems().map((i) => i.name);
  const cat = data().categories[key];
  if (!cat) return [];
  if (cat.items) return cat.items.map((r) => r.name);
  if (cat.pieces) return cat.pieces.map((r) => r.name);
  if (cat.kinds) return cat.kinds.map((r) => r.name);
  if (cat.types) return [...new Set(cat.types.flatMap((t) => (t.d10 ?? []).map(([, , n]) => n)))];
  if (cat.renowned) return cat.renowned.map((r) => r.name);
  return [];
}

export function categoryList(): { key: string; name: string }[] {
  const d = data();
  return [
    ...d.categoryTable.map((r) => ({ key: r.name, name: d.categories[r.name]?.name ?? r.name })),
    { key: OFFICIAL, name: "Z podręczników (runy, Broń Chaosu, artefakty)" }
  ];
}

/** Tekst przedmiotu do schowka. */
export function artefactToText(a: Artefact): string {
  const head = [a.name, a.categoryName, a.wp ? `SW ${a.wp}` : "", a.limit ? `limit: ${a.limit}` : ""].filter(Boolean).join(" · ");
  const lines = [head];
  if (a.qualities.length || a.flaws.length) lines.push(`Zalety: ${a.qualities.join(", ") || "—"}; Wady: ${a.flaws.join(", ") || "—"}`);
  for (const l of a.lines) lines.push(l.label ? `${l.label}: ${l.text}` : l.text);
  if (a.curse) lines.push(`Klątwa — ${a.curse.name}${a.curse.duration ? ` (${a.curse.duration})` : ""}: ${a.curse.text}`);
  lines.push(`[${a.source}]`);
  return lines.join("\n");
}
