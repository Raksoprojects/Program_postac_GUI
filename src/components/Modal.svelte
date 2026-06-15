<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    onClose,
    children,
    footer
  }: {
    title: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="overlay" onclick={onClose} role="presentation">
  <div
    class="dialog panel"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    tabindex="-1"
  >
    <header class="dlg-head">
      <h3>{title}</h3>
      <button class="x" onclick={onClose} aria-label="Zamknij">✕</button>
    </header>
    <div class="dlg-body">
      {@render children()}
    </div>
    {#if footer}
      <footer class="dlg-foot">
        {@render footer()}
      </footer>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--space-4);
    z-index: 100;
    overflow-y: auto;
  }

  .dialog {
    width: min(640px, 100%);
    margin-top: 6vh;
    display: flex;
    flex-direction: column;
    max-height: 86vh;
  }

  .dlg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  .dlg-head h3 {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
  }

  .x {
    min-height: auto;
    padding: var(--space-1) var(--space-2);
    background: transparent;
    border: none;
  }

  .dlg-body {
    padding: var(--space-4);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .dlg-foot {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border);
  }
</style>
