<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { ATTRIBUTES } from "../lib/rules";
  import { ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";
  import { getTalent } from "../lib/gameData";
  import type { TalentMax, TalentMaxType } from "../lib/types";
  import Modal from "./Modal.svelte";

  let textFilter = $state("");
  let onlyDevelopable = $state(false);

  const norm = (s: string) => s.trim().toLowerCase();

  let allRows = $derived(store.talentRows());

  let rows = $derived(
    allRows.filter((r) => {
      if (onlyDevelopable && !r.developable) return false;
      if (textFilter.trim()) {
        const q = norm(textFilter);
        return norm(r.name).includes(q) || norm(r.entry.description).includes(q);
      }
      return true;
    })
  );

  let phantoms = $derived(onlyDevelopable ? store.phantomTalents() : []);

  // --- Modal: dodaj z listy ---
  let showPicker = $state(false);
  let pickerSearch = $state("");
  let pickerSel = $state<string | null>(null);
  let available = $derived(store.availableTalentNames());
  let pickerList = $derived(
    pickerSearch.trim()
      ? available.filter((n) => norm(n).includes(norm(pickerSearch)))
      : available
  );

  function openPicker() {
    pickerSearch = "";
    pickerSel = null;
    showPicker = true;
  }
  function confirmPicker() {
    if (pickerSel) {
      store.addTalentFromList(pickerSel);
      showPicker = false;
    }
  }

  // --- Modal: talent wlasny ---
  let showCustom = $state(false);
  let cName = $state("");
  let cDesc = $state("");
  let cMaxType = $state<TalentMaxType>("none");
  let cMaxValue = $state(1);
  let cMaxAttr = $state("S");
  let customError = $state("");

  function openCustom() {
    cName = "";
    cDesc = "";
    cMaxType = "none";
    cMaxValue = 1;
    cMaxAttr = "S";
    customError = "";
    showCustom = true;
  }
  function buildMax(type: TalentMaxType, value: number, attr: string): TalentMax {
    if (type === "fixed") return { type, value: Math.max(1, Math.trunc(value)) };
    if (type === "characteristic")
      return { type, attr, attr_name: ATTRIBUTE_FULL_NAMES[attr] ?? attr };
    return { type: "none" };
  }
  function submitCustom() {
    const name = cName.trim();
    if (!name) {
      customError = "Podaj nazwę talentu.";
      return;
    }
    const ok = store.addCustomTalent(name, cDesc.trim(), buildMax(cMaxType, cMaxValue, cMaxAttr));
    if (!ok) {
      customError = "Taki talent już istnieje.";
      return;
    }
    showCustom = false;
  }

  // --- Modal: edytuj Maks ---
  let showMaxEdit = $state(false);
  let editName = $state("");
  let eMaxType = $state<TalentMaxType>("none");
  let eMaxValue = $state(1);
  let eMaxAttr = $state("S");

  function openMaxEdit(name: string) {
    const t = store.talentRows().find((r) => r.name === name);
    editName = name;
    const m = t?.entry.max ?? { type: "none" };
    eMaxType = m.type;
    eMaxValue = m.value ?? 1;
    eMaxAttr = m.attr ?? "S";
    showMaxEdit = true;
  }
  function submitMaxEdit() {
    store.setTalentMax(editName, buildMax(eMaxType, eMaxValue, eMaxAttr));
    showMaxEdit = false;
  }

  function maxLabel(max: number | null): string {
    return max === null ? "—" : String(max);
  }
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Talenty</h2>
      <p class="section-sub">
        Dodawaj talenty z listy lub własne, kupuj wykupienia (100 PD × numer) i pilnuj limitu (Maks).
        Rozwój spoza profesji kosztuje podwójnie, chyba że MG wyrazi zgodę.
      </p>
    </div>
  </header>

  <div class="controls panel">
    <div class="row1">
      <input
        type="text"
        placeholder="Wpisz fragment nazwy lub opisu talentu"
        bind:value={textFilter}
        class="grow"
      />
      <button class="ghost" onclick={() => (textFilter = "")}>Wyczyść filtr</button>
      <span class="count text-dim">Wyświetlane: {rows.length} / {allRows.length}</span>
    </div>
    <div class="row2">
      <button class="primary" onclick={openPicker}>Dodaj talent z listy</button>
      <button class="ghost" onclick={openCustom}>Dodaj własny talent</button>
      <label class="check">
        <input type="checkbox" bind:checked={onlyDevelopable} />
        Tylko rozwijalne (+)
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={store.talentOutOfProfession} />
        Rozwój spoza profesji (×2)
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={store.talentGmApproved} disabled={!store.talentOutOfProfession} />
        Zgoda MG (×1)
      </label>
    </div>
  </div>

  <div class="rows">
    {#each rows as row (row.name)}
      <div class="row panel" class:dev-row={row.developable}>
        <div class="top">
          <div class="name">
            <strong>{row.name}</strong>{row.developable ? " +" : ""}
            <span class="text-dim src">{row.entry.source}</span>
            {#if row.entry.is_new}<span class="chip accent tag">nowy</span>{/if}
          </div>
          <div class="stats">
            <span><span class="text-dim">Wykupienia:</span> <b class="val-accent">{row.entry.advances}</b></span>
            <span><span class="text-dim">Maks:</span> <b class="val-warning">{maxLabel(row.max)}</b></span>
          </div>
          <div class="btns">
            <button
              class="btn-sm"
              disabled={!store.engine.talentBelowMax(row.name, 1)}
              onclick={() => store.increaseTalent(row.name, 1)}>+1</button
            >
            <button
              class="btn-sm ghost"
              disabled={row.entry.advances <= (row.entry.base_advances ?? 0)}
              onclick={() => store.decreaseTalent(row.name, 1)}>−1</button
            >
            <button
              class="btn-sm prof"
              class:on={row.override}
              title="Oznacz jako rozwój profesyjny (per postać)"
              onclick={() => store.toggleTalentOverride(row.name)}
            >
              {row.override ? "★ Prof." : "☆ Prof."}
            </button>
            {#if row.entry.is_custom}
              <button class="btn-sm ghost" onclick={() => openMaxEdit(row.name)}>✎ Maks</button>
            {/if}
            {#if row.entry.is_new}
              <button class="btn-sm danger" onclick={() => store.removeNewTalent(row.name)}>Usuń</button>
            {/if}
          </div>
        </div>
        {#if row.entry.description}
          <p class="desc text-dim" title={row.entry.description}>ⓘ {row.entry.description}</p>
        {/if}
      </div>
    {/each}

    {#each phantoms as name (name)}
      <div class="row panel dev-row phantom">
        <div class="top">
          <div class="name"><strong>{name}</strong> +</div>
          <button class="btn-sm success" onclick={() => store.addTalentFromList(name)}>+ Dodaj</button>
        </div>
        <p class="desc text-dim">Talent z profesji – jeszcze nie wykupiony.</p>
      </div>
    {/each}

    {#if allRows.length === 0 && phantoms.length === 0}
      <p class="text-dim empty">Brak talentów. Dodaj pierwszy z listy lub własny.</p>
    {/if}
  </div>
</section>

{#if showPicker}
  <Modal title="Dodaj talent z listy" onClose={() => (showPicker = false)}>
    <input type="text" placeholder="Szukaj talentu…" bind:value={pickerSearch} />
    <div class="picker-list">
      {#each pickerList.slice(0, 200) as name (name)}
        <button
          class="pick-item"
          class:sel={pickerSel === name}
          onclick={() => (pickerSel = name)}
        >
          {name}
        </button>
      {/each}
      {#if pickerList.length === 0}
        <p class="text-dim">Brak pasujących talentów.</p>
      {/if}
    </div>
    {#if pickerSel}
      {@const t = getTalent(pickerSel)}
      <div class="preview panel">
        <strong>{pickerSel}</strong>
        {#if t?.description}<p class="text-dim">{t.description}</p>{/if}
      </div>
    {/if}
    {#snippet footer()}
      <button class="ghost" onclick={() => (showPicker = false)}>Anuluj</button>
      <button class="primary" disabled={!pickerSel} onclick={confirmPicker}>Dodaj</button>
    {/snippet}
  </Modal>
{/if}

{#if showCustom}
  <Modal title="Dodaj własny talent" onClose={() => (showCustom = false)}>
    <label class="fld">
      <span>Nazwa talentu</span>
      <input type="text" bind:value={cName} />
    </label>
    <label class="fld">
      <span>Opis</span>
      <textarea rows="4" bind:value={cDesc}></textarea>
    </label>
    <label class="fld">
      <span>Rodzaj Maksimum</span>
      <select bind:value={cMaxType}>
        <option value="none">brak</option>
        <option value="fixed">liczba</option>
        <option value="characteristic">bonus z cechy</option>
      </select>
    </label>
    {#if cMaxType === "fixed"}
      <label class="fld">
        <span>Wartość liczbowa</span>
        <input type="number" min="1" bind:value={cMaxValue} />
      </label>
    {:else if cMaxType === "characteristic"}
      <label class="fld">
        <span>Cecha</span>
        <select bind:value={cMaxAttr}>
          {#each ATTRIBUTES as code (code)}
            <option value={code}>{ATTRIBUTE_FULL_NAMES[code]} ({code})</option>
          {/each}
        </select>
      </label>
    {/if}
    {#if customError}<p class="val-danger">{customError}</p>{/if}
    {#snippet footer()}
      <button class="ghost" onclick={() => (showCustom = false)}>Anuluj</button>
      <button class="primary" onclick={submitCustom}>Dodaj</button>
    {/snippet}
  </Modal>
{/if}

{#if showMaxEdit}
  <Modal title={`Maksimum: ${editName}`} onClose={() => (showMaxEdit = false)}>
    <label class="fld">
      <span>Rodzaj Maksimum</span>
      <select bind:value={eMaxType}>
        <option value="none">brak</option>
        <option value="fixed">liczba</option>
        <option value="characteristic">bonus z cechy</option>
      </select>
    </label>
    {#if eMaxType === "fixed"}
      <label class="fld">
        <span>Wartość liczbowa</span>
        <input type="number" min="1" bind:value={eMaxValue} />
      </label>
    {:else if eMaxType === "characteristic"}
      <label class="fld">
        <span>Cecha</span>
        <select bind:value={eMaxAttr}>
          {#each ATTRIBUTES as code (code)}
            <option value={code}>{ATTRIBUTE_FULL_NAMES[code]} ({code})</option>
          {/each}
        </select>
      </label>
    {/if}
    {#snippet footer()}
      <button class="ghost" onclick={() => (showMaxEdit = false)}>Anuluj</button>
      <button class="primary" onclick={submitMaxEdit}>Zapisz</button>
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
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .name {
    flex: 1;
    min-width: calc(180px * var(--ui-scale));
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .src {
    font-size: var(--fs-sm);
  }

  .tag {
    font-size: calc(11px * var(--ui-scale));
  }

  .stats {
    display: flex;
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

  .desc {
    font-size: var(--fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
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

  textarea {
    font-family: inherit;
    font-size: var(--fs-sm);
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    resize: vertical;
  }

  .picker-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: calc(280px * var(--ui-scale));
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-1);
  }

  .pick-item {
    text-align: left;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    min-height: auto;
    padding: var(--space-2);
  }

  .pick-item:hover {
    background: var(--bg-elevated);
  }

  .pick-item.sel {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .preview {
    padding: var(--space-3);
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
