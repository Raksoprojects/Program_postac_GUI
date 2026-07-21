<script lang="ts">
  import Modal from "./Modal.svelte";
  import SpecializationModal from "./SpecializationModal.svelte";
  import CharacteristicBonusModal from "./CharacteristicBonusModal.svelte";
  import { store, ATTRIBUTE_FULL_NAMES } from "../lib/store.svelte";
  import * as gameData from "../lib/gameData";
  import {
    parseSpecialization,
    needsSpecialization,
    type SpecInfo
  } from "../lib/specialization";
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
  // Pochodzenie (lokacja startowa) - opcjonalne, modyfikuje umiej./talenty rasowe.
  let originName = $state("");

  // Krok 2 - cechy
  type CharMode = "ordered" | "rearranged" | "pointbuy" | "sandbox";
  /** Minimalna i maksymalna wartosc przydzialu w trybie punktowym oraz pula. */
  const POINT_MIN = 4;
  const POINT_MAX = 18;
  const POINT_POOL = 100;

  let rolls = $state<CharacteristicRolls | null>(null);
  let charMode = $state<CharMode>("ordered");
  /** Czy wykonano przerzut (0 PD, ale zamiana wynikow nadal dozwolona). */
  let rerolled = $state(false);
  /** Wartosc rzutu 2k10 przypisana aktualnie do danej cechy (do zamiany). */
  let rollAssign = $state<Record<string, number>>({});
  /** Przydzial punktow w trybie punktowym (start: POINT_MIN na kazda ceche). */
  let pointAlloc = $state<Record<string, number>>({});
  /** Recznie wpisane wartosci w trybie piaskownicy. */
  let sandboxVals = $state<Record<string, number>>({});

  // Krok 3 - Los / Hart
  let fate = $state(0);
  let resilience = $state(0);

  // Krok 4 - umiejetnosci rasowe (nazwa -> 0 | 5 | 3)
  let skillChoice = $state<Record<string, number>>({});
  // Wybrana specjalizacja dla umiejetnosci typu "(Dowolny)"/wyboru (raw -> pelna nazwa).
  let skillSpec = $state<Record<string, string>>({});
  // Oczekujacy wybor specjalizacji przy zaznaczaniu umiejetnosci.
  let specTarget = $state<{ skill: string; val: number; info: SpecInfo } | null>(null);

  // Krok 5 - talenty rasowe
  let talentChoice = $state<Record<number, string>>({});
  // Losowe talenty rasowe - kazdy losowany OSOBNO, z widocznym rzutem k100 (pkt 3).
  let randomRolls = $state<{ roll: number; talent: string }[]>([]);
  let randomTalents = $derived(randomRolls.map((r) => r.talent));
  // Komunikat przy rzucie na duplikat / puste pole tabeli (trzeba rzucic ponownie).
  let talentRollMsg = $state<string | null>(null);

  // Kolejka wyboru bonusu dla wylosowanych/wybranych talentow +cecha (pkt 22).
  let charBonusQueue = $state<{ name: string; code: string }[]>([]);
  let charBonusIndex = $state(0);

  const race = $derived(raceName ? gameData.getRace(raceName) : undefined);

  // Pochodzenia dostepne dla wybranej rasy (puste = brak; krok pochodzenia ukryty).
  const raceOrigins = $derived(raceName ? gameData.getOrigins(raceName) : []);
  const origin = $derived(originName ? gameData.getOrigin(raceName, originName) : undefined);
  /**
   * Rasa z zastosowanym pochodzeniem: pochodzenie NADPISUJE liste umiejetnosci
   * i talentow do wyboru; cechy/Los/Hart/ruch pozostaja rasowe.
   */
  const effRace = $derived.by(() => {
    if (!race) return undefined;
    if (!origin) return race;
    return {
      ...race,
      skills: origin.skills ?? race.skills,
      talents: origin.talents ?? race.talents
    };
  });

  /** Bazowa wartosc rasowa danej cechy (czesc niezalezna od rzutu). */
  function raceBase(attr: string): number {
    return race?.characteristics[attr] ?? 0;
  }

  /** Aktualne wartosci cech wyliczone z trybu i danych pomocniczych. */
  const chars = $derived.by<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const attr of ATTRIBUTES) {
      if (charMode === "sandbox") {
        out[attr] = sandboxVals[attr] ?? 0;
      } else if (charMode === "pointbuy") {
        out[attr] = raceBase(attr) + (pointAlloc[attr] ?? POINT_MIN);
      } else {
        // ordered / rearranged
        out[attr] = rolls ? raceBase(attr) + (rollAssign[attr] ?? 0) : 0;
      }
    }
    return out;
  });

  /** Czy mozna zamieniac wyniki rzutow (przeciaganie): tryb przestawienia lub po przerzucie. */
  const canSwapRolls = $derived(
    !!rolls && (charMode === "rearranged" || rerolled)
  );

  /** Suma rozdanych punktow w trybie punktowym. */
  const pointSpent = $derived(
    ATTRIBUTES.reduce((s, a) => s + (pointAlloc[a] ?? POINT_MIN), 0)
  );
  const pointRemaining = $derived(POINT_POOL - pointSpent);

  const acceptRandomRace = $derived(
    rolledRace !== "" && rolledRace === raceName
  );
  // W piaskownicy zerujemy CALE PD procesu tworzenia (lacznie z bonusem za rase).
  const raceBonusPd = $derived(
    charMode === "sandbox" ? 0 : acceptRandomRace ? 20 : 0
  );
  const charBonusPd = $derived.by(() => {
    if (charMode === "sandbox" || charMode === "pointbuy") return 0;
    if (rerolled || !rolls) return 0;
    return charMode === "ordered" ? 50 : 25;
  });
  const totalBonusPd = $derived(raceBonusPd + charBonusPd);

  const fatePool = $derived(
    race ? race.fate + race.resilience + race.extraPoints : 0
  );
  /** Punkty z puli extraPoints jeszcze nierozdzielone. */
  const fateRemaining = $derived(fatePool - fate - resilience);

  const plus5Count = $derived(
    Object.values(skillChoice).filter((v) => v === 5).length
  );
  const plus3Count = $derived(
    Object.values(skillChoice).filter((v) => v === 3).length
  );

  const randomTalentCount = $derived(
    effRace ? effRace.talents.reduce((n, t) => n + (t.type === "random" ? t.count : 0), 0) : 0
  );

  // --- Krok 1 ---
  function selectRace(n: string): void {
    raceName = n;
    resetDerivedFromRace();
  }

  /** Wybor pochodzenia: zmienia pule umiej./talentow, wiec zeruje ich wybory. */
  function selectOrigin(name: string): void {
    originName = name;
    skillChoice = {};
    skillSpec = {};
    talentChoice = {};
    randomRolls = [];
    talentRollMsg = null;
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
    rollAssign = {};
    pointAlloc = {};
    sandboxVals = {};
    rerolled = false;
    charMode = "ordered";
    const def = raceName ? gameData.getRace(raceName) : undefined;
    fate = def ? def.fate : 0;
    resilience = def ? def.resilience : 0;
    skillChoice = {};
    talentChoice = {};
    randomRolls = [];
    talentRollMsg = null;
    originName = "";
  }

  // --- Krok 2 ---
  function rollChars(): void {
    if (!race) return;
    const r = rollRaceCharacteristics(race);
    rolls = r;
    const assign: Record<string, number> = {};
    for (const attr of ATTRIBUTES) assign[attr] = r[attr].roll;
    rollAssign = assign;
    rerolled = false;
    if (charMode !== "ordered" && charMode !== "rearranged") charMode = "ordered";
  }

  function rerollChars(): void {
    if (!race) return;
    const r = rollRaceCharacteristics(race);
    rolls = r;
    const assign: Record<string, number> = {};
    for (const attr of ATTRIBUTES) assign[attr] = r[attr].roll;
    rollAssign = assign;
    rerolled = true; // 0 PD, ale zamiana wynikow nadal dozwolona
  }

  /** Zmiana trybu rozdzialu cech wraz z inicjalizacja danych pomocniczych. */
  function setCharMode(mode: CharMode): void {
    charMode = mode;
    if (mode === "pointbuy") {
      const next: Record<string, number> = {};
      for (const attr of ATTRIBUTES) next[attr] = POINT_MIN; // auto: minimum na kazda
      pointAlloc = next;
    } else if (mode === "sandbox") {
      const next: Record<string, number> = {};
      for (const attr of ATTRIBUTES) next[attr] = chars[attr] ?? 0;
      sandboxVals = next;
    }
  }

  /** Zamienia wartosci rzutow miedzy dwiema cechami (przestawienie / po przerzucie). */
  function swapRolls(a: string, b: string): void {
    if (a === b) return;
    const next = { ...rollAssign };
    const tmp = next[a];
    next[a] = next[b];
    next[b] = tmp;
    rollAssign = next;
  }

  // --- Przeciaganie / dotyk (Pointer Events) do zamiany wynikow ---
  let dragAttr = $state<string | null>(null);
  let dragValue = $state<number | null>(null);
  let dragPos = $state<{ x: number; y: number } | null>(null);
  let selectedAttr = $state<string | null>(null);
  let dragMoved = false;

  function onRollPointerDown(attr: string, e: PointerEvent): void {
    if (!canSwapRolls) return;
    e.preventDefault();
    dragAttr = attr;
    dragValue = rollAssign[attr] ?? 0;
    dragMoved = false;
    dragPos = { x: e.clientX, y: e.clientY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onRollPointerMove(e: PointerEvent): void {
    if (dragAttr === null) return;
    dragMoved = true;
    dragPos = { x: e.clientX, y: e.clientY };
  }

  function onRollPointerUp(e: PointerEvent): void {
    if (dragAttr === null) return;
    const src = dragAttr;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const target = el?.closest<HTMLElement>("[data-attr]")?.dataset.attr ?? null;
    if (dragMoved && target && target !== src) {
      swapRolls(src, target);
      selectedAttr = null;
    } else if (!dragMoved) {
      // Dotkniecie bez przeciagniecia = wybor; kolejne dotkniecie zamienia.
      if (selectedAttr && selectedAttr !== src) {
        swapRolls(selectedAttr, src);
        selectedAttr = null;
      } else {
        selectedAttr = selectedAttr === src ? null : src;
      }
    }
    dragAttr = null;
    dragValue = null;
    dragPos = null;
  }

  /** Ustawia przydzial punktowy danej cechy w granicach [MIN, MAX] i puli. */
  function setPointAlloc(attr: string, value: number): void {
    const others = ATTRIBUTES.reduce(
      (s, a) => s + (a === attr ? 0 : pointAlloc[a] ?? POINT_MIN),
      0
    );
    const maxByPool = POINT_POOL - others;
    let v = Math.trunc(Number(value));
    if (!Number.isFinite(v)) v = POINT_MIN;
    v = Math.max(POINT_MIN, Math.min(POINT_MAX, Math.min(v, maxByPool)));
    pointAlloc = { ...pointAlloc, [attr]: v };
  }

  function adjPoint(attr: string, delta: number): void {
    setPointAlloc(attr, (pointAlloc[attr] ?? POINT_MIN) + delta);
  }


  // --- Krok 3 ---
  // Pula extraPoints rozdzielana niezaleznie miedzy Przeznaczenie i Bohatera.
  // Kazda wartosc nie schodzi ponizej minimum rasowego; suma = fatePool.
  function incFate(): void {
    if (fateRemaining > 0) fate += 1;
  }
  function decFate(): void {
    if (race && fate > race.fate) fate -= 1;
  }
  function incResilience(): void {
    if (fateRemaining > 0) resilience += 1;
  }
  function decResilience(): void {
    if (race && resilience > race.resilience) resilience -= 1;
  }

  // --- Krok 4 ---
  function toggleSkill(skill: string, val: number): void {
    const cur = skillChoice[skill] ?? 0;
    if (cur === val) {
      skillChoice = { ...skillChoice, [skill]: 0 };
      const { [skill]: _drop, ...rest } = skillSpec;
      skillSpec = rest;
      return;
    }
    if (val === 5 && plus5Count >= 3) return;
    if (val === 3 && plus3Count >= 3) return;
    // Umiejetnosc ze specjalizacja "(Dowolny)"/wyboru — zapytaj przed przydzialem.
    const info = parseSpecialization(skill);
    if (needsSpecialization(info) && !skillSpec[skill]) {
      specTarget = { skill, val, info };
      return;
    }
    skillChoice = { ...skillChoice, [skill]: val };
  }

  function onSkillSpecConfirm(fullName: string): void {
    if (!specTarget) return;
    const { skill, val } = specTarget;
    skillSpec = { ...skillSpec, [skill]: fullName };
    skillChoice = { ...skillChoice, [skill]: val };
    specTarget = null;
  }

  function resetSkills(): void {
    skillChoice = {};
    skillSpec = {};
  }

  // --- Krok 5 ---
  function selectTalent(idx: number, option: string): void {
    talentChoice = { ...talentChoice, [idx]: option };
  }

  function fixedAndChosenTalents(): string[] {
    if (!effRace) return [];
    const out: string[] = [];
    effRace.talents.forEach((t, i) => {
      if (t.type === "fixed") out.push(t.name);
      else if (t.type === "choice") {
        const sel = talentChoice[i];
        if (sel) out.push(sel);
      }
    });
    return out;
  }

  function rollNextTalent(): void {
    if (!race) return;
    if (randomRolls.length >= randomTalentCount) return;
    const taken = new Set<string>([...fixedAndChosenTalents(), ...randomTalents]);
    const roll = rollK100();
    const t = gameData.randomTalentForRoll(roll);
    if (!t) {
      talentRollMsg = `Rzut ${roll}: brak talentu w tabeli — rzuć ponownie.`;
      return;
    }
    if (taken.has(t)) {
      talentRollMsg = `Rzut ${roll}: „${t}" już wylosowany — rzuć ponownie.`;
      return;
    }
    talentRollMsg = null;
    randomRolls = [...randomRolls, { roll, talent: t }];
  }

  function undoLastTalent(): void {
    randomRolls = randomRolls.slice(0, -1);
    talentRollMsg = null;
  }

  function clearRandomTalents(): void {
    randomRolls = [];
    talentRollMsg = null;
  }

  // --- Walidacja krokow ---
  const canNext = $derived.by(() => {
    switch (step) {
      case 1:
        return raceName !== "";
      case 2:
        if (charMode === "pointbuy") return pointRemaining === 0;
        if (charMode === "sandbox")
          return ATTRIBUTES.every((a) => (chars[a] ?? 0) > 0);
        return rolls !== null;
      case 3:
        return fateRemaining === 0;
      case 4:
        return plus5Count === 3 && plus3Count === 3;
      case 5:
        return (
          (effRace?.talents.filter((t) => t.type === "choice").length ?? 0) ===
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
    sandboxVals = { ...sandboxVals, [attr]: v };
  }

  function next(): void {
    if (step < 6) step++;
  }
  function back(): void {
    if (step > 1) step--;
  }

  function finish(): void {
    if (!race) return;
    const skillsPlus5 = Object.entries(skillChoice)
      .filter(([, v]) => v === 5)
      .map(([k]) => skillSpec[k] ?? k);
    const skillsPlus3 = Object.entries(skillChoice)
      .filter(([, v]) => v === 3)
      .map(([k]) => skillSpec[k] ?? k);
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
    // Wylosowane/wybrane talenty +cecha wymagaja jeszcze wyboru bonusu
    // (+5 albo rzut 1k10). Pokazujemy modal po kolei; zamykamy dopiero po
    // ostatnim wyborze.
    const queue: { name: string; code: string }[] = [];
    for (const tname of talents) {
      const code = gameData.getTalent(tname)?.adds_characteristic;
      if (code) queue.push({ name: tname, code });
    }
    if (queue.length > 0) {
      charBonusQueue = queue;
      charBonusIndex = 0;
      return;
    }
    onClose();
  }

  function onCharBonusConfirm(value: number): void {
    const cur = charBonusQueue[charBonusIndex];
    if (cur) store.setTalentCharacteristicBonus(cur.name, cur.code, value);
    charBonusIndex++;
    if (charBonusIndex >= charBonusQueue.length) {
      charBonusQueue = [];
      charBonusIndex = 0;
      onClose();
    }
  }

  function onCharBonusClose(): void {
    // Zamkniecie bez wyboru = domyslne +5 (talent zawsze podnosi ceche).
    onCharBonusConfirm(5);
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
    {#if raceOrigins.length > 0}
      <label class="fld origin-pick">
        <span>Pochodzenie (lokacja startowa)</span>
        <select value={originName} onchange={(e) => selectOrigin(e.currentTarget.value)}>
          <option value="">— domyślne (rasowe) —</option>
          {#each raceOrigins as o (o.name)}
            <option value={o.name}>{o.name}</option>
          {/each}
        </select>
      </label>
      {#if origin?.description}
        <p class="text-dim">{origin.description}</p>
      {/if}
    {/if}
  {/if}

  {#if step === 2}
    <p class="text-dim">Wybierz sposób wyznaczenia cech. Każda cecha = baza rasowa
      + część zmienna (rzut, przydział lub wartość ręczna).</p>
    <fieldset class="modes">
      <label><input type="radio" value="ordered" checked={charMode === "ordered"} onchange={() => setCharMode("ordered")} /> Rzut w kolejności (+50&nbsp;PD)</label>
      <label><input type="radio" value="rearranged" checked={charMode === "rearranged"} onchange={() => setCharMode("rearranged")} /> Rzut z przestawianiem wyników (+25&nbsp;PD)</label>
      <label><input type="radio" value="pointbuy" checked={charMode === "pointbuy"} onchange={() => setCharMode("pointbuy")} /> Rozdział punktowy — {POINT_POOL} pkt (0&nbsp;PD)</label>
      <label><input type="radio" value="sandbox" checked={charMode === "sandbox"} onchange={() => setCharMode("sandbox")} /> Piaskownica — pełna ręczna edycja (0&nbsp;PD, zeruje całe PD)</label>
    </fieldset>

    {#if charMode === "ordered" || charMode === "rearranged"}
      <div class="row">
        <button class="primary" onclick={rollChars}>🎲 {rolls ? "Rzuć ponownie od nowa" : "Rzuć na cechy"}</button>
        {#if rolls}<button class="ghost" onclick={rerollChars}>🎲 Przerzuć (0 PD)</button>{/if}
      </div>
      {#if rerolled}
        <p class="text-dim">Po przerzucie bonus PD = 0. Możesz nadal przestawiać wyniki.</p>
      {/if}
      {#if charMode === "rearranged" || rerolled}
        <p class="text-dim">Przeciągnij wartość rzutu (kolumna 2k10) na inną cechę,
          aby je zamienić. Na dotyku: dotknij jednej, potem drugiej.</p>
      {/if}
      {#if rolls}
        <table class="ctab">
          <thead>
            <tr><th>Cecha</th><th>Baza</th><th>2k10</th><th>Wartość</th></tr>
          </thead>
          <tbody>
            {#each ATTRIBUTES as attr (attr)}
              <tr data-attr={attr}>
                <td>{ATTRIBUTE_FULL_NAMES[attr]} <span class="dim">({attr})</span></td>
                <td class="num">{raceBase(attr)}</td>
                <td class="num">
                  {#if canSwapRolls}
                    <button
                      type="button"
                      class="roll-chip"
                      class:sel={selectedAttr === attr}
                      class:dragging={dragAttr === attr}
                      data-attr={attr}
                      onpointerdown={(e) => onRollPointerDown(attr, e)}
                      onpointermove={onRollPointerMove}
                      onpointerup={onRollPointerUp}
                    >{rollAssign[attr] ?? 0}</button>
                  {:else}
                    {rollAssign[attr] ?? 0}
                  {/if}
                </td>
                <td class="num"><strong>{chars[attr] ?? 0}</strong></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {:else if charMode === "pointbuy"}
      <p class="text-dim">Każda cecha startuje z minimum {POINT_MIN}. Rozdaj
        pozostałe punkty (min {POINT_MIN}, maks {POINT_MAX} na cechę).</p>
      <p class="pc" class:done={pointRemaining === 0}>Pozostało: {pointRemaining} / {POINT_POOL}</p>
      <table class="ctab">
        <thead>
          <tr><th>Cecha</th><th>Baza</th><th>Przydział</th><th>Wartość</th></tr>
        </thead>
        <tbody>
          {#each ATTRIBUTES as attr (attr)}
            <tr>
              <td>{ATTRIBUTE_FULL_NAMES[attr]} <span class="dim">({attr})</span></td>
              <td class="num">{raceBase(attr)}</td>
              <td class="num">
                <div class="stepper sm">
                  <button type="button" onclick={() => adjPoint(attr, -1)} disabled={(pointAlloc[attr] ?? POINT_MIN) <= POINT_MIN}>−</button>
                  <input
                    type="number"
                    min={POINT_MIN}
                    max={POINT_MAX}
                    value={pointAlloc[attr] ?? POINT_MIN}
                    oninput={(e) => setPointAlloc(attr, +(e.currentTarget as HTMLInputElement).value)}
                  />
                  <button type="button" onclick={() => adjPoint(attr, 1)} disabled={(pointAlloc[attr] ?? POINT_MIN) >= POINT_MAX || pointRemaining <= 0}>+</button>
                </div>
              </td>
              <td class="num"><strong>{chars[attr] ?? 0}</strong></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="text-dim">Piaskownica: wpisz dowolne wartości cech. Cały proces
        tworzenia daje 0&nbsp;PD (również bonus za rasę).</p>
      <table class="ctab">
        <thead>
          <tr><th>Cecha</th><th>Wartość</th></tr>
        </thead>
        <tbody>
          {#each ATTRIBUTES as attr (attr)}
            <tr>
              <td>{ATTRIBUTE_FULL_NAMES[attr]} <span class="dim">({attr})</span></td>
              <td class="num">
                <input
                  type="number"
                  min="0"
                  value={sandboxVals[attr] ?? 0}
                  oninput={(e) => manualEdit(attr, +(e.currentTarget as HTMLInputElement).value)}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <p class="bonus">Bonusowe PD z tego kroku: {charBonusPd} &nbsp;·&nbsp; razem: {totalBonusPd} PD</p>
  {/if}

  {#if step === 3 && race}
    <div class="stat-cards">
      <div class="stat"><span>Żywotność</span><strong>{derivedStats?.wounds ?? 0}</strong></div>
      <div class="stat"><span>Szybkość</span><strong>{race.movement}</strong></div>
      <div class="stat"><span>Chód</span><strong>{derivedStats?.move.walk ?? 0}</strong></div>
      <div class="stat"><span>Bieg</span><strong>{derivedStats?.move.run ?? 0}</strong></div>
    </div>
    <p class="text-dim">Rozdaj pulę {fatePool} pkt na Punkty Przeznaczenia
      i Punkty Bohatera. Minimum rasowe: Przeznaczenie {race.fate}, Bohatera
      {race.resilience}. Pozostało do rozdania: <strong>{fateRemaining}</strong>.</p>
    <div class="distrib">
      <div class="dpair">
        <span>Punkty Przeznaczenia</span>
        <div class="stepper">
          <button onclick={decFate} disabled={fate <= race.fate}>−</button>
          <strong>{fate}</strong>
          <button onclick={incFate} disabled={fateRemaining <= 0}>+</button>
        </div>
        <span class="dim">Punkty Szczęścia = {fate}</span>
      </div>
      <div class="dpair">
        <span>Punkty Bohatera</span>
        <div class="stepper">
          <button onclick={decResilience} disabled={resilience <= race.resilience}>−</button>
          <strong>{resilience}</strong>
          <button onclick={incResilience} disabled={fateRemaining <= 0}>+</button>
        </div>
        <span class="dim">Determinacja = {resilience}</span>
      </div>
    </div>
    <p class="text-dim" class:bonus={fateRemaining === 0}>Rozdysponowano: {fate + resilience} / {fatePool}</p>
  {/if}

  {#if step === 4 && effRace}
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
      {#each effRace.skills as skill (skill)}
        {@const val = skillChoice[skill] ?? 0}
        <li class:has5={val === 5} class:has3={val === 3}>
          <span class="sk-name">{skillSpec[skill] ?? skill}</span>
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

  {#if step === 5 && effRace}
    <p class="text-dim">Talenty rasowe. Dla wyborów „albo” wskaż jeden talent;
      talenty losowe wylosuj z tabeli (k100).</p>
    <ul class="talent-list">
      {#each effRace.talents as t, i (i)}
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
      <div class="random-talents">
        <div class="row">
          <button
            class="ghost"
            onclick={rollNextTalent}
            disabled={randomRolls.length >= randomTalentCount}
          >
            🎲 Rzuć na talent (k100) — {randomRolls.length}/{randomTalentCount}
          </button>
          {#if randomRolls.length}
            <button class="btn-sm ghost" onclick={undoLastTalent}>← Cofnij ostatni</button>
            <button class="btn-sm ghost" onclick={clearRandomTalents}>Wyczyść</button>
          {/if}
        </div>
        {#if talentRollMsg}
          <p class="msg text-dim">{talentRollMsg}</p>
        {/if}
        {#if randomRolls.length}
          <ol class="roll-list">
            {#each randomRolls as r (r.talent)}
              <li><span class="roll-num">🎲 {r.roll}</span> → <strong>{r.talent}</strong></li>
            {/each}
          </ol>
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

  {#if dragAttr !== null && dragPos}
    <div class="drag-ghost" style="left:{dragPos.x}px; top:{dragPos.y}px">{dragValue}</div>
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

{#if specTarget}
  <SpecializationModal
    info={specTarget.info}
    onConfirm={onSkillSpecConfirm}
    onClose={() => (specTarget = null)}
  />
{/if}

{#if charBonusQueue.length > 0 && charBonusIndex < charBonusQueue.length}
  <CharacteristicBonusModal
    talentName={charBonusQueue[charBonusIndex].name}
    charCode={charBonusQueue[charBonusIndex].code}
    onConfirm={onCharBonusConfirm}
    onClose={onCharBonusClose}
  />
{/if}

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

  .roll-chip {
    min-width: 3ch;
    padding: 2px 10px;
    border: 1px solid var(--accent-strong);
    border-radius: var(--radius, 6px);
    background: var(--surface-2, rgba(255, 255, 255, 0.06));
    font-variant-numeric: tabular-nums;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .roll-chip.sel {
    background: var(--accent-strong);
    color: #fff;
  }
  .roll-chip.dragging {
    opacity: 0.4;
  }
  .stepper.sm {
    gap: 4px;
    justify-content: flex-end;
  }
  .stepper.sm input {
    width: 56px;
    text-align: center;
  }
  .stepper.sm button {
    min-width: 28px;
    padding: 2px 6px;
  }
  .drag-ghost {
    position: fixed;
    z-index: 1000;
    transform: translate(-50%, -50%);
    padding: 4px 12px;
    border-radius: var(--radius, 6px);
    background: var(--accent-strong);
    color: #fff;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
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

  .random-talents {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .roll-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .roll-list li {
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius, 6px);
  }
  .roll-num {
    font-variant-numeric: tabular-nums;
    color: var(--text-dim, inherit);
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
