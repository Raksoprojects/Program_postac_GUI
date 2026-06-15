import { writable } from "svelte/store";

const STORAGE_KEY = "wfrp4e:ui-scale";
const MIN = 0.7;
const MAX = 1.8;
const STEP = 0.1;

function clamp(value: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(value * 100) / 100));
}

function readInitial(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed)) {
        return clamp(parsed);
      }
    }
  } catch {
    /* localStorage niedostepny - uzyj wartosci domyslnej */
  }
  return 1;
}

const initial = readInitial();
const store = writable<number>(initial);

function apply(value: number): void {
  document.documentElement.style.setProperty("--ui-scale", String(value));
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignoruj brak localStorage */
  }
}

apply(initial);

store.subscribe(apply);

export const uiScale = {
  subscribe: store.subscribe,
  set(value: number): void {
    store.set(clamp(value));
  },
  increase(): void {
    store.update((v) => clamp(v + STEP));
  },
  decrease(): void {
    store.update((v) => clamp(v - STEP));
  },
  reset(): void {
    store.set(1);
  },
  MIN,
  MAX,
  STEP
};
