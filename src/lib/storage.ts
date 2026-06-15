/**
 * Trwalosc i operacje na plikach dla wersji webowej.
 *
 * - Autozapis biezacej postaci + historii w localStorage (przetrwanie odswiezenia).
 * - Pobieranie plikow (JSON / PDF) przez link Blob (dziala na telefonie i desktopie).
 * - Wybor pliku przez ukryty <input type=file> (bez zaleznosci od File System Access API,
 *   ktore nie jest dostepne na iOS/Firefox).
 */

const AUTOSAVE_KEY = "wfrp4e:autosave";

export interface AutosaveSnapshot {
  character: unknown;
  history: unknown;
  overrideSkills: string[];
  overrideTalents: string[];
}

/** Zapisuje migawke stanu do localStorage (best-effort). */
export function saveAutosave(snapshot: AutosaveSnapshot): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn("Autozapis nieudany:", e);
  }
}

/** Odczytuje migawke stanu z localStorage (lub null). */
export function loadAutosave(): AutosaveSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutosaveSnapshot;
  } catch (e) {
    console.warn("Odczyt autozapisu nieudany:", e);
    return null;
  }
}

/** Usuwa autozapis. */
export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** Tworzy bezpieczna nazwe pliku z nazwy postaci. */
export function safeFileName(name: string, extension: string): string {
  const base = (name || "postac")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zA-Z_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${base || "postac"}.${extension}`;
}

/** Pobiera dane jako plik (Blob) o podanej nazwie. */
export function downloadBlob(
  filename: string,
  data: string | Uint8Array,
  mime: string
): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Otwiera dialog wyboru pliku i zwraca pierwszy wybrany plik (lub null). */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null));
    // Anulowanie dialogu (focus wraca bez change) - rozwiazujemy null po czasie.
    window.addEventListener(
      "focus",
      () => setTimeout(() => finish(null), 500),
      { once: true }
    );
    document.body.appendChild(input);
    input.click();
  });
}
