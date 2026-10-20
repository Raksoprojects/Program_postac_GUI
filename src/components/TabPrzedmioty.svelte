<script lang="ts">
  import ArtefactCard from "./ArtefactCard.svelte";
  import { categoryChoices, categoryList, rollArtefact, type Artefact, type ArtefactOptions } from "../lib/artefacts";
  import * as gameData from "../lib/gameData";
  import { store } from "../lib/store.svelte";

  type Mode = "losowy" | "polLosowy" | "wlasny";
  const MODES: { id: Mode; label: string; hint: string }[] = [
    { id: "losowy", label: "Losowy", hint: "Kategoria i przedmiot z tabel k100 — jedno kliknięcie." },
    { id: "polLosowy", label: "Pół-losowy", hint: "Wybierz kategorię albo liczbę przedmiotów, resztę wylosujemy." },
    { id: "wlasny", label: "Własny", hint: "Wybierasz kategorię i konkretny przedmiot; losują się tylko jego szczegóły." }
  ];

  // Dane generatora ladowane leniwie (ok. 190 kB) przy pierwszym otwarciu zakladki.
  let ready = $state(gameData.getArtefacts() !== null);
  let loadError = $state(false);
  if (!gameData.getArtefacts()) {
    gameData.loadArtefactData().then((ok) => {
      ready = ok;
      loadError = !ok;
    });
  }

  let mode = $state<Mode>("losowy");
  let category = $state("");
  let item = $state("");
  let count = $state(1);
  let allowCursed = $state(true);

  let categories = $derived(ready ? categoryList() : []);
  let choices = $derived(ready && category ? categoryChoices(category) : []);
  let intro = $derived(ready && category ? gameData.getArtefacts()?.categories[category]?.intro : undefined);

  // W trybie wlasnym zawsze jest kategoria i pozycja.
  $effect(() => {
    if (mode !== "wlasny" || !categories.length) return;
    if (!category) category = categories[0].key;
    if (!choices.includes(item)) item = choices[0] ?? "";
  });

  interface Entry {
    id: number;
    spec: ArtefactOptions;
    artefact: Artefact;
    saved: boolean;
  }
  let results = $state<Entry[]>([]);
  let nextId = 0;

  function spec(): ArtefactOptions {
    if (mode === "losowy") return {};
    if (mode === "polLosowy") return { category: category || undefined, allowCursed };
    return { category, item };
  }

  function generate() {
    const s = spec();
    const n = mode === "polLosowy" ? count : 1;
    const fresh = Array.from({ length: n }, () => ({ id: nextId++, spec: s, artefact: rollArtefact(s), saved: false }));
    results = [...fresh, ...results].slice(0, 30);
  }

  function reroll(id: number) {
    results = results.map((e) => (e.id === id ? { ...e, artefact: rollArtefact(e.spec), saved: false } : e));
  }

  function remove(id: number) {
    results = results.filter((e) => e.id !== id);
  }

  function save(e: Entry) {
    store.addMagicItem(e.artefact);
    results = results.map((x) => (x.id === e.id ? { ...x, saved: true } : x));
  }

  let owned = $derived(store.magicItems);
</script>

<section class="tab">
  <div class="panel owned">
    <h3>Przedmioty magiczne postaci</h3>
    {#if owned.length}
      {#each owned as a, i (i)}
        <ArtefactCard artefact={a} compact onremove={() => store.removeMagicItem(i)} />
      {/each}
    {:else}
      <p class="text-dim small">Brak. Wylosuj przedmiot poniżej i kliknij „Dodaj do postaci” — zapisze się w pliku postaci (JSON).</p>
    {/if}
  </div>

  <div class="panel controls">
    <h3>Generator przedmiotów magicznych</h3>
    {#if loadError}
      <p class="val-danger">Nie udało się wczytać danych generatora (artefacts.json).</p>
    {:else if !ready}
      <p class="text-dim">Wczytywanie danych…</p>
    {:else}
      <div class="mode-row">
        <div class="seg" role="group" aria-label="Metoda losowania">
          {#each MODES as m (m.id)}
            <button class:on={mode === m.id} aria-pressed={mode === m.id} onclick={() => (mode = m.id)}>{m.label}</button>
          {/each}
        </div>
        <span class="text-dim small">{MODES.find((m) => m.id === mode)?.hint}</span>
      </div>

      {#if mode !== "losowy"}
        <div class="form">
          <label>Kategoria
            <select bind:value={category}>
              {#if mode === "polLosowy"}<option value="">— losowa (k100) —</option>{/if}
              {#each categories as c (c.key)}<option value={c.key}>{c.name}</option>{/each}
            </select>
          </label>
          {#if mode === "wlasny"}
            <label>Przedmiot
              <select bind:value={item}>
                {#each choices as c (c)}<option value={c}>{c}</option>{/each}
              </select>
            </label>
          {:else}
            <label>Liczba przedmiotów
              <select bind:value={count}>
                {#each [1, 2, 3, 4, 5, 6] as n (n)}<option value={n}>{n}</option>{/each}
              </select>
            </label>
            <label class="check"><input type="checkbox" bind:checked={allowCursed} /> Dopuszczaj przedmioty przeklęte</label>
          {/if}
        </div>
        {#if intro}<p class="text-dim small">{intro}</p>{/if}
      {/if}

      <div class="buttons">
        <button class="primary" onclick={generate}>✦ Losuj przedmiot{mode === "polLosowy" && count > 1 ? "y" : ""}</button>
        {#if results.length}<button class="ghost" onclick={() => (results = [])}>Wyczyść</button>{/if}
      </div>
      <p class="text-dim small">
        Źródło: nieoficjalne kompendium <i>Treasure &amp; Artefacts</i> (przełożone); zaklęcia z bazy programu, runy krasnoludzkie z
        <i>Podręcznika Gracza: Krasnoludy</i>, Broń Chaosu z <i>Warriors of Chaos</i>. Magiczne przedmioty to rzadkość — wiele z nich jest przeklętych.
      </p>
    {/if}
  </div>

  {#each results as e (e.id)}
    <ArtefactCard artefact={e.artefact} saved={e.saved} onsave={() => save(e)} onreroll={() => reroll(e.id)} onremove={() => remove(e.id)} />
  {/each}
</section>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .controls,
  .owned {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  h3 {
    margin: 0;
    font-size: var(--fs-base);
    color: var(--accent-strong);
  }
  .mode-row,
  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .small {
    font-size: var(--fs-sm);
    margin: 0;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .seg button {
    border: none;
    border-radius: 0;
    background: transparent;
  }
  .seg button.on {
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .form {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(200px * var(--ui-scale)), 1fr));
    gap: var(--space-2) var(--space-3);
    align-items: end;
  }
  .form label:not(.check) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
</style>
