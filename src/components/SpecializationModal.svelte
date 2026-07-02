<script lang="ts">
  import Modal from "./Modal.svelte";
  import { buildSpecializedName, type SpecInfo } from "../lib/specialization";

  let {
    info,
    onConfirm,
    onClose
  }: {
    info: SpecInfo;
    onConfirm: (fullName: string) => void;
    onClose: () => void;
  } = $props();

  let custom = $state("");
  let selected = $state<string | null>(null);

  let title = $derived(`Wybierz specjalizację — ${info.base}`);
  let canConfirm = $derived(
    info.kind === "choice" ? selected !== null : custom.trim().length > 0
  );

  const placeholder = $derived(
    info.hint ? `Wpisz: ${info.hint}` : "Wpisz specjalizację"
  );

  function confirmChoice(opt: string) {
    onConfirm(buildSpecializedName(info.base, opt));
  }

  function confirmFree() {
    if (!custom.trim()) return;
    onConfirm(buildSpecializedName(info.base, custom));
  }

  function submit() {
    if (info.kind === "choice") {
      if (selected) confirmChoice(selected);
    } else {
      confirmFree();
    }
  }
</script>

<Modal {title} {onClose}>
  {#if info.kind === "choice"}
    <p class="text-dim">Wybierz jedną z opcji:</p>
    <div class="opts">
      {#each info.options as opt (opt)}
        <button
          type="button"
          class="opt"
          class:on={selected === opt}
          onclick={() => (selected = opt)}
        >{opt}</button>
      {/each}
    </div>
  {:else}
    <label class="fld">
      <span>Specjalizacja{info.hint ? ` (${info.hint})` : ""}</span>
      <input
        type="text"
        bind:value={custom}
        {placeholder}
        onkeydown={(e) => e.key === "Enter" && submit()}
      />
    </label>
  {/if}

  {#snippet footer()}
    <button class="ghost" onclick={onClose}>Anuluj</button>
    <button class="primary" disabled={!canConfirm} onclick={submit}>Dodaj</button>
  {/snippet}
</Modal>

<style>
  .opts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .opt {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    cursor: pointer;
  }
  .opt.on {
    background: var(--accent);
    color: var(--accent-contrast, #fff);
    border-color: var(--accent);
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
</style>
