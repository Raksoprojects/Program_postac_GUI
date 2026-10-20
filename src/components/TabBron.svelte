<script lang="ts">
  import { store } from "../lib/store.svelte";
  import * as gameData from "../lib/gameData";
  import {
    LOCATIONS,
    armourFromDef,
    armourPoints,
    damageLabel,
    damageValue,
    shieldValue,
    totalEnc,
    weaponFromDef
  } from "../lib/equipment";
  import type { CharArmour, CharWeapon } from "../lib/types";
  import Modal from "./Modal.svelte";

  const catalog = gameData.getWeaponsData();
  const meleeGroups = [...new Set(Object.values(catalog.melee).map((w) => w.group))];
  const rangedGroups = [...new Set(Object.values(catalog.ranged).map((w) => w.group))];

  let weapons = $derived(store.weapons);
  let armour = $derived(store.armour);
  let st = $derived(store.strengthToughness);
  let ap = $derived(armourPoints(armour));
  let shield = $derived(shieldValue(weapons));

  const describe = (q: string) => gameData.equipmentQualityDescription(q);

  // --- Okno dodawania z katalogu ---
  let picker = $state<"weapon" | "armour" | null>(null);
  let search = $state("");
  let groupFilter = $state("");
  let sel = $state<string | null>(null);

  type Entry = { name: string; kind: "melee" | "ranged" | "armour"; group: string; info: string };
  let entries = $derived.by((): Entry[] => {
    if (picker === "armour") {
      return Object.entries(catalog.armour).map(([name, a]) => ({
        name, kind: "armour" as const, group: a.type,
        info: `PP ${a.ap} · ${a.locations.join(", ")}${a.qualities.length ? ` · ${a.qualities.join(", ")}` : ""}`
      }));
    }
    if (picker !== "weapon") return [];
    const list = (kind: "melee" | "ranged") =>
      Object.entries(catalog[kind]).map(([name, w]) => ({
        name, kind, group: w.group,
        info: `${damageLabel(w)} · ${kind === "ranged" ? (w.range ? `${w.range} m` : "") : (w.reach ?? "")}${
          w.qualities.length || w.flaws.length ? ` · ${[...w.qualities, ...w.flaws].join(", ")}` : ""}`
      }));
    return [...list("melee"), ...list("ranged")];
  });
  let filtered = $derived(
    entries.filter(
      (e) =>
        (!groupFilter || `${e.kind}:${e.group}` === groupFilter || (picker === "armour" && e.group === groupFilter)) &&
        (!search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase()))
    )
  );

  function openPicker(kind: "weapon" | "armour") {
    picker = kind;
    search = "";
    groupFilter = "";
    sel = null;
  }

  function addSelected() {
    const e = entries.find((x) => x.name === sel);
    if (!e) return;
    if (e.kind === "armour") store.addArmour(armourFromDef(e.name, catalog.armour[e.name]));
    else store.addWeapon(weaponFromDef(e.name, catalog[e.kind][e.name], e.kind));
    picker = null;
  }

  // --- Wlasna bron / pancerz ---
  let custom = $state<"weapon" | "armour" | null>(null);
  let cName = $state("");
  let cKind = $state<"melee" | "ranged">("melee");
  let cGroup = $state("Podstawowa");
  let cDamage = $state(4);
  let cSb = $state(true);
  let cReach = $state("");
  let cQualities = $state("");
  let cEnc = $state("1");
  let cLocations = $state<string[]>(["korpus"]);
  let cAp = $state(1);

  function openCustom(kind: "weapon" | "armour") {
    custom = kind;
    cName = "";
    cQualities = "";
    cReach = "";
  }

  const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  function addCustom() {
    if (!cName.trim()) return;
    if (custom === "weapon") {
      const w: CharWeapon = {
        name: cName.trim(), kind: cKind, group: cGroup.trim() || "Podstawowa", damage: Number(cDamage) || 0, sb: cSb,
        reach: cReach.trim(), qualities: splitList(cQualities), flaws: [], enc: cEnc.trim(), carried: true
      };
      store.addWeapon(w);
    } else {
      const a: CharArmour = {
        name: cName.trim(), locations: [...cLocations], ap: Number(cAp) || 0, qualities: splitList(cQualities),
        enc: cEnc.trim(), worn: true
      };
      store.addArmour(a);
    }
    custom = null;
  }

  const ARMOUR_LOCS = ["głowa", "ramiona", "korpus", "nogi"];
</script>

