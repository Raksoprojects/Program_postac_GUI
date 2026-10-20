<script lang="ts">
  import Modal from "./Modal.svelte";
  import { buildSpecializedName, type SpecInfo } from "../lib/specialization";
  import * as gameData from "../lib/gameData";

  let {
    info,
    onConfirm,
    onClose,
    owned = [],
    error = "",
    note = ""
  }: {
    info: SpecInfo;
    onConfirm: (fullName: string) => void;
    onClose: () => void;
    /** Posiadane pozycje, ktore mozna przypisac do wyboru bez kupowania. */
    owned?: string[];
    /** Komunikat bledu po probie zatwierdzenia (np. duplikat). */
    error?: string;
    /** Dodatkowa podpowiedz pod tytulem. */
    note?: string;
  } = $props();

  let custom = $state("");
  let selected = $state<string | null>(null);

  let title = $derived(info.base ? `Wybierz specjalizację — ${info.base}` : "Wybierz jedną z opcji");
  let canConfirm = $derived(
    info.kind === "choice" ? selected !== null : custom.trim().length > 0
  );

  const placeholder = $derived(
    info.hint ? `Wpisz: ${info.hint}` : "Wpisz specjalizację"
  );

  /** Pelna nazwa opcji "albo" i czy postac juz ja posiada. */
  const ownedSet = $derived(new Set(owned));

  /** Podpowiedzi z danych (profesje, rasy, tradycje, bostwa), bez posiadanych; filtr wpisanym tekstem. */
  const allSuggestions = $derived(
    info.kind === "free" && info.base
      ? gameData
          .specializationSuggestions(info.base)
          .filter((s) => !ownedSet.has(buildSpecializedName(info.base, s)))
      : []
  );
  const suggestions = $derived(
    custom.trim()
      ? allSuggestions.filter((s) => s.toLowerCase().includes(custom.trim().toLowerCase()))
      : allSuggestions
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
  {#if note}<p class="text-dim">{note}</p>{/if}
  {#if info.kind === "choice"}
    <p class="text-dim">Wybierz jedną z opcji:</p>
    <div class="opts">
      {#each info.options as opt (opt)}
        <button
          type="button"
          class="opt"
          class:on={selected === opt}
          onclick={() => (selected = opt)}
        >{opt}{ownedSet.has(buildSpecializedName(info.base, opt)) ? " (posiadana)" : ""}</button>
      {/each}
    </div>
  {:else}
    {#if owned.length}
      <p class="text-dim">Przypisz posiadaną (bez dodatkowego kosztu):</p>
      <div class="opts">
        {#each owned as name (name)}
          <button type="button" class="opt" onclick={() => onConfirm(name)}>{name}</button>
        {/each}
      </div>
      <p class="text-dim">…albo wpisz nową:</p>
    {/if}
    <label class="fld">
      <span>Specjalizacja{info.hint ? ` (${info.hint})` : ""}</span>
      <input
        type="text"
        bind:value={custom}
        {placeholder}
        onkeydown={(e) => e.key === "Enter" && submit()}
      />
    </label>
    {#if allSuggestions.length}
      <p class="text-dim">Podpowiedzi ({suggestions.length}) — kliknij, by wybrać:</p>
      <div class="opts sugg">
        {#each suggestions as s (s)}
          <button type="button" class="opt" class:on={custom === s} onclick={() => (custom = s)} ondblclick={() => onConfirm(buildSpecializedName(info.base, s))}>{s}</button>
        {:else}
          <span class="text-dim">Brak pasujących — zostanie dodana wpisana nazwa.</span>
        {/each}
      </div>
    {/if}
  {/if}
  {#if error}<p class="val-danger">{error}</p>{/if}

  {#snippet footer()}
    <button class="ghost" onclick={onClose}>Anuluj</button>
    <button class="primary" disabled={!canConfirm} onclick={submit}>Wybierz</button>
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
  .sugg {
    max-height: calc(220px * var(--ui-scale));
    overflow-y: auto;
  }
  .sugg .opt {
    padding: var(--space-1) var(--space-2);
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
