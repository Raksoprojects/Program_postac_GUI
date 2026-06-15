<script lang="ts">
  import { store } from "../lib/store.svelte";

  let confirmMsg = $state<string | null>(null);

  function onConfirm() {
    if (!store.hasPending) {
      confirmMsg = "Brak oczekujących zmian do zatwierdzenia.";
      return;
    }
    const result = store.confirmChanges();
    confirmMsg = `Zatwierdzono zmiany. Koszt: ${result.totalCost} PD.`;
  }

  function onRevert() {
    if (!store.hasPending) {
      confirmMsg = "Brak oczekujących zmian do cofnięcia.";
      return;
    }
    const refund = store.revertChanges();
    confirmMsg = `Cofnięto zmiany. Przywrócono ${refund} PD.`;
  }
</script>

<div class="summary panel">
  <div class="cards">
    <div class="card">
      <span class="lbl text-dim">Postać</span>
      <span class="val val-accent">{store.characterName}</span>
    </div>
    <div class="card">
      <span class="lbl text-dim">Dostępne PD</span>
      <span class="val val-success">{store.experience.available}</span>
    </div>
    <div class="card">
      <span class="lbl text-dim">Wydane PD</span>
      <span class="val">{store.experience.spent}</span>
    </div>
    <div class="card">
      <span class="lbl text-dim">Oczekujące zmiany</span>
      <span class="val val-warning">{store.pendingCount || "Brak"}</span>
    </div>
  </div>

  <div class="actions">
    <button class="success" disabled={!store.hasPending} onclick={onConfirm}>
      Zatwierdź zmiany
    </button>
    <button class="danger" disabled={!store.hasPending} onclick={onRevert}>
      Cofnij zmiany
    </button>
  </div>
</div>

{#if confirmMsg}
  <div class="toast panel" role="status">
    <span>{confirmMsg}</span>
    <button class="btn-sm ghost" onclick={() => (confirmMsg = null)}>OK</button>
  </div>
{/if}

<style>
  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .card {
    display: flex;
    flex-direction: column;
    min-width: calc(120px * var(--ui-scale));
  }

  .lbl {
    font-size: var(--fs-sm);
  }

  .val {
    font-size: var(--fs-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
  }

  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border-color: var(--accent);
  }

  @media (max-width: 640px) {
    .actions {
      flex: 1;
    }
    .actions button {
      flex: 1;
    }
  }
</style>
