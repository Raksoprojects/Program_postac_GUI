<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { isLuckPoolMerged } from "../lib/gameData";

  /** Zasady domowe: jedna pula Punktow Przeznaczenia (Przeznaczenie + Bohater). */
  let luckMerged = $derived(isLuckPoolMerged(store.ruleset));

  let onlyDevelopable = $state(false);

  let rows = $derived(
    store.attributeRows().filter((r) => !onlyDevelopable || r.developable)
  );
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Cechy</h2>
      <p class="section-sub">
        Podgląd wartości, rezerwacji PD i maksymalnych możliwych rozwinięć dla każdej cechy.
      </p>
    </div>
  </header>

  <div class="controls panel">
    <div class="legend">
      <span class="chip accent">Rozw. — kupione rozwinięcia</span>
      <span class="chip warning">Maks — ile jeszcze kupisz</span>
      <span class="chip info">+ przy nazwie — rozwijalne w profesji</span>
    </div>
    <div class="filters">
      <label class="check">
        <input type="checkbox" bind:checked={onlyDevelopable} />
        Tylko rozwijalne (+)
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={store.attrGmApproved} />
        Zgoda MG (spoza profesji ×1)
      </label>
    </div>
  </div>

  <div class="rows">
    {#each rows as row (row.code)}
      <div class="row panel" class:dev-row={row.developable}>
        <div class="name">
          <strong>{row.fullName}</strong>
          <span class="text-dim">({row.code}){row.developable ? " +" : ""}</span>
        </div>
        <div class="stats">
          <span><span class="text-dim">Pocz:</span> {row.entry.initial}</span>
          <span><span class="text-dim">Rozw:</span> <b class="val-accent">{row.entry.advanced}</b></span>
          {#if row.talentBonus}
            <span title="Stały bonus z talentu (np. Urodzony Wojownik)"><span class="text-dim">Talent:</span> {row.talentBonus > 0 ? "+" : ""}{row.talentBonus}</span>
          {/if}
          {#if row.modifierBonus}
            <span title="Suma aktywnych modyfikatorów (zakładka Modyfikatory)"><span class="text-dim">Mod.:</span> <b class={row.modifierBonus > 0 ? "val-success" : "val-danger"}>{row.modifierBonus > 0 ? "+" : ""}{row.modifierBonus}</b></span>
          {/if}
          <span><span class="text-dim">Wartość:</span> <b>{row.total}</b></span>
          <span><span class="text-dim">Maks:</span> <b class="val-warning">{row.maxBuy}</b></span>
        </div>
        <div class="btns">
          <button class="btn-sm" disabled={row.maxBuy < 1} onclick={() => store.increaseAttribute(row.code, 1)}>+1</button>
          <button class="btn-sm" disabled={row.maxBuy < 5} onclick={() => store.increaseAttribute(row.code, 5)}>+5</button>
          <button class="btn-sm ghost" disabled={row.entry.advanced <= row.entry.base_advanced} onclick={() => store.decreaseAttribute(row.code, 1)}>−1</button>
          <button class="btn-sm ghost" disabled={row.entry.advanced - 5 < row.entry.base_advanced} onclick={() => store.decreaseAttribute(row.code, 5)}>−5</button>
        </div>
      </div>
    {/each}
    {#if rows.length === 0}
      <p class="text-dim empty">Brak cech spełniających filtr.</p>
    {/if}
  </div>

  <div class="secondary panel">
    <h3 class="section-title sm">Wartości drugorzędne</h3>
    <p class="section-sub">
      Żywotność, Szybkość oraz pule punktów. Zapisywane w postaci i eksportowane do PDF.
    </p>
    <div class="stat-grid">
      <label class="stat-fld">
        <span>Żywotność</span>
        <input type="number" min="0" value={store.stats.wounds}
          oninput={(e) => store.setStat("wounds", Math.max(0, +(e.currentTarget as HTMLInputElement).value))} />
      </label>
      <label class="stat-fld">
        <span>Szybkość</span>
        <input type="number" min="0" value={store.stats.movement}
          oninput={(e) => store.setStat("movement", Math.max(0, +(e.currentTarget as HTMLInputElement).value))} />
      </label>
      <div class="stat-fld ro">
        <span>Chód / Bieg</span>
        <output>{store.stats.movement * 2} / {store.stats.movement * 4}</output>
      </div>
      {#if luckMerged}
        <!-- Zasady domowe: Przeznaczenie i Bohater jako jedna pula (zapis: fate = pula, resilience = 0). -->
        <label class="stat-fld" title="Zasady domowe: wspólna pula Przeznaczenia i Bohatera">
          <span>Punkty Przeznaczenia</span>
          <input type="number" min="0" value={store.stats.fate + store.stats.resilience}
            oninput={(e) => {
              store.setStat("fate", Math.max(0, +(e.currentTarget as HTMLInputElement).value));
              store.setStat("resilience", 0);
            }} />
        </label>
      {:else}
      <label class="stat-fld">
        <span>Punkty Przeznaczenia</span>
        <input type="number" min="0" value={store.stats.fate}
          oninput={(e) => store.setStat("fate", Math.max(0, +(e.currentTarget as HTMLInputElement).value))} />
      </label>
      {/if}
      <label class="stat-fld" title="Maksimum = Punkty Przeznaczenia + wykupienia talentu Szczęście">
        <span>Punkty Szczęścia <span class="text-dim">(maks. {store.luckStats.fortuneMax})</span></span>
        <input type="number" min="0" value={store.stats.fortune}
          oninput={(e) => store.setStat("fortune", Math.max(0, +(e.currentTarget as HTMLInputElement).value))} />
      </label>
      {#if !luckMerged}
      <label class="stat-fld">
        <span>Punkty Bohatera</span>
        <input type="number" min="0" value={store.stats.resilience}
          oninput={(e) => store.setStat("resilience", Math.max(0, +(e.currentTarget as HTMLInputElement).value))} />
      </label>
      <label class="stat-fld">
        <span>Determinacja</span>
        <input type="number" min="0" value={store.stats.resolve}
          oninput={(e) => store.setStat("resolve", Math.max(0, +(e.currentTarget as HTMLInputElement).value))} />
      </label>
      {/if}
      <label class="stat-fld wide">
        <span>Motywacja</span>
        <input type="text" value={store.stats.motivation}
          oninput={(e) => store.setStat("motivation", (e.currentTarget as HTMLInputElement).value)} />
      </label>
    </div>
  </div>
</section>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .secondary {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .section-title.sm {
    font-size: var(--fs-md, 1rem);
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-2) var(--space-3);
  }
  .stat-fld {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-fld > span {
    font-size: var(--fs-sm);
    color: var(--text-dim, #999);
  }
  .stat-fld.wide {
    grid-column: 1 / -1;
  }
  .stat-fld.ro output {
    font-size: var(--fs-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: var(--space-1) 0;
  }
  .stat-fld input {
    font-variant-numeric: tabular-nums;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .legend,
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    align-items: center;
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
    min-width: calc(180px * var(--ui-scale));
    flex: 1;
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
  }

  .empty {
    padding: var(--space-3);
  }

  @media (max-width: 640px) {
    .btns {
      margin-left: 0;
      width: 100%;
    }
    .btns button {
      flex: 1;
    }
  }
</style>
