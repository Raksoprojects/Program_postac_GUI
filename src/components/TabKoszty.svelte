<script lang="ts">
  import { store, ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";
  import { calculateAdvancementCost, type AdvancementType } from "../lib/rules";

  interface Item {
    key: string;
    label: string;
    type: AdvancementType;
    currentAdv: number;
    currentValue: number;
  }

  let items = $derived.by<Item[]>(() => {
    const out: Item[] = [];
    for (const r of store.attributeRows()) {
      out.push({
        key: `cecha:${r.code}`,
        label: `${r.fullName} (${r.code})${r.developable ? " +" : ""}`,
        type: "cecha",
        currentAdv: r.entry.advanced,
        currentValue: r.total
      });
    }
    for (const r of store.skillRows()) {
      out.push({
        key: `umiej:${r.name}`,
        label: `${r.name}${r.developable ? " +" : ""}`,
        type: "umiejetnosc",
        currentAdv: r.entry.advanced,
        currentValue: r.total
      });
    }
    return out;
  });

  // Kalkulator
  let selKey = $state("");
  let count = $state(1);
  let selected = $derived(items.find((i) => i.key === selKey));
  let calcCost = $derived(
    selected ? calculateAdvancementCost(selected.type, selected.currentAdv, Math.max(0, Math.trunc(count))) : null
  );

  // Tabela
  let tableFilter = $state("");
  const norm = (s: string) => s.trim().toLowerCase();
  let tableItems = $derived(
    tableFilter.trim() ? items.filter((i) => norm(i.label).includes(norm(tableFilter))) : items
  );

  function cost(item: Item, n: number): number {
    return calculateAdvancementCost(item.type, item.currentAdv, n);
  }

  let attrItems = $derived(tableItems.filter((i) => i.type === "cecha"));
  let skillItems = $derived(tableItems.filter((i) => i.type === "umiejetnosc"));

  void ATTRIBUTE_FULL_NAMES;
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Koszty rozwinięć</h2>
      <p class="section-sub">
        Policz koszt dowolnej liczby rozwinięć lub porównaj progi 5/10/15/20 w tabeli.
      </p>
    </div>
  </header>

  <div class="calc panel">
    <h3 class="section-title">Kalkulator</h3>
    <div class="calc-row">
      <label class="fld grow">
        <span>Cecha / Umiejętność</span>
        <select bind:value={selKey}>
          <option value="">— wybierz —</option>
          {#each items as it (it.key)}
            <option value={it.key}>{it.label}</option>
          {/each}
        </select>
      </label>
      <label class="fld">
        <span>Liczba rozwinięć</span>
        <input type="number" min="1" bind:value={count} />
      </label>
      <div class="result">
        <span class="text-dim">Typ: {selected ? (selected.type === "cecha" ? "Cecha" : "Umiejętność") : "—"}</span>
        <span class="text-dim">Aktualne rozwinięcia: {selected ? selected.currentAdv : "—"}</span>
        <span class="big val-success">Koszt: {calcCost === null ? "—" : `${calcCost} PD`}</span>
      </div>
    </div>
  </div>

  <div class="table panel">
    <div class="tbl-head">
      <h3 class="section-title">Szybkie tabele kosztów</h3>
      <div class="filter">
        <input type="text" placeholder="Filtr tabeli…" bind:value={tableFilter} />
        <button class="btn-sm ghost" onclick={() => (tableFilter = "")}>Wyczyść</button>
      </div>
    </div>

    <div class="grid head">
      <span>Typ</span><span>Cecha / Umiejętność</span><span>Wart.</span>
      <span>5</span><span>10</span><span>15</span><span>20</span>
    </div>

    {#if attrItems.length}
      <div class="divider val-success">─ CECHY ─</div>
      {#each attrItems as it (it.key)}
        <div class="grid">
          <span class="text-dim">Cecha</span><span>{it.label}</span><span>{it.currentValue}</span>
          <span>{cost(it, 5)}</span><span>{cost(it, 10)}</span><span>{cost(it, 15)}</span><span>{cost(it, 20)}</span>
        </div>
      {/each}
    {/if}

    {#if skillItems.length}
      <div class="divider val-success">─ UMIEJĘTNOŚCI ─</div>
      {#each skillItems as it (it.key)}
        <div class="grid">
          <span class="text-dim">Umiej.</span><span>{it.label}</span><span>{it.currentValue}</span>
          <span>{cost(it, 5)}</span><span>{cost(it, 10)}</span><span>{cost(it, 15)}</span><span>{cost(it, 20)}</span>
        </div>
      {/each}
    {/if}

    {#if tableItems.length === 0}
      <p class="text-dim empty">Brak pozycji spełniających filtr.</p>
    {/if}
  </div>
</section>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .calc,
  .table {
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .calc-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-end;
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

  .grow {
    flex: 1;
    min-width: calc(220px * var(--ui-scale));
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-left: auto;
    text-align: right;
  }

  .big {
    font-size: var(--fs-lg);
    font-weight: 700;
  }

  .tbl-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .filter {
    display: flex;
    gap: var(--space-2);
  }

  .grid {
    display: grid;
    grid-template-columns: 64px minmax(160px, 1fr) 60px 56px 56px 56px 56px;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    font-variant-numeric: tabular-nums;
    font-size: var(--fs-sm);
    border-bottom: 1px solid var(--border);
  }

  .grid.head {
    font-weight: 600;
    color: var(--text-muted);
    position: sticky;
    top: 0;
    background: var(--bg-panel);
  }

  .divider {
    font-size: var(--fs-sm);
    padding: var(--space-2) 0 var(--space-1);
    letter-spacing: 0.1em;
  }

  .empty {
    padding: var(--space-3);
  }

  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 50px minmax(110px, 1fr) 44px 44px 44px 44px 44px;
      font-size: calc(11px * var(--ui-scale));
    }
    .result {
      margin-left: 0;
      text-align: left;
    }
  }
</style>
