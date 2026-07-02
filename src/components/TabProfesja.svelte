<script lang="ts">
  import { store } from "../lib/store.svelte";
  import * as gameData from "../lib/gameData";
  import Autocomplete from "./Autocomplete.svelte";
  import Modal from "./Modal.svelte";

  // Edytor profesji
  let selClass = $state("");
  let selProfession = $state("");
  let selLevel = $state(1);
  let actionMsg = $state<string | null>(null);

  let classNames = $derived(gameData.allClassNames());
  let professionsForClass = $derived(
    selClass ? gameData.careersForClass(selClass) : gameData.allProfessionNames()
  );

  // Synchronizuj edytor z biezaca profesja przy zmianie postaci
  $effect(() => {
    void store.pendingCount; // dotyk reaktywnosci
    if (!selProfession && store.dm.currentCareer) {
      selClass = store.dm.characterClass;
      selProfession = store.dm.currentCareer;
      selLevel = store.dm.currentCareerLevel;
    }
  });

  let completion = $derived(store.careerCompletion());
  let careerPath = $derived((store.pendingCount, store.dm.careerPath.map((s) => ({ ...s }))));
  let currentCareer = $derived((store.pendingCount, store.dm.currentCareer));
  let currentLevel = $derived((store.pendingCount, store.dm.currentCareerLevel));
  let charClass = $derived((store.pendingCount, store.dm.characterClass));
  let profSchema = $derived(currentCareer ? gameData.getProfession(currentCareer) : undefined);

  function statusBadge() {
    if (completion.unknown_profession) return { text: "SPOZA PODSTAWKI", cls: "" };
    return completion.completed
      ? { text: "✓ SKOMPLETOWANA", cls: "success" }
      : { text: "● NIESKOMPLETOWANA", cls: "warning" };
  }

  function onSetCareer() {
    if (!selProfession.trim()) {
      actionMsg = "Wybierz profesję.";
      return;
    }
    store.setCurrentCareer(selProfession.trim(), selLevel);
    actionMsg = `Ustawiono profesję: ${selProfession} (poziom ${selLevel}).`;
  }

  function onAdvance() {
    if (!selProfession.trim()) {
      actionMsg = "Wybierz profesję docelową.";
      return;
    }
    const r = store.advanceCareer(selProfession.trim(), selLevel);
    if (!r.ok) {
      actionMsg = `Za mało PD na awans (koszt ${r.cost} PD).`;
      return;
    }
    actionMsg = `Awansowano do: ${selProfession} (poziom ${selLevel}). Koszt: ${r.cost} PD.`;
  }

  // --- Edytor calej sciezki kariery ---
  let showPathEditor = $state(false);
  let draft = $state<{ profession: string; level: number; completed: boolean }[]>([]);

  function openPathEditor() {
    draft = store.dm.careerPath.map((s) => ({
      profession: s.title || s.profession || "",
      level: s.level || 1,
      completed: Boolean(s.completed)
    }));
    if (draft.length === 0) draft = [{ profession: "", level: 1, completed: false }];
    showPathEditor = true;
  }
  function addStep() {
    draft = [...draft, { profession: "", level: 1, completed: false }];
  }
  function removeStep(i: number) {
    draft = draft.filter((_, idx) => idx !== i);
  }
  function savePath() {
    store.saveCareerPath(draft);
    showPathEditor = false;
    selProfession = store.dm.currentCareer;
    selLevel = store.dm.currentCareerLevel;
    selClass = store.dm.characterClass;
  }

  let allProfessions = $derived(gameData.allProfessionNames());
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Profesja</h2>
      <p class="section-sub">
        Ustaw lub popraw profesję (bez kosztu) albo awansuj do nowej (z kosztem przejścia).
        Poniżej zobaczysz ścieżkę kariery, schemat poziomów i status kompletowania.
      </p>
    </div>
  </header>

  <div class="summary panel">
    <div class="sum-line">
      <span>
        <b>{currentCareer || "—"}</b>
        {#if currentCareer}<span class="text-dim">(poziom {currentLevel})</span>{/if}
      </span>
      <label class="inline-class text-dim">
        Klasa:
        <select
          value={charClass}
          onchange={(e) => store.setCharacterClass(e.currentTarget.value)}
          aria-label="Klasa postaci"
        >
          <option value="">—</option>
          {#each classNames as c (c)}
            <option value={c}>{c}</option>
          {/each}
        </select>
      </label>
      <span class="text-dim">Rasa: {store.dm.characterSpecies || "—"}</span>
      {#if currentCareer}
        {@const b = statusBadge()}
        <span class="chip {b.cls}">{b.text}</span>
      {/if}
    </div>
    {#if currentCareer && !completion.unknown_profession}
      <p class="text-dim">
        Umiejętności: {completion.skills_done}/8 {completion.skills_ok ? "✓" : ""} ·
        Talenty: {completion.talents_done} {completion.talents_ok ? "✓" : ""} ·
        Cechy: {completion.characteristics_pending ? "schemat nieuzupełniony" : completion.characteristics_ok ? "✓" : "w toku"}
      </p>
    {:else if completion.unknown_profession}
      <p class="text-dim">Profesja spoza podstawki — kompletowanie liczone ręcznie.</p>
    {/if}
  </div>

  <div class="editor panel">
    <div class="ed-row">
      <label class="fld">
        <span>Klasa</span>
        <select bind:value={selClass} onchange={() => (selProfession = "")}>
          <option value="">— dowolna —</option>
          {#each classNames as c (c)}
            <option value={c}>{c}</option>
          {/each}
        </select>
      </label>
      <label class="fld grow">
        <span>Profesja</span>
        <select bind:value={selProfession}>
          <option value="">— wybierz —</option>
          {#each professionsForClass as p (p)}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </label>
      <label class="fld">
        <span>Poziom</span>
        <select bind:value={selLevel}>
          {#each [1, 2, 3, 4] as l (l)}
            <option value={l}>{l}</option>
          {/each}
        </select>
      </label>
    </div>
    <div class="ed-actions">
      <button class="ghost" onclick={onSetCareer}>Ustaw / popraw (bez kosztu)</button>
      <button class="primary" onclick={onAdvance}>Awansuj profesję (koszt PD)</button>
    </div>
    {#if actionMsg}
      <p class="msg">{actionMsg}</p>
    {/if}
  </div>

  <div class="path panel">
    <div class="path-head">
      <h3 class="section-title">Ścieżka kariery</h3>
      <button class="btn-sm ghost" onclick={openPathEditor}>✎ Edytuj całą ścieżkę</button>
    </div>
    <div class="chips">
      {#each careerPath as step, i (i)}
        <span class="chip {i === careerPath.length - 1 ? 'accent' : ''}">
          {step.completed ? "✓" : "•"}
          {step.title || step.profession} ({step.level})
          {#if !step.resolved}<span class="text-dim">(spoza podstawki)</span>{/if}
          <button class="rm" aria-label="Usuń krok" onclick={() => store.removeCareerStep(i)}>✕</button>
        </span>
      {/each}
      {#if careerPath.length === 0}
        <span class="text-dim">Brak kroków kariery.</span>
      {/if}
    </div>
  </div>

  {#if profSchema}
    <div class="levels">
      {#each profSchema.levels as lvl (lvl.level)}
        <div class="lvl panel" class:current={lvl.level === currentLevel}>
          <div class="lvl-head">
            <strong>{lvl.level}. {lvl.title}</strong>
            {#if lvl.level === currentLevel}
              <span class="chip accent">OBECNY POZIOM</span>
            {:else if lvl.level < currentLevel}
              <span class="chip success">ukończony</span>
            {:else}
              <span class="chip">później</span>
            {/if}
          </div>
          {#if lvl.characteristics?.length}
            <p class="text-dim"><b>Cechy:</b> {lvl.characteristics.join(", ")}</p>
          {/if}
          {#if lvl.skills?.length}
            <p class="text-dim"><b>Umiejętności:</b> {#each lvl.skills as s, i (s)}<span
                  class:earning={lvl.earning_skills?.includes(s)}
                  title={lvl.earning_skills?.includes(s) ? "Umiejętność zarobkowa" : undefined}
                >{s}</span>{#if i < lvl.skills.length - 1}, {/if}{/each}</p>
          {/if}
          {#if lvl.talents?.length}
            <p class="text-dim"><b>Talenty:</b> {lvl.talents.join(", ")}</p>
          {/if}
          {#if lvl.trappings?.length}
            <p class="text-dim"><b>Wyposażenie:</b> {lvl.trappings.join(", ")}</p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

{#if showPathEditor}
  <Modal title="Edytor ścieżki kariery" onClose={() => (showPathEditor = false)}>
    <p class="text-dim">
      Każdy wiersz to jeden krok kariery. Pole profesji przyjmuje dowolną nazwę. Ostatni krok staje się
      profesją bieżącą.
    </p>
    <div class="draft">
      {#each draft as step, i (i)}
        <div class="draft-row">
          <span class="idx">{i + 1}.</span>
          <Autocomplete bind:value={step.profession} placeholder="Profesja" options={allProfessions} />
          <select bind:value={step.level} aria-label="Poziom">
            {#each [1, 2, 3, 4] as l (l)}
              <option value={l}>{l}</option>
            {/each}
          </select>
          <label class="check">
            <input type="checkbox" bind:checked={step.completed} />
            ukończona
          </label>
          <button class="btn-sm danger" aria-label="Usuń" onclick={() => removeStep(i)}>✕</button>
        </div>
      {/each}
    </div>
    <button class="btn-sm ghost" onclick={addStep}>+ Dodaj krok</button>
    {#snippet footer()}
      <button class="ghost" onclick={() => (showPathEditor = false)}>Anuluj</button>
      <button class="primary" onclick={savePath}>Zapisz</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .summary,
  .editor,
  .path {
    padding: var(--space-3) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sum-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--fs-lg);
  }

  .inline-class {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .inline-class select {
    font-size: var(--fs-sm, 0.85em);
  }

  .ed-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
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

  .grow {
    flex: 1;
    min-width: calc(200px * var(--ui-scale));
  }

  .ed-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .msg {
    color: var(--accent-strong);
    font-size: var(--fs-sm);
  }

  .path-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .rm {
    min-height: auto;
    padding: 0 var(--space-1);
    background: transparent;
    border: none;
    margin-left: var(--space-1);
  }

  .levels {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(280px * var(--ui-scale)), 1fr));
    gap: var(--space-2);
  }

  .lvl {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .lvl.current {
    border-color: var(--accent);
    border-width: 2px;
  }

  .earning {
    font-style: italic;
    font-weight: 600;
  }

  .lvl-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .lvl p {
    font-size: var(--fs-sm);
    margin: 0;
  }

  .draft {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .draft-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .idx {
    width: calc(24px * var(--ui-scale));
    color: var(--text-dim);
  }
</style>
