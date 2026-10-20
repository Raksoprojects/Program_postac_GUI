<script lang="ts">
  import { untrack } from "svelte";
  import { artefactToText, type Artefact } from "../lib/artefacts";
  import * as gameData from "../lib/gameData";

  let {
    artefact,
    onreroll,
    onremove,
    onsave,
    saved = false,
    compact = false
  }: {
    artefact: Artefact;
    onreroll?: () => void;
    onremove?: () => void;
    /** "Dodaj do postaci" - zapis w pliku postaci. */
    onsave?: () => void;
    saved?: boolean;
    /** Zwiniety do naglowka - rozwija sie po kliknieciu. */
    compact?: boolean;
  } = $props();

  let open = $state(untrack(() => !compact));
  let spellOpen = $state<string | null>(null);
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(artefactToText(artefact));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }
</script>

<article class="artefact panel" class:cursed={artefact.cursed}>
  <header class="head">
    <button class="title" onclick={() => (open = !open)} aria-expanded={open}>
      <span class="icon">{artefact.cursed ? "☠" : "✦"}</span>
      <span class="name">{artefact.name}</span>
      <span class="text-dim small">{artefact.categoryName}</span>
    </button>
    <div class="actions">
      {#if onreroll}<button class="btn-sm ghost" onclick={onreroll} title="Wylosuj ponownie z tymi samymi ustawieniami">🎲</button>{/if}
      {#if onsave}
        <button class="btn-sm" class:success={saved} onclick={onsave} disabled={saved} title="Zapisz przedmiot w pliku postaci">
          {saved ? "Dodano" : "Dodaj do postaci"}
        </button>
      {/if}
      <button class="btn-sm ghost" onclick={copy} title="Kopiuj opis do schowka">{copied ? "Skopiowano" : "Kopiuj"}</button>
      {#if onremove}<button class="btn-sm ghost" onclick={onremove} aria-label="Usuń">✕</button>{/if}
    </div>
  </header>

  {#if open}
    <div class="body">
      {#if artefact.wp || artefact.limit || artefact.qualities.length || artefact.flaws.length}
        <p class="meta">
          {#if artefact.wp}<span class="chip accent" title="Siła Woli przedmiotu — opanowanie: Przeciwstawny Test Siły Woli">SW {artefact.wp}</span>{/if}
          {#if artefact.limit}<span class="chip" title="Ile takich przedmiotów może działać naraz">limit: {artefact.limit}</span>{/if}
          {#each artefact.qualities as q (q)}<span class="chip success">{q}</span>{/each}
          {#each artefact.flaws as q (q)}<span class="chip warning">{q}</span>{/each}
        </p>
      {/if}

      {#each artefact.lines as l, i (i)}
        <div class="line">
          {#if l.label}<b class="label">{l.label}</b>{/if}
          <span>{l.text}</span>
        </div>
      {/each}

      {#if artefact.spells.length}
        <p class="spells">
          <span class="text-dim small">Opisy zaklęć:</span>
          {#each artefact.spells as s (s)}
            <button class="chip tap" class:active={spellOpen === s} onclick={() => (spellOpen = spellOpen === s ? null : s)}>{s}</button>
          {/each}
        </p>
        {#if spellOpen}
          {@const sp = gameData.getSpell(spellOpen)}
          {#if sp}
            <div class="spell">
              <b>{sp.name}</b>
              <span class="text-dim">PZ {sp.cn} · Zasięg: {sp.range} · Cel: {sp.target} · Czas: {sp.duration}</span>
              <span>{sp.description}</span>
              <span class="text-dim">{sp.source}{sp.page ? `, s. ${sp.page}` : ""}</span>
            </div>
          {/if}
        {/if}
      {/if}

      {#if artefact.curse}
        <div class="curse">
          <b>☠ Klątwa — {artefact.curse.name}</b>{#if artefact.curse.duration}<span class="text-dim small"> ({artefact.curse.duration})</span>{/if}
          <span>{artefact.curse.text}</span>
          <span class="text-dim small">Klątwa działa po opanowaniu albo pierwszym użyciu; zdejmuje ją Talent Zdjęcie Klątwy (PZ = 2 × BSW przedmiotu) albo świątynia Shallyi.</span>
        </div>
      {/if}

      <p class="source text-dim small">{artefact.source}</p>
    </div>
  {/if}
</article>

<style>
  .artefact {
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .artefact.cursed {
    border-color: var(--danger);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-2);
    background: transparent;
    border: none;
    padding: 0;
    min-height: auto;
    text-align: left;
  }
  .icon {
    color: var(--accent-strong);
  }
  .cursed .icon {
    color: var(--danger-strong);
  }
  .name {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
    font-weight: 600;
  }
  .small {
    font-size: var(--fs-sm);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .meta,
  .spells {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin: 0;
    align-items: center;
  }
  .line {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    color: var(--text-muted);
    font-size: var(--fs-sm);
  }
  button.chip.tap {
    min-height: auto;
    cursor: pointer;
  }
  .chip.active {
    border-color: var(--accent);
    color: var(--accent-strong);
  }
  .spell,
  .curse {
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--accent);
    background: var(--bg-panel-2);
    font-size: var(--fs-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .curse {
    border-left-color: var(--danger-strong);
  }
  .source {
    margin: 0;
  }
</style>
