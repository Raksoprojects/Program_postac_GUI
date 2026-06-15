<script lang="ts">
  import { store } from "../lib/store.svelte";

  let setValue = $state(0);
  let addValue = $state(0);

  // Synchronizuj pole "ustaw" z aktualna wartoscia
  $effect(() => {
    setValue = store.experience.available;
  });

  function doSet() {
    store.setAvailableExperience(Math.trunc(setValue));
  }
  function doAdd() {
    const n = Math.trunc(addValue);
    if (n) {
      store.addExperience(n);
      addValue = 0;
    }
  }
  function quick(n: number) {
    store.addExperience(n);
  }
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Doświadczenie</h2>
      <p class="section-sub">
        Dodawaj pulę PD ręcznie albo szybkim przyciskiem. Zmiany od razu wpływają na maksymalną
        liczbę możliwych rozwinięć.
      </p>
    </div>
  </header>

  <div class="panel pane">
    <h3 class="section-title">Panel doświadczenia</h3>
    <p class="text-dim">Łączna pula postaci: {store.experience.total} PD · Wydane: {store.experience.spent} PD</p>

    <div class="block">
      <label class="fld">
        <span>Dostępne PD</span>
        <input type="number" bind:value={setValue} onkeydown={(e) => e.key === "Enter" && doSet()} />
      </label>
      <button class="ghost" onclick={doSet}>Ustaw wartość</button>
    </div>

    <div class="block">
      <label class="fld">
        <span>Dodaj doświadczenie</span>
        <input type="number" placeholder="Ilość PD" bind:value={addValue} onkeydown={(e) => e.key === "Enter" && doAdd()} />
      </label>
      <button class="primary" onclick={doAdd}>Dodaj</button>
    </div>

    <div class="quick">
      <button onclick={() => quick(10)}>+10</button>
      <button onclick={() => quick(25)}>+25</button>
      <button onclick={() => quick(50)}>+50</button>
      <button onclick={() => quick(100)}>+100</button>
    </div>
  </div>
</section>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .pane {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .block {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
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

  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .quick button {
    min-width: calc(64px * var(--ui-scale));
  }
</style>
