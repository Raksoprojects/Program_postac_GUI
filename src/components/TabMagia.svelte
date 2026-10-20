<script lang="ts">
  import { store } from "../lib/store.svelte";
  import * as gameData from "../lib/gameData";
  import { casterKind } from "../lib/magic";
  import type { PrayerDef, SpellDef } from "../lib/types";
  import Modal from "./Modal.svelte";

  const spellsData = gameData.getSpellsData();
  const prayersData = gameData.getPrayersData();
  const lores = spellsData.lores;
  const loreLabel = (key: string) => lores[key]?.label ?? key;

  let profile = $derived(store.magicProfile());
  let kind = $derived(casterKind(profile));
  let spells = $derived(store.spellRows());
  let miracles = $derived(store.miracleRows());
  let blessings = $derived(store.blessings());

  // Sekcja: zaklecia albo modlitwy (domyslnie wg talentow postaci).
  let section = $state<"spells" | "prayers" | null>(null);
  let active = $derived(section ?? (kind.prayers && !kind.spells ? "prayers" : "spells"));

  let expanded = $state<Record<string, boolean>>({});
  const toggle = (k: string) => (expanded[k] = !expanded[k]);

  // Grupy tradycji do filtrow.
  const GROUP_LABEL: Record<string, string> = { petty: "Magia Prosta", arcane: "Magia Tajemna", chaos: "Magia Chaosu" };
  const loreOptions = Object.entries(lores)
    .map(([key, l]) => ({ key, label: l.label, group: l.group }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label, "pl"));
  const deityOptions = Object.keys(prayersData.deities);

  // --- Okno wyszukiwarki ---
  let picker = $state<"spell" | "miracle" | null>(null);
  let search = $state("");
  let loreFilter = $state("");
  let deityFilter = $state("");
  let onlyAvailable = $state(true);
  let selSpell = $state<SpellDef | null>(null);
  let selMiracle = $state<PrayerDef | null>(null);
  let pickError = $state("");

  const norm = (s: string) => s.trim().toLowerCase();

  function openPicker(mode: "spell" | "miracle") {
    picker = mode;
    search = "";
    pickError = "";
    selSpell = null;
    selMiracle = null;
    onlyAvailable = !store.magicGmApproved;
  }

  let spellList = $derived.by(() => {
    if (picker !== "spell") return [];
    const q = norm(search);
    return spellsData.spells
      .filter((s) => !loreFilter || s.lore === loreFilter || (loreFilter.startsWith("@") && lores[s.lore]?.group === loreFilter.slice(1)))
      .filter((s) => !q || norm(s.name).includes(q) || norm(s.description).includes(q))
      .map((s) => ({ def: s, offer: store.spellOffer(s) }))
      .filter((x) => !onlyAvailable || x.offer.allowed)
      .sort((a, b) => a.def.lore.localeCompare(b.def.lore, "pl") || a.def.cn - b.def.cn || a.def.name.localeCompare(b.def.name, "pl"));
  });

  let miracleList = $derived.by(() => {
    if (picker !== "miracle") return [];
    const q = norm(search);
    return prayersData.miracles
      .filter((m) => !deityFilter || m.deity === deityFilter)
      .filter((m) => !q || norm(m.name).includes(q) || norm(m.description).includes(q))
      .map((m) => ({ def: m, offer: store.miracleOffer(m) }))
      .filter((x) => !onlyAvailable || x.offer.allowed)
      .sort((a, b) => (a.def.deity ?? "").localeCompare(b.def.deity ?? "", "pl") || a.def.name.localeCompare(b.def.name, "pl"));
  });

  let selOffer = $derived(
    picker === "spell" && selSpell ? store.spellOffer(selSpell) : picker === "miracle" && selMiracle ? store.miracleOffer(selMiracle) : null
  );

  function learnSelected() {
    pickError = "";
    const r = picker === "spell" && selSpell ? store.learnSpell(selSpell) : picker === "miracle" && selMiracle ? store.learnMiracle(selMiracle) : null;
    if (!r) return;
    if (!r.ok) {
      pickError = r.reason ?? "Nie udało się dodać.";
      return;
    }
    selSpell = null;
    selMiracle = null;
  }

  function forget(kindName: "spell" | "miracle", name: string, isNew: boolean, cost: number) {
    const msg = isNew
      ? `Cofnąć „${name}”? Zwrot ${cost} PD.`
      : `Usunąć zatwierdzone „${name}”? PD nie zostaną zwrócone.`;
    if (confirm(msg)) store.forget(kindName, name);
  }

  // Zaklecia pogrupowane wg tradycji (do naglowkow listy).
  let spellGroups = $derived.by(() => {
    const out: { lore: string; items: typeof spells }[] = [];
    for (const s of spells) {
      let g = out.find((x) => x.lore === s.lore);
      if (!g) out.push((g = { lore: s.lore, items: [] }));
      g.items.push(s);
    }
    return out;
  });
