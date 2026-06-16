<script lang="ts">
  import Modal from "./Modal.svelte";
  import { store, ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";
  import * as gameData from "../lib/gameData";
  import {
    rollK100,
    rollRaceCharacteristics,
    characteristicBonus,
    computeWounds,
    movementSteps,
    type CharacteristicRolls
  } from "../lib/creation";
  import { ATTRIBUTES } from "../lib/rules";
  import type { RaceCreationInput } from "../lib/types";

  let { onClose }: { onClose: () => void } = $props();

  const raceNames = gameData.allRaceNames();

  let step = $state(1);
  let name = $state("Nowa Postać");

  // Krok 1 - rasa
  let raceName = $state("");
  let rolledRace = $state("");
  let raceRoll = $state<number | null>(null);

  // Krok 2 - cechy
  let rolls = $state<CharacteristicRolls | null>(null);
  let chars = $state<Record<string, number>>({});
  let charMode = $state<"ordered" | "rearranged" | "manual">("ordered");

  // Krok 3 - Los / Hart
  let fate = $state(0);
  let resilience = $state(0);

  // Krok 4 - umiejetnosci rasowe (nazwa -> 0 | 5 | 3)
  let skillChoice = $state<Record<string, number>>({});

  // Krok 5 - talenty rasowe
  let talentChoice = $state<Record<number, string>>({});
  let randomTalents = $state<string[]>([]);

  const race = $derived(raceName ? gameData.getRace(raceName) : undefined);

  const acceptRandomRace = $derived(
    rolledRace !== "" && rolledRace === raceName
  );
  const raceBonusPd = $derived(acceptRandomRace ? 20 : 0);
  const charBonusPd = $derived(
    !rolls ? 0 : charMode === "ordered" ? 50 : charMode === "rearranged" ? 25 : 0
  );
  const totalBonusPd = $derived(raceBonusPd + charBonusPd);

  const fatePool = $derived(
    race ? race.fate + race.resilience + race.extraPoints : 0
  );

  const plus5Count = $derived(
    Object.values(skillChoice).filter((v) => v === 5).length
  );
  const plus3Count = $derived(
    Object.values(skillChoice).filter((v) => v === 3).length
  );

  const randomTalentCount = $derived(
    race ? race.talents.reduce((n, t) => n + (t.type === "random" ? t.count : 0), 0) : 0
  );

  // --- Krok 1 ---
  function selectRace(n: string): void {
    raceName = n;
    resetDerivedFromRace();
  }

  function rollRace(): void {
    const r = rollK100();
    raceRoll = r;
    const found = gameData.raceForRoll(r) ?? "Człowiek";
    rolledRace = found;
    raceName = found;
    resetDerivedFromRace();
  }

  function resetDerivedFromRace(): void {
    rolls = null;
    chars = {};
    const def = raceName ? gameData.getRace(raceName) : undefined;
    fate = def ? def.fate : 0;
    resilience = def ? def.resilience : 0;
    skillChoice = {};
    talentChoice = {};
    randomTalents = [];
  }

  // --- Krok 2 ---
  function rollChars(): void {
    if (!race) return;
    const r = rollRaceCharacteristics(race);
    rolls = r;
    const next: Record<string, number> = {};
    for (const attr of ATTRIBUTES) next[attr] = r[attr].total;
    chars = next;
    charMode = "ordered";
  }

  function rerollChars(): void {
    rollChars();
    charMode = "manual";
  }

  // --- Krok 3 ---
  function adjFate(delta: number): void {
    if (!race) return;
    const nf = fate + delta;
    const nr = resilience - delta;
    if (nf < race.fate || nr < race.resilience) return;
    if (nf + nr !== fatePool) return;
    fate = nf;
    resilience = nr;
  }

  // --- Krok 4 ---
  function toggleSkill(skill: string, val: number): void {
    const cur = skillChoice[skill] ?? 0;
    if (cur === val) {
      skillChoice = { ...skillChoice, [skill]: 0 };
      return;
    }
    if (val === 5 && plus5Count >= 3) return;
    if (val === 3 && plus3Count >= 3) return;
    skillChoice = { ...skillChoice, [skill]: val };
  }

  function resetSkills(): void {
    skillChoice = {};
  }

  // --- Krok 5 ---
  function selectTalent(idx: number, option: string): void {
    talentChoice = { ...talentChoice, [idx]: option };
  }

  function fixedAndChosenTalents(): string[] {
    if (!race) return [];
    const out: string[] = [];
    race.talents.forEach((t, i) => {
      if (t.type === "fixed") out.push(t.name);
      else if (t.type === "choice") {
        const sel = talentChoice[i];
        if (sel) out.push(sel);
      }
    });
    return out;
  }

  function rollRandomTalents(): void {
    if (!race) return;
    const taken = new Set<string>(fixedAndChosenTalents());
    const result: string[] = [];
    let guard = 0;
    while (result.length < randomTalentCount && guard < 500) {
      guard++;
      const r = rollK100();
      const t = gameData.randomTalentForRoll(r);
      if (!t) continue;
      if (taken.has(t) || result.includes(t)) continue;
      result.push(t);
    }
    randomTalents = result;
  }

  // --- Walidacja krokow ---
  const canNext = $derived.by(() => {
    switch (step) {
      case 1:
        return raceName !== "";
      case 2:
        return rolls !== null || ATTRIBUTES.every((a) => (chars[a] ?? 0) > 0);
      case 3:
        return fate + resilience === fatePool;
      case 4:
        return plus5Count === 3 && plus3Count === 3;
      case 5:
        return (
          (race?.talents.filter((t) => t.type === "choice").length ?? 0) ===
            Object.values(talentChoice).filter(Boolean).length &&
          randomTalents.length === randomTalentCount
        );
      default:
        return true;
    }
  });

  const derivedStats = $derived.by(() => {
    if (!race) return null;
    const sB = characteristicBonus(chars["S"] ?? 0);
    const wtB = characteristicBonus(chars["Wt"] ?? 0);
    const swB = characteristicBonus(chars["SW"] ?? 0);
    return {
      wounds: computeWounds(sB, wtB, swB, race.woundsIncludeStrength),
      move: movementSteps(race.movement)
    };
  });

  function manualEdit(attr: string, value: number): void {
    const v = Math.max(0, Math.trunc(value));
    chars = { ...chars, [attr]: v };
    charMode = "manual";
  }

  function next(): void {
    if (step === 1 && rolls === null) {
      // przy wejsciu na krok 2 nic nie rzucamy automatycznie
    }
    if (step < 6) step++;
  }
  function back(): void {
    if (step > 1) step--;
  }

  function finish(): void {
    if (!race) return;
    const skillsPlus5 = Object.entries(skillChoice)
      .filter(([, v]) => v === 5)
      .map(([k]) => k);
    const skillsPlus3 = Object.entries(skillChoice)
      .filter(([, v]) => v === 3)
      .map(([k]) => k);
    const talents = [...fixedAndChosenTalents(), ...randomTalents];
    const input: RaceCreationInput = {
      name: name.trim() || "Nowa Postać",
      race: raceName,
      characteristics: { ...chars },
      fate,
      resilience,
      wounds: derivedStats?.wounds ?? 0,
      movement: race.movement,
      skillsPlus5,
      skillsPlus3,
      talents,
      experience: totalBonusPd
    };
    store.createFromRace(input);
    onClose();
  }
</script>

<Modal title="Kreator postaci — rasa i pochodzenie" {onClose}>
  <ol class="steps">
    {#each ["Rasa", "Cechy", "Punkty", "Umiejętności", "Talenty", "Podsumowanie"] as label, i (label)}
      <li class:active={step === i + 1} class:done={step > i + 1}>{i + 1}. {label}</li>
    {/each}
  </ol>

  {#if step === 1}
    <p class="text-dim">Wybierz rasę z listy lub wylosuj ją (k100). Akceptacja
      wylosowanej rasy daje +20&nbsp;PD.</p>
    <div class="race-grid">
      {#each raceNames as n (n)}
        <button
          class="race-btn"
          class:sel={raceName === n}
          onclick={() => selectRace(n)}
        >{n}</button>
      {/each}
    </div>
    <div class="row">
      <button class="ghost" onclick={rollRace}>🎲 Losuj rasę (k100)</button>
      {#if raceRoll !== null}
        <span class="text-dim">Wynik rzutu: <strong>{raceRoll}</strong> → {rolledRace}</span>
      {/if}
    </div>
    {#if acceptRandomRace}
      <p class="bonus">✓ Zaakceptowano wylosowaną rasę: +20 PD</p>
    {/if}
  {/if}

  {#if step === 2}
    <p class="text-dim">Rzut 2k10 + baza rasowa dla każdej cechy. Akceptacja
      rzutów w kolejności: +50&nbsp;PD; przestawienie wyników: +25&nbsp;PD;
      ręczny rozdział lub przerzut: 0&nbsp;PD.</p>
    <div class="row">
      <button class="primary" onclick={rollChars}>🎲 Rzuć na cechy</button>
      {#if rolls}<button class="ghost" onclick={rerollChars}>Przerzuć (0 PD)</button>{/if}
    </div>
    {#if rolls}
      <table class="ctab">
        <thead>
          <tr><th>Cecha</th><th>Baza</th><th>2k10</th><th>Wartość</th></tr>
        </thead>
        <tbody>
          {#each ATTRIBUTES as attr (attr)}
            <tr>
              <td>{ATTRIBUTE_FULL_NAMES[attr]} <span class="dim">({attr})</span></td>
              <td class="num">{rolls[attr].base}</td>
              <td class="num">{rolls[attr].roll}</td>
              <td class="num">
                <input
                  type="number"
                  min="0"
                  value={chars[attr] ?? 0}
                  oninput={(e) => manualEdit(attr, +(e.currentTarget as HTMLInputElement).value)}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <fieldset class="modes">
        <label><input type="radio" value="ordered" bind:group={charMode} /> Akceptuję w kolejności (+50 PD)</label>
        <label><input type="radio" value="rearranged" bind:group={charMode} /> Przestawiam wyniki (+25 PD)</label>
        <label><input type="radio" value="manual" bind:group={charMode} /> Ręcznie / przerzut (0 PD)</label>
      </fieldset>
    {/if}
  {/if}

  {#if step === 3 && race}
    <div class="stat-cards">
      <div class="stat"><span>Żywotność</span><strong>{derivedStats?.wounds ?? 0}</strong></div>
      <div class="stat"><span>Szybkość</span><strong>{race.movement}</strong></div>
      <div class="stat"><span>Chód</span><strong>{derivedStats?.move.walk ?? 0}</strong></div>
      <div class="stat"><span>Bieg</span><strong>{derivedStats?.move.run ?? 0}</strong></div>
    </div>
    <p class="text-dim">Rozdziel pulę {fatePool} pkt między Punkty Przeznaczenia
      i Punkty Bohatera. Minimum rasowe: Przeznaczenie {race.fate}, Bohatera {race.resilience}.</p>
    <div class="distrib">
      <div class="dpair">
        <span>Punkty Przeznaczenia</span>
        <div class="stepper">
          <button onclick={() => adjFate(-1)} disabled={fate <= race.fate}>−</button>
          <strong>{fate}</strong>
          <button onclick={() => adjFate(1)} disabled={resilience <= race.resilience}>+</button>
        </div>
        <span class="dim">Punkty Szczęścia = {fate}</span>
      </div>
      <div class="dpair">
        <span>Punkty Bohatera</span>
        <div class="stepper">
          <button onclick={() => adjFate(1)} disabled={resilience <= race.resilience}>−</button>
          <strong>{resilience}</strong>
          <button onclick={() => adjFate(-1)} disabled={fate <= race.fate}>+</button>
        </div>
        <span class="dim">Determinacja = {resilience}</span>
      </div>
    </div>
    <p class="text-dim">Rozdysponowano: {fate + resilience} / {fatePool}</p>
  {/if}

  {#if step === 4 && race}
    <p class="text-dim">Wybierz <strong>3</strong> umiejętności po +5 oraz kolejne
      <strong>3</strong> po +3.</p>
    <div class="pick-counters">
      <span class="pc" class:done={plus5Count === 3}>+5: {plus5Count}/3</span>
      <span class="pc" class:done={plus3Count === 3}>+3: {plus3Count}/3</span>
      <button class="ghost btn-sm" onclick={resetSkills} disabled={plus5Count === 0 && plus3Count === 0}>
        Wyczyść
      </button>
    </div>
    <ul class="skill-list">
      {#each race.skills as skill (skill)}
        {@const val = skillChoice[skill] ?? 0}
        <li class:has5={val === 5} class:has3={val === 3}>
          <span class="sk-name">{skill}</span>
          <span class="sk-attr dim">{gameData.skillBaseAttr(skill) ?? "?"}</span>
          <button
            class="pick"
            class:on={val === 5}
            disabled={val !== 5 && plus5Count >= 3}
            onclick={() => toggleSkill(skill, 5)}
          >+5</button>
          <button
            class="pick"
            class:on={val === 3}
            disabled={val !== 3 && plus3Count >= 3}
            onclick={() => toggleSkill(skill, 3)}
          >+3</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if step === 5 && race}
    <p class="text-dim">Talenty rasowe. Dla wyborów „albo” wskaż jeden talent;
      talenty losowe wylosuj z tabeli (k100).</p>
    <ul class="talent-list">
      {#each race.talents as t, i (i)}
        <li>
          {#if t.type === "fixed"}
            <span class="tg-fixed">✓ {t.name}</span>
          {:else if t.type === "choice"}
            <div class="tg-choice">
              <span class="dim tg-label">Wybierz:</span>
              {#each t.options as opt (opt)}
                <button
                  class="pick"
                  class:on={talentChoice[i] === opt}
                  onclick={() => selectTalent(i, opt)}
                >{opt}</button>
              {/each}
            </div>
          {:else}
            <span class="dim">Losowe talenty: {t.count}</span>
          {/if}
        </li>
      {/each}
    </ul>
    {#if randomTalentCount > 0}
      <div class="row">
        <button class="ghost" onclick={rollRandomTalents}>
          🎲 {randomTalents.length ? "Przelosuj" : "Losuj"} talenty ({randomTalentCount})
        </button>
        {#if randomTalents.length}
          <span class="text-dim">{randomTalents.join(", ")}</span>
        {/if}
      </div>
    {/if}
  {/if}

  {#if step === 6 && race}
    <label class="fld">
      <span>Nazwa postaci</span>
      <input type="text" bind:value={name} />
    </label>
    <div class="summary">
      <p><strong>Rasa:</strong> {raceName}</p>
      <p><strong>Cechy:</strong>
        {#each ATTRIBUTES as a (a)}<span class="chip">{a} {chars[a] ?? 0}</span>{/each}
      </p>
      <p><strong>Żywotność:</strong> {derivedStats?.wounds ?? 0} &nbsp;
        <strong>Szybkość:</strong> {race.movement} ({derivedStats?.move.walk}/{derivedStats?.move.run})</p>
      <p><strong>Punkty Przeznaczenia:</strong> {fate} &nbsp;
        <strong>Punkty Bohatera:</strong> {resilience}</p>
      <p><strong>Umiejętności +5:</strong>
        {Object.entries(skillChoice).filter(([, v]) => v === 5).map(([k]) => k).join(", ")}</p>
      <p><strong>Umiejętności +3:</strong>
        {Object.entries(skillChoice).filter(([, v]) => v === 3).map(([k]) => k).join(", ")}</p>
      <p><strong>Talenty:</strong> {[...fixedAndChosenTalents(), ...randomTalents].join(", ")}</p>
      <p class="bonus">Bonusowe PD startowe: {totalBonusPd}</p>
    </div>
  {/if}

  {#snippet footer()}
    <button class="ghost" onclick={onClose}>Anuluj</button>
    {#if step > 1}<button class="ghost" onclick={back}>Wstecz</button>{/if}
    {#if step < 6}
      <button class="primary" onclick={next} disabled={!canNext}>Dalej</button>
    {:else}
      <button class="primary" onclick={finish}>Utwórz postać</button>
    {/if}
  {/snippet}
</Modal>

<style>
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-2);
    font-size: var(--fs-xs, 0.78rem);
  }
  .steps li {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2, rgba(255, 255, 255, 0.05));
    color: var(--text-dim, #999);
    border: 1px solid var(--border);
  }
  .steps li.active {
    background: var(--accent-strong);
    color: #fff;
    border-color: var(--accent-strong);
  }
  .steps li.done {
    color: var(--success-strong, #4caf50);
    border-color: var(--success-strong, #4caf50);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .dim,
  .text-dim {
    color: var(--text-dim, #999);
  }
  .bonus {
    color: var(--success-strong, #4caf50);
    font-weight: 600;
  }

  .race-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: var(--space-2);
  }
  .race-btn {
    padding: var(--space-2);
    border: 1px solid var(--border);
    background: var(--surface-2, rgba(255, 255, 255, 0.04));
  }
  .race-btn.sel {
    border-color: var(--accent-strong);
    background: var(--accent-strong);
    color: #fff;
  }

  .ctab {
    width: 100%;
    border-collapse: collapse;
  }
  .ctab th,
  .ctab td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }
  .ctab td.num,
  .ctab th:nth-child(n + 2) {
    text-align: right;
  }
  .ctab input {
    width: 70px;
    text-align: right;
  }
  .modes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius, 6px);
    padding: var(--space-2);
  }
  .modes label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius, 6px);
  }
  .stat span {
    font-size: var(--fs-xs, 0.78rem);
    color: var(--text-dim, #999);
  }
  .stat strong {
    font-size: var(--fs-lg);
    color: var(--accent-strong);
  }

  .distrib {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .dpair {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .stepper strong {
    min-width: 2ch;
    text-align: center;
    font-size: var(--fs-lg);
  }

  .skill-list,
  .talent-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .skill-list li {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: var(--space-2);
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius, 6px);
  }
  .skill-list li.has5 {
    border-color: var(--accent-strong);
  }
  .skill-list li.has3 {
    border-color: var(--success-strong, #4caf50);
  }
  .sk-attr {
    font-size: var(--fs-xs, 0.78rem);
  }
  .pick {
    min-height: auto;
    padding: 2px 10px;
    border: 1px solid var(--border);
    background: transparent;
  }
  .pick.on {
    background: var(--accent-strong);
    color: #fff;
    border-color: var(--accent-strong);
  }
  .pick:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pick-counters {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .pc {
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }
  .pc.done {
    color: var(--success-strong, #4caf50);
    border-color: var(--success-strong, #4caf50);
  }
  .tg-label {
    align-self: center;
  }
  .tg-fixed {
    color: var(--success-strong, #4caf50);
  }
  .tg-choice {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .summary p {
    margin: 0;
  }
  .chip {
    display: inline-block;
    margin: 2px;
    padding: 1px 6px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: var(--fs-xs, 0.78rem);
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
