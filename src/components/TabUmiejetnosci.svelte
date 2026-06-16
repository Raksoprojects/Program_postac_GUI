<script lang="ts">
  import { store, ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";
  import { ATTRIBUTES } from "../lib/rules";
  import { characteristicToCode } from "../lib/gameData";
  import Modal from "./Modal.svelte";
  import Autocomplete from "./Autocomplete.svelte";

  let textFilter = $state("");
  let attrFilter = $state("");
  let onlyDevelopable = $state(false);

  // Modal dodawania umiejetnosci
  let showAdd = $state(false);
  let newName = $state("");
  let newAttr = $state<string>("Int");
  let newAdv = $state(0);
  let addError = $state("");

  const norm = (s: string) => s.trim().toLowerCase();

  let allRows = $derived(store.skillRows());

  let rows = $derived(
    allRows.filter((r) => {
      if (onlyDevelopable && !r.developable) return false;
      if (attrFilter && characteristicToCode(r.attribute) !== attrFilter) return false;
      if (textFilter.trim()) {
        const q = norm(textFilter);
        return norm(r.name).includes(q) || norm(r.attribute).includes(q);
      }
      return true;
    })
  );

  let phantoms = $derived(onlyDevelopable ? store.phantomSkills() : []);
  let skillSuggestions = $derived(store.availableSkillNames());

  function clearFilters() {
    textFilter = "";
    attrFilter = "";
    onlyDevelopable = false;
  }

  function openAdd() {
    newName = "";
    newAttr = "Int";
    newAdv = 0;
    addError = "";
    showAdd = true;
  }

  function onPickSkill(name: string) {
    const code = store.skillBaseAttr(name);
    if (code) newAttr = code;
  }

  function addPhantom(name: string) {
    const code = store.skillBaseAttr(name) ?? "Int";
    store.addSkill(name, code);
  }

  function submitAdd() {
    const name = newName.trim();
    if (!name) {
      addError = "Podaj nazwę umiejętności.";
      return;
    }
    const ok = store.addSkill(name, newAttr, Math.max(0, Math.trunc(newAdv)));
    if (!ok) {
      addError = "Taka umiejętność już istnieje.";
      return;
    }
    showAdd = false;
  }
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Umiejętności</h2>
      <p class="section-sub">
        Filtruj po nazwie lub atrybucie i sprawdzaj, ile rozwinięć da się jeszcze kupić.
      </p>
    </div>
  </header>

  <div class="controls panel">
    <div class="row1">
      <input
        type="text"
        placeholder="Wpisz fragment nazwy lub atrybut, np. Int albo Plotkowanie"
        bind:value={textFilter}
        class="grow"
      />
      <select bind:value={attrFilter} aria-label="Filtr po cesze">
        <option value="">Wszystkie cechy</option>
        {#each ATTRIBUTES as code (code)}
          <option value={code}>{ATTRIBUTE_FULL_NAMES[code]} ({code})</option>
        {/each}
      </select>
      <button class="ghost" onclick={clearFilters}>Wyczyść filtr</button>
      <button class="primary" onclick={openAdd}>Dodaj umiejętność</button>
    </div>
    <div class="row2">
      <label class="check">
        <input type="checkbox" bind:checked={onlyDevelopable} />
        Tylko rozwijalne (+)
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={store.attrGmApproved} />
        Zgoda MG (spoza profesji ×1)
      </label>
      <span class="count text-dim">Wyświetlane: {rows.length} / {allRows.length}</span>
    </div>
  </div>

  <div class="rows">
    {#each rows as row (row.name)}
      <div class="row panel" class:dev-row={row.developable}>
        <div class="name">
          <strong>{row.name}</strong>
          <span class="text-dim">({row.attribute}){row.developable ? " +" : ""}</span>
          {#if row.entry.is_new}<span class="chip accent tag">nowa</span>{/if}
        </div>
        <div class="stats">
          <span><span class="text-dim">Pocz:</span> {row.entry.initial}</span>
          <span><span class="text-dim">Rozw:</span> <b class="val-accent">{row.entry.advanced}</b></span>
          <span><span class="text-dim">Suma:</span> <b>{row.total}</b></span>
          <span><span class="text-dim">Maks:</span> <b class="val-warning">{row.maxBuy}</b></span>
        </div>
        <div class="btns">
          <button class="btn-sm" disabled={row.maxBuy < 1} onclick={() => store.increaseSkill(row.name, 1)}>+1</button>
          <button class="btn-sm" disabled={row.maxBuy < 5} onclick={() => store.increaseSkill(row.name, 5)}>+5</button>
          {#if row.entry.is_new}
            <button class="btn-sm ghost" disabled={row.entry.advanced <= 0} onclick={() => store.decreaseSkill(row.name, 1)}>−1</button>
          {:else}
            <button class="btn-sm ghost" disabled={row.entry.advanced <= row.entry.base_advanced} onclick={() => store.decreaseSkill(row.name, 1)}>−1</button>
          {/if}
          <button
            class="btn-sm prof"
            class:on={row.override}
            title="Oznacz jako rozwój profesyjny (per postać)"
            onclick={() => store.toggleSkillOverride(row.name)}
          >
            {row.override ? "★ Prof." : "☆ Prof."}
          </button>
          {#if row.entry.is_new}
            <button class="btn-sm danger" onclick={() => store.removeNewSkill(row.name)}>Usuń</button>
          {/if}
        </div>
      </div>
    {/each}
    {#each phantoms as name (name)}
      <div class="row panel dev-row phantom">
        <div class="name">
          <strong>{name}</strong> <span class="text-dim">+</span>
        </div>
        <div class="stats text-dim">Umiejętność z profesji – jeszcze nieposiadana.</div>
        <div class="btns">
          <button class="btn-sm success" onclick={() => addPhantom(name)}>+ Dodaj</button>
        </div>
      </div>
    {/each}
    {#if allRows.length === 0 && phantoms.length === 0}
      <p class="text-dim empty">Brak umiejętności. Dodaj pierwszą przyciskiem „Dodaj umiejętność".</p>
    {:else if rows.length === 0 && phantoms.length === 0}
      <p class="text-dim empty">Brak umiejętności spełniających filtr.</p>
    {/if}
  </div>
</section>

{#if showAdd}
  <Modal title="Dodaj umiejętność" onClose={() => (showAdd = false)}>
    <label class="fld">
      <span>Nazwa umiejętności</span>
      <Autocomplete
        bind:value={newName}
        options={skillSuggestions}
        placeholder="np. Wiedza (Medycyna) – zacznij pisać"
        onpick={onPickSkill}
      />
    </label>
    <label class="fld">
      <span>Atrybut</span>
      <select bind:value={newAttr}>
        {#each ATTRIBUTES as code (code)}
          <option value={code}>{ATTRIBUTE_FULL_NAMES[code]} ({code})</option>
        {/each}
      </select>
    </label>
    <label class="fld">
      <span>Rozwinięcia (kupowane od razu)</span>
      <input type="number" min="0" bind:value={newAdv} />
    </label>
    <p class="text-dim">Wartość początkowa będzie równa wartości przypisanej cechy.</p>
    {#if addError}<p class="val-danger">{addError}</p>{/if}
    {#snippet footer()}
      <button class="ghost" onclick={() => (showAdd = false)}>Anuluj</button>
      <button class="primary" onclick={submitAdd}>Dodaj</button>
    {/snippet}
  </Modal>
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
  .row2 {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .grow {
    flex: 1;
    min-width: calc(200px * var(--ui-scale));
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
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
  }

  .name {
    min-width: calc(200px * var(--ui-scale));
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .tag {
    font-size: calc(11px * var(--ui-scale));
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-variant-numeric: tabular-nums;
  }

  .btns {
    display: flex;
    gap: var(--space-1);
    margin-left: auto;
    flex-wrap: wrap;
  }

  .prof.on {
    border-color: var(--dev-border);
    background: var(--dev-bg);
    color: var(--info-strong);
  }

  .empty {
    padding: var(--space-3);
  }

  .fld {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .fld span {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }

  @media (max-width: 640px) {
    .btns {
      margin-left: 0;
      width: 100%;
    }
    .count {
      margin-left: 0;
    }
  }
</style>
