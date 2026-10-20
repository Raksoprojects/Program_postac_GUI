/**
 * Bron i pancerz postaci: przeniesienie pozycji z katalogu (weapons.json),
 * Obrazenia z Bonusem z Sily, umiejetnosc i wartosc testu, PP na lokacjach.
 * Funkcje czyste - bez stanu.
 */

import type { ArmourDef, CharArmour, CharWeapon, WeaponDef } from "./types";

/** Lokacje karty w kolejnosci (klucz -> etykieta). */
export const LOCATIONS = [
  { key: "glowa", label: "Głowa" },
  { key: "lreka", label: "Lewa ręka" },
  { key: "preka", label: "Prawa ręka" },
  { key: "korpus", label: "Korpus" },
  { key: "lnoga", label: "Lewa noga" },
  { key: "pnoga", label: "Prawa noga" }
] as const;

export type LocationKey = (typeof LOCATIONS)[number]["key"];

/** Lokacje z danych ("ramiona", "nogi") -> lokacje karty. */
const LOCATION_MAP: Record<string, LocationKey[]> = {
  "głowa": ["glowa"],
  "ramiona": ["lreka", "preka"],
  "ręce": ["lreka", "preka"],
  "korpus": ["korpus"],
  "nogi": ["lnoga", "pnoga"]
};

export function weaponFromDef(name: string, def: WeaponDef, kind: "melee" | "ranged"): CharWeapon {
  return {
    name,
    kind,
    group: def.group,
    damage: def.damage,
    sb: def.sb,
    reach: kind === "ranged" ? (def.range ? `${def.range} m` : "") : (def.reach ?? ""),
    qualities: [...def.qualities],
    flaws: [...def.flaws],
    enc: def.enc ?? "",
    shield: def.shield,
    carried: true,
    note: def.note
  };
}

export function armourFromDef(name: string, def: ArmourDef): CharArmour {
  return {
    name,
    locations: [...def.locations],
    ap: def.ap,
    qualities: [...def.qualities],
    enc: "",
    worn: true,
    penalty: def.penalty
  };
}

/** Zapis Obrazen jak w podreczniku: "+BS+4" albo "+8". */
export function damageLabel(w: Pick<CharWeapon, "damage" | "sb">): string {
  const n = w.damage >= 0 ? `+${w.damage}` : `${w.damage}`;
  return w.sb ? `+BS${n}` : n;
}

/** Obrazenia liczbowo dla Bonusu z Sily postaci. */
export function damageValue(w: Pick<CharWeapon, "damage" | "sb">, strengthBonus: number): number {
  return w.damage + (w.sb ? strengthBonus : 0);
}

/** Umiejetnosc, ktora testuje sie atak bronia. */
export function weaponSkill(w: Pick<CharWeapon, "kind" | "group">): string {
  return `${w.kind === "ranged" ? "Broń Zasięgowa" : "Broń Biała"} (${w.group})`;
}

/** Laczne PP pancerza (zalozonego) na kazdej lokacji. */
export function armourPoints(armour: CharArmour[]): Record<LocationKey, number> {
  const out = Object.fromEntries(LOCATIONS.map((l) => [l.key, 0])) as Record<LocationKey, number>;
  for (const a of armour) {
    if (!a.worn) continue;
    for (const loc of a.locations) {
      for (const k of LOCATION_MAP[loc.toLowerCase()] ?? []) out[k] += a.ap;
    }
  }
  return out;
}

/** Najwyzsza Tarcza z broni noszonej przy sobie. */
export function shieldValue(weapons: CharWeapon[]): number {
  return weapons.reduce((m, w) => (w.carried && w.shield ? Math.max(m, w.shield) : m), 0);
}

/** Etykieta lokacji pancerza do tabeli ("ramiona, korpus"). */
export function locationsLabel(a: Pick<CharArmour, "locations">): string {
  return a.locations.join(", ");
}

/** Suma Obciazenia (liczby w polu enc; puste = 0). */
export function totalEnc(items: { enc: string }[], filter: (i: { enc: string }) => boolean = () => true): number {
  return items.filter(filter).reduce((s, i) => s + (Number.parseFloat(i.enc.replace(",", ".")) || 0), 0);
}
