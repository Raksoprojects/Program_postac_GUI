/**
 * Import/eksport karty postaci WFRP 4ed z/do formularza PDF (port pdf_character_io.py).
 *
 * Uzywa pdf-lib zamiast pypdf. Roznice obslugiwane swiadomie:
 *  - flagi "rozwijalne w profesji" czytamy z kolejnosci anotacji checkboxow na
 *    stronie 1 (jak pypdf), poprzez niskopoziomowe API pdf-lib (page.node.Annots).
 *  - przy zapisie ustawiamy surowe /V (PDFHexString UTF-16BE) i NeedAppearances=true,
 *    aby uniknac bledow kodowania polskich znakow przy regeneracji wygladu pol.
 */

import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFHexString,
  PDFString,
  PDFBool,
  type PDFField,
  PDFTextField,
  PDFDropdown,
  PDFCheckBox
} from "pdf-lib";
import {
  ATTRIBUTE_NAME_MAP,
  PDF_ADVANCED_SKILL_ROWS,
  PDF_ATTRIBUTE_FIELDS,
  PDF_BASIC_SKILL_LAYOUT,
  PDF_EXPERIENCE_FIELDS,
  PDF_PAGE_ONE_PROFESSION_CHECKBOX_COUNT,
  PDF_TALENT_ROWS
} from "./pdfConstants";
import type { AttributeEntry, SkillEntry } from "./types";

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

