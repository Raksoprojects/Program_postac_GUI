<script lang="ts">
  import { untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import Autocomplete from "./Autocomplete.svelte";
  import { ATTRIBUTES } from "../lib/rules";
  import { ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";
  import * as gameData from "../lib/gameData";
  import { instantiateModifier, isDiceValue } from "../lib/modifiers";
  import type { CharacterModifier, ModifierDef } from "../lib/types";

  let {
    initial,
    def = null,
    title,
    confirmLabel = "Zapisz",
    onConfirm,
    onClose
  }: {
    /** Wartosci startowe (z katalogu po rzucie albo istniejacy modyfikator). */
    initial: CharacterModifier;
    /** Wpis katalogu (do ponownego rzutu koscmi); null dla wlasnych/edycji. */
    def?: ModifierDef | null;
    title: string;
    confirmLabel?: string;
    onConfirm: (mod: CharacterModifier) => void;
    onClose: () => void;
  } = $props();

  // Lokalna, edytowalna kopia (formularz) - celowo tylko wartosc startowa.
  const start = untrack(() => structuredClone($state.snapshot(initial)) as CharacterModifier);
  let draft = $state<CharacterModifier>(start);
  let skillRows = $state<{ name: string; value: number }[]>(
    Object.entries(start.skills ?? {}).map(([name, value]) => ({ name, value }))
  );
  let error = $state("");

  const hasDice = $derived(
    !!def &&
      [...Object.values(def.characteristics ?? {}), ...Object.values(def.skills ?? {})].some(isDiceValue)
  );
  const locations = gameData.modifierLocationNames();
  const skillOptions = gameData.allSkillNames();

  function charValue(code: string): number {
    return draft.characteristics[code] ?? 0;
  }
  function setChar(code: string, raw: string) {
    const n = Math.trunc(Number(raw));
    const next = { ...draft.characteristics };
    if (Number.isFinite(n) && n !== 0) next[code] = n;
    else delete next[code];
    draft.characteristics = next;
  }
  function setNum(key: "movement" | "wounds" | "fate" | "resilience", raw: string) {
    const n = Math.trunc(Number(raw));
    draft[key] = Number.isFinite(n) && n !== 0 ? n : undefined;
  }

  /** Ponowny rzut koscmi z wpisu katalogu (zachowuje nazwe/opis/lokalizacje). */
  function reroll() {
    if (!def) return;
    const fresh = instantiateModifier(def, draft.category, Math.random, draft.location);
    draft.characteristics = fresh.characteristics;
    skillRows = Object.entries(fresh.skills ?? {}).map(([name, value]) => ({ name, value }));
  }

  function rollLocation() {
    const roll = 1 + Math.floor(Math.random() * 100);
    draft.location = gameData.modifierLocationForRoll(roll) ?? draft.location;
  }

  function dropCap(code: string) {
    const next = { ...(draft.maxCharacteristics ?? {}) };
    delete next[code];
    draft.maxCharacteristics = Object.keys(next).length ? next : undefined;
  }

  function submit() {
    const name = draft.name.trim();
    if (!name) {
      error = "Podaj nazwę modyfikatora.";
      return;
    }
    const skills: Record<string, number> = {};
    for (const r of skillRows) {
      const n = Math.trunc(Number(r.value));
      if (r.name.trim() && Number.isFinite(n) && n !== 0) {
        skills[r.name.trim()] = (skills[r.name.trim()] ?? 0) + n;
      }
    }
    const out: CharacterModifier = {
      ...$state.snapshot(draft),
      name,
      category: draft.category.trim() || "Własne",
      skills: Object.keys(skills).length ? skills : undefined
    };
    onConfirm(out);
  }
</script>

<Modal {title} {onClose}>
  <div class="grid2">
    <label class="fld">
      <span>Nazwa</span>
      <input type="text" bind:value={draft.name} />
    </label>
    <label class="fld">
      <span>Kategoria</span>
      <input type="text" bind:value={draft.category} placeholder="np. Mutacja, Klątwa, Wampiryzm" />
    </label>
  </div>

  <label class="fld">
    <span>Opis / efekt</span>
    <textarea rows="3" bind:value={draft.description}></textarea>
  </label>

  {#if locations.length && (def?.rollLocation || draft.location)}
    <div class="loc">
      <label class="fld">
        <span>Lokalizacja</span>
        <select bind:value={draft.location}>
          <option value={undefined}>—</option>
          {#each locations as l (l)}<option value={l}>{l}</option>{/each}
        </select>
      </label>
      <button type="button" class="btn-sm ghost" onclick={rollLocation}>🎲 Losuj (k100)</button>
    </div>
  {/if}

  <div class="sub-head">
    <span class="lbl">Zmiana cech</span>
    {#if hasDice}
      <button type="button" class="btn-sm ghost" onclick={reroll} title="Wpis zawiera kości — rzuć ponownie">
        🎲 Przerzuć kości
      </button>
    {/if}
  </div>
  <div class="chars">
    {#each ATTRIBUTES as code (code)}
      <label class="cfld" title={ATTRIBUTE_FULL_NAMES[code]}>
        <span>{code}</span>
        <input
          type="number"
          value={charValue(code)}
          oninput={(e) => setChar(code, e.currentTarget.value)}
        />
      </label>
    {/each}
  </div>

  {#if draft.maxCharacteristics && Object.keys(draft.maxCharacteristics).length}
    <div class="caps">
      <span class="lbl">Górny limit cech:</span>
      {#each Object.entries(draft.maxCharacteristics) as [code, cap] (code)}
        <span class="chip">{code} maks. {cap}
          <button type="button" class="rm" aria-label="Usuń limit" onclick={() => dropCap(code)}>✕</button>
        </span>
      {/each}
    </div>
  {/if}

  <div class="chars">
    <label class="cfld">
      <span>Szybkość</span>
      <input type="number" value={draft.movement ?? 0} oninput={(e) => setNum("movement", e.currentTarget.value)} />
    </label>
    <label class="cfld">
      <span>Żywotność</span>
      <input type="number" value={draft.wounds ?? 0} oninput={(e) => setNum("wounds", e.currentTarget.value)} />
    </label>
    <label class="cfld">
      <span>Przeznacz.</span>
      <input type="number" value={draft.fate ?? 0} oninput={(e) => setNum("fate", e.currentTarget.value)} />
    </label>
    <label class="cfld">
      <span>Bohater</span>
      <input type="number" value={draft.resilience ?? 0} oninput={(e) => setNum("resilience", e.currentTarget.value)} />
    </label>
  </div>

  <div class="sub-head">
    <span class="lbl">Zmiana umiejętności</span>
    <button type="button" class="btn-sm ghost" onclick={() => (skillRows = [...skillRows, { name: "", value: 0 }])}>
      + Dodaj umiejętność
    </button>
  </div>
  {#each skillRows as row, i (i)}
    <div class="skill-row">
      <Autocomplete bind:value={row.name} options={skillOptions} placeholder="Umiejętność" />
      <input type="number" class="num" bind:value={row.value} />
      <button type="button" class="btn-sm danger" aria-label="Usuń" onclick={() => (skillRows = skillRows.filter((_, j) => j !== i))}>✕</button>
    </div>
  {/each}

  <label class="check">
    <input type="checkbox" bind:checked={draft.active} />
    Aktywny (wpływa na wartości postaci)
  </label>
  <p class="text-dim hint">
    Zmiany cech nie są rozwinięciami — nie zmieniają kosztów PD ani kompletowania profesji.
    Szybkość, Przeznaczenie i Punkty Bohatera są doliczane do statystyk przy włączeniu
    i odejmowane przy wyłączeniu/usunięciu.
  </p>
  {#if error}<p class="val-danger">{error}</p>{/if}

  {#snippet footer()}
    <button class="ghost" onclick={onClose}>Anuluj</button>
    <button class="primary" onclick={submit}>{confirmLabel}</button>
  {/snippet}
</Modal>

<style>
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(calc(200px * var(--ui-scale)), 1fr));
    gap: var(--space-2);
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .fld span,
  .lbl {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .loc,
  .sub-head,
  .caps {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--space-2);
    justify-content: space-between;
  }
  .caps {
    justify-content: flex-start;
    align-items: center;
  }
  .chars {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(72px * var(--ui-scale)), 1fr));
    gap: var(--space-2);
  }
  .cfld {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cfld span {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
  .cfld input,
  .num {
    width: 100%;
    min-width: 0;
  }
  .skill-row {
    display: grid;
    grid-template-columns: 1fr calc(80px * var(--ui-scale)) auto;
    gap: var(--space-2);
    align-items: center;
  }
  .rm {
    min-height: auto;
    padding: 0 var(--space-1);
    background: transparent;
    border: none;
  }
  .hint {
    font-size: var(--fs-sm);
  }
  textarea {
    font: inherit;
    resize: vertical;
  }
</style>
