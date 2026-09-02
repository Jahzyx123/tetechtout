/* ui/app.js — NEON FORGE shell.
   One roll-button family driving the unified engine roll(scope, mode):
   - per-field roll / lock / manual pick (from ATOMS + PICKER_POOLS)
   - per-section roll + hide
   - global ROLL (everything) and MAX (maximize score over N tries)
   - output tabs: Style Prompt (≤1000) / Full Brief (≤3000)
   - shareable state via ?s= URL param, deterministic per seed. */
import { ATOMS, PICKER_POOLS } from "../data/atoms.js";
import { LAYERS } from "../data/safety.js";
import {
  defaultState, roll, buildStylePrompt, buildFullBrief, scorePrompt,
  encodeState, decodeState, setSeed, weirdMix,
  SOUND_CARDS, unhideAllSoundCards, autoFitSounds
} from "../engine/index.js";
import { openPicker } from "./picker.js";

/* ---------------------------- state ---------------------------- */
export let state = loadInitialState();
setSeed(state.seed);

function loadInitialState() {
  const q = new URLSearchParams(location.search).get("s");
  if (q) { const s = decodeState(q); if (s) return s; }
  const s = defaultState();
  roll(s, "everything");
  return s;
}

/* ---------------------------- card atlas ---------------------------- */
const CARD_DEFS = [
  { id: "styleCard", title: "Style", scope: "genre" },
  { id: "feelCard", title: "Feeling & Melody", scope: "feel-melody" },
  { id: "bassCard", title: "Bass", scope: "bass" },
  { id: "drumsCard", title: "Drums", scope: "drums" },
  { id: "technoLabCard", title: "Techno Lab", scope: "technoLab" },
  { id: "harmonyLabCard", title: "Harmony Lab", scope: "harmony" },
  { id: "rhythmLabCard", title: "Rhythm Lab", scope: "rhythm" },
  { id: "soundDesignCard", title: "Sound Design", scope: "soundDesign" },
  { id: "mixMasterCard", title: "Mix & Master", scope: "mixMaster" },
  { id: "spatialModCard", title: "Spatial & Mod", scope: "spatialMod" },
  { id: "grooveMelodicCard", title: "Groove & Melodic", scope: "grooveMelodic" },
  { id: "textureFxCard", title: "Texture & FX", scope: "textureFx" },
  { id: "conceptCard", title: "Concept", scope: "concept" },
  { id: "arrangementCard", title: "Arrangement", scope: "arrangement" },
  { id: "layersCard", title: "Detail Layers", scope: null }
];
const ATOMS_BY_CARD = {};
ATOMS.forEach(a => { (ATOMS_BY_CARD[a.card] = ATOMS_BY_CARD[a.card] || []).push(a); });

/* ---------------------------- helpers ---------------------------- */
const $ = sel => document.querySelector(sel);
export function escapeHtml(x) { return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
let toastTimer;
export function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}
function copyText(text, label) {
  const done = () => toast("📋 " + (label || "Copied"));
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { toast("Copy failed"); }
  ta.remove();
}
function updateURL() {
  try { history.replaceState(null, "", location.pathname + "?s=" + encodeState(state)); } catch (e) { }
}
export function afterChange() { render(); updateURL(); }

function atomValue(a) {
  if (a.display) { try { return a.display(state); } catch (e) { return ""; } }
  if (a.key === "melodyConcept") { const mc = state.melodyConcept || {}; return mc.hook || mc.story || ""; }
  if (a.key === "concept") { const c = state.concept || {}; return c.title ? c.title + (c.world ? " — " + c.world : "") : ""; }
  if (a.field) return state[a.field];
  return "";
}

/* ---------------------------- actions ---------------------------- */
function doRoll(scope, mode) {
  const tries = +($("#triesSel") ? $("#triesSel").value : 24);
  const res = roll(state, scope, { mode: mode || "random", tries });
  if (mode === "max") {
    toast(res.improved ? "⭐ Improved to " + res.score + " in " + res.tries + " tries" : "⭐ Kept the current set (already " + res.score + ")");
  }
  afterChange();
}
function toggleLock(key) { state.locks[key] = !state.locks[key]; afterChange(); }
function toggleHide(id) { state.hidden[id] = !state.hidden[id]; afterChange(); }
function setMode(techOnly) {
  state.techOnly = techOnly;
  if (techOnly) { unhideAllSoundCards(state, SOUND_CARDS); state.lastFitGenre = ""; }
  doRoll("genre");
}

