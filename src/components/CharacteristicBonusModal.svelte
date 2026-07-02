<script lang="ts">
  import Modal from "./Modal.svelte";
  import { ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";

  let {
    talentName,
    charCode,
    onConfirm,
    onClose
  }: {
    talentName: string;
    charCode: string;
    onConfirm: (value: number) => void;
    onClose: () => void;
  } = $props();

  let rolled = $state<number | null>(null);

  const charName = $derived(ATTRIBUTE_FULL_NAMES[charCode] ?? charCode);
  const title = $derived(`Bonus do cechy — ${talentName}`);

  function rollK10() {
    rolled = Math.floor(Math.random() * 10) + 1;
  }
</script>

<Modal {title} {onClose}>
  <p class="text-dim">
    Talent <strong>{talentName}</strong> na stałe podnosi cechę
    <strong>{charName}</strong>. Wybierz wartość bonusu (raz, na stałe):
  </p>

  <div class="opts">
    <button type="button" class="opt" onclick={() => onConfirm(5)}>
      Stałe +5
    </button>
    <button type="button" class="opt" onclick={rollK10}>
      Rzut 1k10{rolled !== null ? ` → ${rolled}` : ""}
    </button>
  </div>

  {#if rolled !== null}
    <p class="roll">
      Wynik rzutu: <strong>+{rolled}</strong> do cechy {charName}.
    </p>
  {/if}

  {#snippet footer()}
    <button class="ghost" onclick={onClose}>Anuluj</button>
    <button
      class="primary"
      disabled={rolled === null}
      onclick={() => rolled !== null && onConfirm(rolled)}
    >Zatwierdź rzut</button>
  {/snippet}
</Modal>

<style>
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .opt {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    cursor: pointer;
  }
  .opt:hover {
    border-color: var(--accent);
  }
  .roll {
    margin-top: var(--space-2);
  }
</style>
