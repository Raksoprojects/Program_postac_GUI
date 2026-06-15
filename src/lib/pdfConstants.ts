/**
 * Stale ukladu formularza PDF karty postaci WFRP 4ed (port z pdf_character_io.py).
 *
 * Nazwy pol odpowiadaja polom AcroForm w szablonie empty_card.pdf. Klucze sa
 * porownywane po normalizacji (bez akcentow, male litery) - patrz normalizePdfFieldName.
 */

/** Mapowanie cech na nazwy pol PDF (poczatkowa / rozwiniecie / aktualna). */
export const PDF_ATTRIBUTE_FIELDS: Record<
  string,
  { initial: string; advanced: string; current: string }
> = {
  WW: { initial: "ww_poczatkowa", advanced: "ww_rozwieniecie", current: "ww_aktualna" },
  US: { initial: "us_poczatkowa", advanced: "us_rozwienicie", current: "us_aktualna" },
  S: { initial: "s_poczatkowa", advanced: "s_rozwienicie", current: "s_aktualna" },
  Wt: { initial: "wt_poczatkowa", advanced: "wt_rozwienicie", current: "wt_aktualna" },
  I: { initial: "i_poczatkowa", advanced: "i_rozwienicie", current: "i_aktualna" },
  Zw: { initial: "zw_poczatkowa", advanced: "zw_rozwienicie", current: "zw_aktualna" },
  Zr: { initial: "zr_poczatkowa", advanced: "zr_rozwienicie", current: "zr_aktualna" },
  Int: { initial: "int_poczatkowa", advanced: "int_rozwienicie", current: "int_aktualna" },
  SW: { initial: "sw_poczatkowa", advanced: "sw_rozwienicie", current: "sw_aktualna" },
  Ogd: { initial: "ogd_poczatkowa", advanced: "ogd_rozwienicie", current: "ogd_aktualna" }
};

export interface BasicSkillLayout {
  name: string;
  attribute: string;
  advanced_field: string;
  total_field: string;
  specialization_field?: string;
}

/** Staly uklad 26 umiejetnosci podstawowych na karcie. */
export const PDF_BASIC_SKILL_LAYOUT: BasicSkillLayout[] = [
  { name: "Atletyka", attribute: "Zw", advanced_field: "atletyka_zw_cecha_rozwiniecie", total_field: "umtotal1" },
  { name: "Broń Biała (Podstawowa)", attribute: "WW", advanced_field: "bb_rozwiniecie", total_field: "umtotal2" },
  { name: "Broń Biała ({specialization})", attribute: "WW", advanced_field: "bb_x_rozwiniecie", total_field: "umtotal3", specialization_field: "bronbia_ax" },
  { name: "Charyzma", attribute: "Ogd", advanced_field: "charyzma_ogd_cecha_rozwiniecie", total_field: "umtotal4" },
  { name: "Dowodzenie", attribute: "Ogd", advanced_field: "dowodzenie_ogd_cecha_rozwiniecie", total_field: "umtotal5" },
  { name: "Hazard", attribute: "Int", advanced_field: "hazard_int_cecha_rozwiniecie", total_field: "umtotal6" },
  { name: "Intuicja", attribute: "I", advanced_field: "intuicja_i_cecha_rozwiniecie", total_field: "umtotal7" },
  { name: "Jeździectwo", attribute: "Zw", advanced_field: "jezdziectwo_zw_cecha_rozwieniecie", total_field: "umtotal8" },
  { name: "Mocna głowa", attribute: "Wt", advanced_field: "mocna_g_owa_cecha_wt_rozwiniecie", total_field: "umtotal9" },
  { name: "Nawigacja", attribute: "I", advanced_field: "nawigacja_cecha_i_rozwiniecie", total_field: "umtotal10" },
  { name: "Odporność", attribute: "Wt", advanced_field: "odporno_wt_cecha_rozwiniecie", total_field: "umtotal11" },
  { name: "Opanowanie", attribute: "SW", advanced_field: "opanowanie_sw_sw_cecha_rozwiniecie", total_field: "umtotal12" },
  { name: "Oswajanie", attribute: "SW", advanced_field: "oswajanie_cecha_sw_rozwiniecie", total_field: "umtotal13" },
  { name: "Percepcja", attribute: "I", advanced_field: "percepcja_cecha_i_rozwiniecie", total_field: "umtotal14" },
  { name: "Plotkowanie", attribute: "Ogd", advanced_field: "plotkowanie_cecha_ogd_rozwiniecie", total_field: "umtotal15" },
  { name: "Powożenie", attribute: "Zw", advanced_field: "powo_enie_zw_cecha_rozwiniecie", total_field: "umtotal16" },
  { name: "Przekupstwo", attribute: "Ogd", advanced_field: "przekupstwo_cecha_ogd_rozwiniecie", total_field: "umtotal17" },
  { name: "Skradanie ({specialization})", attribute: "Zw", advanced_field: "skradanie_zw_cecha_rozwiniecie", total_field: "umtotal18", specialization_field: "skradaniex" },
  { name: "Sztuka ({specialization})", attribute: "Zr", advanced_field: "sztuka_cecha_zr_rozwieniecie", total_field: "umtotal19", specialization_field: "sztuka_x" },
  { name: "Sztuka Przetrwania", attribute: "Int", advanced_field: "sztuka_przetrwania_int_cecha_rozwiniecie", total_field: "umtotal20" },
  { name: "Targowanie", attribute: "Ogd", advanced_field: "targowanie_ogd_cecha_rozwiniecie", total_field: "umtotal21" },
  { name: "Unik", attribute: "Zw", advanced_field: "unik_zw_cecha_rozwiniecie", total_field: "umtotal22" },
  { name: "Wioślarstwo", attribute: "S", advanced_field: "wioslarstwo_cecha_s_roziwniecie", total_field: "umtotal23" },
  { name: "Wspinaczka", attribute: "S", advanced_field: "wspinaczka_cecha_s_rozwiniecie", total_field: "umtotal24" },
  { name: "Występy ({specialization})", attribute: "Ogd", advanced_field: "wystepy_ogd_cecha_rozwieniecie", total_field: "umtotal25", specialization_field: "wystepy_x" },
  { name: "Zastraszanie", attribute: "S", advanced_field: "zastraszanie_cecha_s_rozwiniecie", total_field: "umtotal26" }
];

/** Pola doswiadczenia (dostepne / wydane / suma). */
export const PDF_EXPERIENCE_FIELDS: Record<string, string> = {
  available: "aktualne_doswiadczenie",
  spent: "wydane_doswiadczenie",
  total: "suma_doswiadczenia"
};

/** Numery wierszy talentow (1..30) i umiejetnosci zaawansowanych (1..20). */
export const PDF_TALENT_ROWS = Array.from({ length: 30 }, (_, i) => i + 1);
export const PDF_ADVANCED_SKILL_ROWS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Liczba checkboxow "rozwijalne w profesji" na stronie 1 (10 + 26 + 20). */
export const PDF_PAGE_ONE_PROFESSION_CHECKBOX_COUNT = 56;

/** Mapowanie znormalizowanych nazw cech na kody uzywane w aplikacji. */
export const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  ww: "WW",
  us: "US",
  s: "S",
  wt: "Wt",
  i: "I",
  zw: "Zw",
  zr: "Zr",
  int: "Int",
  sw: "SW",
  ogd: "Ogd"
};