/* ---------------------------- top bar ---------------------------- */
function renderTopbar() {
  const el = $("#topbar");
  const m = weirdMix(state.weirdness);
  const pct = x => Math.round(x * 100);
  el.innerHTML = `
    <span class="logo">NEON FORGE</span>
    <span class="seg" id="modeSeg">
      <button data-mode="techno" class="${state.techOnly ? "on" : ""}">TECHNO-ONLY</button>
      <button data-mode="all" class="${!state.techOnly ? "on" : ""}">NO-TECHNO</button>
    </span>
    <button class="btn primary" id="rollAllBtn" title="Roll every unlocked field (R)">🎲 ROLL EVERYTHING</button>
    <button class="btn" id="maxBtn" title="Reroll everything N times, keep the best-scoring set">⭐ MAX</button>
    <select id="triesSel" title="Max tries">
      <option value="12">12×</option><option value="24" selected>24×</option><option value="48">48×</option>
    </select>
    <label class="inline">Weird <input type="range" id="weirdRange" min="0" max="100" value="${state.weirdness}">
      <span class="readout"><b>${state.weirdness}</b> · core ${pct(m.core)}% / sub ${pct(m.sub)}% / rare ${pct(m.rare)}%</span></label>
    <span class="chip ${state.instrumental ? "on" : ""}" id="instToggle" title="Keep every vocal reference out of the output">Instrumental</span>
    <span class="chip ${state.equalChance ? "on" : ""}" id="eqToggle" title="Every style equally likely (ignores weirdness tiers)">Equal chance</span>
    <span class="chip ${state.styleFit ? "on" : ""}" id="fitToggle" title="Auto-hide electronic-only cards for organic genres">Style-fit</span>
    <span class="chip ${state.structure ? "on" : ""}" id="structToggle" title="Append [Intro][Build][Drop]… tags">Structure</span>
    <label class="inline">Influence <select id="influenceSel">
      ${["subtle", "balanced", "strong"].map(v => `<option ${state.influence === v ? "selected" : ""}>${v}</option>`).join("")}
    </select></label>
    <label class="inline">Length <select id="durationSel">
      ${["compact", "standard", "extended"].map(v => `<option ${state.duration === v ? "selected" : ""}>${v}</option>`).join("")}
    </select></label>
    <label class="inline">Melody <select id="forceSel">
      ${["light", "balanced", "strong", "dominant"].map(v => `<option ${state.melodicForce === v ? "selected" : ""}>${v}</option>`).join("")}
    </select></label>
    <span class="chip" id="seedChip" title="Click to copy share link">seed ${state.seed}</span>
  `;
  el.querySelector("#modeSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    setMode(b.dataset.mode === "techno");
  });
  el.querySelector("#rollAllBtn").addEventListener("click", () => doRoll("everything"));
  el.querySelector("#maxBtn").addEventListener("click", () => doRoll("everything", "max"));
  el.querySelector("#weirdRange").addEventListener("change", e => { state.weirdness = +e.target.value; afterChange(); });
  el.querySelector("#instToggle").addEventListener("click", () => { state.instrumental = !state.instrumental; afterChange(); });
  el.querySelector("#eqToggle").addEventListener("click", () => { state.equalChance = !state.equalChance; afterChange(); });
  el.querySelector("#fitToggle").addEventListener("click", () => {
    state.styleFit = !state.styleFit;
    if (state.styleFit) { state.lastFitGenre = ""; autoFitSounds(state, { reRoll: false }); }
    else unhideAllSoundCards(state, SOUND_CARDS);
    afterChange();
  });
  el.querySelector("#structToggle").addEventListener("click", () => { state.structure = !state.structure; afterChange(); });
  el.querySelector("#influenceSel").addEventListener("change", e => { state.influence = e.target.value; afterChange(); });
  el.querySelector("#durationSel").addEventListener("change", e => { state.duration = e.target.value; afterChange(); });
  el.querySelector("#forceSel").addEventListener("change", e => { state.melodicForce = e.target.value; afterChange(); });
  el.querySelector("#seedChip").addEventListener("click", () => {
    copyText(location.origin + location.pathname + "?s=" + encodeState(state), "Share link");
  });
}

/* ---------------------------- cards ---------------------------- */
function cardHtml(def) {
  const hidden = !!state.hidden[def.id];
  const head = `
    <div class="head">
      <h2>${def.title}</h2>
      ${def.scope ? `<button class="iconbtn" data-cardroll="${def.scope}" title="Roll this section">🎲</button>
      <button class="iconbtn" data-cardmax="${def.scope}" title="Maximize this section">⭐</button>` : ""}
      <button class="iconbtn ${hidden ? "on" : ""}" data-cardhide="${def.id}" title="${hidden ? "Show in prompt" : "Hide from prompt"}">${hidden ? "🙈" : "👁"}</button>
    </div>`;
  if (def.id === "layersCard") {
    return `<div class="card ${hidden ? "hiddenCard" : ""}" id="${def.id}">${head}
      <div id="layersWrap">${LAYERS.map(l =>
        `<span class="chip ${state.layers[l.id] ? "on" : ""}" data-layer="${l.id}" title="${escapeHtml(l.phrase)}">${escapeHtml(l.label)}</span>`).join("")}
      </div></div>`;
  }
  const rows = (ATOMS_BY_CARD[def.id] || []).map(a => {
    const locked = !!state.locks[a.key];
    const pickable = !!a.pickEntry;
    const rowHide = (a.key === "bpm" || a.key === "key")
      ? `<button class="iconbtn ${state.hidden[a.key] ? "on" : ""}" data-rowhide="${a.key}" title="Hide ${a.key} from prompt">${state.hidden[a.key] ? "🙈" : "👁"}</button>` : "";
    return `<div class="row ${locked ? "locked" : ""}">
      <span class="lab">${escapeHtml(a.label)}</span>
      <span class="val">${escapeHtml(atomValue(a) ?? "")}</span>
      <span class="ops">
        <button class="iconbtn" data-roll="${a.key}" title="Roll">🎲</button>
        <button class="iconbtn ${locked ? "on" : ""}" data-lock="${a.key}" title="${locked ? "Unlock" : "Lock"}">${locked ? "🔒" : "🔓"}</button>
        ${pickable ? `<button class="iconbtn" data-pick="${a.key}" title="Pick manually">☰</button>` : ""}
        ${rowHide}
      </span>
    </div>`;
  }).join("");
  return `<div class="card ${hidden ? "hiddenCard" : ""}" id="${def.id}">${head}<div class="rows">${rows}</div></div>`;
}

