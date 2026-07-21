<script lang="ts">
  import { store } from "../lib/store.svelte";
  import type { SourceFilter } from "../lib/types";

  const options: { id: SourceFilter; label: string }[] = [
    { id: "podstawka_dodatki", label: "Podstawka + dodatki" },
    { id: "podstawka", label: "Tylko podstawka" },
    { id: "wszystko", label: "Wszystko" },
    { id: "domowe", label: "Tylko domowe" }
  ];
</script>

<label class="source-filter" title="Filtr źródła — decyduje, co widać na liście">
  <span>Źródło:</span>
  <select
    value={store.sourceFilter}
    onchange={(e) => store.setSourceFilter(e.currentTarget.value as SourceFilter)}
  >
    {#each options as o (o.id)}
      <option value={o.id}>{o.label}</option>
    {/each}
  </select>
</label>

<style>
  .source-filter {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .source-filter span {
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
</style>