<section class="tab">
  <header class="tab-head">
    <h2 class="section-title">Broń i pancerz</h2>
    <p class="section-sub">
      Bonus z Siły {st.sb}, Bonus z Wytrzymałości {st.tb}. Obrażenia i PP liczone na bieżąco; zapis w pliku postaci i na karcie PDF (strona 2).
    </p>
  </header>

  <div class="panel block">
    <div class="head">
      <h3>Broń</h3>
      <div class="actions">
        <button class="primary btn-sm" onclick={() => openPicker("weapon")}>+ Z katalogu</button>
        <button class="btn-sm ghost" onclick={() => openCustom("weapon")}>+ Własna</button>
      </div>
    </div>
    {#if weapons.length}
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Nazwa</th><th>Grupa</th><th>Test</th><th>Obrażenia</th><th>Dł./Zasięg</th><th>Zalety i Wady</th><th>Obc.</th><th title="Przy sobie">✓</th><th></th></tr>
          </thead>
          <tbody>
            {#each weapons as w, i (i)}
              {@const t = store.weaponTest(w)}
              <tr>
                <td><b>{w.name}</b>{#if w.note}<div class="text-dim small">{w.note}</div>{/if}</td>
                <td>{w.kind === "ranged" ? "Zasięgowa" : "Biała"} ({w.group})</td>
                <td title={t.skill}>
                  <b>{t.value}</b>
                  {#if !t.trained}<div class="val-warning small" title="Bez umiejętności: test samą cechą, bez Zalet broni (Wady działają)">bez umiej.</div>{/if}
                </td>
                <td title={damageLabel(w)}>+{damageValue(w, st.sb)} <span class="text-dim small">({damageLabel(w)})</span></td>
                <td>{w.reach}</td>
                <td>
                  {#each w.qualities as q (q)}<span class="chip success" title={describe(q)}>{q}</span>{/each}
                  {#each w.flaws as q (q)}<span class="chip warning" title={describe(q)}>{q}</span>{/each}
                </td>
                <td><input class="enc" value={w.enc} onchange={(e) => store.updateWeapon(i, { enc: e.currentTarget.value })} aria-label="Obciążenie" /></td>
                <td><input type="checkbox" checked={w.carried} onchange={(e) => store.updateWeapon(i, { carried: e.currentTarget.checked })} aria-label="Przy sobie" /></td>
                <td><button class="btn-sm ghost" onclick={() => store.removeWeapon(i)} aria-label="Usuń">✕</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="text-dim small">Obciążenie broni przy sobie: {totalEnc(weapons.filter((w) => w.carried))}{shield ? ` · Tarcza ${shield}` : ""}</p>
    {:else}
      <p class="text-dim small">Brak broni.</p>
    {/if}
  </div>

  <div class="panel block">
    <div class="head">
      <h3>Pancerz</h3>
      <div class="actions">
        <button class="primary btn-sm" onclick={() => openPicker("armour")}>+ Z katalogu</button>
        <button class="btn-sm ghost" onclick={() => openCustom("armour")}>+ Własny</button>
      </div>
    </div>
    {#if armour.length}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nazwa</th><th>Lokacje</th><th>PP</th><th>Zalety i Wady</th><th>Obc.</th><th title="Założony">Na sobie</th><th></th></tr></thead>
          <tbody>
            {#each armour as a, i (i)}
              <tr class:off={!a.worn}>
                <td><b>{a.name}</b>{#if a.penalty}<div class="val-warning small">{a.penalty}</div>{/if}</td>
                <td>{a.locations.join(", ")}</td>
                <td>{a.ap}</td>
                <td>{#each a.qualities as q (q)}<span class="chip" title={describe(q)}>{q}</span>{/each}</td>
                <td><input class="enc" value={a.enc} onchange={(e) => store.updateArmour(i, { enc: e.currentTarget.value })} aria-label="Obciążenie" /></td>
                <td><input type="checkbox" checked={a.worn} onchange={(e) => store.updateArmour(i, { worn: e.currentTarget.checked })} aria-label="Na sobie" /></td>
                <td><button class="btn-sm ghost" onclick={() => store.removeArmour(i)} aria-label="Usuń">✕</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="text-dim small">Brak pancerza.</p>
    {/if}
    <div class="locs">
      {#each LOCATIONS as l (l.key)}
        <div class="loc" title="PP pancerza / PP + Bonus z Wytrzymałości">
          <span class="text-dim small">{l.label}</span>
          <b>{ap[l.key]}</b><span class="text-dim small">/ {ap[l.key] + st.tb}</span>
        </div>
      {/each}
      {#if shield}<div class="loc"><span class="text-dim small">Tarcza</span><b>{shield}</b></div>{/if}
    </div>
  </div>
</section>

{#if picker}
  <Modal title={picker === "weapon" ? "Dodaj broń z katalogu" : "Dodaj pancerz z katalogu"} onClose={() => (picker = null)}>
    <div class="row">
      <input class="grow" type="search" placeholder="Szukaj…" bind:value={search} />
      <select bind:value={groupFilter} aria-label="Grupa">
        <option value="">— wszystkie —</option>
        {#if picker === "weapon"}
          <optgroup label="Broń Biała">{#each meleeGroups as g (g)}<option value={`melee:${g}`}>{g}</option>{/each}</optgroup>
          <optgroup label="Broń Zasięgowa">{#each rangedGroups as g (g)}<option value={`ranged:${g}`}>{g}</option>{/each}</optgroup>
        {:else}
          {#each [...new Set(Object.values(catalog.armour).map((a) => a.type))] as g (g)}<option value={g}>{g}</option>{/each}
        {/if}
      </select>
    </div>
    <div class="pick-list">
      {#each filtered as e (e.kind + e.name)}
        <button class="pick-item" class:sel={sel === e.name} onclick={() => (sel = e.name)} ondblclick={() => { sel = e.name; addSelected(); }}>
          <span><b>{e.name}</b> <span class="text-dim small">· {e.group}</span></span>
          <span class="text-dim small">{e.info}</span>
        </button>
      {:else}
        <p class="text-dim">Brak wyników.</p>
      {/each}
    </div>
    {#snippet footer()}
      <button class="ghost" onclick={() => (picker = null)}>Anuluj</button>
      <button class="primary" disabled={!sel} onclick={addSelected}>Dodaj</button>
    {/snippet}
  </Modal>
{/if}

{#if custom}
  <Modal title={custom === "weapon" ? "Własna broń" : "Własny pancerz"} onClose={() => (custom = null)}>
    <div class="form">
      <label class="fld"><span>Nazwa</span><input bind:value={cName} /></label>
      {#if custom === "weapon"}
        <label class="fld"><span>Rodzaj</span>
          <select bind:value={cKind}><option value="melee">Broń Biała</option><option value="ranged">Broń Zasięgowa</option></select>
        </label>
        <label class="fld"><span>Grupa</span>
          <input bind:value={cGroup} list="eq-groups" />
          <datalist id="eq-groups">{#each cKind === "ranged" ? rangedGroups : meleeGroups as g (g)}<option value={g}></option>{/each}</datalist>
        </label>
        <label class="fld"><span>Obrażenia</span><input type="number" bind:value={cDamage} /></label>
        <label class="check"><input type="checkbox" bind:checked={cSb} /> + Bonus z Siły</label>
        <label class="fld"><span>{cKind === "ranged" ? "Zasięg" : "Długość"}</span><input bind:value={cReach} /></label>
      {:else}
        <fieldset class="fld"><span>Lokacje</span>
          <div class="row">
            {#each ARMOUR_LOCS as l (l)}
              <label class="check"><input type="checkbox" checked={cLocations.includes(l)} onchange={(e) => (cLocations = e.currentTarget.checked ? [...cLocations, l] : cLocations.filter((x) => x !== l))} /> {l}</label>
            {/each}
          </div>
        </fieldset>
        <label class="fld"><span>PP</span><input type="number" min="0" bind:value={cAp} /></label>
      {/if}
      <label class="fld"><span>Zalety i Wady (po przecinku)</span><input bind:value={cQualities} /></label>
      <label class="fld"><span>Obciążenie</span><input bind:value={cEnc} /></label>
    </div>
    {#snippet footer()}
      <button class="ghost" onclick={() => (custom = null)}>Anuluj</button>
      <button class="primary" disabled={!cName.trim()} onclick={addCustom}>Dodaj</button>
    {/snippet}
  </Modal>
{/if}

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  .head,
  .row,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .head {
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: var(--fs-base);
    color: var(--accent-strong);
  }
  .small {
    font-size: var(--fs-sm);
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  th,
  td {
    text-align: left;
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    color: var(--text-muted);
    font-weight: 600;
  }
  tr.off {
    opacity: 0.55;
  }
  input.enc {
    width: calc(44px * var(--ui-scale));
  }
  .locs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .loc {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-panel-2);
  }
  .grow {
    flex: 1;
  }
  .pick-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 50vh;
    overflow-y: auto;
    margin-top: var(--space-2);
  }
  .pick-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
  }
  .pick-item.sel {
    border-color: var(--accent);
    background: var(--bg-panel-2);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .fld {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border: none;
    padding: 0;
    margin: 0;
  }
</style>
