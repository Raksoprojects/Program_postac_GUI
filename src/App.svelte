<script lang="ts">
  import { uiScale } from "./lib/uiScale";
  import { store } from "./lib/store.svelte";
  import { pickFile } from "./lib/storage";
  import SummaryCards from "./components/SummaryCards.svelte";
  import TabCechy from "./components/TabCechy.svelte";
  import TabUmiejetnosci from "./components/TabUmiejetnosci.svelte";
  import TabTalenty from "./components/TabTalenty.svelte";
  import TabProfesja from "./components/TabProfesja.svelte";
  import TabKoszty from "./components/TabKoszty.svelte";
  import TabDoswiadczenie from "./components/TabDoswiadczenie.svelte";
  import TabHistoria from "./components/TabHistoria.svelte";
  import CreatorModal from "./components/CreatorModal.svelte";

  const tabs = [
    { id: "cechy", label: "Cechy", badge: "cechy" },
    { id: "umiejetnosci", label: "Umiejętności", badge: "umiejetnosci" },
    { id: "talenty", label: "Talenty", badge: "talenty" },
    { id: "profesja", label: "Profesja", badge: null },
    { id: "koszty", label: "Koszty", badge: null },
    { id: "doswiadczenie", label: "Doświadczenie", badge: null },
    { id: "historia", label: "Historia", badge: null }
  ] as const;

  let activeTab = $state<(typeof tabs)[number]["id"]>("cechy");
  let scale = $state(1);
  uiScale.subscribe((v) => (scale = v));

  // Wczytanie statycznych danych gry (profesje, klasy, talenty).
  store.init();

  function newCharacter() {
    const name = prompt("Nazwa nowej postaci:", "Nowa Postać");
    if (name !== null) store.newCharacter(name.trim() || "Nowa Postać");
  }

  let showCreator = $state(false);

  let busy = $state(false);
  let actionError = $state("");

  async function loadPdf() {
    const file = await pickFile(".pdf,application/pdf");
    if (!file) return;
    busy = true;
    actionError = "";
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ok = await store.loadPdfBytes(bytes);
      if (!ok) actionError = "Nie udało się wczytać pliku PDF.";
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function loadJson() {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    busy = true;
    actionError = "";
    try {
      const text = await file.text();
      const ok = store.loadJsonText(text);
      if (!ok) actionError = "Nie udało się wczytać pliku JSON.";
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function saveJson() {
    actionError = "";
    try {
      store.saveJson();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    }
  }

  async function exportPdf() {
    busy = true;
    actionError = "";
    try {
      await store.exportPdf();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  // Ctrl + kolko myszy = zoom (jak w aplikacjach desktopowych).
  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY < 0) uiScale.increase();
    else uiScale.decrease();
  }
</script>

<svelte:window onwheel={onWheel} />

<div class="app-shell">
  <header class="app-header panel">
    <div class="brand">
      <h1>Karta Postaci <span class="edition">WFRP 4ed</span></h1>
      <div class="brand-meta">
        <span class="char-name">{store.characterName}</span>
        {#if store.careerLabel}
          <span class="career-chip">{store.careerLabel}</span>
        {/if}
        {#if store.hasPending}
          <span class="pending-chip" title="Masz niezapisane zmiany">
            ● Niezapisane: {store.pendingCount}
          </span>
        {:else}
          <span class="saved-chip" title="Wszystko zapisane">✓ Zapisano</span>
        {/if}
      </div>
    </div>

    <div class="header-actions">
      <div class="btn-group">
        <button title="Wczytaj postać z pliku PDF" onclick={loadPdf} disabled={busy}>Wczytaj z PDF</button>
        <button title="Wczytaj postać z pliku JSON" onclick={loadJson} disabled={busy}>Wczytaj JSON</button>
        <button title="Utwórz nową, pustą postać" onclick={newCharacter} disabled={busy}>Nowa</button>
        <button title="Kreator postaci — rasa, pochodzenie i rzuty na cechy" onclick={() => (showCreator = true)} disabled={busy}>Kreator</button>
        <button title="Zapisz postać do pliku JSON" onclick={saveJson} disabled={busy}>Zapisz JSON</button>
        <button title="Eksportuj do wypełnionego PDF" onclick={exportPdf} disabled={busy}>Eksport PDF</button>
      </div>

      <div class="zoom-control" role="group" aria-label="Powiększenie interfejsu">
        <button
          class="zoom-btn"
          title="Zmniejsz interfejs"
          aria-label="Zmniejsz"
          onclick={() => uiScale.decrease()}>−</button
        >
        <button
          class="zoom-value"
          title="Przywróć domyślne powiększenie"
          onclick={() => uiScale.reset()}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          class="zoom-btn"
          title="Powiększ interfejs"
          aria-label="Powiększ"
          onclick={() => uiScale.increase()}>+</button
        >
      </div>
    </div>
  </header>

  {#if actionError}
    <div class="action-banner" role="alert">
      <span class="val-danger">{actionError}</span>
      <button class="btn-sm ghost" onclick={() => (actionError = "")}>✕</button>
    </div>
  {/if}

  <SummaryCards />

  <nav class="tab-bar" aria-label="Sekcje karty">
    {#each tabs as tab (tab.id)}
      {@const badgeCount = tab.badge ? store.pendingByTab[tab.badge] : 0}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        aria-pressed={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
        {#if badgeCount > 0}
          <span class="tab-badge" aria-label="oczekujące zmiany">{badgeCount}</span>
        {/if}
      </button>
    {/each}
  </nav>

  <main class="content">
    {#if store.loadError}
      <section class="panel placeholder">
        <h2>Błąd ładowania danych</h2>
        <p class="val-danger">{store.loadError}</p>
        <p class="text-dim">Sprawdź, czy pliki w katalogu data/ są dostępne.</p>
      </section>
    {:else if !store.ready}
      <section class="panel placeholder">
        <h2>Wczytywanie danych gry…</h2>
        <p class="text-dim">Ładowanie profesji, klas i talentów.</p>
      </section>
    {:else if activeTab === "cechy"}
      <TabCechy />
    {:else if activeTab === "umiejetnosci"}
      <TabUmiejetnosci />
    {:else if activeTab === "talenty"}
      <TabTalenty />
    {:else if activeTab === "profesja"}
      <TabProfesja />
    {:else if activeTab === "koszty"}
      <TabKoszty />
    {:else if activeTab === "doswiadczenie"}
      <TabDoswiadczenie />
    {:else if activeTab === "historia"}
      <TabHistoria />
    {/if}
  </main>

  <footer class="app-footer text-dim">
    <span>Warhammer Fantasy Roleplay 4ed · narzędzie pomocnicze gracza</span>
  </footer>
</div>

{#if showCreator}
  <CreatorModal onClose={() => (showCreator = false)} />
{/if}

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-3);
    gap: var(--space-3);
    /* Respektuj wciecia ekranu (notch / zaokraglenia) na telefonach. */
    padding-top: max(var(--space-3), env(safe-area-inset-top));
    padding-left: max(var(--space-3), env(safe-area-inset-left));
    padding-right: max(var(--space-3), env(safe-area-inset-right));
    padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
  }

  .app-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .brand {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand h1 {
    font-size: var(--fs-xl);
    color: var(--text);
  }

  .edition {
    color: var(--accent);
    font-weight: 700;
  }

  .brand-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-sm);
  }

  .char-name {
    font-weight: 600;
    color: var(--text);
  }

  .career-chip {
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-muted);
  }

  .pending-chip {
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--warning);
    background: var(--bg);
    color: var(--warning);
    font-weight: 600;
  }

  .saved-chip {
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--success-strong);
    background: var(--bg);
    color: var(--success-strong);
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: calc(18px * var(--ui-scale));
    height: calc(18px * var(--ui-scale));
    margin-left: var(--space-1);
    padding: 0 5px;
    border-radius: 999px;
    background: var(--warning);
    color: var(--bg);
    font-size: var(--fs-xs, 0.7rem);
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .zoom-control {
    display: inline-flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .zoom-control button {
    border: none;
    border-radius: 0;
    background: transparent;
    min-height: calc(32px * var(--ui-scale));
  }

  .zoom-btn {
    font-size: var(--fs-lg);
    line-height: 1;
    padding: var(--space-1) var(--space-3);
    min-width: calc(34px * var(--ui-scale));
  }

  .zoom-value {
    min-width: calc(54px * var(--ui-scale));
    font-variant-numeric: tabular-nums;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }

  .tab-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .action-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--danger-strong);
    border-radius: var(--radius);
    background: var(--bg-panel);
  }

  .tab {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    color: var(--text-muted);
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    background: var(--bg-elevated);
    color: var(--accent-strong);
    border-color: var(--accent);
    font-weight: 600;
  }

  .content {
    flex: 1;
  }

  .placeholder {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .placeholder h2 {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
  }

  .app-footer {
    font-size: var(--fs-sm);
    text-align: center;
    padding: var(--space-2);
  }

  /* Telefon: nagłówek i akcje układają się pionowo, przyciski rozciągają się. */
  @media (max-width: 640px) {
    .app-shell {
      padding: var(--space-2);
    }

    .app-header {
      flex-direction: column;
      align-items: stretch;
    }

    .header-actions {
      justify-content: space-between;
    }

    .btn-group {
      flex: 1;
    }

    .btn-group button {
      flex: 1 1 auto;
    }

    .tab-bar {
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
    }

    .tab {
      white-space: nowrap;
    }
  }
</style>
