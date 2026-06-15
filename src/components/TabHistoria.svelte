<script lang="ts">
  import { store } from "../lib/store.svelte";

  let entries = $derived([...store.history].reverse().slice(0, 100));

  function fmt(ts: string): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString("pl-PL");
  }
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Historia</h2>
      <p class="section-sub">
        Chronologiczny zapis operacji: wczytań, zatwierdzeń, cofnięć, zmian PD i umiejętności.
      </p>
    </div>
    <div class="chips">
      <span class="chip {store.hasPending ? 'warning' : 'success'}">
        {store.hasPending ? "Masz oczekujące zmiany" : "Brak oczekujących zmian"}
      </span>
      <span class="chip info">Źródło: {store.dm.sourceType.toUpperCase()}</span>
    </div>
  </header>

  <div class="panel log">
    {#each entries as e, i (entries.length - i)}
      <div class="entry">
        <span class="ts text-dim">{fmt(e.timestamp)}</span>
        <span class="action"><b>{e.action}</b>{e.details ? ` — ${e.details}` : ""}</span>
      </div>
    {/each}
    {#if entries.length === 0}
      <p class="text-dim empty">Brak zapisanych operacji.</p>
    {/if}
  </div>
</section>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .tab-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .log {
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-height: 70vh;
    overflow-y: auto;
  }

  .entry {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--border);
    font-size: var(--fs-sm);
  }

  .ts {
    min-width: calc(150px * var(--ui-scale));
    font-variant-numeric: tabular-nums;
  }

  .empty {
    padding: var(--space-3);
  }
</style>
