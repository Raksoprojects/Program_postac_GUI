<script lang="ts">
  import { store, ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";
  import { ATTRIBUTES } from "../lib/rules";
  import * as gameData from "../lib/gameData";
  import {
    describeModifierDef,
    instantiateModifier,
    modifierEffectLabels,
    newModifierId
  } from "../lib/modifiers";
  import type { CharacterModifier, ModifierDef, ModifierValue } from "../lib/types";
  import Modal from "./Modal.svelte";
  import ModifierEditorModal from "./ModifierEditorModal.svelte";

  let mods = $derived(store.modifiers);
  let totals = $derived.by(() => {
    const sums = store.modifierTotals;
    return ATTRIBUTES.map((code) => ({ code, value: sums[code] ?? 0 })).filter((t) => t.value !== 0);
  });
  let expanded = $state<Record<string, boolean>>({});

  // --- Katalog ---
  const categories = gameData.modifierCategories();
  let showCatalog = $state(false);
  let catFilter = $state("");
  let search = $state("");
  let picked = $state<ModifierDef | null>(null);

  const norm = (s: string) => s.trim().toLowerCase();
  let catalog = $derived(
    gameData
      .modifierEntries(catFilter || undefined)
      .filter((e) => !search.trim() || norm(e.name).includes(norm(search)) || norm(e.effect ?? "").includes(norm(search)))
  );

  function openCatalog() {
    picked = null;
    search = "";
    showCatalog = true;
  }

  /** Zasady domowe: Przeznaczenie i Bohater jako jedna pula Punktow Przeznaczenia. */
  let luckMerged = $derived(gameData.isLuckPoolMerged(store.ruleset));

  const signed = (v: ModifierValue): string =>
    typeof v === "number" ? (v > 0 ? `+${v}` : `${v}`) : v.startsWith("-") ? v : `+${v}`;

  /** Krotki opis wartosci wpisu katalogu (przed rzutem kosci). */
  function defLabels(def: ModifierDef): string[] {
    const out: string[] = [];
    for (const [k, v] of Object.entries(def.characteristics ?? {})) out.push(`${k} ${signed(v)}`);
    for (const [k, v] of Object.entries(def.skills ?? {})) out.push(`${k} ${signed(v)}`);
    for (const [k, v] of Object.entries(def.maxCharacteristics ?? {})) out.push(`${k} maks. ${v}`);
    if (def.movement) out.push(`Szybkość ${signed(def.movement)}`);
    if (def.wounds) out.push(`Żywotność ${signed(def.wounds)}`);
    if (luckMerged) {
      // Zasady domowe: jedna pula Przeznaczenia (suma zmian Przeznaczenia i Bohatera).
      const luck = (Number(def.fate) || 0) + (Number(def.resilience) || 0);
      if (luck) out.push(`Przeznaczenie ${signed(luck)}`);
    } else {
      if (def.fate) out.push(`Przeznaczenie ${signed(def.fate)}`);
      if (def.resilience) out.push(`Bohater ${signed(def.resilience)}`);
    }
    return out;
  }

  // --- Edytor (dodawanie z katalogu / wlasny / edycja) ---
  let editor = $state<{
    initial: CharacterModifier;
    def: ModifierDef | null;
    editId: string | null;
  } | null>(null);

  function useCatalogEntry() {
    if (!picked) return;
    const roll = 1 + Math.floor(Math.random() * 100);
    const location = picked.rollLocation ? gameData.modifierLocationForRoll(roll) : undefined;
    editor = {
      initial: instantiateModifier(picked, gameData.modifierCategoryLabel(picked.category), Math.random, location),
      def: picked,
      editId: null
    };
    showCatalog = false;
  }

  function openCustom() {
    editor = {
      initial: {
        id: newModifierId(),
        name: "",
        category: "Własne",
        description: "",
        active: true,
        characteristics: {}
      },
      def: null,
      editId: null
    };
  }

  function openEdit(mod: CharacterModifier) {
    editor = { initial: mod, def: null, editId: mod.id };
  }

  function onEditorConfirm(mod: CharacterModifier) {
    if (!editor) return;
    if (editor.editId) store.updateModifier(editor.editId, mod);
    else store.addModifier(mod);
    editor = null;
  }

  function removeMod(mod: CharacterModifier) {
    if (confirm(`Usunąć modyfikator „${mod.name}”?`)) store.removeModifier(mod.id);
  }
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Modyfikatory</h2>
      <p class="section-sub">
        Mutacje, wampiryzm, Dary Chaosu i Krwi, klątwy i inne stałe zmiany cech. Modyfikatory
        nie są rozwinięciami — zmieniają wartość cech/umiejętności, ale nie koszty PD.
      </p>
    </div>
  </header>

  <div class="controls panel">
    <div class="row1">
      <button class="primary" onclick={openCatalog}>Dodaj z katalogu</button>
      <button class="ghost" onclick={openCustom}>Dodaj własny</button>
      <span class="count text-dim">Modyfikatory: {mods.filter((m) => m.active).length} aktywne / {mods.length}</span>
    </div>
    {#if totals.length}
      <div class="totals">
        <span class="text-dim">Suma zmian cech:</span>
        {#each totals as t (t.code)}
          <span class="chip {t.value > 0 ? 'success' : 'warning'}" title={ATTRIBUTE_FULL_NAMES[t.code]}>
            {t.code} {t.value > 0 ? "+" : ""}{t.value}
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="rows">
    {#each mods as mod (mod.id)}
      {@const labels = modifierEffectLabels(mod, luckMerged)}
      <div class="row panel" class:inactive={!mod.active}>
        <div class="top">
          <div class="name">
            <strong>{mod.name}</strong>
            {#if mod.location}<span class="text-dim">({mod.location})</span>{/if}
            <span class="chip tag">{mod.category}</span>
            {#if !mod.active}<span class="chip tag warning">wyłączony</span>{/if}
          </div>
          <div class="btns">
            <label class="check">
              <input
                type="checkbox"
                checked={mod.active}
                onchange={(e) => store.setModifierActive(mod.id, e.currentTarget.checked)}
              />
              Aktywny
            </label>
            <button class="btn-sm ghost" onclick={() => openEdit(mod)}>✎ Edytuj</button>
            <button class="btn-sm danger" onclick={() => removeMod(mod)}>Usuń</button>
          </div>
        </div>
        {#if labels.length}
          <div class="fx">
            {#each labels as l (l)}<span class="chip">{l}</span>{/each}
          </div>
        {/if}
        {#if mod.description}
          <button
            type="button"
            class="desc text-dim"
            class:expanded={expanded[mod.id]}
            aria-expanded={expanded[mod.id] ? "true" : "false"}
            onclick={() => (expanded[mod.id] = !expanded[mod.id])}
          >ⓘ {mod.description}</button>
        {/if}
      </div>
    {/each}
    {#if mods.length === 0}
      <p class="text-dim empty">
        Brak modyfikatorów. Dodaj mutację, przemianę w wampira lub inny efekt z katalogu albo własny.
      </p>
    {/if}
  </div>
</section>

{#if showCatalog}
  <Modal title="Katalog modyfikatorów" onClose={() => (showCatalog = false)}>
    <div class="picker-head">
      <select bind:value={catFilter} aria-label="Kategoria">
        <option value="">Wszystkie kategorie</option>
        {#each categories as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
      </select>
      <input type="text" placeholder="Szukaj w nazwie lub opisie…" bind:value={search} />
    </div>
    {#if catFilter}
      {@const cat = categories.find((c) => c.id === catFilter)}
      {#if cat?.description || cat?.source}
        <p class="text-dim cat-desc">{cat.description ?? ""} {cat.source ? `Źródło: ${cat.source}.` : ""}</p>
      {/if}
    {/if}
    <div class="picker-list">
      {#each catalog.slice(0, 300) as e, i (`${e.category}|${e.name}|${i}`)}
        <button class="pick-item" class:sel={picked === e} onclick={() => (picked = e)}>
          <span>{e.name}{#if e.source} <span class="text-dim small">({gameData.sourceShort(e.source)})</span>{/if}</span>
          <span class="text-dim small">
            {e.severity ? `${e.severity} · ` : ""}{catFilter ? "" : gameData.modifierCategoryLabel(e.category)}
          </span>
        </button>
      {/each}
      {#if catalog.length === 0}<p class="text-dim">Brak pasujących wpisów.</p>{/if}
    </div>
    {#if picked}
      {@const labels = defLabels(picked)}
      <div class="preview panel">
        <strong>{picked.name}</strong>
        {#if labels.length}
          <div class="fx">{#each labels as l (l)}<span class="chip">{l}</span>{/each}</div>
        {/if}
        <p class="text-dim">{describeModifierDef(picked)}</p>
      </div>
    {/if}
    {#snippet footer()}
      <button class="ghost" onclick={() => (showCatalog = false)}>Anuluj</button>
      <button class="primary" disabled={!picked} onclick={useCatalogEntry}>Dalej…</button>
    {/snippet}
  </Modal>
{/if}

{#if editor}
  <ModifierEditorModal
    initial={editor.initial}
    def={editor.def}
    title={editor.editId ? "Edytuj modyfikator" : "Dodaj modyfikator"}
    confirmLabel={editor.editId ? "Zapisz" : "Dodaj"}
    onConfirm={onEditorConfirm}
    onClose={() => (editor = null)}
  />
{/if}

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  .row1,
  .totals,
  .fx {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .count {
    margin-left: auto;
    font-size: var(--fs-sm);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }
  .row.inactive {
    opacity: 0.6;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  .name {
    flex: 1;
    min-width: calc(200px * var(--ui-scale));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .tag {
    font-size: calc(11px * var(--ui-scale));
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
  }
  .desc {
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    min-height: auto;
    font-size: var(--fs-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }
  .desc.expanded {
    white-space: normal;
  }
  .empty {
    padding: var(--space-3);
  }
  .picker-head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .picker-head input {
    flex: 1;
    min-width: calc(180px * var(--ui-scale));
  }
  .cat-desc {
    font-size: var(--fs-sm);
  }
  .picker-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: calc(320px * var(--ui-scale));
    overflow-y: auto;
  }
  .pick-item {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    text-align: left;
    background: var(--bg-panel-2);
    border: 1px solid transparent;
  }
  .pick-item.sel {
    border-color: var(--accent);
  }
  .small {
    font-size: var(--fs-sm);
  }
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  @media (max-width: 640px) {
    .btns,
    .count {
      margin-left: 0;
    }
  }
</style>