function renderCards() {
  $("#cards").innerHTML = CARD_DEFS.map(cardHtml).join("");
}

/* ---------------------------- output ---------------------------- */
let currentTab = "style";
function renderOutput() {
  const host = $("#output");
  const sp = buildStylePrompt(state);
  const fb = buildFullBrief(state);
  const text = currentTab === "style" ? sp : fb;
  const cap = currentTab === "style" ? 1000 : 3000;
  const score = scorePrompt(state);
  host.innerHTML = `
    <div class="card">
      <div id="outTabs">
        <button data-tab="style" class="${currentTab === "style" ? "on" : ""}">Style Prompt</button>
        <button data-tab="brief" class="${currentTab === "brief" ? "on" : ""}">Full Brief</button>
      </div>
      <div id="outbox">${escapeHtml(text)}</div>
      <div id="outmeta">
        <button class="btn small" id="copyOutBtn">📋 Copy</button>
        <button class="btn small" id="shareBtn">🔗 Share link</button>
        <span id="charCount" class="${text.length > cap ? "warn" : ""}">${text.length} / ${cap}</span>
        <span id="scoreChip" title="${score.items.map(i => i.label + " " + i.score).join(" · ")}">score ${score.total}</span>
      </div>
    </div>`;
  host.querySelector("#outTabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    currentTab = b.dataset.tab; renderOutput();
  });
  host.querySelector("#copyOutBtn").addEventListener("click", () => copyText(text, currentTab === "style" ? "Style Prompt" : "Full Brief"));
  host.querySelector("#shareBtn").addEventListener("click", () =>
    copyText(location.origin + location.pathname + "?s=" + encodeState(state), "Share link"));
}

export function render() {
  renderTopbar();
  renderCards();
  renderOutput();
}

/* ---------------------------- events ---------------------------- */
function initEvents() {
  $("#cards").addEventListener("click", e => {
    const t = e.target.closest("[data-roll],[data-lock],[data-pick],[data-cardroll],[data-cardmax],[data-cardhide],[data-rowhide],[data-layer]");
    if (!t) return;
    if (t.dataset.roll) return doRoll(t.dataset.roll);
    if (t.dataset.lock) return toggleLock(t.dataset.lock);
    if (t.dataset.pick) return openPicker(t.dataset.pick, state, afterChange);
    if (t.dataset.cardroll) return doRoll(t.dataset.cardroll);
    if (t.dataset.cardmax) return doRoll(t.dataset.cardmax, "max");
    if (t.dataset.cardhide) return toggleHide(t.dataset.cardhide);
    if (t.dataset.rowhide) return toggleHide(t.dataset.rowhide);
    if (t.dataset.layer) { state.layers[t.dataset.layer] = !state.layers[t.dataset.layer]; afterChange(); }
  });
  document.addEventListener("keydown", e => {
    if (e.target.matches("input,textarea,select")) return;
    if (e.key === "r" || e.key === "R") { doRoll("everything"); }
  });
}

/* ---------------------------- boot ---------------------------- */
ATOMS.forEach(a => {
  const entry = PICKER_POOLS[a.pick || a.key];
  if (entry && (entry.arr || ["style", "key"].includes(entry.type))) a.pickEntry = entry;
});

initEvents();
render();
updateURL();

/* test hook (mirrors the legacy __NF hook, engine-level) */
window.__NF = {
  get: () => state,
  set: s => { state = s; setSeed(state.seed); render(); },
  roll: (scope, opts) => { const r = roll(state, scope, opts); afterChange(); return r; },
  buildStylePrompt: () => buildStylePrompt(state),
  buildFullBrief: () => buildFullBrief(state),
  scorePrompt: () => scorePrompt(state),
  encodeState, decodeState, defaultState
};