/** Klucz wyszukiwania pola: bez akcentow, tylko [0-9a-z] rozdzielone '_'. */
export function normalizePdfFieldName(text: string): string {
  const stripped = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return stripped
    .replace(/[^0-9a-zA-Z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function cleanPdfValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (value === "/Off") return "";
  if (value === "/Yes") return "Tak";
  return String(value).trim();
}

function safeInt(value: string | null | undefined): number {
  const text = cleanPdfValue(value);
  if (!text) return 0;
  const num = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(num) ? Math.trunc(num) : 0;
}

function canonicalAttribute(value: string): string {
  return ATTRIBUTE_NAME_MAP[normalizePdfFieldName(value)] ?? "";
}

function resolveDisplayName(template: string, specialization: string): string {
  const spec = specialization.trim();
  if (!template.includes("{specialization}")) return template;
  if (spec) return template.replace("{specialization}", spec);
  return template.split(" (")[0];
}

function extractSpecialization(skillName: string): string {
  const match = skillName.match(/\((.*?)\)/);
  return match ? match[1].trim() : "";
}

// ---------------------------------------------------------------------------
// Odczyt wartosci pol
// ---------------------------------------------------------------------------

interface FieldIndex {
  /** znormalizowana nazwa -> rzeczywista nazwa pola */
  lookup: Record<string, string>;
  /** rzeczywista nazwa -> obiekt pola */
  byName: Record<string, PDFField>;
}

function buildFieldIndex(fields: PDFField[]): FieldIndex {
  const lookup: Record<string, string> = {};
  const byName: Record<string, PDFField> = {};
  for (const field of fields) {
    const name = field.getName();
    byName[name] = field;
    const norm = normalizePdfFieldName(name);
    if (!(norm in lookup)) lookup[norm] = name;
  }
  return { lookup, byName };
}

function fieldNameFor(index: FieldIndex, normalizedName: string): string | null {
  return index.lookup[normalizedName] ?? null;
}

/** Odczytuje wartosc pola (text/dropdown/checkbox) jako oczyszczony tekst. */
function readFieldValue(index: FieldIndex, normalizedName: string): string {
  const actual = fieldNameFor(index, normalizedName);
  if (!actual) return "";
  const field = index.byName[actual];
  if (!field) return "";
  try {
    if (field instanceof PDFTextField) return cleanPdfValue(field.getText() ?? "");
    if (field instanceof PDFDropdown) {
      const sel = field.getSelected();
      return cleanPdfValue(sel.length ? sel[0] : "");
    }
    if (field instanceof PDFCheckBox) return field.isChecked() ? "Tak" : "";
  } catch {
    return "";
  }
  return "";
}

/** Stany checkboxow na danej stronie w kolejnosci anotacji (mirror pypdf). */
function pageCheckboxStates(doc: PDFDocument, pageIndex: number): boolean[] {
  const states: boolean[] = [];
  const page = doc.getPage(pageIndex);
  const annots = page.node.Annots();
  if (!annots) return states;
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    const annot = doc.context.lookup(ref);
    if (!(annot instanceof PDFDict)) continue;
    let ft = annot.get(PDFName.of("FT"));
    if (!ft) {
      const parentRef = annot.get(PDFName.of("Parent"));
      if (parentRef) {
        const parent = doc.context.lookup(parentRef);
        if (parent instanceof PDFDict) ft = parent.get(PDFName.of("FT"));
      }
    }
    if (ft && ft.toString() === "/Btn") {
      const as = annot.get(PDFName.of("AS"));
      states.push(Boolean(as) && as!.toString() === "/Yes");
    }
  }
  return states;
}

// ---------------------------------------------------------------------------
// Typy wyniku importu
// ---------------------------------------------------------------------------

export interface PdfProfessionInfo {
  class: string;
  profession: string;
  level_text: string;
  path_text: string;
  species: string;
  [key: string]: unknown;
}

export interface PdfRawTalent {
  advances: string;
  description: string;
}

export interface PdfMapping {
  character_name: string | null;
  experience: Record<string, string | null>;
  attributes: Record<string, Record<string, string | null>>;
  skills: Record<string, Record<string, unknown>>;
  talents: Record<string, Record<string, unknown>>;
  talents_free: Array<Record<string, string | null>>;
  profession: Record<string, string | null>;
}

export interface PdfExtractResult {
  character_name: string;
  attributes: Record<string, AttributeEntry>;
  skills: Record<string, SkillEntry>;
  talents: Record<string, PdfRawTalent>;
  experience: { available: number; spent: number; total: number };
  profession_info: PdfProfessionInfo;
  pdf_mapping: PdfMapping;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Wczytuje dane postaci z wypelnionego formularza PDF. */
export async function extractPdfCharacterData(
  bytes: ArrayBuffer | Uint8Array
): Promise<PdfExtractResult> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const index = buildFieldIndex(form.getFields());

  const checkboxStates = pageCheckboxStates(doc, 0);
  let attrFlags: boolean[];
  let basicFlags: boolean[];
  let advancedFlags: boolean[];
  if (checkboxStates.length >= PDF_PAGE_ONE_PROFESSION_CHECKBOX_COUNT) {
    attrFlags = checkboxStates.slice(0, 10);
    basicFlags = checkboxStates.slice(10, 36);
    advancedFlags = checkboxStates.slice(36, 56);
  } else {
    attrFlags = new Array(10).fill(false);
    basicFlags = new Array(PDF_BASIC_SKILL_LAYOUT.length).fill(false);
    advancedFlags = new Array(PDF_ADVANCED_SKILL_ROWS.length).fill(false);
  }

  const experience = {
    available: safeInt(readFieldValue(index, PDF_EXPERIENCE_FIELDS.available)),
    spent: safeInt(readFieldValue(index, PDF_EXPERIENCE_FIELDS.spent)),
    total: safeInt(readFieldValue(index, PDF_EXPERIENCE_FIELDS.total))
  };

  const pdfMapping: PdfMapping = {
    character_name: fieldNameFor(index, "imie"),
    experience: {},
    attributes: {},
    skills: {},
    talents: {},
    talents_free: [],
    profession: {
      class_field: fieldNameFor(index, "klasa"),
      profession_field: fieldNameFor(index, "profesja"),
      level_field: fieldNameFor(index, "poziom_profesji"),
      path_field: fieldNameFor(index, "sciezka_profesji"),
      species_field: fieldNameFor(index, "rasa")
    }
  };

  const professionInfo: PdfProfessionInfo = {
    class: readFieldValue(index, "klasa"),
    profession: readFieldValue(index, "profesja"),
    level_text: readFieldValue(index, "poziom_profesji"),
    path_text: readFieldValue(index, "sciezka_profesji"),
    species: readFieldValue(index, "rasa")
  };

  for (const [key, normalizedName] of Object.entries(PDF_EXPERIENCE_FIELDS)) {
    pdfMapping.experience[key] = fieldNameFor(index, normalizedName);
  }

  // Cechy
  const attributes: Record<string, AttributeEntry> = {};
  const attrEntries = Object.entries(PDF_ATTRIBUTE_FIELDS);
  attrEntries.forEach(([attrName, mapping], attrIndex) => {
    const initial = safeInt(readFieldValue(index, mapping.initial));
    const advanced = safeInt(readFieldValue(index, mapping.advanced));
    let current = safeInt(readFieldValue(index, mapping.current));
    if (!current) current = initial + advanced;
    attributes[attrName] = {
      initial,
      advanced,
      current,
      base_advanced: advanced,
      is_new: false,
      profession_available: attrFlags[attrIndex] ?? false
    };
    pdfMapping.attributes[attrName] = {
      initial: fieldNameFor(index, mapping.initial),
      advanced: fieldNameFor(index, mapping.advanced),
      current: fieldNameFor(index, mapping.current)
    };
  });

  // Umiejetnosci podstawowe (staly uklad)
  const skills: Record<string, SkillEntry> = {};
  PDF_BASIC_SKILL_LAYOUT.forEach((layout, layoutIndex) => {
    const specialization = layout.specialization_field
      ? readFieldValue(index, layout.specialization_field)
      : "";
    const skillName = resolveDisplayName(layout.name, specialization);
    const advanced = safeInt(readFieldValue(index, layout.advanced_field));
    let current = safeInt(readFieldValue(index, layout.total_field));
    if (!current) current = (attributes[layout.attribute]?.current ?? 0) + advanced;
    const initial = Math.max(current - advanced, 0);

    skills[skillName] = {
      attribute: layout.attribute,
      initial,
      advanced,
      current,
      base_advanced: advanced,
      is_new: false,
      profession_available: basicFlags[layoutIndex] ?? false
    };
    pdfMapping.skills[skillName] = {
      type: "basic",
      attribute: layout.attribute,
      advanced_field: fieldNameFor(index, layout.advanced_field),
      total_field: fieldNameFor(index, layout.total_field),
      specialization_field: layout.specialization_field
        ? fieldNameFor(index, layout.specialization_field)
        : null,
      specialization_value: specialization
    };
  });

  // Umiejetnosci zaawansowane (wiersze)
  PDF_ADVANCED_SKILL_ROWS.forEach((rowIndex, rowPosition) => {
    const nameField = `skillnamerow${rowIndex}`;
    const skillName = readFieldValue(index, nameField);
    if (!skillName) return;
    const attribute = canonicalAttribute(readFieldValue(index, `listboxrow${rowIndex}`));
    if (!attribute) return;

    const advanced = safeInt(readFieldValue(index, `advrow${rowIndex}`));
    const initial = safeInt(readFieldValue(index, `characteristicrow${rowIndex}`));
    let current = safeInt(readFieldValue(index, `skillrow${rowIndex}`));
    if (!current) current = initial + advanced;

    skills[skillName] = {
      attribute,
      initial,
      advanced,
      current,
      base_advanced: advanced,
      is_new: false,
      profession_available: advancedFlags[rowPosition] ?? false
    };
    pdfMapping.skills[skillName] = {
      type: "advanced",
      name_field: fieldNameFor(index, nameField),
      attribute_field: fieldNameFor(index, `listboxrow${rowIndex}`),
      advanced_field: fieldNameFor(index, `advrow${rowIndex}`),
      initial_field: fieldNameFor(index, `characteristicrow${rowIndex}`),
      current_field: fieldNameFor(index, `skillrow${rowIndex}`),
      name_value: skillName,
      attribute_value: attribute
    };
  });

  // Talenty (wiersze)
  const talents: Record<string, PdfRawTalent> = {};
  const talentsFree: Array<Record<string, string | null>> = [];
  for (const rowIndex of PDF_TALENT_ROWS) {
    const talentName = readFieldValue(index, `talent_namerow${rowIndex}`);
    if (!talentName) {
      talentsFree.push({
        name_field: fieldNameFor(index, `talent_namerow${rowIndex}`),
        advances_field: fieldNameFor(index, `times_takenrow${rowIndex}`),
        description_field: fieldNameFor(index, `descriptionrow${rowIndex}`)
      });
      continue;
    }
    const advances = cleanPdfValue(readFieldValue(index, `times_takenrow${rowIndex}`));
    const description = readFieldValue(index, `descriptionrow${rowIndex}`);
    talents[talentName] = { advances, description };
    pdfMapping.talents[talentName] = {
      name_field: fieldNameFor(index, `talent_namerow${rowIndex}`),
      advances_field: fieldNameFor(index, `times_takenrow${rowIndex}`),
      description_field: fieldNameFor(index, `descriptionrow${rowIndex}`),
      name_value: talentName,
      advances_value: advances,
      description_value: description
    };
  }
  pdfMapping.talents_free = talentsFree;

  return {
    character_name: readFieldValue(index, "imie") || "Brak Imienia",
    attributes,
    skills,
    talents,
    experience,
    profession_info: professionInfo,
    pdf_mapping: pdfMapping
  };
}

// ---------------------------------------------------------------------------
// Eksport
// ---------------------------------------------------------------------------

/** Dane wejsciowe do zapisu PDF (mirror payload z save_to_pdf/export_to_pdf). */
export interface PdfWritePayload {
  character_name: string;
  attributes: Record<string, AttributeEntry>;
  skills: Record<string, SkillEntry>;
  talents: Record<string, { advances?: number | string; description?: string }>;
  experience: { available: number; spent: number; total: number };
  profession: Record<string, string>;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Ustawia surowa wartosc /V pola (UTF-16BE dla bezpieczenstwa polskich znakow)
 * i usuwa zapisany wyglad, aby przegladarka/czytnik wygenerowal go ponownie.
 */
function setRawFieldValue(field: PDFField, value: string): void {
  const dict = field.acroField.dict;
  // Wartosci ASCII zostawiamy jako PDFString (krotsze), reszte jako UTF-16BE hex.
  // eslint-disable-next-line no-control-regex
  const isAscii = /^[\x00-\x7F]*$/.test(value);
  dict.set(PDFName.of("V"), isAscii ? PDFString.of(value) : PDFHexString.fromText(value));
  dict.delete(PDFName.of("AP"));
  for (const widget of field.acroField.getWidgets()) {
    widget.dict.delete(PDFName.of("AP"));
  }
}

/** Zapisuje dane postaci do formularza PDF na podstawie szablonu i mapowania. */
export async function writePdfCharacterData(
  sourceBytes: ArrayBuffer | Uint8Array,
  payload: PdfWritePayload,
  mapping: PdfMapping
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const index = buildFieldIndex(form.getFields());

  const updates: Record<string, string> = {};
  const setUpdate = (fieldName: string | null | undefined, value: string) => {
    if (fieldName) updates[fieldName] = value;
  };

  setUpdate(mapping.character_name, stringify(payload.character_name));

  for (const [key, fieldName] of Object.entries(mapping.experience)) {
    setUpdate(fieldName, stringify(payload.experience[key as keyof typeof payload.experience] || ""));
  }

  for (const [attrName, attrMapping] of Object.entries(mapping.attributes)) {
    const attrData = payload.attributes[attrName];
    if (!attrData) continue;
    setUpdate(attrMapping.initial, stringify(attrData.initial || ""));
    setUpdate(attrMapping.advanced, stringify(attrData.advanced || ""));
    setUpdate(attrMapping.current, stringify(attrData.initial + attrData.advanced));
  }

  for (const [skillName, skillMapping] of Object.entries(mapping.skills)) {
    const skillData = payload.skills[skillName];
    if (!skillData) continue;
    const currentValue = skillData.initial + skillData.advanced;
    setUpdate(skillMapping.advanced_field as string, stringify(skillData.advanced || ""));

    if (skillMapping.type === "basic") {
      const specField = skillMapping.specialization_field as string | null;
      const specValue = (skillMapping.specialization_value as string) ?? "";
      if (specField && extractSpecialization(skillName) !== specValue) {
        setUpdate(specField, stringify(extractSpecialization(skillName)));
      }
      setUpdate(skillMapping.total_field as string, stringify(currentValue || ""));
    } else {
      if (skillMapping.name_field && skillName !== skillMapping.name_value) {
        setUpdate(skillMapping.name_field as string, stringify(skillName));
      }
      if (skillMapping.attribute_field && skillData.attribute !== skillMapping.attribute_value) {
        setUpdate(skillMapping.attribute_field as string, stringify(skillData.attribute));
      }
      setUpdate(skillMapping.initial_field as string, stringify(skillData.initial || ""));
      setUpdate(skillMapping.current_field as string, stringify(currentValue || ""));
    }
  }

  for (const [talentName, talentMapping] of Object.entries(mapping.talents)) {
    const talentData = payload.talents[talentName];
    if (!talentData) {
      setUpdate(talentMapping.name_field as string, "");
      setUpdate(talentMapping.advances_field as string, "");
      setUpdate(talentMapping.description_field as string, "");
      continue;
    }
    if (talentMapping.name_field && talentName !== talentMapping.name_value) {
      setUpdate(talentMapping.name_field as string, stringify(talentName));
    }
    if (
      talentMapping.advances_field &&
      String(talentData.advances ?? "") !== String(talentMapping.advances_value ?? "")
    ) {
      setUpdate(talentMapping.advances_field as string, stringify(talentData.advances ?? ""));
    }
    if (
      talentMapping.description_field &&
      String(talentData.description ?? "") !== String(talentMapping.description_value ?? "")
    ) {
      setUpdate(talentMapping.description_field as string, stringify(talentData.description ?? ""));
    }
  }

  // Nowe talenty -> wolne wiersze karty.
  const mappedTalents = new Set(Object.keys(mapping.talents));
  const freeRows = [...mapping.talents_free];
  for (const [talentName, talentData] of Object.entries(payload.talents)) {
    if (mappedTalents.has(talentName)) continue;
    const row = freeRows.shift();
    if (!row) break;
    setUpdate(row.name_field, stringify(talentName));
    setUpdate(row.advances_field, stringify(talentData.advances ?? ""));
    setUpdate(row.description_field, stringify(talentData.description ?? ""));
  }

  // Profesja / klasa / sciezka.
  const professionFieldMap: Record<string, string> = {
    class: "class_field",
    profession: "profession_field",
    level_text: "level_field",
    path_text: "path_field",
    species: "species_field"
  };
  for (const [valueKey, fieldKey] of Object.entries(professionFieldMap)) {
    const fieldName = mapping.profession[fieldKey];
    if (fieldName && valueKey in payload.profession) {
      setUpdate(fieldName, stringify(payload.profession[valueKey]));
    }
  }

  // Zastosuj aktualizacje przez surowe /V (bez regeneracji wygladu przez pdf-lib).
  for (const [fieldName, value] of Object.entries(updates)) {
    const field = index.byName[fieldName];
    if (field) setRawFieldValue(field, value);
  }

  // Wymus regeneracje wygladu pol przez czytnik PDF.
  form.acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True);

  // KRYTYCZNE: nie pozwalamy pdf-lib regenerowac wygladu pol - wbudowany font
  // WinAnsi nie koduje polskich znakow (np. 0x0105) i rzucilby wyjatkiem.
  // Wartosci zapisujemy surowo (/V), a wyglad odtwarza czytnik (NeedAppearances).
  return doc.save({ updateFieldAppearances: false });
}