</script>

<section class="tab">
  <header class="tab-head">
    <div>
      <h2 class="section-title">Zaklęcia i modlitwy</h2>
      <p class="section-sub">
        Zaklęcia wymagają Talentów Magia Prosta / Magia Tajemna (Tradycja), modlitwy — Błogosławieństwo
        i Inwokacja (Bóstwo). Postać zna albo zaklęcia, albo cuda; Zgoda MG znosi ograniczenia.
      </p>
    </div>
  </header>

  <div class="controls panel">
    <div class="chips">
      {#if profile.petty}<span class="chip">Magia Prosta{profile.pettyLores.length > 1 ? ` (${profile.pettyLores.filter((l) => l !== "Prosta").map(loreLabel).join(", ")})` : ""}</span>{/if}
      {#each profile.arcaneLores as l (l)}<span class="chip accent">Magia Tajemna: {loreLabel(l)}</span>{/each}
      {#each profile.chaosLores as l (l)}<span class="chip warning">Magia Chaosu: {loreLabel(l)}</span>{/each}
      {#each profile.blessDeities as d (d)}<span class="chip">Błogosławieństwo: {d}</span>{/each}
      {#each profile.invokes as i (i.deity + (i.aspect ?? ""))}<span class="chip success">Inwokacja: {i.deity}{i.aspect ? ` — ${i.aspect}` : ""}</span>{/each}
      {#if !kind.spells && !kind.prayers}
        <span class="text-dim">Brak talentów magicznych ani kapłańskich — dodaj je w zakładce Talenty (albo zaznacz Zgodę MG).</span>
      {/if}
    </div>
    {#if profile.unresolved.length}
      <p class="val-warning small">
        Nierozpoznana tradycja/bóstwo w talentach: {profile.unresolved.join(", ")} — wybierz specjalizację w zakładce Talenty.
      </p>
    {/if}
    {#if kind.spells && profile.invokes.length}
      <p class="val-warning small">Uwaga: postać ma jednocześnie magię i Inwokację — według zasad to się wyklucza.</p>
    {/if}
    <div class="row1">
      <div class="seg" role="tablist">
        <button class:on={active === "spells"} onclick={() => (section = "spells")}>Zaklęcia ({spells.length})</button>
        <button class:on={active === "prayers"} onclick={() => (section = "prayers")}>Modlitwy ({miracles.length + blessings.length})</button>
      </div>
      <label class="check"><input type="checkbox" bind:checked={store.magicGmApproved} /> Zgoda MG (dowolne)</label>
      <label class="check" title="Następne poznane zaklęcie/cud bez kosztu PD"><input type="checkbox" bind:checked={store.magicFree} /> Bez kosztu PD</label>
      <span class="grow"></span>
      {#if active === "spells"}
        <button class="primary" onclick={() => openPicker("spell")}>Dodaj zaklęcie</button>
      {:else}
        <button class="primary" onclick={() => openPicker("miracle")}>Dodaj cud</button>
      {/if}
    </div>
  </div>

  {#if active === "spells"}
    <div class="rows">
      {#each spellGroups as g (g.lore)}
        <h3 class="group-head">{loreLabel(g.lore)} <span class="text-dim small">({GROUP_LABEL[lores[g.lore]?.group ?? "arcane"]})</span></h3>
        {#each g.items as s (s.name)}
          <div class="row panel">
            <div class="top">
              <div class="name">
                <strong>{s.name}</strong>
                <span class="chip tag">PZ {s.cn}</span>
                {#if s.is_new}<span class="chip accent tag">nowe · {s.cost} PD</span>{/if}
              </div>
              <button class="btn-sm {s.is_new ? 'ghost' : 'danger'}" onclick={() => forget("spell", s.name, s.is_new, s.cost)}>
                {s.is_new ? "Cofnij" : "Usuń"}
              </button>
            </div>
            <div class="meta text-dim small">
              <span><b>Zasięg:</b> {s.range}</span><span><b>Cel:</b> {s.target}</span><span><b>Czas:</b> {s.duration}</span>
            </div>
            <button type="button" class="desc text-dim" class:expanded={expanded["s:" + s.name]} onclick={() => toggle("s:" + s.name)}>
              ⓘ {s.description}
            </button>
          </div>
        {/each}
      {/each}
      {#if !spells.length}<p class="text-dim empty">Brak znanych zaklęć.</p>{/if}
    </div>
  {:else}
    <div class="rows">
      {#if blessings.length}
        <h3 class="group-head">Błogosławieństwa <span class="text-dim small">(z Talentu Błogosławieństwo — bez kosztu)</span></h3>
        {#each blessings as b (b.deity + b.blessing.name)}
          <div class="row panel">
            <div class="top">
              <div class="name"><strong>{b.blessing.name}</strong> <span class="chip tag">{b.deity}</span></div>
            </div>
            <div class="meta text-dim small">
              <span><b>Zasięg:</b> {b.blessing.range}</span><span><b>Cel:</b> {b.blessing.target}</span><span><b>Czas:</b> {b.blessing.duration}</span>
            </div>
            <p class="text-dim small">{b.blessing.description}</p>
          </div>
        {/each}
      {/if}
      <h3 class="group-head">Cuda</h3>
      {#each miracles as m (m.name)}
        <div class="row panel">
          <div class="top">
            <div class="name">
              <strong>{m.name}</strong>
              <span class="chip tag">{m.deity}{m.aspect ? ` — ${m.aspect}` : ""}</span>
              {#if m.is_new}<span class="chip accent tag">nowy · {m.cost} PD</span>{/if}
            </div>
            <button class="btn-sm {m.is_new ? 'ghost' : 'danger'}" onclick={() => forget("miracle", m.name, m.is_new, m.cost)}>
              {m.is_new ? "Cofnij" : "Usuń"}
            </button>
          </div>
          <div class="meta text-dim small">
            <span><b>Zasięg:</b> {m.range}</span><span><b>Cel:</b> {m.target}</span><span><b>Czas:</b> {m.duration}</span>
          </div>
          <button type="button" class="desc text-dim" class:expanded={expanded["m:" + m.name]} onclick={() => toggle("m:" + m.name)}>
            ⓘ {m.description}
          </button>
        </div>
      {/each}
      {#if !miracles.length}
        <p class="text-dim empty">
          Brak cudów. {profile.invokes.length ? "Pierwszy cud z Talentu Inwokacja jest darmowy." : "Wymagają Talentu Inwokacja (Bóstwo)."}
        </p>
      {/if}
    </div>
  {/if}
</section>

{#if picker}
  <Modal title={picker === "spell" ? "Dodaj zaklęcie" : "Dodaj cud"} onClose={() => (picker = null)}>
    <div class="picker-head">
      <input type="text" placeholder="Szukaj w nazwie i opisie…" bind:value={search} />
      {#if picker === "spell"}
        <select bind:value={loreFilter} aria-label="Tradycja">
          <option value="">Wszystkie tradycje</option>
          <option value="@petty">— Magia Prosta (wszystkie) —</option>
          <option value="@arcane">— Magia Tajemna (wszystkie) —</option>
          <option value="@chaos">— Magia Chaosu (wszystkie) —</option>
          {#each loreOptions as l (l.key)}<option value={l.key}>{l.label}</option>{/each}
        </select>
      {:else}
        <select bind:value={deityFilter} aria-label="Bóstwo">
          <option value="">Wszystkie bóstwa</option>
          {#each deityOptions as d (d)}<option value={d}>{d}</option>{/each}
        </select>
      {/if}
    </div>
    <div class="picker-opts">
      <label class="check"><input type="checkbox" bind:checked={onlyAvailable} /> Tylko dostępne dla postaci</label>
      <label class="check"><input type="checkbox" bind:checked={store.magicGmApproved} /> Zgoda MG</label>
      <label class="check"><input type="checkbox" bind:checked={store.magicFree} /> Bez kosztu PD</label>
      <span class="text-dim small">Wyników: {picker === "spell" ? spellList.length : miracleList.length}</span>
    </div>
    <div class="picker-list">
      {#if picker === "spell"}
        {#each spellList.slice(0, 300) as x (x.def.name)}
          <button class="pick-item" class:sel={selSpell === x.def} class:blocked={!x.offer.allowed} onclick={() => (selSpell = x.def)}>
            <span>{x.def.name} <span class="text-dim small">· {loreLabel(x.def.lore)} · PZ {x.def.cn} · ({gameData.sourceShort(x.def.source)})</span></span>
            <span class="small">{x.offer.known ? "znane" : x.offer.allowed ? `${x.offer.cost} PD` : "niedostępne"}</span>
          </button>
        {/each}
      {:else}
        {#each miracleList.slice(0, 300) as x (x.def.name)}
          <button class="pick-item" class:sel={selMiracle === x.def} class:blocked={!x.offer.allowed} onclick={() => (selMiracle = x.def)}>
            <span>{x.def.name} <span class="text-dim small">· {x.def.deity}{x.def.aspect ? ` — ${x.def.aspect}` : ""} · ({gameData.sourceShort(x.def.source)})</span></span>
            <span class="small">{x.offer.known ? "znany" : x.offer.allowed ? `${x.offer.cost} PD` : "niedostępny"}</span>
          </button>
        {/each}
      {/if}
      {#if (picker === "spell" ? spellList : miracleList).length === 0}
        <p class="text-dim">Brak wyników{onlyAvailable ? " dostępnych dla postaci — odznacz filtr lub zaznacz Zgodę MG" : ""}.</p>
      {/if}
    </div>
    {#if (picker === "spell" && selSpell) || (picker === "miracle" && selMiracle)}
      {@const d = (picker === "spell" ? selSpell : selMiracle)!}
      <div class="preview panel">
        <strong>{d.name}</strong>
        <div class="meta text-dim small">
          {#if picker === "spell" && selSpell}<span><b>Tradycja:</b> {loreLabel(selSpell.lore)}</span><span><b>PZ:</b> {selSpell.cn}</span>{/if}
          {#if picker === "miracle" && selMiracle}<span><b>Bóstwo:</b> {selMiracle.deity}{selMiracle.aspect ? ` — ${selMiracle.aspect}` : ""}</span>{/if}
          <span><b>Zasięg:</b> {d.range}</span><span><b>Cel:</b> {d.target}</span><span><b>Czas:</b> {d.duration}</span>
        </div>
        <p class="text-dim small">{d.description}</p>
        {#if d.source}<p class="text-dim small">Źródło: {d.source}</p>{/if}
        {#if selOffer}
          <p class="small" class:val-warning={!selOffer.allowed || selOffer.reason}>
            {selOffer.allowed ? `Koszt: ${selOffer.cost} PD — ${selOffer.note}` : selOffer.reason}
            {#if selOffer.allowed && selOffer.reason}<br />{selOffer.reason}{/if}
          </p>
        {/if}
      </div>
    {/if}
    {#if pickError}<p class="val-danger">{pickError}</p>{/if}
    {#snippet footer()}
      <button class="ghost" onclick={() => (picker = null)}>Zamknij</button>
      <button class="primary" disabled={!selOffer?.allowed} onclick={learnSelected}>
        {picker === "spell" ? "Poznaj zaklęcie" : "Poznaj cud"}{selOffer?.allowed ? ` (${selOffer.cost} PD)` : ""}
      </button>
    {/snippet}
  </Modal>
{/if}

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  .chips,
  .row1,
  .meta,
  .picker-head,
  .picker-opts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .grow {
    flex: 1;
  }
  .small {
    font-size: var(--fs-sm);
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
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .group-head {
    margin: var(--space-2) 0 0;
    font-size: var(--fs-base);
    color: var(--accent-strong);
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .name {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .tag {
    font-size: calc(11px * var(--ui-scale));
  }
  .desc {
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    min-height: auto;
    font-size: var(--fs-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }
  .desc.expanded {
    white-space: normal;
  }
  .empty {
    padding: var(--space-3);
  }
  .picker-head input {
    flex: 1;
    min-width: calc(180px * var(--ui-scale));
  }
  .picker-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: calc(300px * var(--ui-scale));
    overflow-y: auto;
  }
  .pick-item {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    text-align: left;
    background: var(--bg-panel-2);
    border: 1px solid transparent;
  }
  .pick-item.sel {
    border-color: var(--accent);
  }
  .pick-item.blocked {
    opacity: 0.6;
  }
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
  }
  .preview p {
    margin: 0;
  }
</style>
